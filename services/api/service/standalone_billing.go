package service

import (
	"errors"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// forUpdateSvc 条件化地在查询上添加 FOR UPDATE 行锁
func forUpdateSvc(tx *gorm.DB) *gorm.DB {
	if database.IsSQLite {
		return tx
	}
	return tx.Clauses(clause.Locking{Strength: clause.LockingStrengthUpdate})
}

// StandaloneBilling 本地独立计费模式实现
type StandaloneBilling struct{}

func NewStandaloneBilling() *StandaloneBilling {
	return &StandaloneBilling{}
}

// GetBalance 查询本地工作区余额
func (s *StandaloneBilling) GetBalance(userID uuid.UUID, workspaceID uuid.UUID) (float64, error) {
	var ws model.Workspace
	if err := database.DB.Where("id = ?", workspaceID).First(&ws).Error; err != nil {
		return 0, err
	}
	return float64(ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance), nil
}

// DeductCredits 本地工作区余额预扣减/冻结
func (s *StandaloneBilling) DeductCredits(userID uuid.UUID, workspaceID uuid.UUID, amount int64, reason string, task *model.GenerationTask) (bool, error) {
	tx := database.DB.Begin()
	if tx.Error != nil {
		return false, tx.Error
	}

	var ws model.Workspace
	if err := forUpdateSvc(tx).Where("id = ?", workspaceID).First(&ws).Error; err != nil {
		tx.Rollback()
		return false, err
	}

	total := ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance
	if total < amount {
		tx.Rollback()
		return false, nil // 余额不足，返回 false，不抛错
	}

	// 扣减优先级: 赠送余额 -> 退款余额 -> 充值余额
	var frozenGift, frozenRefund, frozenRecharge int64
	remainingToFreeze := amount

	if ws.GiftBalance >= remainingToFreeze {
		frozenGift = remainingToFreeze
		ws.GiftBalance -= remainingToFreeze
		remainingToFreeze = 0
	} else {
		frozenGift = ws.GiftBalance
		remainingToFreeze -= ws.GiftBalance
		ws.GiftBalance = 0
	}

	if remainingToFreeze > 0 {
		if ws.RefundBalance >= remainingToFreeze {
			frozenRefund = remainingToFreeze
			ws.RefundBalance -= remainingToFreeze
			remainingToFreeze = 0
		} else {
			frozenRefund = ws.RefundBalance
			remainingToFreeze -= ws.RefundBalance
			ws.RefundBalance = 0
		}
	}

	if remainingToFreeze > 0 {
		if ws.RechargeBalance >= remainingToFreeze {
			frozenRecharge = remainingToFreeze
			ws.RechargeBalance -= remainingToFreeze
			remainingToFreeze = 0
		} else {
			tx.Rollback()
			return false, errors.New("防超卖：最终校验时充值余额不足")
		}
	}

	// 保存工作区余额
	if err := tx.Save(&ws).Error; err != nil {
		tx.Rollback()
		return false, err
	}

	// 记录任务冻结积分
	if task != nil {
		task.FrozenCredits = amount
		task.FrozenGiftCredits = frozenGift
		task.FrozenRefundCredits = frozenRefund
		task.FrozenRechargeCredits = frozenRecharge
		if err := tx.Model(&model.GenerationTask{}).Where("id = ?", task.ID).Updates(map[string]any{
			"frozen_credits": amount, "frozen_gift_credits": frozenGift,
			"frozen_refund_credits": frozenRefund, "frozen_recharge_credits": frozenRecharge,
		}).Error; err != nil {
			tx.Rollback()
			return false, err
		}
	}

	// 记录点数冻结流水
	transaction := model.CreditTransaction{
		ID:              uuid.New(),
		WorkspaceID:     workspaceID,
		UserID:          &userID,
		TransactionType: "freeze",
		Amount:          amount,
		GiftAmount:      frozenGift,
		RefundAmount:    frozenRefund,
		RechargeAmount:  frozenRecharge,
		BalanceAfter:    ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
		Reason:          &reason,
		CreatedAt:       time.Now(),
	}

	if task != nil {
		transaction.TaskID = &task.ID
		transaction.ProjectID = &task.ProjectID
	}

	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		return false, err
	}

	if err := tx.Commit().Error; err != nil {
		return false, err
	}
	return true, nil
}

// RefundCredits 释放或退还本地工作区额度
func (s *StandaloneBilling) RefundCredits(userID uuid.UUID, workspaceID uuid.UUID, amount int64, reason string, task *model.GenerationTask) error {
	if task == nil {
		return refundWithoutTask(userID, workspaceID, amount, reason)
	}
	return database.DB.Transaction(func(tx *gorm.DB) error {
		var dbTask model.GenerationTask
		if err := forUpdateSvc(tx).Where("id = ?", task.ID).First(&dbTask).Error; err != nil {
			return err
		}
		consumed, err := taskTransactionExists(tx, task.ID, "consume")
		if err != nil {
			return err
		}
		if consumed {
			copyTaskBillingFields(task, dbTask)
			return ErrAlreadySettled
		}
		refunded, err := taskTransactionExists(tx, task.ID, "refund")
		if err != nil {
			return err
		}
		if refunded || dbTask.FrozenCredits <= 0 {
			copyTaskBillingFields(task, dbTask)
			return nil
		}

		var ws model.Workspace
		if err := forUpdateSvc(tx).Where("id = ?", workspaceID).First(&ws).Error; err != nil {
			return err
		}

		frozenGift := dbTask.FrozenGiftCredits
		frozenRefund := dbTask.FrozenRefundCredits
		frozenRecharge := dbTask.FrozenRechargeCredits
		ws.GiftBalance += frozenGift
		ws.RefundBalance += frozenRefund
		ws.RechargeBalance += frozenRecharge
		if err := tx.Save(&ws).Error; err != nil {
			return err
		}

		cleared := tx.Model(&model.GenerationTask{}).Where("id = ? AND frozen_credits > 0", task.ID).Updates(map[string]any{
			"frozen_credits": 0, "frozen_gift_credits": 0,
			"frozen_refund_credits": 0, "frozen_recharge_credits": 0,
		})
		if cleared.Error != nil {
			return cleared.Error
		}
		if cleared.RowsAffected != 1 {
			return errors.New("任务冻结积分已被并发结转或退回")
		}
		copyTaskBillingFields(task, dbTask)
		task.FrozenCredits = 0
		task.FrozenGiftCredits = 0
		task.FrozenRefundCredits = 0
		task.FrozenRechargeCredits = 0

		refundAmount := amount
		if refundAmount <= 0 {
			refundAmount = dbTask.FrozenCredits
		}
		transaction := model.CreditTransaction{
			ID: uuid.New(), WorkspaceID: workspaceID, UserID: &userID,
			ProjectID: &task.ProjectID, TaskID: &task.ID, TransactionType: "refund",
			Amount: refundAmount, GiftAmount: frozenGift, RefundAmount: frozenRefund,
			RechargeAmount: frozenRecharge, BalanceAfter: ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
			Reason: &reason, CreatedAt: time.Now(),
		}
		return tx.Create(&transaction).Error
	})
}

func refundWithoutTask(userID uuid.UUID, workspaceID uuid.UUID, amount int64, reason string) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		var ws model.Workspace
		if err := forUpdateSvc(tx).Where("id = ?", workspaceID).First(&ws).Error; err != nil {
			return err
		}
		ws.GiftBalance += amount
		if err := tx.Save(&ws).Error; err != nil {
			return err
		}
		transaction := model.CreditTransaction{
			ID: uuid.New(), WorkspaceID: workspaceID, UserID: &userID,
			TransactionType: "refund", Amount: amount, GiftAmount: amount,
			BalanceAfter: ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
			Reason: &reason, CreatedAt: time.Now(),
		}
		return tx.Create(&transaction).Error
	})
}

func (s *StandaloneBilling) SettleCredits(userID uuid.UUID, workspaceID uuid.UUID, actualAmount int64, reason string, task *model.GenerationTask) error {
	if task == nil {
		return errors.New("任务结算缺少任务记录")
	}
	if actualAmount < 0 {
		actualAmount = 0
	}
	return database.DB.Transaction(func(tx *gorm.DB) error {
		var dbTask model.GenerationTask
		if err := forUpdateSvc(tx).Where("id = ?", task.ID).First(&dbTask).Error; err != nil {
			return err
		}
		consumed, err := taskTransactionExists(tx, task.ID, "consume")
		if err != nil {
			return err
		}
		if consumed {
			copyTaskBillingFields(task, dbTask)
			return nil
		}
		refunded, err := taskTransactionExists(tx, task.ID, "refund")
		if err != nil {
			return err
		}
		if refunded {
			copyTaskBillingFields(task, dbTask)
			return ErrAlreadyRefunded
		}
		if dbTask.FrozenCredits <= 0 {
			return errors.New("任务已无冻结积分，无法结算")
		}

		var ws model.Workspace
		if err := forUpdateSvc(tx).Where("id = ?", workspaceID).First(&ws).Error; err != nil {
			return err
		}

		remaining := actualAmount
		consumeGift := minInt64(dbTask.FrozenGiftCredits, remaining)
		remaining -= consumeGift
		consumeRefund := minInt64(dbTask.FrozenRefundCredits, remaining)
		remaining -= consumeRefund
		consumeRecharge := minInt64(dbTask.FrozenRechargeCredits, remaining)
		remaining -= consumeRecharge

		ws.GiftBalance += dbTask.FrozenGiftCredits - consumeGift
		ws.RefundBalance += dbTask.FrozenRefundCredits - consumeRefund
		ws.RechargeBalance += dbTask.FrozenRechargeCredits - consumeRecharge

		if remaining > 0 {
			if !deductAdditionalBalance(&ws, remaining) {
				return errors.New("实际消费超过预冻结额度且余额不足")
			}
		}
		if err := tx.Save(&ws).Error; err != nil {
			return err
		}

		cleared := tx.Model(&model.GenerationTask{}).Where("id = ? AND frozen_credits > 0", task.ID).Updates(map[string]any{
			"actual_credits": actualAmount, "frozen_credits": 0, "frozen_gift_credits": 0,
			"frozen_refund_credits": 0, "frozen_recharge_credits": 0,
		})
		if cleared.Error != nil {
			return cleared.Error
		}
		if cleared.RowsAffected != 1 {
			return errors.New("任务冻结积分已被并发结转或退回")
		}

		task.ActualCredits = actualAmount
		task.FrozenCredits = 0
		task.FrozenGiftCredits = 0
		task.FrozenRefundCredits = 0
		task.FrozenRechargeCredits = 0

		transaction := model.CreditTransaction{
			ID: uuid.New(), WorkspaceID: workspaceID, UserID: &userID,
			ProjectID: &task.ProjectID, TaskID: &task.ID, TransactionType: "consume",
			Amount: actualAmount, BalanceAfter: ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
			Reason: &reason, CreatedAt: time.Now(),
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return err
		}
		return tx.Model(&model.Project{}).Where("id = ? AND workspace_id = ?", task.ProjectID, workspaceID).
			UpdateColumn("consumed_credits", gorm.Expr("consumed_credits + ?", actualAmount)).Error
	})
}

func taskTransactionExists(tx *gorm.DB, taskID uuid.UUID, txType string) (bool, error) {
	var n int64
	err := tx.Model(&model.CreditTransaction{}).
		Where("task_id = ? AND transaction_type = ?", taskID, txType).
		Count(&n).Error
	return n > 0, err
}

func copyTaskBillingFields(dst *model.GenerationTask, src model.GenerationTask) {
	dst.ActualCredits = src.ActualCredits
	dst.FrozenCredits = src.FrozenCredits
	dst.FrozenGiftCredits = src.FrozenGiftCredits
	dst.FrozenRefundCredits = src.FrozenRefundCredits
	dst.FrozenRechargeCredits = src.FrozenRechargeCredits
}

func minInt64(left, right int64) int64 {
	if left < right {
		return left
	}
	return right
}

func deductAdditionalBalance(ws *model.Workspace, amount int64) bool {
	remaining := amount
	for _, balance := range []*int64{&ws.GiftBalance, &ws.RefundBalance, &ws.RechargeBalance} {
		used := minInt64(*balance, remaining)
		*balance -= used
		remaining -= used
		if remaining == 0 {
			return true
		}
	}
	return false
}
