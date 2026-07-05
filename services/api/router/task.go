package router

import (
	"reveria/services/api/handler"

	"github.com/gin-gonic/gin"
)

// registerTaskRoutes 注册 AI 任务与工作流路由
func registerTaskRoutes(auth *gin.RouterGroup) {
	// AI 任务与生成 API
	auth.GET("/tasks", handler.ListTasks)
	auth.POST("/tasks/estimate", handler.EstimateTask)
	auth.POST("/tasks", handler.CreateTask)
	auth.GET("/tasks/:id", handler.GetTaskDetail)
	auth.POST("/tasks/:id/cancel", handler.CancelTask)
	auth.POST("/tasks/:id/retry", handler.RetryTask)

	// 任务日志与留言 API
	auth.GET("/tasks/:id/comments", handler.ListTaskComments)
	auth.POST("/tasks/:id/comments", handler.CreateTaskComment)

	// 兼容旧前端的生图工作流接口
	auth.POST("/workflows/image-generation", handler.CreateTask)

	// 创意大模型文本分析工作流 API
	auth.POST("/workflows/brief-analysis", handler.RunBriefAnalysis)
	auth.POST("/workflows/brand-style-extract", handler.RunBrandStyleExtract)
	auth.POST("/workflows/creative-directions", handler.RunCreativeDirections)
	auth.POST("/workflows/short-video-script-storyboard", handler.RunShortVideoScriptStoryboard)
	auth.POST("/workflows/xiaohongshu-cover-batch", handler.RunXiaohongshuCoverBatch)
	auth.POST("/workflows/magic-action", handler.RunMagicAction)
}
