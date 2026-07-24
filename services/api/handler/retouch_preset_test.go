package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestValidateRetouchPresetPayload(t *testing.T) {
	name, settings, err := validateRetouchPresetPayload(saveRetouchPresetRequest{
		Name:     "  清透人像  ",
		Settings: json.RawMessage(`{"exposure":12,"skin_whiten":20}`),
	})
	if err != nil {
		t.Fatal(err)
	}
	if name != "清透人像" || settings == "" {
		t.Fatalf("校验结果异常: name=%q settings=%q", name, settings)
	}
}

func TestRetouchPresetEndpointsIsolateUsers(t *testing.T) {
	previousDB := database.DB
	t.Cleanup(func() { database.DB = previousDB })
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.RetouchPreset{}); err != nil {
		t.Fatal(err)
	}
	database.DB = db
	gin.SetMode(gin.TestMode)

	ownerID := uuid.New()
	otherID := uuid.New()
	requestAs := func(userID uuid.UUID, method, path, body string) *httptest.ResponseRecorder {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("user_id", userID)
			c.Next()
		})
		router.GET("/retouch-presets", ListRetouchPresets)
		router.POST("/retouch-presets", SaveRetouchPreset)
		router.DELETE("/retouch-presets/:id", DeleteRetouchPreset)
		req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)
		return response
	}

	created := requestAs(ownerID, http.MethodPost, "/retouch-presets", `{"name":"清透","settings":{"exposure":12}}`)
	if created.Code != http.StatusCreated {
		t.Fatalf("创建状态码 = %d, body=%s", created.Code, created.Body.String())
	}
	var preset retouchPresetResponse
	if err := json.Unmarshal(created.Body.Bytes(), &preset); err != nil {
		t.Fatal(err)
	}

	otherList := requestAs(otherID, http.MethodGet, "/retouch-presets", "")
	if otherList.Code != http.StatusOK || strings.Contains(otherList.Body.String(), preset.ID.String()) {
		t.Fatalf("其他用户读取到了预设: %s", otherList.Body.String())
	}
	otherDelete := requestAs(otherID, http.MethodDelete, "/retouch-presets/"+preset.ID.String(), "")
	if otherDelete.Code != http.StatusNotFound {
		t.Fatalf("其他用户删除状态码 = %d, want %d", otherDelete.Code, http.StatusNotFound)
	}
	ownerDelete := requestAs(ownerID, http.MethodDelete, "/retouch-presets/"+preset.ID.String(), "")
	if ownerDelete.Code != http.StatusOK {
		t.Fatalf("所有者删除状态码 = %d, body=%s", ownerDelete.Code, ownerDelete.Body.String())
	}
}

func TestValidateRetouchPresetPayloadRejectsInvalidInput(t *testing.T) {
	cases := []saveRetouchPresetRequest{
		{Name: "", Settings: json.RawMessage(`{}`)},
		{Name: strings.Repeat("名", 81), Settings: json.RawMessage(`{}`)},
		{Name: "错误", Settings: json.RawMessage(`[]`)},
		{Name: "过大", Settings: json.RawMessage(`{"value":"` + strings.Repeat("x", maxRetouchPresetSettingsBytes) + `"}`)},
	}
	for _, testCase := range cases {
		if _, _, err := validateRetouchPresetPayload(testCase); err == nil {
			t.Fatalf("非法输入未被拒绝: name=%q", testCase.Name)
		}
	}
}
