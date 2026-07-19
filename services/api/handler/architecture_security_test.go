package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func useArchitectureTestDB(t *testing.T, models ...any) *gorm.DB {
	t.Helper()
	previous := database.DB
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(models...); err != nil {
		t.Fatal(err)
	}
	database.DB = db
	t.Cleanup(func() { database.DB = previous })
	return db
}

func TestPlatformAdminMiddlewareRejectsRegularUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := useArchitectureTestDB(t, &model.User{})
	user := model.User{ID: uuid.New(), Status: "active", IsPlatformAdmin: false}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	router := gin.New()
	router.GET("/admin", func(c *gin.Context) { c.Set("user_id", user.ID) }, PlatformAdminMiddleware(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/admin", nil))
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("普通用户访问后台状态码 = %d", recorder.Code)
	}
}

func TestClientSettingsResponseDoesNotExposeSecrets(t *testing.T) {
	settings := model.ClientSettings{UpstreamAPIKey: "upstream-secret", BridgeInternalSecret: "bridge-secret"}
	response := sanitizedClientSettings(settings)
	encoded, err := json.Marshal(response)
	if err != nil {
		t.Fatal(err)
	}
	text := string(encoded)
	if containsAny(text, "upstream-secret", "bridge-secret") {
		t.Fatalf("配置响应泄露了密钥: %s", text)
	}
	if response["upstream_api_key_configured"] != true || response["bridge_internal_secret_configured"] != true {
		t.Fatalf("配置状态没有正确返回: %#v", response)
	}
}

func TestDevLoginDisabledByDefault(t *testing.T) {
	t.Setenv("REVERIA_ENABLE_DEV_LOGIN", "")
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodPost, "/api/auth/dev-login", nil)
	DevLogin(context)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("开发登录关闭时状态码 = %d", recorder.Code)
	}
}

func TestRequireProjectInWorkspaceRejectsCrossTenantProject(t *testing.T) {
	db := useArchitectureTestDB(t, &model.Project{})
	project := model.Project{ID: uuid.New(), WorkspaceID: uuid.New(), Name: "other", Status: "draft", ProjectType: "ai_canvas"}
	if err := db.Create(&project).Error; err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	if requireProjectInWorkspace(context, project.ID, uuid.New()) {
		t.Fatal("跨工作区项目被错误接受")
	}
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("跨工作区项目状态码 = %d", recorder.Code)
	}
}

func TestStorageReservationEnforcesQuota(t *testing.T) {
	db := useArchitectureTestDB(t, &model.Workspace{})
	workspace := model.Workspace{ID: uuid.New(), Name: "quota", StorageQuota: 10, StorageUsed: 8}
	if err := db.Create(&workspace).Error; err != nil {
		t.Fatal(err)
	}
	if reserveStorage(workspace.ID, 3) {
		t.Fatal("超过配额的存储预占被错误接受")
	}
	if !reserveStorage(workspace.ID, 2) {
		t.Fatal("配额内的存储预占失败")
	}
	if err := db.First(&workspace, "id = ?", workspace.ID).Error; err != nil {
		t.Fatal(err)
	}
	if workspace.StorageUsed != 10 {
		t.Fatalf("storage_used = %d, want 10", workspace.StorageUsed)
	}
	releaseStorage(workspace.ID, 2)
}

func TestStoredFileNameIgnoresAuthorizationQuery(t *testing.T) {
	name, ok := storedFileNameFromURL("http://127.0.0.1:4100/api/files/example.jpg?access_token=secret")
	if !ok || name != "example.jpg" {
		t.Fatalf("解析文件名 = %q, %v", name, ok)
	}
	if isSafeRemoteURL("http://127.0.0.1/internal") || isSafeRemoteURL("https://localhost/internal") {
		t.Fatal("内部地址被错误允许")
	}
}

func TestFindStoredAssetSupportsLegacyAbsoluteURL(t *testing.T) {
	db := useArchitectureTestDB(t, &model.Asset{})
	asset := model.Asset{
		ID: uuid.New(), WorkspaceID: uuid.New(), ProjectID: uuid.New(),
		AssetType: "image", Source: "upload",
		FileURL: "http://127.0.0.1:4100/api/files/legacy.jpg",
	}
	if err := db.Create(&asset).Error; err != nil {
		t.Fatal(err)
	}
	found, err := findStoredAsset("/api/files/legacy.jpg")
	if err != nil {
		t.Fatalf("历史绝对文件地址查询失败: %v", err)
	}
	if found.ID != asset.ID {
		t.Fatalf("查询到错误素材: %s", found.ID)
	}
}

func TestStoredAssetAccessSupportsWebAuthCookie(t *testing.T) {
	db := useArchitectureTestDB(t, &model.User{}, &model.AuthSession{}, &model.WorkspaceMember{})
	userID, workspaceID, sessionID := uuid.New(), uuid.New(), uuid.New()
	if err := db.Create(&model.User{ID: userID, Status: "active"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.WorkspaceMember{
		ID: uuid.New(), WorkspaceID: workspaceID, UserID: userID,
		Role: "owner", Status: "joined", JoinedAt: time.Now(),
	}).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&model.AuthSession{
		ID: sessionID, UserID: userID, RefreshTokenHash: uuid.NewString(),
		ClientType: "web", ExpiresAt: time.Now().Add(time.Hour), LastUsedAt: time.Now(),
	}).Error; err != nil {
		t.Fatal(err)
	}
	token, err := GenerateAccessToken(userID, sessionID)
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodGet, "/api/files/example.jpg", nil)
	context.Request.AddCookie(&http.Cookie{Name: accessCookieName, Value: token})
	if !canAccessStoredAsset(context, model.Asset{WorkspaceID: workspaceID}) {
		t.Fatal("浏览器认证 Cookie 未能授权素材文件访问")
	}
}

func containsAny(value string, candidates ...string) bool {
	for _, candidate := range candidates {
		if len(candidate) > 0 && len(value) >= len(candidate) {
			for i := 0; i+len(candidate) <= len(value); i++ {
				if value[i:i+len(candidate)] == candidate {
					return true
				}
			}
		}
	}
	return false
}
