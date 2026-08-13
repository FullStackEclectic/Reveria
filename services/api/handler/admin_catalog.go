package handler

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func ListPricingRules(c *gin.Context) {
	var rules []model.PricingRule
	if err := database.DB.Order("created_at desc").Find(&rules).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "读取定价规则失败"})
		return
	}
	c.JSON(http.StatusOK, rules)
}

func CreatePricingRule(c *gin.Context) {
	var rule model.PricingRule
	if err := c.ShouldBindJSON(&rule); err != nil || strings.TrimSpace(rule.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "定价规则参数不合法"})
		return
	}
	if rule.ID == uuid.Nil {
		rule.ID = uuid.New()
	}
	rule.Name = strings.TrimSpace(rule.Name)
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	if err := database.DB.Create(&rule).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存定价规则失败"})
		return
	}
	c.JSON(http.StatusOK, rule)
}

type workflowTemplateRequest struct {
	Name              string          `json:"name" binding:"required"`
	TaskType          string          `json:"task_type" binding:"required"`
	Version           int             `json:"version" binding:"min=1"`
	Enabled           bool            `json:"enabled"`
	InputSchema       json.RawMessage `json:"input_schema" binding:"required"`
	OutputSchema      json.RawMessage `json:"output_schema" binding:"required"`
	WorkflowSteps     json.RawMessage `json:"workflow_steps" binding:"required"`
	DefaultModelRoute json.RawMessage `json:"default_model_route" binding:"required"`
}

func workflowTemplateResponse(template model.WorkflowTemplate) gin.H {
	decode := func(value string) any {
		var decoded any
		if json.Unmarshal([]byte(value), &decoded) != nil {
			return nil
		}
		return decoded
	}
	return gin.H{
		"id": template.ID, "name": template.Name, "task_type": template.TaskType,
		"version": template.Version, "enabled": template.Enabled,
		"input_schema": decode(template.InputSchema), "output_schema": decode(template.OutputSchema),
		"workflow_steps": decode(template.WorkflowSteps), "default_model_route": decode(template.DefaultModelRoute),
		"created_at": template.CreatedAt, "updated_at": template.UpdatedAt,
	}
}

func ListWorkflowTemplates(c *gin.Context) {
	var templates []model.WorkflowTemplate
	if err := database.DB.Order("created_at desc").Find(&templates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "读取工作流模板失败"})
		return
	}
	result := make([]gin.H, 0, len(templates))
	for _, template := range templates {
		result = append(result, workflowTemplateResponse(template))
	}
	c.JSON(http.StatusOK, result)
}

func CreateWorkflowTemplate(c *gin.Context) {
	var req workflowTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作流模板参数不合法"})
		return
	}
	template := model.WorkflowTemplate{
		ID: uuid.New(), Name: strings.TrimSpace(req.Name), TaskType: strings.TrimSpace(req.TaskType),
		Version: req.Version, Enabled: req.Enabled, InputSchema: string(req.InputSchema),
		OutputSchema: string(req.OutputSchema), WorkflowSteps: string(req.WorkflowSteps),
		DefaultModelRoute: string(req.DefaultModelRoute), CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	if err := database.DB.Create(&template).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "相同任务类型和版本已存在"})
		return
	}
	c.JSON(http.StatusOK, workflowTemplateResponse(template))
}

func SetWorkflowTemplateEnabled(c *gin.Context) {
	setWorkflowTemplateEnabled(c, false)
}

func PublishWorkflowTemplate(c *gin.Context) {
	setWorkflowTemplateEnabled(c, true)
}

func setWorkflowTemplateEnabled(c *gin.Context, publish bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "模板 ID 不合法"})
		return
	}
	enabled := publish
	if !publish {
		var req struct {
			Enabled bool `json:"enabled"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "状态参数不合法"})
			return
		}
		enabled = req.Enabled
	}
	var template model.WorkflowTemplate
	if err := database.DB.Where("id = ?", id).First(&template).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "工作流模板不存在"})
		return
	}
	template.Enabled = enabled
	template.UpdatedAt = time.Now()
	if err := database.DB.Save(&template).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新工作流模板失败"})
		return
	}
	c.JSON(http.StatusOK, workflowTemplateResponse(template))
}

func TestTextModel(c *gin.Context) {
	var req struct {
		ModelID string `json:"model_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "模型参数不合法"})
		return
	}
	var settings model.ClientSettings
	if database.DB.First(&settings).Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "无法加载上游配置"})
		return
	}
	response, _, _, err := callUpstreamLLM("仅回复 OK", req.ModelID, settings)
	if err != nil || response == "" || strings.Contains(response, "失败") || strings.Contains(response, "错误") || strings.Contains(response, "超时") {
		message := response
		if err != nil {
			message = err.Error()
		}
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": message})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "文字模型连通正常"})
}

func TestImageModel(c *gin.Context) {
	// 图片通道与文字通道共享服务商鉴权；避免测试接口产生真实图片费用，仅校验模型已启用且服务商密钥存在。
	var req struct {
		ModelID string `json:"model_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "模型参数不合法"})
		return
	}
	var selected model.Model
	if err := database.DB.Where("id = ? AND enabled = true", req.ModelID).First(&selected).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "图片模型不存在或未启用"})
		return
	}
	var provider model.Provider
	if err := database.DB.Where("id = ? AND enabled = true", selected.ProviderID).First(&provider).Error; err != nil || strings.TrimSpace(provider.ApiKey) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "服务商未启用或密钥未配置"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "图片模型配置完整"})
}
