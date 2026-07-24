package handler

import (
	"net/http"
	"regexp"
	"strconv"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"
	"reveria/services/api/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// GetCreditBalance 获取积分余额详情 (GET /credits/:workspace_id/balance)
func GetCreditBalance(c *gin.Context) {
	workspaceIDStr := c.Param("workspace_id")
	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此账本"})
		return
	}

	// 使用账务服务查询
	billingSvc := service.GetBillingService()
	total, err := billingSvc.GetBalance(actorID, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取积分余额失败: " + err.Error()})
		return
	}

	// 加载本地工作区，只为了前端做旧字段兼容
	var ws model.Workspace
	database.DB.Where("id = ?", workspaceID).First(&ws)

	c.JSON(http.StatusOK, gin.H{
		"workspace_id":     workspaceID,
		"recharge_credits": float64(ws.RechargeBalance),
		"gift_credits":     float64(ws.GiftBalance),
		"refund_credits":   float64(ws.RefundBalance),
		"total_credits":    total,
	})
}

// ListCreditTransactions 查询消费流水 (GET /credits/:workspace_id/transactions)
func ListCreditTransactions(c *gin.Context) {
	workspaceIDStr := c.Param("workspace_id")
	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此流水"})
		return
	}

	var transactions []model.CreditTransaction
	if err := database.DB.Where("workspace_id = ?", workspaceID).Order("created_at desc").Limit(100).Find(&transactions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取流水失败: " + err.Error()})
		return
	}

	var respList []map[string]any
	re := regexp.MustCompile(`实际消耗:\s*([0-9.]+)\s*积分`)

	for _, t := range transactions {
		m := map[string]any{
			"id":               t.ID.String(),
			"workspace_id":     t.WorkspaceID.String(),
			"transaction_type": t.TransactionType,
			"amount":           float64(t.Amount),
			"gift_amount":      float64(t.GiftAmount),
			"recharge_amount":  float64(t.RechargeAmount),
			"refund_amount":    float64(t.RefundAmount),
			"balance_after":    float64(t.BalanceAfter),
			"reason":           t.Reason,
			"created_at":       t.CreatedAt,
		}
		if t.UserID != nil {
			m["user_id"] = t.UserID.String()
		}
		if t.ProjectID != nil {
			m["project_id"] = t.ProjectID.String()
		}
		if t.TaskID != nil {
			m["task_id"] = t.TaskID.String()
		}
		if t.OperatorID != nil {
			m["operator_id"] = t.OperatorID.String()
		}

		if t.Reason != nil {
			matches := re.FindStringSubmatch(*t.Reason)
			if len(matches) > 1 {
				if val, err := strconv.ParseFloat(matches[1], 64); err == nil {
					m["amount"] = val
				}
			}
		}
		respList = append(respList, m)
	}

	c.JSON(http.StatusOK, respList)
}

// ListRechargeRecords 查询充值记录 (GET /credits/:workspace_id/recharges)
func ListRechargeRecords(c *gin.Context) {
	workspaceIDStr := c.Param("workspace_id")
	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看充值记录"})
		return
	}

	var records []model.RechargeRecord
	if err := database.DB.Where("workspace_id = ?", workspaceID).Order("created_at desc").Find(&records).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取充值记录失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, records)
}

func ensureDefaultPlans() []model.Plan {
	var plans []model.Plan
	database.DB.Find(&plans)

	// 如果数据库中套餐过少，我们自动清空重写，Seed 完整的包月方案和纯点数包
	if len(plans) <= 2 {
		database.DB.Exec("DELETE FROM plans")
		plans = nil

		seedPlans := []model.Plan{
			// 1. 订阅型套餐 (IsPointsPackage = false)
			{
				ID:                uuid.MustParse("00000000-0000-0000-0000-000000000001"),
				Name:              "体验版订阅 (包月)",
				BadgeLabel:        "FREE",
				PriceCents:        0,
				MonthlyCredits:    1000,
				MaxMembers:        3,
				StorageQuotaBytes: 2 * 1024 * 1024 * 1024, // 2GB
				Enabled:           true,
				IsPointsPackage:   false,
				CreatedAt:         time.Now(),
				UpdatedAt:         time.Now(),
			},
			{
				ID:                uuid.MustParse("00000000-0000-0000-0000-000000000002"),
				Name:              "专业版订阅 (包月)",
				BadgeLabel:        "PRO",
				PriceCents:        9900, // ￥99
				MonthlyCredits:    5000,
				MaxMembers:        10,
				StorageQuotaBytes: 50 * 1024 * 1024 * 1024, // 50GB
				Enabled:           true,
				IsPointsPackage:   false,
				CreatedAt:         time.Now(),
				UpdatedAt:         time.Now(),
			},
			{
				ID:                uuid.MustParse("00000000-0000-0000-0000-000000000003"),
				Name:              "企业版订阅 (包月)",
				BadgeLabel:        "ENT",
				PriceCents:        29900, // ￥299
				MonthlyCredits:    20000,
				MaxMembers:        30,
				StorageQuotaBytes: 200 * 1024 * 1024 * 1024, // 200GB
				Enabled:           true,
				IsPointsPackage:   false,
				CreatedAt:         time.Now(),
				UpdatedAt:         time.Now(),
			},
			// 2. 纯点数直充包 (IsPointsPackage = true)
			{
				ID:                uuid.MustParse("00000000-0000-0000-0000-000000000010"),
				Name:              "100点 基础点数直充",
				BadgeLabel:        "100",
				PriceCents:        1000, // ￥10
				MonthlyCredits:    100,  // 点数直充也是借用这个字段记录购买点数
				MaxMembers:        1,
				StorageQuotaBytes: 0,
				Enabled:           true,
				IsPointsPackage:   true,
				CreatedAt:         time.Now(),
				UpdatedAt:         time.Now(),
			},
			{
				ID:                uuid.MustParse("00000000-0000-0000-0000-000000000011"),
				Name:              "550点 特惠点数直充 (送50)",
				BadgeLabel:        "550",
				PriceCents:        5000, // ￥50
				MonthlyCredits:    550,
				MaxMembers:        1,
				StorageQuotaBytes: 0,
				Enabled:           true,
				IsPointsPackage:   true,
				CreatedAt:         time.Now(),
				UpdatedAt:         time.Now(),
			},
			{
				ID:                uuid.MustParse("00000000-0000-0000-0000-000000000012"),
				Name:              "1200点 豪华点数直充 (送200)",
				BadgeLabel:        "1200",
				PriceCents:        10000, // ￥100
				MonthlyCredits:    1200,
				MaxMembers:        1,
				StorageQuotaBytes: 0,
				Enabled:           true,
				IsPointsPackage:   true,
				CreatedAt:         time.Now(),
				UpdatedAt:         time.Now(),
			},
		}

		for _, p := range seedPlans {
			_ = database.DB.Create(&p)
			plans = append(plans, p)
		}
	}

	return plans
}

// ListPlans 获取套餐列表 (GET /billing/plans)
func ListPlans(c *gin.Context) {
	ensureDefaultPlans()

	var plans []model.Plan
	if err := database.DB.Where("enabled = ?", true).Find(&plans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "无法获取套餐列表: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, plans)
}

// ListAdminPlans 获取全部套餐配置 (GET /admin/plans)
func ListAdminPlans(c *gin.Context) {
	if !checkPlatformAdmin(c) {
		return
	}

	ensureDefaultPlans()

	var plans []model.Plan
	if err := database.DB.Order("is_points_package asc, price_cents asc, created_at asc").Find(&plans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "无法获取套餐配置: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, plans)
}

type UpdatePlanRequest struct {
	Name              string `json:"name" binding:"required"`
	BadgeLabel        string `json:"badge_label"`
	PriceCents        int64  `json:"price_cents"`
	MonthlyCredits    int64  `json:"monthly_credits"`
	MaxMembers        int    `json:"max_members"`
	StorageQuotaBytes int64  `json:"storage_quota_bytes"`
	Enabled           bool   `json:"enabled"`
	IsPointsPackage   bool   `json:"is_points_package"`
}

// UpdateAdminPlan 更新套餐配置 (PUT /admin/plans/:id)
func UpdateAdminPlan(c *gin.Context) {
	if !checkPlatformAdmin(c) {
		return
	}

	planID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "套餐 ID 格式有误"})
		return
	}

	var req UpdatePlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入不合法"})
		return
	}

	if req.PriceCents < 0 || req.MonthlyCredits < 0 || req.StorageQuotaBytes < 0 || req.MaxMembers < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "套餐数值配置不合法"})
		return
	}

	var plan model.Plan
	if err := database.DB.Where("id = ?", planID).First(&plan).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "套餐不存在"})
		return
	}

	plan.Name = req.Name
	plan.BadgeLabel = req.BadgeLabel
	plan.PriceCents = req.PriceCents
	plan.MonthlyCredits = req.MonthlyCredits
	plan.MaxMembers = req.MaxMembers
	plan.StorageQuotaBytes = req.StorageQuotaBytes
	plan.Enabled = req.Enabled
	plan.IsPointsPackage = req.IsPointsPackage
	plan.UpdatedAt = time.Now()

	if err := database.DB.Save(&plan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "套餐保存失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, plan)
}

// CreateOrder 创建充值/购买订单 (POST /billing/orders)
func CreateOrder(c *gin.Context) {
	var req struct {
		WorkspaceID     uuid.UUID  `json:"workspace_id" binding:"required"`
		PlanID          *uuid.UUID `json:"plan_id"`
		AmountCents     int64      `json:"amount_cents" binding:"required"`
		PaymentProvider string     `json:"payment_provider" binding:"required"` // wechat / alipay / stripe
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入不合法"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "只有所有者或管理员才可以发起支付订购"})
		return
	}

	order := model.Order{
		ID:              uuid.New(),
		WorkspaceID:     req.WorkspaceID,
		PlanID:          req.PlanID,
		AmountCents:     req.AmountCents,
		PaymentProvider: req.PaymentProvider,
		Status:          "pending",
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := database.DB.Create(&order).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "订单生成失败: " + err.Error()})
		return
	}

	// 模拟返回：在完整的生产环境中，这里应该去调 go-pay 调起微信扫码或支付宝 H5 并返回二维码连接
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "订单初始化完成，等待支付",
		"data": gin.H{
			"order_id":     order.ID,
			"status":       order.Status,
			"pay_url":      nil,
			"amount_cents": order.AmountCents,
		},
	})
}

// ListWorkspaceOrders 查询工作区订单记录 (GET /credits/:workspace_id/orders)
func ListWorkspaceOrders(c *gin.Context) {
	workspaceIDStr := c.Param("workspace_id")
	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此账本订单"})
		return
	}

	var orders []model.Order
	if err := database.DB.Where("workspace_id = ?", workspaceID).Order("created_at desc").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询订单记录失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, orders)
}
