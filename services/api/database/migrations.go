package database

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"reveria/services/api/model"

	"gorm.io/gorm"
)

type schemaMigration struct {
	ID        string    `gorm:"type:varchar(120);primaryKey"`
	AppliedAt time.Time `gorm:"not null"`
}

type versionedMigration struct {
	id  string
	run func(*gorm.DB) error
}

// RunVersionedMigrations 是运行时数据库约束的唯一迁移入口。
func RunVersionedMigrations() error {
	if err := DB.AutoMigrate(&schemaMigration{}); err != nil {
		return err
	}

	migrations := []versionedMigration{
		{id: "20260713_task_and_credit_idempotency", run: func(tx *gorm.DB) error {
			statements := []string{
				"CREATE UNIQUE INDEX IF NOT EXISTS generation_tasks_idempotency_idx ON generation_tasks(workspace_id, user_id, idempotency_key) WHERE idempotency_key IS NOT NULL",
				"CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_task_type_once_idx ON credit_transactions(task_id, transaction_type) WHERE task_id IS NOT NULL",
				"CREATE INDEX IF NOT EXISTS generation_tasks_project_conversation_idx ON generation_tasks(project_id, conversation_id, created_at)",
				"CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_task_output ON assets(task_id, output_index) WHERE task_id IS NOT NULL",
			}
			for _, statement := range statements {
				if err := tx.Exec(statement).Error; err != nil {
					return err
				}
			}
			return nil
		}},
		{id: "20260713_storage_usage_backfill", run: func(tx *gorm.DB) error {
			var assets []model.Asset
			if err := tx.Find(&assets).Error; err != nil {
				return err
			}
			usage := make(map[string]int64)
			for _, asset := range assets {
				if !strings.HasPrefix(asset.FileURL, "/api/files/") {
					continue
				}
				size := asset.SizeBytes
				if size == 0 && asset.Metadata != nil {
					var metadata struct {
						Size int64 `json:"size"`
					}
					_ = json.Unmarshal([]byte(*asset.Metadata), &metadata)
					size = metadata.Size
					if size > 0 {
						if err := tx.Model(&model.Asset{}).Where("id = ?", asset.ID).Update("size_bytes", size).Error; err != nil {
							return err
						}
					}
				}
				usage[asset.WorkspaceID.String()] += size
			}
			for workspaceID, size := range usage {
				if err := tx.Model(&model.Workspace{}).Where("id = ?", workspaceID).Update("storage_used", size).Error; err != nil {
					return err
				}
			}
			return nil
		}},
		{id: "20260713_encrypt_persisted_secrets", run: func(tx *gorm.DB) error {
			var providers []model.Provider
			if err := tx.Find(&providers).Error; err != nil {
				return err
			}
			for index := range providers {
				if err := tx.Save(&providers[index]).Error; err != nil {
					return err
				}
			}
			var settings []model.ClientSettings
			if err := tx.Find(&settings).Error; err != nil {
				return err
			}
			for index := range settings {
				if err := tx.Save(&settings[index]).Error; err != nil {
					return err
				}
			}
			return nil
		}},
		{id: "20260715_worker_leases_and_singleton_settings", run: func(tx *gorm.DB) error {
			statements := []string{
				"CREATE INDEX IF NOT EXISTS generation_tasks_worker_lease_idx ON generation_tasks(status, lease_until)",
				"CREATE UNIQUE INDEX IF NOT EXISTS client_settings_singleton_idx ON client_settings ((1))",
			}
			for _, statement := range statements {
				if err := tx.Exec(statement).Error; err != nil {
					return err
				}
			}
			return nil
		}},
		{id: "20260715_revocable_auth_sessions", run: func(tx *gorm.DB) error {
			statements := []string{
				"CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx ON auth_sessions(user_id, revoked_at, expires_at)",
				"CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at)",
			}
			for _, statement := range statements {
				if err := tx.Exec(statement).Error; err != nil {
					return err
				}
			}
			return nil
		}},
	}

	for _, migration := range migrations {
		var count int64
		if err := DB.Model(&schemaMigration{}).Where("id = ?", migration.id).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		if err := DB.Transaction(func(tx *gorm.DB) error {
			if err := migration.run(tx); err != nil {
				return fmt.Errorf("%s: %w", migration.id, err)
			}
			return tx.Create(&schemaMigration{ID: migration.id, AppliedAt: time.Now()}).Error
		}); err != nil {
			return err
		}
	}
	return nil
}
