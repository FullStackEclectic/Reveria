package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"strconv"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func authLimitFromEnv(name string, fallback int) int {
	if raw := strings.TrimSpace(os.Getenv(name)); raw != "" {
		if value, err := strconv.Atoi(raw); err == nil && value > 0 {
			return value
		}
	}
	return fallback
}

func authThrottleKey(parts ...string) string {
	digest := sha256.Sum256([]byte(strings.Join(parts, "\x00")))
	return hex.EncodeToString(digest[:])
}

func consumeAuthAttempt(key string, limit int, window, block time.Duration) (bool, time.Duration, error) {
	now := time.Now()
	var retryAfter time.Duration
	err := database.DB.Transaction(func(tx *gorm.DB) error {
		var throttle model.AuthThrottle
		err := tx.Clauses(clause.Locking{Strength: clause.LockingStrengthUpdate}).Where("key = ?", key).First(&throttle).Error
		if err == gorm.ErrRecordNotFound {
			return tx.Create(&model.AuthThrottle{Key: key, AttemptCount: 1, WindowStartedAt: now, UpdatedAt: now}).Error
		}
		if err != nil {
			return err
		}
		if throttle.BlockedUntil != nil && throttle.BlockedUntil.After(now) {
			retryAfter = time.Until(*throttle.BlockedUntil)
			return nil
		}
		if now.Sub(throttle.WindowStartedAt) >= window {
			throttle.AttemptCount = 0
			throttle.WindowStartedAt = now
			throttle.BlockedUntil = nil
		}
		throttle.AttemptCount++
		throttle.UpdatedAt = now
		if throttle.AttemptCount > limit {
			blockedUntil := now.Add(block)
			throttle.BlockedUntil = &blockedUntil
			retryAfter = block
		}
		return tx.Save(&throttle).Error
	})
	return retryAfter == 0, retryAfter, err
}
