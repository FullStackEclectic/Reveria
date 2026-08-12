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

func TestEnsureDefaultPlansDoesNotDeleteCustomPlans(t *testing.T) {
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.Plan{}); err != nil {
		t.Fatal(err)
	}

	custom := model.Plan{ID: uuid.New(), Name: "工作室自建套餐", PriceCents: 1234, Enabled: true}
	if err := db.Create(&custom).Error; err != nil {
		t.Fatal(err)
	}
	ensureDefaultPlans()

	var count int64
	if err := db.Model(&model.Plan{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count < 2 {
		t.Fatalf("套餐数量过少: %d", count)
	}
	var kept model.Plan
	if err := db.Where("id = ?", custom.ID).First(&kept).Error; err != nil {
		t.Fatal("自定义套餐被删除")
	}
	if kept.PriceCents != 1234 {
		t.Fatalf("自定义套餐价格被覆盖: %d", kept.PriceCents)
	}
}
