package router

import (
	"reveria/services/api/handler"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes 注册所有业务路由
func RegisterRoutes(r *gin.Engine) {
	// 注册公开的文件伺服接口
	r.GET("/api/files/:file_name", handler.ServeFile)

	api := r.Group("/api")
	{
		// 1. 公开的认证接口（不需要鉴权）
		registerAuthPublicRoutes(api)

		// 2. 外部客户免登交付预览 Portal 接口
		registerPortalRoutes(api)

		// 3. 需要用户鉴权的路由组
		auth := api.Group("")
		auth.Use(handler.AuthMiddleware())
		{
			registerAuthProtectedRoutes(auth)
			registerProjectRoutes(auth)
			registerTaskRoutes(auth)
			registerCreditRoutes(auth)
			registerAdminRoutes(auth)
			auth.GET("/models", handler.ListModels)
			auth.GET("/template-categories", handler.ListTemplateCategoriesPublic)
			auth.GET("/prompt-templates", handler.ListPromptTemplatesPublic)
		}
	}
}
