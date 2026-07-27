import {
  AssetSummary,
  BrandKitSummary,
  CanvasConnection,
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

type ReveriaRuntimeWindow = Window & {
  __REVERIA_API_BASE__?: string;
  go?: unknown;
};

function resolveApiBase() {
  if (typeof window === "undefined") {
    return "";
  }
  const runtimeWindow = window as ReveriaRuntimeWindow;
  const configuredBase = runtimeWindow.__REVERIA_API_BASE__?.trim();
  if (configuredBase) {
    return configuredBase.replace(/\/$/, "");
  }
  return "";
}

export let API_BASE = resolveApiBase();

export function configureApiBase(baseURL: string) {
  API_BASE = baseURL.trim().replace(/\/$/, "");
}
export const CURRENT_USER_STORAGE_KEY = "reveria.currentUser";
export const ACCESS_TOKEN_STORAGE_KEY = "reveria.accessToken"; // 仅用于清理历史版本遗留值
if (typeof window !== "undefined") {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

type DesktopAuthRuntime = {
  accessToken: string;
  refreshToken: string;
  saveTokens?: (accessToken: string, refreshToken: string) => Promise<void>;
  clearTokens?: () => Promise<void>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let desktopAuthRuntime: DesktopAuthRuntime | null = null;
let refreshRequest: Promise<boolean> | null = null;

export function configureDesktopAuthRuntime(runtime: DesktopAuthRuntime) {
  desktopAuthRuntime = runtime;
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

export function isDesktopAuthRuntime() {
  return desktopAuthRuntime !== null;
}

export async function persistAuthTokens(accessToken?: string, refreshToken?: string) {
  if (!desktopAuthRuntime || !accessToken || !refreshToken) {
    return;
  }
  desktopAuthRuntime.accessToken = accessToken;
  desktopAuthRuntime.refreshToken = refreshToken;
  await desktopAuthRuntime.saveTokens?.(accessToken, refreshToken);
}

export async function clearAuthTokens() {
  if (desktopAuthRuntime) {
    desktopAuthRuntime.accessToken = "";
    desktopAuthRuntime.refreshToken = "";
    await desktopAuthRuntime.clearTokens?.();
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

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

/** 单个画板文档允许承载的元素上限，需与后端 handler/canvas.go 的 canvasItemLimit 保持一致。 */
export const CANVAS_ITEM_LIMIT = 2000;

/** 把任意输入折算成有限数值，NaN / Infinity / 非数字一律退回兜底值。 */
function finiteNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
      // note / frame 需要原样保留，其余一律按素材卡片处理。
      const itemType: CanvasItem["type"] =
        item.type === "note" || item.type === "frame" ? item.type : "asset";
      return {
        id: typeof item.id === "string" && item.id ? item.id : createCanvasItemId(),
        type: itemType,
        asset_id: typeof item.asset_id === "string" ? item.asset_id : undefined,
        task_id: typeof item.task_id === "string" ? item.task_id : undefined,
        title: typeof item.title === "string" && item.title ? item.title : "画布元素",
        text: typeof item.text === "string" ? item.text : "",
        x: clamp(finiteNumber(item.x, 0), -1000000, 1000000),
        y: clamp(finiteNumber(item.y, 0), -1000000, 1000000),
        w: clamp(finiteNumber(item.w, 180), 80, 1000000),
        h: clamp(finiteNumber(item.h, 140), 60, 1000000),
        board_id: typeof item.board_id === "string" ? item.board_id : undefined,
        color: typeof item.color === "string" ? item.color : undefined,
        fontSize: (item.fontSize === "sm" || item.fontSize === "md" || item.fontSize === "lg") ? item.fontSize : undefined,
        titleSize: (item.titleSize === "sm" || item.titleSize === "md" || item.titleSize === "lg") ? item.titleSize : undefined,
      };
    })
    .slice(0, CANVAS_ITEM_LIMIT);

  const boards = Array.isArray(obj.boards)
    ? obj.boards
        .filter((b): b is { id: string; name: string } => Boolean(b) && typeof b === "object" && typeof b.id === "string" && typeof b.name === "string")
        .map((b) => ({ id: b.id, name: b.name }))
    : undefined;

  // 连线必须跟着文档一起还原，否则保存一次就会全部丢失。
  // 同时剔除指向已删除元素的悬空连线、自环连线与重复连线。
  const itemIds = new Set(normalizedItems.map((item) => item.id));
  const seenConnections = new Set<string>();
  const connections = Array.isArray(obj.connections)
    ? obj.connections
        .filter((conn): conn is Partial<CanvasConnection> => Boolean(conn) && typeof conn === "object")
        .filter(
          (conn) =>
            typeof conn.fromItemId === "string" &&
            typeof conn.toItemId === "string" &&
            conn.fromItemId !== conn.toItemId &&
            itemIds.has(conn.fromItemId) &&
            itemIds.has(conn.toItemId)
        )
        .filter((conn) => {
          const pairKey = `${conn.fromItemId}->${conn.toItemId}`;
          if (seenConnections.has(pairKey)) return false;
          seenConnections.add(pairKey);
          return true;
        })
        .map((conn): CanvasConnection => ({
          id: typeof conn.id === "string" && conn.id ? conn.id : createCanvasItemId(),
          fromItemId: conn.fromItemId as string,
          toItemId: conn.toItemId as string,
          color: typeof conn.color === "string" ? conn.color : undefined,
          label: typeof conn.label === "string" ? conn.label : undefined,
        }))
    : undefined;

  return {
    version: 1,
    items: normalizedItems,
    boards,
    activeBoardId: typeof obj.activeBoardId === "string" ? obj.activeBoardId : undefined,
    panX: typeof obj.panX === "number" && Number.isFinite(obj.panX) ? obj.panX : undefined,
    panY: typeof obj.panY === "number" && Number.isFinite(obj.panY) ? obj.panY : undefined,
    zoom: typeof obj.zoom === "number" && Number.isFinite(obj.zoom) ? obj.zoom : undefined,
    connections,
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

export function isTextAsset(asset: AssetSummary) {
  const meta = getAssetMetadata(asset);
  const taskType = typeof meta.task_type === "string" ? meta.task_type.toLowerCase() : "";
  const hasGeneratedText =
    typeof meta.output === "string" || typeof meta.summary === "string";

  return asset.asset_type === "text" || taskType === "text" || (
    asset.asset_type === "document" &&
    asset.source === "generated" &&
    hasGeneratedText
  );
}

export function assetTextContent(asset: AssetSummary) {
  const meta = getAssetMetadata(asset);
  const content = typeof meta.output === "string" ? meta.output : meta.summary;
  return typeof content === "string" ? content.trim() : "";
}

export function textAssetTitle(asset: AssetSummary) {
  const meta = getAssetMetadata(asset);
  const title = typeof meta.title === "string" ? meta.title.trim() : "";
  const prompt = typeof meta.prompt === "string" ? meta.prompt.trim() : "";
  const candidate = title && title !== "AI 文本生成结果" ? title : prompt;
  const normalized = candidate.replace(/\s+/g, " ");

  if (!normalized) {
    return "AI 文本生成结果";
  }
  return normalized.length > 42 ? `${normalized.slice(0, 42)}...` : normalized;
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
  if (desktopAuthRuntime) {
    return {
      ...headers,
      "X-Reveria-Client": "desktop",
      ...(desktopAuthRuntime.accessToken
        ? { Authorization: `Bearer ${desktopAuthRuntime.accessToken}` }
        : {}),
    };
  }
  return headers;
}

async function handleHttpStatus(status: number) {
  if (status === 401) {
    await clearAuthTokens();
    if (typeof window !== "undefined") {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
      window.dispatchEvent(new Event("reveria-unauthorized"));
    }
  }
}

async function createApiError(response: Response, fallback: string) {
  let message = fallback;
  try {
    const payload = await response.json() as { message?: unknown };
    if (typeof payload.message === "string" && payload.message.trim()) {
      message = payload.message.trim();
    }
  } catch {
    // 非 JSON 错误响应沿用包含请求路径和状态码的兜底信息。
  }
  return new ApiError(message, response.status);
}

async function refreshAuthentication() {
  if (refreshRequest) {
    return refreshRequest;
  }
  refreshRequest = (async () => {
    const headers: Record<string, string> = {};
    if (desktopAuthRuntime) {
      if (!desktopAuthRuntime.refreshToken) {
        return false;
      }
      headers["X-Reveria-Client"] = "desktop";
      headers["X-Reveria-Refresh-Token"] = desktopAuthRuntime.refreshToken;
    }
    const response = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers,
      credentials: "include",
    });
    if (!response.ok) {
      return false;
    }
    if (desktopAuthRuntime) {
      const tokens = await response.json() as { access_token?: string; refresh_token?: string };
      if (!tokens.access_token || !tokens.refresh_token) {
        return false;
      }
      await persistAuthTokens(tokens.access_token, tokens.refresh_token);
    }
    return true;
  })().finally(() => {
    refreshRequest = null;
  });
  return refreshRequest;
}

async function authorizedFetch(path: string, init: RequestInit = {}, allowRefresh = true) {
  const headers = withAuthHeaders(init.headers as Record<string, string> | undefined);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const isAuthEntry = path === "/api/auth/login" || path === "/api/auth/register" || path === "/api/auth/dev-login" || path === "/api/auth/refresh";
  if (response.status === 401 && allowRefresh && !isAuthEntry && await refreshAuthentication()) {
    return authorizedFetch(path, init, false);
  }
  return response;
}

export async function getJson<T>(
  path: string,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await authorizedFetch(path, {
    headers: withAuthHeaders(headers),
  });
  if (!response.ok) {
    await handleHttpStatus(response.status);
    throw await createApiError(response, `GET ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await authorizedFetch(path, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await handleHttpStatus(response.status);
    throw await createApiError(response, `POST ${path} failed with ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function putJson<T>(path: string, body: unknown): Promise<T> {
  const response = await authorizedFetch(path, {
    method: "PUT",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    await handleHttpStatus(response.status);
    throw await createApiError(response, `PUT ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function deleteJson<T>(path: string, body?: unknown): Promise<T> {
  const response = await authorizedFetch(path, {
    method: "DELETE",
    headers: withAuthHeaders(body ? { "Content-Type": "application/json" } : undefined),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    await handleHttpStatus(response.status);
    throw await createApiError(response, `DELETE ${path} failed with ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function uploadAsset(formData: FormData): Promise<AssetSummary> {
  const response = await authorizedFetch("/api/assets/upload", {
    method: "POST",
    headers: withAuthHeaders(),
    body: formData,
  });
  if (!response.ok) {
    await handleHttpStatus(response.status);
    throw new Error(`POST /api/assets/upload failed with ${response.status}`);
  }
  return (await response.json()) as AssetSummary;
}

export function assetUrl(url: string, shareToken?: string) {
  if (!url) return "";
  if (url.startsWith("data:")) {
    return url;
  }

  let formattedUrl = url;
  let absolute = formattedUrl.startsWith("http://") || formattedUrl.startsWith("https://");
  // 历史本地数据可能保存了 127.0.0.1 等绝对文件地址，统一切回当前 API 主机以携带认证凭据。
  if (absolute) {
    try {
      const parsed = new URL(formattedUrl);
      if (parsed.pathname.startsWith("/api/files/")) {
        formattedUrl = `${parsed.pathname}${parsed.search}`;
        absolute = false;
      }
    } catch {
      // 非法绝对地址交由浏览器按原值处理。
    }
  }
  // 如果 url 只是一个纯文件名（如 fdda4a...jpg）或不含 /api/files/ 的路径，智能重整为标准的相对静态路由
  if (!absolute && !formattedUrl.includes("/api/files/")) {
    if (formattedUrl.startsWith("/")) {
      formattedUrl = `/api/files${formattedUrl}`;
    } else {
      formattedUrl = `/api/files/${formattedUrl}`;
    }
  }

  const base = API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE;
  const resolved = absolute ? formattedUrl : `${base}${formattedUrl}`;
  const token = shareToken || desktopAuthRuntime?.accessToken;
  if (!token || !formattedUrl.includes("/api/files/")) return resolved;
  const separator = resolved.includes("?") ? "&" : "?";
  return `${resolved}${separator}${shareToken ? "share_token" : "access_token"}=${encodeURIComponent(token)}`;
}

export function formatCredits(amount?: number) {
  if (amount === undefined || amount === null) return "0";
  if (amount % 1 === 0) {
    return new Intl.NumberFormat("zh-CN").format(amount);
  }
  const formatted = amount.toFixed(6).replace(/\.?0+$/, "");
  const parts = formatted.split(".");
  const integerPart = new Intl.NumberFormat("zh-CN").format(parseInt(parts[0]));
  return parts.length > 1 ? `${integerPart}.${parts[1]}` : integerPart;
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
    try {
      memberData = await getJson<WorkspaceMemberSummary[]>(`/api/admin/workspace-members?workspace_id=${workspaceId}`);
    } catch {
      memberData = [];
    }
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
