package handler

import (
	"context"
	"log"
	"sync"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	taskWorkerOnce sync.Once
	taskWake       = make(chan struct{}, 1)
	taskSlots      = make(chan struct{}, 4)
)

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
				dispatchPendingTasks()
				recoverStaleSettlements()
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

	var polling []model.GenerationTask
	if err := database.DB.Where("status = ? AND upstream_task_id IS NOT NULL", "running").Find(&polling).Error; err == nil {
		var settings model.ClientSettings
		if database.DB.First(&settings).Error == nil {
			for _, task := range polling {
				if task.UpstreamTaskID != nil {
					go pollUpstreamTask(task, *task.UpstreamTaskID, settings)
				}
			}
		}
	}

	var interrupted []model.GenerationTask
	if err := database.DB.Where("status IN ? AND upstream_task_id IS NULL AND started_at < ?", []string{"running", "dispatching"}, cutoff).Find(&interrupted).Error; err == nil {
		for _, task := range interrupted {
			handleTaskFailure(task.ID, "WORKER_INTERRUPTED", "服务重启导致任务中断，已自动释放冻结积分")
		}
	}
}

func recoverStaleSettlements() {
	cutoff := time.Now().Add(-5 * time.Minute)
	var tasks []model.GenerationTask
	if err := database.DB.Where("status = ? AND started_at < ?", "settling", cutoff).Limit(20).Find(&tasks).Error; err != nil {
		return
	}
	for _, task := range tasks {
		if task.TaskType == "text" && task.FrozenCredits == 0 && task.OutputPayload != nil {
			if err := completeSettledTextTask(task); err != nil {
				log.Printf("[TaskWorker] 恢复文本任务 %s 终态失败: %v", task.ID, err)
			}
			continue
		}
		result := database.DB.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, "settling").Update("status", "running")
		if result.Error == nil && result.RowsAffected == 1 {
			handleTaskFailure(task.ID, "SETTLEMENT_INTERRUPTED", "任务结算中断，已执行补偿处理")
		}
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

func dispatchPendingTasks() {
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
			Updates(map[string]any{"status": "dispatching", "started_at": time.Now()})
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
		task.Status = "dispatching"
		go func(task model.GenerationTask, settings model.ClientSettings) {
			defer func() { <-taskSlots }()
			callUpstreamGateway(task, settings)
		}(task, settings)
	}
}

func claimTaskForSettlement(taskID uuid.UUID) (model.GenerationTask, bool) {
	result := database.DB.Model(&model.GenerationTask{}).
		Where("id = ? AND status IN ?", taskID, []string{"pending", "dispatching", "running"}).
		Update("status", "settling")
	if result.Error != nil || result.RowsAffected != 1 {
		return model.GenerationTask{}, false
	}
	var task model.GenerationTask
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		return model.GenerationTask{}, false
	}
	return task, true
}
