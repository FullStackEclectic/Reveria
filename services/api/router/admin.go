package router

import (
	"reveria/services/api/handler"

	"github.com/gin-gonic/gin"
)

// registerSettingsRoutes 注册站长本地网关配置路由（公开，不需要 Token 鉴权）
func registerSettingsRoutes(api *gin.RouterGroup) {
	adminSettings := api.Group("/admin")
	{
		adminSettings.GET("/settings", handler.GetClientSettings)
		adminSettings.POST("/settings", handler.UpdateClientSettings)
	}
}

// registerAdminRoutes 注册管理员特权路由
func registerAdminRoutes(auth *gin.RouterGroup) {
	// 分站管理员特权及财务对账接口
	auth.GET("/admin/users", handler.ListAdminUsers)
	auth.POST("/admin/users/:user_id/platform-admin", handler.UpdatePlatformAdmin)
	auth.GET("/admin/workspace-members", handler.ListWorkspaceMembers)
	auth.POST("/admin/workspace-members", handler.UpsertWorkspaceMember)
	auth.DELETE("/admin/workspace-members", handler.DeleteWorkspaceMember)
	auth.POST("/admin/credits/adjust", handler.AdjustCredits)
	auth.GET("/admin/plans", handler.ListAdminPlans)
	auth.PUT("/admin/plans/:id", handler.UpdateAdminPlan)
	auth.GET("/admin/reports/costs", handler.GetCostReport)
	auth.POST("/billing/orders/:order_id/mock-pay", handler.MockPayOrder)

	// 后台服务商接入与算力模型大盘
	auth.GET("/admin/providers", handler.ListProviders)
	auth.POST("/admin/providers", handler.CreateProvider)
	auth.POST("/admin/providers/:id/enabled", handler.EnableProvider)
	auth.DELETE("/admin/providers/:id", handler.DeleteProvider)
	auth.POST("/admin/providers/fetch-upstream-models", handler.FetchUpstreamModels)

	auth.GET("/admin/models", handler.ListModels)
	auth.POST("/admin/models", handler.CreateModel)
	auth.POST("/admin/models/:id/enabled", handler.EnableModel)
	auth.DELETE("/admin/models/:id", handler.DeleteModel)
	auth.POST("/admin/models/batch-import", handler.BatchImportModels)
	auth.GET("/admin/pricing-rules", handler.MockListPricingRules)
	auth.POST("/admin/pricing-rules", handler.MockCreatePricingRule)
	auth.GET("/admin/workflow-templates", handler.MockListWorkflowTemplates)
	auth.POST("/admin/workflow-templates", handler.MockCreateWorkflowTemplate)
	auth.POST("/admin/workflow-templates/:id/enabled", handler.MockEnableWorkflowTemplate)
	auth.POST("/admin/workflow-templates/:id/publish", handler.MockPublishWorkflowTemplate)
	auth.POST("/admin/models/test-text", handler.MockTestTextModel)
	auth.POST("/admin/models/test-image", handler.MockTestImageModel)

	// 模板分类管理 (Admin CRUD)
	auth.GET("/admin/template-categories", handler.ListTemplateCategories)
	auth.POST("/admin/template-categories", handler.CreateTemplateCategory)
	auth.PUT("/admin/template-categories/:id", handler.UpdateTemplateCategory)
	auth.DELETE("/admin/template-categories/:id", handler.DeleteTemplateCategory)

	// 提示词模板管理 (Admin CRUD)
	auth.GET("/admin/prompt-templates", handler.ListPromptTemplates)
	auth.POST("/admin/prompt-templates", handler.CreatePromptTemplate)
	auth.PUT("/admin/prompt-templates/:id", handler.UpdatePromptTemplate)
	auth.DELETE("/admin/prompt-templates/:id", handler.DeletePromptTemplate)

	// 前台公开获取接口
	auth.GET("/template-categories", handler.ListTemplateCategoriesPublic)
	auth.GET("/prompt-templates", handler.ListPromptTemplatesPublic)
}
