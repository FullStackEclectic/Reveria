package handler

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
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

// insecureTransport 根据环境变量控制是否跳过 SSL/TLS 证书校验
// 默认启用证书校验（安全模式），仅当 REVERIA_INSECURE_SKIP_TLS=true 时跳过
var insecureTransport *http.Transport

func init() {
	skipTLS := os.Getenv("REVERIA_INSECURE_SKIP_TLS") == "true"
	insecureTransport = &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: skipTLS},
	}
	if skipTLS {
		log.Println("[TLS] ⚠️  警告：TLS 证书校验已被禁用 (REVERIA_INSECURE_SKIP_TLS=true)，存在中间人攻击风险！")
		log.Println("[TLS] ⚠️  生产环境请务必关闭此选项并配置正确的 TLS 证书。")
	}
}

// callUpstreamGateway 发包调用 12ZX-AI
func callUpstreamGateway(task model.GenerationTask, settings model.ClientSettings) {
	// 更新任务状态为 running
	progressJSON := `{"progress_text":"已提交请求，等待 AI 响应..."}`
	database.DB.Model(&task).Updates(map[string]any{
		"status":         "running",
		"started_at":     time.Now(),
		"output_payload": &progressJSON,
	})

	// 准备发包给网关
	var upstreamURL string
	var reqBody []byte

	// 获取真实的网关模型 API 英文标识
	gatewayModelName := ""
	if settings.BillingMode == "bridge" {
		if task.SelectedModel != nil {
			gatewayModelName = *task.SelectedModel
		}
		settings.UpstreamAPIURL = settings.BridgeMainStationURL
		log.Printf("[callUpstreamGateway] Bridge Mode: Model=%s, URL=%s", gatewayModelName, settings.UpstreamAPIURL)
	} else {
		// 自营模式下强制锁定使用 12ZX 官方网关地址
		settings.UpstreamAPIURL = "https://ai.12zx.net"

		if task.SelectedModel != nil {
			var dbModel model.Model
			if err := database.DB.Where("id = ?", *task.SelectedModel).First(&dbModel).Error; err != nil {
				// 兜底匹配：若是模板推荐的模型ID没有带 provider_uuid 前缀，则使用 name 进行匹配
				_ = database.DB.Where("name = ? AND enabled = true", *task.SelectedModel).First(&dbModel).Error
			}
			if dbModel.Name != "" {
				gatewayModelName = dbModel.Name
				log.Printf("[callUpstreamGateway] Resolved model ID %s to API name %s", *task.SelectedModel, gatewayModelName)

				// 读取模型对应的 Provider，仅覆盖 settings 的 API 密钥
				var provider model.Provider
				if err := database.DB.Where("id = ?", dbModel.ProviderID).First(&provider).Error; err == nil {
					if provider.ApiKey != "" {
						settings.UpstreamAPIKey = provider.ApiKey
					}
					log.Printf("[callUpstreamGateway] Loaded Provider from DB for model %s: ID=%s, locked URL=%s", gatewayModelName, provider.ID, settings.UpstreamAPIURL)
				} else {
					log.Printf("[callUpstreamGateway] DB provider not found for ID %s, using global setting fallback: %v", dbModel.ProviderID, err)
				}
			} else {
				gatewayModelName = *task.SelectedModel
				log.Printf("[callUpstreamGateway] Using raw model name and global settings: %s", gatewayModelName)
			}
		}
	}

	// 裁剪 API URL，去掉末尾可能存在的 "/" 以及 "/v1" 后缀，方便之后统一硬编码拼接 `/v1/images/generations` 等
	settings.UpstreamAPIURL = strings.TrimSuffix(settings.UpstreamAPIURL, "/")
	settings.UpstreamAPIURL = strings.TrimSuffix(settings.UpstreamAPIURL, "/v1")

	// 文本大类任务，直接调用大语言模型完成
	if task.TaskType == "text" {
		var payload map[string]any
		_ = json.Unmarshal([]byte(task.InputPayload), &payload)
		prompt, _ := payload["prompt"].(string)

		responseMsg, promptTokens, completionTokens := callUpstreamLLM(prompt, gatewayModelName, settings)
		totalTokens := promptTokens + completionTokens

		// 根据模型指定的计费方式进行计费 (per_token 按 Token 百万折算，per_use 按次固定扣除)
		actualCost := int64(0)
		actualCostFloat := 0.0
		
		if task.SelectedModel != nil && *task.SelectedModel != "" {
			var m model.Model
			if err := database.DB.Where("id = ?", *task.SelectedModel).First(&m).Error; err == nil {
				if m.CreditsCost > 0 {
					if m.BillingMethod == "per_use" {
						actualCost = int64(m.CreditsCost + 0.5)
						actualCostFloat = m.CreditsCost
					} else {
						actualCost = int64((float64(totalTokens) * m.CreditsCost) / 1000000.0 + 0.5)
						actualCostFloat = float64(totalTokens) * m.CreditsCost / 1000000.0
					}
				}
			}
		} else {
			// 兜底文本按次 2 积分
			actualCost = 2
			actualCostFloat = 2.0
		}

		outMap := map[string]any{
			"summary":           responseMsg,
			"output":            responseMsg,
			"task_id":           task.ID.String(),
			"task_type":         "text",
			"prompt":            prompt,
			"title":             "AI 文本生成结果",
			"model":             gatewayModelName,
			"prompt_tokens":     promptTokens,
			"completion_tokens": completionTokens,
			"total_tokens":      totalTokens,
			"actual_credits":    actualCostFloat,
		}
		outBytes, _ := json.Marshal(outMap)
		outStr := string(outBytes)

		// 1. 全额释放当初的预冻结额度
		billingSvc := service.GetBillingService()
		_ = billingSvc.RefundCredits(*task.UserID, task.WorkspaceID, task.EstimatedCredits, fmt.Sprintf("任务 %s 成功结算释放原冻结", task.ID.String()), &task)

		// 2. 从用户钱包中，物理扣除实际消耗积分 actualCost
		tx := database.DB.Begin()
		var ws model.Workspace
		if err := forUpdate(tx).Where("id = ?", task.WorkspaceID).First(&ws).Error; err == nil {
			remaining := actualCost
			
			// 依次扣减 Recharge -> Gift -> Refund
			if ws.RechargeBalance >= remaining {
				ws.RechargeBalance -= remaining
				remaining = 0
			} else {
				remaining -= ws.RechargeBalance
				ws.RechargeBalance = 0
			}
			
			if remaining > 0 {
				if ws.GiftBalance >= remaining {
					ws.GiftBalance -= remaining
					remaining = 0
				} else {
					remaining -= ws.GiftBalance
					ws.GiftBalance = 0
				}
			}
			
			if remaining > 0 {
				if ws.RefundBalance >= remaining {
					ws.RefundBalance -= remaining
					remaining = 0
				} else {
					remaining -= ws.RefundBalance
					ws.RefundBalance = 0
				}
			}
			
			tx.Save(&ws)
			
			// 3. 记录消费流水记录
			consumeReason := fmt.Sprintf("AI 文本生成任务完成结算扣费 (Total Tokens: %d, 实际消耗: %f 积分)", totalTokens, actualCostFloat)
			transaction := model.CreditTransaction{
				ID:              uuid.New(),
				WorkspaceID:     task.WorkspaceID,
				UserID:          task.UserID,
				ProjectID:       &task.ProjectID,
				TaskID:          &task.ID,
				TransactionType: "consume",
				Amount:          actualCost,
				BalanceAfter:    ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
				Reason:          &consumeReason,
				CreatedAt:       time.Now(),
			}
			tx.Create(&transaction)
		}

		// 4. 更新 Task 任务本身的状态并写入 Asset 资产
		var dbTask model.GenerationTask
		if tx.Where("id = ?", task.ID).First(&dbTask).Error == nil {
			dbTask.Status = "succeeded"
			dbTask.OutputPayload = &outStr
			dbTask.ActualCredits = actualCost
			dbTask.FrozenCredits = 0
			dbTask.FrozenGiftCredits = 0
			dbTask.FrozenRefundCredits = 0
			dbTask.FrozenRechargeCredits = 0
			tx.Save(&dbTask)

			asset := model.Asset{
				ID:          uuid.New(),
				WorkspaceID: dbTask.WorkspaceID,
				ProjectID:   dbTask.ProjectID,
				AssetType:   "document",
				Source:      "generated",
				FileURL:     "",
				Metadata:    &outStr,
				CreatedAt:   time.Now(),
			}
			tx.Create(&asset)
		}
		tx.Commit()
		return
	}

	contentType := "application/json"

	// 图像生成与视频生成在 OpenAI 网关上接口不一样
	if task.TaskType == "image_generation" || task.TaskType == "text_to_image" {
		// 解析 InputPayload 参数
		var payload map[string]any
		_ = json.Unmarshal([]byte(task.InputPayload), &payload)

		prompt, _ := payload["prompt"].(string)
		sizeStr, _ := payload["size"].(string)
		if sizeStr == "" {
			sizeStr = "1024x1024"
		}

		imageCount := 1
		if ic, ok := payload["image_count"].(float64); ok && ic > 0 {
			imageCount = int(ic)
		} else if icVal, ok := payload["image_count"].(int); ok && icVal > 0 {
			imageCount = icVal
		}
		if imageCount < 1 {
			imageCount = 1
		}
		if imageCount > 16 { // 限制单次最多生成 16 张图片
			imageCount = 16
		}

		refImg, _ := payload["ref_image_url"].(string)
		var imgBytes []byte
		var err error

		if refImg != "" {
			log.Printf("[callUpstreamGateway] ImageToImage (edits): Downloading reference image %s", refImg)

			// 1. 尝试直接从本地磁盘读取
			lastSlash := strings.LastIndex(refImg, "/")
			if lastSlash != -1 {
				fileName := refImg[lastSlash+1:]
				localPath := filepath.Join(getStorageDir(), fileName)
				imgBytes, err = os.ReadFile(localPath)
				if err == nil {
					log.Printf("[callUpstreamGateway] ImageToImage (edits): Successfully read local file directly: %s", localPath)
				} else {
					log.Printf("[callUpstreamGateway] ImageToImage (edits): Local file not found or failed to read (%s): %v. Falling back to HTTP download.", localPath, err)
				}
			}

			// 2. 如果本地读取失败，降级通过 HTTP 网络下载
			if len(imgBytes) == 0 {
				respImg, err := http.Get(refImg)
				if err != nil {
					handleTaskFailure(task.ID, "DOWNLOAD_REF_IMAGE_FAILED", "下载参考图片失败: "+err.Error())
					return
				}
				defer respImg.Body.Close()
				imgBytes, err = io.ReadAll(respImg.Body)
				if err != nil {
					handleTaskFailure(task.ID, "READ_REF_IMAGE_FAILED", "读取参考图片数据失败: "+err.Error())
					return
				}
				log.Printf("[callUpstreamGateway] ImageToImage (edits): Successfully downloaded image via HTTP: %s", refImg)
			}
		}

		// 上游 API 限制单次请求 n 最大为 4，需要分批请求
		// 采用串行执行（非并发），降低上游压力
		// 核心改进：部分成功也算成功，已成功的图片不会因后续批次失败而丢失
		var batches []int
		var subPrompts []string
		isMultiSceneTemplate := false

		if strings.Contains(prompt, "需要一张") &&
			strings.Contains(prompt, "产品配戴图") &&
			strings.Contains(prompt, "产品细节图") {
			isMultiSceneTemplate = true

			prefix := ""
			idxNeed := strings.Index(prompt, "需要一张")
			if idxNeed != -1 {
				prefix = prompt[:idxNeed]
			}

			suffix := "，图片尺寸1200*1200，绝对不能拼图，请务必生成单张画面，绝对禁止使用多格拼图。"

			scenes := []string{
				"需要一张产品主图，以精美的饰品特写展示产品的卖点与工艺品质",
				"需要一张产品配戴图，由单个模特佩戴展示产品的实际佩戴效果与时尚氛围",
				"需要一张近距离产品细节图，展示产品的精细纹路、材质工艺与细节特写",
				"需要一张产品白底图，在纯白色背景上展示产品的真实结构与本色",
				"需要一张材质/卖点图，突出展示做工精细",
				"需要一张场景/礼物氛围图，展示产品在精美的礼品包装盒场景中传递心意",
			}

			limit := imageCount
			if limit > len(scenes) {
				limit = len(scenes)
			}
			for i := 0; i < limit; i++ {
				subPrompts = append(subPrompts, prefix+scenes[i]+suffix)
				batches = append(batches, 1)
			}
		} else {
			maxPerBatch := 4
			if refImg != "" {
				maxPerBatch = 2 // 图生图每批上限降低，提高成功率
			}
			tempCount := imageCount
			for tempCount > 0 {
				if tempCount >= maxPerBatch {
					batches = append(batches, maxPerBatch)
					tempCount -= maxPerBatch
				} else {
					batches = append(batches, tempCount)
					tempCount = 0
				}
			}
		}

		// 图生图超时 300 秒（需上传参考图+生成多张变体），文生图 90 秒
		httpTimeout := 90 * time.Second
		if refImg != "" {
			httpTimeout = 300 * time.Second
		}

		log.Printf("[callUpstreamGateway] 总计请求 %d 张图片，分 %d 批串行执行，timeout=%s", imageCount, len(batches), httpTimeout)

		// 写入进度提示
		progressJSON := fmt.Sprintf(`{"progress_text":"正在生成 %d 张图片，请耐心等待..."}`, imageCount)
		database.DB.Model(&task).Update("output_payload", progressJSON)

		var allURLs []string
		var lastErr error

		for batchIdx, count := range batches {
			// 更新进度
			if batchIdx > 0 {
				progressJSON = fmt.Sprintf(`{"progress_text":"已生成 %d/%d 张图片，继续生成中..."}`, len(allURLs), imageCount)
				database.DB.Model(&task).Update("output_payload", progressJSON)
			}

			// 确定本批次的 prompt
			currentPrompt := prompt
			if isMultiSceneTemplate && batchIdx < len(subPrompts) {
				currentPrompt = subPrompts[batchIdx]
				log.Printf("[callUpstreamGateway] 一图生多图拆分提示词，批次 %d/%d: %s", batchIdx+1, len(batches), currentPrompt)
			}

			var batchUpstreamURL string
			var batchReqBody []byte
			var batchContentType string = "application/json"

			if refImg != "" {
				// 【图生图分支】调用 /v1/images/edits
				batchUpstreamURL = fmt.Sprintf("%s/v1/images/edits", settings.UpstreamAPIURL)
				bodyBuf := &bytes.Buffer{}
				bodyWriter := multipart.NewWriter(bodyBuf)

				fileName := "reference.png"
				if strings.Contains(refImg, ".jpg") || strings.Contains(refImg, ".jpeg") {
					fileName = "reference.jpg"
				} else if strings.Contains(refImg, ".webp") {
					fileName = "reference.webp"
				}

				fileWriter, fErr := bodyWriter.CreateFormFile("image", fileName)
				if fErr != nil {
					lastErr = fmt.Errorf("创建图片表单字段失败: %w", fErr)
					log.Printf("[callUpstreamGateway] 批次 %d/%d 构建表单失败: %v", batchIdx+1, len(batches), fErr)
					break
				}
				_, fErr = io.Copy(fileWriter, bytes.NewReader(imgBytes))
				if fErr != nil {
					lastErr = fmt.Errorf("写入图片表单数据失败: %w", fErr)
					log.Printf("[callUpstreamGateway] 批次 %d/%d 写入表单失败: %v", batchIdx+1, len(batches), fErr)
					break
				}

				_ = bodyWriter.WriteField("prompt", currentPrompt)
				_ = bodyWriter.WriteField("model", gatewayModelName)
				_ = bodyWriter.WriteField("n", fmt.Sprintf("%d", count))
				if sizeStr != "" {
					_ = bodyWriter.WriteField("size", sizeStr)
				}

				batchContentType = bodyWriter.FormDataContentType()
				_ = bodyWriter.Close()
				batchReqBody = bodyBuf.Bytes()
			} else {
				// 【文生图分支】调用 /v1/images/generations
				batchUpstreamURL = fmt.Sprintf("%s/v1/images/generations", settings.UpstreamAPIURL)
				gatewayReq := map[string]any{
					"model":  gatewayModelName,
					"prompt": currentPrompt,
					"n":      count,
					"size":   sizeStr,
				}
				batchReqBody, _ = json.Marshal(gatewayReq)
			}

			log.Printf("[callUpstreamGateway] 发送批次 %d/%d, n=%d", batchIdx+1, len(batches), count)

			batchReq, bErr := http.NewRequest("POST", batchUpstreamURL, bytes.NewBuffer(batchReqBody))
			if bErr != nil {
				lastErr = fmt.Errorf("网关连接失败: %w", bErr)
				log.Printf("[callUpstreamGateway] 批次 %d/%d 创建请求失败: %v", batchIdx+1, len(batches), bErr)
				continue // 跳过此批次，尝试下一批
			}

			batchReq.Header.Set("Content-Type", batchContentType)
			batchReq.Header.Set("Authorization", "Bearer "+settings.UpstreamAPIKey)

			batchClient := &http.Client{
				Transport: insecureTransport,
				Timeout:   httpTimeout,
			}
			batchResp, bErr := batchClient.Do(batchReq)
			if bErr != nil {
				lastErr = fmt.Errorf("调用主网关超时: %w", bErr)
				log.Printf("[callUpstreamGateway] 批次 %d/%d 请求超时: %v", batchIdx+1, len(batches), bErr)
				continue // 跳过此批次，尝试下一批
			}

			batchRespBytes, _ := io.ReadAll(batchResp.Body)
			batchResp.Body.Close()

			if batchResp.StatusCode != http.StatusOK {
				var errorResp map[string]any
				_ = json.Unmarshal(batchRespBytes, &errorResp)
				msg := "网关调用错误"
				if errData, ok := errorResp["error"].(map[string]any); ok {
					if m, ok := errData["message"].(string); ok {
						msg = m
					}
				}
				lastErr = fmt.Errorf("GATEWAY_%d: %s", batchResp.StatusCode, msg)
				log.Printf("[callUpstreamGateway] 批次 %d/%d 返回错误: %s", batchIdx+1, len(batches), msg)
				continue // 跳过此批次，尝试下一批
			}

			var batchResponseData map[string]any
			if err := json.Unmarshal(batchRespBytes, &batchResponseData); err != nil {
				lastErr = fmt.Errorf("网关返回数据无法解析")
				log.Printf("[callUpstreamGateway] 批次 %d/%d 响应解析失败", batchIdx+1, len(batches))
				continue
			}

			if dataList, ok := batchResponseData["data"].([]any); ok && len(dataList) > 0 {
				for _, item := range dataList {
					if m, ok := item.(map[string]any); ok {
						if url, ok := m["url"].(string); ok && url != "" {
							allURLs = append(allURLs, url)
						}
					}
				}
			}

			log.Printf("[callUpstreamGateway] 批次 %d/%d 成功，累计已获得 %d 张图片", batchIdx+1, len(batches), len(allURLs))
		}

		// 部分成功也算成功：只要有 >= 1 张图片就走成功流程
		if len(allURLs) > 0 {
			log.Printf("[callUpstreamGateway] 请求 %d 张图片，实际返回 %d 张", imageCount, len(allURLs))
			handleTaskSuccess(task, allURLs)
			return
		} else {
			errMsg := "上游未返回任何图片数据"
			if lastErr != nil {
				errMsg = lastErr.Error()
			}
			handleTaskFailure(task.ID, "NO_IMAGES_GENERATED", errMsg)
			return
		}
	} else if task.TaskType == "video_generation" || task.TaskType == "image_to_video" {
		// 视频生成
		upstreamURL = fmt.Sprintf("%s/v1/video/generations", settings.UpstreamAPIURL)
		var payload map[string]any
		_ = json.Unmarshal([]byte(task.InputPayload), &payload)
		prompt, _ := payload["prompt"].(string)
		gatewayReq := map[string]any{
			"model":  gatewayModelName,
			"prompt": prompt,
		}
		if refImg, ok := payload["ref_image_url"].(string); ok && refImg != "" {
			gatewayReq["ref_image_url"] = refImg
			gatewayReq["ref_img"] = refImg
		}
		reqBody, _ = json.Marshal(gatewayReq)
	} else {
		handleTaskFailure(task.ID, "UNSUPPORTED_TASK_TYPE", "不支持的任务大类类型: "+task.TaskType)
		return
	}

	req, err := http.NewRequest("POST", upstreamURL, bytes.NewBuffer(reqBody))
	if err != nil {
		handleTaskFailure(task.ID, "HTTP_CLIENT_ERROR", "网关连接失败: "+err.Error())
		return
	}

	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Authorization", "Bearer "+settings.UpstreamAPIKey)

	client := &http.Client{
		Transport: insecureTransport,
		Timeout:   90 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		handleTaskFailure(task.ID, "GATEWAY_TIMEOUT", "调用主网关超时: "+err.Error())
		return
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		var errorResp map[string]any
		_ = json.Unmarshal(respBytes, &errorResp)
		msg := "网关调用错误"
		if errData, ok := errorResp["error"].(map[string]any); ok {
			if m, ok := errData["message"].(string); ok {
				msg = m
			}
		}
		handleTaskFailure(task.ID, fmt.Sprintf("GATEWAY_%d", resp.StatusCode), msg)
		return
	}

	// 解析网关返回的任务 ID (如果是异步生成任务，网关返回 task_id 或者是 data[0].url)
	var responseData map[string]any
	if err := json.Unmarshal(respBytes, &responseData); err != nil {
		handleTaskFailure(task.ID, "RESPONSE_PARSE_ERROR", "网关返回数据无法解析")
		return
	}

	// 12ZX-AI 文生图通常同步返回图片链接，视频通常是异步任务返回 ID
	// 针对同步返回（例如 DALLE 生图直接返回数据）：
	if dataList, ok := responseData["data"].([]any); ok && len(dataList) > 0 {
		var urls []string
		for _, item := range dataList {
			if m, ok := item.(map[string]any); ok {
				if url, ok := m["url"].(string); ok && url != "" {
					urls = append(urls, url)
				}
			}
		}
		if len(urls) > 0 {
			// 同步完成！直接进行下载和结算
			handleTaskSuccess(task, urls)
			return
		}
	}

	// 针对异步任务（可灵、即梦视频生成等，网关返回 task_id）：
	upstreamTaskID, _ := responseData["id"].(string)
	if upstreamTaskID == "" {
		upstreamTaskID, _ = responseData["task_id"].(string)
	}

	if upstreamTaskID == "" {
		handleTaskFailure(task.ID, "NO_UPSTREAM_TASK_ID", "网关未返回合法的生成任务 ID")
		return
	}

	// 更新 upstream_task_id 并启动协程异步轮询
	database.DB.Model(&model.GenerationTask{}).Where("id = ?", task.ID).Update("upstream_task_id", upstreamTaskID)
	go pollUpstreamTask(task, upstreamTaskID, settings)
}

// pollUpstreamTask 轮询 12ZX-AI 异步任务进度
func pollUpstreamTask(task model.GenerationTask, upstreamTaskID string, settings model.ClientSettings) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	timeout := time.After(15 * time.Minute) // 视频生成最长等待 15 分钟

	pollURL := fmt.Sprintf("%s/v1/tasks/%s", settings.UpstreamAPIURL, upstreamTaskID)

	for {
		select {
		case <-timeout:
			handleTaskFailure(task.ID, "TIMEOUT", "生成任务等待超时")
			return
		case <-ticker.C:
			req, err := http.NewRequest("GET", pollURL, nil)
			if err != nil {
				continue
			}
			req.Header.Set("Authorization", "Bearer "+settings.UpstreamAPIKey)

			client := &http.Client{
				Transport: insecureTransport,
				Timeout:   10 * time.Second,
			}
			resp, err := client.Do(req)
			if err != nil {
				continue
			}

			respBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				continue
			}

			var taskData map[string]any
			if err := json.Unmarshal(respBytes, &taskData); err != nil {
				continue
			}

			status, _ := taskData["status"].(string)
			// 12ZX-AI 状态一般是 success / failed / processing
			if status == "success" || status == "succeeded" {
				var urls []string
				if resURL, ok := taskData["result_url"].(string); ok && resURL != "" {
					urls = append(urls, resURL)
				} else if dataList, ok := taskData["data"].([]any); ok && len(dataList) > 0 {
					for _, item := range dataList {
						if m, ok := item.(map[string]any); ok {
							if u, _ := m["url"].(string); u != "" {
								urls = append(urls, u)
							}
						}
					}
				}
				if len(urls) > 0 {
					handleTaskSuccess(task, urls)
					return
				}
			} else if status == "failed" || status == "fail" {
				reason, _ := taskData["error_message"].(string)
				if reason == "" {
					reason, _ = taskData["message"].(string)
				}
				handleTaskFailure(task.ID, "GATEWAY_TASK_FAILED", "上游厂商生成失败: "+reason)
				return
			} else {
				// processing 或者 running 状态，写回实时进度
				progressText := "上游正在努力渲染多图场景中，请稍候..."
				if pct, ok := taskData["progress"].(float64); ok {
					progressText = fmt.Sprintf("AI 正在绘制画面 (进度 %.0f%%)...", pct)
				} else if pctStr, ok := taskData["progress"].(string); ok {
					progressText = fmt.Sprintf("AI 正在绘制画面 (进度 %s)...", pctStr)
				}
				progressJSON := fmt.Sprintf(`{"progress_text":%q}`, progressText)
				database.DB.Model(&task).Update("output_payload", progressJSON)
			}
		}
	}
}
