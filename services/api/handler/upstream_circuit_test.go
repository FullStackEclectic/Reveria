package handler

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func useCircuitTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.ClientSettings{}); err != nil {
		t.Fatal(err)
	}
	settings := model.ClientSettings{ID: uuid.New(), SiteTitle: "t", UpstreamAPIURL: "http://example.invalid", PriceRate: 1}
	if err := db.Create(&settings).Error; err != nil {
		t.Fatal(err)
	}
	return db
}

func TestRecordUpstreamHTTPStatusOpensCircuitOn402(t *testing.T) {
	useCircuitTestDB(t)
	recordUpstreamHTTPStatus(http.StatusBadGateway)
	if upstreamCircuitOpen() {
		t.Fatal("非 402 不应打开熔断")
	}
	recordUpstreamHTTPStatus(http.StatusPaymentRequired)
	if !upstreamCircuitOpen() {
		t.Fatal("402 应打开熔断")
	}
	clearUpstreamCircuit()
	if upstreamCircuitOpen() {
		t.Fatal("清除后熔断应关闭")
	}
}

func TestRejectIfUpstreamCircuitOpen(t *testing.T) {
	gin.SetMode(gin.TestMode)
	useCircuitTestDB(t)
	openUpstreamCircuit("test")

	router := gin.New()
	router.POST("/tasks", func(c *gin.Context) {
		if rejectIfUpstreamCircuitOpen(c) {
			return
		}
		c.Status(http.StatusNoContent)
	})
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/tasks", nil))
	if recorder.Code != http.StatusPaymentRequired {
		t.Fatalf("熔断开启时应返回 402，实际 %d", recorder.Code)
	}
}
