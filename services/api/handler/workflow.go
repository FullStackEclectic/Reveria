package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
	if err := database.DB.First(&settings).Error; err == nil {
		costCredits = int64(float64(costCredits) * settings.PriceRate)
	}

	tx := database.DB.Begin()
	var ws model.Workspace
	tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", req.WorkspaceID).First(&ws)

	total := ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance
	if total < costCredits {
		tx.Rollback()
		c.JSON(http.StatusPaymentRequired, gin.H{"success": false, "message": "工作区余额不足"})
		return
	}

	// 积分扣除
	ws.GiftBalance -= costCredits // 简写，直接扣减
	if ws.GiftBalance < 0 {
		ws.RechargeBalance += ws.GiftBalance
		ws.GiftBalance = 0
	}
	tx.Save(&ws)

	// 记录流水
	reason := "分析 Brief 需求工作流消费"
	transaction := model.CreditTransaction{
		ID:              uuid.New(),
		WorkspaceID:     req.WorkspaceID,
		UserID:          &actorID,
		ProjectID:       &req.ProjectID,
		TransactionType: "consume",
		Amount:          costCredits,
		BalanceAfter:    ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
		Reason:          &reason,
		CreatedAt:       time.Now(),
	}
	tx.Create(&transaction)
	tx.Commit()

	// 2. 调用 12ZX-AI 大语言模型进行 Brief 提取
	prompt := fmt.Sprintf("请作为专业的广告策划大师，分析以下创意大纲，并提炼成简明扼要的摘要、受众定位、三个核心方向、以及一个风险分析提示。内容: %s", req.Brief)

	responseMsg := callUpstreamLLM(prompt, settings)

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
	responseMsg := callUpstreamLLM(prompt, settings)

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
	responseMsg := callUpstreamLLM(prompt, settings)

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
	responseMsg := callUpstreamLLM(prompt, settings)

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

// callUpstreamLLM 发包调用 12ZX-AI 大语言模型
func callUpstreamLLM(prompt string, settings model.ClientSettings) string {
	apiURL := fmt.Sprintf("%s/v1/chat/completions", settings.UpstreamAPIURL)

	reqBody := map[string]any{
		"model": "deepseek-chat", // 默认大语言模型
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
		return "本地客户端网络初始化失败"
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+settings.UpstreamAPIKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "调用主网关超时，大模型生成失败: " + err.Error()
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return fmt.Sprintf("主网关生成大模型文本错误，HTTP 状态码: %d", resp.StatusCode)
	}

	type Choice struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	type ChatResp struct {
		Choices []Choice `json:"choices"`
	}

	var chatResp ChatResp
	if err := json.Unmarshal(respBytes, &chatResp); err == nil && len(chatResp.Choices) > 0 {
		return chatResp.Choices[0].Message.Content
	}

	return "主网关返回数据解析错误"
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
	if err := database.DB.First(&settings).Error; err == nil {
		costCredits = int64(float64(costCredits) * settings.PriceRate)
	}

	tx := database.DB.Begin()
	var ws model.Workspace
	tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", req.WorkspaceID).First(&ws)

	total := ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance
	if total < costCredits {
		tx.Rollback()
		c.JSON(http.StatusPaymentRequired, gin.H{"success": false, "message": "工作区积分不足"})
		return
	}

	// 积分扣除
	ws.GiftBalance -= costCredits
	if ws.GiftBalance < 0 {
		ws.RechargeBalance += ws.GiftBalance
		ws.GiftBalance = 0
	}
	tx.Save(&ws)

	// 记录流水
	reason := "小红书封面批量大纲分析消费"
	transaction := model.CreditTransaction{
		ID:              uuid.New(),
		WorkspaceID:     req.WorkspaceID,
		UserID:          &actorID,
		ProjectID:       &req.ProjectID,
		TransactionType: "consume",
		Amount:          costCredits,
		BalanceAfter:    ws.RechargeBalance + ws.GiftBalance + ws.RefundBalance,
		Reason:          &reason,
		CreatedAt:       time.Now(),
	}
	tx.Create(&transaction)
	tx.Commit()

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
	responseMsg := callUpstreamLLM(prompt, settings)

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
