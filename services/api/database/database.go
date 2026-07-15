package database

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"reveria/services/api/model"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// IsSQLite 标识当前是否使用 SQLite 数据库引擎
// SQLite 不支持 SELECT ... FOR UPDATE 行级锁语法，需要在相关代码中条件化处理
var IsSQLite bool

// InitDatabase 初始化数据库连接，支持 Postgres 与 SQLite
func InitDatabase() {
	var err error
	dbType := strings.ToLower(os.Getenv("DATABASE_TYPE"))
	dbURL := os.Getenv("DATABASE_URL")

	// 默认使用 SQLite
	if dbType == "" {
		dbType = "sqlite"
	}

	IsSQLite = (dbType == "sqlite")

	var dialector gorm.Dialector

	if dbType == "postgres" {
		if dbURL == "" {
			dbURL = "host=localhost user=postgres password=postgres dbname=reveria port=5432 sslmode=disable"
		}
		log.Println("正在连接 Postgres 数据库")
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
		&model.AuthSession{},
		&model.AuthThrottle{},
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
		&model.PricingRule{},
		&model.WorkflowTemplate{},
		&model.TemplateCategory{},
		&model.PromptTemplate{},
	}
	for _, m := range modelsToMigrate {
		if err := DB.AutoMigrate(m); err != nil {
			log.Fatalf("自动迁移表模型失败: %v", err)
		}
	}
	if err := RunVersionedMigrations(); err != nil {
		log.Fatalf("执行版本化数据库迁移失败: %v", err)
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
	sceneConfig := map[string]any{
		"version":        1,
		"operation":      "image-to-image",
		"output_mode":    "scenes",
		"reference_mode": "required",
		"max_outputs":    12,
		"scenes": []map[string]string{
			{"id": "product-main", "title": "产品主图", "prompt": "以精美的产品特写展示卖点与工艺品质"},
			{"id": "product-wearing", "title": "模特佩戴图", "prompt": "由单个模特佩戴，展示实际佩戴效果与时尚氛围"},
			{"id": "product-detail", "title": "产品细节图", "prompt": "近距离展示产品的精细纹路、材质工艺与细节"},
			{"id": "product-white", "title": "产品白底图", "prompt": "在纯白背景上展示产品的真实结构与本色"},
			{"id": "product-selling-point", "title": "材质卖点图", "prompt": "突出材质、工艺和核心卖点，体现精致做工"},
			{"id": "product-gift", "title": "礼物氛围图", "prompt": "在精美礼品包装场景中展示产品与送礼氛围"},
		},
	}
	executionConfigBytes, _ := json.Marshal(sceneConfig)
	executionConfig := string(executionConfigBytes)
	globalPrompt := "这个款有金色银色，戒指尺码6 7 8 9 10。你作为高端饰品摄影师，记住产品的外形特征并锁定外观结构，分析产品卖点、构图与打光。产品占画面约80%，用于跨境电商平台，每张图为1200*1200的单张画面，不可拼图。"
	var tpl model.PromptTemplate
	err = DB.Where("title = ?", "高端饰品一图生多图").First(&tpl).Error
	if err != nil {
		tpl = model.PromptTemplate{
			ID:              uuid.New(),
			CategoryID:      category.ID,
			Title:           "高端饰品一图生多图",
			Content:         globalPrompt,
			DefaultWidth:    1200,
			DefaultHeight:   1200,
			WorkflowType:    "image-generation",
			NeedImage:       1,
			ShowRatio:       true,
			NegativePrompt:  "low quality, blurry, deformed, bad hands, distorted fingers, low resolution, multiple rings, collage",
			PreviewUrl:      "ring_template_preview.png",
			ModelID:         "gpt-image-2",
			ExecutionConfig: executionConfig,
		}
		if err := DB.Create(&tpl).Error; err != nil {
			log.Printf("创建高端饰品一图生多图模板失败: %v", err)
		} else {
			log.Println("已成功创建内置模板：高端饰品一图生多图")
		}
	} else if strings.TrimSpace(tpl.ExecutionConfig) == "" {
		if err := DB.Model(&tpl).Updates(map[string]any{
			"content":          globalPrompt,
			"execution_config": executionConfig,
			"need_image":       1,
		}).Error; err != nil {
			log.Printf("迁移内置多场景模板失败: %v", err)
		} else {
			log.Println("已将内置六图模板迁移为结构化场景模式")
		}
	}
}

// EncryptStoredSecrets 会在每次启动时收敛历史明文密钥，兼容先开发后配置生产密钥的数据库。
func EncryptStoredSecrets() error {
	if !model.SecretEncryptionConfigured() {
		return nil
	}
	var providers []model.Provider
	if err := DB.Find(&providers).Error; err != nil {
		return err
	}
	for index := range providers {
		if err := DB.Save(&providers[index]).Error; err != nil {
			return err
		}
	}
	var settings []model.ClientSettings
	if err := DB.Find(&settings).Error; err != nil {
		return err
	}
	for index := range settings {
		if err := DB.Save(&settings[index]).Error; err != nil {
			return err
		}
	}
	return nil
}
