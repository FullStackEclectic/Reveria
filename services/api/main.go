package main

import (
	"log"
	"net/http"
	"os"

	"reveria/services/api/database"
	"reveria/services/api/handler"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func main() {
	log.Println("正在启动 Reveria-Go 业务分站服务端...")

	// 1. 初始化数据库
	database.InitDatabase()

	// 2. 初始化默认设置（如果不存在）
	initDefaultSettings()

	// 3. 开启 Gin 服务
	r := gin.Default()

	// 简单的 CORS 跨域中间件
	r.Use(corsMiddleware())

	// 注册健康检查路由
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "Reveria Go API 运行正常",
		})
	})

	// 注册公开的文件伺服接口 (与 Rust 旧接口 /api/files/{file_name} 完全对齐)
	r.GET("/api/files/:file_name", handler.ServeFile)

	// 注册基础 API 路由 (前缀改为 /api 以对齐旧前端)
	api := r.Group("/api")
	{
		// 1. 公开的认证接口（不需要鉴权）
		api.POST("/auth/register", handler.RegisterUser)
		api.POST("/auth/login", handler.LoginUser)
		api.POST("/auth/dev-login", handler.DevLogin) // 快捷开发登录
		api.GET("/version", getBuildVersion)

		// 2. 外部客户免登交付预览 Portal 接口（公开不需要 Token 鉴权）
		api.GET("/portal/shares/:token", handler.GetPortalProject)
		api.POST("/portal/shares/:token/comments", handler.CreatePortalComment)
		api.POST("/portal/shares/:token/approve", handler.ApprovePortalProject)
		api.POST("/portal/shares/:token/assets/:asset_id/select", handler.SelectPortalAsset)
		api.POST("/portal/shares/:token/assets/:asset_id/comments", handler.CreatePortalAssetComment)

		// 3. 站长本地网关配置（站长自身配置）
		adminSettings := api.Group("/admin")
		{
			adminSettings.GET("/settings", getClientSettings)
			adminSettings.POST("/settings", updateClientSettings)
		}

		// 4. 需要用户鉴权的路由组
		auth := api.Group("")
		auth.Use(handler.AuthMiddleware())
		{
			// 认证与工作区
			auth.GET("/auth/me", handler.CurrentUser)
			auth.POST("/auth/logout", handler.LogoutUser)
			auth.POST("/auth/refresh", handler.RefreshSession)
			auth.GET("/workspaces", handler.ListWorkspaces)
			auth.POST("/workspaces", handler.CreateWorkspace)
			auth.POST("/workspaces/:workspace_id/invitations", handler.CreateInvitation)
			auth.POST("/invitations/accept", handler.AcceptInvitation)

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

			// 素材资产 API
			auth.GET("/assets", handler.ListAssets)          // 获取素材列表 (支持 project_id 过滤)
			auth.POST("/assets", handler.CreateAsset)        // 手动创建/上报素材
			auth.POST("/assets/upload", handler.UploadAsset) // 上传素材文件
			auth.DELETE("/assets/:id", handler.DeleteAsset)

			// 本地点数与商业化计费 API
			auth.GET("/credits/:workspace_id/balance", handler.GetCreditBalance)
			auth.GET("/credits/:workspace_id/transactions", handler.ListCreditTransactions)
			auth.GET("/credits/:workspace_id/recharges", handler.ListRechargeRecords)
			auth.GET("/billing/plans", handler.ListPlans)
			auth.POST("/billing/orders", handler.CreateOrder)

			// AI 任务与生成 API
			auth.GET("/tasks", handler.ListTasks) // 获取任务大盘列表
			auth.POST("/tasks/estimate", handler.EstimateTask)
			auth.POST("/tasks", handler.CreateTask)
			auth.GET("/tasks/:id", handler.GetTaskDetail)
			auth.POST("/tasks/:id/cancel", handler.CancelTask) // 任务取消
			auth.POST("/tasks/:id/retry", handler.RetryTask)   // 任务重试

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
			auth.POST("/workflows/xiaohongshu-cover-batch", handler.RunXiaohongshuCoverBatch) // 新增小红书封面批量工作流
			auth.POST("/workflows/magic-action", handler.RunMagicAction)                      // 新增画板 AI 魔法修改接口

			// 分站管理员特权及财务对账接口
			auth.GET("/admin/users", handler.ListAdminUsers)                               // 获取系统用户大盘
			auth.POST("/admin/users/:user_id/platform-admin", handler.UpdatePlatformAdmin) // 调整超管头衔
			auth.GET("/admin/workspace-members", handler.ListWorkspaceMembers)
			auth.POST("/admin/workspace-members", handler.UpsertWorkspaceMember)
			auth.DELETE("/admin/workspace-members", handler.DeleteWorkspaceMember)
			auth.POST("/admin/credits/adjust", handler.AdjustCredits)
			auth.GET("/admin/plans", handler.ListAdminPlans)
			auth.PUT("/admin/plans/:id", handler.UpdateAdminPlan)
			auth.GET("/admin/reports/costs", handler.GetCostReport)
			auth.POST("/billing/orders/:order_id/mock-pay", handler.MockPayOrder) // 模拟支付

			// 后台服务商接入与算力模型大盘真实接口
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
	}

	// 兼容老前缀：若前端有硬编码 `/api/v1/...` 的部分请求，重定向至 `/api/...`
	r.Any("/api/v1/*any", func(c *gin.Context) {
		path := c.Param("any")
		c.Redirect(http.StatusMovedPermanently, "/api"+path)
	})

	// 监听端口，默认 4100 与原 Rust 后端端口保持一致
	port := os.Getenv("PORT")
	if port == "" {
		port = "4100"
	}
	log.Printf("Reveria Go API 正在监听端口 :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}

// corsMiddleware 简单的 CORS 跨域请求处理
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// initDefaultSettings 若不存在配置记录，则插入一条默认 of 12ZX-AI 上游网关设置
func initDefaultSettings() {
	var count int64
	database.DB.Model(&model.ClientSettings{}).Count(&count)
	if count == 0 {
		settings := model.ClientSettings{
			ID:                    uuid.New(),
			SiteTitle:             "Reveria AI 算力中心",
			SiteAnnouncement:      "欢迎来到分站！本站已支持百万 Token 精细计费和全浮点大本位钱包系统。",
			UpstreamAPIURL:        "https://api.12zx.com", // 默认 12ZX-AI 上游网关
			UpstreamAPIKey:        "sk-default-placeholder-key",
			AllowUserRegister:     true,
			GiftCreditsOnRegister: 100, // 默认新注册用户送 100 积分
			PriceRate:             1.00,
			BillingMode:           "standalone",
			BridgeMainStationURL:  "",
			BridgeInternalSecret:  "",
			BridgeTextModel:       "",
			BridgeImageModel:      "",
			BridgeVideoModel:      "",
			BridgeTextPools:       "",
			BridgeImagePools:      "",
			BridgeVideoPools:      "",
		}
		if err := database.DB.Create(&settings).Error; err != nil {
			log.Printf("初始化默认配置记录失败: %v", err)
		} else {
			log.Println("默认 ClientSettings 设置记录初始化完成。")
		}
	}
}

// getClientSettings 获取站长配置
func getClientSettings(c *gin.Context) {
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无法读取配置信息: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    settings,
	})
}

// updateClientSettings 更新站长配置
func updateClientSettings(c *gin.Context) {
	var req model.ClientSettings
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "输入格式有误"})
		return
	}

	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未找到配置记录"})
		return
	}

	// 更新字段
	settings.SiteTitle = req.SiteTitle
	settings.SiteAnnouncement = req.SiteAnnouncement
	settings.UpstreamAPIURL = req.UpstreamAPIURL
	settings.UpstreamAPIKey = req.UpstreamAPIKey
	settings.AllowUserRegister = req.AllowUserRegister
	settings.GiftCreditsOnRegister = req.GiftCreditsOnRegister
	settings.PriceRate = req.PriceRate
	settings.BillingMode = req.BillingMode
	settings.BridgeMainStationURL = req.BridgeMainStationURL
	settings.BridgeInternalSecret = req.BridgeInternalSecret
	settings.BridgeTextModel = req.BridgeTextModel
	settings.BridgeImageModel = req.BridgeImageModel
	settings.BridgeVideoModel = req.BridgeVideoModel
	settings.BridgeTextPools = req.BridgeTextPools
	settings.BridgeImagePools = req.BridgeImagePools
	settings.BridgeVideoPools = req.BridgeVideoPools

	if err := database.DB.Save(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "保存失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "配置更新成功",
		"data":    settings,
	})
}

// getBuildVersion 返回服务的版本与编译信息以兼容前端 dashboard
func getBuildVersion(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"service":            "reveria-go-api",
		"version":            "0.1.0",
		"api_contract":       1,
		"database_connected": true,
	})
}
