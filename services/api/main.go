package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/handler"
	"reveria/services/api/model"
	"reveria/services/api/router"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func main() {
	log.Println("正在启动 Reveria-Go 业务分站服务端...")
	validateRuntimeConfig()

	// 1. 初始化数据库
	database.InitDatabase()

	// 2. 初始化默认设置（如果不存在）
	initDefaultSettings()
	if err := database.EncryptStoredSecrets(); err != nil {
		log.Fatalf("加密持久化密钥失败: %v", err)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	handler.StartTaskWorker(ctx)

	// 3. 开启 Gin 服务
	r := gin.Default()
	trustedProxies := make([]string, 0)
	for _, proxy := range strings.Split(os.Getenv("REVERIA_TRUSTED_PROXIES"), ",") {
		if normalized := strings.TrimSpace(proxy); normalized != "" {
			trustedProxies = append(trustedProxies, normalized)
		}
	}
	if err := r.SetTrustedProxies(trustedProxies); err != nil {
		log.Fatalf("配置可信反向代理失败: %v", err)
	}

	r.Use(requestIDMiddleware())
	// 简单的 CORS 跨域中间件
	r.Use(corsMiddleware())

	// 注册健康检查路由
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "Reveria Go API 运行正常",
		})
	})
	r.GET("/ready", func(c *gin.Context) {
		sqlDB, err := database.DB.DB()
		if err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not_ready", "message": "数据库连接不可用"})
			return
		}
		checkCtx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := sqlDB.PingContext(checkCtx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "not_ready", "message": "数据库健康检查失败"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready"})
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
	server := &http.Server{
		Addr: ":" + port, Handler: r,
		ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second,
		WriteTimeout: 20 * time.Minute, IdleTimeout: 60 * time.Second,
	}
	go func() {
		log.Printf("Reveria Go API 正在监听端口 :%s", port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("服务启动失败: %v", err)
		}
	}()
	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("服务优雅关闭失败: %v", err)
	}
}

func validateRuntimeConfig() {
	if err := checkRuntimeConfig(); err != nil {
		log.Fatal(err)
	}
}

func isProductionEnv() bool {
	return os.Getenv("REVERIA_ENV") == "production" || os.Getenv("GIN_MODE") == "release"
}

func checkRuntimeConfig() error {
	if !isProductionEnv() {
		return nil
	}
	if os.Getenv("REVERIA_ENABLE_DEV_LOGIN") == "true" {
		return errors.New("生产环境禁止启用 REVERIA_ENABLE_DEV_LOGIN")
	}
	if strings.TrimSpace(os.Getenv("REVERIA_ALLOWED_ORIGINS")) == "" {
		return errors.New("生产环境必须配置 REVERIA_ALLOWED_ORIGINS")
	}
	if strings.ToLower(strings.TrimSpace(os.Getenv("DATABASE_TYPE"))) != "postgres" {
		return errors.New("生产环境必须设置 DATABASE_TYPE=postgres")
	}
	if strings.TrimSpace(os.Getenv("DATABASE_URL")) == "" {
		return errors.New("生产环境必须设置 DATABASE_URL")
	}
	return nil
}

func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := strings.TrimSpace(c.GetHeader("X-Request-ID"))
		if requestID == "" {
			requestID = uuid.NewString()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// corsMiddleware 简单的 CORS 跨域请求处理
func corsMiddleware() gin.HandlerFunc {
	configured := strings.TrimSpace(os.Getenv("REVERIA_ALLOWED_ORIGINS"))
	configuredOrigins := strings.Split(configured, ",")
	allowedOrigins := map[string]bool{}
	// 本地开发保留常用来源；生产环境必须显式配置，避免凭据跨源暴露。
	if os.Getenv("REVERIA_ENV") != "production" && os.Getenv("GIN_MODE") != "release" {
		allowedOrigins["http://localhost:3000"] = true
		allowedOrigins["http://127.0.0.1:3000"] = true
		allowedOrigins["http://localhost:1420"] = true
		allowedOrigins["http://127.0.0.1:1420"] = true
		allowedOrigins["wails://wails"] = true
	}
	for _, origin := range configuredOrigins {
		if normalized := strings.TrimSpace(origin); normalized != "" {
			allowedOrigins[normalized] = true
		}
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && allowedOrigins[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Vary", "Origin")
		}
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, X-Reveria-Client, X-Reveria-Refresh-Token, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, PATCH, DELETE")

		if c.Request.Method == "OPTIONS" && origin != "" && !allowedOrigins[origin] {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
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
		siteTitle := strings.TrimSpace(os.Getenv("REVERIA_SITE_TITLE"))
		if siteTitle == "" {
			siteTitle = "Reveria"
		}
		settings := model.ClientSettings{
			ID:                    uuid.New(),
			SiteTitle:             siteTitle,
			SiteTagline:           strings.TrimSpace(os.Getenv("REVERIA_SITE_TAGLINE")),
			SiteDescription:       strings.TrimSpace(os.Getenv("REVERIA_SITE_DESCRIPTION")),
			SiteAnnouncement:      strings.TrimSpace(os.Getenv("REVERIA_SITE_ANNOUNCEMENT")),
			PublicOrigin:          strings.TrimSpace(os.Getenv("REVERIA_PUBLIC_ORIGIN")),
			UpstreamAPIURL:        strings.TrimSpace(os.Getenv("REVERIA_UPSTREAM_API_URL")),
			UpstreamAPIKey:        strings.TrimSpace(os.Getenv("REVERIA_UPSTREAM_API_KEY")),
			AllowUserRegister:     !isProductionEnv(),
			GiftCreditsOnRegister: 0,
			PriceRate:             1.00,
		}
		if err := database.DB.Create(&settings).Error; err != nil {
			log.Printf("初始化默认配置记录失败: %v", err)
		} else {
			log.Println("默认 ClientSettings 设置记录初始化完成。")
		}
	} else if count > 1 {
		log.Fatalf("client_settings 存在 %d 条记录，系统配置必须保持单例，请先合并重复配置", count)
	}
}
