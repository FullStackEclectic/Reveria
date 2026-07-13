package service

import (
	"fmt"
	"testing"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestSettleCreditsReturnsUnusedFrozenBalance(t *testing.T) {
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.Workspace{}, &model.GenerationTask{}, &model.CreditTransaction{}); err != nil {
		t.Fatal(err)
	}

	workspace := model.Workspace{ID: uuid.New(), Name: "billing", GiftBalance: 88}
	userID := uuid.New()
	task := model.GenerationTask{
		ID: uuid.New(), WorkspaceID: workspace.ID, ProjectID: uuid.New(), UserID: &userID,
		TaskType: "text", Status: "settling", EstimatedCredits: 12,
		FrozenCredits: 12, FrozenGiftCredits: 12,
	}
	if err := db.Create(&workspace).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	service := NewStandaloneBilling()
	if err := service.SettleCredits(userID, workspace.ID, 2, "text settle", &task); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&workspace, "id = ?", workspace.ID).Error; err != nil {
		t.Fatal(err)
	}
	if workspace.GiftBalance != 98 {
		t.Fatalf("结算后赠送余额 = %d, want 98", workspace.GiftBalance)
	}
	if task.ActualCredits != 2 || task.FrozenCredits != 0 {
		t.Fatalf("任务结算字段异常: %#v", task)
	}
}
