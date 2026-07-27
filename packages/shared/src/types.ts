import { FolderKanban, BriefcaseBusiness, UsersRound, Library, Boxes, History, Coins, Settings, Sparkles, Wand2 } from "lucide-react";

export type AppView =
  | "square"
  | "workbench"
  | "projects"
  | "customers"
  | "assets"
  | "history"
  | "credits"
  | "admin";

export type ProjectCommentSummary = {
  id: string;
  project_id: string;
  user_id: string | null;
  user_display_name: string;
  content: string;
  created_at: number;
};

export type ProjectShareSummary = {
  id: string;
  project_id: string;
  token: string;
  created_at: number;
  expires_at: number | null;
  status: string;
};

export type PortalProjectDetails = {
  project: ProjectSummary;
  canvas: ProjectCanvasDocument;
  assets: AssetSummary[];
  comments: ProjectCommentSummary[];
};

export type TaskCommentSummary = {
  id: string;
  task_id: string;
  user_id: string;
  user_display_name: string;
  content: string;
  created_at: number;
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  credit_balance: number;
  gift_balance: number;
  recharge_balance: number;
  refund_balance: number;
  plan_id?: string | null;
  storage_quota?: number | null;
};

export type PlanSummary = {
  id: string;
  name: string;
  badge_label?: string;
  price_cents: number;
  monthly_credits: number;
  max_members: number;
  storage_quota_bytes: number;
  features: Record<string, boolean>;
  enabled: boolean;
  is_points_package?: boolean;
};

export type OrderSummary = {
  id: string;
  workspace_id: string;
  plan_id: string;
  amount_cents: number;
  payment_provider: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type RechargeRecordSummary = {
  id: string;
  workspace_id: string;
  order_id?: string | null;
  credits_added: number;
  recharge_type: string;
  operator_id?: string | null;
  created_at: string;
};

export type UserSummary = {
  id: string;
  display_name: string;
  email?: string | null;
  is_platform_admin: boolean;
};

export type CurrentUserResponse = {
  user: UserSummary | null;
};

export type DevLoginResponse = {
  user: UserSummary;
  access_token?: string;
  refresh_token?: string;
};

export type AuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
};

export type BuildInfoResponse = {
  service: string;
  version: string;
  api_contract: number;
  git_sha?: string | null;
  database_connected: boolean;
};

export type ProjectSummary = {
  id: string;
  workspace_id?: string;
  customer_id?: string | null;
  brand_kit_id?: string | null;
  name: string;
  brief?: string | null;
  status: string;
  budget_credits?: number | null;
  consumed_credits: number;
  project_type: string;
  cover_url?: string;
};

export type CustomerSummary = {
  id: string;
  workspace_id: string;
  name: string;
  industry?: string | null;
  notes?: string | null;
};

export type BrandKitSummary = {
  id: string;
  workspace_id: string;
  customer_id?: string | null;
  name: string;
  tone_of_voice?: string | null;
  style_prompt?: string | null;
  notes?: string | null;
};

export type AssetSummary = {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  customer_id?: string | null;
  /** 产出该素材的生成任务 ID，用于把任务结果精确绑定回画布卡片（后端 model.Asset.TaskID）。 */
  task_id?: string | null;
  /** 同一任务多图输出时的序号（后端 model.Asset.OutputIndex）。 */
  output_index?: number;
  asset_type: string;
  source: string;
  file_url?: string | null;
  selection_status?: string;
  thumbnail_url?: string | null;
  created_at?: string;
  metadata: {
    title?: string;
    task_type?: string;
    file_name?: string;
    mime_type?: string;
    size?: number;
    output?: unknown;
    [key: string]: unknown;
  };
};

export type CanvasBoard = {
  id: string;
  name: string;
};

export type CanvasItem = {
  id: string;
  type: "asset" | "note" | "frame";
  asset_id?: string;
  task_id?: string; // 关联的异步生图任务 ID
  title: string;
  text?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  board_id?: string;
  color?: string;
  fontSize?: "sm" | "md" | "lg";
  titleSize?: "sm" | "md" | "lg";
};

export type CanvasConnection = {
  id: string;
  fromItemId: string;
  toItemId: string;
  color?: string;
  label?: string;
};

export type AISession = {
  id: string;
  title: string;
  createdAt: number;
  assetIds: string[];
};

export type ProjectCanvasDocument = {
  version: 1;
  items: CanvasItem[];
  boards?: CanvasBoard[];
  activeBoardId?: string;
  panX?: number;
  panY?: number;
  zoom?: number;
  connections?: CanvasConnection[];
};

export type ProjectCanvasSummary = {
  project_id: string;
  workspace_id: string;
  canvas: ProjectCanvasDocument;
};

export type CreditTransactionSummary = {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  reason?: string;
  created_at?: string;
  task_id?: string;
  project_id?: string;
  user_id?: string;
};

export type ProviderSummary = {
  id: string;
  name: string;
  provider_type: string;
  api_url?: string;
  api_key?: string;
  api_key_configured?: boolean;
  enabled: boolean;
};

export type ModelSummary = {
  id: string;
  provider_id: string;
  name: string;
  display_name?: string;
  model_type?: string;
  billing_method?: string;
  credits_cost?: number;
  enabled: boolean;
};

export type PricingRuleSummary = {
  id: string;
  name: string;
  task_type?: string | null;
  model_id?: string | null;
  unit?: string | null;
  min_credits?: number | null;
  max_credits?: number | null;
  enabled: boolean;
};

export type WorkspaceMemberSummary = {
  id: string;
  workspace_id: string;
  user_id: string;
  display_name: string;
  email?: string | null;
  role: string;
  status: string;
  daily_credit_limit?: number | null;
  monthly_credit_limit?: number | null;
};

export type WorkflowTemplateSummary = {
  id: string;
  name: string;
  task_type: string;
  version: number;
  enabled: boolean;
  input_schema: unknown;
  output_schema: unknown;
  workflow_steps: unknown;
  default_model_route: unknown;
};

export type WorkflowResult = {
  task?: {
    id?: string;
    workspace_id?: string;
    project_id?: string | null;
    task_type: string;
    status: string;
    estimated_credits: number;
    actual_credits: number;
  };
  output?: unknown;
  asset?: AssetSummary | null;
  transactions?: CreditTransactionSummary[];
};

export type GenerationTaskSummary = {
  id: string;
  conversation_id?: string | null;
  task_type: string;
  status: string;
  estimated_credits: number;
  actual_credits: number;
  user_id?: string;
  project_id?: string | null;
  workspace_id?: string;
  created_at?: string;
};

export type GenerationTaskDetail = GenerationTaskSummary & {
  workspace_id: string;
  project_id?: string | null;
  frozen_credits: number;
  input_payload: unknown;
  output_payload?: unknown;
  error_code?: string | null;
  error_message?: string | null;
};

export type TestTextModelResponse = {
  output: string;
  provider?: string;
  model?: string;
};

export type TestImageModelResponse = {
  image_url?: string | null;
  b64_json?: string | null;
  revised_prompt?: string | null;
  provider?: string | null;
  model?: string | null;
};

export type SettleTaskResponse = {
  task: GenerationTaskSummary;
  transactions: CreditTransactionSummary[];
};

export type CreateTaskResponse = {
  task: GenerationTaskSummary;
  frozen_transaction: CreditTransactionSummary;
};

export type ProjectCostSummary = {
  project_id: string;
  project_name: string;
  budget_credits?: number | null;
  consumed_credits: number;
  task_actual_credits: number;
  task_count: number;
  provider_cost_micro: number;
  margin_rate: number;
};

export type TaskTypeCostSummary = {
  task_type: string;
  task_count: number;
  estimated_credits: number;
  actual_credits: number;
  provider_cost_micro: number;
  margin_rate: number;
};

export type ModelCallCostSummary = {
  provider_name?: string | null;
  model_name?: string | null;
  call_type: string;
  status: string;
  call_count: number;
  total_latency_ms: number;
  provider_cost_micro: number;
  actual_credits: number;
  margin_rate: number;
};

export type WorkspaceCostReportResponse = {
  workspace_id: string;
  total_consumed_credits: number;
  total_refunded_credits: number;
  failed_model_call_count: number;
  provider_cost_micro: number;
  margin_rate: number;
  projects: ProjectCostSummary[];
  task_types: TaskTypeCostSummary[];
  model_calls: ModelCallCostSummary[];
};

export type DeleteAssetResponse = {
  asset_id: string;
  deleted: boolean;
};

export const navItems = [
  { icon: Sparkles, label: "首页", view: "square" },
  { icon: FolderKanban, label: "工作台", view: "workbench" },
  { icon: BriefcaseBusiness, label: "项目", view: "projects" },
  { icon: UsersRound, label: "客户", view: "customers" },
  { icon: Boxes, label: "素材库", view: "assets" },
] as const;

export const quickTasks = [
  { label: "图像", type: "image-generation" },
  { label: "文本", type: "text-generation" },
  { label: "视频", type: "video-generation" },
] as const;

export type WorkflowType = (typeof quickTasks)[number]["type"];

export interface TemplateCategory {
  id: string;
  name: string;
  sort_order: number;
  parent_id?: string | null;
  workflow_type: string;
  created_at?: string;
  updated_at?: string;
}

export type ImageTemplateOperation = "text-to-image" | "image-to-image" | "image-edit";
export type TemplateOutputMode = "single" | "scenes" | "variants";
export type TemplateReferenceMode = "none" | "optional" | "required";

export interface TemplateScene {
  id: string;
  title: string;
  prompt: string;
}

export interface TemplateExecutionConfig {
  version: 1;
  operation: ImageTemplateOperation;
  output_mode: TemplateOutputMode;
  reference_mode: TemplateReferenceMode;
  max_outputs: number;
  scenes: TemplateScene[];
}

export interface TemplateGenerationPayload {
  prompt: string;
  negative_prompt: string;
  ratio: string;
  ref_image_url: string | null;
  execution_config: TemplateExecutionConfig;
  scenes: TemplateScene[];
}

export interface PromptTemplate {
  id: string;
  category_id: string;
  title: string;
  content: string;
  default_width: number;
  default_height: number;
  workflow_type?: string;
  need_image?: number;
  show_ratio?: boolean;
  negative_prompt?: string;
  preview_url?: string;
  model_id?: string;
  advanced_params?: string;
  execution_config?: string;
  created_at?: string;
  updated_at?: string;
}
