package handler

import (
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func useAuthSessionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.User{}, &model.AuthSession{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestWriteAuthSuccessUsesCookieForWebAndTokensForDesktop(t *testing.T) {
	db := useAuthSessionTestDB(t)
	user := model.User{ID: uuid.New(), Status: "active"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	gin.SetMode(gin.TestMode)
	webRecorder := httptest.NewRecorder()
	webContext, _ := gin.CreateTestContext(webRecorder)
	webContext.Request = httptest.NewRequest("POST", "/api/auth/login", nil)
	writeAuthSuccess(webContext, user)
	webCookies := strings.Join(webRecorder.Header().Values("Set-Cookie"), "\n")
	if !strings.Contains(webCookies, accessCookieName+"=") || !strings.Contains(webCookies, refreshCookieName+"=") || !strings.Contains(webCookies, "HttpOnly") {
		t.Fatalf("Web 登录未写入 HttpOnly Cookie: %s", webCookies)
	}
	var webBody map[string]any
	if err := json.Unmarshal(webRecorder.Body.Bytes(), &webBody); err != nil {
		t.Fatal(err)
	}
	if _, exposed := webBody["access_token"]; exposed {
		t.Fatal("Web 登录响应不应向 JavaScript 暴露 Access Token")
	}

	desktopRecorder := httptest.NewRecorder()
	desktopContext, _ := gin.CreateTestContext(desktopRecorder)
	desktopContext.Request = httptest.NewRequest("POST", "/api/auth/login", nil)
	desktopContext.Request.Header.Set("X-Reveria-Client", "desktop")
	writeAuthSuccess(desktopContext, user)
	var desktopBody map[string]any
	if err := json.Unmarshal(desktopRecorder.Body.Bytes(), &desktopBody); err != nil {
		t.Fatal(err)
	}
	if desktopBody["access_token"] == nil || desktopBody["refresh_token"] == nil {
		t.Fatalf("桌面登录响应缺少令牌: %s", desktopRecorder.Body.String())
	}
	if len(desktopRecorder.Header().Values("Set-Cookie")) != 0 {
		t.Fatal("桌面登录不应依赖浏览器 Cookie")
	}
}

func TestAccessTokenBecomesInvalidAfterSessionRevocation(t *testing.T) {
	db := useAuthSessionTestDB(t)
	userID := uuid.New()
	user := model.User{ID: userID, Status: "active"}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	session, accessToken, _, err := createAuthSession(userID, "desktop")
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := ParseAccessTokenDetails(accessToken); err != nil {
		t.Fatalf("新签发的 Access Token 无效: %v", err)
	}
	now := time.Now()
	if err := db.Model(&model.AuthSession{}).Where("id = ?", session.ID).Update("revoked_at", now).Error; err != nil {
		t.Fatal(err)
	}
	if _, _, err := ParseAccessTokenDetails(accessToken); err == nil {
		t.Fatal("会话撤销后旧 Access Token 仍然有效")
	}
}

func TestRefreshTokenCarriesSessionIdentity(t *testing.T) {
	useAuthSessionTestDB(t)
	userID := uuid.New()
	session, _, refreshToken, err := createAuthSession(userID, "web")
	if err != nil {
		t.Fatal(err)
	}
	parsedUserID, parsedSessionID, err := ParseRefreshToken(refreshToken)
	if err != nil {
		t.Fatal(err)
	}
	if parsedUserID != userID || parsedSessionID != session.ID {
		t.Fatalf("Refresh Token 会话身份不一致: user=%s session=%s", parsedUserID, parsedSessionID)
	}
}
