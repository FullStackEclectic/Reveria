import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppView,
  WorkspaceSummary,
  PlanSummary,
  OrderSummary,
  UserSummary,
  RechargeRecordSummary,
  ProjectSummary,
  CustomerSummary,
  BrandKitSummary,
  AssetSummary,
  ProjectCanvasDocument,
  CreditTransactionSummary,
  GenerationTaskSummary,
  GenerationTaskDetail,
  BuildInfoResponse,
  ModelSummary,
  DeleteAssetResponse,
  ProjectCanvasSummary,
} from "./types";
import {
  CURRENT_USER_STORAGE_KEY,
  createEmptyCanvas,
  readCachedUser,
  getJson,
  postJson,
  putJson,
  deleteJson,
  formatCredits,
  assetUrl,
  uploadAsset,
  fetchDashboardData,
  handleExportProject,
  normalizeCanvas,
} from "./utils";
// Subview components
// Subview components
import { LoginView } from "./components/auth/LoginView";
import { RetouchView } from "./components/asset/RetouchView";
import { HeaderBar } from "./components/common/HeaderBar";
import { MainRouter } from "./components/common/MainRouter";
import { useAuth } from "./hooks/useAuth";
import { useInviteFlow } from "./hooks/useInviteFlow";
import { useOrderFlow } from "./hooks/useOrderFlow";
// Dialog/Modal components
// Dialog/Modal components
import { NewProjectModal } from "./components/project/NewProjectModal";
import { InvitationModal } from "./components/auth/InvitationModal";
import { AssetPreviewDialog } from "./components/asset/AssetPreviewDialog";
import { ClientPortalView } from "./components/portal/ClientPortalView";
import { Sidebar } from "./components/common/Sidebar";
import { AssetEditorWorkbench } from "./components/asset/AssetEditorWorkbench";
import type { RetouchSettings } from "./components/asset/AssetEditorWorkbench";
import type { ExportImageOptions } from "./components/asset/EditorHeader";
import { normalizeRetouchSettings } from "./components/asset/editorConstants";
import { buildNativeExportSettings } from "./components/asset/retouch/nativeExport";
const planBadgeLabel = (p?: PlanSummary) => !p ? "套餐" : p.badge_label?.trim() ? p.badge_label.trim().toUpperCase() : p.price_cents === 0 ? "FREE" : (p.name.includes("专业") || p.name.toLowerCase().includes("pro")) ? "PRO" : (p.name.includes("企业") || p.name.toLowerCase().includes("enterprise")) ? "ENT" : "PLAN";
export function AppCore() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [brandKits, setBrandKits] = useState<BrandKitSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [projectCanvas, setProjectCanvas] = useState<ProjectCanvasDocument>(createEmptyCanvas());
  // 画布加载请求序号，用于丢弃乱序返回的旧响应（见 loadProjectCanvas）
  const canvasLoadSeqRef = useRef(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedBrandKitId, setSelectedBrandKitId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isRestored, setIsRestored] = useState(false);
  const activeWorkspace = workspaces[0];
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? customers[0];
  const selectedBrandKit = brandKits.find((b) => b.id === selectedBrandKitId) ?? brandKits[0];
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];
  const [transactions, setTransactions] = useState<CreditTransactionSummary[]>([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitedClaims, setInvitedClaims] = useState<any>(null);
  // 提取后的新业务 Hooks 实例
  // 提取后的新业务 Hooks 实例
  const {
    currentUser,
    setCurrentUser,
    isLoginModalOpen,
    setIsLoginModalOpen,
    loginCallback,
    setLoginCallback,
    isLoggingIn,
    loginMessage,
    setLoginMessage,
    loginMode,
    setLoginMode,
    loginForm,
    setLoginForm,
    restoreCurrentUser,
    handleLogout,
    handlePasswordAuth,
    handleDevLogin,
  } = useAuth({
    inviteToken,
    setInviteToken,
    invitedClaims,
    setInvitedClaims,
    refreshAll,
    onAuthSuccess: async () => {
      await refreshAll();
    }
  });
  const {
    isAcceptingInvite,
    inviteError,
    handleAcceptInvitation,
    handleCancelInvitation,
  } = useInviteFlow({
    currentUser,
    refreshAll,
    inviteToken,
    setInviteToken,
    invitedClaims,
    setInvitedClaims,
  });
  const {
    plans,
    setPlans,
    rechargeRecords,
    setRechargeRecords,
    pendingOrder,
    isCreatingOrder,
    creditsTab,
    setCreditsTab,
    handleCreateOrder,
  } = useOrderFlow({
    currentUser,
    activeWorkspace,
    setAdminMessage,
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("reveria.sidebarCollapsed");
      if (saved === "true") {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);
  const [isHeaderUserDropdownOpen, setIsHeaderUserDropdownOpen] = useState(false);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>("square");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedWorkflowType, setSelectedWorkflowType] = useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>("all");
  useEffect(() => {
    if (!currentUser) {
      setCategories([]);
      return;
    }
    async function initCategories() {
      try {
        const catsRes = await getJson<any>("/api/template-categories");
        if (catsRes && catsRes.success) {
          setCategories(catsRes.data || []);
        }
      } catch (err) {
        console.error("Failed to load template categories in AppCore:", err);
      }
    }
    void initCategories();
  }, [currentUser]);
  const [searchQuery, setSearchQuery] = useState("");
  const triggerLogin = (callback?: () => void) => { if (callback) setLoginCallback(() => callback); setIsLoginModalOpen(true); };
  const [projectsViewMode, setProjectsViewMode] = useState<"list" | "detail">("list");
  const [customerEditForm, setCustomerEditForm] = useState({ name: "", industry: "", notes: "" });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [buildInfo, setBuildInfo] = useState<BuildInfoResponse | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskDetail, setTaskDetail] = useState<GenerationTaskDetail | null>(null);
  const [isApiOnline, setIsApiOnline] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tasks, setTasks] = useState<GenerationTaskSummary[]>([]);
  const [previewAsset, setPreviewAsset] = useState<AssetSummary | null>(null);
  const [editingAsset, setEditingAsset] = useState<AssetSummary | null>(null);
  const [retouchInitialSettings, setRetouchInitialSettings] = useState<RetouchSettings | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState("");
  const handleSaveRetouchSettings = async (assetId: string, settings: RetouchSettings) => {
    if (!selectedProjectId) return false;
    try {
      const res = await postJson<{ success: boolean }>(
        `/api/projects/${selectedProjectId}/retouch-sync`,
        {
          assets: [
            {
              asset_id: assetId,
              retouch_settings: {
                exposure: settings.exposure,
                contrast: settings.contrast,
                saturation: settings.saturation,
                blur_strength: settings.blur_strength,
                eye_enlarge: settings.eye_enlarge,
                slim_face: settings.slim_face,
                lut_file: settings.lut_file,
                advanced_json: JSON.stringify(settings),
              }
            }
          ]
        }
      );
      return res.success !== false;
    } catch (err) {
      console.error(err); return false;
    }
  };

  const handleLoadRetouchSettings = useCallback(async (assetId: string) => {
    if (!selectedProjectId) return undefined;
    const response = await getJson<{
      retouch: Array<{
        asset_id: string;
        exposure: number;
        contrast: number;
        saturation: number;
        blur_strength: number;
        eye_enlarge: number;
        slim_face: number;
        lut_file: string;
        advanced_json?: string;
      }>;
    }>(`/api/projects/${selectedProjectId}/retouch-sync`);
    const saved = response.retouch.find((item) => item.asset_id === assetId);
    if (!saved) return undefined;

    let advanced: Partial<RetouchSettings> = {};
    if (saved.advanced_json) {
      try {
        const parsed = JSON.parse(saved.advanced_json);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          advanced = parsed as Partial<RetouchSettings>;
        }
      } catch (error) {
        console.warn("Invalid retouch advanced_json:", error);
      }
    }

    return normalizeRetouchSettings({
      exposure: saved.exposure,
      contrast: saved.contrast,
      saturation: saved.saturation,
      blur_strength: saved.blur_strength,
      eye_enlarge: saved.eye_enlarge,
      slim_face: saved.slim_face,
      lut_file: saved.lut_file,
      ...advanced,
    });
  }, [selectedProjectId]);

  const handleExportRetouchImage = async (
    assetId: string,
    settings: RetouchSettings,
    dataUrl: string,
    format: "jpeg" | "png" | "webp",
    options?: ExportImageOptions,
  ) => {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) {
      alert("找不到要导出的素材");
      return false;
    }
    const extension = format === "jpeg" ? "jpg" : format;
    const filename = options?.filename || `${(asset.metadata?.title || asset.metadata?.file_name || "retouched_image").replace(/\.[^.]+$/, "")}_retouched.${extension}`;
    const wailsApp = (window as any).go?.main?.App;
    try {
      if (wailsApp?.SaveRenderedImage) {
        let savePath = options?.outputPath || "";
        if (!savePath) {
          savePath = await wailsApp.SelectSavePath(filename);
        }
        if (!savePath) return false;
        const nativeSettings = options?.outputPath ? null : buildNativeExportSettings(settings, format);
        let nativeExported = false;
        if (nativeSettings && wailsApp.ExportRetouchedImageNative) {
          try {
            const fileURL = assetUrl(asset.file_url ?? asset.thumbnail_url ?? "");
            await wailsApp.ExportRetouchedImageNative(
              fileURL,
              "",
              savePath,
              JSON.stringify(nativeSettings),
            );
            nativeExported = true;
          } catch (error) {
            console.warn("Rust 原生导出失败，回退到 WebGL 最终画面：", error);
          }
        }
        if (!nativeExported) {
          await wailsApp.SaveRenderedImage(dataUrl, savePath);
        }
        if (!options?.silent) {
          alert(`导出成功！已保存至：${savePath}`);
        }
        try {
          const recentListStr = localStorage.getItem("reveria.recentExports") || "[]";
          const recentList = JSON.parse(recentListStr);
          recentList.unshift({
            id: assetId,
            title: filename,
            path: savePath,
            time: new Date().toLocaleTimeString(),
          });
          if (recentList.length > 5) recentList.pop();
          localStorage.setItem("reveria.recentExports", JSON.stringify(recentList));
          window.dispatchEvent(new Event("recentExportsUpdated"));
        } catch (e) {
          console.error("Failed to update export history", e);
        }
        return true;
      }

      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return true;
    } catch (err: any) {
      console.error("Export error:", err);
      if (!options?.silent) {
        alert(`导出过程中发生错误: ${err.message || err}`);
      }
      return false;
    }
  };
  const handleUploadAndEditQuick = async (file: File) => {
    if (!currentUser) {
      setLoginCallback(() => () => {
        void handleUploadAndEditQuick(file);
      });
      setIsLoginModalOpen(true);
      return;
    }
    if (!activeWorkspace) {
      alert("未选择工作区，无法上传");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("workspace_id", activeWorkspace.id);
      if (selectedProjectId) {
        formData.append("project_id", selectedProjectId);
      }
      if (selectedCustomer?.id) {
        formData.append("customer_id", selectedCustomer.id);
      }
      formData.append("file", file);
      const asset = await uploadAsset(formData);
      setAssets((current) => [asset, ...current]);
      setEditingAsset(asset);
      return asset;
    } catch (err: any) {
      console.error("Failed to upload image for retouching:", err);
      alert(`上传失败: ${err.message || err}`);
    }
  };
  useEffect(() => {
    if (currentUser) {
      void refreshAll();
    }
  }, [currentUser]);
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerEditForm({ name: "", industry: "", notes: "" });
      return;
    }
    setCustomerEditForm({
      name: selectedCustomer.name,
      industry: selectedCustomer.industry ?? "",
      notes: selectedCustomer.notes ?? "",
    });
  }, [selectedCustomer?.id]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentUser(null);
      triggerLogin();
    };
    window.addEventListener("reveria-unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("reveria-unauthorized", handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedActiveView = localStorage.getItem("reveria.activeView");
      if (savedActiveView) {
        setActiveView(savedActiveView as AppView);
      }
      const savedProjectsViewMode = localStorage.getItem("reveria.projectsViewMode");
      if (savedProjectsViewMode) {
        setProjectsViewMode(savedProjectsViewMode as "list" | "detail");
      }
      const savedSelectedProjectId = localStorage.getItem("reveria.selectedProjectId");
      if (savedSelectedProjectId) {
        setSelectedProjectId(savedSelectedProjectId);
      }
    }
    setIsRestored(true);
  }, []);
  useEffect(() => {
    if (!isRestored) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("reveria.activeView", activeView);
    }
  }, [activeView, isRestored]);
  useEffect(() => {
    if (!isRestored) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("reveria.projectsViewMode", projectsViewMode);
    }
  }, [projectsViewMode, isRestored]);
  useEffect(() => {
    if (!isRestored) return;
    if (typeof window !== "undefined") {
      localStorage.setItem("reveria.selectedProjectId", selectedProjectId);
    }
  }, [selectedProjectId, isRestored]);
  const [realtimeCredits, setRealtimeCredits] = useState<number | null>(null);
  useEffect(() => {
    if (!activeWorkspace?.id) {
      setRealtimeCredits(null);
      return;
    }
    const fetchBalance = async () => {
      try {
        const res = await getJson<any>(`/api/credits/${activeWorkspace.id}/balance`);
        if (res && typeof res.total_credits === "number") {
          setRealtimeCredits(res.total_credits);
        }
      } catch (err) {
        console.error("Failed to fetch real-time balance in header:", err);
      }
    };
    void fetchBalance();
    const timer = setInterval(() => {
      void fetchBalance();
    }, 20000); // 20秒周期极速拉取同步
    return () => clearInterval(timer);
  }, [activeWorkspace?.id]);
  const creditBalance = realtimeCredits !== null 
    ? realtimeCredits 
    : activeWorkspace 
      ? ((activeWorkspace.recharge_balance ?? 0) + (activeWorkspace.gift_balance ?? 0) + (activeWorkspace.refund_balance ?? 0)) 
      : 0;
  const formattedCredits = formatCredits(creditBalance);
  const formattedRecharge = formatCredits(activeWorkspace?.recharge_balance);
  const formattedGift = formatCredits(activeWorkspace?.gift_balance);
  const formattedRefund = formatCredits(activeWorkspace?.refund_balance);
  const currentSubscriptionPlan = plans.find((plan) => plan.id === activeWorkspace?.plan_id && !plan.is_points_package)
    ?? (!activeWorkspace?.plan_id ? plans.find((plan) => !plan.is_points_package && plan.price_cents === 0) : undefined);
  const currentPlanLabel = planBadgeLabel(currentSubscriptionPlan);
  const currentRole = useMemo(() => {
    if (!currentUser || !activeWorkspace) return null;
    return currentUser.is_platform_admin ? "平台超级管理员" : "工作区成员";
  }, [currentUser, activeWorkspace]);
  useEffect(() => {
    if (currentUser) {
      setIsLoginModalOpen(false);
      if (loginCallback) {
        loginCallback();
        setLoginCallback(null);
      }
    }
  }, [currentUser, loginCallback]);
  const handleViewChange = (view: AppView) => {
    if (view === "square") {
      setActiveView("square");
      return;
    }
    if (!currentUser) {
      setLoginCallback(() => () => {
        setActiveView(view);
      });
      setIsLoginModalOpen(true);
    } else {
      setActiveView(view);
    }
  };
  async function refreshAll() {
    setIsRefreshing(true);
    try {
      await loadDashboard();
    } finally {
      setIsRefreshing(false);
    }
  }
  async function loadActiveModels() {
    try {
      const activeModels = await getJson<ModelSummary[]>("/api/models");
      setModels(activeModels.filter((m) => m.enabled));
    } catch (err) {
      console.error("Failed to load active models:", err);
    }
  }
  async function loadDashboard() {
    try {
      const data = await fetchDashboardData();
      const firstProjectId = data.projectData[0]?.id ?? "";
      const firstCustomerId = data.customerData[0]?.id ?? "";
      const firstBrandKitId = data.brandKitData[0]?.id ?? "";
      setWorkspaces(data.workspaceData);
      setCustomers(data.customerData);
      setBrandKits(data.brandKitData);
      setProjects(data.projectData);
      setBuildInfo(data.buildData);
      setTransactions(data.transactionData);
      setPlans(data.planData);
      setRechargeRecords(data.rechargeData);
      setSelectedCustomerId((current) => current || firstCustomerId);
      setSelectedBrandKitId((current) => current || firstBrandKitId);
      let finalProjectId = selectedProjectId;
      if (!finalProjectId && typeof window !== "undefined") {
        finalProjectId = localStorage.getItem("reveria.selectedProjectId") || "";
      }
      if (finalProjectId && !data.projectData.some((p) => p.id === finalProjectId)) {
        finalProjectId = "";
      }
      if (!finalProjectId) {
        finalProjectId = firstProjectId;
      }
      setSelectedProjectId(finalProjectId);
      if (finalProjectId) {
        void loadProjectAssets(finalProjectId);
        void loadProjectCanvas(finalProjectId);
      }
      await loadActiveModels();
      setIsApiOnline(true);
    } catch (err) {
      console.error("loadDashboard failed:", err);
      setWorkspaces([]);
      setCustomers([]);
      setBrandKits([]);
      setProjects([]);
      setBuildInfo(null);
      setPlans([]);
      setRechargeRecords([]);
      setSelectedCustomerId("");
      setSelectedBrandKitId("");
      setSelectedProjectId("");
      setAssets([]);
      setProjectCanvas(createEmptyCanvas());
      setTransactions([]);
      setIsApiOnline(false);
    }
  }
  async function handleSaveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCustomer) return;
    setIsSavingCustomer(true);
    try {
      const customer = await putJson<CustomerSummary>(`/api/customers/${selectedCustomer.id}`, {
        name: customerEditForm.name,
        industry: customerEditForm.industry || null,
        notes: customerEditForm.notes || null,
      });
      setCustomers((current) => current.map((item) => (item.id === customer.id ? customer : item)));
      setAdminMessage(`已保存客户：${customer.name}`);
    } finally {
      setIsSavingCustomer(false);
    }
  }
  async function deleteAsset(assetId: string) {
    setDeletingAssetId(assetId);
    try {
      await deleteJson<DeleteAssetResponse>(`/api/assets/${assetId}`);
      setAssets((current) => current.filter((asset) => asset.id !== assetId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      alert(`删除素材失败：${message}`);
    } finally {
      setDeletingAssetId("");
    }
  }
  async function loadProjectAssets(projectId: string) {
    try {
      const projectAssets = await getJson<AssetSummary[]>(`/api/assets?project_id=${encodeURIComponent(projectId)}`);
      setAssets(projectAssets);
    } catch {
      setAssets([]);
    }
  }
  async function loadProjectCanvas(projectId: string) {
    // 请求序号守卫：快速切换项目时两次 GET 可能乱序返回，
    // 若不校验，后到的旧响应会把画布换成上一个项目的文档，此时点保存就会写串项目。
    const requestSeq = ++canvasLoadSeqRef.current;
    try {
      const response = await getJson<ProjectCanvasSummary>(`/api/projects/${projectId}/canvas`);
      if (requestSeq !== canvasLoadSeqRef.current) return;
      setProjectCanvas(normalizeCanvas(response.canvas));
    } catch {
      if (requestSeq !== canvasLoadSeqRef.current) return;
      // 加载失败时保持内存中的文档不动。
      // 清空是危险的：模板轮询/自愈保存随后触发时会把这份空文档 PUT 回服务端，等于删库。
      console.error(`[loadProjectCanvas] 项目 ${projectId} 画布加载失败，保留当前内存文档`);
    }
  }
  function exportCurrentProject(format: "json" | "markdown") {
    handleExportProject(
      format,
      selectedProject,
      assets,
      activeWorkspace,
      customers,
      brandKits,
      transactions
    );
  }
  const isNoSidebar = ((activeView === "projects" && projectsViewMode === "detail") || activeView === "admin") && currentUser !== null;
  const isNoHeader = (activeView === "admin" || (activeView === "projects" && projectsViewMode === "detail")) && currentUser !== null;
  return (
    <div className="rv-app-wrapper" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {!isNoHeader && (
        <HeaderBar
          currentUser={currentUser}
          activeView={activeView}
          projectsViewMode={projectsViewMode}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          currentPlanLabel={currentPlanLabel}
          formattedCredits={formattedCredits}
          isHeaderUserDropdownOpen={isHeaderUserDropdownOpen}
          setIsHeaderUserDropdownOpen={setIsHeaderUserDropdownOpen}
          handleViewChange={handleViewChange}
          handleLogout={handleLogout}
          setIsLoginModalOpen={setIsLoginModalOpen}
          setLoginCallback={setLoginCallback}
        />
      )}
      <main className={`app-shell ${isSidebarCollapsed ? "collapsed" : ""} ${isNoSidebar ? "no-sidebar" : ""} ${isNoHeader ? "no-header" : ""}`}>
        {!isNoSidebar && (
          <Sidebar
            isSidebarCollapsed={isSidebarCollapsed}
            setIsSidebarCollapsed={setIsSidebarCollapsed}
            activeView={activeView}
            setActiveView={handleViewChange}
            setAdminMessage={setAdminMessage}
            setProjectsViewMode={setProjectsViewMode}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            setSelectedCategoryId={setSelectedCategoryId}
            setSelectedSubCategoryId={setSelectedSubCategoryId}
            setSelectedWorkflowType={setSelectedWorkflowType}
          />
        )}
        <Suspense fallback={<div className="app-route-loading" aria-busy="true" /> }>
        <MainRouter
          activeView={activeView}
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          triggerLogin={triggerLogin}
          setIsNewProjectModalOpen={setIsNewProjectModalOpen}
          setActiveView={setActiveView}
          setSelectedProjectId={setSelectedProjectId}
          loadProjectAssets={loadProjectAssets}
          loadProjectCanvas={loadProjectCanvas}
          setProjectsViewMode={setProjectsViewMode}
          handleViewChange={handleViewChange}
          exportCurrentProject={exportCurrentProject}
          handleSaveRetouchSettings={handleSaveRetouchSettings}
          handleLoadRetouchSettings={handleLoadRetouchSettings}
          handleExportRetouchImage={handleExportRetouchImage}
          handleSaveCustomer={handleSaveCustomer}
          deleteAsset={deleteAsset}
          handleCreateOrder={handleCreateOrder}
          loadActiveModels={loadActiveModels}
          activeWorkspace={activeWorkspace}
          isApiOnline={isApiOnline}
          formattedCredits={formattedCredits}
          projects={projects}
          setProjects={setProjects}
          selectedProject={selectedProject || undefined}
          projectsViewMode={projectsViewMode}
          assets={assets}
          setAssets={setAssets}
          projectCanvas={projectCanvas}
          setProjectCanvas={setProjectCanvas}
          customers={customers}
          setCustomers={setCustomers}
          brandKits={brandKits}
          setBrandKits={setBrandKits}
          currentRole={currentRole}
          transactions={transactions}
          setTransactions={setTransactions as any}
          setTasks={setTasks}
          setSelectedTaskId={setSelectedTaskId}
          setTaskDetail={setTaskDetail}
          deletingAssetId={deletingAssetId}
          models={models}
          setPreviewAsset={setPreviewAsset}
          setRetouchInitialSettings={setRetouchInitialSettings}
          setEditingAsset={setEditingAsset}
          selectedCustomer={selectedCustomer || undefined}
          setSelectedCustomerId={setSelectedCustomerId}
          customerEditForm={customerEditForm}
          setCustomerEditForm={setCustomerEditForm}
          isSavingCustomer={isSavingCustomer}
          plans={plans}
          rechargeRecords={rechargeRecords}
          pendingOrder={pendingOrder}
          isCreatingOrder={isCreatingOrder}
          creditsTab={creditsTab}
          setCreditsTab={setCreditsTab}
          formattedRecharge={formattedRecharge}
          formattedGift={formattedGift}
          formattedRefund={formattedRefund}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          categories={categories}
          setCategories={setCategories}
          selectedWorkflowType={selectedWorkflowType}
          setSelectedWorkflowType={setSelectedWorkflowType}
          selectedCategoryId={selectedCategoryId}
          setSelectedCategoryId={setSelectedCategoryId}
          selectedSubCategoryId={selectedSubCategoryId}
          setSelectedSubCategoryId={setSelectedSubCategoryId}
          tasks={tasks}
        />
        </Suspense>
        {previewAsset ? (
          <AssetPreviewDialog
            asset={previewAsset}
            setPreviewAsset={setPreviewAsset}
            onEnterEditor={
              typeof window !== "undefined" && (window as any).go?.main?.App
                ? (asset) => setEditingAsset(asset)
                : undefined
            }
          />
        ) : null}
        {editingAsset && (
          <AssetEditorWorkbench
            asset={editingAsset}
            projectAssets={assets}
            onClose={() => {
              setEditingAsset(null);
              setRetouchInitialSettings(null);
            }}
            onSaveSettings={handleSaveRetouchSettings}
            onLoadSettings={handleLoadRetouchSettings}
            onExportImage={handleExportRetouchImage}
            onUpload={handleUploadAndEditQuick}
            initialSettings={retouchInitialSettings || undefined}
            onAssetsRefresh={() => { if (selectedProjectId) void loadProjectAssets(selectedProjectId); }}
          />
        )}
        <InvitationModal
          inviteToken={inviteToken}
          invitedClaims={invitedClaims}
          currentUser={currentUser}
          inviteError={inviteError}
          isAcceptingInvite={isAcceptingInvite}
          handleAcceptInvitation={handleAcceptInvitation}
          handleCancelInvitation={handleCancelInvitation}
        />
        <NewProjectModal
          isOpen={isNewProjectModalOpen}
          onClose={() => setIsNewProjectModalOpen(false)}
          activeWorkspace={activeWorkspace}
          currentUser={currentUser}
          customers={customers}
          brandKits={brandKits}
          onSuccess={(project, customer, brandKit, existingCid, existingBid) => {
            setProjects((current) => [project, ...current]);
            setSelectedProjectId(project.id);
            setAssets([]);
            if (customer) {
              setCustomers((current) => [customer, ...current]);
              setSelectedCustomerId(customer.id);
            } else if (existingCid) {
              setSelectedCustomerId(existingCid);
            }
            if (brandKit) {
              setBrandKits((current) => [brandKit, ...current]);
              setSelectedBrandKitId(brandKit.id);
            } else if (existingBid) {
              setSelectedBrandKitId(existingBid);
            }
            setActiveView("projects");
            setProjectsViewMode("detail");
            void loadProjectAssets(project.id);
            void loadProjectCanvas(project.id);
          }}
          onError={(msg) => {
            setAdminMessage(msg);
            alert(msg);
          }}
        />
      </main>
      {isLoginModalOpen && (
        <LoginView
          isModal
          onClose={() => setIsLoginModalOpen(false)}
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          loginMode={loginMode}
          setLoginMode={setLoginMode}
          loginMessage={loginMessage}
          inviteToken={inviteToken}
          invitedClaims={invitedClaims}
          isLoggingIn={isLoggingIn}
          handlePasswordAuth={handlePasswordAuth}
          handleDevLogin={handleDevLogin}
        />
      )}
    </div>
  );
}
