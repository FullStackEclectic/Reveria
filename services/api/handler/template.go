package handler

import (
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// checkPlatformAdmin 辅助方法：校验当前用户是否为超管
func checkPlatformAdmin(c *gin.Context) bool {
	actorID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未登录或登录已失效"})
		return false
	}

	uid, ok := actorID.(uuid.UUID)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "无效的用户凭证"})
		return false
	}

	var actor model.User
	if err := database.DB.Where("id = ?", uid).First(&actor).Error; err != nil || !actor.IsPlatformAdmin {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "仅平台超级管理员可执行此项后台配置操作"})
		return false
	}
	return true
}

// ==========================================
// 1. 模板分类 API (Admin CRUD & Public)
// ==========================================

// ListTemplateCategories (GET /api/admin/template-categories)
func ListTemplateCategories(c *gin.Context) {
	if !checkPlatformAdmin(c) {
		return
	}

	var categories []model.TemplateCategory
	if err := database.DB.Order("sort_order asc, created_at desc").Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取分类列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": categories})
}

// CreateTemplateCategoryRequest 创建模板分类请求体
type CreateTemplateCategoryRequest struct {
	Name         string     `json:"name" binding:"required"`
	SortOrder    int        `json:"sort_order"`
	ParentID     *uuid.UUID `json:"parent_id"`
	WorkflowType string     `json:"workflow_type"`
}

// CreateTemplateCategory (POST /api/admin/template-categories)
func CreateTemplateCategory(c *gin.Context) {
	if !checkPlatformAdmin(c) {
		return
	}

	var req CreateTemplateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数不合法"})
		return
	}

	wt := req.WorkflowType
	if wt == "" {
		wt = "image-generation"
	}

	category := model.TemplateCategory{
		ID:           uuid.New(),
		Name:         req.Name,
		SortOrder:    req.SortOrder,
		ParentID:     req.ParentID,
		WorkflowType: wt,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := database.DB.Create(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建模板分类失败，可能重名: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": category})
}

// UpdateTemplateCategory (PUT /api/admin/template-categories/:id)
func UpdateTemplateCategory(c *gin.Context) {
	if !checkPlatformAdmin(c) {
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的分类ID"})
		return
	}

	var req CreateTemplateCategoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数不合法"})
		return
	}

	var category model.TemplateCategory
	if err := database.DB.Where("id = ?", id).First(&category).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定的模板分类"})
		return
	}

	wt := req.WorkflowType
	if wt == "" {
		wt = "image-generation"
	}

	category.Name = req.Name
	category.SortOrder = req.SortOrder
	category.ParentID = req.ParentID
	category.WorkflowType = wt
	category.UpdatedAt = time.Now()

	if err := database.DB.Save(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新模板分类失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": category})
}

// DeleteTemplateCategory (DELETE /api/admin/template-categories/:id)
func DeleteTemplateCategory(c *gin.Context) {
	if !checkPlatformAdmin(c) {
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的分类ID"})
		return
	}

	var category model.TemplateCategory
	if err := database.DB.Where("id = ?", id).First(&category).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定的模板分类"})
		return
	}

	var templateCount int64
	database.DB.Model(&model.PromptTemplate{}).Where("category_id = ?", id).Count(&templateCount)
	if templateCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "该分类下尚存提示词模板，请先移除或转移模板后再删除分类"})
		return
	}

	if err := database.DB.Delete(&category).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除分类失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "模板分类删除成功"})
}

// ListTemplateCategoriesPublic 前台公开获取分类列表 (GET /api/template-categories)
func ListTemplateCategoriesPublic(c *gin.Context) {
	var categories []model.TemplateCategory
	if err := database.DB.Order("sort_order asc, created_at desc").Find(&categories).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取分类列表失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": categories})
}

// ==========================================
// 2. 提示词模板 API (Admin CRUD & Public)
// ==========================================

// ListPromptTemplates (GET /api/admin/prompt-templates)
func ListPromptTemplates(c *gin.Context) {
	if !checkPlatformAdmin(c) {
		return
	}

	categoryIDStr := c.Query("category_id")
	query := database.DB.Order("created_at desc")

	if categoryIDStr != "" {
		categoryID, err := uuid.Parse(categoryIDStr)
		if err == nil {
			query = query.Where("category_id = ?", categoryID)
		}
	}

	var templates []model.PromptTemplate
	if err := query.Find(&templates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取提示词模板列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": templates})
}

// UpsertPromptTemplateRequest 提示词模板参数载荷
type UpsertPromptTemplateRequest struct {
	CategoryID     uuid.UUID `json:"category_id" binding:"required"`
	Title          string    `json:"title" binding:"required"`
	Content        string    `json:"content" binding:"required"`
	DefaultWidth   int       `json:"default_width"`
	DefaultHeight  int       `json:"default_height"`
	WorkflowType   string    `json:"workflow_type"`
	NeedImage      int       `json:"need_image"`
	ShowRatio      *bool     `json:"show_ratio"`
	NegativePrompt string    `json:"negative_prompt"`
	PreviewUrl     string    `json:"preview_url"`
	ModelID        string    `json:"model_id"`
	AdvancedParams string    `json:"advanced_params"`
}

// CreatePromptTemplate (POST /api/admin/prompt-templates)
func CreatePromptTemplate(c *gin.Context) {
	if !checkPlatformAdmin(c) {
		return
	}

	var req UpsertPromptTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数绑定失败，请检查是否填写必填项"})
		return
	}

	var cat model.TemplateCategory
	if err := database.DB.Where("id = ?", req.CategoryID).First(&cat).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "所选的模板分类不存在"})
		return
	}

	dw := req.DefaultWidth
	if dw <= 0 {
		dw = 300
	}
	dh := req.DefaultHeight
	if dh <= 0 {
		dh = 200
	}

	wt := req.WorkflowType
	if wt == "" {
		wt = "image-generation"
	}
	sr := true
	if req.ShowRatio != nil {
		sr = *req.ShowRatio
	}

	template := model.PromptTemplate{
		ID:             uuid.New(),
		CategoryID:     req.CategoryID,
		Title:          req.Title,
		Content:        req.Content,
		DefaultWidth:   dw,
		DefaultHeight:  dh,
		WorkflowType:   wt,
		NeedImage:      req.NeedImage,
		ShowRatio:      sr,
		NegativePrompt: req.NegativePrompt,
		PreviewUrl:     req.PreviewUrl,
		ModelID:        req.ModelID,
		AdvancedParams: req.AdvancedParams,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := database.DB.Create(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建提示词模板失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": template})
}

// UpdatePromptTemplate (PUT /api/admin/prompt-templates/:id)
func UpdatePromptTemplate(c *gin.Context) {
	if !checkPlatformAdmin(c) {
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的模板ID"})
		return
	}

	var req UpsertPromptTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数不合法"})
		return
	}

	var template model.PromptTemplate
	if err := database.DB.Where("id = ?", id).First(&template).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定的提示词模板"})
		return
	}

	var cat model.TemplateCategory
	if err := database.DB.Where("id = ?", req.CategoryID).First(&cat).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "所选的模板分类不存在"})
		return
	}

	dw := req.DefaultWidth
	if dw <= 0 {
		dw = 300
	}
	dh := req.DefaultHeight
	if dh <= 0 {
		dh = 200
	}

	template.CategoryID = req.CategoryID
	template.Title = req.Title
	template.Content = req.Content
	template.DefaultWidth = dw
	template.DefaultHeight = dh
	template.WorkflowType = req.WorkflowType
	template.NeedImage = req.NeedImage
	if req.ShowRatio != nil {
		template.ShowRatio = *req.ShowRatio
	}
	template.NegativePrompt = req.NegativePrompt
	template.PreviewUrl = req.PreviewUrl
	template.ModelID = req.ModelID
	template.AdvancedParams = req.AdvancedParams
	template.UpdatedAt = time.Now()

	if err := database.DB.Save(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新提示词模板失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": template})
}

// DeletePromptTemplate (DELETE /api/admin/prompt-templates/:id)
func DeletePromptTemplate(c *gin.Context) {
	if !checkPlatformAdmin(c) {
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的模板ID"})
		return
	}

	var template model.PromptTemplate
	if err := database.DB.Where("id = ?", id).First(&template).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定的提示词模板"})
		return
	}

	if err := database.DB.Delete(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除提示词模板失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "提示词模板删除成功"})
}

// ListPromptTemplatesPublic 前台公开获取模板列表 (GET /api/prompt-templates)
func ListPromptTemplatesPublic(c *gin.Context) {
	categoryIDStr := c.Query("category_id")
	query := database.DB.Order("created_at desc")

	if categoryIDStr != "" {
		categoryID, err := uuid.Parse(categoryIDStr)
		if err == nil {
			query = query.Where("category_id = ?", categoryID)
		}
	}

	var templates []model.PromptTemplate
	if err := query.Find(&templates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取提示词模板失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": templates})
}
