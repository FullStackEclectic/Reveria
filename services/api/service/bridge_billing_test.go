package service

import (
	"testing"

	"reveria/services/api/model"

	"github.com/google/uuid"
)

func TestBridgeOperationIDIsStableForTask(t *testing.T) {
	task := &model.GenerationTask{ID: uuid.New()}
	first := bridgeOperationID(task, "deduct")
	second := bridgeOperationID(task, "deduct")
	if first != second {
		t.Fatalf("同一任务的幂等操作标识不稳定: %q != %q", first, second)
	}
	if first == bridgeOperationID(task, "refund") {
		t.Fatal("扣费与退款不能复用同一个幂等操作标识")
	}
}

func TestBridgeOperationIDIsUniqueForAdhocOperation(t *testing.T) {
	if bridgeOperationID(nil, "refund") == bridgeOperationID(nil, "refund") {
		t.Fatal("非任务操作必须生成唯一操作标识")
	}
}
