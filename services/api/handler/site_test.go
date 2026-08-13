package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestGetPublicSiteOmitsUpstreamSecrets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.ClientSettings{}); err != nil {
		t.Fatal(err)
	}
	settings := model.ClientSettings{
		ID: uuid.New(), SiteTitle: "青橙工作室", SiteTagline: "本地贴牌",
		SiteDescription: "分站介绍", PublicOrigin: "https://studio.example.com",
		UpstreamAPIURL: "https://ai.example.com", UpstreamAPIKey: "sk-secret",
		AllowUserRegister: true, PriceRate: 1,
	}
	if err := db.Create(&settings).Error; err != nil {
		t.Fatal(err)
	}

	router := gin.New()
	router.GET("/api/site", GetPublicSite)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/site", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	body := recorder.Body.String()
	if strings.Contains(body, "sk-secret") || strings.Contains(body, "ai.example.com") {
		t.Fatalf("公开站点接口泄露了上游配置: %s", body)
	}
	var payload struct {
		Success bool `json:"success"`
		Data    struct {
			SiteTitle    string `json:"site_title"`
			PublicOrigin string `json:"public_origin"`
		} `json:"data"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if !payload.Success || payload.Data.SiteTitle != "青橙工作室" || payload.Data.PublicOrigin != "https://studio.example.com" {
		t.Fatalf("公开品牌不正确: %+v", payload)
	}
}

func TestSanitizePublicOriginAndBrandColor(t *testing.T) {
	origin, err := sanitizePublicOrigin("https://studio.example.com/path?q=1")
	if err != nil || origin != "https://studio.example.com" {
		t.Fatalf("origin = %q err=%v", origin, err)
	}
	if _, err := sanitizePublicOrigin("javascript:alert(1)"); err == nil {
		t.Fatal("应拒绝 javascript origin")
	}
	if color, err := sanitizeBrandColor("#0f766e"); err != nil || color != "#0f766e" {
		t.Fatalf("color = %q err=%v", color, err)
	}
	if _, err := sanitizeBrandColor("red"); err == nil {
		t.Fatal("应拒绝非法品牌色")
	}
	if logo, err := sanitizePublicAssetURL("/api/files/logo.png", "Logo"); err != nil || logo != "/api/files/logo.png" {
		t.Fatalf("logo = %q err=%v", logo, err)
	}
}

func TestTestUpstreamGatewayUsesStoredCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" || r.Header.Get("Authorization") != "Bearer stored-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-test"}]}`))
	}))
	t.Cleanup(upstream.Close)

	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.ClientSettings{}); err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.ClientSettings{
		ID: uuid.New(), SiteTitle: "t", UpstreamAPIURL: upstream.URL, UpstreamAPIKey: "stored-key", PriceRate: 1,
	}).Error; err != nil {
		t.Fatal(err)
	}

	router := gin.New()
	router.POST("/test", TestUpstreamGateway)
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/test", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(recorder, req)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), "1 个模型") {
		t.Fatalf("联调结果不符合预期: %s", recorder.Body.String())
	}
}
