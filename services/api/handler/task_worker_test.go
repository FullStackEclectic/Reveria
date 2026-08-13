package handler

import (
	"fmt"
	"testing"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestTaskLeaseCanOnlyBeRenewedByOwner(t *testing.T) {
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.GenerationTask{}); err != nil {
		t.Fatal(err)
	}

	projectID, workspaceID, userID := uuid.New(), uuid.New(), uuid.New()
	owner := taskWorkerID
	expired := time.Now().Add(-time.Minute)
	task := model.GenerationTask{
		ID: uuid.New(), WorkspaceID: workspaceID, ProjectID: projectID, UserID: &userID,
		TaskType: "image_generation", InputPayload: `{}`, Status: "running",
		WorkerID: &owner, LeaseUntil: &expired,
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	if !renewTaskLease(task.ID) {
		t.Fatal("当前 Worker 无法续租自己的任务")
	}
	if err := db.First(&task, "id = ?", task.ID).Error; err != nil {
		t.Fatal(err)
	}
	if task.LeaseUntil == nil || !task.LeaseUntil.After(time.Now()) {
		t.Fatalf("任务租约未续期: %#v", task.LeaseUntil)
	}

	other := "another-worker"
	if err := db.Model(&task).Update("worker_id", other).Error; err != nil {
		t.Fatal(err)
	}
	if renewTaskLease(task.ID) {
		t.Fatal("非任务所有者不应能够续租")
	}
}

func TestSettlementClaimClearsWorkerLease(t *testing.T) {
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.GenerationTask{}); err != nil {
		t.Fatal(err)
	}

	worker := taskWorkerID
	lease := time.Now().Add(time.Minute)
	task := model.GenerationTask{
		ID: uuid.New(), WorkspaceID: uuid.New(), ProjectID: uuid.New(),
		TaskType: "text", InputPayload: `{}`, Status: "running",
		WorkerID: &worker, LeaseUntil: &lease,
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	claimed, ok := claimTaskForSettlement(task.ID)
	if !ok {
		t.Fatal("无法抢占任务进行结算")
	}
	if claimed.Status != "settling" || claimed.WorkerID == nil || claimed.LeaseUntil == nil {
		t.Fatalf("结算抢占后应持有租约: %#v", claimed)
	}
	if *claimed.WorkerID != taskWorkerID || !claimed.LeaseUntil.After(time.Now()) {
		t.Fatalf("结算租约不正确: worker=%v lease=%v", claimed.WorkerID, claimed.LeaseUntil)
	}
}

func TestRetrySettlingTaskKeepsAssetsWhenAlreadyCharged(t *testing.T) {
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.GenerationTask{}, &model.Asset{}, &model.CreditTransaction{}, &model.Workspace{}); err != nil {
		t.Fatal(err)
	}

	userID := uuid.New()
	task := model.GenerationTask{
		ID: uuid.New(), WorkspaceID: uuid.New(), ProjectID: uuid.New(), UserID: &userID,
		TaskType: "image_generation", InputPayload: `{}`, Status: "settling", FrozenCredits: 0,
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	asset := model.Asset{
		ID: uuid.New(), WorkspaceID: task.WorkspaceID, ProjectID: task.ProjectID,
		TaskID: &task.ID, FileURL: "/api/files/demo.jpg", AssetType: "image", Source: "generated",
	}
	if err := db.Create(&asset).Error; err != nil {
		t.Fatal(err)
	}

	retrySettlingTask(task)
	if err := db.First(&task, "id = ?", task.ID).Error; err != nil {
		t.Fatal(err)
	}
	if task.Status != "succeeded" {
		t.Fatalf("已落盘且已扣费的 settling 任务应标为 succeeded，实际 %s", task.Status)
	}
	var assetCount int64
	if err := db.Model(&model.Asset{}).Where("task_id = ?", task.ID).Count(&assetCount).Error; err != nil {
		t.Fatal(err)
	}
	if assetCount != 1 {
		t.Fatalf("成片不应被删除，实际 %d", assetCount)
	}
}

func TestMarkTaskRunningIgnoresCancelled(t *testing.T) {
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.GenerationTask{}); err != nil {
		t.Fatal(err)
	}

	task := model.GenerationTask{
		ID: uuid.New(), WorkspaceID: uuid.New(), ProjectID: uuid.New(),
		TaskType: "image_generation", InputPayload: `{}`, Status: "cancelled",
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	if markTaskRunning(task.ID, `{"progress_text":"x"}`) {
		t.Fatal("已取消任务不应被改回 running")
	}
	if err := db.First(&task, "id = ?", task.ID).Error; err != nil {
		t.Fatal(err)
	}
	if task.Status != "cancelled" {
		t.Fatalf("状态被改写为 %s", task.Status)
	}
}

func TestRecoverStaleSettlementsSkipsLeasedTask(t *testing.T) {
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.GenerationTask{}, &model.Asset{}, &model.CreditTransaction{}); err != nil {
		t.Fatal(err)
	}

	userID := uuid.New()
	lease := time.Now().Add(time.Minute)
	worker := taskWorkerID
	task := model.GenerationTask{
		ID: uuid.New(), WorkspaceID: uuid.New(), ProjectID: uuid.New(), UserID: &userID,
		TaskType: "image_generation", InputPayload: `{}`, Status: "settling",
		FrozenCredits: 12, FrozenGiftCredits: 12, EstimatedCredits: 12,
		WorkerID: &worker, LeaseUntil: &lease,
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatal(err)
	}

	recoverStaleSettlements()
	if err := db.First(&task, "id = ?", task.ID).Error; err != nil {
		t.Fatal(err)
	}
	if task.Status != "settling" || task.FrozenCredits != 12 {
		t.Fatalf("仍在下载的 settling 任务不应被恢复: %#v", task)
	}
}

func TestFailTextTaskFromLLMRefundsOn402(t *testing.T) {
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.GenerationTask{}, &model.Workspace{}, &model.CreditTransaction{}, &model.ClientSettings{}); err != nil {
		t.Fatal(err)
	}

	workspace := model.Workspace{ID: uuid.New(), Name: "ws", GiftBalance: 0}
	userID := uuid.New()
	task := model.GenerationTask{
		ID: uuid.New(), WorkspaceID: workspace.ID, ProjectID: uuid.New(), UserID: &userID,
		TaskType: "text", InputPayload: `{}`, Status: "running",
		FrozenCredits: 2, FrozenGiftCredits: 2, EstimatedCredits: 2,
	}
	settings := model.ClientSettings{ID: uuid.New(), SiteTitle: "t", UpstreamAPIURL: "http://example.invalid", PriceRate: 1}
	if err := db.Create(&workspace).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&task).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&settings).Error; err != nil {
		t.Fatal(err)
	}

	failTextTaskFromLLM(task.ID, fmt.Errorf("%w: HTTP 402", errUpstreamPaymentRequired))
	if err := db.First(&task, "id = ?", task.ID).Error; err != nil {
		t.Fatal(err)
	}
	if task.Status != "failed" {
		t.Fatalf("文本 402 应失败退款，实际 %s", task.Status)
	}
	if task.FrozenCredits != 0 {
		t.Fatalf("冻结积分应为 0，实际 %d", task.FrozenCredits)
	}
	if err := db.First(&workspace, "id = ?", workspace.ID).Error; err != nil {
		t.Fatal(err)
	}
	if workspace.GiftBalance != 2 {
		t.Fatalf("退款后赠送余额 = %d, want 2", workspace.GiftBalance)
	}
	if !upstreamCircuitOpen() {
		t.Fatal("文本 402 应打开全站熔断")
	}
}
