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
	WorkspaceID   uuid.UUID       `json:"workspace_id" binding:"required"`
	ProjectID     uuid.UUID       `json:"project_id" binding:"required"`
	TaskType      string          `json:"task_type" binding:"required"` // image_generation / video_generation / text
	SelectedModel string          `json:"selected_model"`
	InputPayload  json.RawMessage `json:"input_payload" binding:"required"`
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

	// 2. 估算与扣除/冻结积分
	var estCredits int64 = 12 // 默认生图估算 12 点
	if req.TaskType == "video_generation" || req.TaskType == "image_to_video" {
		estCredits = 30
	} else if req.TaskType == "text" {
		estCredits = 2
	}

	// 动态关联管理后台设置的模型定价 (CreditsCost)
	if req.SelectedModel != "" {
		var m model.Model
		if err := database.DB.Where("id = ?", req.SelectedModel).First(&m).Error; err != nil {
			// 兜底匹配：若是模板推荐的模型ID没有带 provider_uuid 前缀，则使用 name 进行匹配
			_ = database.DB.Where("name = ? AND enabled = true", req.SelectedModel).First(&m).Error
		}
		if m.CreditsCost > 0 {
			estCredits = int64(m.CreditsCost + 0.5)
		}
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
	if err := forUpdate(tx).Where("id = ?", taskID).First(&task).Error; err != nil {
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
	forUpdate(tx).Where("id = ?", task.WorkspaceID).First(&ws)
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
