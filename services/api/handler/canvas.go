package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm/clause"
)

// ProjectCanvasSummary Canvas 返回 Summary
type ProjectCanvasSummary struct {
	ProjectID   uuid.UUID       `json:"project_id"`
	WorkspaceID uuid.UUID       `json:"workspace_id"`
	Canvas      json.RawMessage `json:"canvas"`
}

// UpdateProjectCanvasRequest 更新画布请求载荷
type UpdateProjectCanvasRequest struct {
	Canvas json.RawMessage `json:"canvas" binding:"required"`
}

// GetProjectCanvas 获取项目画布 (GET /projects/:project_id/canvas)
func GetProjectCanvas(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	// 先获取项目以校验工作区
	var project model.Project
	if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定项目"})
		return
	}

	// 权限校验
	if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此项目的画布"})
		return
	}

	var canvas model.ProjectCanvas
	err = database.DB.Where("project_id = ?", projectID).First(&canvas).Error
	if err != nil {
		// 如果没找到，返回默认画布
		defaultCanvas := json.RawMessage(`{"version":1,"items":[]}`)
		c.JSON(http.StatusOK, ProjectCanvasSummary{
			ProjectID:   projectID,
			WorkspaceID: project.WorkspaceID,
			Canvas:      defaultCanvas,
		})
		return
	}

	c.JSON(http.StatusOK, ProjectCanvasSummary{
		ProjectID:   canvas.ProjectID,
		WorkspaceID: canvas.WorkspaceID,
		Canvas:      json.RawMessage(canvas.Canvas),
	})
}

// UpdateProjectCanvas 更新项目画布 (PUT /projects/:project_id/canvas)
func UpdateProjectCanvas(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式有误"})
		return
	}

	var req UpdateProjectCanvasRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数解析失败"})
		return
	}

	// 校验画布是否合法 (is_valid_project_canvas)
	if !isValidProjectCanvas(req.Canvas) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "画布数据结构不合法(version需为1)"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	// 获取项目并校验权限
	var project model.Project
	if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定项目"})
		return
	}

	if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限更新此画布"})
		return
	}

	// 准备保存数据
	canvasStr := string(req.Canvas)
	canvasItem := model.ProjectCanvas{
		ProjectID:   projectID,
		WorkspaceID: project.WorkspaceID,
		Canvas:      canvasStr,
		UpdatedBy:   &actorID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// 执行 Upsert (支持 SQLite 和 Postgres 兼容语法)
	err = database.DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "project_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"canvas", "updated_by", "updated_at"}),
	}).Create(&canvasItem).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新画布失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, ProjectCanvasSummary{
		ProjectID:   projectID,
		WorkspaceID: project.WorkspaceID,
		Canvas:      req.Canvas,
	})
}

// isValidProjectCanvas 校验画布结构
func isValidProjectCanvas(canvasData json.RawMessage) bool {
	var val map[string]any
	if err := json.Unmarshal(canvasData, &val); err != nil {
		return false
	}

	versionVal, ok := val["version"]
	if !ok {
		return false
	}

	// 确认版本号是 1
	switch v := versionVal.(type) {
	case float64:
		return v == 1
	case int64:
		return v == 1
	}

	return false
}
