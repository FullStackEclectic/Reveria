package handler

import (
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateProjectRequest 创建项目请求载荷
type CreateProjectRequest struct {
	WorkspaceID   uuid.UUID  `json:"workspace_id" binding:"required"`
	CustomerID    *uuid.UUID `json:"customer_id"`
	BrandKitID    *uuid.UUID `json:"brand_kit_id"`
	Name          string     `json:"name" binding:"required"`
	Brief         *string    `json:"brief"`
	BudgetCredits *int64     `json:"budget_credits"`
	ProjectType   string     `json:"project_type"`
}

// UpdateProjectRequest 更新项目请求载荷
type UpdateProjectRequest struct {
	CustomerID    *uuid.UUID `json:"customer_id"`
	BrandKitID    *uuid.UUID `json:"brand_kit_id"`
	Name          string     `json:"name" binding:"required"`
	Brief         *string    `json:"brief"`
	Status        string     `json:"status" binding:"required"` // draft / active / reviewing / delivered / archived
	BudgetCredits *int64     `json:"budget_credits"`
}

// fillProjectCoverURL 查询项目下最新的一张资产（图片/视频/输出等）作为缩略图封面
func fillProjectCoverURL(proj *model.Project) {
	var latestAsset model.Asset
	// 查找项目下最新的图片资产，只要有 file_url 且非空
	if err := database.DB.Where("project_id = ? AND file_url IS NOT NULL AND file_url != ''", proj.ID).Order("created_at desc").First(&latestAsset).Error; err == nil {
		if latestAsset.ThumbnailURL != nil && *latestAsset.ThumbnailURL != "" {
			proj.CoverURL = *latestAsset.ThumbnailURL
		} else {
			proj.CoverURL = latestAsset.FileURL
		}
	}
}

// ListProjects 获取项目列表 (GET /projects)
func ListProjects(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)
	workspaceIDStr := c.Query("workspace_id")
	var workspaceID uuid.UUID
	var err error

	if workspaceIDStr == "" || workspaceIDStr == "undefined" || workspaceIDStr == "null" {
		// 自动获取该用户加入的第一个工作区以兼容前端并行初始化
		var memberRelation model.WorkspaceMember
		if err := database.DB.Where("user_id = ? AND status = 'joined'", actorID).First(&memberRelation).Error; err != nil {
			c.JSON(http.StatusOK, []model.Project{})
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

	// 权限检查：需是工作区的拥有者、管理员或成员
	if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限操作此工作区"})
		return
	}

	var projects []model.Project
	if err := database.DB.Where("workspace_id = ?", workspaceID).Order("created_at desc").Limit(50).Find(&projects).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取项目列表失败: " + err.Error()})
		return
	}

	for i := range projects {
		fillProjectCoverURL(&projects[i])
	}

	c.JSON(http.StatusOK, projects)
}

// CreateProject 创建项目 (POST /projects)
func CreateProject(c *gin.Context) {
	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求参数不合法"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	// 权限检查：需是工作区的拥有者、管理员或成员
	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限操作此工作区"})
		return
	}
	if !requireCustomerInWorkspace(c, req.CustomerID, req.WorkspaceID) || !requireBrandKitInWorkspace(c, req.BrandKitID, req.WorkspaceID) {
		return
	}

	// 如果设置预算额度，只有 owner 或 admin 能操作
	if req.BudgetCredits != nil {
		if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin"}) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "只有管理员或所有者可以配置项目预算"})
			return
		}
	}

	projType := req.ProjectType
	if projType == "" {
		projType = "ai_canvas"
	}

	project := model.Project{
		ID:            uuid.New(),
		WorkspaceID:   req.WorkspaceID,
		CustomerID:    req.CustomerID,
		BrandKitID:    req.BrandKitID,
		Name:          req.Name,
		Brief:         req.Brief,
		Status:        "draft",
		BudgetCredits: req.BudgetCredits,
		ProjectType:   projType,
		CreatedBy:     &actorID,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := database.DB.Create(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建项目失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, project)
}

// GetProject 获取项目详情 (GET /projects/:id)
func GetProject(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var project model.Project
	if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定项目"})
		return
	}

	// 权限校验
	if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此项目"})
		return
	}

	fillProjectCoverURL(&project)

	c.JSON(http.StatusOK, project)
}

// UpdateProject 更新项目 (PATCH /projects/:id)
func UpdateProject(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式有误"})
		return
	}

	var req UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var project model.Project
	if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定项目"})
		return
	}

	// 权限校验
	if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限更新此项目"})
		return
	}

	isAdminOrOwner := hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin"})

	// 预算更改校验
	if req.BudgetCredits != project.BudgetCredits {
		if !isAdminOrOwner {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "只有管理员或所有者可以修改项目预算"})
			return
		}
	}

	// 状态迁移限制：delivered/archived 状态变更必须是 admin/owner 权限
	isNewStatusRestricted := req.Status == "delivered" || req.Status == "archived"
	isOldStatusRestricted := project.Status == "delivered" || project.Status == "archived"
	if (isNewStatusRestricted || isOldStatusRestricted) && !isAdminOrOwner {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限更改此状态"})
		return
	}

	// 外键工作区一致性校验：校验 customer 是否属于同一个工作区
	if req.CustomerID != nil {
		var customer model.Customer
		if err := database.DB.Where("id = ?", req.CustomerID).First(&customer).Error; err != nil || customer.WorkspaceID != project.WorkspaceID {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "客户所属工作区不一致"})
			return
		}
	}

	// 校验 brand kit 是否属于同一工作区
	if req.BrandKitID != nil {
		var brandKit model.BrandKit
		if err := database.DB.Where("id = ?", req.BrandKitID).First(&brandKit).Error; err != nil || brandKit.WorkspaceID != project.WorkspaceID {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "品牌库所属工作区不一致"})
			return
		}
	}

	// 更新字段
	project.CustomerID = req.CustomerID
	project.BrandKitID = req.BrandKitID
	project.Name = req.Name
	project.Brief = req.Brief
	project.Status = req.Status
	project.BudgetCredits = req.BudgetCredits
	project.UpdatedAt = time.Now()

	if err := database.DB.Save(&project).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存项目失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, project)
}

// DeleteProject 删除项目 (DELETE /projects/:id)
func DeleteProject(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := uuid.Parse(projectIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var project model.Project
	if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定项目"})
		return
	}

	// 删除项目会影响画布和资产，仅工作区管理员或所有者可执行。
	if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限删除此项目"})
		return
	}

	// 使用事务删除项目，确保级联删除画布和相关资产
	tx := database.DB.Begin()
	if err := tx.Where("id = ?", projectID).Delete(&model.Project{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除项目失败: " + err.Error()})
		return
	}

	// 级联清理画布
	if err := tx.Where("project_id = ?", projectID).Delete(&model.ProjectCanvas{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "清理项目画布失败"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交项目删除事务失败"})
		return
	}
	c.Status(http.StatusNoContent)
}
