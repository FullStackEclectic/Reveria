package handler

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"
	"reveria/services/api/service"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	taskWorkerOnce sync.Once
	taskWake       = make(chan struct{}, 1)
	taskSlots      = make(chan struct{}, 4)
	taskWorkerID   = uuid.NewString()
)

const taskLeaseDuration = 30 * time.Second

// StartTaskWorker 从数据库恢复并分发任务，数据库记录是队列的持久化事实来源。
func StartTaskWorker(ctx context.Context) {
	taskWorkerOnce.Do(func() {
		recoverInterruptedTasks()
		go func() {
			ticker := time.NewTicker(3 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
				case <-taskWake:
				}
				dispatchPendingTasks(ctx)
				recoverPollingTasks(ctx)
				recoverStaleSettlements()
				recoverRefundingTasks()
			}
		}()
	})
}

func EnqueueTask(_ uuid.UUID) {
	select {
	case taskWake <- struct{}{}:
	default:
	}
}

func recoverInterruptedTasks() {
	cutoff := time.Now().Add(-2 * time.Minute)
	var initializing []model.GenerationTask
	if err := database.DB.Where("status = ? AND created_at < ?", "initializing", cutoff).Find(&initializing).Error; err == nil {
		for _, task := range initializing {
			if task.FrozenCredits > 0 {
				database.DB.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, "initializing").Update("status", "running")
				handleTaskFailure(task.ID, "INITIALIZATION_INTERRUPTED", "任务初始化中断，已自动释放冻结积分")
			} else {
				database.DB.Delete(&task)
			}
		}
	}

	var interrupted []model.GenerationTask
	if err := database.DB.Where(
		"status IN ? AND upstream_task_id IS NULL AND started_at < ? AND (lease_until IS NULL OR lease_until < ?)",
		[]string{"running", "dispatching"}, cutoff, time.Now(),
	).Find(&interrupted).Error; err == nil {
		for _, task := range interrupted {
			handleTaskFailure(task.ID, "WORKER_INTERRUPTED", "服务重启导致任务中断，已自动释放冻结积分")
		}
	}
}

func recoverPollingTasks(ctx context.Context) {
	var tasks []model.GenerationTask
	now := time.Now()
	if err := database.DB.Where(
		"status = ? AND upstream_task_id IS NOT NULL AND (lease_until IS NULL OR lease_until < ?)",
		"running", now,
	).Order("started_at asc").Limit(20).Find(&tasks).Error; err != nil {
		return
	}
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err != nil {
		return
	}
	for _, task := range tasks {
		leaseUntil := now.Add(taskLeaseDuration)
		claimed := database.DB.Model(&model.GenerationTask{}).
			Where("id = ? AND status = ? AND upstream_task_id IS NOT NULL AND (lease_until IS NULL OR lease_until < ?)", task.ID, "running", now).
			Updates(map[string]any{"worker_id": taskWorkerID, "lease_until": leaseUntil})
		if claimed.Error != nil || claimed.RowsAffected != 1 || task.UpstreamTaskID == nil {
			continue
		}
		pollSettings, err := resolveTaskPollingSettings(task, settings)
		if err != nil {
			database.DB.Model(&model.GenerationTask{}).
				Where("id = ? AND status = ? AND worker_id = ?", task.ID, "running", taskWorkerID).
				Updates(map[string]any{"worker_id": nil, "lease_until": time.Now().Add(time.Minute)})
			log.Printf("[TaskWorker] 恢复任务 %s 的上游配置失败: %v", task.ID, err)
			continue
		}
		go pollUpstreamTask(ctx, task, *task.UpstreamTaskID, pollSettings)
	}
}

func renewTaskLease(taskID uuid.UUID) bool {
	result := database.DB.Model(&model.GenerationTask{}).
		Where("id = ? AND status = ? AND worker_id = ?", taskID, "running", taskWorkerID).
		Update("lease_until", time.Now().Add(taskLeaseDuration))
	return result.Error == nil && result.RowsAffected == 1
}

func recoverStaleSettlements() {
	var tasks []model.GenerationTask
	if err := database.DB.Where("status = ?", "settling").Limit(20).Find(&tasks).Error; err != nil {
		return
	}
	for _, task := range tasks {
		retrySettlingTask(task)
	}
}

func retrySettlingTask(task model.GenerationTask) {
	if task.TaskType == "text" && task.FrozenCredits == 0 && task.OutputPayload != nil {
		if err := completeSettledTextTask(task); err != nil {
			log.Printf("[TaskWorker] 恢复文本任务 %s 终态失败: %v", task.ID, err)
		}
		return
	}
	var assetCount int64
	if err := database.DB.Model(&model.Asset{}).Where("task_id = ?", task.ID).Count(&assetCount).Error; err != nil {
		return
	}
	if assetCount == 0 {
		result := database.DB.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, "settling").Update("status", "running")
		if result.Error == nil && result.RowsAffected == 1 {
			handleTaskFailure(task.ID, "SETTLEMENT_INTERRUPTED", "任务结算中断且未保存生成结果，已执行补偿退款")
		}
		return
	}
	if task.FrozenCredits == 0 {
		now := time.Now()
		_ = database.DB.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, "settling").
			Updates(map[string]any{"status": "succeeded", "completed_at": now}).Error
		return
	}
	if task.UserID == nil {
		log.Printf("[TaskWorker] 结算任务 %s 缺少用户，无法重试扣费", task.ID)
		return
	}
	consumeReason := fmt.Sprintf("AI 生成任务 %s 完成扣费", task.TaskType)
	if err := service.GetBillingService().SettleCredits(*task.UserID, task.WorkspaceID, task.EstimatedCredits, consumeReason, &task); err != nil {
		log.Printf("[TaskWorker] 重试结算任务 %s 失败: %v", task.ID, err)
		return
	}
	now := time.Now()
	if err := database.DB.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, "settling").
		Updates(map[string]any{"status": "succeeded", "completed_at": now}).Error; err != nil {
		log.Printf("[TaskWorker] 结算成功但回写任务 %s 终态失败: %v", task.ID, err)
	}
}

func recoverRefundingTasks() {
	var tasks []model.GenerationTask
	if err := database.DB.Where("status = ?", "refunding").Limit(20).Find(&tasks).Error; err != nil {
		return
	}
	for _, task := range tasks {
		if task.FrozenCredits > 0 {
			actorID := uuid.Nil
			if task.UserID != nil {
				actorID = *task.UserID
			}
			reason := fmt.Sprintf("生成任务 %s 失败，原路退回冻结积分", task.ID.String())
			if err := service.GetBillingService().RefundCredits(actorID, task.WorkspaceID, task.EstimatedCredits, reason, &task); err != nil {
				log.Printf("[TaskWorker] 重试退款任务 %s 失败: %v", task.ID, err)
				continue
			}
		}
		cleanupTaskAssets(task.ID)
		errorCode := "REFUND_RECOVERED"
		errorMsg := "任务失败后的退款已补齐"
		if task.ErrorCode != nil {
			errorCode = *task.ErrorCode
		}
		if task.ErrorMessage != nil {
			errorMsg = *task.ErrorMessage
		}
		now := time.Now()
		_ = database.DB.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, "refunding").Updates(map[string]any{
			"status": "failed", "error_code": errorCode, "error_message": errorMsg, "completed_at": now,
		}).Error
	}
}

func completeSettledTextTask(task model.GenerationTask) error {
	return database.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		result := tx.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, "settling").
			Updates(map[string]any{"status": "succeeded", "completed_at": now})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return gorm.ErrRecordNotFound
		}
		asset := model.Asset{
			ID: uuid.New(), WorkspaceID: task.WorkspaceID, ProjectID: task.ProjectID,
			TaskID: &task.ID, OutputIndex: 0, AssetType: "document", Source: "generated",
			FileURL: "", Metadata: task.OutputPayload, CreatedAt: now,
		}
		return tx.Where("task_id = ? AND output_index = ?", task.ID, 0).FirstOrCreate(&asset).Error
	})
}

func dispatchPendingTasks(ctx context.Context) {
	var tasks []model.GenerationTask
	if err := database.DB.Where("status = ?", "pending").Order("created_at asc").Limit(8).Find(&tasks).Error; err != nil {
		log.Printf("[TaskWorker] 扫描待处理任务失败: %v", err)
		return
	}
	for _, task := range tasks {
		select {
		case taskSlots <- struct{}{}:
		default:
			return
		}
		claimed := database.DB.Model(&model.GenerationTask{}).
			Where("id = ? AND status = ?", task.ID, "pending").
			Updates(map[string]any{
				"status":        "dispatching",
				"started_at":    time.Now(),
				"worker_id":     taskWorkerID,
				"lease_until":   time.Now().Add(taskLeaseDuration),
				"attempt_count": gorm.Expr("attempt_count + 1"),
			})
		if claimed.Error != nil || claimed.RowsAffected != 1 {
			<-taskSlots
			continue
		}
		var settings model.ClientSettings
		if err := database.DB.First(&settings).Error; err != nil {
			<-taskSlots
			handleTaskFailure(task.ID, "SETTINGS_UNAVAILABLE", "无法加载上游配置")
			continue
		}
		if settings.UpstreamCircuitOpenedAt != nil {
			<-taskSlots
			handleTaskFailure(task.ID, "UPSTREAM_CIRCUIT_OPEN", upstreamCircuitMessage)
			continue
		}
		task.Status = "dispatching"
		go func(task model.GenerationTask, settings model.ClientSettings) {
			defer func() { <-taskSlots }()
			callUpstreamGateway(ctx, task, settings)
		}(task, settings)
	}
}

func claimTaskForSettlement(taskID uuid.UUID) (model.GenerationTask, bool) {
	result := database.DB.Model(&model.GenerationTask{}).
		Where("id = ? AND status IN ?", taskID, []string{"pending", "dispatching", "running"}).
		Updates(map[string]any{"status": "settling", "worker_id": nil, "lease_until": nil})
	if result.Error != nil || result.RowsAffected != 1 {
		return model.GenerationTask{}, false
	}
	var task model.GenerationTask
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		return model.GenerationTask{}, false
	}
	return task, true
}
