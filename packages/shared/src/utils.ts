import {
  AssetSummary,
  BrandKitSummary,
  CanvasItem,
  CreditTransactionSummary,
  CustomerSummary,
  ProjectCanvasDocument,
  ProjectSummary,
  UserSummary,
  WorkflowTemplateSummary,
  WorkspaceSummary,
  WorkflowType,
  BuildInfoResponse,
  PlanSummary,
  RechargeRecordSummary,
  WorkspaceMemberSummary,
  WorkspaceCostReportResponse,
  GenerationTaskSummary,
  ProviderSummary,
  ModelSummary,
  PricingRuleSummary,
} from "./types";

export const API_BASE = typeof window !== "undefined"
  ? (window.location.hostname === "localhost" || 
     window.location.hostname === "127.0.0.1" || 
     window.location.hostname.includes("wails")
       ? "http://127.0.0.1:4100" 
       : "")
  : "http://127.0.0.1:4100";
export const CURRENT_USER_STORAGE_KEY = "reveria.currentUser";
export const ACCESS_TOKEN_STORAGE_KEY = "reveria.accessToken";

export function parseJwt(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function canCancelTask(status: string) {
  return status === "pending" || status === "running";
}

export function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function formatMicroCost(value: number) {
  if (!value) {
    return "未回传";
  }
  return (value / 1_000_000).toFixed(4);
}

export function createEmptyCanvas(): ProjectCanvasDocument {
  return {
    version: 1,
    items: [],
  };
}

export function createCanvasItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `canvas-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeCanvas(canvas: ProjectCanvasDocument | unknown): ProjectCanvasDocument {
  if (!canvas || typeof canvas !== "object") {
    return createEmptyCanvas();
  }
  const obj = canvas as Record<string, unknown>;
  const items = Array.isArray(obj.items) ? obj.items : [];

  const normalizedItems = items
    .filter((item): item is Partial<CanvasItem> => Boolean(item) && typeof item === "object")
    .map((item): CanvasItem => {
      const itemType: CanvasItem["type"] = item.type === "note" ? "note" : "asset";
      return {
        id: typeof item.id === "string" && item.id ? item.id : createCanvasItemId(),
        type: itemType,
        asset_id: typeof item.asset_id === "string" ? item.asset_id : undefined,
        task_id: typeof item.task_id === "string" ? item.task_id : undefined,
        title: typeof item.title === "string" && item.title ? item.title : "画布元素",
        text: typeof item.text === "string" ? item.text : "",
        x: clamp(Number(item.x ?? 0), -1000000, 1000000),
        y: clamp(Number(item.y ?? 0), -1000000, 1000000),
        w: Math.max(Number(item.w ?? 180), 80),
        h: Math.max(Number(item.h ?? 140), 60),
        board_id: typeof item.board_id === "string" ? item.board_id : undefined,
        color: typeof item.color === "string" ? item.color : undefined,
        fontSize: (item.fontSize === "sm" || item.fontSize === "md" || item.fontSize === "lg") ? item.fontSize : undefined,
        titleSize: (item.titleSize === "sm" || item.titleSize === "md" || item.titleSize === "lg") ? item.titleSize : undefined,
      };
    })
    .slice(0, 200);

  const boards = Array.isArray(obj.boards)
    ? obj.boards
        .filter((b): b is { id: string; name: string } => Boolean(b) && typeof b === "object" && typeof b.id === "string" && typeof b.name === "string")
        .map((b) => ({ id: b.id, name: b.name }))
    : undefined;

  return {
    version: 1,
    items: normalizedItems,
    boards,
    activeBoardId: typeof obj.activeBoardId === "string" ? obj.activeBoardId : undefined,
    panX: typeof obj.panX === "number" ? obj.panX : undefined,
    panY: typeof obj.panY === "number" ? obj.panY : undefined,
    zoom: typeof obj.zoom === "number" ? obj.zoom : undefined,
  };
}

export function assetTypeFromMime(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "document";
}

export function assetTitle(asset: AssetSummary) {
  const meta = getAssetMetadata(asset);
  const title = meta.file_name ?? meta.title;
  return typeof title === "string" && title.trim() ? title : asset.asset_type;
}

export function assetMimeType(asset: AssetSummary) {
  const meta = getAssetMetadata(asset);
  return typeof meta.mime_type === "string" && meta.mime_type.trim()
    ? meta.mime_type
    : asset.asset_type;
}

export function routeModelCount(route: unknown) {
  if (!route || typeof route !== "object" || !("text_model_ids" in route)) {
    return 0;
  }
  const ids = (route as { text_model_ids?: unknown }).text_model_ids;
  return Array.isArray(ids) ? ids.length : 0;
}

export function mergePublishedWorkflowTemplate(
  templates: WorkflowTemplateSummary[],
  template: WorkflowTemplateSummary,
) {
  const nextTemplates = templates.map((item) => {
    if (item.id === template.id) {
      return template;
    }
    if (template.enabled && item.task_type === template.task_type) {
      return { ...item, enabled: false };
    }
    return item;
  });

  return nextTemplates.some((item) => item.id === template.id)
    ? nextTemplates
    : [template, ...nextTemplates];
}

type AppExportBuilder = () => {
  exported_at: string;
  workspace: WorkspaceSummary | undefined;
  project: ProjectSummary | undefined;
  customer: CustomerSummary | null;
  brand_kit: BrandKitSummary | null;
  workflow_outputs: AssetSummary[];
  materials: AssetSummary[];
  recent_credit_transactions: CreditTransactionSummary[];
};

export function buildProjectMarkdown(data: ReturnType<AppExportBuilder>) {
  const workflowOutputs = data.workflow_outputs
    .map((asset, index) => {
      return [
        `## ${index + 1}. ${asset.metadata.title ?? asset.asset_type}`,
        "",
        `- 类型：${asset.asset_type}`,
        `- 来源：${asset.source}`,
        "",
        "```json",
        JSON.stringify(asset.metadata.output ?? asset.metadata, null, 2),
        "```",
      ].join("\n");
    })
    .join("\n\n");

  const materials = data.materials
    .map((asset) => {
      return `- ${asset.metadata.file_name ?? asset.metadata.title ?? asset.asset_type} (${asset.metadata.mime_type ?? asset.asset_type})`;
    })
    .join("\n");

  return [
    `# ${data.project?.name ?? "项目交付记录"}`,
    "",
    `导出时间：${data.exported_at}`,
    "",
    "## 项目概览",
    "",
    `- 状态：${data.project?.status ?? "unknown"}`,
    `- 消耗点数：${data.project?.consumed_credits ?? 0}`,
    `- 客户：${data.customer?.name ?? "未绑定"}`,
    `- 品牌库：${data.brand_kit?.name ?? "未绑定"}`,
    "",
    "## 素材",
    "",
    materials || "暂无素材。",
    "",
    workflowOutputs || "## 生成结果\n\n暂无生成结果。",
    "",
  ].join("\n");
}

export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function sanitizeDownloadName(name: string) {
  return (
    name
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "reveria-project"
  );
}


export function readCachedUser() {
  if (typeof window === "undefined") {
    return null;
  }
  const rawValue = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const user = JSON.parse(rawValue) as Partial<UserSummary>;
    if (typeof user.id === "string" && typeof user.display_name === "string") {
      return {
        id: user.id,
        display_name: user.display_name,
        email: user.email ?? null,
        is_platform_admin: user.is_platform_admin ?? false,
      };
    }
  } catch {
    if (typeof window !== "undefined") {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
  }

  return null;
}

export function isWorkflowRunnable(workflow: WorkflowType) {
  return (
    workflow === "image-generation" ||
    workflow === "text-generation" ||
    workflow === "video-generation"
  );
}

export function withAuthHeaders(headers: Record<string, string> = {}) {
  if (typeof window === "undefined") {
    return headers;
  }
  const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  if (!token) {
    return headers;
  }
  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}

export async function getJson<T>(
  path: string,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: withAuthHeaders(headers),
  });
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`POST ${path} failed with ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`PUT ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function deleteJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: withAuthHeaders(body ? { "Content-Type": "application/json" } : undefined),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`DELETE ${path} failed with ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function uploadAsset(formData: FormData): Promise<AssetSummary> {
  const response = await fetch(`${API_BASE}/api/assets/upload`, {
    method: "POST",
    headers: withAuthHeaders(),
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`POST /api/assets/upload failed with ${response.status}`);
  }
  return (await response.json()) as AssetSummary;
}

export function assetUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  
  let formattedUrl = url;
  // 如果 url 只是一个纯文件名（如 fdda4a...jpg）或不含 /api/files/ 的路径，智能重整为标准的相对静态路由
  if (!formattedUrl.includes("/api/files/")) {
    if (formattedUrl.startsWith("/")) {
      formattedUrl = `/api/files${formattedUrl}`;
    } else {
      formattedUrl = `/api/files/${formattedUrl}`;
    }
  }

  const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  return `${base}${formattedUrl}`;
}

export function formatCredits(amount?: number) {
  return new Intl.NumberFormat("zh-CN").format(amount ?? 0);
}

export function handleExportProject(
  format: "json" | "markdown",
  selectedProject: ProjectSummary | null,
  assets: AssetSummary[],
  activeWorkspace: WorkspaceSummary | undefined,
  customers: CustomerSummary[],
  brandKits: BrandKitSummary[],
  transactions: CreditTransactionSummary[]
) {
  if (!selectedProject) return;
  const workflowAssets = assets.filter((asset) => asset.asset_type === "workflow_output");
  const materialAssets = assets.filter((asset) => asset.asset_type !== "workflow_output");

  const exportData = {
    exported_at: new Date().toISOString(),
    workspace: activeWorkspace,
    project: selectedProject,
    customer: customers.find((customer) => customer.id === selectedProject?.customer_id) ?? null,
    brand_kit: brandKits.find((brandKit) => brandKit.id === selectedProject?.brand_kit_id) ?? null,
    workflow_outputs: workflowAssets,
    materials: materialAssets,
    recent_credit_transactions: transactions.slice(0, 20),
  };

  const baseName = sanitizeDownloadName(selectedProject.name);
  if (format === "json") {
    downloadTextFile(`${baseName}-交付记录.json`, JSON.stringify(exportData, null, 2), "application/json");
  } else {
    downloadTextFile(`${baseName}-交付记录.md`, buildProjectMarkdown(exportData), "text/markdown");
  }
}

export async function fetchDashboardData(workspaceIdOverride?: string) {
  const [buildData, workspaceData, customerData, brandKitData, projectData, planData] =
    await Promise.all([
      getJson<BuildInfoResponse>("/api/version"),
      getJson<WorkspaceSummary[]>("/api/workspaces"),
      getJson<CustomerSummary[]>("/api/customers"),
      getJson<BrandKitSummary[]>("/api/brand-kits"),
      getJson<ProjectSummary[]>("/api/projects"),
      getJson<PlanSummary[]>("/api/billing/plans"),
    ]);

  let transactionData: CreditTransactionSummary[] = [];
  let memberData: WorkspaceMemberSummary[] = [];
  let rechargeData: RechargeRecordSummary[] = [];
  const workspaceId = workspaceIdOverride ?? workspaceData[0]?.id;
  if (workspaceId) {
    transactionData = await getJson<CreditTransactionSummary[]>(`/api/credits/${workspaceId}/transactions`);
    memberData = await getJson<WorkspaceMemberSummary[]>(`/api/admin/workspace-members?workspace_id=${workspaceId}`);
    try {
      rechargeData = await getJson<RechargeRecordSummary[]>(`/api/credits/${workspaceId}/recharges`);
    } catch (err) {
      console.error("Failed to load recharge records:", err);
    }
  }

  return {
    buildData,
    workspaceData,
    customerData,
    brandKitData,
    projectData,
    planData,
    transactionData,
    memberData,
    rechargeData,
  };
}

export async function fetchAdminData(workspaceId?: string) {
  const [userData, providerData, modelData, pricingRuleData, templateData, taskData, workspaceData, buildData] =
    await Promise.all([
      getJson<UserSummary[]>("/api/admin/users"),
      getJson<ProviderSummary[]>("/api/admin/providers"),
      getJson<ModelSummary[]>("/api/admin/models"),
      getJson<PricingRuleSummary[]>("/api/admin/pricing-rules"),
      getJson<WorkflowTemplateSummary[]>("/api/admin/workflow-templates"),
      getJson<GenerationTaskSummary[]>("/api/tasks"),
      getJson<WorkspaceSummary[]>("/api/workspaces"),
      getJson<any>("/api/version").catch(() => null),
    ]);
  const activeWId = workspaceId ?? workspaceData[0]?.id;
  const memberData = activeWId
    ? await getJson<WorkspaceMemberSummary[]>(`/api/admin/workspace-members?workspace_id=${activeWId}`)
    : [];
  const costReportData = activeWId
    ? await getJson<WorkspaceCostReportResponse>(`/api/admin/reports/costs?workspace_id=${activeWId}`)
    : null;

  return {
    userData,
    providerData,
    modelData,
    pricingRuleData,
    templateData,
    taskData,
    memberData,
    costReportData,
    buildData,
  };
}

export function getAssetMetadata(asset: AssetSummary): any {
  if (!asset || !asset.metadata) return {};
  if (typeof asset.metadata === "string") {
    try {
      return JSON.parse(asset.metadata);
    } catch {
      return {};
    }
  }
  return asset.metadata;
}
