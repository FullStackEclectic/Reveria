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
