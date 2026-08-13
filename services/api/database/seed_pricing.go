package database

import (
	"log"
	"time"

	"reveria/services/api/model"

	"github.com/google/uuid"
)

// SeedPricingRules 仅为尚无启用规则的任务类型写入目录价。
// 已有规则（含管理员改过的价格）不会被覆盖；resolveEstimatedCredits 仍禁止代码内默认价。
func SeedPricingRules() {
	type seed struct {
		name     string
		taskType string
		credits  int64
	}
	seeds := []seed{
		{name: "文本生成", taskType: "text", credits: 2},
		{name: "图像生成", taskType: "image_generation", credits: 10},
		{name: "文生图", taskType: "text_to_image", credits: 10},
		{name: "视频生成", taskType: "video_generation", credits: 40},
		{name: "图生视频", taskType: "image_to_video", credits: 40},
		{name: "智能消除", taskType: "image_inpainting", credits: 5},
		{name: "智能抠图", taskType: "image_background_removal", credits: 6},
		{name: "AI 变清晰", taskType: "image_upscale", credits: 8},
	}
	for _, item := range seeds {
		var count int64
		if err := DB.Model(&model.PricingRule{}).
			Where("task_type = ? AND enabled = ?", item.taskType, true).
			Count(&count).Error; err != nil {
			log.Printf("检查定价规则 %s 失败: %v", item.taskType, err)
			continue
		}
		if count > 0 {
			continue
		}
		taskType := item.taskType
		credits := item.credits
		rule := model.PricingRule{
			ID:         uuid.New(),
			Name:       item.name,
			TaskType:   &taskType,
			MinCredits: &credits,
			Enabled:    true,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}
		if err := DB.Create(&rule).Error; err != nil {
			log.Printf("写入定价规则 %s 失败: %v", item.taskType, err)
			continue
		}
		log.Printf("已写入默认定价规则：%s = %d 点（可在管理后台修改）", item.name, item.credits)
	}
}
