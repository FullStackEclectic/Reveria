package handler

import (
	"fmt"
	"testing"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestResolveEstimatedCreditsUsesConfiguredPricing(t *testing.T) {
	previousDB := database.DB
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })
	if err := db.AutoMigrate(&model.PricingRule{}, &model.Model{}); err != nil {
		t.Fatal(err)
	}

	taskType := "image_generation"
	modelID := "configured-image-model"
	genericPrice, exactPrice := int64(8), int64(13)
	rules := []model.PricingRule{
		{ID: uuid.New(), Name: "generic", TaskType: &taskType, MinCredits: &genericPrice, Enabled: true},
		{ID: uuid.New(), Name: "exact", TaskType: &taskType, ModelID: &modelID, MinCredits: &exactPrice, Enabled: true},
	}
	if err := db.Create(&rules).Error; err != nil {
		t.Fatal(err)
	}

	credits, err := resolveEstimatedCredits(taskType, modelID)
	if err != nil {
		t.Fatal(err)
	}
	if credits != exactPrice {
		t.Fatalf("模型精确定价 = %d, want %d", credits, exactPrice)
	}
}

func TestResolveEstimatedCreditsRejectsMissingPricing(t *testing.T) {
	previousDB := database.DB
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })
	if err := db.AutoMigrate(&model.PricingRule{}, &model.Model{}); err != nil {
		t.Fatal(err)
	}
	if _, err := resolveEstimatedCredits("video_generation", "missing-model"); err == nil {
		t.Fatal("缺少价格配置时不应返回代码内默认价格")
	}
}

func TestResolveEstimatedCreditsInpaintingUsesGenericRule(t *testing.T) {
	previousDB := database.DB
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })
	if err := db.AutoMigrate(&model.PricingRule{}, &model.Model{}); err != nil {
		t.Fatal(err)
	}

	taskType := "image_inpainting"
	price := int64(5)
	rule := model.PricingRule{
		ID: uuid.New(), Name: "inpainting-generic", TaskType: &taskType, MinCredits: &price, Enabled: true,
	}
	if err := db.Create(&rule).Error; err != nil {
		t.Fatal(err)
	}

	// image_inpainting 不需要选择模型，以空字符串调用
	credits, err := resolveEstimatedCredits(taskType, "")
	if err != nil {
		t.Fatal(err)
	}
	if credits != price {
		t.Fatalf("inpainting 通用定价 = %d, want %d", credits, price)
	}
}

func TestResolveEstimatedCreditsInpaintingRejectsMissingPricing(t *testing.T) {
	previousDB := database.DB
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })
	if err := db.AutoMigrate(&model.PricingRule{}, &model.Model{}); err != nil {
		t.Fatal(err)
	}
	if _, err := resolveEstimatedCredits("image_inpainting", ""); err == nil {
		t.Fatal("image_inpainting 缺少价格配置时不应返回代码内默认价格")
	}
}

func TestResolveEstimatedCreditsBackgroundRemovalUsesGenericRule(t *testing.T) {
	previousDB := database.DB
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB = db
	t.Cleanup(func() { database.DB = previousDB })
	if err := db.AutoMigrate(&model.PricingRule{}, &model.Model{}); err != nil {
		t.Fatal(err)
	}
	taskType := "image_background_removal"
	price := int64(6)
	if err := db.Create(&model.PricingRule{
		ID: uuid.New(), Name: "background-removal", TaskType: &taskType, MinCredits: &price, Enabled: true,
	}).Error; err != nil {
		t.Fatal(err)
	}
	credits, err := resolveEstimatedCredits(taskType, "")
	if err != nil {
		t.Fatal(err)
	}
	if credits != price {
		t.Fatalf("background removal 通用定价 = %d, want %d", credits, price)
	}
}
