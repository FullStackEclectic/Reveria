package handler

import (
	"encoding/json"
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

func TestDeleteGeneratedTextAssetIsIdempotent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousDB := database.DB
	t.Cleanup(func() { database.DB = previousDB })

	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.Asset{}, &model.WorkspaceMember{}); err != nil {
		t.Fatal(err)
	}
	database.DB = db

	workspaceID := uuid.New()
	userID := uuid.New()
	assetID := uuid.New()
	metadata := `{"task_type":"text","output":"一段生成文本"}`
	member := model.WorkspaceMember{
		ID:          uuid.New(),
		WorkspaceID: workspaceID,
		UserID:      userID,
		Role:        "member",
		Status:      "joined",
	}
	asset := model.Asset{
		ID:          assetID,
		WorkspaceID: workspaceID,
		ProjectID:   uuid.New(),
		AssetType:   "document",
		Source:      "generated",
		FileURL:     "",
		Metadata:    &metadata,
	}
	if err := db.Create(&member).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&asset).Error; err != nil {
		t.Fatal(err)
	}

	first := performDeleteAssetRequest(assetID, userID)
	if first.Code != http.StatusOK {
		t.Fatalf("第一次删除状态码 = %d, 响应 = %s", first.Code, first.Body.String())
	}
	var firstResponse struct {
		AssetID uuid.UUID `json:"asset_id"`
		Deleted bool      `json:"deleted"`
	}
	if err := json.Unmarshal(first.Body.Bytes(), &firstResponse); err != nil {
		t.Fatal(err)
	}
	if !firstResponse.Deleted || firstResponse.AssetID != assetID {
		t.Fatalf("第一次删除响应不符合预期: %s", first.Body.String())
	}

	var count int64
	if err := db.Model(&model.Asset{}).Where("id = ?", assetID).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("文本资产删除后仍有 %d 条记录", count)
	}

	second := performDeleteAssetRequest(assetID, userID)
	if second.Code != http.StatusOK {
		t.Fatalf("重复删除状态码 = %d, 响应 = %s", second.Code, second.Body.String())
	}
	var secondResponse struct {
		AssetID uuid.UUID `json:"asset_id"`
		Deleted bool      `json:"deleted"`
	}
	if err := json.Unmarshal(second.Body.Bytes(), &secondResponse); err != nil {
		t.Fatal(err)
	}
	if secondResponse.Deleted || secondResponse.AssetID != assetID {
		t.Fatalf("重复删除响应不符合预期: %s", second.Body.String())
	}
}

func performDeleteAssetRequest(assetID uuid.UUID, userID uuid.UUID) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest(http.MethodDelete, "/api/assets/"+assetID.String(), nil)
	context.Params = gin.Params{{Key: "id", Value: assetID.String()}}
	context.Set("user_id", userID)

	DeleteAsset(context)
	return recorder
}
