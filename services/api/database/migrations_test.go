package database

import (
	"fmt"
	"testing"

	"reveria/services/api/model"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestRunVersionedMigrationsIsIdempotent(t *testing.T) {
	previous := DB
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	DB = db
	t.Cleanup(func() { DB = previous })
	if err := DB.AutoMigrate(&model.GenerationTask{}, &model.CreditTransaction{}, &model.Asset{}, &model.Workspace{}, &model.Provider{}, &model.ClientSettings{}, &model.AuthSession{}); err != nil {
		t.Fatal(err)
	}
	if err := RunVersionedMigrations(); err != nil {
		t.Fatal(err)
	}
	if err := RunVersionedMigrations(); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err := DB.Model(&schemaMigration{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 5 {
		t.Fatalf("迁移记录数 = %d, want 5", count)
	}
	first := model.ClientSettings{ID: uuid.New(), SiteTitle: "first"}
	second := model.ClientSettings{ID: uuid.New(), SiteTitle: "second"}
	if err := DB.Create(&first).Error; err != nil {
		t.Fatal(err)
	}
	if err := DB.Create(&second).Error; err == nil {
		t.Fatal("client_settings 单例索引未阻止第二条配置")
	}
}
