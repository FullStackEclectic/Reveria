package handler

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"time"

	xdraw "golang.org/x/image/draw"
	"reveria/services/api/database"
	"reveria/services/api/model"
	"reveria/services/api/service"
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

func resolveTaskPollingSettings(task model.GenerationTask, settings model.ClientSettings) (model.ClientSettings, error) {
	if task.SelectedModel != nil && strings.TrimSpace(*task.SelectedModel) != "" {
		var dbModel model.Model
		lookupErr := database.DB.Where("id = ?", *task.SelectedModel).First(&dbModel).Error
		if lookupErr != nil {
			lookupErr = database.DB.Where("name = ? AND enabled = true", *task.SelectedModel).First(&dbModel).Error
		}
		if lookupErr == nil {
			var provider model.Provider
			if err := database.DB.Where("id = ?", dbModel.ProviderID).First(&provider).Error; err == nil {
				if strings.TrimSpace(provider.ApiURL) != "" {
					settings.UpstreamAPIURL = provider.ApiURL
				}
				if provider.ApiKey != "" {
					settings.UpstreamAPIKey = provider.ApiKey
				}
			}
		}
	}
	settings.UpstreamAPIURL = strings.TrimSuffix(strings.TrimSuffix(strings.TrimSpace(settings.UpstreamAPIURL), "/"), "/v1")
	if settings.UpstreamAPIURL == "" {
		return settings, fmt.Errorf("上游 API 地址为空")
	}
	return settings, nil
}

// callUpstreamGateway 发包调用 12ZX-AI
func callUpstreamGateway(ctx context.Context, task model.GenerationTask, settings model.ClientSettings) {
	// 更新任务状态为 running
	progressJSON := `{"progress_text":"已提交请求，等待 AI 响应..."}`
	if !markTaskRunning(task.ID, progressJSON) {
		log.Printf("[callUpstreamGateway] 任务 %s 已离开 dispatching，跳过上游调用", task.ID)
		return
	}

	// 准备发包给网关
	var upstreamURL string
	var reqBody []byte

	// 获取真实的网关模型 API 英文标识
	gatewayModelName := ""
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
				if strings.TrimSpace(provider.ApiURL) != "" {
					settings.UpstreamAPIURL = provider.ApiURL
				}
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
	if strings.TrimSpace(settings.UpstreamAPIURL) == "" {
		handleTaskFailure(task.ID, "UPSTREAM_NOT_CONFIGURED", "尚未配置可用的上游 API 地址")
		return
	}

	// 统一规范 API 根地址，后续按任务类型拼接标准端点。
	settings.UpstreamAPIURL = strings.TrimSuffix(settings.UpstreamAPIURL, "/")
	settings.UpstreamAPIURL = strings.TrimSuffix(settings.UpstreamAPIURL, "/v1")

	// 文本大类任务，直接调用大语言模型完成
	if task.TaskType == "text" {
		var payload map[string]any
		_ = json.Unmarshal([]byte(task.InputPayload), &payload)
		prompt, _ := payload["prompt"].(string)

		messages := buildConversationMessages(task, prompt)
		responseMsg, promptTokens, completionTokens, llmErr := callUpstreamLLMWithMessages(messages, gatewayModelName, settings)
		if llmErr != nil {
			failTextTaskFromLLM(task.ID, llmErr)
			return
		}
		totalTokens := promptTokens + completionTokens

		// 根据模型指定的计费方式进行计费 (per_token 按 Token 百万折算，per_use 按次固定扣除)
		actualCost := int64(2)
		actualCostFloat := 2.0

		if task.SelectedModel != nil && *task.SelectedModel != "" {
			var m model.Model
			lookupErr := database.DB.Where("id = ?", *task.SelectedModel).First(&m).Error
			if lookupErr != nil {
				lookupErr = database.DB.Where("name = ? AND enabled = true", *task.SelectedModel).First(&m).Error
			}
			if lookupErr == nil {
				if m.CreditsCost > 0 {
					if m.BillingMethod == "per_use" {
						actualCost = int64(m.CreditsCost + 0.5)
						actualCostFloat = m.CreditsCost
					} else {
						actualCost = int64((float64(totalTokens)*m.CreditsCost)/1000000.0 + 0.5)
						actualCostFloat = float64(totalTokens) * m.CreditsCost / 1000000.0
					}
				}
			}
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
		if task.ConversationID != nil {
			outMap["conversation_id"] = *task.ConversationID
		}
		outBytes, _ := json.Marshal(outMap)
		outStr := string(outBytes)
		claimedTask, claimed := claimTaskForSettlement(task.ID)
		if !claimed {
			return
		}
		task = claimedTask

		billingSvc := service.GetBillingService()
		if task.UserID == nil {
			failClaimedTask(task, "TASK_USER_MISSING", "文本任务缺少创建用户")
			return
		}
		if err := database.DB.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, "settling").
			Update("output_payload", outStr).Error; err != nil {
			log.Printf("[TextTask] 任务 %s 写入输出失败: %v", task.ID, err)
		}
		task.OutputPayload = &outStr
		consumeReason := fmt.Sprintf("AI 文本生成任务完成结算 (Total Tokens: %d, 实际消耗: %f 积分)", totalTokens, actualCostFloat)
		if err := billingSvc.SettleCredits(*task.UserID, task.WorkspaceID, actualCost, consumeReason, &task); err != nil {
			failClaimedTask(task, "SETTLEMENT_FAILED", err.Error())
			return
		}
		if err := completeSettledTextTask(task); err != nil {
			log.Printf("[TextTask] 任务 %s 写入终态失败，将由恢复任务重试: %v", task.ID, err)
		}
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
		operation, _ := payload["operation"].(string)
		if (operation == "image-to-image" || operation == "image-edit") && refImg == "" {
			handleTaskFailure(task.ID, "REFERENCE_IMAGE_REQUIRED", "当前模板必须提供参考图片")
			return
		}
		var imgBytes []byte
		var err error

		if refImg != "" {
			log.Printf("[callUpstreamGateway] ImageToImage (edits): Downloading reference image %s", refImg)

			// 1. 仅允许读取当前工作区已经入库的本地文件。
			if fileName, local := storedFileNameFromURL(refImg); local {
				fileURL := "/api/files/" + fileName
				var count int64
				if database.DB.Model(&model.Asset{}).Where("workspace_id = ? AND (file_url = ? OR thumbnail_url = ?)", task.WorkspaceID, fileURL, fileURL).Count(&count).Error != nil || count == 0 {
					handleTaskFailure(task.ID, "REFERENCE_ACCESS_DENIED", "参考图片不属于当前工作区")
					return
				}
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
				if !isSafeRemoteURL(refImg) {
					handleTaskFailure(task.ID, "UNSAFE_REFERENCE_URL", "参考图片地址不允许访问")
					return
				}
				respImg, err := (&http.Client{Transport: insecureTransport, Timeout: 30 * time.Second}).Get(refImg)
				if err != nil {
					handleTaskFailure(task.ID, "DOWNLOAD_REF_IMAGE_FAILED", "下载参考图片失败: "+err.Error())
					return
				}
				defer respImg.Body.Close()
				if respImg.StatusCode != http.StatusOK {
					handleTaskFailure(task.ID, "DOWNLOAD_REF_IMAGE_FAILED", fmt.Sprintf("参考图片返回状态码 %d", respImg.StatusCode))
					return
				}
				imgBytes, err = io.ReadAll(io.LimitReader(respImg.Body, maxUploadBytes()+1))
				if err != nil {
					handleTaskFailure(task.ID, "READ_REF_IMAGE_FAILED", "读取参考图片数据失败: "+err.Error())
					return
				}
				if int64(len(imgBytes)) > maxUploadBytes() {
					handleTaskFailure(task.ID, "REFERENCE_IMAGE_TOO_LARGE", "参考图片超过大小限制")
					return
				}
				log.Printf("[callUpstreamGateway] ImageToImage (edits): Successfully downloaded image via HTTP: %s", refImg)
			}
		}
		if len(imgBytes) > 4500000 {
			compressed, compressErr := compressReferenceImage(imgBytes)
			if compressErr != nil {
				handleTaskFailure(task.ID, "REFERENCE_IMAGE_INVALID", "参考图片无法压缩处理: "+compressErr.Error())
				return
			}
			imgBytes = compressed
			if len(imgBytes) > 5000000 {
				handleTaskFailure(task.ID, "REFERENCE_IMAGE_TOO_LARGE", "参考图片压缩后仍超过上游 5MB 限制")
				return
			}
		}

		// 上游 API 限制单次请求 n 最大为 4，需要分批请求
		// 采用串行执行（非并发），降低上游压力
		// 核心改进：部分成功也算成功，已成功的图片不会因后续批次失败而丢失
		var batches []int
		scenes := parseGenerationScenes(payload)
		if len(scenes) > 0 {
			imageCount = len(scenes)
			for range scenes {
				batches = append(batches, 1)
			}
		} else {
			prompt = ensureSingleImagePrompt(prompt)
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
			if batchIdx < len(scenes) {
				currentPrompt = buildScenePrompt(prompt, scenes[batchIdx])
				log.Printf("[callUpstreamGateway] 执行场景 %d/%d (%s)", batchIdx+1, len(scenes), scenes[batchIdx].Title)
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

			batchReq, bErr := http.NewRequestWithContext(ctx, "POST", batchUpstreamURL, bytes.NewBuffer(batchReqBody))
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
				if batchResp.StatusCode == http.StatusPaymentRequired {
					failTaskFromUpstream(task.ID, batchResp.StatusCode, fmt.Sprintf("GATEWAY_%d", batchResp.StatusCode), msg)
					return
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
						} else if encoded, ok := m["b64_json"].(string); ok && strings.TrimSpace(encoded) != "" {
							allURLs = append(allURLs, "data:image/png;base64,"+strings.TrimSpace(encoded))
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
	} else if task.TaskType == "image_background_removal" {
		handleBackgroundRemovalTask(ctx, task, settings, gatewayModelName)
		return
	} else if task.TaskType == "image_upscale" {
		handleUpscaleTask(ctx, task, settings, gatewayModelName)
		return
	} else if task.TaskType == "image_inpainting" {
		// AI 智能消除：source image + mask → /v1/images/edits
		var payload map[string]any
		_ = json.Unmarshal([]byte(task.InputPayload), &payload)

		imageURL, _ := payload["image_url"].(string)
		maskData, _ := payload["mask_data"].(string) // base64 PNG, white=erase black=keep
		prompt, _ := payload["prompt"].(string)
		sizeStr, _ := payload["size"].(string)
		if sizeStr == "" {
			sizeStr = "1024x1024"
		}
		if imageURL == "" || maskData == "" {
			handleTaskFailure(task.ID, "INPAINTING_PARAMS_MISSING", "消除任务缺少源图或蒙版数据")
			return
		}

		// 下载源图
		var imgBytes []byte
		if fileName, local := storedFileNameFromURL(imageURL); local {
			fileURL := "/api/files/" + fileName
			var count int64
			if database.DB.Model(&model.Asset{}).Where("workspace_id = ? AND (file_url = ? OR thumbnail_url = ?)", task.WorkspaceID, fileURL, fileURL).Count(&count).Error != nil || count == 0 {
				handleTaskFailure(task.ID, "INPAINTING_IMAGE_ACCESS_DENIED", "消除源图不属于当前工作区")
				return
			}
			localPath := filepath.Join(getStorageDir(), fileName)
			imgBytes, _ = os.ReadFile(localPath)
		}
		if len(imgBytes) == 0 {
			if !isSafeRemoteURL(imageURL) {
				handleTaskFailure(task.ID, "UNSAFE_IMAGE_URL", "消除源图地址不允许访问")
				return
			}
			resp, err := (&http.Client{Transport: insecureTransport, Timeout: 30 * time.Second}).Get(imageURL)
			if err != nil || resp.StatusCode != http.StatusOK {
				handleTaskFailure(task.ID, "DOWNLOAD_IMAGE_FAILED", "下载消除源图失败")
				if resp != nil {
					resp.Body.Close()
				}
				return
			}
			imgBytes, _ = io.ReadAll(io.LimitReader(resp.Body, maxUploadBytes()+1))
			resp.Body.Close()
		}
		if len(imgBytes) > 4500000 {
			compressed, compressErr := compressReferenceImage(imgBytes)
			if compressErr != nil {
				handleTaskFailure(task.ID, "IMAGE_COMPRESS_FAILED", "源图压缩失败: "+compressErr.Error())
				return
			}
			imgBytes = compressed
		}

		// 解码 mask（前端传 base64 PNG 或 data URL）
		maskBytes, _, decodeErr := decodeImageDataURL(maskData)
		if decodeErr != nil {
			// 尝试直接 base64 解码
			var b64Err error
			maskBytes, b64Err = base64.StdEncoding.DecodeString(maskData)
			if b64Err != nil {
				handleTaskFailure(task.ID, "MASK_DECODE_FAILED", "蒙版数据解码失败")
				return
			}
		}

		progressMsg := `{"progress_text":"已提交消除请求，等待 AI 处理..."}`
		database.DB.Model(&task).Update("output_payload", progressMsg)

		inpaintURL := fmt.Sprintf("%s/v1/images/edits", settings.UpstreamAPIURL)
		bodyBuf := &bytes.Buffer{}
		bodyWriter := multipart.NewWriter(bodyBuf)

		imageField, _ := bodyWriter.CreateFormFile("image", "source.png")
		_, _ = io.Copy(imageField, bytes.NewReader(imgBytes))

		maskField, _ := bodyWriter.CreateFormFile("mask", "mask.png")
		_, _ = io.Copy(maskField, bytes.NewReader(maskBytes))

		_ = bodyWriter.WriteField("prompt", prompt)
		_ = bodyWriter.WriteField("model", gatewayModelName)
		_ = bodyWriter.WriteField("n", "1")
		if sizeStr != "" {
			_ = bodyWriter.WriteField("size", sizeStr)
		}
		_ = bodyWriter.Close()

		inpaintReq, err := http.NewRequestWithContext(ctx, "POST", inpaintURL, bodyBuf)
		if err != nil {
			handleTaskFailure(task.ID, "HTTP_CLIENT_ERROR", "创建消除请求失败: "+err.Error())
			return
		}
		inpaintReq.Header.Set("Content-Type", bodyWriter.FormDataContentType())
		inpaintReq.Header.Set("Authorization", "Bearer "+settings.UpstreamAPIKey)

		inpaintClient := &http.Client{Transport: insecureTransport, Timeout: 120 * time.Second}
		inpaintResp, err := inpaintClient.Do(inpaintReq)
		if err != nil {
			handleTaskFailure(task.ID, "INPAINTING_TIMEOUT", "调用消除网关超时: "+err.Error())
			return
		}
		defer inpaintResp.Body.Close()
		inpaintRespBytes, _ := io.ReadAll(inpaintResp.Body)

		if inpaintResp.StatusCode != http.StatusOK {
			var errResp map[string]any
			_ = json.Unmarshal(inpaintRespBytes, &errResp)
			msg := fmt.Sprintf("消除网关返回 %d", inpaintResp.StatusCode)
			if errData, ok := errResp["error"].(map[string]any); ok {
				if m, ok := errData["message"].(string); ok {
					msg = m
				}
			}
			failTaskFromUpstream(task.ID, inpaintResp.StatusCode, fmt.Sprintf("INPAINTING_GATEWAY_%d", inpaintResp.StatusCode), msg)
			return
		}

		var inpaintData map[string]any
		if err := json.Unmarshal(inpaintRespBytes, &inpaintData); err != nil {
			handleTaskFailure(task.ID, "INPAINTING_PARSE_ERROR", "消除结果解析失败")
			return
		}

		var resultURLs []string
		if dataList, ok := inpaintData["data"].([]any); ok {
			for _, item := range dataList {
				if m, ok := item.(map[string]any); ok {
					if u, _ := m["url"].(string); u != "" {
						resultURLs = append(resultURLs, u)
					} else if b64, _ := m["b64_json"].(string); b64 != "" {
						resultURLs = append(resultURLs, "data:image/png;base64,"+strings.TrimSpace(b64))
					}
				}
			}
		}
		if len(resultURLs) == 0 {
			handleTaskFailure(task.ID, "NO_INPAINTING_RESULT", "消除网关未返回结果图片")
			return
		}
		handleTaskSuccess(task, resultURLs)
		return

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

	req, err := http.NewRequestWithContext(ctx, "POST", upstreamURL, bytes.NewBuffer(reqBody))
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
		failTaskFromUpstream(task.ID, resp.StatusCode, fmt.Sprintf("GATEWAY_%d", resp.StatusCode), msg)
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
				} else if encoded, ok := m["b64_json"].(string); ok && strings.TrimSpace(encoded) != "" {
					urls = append(urls, "data:image/png;base64,"+strings.TrimSpace(encoded))
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
	leaseUntil := time.Now().Add(taskLeaseDuration)
	database.DB.Model(&model.GenerationTask{}).Where("id = ?", task.ID).Updates(map[string]any{
		"upstream_task_id": upstreamTaskID,
		"worker_id":        taskWorkerID,
		"lease_until":      leaseUntil,
	})
	go pollUpstreamTask(ctx, task, upstreamTaskID, settings)
}

func compressReferenceImage(data []byte) ([]byte, error) {
	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	const maxDimension = 2048
	bounds := src.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	if width > maxDimension || height > maxDimension {
		scale := float64(maxDimension) / float64(width)
		if height > width {
			scale = float64(maxDimension) / float64(height)
		}
		width = max(1, int(float64(width)*scale))
		height = max(1, int(float64(height)*scale))
	}
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	xdraw.BiLinear.Scale(dst, dst.Bounds(), src, bounds, xdraw.Over, nil)
	var out bytes.Buffer
	if err := jpeg.Encode(&out, dst, &jpeg.Options{Quality: 82}); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}
