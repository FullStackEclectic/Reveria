package handler

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	accessCookieName  = "reveria_access"
	refreshCookieName = "reveria_refresh"
)

func isDesktopClient(c *gin.Context) bool {
	return strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Reveria-Client")), "desktop")
}

func tokenHash(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}

func secureCookies(c *gin.Context) bool {
	return c.Request.TLS != nil || os.Getenv("REVERIA_ENV") == "production" || os.Getenv("GIN_MODE") == "release"
}

func setWebAuthCookies(c *gin.Context, accessToken, refreshToken string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(accessCookieName, accessToken, int(accessTokenTTL.Seconds()), "/", "", secureCookies(c), true)
	c.SetCookie(refreshCookieName, refreshToken, int(refreshTokenTTL.Seconds()), "/api/auth/refresh", "", secureCookies(c), true)
}

func clearWebAuthCookies(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(accessCookieName, "", -1, "/", "", secureCookies(c), true)
	c.SetCookie(refreshCookieName, "", -1, "/api/auth/refresh", "", secureCookies(c), true)
}

func createAuthSession(userID uuid.UUID, clientType string) (model.AuthSession, string, string, error) {
	now := time.Now()
	_ = database.DB.Where("expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)", now, now.Add(-7*24*time.Hour)).
		Delete(&model.AuthSession{}).Error
	session := model.AuthSession{
		ID: uuid.New(), UserID: userID, ClientType: clientType,
		ExpiresAt: now.Add(refreshTokenTTL), LastUsedAt: now, CreatedAt: now, UpdatedAt: now,
	}
	refreshToken, err := GenerateRefreshToken(userID, session.ID)
	if err != nil {
		return session, "", "", err
	}
	session.RefreshTokenHash = tokenHash(refreshToken)
	if err := database.DB.Create(&session).Error; err != nil {
		return session, "", "", err
	}
	accessToken, err := GenerateAccessToken(userID, session.ID)
	if err != nil {
		_ = database.DB.Delete(&session).Error
		return session, "", "", err
	}
	return session, accessToken, refreshToken, nil
}

func writeAuthSuccess(c *gin.Context, user model.User) {
	clientType := "web"
	if isDesktopClient(c) {
		clientType = "desktop"
	}
	_, accessToken, refreshToken, err := createAuthSession(user.ID, clientType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建登录会话失败"})
		return
	}
	response := gin.H{
		"user": gin.H{
			"id": user.ID, "email": user.Email, "display_name": user.DisplayName,
			"avatar_url": user.AvatarURL, "is_platform_admin": user.IsPlatformAdmin,
		},
	}
	if clientType == "desktop" {
		response["access_token"] = accessToken
		response["refresh_token"] = refreshToken
	} else {
		setWebAuthCookies(c, accessToken, refreshToken)
	}
	c.JSON(http.StatusOK, response)
}

func refreshTokenFromRequest(c *gin.Context) string {
	if isDesktopClient(c) {
		return strings.TrimSpace(c.GetHeader("X-Reveria-Refresh-Token"))
	}
	token, _ := c.Cookie(refreshCookieName)
	return strings.TrimSpace(token)
}

func rotateAuthSession(c *gin.Context) {
	refreshToken := refreshTokenFromRequest(c)
	if refreshToken == "" {
		clearWebAuthCookies(c)
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "缺少刷新凭证"})
		return
	}
	userID, sessionID, err := ParseRefreshToken(refreshToken)
	if err != nil {
		clearWebAuthCookies(c)
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "刷新凭证无效或已过期"})
		return
	}

	var newAccessToken, newRefreshToken string
	err = database.DB.Transaction(func(tx *gorm.DB) error {
		var session model.AuthSession
		if err := tx.Clauses(clause.Locking{Strength: clause.LockingStrengthUpdate}).
			Where("id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > ?", sessionID, userID, time.Now()).
			First(&session).Error; err != nil {
			return err
		}
		expectedHash, actualHash := []byte(session.RefreshTokenHash), []byte(tokenHash(refreshToken))
		if len(expectedHash) != len(actualHash) || subtle.ConstantTimeCompare(expectedHash, actualHash) != 1 {
			return errors.New("refresh token has already been rotated")
		}
		newRefreshToken, err = GenerateRefreshToken(userID, sessionID)
		if err != nil {
			return err
		}
		newAccessToken, err = GenerateAccessToken(userID, sessionID)
		if err != nil {
			return err
		}
		now := time.Now()
		return tx.Model(&session).Updates(map[string]any{
			"refresh_token_hash": tokenHash(newRefreshToken),
			"last_used_at":       now,
			"expires_at":         now.Add(refreshTokenTTL),
		}).Error
	})
	if err != nil {
		clearWebAuthCookies(c)
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "登录会话已失效，请重新登录"})
		return
	}

	response := gin.H{"success": true}
	if isDesktopClient(c) {
		response["access_token"] = newAccessToken
		response["refresh_token"] = newRefreshToken
	} else {
		setWebAuthCookies(c, newAccessToken, newRefreshToken)
	}
	c.JSON(http.StatusOK, response)
}
