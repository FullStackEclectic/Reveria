package handler

import (
	"bytes"
	"encoding/json"
	"errors"
	"image"
	"image/jpeg"
	_ "image/png" // 支持 PNG 解码
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/image/draw"
	"gorm.io/gorm"
)

// UploadAsset 上传资产素材 (POST /assets/upload)
func UploadAsset(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes())
	// 1. 获取 multipart/form-data 参数
	workspaceIDStr := c.PostForm("workspace_id")
	projectIDStr := c.PostForm("project_id")
	customerIDStr := c.PostForm("customer_id")

	workspaceID, err := uuid.Parse(workspaceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	// 2. 校验权限
	if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限在此工作区上传素材"})
		return
	}

	var projectID uuid.UUID
	if projectIDStr != "" {
		projectID, err = uuid.Parse(projectIDStr)
		if err != nil || !requireProjectInWorkspace(c, projectID, workspaceID) {
			return
		}
	}
	var customerID *uuid.UUID
	if customerIDStr != "" {
		parsedCustomerID, parseErr := uuid.Parse(customerIDStr)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "客户 ID 格式有误"})
			return
		}
		customerID = &parsedCustomerID
	}
	if !requireCustomerInWorkspace(c, customerID, workspaceID) {
		return
	}

	// 3. 读取上传的文件
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "未找到上传的文件"})
		return
	}
	defer file.Close()

	// 读取文件字节
	fileBytes, err := io.ReadAll(io.LimitReader(file, maxUploadBytes()+1))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "读取文件失败"})
		return
	}
	if int64(len(fileBytes)) > maxUploadBytes() {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": "上传文件超过大小限制"})
		return
	}

	// 4. 判定资产类型 (通过 content-type)
	contentType := http.DetectContentType(fileBytes)
	assetType := assetTypeFromMime(contentType)
	if assetType == "text" && !strings.HasPrefix(contentType, "text/") {
		c.JSON(http.StatusUnsupportedMediaType, gin.H{"success": false, "message": "不支持的文件类型"})
		return
	}
	if !reserveStorage(workspaceID, int64(len(fileBytes))) {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": "工作区存储空间不足"})
		return
	}
	storageReserved := true
	defer func() {
		if storageReserved {
			releaseStorage(workspaceID, int64(len(fileBytes)))
		}
	}()

	// 5. 存储文件
	storageDir := getStorageDir()
	if err := os.MkdirAll(storageDir, 0750); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建存储目录失败"})
		return
	}

	storedName := uuid.New().String() + "-" + sanitizeFileName(header.Filename)
	storagePath := filepath.Join(storageDir, storedName)
	if err := os.WriteFile(storagePath, fileBytes, 0640); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存源文件失败"})
		return
	}

	// 6. 若是图片，生成 320px 缩略图
	var thumbnailURL *string
	if assetType == "image" {
		thumbBytes, err := resizeImage(fileBytes, 320)
		if err == nil {
			thumbName := uuid.New().String() + "-thumb.jpg"
			thumbPath := filepath.Join(storageDir, thumbName)
			if err := os.WriteFile(thumbPath, thumbBytes, 0640); err == nil {
				url := "/api/files/" + thumbName
				thumbnailURL = &url
			}
		}
	}

	// 7. 构建元数据
	metaMap := map[string]any{
		"title":     header.Filename,
		"file_name": header.Filename,
		"mime_type": contentType,
		"size":      header.Size,
	}
	if thumbnailURL != nil {
		metaMap["thumbnail"] = map[string]any{
			"url":    *thumbnailURL,
			"width":  320,
			"format": "image/jpeg",
		}
	}
	metaBytes, _ := json.Marshal(metaMap)
	metaStr := string(metaBytes)

	fileURL := "/api/files/" + storedName
	asset := model.Asset{
		ID:           uuid.New(),
		WorkspaceID:  workspaceID,
		ProjectID:    projectID,
		CustomerID:   customerID,
		AssetType:    assetType,
		Source:       "upload",
		FileURL:      fileURL,
		ThumbnailURL: thumbnailURL,
		Metadata:     &metaStr,
		SizeBytes:    int64(len(fileBytes)),
		CreatedBy:    &actorID,
		CreatedAt:    time.Now(),
	}

	if err := database.DB.Create(&asset).Error; err != nil {
		_ = os.Remove(storagePath)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "资产记录保存失败: " + err.Error()})
		return
	}
	storageReserved = false

	c.JSON(http.StatusOK, asset)
}

// CreateAssetRequest 创建资产请求体
type CreateAssetRequest struct {
	WorkspaceID  uuid.UUID  `json:"workspace_id" binding:"required"`
	ProjectID    uuid.UUID  `json:"project_id" binding:"required"`
	CustomerID   *uuid.UUID `json:"customer_id"`
	AssetType    string     `json:"asset_type" binding:"required"`
	Source       string     `json:"source" binding:"required"`
	FileURL      string     `json:"file_url" binding:"required"`
	ThumbnailURL *string    `json:"thumbnail_url"`
	Metadata     *string    `json:"metadata"`
}

// ListAssets 获取素材资产列表 (GET /api/assets)
func ListAssets(c *gin.Context) {
	projectIDStr := c.Query("project_id")
	workspaceIDStr := c.Query("workspace_id")

	actorID := c.MustGet("user_id").(uuid.UUID)

	query := database.DB.Order("created_at desc")

	if projectIDStr != "" {
		projectID, err := uuid.Parse(projectIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "项目 ID 格式有误"})
			return
		}
		// 校验项目权限
		var project model.Project
		if err := database.DB.Where("id = ?", projectID).First(&project).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "项目不存在"})
			return
		}
		if !hasWorkspaceRole(project.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此素材"})
			return
		}
		query = query.Where("project_id = ?", projectID)
	} else if workspaceIDStr != "" {
		workspaceID, err := uuid.Parse(workspaceIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
			return
		}
		if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin", "member"}) {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看此素材"})
			return
		}
		query = query.Where("workspace_id = ?", workspaceID)
	} else {
		// 都不传时，默认查询当前用户参与的所有工作区的素材
		var memberWorkspaces []model.WorkspaceMember
		database.DB.Where("user_id = ? AND status = 'joined'", actorID).Find(&memberWorkspaces)
		var wsIDs []uuid.UUID
		for _, m := range memberWorkspaces {
			wsIDs = append(wsIDs, m.WorkspaceID)
		}
		if len(wsIDs) == 0 {
			c.JSON(http.StatusOK, []model.Asset{})
			return
		}
		query = query.Where("workspace_id IN ?", wsIDs)
	}

	var assets []model.Asset
	if err := query.Find(&assets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取素材列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, assets)
}

// CreateAsset 手动存盘资产记录 (POST /api/assets)
func CreateAsset(c *gin.Context) {
	var req CreateAssetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求参数不合法"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	// 校验工作区权限
	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限在此工作区上报资产"})
		return
	}
	if !requireProjectInWorkspace(c, req.ProjectID, req.WorkspaceID) || !requireCustomerInWorkspace(c, req.CustomerID, req.WorkspaceID) {
		return
	}

	asset := model.Asset{
		ID:           uuid.New(),
		WorkspaceID:  req.WorkspaceID,
		ProjectID:    req.ProjectID,
		CustomerID:   req.CustomerID,
		AssetType:    req.AssetType,
		Source:       req.Source,
		FileURL:      req.FileURL,
		ThumbnailURL: req.ThumbnailURL,
		Metadata:     req.Metadata,
		CreatedBy:    &actorID,
		CreatedAt:    time.Now(),
	}

	if err := database.DB.Create(&asset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存资产记录失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, asset)
}

// DeleteAsset 删除素材 (DELETE /assets/:id)
func DeleteAsset(c *gin.Context) {
	assetIDStr := c.Param("id")
	assetID, err := uuid.Parse(assetIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "资产 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var asset model.Asset
	if err := database.DB.Where("id = ?", assetID).First(&asset).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{
				"success":  true,
				"deleted":  false,
				"asset_id": assetID,
				"message":  "资产已不存在",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "查询资产失败: " + err.Error()})
		return
	}

	// 校验工作区权限
	if !hasWorkspaceRole(asset.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限删除此素材"})
		return
	}

	// 先删除数据库记录，再清理磁盘；数据库失败时不会留下指向已删除文件的记录。
	if err := database.DB.Delete(&asset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "数据库记录删除失败: " + err.Error()})
		return
	}

	storedName := strings.TrimPrefix(asset.FileURL, "/api/files/")
	if storedName != "" && !strings.Contains(storedName, "..") {
		_ = os.Remove(filepath.Join(getStorageDir(), storedName))
	}
	if asset.ThumbnailURL != nil {
		thumbName := strings.TrimPrefix(*asset.ThumbnailURL, "/api/files/")
		if thumbName != "" && !strings.ContainsAny(thumbName, `/\\`) && !strings.Contains(thumbName, "..") {
			_ = os.Remove(filepath.Join(getStorageDir(), thumbName))
		}
	}

	releaseStorage(asset.WorkspaceID, asset.SizeBytes)

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"deleted":  true,
		"asset_id": asset.ID,
		"message":  "资产删除完成",
	})
}

// ServeFile 静态文件伺服处理 (GET /api/files/:file_name)
func ServeFile(c *gin.Context) {
	fileName := c.Param("file_name")
	// 防穿透安全处理
	if strings.Contains(fileName, "..") || strings.Contains(fileName, "/") || strings.Contains(fileName, "\\") {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "非法请求"})
		return
	}

	filePath := filepath.Join(getStorageDir(), fileName)
	publicAssets := map[string]bool{
		"model_anime.png": true, "model_cg_car.png": true, "model_cyberpunk.png": true,
		"model_portrait.png": true, "ring_template_preview.png": true,
	}
	if publicAssets[fileName] {
		c.File(filePath)
		return
	}
	fileURL := "/api/files/" + fileName
	var asset model.Asset
	if err := database.DB.Where("file_url = ? OR thumbnail_url = ?", fileURL, fileURL).First(&asset).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "文件记录不存在"})
		return
	}
	if !canAccessStoredAsset(c, asset) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权访问该文件"})
		return
	}
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "文件不存在"})
		return
	}

	c.File(filePath)
}

func canAccessStoredAsset(c *gin.Context, asset model.Asset) bool {
	token := strings.TrimSpace(c.Query("access_token"))
	if token == "" {
		auth := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.HasPrefix(auth, "Bearer ") {
			token = strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
		}
	}
	if token != "" {
		if userID, err := ParseAccessToken(token); err == nil && hasWorkspaceRole(asset.WorkspaceID, userID, []string{"owner", "admin", "member"}) {
			return true
		}
	}

	shareToken := strings.TrimSpace(c.Query("share_token"))
	if shareToken == "" {
		return false
	}
	var count int64
	return database.DB.Model(&model.ProjectShare{}).
		Where("token = ? AND project_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)", shareToken, asset.ProjectID, time.Now()).
		Count(&count).Error == nil && count > 0
}

// 辅助方法: 通过 MIME 类型判定资产类型
func assetTypeFromMime(mime string) string {
	mime = strings.ToLower(mime)
	if strings.HasPrefix(mime, "image/") {
		return "image"
	}
	if strings.HasPrefix(mime, "video/") {
		return "video"
	}
	if strings.HasPrefix(mime, "audio/") {
		return "audio"
	}
	if strings.Contains(mime, "pdf") || strings.Contains(mime, "epub") || strings.Contains(mime, "word") {
		return "document"
	}
	return "text"
}

// 辅助方法: 清洗文件名防非法字符
func sanitizeFileName(filename string) string {
	return strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '.' || r == '-' || r == '_' {
			return r
		}
		return '_'
	}, filename)
}

// 辅助方法: 双线性插值图片缩放
func resizeImage(imgData []byte, width int) ([]byte, error) {
	src, _, err := image.Decode(bytes.NewReader(imgData))
	if err != nil {
		return nil, err
	}
	bounds := src.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	if srcW <= width {
		return imgData, nil
	}

	dstH := int(float64(srcH) * (float64(width) / float64(srcW)))
	dst := image.NewRGBA(image.Rect(0, 0, width, dstH))

	// 双线性过滤缩放图片
	draw.BiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)

	var out bytes.Buffer
	err = jpeg.Encode(&out, dst, &jpeg.Options{Quality: 80})
	if err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}
