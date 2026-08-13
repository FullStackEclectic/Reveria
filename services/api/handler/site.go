package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
)

var brandColorPattern = regexp.MustCompile(`^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$`)

func publicSitePayload(settings model.ClientSettings) gin.H {
	title := strings.TrimSpace(settings.SiteTitle)
	if title == "" {
		title = "Reveria"
	}
	tagline := strings.TrimSpace(settings.SiteTagline)
	if tagline == "" {
		tagline = "创意交付工作台"
	}
	description := strings.TrimSpace(settings.SiteDescription)
	if description == "" {
		description = "面向传媒工作室的 AI 创意生产、无限画布与图像精修平台。"
	}
	return gin.H{
		"site_title":          title,
		"site_tagline":        tagline,
		"site_description":    description,
		"site_announcement":   settings.SiteAnnouncement,
		"public_origin":       settings.PublicOrigin,
		"logo_url":            settings.LogoURL,
		"favicon_url":         settings.FaviconURL,
		"brand_color":         settings.BrandColor,
		"contact_email":       settings.ContactEmail,
		"allow_user_register": settings.AllowUserRegister,
	}
}

// GetPublicSite 公开站点品牌（GET /api/site），不含上游密钥。
func GetPublicSite(c *gin.Context) {
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "data": publicSitePayload(model.ClientSettings{})})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": publicSitePayload(settings)})
}

// TestUpstreamGateway 用当前或表单中的主站 URL/Key 探测 /v1/models（POST /api/admin/settings/test-upstream）。
func TestUpstreamGateway(c *gin.Context) {
	var req struct {
		UpstreamAPIURL string `json:"upstream_api_url"`
		UpstreamAPIKey string `json:"upstream_api_key"`
	}
	_ = c.ShouldBindJSON(&req)

	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "无法读取站点配置"})
		return
	}
	apiURL := strings.TrimSpace(req.UpstreamAPIURL)
	if apiURL == "" {
		apiURL = settings.UpstreamAPIURL
	}
	apiKey := strings.TrimSpace(req.UpstreamAPIKey)
	if apiKey == "" {
		apiKey = settings.UpstreamAPIKey
	}
	apiURL = strings.TrimSuffix(strings.TrimSuffix(strings.TrimSpace(apiURL), "/"), "/v1")
	if apiURL == "" || apiKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请先填写上游 API 地址和密钥"})
		return
	}

	httpReq, err := http.NewRequest(http.MethodGet, apiURL+"/v1/models", nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "上游 API 地址格式有误"})
		return
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	client := &http.Client{Transport: insecureTransport, Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "无法连接主站网关: " + err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": fmt.Sprintf("主站网关返回 HTTP %d", resp.StatusCode),
		})
		return
	}
	var list struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &list); err != nil {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "主站网关已连通，但未返回标准模型列表", "model_count": 0})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"message":     fmt.Sprintf("主站网关联调成功，可见 %d 个模型", len(list.Data)),
		"model_count": len(list.Data),
	})
}

func sanitizePublicOrigin(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.User != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", errors.New("对外域名须为 http(s) 完整地址，例如 https://studio.example.com")
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}

func sanitizePublicAssetURL(raw, label string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	if strings.HasPrefix(raw, "/api/files/") && !strings.Contains(raw, "..") && !strings.ContainsAny(raw, " \t\n") {
		return raw, nil
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.User != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return "", fmt.Errorf("%s 须为 http(s) 地址或 /api/files/ 路径", label)
	}
	return raw, nil
}

func sanitizeBrandColor(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	if !brandColorPattern.MatchString(raw) {
		return "", errors.New("品牌色须为 #RGB 或 #RRGGBB")
	}
	return raw, nil
}
