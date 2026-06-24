package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
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

// DeleteWorkspaceMember 物理删除工作区成员记录 (DELETE /admin/workspace-members)
func DeleteWorkspaceMember(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		WorkspaceID uuid.UUID `json:"workspace_id" binding:"required"`
		UserID      uuid.UUID `json:"user_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数有误"})
		return
	}

	// 只有工作区的所有者或管理员可以移除成员
	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限移除该成员"})
		return
	}

	// 执行删除
	var member model.WorkspaceMember
	err := database.DB.Where("workspace_id = ? AND user_id = ?", req.WorkspaceID, req.UserID).First(&member).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未在该工作区中找到指定成员记录"})
		return
	}

	// 限制：无法删除工作区最后一个 owner
	if member.Role == "owner" {
		var ownerCount int64
		database.DB.Model(&model.WorkspaceMember{}).Where("workspace_id = ? AND role = ?", req.WorkspaceID, "owner").Count(&ownerCount)
		if ownerCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无法删除工作区最后一个所有者"})
			return
		}
	}

	if err := database.DB.Delete(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "移出工作区失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "已成功将成员移出该工作区"})
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
// 1. 服务商管理

// ListProviders 获取服务商列表 (GET /api/admin/providers)
func ListProviders(c *gin.Context) {
	var list []model.Provider
	if err := database.DB.Order("created_at desc").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取服务商列表失败"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateProvider 创建或更新服务商 (POST /api/admin/providers)
func CreateProvider(c *gin.Context) {
	var req model.Provider
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入格式有误"})
		return
	}

	if req.ID == "" {
		req.ID = uuid.New().String()
	}
	req.CreatedAt = time.Now()

	var existing model.Provider
	err := database.DB.Where("id = ?", req.ID).First(&existing).Error
	if err != nil {
		// 创建
		if err := database.DB.Create(&req).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建服务商失败"})
			return
		}
	} else {
		// 更新
		existing.Name = req.Name
		existing.ApiURL = req.ApiURL
		existing.ApiKey = req.ApiKey
		existing.ProviderType = req.ProviderType
		existing.Enabled = req.Enabled
		if err := database.DB.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新服务商失败"})
			return
		}
		req = existing
	}

	c.JSON(http.StatusOK, req)
}

// EnableProvider 启用/禁用服务商 (POST /api/admin/providers/:id/enabled)
func EnableProvider(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数有误"})
		return
	}

	if err := database.DB.Model(&model.Provider{}).Where("id = ?", id).Update("enabled", req.Enabled).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "状态更新失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DeleteProvider 删除服务商 (DELETE /api/admin/providers/:id)
func DeleteProvider(c *gin.Context) {
	id := c.Param("id")
	// 删除服务商
	if err := database.DB.Delete(&model.Provider{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败"})
		return
	}
	// 连带删除该服务商下的模型
	database.DB.Delete(&model.Model{}, "provider_id = ?", id)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 2. 算力模型管理

// ListModels 获取模型列表 (GET /api/admin/models)
func ListModels(c *gin.Context) {
	var list []model.Model
	if err := database.DB.Order("created_at desc").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取模型列表失败"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateModel 创建或修改模型定价 (POST /api/admin/models)
func CreateModel(c *gin.Context) {
	var req model.Model
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数格式错误"})
		return
	}

	if req.ID == "" {
		req.ID = req.Name // 默认用 Name 作为 ID
	}
	req.CreatedAt = time.Now()

	var existing model.Model
	err := database.DB.Where("id = ?", req.ID).First(&existing).Error
	if err != nil {
		if err := database.DB.Create(&req).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建模型失败"})
			return
		}
	} else {
		existing.DisplayName = req.DisplayName
		existing.ModelType = req.ModelType
		existing.CreditsCost = req.CreditsCost
		existing.Enabled = req.Enabled
		if err := database.DB.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存模型失败"})
			return
		}
		req = existing
	}
	c.JSON(http.StatusOK, req)
}

// EnableModel 启用/禁用模型 (POST /api/admin/models/:id/enabled)
func EnableModel(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数格式有误"})
		return
	}

	if err := database.DB.Model(&model.Model{}).Where("id = ?", id).Update("enabled", req.Enabled).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DeleteModel 删除模型 (DELETE /api/admin/models/:id)
func DeleteModel(c *gin.Context) {
	id := c.Param("id")
	log.Printf("[DeleteModel] 收到删除模型请求，ID = %s", id)
	db := database.DB.Delete(&model.Model{}, "id = ?", id)
	if db.Error != nil {
		log.Printf("[DeleteModel] 从数据库删除失败: %v", db.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败: " + db.Error.Error()})
		return
	}
	log.Printf("[DeleteModel] 从数据库删除成功，RowsAffected = %d", db.RowsAffected)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// 3. 实时代理拉取模型与批量导入

type FetchUpstreamModelsRequest struct {
	ApiURL string `json:"api_url" binding:"required"`
	ApiKey string `json:"api_key" binding:"required"`
}

type UpstreamModelItem struct {
	ID string `json:"id"`
}

type UpstreamModelsResponse struct {
	Data []UpstreamModelItem `json:"data"`
}

// FetchUpstreamModels 代理拉取上游服务商模型 (POST /api/admin/providers/fetch-upstream-models)
func FetchUpstreamModels(c *gin.Context) {
	var req FetchUpstreamModelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求参数不合法"})
		return
	}

	url := strings.TrimSuffix(req.ApiURL, "/") + "/v1/models"
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "上游 API 链接格式有误"})
		return
	}
	httpReq.Header.Set("Authorization", "Bearer "+req.ApiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "访问上游失败，连接超时或网络不通: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": fmt.Sprintf("上游返回错误 (Status: %d): %s", resp.StatusCode, string(bodyBytes))})
		return
	}

	var upstreamResp UpstreamModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&upstreamResp); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "解析上游模型格式失败"})
		return
	}

	var ids []string
	for _, item := range upstreamResp.Data {
		ids = append(ids, item.ID)
	}

	c.JSON(http.StatusOK, ids)
}

type BatchImportItem struct {
	ID          string `json:"id"`
	ProviderID  string `json:"provider_id"`
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
	ModelType   string `json:"model_type"`
	CreditsCost int64  `json:"credits_cost"`
}

// BatchImportModels 批量导入并设定模型定价 (POST /api/admin/models/batch-import)
func BatchImportModels(c *gin.Context) {
	var req []BatchImportItem
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入有误"})
		return
	}

	tx := database.DB.Begin()
	for _, item := range req {
		var modelItem model.Model
		err := tx.Where("id = ?", item.ID).First(&modelItem).Error
		if err != nil {
			// 新增
			modelItem = model.Model{
				ID:          item.ID,
				ProviderID:  item.ProviderID,
				Name:        item.Name,
				DisplayName: item.DisplayName,
				ModelType:   item.ModelType,
				Enabled:     true,
				CreditsCost: item.CreditsCost,
				CreatedAt:   time.Now(),
			}
			if err := tx.Create(&modelItem).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "导入模型失败: " + err.Error()})
				return
			}
		} else {
			// 覆盖更新类型与价格
			modelItem.ModelType = item.ModelType
			modelItem.CreditsCost = item.CreditsCost
			if err := tx.Save(&modelItem).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新模型失败: " + err.Error()})
				return
			}
		}
	}
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "模型批量导入保存成功"})
}

// Mock 辅助存根
func MockListPricingRules(c *gin.Context) {
	c.JSON(http.StatusOK, []any{})
}
func MockCreatePricingRule(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true})
}
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
func MockTestTextModel(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "网关文字通道连通性测试通过"})
}
func MockTestImageModel(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "网关图片通道连通性测试通过"})
}
