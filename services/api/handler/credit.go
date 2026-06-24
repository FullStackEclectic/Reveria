package handler

import (
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

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

	var ws model.Workspace
	if err := database.DB.Where("id = ?", workspaceID).First(&ws).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "工作区不存在"})
		return
	}

	total := ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance

	c.JSON(http.StatusOK, gin.H{
		"workspace_id":     ws.ID,
		"recharge_credits": ws.RechargeBalance,
		"gift_credits":     ws.GiftBalance,
		"refund_credits":   ws.RefundBalance,
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

	c.JSON(http.StatusOK, transactions)
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

// ListPlans 获取套餐列表 (GET /billing/plans)
func ListPlans(c *gin.Context) {
	var plans []model.Plan
	if err := database.DB.Where("enabled = ?", true).Find(&plans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "无法获取套餐列表: " + err.Error()})
		return
	}

	// 如果数据库中没有任何 plan，则默认返回一个测试套餐（保证演示和本地测试高可用）
	if len(plans) == 0 {
		defaultPlan := model.Plan{
			ID:                uuid.New(),
			Name:              "体验版套餐 (自动生成)",
			PriceCents:        0,
			MonthlyCredits:    1000,
			MaxMembers:        3,
			StorageQuotaBytes: 10 * 1024 * 1024 * 1024,
			Enabled:           true,
			CreatedAt:         time.Now(),
			UpdatedAt:         time.Now(),
		}
		_ = database.DB.Create(&defaultPlan)
		plans = append(plans, defaultPlan)
	}

	c.JSON(http.StatusOK, plans)
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
			"pay_url":      "https://api.12zx.com/mock/pay/" + order.ID.String(), // 模拟支付扫码页
			"amount_cents": order.AmountCents,
		},
	})
}

// MockPayOrder 模拟支付订单 (POST /billing/orders/:order_id/mock-pay)
func MockPayOrder(c *gin.Context) {
	orderIDStr := c.Param("order_id")
	orderID, err := uuid.Parse(orderIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "订单 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	// 必须为平台管理员
	var actor model.User
	if err := database.DB.Where("id = ?", actorID).First(&actor).Error; err != nil || !actor.IsPlatformAdmin {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "仅平台超级管理员可执行模拟支付"})
		return
	}

	tx := database.DB.Begin()

	var order model.Order
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", orderID).First(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定订单"})
		return
	}

	if order.Status != "pending" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "该订单已支付或已取消"})
		return
	}

	if order.PlanID == nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "订单没有关联的订阅套餐"})
		return
	}

	var plan model.Plan
	if err := tx.Where("id = ?", *order.PlanID).First(&plan).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取套餐详情失败"})
		return
	}

	// 1. 更新订单状态为 paid
	order.Status = "paid"
	order.UpdatedAt = time.Now()
	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新订单状态失败"})
		return
	}

	// 2. 更新工作区信息 (增加 Gift 余额和存储配额)
	var ws model.Workspace
	if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", order.WorkspaceID).First(&ws).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新工作区账本失败"})
		return
	}

	ws.PlanID = order.PlanID
	ws.StorageQuota = plan.StorageQuotaBytes
	ws.GiftBalance += plan.MonthlyCredits
	ws.UpdatedAt = time.Now()
	if err := tx.Save(&ws).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存工作区账本失败"})
		return
	}

	// 3. 写入 Gift 余额批次表
	if plan.MonthlyCredits > 0 {
		batch := model.GiftCreditBatch{
			ID:              uuid.New(),
			WorkspaceID:     order.WorkspaceID,
			Amount:          plan.MonthlyCredits,
			RemainingAmount: plan.MonthlyCredits,
			ExpiredAt:       time.Now().Add(30 * 24 * time.Hour), // 30天有效期
			CreatedAt:       time.Now(),
		}
		if err := tx.Create(&batch).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存积分赠送批次失败"})
			return
		}
	}

	// 4. 写入充值记录表
	recharge := model.RechargeRecord{
		ID:           uuid.New(),
		WorkspaceID:  order.WorkspaceID,
		OrderID:      &order.ID,
		CreditsAdded: plan.MonthlyCredits,
		RechargeType: "plan_monthly",
		OperatorID:   &actorID,
		CreatedAt:    time.Now(),
	}
	if err := tx.Create(&recharge).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存充值记录失败"})
		return
	}

	// 5. 写入额度流水表
	reason := "订单模拟支付：订阅套餐增加额度"
	transaction := model.CreditTransaction{
		ID:              uuid.New(),
		WorkspaceID:     order.WorkspaceID,
		UserID:          &actorID,
		TransactionType: "plan_monthly",
		Amount:          plan.MonthlyCredits,
		GiftAmount:      plan.MonthlyCredits,
		RechargeAmount:  0,
		RefundAmount:    0,
		BalanceAfter:    ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
		Reason:          &reason,
		OperatorID:      &actorID,
		CreatedAt:       time.Now(),
	}
	if err := tx.Create(&transaction).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "写入点数消费流水失败"})
		return
	}

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "模拟支付成功，额度已划拨到位",
		"data":    order,
	})
}
