package handler

import (
	"testing"
	"time"

	"reveria/services/api/model"
)

func TestConsumeAuthAttemptBlocksAfterConfiguredLimit(t *testing.T) {
	db := useAuthSessionTestDB(t)
	if err := db.AutoMigrate(&model.AuthThrottle{}); err != nil {
		t.Fatal(err)
	}
	key := authThrottleKey("login", "127.0.0.1", "user@example.com")
	for attempt := 1; attempt <= 2; attempt++ {
		allowed, _, err := consumeAuthAttempt(key, 2, time.Minute, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		if !allowed {
			t.Fatalf("第 %d 次请求被提前限流", attempt)
		}
	}
	allowed, retryAfter, err := consumeAuthAttempt(key, 2, time.Minute, time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if allowed || retryAfter <= 0 {
		t.Fatalf("超过限制后仍被允许: allowed=%v retry=%s", allowed, retryAfter)
	}
}
