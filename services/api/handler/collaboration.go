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

// CommentSummary 评论信息
type CommentSummary struct {
	ID              uuid.UUID  `json:"id"`
	ProjectID       uuid.UUID  `json:"project_id"`
	UserID          *uuid.UUID `json:"user_id"`
	UserDisplayName string     `json:"user_display_name"`
	Content         string     `json:"content"`
	CreatedAt       int64      `json:"created_at"`
}

// ShareSummary 分享外链信息
type ShareSummary struct {
	ID        uuid.UUID  `json:"id"`
	ProjectID uuid.UUID  `json:"project_id"`
	Token     string     `json:"token"`
	CreatedAt int64      `json:"created_at"`
	ExpiresAt *int64     `json:"expires_at"`
	Status    string     `json:"status"`
}

// ListProjectComments 获取项目评论列表 (GET /projects/:project_id/comments)
func ListProjectComments(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式错误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var project model.Project
	if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定项目"})
		return
	}

	if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此项目的评论"})
		return
	}

	// 联合 users 表查询评论列表，获取 display_name
	type Row struct {
		ID              uuid.UUID  `gorm:"column:id"`
		ProjectID       uuid.UUID  `gorm:"column:project_id"`
		UserID          *uuid.UUID `gorm:"column:user_id"`
		UserDisplayName *string    `gorm:"column:user_display_name"`
		ClientName      *string    `gorm:"column:client_name"`
		Content         string     `gorm:"column:content"`
		CreatedAt       time.Time  `gorm:"column:created_at"`
	}

	var rows []Row
	err = database.DB.Table("project_comments").
		Select("project_comments.id, project_comments.project_id, project_comments.user_id, users.display_name as user_display_name, project_comments.client_name, project_comments.content, project_comments.created_at").
		Joins("left join users on project_comments.user_id = users.id").
		Where("project_comments.project_id = ?", projectID).
		Order("project_comments.created_at asc").
		Scan(&rows).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取评论失败: " + err.Error()})
		return
	}

	summaries := make([]CommentSummary, 0, len(rows))
	for _, r := range rows {
		name := "访客"
		if r.UserDisplayName != nil {
			name = *r.UserDisplayName
		} else if r.ClientName != nil {
			name = *r.ClientName
		}
		summaries = append(summaries, CommentSummary{
			ID:              r.ID,
			ProjectID:       r.ProjectID,
			UserID:          r.UserID,
			UserDisplayName: name,
			Content:         r.Content,
			CreatedAt:       r.CreatedAt.Unix(),
		})
	}

	c.JSON(http.StatusOK, summaries)
}

// CreateProjectComment 发表项目评论 (POST /projects/:project_id/comments)
func CreateProjectComment(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式错误"})
		return
	}

	var req struct {
		Content string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "评论内容不能为空"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var project model.Project
	if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定项目"})
		return
	}

	if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限在此项目发表评论"})
		return
	}

	comment := model.ProjectComment{
		ID:        uuid.New(),
		ProjectID: projectID,
		UserID:    &actorID,
		Content:   req.Content,
		CreatedAt: time.Now(),
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "发表评论失败: " + err.Error()})
		return
	}

	var user model.User
	database.DB.Where("id = ?", actorID).First(&user)
	displayName := "开发者用户"
	if user.DisplayName != nil {
		displayName = *user.DisplayName
	}

	c.JSON(http.StatusOK, CommentSummary{
		ID:              comment.ID,
		ProjectID:       comment.ProjectID,
		UserID:          comment.UserID,
		UserDisplayName: displayName,
		Content:         comment.Content,
		CreatedAt:       comment.CreatedAt.Unix(),
	})
}

// ListProjectShares 获取项目外链列表 (GET /projects/:project_id/shares)
func ListProjectShares(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式错误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var project model.Project
	if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定项目"})
		return
	}

	if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看分享外链"})
		return
	}

	var shares []model.ProjectShare
	if err := database.DB.Where("project_id = ?", projectID).Find(&shares).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取分享外链失败: " + err.Error()})
		return
	}

	summaries := make([]ShareSummary, 0, len(shares))
	for _, s := range shares {
		var exp *int64
		if s.ExpiresAt != nil {
			e := s.ExpiresAt.Unix()
			exp = &e
		}
		summaries = append(summaries, ShareSummary{
			ID:        s.ID,
			ProjectID: s.ProjectID,
			Token:     s.Token,
			CreatedAt: s.CreatedAt.Unix(),
			ExpiresAt: exp,
			Status:    s.Status,
		})
	}

	c.JSON(http.StatusOK, summaries)
}

// CreateProjectShare 创建项目分享链接 (POST /projects/:project_id/shares)
func CreateProjectShare(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式错误"})
		return
	}

	var req struct {
		ExpiresInDays *int64 `json:"expires_in_days"`
	}
	_ = c.ShouldBindJSON(&req)

	actorID := c.MustGet("user_id").(uuid.UUID)

	var project model.Project
	if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定项目"})
		return
	}

	if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限生成分享外链"})
		return
	}

	token := uuid.New().String() + "-" + uuid.New().String()

	var expiresAt *time.Time
	if req.ExpiresInDays != nil && *req.ExpiresInDays > 0 {
		exp := time.Now().Add(time.Duration(*req.ExpiresInDays*24) * time.Hour)
		expiresAt = &exp
	}

	share := model.ProjectShare{
		ID:        uuid.New(),
		ProjectID: projectID,
		Token:     token,
		CreatedBy: &actorID,
		CreatedAt: time.Now(),
		ExpiresAt: expiresAt,
		Status:    "active",
	}

	if err := database.DB.Create(&share).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建分享链接失败: " + err.Error()})
		return
	}

	var exp *int64
	if share.ExpiresAt != nil {
		e := share.ExpiresAt.Unix()
		exp = &e
	}

	c.JSON(http.StatusOK, ShareSummary{
		ID:        share.ID,
		ProjectID: share.ProjectID,
		Token:     share.Token,
		CreatedAt: share.CreatedAt.Unix(),
		ExpiresAt: exp,
		Status:    share.Status,
	})
}

// RevokeProjectShare 收回分享外链 (DELETE /shares/:id)
func RevokeProjectShare(c *gin.Context) {
	shareIDStr := c.Param("id")
	shareID, err := uuid.Parse(shareIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "外链 ID 格式错误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var share model.ProjectShare
	if err := database.DB.Where("id = ?", shareID).First(&share).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到外链"})
		return
	}

	var project model.Project
	database.DB.Where("id = ?", share.ProjectID).First(&project)

	if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限撤销分享外链"})
		return
	}

	if err := database.DB.Model(&share).Update("status", "revoked").Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "撤销失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "外链已成功撤销"})
}

// ======================== PORTAL (外部免密交付预览端) ========================

// GetPortalProject 客户预览外链内容 (GET /portal/shares/:token)
func GetPortalProject(c *gin.Context) {
	token := c.Param("token")

	var share model.ProjectShare
	err := database.DB.Where("token = ? AND status = ?", token, "active").First(&share).Error
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "分享链接无效或已被撤销"})
		return
	}

	if share.ExpiresAt != nil && share.ExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "分享外链已过期"})
		return
	}

	// 查出对应的项目和画布
	var project model.Project
	if err := database.DB.Where("id = ?", share.ProjectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "项目已被删除"})
		return
	}

	var canvas model.ProjectCanvas
	err = database.DB.Where("project_id = ?", share.ProjectID).First(&canvas).Error
	var canvasJSON json.RawMessage
	if err == nil {
		canvasJSON = json.RawMessage(canvas.Canvas)
	} else {
		canvasJSON = json.RawMessage(`{"version":1,"items":[]}`)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"project":      project,
		"canvas":       canvasJSON,
		"shared_token": token,
	})
}

// CreatePortalComment 客户在免登页面评论项目 (POST /portal/shares/:token/comments)
func CreatePortalComment(c *gin.Context) {
	token := c.Param("token")

	var share model.ProjectShare
	if err := database.DB.Where("token = ? AND status = 'active'", token).First(&share).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "外链无效"})
		return
	}

	var req struct {
		ClientName string `json:"client_name" binding:"required"`
		Content    string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数输入不合法"})
		return
	}

	comment := model.ProjectComment{
		ID:         uuid.New(),
		ProjectID:  share.ProjectID,
		ClientName: &req.ClientName,
		Content:    req.Content,
		CreatedAt:  time.Now(),
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存评论失败"})
		return
	}

	c.JSON(http.StatusOK, CommentSummary{
		ID:              comment.ID,
		ProjectID:       comment.ProjectID,
		UserDisplayName: req.ClientName,
		Content:         comment.Content,
		CreatedAt:       comment.CreatedAt.Unix(),
	})
}

// ApprovePortalProject 客户在免密门户通过并审批项目 (POST /portal/shares/:token/approve)
func ApprovePortalProject(c *gin.Context) {
	token := c.Param("token")

	var share model.ProjectShare
	if err := database.DB.Where("token = ? AND status = 'active'", token).First(&share).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "外链无效"})
		return
	}

	tx := database.DB.Begin()

	var project model.Project
	if err := tx.Where("id = ?", share.ProjectID).First(&project).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "项目已不存在"})
		return
	}

	// 更新项目状态为 delivered (已交付)
	project.Status = "delivered"
	project.UpdatedAt = time.Now()
	tx.Save(&project)

	// 新增一条系统评论通知
	systemMsg := "外部客户已审批通过该项目交付版本。"
	comment := model.ProjectComment{
		ID:         uuid.New(),
		ProjectID:  share.ProjectID,
		ClientName: ptrString("客户系统审批"),
		Content:    systemMsg,
		CreatedAt:  time.Now(),
	}
	tx.Create(&comment)

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "项目交付审批通过",
		"status":  project.Status,
	})
}
