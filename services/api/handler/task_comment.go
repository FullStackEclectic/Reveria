package handler

import (
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListTaskComments 获取某个 AI 任务的调试留言/日志 (GET /api/tasks/:id/comments)
func ListTaskComments(c *gin.Context) {
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "任务 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var task model.GenerationTask
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "任务不存在"})
		return
	}

	if !hasWorkspaceRole(task.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此任务留言"})
		return
	}

	var comments []model.TaskComment
	if err := database.DB.Where("task_id = ?", taskID).Order("created_at asc").Find(&comments).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取留言失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, comments)
}

// CreateTaskComment 创建任务留言/调试日志 (POST /api/tasks/:id/comments)
func CreateTaskComment(c *gin.Context) {
	taskIDStr := c.Param("id")
	taskID, err := uuid.Parse(taskIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "任务 ID 格式有误"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "留言内容不能为空"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var task model.GenerationTask
	if err := database.DB.Where("id = ?", taskID).First(&task).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "任务不存在"})
		return
	}

	if !hasWorkspaceRole(task.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限留言"})
		return
	}

	comment := model.TaskComment{
		ID:        uuid.New(),
		TaskID:    taskID,
		UserID:    actorID,
		Content:   req.Content,
		CreatedAt: time.Now(),
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存留言失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, comment)
}
