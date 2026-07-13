package service

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BridgeBilling 桥接互通计费模式实现 (连接主站 12ZX-AI)
type BridgeBilling struct{}

func NewBridgeBilling() *BridgeBilling {
	return &BridgeBilling{}
}

// 汇率换算：1 credit = 5000 quota
const QuotaExchangeRate = 5000

// getBridgeConfig 获取桥接配置及用户Email
func (b *BridgeBilling) getBridgeConfig(userID uuid.UUID) (string, string, string, error) {
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err != nil {
		return "", "", "", fmt.Errorf("无法加载系统桥接配置: %v", err)
	}

	if settings.BridgeMainStationURL == "" {
		return "", "", "", errors.New("主站桥接 URL 未配置")
	}

	var user model.User
	if err := database.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return "", "", "", fmt.Errorf("未找到对应的本地用户: %v", err)
	}

	if user.Email == nil || *user.Email == "" {
		return "", "", "", errors.New("用户无绑定邮箱，无法桥接至主站")
	}

	return settings.BridgeMainStationURL, settings.BridgeInternalSecret, *user.Email, nil
}

// sendPostRequest 发送 POST 请求到主站
func (b *BridgeBilling) sendPostRequest(url, secret string, body interface{}) ([]byte, int, error) {
	jsonBytes, err := json.Marshal(body)
	if err != nil {
		return nil, 0, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, 0, err
	}

	req.Header.Set("Content-Type", "application/json")
	if secret != "" {
		req.Header.Set("X-Internal-Secret", secret)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, resp.StatusCode, err
	}

	return respBody, resp.StatusCode, nil
}

// GetBalance 从主站查询余额并换算
func (b *BridgeBilling) GetBalance(userID uuid.UUID, workspaceID uuid.UUID) (float64, error) {
	baseURL, secret, email, err := b.getBridgeConfig(userID)
	if err != nil {
		return 0, err
	}

	url := fmt.Sprintf("%s/api/internal/user/quota?email=%s", baseURL, email)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return 0, err
	}

	if secret != "" {
		req.Header.Set("X-Internal-Secret", secret)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("主站查询失败，HTTP 状态码: %d", resp.StatusCode)
	}

	var result struct {
		Success bool   `json:"success"`
		Quota   int64  `json:"quota"`
		Message string `json:"message"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}

	if !result.Success {
		return 0, fmt.Errorf("主站返回错误: %s", result.Message)
	}

	// 换算 quota -> credits (点数) 支持高精度浮点
	credits := float64(result.Quota) / float64(QuotaExchangeRate)
	return credits, nil
}

// DeductCredits 预扣减主站 Quota
func (b *BridgeBilling) DeductCredits(userID uuid.UUID, workspaceID uuid.UUID, amount int64, reason string, task *model.GenerationTask) (bool, error) {
	baseURL, secret, email, err := b.getBridgeConfig(userID)
	if err != nil {
		return false, err
	}

	quotaAmount := amount * QuotaExchangeRate
	url := fmt.Sprintf("%s/api/internal/user/deduct", baseURL)

	body := map[string]interface{}{
		"email": email,
		"quota": quotaAmount,
	}

	respBody, statusCode, err := b.sendPostRequest(url, secret, body)
	if err != nil {
		return false, err
	}

	if statusCode == http.StatusPaymentRequired {
		return false, nil // 余额不足
	}

	if statusCode != http.StatusOK {
		return false, fmt.Errorf("主站扣减失败，状态码: %d, 返回: %s", statusCode, string(respBody))
	}

	var result struct {
		Success bool `json:"success"`
	}
	if err := json.Unmarshal(respBody, &result); err != nil {
		return false, err
	}

	if result.Success && task != nil {
		// 桥接模式下也记录基本的 FrozenCredits，用于追踪任务点数
		task.FrozenCredits = amount
		task.FrozenGiftCredits = 0
		task.FrozenRefundCredits = 0
		task.FrozenRechargeCredits = 0
		if err := database.DB.Model(&model.GenerationTask{}).Where("id = ?", task.ID).Update("frozen_credits", amount).Error; err != nil {
			refundErr := b.RefundCredits(userID, workspaceID, amount, "本地冻结记录失败，自动退回主站额度", task)
			if refundErr != nil {
				return false, fmt.Errorf("保存本地冻结记录失败: %v；主站退款也失败: %w", err, refundErr)
			}
			return false, err
		}
	}

	return result.Success, nil
}

// RefundCredits 退还主站 Quota
func (b *BridgeBilling) RefundCredits(userID uuid.UUID, workspaceID uuid.UUID, amount int64, reason string, task *model.GenerationTask) error {
	baseURL, secret, email, err := b.getBridgeConfig(userID)
	if err != nil {
		return err
	}

	quotaAmount := amount * QuotaExchangeRate
	url := fmt.Sprintf("%s/api/internal/user/refund", baseURL)

	body := map[string]interface{}{
		"email": email,
		"quota": quotaAmount,
	}

	respBody, statusCode, err := b.sendPostRequest(url, secret, body)
	if err != nil {
		return err
	}

	if statusCode != http.StatusOK {
		return fmt.Errorf("主站退还失败，状态码: %d, 返回: %s", statusCode, string(respBody))
	}

	if task != nil {
		task.FrozenCredits = 0
		task.FrozenGiftCredits = 0
		task.FrozenRefundCredits = 0
		task.FrozenRechargeCredits = 0
		// 更新本地任务状态为释放
		database.DB.Save(task)
	}

	return nil
}

func (b *BridgeBilling) SettleCredits(userID uuid.UUID, workspaceID uuid.UUID, actualAmount int64, reason string, task *model.GenerationTask) error {
	if task == nil {
		return errors.New("任务结算缺少任务记录")
	}
	// 主站在预扣时已经完成额度扣减。桥接协议当前不支持原子差额结算，
	// 因此本地以预扣额作为最终消费，避免退款与再次扣款之间出现分布式不一致。
	task.ActualCredits = task.EstimatedCredits
	task.FrozenCredits = 0
	task.FrozenGiftCredits = 0
	task.FrozenRefundCredits = 0
	task.FrozenRechargeCredits = 0
	return database.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(task).Error; err != nil {
			return err
		}
		transaction := model.CreditTransaction{
			ID: uuid.New(), WorkspaceID: workspaceID, UserID: &userID,
			ProjectID: &task.ProjectID, TaskID: &task.ID, TransactionType: "consume",
			Amount: task.ActualCredits, BalanceAfter: 0, Reason: &reason, CreatedAt: time.Now(),
		}
		return tx.Create(&transaction).Error
	})
}
