package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestProductionCORSOnlyAllowsConfiguredOrigins(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("REVERIA_ENV", "production")
	t.Setenv("REVERIA_ALLOWED_ORIGINS", "https://app.example.com")

	router := gin.New()
	router.Use(corsMiddleware())
	router.GET("/test", func(c *gin.Context) { c.Status(http.StatusNoContent) })

	localRequest := httptest.NewRequest(http.MethodGet, "/test", nil)
	localRequest.Header.Set("Origin", "http://localhost:3000")
	localResponse := httptest.NewRecorder()
	router.ServeHTTP(localResponse, localRequest)
	if origin := localResponse.Header().Get("Access-Control-Allow-Origin"); origin != "" {
		t.Fatalf("生产环境不应默认允许本地来源，实际为 %q", origin)
	}

	allowedRequest := httptest.NewRequest(http.MethodGet, "/test", nil)
	allowedRequest.Header.Set("Origin", "https://app.example.com")
	allowedResponse := httptest.NewRecorder()
	router.ServeHTTP(allowedResponse, allowedRequest)
	if origin := allowedResponse.Header().Get("Access-Control-Allow-Origin"); origin != "https://app.example.com" {
		t.Fatalf("显式来源未被允许，实际为 %q", origin)
	}
}

func TestCheckRuntimeConfigRequiresPostgresInProduction(t *testing.T) {
	t.Setenv("REVERIA_ENV", "production")
	t.Setenv("REVERIA_ENABLE_DEV_LOGIN", "")
	t.Setenv("REVERIA_ALLOWED_ORIGINS", "https://app.example.com")
	t.Setenv("DATABASE_TYPE", "sqlite")
	t.Setenv("DATABASE_URL", "reveria.db")
	if err := checkRuntimeConfig(); err == nil {
		t.Fatal("生产环境使用 SQLite 应被拒绝")
	}

	t.Setenv("DATABASE_TYPE", "postgres")
	t.Setenv("DATABASE_URL", "")
	if err := checkRuntimeConfig(); err == nil {
		t.Fatal("生产环境缺少 DATABASE_URL 应被拒绝")
	}

	t.Setenv("DATABASE_URL", "host=127.0.0.1 user=reveria password=secret dbname=reveria port=5432 sslmode=disable")
	if err := checkRuntimeConfig(); err != nil {
		t.Fatal(err)
	}
}
