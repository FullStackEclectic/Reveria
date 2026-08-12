package handler

import (
	"fmt"
	"os"
	"testing"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func TestShouldBootstrapFirstAdmin(t *testing.T) {
	t.Setenv("REVERIA_ENV", "production")
	t.Setenv("GIN_MODE", "release")
	t.Setenv("REVERIA_BOOTSTRAP_FIRST_ADMIN", "")
	if shouldBootstrapFirstAdmin() {
		t.Fatal("生产环境默认不应把首位注册用户升为超管")
	}
	t.Setenv("REVERIA_BOOTSTRAP_FIRST_ADMIN", "true")
	if !shouldBootstrapFirstAdmin() {
		t.Fatal("显式打开引导开关后应允许首位超管")
	}
	t.Setenv("REVERIA_ENV", "")
	t.Setenv("GIN_MODE", "")
	t.Setenv("REVERIA_BOOTSTRAP_FIRST_ADMIN", "")
	if !shouldBootstrapFirstAdmin() {
		t.Fatal("开发环境应允许首位超管")
	}
}

func TestRegisterDoesNotPromoteFirstUserInProduction(t *testing.T) {
	previous := os.Getenv("REVERIA_ENV")
	t.Setenv("REVERIA_ENV", "production")
	t.Setenv("GIN_MODE", "release")
	t.Setenv("REVERIA_BOOTSTRAP_FIRST_ADMIN", "")
	t.Cleanup(func() { _ = os.Setenv("REVERIA_ENV", previous) })

	previousDB, previousSQLite := database.DB, database.IsSQLite
	db, err := gorm.Open(sqlite.Open(fmt.Sprintf("file:%s?mode=memory&cache=shared", uuid.NewString())), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	database.DB, database.IsSQLite = db, true
	t.Cleanup(func() { database.DB, database.IsSQLite = previousDB, previousSQLite })
	if err := db.AutoMigrate(&model.User{}); err != nil {
		t.Fatal(err)
	}
	if shouldBootstrapFirstAdmin() {
		t.Fatal("测试环境应模拟生产：禁止自动升超管")
	}
}
