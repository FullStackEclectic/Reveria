package router

import (
	"reveria/services/api/handler"

	"github.com/gin-gonic/gin"
)

// registerCreditRoutes 注册积分计费、订单路由
func registerCreditRoutes(auth *gin.RouterGroup) {
	auth.GET("/credits/:workspace_id/balance", handler.GetCreditBalance)
	auth.GET("/credits/:workspace_id/transactions", handler.ListCreditTransactions)
	auth.GET("/credits/:workspace_id/recharges", handler.ListRechargeRecords)
	auth.GET("/credits/:workspace_id/orders", handler.ListWorkspaceOrders)
	auth.GET("/billing/plans", handler.ListPlans)
	auth.POST("/billing/orders", handler.CreateOrder)
}
