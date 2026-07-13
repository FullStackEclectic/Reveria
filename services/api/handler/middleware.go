package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AuthMiddleware JWT 鉴权中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未提供登录凭证"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Authorization 格式错误"})
			c.Abort()
			return
		}

		tokenStr := strings.TrimSpace(parts[1])

		// 使用 JWT 校验 Token 签名和有效期
		userID, err := ParseAccessToken(tokenStr)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "登录凭证无效或已过期，请重新登录"})
			c.Abort()
			return
		}

		// 验证用户存在性
		var user model.User
		if err := database.DB.Where("id = ? AND status = ?", userID, "active").First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "用户不存在"})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Next()
	}
}

// PlatformAdminMiddleware 统一保护平台级管理接口，避免各 Handler 分散鉴权产生遗漏。
func PlatformAdminMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		actorID, exists := c.Get("user_id")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "message": "未登录或登录已失效"})
			return
		}

		userID, ok := actorID.(uuid.UUID)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "message": "无效的用户凭证"})
			return
		}

		var actor model.User
		if err := database.DB.Select("id", "is_platform_admin").Where("id = ?", userID).First(&actor).Error; err != nil || !actor.IsPlatformAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"success": false, "message": "仅平台超级管理员可执行此操作"})
			return
		}
		c.Next()
	}
}

// hasWorkspaceRole 校验用户是否在对应工作区拥有指定角色权限
func hasWorkspaceRole(workspaceID uuid.UUID, userID uuid.UUID, allowedRoles []string) bool {
	if userID == uuid.Nil || workspaceID == uuid.Nil {
		return false
	}

	var member model.WorkspaceMember
	err := database.DB.Where("workspace_id = ? AND user_id = ? AND status = 'joined'", workspaceID, userID).First(&member).Error
	if err != nil {
		// 如果是工作区所有者，天然通过
		var ws model.Workspace
		if err := database.DB.Where("id = ? AND owner_user_id = ?", workspaceID, userID).First(&ws).Error; err == nil {
			return true
		}
		return false
	}

	for _, role := range allowedRoles {
		if member.Role == role {
			return true
		}
	}

	return false
}

func requireProjectInWorkspace(c *gin.Context, projectID, workspaceID uuid.UUID) bool {
	if projectID == uuid.Nil || workspaceID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目和工作区不能为空"})
		return false
	}
	var count int64
	if err := database.DB.Model(&model.Project{}).Where("id = ? AND workspace_id = ?", projectID, workspaceID).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "校验项目归属失败"})
		return false
	}
	if count == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目不属于指定工作区"})
		return false
	}
	return true
}

func requireCustomerInWorkspace(c *gin.Context, customerID *uuid.UUID, workspaceID uuid.UUID) bool {
	if customerID == nil {
		return true
	}
	var count int64
	if err := database.DB.Model(&model.Customer{}).Where("id = ? AND workspace_id = ?", *customerID, workspaceID).Count(&count).Error; err != nil || count == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "客户不属于指定工作区"})
		return false
	}
	return true
}

func requireBrandKitInWorkspace(c *gin.Context, brandKitID *uuid.UUID, workspaceID uuid.UUID) bool {
	if brandKitID == nil {
		return true
	}
	var count int64
	if err := database.DB.Model(&model.BrandKit{}).Where("id = ? AND workspace_id = ?", *brandKitID, workspaceID).Count(&count).Error; err != nil || count == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "品牌库不属于指定工作区"})
		return false
	}
	return true
}

func ptrString(s string) *string {
	return &s
}

// getStorageDir 获取物理存储路径目录
func getStorageDir() string {
	dir := os.Getenv("REVERIA_STORAGE_DIR")
	if dir == "" {
		dir = "storage/uploads"
	}
	if filepath.IsAbs(dir) {
		return filepath.Clean(dir)
	}

	cwd, err := os.Getwd()
	if err != nil {
		return filepath.Clean(dir)
	}

	// 支持从仓库根目录或 services/api 目录启动，避免相对路径指向两个不同的存储目录。
	serviceDir := filepath.Join(cwd, "services", "api")
	if _, statErr := os.Stat(filepath.Join(serviceDir, "go.mod")); statErr == nil {
		return filepath.Clean(filepath.Join(serviceDir, dir))
	}

	return filepath.Clean(filepath.Join(cwd, dir))
}

// forUpdate 条件化地在查询上添加 FOR UPDATE 行锁
// SQLite 不支持 FOR UPDATE，直接跳过；Postgres 正常使用
func forUpdate(tx *gorm.DB) *gorm.DB {
	if database.IsSQLite {
		return tx
	}
	return tx.Set("gorm:query_option", "FOR UPDATE")
}
