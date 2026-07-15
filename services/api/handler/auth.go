package handler

import (
	"bytes"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/argon2"
	"golang.org/x/crypto/bcrypt"
)

// RegisterRequest 注册请求载荷
type RegisterRequest struct {
	Email       string `json:"email" binding:"required,email"`
	Password    string `json:"password" binding:"required,min=8"`
	DisplayName string `json:"display_name" binding:"required"`
}

// LoginRequest 登录请求载荷
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// DevLoginRequest 开发模式快捷登录载荷
type DevLoginRequest struct {
	Email       *string `json:"email"`
	DisplayName string  `json:"display_name" binding:"required"`
}

func defaultWorkspaceStorageQuota() int64 {
	raw := strings.TrimSpace(os.Getenv("REVERIA_DEFAULT_STORAGE_QUOTA_BYTES"))
	if raw == "" {
		return 0
	}
	value, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || value < 0 {
		return 0
	}
	return value
}

// verifyArgon2Hash 校验密码是否匹配 Argon2 编码的哈希串
func verifyArgon2Hash(password, encodedHash string) (bool, error) {
	// 期望格式: $argon2id$v=19$m=4096,t=3,p=1$c2FsdA$aGFzaA
	parts := strings.Split(encodedHash, "$")
	if len(parts) < 6 {
		return false, errors.New("invalid hash format")
	}

	var version int
	_, err := fmt.Sscanf(parts[2], "v=%d", &version)
	if err != nil {
		return false, err
	}
	if version != argon2.Version {
		return false, errors.New("incompatible argon2 version")
	}

	var memory, timeCost, threads uint32
	_, err = fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &memory, &timeCost, &threads)
	if err != nil {
		return false, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		salt, err = base64.StdEncoding.DecodeString(parts[4])
		if err != nil {
			return false, err
		}
	}

	expectedKey, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		expectedKey, err = base64.StdEncoding.DecodeString(parts[5])
		if err != nil {
			return false, err
		}
	}

	var actualKey []byte
	switch parts[1] {
	case "argon2id":
		actualKey = argon2.IDKey([]byte(password), salt, timeCost, memory, uint8(threads), uint32(len(expectedKey)))
	case "argon2i":
		actualKey = argon2.Key([]byte(password), salt, timeCost, memory, uint8(threads), uint32(len(expectedKey)))
	default:
		return false, errors.New("unsupported argon2 mode")
	}

	if subtle.ConstantTimeCompare(actualKey, expectedKey) == 1 {
		return true, nil
	}
	return false, nil
}

// RegisterUser 用户注册 (POST /auth/register)
func RegisterUser(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入参数不合法（密码需不小于8位）"})
		return
	}

	// 校验分站注册控制与运行模式
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err == nil {
		if settings.BillingMode == "bridge" {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "当前已启用主站数据互通模式，分站不支持自助注册。请使用您在 AI主站 注册的账号直接登录。"})
			return
		}
		if !settings.AllowUserRegister {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "前台自助注册功能暂未开放，请联系管理员分配账户。"})
			return
		}
	}

	emailNormalized := strings.ToLower(strings.TrimSpace(req.Email))
	allowed, retryAfter, throttleErr := consumeAuthAttempt(
		authThrottleKey("register", c.ClientIP()),
		authLimitFromEnv("REVERIA_REGISTER_LIMIT", 5), time.Hour, time.Hour,
	)
	if throttleErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "注册频率校验失败"})
		return
	}
	if !allowed {
		c.Header("Retry-After", fmt.Sprintf("%.0f", retryAfter.Seconds()))
		c.JSON(http.StatusTooManyRequests, gin.H{"success": false, "message": "注册请求过于频繁，请稍后再试"})
		return
	}

	// 校验邮箱是否已被注册
	var existingUser model.User
	if err := database.DB.Where("email = ?", emailNormalized).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "该邮箱已被注册"})
		return
	}

	// 密码哈希
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "密码加密失败"})
		return
	}

	// 开启事务，注册用户并创建默认个人工作区
	tx := database.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "无法开启注册事务"})
		return
	}

	userID := uuid.New()
	user := model.User{
		ID:           userID,
		Email:        &emailNormalized,
		DisplayName:  &req.DisplayName,
		PasswordHash: string(hashedBytes),
		Status:       "active",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	// 若系统是第一个注册的用户，则默认设为平台超管
	var totalUsers int64
	tx.Model(&model.User{}).Count(&totalUsers)
	if totalUsers == 0 {
		user.IsPlatformAdmin = true
	}

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建用户失败: " + err.Error()})
		return
	}

	// 读取站长注册赠送额度设置
	var giftBalance int64
	if settings.ID != uuid.Nil {
		giftBalance = settings.GiftCreditsOnRegister
	}

	// 创建默认个人工作区
	workspaceID := uuid.New()
	workspace := model.Workspace{
		ID:           workspaceID,
		Name:         req.DisplayName + " 的个人工作区",
		OwnerUserID:  userID,
		GiftBalance:  giftBalance,
		StorageQuota: defaultWorkspaceStorageQuota(),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := tx.Create(&workspace).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建默认工作区失败: " + err.Error()})
		return
	}

	// 绑定成员关系为 owner
	member := model.WorkspaceMember{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		UserID:      userID,
		Role:        "owner",
		Status:      "joined",
		JoinedAt:    time.Now(),
	}

	if err := tx.Create(&member).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建工作区成员关联失败: " + err.Error()})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交注册事务失败"})
		return
	}
	writeAuthSuccess(c, user)
}

// syncBridgeUser 桥接模式下将主站通过验证的用户自动同步并初始化至本地数据库
func syncBridgeUser(email string, displayName string) (*model.User, error) {
	tx := database.DB.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}

	var existingUser model.User
	if err := tx.Where("email = ?", email).First(&existingUser).Error; err == nil {
		tx.Rollback()
		return &existingUser, nil
	}

	userID := uuid.New()
	user := model.User{
		ID:           userID,
		Email:        &email,
		DisplayName:  &displayName,
		PasswordHash: "$bcrypt$bridge_sync_dummy_hash", // 桥接模式下本地密码是随机无用占位符
		Status:       "active",
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 读取站长注册赠送额度设置
	var settings model.ClientSettings
	var giftBalance int64
	if err := tx.First(&settings).Error; err == nil {
		giftBalance = settings.GiftCreditsOnRegister
	}

	// 如果是桥接模式，本地的个人工作区账户余额我们设为 0，因为额度是直接从主站扣的
	if settings.BillingMode == "bridge" {
		giftBalance = 0
	}

	// 创建默认个人工作区
	workspaceID := uuid.New()
	workspace := model.Workspace{
		ID:           workspaceID,
		Name:         displayName + " 的个人工作区",
		OwnerUserID:  userID,
		GiftBalance:  giftBalance,
		StorageQuota: defaultWorkspaceStorageQuota(),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := tx.Create(&workspace).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 绑定成员关系
	member := model.WorkspaceMember{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		UserID:      userID,
		Role:        "owner",
		Status:      "joined",
		JoinedAt:    time.Now(),
	}

	if err := tx.Create(&member).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// LoginUser 用户登录 (POST /auth/login)
func LoginUser(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数格式不正确"})
		return
	}

	emailNormalized := strings.ToLower(strings.TrimSpace(req.Email))
	allowed, retryAfter, throttleErr := consumeAuthAttempt(
		authThrottleKey("login", c.ClientIP(), emailNormalized),
		authLimitFromEnv("REVERIA_LOGIN_LIMIT", 20), 10*time.Minute, 15*time.Minute,
	)
	if throttleErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "登录频率校验失败"})
		return
	}
	if !allowed {
		c.Header("Retry-After", fmt.Sprintf("%.0f", retryAfter.Seconds()))
		c.JSON(http.StatusTooManyRequests, gin.H{"success": false, "message": "登录尝试过于频繁，请稍后再试"})
		return
	}

	// 读取配置看当前是否是 bridge 模式
	var settings model.ClientSettings
	isBridge := false
	if err := database.DB.First(&settings).Error; err == nil {
		if settings.BillingMode == "bridge" {
			isBridge = true
		}
	}

	if isBridge {
		// 1. 调用主站的登录接口进行校验
		loginURL := fmt.Sprintf("%s/api/user/login", settings.BridgeMainStationURL)
		body := map[string]string{
			"username": emailNormalized,
			"password": req.Password,
		}

		jsonBytes, err := json.Marshal(body)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "请求序列化失败"})
			return
		}

		httpReq, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(jsonBytes))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建登录请求失败"})
			return
		}
		httpReq.Header.Set("Content-Type", "application/json")

		client := &http.Client{Timeout: 8 * time.Second}
		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "连接主站登录失败: " + err.Error()})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "主站账号或密码验证错误"})
			return
		}

		var mainUser struct {
			Success bool `json:"success"`
			User    struct {
				DisplayName string `json:"display_name"`
				Username    string `json:"username"`
			} `json:"user"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&mainUser); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "解析主站用户信息失败"})
			return
		}

		displayName := mainUser.User.DisplayName
		if displayName == "" {
			displayName = mainUser.User.Username
		}
		if displayName == "" {
			displayName = strings.Split(emailNormalized, "@")[0]
		}

		// 2. 将用户同步至本地
		user, err := syncBridgeUser(emailNormalized, displayName)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "本地同步主站用户失败: " + err.Error()})
			return
		}

		writeAuthSuccess(c, *user)
		return
	}

	// 否则，执行原有的本地登录逻辑
	var user model.User
	if err := database.DB.Where("email = ? AND status = 'active'", emailNormalized).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "用户名或密码错误"})
		return
	}

	// 验证密码，支持 Argon2 & Bcrypt
	isArgon2 := strings.HasPrefix(user.PasswordHash, "$argon2")
	if isArgon2 {
		match, err := verifyArgon2Hash(req.Password, user.PasswordHash)
		if err != nil || !match {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "用户名或密码错误"})
			return
		}
		// 密码正确，自动平滑升级为 bcrypt 并入库保存，防止下次重复解密
		newHashBytes, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err == nil {
			database.DB.Model(&user).Update("password_hash", string(newHashBytes))
		}
	} else {
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "用户名或密码错误"})
			return
		}
	}

	writeAuthSuccess(c, user)
}

// DevLogin 开发模式快捷登录 (POST /auth/dev-login)
func DevLogin(c *gin.Context) {
	if os.Getenv("REVERIA_ENABLE_DEV_LOGIN") != "true" {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "开发登录未启用"})
		return
	}
	var req DevLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求参数不合法"})
		return
	}

	email := "dev@reveria.local"
	if req.Email != nil && *req.Email != "" {
		email = strings.ToLower(strings.TrimSpace(*req.Email))
	}

	tx := database.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "无法开启开发登录事务"})
		return
	}

	var user model.User
	err := tx.Where("email = ?", email).First(&user).Error
	if err != nil {
		// 不存在则创建
		userID := uuid.New()
		user = model.User{
			ID:              userID,
			Email:           &email,
			DisplayName:     &req.DisplayName,
			Status:          "active",
			IsPlatformAdmin: true, // 开发者默认超管
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}
		if err := tx.Create(&user).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建开发用户失败"})
			return
		}

		// 为该用户创建一个默认工作区
		workspaceID := uuid.New()
		var devSettings model.ClientSettings
		_ = tx.First(&devSettings).Error
		workspace := model.Workspace{
			ID:           workspaceID,
			Name:         req.DisplayName + " 的个人工作区",
			OwnerUserID:  userID,
			GiftBalance:  devSettings.GiftCreditsOnRegister,
			StorageQuota: defaultWorkspaceStorageQuota(),
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}
		tx.Create(&workspace)

		member := model.WorkspaceMember{
			ID:          uuid.New(),
			WorkspaceID: workspaceID,
			UserID:      userID,
			Role:        "owner",
			Status:      "joined",
			JoinedAt:    time.Now(),
		}
		tx.Create(&member)
	} else {
		// 已存在则强制设为 active 且为 platform admin，更新显示名称
		user.IsPlatformAdmin = true
		user.Status = "active"
		user.DisplayName = &req.DisplayName
		tx.Save(&user)
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交开发登录事务失败"})
		return
	}

	writeAuthSuccess(c, user)
}

// CurrentUser 获取当前登录用户身份详情 (GET /auth/me)
func CurrentUser(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)

	var user model.User
	if err := database.DB.Where("id = ?", actorID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "找不到当前用户"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":                user.ID,
			"email":             user.Email,
			"display_name":      user.DisplayName,
			"avatar_url":        user.AvatarURL,
			"is_platform_admin": user.IsPlatformAdmin,
		},
	})
}

// LogoutUser 用户登出 (POST /auth/logout)
func LogoutUser(c *gin.Context) {
	if sessionValue, exists := c.Get("session_id"); exists {
		if sessionID, ok := sessionValue.(uuid.UUID); ok {
			now := time.Now()
			_ = database.DB.Model(&model.AuthSession{}).Where("id = ?", sessionID).Update("revoked_at", now).Error
		}
	}
	clearWebAuthCookies(c)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "登出成功",
	})
}

// RefreshSession 刷新登录态 Token (POST /auth/refresh)
func RefreshSession(c *gin.Context) {
	rotateAuthSession(c)
}
