package router

import (
	"os"

	"reveria/services/api/handler"

	"github.com/gin-gonic/gin"
)

// registerAuthPublicRoutes 注册公开的认证接口（不需要鉴权）
func registerAuthPublicRoutes(api *gin.RouterGroup) {
	api.POST("/auth/register", handler.RegisterUser)
	api.POST("/auth/login", handler.LoginUser)
	if os.Getenv("REVERIA_ENABLE_DEV_LOGIN") == "true" {
		api.POST("/auth/dev-login", handler.DevLogin)
	}
	api.GET("/version", handler.GetBuildVersion)
}

// registerAuthProtectedRoutes 注册需要鉴权的认证与工作区接口
func registerAuthProtectedRoutes(auth *gin.RouterGroup) {
	auth.GET("/auth/me", handler.CurrentUser)
	auth.POST("/auth/logout", handler.LogoutUser)
	auth.POST("/auth/refresh", handler.RefreshSession)
	auth.GET("/workspaces", handler.ListWorkspaces)
	auth.POST("/workspaces", handler.CreateWorkspace)
	auth.POST("/workspaces/:workspace_id/invitations", handler.CreateInvitation)
	auth.POST("/invitations/accept", handler.AcceptInvitation)
}
