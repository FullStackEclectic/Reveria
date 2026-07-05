package router

import (
	"reveria/services/api/handler"

	"github.com/gin-gonic/gin"
)

// registerPortalRoutes 注册外部客户免登交付预览 Portal 接口
func registerPortalRoutes(api *gin.RouterGroup) {
	api.GET("/portal/shares/:token", handler.GetPortalProject)
	api.POST("/portal/shares/:token/comments", handler.CreatePortalComment)
	api.POST("/portal/shares/:token/approve", handler.ApprovePortalProject)
	api.POST("/portal/shares/:token/assets/:asset_id/select", handler.SelectPortalAsset)
	api.POST("/portal/shares/:token/assets/:asset_id/comments", handler.CreatePortalAssetComment)
}
