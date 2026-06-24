package handler

import (
	"fmt"
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AdjustCreditsRequest 补点扣点载荷
type AdjustCreditsRequest struct {
	WorkspaceID uuid.UUID `json:"workspace_id" binding:"required"`
	Amount      int64     `json:"amount" binding:"required"` // 正数为充值，负数为扣减
	Reason      string    `json:"reason" binding:"required"`
}

// AdjustCredits 平台管理员手动补点扣点 (POST /admin/credits/adjust)
func AdjustCredits(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)

	// 权限拦截：仅限系统平台超管 (IsPlatformAdmin)
	var actor model.User
	if err := database.DB.Where("id = ?", actorID).First(&actor).Error; err != nil || !actor.IsPlatformAdmin {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "仅平台超级管理员可执行调额操作"})
		return
	}

	var req AdjustCreditsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入不合法"})
		return
	}

	tx := database.DB.Begin()

	var ws model.Workspace
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", req.WorkspaceID).First(&ws).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定工作区"})
		return
	}

	// 调额写入对应的余额
	if req.Amount >= 0 {
		ws.RechargeBalance += req.Amount
	} else {
		// 负数调减
		absAmount := -req.Amount
		if ws.RechargeBalance >= absAmount {
			ws.RechargeBalance -= absAmount
		} else {
			remaining := absAmount - ws.RechargeBalance
			ws.RechargeBalance = 0
			if ws.GiftBalance >= remaining {
				ws.GiftBalance -= remaining
			} else {
				tx.Rollback()
				c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区额度余额不足，扣减失败"})
				return
			}
		}
	}

	if err := tx.Save(&ws).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存账本失败"})
		return
	}

	// 记录流水
	var tranType string
	if req.Amount >= 0 {
		tranType = "adjust_add"
	} else {
		tranType = "adjust_sub"
	}

	transaction := model.CreditTransaction{
		ID:              uuid.New(),
		WorkspaceID:     ws.ID,
		UserID:          &actorID,
		TransactionType: tranType,
		Amount:          req.Amount,
		BalanceAfter:    ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
		Reason:          &req.Reason,
		OperatorID:      &actorID,
		CreatedAt:       time.Now(),
	}

	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "流水账记录失败"})
		return
	}

	// 记录审计日志
	auditLog := model.AuditLog{
		ID:          uuid.New(),
		WorkspaceID: ws.ID,
		OperatorID:  &actorID,
		Action:      "adjust_credits",
		TargetType:  ptrString("workspace"),
		TargetID:    &ws.ID,
		AfterSnapshot: ptrString(fmt.Sprintf(`{"amount": %d, "reason": "%s"}`, req.Amount, req.Reason)),
		CreatedAt:   time.Now(),
	}
	tx.Create(&auditLog)

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "额度手动微调成功",
		"balance": ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
	})
}

// WorkspaceMemberSummary 包含关联的用户名称和邮箱
type WorkspaceMemberSummary struct {
	ID                 uuid.UUID `json:"id"`
	WorkspaceID        uuid.UUID `json:"workspace_id"`
	UserID             uuid.UUID `json:"user_id"`
	Role               string    `json:"role"`
	DailyCreditLimit   *int64    `json:"daily_credit_limit"`
	MonthlyCreditLimit *int64    `json:"monthly_credit_limit"`
	Status             string    `json:"status"`
	JoinedAt           time.Time `json:"joined_at"`
	DisplayName        string    `json:"display_name"`
	Email              string    `json:"email"`
}

// ListWorkspaceMembers 管理员获取工作区成员列表 (GET /admin/workspace-members)
func ListWorkspaceMembers(c *gin.Context) {
	workspaceIDStr := c.Query("workspace_id")
	if workspaceIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "必须提供 workspace_id 参数"})
		return
	}

	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	// 校验工作区权限：仅限 owner 或 admin 可操作
	if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看成员配置"})
		return
	}

	var members []WorkspaceMemberSummary
	err = database.DB.Table("workspace_members").
		Select("workspace_members.*, users.display_name, users.email").
		Joins("left join users on users.id = workspace_members.user_id").
		Where("workspace_members.workspace_id = ?", workspaceID).
		Scan(&members).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "读取成员列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, members)
}

// UpsertWorkspaceMemberRequest 成员额度及角色配置载荷
type UpsertWorkspaceMemberRequest struct {
	WorkspaceID        uuid.UUID  `json:"workspace_id" binding:"required"`
	UserID             uuid.UUID  `json:"user_id" binding:"required"`
	Role               string     `json:"role" binding:"required"` // owner / admin / manager / creator / viewer
	DailyCreditLimit   *int64     `json:"daily_credit_limit"`
	MonthlyCreditLimit *int64     `json:"monthly_credit_limit"`
}

// UpsertWorkspaceMember 配置和修改工作区成员限额及角色 (POST /admin/workspace-members)
func UpsertWorkspaceMember(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)

	var req UpsertWorkspaceMemberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数有误"})
		return
	}

	// 只有所有者或管理员可以分配角色限额
	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限配置工作区成员限额"})
		return
	}

	var member model.WorkspaceMember
	err := database.DB.Where("workspace_id = ? AND user_id = ?", req.WorkspaceID, req.UserID).First(&member).Error
	if err != nil {
		// 创建新成员
		member = model.WorkspaceMember{
			ID:                 uuid.New(),
			WorkspaceID:        req.WorkspaceID,
			UserID:             req.UserID,
			Role:               req.Role,
			DailyCreditLimit:   req.DailyCreditLimit,
			MonthlyCreditLimit: req.MonthlyCreditLimit,
			Status:             "joined",
			JoinedAt:           time.Now(),
		}
		if err := database.DB.Create(&member).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "添加成员配置失败"})
			return
		}
	} else {
		// 更新已有配置
		member.Role = req.Role
		member.DailyCreditLimit = req.DailyCreditLimit
		member.MonthlyCreditLimit = req.MonthlyCreditLimit
		if err := database.DB.Save(&member).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新成员配置失败"})
			return
		}
	}

	c.JSON(http.StatusOK, member)
}

// GetCostReport 获取大盘成本与毛利报表 (GET /admin/reports/costs)
func GetCostReport(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)

	var user model.User
	if err := database.DB.Where("id = ?", actorID).First(&user).Error; err != nil || !user.IsPlatformAdmin {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权访问财务报表"})
		return
	}

	// 统计总消费点数，及站长实际支出批发点数
	type Result struct {
		TotalSucceededTasks   int64 `gorm:"column:total_succeeded_tasks"`
		TotalEstimatedCredits int64 `gorm:"column:total_estimated_credits"`
		TotalActualCredits    int64 `gorm:"column:total_actual_credits"`
		TotalUpstreamCost     int64 `gorm:"column:total_upstream_cost"`
	}

	var res Result
	database.DB.Table("generation_tasks").
		Select("count(id) as total_succeeded_tasks, sum(estimated_credits) as total_estimated_credits, sum(actual_credits) as total_actual_credits, sum(upstream_cost_credits) as total_upstream_cost").
		Where("status = ?", "succeeded").
		Scan(&res)

	// 计算利润点数（分站赚取的积分）
	netProfitCredits := res.TotalActualCredits - res.TotalUpstreamCost

	c.JSON(http.StatusOK, gin.H{
		"total_succeeded_tasks":   res.TotalSucceededTasks,
		"total_estimated_credits": res.TotalEstimatedCredits,
		"total_actual_credits":    res.TotalActualCredits,
		"total_upstream_cost":     res.TotalUpstreamCost,
		"net_profit_credits":      netProfitCredits,
	})
}

// UserSummary 用户简易大盘实体
type UserSummary struct {
	ID              uuid.UUID `json:"id"`
	DisplayName     string    `json:"display_name"`
	Email           string    `json:"email"`
	IsPlatformAdmin bool      `json:"is_platform_admin"`
}

// ListAdminUsers 获取系统所有用户列表 (GET /api/admin/users)
func ListAdminUsers(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)

	// 仅限系统超管
	var actor model.User
	if err := database.DB.Where("id = ?", actorID).First(&actor).Error; err != nil || !actor.IsPlatformAdmin {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "仅平台超级管理员可执行该操作"})
		return
	}

	var users []model.User
	if err := database.DB.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取用户大盘失败: " + err.Error()})
		return
	}

	var summaries []UserSummary
	for _, u := range users {
		emailStr := ""
		if u.Email != nil {
			emailStr = *u.Email
		}
		dispName := ""
		if u.DisplayName != nil {
			dispName = *u.DisplayName
		}
		summaries = append(summaries, UserSummary{
			ID:              u.ID,
			DisplayName:     dispName,
			Email:           emailStr,
			IsPlatformAdmin: u.IsPlatformAdmin,
		})
	}

	c.JSON(http.StatusOK, summaries)
}

// UpdatePlatformAdmin 修改用户系统超级管理员标记 (POST /api/admin/users/:user_id/platform-admin)
func UpdatePlatformAdmin(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)

	var actor model.User
	if err := database.DB.Where("id = ?", actorID).First(&actor).Error; err != nil || !actor.IsPlatformAdmin {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "仅限超级管理员操作"})
		return
	}

	targetUserIDStr := c.Param("user_id")
	targetUserID, err := uuid.Parse(targetUserIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "目标用户 ID 格式有误"})
		return
	}

	var req struct {
		IsPlatformAdmin bool `json:"is_platform_admin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数格式错误"})
		return
	}

	if err := database.DB.Model(&model.User{}).Where("id = ?", targetUserID).Update("is_platform_admin", req.IsPlatformAdmin).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新超级管理员权限失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "用户超级管理员权限更新成功"})
}

// Mock 接口使用的响应载荷结构体
type ProviderSummary struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	ProviderType string `json:"provider_type"`
	Enabled      bool   `json:"enabled"`
}

type ModelSummary struct {
	ID          string `json:"id"`
	ProviderID  string `json:"provider_id"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	Enabled     bool   `json:"enabled"`
}

// MockListProviders (GET /api/admin/providers)
func MockListProviders(c *gin.Context) {
	providers := []ProviderSummary{
		{ID: "12zx-ai", Name: "12ZX-AI 大模型中台网关", ProviderType: "gateway", Enabled: true},
	}
	c.JSON(http.StatusOK, providers)
}

func MockCreateProvider(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"id": "new-mock-provider", "name": "新网关通道"})
}

func MockEnableProvider(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func MockDeleteProvider(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// MockListModels (GET /api/admin/models) - 写死返回常用模型配置，高可用支持下拉选择
func MockListModels(c *gin.Context) {
	models := []ModelSummary{
		{ID: "deepseek-chat", ProviderID: "12zx-ai", Name: "deepseek-chat", DisplayName: "DeepSeek Chat (网关LLM)", Enabled: true},
		{ID: "gpt-4o", ProviderID: "12zx-ai", Name: "gpt-4o", DisplayName: "GPT-4o (网关LLM)", Enabled: true},
		{ID: "kling-v1.5", ProviderID: "12zx-ai", Name: "kling-v1.5", DisplayName: "可灵 Kling 视频 (网关视频)", Enabled: true},
		{ID: "stable-diffusion-3", ProviderID: "12zx-ai", Name: "stable-diffusion-3", DisplayName: "Stable Diffusion 3 (网关生图)", Enabled: true},
	}
	c.JSON(http.StatusOK, models)
}

func MockCreateModel(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"id": "new-mock-model", "name": "新大模型通道"})
}

func MockEnableModel(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func MockDeleteModel(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// MockListPricingRules (GET /api/admin/pricing-rules)
func MockListPricingRules(c *gin.Context) {
	// 返回空数组，代表采用分站默认加价策略
	c.JSON(http.StatusOK, []any{})
}

func MockCreatePricingRule(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// MockListWorkflowTemplates (GET /api/admin/workflow-templates)
func MockListWorkflowTemplates(c *gin.Context) {
	c.JSON(http.StatusOK, []any{})
}

func MockCreateWorkflowTemplate(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func MockEnableWorkflowTemplate(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func MockPublishWorkflowTemplate(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// MockTestTextModel (POST /api/admin/models/test-text)
func MockTestTextModel(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "网关文字通道连通性测试通过"})
}

// MockTestImageModel (POST /api/admin/models/test-image)
func MockTestImageModel(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "网关图片通道连通性测试通过"})
}
