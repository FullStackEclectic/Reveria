package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"
	"reveria/services/api/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// TaskEstimateRequest 任务估算请求
type TaskEstimateRequest struct {
	WorkspaceID uuid.UUID `json:"workspace_id" binding:"required"`
	TaskType    string    `json:"task_type" binding:"required"`
	ModelName   string    `json:"model_name"`
}

// CreateTaskRequest 发起 AI 任务请求
type CreateTaskRequest struct {
	WorkspaceID    uuid.UUID       `json:"workspace_id" binding:"required"`
	ProjectID      uuid.UUID       `json:"project_id" binding:"required"`
	TaskType       string          `json:"task_type" binding:"required"` // image_generation / video_generation / text
	SelectedModel  string          `json:"selected_model"`
	ConversationID string          `json:"conversation_id" binding:"max=120"`
	IdempotencyKey string          `json:"idempotency_key" binding:"max=120"`
	InputPayload   json.RawMessage `json:"input_payload" binding:"required"`
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

func resolveEstimatedCredits(taskType, modelIdentifier string) (int64, error) {
	var rule model.PricingRule
	if strings.TrimSpace(modelIdentifier) != "" {
		err := database.DB.Where(
			"enabled = ? AND model_id = ? AND (task_type IS NULL OR task_type = ?)",
			true, modelIdentifier, taskType,
		).Order("updated_at desc").First(&rule).Error
		if err == nil && rule.MinCredits != nil && *rule.MinCredits > 0 {
			return *rule.MinCredits, nil
		}
	}
	if err := database.DB.Where(
		"enabled = ? AND model_id IS NULL AND (task_type IS NULL OR task_type = ?)", true, taskType,
	).Order("updated_at desc").First(&rule).Error; err == nil && rule.MinCredits != nil && *rule.MinCredits > 0 {
		return *rule.MinCredits, nil
	}

	if strings.TrimSpace(modelIdentifier) != "" {
		var configuredModel model.Model
		lookupErr := database.DB.Where("id = ? AND enabled = true", modelIdentifier).First(&configuredModel).Error
		if lookupErr != nil {
			lookupErr = database.DB.Where("name = ? AND enabled = true", modelIdentifier).First(&configuredModel).Error
		}
		if lookupErr == nil && configuredModel.CreditsCost > 0 {
			credits := int64(configuredModel.CreditsCost + 0.5)
			if credits < 1 {
				credits = 1
			}
			return credits, nil
		}
	}
	return 0, fmt.Errorf("任务类型 %s 尚未配置有效价格", taskType)
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

	estCredits, err := resolveEstimatedCredits(req.TaskType, req.ModelName)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "message": err.Error()})
		return
	}

	// 支持根据站长加价率进行换算
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err == nil {
		estCredits = int64(float64(estCredits) * settings.PriceRate)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":           true,
		"estimated_credits": estCredits,
	})
}

// CreateTask 发起 AI 生成任务接口 (POST /tasks 或 /workflows/image-generation)
func CreateTask(c *gin.Context) {
	var req CreateTaskRequest

	// 如果是旧生图工作流请求，使用旧版结构体解析并手动映射到 CreateTaskRequest
	if c.FullPath() == "/api/workflows/image-generation" {
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "读取请求内容失败"})
			return
		}
		// 将读取到的 body 重新写回 Request.Body，防止后续依赖它的中间件或操作受影响
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		var compatReq CompatCreateTaskRequest
		if err := json.Unmarshal(bodyBytes, &compatReq); err == nil {
			req.WorkspaceID = compatReq.WorkspaceID
			req.ProjectID = compatReq.ProjectID
			req.TaskType = "image_generation"
			req.SelectedModel = compatReq.Model
			req.IdempotencyKey = compatReq.IdempotencyKey

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
	if !requireProjectInWorkspace(c, req.ProjectID, req.WorkspaceID) {
		return
	}
	var idempotencyKey *string
	if normalized := strings.TrimSpace(req.IdempotencyKey); normalized != "" {
		idempotencyKey = &normalized
		var existing model.GenerationTask
		if err := database.DB.Where("workspace_id = ? AND user_id = ? AND idempotency_key = ?", req.WorkspaceID, actorID, normalized).First(&existing).Error; err == nil {
			c.JSON(http.StatusOK, gin.H{"success": true, "message": "已返回相同幂等请求创建的任务", "data": existing})
			return
		}
	}

	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "message": "系统计费配置不可用"})
		return
	}

	// 2. 估算与扣除/冻结积分。价格必须来自模型或定价规则，禁止使用代码内默认价格。
	estCredits, err := resolveEstimatedCredits(req.TaskType, req.SelectedModel)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"success": false, "message": err.Error()})
		return
	}
	estCredits = int64(float64(estCredits) * settings.PriceRate)
	if estCredits < 1 {
		estCredits = 1
	}

	// 准备 GenerationTask 记录
	taskID := uuid.New()
	inputStr := string(req.InputPayload)
	var conversationID *string
	if normalized := strings.TrimSpace(req.ConversationID); normalized != "" {
		conversationID = &normalized
	}
	task := model.GenerationTask{
		ID:               taskID,
		WorkspaceID:      req.WorkspaceID,
		ProjectID:        req.ProjectID,
		UserID:           &actorID,
		ConversationID:   conversationID,
		IdempotencyKey:   idempotencyKey,
		TaskType:         req.TaskType,
		InputPayload:     inputStr,
		SelectedModel:    &req.SelectedModel,
		EstimatedCredits: estCredits,
		Status:           "initializing",
		CreatedAt:        time.Now(),
	}
	if err := database.DB.Create(&task).Error; err != nil {
		if idempotencyKey != nil {
			var existing model.GenerationTask
			if database.DB.Where("workspace_id = ? AND user_id = ? AND idempotency_key = ?", req.WorkspaceID, actorID, *idempotencyKey).First(&existing).Error == nil {
				c.JSON(http.StatusOK, gin.H{"success": true, "message": "已返回相同幂等请求创建的任务", "data": existing})
				return
			}
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建本地生成任务失败"})
		return
	}

	// 统一账务接口校验与预扣
	billingSvc := service.GetBillingService()
	success, err := billingSvc.DeductCredits(actorID, req.WorkspaceID, estCredits, fmt.Sprintf("AI 生成任务 %s 积分预冻结", req.TaskType), &task)
	if err != nil {
		database.DB.Delete(&task)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "积分结算失败: " + err.Error()})
		return
	}

	if !success {
		database.DB.Delete(&task)
		c.JSON(http.StatusPaymentRequired, gin.H{"success": false, "message": "工作区积分余额不足，请联系管理员充值"})
		return
	}

	task.Status = "pending"
	transition := database.DB.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, "initializing").Updates(map[string]any{
		"status": task.Status, "frozen_credits": task.FrozenCredits,
		"frozen_gift_credits": task.FrozenGiftCredits, "frozen_refund_credits": task.FrozenRefundCredits,
		"frozen_recharge_credits": task.FrozenRechargeCredits,
	})
	if transition.Error != nil || transition.RowsAffected != 1 {
		task.Status = "failed"
		_ = billingSvc.RefundCredits(actorID, req.WorkspaceID, estCredits, "创建本地任务记录失败，触发自动退款", &task)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交生成任务失败"})
		return
	}

	// 3. 调用 12ZX-AI 网关
	if c.FullPath() == "/api/workflows/image-generation" {
		// 生图工作流兼容接口采用同步方式等待网关调用结束，这样能即时返回生图任务的状态或资产结果给画板展示
		callUpstreamGateway(c.Request.Context(), task, settings)

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
		EnqueueTask(task.ID)

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

	var task model.GenerationTask
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "生成任务不存在"})
		return
	}

	// 校验工作区 owner 或 admin 权限
	if !hasWorkspaceRole(task.WorkspaceID, actorID, []string{"owner", "admin"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限取消此任务"})
		return
	}

	if task.Status != "pending" && task.Status != "dispatching" && task.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "当前任务状态不允许取消"})
		return
	}
	originalStatus := task.Status
	claimed := database.DB.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, originalStatus).Update("status", "settling")
	if claimed.Error != nil || claimed.RowsAffected != 1 {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "任务状态已变化，请刷新后重试"})
		return
	}
	task.Status = "settling"
	creatorID := actorID
	if task.UserID != nil {
		creatorID = *task.UserID
	}
	billingSvc := service.GetBillingService()
	releaseReason := fmt.Sprintf("任务 %s 取消，原路退回冻结积分", taskID.String())
	if err := billingSvc.RefundCredits(creatorID, task.WorkspaceID, task.EstimatedCredits, releaseReason, &task); err != nil {
		database.DB.Model(&model.GenerationTask{}).Where("id = ? AND status = ?", task.ID, "settling").Update("status", originalStatus)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "任务取消退款失败: " + err.Error()})
		return
	}
	task.Status = "cancelled"
	task.CompletedAt = ptrTime(time.Now())
	if err := database.DB.Save(&task).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "任务取消状态保存失败"})
		return
	}
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
	selectedModel := ""
	if task.SelectedModel != nil {
		selectedModel = *task.SelectedModel
	}
	conversationID := ""
	if task.ConversationID != nil {
		conversationID = *task.ConversationID
	}
	reqBody := CreateTaskRequest{
		WorkspaceID:    task.WorkspaceID,
		ProjectID:      task.ProjectID,
		TaskType:       task.TaskType,
		SelectedModel:  selectedModel,
		ConversationID: conversationID,
		InputPayload:   json.RawMessage(task.InputPayload),
	}

	bodyBytes, _ := json.Marshal(reqBody)
	c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	// 直接调用 CreateTask 以保持完全一样的点数冻结和 Goroutine 拉起机制
	CreateTask(c)
}
