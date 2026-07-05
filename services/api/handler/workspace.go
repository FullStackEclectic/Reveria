package handler

import (
	"net/http"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ListWorkspaces 获取当前用户参与的所有工作区 (GET /workspaces)
func ListWorkspaces(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)

	// 查询该用户加入的工作区列表
	var members []model.WorkspaceMember
	if err := database.DB.Where("user_id = ? AND status = 'joined'", actorID).Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取工作区关系失败: " + err.Error()})
		return
	}

	var workspaceIDs []uuid.UUID
	for _, m := range members {
		workspaceIDs = append(workspaceIDs, m.WorkspaceID)
	}

	// 查询自己创建且未退出的工作区
	var ownedWorkspaces []model.Workspace
	database.DB.Where("owner_user_id = ?", actorID).Find(&ownedWorkspaces)
	for _, ws := range ownedWorkspaces {
		found := false
		for _, id := range workspaceIDs {
			if id == ws.ID {
				found = true
				break
			}
		}
		if !found {
			workspaceIDs = append(workspaceIDs, ws.ID)
		}
	}

	if len(workspaceIDs) == 0 {
		c.JSON(http.StatusOK, []model.Workspace{})
		return
	}

	var workspaces []model.Workspace
	if err := database.DB.Where("id IN ?", workspaceIDs).Find(&workspaces).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取工作区列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, workspaces)
}

// CreateWorkspace 创建新的工作区 (POST /workspaces)
func CreateWorkspace(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区名称不合法"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	workspace := model.Workspace{
		ID:           uuid.New(),
		Name:         req.Name,
		OwnerUserID:  actorID,
		GiftBalance:  0,
		StorageQuota: 10 * 1024 * 1024 * 1024, // 10GB
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	tx := database.DB.Begin()
	if err := tx.Create(&workspace).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建工作区失败"})
		return
	}

	// 绑定成员角色为 owner
	member := model.WorkspaceMember{
		ID:          uuid.New(),
		WorkspaceID: workspace.ID,
		UserID:      actorID,
		Role:        "owner",
		Status:      "joined",
		JoinedAt:    time.Now(),
	}
	if err := tx.Create(&member).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "添加工作区所有者失败"})
		return
	}

	tx.Commit()
	c.JSON(http.StatusOK, workspace)
}

// CreateInvitationRequest 成员邀请请求载荷
type CreateInvitationRequest struct {
	Email string `json:"email" binding:"required,email"`
	Role  string `json:"role" binding:"required"` // admin / manager / creator / viewer
}

// CreateInvitation 创建工作区成员邀请 (POST /workspaces/:workspace_id/invitations)
func CreateInvitation(c *gin.Context) {
	workspaceIDStr := c.Param("workspace_id")
	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
		return
	}

	var req CreateInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	// 只有管理员 (admin) 或所有者 (owner) 才能发出邀请
	if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限在此工作区邀请成员"})
		return
	}

	emailNormalized := strings.ToLower(strings.TrimSpace(req.Email))

	// 生成随机的唯一 Token 串代替复杂的 JWT
	token := uuid.New().String() + "-" + uuid.New().String()

	invitation := model.WorkspaceInvitation{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		Email:       emailNormalized,
		Role:        req.Role,
		Token:       token,
		Status:      "pending",
		InvitedBy:   &actorID,
		CreatedAt:   time.Now(),
		ExpiresAt:   time.Now().Add(7 * 24 * time.Hour), // 7 天后过期
	}

	if err := database.DB.Create(&invitation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "生成邀请链接失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"token":   token,
		"expires": invitation.ExpiresAt,
	})
}

// AcceptInvitationRequest 接受邀请载荷
type AcceptInvitationRequest struct {
	Token string `json:"token" binding:"required"`
}

// AcceptInvitation 接受邀请并加入工作区 (POST /invitations/accept)
func AcceptInvitation(c *gin.Context) {
	var req AcceptInvitationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "邀请 Token 不能为空"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	tx := database.DB.Begin()

	// 1. 查询有效且未过期的 pending 邀请
	var invitation model.WorkspaceInvitation
	err := forUpdate(tx).
		Where("token = ? AND status = ? AND expires_at > ?", req.Token, "pending", time.Now()).
		First(&invitation).Error

	if err != nil {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "邀请码无效或已过期"})
		return
	}

	// 2. 校验当前登录用户的邮箱和邀请的邮箱是否匹配
	var user model.User
	if err := tx.Where("id = ?", actorID).First(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "身份核验失败"})
		return
	}

	if user.Email == nil || strings.ToLower(*user.Email) != strings.ToLower(invitation.Email) {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "当前登录账号与受邀账号邮箱不匹配"})
		return
	}

	// 3. 将其添加入 workspace_members
	// 校验是否已是成员
	var count int64
	tx.Model(&model.WorkspaceMember{}).Where("workspace_id = ? AND user_id = ?", invitation.WorkspaceID, actorID).Count(&count)
	if count > 0 {
		// 已是成员，直接标记邀请已被接受，提交事务
		invitation.Status = "accepted"
		tx.Save(&invitation)
		tx.Commit()
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "你已是该工作区成员"})
		return
	}

	member := model.WorkspaceMember{
		ID:          uuid.New(),
		WorkspaceID: invitation.WorkspaceID,
		UserID:      actorID,
		Role:        invitation.Role,
		Status:      "joined",
		JoinedAt:    time.Now(),
	}

	if err := tx.Create(&member).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "加入工作区失败"})
		return
	}

	// 4. 更改邀请状态
	invitation.Status = "accepted"
	tx.Save(&invitation)

	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"message":      "成功加入工作区",
		"workspace_id": invitation.WorkspaceID,
	})
}
