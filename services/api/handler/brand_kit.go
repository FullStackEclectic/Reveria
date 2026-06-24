package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateBrandKitRequest 品牌库创建载荷
type CreateBrandKitRequest struct {
	WorkspaceID    uuid.UUID       `json:"workspace_id" binding:"required"`
	CustomerID     *uuid.UUID      `json:"customer_id"`
	Name           string          `json:"name" binding:"required"`
	LogoAssetID    *uuid.UUID      `json:"logo_asset_id"`
	Colors         json.RawMessage `json:"colors"`
	Fonts          json.RawMessage `json:"fonts"`
	ToneOfVoice    *string         `json:"tone_of_voice"`
	VisualKeywords json.RawMessage `json:"visual_keywords"`
	ForbiddenWords json.RawMessage `json:"forbidden_words"`
	StylePrompt    *string         `json:"style_prompt"`
	Notes          *string         `json:"notes"`
}

// UpdateBrandKitRequest 品牌库更新载荷
type UpdateBrandKitRequest struct {
	CustomerID     *uuid.UUID      `json:"customer_id"`
	Name           string          `json:"name" binding:"required"`
	LogoAssetID    *uuid.UUID      `json:"logo_asset_id"`
	Colors         json.RawMessage `json:"colors"`
	Fonts          json.RawMessage `json:"fonts"`
	ToneOfVoice    *string         `json:"tone_of_voice"`
	VisualKeywords json.RawMessage `json:"visual_keywords"`
	ForbiddenWords json.RawMessage `json:"forbidden_words"`
	StylePrompt    *string         `json:"style_prompt"`
	Notes          *string         `json:"notes"`
}

// ListBrandKits 获取品牌库列表 (GET /brand-kits)
func ListBrandKits(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)
	workspaceIDStr := c.Query("workspace_id")
	var workspaceID uuid.UUID
	var err error

	if workspaceIDStr == "" {
		// 自动获取该用户加入的第一个工作区以兼容前端并行初始化
		var memberRelation model.WorkspaceMember
		if err := database.DB.Where("user_id = ? AND status = 'joined'", actorID).First(&memberRelation).Error; err != nil {
			c.JSON(http.StatusOK, []model.BrandKit{})
			return
		}
		workspaceID = memberRelation.WorkspaceID
	} else {
		workspaceID, err = uuid.Parse(workspaceIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
			return
		}
	}

	if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看品牌库"})
		return
	}

	var brandKits []model.BrandKit
	if err := database.DB.Where("workspace_id = ?", workspaceID).Order("name asc").Find(&brandKits).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "读取品牌库列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, brandKits)
}

// CreateBrandKit 新建品牌库 (POST /brand-kits)
func CreateBrandKit(c *gin.Context) {
	var req CreateBrandKitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限在此工作区新建品牌库"})
		return
	}

	// 字段序列化
	colorsStr := ptrString(string(req.Colors))
	fontsStr := ptrString(string(req.Fonts))
	visualStr := ptrString(string(req.VisualKeywords))
	forbiddenStr := ptrString(string(req.ForbiddenWords))

	brandKit := model.BrandKit{
		ID:             uuid.New(),
		WorkspaceID:    req.WorkspaceID,
		CustomerID:     req.CustomerID,
		Name:           req.Name,
		LogoAssetID:    req.LogoAssetID,
		Colors:         colorsStr,
		Fonts:          fontsStr,
		ToneOfVoice:    req.ToneOfVoice,
		VisualKeywords: visualStr,
		ForbiddenWords: forbiddenStr,
		StylePrompt:    req.StylePrompt,
		Notes:          req.Notes,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := database.DB.Create(&brandKit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建品牌库失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, brandKit)
}

// GetBrandKit 获取品牌库详情 (GET /brand-kits/:id)
func GetBrandKit(c *gin.Context) {
	brandKitIDStr := c.Param("id")
	brandKitID, err := uuid.Parse(brandKitIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "品牌库 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var brandKit model.BrandKit
	if err := database.DB.Where("id = ?", brandKitID).First(&brandKit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定品牌库"})
		return
	}

	if !hasWorkspaceRole(brandKit.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此品牌库详情"})
		return
	}

	c.JSON(http.StatusOK, brandKit)
}

// UpdateBrandKit 更新品牌库 (PUT /brand-kits/:id)
func UpdateBrandKit(c *gin.Context) {
	brandKitIDStr := c.Param("id")
	brandKitID, err := uuid.Parse(brandKitIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "品牌库 ID 格式有误"})
		return
	}

	var req UpdateBrandKitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入参数有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var brandKit model.BrandKit
	if err := database.DB.Where("id = ?", brandKitID).First(&brandKit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定品牌库"})
		return
	}

	if !hasWorkspaceRole(brandKit.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限更改此品牌库资料"})
		return
	}

	// 校验工作区是否一致
	if req.CustomerID != nil {
		var customer model.Customer
		if err := database.DB.Where("id = ?", req.CustomerID).First(&customer).Error; err != nil || customer.WorkspaceID != brandKit.WorkspaceID {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "客户所属工作区不一致"})
			return
		}
	}

	// 更新字段
	brandKit.CustomerID = req.CustomerID
	brandKit.Name = req.Name
	brandKit.LogoAssetID = req.LogoAssetID
	brandKit.Colors = ptrString(string(req.Colors))
	brandKit.Fonts = ptrString(string(req.Fonts))
	brandKit.ToneOfVoice = req.ToneOfVoice
	brandKit.VisualKeywords = ptrString(string(req.VisualKeywords))
	brandKit.ForbiddenWords = ptrString(string(req.ForbiddenWords))
	brandKit.StylePrompt = req.StylePrompt
	brandKit.Notes = req.Notes
	brandKit.UpdatedAt = time.Now()

	if err := database.DB.Save(&brandKit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存品牌库失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, brandKit)
}

// DeleteBrandKit 删除品牌库 (DELETE /brand-kits/:id)
func DeleteBrandKit(c *gin.Context) {
	brandKitIDStr := c.Param("id")
	brandKitID, err := uuid.Parse(brandKitIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "品牌库 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var brandKit model.BrandKit
	if err := database.DB.Where("id = ?", brandKitID).First(&brandKit).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定品牌库"})
		return
	}

	if !hasWorkspaceRole(brandKit.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限删除该品牌库"})
		return
	}

	if err := database.DB.Delete(&brandKit).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除品牌库记录失败: " + err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
