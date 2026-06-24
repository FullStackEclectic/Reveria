package handler

import (
	"net/http"
	"os"
	"strings"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// AuthMiddleware 简单的鉴权中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// 如果没有提供登录态，但在本地开发测试中为了让桌面端跑通，可以提供一个默认虚拟用户 UUID
			// 这里我们使用一个固定的 UUID 占位
			defaultUserID := uuid.MustParse("00000000-0000-0000-0000-000000000000")
			c.Set("user_id", defaultUserID)
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Authorization 格式错误"})
			c.Abort()
			return
		}

		tokenStr := strings.TrimSpace(parts[1])
		userID, err := uuid.Parse(tokenStr)
		if err != nil {
			// 在完整的生产环境中，这里应该解析 JWT 或者查询 auth_sessions 表
			// 目前开发过渡期，只要 token 是个 UUID，我们就直接作为 user_id 使用
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "无效的 Token"})
			c.Abort()
			return
		}

		// 检查用户是否存在，若不存在则临时创建（平滑过渡，保证可用性）
		var user model.User
		if err := database.DB.Where("id = ?", userID).First(&user).Error; err != nil {
			// 自动建一个临时用户以防报错
			user = model.User{
				ID:          userID,
				Status:      "active",
				DisplayName: ptrString("开发者用户"),
			}
			database.DB.Create(&user)
		}

		c.Set("user_id", userID)
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

func ptrString(s string) *string {
	return &s
}

// getStorageDir 获取物理存储路径目录
func getStorageDir() string {
	dir := os.Getenv("REVERIA_STORAGE_DIR")
	if dir == "" {
		return "storage/uploads"
	}
	return dir
}
