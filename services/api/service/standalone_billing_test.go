package service

import (
	"fmt"
	"strings"
	"testing"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
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
	if err := db.AutoMigrate(&model.Workspace{}, &model.Project{}, &model.GenerationTask{}, &model.CreditTransaction{}); err != nil {
		t.Fatal(err)
	}

	workspace := model.Workspace{ID: uuid.New(), Name: "billing", GiftBalance: 88}
	userID := uuid.New()
	project := model.Project{ID: uuid.New(), WorkspaceID: workspace.ID, Name: "billing project"}
	task := model.GenerationTask{
		ID: uuid.New(), WorkspaceID: workspace.ID, ProjectID: project.ID, UserID: &userID,
		TaskType: "text", Status: "settling", EstimatedCredits: 12,
		FrozenCredits: 12, FrozenGiftCredits: 12,
	}
	if err := db.Create(&workspace).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&project).Error; err != nil {
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
	if err := db.First(&project, "id = ?", project.ID).Error; err != nil {
		t.Fatal(err)
	}
	if project.ConsumedCredits != 2 {
		t.Fatalf("项目累计消耗 = %d, want 2", project.ConsumedCredits)
	}
}

func TestSettleCreditsIsIdempotent(t *testing.T) {
	db, userID, workspace, project, task := setupBillingFixture(t, 12)
	service := NewStandaloneBilling()
	if err := service.SettleCredits(userID, workspace.ID, 2, "first", &task); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&workspace, "id = ?", workspace.ID).Error; err != nil {
		t.Fatal(err)
	}
	if err := service.SettleCredits(userID, workspace.ID, 2, "second", &task); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&workspace, "id = ?", workspace.ID).Error; err != nil {
		t.Fatal(err)
	}
	if workspace.GiftBalance != 98 {
		t.Fatalf("重复结算后赠送余额 = %d, want 98", workspace.GiftBalance)
	}
	if err := db.First(&project, "id = ?", project.ID).Error; err != nil {
		t.Fatal(err)
	}
	if project.ConsumedCredits != 2 {
		t.Fatalf("重复结算后项目累计消耗 = %d, want 2", project.ConsumedCredits)
	}
	var consumeCount int64
	if err := db.Model(&model.CreditTransaction{}).Where("task_id = ? AND transaction_type = ?", task.ID, "consume").Count(&consumeCount).Error; err != nil {
		t.Fatal(err)
	}
	if consumeCount != 1 {
		t.Fatalf("consume 流水数 = %d, want 1", consumeCount)
	}
}

func TestRefundCreditsIsIdempotentAndRejectsAfterSettle(t *testing.T) {
	_, userID, workspace, _, task := setupBillingFixture(t, 12)
	billing := NewStandaloneBilling()
	if err := billing.RefundCredits(userID, workspace.ID, 12, "first", &task); err != nil {
		t.Fatal(err)
	}
	if err := billing.RefundCredits(userID, workspace.ID, 12, "second", &task); err != nil {
		t.Fatal(err)
	}

	_, userID2, workspace2, _, settled := setupBillingFixture(t, 12)
	if err := billing.SettleCredits(userID2, workspace2.ID, 2, "settle", &settled); err != nil {
		t.Fatal(err)
	}
	if err := billing.RefundCredits(userID2, workspace2.ID, 12, "after settle", &settled); err != ErrAlreadySettled {
		t.Fatalf("已结算任务退款应返回 ErrAlreadySettled，实际 %v", err)
	}
}

func setupBillingFixture(t *testing.T, frozen int64) (*gorm.DB, uuid.UUID, model.Workspace, model.Project, model.GenerationTask) {
	t.Helper()
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.Workspace{}, &model.Project{}, &model.GenerationTask{}, &model.CreditTransaction{}); err != nil {
		t.Fatal(err)
	}

	workspace := model.Workspace{ID: uuid.New(), Name: "billing", GiftBalance: 88}
	userID := uuid.New()
	project := model.Project{ID: uuid.New(), WorkspaceID: workspace.ID, Name: "billing project"}
	task := model.GenerationTask{
		ID: uuid.New(), WorkspaceID: workspace.ID, ProjectID: project.ID, UserID: &userID,
		TaskType: "text", Status: "settling", EstimatedCredits: frozen,
		FrozenCredits: frozen, FrozenGiftCredits: frozen,
	}
	if err := db.Create(&workspace).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&project).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	return db, userID, workspace, project, task
}

func TestForUpdateSvcUsesPostgresRowLock(t *testing.T) {
	previousSQLite := database.IsSQLite
	database.IsSQLite = false
	t.Cleanup(func() { database.IsSQLite = previousSQLite })

	db, err := gorm.Open(postgres.Open("host=127.0.0.1 user=test dbname=test sslmode=disable"), &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	statement := forUpdateSvc(db).Where("id = ?", uuid.New()).Find(&model.Workspace{}).Statement.SQL.String()
	if statement == "" || !strings.Contains(statement, "FOR UPDATE") {
		t.Fatalf("Postgres 行锁 SQL 未生成 FOR UPDATE: %q", statement)
	}
}
