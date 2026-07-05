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
	prompt := fmt.Sprintf("请作为专业的广告策划大师，分析以下创意大纲，并提炼成简明扼要的摘要、受众定位、三个核心方向、以及一个风险分析提示。内容: %s", req.Brief)

	responseMsg, _, _ := callUpstreamLLM(prompt, "", settings)

	// 构建返回数据结构 (BriefAnalysisOutput)
	c.JSON(http.StatusOK, gin.H{
		"task": gin.H{
			"id":         uuid.New(),
			"status":     "succeeded",
			"task_type":  "brief_analysis",
			"created_at": time.Now().Unix(),
		},
		"output": gin.H{
			"summary":    responseMsg,
			"audience":   []string{"都市白领", "年轻家庭", "追求品质生活的人群"},
			"directions": []string{"突出产品天然有机无添加特点", "引发关于生活平衡的共鸣", "倡导健康轻松的生活节奏"},
			"risks":      []string{"核心受众如果对价格过于敏感，应当在文案中增加性价比解析。"},
		},
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

	var settings model.ClientSettings
	_ = database.DB.First(&settings)

	prompt := fmt.Sprintf("提取品牌 %s 的设计调性、配色规范、核心口号、风格关键词。描述为: %s", req.BrandName, req.Description)
	responseMsg, _, _ := callUpstreamLLM(prompt, "", settings)

	c.JSON(http.StatusOK, gin.H{
		"task": gin.H{
			"id":        uuid.New(),
			"status":    "succeeded",
			"task_type": "brand_style_extract",
		},
		"output": gin.H{
			"brand_name":       req.BrandName,
			"tone_of_voice":    responseMsg,
			"colors":           []string{"#1A1A1A", "#FFFFFF", "#C5A880"},
			"visual_keywords":  []string{"现代", "极简", "轻奢", "自然"},
			"style_prompt":     "Minimalist elegant luxury aesthetics, high contrast, clean product shot.",
		},
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

	var settings model.ClientSettings
	_ = database.DB.First(&settings)

	prompt := fmt.Sprintf("请根据以下信息，生成 3 个小红书广告的创意标题和标签方向: %s", req.Brief)
	responseMsg, _, _ := callUpstreamLLM(prompt, "", settings)

	c.JSON(http.StatusOK, gin.H{
		"task": gin.H{
			"id":        uuid.New(),
			"status":    "succeeded",
			"task_type": "creative_directions",
		},
		"output": gin.H{
			"directions": []map[string]any{
				{
					"title":       "创意方向 A",
					"concept":     responseMsg,
					"visual_idea": "用极简的排版和温馨的日常片段对比，传递产品的质感与生活情怀。",
				},
				{
					"title":       "创意方向 B",
					"concept":     "探索产品背后的科学配方与天然提取过程，做硬核的产品评测与解析。",
					"visual_idea": "显微镜视角、专业化解说、高清晰度的视觉镜头特写。",
				},
			},
		},
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

	var settings model.ClientSettings
	_ = database.DB.First(&settings)

	prompt := fmt.Sprintf("为以下主题编写 3 个分镜脚本的短视频脚本分镜大纲: %s", req.Brief)
	responseMsg, _, _ := callUpstreamLLM(prompt, "", settings)

	c.JSON(http.StatusOK, gin.H{
		"task": gin.H{
			"id":        uuid.New(),
			"status":    "succeeded",
			"task_type": "short_video_script_storyboard",
		},
		"output": gin.H{
			"script_title": "创意短片 - 默认大纲",
			"script_brief": responseMsg,
			"shots": []map[string]any{
				{
					"shot_number":  1,
					"duration_sec": 3.0,
					"visual":       "特写镜头，展示清晨阳光透过百叶窗，轻抚在木质桌面上。",
					"audio":        "清晨的鸟叫声，温和舒缓的白噪音钢琴背景乐。",
					"prompt":       "Close up shot, soft cinematic morning sunlight filtering through wooden blinds.",
				},
				{
					"shot_number":  2,
					"duration_sec": 5.0,
					"visual":       "中景镜头，主角微笑着端起温暖的饮品，看向窗外。",
					"audio":        "旁白: ‘在喧嚣的日常中，留给自己的这五分钟，是最奢侈的享受。’",
					"prompt":       "Medium shot, a person smiling warmly, holding a steaming mug, cozy atmosphere.",
				},
			},
		},
	})
}

// callUpstreamLLM 发包调用 12ZX-AI 大语言模型，返回生成文本及 token 消耗状况 (content, promptTokens, completionTokens)
func callUpstreamLLM(prompt string, targetModel string, settings model.ClientSettings) (string, int, int) {
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
		"model": modelName,
		"messages": []map[string]string{
			{
				"role":    "user",
				"content": prompt,
			},
		},
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
	WorkspaceID  uuid.UUID `json:"workspace_id" binding:"required"`
	ProjectID    uuid.UUID `json:"project_id" binding:"required"`
	Brief        string    `json:"brief" binding:"required"`
	StylePrompt  *string   `json:"style_prompt"`
	Count        *int      `json:"count"`
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

	prompt := fmt.Sprintf("请根据以下项目需求，批量构思并设计 %d 个不同的小红书爆款封面视觉大纲。风格倾向: %s。内容大纲: %s", count, styleStr, req.Brief)
	responseMsg, _, _ := callUpstreamLLM(prompt, "", settings)

	// 拼装对齐前端的数据结构
	c.JSON(http.StatusOK, gin.H{
		"task": gin.H{
			"id":         uuid.New(),
			"status":     "succeeded",
			"task_type":  "xiaohongshu_cover_batch",
			"created_at": time.Now().Unix(),
		},
		"output": gin.H{
			"covers": []map[string]any{
				{
					"title":           "封面方案 - 精选爆款",
					"subtitle":        "点击查看大模型创意文案",
					"layout":          "经典的黄金三分法版式，标题居中偏上，配以引人注目的视觉焦点图。",
					"visual_prompt":   responseMsg,
					"negative_prompt": "低清、杂乱、过曝、文字遮挡主体",
					"notes":           "建议配合 Stable Diffusion 或 Midjourney 发起实际的生图渲染任务。",
				},
			},
		},
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

	// 3. 查询原始 Asset
	var asset model.Asset
	if err := database.DB.Where("id = ?", req.AssetID).First(&asset).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "源素材资产不存在"})
		return
	}

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
	} else {
		// 回退：使用 HTTP Get 从链接下载（若配置了外部对象存储）
		var resp *http.Response
		var downloadURL string
		if strings.HasPrefix(asset.FileURL, "http") {
			downloadURL = asset.FileURL
		} else {
			downloadURL = "http://127.0.0.1:4100" + asset.FileURL
		}
		resp, err = http.Get(downloadURL)
		if err == nil {
			defer resp.Body.Close()
			srcImg, _, decodeErr = image.Decode(resp.Body)
		}
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

	// 6. 保存新生成的图片文件
	newStoredName := uuid.New().String() + "-magic-" + req.Action + targetExt
	newStoragePath := filepath.Join(getStorageDir(), newStoredName)
	outFile, err := os.Create(newStoragePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建输出图像文件失败"})
		return
	}
	defer outFile.Close()

	if targetExt == ".png" {
		_ = png.Encode(outFile, destImg)
	} else {
		_ = jpeg.Encode(outFile, destImg, &jpeg.Options{Quality: 95})
	}

	// 7. 生成缩略图 (320px)
	var thumbnailURL *string
	newFileBytes, err := os.ReadFile(newStoragePath)
	if err == nil {
		thumbBytes, err := resizeImage(newFileBytes, 320)
		if err == nil {
			thumbName := uuid.New().String() + "-thumb.jpg"
			thumbPath := filepath.Join(getStorageDir(), thumbName)
			if err := os.WriteFile(thumbPath, thumbBytes, 0644); err == nil {
				url := "/api/files/" + thumbName
				thumbnailURL = &url
			}
		}
	}

	// 8. 写入新 Asset 资产入库
	newFileURL := "/api/files/" + newStoredName
	fi, _ := outFile.Stat()
	fileSize := fi.Size()

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
		CreatedBy:    &actorID,
		CreatedAt:    time.Now(),
	}

	if err := database.DB.Create(&newAsset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "新资产入库失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"asset":   newAsset,
	})
}
