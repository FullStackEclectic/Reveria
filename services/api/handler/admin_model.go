package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
)

// BridgeModelMeta 桥接模式下的主站模型元信息
type BridgeModelMeta struct {
	ID           int    `json:"id"`
	ModelName    string `json:"model_name"`
	Description  string `json:"description"`
	Capabilities string `json:"capabilities"`
	Tags         string `json:"tags"`
}

// ListModels 获取模型列表 (GET /api/admin/models)
func ListModels(c *gin.Context) {
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err == nil && settings.BillingMode == "bridge" {
		// 桥接模式下实时拉取主站模型数据
		if settings.BridgeMainStationURL == "" {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "主站根地址未配置，请先在全局配置中完成设置"})
			return
		}

		url := fmt.Sprintf("%s/api/internal/models", strings.TrimSuffix(settings.BridgeMainStationURL, "/"))
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建主站模型拉取请求失败"})
			return
		}
		if settings.BridgeInternalSecret != "" {
			req.Header.Set("X-Internal-Secret", settings.BridgeInternalSecret)
		}

		client := &http.Client{Timeout: 8 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "获取主站模型超时，请检查主站连接状态: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": fmt.Sprintf("主站返回了异常状态码: %d", resp.StatusCode)})
			return
		}

		var mainResp struct {
			Success bool              `json:"success"`
			Models  []BridgeModelMeta `json:"models"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&mainResp); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "解析主站模型数据格式失败"})
			return
		}

		// 校验过滤：只有当非 all 参数且站长配置过至少一个模型时，我们才做前台列表过滤
		all := c.Query("all") == "true"
		var filteredList []model.Model

		allowedModels := make(map[string]bool)
		hasConfigured := false

		if !all {
			// 将逗号分隔的已配置模型列表拆分放入 map
			for _, mName := range strings.Split(settings.BridgeTextModel, ",") {
				if mName = strings.TrimSpace(mName); mName != "" {
					allowedModels[mName] = true
					hasConfigured = true
				}
			}
			for _, mName := range strings.Split(settings.BridgeImageModel, ",") {
				if mName = strings.TrimSpace(mName); mName != "" {
					allowedModels[mName] = true
					hasConfigured = true
				}
			}
			for _, mName := range strings.Split(settings.BridgeVideoModel, ",") {
				if mName = strings.TrimSpace(mName); mName != "" {
					allowedModels[mName] = true
					hasConfigured = true
				}
			}
		}

		for _, m := range mainResp.Models {
			// 解析 capabilities 划分模型类型 (chat/image/video)
			modelType := "chat"
			var caps []string
			if strings.HasPrefix(m.Capabilities, "[") {
				_ = json.Unmarshal([]byte(m.Capabilities), &caps)
			} else if m.Capabilities != "" {
				caps = strings.Split(m.Capabilities, ",")
			}

			for _, capVal := range caps {
				capVal = strings.TrimSpace(strings.ToLower(capVal))
				if capVal == "image_generation" || capVal == "image" || capVal == "drawing" {
					modelType = "image"
					break
				}
				if capVal == "video_generation" || capVal == "video" {
					modelType = "video"
					break
				}
			}

			dispName := m.ModelName
			if m.Description != "" {
				dispName = fmt.Sprintf("%s (%s)", m.ModelName, m.Description)
			}

			// 如果没加 all，且站长已经配置过受限模型，只返回被允许的
			if !all && hasConfigured && !allowedModels[m.ModelName] {
				continue
			}

			filteredList = append(filteredList, model.Model{
				ID:          m.ModelName,
				ProviderID:  "bridge_main_station",
				Name:        m.ModelName,
				DisplayName: dispName,
				ModelType:   modelType,
				Enabled:     true,
				CreditsCost: 0,
				Tags:        m.Tags,
				CreatedAt:   time.Now(),
			})
		}
		c.JSON(http.StatusOK, filteredList)
		return
	}

	// 独立模式走本地数据库查询
	var list []model.Model
	if err := database.DB.Order("created_at desc").Find(&list).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取模型列表失败"})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateModel 创建或修改模型定价 (POST /api/admin/models)
func CreateModel(c *gin.Context) {
	var req model.Model
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[CreateModel Bind Error]: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数格式错误: " + err.Error()})
		return
	}

	if req.ID == "" {
		req.ID = req.Name // 默认用 Name 作为 ID
	}
	req.CreatedAt = time.Now()

	var existing model.Model
	err := database.DB.Where("id = ?", req.ID).First(&existing).Error
	if err != nil {
		if err := database.DB.Create(&req).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建模型失败"})
			return
		}
	} else {
		existing.DisplayName = req.DisplayName
		existing.ModelType = req.ModelType
		existing.BillingMethod = req.BillingMethod
		existing.CreditsCost = req.CreditsCost
		existing.Enabled = req.Enabled
		if err := database.DB.Save(&existing).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存模型失败"})
			return
		}
		req = existing
	}
	c.JSON(http.StatusOK, req)
}

// EnableModel 启用/禁用模型 (POST /api/admin/models/:id/enabled)
func EnableModel(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数格式有误"})
		return
	}

	if err := database.DB.Model(&model.Model{}).Where("id = ?", id).Update("enabled", req.Enabled).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// DeleteModel 删除模型 (DELETE /api/admin/models/:id)
func DeleteModel(c *gin.Context) {
	id := c.Param("id")
	log.Printf("[DeleteModel] 收到删除模型请求，ID = %s", id)
	db := database.DB.Delete(&model.Model{}, "id = ?", id)
	if db.Error != nil {
		log.Printf("[DeleteModel] 从数据库删除失败: %v", db.Error)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除失败: " + db.Error.Error()})
		return
	}
	log.Printf("[DeleteModel] 从数据库删除成功，RowsAffected = %d", db.RowsAffected)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// BatchImportItem 批量导入模型条目
type BatchImportItem struct {
	ID            string  `json:"id"`
	ProviderID    string  `json:"provider_id"`
	Name          string  `json:"name"`
	DisplayName   string  `json:"display_name"`
	ModelType     string  `json:"model_type"`
	BillingMethod string  `json:"billing_method"`
	CreditsCost   float64 `json:"credits_cost"`
}

// BatchImportModels 批量导入并设定模型定价 (POST /api/admin/models/batch-import)
func BatchImportModels(c *gin.Context) {
	var req []BatchImportItem
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入有误"})
		return
	}

	tx := database.DB.Begin()
	for _, item := range req {
		var modelItem model.Model
		err := tx.Where("id = ?", item.ID).First(&modelItem).Error
		if err != nil {
			// 新增
			modelItem = model.Model{
				ID:            item.ID,
				ProviderID:    item.ProviderID,
				Name:          item.Name,
				DisplayName:   item.DisplayName,
				ModelType:     item.ModelType,
				BillingMethod: item.BillingMethod,
				Enabled:       true,
				CreditsCost:   item.CreditsCost,
				CreatedAt:     time.Now(),
			}
			if err := tx.Create(&modelItem).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "导入模型失败: " + err.Error()})
				return
			}
		} else {
			// 覆盖更新类型与价格
			modelItem.ModelType = item.ModelType
			modelItem.BillingMethod = item.BillingMethod
			modelItem.CreditsCost = item.CreditsCost
			if err := tx.Save(&modelItem).Error; err != nil {
				tx.Rollback()
				c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新模型失败: " + err.Error()})
				return
			}
		}
	}
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "模型批量导入保存成功"})
}
