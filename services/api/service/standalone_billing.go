package service

import (
	"errors"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/google/uuid"
)

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

	var ws model.Workspace
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", workspaceID).First(&ws).Error; err != nil {
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

	tx.Commit()
	return true, nil
}

// RefundCredits 释放或退还本地工作区额度
func (s *StandaloneBilling) RefundCredits(userID uuid.UUID, workspaceID uuid.UUID, amount int64, reason string, task *model.GenerationTask) error {
	tx := database.DB.Begin()

	var ws model.Workspace
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", workspaceID).First(&ws).Error; err != nil {
		tx.Rollback()
		return err
	}

	var frozenGift, frozenRefund, frozenRecharge int64

	if task != nil {
		frozenGift = task.FrozenGiftCredits
		frozenRefund = task.FrozenRefundCredits
		frozenRecharge = task.FrozenRechargeCredits

		ws.GiftBalance += frozenGift
		ws.RefundBalance += frozenRefund
		ws.RechargeBalance += frozenRecharge

		// 清空任务上记录的冻结额度
		task.FrozenCredits = 0
		task.FrozenGiftCredits = 0
		task.FrozenRefundCredits = 0
		task.FrozenRechargeCredits = 0
		if err := tx.Save(task).Error; err != nil {
			tx.Rollback()
			return err
		}
	} else {
		// 如果任务为空，默认退还到 GiftBalance
		frozenGift = amount
		ws.GiftBalance += amount
	}

	// 保存工作区余额
	if err := tx.Save(&ws).Error; err != nil {
		tx.Rollback()
		return err
	}

	// 记录退款流水
	transaction := model.CreditTransaction{
		ID:              uuid.New(),
		WorkspaceID:     workspaceID,
		UserID:          &userID,
		TransactionType: "refund",
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
		return err
	}

	tx.Commit()
	return nil
}
