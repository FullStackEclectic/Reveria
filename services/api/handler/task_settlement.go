package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
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
	claimedTask, claimed := claimTaskForSettlement(task.ID)
	if !claimed {
		log.Printf("[TaskSucceeded] 忽略任务 %s 的重复成功回调", task.ID)
		return
	}
	task = claimedTask
	log.Printf("[TaskSucceeded] 任务 %s 生成成功，开始本地化下载...", task.ID)

	downloadClient := &http.Client{
		Transport: insecureTransport,
		Timeout:   60 * time.Second,
	}

	var metaStr string
	var lastMetaStr string
	var inputPayload map[string]any
	_ = json.Unmarshal([]byte(task.InputPayload), &inputPayload)
	scenes := parseGenerationScenes(inputPayload)

	totalCount := len(upstreamURLs)
	createdAssetCount := 0
	// 循环下载每一个生成的图片，落地并存入资产库
	for idx, url := range upstreamURLs {
		if url == "" {
			continue
		}
		// 每次下载，向 DB 写入当前的下载落地进度，让前端能实时呈现 (已完成 1/6)
		progressText := fmt.Sprintf("AI 画面生成完毕，正在下载本地化 (已完成 %d/%d)...", idx, totalCount)
		progressJSON := fmt.Sprintf(`{"progress_text":%q}`, progressText)
		database.DB.Model(&task).Update("output_payload", progressJSON)

		var fileBytes []byte
		contentType := "image/jpeg"
		var err error
		if strings.HasPrefix(url, "data:") {
			fileBytes, contentType, err = decodeImageDataURL(url)
			if err != nil {
				log.Printf("[TaskSucceeded] 解码图片 %d/%d 的 Base64 数据失败: %v", idx+1, totalCount, err)
				continue
			}
		} else {
			if !isSafeRemoteURL(url) {
				log.Printf("[TaskSucceeded] 拒绝下载不安全的结果 URL")
				continue
			}
			log.Printf("[TaskSucceeded] 开始下载图片 %d/%d: %s", idx+1, totalCount, url)
			resp, downloadErr := downloadClient.Get(url)
			if downloadErr != nil {
				log.Printf("[TaskSucceeded] 下载图片 %d/%d 失败 (网络错误): %v, URL: %s", idx+1, totalCount, downloadErr, url)
				continue
			}
			if resp.StatusCode != http.StatusOK {
				log.Printf("[TaskSucceeded] 下载图片 %d/%d 失败 (HTTP %d), URL: %s", idx+1, totalCount, resp.StatusCode, url)
				resp.Body.Close()
				continue
			}
			fileBytes, err = io.ReadAll(io.LimitReader(resp.Body, maxUploadBytes()+1))
			contentType = resp.Header.Get("Content-Type")
			resp.Body.Close()
		}
		if err != nil {
			continue
		}
		if task.TaskType == "image_background_removal" {
			if err := validateTransparentPNG(fileBytes); err != nil {
				log.Printf("[TaskSucceeded] 抠图结果 %d/%d 不符合透明 PNG 契约: %v", idx+1, totalCount, err)
				continue
			}
			if err := validateCutoutAspect(fileBytes, inputPayload); err != nil {
				log.Printf("[TaskSucceeded] 抠图结果 %d/%d 宽高比不匹配: %v", idx+1, totalCount, err)
				continue
			}
			contentType = "image/png"
		}
		if int64(len(fileBytes)) > maxUploadBytes() {
			log.Printf("[TaskSucceeded] 结果文件超过允许大小")
			continue
		}
		if !reserveStorage(task.WorkspaceID, int64(len(fileBytes))) {
			log.Printf("[TaskSucceeded] 工作区存储空间不足，跳过结果 %d/%d", idx+1, totalCount)
			continue
		}

		storageDir := getStorageDir()
		_ = os.MkdirAll(storageDir, 0750)

		ext := extensionForGeneratedContent(task, contentType, fileBytes)
		storedName := uuid.New().String() + ext
		storagePath := filepath.Join(storageDir, storedName)
		if err := os.WriteFile(storagePath, fileBytes, 0640); err != nil {
			releaseStorage(task.WorkspaceID, int64(len(fileBytes)))
			continue
		}

		localURL := "/api/files/" + storedName

		var localThumbURL *string
		if ext != ".mp4" {
			thumbBytes, err := resizeImage(fileBytes, 320)
			if err == nil {
				thumbName := uuid.New().String() + "-thumb.jpg"
				thumbPath := filepath.Join(storageDir, thumbName)
				if err := os.WriteFile(thumbPath, thumbBytes, 0640); err == nil {
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

		if inputPayload != nil {
			prompt, _ = inputPayload["prompt"].(string)
			paramSize, _ = inputPayload["size"].(string)
			quality, _ = inputPayload["quality"].(string)
		}

		if task.SelectedModel != nil {
			var dbModel model.Model
			modelIdentifier := strings.TrimSpace(*task.SelectedModel)
			lookupErr := database.DB.Where("id = ?", modelIdentifier).First(&dbModel).Error
			if lookupErr != nil {
				lookupErr = database.DB.Where("name = ? AND enabled = true", modelIdentifier).First(&dbModel).Error
			}
			if lookupErr == nil {
				modelName = dbModel.DisplayName
				if modelName == "" {
					modelName = dbModel.Name
				}
			} else {
				modelName = modelIdentifier
			}
		}

		mimeType := contentType
		if mimeType == "" {
			mimeType = "image/jpeg"
		}
		if ext == ".mp4" {
			mimeType = "video/mp4"
		}

		refImgURL, _ := inputPayload["ref_image_url"].(string)

		title := "AI 创意生成结果"
		if task.TaskType == "image_background_removal" {
			title = "智能抠图结果"
		} else if task.TaskType == "image_inpainting" {
			title = "智能消除结果"
		} else if task.TaskType == "image_upscale" {
			title = "AI 变清晰结果"
		}
		metaMap := map[string]any{
			"task_id":       task.ID.String(),
			"task_type":     task.TaskType,
			"file_name":     storedName,
			"url":           localURL,
			"title":         title,
			"size":          len(fileBytes),
			"mime_type":     mimeType,
			"prompt":        prompt,
			"size_str":      paramSize,
			"dimensions":    paramSize,
			"quality":       quality,
			"model":         modelName,
			"ref_image_url": refImgURL,
		}
		if idx < len(scenes) {
			metaMap["scene_id"] = scenes[idx].ID
			metaMap["scene_title"] = scenes[idx].Title
			metaMap["scene_prompt"] = scenes[idx].Prompt
			metaMap["prompt"] = buildScenePrompt(prompt, scenes[idx])
			title := scenes[idx].Title
			if title != "" {
				metaMap["title"] = title
			}
		}
		if task.ConversationID != nil {
			metaMap["conversation_id"] = *task.ConversationID
		}
		metaBytes, _ := json.Marshal(metaMap)
		metaStr = string(metaBytes)
		lastMetaStr = metaStr

		// 构建 Asset 数据模型并写入数据库
		asset := model.Asset{
			ID:           uuid.New(),
			WorkspaceID:  task.WorkspaceID,
			ProjectID:    task.ProjectID,
			TaskID:       &task.ID,
			OutputIndex:  idx,
			SizeBytes:    int64(len(fileBytes)),
			AssetType:    assetTypeFromExt(ext),
			Source:       "generated",
			FileURL:      localURL,
			ThumbnailURL: localThumbURL,
			Metadata:     &metaStr,
			CreatedAt:    time.Now(),
		}
		if err := database.DB.Create(&asset).Error; err != nil {
			releaseStorage(task.WorkspaceID, int64(len(fileBytes)))
			_ = os.Remove(storagePath)
			log.Printf("[TaskSucceeded] 创建资产记录失败: %v, ID: %s, file: %s", err, asset.ID, localURL)
		} else {
			createdAssetCount++
			log.Printf("[TaskSucceeded] 成功创建资产记录: %s, file: %s", asset.ID, localURL)
		}
	}
	if createdAssetCount == 0 {
		failClaimedTask(task, "ASSET_PERSIST_FAILED", "生成结果未能保存到工作区存储")
		return
	}

	// 4. 通过统一账务服务完成正式结算，避免不同任务类型形成两套账务语义。
	task.Status = "succeeded"
	task.OutputPayload = &lastMetaStr
	task.CompletedAt = ptrTime(time.Now())
	consumeReason := fmt.Sprintf("AI 生成任务 %s 完成扣费", task.TaskType)
	if task.UserID == nil {
		failClaimedTask(task, "TASK_USER_MISSING", "生成任务缺少创建用户")
		return
	}
	billingSvc := service.GetBillingService()
	if err := billingSvc.SettleCredits(*task.UserID, task.WorkspaceID, task.EstimatedCredits, consumeReason, &task); err != nil {
		log.Printf("[TaskSucceeded] 任务 %s 结算事务失败，将保持 settling 并重试: %v", task.ID, err)
		return
	}
	log.Printf("[TaskSucceeded] 任务 %s 结算完成，已归档资产。", task.ID)
}

func decodeImageDataURL(raw string) ([]byte, string, error) {
	parts := strings.SplitN(raw, ",", 2)
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "data:") || !strings.Contains(parts[0], ";base64") {
		return nil, "", fmt.Errorf("图片数据不是合法的 Base64 Data URL")
	}
	mimeType := strings.TrimPrefix(strings.SplitN(parts[0], ";", 2)[0], "data:")
	decoded, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, "", err
	}
	return decoded, mimeType, nil
}

func validateTransparentPNG(data []byte) error {
	decoded, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("图片解码失败: %w", err)
	}
	if format != "png" {
		return fmt.Errorf("结果格式为 %s，必须为 PNG", format)
	}
	bounds := decoded.Bounds()
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			_, _, _, alpha := decoded.At(x, y).RGBA()
			if alpha < 0xffff {
				return nil
			}
		}
	}
	return fmt.Errorf("结果不包含透明像素")
}

func validateCutoutAspect(data []byte, inputPayload map[string]any) error {
	sourceWidth, widthOK := inputPayload["source_width"].(float64)
	sourceHeight, heightOK := inputPayload["source_height"].(float64)
	if !widthOK || !heightOK || sourceWidth <= 0 || sourceHeight <= 0 {
		return nil
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 {
		return fmt.Errorf("无法读取结果尺寸")
	}
	sourceRatio := sourceWidth / sourceHeight
	resultRatio := float64(config.Width) / float64(config.Height)
	difference := sourceRatio - resultRatio
	if difference < 0 {
		difference = -difference
	}
	if difference/sourceRatio > 0.03 {
		return fmt.Errorf("源图比例 %.4f，结果比例 %.4f", sourceRatio, resultRatio)
	}
	return nil
}

func extensionForGeneratedContent(task model.GenerationTask, contentType string, fileBytes []byte) string {
	if task.TaskType == "video_generation" || task.TaskType == "image_to_video" {
		return ".mp4"
	}
	contentType = strings.ToLower(strings.TrimSpace(strings.SplitN(contentType, ";", 2)[0]))
	if contentType == "" {
		contentType = http.DetectContentType(fileBytes)
	}
	switch contentType {
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".jpg"
	}
}

// handleTaskFailure 任务失败，执行退款并更新状态
func handleTaskFailure(taskID uuid.UUID, errorCode string, errorMsg string) {
	log.Printf("[TaskFailed] 任务 %s 失败: [%s] %s，正在执行退款...", taskID, errorCode, errorMsg)

	task, claimed := claimTaskForSettlement(taskID)
	if !claimed {
		return
	}
	failClaimedTask(task, errorCode, errorMsg)
}

func failClaimedTask(task model.GenerationTask, errorCode string, errorMsg string) {
	billingSvc := service.GetBillingService()
	actorID := uuid.Nil
	if task.UserID != nil {
		actorID = *task.UserID
	}

	refundReason := fmt.Sprintf("生成任务 %s 失败，原路退回冻结积分", task.ID.String())
	err := billingSvc.RefundCredits(actorID, task.WorkspaceID, task.EstimatedCredits, refundReason, &task)
	if err != nil {
		log.Printf("[TaskFailed] 积分退回失败，任务保持 refunding: %v", err)
		task.Status = "refunding"
		task.ErrorCode = &errorCode
		task.ErrorMessage = &errorMsg
		database.DB.Save(&task)
		return
	}

	cleanupTaskAssets(task.ID)

	task.Status = "failed"
	task.ErrorCode = &errorCode
	task.ErrorMessage = &errorMsg
	task.CompletedAt = ptrTime(time.Now())
	database.DB.Save(&task)

	log.Printf("[TaskFailed] 任务 %s 退款流程闭环完成。", task.ID)
}

func cleanupTaskAssets(taskID uuid.UUID) {
	var assets []model.Asset
	if err := database.DB.Where("task_id = ?", taskID).Find(&assets).Error; err != nil {
		return
	}
	for _, asset := range assets {
		if err := database.DB.Delete(&asset).Error; err != nil {
			continue
		}
		fileURLs := []string{asset.FileURL}
		if asset.ThumbnailURL != nil {
			fileURLs = append(fileURLs, *asset.ThumbnailURL)
		}
		for _, fileURL := range fileURLs {
			name := strings.TrimPrefix(fileURL, "/api/files/")
			if name != "" && !strings.ContainsAny(name, `/\\`) && !strings.Contains(name, "..") {
				_ = os.Remove(filepath.Join(getStorageDir(), name))
			}
		}
		releaseStorage(asset.WorkspaceID, asset.SizeBytes)
	}
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
