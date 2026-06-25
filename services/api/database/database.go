package database

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"reveria/services/api/model"

	"gorm.io/driver/postgres"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDatabase 初始化数据库连接，支持 Postgres 与 SQLite
func InitDatabase() {
	var err error
	dbType := strings.ToLower(os.Getenv("DATABASE_TYPE"))
	dbURL := os.Getenv("DATABASE_URL")

	// 默认使用 SQLite
	if dbType == "" {
		dbType = "sqlite"
	}

	var dialector gorm.Dialector

	if dbType == "postgres" {
		if dbURL == "" {
			dbURL = "host=localhost user=postgres password=postgres dbname=reveria port=5432 sslmode=disable"
		}
		log.Printf("连接 Postgres 数据库: %s", dbURL)
		dialector = postgres.Open(dbURL)
	} else {
		// SQLite
		if dbURL == "" {
			dbURL = "reveria.db"
		}
		// 确保 SQLite 的父目录存在
		dir := filepath.Dir(dbURL)
		if dir != "." && dir != "" {
			_ = os.MkdirAll(dir, 0755)
		}
		log.Printf("连接 SQLite 数据库: %s", dbURL)
		dialector = sqlite.Open(dbURL)
	}

	config := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	}

	DB, err = gorm.Open(dialector, config)
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	log.Println("数据库连接成功，开始自动迁移表结构...")
	AutoMigrate()
}

// AutoMigrate 自动迁移数据库结构
func AutoMigrate() {
	err := DB.AutoMigrate(
		&model.User{},
		&model.Workspace{},
		&model.WorkspaceMember{},
		&model.Customer{},
		&model.BrandKit{},
		&model.Project{},
		&model.ProjectCanvas{},
		&model.Asset{},
		&model.AssetRetouchSettings{},
		&model.AssetComment{},
		&model.GenerationTask{},
		&model.CreditTransaction{},
		&model.AuditLog{},
		&model.ClientSettings{},
		&model.Plan{},
		&model.Order{},
		&model.RechargeRecord{},
		&model.GiftCreditBatch{},
		&model.WorkspaceInvitation{},
		&model.ProjectComment{},
		&model.TaskComment{},
		&model.ProjectShare{},
		&model.Provider{},
		&model.Model{},
		&model.TemplateCategory{},
		&model.PromptTemplate{},
	)
	if err != nil {
		log.Fatalf("数据库自动迁移失败: %v", err)
	}
	log.Println("数据库自动表迁移完成。")
}
