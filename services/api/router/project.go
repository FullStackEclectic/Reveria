package router

import (
	"reveria/services/api/handler"

	"github.com/gin-gonic/gin"
)

// registerProjectRoutes 注册项目管理、画布、协作、客户、品牌库路由
func registerProjectRoutes(auth *gin.RouterGroup) {
	// 客户管理 API
	auth.GET("/customers", handler.ListCustomers)
	auth.POST("/customers", handler.CreateCustomer)
	auth.GET("/customers/:id", handler.GetCustomer)
	auth.PUT("/customers/:id", handler.UpdateCustomer)
	auth.DELETE("/customers/:id", handler.DeleteCustomer)

	// 品牌库 API
	auth.GET("/brand-kits", handler.ListBrandKits)
	auth.POST("/brand-kits", handler.CreateBrandKit)
	auth.GET("/brand-kits/:id", handler.GetBrandKit)
	auth.PUT("/brand-kits/:id", handler.UpdateBrandKit)
	auth.DELETE("/brand-kits/:id", handler.DeleteBrandKit)

	// 项目管理 API
	auth.GET("/projects", handler.ListProjects)
	auth.POST("/projects", handler.CreateProject)
	auth.GET("/projects/:id", handler.GetProject)
	auth.PATCH("/projects/:id", handler.UpdateProject)
	auth.PUT("/projects/:id", handler.UpdateProject)
	auth.DELETE("/projects/:id", handler.DeleteProject)

	// 画布 API
	auth.GET("/projects/:id/canvas", handler.GetProjectCanvas)
	auth.PUT("/projects/:id/canvas", handler.UpdateProjectCanvas)

	// 协作与外链分享 API
	auth.GET("/projects/:id/comments", handler.ListProjectComments)
	auth.POST("/projects/:id/comments", handler.CreateProjectComment)
	auth.GET("/projects/:id/shares", handler.ListProjectShares)
	auth.POST("/projects/:id/shares", handler.CreateProjectShare)
	auth.DELETE("/shares/:id", handler.RevokeProjectShare)
	auth.POST("/projects/:id/retouch-sync", handler.SyncRetouchSettings)
	auth.GET("/projects/:id/retouch-sync", handler.PullRetouchCollaboration)
	auth.GET("/retouch-presets", handler.ListRetouchPresets)
	auth.POST("/retouch-presets", handler.SaveRetouchPreset)
	auth.DELETE("/retouch-presets/:id", handler.DeleteRetouchPreset)

	// 素材资产 API
	auth.GET("/assets", handler.ListAssets)
	auth.POST("/assets", handler.CreateAsset)
	auth.POST("/assets/upload", handler.UploadAsset)
	auth.DELETE("/assets/:id", handler.DeleteAsset)
}
