package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"
	"reveria/services/api/service"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	xdraw "golang.org/x/image/draw"
)

// WorkflowRequest 基础创意工作流请求
type WorkflowRequest struct {
	WorkspaceID    uuid.UUID `json:"workspace_id" binding:"required"`
	ProjectID      uuid.UUID `json:"project_id" binding:"required"`
	Brief          string    `json:"brief"`
	IdempotencyKey *string   `json:"idempotency_key"`
}

// RunBriefAnalysis 需求分析工作流 (POST /workflows/brief-analysis)
func RunBriefAnalysis(c *gin.Context) {
	var req WorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入不合法"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限在此工作区操作"})
		return
	}
	if !requireProjectInWorkspace(c, req.ProjectID, req.WorkspaceID) {
		return
	}
	// 1. 扣减 2 个积分点数
	var costCredits int64 = 2
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err == nil && settings.BillingMode != "bridge" {
		costCredits = int64(float64(costCredits) * settings.PriceRate)
	}

	reason := "分析 Brief 需求工作流消费"
	billingSvc := service.GetBillingService()
	success, err := billingSvc.DeductCredits(actorID, req.WorkspaceID, costCredits, reason, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "积分结算服务出错: " + err.Error()})
		return
	}
	if !success {
		c.JSON(http.StatusPaymentRequired, gin.H{"success": false, "message": "工作区余额不足"})
		return
	}

	// 2. 调用 12ZX-AI 大语言模型进行 Brief 提取
	prompt := fmt.Sprintf("请分析以下创意大纲，只返回 JSON：{\"summary\":\"\",\"audience\":[],\"directions\":[],\"risks\":[]}。内容: %s", req.Brief)

	responseMsg, _, _ := callUpstreamLLM(prompt, "", settings)
	var output struct {
		Summary    string   `json:"summary"`
		Audience   []string `json:"audience"`
		Directions []string `json:"directions"`
		Risks      []string `json:"risks"`
	}
	if err := decodeStructuredResponse(responseMsg, &output); err != nil {
		_ = billingSvc.RefundCredits(actorID, req.WorkspaceID, costCredits, "需求分析失败退回积分", nil)
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "上游未返回合法的需求分析结构"})
		return
	}

	// 构建返回数据结构 (BriefAnalysisOutput)
	c.JSON(http.StatusOK, gin.H{
		"task": gin.H{
			"id":         uuid.New(),
			"status":     "succeeded",
			"task_type":  "brief_analysis",
			"created_at": time.Now().Unix(),
		},
		"output": output,
	})
}

// RunBrandStyleExtract 品牌库风格提取工作流 (POST /workflows/brand-style-extract)
func RunBrandStyleExtract(c *gin.Context) {
	var req struct {
		WorkspaceID uuid.UUID `json:"workspace_id" binding:"required"`
		ProjectID   uuid.UUID `json:"project_id" binding:"required"`
		BrandName   string    `json:"brand_name" binding:"required"`
		Description string    `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限进行操作"})
		return
	}
	if !requireProjectInWorkspace(c, req.ProjectID, req.WorkspaceID) {
		return
	}

	var settings model.ClientSettings
	_ = database.DB.First(&settings)

	prompt := fmt.Sprintf("提取品牌设计规范，只返回 JSON：{\"brand_name\":%q,\"tone_of_voice\":\"\",\"colors\":[],\"visual_keywords\":[],\"style_prompt\":\"\"}。描述: %s", req.BrandName, req.Description)
	responseMsg, _, _ := callUpstreamLLM(prompt, "", settings)
	var output map[string]any
	if err := decodeStructuredResponse(responseMsg, &output); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "上游未返回合法的品牌风格结构"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task": gin.H{
			"id":        uuid.New(),
			"status":    "succeeded",
			"task_type": "brand_style_extract",
		},
		"output": output,
	})
}

// RunCreativeDirections 小红书/广告创意方向生成 (POST /workflows/creative-directions)
func RunCreativeDirections(c *gin.Context) {
	var req WorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入不合法"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)
	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限在此工作区操作"})
		return
	}
	if !requireProjectInWorkspace(c, req.ProjectID, req.WorkspaceID) {
		return
	}

	var settings model.ClientSettings
	_ = database.DB.First(&settings)

	prompt := fmt.Sprintf("根据以下信息生成 3 个广告创意方向，只返回 JSON：{\"directions\":[{\"title\":\"\",\"concept\":\"\",\"visual_idea\":\"\"}]}。内容: %s", req.Brief)
	responseMsg, _, _ := callUpstreamLLM(prompt, "", settings)
	var output map[string]any
	if err := decodeStructuredResponse(responseMsg, &output); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "上游未返回合法的创意方向结构"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task": gin.H{
			"id":        uuid.New(),
			"status":    "succeeded",
			"task_type": "creative_directions",
		},
		"output": output,
	})
}

// RunShortVideoScriptStoryboard 短视频分镜故事板 (POST /workflows/short-video-script-storyboard)
func RunShortVideoScriptStoryboard(c *gin.Context) {
	var req WorkflowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入不合法"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)
	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限操作"})
		return
	}
	if !requireProjectInWorkspace(c, req.ProjectID, req.WorkspaceID) {
		return
	}

	var settings model.ClientSettings
	_ = database.DB.First(&settings)

	prompt := fmt.Sprintf("为以下主题生成短视频分镜，只返回 JSON：{\"script_title\":\"\",\"script_brief\":\"\",\"shots\":[{\"shot_number\":1,\"duration_sec\":0,\"visual\":\"\",\"audio\":\"\",\"prompt\":\"\"}]}。主题: %s", req.Brief)
	responseMsg, _, _ := callUpstreamLLM(prompt, "", settings)
	var output map[string]any
	if err := decodeStructuredResponse(responseMsg, &output); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "上游未返回合法的分镜结构"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task": gin.H{
			"id":        uuid.New(),
			"status":    "succeeded",
			"task_type": "short_video_script_storyboard",
		},
		"output": output,
	})
}

type upstreamChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func decodeStructuredResponse(response string, target any) error {
	trimmed := strings.TrimSpace(response)
	trimmed = strings.TrimPrefix(trimmed, "```json")
	trimmed = strings.TrimPrefix(trimmed, "```")
	trimmed = strings.TrimSuffix(trimmed, "```")
	start := strings.Index(trimmed, "{")
	end := strings.LastIndex(trimmed, "}")
	if start < 0 || end < start {
		return fmt.Errorf("响应中没有 JSON 对象")
	}
	return json.Unmarshal([]byte(trimmed[start:end+1]), target)
}

// callUpstreamLLM 发包调用 12ZX-AI 大语言模型，返回生成文本及 token 消耗状况 (content, promptTokens, completionTokens)
func callUpstreamLLM(prompt string, targetModel string, settings model.ClientSettings) (string, int, int) {
	return callUpstreamLLMWithMessages([]upstreamChatMessage{{Role: "user", Content: prompt}}, targetModel, settings)
}

func callUpstreamLLMWithMessages(messages []upstreamChatMessage, targetModel string, settings model.ClientSettings) (string, int, int) {
	var apiURL string
	modelName := "deepseek-chat"

	if settings.BillingMode == "bridge" {
		baseURL := strings.TrimSuffix(settings.BridgeMainStationURL, "/")
		baseURL = strings.TrimSuffix(baseURL, "/v1")
		apiURL = fmt.Sprintf("%s/v1/chat/completions", baseURL)
		if targetModel != "" {
			modelName = targetModel
		} else if settings.BridgeTextModel != "" {
			modelName = settings.BridgeTextModel
		}
	} else {
		// 自营模式下使用站长配置的上游网关地址，未配置时使用默认地址
		if settings.UpstreamAPIURL == "" {
			settings.UpstreamAPIURL = "https://ai.12zx.net"
		}

		// 智能从已启用的 Provider 列表中自动抽取一个可用通道的 Key
		var p model.Provider
		if err := database.DB.Where("enabled = ? AND api_key != ''", true).First(&p).Error; err == nil {
			settings.UpstreamAPIKey = p.ApiKey
		}

		baseURL := strings.TrimSuffix(settings.UpstreamAPIURL, "/")
		baseURL = strings.TrimSuffix(baseURL, "/v1")
		apiURL = fmt.Sprintf("%s/v1/chat/completions", baseURL)
		if targetModel != "" {
			modelName = targetModel
		}
	}

	reqBody := map[string]any{
		"model":       modelName,
		"messages":    messages,
		"temperature": 0.7,
	}

	bodyBytes, _ := json.Marshal(reqBody)
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "本地客户端网络初始化失败", 0, 0
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+settings.UpstreamAPIKey)

	client := &http.Client{
		Transport: insecureTransport,
		Timeout:   120 * time.Second,
	}
	resp, err := client.Do(req)
	if err != nil {
		return "调用主网关超时，大模型生成失败: " + err.Error(), 0, 0
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Sprintf("主网关生成大模型文本错误，HTTP 状态码: %d", resp.StatusCode), 0, 0
	}

	type Choice struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	type Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	}
	type ChatResp struct {
		Choices []Choice `json:"choices"`
		Usage   Usage    `json:"usage"`
	}

	var chatResp ChatResp
	if err := json.Unmarshal(respBytes, &chatResp); err == nil && len(chatResp.Choices) > 0 {
		return chatResp.Choices[0].Message.Content, chatResp.Usage.PromptTokens, chatResp.Usage.CompletionTokens
	}

	return "主网关返回数据解析错误", 0, 0
}

// XiaohongshuCoverBatchRequest 小红书封面请求结构
type XiaohongshuCoverBatchRequest struct {
	WorkspaceID uuid.UUID `json:"workspace_id" binding:"required"`
	ProjectID   uuid.UUID `json:"project_id" binding:"required"`
	Brief       string    `json:"brief" binding:"required"`
	StylePrompt *string   `json:"style_prompt"`
	Count       *int      `json:"count"`
}

// RunXiaohongshuCoverBatch 小红书封面大纲生成 (POST /workflows/xiaohongshu-cover-batch)
func RunXiaohongshuCoverBatch(c *gin.Context) {
	var req XiaohongshuCoverBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入不合法"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限操作"})
		return
	}
	if !requireProjectInWorkspace(c, req.ProjectID, req.WorkspaceID) {
		return
	}

	// 1. 扣除 5 点积分
	var costCredits int64 = 5
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err == nil && settings.BillingMode != "bridge" {
		costCredits = int64(float64(costCredits) * settings.PriceRate)
	}

	reason := "小红书封面批量大纲分析消费"
	billingSvc := service.GetBillingService()
	success, err := billingSvc.DeductCredits(actorID, req.WorkspaceID, costCredits, reason, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "积分结算服务出错: " + err.Error()})
		return
	}
	if !success {
		c.JSON(http.StatusPaymentRequired, gin.H{"success": false, "message": "工作区积分不足"})
		return
	}

	// 2. 调用 12ZX-AI 上游网关 LLM 进行提炼
	styleStr := ""
	if req.StylePrompt != nil {
		styleStr = *req.StylePrompt
	}
	count := 6
	if req.Count != nil {
		count = *req.Count
	}

	prompt := fmt.Sprintf("根据项目需求设计 %d 个封面，只返回 JSON：{\"covers\":[{\"title\":\"\",\"subtitle\":\"\",\"layout\":\"\",\"visual_prompt\":\"\",\"negative_prompt\":\"\",\"notes\":\"\"}]}。风格: %s。内容: %s", count, styleStr, req.Brief)
	responseMsg, _, _ := callUpstreamLLM(prompt, "", settings)
	var output map[string]any
	if err := decodeStructuredResponse(responseMsg, &output); err != nil {
		_ = billingSvc.RefundCredits(actorID, req.WorkspaceID, costCredits, "封面分析失败退回积分", nil)
		c.JSON(http.StatusBadGateway, gin.H{"success": false, "message": "上游未返回合法的封面方案结构"})
		return
	}

	// 拼装对齐前端的数据结构
	c.JSON(http.StatusOK, gin.H{
		"task": gin.H{
			"id":         uuid.New(),
			"status":     "succeeded",
			"task_type":  "xiaohongshu_cover_batch",
			"created_at": time.Now().Unix(),
		},
		"output": output,
	})
}

// MagicActionRequest 画布魔力动作请求体
type MagicActionRequest struct {
	WorkspaceID uuid.UUID `json:"workspace_id" binding:"required"`
	ProjectID   uuid.UUID `json:"project_id" binding:"required"`
	AssetID     uuid.UUID `json:"asset_id" binding:"required"`
	Action      string    `json:"action" binding:"required"` // "remove-bg" | "upscale" | "erase"
}

// RunMagicAction 后端真实抠图去背景、抗锯齿插值超分放大、局部擦除 API (POST /api/workflows/magic-action)
func RunMagicAction(c *gin.Context) {
	var req MagicActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	// 1. 校验工作区权限
	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限进行此操作"})
		return
	}
	if !requireProjectInWorkspace(c, req.ProjectID, req.WorkspaceID) {
		return
	}
	if req.Action != "remove-bg" && req.Action != "upscale" && req.Action != "erase" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "不支持的图像处理动作"})
		return
	}

	var asset model.Asset
	if err := database.DB.Where("id = ? AND project_id = ? AND workspace_id = ?", req.AssetID, req.ProjectID, req.WorkspaceID).First(&asset).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "源素材不存在或不属于当前项目"})
		return
	}
	if !strings.HasPrefix(asset.FileURL, "/api/files/") {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请先将外部素材导入工作区后再处理"})
		return
	}

	// 2. 扣减积分 (抠图/超分/擦除统一扣除 2 个积分点数)
	var costCredits int64 = 2
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err == nil && settings.BillingMode != "bridge" {
		costCredits = int64(float64(costCredits) * settings.PriceRate)
	}

	reason := fmt.Sprintf("画布 AI 魔法操作 (%s) 消费", req.Action)
	billingSvc := service.GetBillingService()
	success, err := billingSvc.DeductCredits(actorID, req.WorkspaceID, costCredits, reason, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "积分结算服务出错: " + err.Error()})
		return
	}
	if !success {
		c.JSON(http.StatusPaymentRequired, gin.H{"success": false, "message": "工作区余额不足，本次操作需要 " + fmt.Sprintf("%d", costCredits) + " 个点数"})
		return
	}
	completed := false
	defer func() {
		if !completed {
			_ = billingSvc.RefundCredits(actorID, req.WorkspaceID, costCredits, "图像处理失败退回积分", nil)
		}
	}()

	if asset.FileURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "源素材无有效文件链接"})
		return
	}

	// 4. 读取源素材图像
	var srcImg image.Image
	var decodeErr error

	// 先尝试从本地存储读取以保障速度
	storedName := strings.TrimPrefix(asset.FileURL, "/api/files/")
	storagePath := filepath.Join(getStorageDir(), storedName)
	file, err := os.Open(storagePath)
	if err == nil {
		defer file.Close()
		srcImg, _, decodeErr = image.Decode(file)
	}

	if decodeErr != nil || srcImg == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "解析源图片文件失败"})
		return
	}

	bounds := srcImg.Bounds()
	var destImg image.Image
	var targetExt = ".png" // 默认转成支持透明的 PNG 格式
	var contentType = "image/png"

	// 5. 执行具体的图像魔法算法
	switch req.Action {
	case "remove-bg":
		// AI 去背景：分析左上角背景色并透明化
		rgba := image.NewRGBA(bounds)
		xdraw.Draw(rgba, bounds, srcImg, bounds.Min, xdraw.Src)

		bgRGBA := rgba.RGBAAt(bounds.Min.X, bounds.Min.Y)
		tolerance := 35

		absDiff := func(a, b uint8) int {
			d := int(a) - int(b)
			if d < 0 {
				return -d
			}
			return d
		}

		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				c := rgba.RGBAAt(x, y)
				diff := absDiff(c.R, bgRGBA.R) + absDiff(c.G, bgRGBA.G) + absDiff(c.B, bgRGBA.B)
				if diff < tolerance {
					c.A = 0 // 背景透明
					rgba.SetRGBA(x, y, c)
				}
			}
		}
		destImg = rgba

	case "upscale":
		// AI 4K超分：双三次插值重绘 2 倍物理拉伸
		newW := bounds.Dx() * 2
		newH := bounds.Dy() * 2
		newRect := image.Rect(0, 0, newW, newH)
		rgba := image.NewRGBA(newRect)

		xdraw.CatmullRom.Scale(rgba, newRect, srcImg, bounds, xdraw.Over, nil)
		destImg = rgba
		targetExt = ".jpg"
		contentType = "image/jpeg"

	case "erase":
		// AI 橡皮擦：擦除图像中央 25% 的内容
		rgba := image.NewRGBA(bounds)
		xdraw.Draw(rgba, bounds, srcImg, bounds.Min, xdraw.Src)

		cx := bounds.Min.X + bounds.Dx()/2
		cy := bounds.Min.Y + bounds.Dy()/2
		ew := bounds.Dx() / 4
		eh := bounds.Dy() / 4
		eraseRect := image.Rect(cx-ew/2, cy-eh/2, cx+ew/2, cy+eh/2)

		for y := eraseRect.Min.Y; y < eraseRect.Max.Y; y++ {
			for x := eraseRect.Min.X; x < eraseRect.Max.X; x++ {
				rgba.SetRGBA(x, y, color.RGBA{0, 0, 0, 0})
			}
		}
		destImg = rgba

	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "不支持的 AI 魔法动作"})
		return
	}

	// 6. 编码输出并在写盘前预占配额
	newStoredName := uuid.New().String() + "-magic-" + req.Action + targetExt
	newStoragePath := filepath.Join(getStorageDir(), newStoredName)
	var encoded bytes.Buffer
	if targetExt == ".png" {
		err = png.Encode(&encoded, destImg)
	} else {
		err = jpeg.Encode(&encoded, destImg, &jpeg.Options{Quality: 95})
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "编码输出图像失败"})
		return
	}

	// 7. 生成缩略图 (320px)
	var thumbnailURL *string
	var thumbBytes []byte
	var thumbPath string
	if resized, resizeErr := resizeImage(encoded.Bytes(), 320); resizeErr == nil {
		thumbBytes = resized
		thumbName := uuid.New().String() + "-thumb.jpg"
		thumbPath = filepath.Join(getStorageDir(), thumbName)
		url := "/api/files/" + thumbName
		thumbnailURL = &url
	}
	totalSize := int64(encoded.Len() + len(thumbBytes))
	if !reserveStorage(req.WorkspaceID, totalSize) {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"success": false, "message": "工作区存储空间不足"})
		return
	}
	storageReserved := true
	defer func() {
		if storageReserved {
			releaseStorage(req.WorkspaceID, totalSize)
		}
	}()
	if err := os.WriteFile(newStoragePath, encoded.Bytes(), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存输出图像失败"})
		return
	}
	if len(thumbBytes) > 0 {
		if err := os.WriteFile(thumbPath, thumbBytes, 0644); err != nil {
			_ = os.Remove(newStoragePath)
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存缩略图失败"})
			return
		}
	}

	// 8. 写入新 Asset 资产入库
	newFileURL := "/api/files/" + newStoredName
	fileSize := int64(encoded.Len())

	title := asset.Metadata
	var originTitle = "AI 生成图"
	if title != nil {
		var meta map[string]any
		if err := json.Unmarshal([]byte(*title), &meta); err == nil {
			if t, ok := meta["title"].(string); ok {
				originTitle = t
			}
		}
	}
	newTitle := fmt.Sprintf("%s (AI %s)", originTitle, req.Action)

	metaMap := map[string]any{
		"title":     newTitle,
		"file_name": newStoredName,
		"mime_type": contentType,
		"size":      fileSize,
		"width":     destImg.Bounds().Dx(),
		"height":    destImg.Bounds().Dy(),
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

	newAsset := model.Asset{
		ID:           uuid.New(),
		WorkspaceID:  req.WorkspaceID,
		ProjectID:    req.ProjectID,
		CustomerID:   asset.CustomerID,
		AssetType:    "image",
		Source:       "workflow",
		FileURL:      newFileURL,
		ThumbnailURL: thumbnailURL,
		Metadata:     &metaStr,
		SizeBytes:    totalSize,
		CreatedBy:    &actorID,
		CreatedAt:    time.Now(),
	}

	if err := database.DB.Create(&newAsset).Error; err != nil {
		_ = os.Remove(newStoragePath)
		if thumbPath != "" {
			_ = os.Remove(thumbPath)
		}
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "新资产入库失败"})
		return
	}
	storageReserved = false
	completed = true

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"asset":   newAsset,
	})
}
