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
	if claimed.Status != "settling" || claimed.WorkerID != nil || claimed.LeaseUntil != nil {
		t.Fatalf("结算抢占后租约未清理: %#v", claimed)
	}
}
