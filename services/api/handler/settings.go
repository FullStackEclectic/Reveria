package handler

import (
	"net/http"
	"strings"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
)

func sanitizedClientSettings(settings model.ClientSettings) gin.H {
	return gin.H{
		"id": settings.ID, "site_title": settings.SiteTitle, "site_tagline": settings.SiteTagline,
		"site_description": settings.SiteDescription, "site_announcement": settings.SiteAnnouncement,
		"public_origin": settings.PublicOrigin, "logo_url": settings.LogoURL, "favicon_url": settings.FaviconURL,
		"brand_color": settings.BrandColor, "contact_email": settings.ContactEmail,
		"allow_user_register": settings.AllowUserRegister, "gift_credits_on_register": settings.GiftCreditsOnRegister,
		"price_rate": settings.PriceRate, "upstream_api_url": settings.UpstreamAPIURL,
		"upstream_api_key": "", "upstream_api_key_configured": strings.TrimSpace(settings.UpstreamAPIKey) != "",
		"upstream_circuit_open":      settings.UpstreamCircuitOpenedAt != nil,
		"upstream_circuit_reason":    settings.UpstreamCircuitReason,
		"upstream_circuit_opened_at": settings.UpstreamCircuitOpenedAt,
		"created_at":                 settings.CreatedAt, "updated_at": settings.UpdatedAt,
	}
}

// GetClientSettings 获取站长配置 (GET /api/admin/settings)
func GetClientSettings(c *gin.Context) {
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "无法读取配置信息: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    sanitizedClientSettings(settings),
	})
}

// UpdateClientSettings 更新站长配置 (POST /api/admin/settings)
func UpdateClientSettings(c *gin.Context) {
	var req struct {
		model.ClientSettings
		ClearUpstreamCircuit bool `json:"clear_upstream_circuit"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "输入格式有误"})
		return
	}

	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "未找到配置记录"})
		return
	}

	keyChanged := strings.TrimSpace(req.UpstreamAPIKey) != ""
	urlChanged := strings.TrimSpace(req.UpstreamAPIURL) != "" && req.UpstreamAPIURL != settings.UpstreamAPIURL

	publicOrigin, err := sanitizePublicOrigin(req.PublicOrigin)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	logoURL, err := sanitizePublicAssetURL(req.LogoURL, "Logo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	faviconURL, err := sanitizePublicAssetURL(req.FaviconURL, "Favicon")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	brandColor, err := sanitizeBrandColor(req.BrandColor)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	settings.SiteTitle = strings.TrimSpace(req.SiteTitle)
	settings.SiteTagline = strings.TrimSpace(req.SiteTagline)
	settings.SiteDescription = strings.TrimSpace(req.SiteDescription)
	settings.SiteAnnouncement = req.SiteAnnouncement
	settings.PublicOrigin = publicOrigin
	settings.LogoURL = logoURL
	settings.FaviconURL = faviconURL
	settings.BrandColor = brandColor
	settings.ContactEmail = strings.TrimSpace(req.ContactEmail)
	settings.UpstreamAPIURL = req.UpstreamAPIURL
	if keyChanged {
		settings.UpstreamAPIKey = strings.TrimSpace(req.UpstreamAPIKey)
	}
	settings.AllowUserRegister = req.AllowUserRegister
	settings.GiftCreditsOnRegister = req.GiftCreditsOnRegister
	settings.PriceRate = req.PriceRate
	if req.ClearUpstreamCircuit || keyChanged || urlChanged {
		settings.UpstreamCircuitOpenedAt = nil
		settings.UpstreamCircuitReason = ""
	}

	if err := database.DB.Save(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": "保存失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "配置更新成功",
		"data":    sanitizedClientSettings(settings),
	})
}

// GetBuildVersion 返回服务的版本与编译信息以兼容前端 dashboard (GET /api/version)
func GetBuildVersion(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"service":            "reveria-go-api",
		"version":            "0.1.0",
		"api_contract":       1,
		"database_connected": true,
	})
}
