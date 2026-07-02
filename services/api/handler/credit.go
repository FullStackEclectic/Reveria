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

	var recharge, gift, refund float64
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err == nil && settings.BillingMode == "bridge" {
		gift = total // 桥接模式下将总额度当做赠送积分返回，保证前端大盘完美展示
	} else {
		recharge = float64(ws.RechargeBalance)
		gift = float64(ws.GiftBalance)
		refund = float64(ws.RefundBalance)
	}

	c.JSON(http.StatusOK, gin.H{
		"workspace_id":     workspaceID,
		"recharge_credits": recharge,
		"gift_credits":     gift,
		"refund_credits":   refund,
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

// ListPlans 获取套餐列表 (GET /billing/plans)
func ListPlans(c *gin.Context) {
	var plans []model.Plan
	if err := database.DB.Where("enabled = ?", true).Find(&plans).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "无法获取套餐列表: " + err.Error()})
		return
	}

	// 如果数据库中套餐过少，我们自动清空重写，Seed 完整的包月方案和纯点数包
	if len(plans) <= 2 {
		database.DB.Exec("DELETE FROM plans")
		plans = nil

		seedPlans := []model.Plan{
			// 1. 订阅型套餐 (IsPointsPackage = false)
			{
				ID:                uuid.MustParse("00000000-0000-0000-0000-000000000001"),
				Name:              "体验版订阅 (包月)",
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

	var settings model.ClientSettings
	var isBridge = false
	if err := tx.First(&settings).Error; err == nil && settings.BillingMode == "bridge" {
		isBridge = true
	}

	var rechargeType = "plan_monthly"
	var reason = "订单模拟支付：订阅套餐增加额度"
	var txType = "plan_monthly"
	var txGift int64 = plan.MonthlyCredits
	var txRecharge int64 = 0

	if plan.IsPointsPackage {
		rechargeType = "recharge"
		reason = "订单模拟支付：在线充值增加点数"
		txType = "recharge"
		txGift = 0
		txRecharge = plan.MonthlyCredits

		if isBridge {
			billingSvc := service.GetBillingService()
			err := billingSvc.RefundCredits(ws.OwnerUserID, ws.ID, plan.MonthlyCredits, "充值点数支付成功，同步加额到主站", nil)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "同步充值额度至主站失败: " + err.Error()})
				return
			}
		} else {
			ws.RechargeBalance += plan.MonthlyCredits
		}
	} else {
		ws.PlanID = order.PlanID
		ws.StorageQuota = plan.StorageQuotaBytes
		if isBridge {
			// 桥接模式下本地不累加 GiftBalance，而是直接同步充值到主站
			billingSvc := service.GetBillingService()
			err := billingSvc.RefundCredits(ws.OwnerUserID, ws.ID, plan.MonthlyCredits, "订阅套餐支付成功，同步加额到主站", nil)
			if err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "同步充值额度至主站失败: " + err.Error()})
				return
			}
		} else {
			ws.GiftBalance += plan.MonthlyCredits
		}
	}
	ws.UpdatedAt = time.Now()
	if err := tx.Save(&ws).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存工作区账本失败"})
		return
	}

	// 3. 写入 Gift 余额批次表 (仅当是非纯点数包订阅、且点数大于 0 时写入)
	if !plan.IsPointsPackage && plan.MonthlyCredits > 0 {
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
		RechargeType: rechargeType,
		OperatorID:   &actorID,
		CreatedAt:    time.Now(),
	}
	if err := tx.Create(&recharge).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存充值记录失败"})
		return
	}

	// 5. 写入额度流水表
	transaction := model.CreditTransaction{
		ID:              uuid.New(),
		WorkspaceID:     order.WorkspaceID,
		UserID:          &actorID,
		TransactionType: txType,
		Amount:          plan.MonthlyCredits,
		GiftAmount:      txGift,
		RechargeAmount:  txRecharge,
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
