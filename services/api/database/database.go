package database

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
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

	// 针对 SQLite 优化并发读写性能，防止在并发事务中发生 "database is locked (SQLITE_BUSY)" 报错
	if dbType == "sqlite" {
		sqlDB, err := DB.DB()
		if err == nil {
			sqlDB.SetMaxOpenConns(1)
			_, _ = sqlDB.Exec("PRAGMA journal_mode=WAL;")
			_, _ = sqlDB.Exec("PRAGMA busy_timeout=5000;")
			log.Println("SQLite 数据库连接已限制 max_open_conns=1 并启用 WAL 模式")
		}
	}

	log.Println("数据库连接成功，开始自动迁移表结构...")
	AutoMigrate()
}

// AutoMigrate 自动迁移数据库结构
func AutoMigrate() {
	modelsToMigrate := []any{
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
	}
	for _, m := range modelsToMigrate {
		if err := DB.AutoMigrate(m); err != nil {
			log.Printf("自动迁移表模型遇到警告（跳过并继续）: %v", err)
		}
	}
	log.Println("数据库自动表迁移完成。")
	SeedTemplates()
}

// SeedTemplates 初始化内置模板数据
func SeedTemplates() {
	log.Println("开始自动检查并填充内置模板数据...")

	// 1. 确保“电商摄影”分类存在
	var category model.TemplateCategory
	err := DB.Where("name = ?", "电商摄影").First(&category).Error
	if err != nil {
		category = model.TemplateCategory{
			ID:           uuid.New(),
			Name:         "电商摄影",
			WorkflowType: "image-generation",
			SortOrder:    1,
		}
		if err := DB.Create(&category).Error; err != nil {
			log.Printf("创建电商摄影模板分类失败: %v", err)
			return
		}
		log.Println("已创建内置模板分类：电商摄影")
	}

	// 2. 确保“高端饰品一图生多图”模板存在
	var tpl model.PromptTemplate
	err = DB.Where("title = ?", "高端饰品一图生多图").First(&tpl).Error
	if err != nil {
		tpl = model.PromptTemplate{
			ID:            uuid.New(),
			CategoryID:    category.ID,
			Title:         "高端饰品一图生多图",
			Content:       "这个款有金色银色，戒指尺码6 7 8 9 10，你作为一个高端饰品摄影师，首先记住这款产品的外型特征，锁定产品外观结构，然后需要你帮我分析这款产品的卖点，应该来怎么拍摄，构图，以及产品打光，产品需要占画面的百分之80，拍摄用于电商主图，跨境平台temu使用，需要一张产品主图展示产品的卖点，一张产品配戴图展示产品配戴效果，一张产品细节图，一张产品白底图，一张材质/卖点图，一张场景/礼物氛围图，每张图片尺寸1200*1200，不可以拼图。",
			DefaultWidth:  1200,
			DefaultHeight: 1200,
			WorkflowType:  "image-generation",
			NeedImage:     1,
			ShowRatio:     true,
			NegativePrompt: "low quality, blurry, deformed, bad hands, distorted fingers, low resolution, multiple rings, collage",
			PreviewUrl:     "ring_template_preview.png",
			ModelID:        "gpt-image-2",
		}
		if err := DB.Create(&tpl).Error; err != nil {
			log.Printf("创建高端饰品一图生多图模板失败: %v", err)
		} else {
			log.Println("已成功创建内置模板：高端饰品一图生多图")
		}
	}
}
