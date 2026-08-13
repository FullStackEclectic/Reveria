package database

import (
	"fmt"
	"testing"

	"reveria/services/api/model"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestSeedPricingRulesInsertsMainGenerationTypesOnce(t *testing.T) {
	previous := DB
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	DB = db
	t.Cleanup(func() { DB = previous })
	if err := DB.AutoMigrate(&model.PricingRule{}); err != nil {
		t.Fatal(err)
	}

	SeedPricingRules()
	SeedPricingRules()

	want := map[string]int64{
		"text": 2, "image_generation": 10, "text_to_image": 10,
		"video_generation": 40, "image_to_video": 40,
		"image_inpainting": 5, "image_background_removal": 6, "image_upscale": 8,
	}
	for taskType, credits := range want {
		var count int64
		if err := DB.Model(&model.PricingRule{}).Where("task_type = ? AND enabled = ?", taskType, true).Count(&count).Error; err != nil {
			t.Fatal(err)
		}
		if count != 1 {
			t.Fatalf("%s 定价规则数 = %d, want 1", taskType, count)
		}
		var rule model.PricingRule
		if err := DB.Where("task_type = ?", taskType).First(&rule).Error; err != nil {
			t.Fatal(err)
		}
		if rule.MinCredits == nil || *rule.MinCredits != credits {
			t.Fatalf("%s 目录价 = %v, want %d", taskType, rule.MinCredits, credits)
		}
	}
}
