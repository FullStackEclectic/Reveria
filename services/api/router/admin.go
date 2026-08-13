package router

import (
	"reveria/services/api/handler"

	"github.com/gin-gonic/gin"
)

// registerAdminRoutes 注册管理员特权路由
func registerAdminRoutes(auth *gin.RouterGroup) {
	// 工作区成员管理沿用原接口路径，但权限由工作区 owner/admin 控制。
	auth.GET("/admin/workspace-members", handler.ListWorkspaceMembers)
	auth.POST("/admin/workspace-members", handler.UpsertWorkspaceMember)
	auth.DELETE("/admin/workspace-members", handler.DeleteWorkspaceMember)

	admin := auth.Group("/admin")
	admin.Use(handler.PlatformAdminMiddleware())

	admin.GET("/settings", handler.GetClientSettings)
	admin.POST("/settings", handler.UpdateClientSettings)
	admin.POST("/settings/test-upstream", handler.TestUpstreamGateway)

	// 分站管理员特权及财务对账接口
	admin.GET("/users", handler.ListAdminUsers)
	admin.POST("/users/:user_id/platform-admin", handler.UpdatePlatformAdmin)
	admin.POST("/credits/adjust", handler.AdjustCredits)
	admin.GET("/plans", handler.ListAdminPlans)
	admin.PUT("/plans/:id", handler.UpdateAdminPlan)
	admin.GET("/reports/costs", handler.GetCostReport)

	// 后台服务商接入与算力模型大盘
	admin.GET("/providers", handler.ListProviders)
	admin.POST("/providers", handler.CreateProvider)
	admin.POST("/providers/:id/enabled", handler.EnableProvider)
	admin.DELETE("/providers/:id", handler.DeleteProvider)
	admin.POST("/providers/fetch-upstream-models", handler.FetchUpstreamModels)

	admin.GET("/models", handler.ListModels)
	admin.POST("/models", handler.CreateModel)
	admin.POST("/models/:id/enabled", handler.EnableModel)
	admin.DELETE("/models/:id", handler.DeleteModel)
	admin.POST("/models/batch-import", handler.BatchImportModels)
	admin.GET("/pricing-rules", handler.ListPricingRules)
	admin.POST("/pricing-rules", handler.CreatePricingRule)
	admin.GET("/workflow-templates", handler.ListWorkflowTemplates)
	admin.POST("/workflow-templates", handler.CreateWorkflowTemplate)
	admin.POST("/workflow-templates/:id/enabled", handler.SetWorkflowTemplateEnabled)
	admin.POST("/workflow-templates/:id/publish", handler.PublishWorkflowTemplate)
	admin.POST("/models/test-text", handler.TestTextModel)
	admin.POST("/models/test-image", handler.TestImageModel)

	// 模板分类管理 (Admin CRUD)
	admin.GET("/template-categories", handler.ListTemplateCategories)
	admin.POST("/template-categories", handler.CreateTemplateCategory)
	admin.PUT("/template-categories/:id", handler.UpdateTemplateCategory)
	admin.DELETE("/template-categories/:id", handler.DeleteTemplateCategory)

	// 提示词模板管理 (Admin CRUD)
	admin.GET("/prompt-templates", handler.ListPromptTemplates)
	admin.POST("/prompt-templates", handler.CreatePromptTemplate)
	admin.PUT("/prompt-templates/:id", handler.UpdatePromptTemplate)
	admin.DELETE("/prompt-templates/:id", handler.DeletePromptTemplate)
}
