package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"
	"reveria/services/api/service"

	"github.com/google/uuid"
)

// handleTaskSuccess 任务成功，下载素材并退还剩余积分
func handleTaskSuccess(task model.GenerationTask, upstreamURLs []string) {
	log.Printf("[TaskSucceeded] 任务 %s 生成成功，开始本地化下载...", task.ID)

	downloadClient := &http.Client{
		Transport: insecureTransport,
		Timeout:   60 * time.Second,
	}

	var metaStr string
	var lastMetaStr string

	totalCount := len(upstreamURLs)
	// 循环下载每一个生成的图片，落地并存入资产库
	for idx, url := range upstreamURLs {
		if url == "" {
			continue
		}

		// 每次下载，向 DB 写入当前的下载落地进度，让前端能实时呈现 (已完成 1/6)
		progressText := fmt.Sprintf("AI 画面生成完毕，正在下载本地化 (已完成 %d/%d)...", idx, totalCount)
		progressJSON := fmt.Sprintf(`{"progress_text":%q}`, progressText)
		database.DB.Model(&task).Update("output_payload", progressJSON)
		resp, err := downloadClient.Get(url)
		if err != nil || resp.StatusCode != http.StatusOK {
			if resp != nil {
				resp.Body.Close()
			}
			continue
		}

		fileBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}

		storageDir := getStorageDir()
		_ = os.MkdirAll(storageDir, 0755)

		ext := ".jpg"
		if task.TaskType == "video_generation" || task.TaskType == "image_to_video" {
			ext = ".mp4"
		}
		storedName := uuid.New().String() + ext
		storagePath := filepath.Join(storageDir, storedName)
		_ = os.WriteFile(storagePath, fileBytes, 0644)

		localURL := "/api/files/" + storedName

		var localThumbURL *string
		if ext == ".jpg" {
			thumbBytes, err := resizeImage(fileBytes, 320)
			if err == nil {
				thumbName := uuid.New().String() + "-thumb.jpg"
				thumbPath := filepath.Join(storageDir, thumbName)
				if err := os.WriteFile(thumbPath, thumbBytes, 0644); err == nil {
					u := "/api/files/" + thumbName
					localThumbURL = &u
				}
			}
		}

		// 读取任务输入参数，提取 prompt 等元信息
		var prompt string
		var paramSize string
		var quality string
		var modelName string

		var inputPayload map[string]any
		if json.Unmarshal([]byte(task.InputPayload), &inputPayload) == nil {
			prompt, _ = inputPayload["prompt"].(string)
			paramSize, _ = inputPayload["size"].(string)
			quality, _ = inputPayload["quality"].(string)
		}

		if task.SelectedModel != nil {
			var dbModel model.Model
			if database.DB.Where("id = ?", *task.SelectedModel).First(&dbModel).Error == nil {
				modelName = dbModel.DisplayName
				if modelName == "" {
					modelName = dbModel.Name
				}
			} else {
				modelName = *task.SelectedModel
			}
		}

		mimeType := "image/jpeg"
		if ext == ".mp4" {
			mimeType = "video/mp4"
		}

		refImgURL, _ := inputPayload["ref_image_url"].(string)

		metaMap := map[string]any{
			"task_id":       task.ID.String(),
			"file_name":     storedName,
			"url":           localURL,
			"title":         "AI 创意生成结果",
			"size":          len(fileBytes),
			"mime_type":     mimeType,
			"prompt":        prompt,
			"size_str":      paramSize,
			"dimensions":    paramSize,
			"quality":       quality,
			"model":         modelName,
			"ref_image_url": refImgURL,
		}
		metaBytes, _ := json.Marshal(metaMap)
		metaStr = string(metaBytes)
		lastMetaStr = metaStr

		// 构建 Asset 数据模型并写入数据库
		asset := model.Asset{
			ID:           uuid.New(),
			WorkspaceID:  task.WorkspaceID,
			ProjectID:    task.ProjectID,
			AssetType:    assetTypeFromExt(ext),
			Source:       "generated",
			FileURL:      localURL,
			ThumbnailURL: localThumbURL,
			Metadata:     &metaStr,
			CreatedAt:    time.Now(),
		}
		_ = database.DB.Create(&asset)
	}

	// 4. 积分正式扣减结算事务
	tx := database.DB.Begin()

	task.Status = "succeeded"
	task.OutputPayload = &lastMetaStr
	task.CompletedAt = ptrTime(time.Now())

	// 扣减结算
	tx.Save(&task)

	// 将预扣积分从 workspace 的冻结状态标记为已消费，这里释放冻结字段
	task.ActualCredits = task.EstimatedCredits
	task.FrozenCredits = 0
	task.FrozenGiftCredits = 0
	task.FrozenRefundCredits = 0
	task.FrozenRechargeCredits = 0
	tx.Save(&task)

	// 记录正式消费流水
	consumeReason := fmt.Sprintf("AI 生成任务 %s 完成扣费", task.TaskType)
	var ws model.Workspace
	tx.Where("id = ?", task.WorkspaceID).First(&ws)
	transaction := model.CreditTransaction{
		ID:              uuid.New(),
		WorkspaceID:     task.WorkspaceID,
		UserID:          task.UserID,
		ProjectID:       &task.ProjectID,
		TaskID:          &task.ID,
		TransactionType: "consume",
		Amount:          task.ActualCredits,
		BalanceAfter:    ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
		Reason:          &consumeReason,
		CreatedAt:       time.Now(),
	}
	tx.Create(&transaction)

	tx.Commit()
	log.Printf("[TaskSucceeded] 任务 %s 结算完成，已归档资产。", task.ID)
}

// handleTaskFailure 任务失败，执行退款并更新状态
func handleTaskFailure(taskID uuid.UUID, errorCode string, errorMsg string) {
	log.Printf("[TaskFailed] 任务 %s 失败: [%s] %s，正在执行退款...", taskID, errorCode, errorMsg)

	var task model.GenerationTask
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		return
	}

	if task.Status != "running" && task.Status != "pending" {
		return // 防止重复结算
	}

	// 统一账务接口进行退额/退款
	billingSvc := service.GetBillingService()
	actorID := uuid.Nil
	if task.UserID != nil {
		actorID = *task.UserID
	}

	refundReason := fmt.Sprintf("生成任务 %s 失败，原路退回冻结积分", taskID.String())
	err := billingSvc.RefundCredits(actorID, task.WorkspaceID, task.EstimatedCredits, refundReason, &task)
	if err != nil {
		log.Printf("[TaskFailed] 积分退回失败: %v", err)
	}

	// 更新任务状态为失败
	task.Status = "failed"
	task.ErrorCode = &errorCode
	task.ErrorMessage = &errorMsg
	task.CompletedAt = ptrTime(time.Now())
	database.DB.Save(&task)

	log.Printf("[TaskFailed] 任务 %s 退款流程闭环完成。", taskID)
}

func assetTypeFromExt(ext string) string {
	ext = strings.ToLower(ext)
	if ext == ".mp4" || ext == ".mov" || ext == ".webm" {
		return "video"
	}
	return "image"
}

func ptrTime(t time.Time) *time.Time {
	return &t
}
