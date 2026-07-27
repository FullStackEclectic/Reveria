package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm/clause"
)

const (
	// canvasItemLimit 单个画布文档允许承载的元素上限，
	// 需与前端 packages/shared/src/utils.ts 的 CANVAS_ITEM_LIMIT 保持一致。
	canvasItemLimit = 2000
	// canvasMaxBytes 画布文档序列化后的体积上限，防止超大载荷打满数据库与内存。
	canvasMaxBytes = 4 << 20 // 4MB
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

	// 校验画布是否合法
	if ok, reason := validateProjectCanvas(req.Canvas); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": reason})
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

// validateProjectCanvas 校验画布结构，返回是否合法与不合法的具体原因。
// 画布以原始 JSON 落库，这里是唯一的服务端防线，必须挡住超大载荷与结构错乱的文档。
func validateProjectCanvas(canvasData json.RawMessage) (bool, string) {
	if len(canvasData) > canvasMaxBytes {
		return false, fmt.Sprintf("画布数据过大(上限 %d MB)，请清理后再保存", canvasMaxBytes>>20)
	}

	var val map[string]any
	if err := json.Unmarshal(canvasData, &val); err != nil {
		return false, "画布数据不是合法的 JSON 对象"
	}

	versionVal, ok := val["version"]
	if !ok {
		return false, "画布数据缺少 version 字段"
	}
	switch v := versionVal.(type) {
	case float64:
		if v != 1 {
			return false, "画布版本号不受支持(需为 1)"
		}
	case int64:
		if v != 1 {
			return false, "画布版本号不受支持(需为 1)"
		}
	default:
		return false, "画布版本号不受支持(需为 1)"
	}

	itemsVal, ok := val["items"]
	if !ok {
		return false, "画布数据缺少 items 字段"
	}
	items, ok := itemsVal.([]any)
	if !ok {
		return false, "画布 items 字段必须是数组"
	}
	if len(items) > canvasItemLimit {
		return false, fmt.Sprintf("画布元素数量超过上限 %d 个", canvasItemLimit)
	}

	// boards / connections 为可选字段，出现时必须是数组，避免前端读取时崩溃。
	for _, field := range []string{"boards", "connections"} {
		value, exists := val[field]
		if !exists || value == nil {
			continue
		}
		if _, ok := value.([]any); !ok {
			return false, fmt.Sprintf("画布 %s 字段必须是数组", field)
		}
	}

	return true, ""
}
