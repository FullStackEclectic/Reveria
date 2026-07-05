package main

import (
	"log"
	"net/http"
	"os"

	"reveria/services/api/database"
	"reveria/services/api/model"
	"reveria/services/api/router"

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

	// 注册所有业务路由
	router.RegisterRoutes(r)

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
