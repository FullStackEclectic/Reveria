package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User 用户表
type User struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Email           *string        `gorm:"type:varchar(255);uniqueIndex" json:"email"`
	Phone           *string        `gorm:"type:varchar(32)" json:"phone"`
	DisplayName     *string        `gorm:"type:varchar(100)" json:"display_name"`
	PasswordHash    string         `gorm:"type:varchar(255)" json:"-"` // 隐藏密码哈希
	AvatarURL       *string        `gorm:"type:text" json:"avatar_url"`
	Status          string         `gorm:"type:varchar(32);default:'active';index" json:"status"`
	IsPlatformAdmin bool           `gorm:"default:false;not null" json:"is_platform_admin"` // 平台超管标记
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

// Workspace 工作区表
type Workspace struct {
	ID              uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name            string         `gorm:"type:varchar(120);not null" json:"name"`
	OwnerUserID     uuid.UUID      `gorm:"type:uuid" json:"owner_user_id"`
	PlanID          *uuid.UUID     `gorm:"type:uuid" json:"plan_id"`
	RechargeBalance int64          `gorm:"default:0;not null" json:"recharge_balance"`
	GiftBalance     int64          `gorm:"default:0;not null" json:"gift_balance"`
	RefundBalance   int64          `gorm:"default:0;not null" json:"refund_balance"`
	StorageQuota    int64          `gorm:"default:0;not null" json:"storage_quota"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

// WorkspaceMember 工作区成员关系表
type WorkspaceMember struct {
	ID                 uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID        uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_ws_user" json:"workspace_id"`
	UserID             uuid.UUID `gorm:"type:uuid;uniqueIndex:idx_ws_user" json:"user_id"`
	Role               string    `gorm:"type:varchar(32);not null" json:"role"`
	DailyCreditLimit   *int64    `json:"daily_credit_limit"`
	MonthlyCreditLimit *int64    `json:"monthly_credit_limit"`
	Status             string    `gorm:"type:varchar(32);default:'joined'" json:"status"`
	JoinedAt           time.Time `json:"joined_at"`
}

// Customer 客户表
type Customer struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID uuid.UUID `gorm:"type:uuid;index" json:"workspace_id"`
	Name        string    `gorm:"type:varchar(160);not null;index" json:"name"`
	Industry    *string   `gorm:"type:varchar(100)" json:"industry"`
	ContactName *string   `gorm:"type:varchar(100)" json:"contact_name"`
	ContactInfo *string   `gorm:"type:jsonb" json:"contact_info"` // json 字符串
	Notes       *string   `gorm:"type:text" json:"notes"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BrandKit 品牌库表
type BrandKit struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID    uuid.UUID  `gorm:"type:uuid;index" json:"workspace_id"`
	CustomerID     *uuid.UUID `gorm:"type:uuid" json:"customer_id"`
	Name           string     `gorm:"type:varchar(160);not null" json:"name"`
	LogoAssetID    *uuid.UUID `gorm:"type:uuid" json:"logo_asset_id"`
	Colors         *string    `gorm:"type:jsonb" json:"colors"`
	Fonts          *string    `gorm:"type:jsonb" json:"fonts"`
	ToneOfVoice    *string    `gorm:"type:text" json:"tone_of_voice"`
	VisualKeywords *string    `gorm:"type:jsonb" json:"visual_keywords"`
	ForbiddenWords *string    `gorm:"type:jsonb" json:"forbidden_words"`
	StylePrompt    *string    `gorm:"type:text" json:"style_prompt"`
	Notes          *string    `gorm:"type:text" json:"notes"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// Project 项目表
type Project struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID     uuid.UUID  `gorm:"type:uuid;index" json:"workspace_id"`
	CustomerID      *uuid.UUID `gorm:"type:uuid" json:"customer_id"`
	BrandKitID      *uuid.UUID `gorm:"type:uuid" json:"brand_kit_id"`
	Name            string     `gorm:"type:varchar(180);not null" json:"name"`
	Brief           *string    `gorm:"type:text" json:"brief"`
	TargetPlatforms *string    `gorm:"type:jsonb" json:"target_platforms"`
	Status          string     `gorm:"type:varchar(32);default:'draft';index" json:"status"`
	BudgetCredits   *int64     `json:"budget_credits"`
	ConsumedCredits int64      `gorm:"default:0;not null" json:"consumed_credits"`
	ProjectType     string     `gorm:"type:varchar(64);default:'ai_canvas';not null" json:"project_type"`
	DueAt           *time.Time `json:"due_at"`
	CreatedBy       *uuid.UUID `gorm:"type:uuid" json:"created_by"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	CoverURL        string     `gorm:"-" json:"cover_url"`
}

// Asset 素材/资产表
type Asset struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID     uuid.UUID  `gorm:"type:uuid;index" json:"workspace_id"`
	ProjectID       uuid.UUID  `gorm:"type:uuid;index" json:"project_id"`
	CustomerID      *uuid.UUID `gorm:"type:uuid" json:"customer_id"`
	AssetType       string     `gorm:"type:varchar(32);not null;index" json:"asset_type"`
	Source          string     `gorm:"type:varchar(32);not null" json:"source"`
	FileURL         string     `gorm:"type:text;not null" json:"file_url"`
	LocalPath       *string    `gorm:"type:text" json:"local_path"`                                      // 本地硬盘照片路径（仅客户端有用）
	SelectionStatus string     `gorm:"type:varchar(32);default:'pending';index" json:"selection_status"` // 客户选片状态：pending / approved / rejected
	ThumbnailURL    *string    `gorm:"type:text" json:"thumbnail_url"`
	Metadata        *string    `gorm:"type:jsonb" json:"metadata"`
	CreatedBy       *uuid.UUID `gorm:"type:uuid" json:"created_by"`
	CreatedAt       time.Time  `json:"created_at"`
}

// GenerationTask 生成任务表
type GenerationTask struct {
	ID                    uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID           uuid.UUID  `gorm:"type:uuid;index" json:"workspace_id"`
	ProjectID             uuid.UUID  `gorm:"type:uuid;index" json:"project_id"`
	UserID                *uuid.UUID `gorm:"type:uuid" json:"user_id"`
	TaskType              string     `gorm:"type:varchar(64);not null" json:"task_type"`
	InputPayload          string     `gorm:"type:jsonb;not null" json:"input_payload"`
	OutputPayload         *string    `gorm:"type:jsonb" json:"output_payload"`
	SelectedModel         *string    `gorm:"type:varchar(160)" json:"selected_model"`
	UpstreamTaskID        *string    `gorm:"type:varchar(120);index" json:"upstream_task_id"` // 12ZX-AI 的异步任务 ID
	EstimatedCredits      int64      `gorm:"default:0;not null" json:"estimated_credits"`
	FrozenCredits         int64      `gorm:"default:0;not null" json:"frozen_credits"`
	FrozenGiftCredits     int64      `gorm:"default:0;not null" json:"frozen_gift_credits"`
	FrozenRechargeCredits int64      `gorm:"default:0;not null" json:"frozen_recharge_credits"`
	FrozenRefundCredits   int64      `gorm:"default:0;not null" json:"frozen_refund_credits"`
	ActualCredits         int64      `gorm:"default:0;not null" json:"actual_credits"`
	UpstreamCostCredits   int64      `gorm:"default:0;not null" json:"upstream_cost_credits"` // 站长调用主网关扣减额度
	Status                string     `gorm:"type:varchar(32);default:'pending';index" json:"status"`
	ErrorCode             *string    `gorm:"type:varchar(80)" json:"error_code"`
	ErrorMessage          *string    `gorm:"type:text" json:"error_message"`
	IdempotencyKey        *string    `gorm:"type:varchar(120)" json:"idempotency_key"`
	CreatedAt             time.Time  `json:"created_at"`
	StartedAt             *time.Time `json:"started_at"`
	CompletedAt           *time.Time `json:"completed_at"`
}

// CreditTransaction 点数消费流水表
type CreditTransaction struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID     uuid.UUID  `gorm:"type:uuid;index" json:"workspace_id"`
	UserID          *uuid.UUID `gorm:"type:uuid" json:"user_id"`
	ProjectID       *uuid.UUID `gorm:"type:uuid" json:"project_id"`
	TaskID          *uuid.UUID `gorm:"type:uuid;index" json:"task_id"`
	TransactionType string     `gorm:"type:varchar(32);not null;index" json:"transaction_type"`
	Amount          int64      `gorm:"not null" json:"amount"`
	GiftAmount      int64      `gorm:"default:0;not null" json:"gift_amount"`
	RechargeAmount  int64      `gorm:"default:0;not null" json:"recharge_amount"`
	RefundAmount    int64      `gorm:"default:0;not null" json:"refund_amount"`
	BalanceAfter    int64      `gorm:"not null" json:"balance_after"`
	Reason          *string    `gorm:"type:text" json:"reason"`
	OperatorID      *uuid.UUID `gorm:"type:uuid" json:"operator_id"`
	CreatedAt       time.Time  `json:"created_at"`
}

// AuditLog 审计日志表
type AuditLog struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID    uuid.UUID  `gorm:"type:uuid;index" json:"workspace_id"`
	OperatorID     *uuid.UUID `gorm:"type:uuid" json:"operator_id"`
	Action         string     `gorm:"type:varchar(120);not null;index" json:"action"`
	TargetType     *string    `gorm:"type:varchar(80)" json:"target_type"`
	TargetID       *uuid.UUID `gorm:"type:uuid" json:"target_id"`
	BeforeSnapshot *string    `gorm:"type:jsonb" json:"before_snapshot"`
	AfterSnapshot  *string    `gorm:"type:jsonb" json:"after_snapshot"`
	IP             *string    `gorm:"type:varchar(45)" json:"ip"`
	UserAgent      *string    `gorm:"type:text" json:"user_agent"`
	CreatedAt      time.Time  `json:"created_at"`
}

// ClientSettings 业务分站配置表
type ClientSettings struct {
	ID                    uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	SiteTitle             string    `gorm:"type:varchar(160);default:'Reveria AI 算力中心';not null" json:"site_title"`
	SiteAnnouncement      string    `gorm:"type:text;default:'';not null" json:"site_announcement"`
	UpstreamAPIURL        string    `gorm:"type:varchar(255);not null" json:"upstream_api_url"`
	UpstreamAPIKey        string    `gorm:"type:text;not null" json:"upstream_api_key"`
	AllowUserRegister     bool      `gorm:"default:true;not null" json:"allow_user_register"`
	GiftCreditsOnRegister int64     `gorm:"default:0;not null" json:"gift_credits_on_register"`
	PriceRate             float64   `gorm:"type:numeric(4,2);default:1.00;not null" json:"price_rate"`
	BillingMode           string    `gorm:"type:varchar(32);default:'standalone';not null" json:"billing_mode"`
	BridgeMainStationURL  string    `gorm:"type:varchar(255);default:'';not null" json:"bridge_main_station_url"`
	BridgeInternalSecret  string    `gorm:"type:varchar(255);default:'';not null" json:"bridge_internal_secret"`
	BridgeTextModel       string    `gorm:"type:text;default:'';not null" json:"bridge_text_model"`
	BridgeImageModel      string    `gorm:"type:text;default:'';not null" json:"bridge_image_model"`
	BridgeVideoModel      string    `gorm:"type:text;default:'';not null" json:"bridge_video_model"`
	BridgeTextPools       string    `gorm:"type:text;default:'';not null" json:"bridge_text_pools"`
	BridgeImagePools      string    `gorm:"type:text;default:'';not null" json:"bridge_image_pools"`
	BridgeVideoPools      string    `gorm:"type:text;default:'';not null" json:"bridge_video_pools"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}

// Plan 订阅套餐表
type Plan struct {
	ID                uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name              string    `gorm:"type:varchar(100);not null" json:"name"`
	BadgeLabel        string    `gorm:"type:varchar(24);default:'';not null" json:"badge_label"`
	PriceCents        int64     `gorm:"default:0;not null" json:"price_cents"`
	MonthlyCredits    int64     `gorm:"default:0;not null" json:"monthly_credits"`
	MaxMembers        int       `gorm:"default:1;not null" json:"max_members"`
	StorageQuotaBytes int64     `gorm:"default:0;not null" json:"storage_quota_bytes"`
	Features          string    `gorm:"type:jsonb;default:'{}';not null" json:"features"`
	Enabled           bool      `gorm:"default:true;not null;index" json:"enabled"`
	IsPointsPackage   bool      `gorm:"default:false;not null" json:"is_points_package"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// Order 充值/订阅订单表
type Order struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID     uuid.UUID  `gorm:"type:uuid;index" json:"workspace_id"`
	PlanID          *uuid.UUID `gorm:"type:uuid" json:"plan_id"`
	AmountCents     int64      `gorm:"default:0;not null" json:"amount_cents"`
	PaymentProvider string     `gorm:"type:varchar(64);not null" json:"payment_provider"`
	Status          string     `gorm:"type:varchar(32);default:'pending';index" json:"status"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// RechargeRecord 点数充值记录表
type RechargeRecord struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID  uuid.UUID  `gorm:"type:uuid;index" json:"workspace_id"`
	OrderID      *uuid.UUID `gorm:"type:uuid" json:"order_id"`
	CreditsAdded int64      `gorm:"not null" json:"credits_added"`
	RechargeType string     `gorm:"type:varchar(32);not null" json:"recharge_type"`
	OperatorID   *uuid.UUID `gorm:"type:uuid" json:"operator_id"`
	CreatedAt    time.Time  `json:"created_at"`
}

// GiftCreditBatch 赠送积分批次表
type GiftCreditBatch struct {
	ID              uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID     uuid.UUID `gorm:"type:uuid;index" json:"workspace_id"`
	Amount          int64     `gorm:"not null" json:"amount"`
	RemainingAmount int64     `gorm:"not null" json:"remaining_amount"`
	ExpiredAt       time.Time `gorm:"index" json:"expired_at"`
	CreatedAt       time.Time `json:"created_at"`
}

// WorkspaceInvitation 成员邀请表
type WorkspaceInvitation struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	WorkspaceID uuid.UUID  `gorm:"type:uuid;index" json:"workspace_id"`
	Email       string     `gorm:"type:varchar(120);not null" json:"email"`
	Role        string     `gorm:"type:varchar(32);not null" json:"role"`
	Token       string     `gorm:"type:text;not null;index" json:"token"`
	Status      string     `gorm:"type:varchar(32);default:'pending'" json:"status"`
	InvitedBy   *uuid.UUID `gorm:"type:uuid" json:"invited_by"`
	CreatedAt   time.Time  `json:"created_at"`
	ExpiresAt   time.Time  `json:"expires_at"`
}

// ProjectCanvas 项目无限画布表
type ProjectCanvas struct {
	ProjectID   uuid.UUID  `gorm:"type:uuid;primaryKey" json:"project_id"`
	WorkspaceID uuid.UUID  `gorm:"type:uuid;index" json:"workspace_id"`
	Canvas      string     `gorm:"type:jsonb;default:'{\"version\":1,\"items\":[]}'" json:"canvas"`
	UpdatedBy   *uuid.UUID `gorm:"type:uuid" json:"updated_by"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ProjectComment 项目评论表
type ProjectComment struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID  uuid.UUID  `gorm:"type:uuid;index" json:"project_id"`
	UserID     *uuid.UUID `gorm:"type:uuid" json:"user_id"`
	ClientName *string    `gorm:"type:varchar(80)" json:"client_name"`
	Content    string     `gorm:"type:text;not null" json:"content"`
	CreatedAt  time.Time  `json:"created_at"`
}

// TaskComment 任务评论表
type TaskComment struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TaskID    uuid.UUID `gorm:"type:uuid;index" json:"task_id"`
	UserID    uuid.UUID `gorm:"type:uuid" json:"user_id"`
	Content   string    `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

// ProjectShare 项目分享表
type ProjectShare struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	ProjectID uuid.UUID  `gorm:"type:uuid;index" json:"project_id"`
	Token     string     `gorm:"type:varchar(128);uniqueIndex;not null" json:"token"`
	CreatedBy *uuid.UUID `gorm:"type:uuid" json:"created_by"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at"`
	Status    string     `gorm:"type:varchar(32);default:'active'" json:"status"`
}

// Provider 算力服务商
type Provider struct {
	ID           string    `gorm:"type:varchar(80);primaryKey" json:"id"`
	Name         string    `gorm:"type:varchar(120);not null" json:"name"`
	ApiURL       string    `gorm:"type:text" json:"api_url"`
	ApiKey       string    `gorm:"type:text" json:"api_key"`
	ProviderType string    `gorm:"type:varchar(64);default:'openai'" json:"provider_type"`
	Enabled      bool      `gorm:"default:true;not null" json:"enabled"`
	CreatedAt    time.Time `json:"created_at"`
}

// Model 算力模型表
type Model struct {
	ID            string    `gorm:"type:varchar(160);primaryKey" json:"id"`
	ProviderID    string    `gorm:"type:varchar(80);index" json:"provider_id"`
	Name          string    `gorm:"type:varchar(160);not null" json:"name"`
	DisplayName   string    `gorm:"type:varchar(160);not null" json:"display_name"`
	ModelType     string    `gorm:"type:varchar(32);default:'chat'" json:"model_type"`                   // 模型类型：chat (对话), image (图像), video (视频)
	BillingMethod string    `gorm:"type:varchar(32);default:'per_token';not null" json:"billing_method"` // 计费方式：per_token (按Token), per_use (按次)
	Enabled       bool      `gorm:"default:true;not null" json:"enabled"`
	CreditsCost   float64   `gorm:"type:decimal(10,4);default:0.0" json:"credits_cost"` // 调用定价扣点
	Tags          string    `gorm:"-" json:"tags,omitempty"`                            // 虚拟字段：主站标签资源池
	CreatedAt     time.Time `json:"created_at"`
}

// TemplateCategory 模板分类表
type TemplateCategory struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ParentID     *uuid.UUID     `gorm:"type:uuid" json:"parent_id"`
	WorkflowType string         `gorm:"type:varchar(60);default:'image-generation';not null" json:"workflow_type"`
	Name         string         `gorm:"type:varchar(100);not null;uniqueIndex" json:"name"`
	SortOrder    int            `gorm:"default:0" json:"sort_order"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// PromptTemplate 提示词模板表
type PromptTemplate struct {
	ID             uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	CategoryID     uuid.UUID      `gorm:"type:uuid;index" json:"category_id"`
	Title          string         `gorm:"type:varchar(160);not null" json:"title"`
	Content        string         `gorm:"type:text;not null" json:"content"`
	DefaultWidth   int            `gorm:"default:300" json:"default_width"`
	DefaultHeight  int            `gorm:"default:200" json:"default_height"`
	WorkflowType   string         `gorm:"type:varchar(60);default:'image-generation'" json:"workflow_type"`
	NeedImage      int            `gorm:"default:0" json:"need_image"`
	ShowRatio      bool           `gorm:"default:true" json:"show_ratio"`
	NegativePrompt string         `gorm:"type:text" json:"negative_prompt"`
	PreviewUrl     string         `gorm:"type:varchar(255)" json:"preview_url"`
	ModelID        string         `gorm:"type:varchar(60)" json:"model_id"`
	AdvancedParams string         `gorm:"type:text" json:"advanced_params"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// AssetRetouchSettings 资产修图参数表
type AssetRetouchSettings struct {
	AssetID      uuid.UUID `gorm:"type:uuid;primaryKey;index" json:"asset_id"` // 关联资产ID
	ProjectID    uuid.UUID `gorm:"type:uuid;index" json:"project_id"`
	Exposure     float64   `gorm:"default:0.0" json:"exposure"`       // 曝光度 (-100 ~ 100)
	Contrast     float64   `gorm:"default:0.0" json:"contrast"`       // 对比度 (-100 ~ 100)
	Saturation   float64   `gorm:"default:0.0" json:"saturation"`     // 饱和度 (-100 ~ 100)
	BlurStrength float64   `gorm:"default:0.0" json:"blur_strength"`  // 磨皮强度 (0 ~ 100)
	EyeEnlarge   float64   `gorm:"default:0.0" json:"eye_enlarge"`    // 大眼强度 (0 ~ 100)
	SlimFace     float64   `gorm:"default:0.0" json:"slim_face"`      // 瘦脸强度 (0 ~ 100)
	LUTFile      string    `gorm:"type:varchar(255)" json:"lut_file"` // 应用的 3D LUT 文件路径
	AdvancedJSON string    `gorm:"type:text" json:"advanced_json"`    // 其它高级/自定义参数 (如 AI 关键点数据)
	UpdatedAt    time.Time `json:"updated_at"`
}

// AssetComment 资产评论表（用于单张照片的精修意见沟通）
type AssetComment struct {
	ID         uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	AssetID    uuid.UUID  `gorm:"type:uuid;index" json:"asset_id"` // 关联资产ID
	ProjectID  uuid.UUID  `gorm:"type:uuid;index" json:"project_id"`
	UserID     *uuid.UUID `gorm:"type:uuid" json:"user_id"`            // 如果是登录用户（修图师/销售）
	ClientName *string    `gorm:"type:varchar(80)" json:"client_name"` // 如果是免登客户
	Content    string     `gorm:"type:text;not null" json:"content"`   // 评论内容
	CreatedAt  time.Time  `json:"created_at"`
}
