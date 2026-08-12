# 数据库迁移说明

本目录保留早期 PostgreSQL 架构设计记录，不再作为运行时迁移入口。

正式环境的业务主库是 PostgreSQL；本机开发 API 默认 SQLite。两种引擎共用同一套 GORM 模型与版本化迁移。网页端和桌面端不直连数据库。

当前服务以 `services/api/model` 中的 GORM 模型建立基础表结构，并由
`services/api/database/migrations.go` 执行带版本记录的索引、约束和数据迁移。
任何生产数据库变更都必须加入该版本化迁移列表；迁移失败时服务会停止启动。
