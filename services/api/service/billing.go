package service

import (
	"github.com/google/uuid"
	"reveria/services/api/model"
)

// BillingService 统一账务计费服务接口
type BillingService interface {
	// GetBalance 查询用户的积分余额 (返回总额度)
	GetBalance(userID uuid.UUID, workspaceID uuid.UUID) (float64, error)

	// DeductCredits 预扣减/冻结用户额度。返回 true 表示扣减成功
	DeductCredits(userID uuid.UUID, workspaceID uuid.UUID, amount int64, reason string, task *model.GenerationTask) (bool, error)

	// RefundCredits 释放或退还用户额度
	RefundCredits(userID uuid.UUID, workspaceID uuid.UUID, amount int64, reason string, task *model.GenerationTask) error

	// SettleCredits 将任务预冻结额度原子结转为实际消费，并退回未使用部分。
	SettleCredits(userID uuid.UUID, workspaceID uuid.UUID, actualAmount int64, reason string, task *model.GenerationTask) error
}

// GetBillingService 返回本地独立计费服务实例
func GetBillingService() BillingService {
	return NewStandaloneBilling()
}
