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

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// insecureTransport 是一个跳过 SSL/TLS 证书校验的自定义 Transport，用于解决网关证书配置不匹配的问题
var insecureTransport = &http.Transport{
	TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
}

// TaskEstimateRequest 任务估算请求
type TaskEstimateRequest struct {
	WorkspaceID uuid.UUID `json:"workspace_id" binding:"required"`
	TaskType    string    `json:"task_type" binding:"required"`
	ModelName   string    `json:"model_name"`
}

// CreateTaskRequest 发起 AI 任务请求
type CreateTaskRequest struct {
	WorkspaceID  uuid.UUID       `json:"workspace_id" binding:"required"`
	ProjectID    uuid.UUID       `json:"project_id" binding:"required"`
	TaskType     string          `json:"task_type" binding:"required"` // image_generation / video_generation / text
	SelectedModel string          `json:"selected_model"`
	InputPayload json.RawMessage `json:"input_payload" binding:"required"`
}

// EstimateTask 估算任务积分 (POST /tasks/estimate)
func EstimateTask(c *gin.Context) {
	var req TaskEstimateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限在此工作区操作"})
		return
	}

	// 简单的积分定价估算：生图 10 点，视频 50 点，文本 2 点
	var estCredits int64 = 2
	switch req.TaskType {
	case "image_generation", "text_to_image":
		estCredits = 10
	case "video_generation", "image_to_video":
		estCredits = 50
	}

	// 支持根据站长加价率进行换算
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err == nil && settings.BillingMode != "bridge" {
		estCredits = int64(float64(estCredits) * settings.PriceRate)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"estimated_credits": estCredits,
	})
}

type CompatCreateTaskRequest struct {
	WorkspaceID    uuid.UUID `json:"workspace_id"`
	ProjectID      uuid.UUID `json:"project_id"`
	Model          string    `json:"model"`
	Prompt         string    `json:"prompt"`
	Size           string    `json:"size"`
	Quality        string    `json:"quality"`
	ImageCount     int       `json:"image_count"`
	RefImageURL    *string   `json:"ref_image_url"`
	IdempotencyKey string    `json:"idempotency_key"`
}

// CreateTask 发起 AI 生成任务接口 (POST /tasks 或 /workflows/image-generation)
func CreateTask(c *gin.Context) {
	var req CreateTaskRequest

	// 如果是旧生图工作流请求，使用旧版结构体解析并手动映射到 CreateTaskRequest
	if c.FullPath() == "/api/workflows/image-generation" {
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			log.Printf("[CompatCreateTask] Failed to read request body: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "读取请求内容失败"})
			return
		}
		// 将读取到的 body 重新写回 Request.Body，防止后续依赖它的中间件或操作受影响
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		log.Printf("[CompatCreateTask] Received Raw JSON Body: %s", string(bodyBytes))

		var compatReq CompatCreateTaskRequest
		if err := json.Unmarshal(bodyBytes, &compatReq); err == nil {
			req.WorkspaceID = compatReq.WorkspaceID
			req.ProjectID = compatReq.ProjectID
			req.TaskType = "image_generation"
			req.SelectedModel = compatReq.Model
			
			// 组装 input_payload
			inputMap := map[string]any{
				"prompt":        compatReq.Prompt,
				"size":          compatReq.Size,
				"quality":       compatReq.Quality,
				"image_count":   compatReq.ImageCount,
				"ref_image_url": compatReq.RefImageURL,
			}
			inputBytes, _ := json.Marshal(inputMap)
			req.InputPayload = inputBytes
		} else {
			log.Printf("[CompatCreateTask] JSON Unmarshal error: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入有误: " + err.Error()})
			return
		}
	} else {
		// 标准处理
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入有误: " + err.Error()})
			return
		}
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	// 1. 权限校验
	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限在此工作区操作"})
		return
	}

	// 2. 估算与扣除/冻结积分
	var estCredits int64 = 10 // 默认生图估算 10 点
	if req.TaskType == "video_generation" || req.TaskType == "image_to_video" {
		estCredits = 50
	}

	var settings model.ClientSettings
	_ = database.DB.First(&settings).Error

	if settings.BillingMode != "bridge" {
		estCredits = int64(float64(estCredits) * settings.PriceRate)
	} else {
		// 桥接模式下的默认模型分配：如果 SelectedModel 为空，则从已配置的逗号分隔列表中提取第一个作为兜底
		if req.SelectedModel == "" {
			var fallbackModel string
			if req.TaskType == "video_generation" || req.TaskType == "image_to_video" {
				fallbackModel = settings.BridgeVideoModel
			} else {
				fallbackModel = settings.BridgeImageModel
			}
			
			if fallbackModel != "" {
				parts := strings.Split(fallbackModel, ",")
				req.SelectedModel = strings.TrimSpace(parts[0])
			}
		}
	}

	// 准备 GenerationTask 记录
	taskID := uuid.New()
	inputStr := string(req.InputPayload)
	task := model.GenerationTask{
		ID:               taskID,
		WorkspaceID:      req.WorkspaceID,
		ProjectID:        req.ProjectID,
		UserID:           &actorID,
		TaskType:         req.TaskType,
		InputPayload:     inputStr,
		SelectedModel:    &req.SelectedModel,
		EstimatedCredits: estCredits,
		Status:           "pending",
		CreatedAt:        time.Now(),
	}

	// 统一账务接口校验与预扣
	billingSvc := service.GetBillingService()
	success, err := billingSvc.DeductCredits(actorID, req.WorkspaceID, estCredits, fmt.Sprintf("AI 生成任务 %s 积分预冻结", req.TaskType), &task)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "积分结算失败: " + err.Error()})
		return
	}

	if !success {
		c.JSON(http.StatusPaymentRequired, gin.H{"success": false, "message": "工作区积分余额不足，请联系管理员充值"})
		return
	}

	// 创建本地生成任务
	if err := database.DB.Create(&task).Error; err != nil {
		// 如果扣费成功了但任务建表失败，原路退回！
		_ = billingSvc.RefundCredits(actorID, req.WorkspaceID, estCredits, "创建本地任务记录失败，触发自动退款", &task)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建本地生成任务失败"})
		return
	}

	// 3. 调用 12ZX-AI 网关
	if c.FullPath() == "/api/workflows/image-generation" {
		// 生图工作流兼容接口采用同步方式等待网关调用结束，这样能即时返回生图任务的状态或资产结果给画板展示
		callUpstreamGateway(task, settings)

		var finalTask model.GenerationTask
		database.DB.Where("id = ?", task.ID).First(&finalTask)

		if finalTask.Status == "succeeded" {
			var asset model.Asset
			var meta struct {
				URL string `json:"url"`
			}
			if finalTask.OutputPayload != nil {
				_ = json.Unmarshal([]byte(*finalTask.OutputPayload), &meta)
			}
			if meta.URL != "" && database.DB.Where("file_url = ?", meta.URL).Order("created_at desc").First(&asset).Error == nil {
				c.JSON(http.StatusOK, gin.H{
					"task":  finalTask,
					"asset": asset,
				})
			} else {
				c.JSON(http.StatusOK, gin.H{
					"task":  finalTask,
					"asset": nil,
				})
			}
		} else {
			errMsg := "生图工作流执行失败，请检查 API 连接状态"
			if finalTask.ErrorMessage != nil {
				errMsg = *finalTask.ErrorMessage
			}
			c.JSON(http.StatusOK, gin.H{
				"task": finalTask,
				"output": gin.H{
					"message": errMsg,
				},
			})
		}
	} else {
		// 标准异步生图任务直接放入后台并返回任务 ID 凭证
		go callUpstreamGateway(task, settings)

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "生成任务已提交后台处理",
			"data":    task,
		})
	}
}

// GetTaskDetail 获取任务进度 (GET /tasks/:id)
func GetTaskDetail(c *gin.Context) {
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "任务 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var task model.GenerationTask
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "找不到指定任务"})
		return
	}

	if !hasWorkspaceRole(task.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此任务"})
		return
	}

	c.JSON(http.StatusOK, task)
}

// ======================== 后台协程与 12ZX-AI 调用逻辑 ========================

// callUpstreamGateway 发包调用 12ZX-AI
func callUpstreamGateway(task model.GenerationTask, settings model.ClientSettings) {
	// 更新任务状态为 running
	database.DB.Model(&task).Updates(map[string]any{
		"status":     "running",
		"started_at": time.Now(),
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
		if task.SelectedModel != nil {
			var dbModel model.Model
			if err := database.DB.Where("id = ?", *task.SelectedModel).First(&dbModel).Error; err == nil {
				gatewayModelName = dbModel.Name
				log.Printf("[callUpstreamGateway] Resolved model ID %s to API name %s", *task.SelectedModel, gatewayModelName)

				// 读取模型对应的 Provider，覆盖 settings 的 API 密钥和地址以做多渠道动态分发
				var provider model.Provider
				if err := database.DB.Where("id = ?", dbModel.ProviderID).First(&provider).Error; err == nil {
					if provider.ApiURL != "" {
						settings.UpstreamAPIURL = provider.ApiURL
					}
					if provider.ApiKey != "" {
						settings.UpstreamAPIKey = provider.ApiKey
					}
					log.Printf("[callUpstreamGateway] Loaded Provider from DB for model %s: ID=%s, URL=%s", gatewayModelName, provider.ID, settings.UpstreamAPIURL)
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

		responseMsg := callUpstreamLLM(prompt, settings)

		outMap := map[string]any{
			"summary": responseMsg,
		}
		outBytes, _ := json.Marshal(outMap)
		outStr := string(outBytes)

		tx := database.DB.Begin()
		var dbTask model.GenerationTask
		if tx.Where("id = ?", task.ID).First(&dbTask).Error == nil {
			dbTask.Status = "succeeded"
			dbTask.OutputPayload = &outStr
			dbTask.ActualCredits = dbTask.EstimatedCredits
			dbTask.FrozenCredits = 0
			dbTask.FrozenGiftCredits = 0
			dbTask.FrozenRefundCredits = 0
			dbTask.FrozenRechargeCredits = 0
			tx.Save(&dbTask)

			// 记录正式消费流水
			consumeReason := fmt.Sprintf("AI 生成任务 %s 完成扣费", dbTask.TaskType)
			var ws model.Workspace
			tx.Where("id = ?", dbTask.WorkspaceID).First(&ws)
			transaction := model.CreditTransaction{
				ID:              uuid.New(),
				WorkspaceID:     dbTask.WorkspaceID,
				UserID:          dbTask.UserID,
				ProjectID:       &dbTask.ProjectID,
				TaskID:          &dbTask.ID,
				TransactionType: "consume",
				Amount:          dbTask.ActualCredits,
				BalanceAfter:    ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
				Reason:          &consumeReason,
				CreatedAt:       time.Now(),
			}
			tx.Create(&transaction)
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

		refImg, _ := payload["ref_image_url"].(string)
		if refImg != "" {
			// 【图生图分支】调用 /v1/images/edits，使用 multipart/form-data 格式
			upstreamURL = fmt.Sprintf("%s/v1/images/edits", settings.UpstreamAPIURL)
			log.Printf("[callUpstreamGateway] ImageToImage (edits): Downloading reference image %s", refImg)

			// 读取参考图片数据
			var imgBytes []byte
			var err error

			// 1. 尝试直接从本地磁盘读取（消除内部 HTTP 环回请求可能导致的 404/卡死等网络风险）
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

			// 拼装 multipart body
			bodyBuf := &bytes.Buffer{}
			bodyWriter := multipart.NewWriter(bodyBuf)

			fileName := "reference.png"
			if strings.Contains(refImg, ".jpg") || strings.Contains(refImg, ".jpeg") {
				fileName = "reference.jpg"
			} else if strings.Contains(refImg, ".webp") {
				fileName = "reference.webp"
			}

			fileWriter, err := bodyWriter.CreateFormFile("image", fileName)
			if err != nil {
				handleTaskFailure(task.ID, "MULTIPART_ERROR", "创建图片表单字段失败: "+err.Error())
				return
			}
			_, err = io.Copy(fileWriter, bytes.NewReader(imgBytes))
			if err != nil {
				handleTaskFailure(task.ID, "MULTIPART_ERROR", "写入图片表单数据失败: "+err.Error())
				return
			}

			_ = bodyWriter.WriteField("prompt", prompt)
			_ = bodyWriter.WriteField("model", gatewayModelName)
			_ = bodyWriter.WriteField("n", "1")
			if sizeStr != "" {
				_ = bodyWriter.WriteField("size", sizeStr)
			}

			contentType = bodyWriter.FormDataContentType()
			_ = bodyWriter.Close()
			reqBody = bodyBuf.Bytes()
		} else {
			// 【文生图分支】调用 /v1/images/generations，使用 application/json 格式
			upstreamURL = fmt.Sprintf("%s/v1/images/generations", settings.UpstreamAPIURL)
			gatewayReq := map[string]any{
				"model":  gatewayModelName,
				"prompt": prompt,
				"n":      1,
				"size":   sizeStr,
			}
			reqBody, _ = json.Marshal(gatewayReq)
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
		if firstItem, ok := dataList[0].(map[string]any); ok {
			if url, ok := firstItem["url"].(string); ok {
				// 同步完成！直接进行下载和结算
				handleTaskSuccess(task, url)
				return
			}
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
				var url string
				if resURL, ok := taskData["result_url"].(string); ok {
					url = resURL
				} else if dataList, ok := taskData["data"].([]any); ok && len(dataList) > 0 {
					if firstItem, ok := dataList[0].(map[string]any); ok {
						url, _ = firstItem["url"].(string)
					}
				}
				if url != "" {
					handleTaskSuccess(task, url)
					return
				}
			} else if status == "failed" || status == "fail" {
				reason, _ := taskData["error_message"].(string)
				if reason == "" {
					reason, _ = taskData["message"].(string)
				}
				handleTaskFailure(task.ID, "GATEWAY_TASK_FAILED", "上游厂商生成失败: "+reason)
				return
			}
		}
	}
}

// handleTaskSuccess 任务成功，下载素材并退还剩余积分
func handleTaskSuccess(task model.GenerationTask, upstreamURL string) {
	log.Printf("[TaskSucceeded] 任务 %s 生成成功，开始本地化下载...", task.ID)

	// 1. 下载原始大文件至本地存储
	downloadClient := &http.Client{
		Transport: insecureTransport,
		Timeout:   60 * time.Second,
	}
	resp, err := downloadClient.Get(upstreamURL)
	var localURL string
	var localThumbURL *string
	var metaStr string

	if err == nil && resp.StatusCode == http.StatusOK {
		fileBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err == nil {
			storageDir := getStorageDir()
			_ = os.MkdirAll(storageDir, 0755)

			ext := ".jpg"
			if task.TaskType == "video_generation" || task.TaskType == "image_to_video" {
				ext = ".mp4"
			}
			storedName := uuid.New().String() + ext
			storagePath := filepath.Join(storageDir, storedName)
			_ = os.WriteFile(storagePath, fileBytes, 0644)

			localURL = "/api/files/" + storedName

			// 2. 生成缩略图
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

			// 3. 构建 Asset 数据模型并写入数据库
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
	}

	// 4. 积分正式扣减结算事务
	tx := database.DB.Begin()

	task.Status = "succeeded"
	task.OutputPayload = &metaStr
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

// ListTasks 获取生成任务列表 (GET /api/tasks)
func ListTasks(c *gin.Context) {
	projectIDStr := c.Query("project_id")
	workspaceIDStr := c.Query("workspace_id")

	actorID := c.MustGet("user_id").(uuid.UUID)

	query := database.DB.Order("created_at desc")

	// 权限过滤：如果是平台超管，可以查看所有任务；否则只能查看当前用户参与的工作区的任务
	var actor model.User
	isPlatformAdmin := false
	if err := database.DB.Where("id = ?", actorID).First(&actor).Error; err == nil && actor.IsPlatformAdmin {
		isPlatformAdmin = true
	}

	if projectIDStr != "" {
		projectID, err := uuid.Parse(projectIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式有误"})
			return
		}
		// 校验非超管下的项目权限
		if !isPlatformAdmin {
			var project model.Project
			if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
				c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "项目不存在"})
				return
			}
			if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
				c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此项目的任务"})
				return
			}
		}
		query = query.Where("project_id = ?", projectID)
	} else if workspaceIDStr != "" {
		workspaceID, err := uuid.Parse(workspaceIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
			return
		}
		if !isPlatformAdmin && !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin", "member"}) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此工作区的任务"})
			return
		}
		query = query.Where("workspace_id = ?", workspaceID)
	} else if !isPlatformAdmin {
		// 都不传且非超管，查询用户加入的所有工作区下的任务
		var memberWorkspaces []model.WorkspaceMember
		database.DB.Where("user_id = ? AND status = 'joined'", actorID).Find(&memberWorkspaces)
		var wsIDs []uuid.UUID
		for _, m := range memberWorkspaces {
			wsIDs = append(wsIDs, m.WorkspaceID)
		}
		if len(wsIDs) == 0 {
			c.JSON(http.StatusOK, []model.GenerationTask{})
			return
		}
		query = query.Where("workspace_id IN ?", wsIDs)
	}

	var tasks []model.GenerationTask
	if err := query.Limit(50).Find(&tasks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取任务列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, tasks)
}

// CancelTask 任务取消并退还预扣点数 (POST /api/tasks/:id/cancel)
func CancelTask(c *gin.Context) {
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "任务 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	tx := database.DB.Begin()

	var task model.GenerationTask
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", taskID).First(&task).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "生成任务不存在"})
		return
	}

	// 校验工作区 owner 或 admin 权限
	if !hasWorkspaceRole(task.WorkspaceID, actorID, []string{"owner", "admin"}) {
		tx.Rollback()
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限取消此任务"})
		return
	}

	// 仅限 pending 或 running 状态的任务可以取消
	if task.Status != "pending" && task.Status != "running" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "当前任务状态不允许取消"})
		return
	}

	// 退回冻结的 workspace 积分
	var ws model.Workspace
	tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", task.WorkspaceID).First(&ws)
	ws.GiftBalance += task.FrozenGiftCredits
	ws.RefundBalance += task.FrozenRefundCredits
	ws.RechargeBalance += task.FrozenRechargeCredits
	tx.Save(&ws)

	// 更新状态为 cancelled
	task.Status = "cancelled"
	task.FrozenCredits = 0
	task.FrozenGiftCredits = 0
	task.FrozenRefundCredits = 0
	task.FrozenRechargeCredits = 0
	task.CompletedAt = ptrTime(time.Now())
	tx.Save(&task)

	// 写入退还/释放额度流水记录
	releaseReason := fmt.Sprintf("任务 %s 取消成功，原路退回冻结积分", taskID.String())
	transaction := model.CreditTransaction{
		ID:              uuid.New(),
		WorkspaceID:     task.WorkspaceID,
		UserID:          task.UserID,
		ProjectID:       &task.ProjectID,
		TaskID:          &task.ID,
		TransactionType: "release",
		Amount:          task.EstimatedCredits,
		GiftAmount:      task.FrozenGiftCredits,
		RefundAmount:    task.FrozenRefundCredits,
		RechargeAmount:  task.FrozenRechargeCredits,
		BalanceAfter:    ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
		Reason:          &releaseReason,
		CreatedAt:       time.Now(),
	}
	tx.Create(&transaction)

	tx.Commit()
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "任务取消及退额成功", "data": task})
}

// RetryTask 重试失败/取消的任务 (POST /api/tasks/:id/retry)
func RetryTask(c *gin.Context) {
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "任务 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var task model.GenerationTask
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "源任务未找到"})
		return
	}

	// 校验工作区权限
	if !hasWorkspaceRole(task.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限操作"})
		return
	}

	// 构造新的 CreateTaskRequest 并直接重入 CreateTask 逻辑
	reqBody := CreateTaskRequest{
		WorkspaceID:   task.WorkspaceID,
		ProjectID:     task.ProjectID,
		TaskType:      task.TaskType,
		SelectedModel: *task.SelectedModel,
		InputPayload:  json.RawMessage(task.InputPayload),
	}

	bodyBytes, _ := json.Marshal(reqBody)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	// 直接调用 CreateTask 以保持完全一样的点数冻结和 Goroutine 拉起机制
	CreateTask(c)
}

// ListTaskComments 获取某个 AI 任务的调试留言/日志 (GET /api/tasks/:id/comments)
func ListTaskComments(c *gin.Context) {
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "任务 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var task model.GenerationTask
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "任务不存在"})
		return
	}

	if !hasWorkspaceRole(task.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此任务留言"})
		return
	}

	var comments []model.TaskComment
	if err := database.DB.Where("task_id = ?", taskID).Order("created_at asc").Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取留言失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, comments)
}

// CreateTaskComment 创建任务留言/调试日志 (POST /api/tasks/:id/comments)
func CreateTaskComment(c *gin.Context) {
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "任务 ID 格式有误"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "留言内容不能为空"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var task model.GenerationTask
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "任务不存在"})
		return
	}

	if !hasWorkspaceRole(task.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限留言"})
		return
	}

	comment := model.TaskComment{
		ID:        uuid.New(),
		TaskID:    taskID,
		UserID:    actorID,
		Content:   req.Content,
		CreatedAt: time.Now(),
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存留言失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, comment)
}
