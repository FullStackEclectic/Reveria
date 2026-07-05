package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListProviders 获取服务商列表 (GET /api/admin/providers)
func ListProviders(c *gin.Context) {
	var list []model.Provider
	if err := database.DB.Order("created_at desc").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取服务商列表失败"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateProvider 创建或更新服务商 (POST /api/admin/providers)
func CreateProvider(c *gin.Context) {
	var req model.Provider
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入格式有误"})
		return
	}

	if req.ID == "" {
		req.ID = uuid.New().String()
	}
	req.CreatedAt = time.Now()

	var existing model.Provider
	err := database.DB.Where("id = ?", req.ID).First(&existing).Error
	if err != nil {
		// 创建
		if err := database.DB.Create(&req).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建服务商失败"})
			return
		}
	} else {
		// 更新
		existing.Name = req.Name
		existing.ApiURL = req.ApiURL
		existing.ApiKey = req.ApiKey
		existing.ProviderType = req.ProviderType
		existing.Enabled = req.Enabled
		if err := database.DB.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新服务商失败"})
			return
		}
		req = existing
	}

	c.JSON(http.StatusOK, req)
}

// EnableProvider 启用/禁用服务商 (POST /api/admin/providers/:id/enabled)
func EnableProvider(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数有误"})
		return
	}

	if err := database.DB.Model(&model.Provider{}).Where("id = ?", id).Update("enabled", req.Enabled).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "状态更新失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DeleteProvider 删除服务商 (DELETE /api/admin/providers/:id)
func DeleteProvider(c *gin.Context) {
	id := c.Param("id")
	// 删除服务商
	if err := database.DB.Delete(&model.Provider{}, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败"})
		return
	}
	// 连带删除该服务商下的模型
	database.DB.Delete(&model.Model{}, "provider_id = ?", id)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// FetchUpstreamModelsRequest 代理拉取上游模型请求
type FetchUpstreamModelsRequest struct {
	ApiURL string `json:"api_url" binding:"required"`
	ApiKey string `json:"api_key" binding:"required"`
}

// UpstreamModelItem 上游模型条目
type UpstreamModelItem struct {
	ID string `json:"id"`
}

// UpstreamModelsResponse 上游模型响应
type UpstreamModelsResponse struct {
	Data []UpstreamModelItem `json:"data"`
}

// FetchUpstreamModels 代理拉取上游服务商模型 (POST /api/admin/providers/fetch-upstream-models)
func FetchUpstreamModels(c *gin.Context) {
	var req FetchUpstreamModelsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求参数不合法"})
		return
	}

	// 强制锁定使用 12ZX 官方网关地址
	apiHost := "https://ai.12zx.net"
	url := strings.TrimSuffix(apiHost, "/") + "/v1/models"
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "上游 API 链接格式有误"})
		return
	}
	httpReq.Header.Set("Authorization", "Bearer "+req.ApiKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "访问上游失败，连接超时或网络不通: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": fmt.Sprintf("上游返回错误 (Status: %d): %s", resp.StatusCode, string(bodyBytes))})
		return
	}

	var upstreamResp UpstreamModelsResponse
	if err := json.NewDecoder(resp.Body).Decode(&upstreamResp); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "解析上游模型格式失败"})
		return
	}

	var ids []string
	for _, item := range upstreamResp.Data {
		ids = append(ids, item.ID)
	}

	c.JSON(http.StatusOK, ids)
}
