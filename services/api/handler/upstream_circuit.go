package handler

import (
	"errors"
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const upstreamCircuitMessage = "上游网关欠费，生成已暂停。请站长在主站充值后，于系统设置中恢复生成。"

func recordUpstreamHTTPStatus(statusCode int) {
	if statusCode != http.StatusPaymentRequired {
		return
	}
	openUpstreamCircuit("上游网关返回 402")
}

func openUpstreamCircuit(reason string) {
	now := time.Now()
	_ = database.DB.Model(&model.ClientSettings{}).
		Where("upstream_circuit_opened_at IS NULL").
		Updates(map[string]any{
			"upstream_circuit_opened_at": now,
			"upstream_circuit_reason":    reason,
			"updated_at":                 now,
		}).Error
}

func clearUpstreamCircuit() {
	_ = database.DB.Model(&model.ClientSettings{}).
		Where("1 = 1").
		Updates(map[string]any{
			"upstream_circuit_opened_at": nil,
			"upstream_circuit_reason":    "",
			"updated_at":                 time.Now(),
		}).Error
}

func upstreamCircuitOpen() bool {
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err != nil {
		return false
	}
	return settings.UpstreamCircuitOpenedAt != nil
}

func rejectIfUpstreamCircuitOpen(c *gin.Context) bool {
	if !upstreamCircuitOpen() {
		return false
	}
	c.JSON(http.StatusPaymentRequired, gin.H{
		"success": false,
		"message": upstreamCircuitMessage,
		"code":    "UPSTREAM_CIRCUIT_OPEN",
	})
	return true
}

func failTaskFromUpstream(taskID uuid.UUID, statusCode int, errorCode, message string) {
	recordUpstreamHTTPStatus(statusCode)
	if statusCode == http.StatusPaymentRequired && message == "" {
		message = upstreamCircuitMessage
	}
	handleTaskFailure(taskID, errorCode, message)
}

func failTextTaskFromLLM(taskID uuid.UUID, err error) {
	statusCode := 0
	code := "UPSTREAM_LLM_FAILED"
	if errors.Is(err, errUpstreamPaymentRequired) {
		statusCode = http.StatusPaymentRequired
		code = "GATEWAY_402"
	}
	failTaskFromUpstream(taskID, statusCode, code, err.Error())
}
