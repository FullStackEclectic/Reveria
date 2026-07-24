package handler

import (
	"log"
	"net/http"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
)

// ListModels 获取模型列表 (GET /api/admin/models)
func ListModels(c *gin.Context) {
	adminRequest := strings.HasPrefix(c.FullPath(), "/api/admin/")
	var list []model.Model
	query := database.DB.Order("created_at desc")
	if !adminRequest {
		query = query.Where("enabled = true")
	}
	if err := query.Find(&list).Error; err != nil {
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
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交模型导入事务失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "模型批量导入保存成功"})
}
