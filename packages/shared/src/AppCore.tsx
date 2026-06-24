import { FormEvent, useEffect, useMemo, useState } from "react";
import { LogOut, History, Coins, Settings, ChevronLeft, ChevronRight, Menu, Camera, Search, Sparkles, ChevronDown, Bell, ClipboardList, FileText } from "lucide-react";
import { navItems } from "./types";
import {
  AppView,
  ProjectCommentSummary,
  ProjectShareSummary,
  PortalProjectDetails,
  WorkspaceSummary,
  PlanSummary,
  OrderSummary,
  RechargeRecordSummary,
  UserSummary,
  DevLoginResponse,
  BuildInfoResponse,
  ProjectSummary,
  CustomerSummary,
  BrandKitSummary,
  AssetSummary,
  ProjectCanvasDocument,
  CreditTransactionSummary,
  WorkspaceMemberSummary,
  GenerationTaskSummary,
  GenerationTaskDetail,
  CurrentUserResponse,
  AuthTokenResponse,
  WorkspaceCostReportResponse,
  DeleteAssetResponse,
  ProjectCanvasSummary,
  ModelSummary,
} from "./types";
import {
  API_BASE,
  CURRENT_USER_STORAGE_KEY,
  ACCESS_TOKEN_STORAGE_KEY,
  parseJwt,
  createEmptyCanvas,
  normalizeCanvas,
  readCachedUser,
  getJson,
  postJson,
  putJson,
  deleteJson,
  handleExportProject,
  formatCredits,
  fetchDashboardData,
} from "./utils";

// Subview components
import { LoginView } from "./components/auth/LoginView";
import { ModelSquare } from "./components/square/ModelSquare";
import { DashboardView } from "./components/dashboard/DashboardView";
import { ProjectsView } from "./components/project/ProjectsView";
import { CustomersView } from "./components/customer/CustomersView";
import { AssetsView } from "./components/asset/AssetsView";
import { HistoryView } from "./components/history/HistoryView";
import { CreditsView } from "./components/credits/CreditsView";
import { AdminConsole } from "./components/admin/AdminConsole";

// Dialog/Modal components
import { NewProjectModal } from "./components/project/NewProjectModal";
import { InvitationModal } from "./components/auth/InvitationModal";
import { AssetPreviewDialog } from "./components/asset/AssetPreviewDialog";
import { ClientPortalView } from "./components/portal/ClientPortalView";
import { Sidebar } from "./components/common/Sidebar";

export function AppCore() {
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("reveria.sidebarCollapsed");
      if (saved === "true") {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  const [isHeaderUserDropdownOpen, setIsHeaderUserDropdownOpen] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);

  // Client Portal State
  const [shareToken, setShareToken] = useState<string | null>(null);

  // Invitation Workspace State
  const [invitedClaims, setInvitedClaims] = useState<{
    sub: string;
    workspace_id: string;
    workspace_name: string;
    role: string;
    exp: number;
  } | null>(null);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [loginForm, setLoginForm] = useState({
    displayName: "",
    email: "",
    password: "",
  });
  const [loginMode, setLoginMode] = useState<"login" | "register" | "dev">("login");
  const [loginMessage, setLoginMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeView, setActiveView] = useState<AppView>("square");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedWorkflowType, setSelectedWorkflowType] = useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string>("all");

  useEffect(() => {
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
  }, []);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loginCallback, setLoginCallback] = useState<(() => void) | null>(null);
  const triggerLogin = (callback?: () => void) => {
    if (callback) {
      setLoginCallback(() => callback);
    }
    setIsLoginModalOpen(true);
  };
  const [projectsViewMode, setProjectsViewMode] = useState<"list" | "detail">("list");
  
  // 核心共享业务状态
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [brandKits, setBrandKits] = useState<BrandKitSummary[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [projectCanvas, setProjectCanvas] = useState<ProjectCanvasDocument>(createEmptyCanvas());

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedBrandKitId, setSelectedBrandKitId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isRestored, setIsRestored] = useState(false);

  const [customerEditForm, setCustomerEditForm] = useState({ name: "", industry: "", notes: "" });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  const [transactions, setTransactions] = useState<CreditTransactionSummary[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [buildInfo, setBuildInfo] = useState<BuildInfoResponse | null>(null);
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [rechargeRecords, setRechargeRecords] = useState<RechargeRecordSummary[]>([]);
  const [pendingOrder, setPendingOrder] = useState<OrderSummary | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isPayingOrder, setIsPayingOrder] = useState(false);
  const [creditsTab, setCreditsTab] = useState<"transactions" | "recharges">("transactions");

  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [taskDetail, setTaskDetail] = useState<GenerationTaskDetail | null>(null);
  const [isApiOnline, setIsApiOnline] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tasks, setTasks] = useState<GenerationTaskSummary[]>([]);

  const [previewAsset, setPreviewAsset] = useState<AssetSummary | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState("");
  const [adminMessage, setAdminMessage] = useState("");

  const activeWorkspace = workspaces[0];
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? customers[0];
  const selectedBrandKit = brandKits.find((b) => b.id === selectedBrandKitId) ?? brandKits[0];
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareTokenParam = params.get("share_token");
    if (shareTokenParam) {
      setShareToken(shareTokenParam);
      return;
    }

    void restoreCurrentUser();

    const token = params.get("token");
    if (token) {
      setInviteToken(token);
      const claims = parseJwt(token);
      if (claims) {
        setInvitedClaims(claims);
        setLoginForm((prev) => ({
          ...prev,
          email: claims.sub || "",
          displayName: prev.displayName === "开发用户" ? "" : prev.displayName,
        }));
        setLoginMode("register");
      }
    }
  }, []);

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

  // 恢复本地存储状态
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

  // 状态变化同步至 localStorage
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

  const formattedCredits = formatCredits(activeWorkspace?.credit_balance);
  const formattedRecharge = formatCredits(activeWorkspace?.recharge_balance);
  const formattedGift = formatCredits(activeWorkspace?.gift_balance);
  const formattedRefund = formatCredits(activeWorkspace?.refund_balance);

  const currentRole = useMemo(() => {
    if (!currentUser || !activeWorkspace) return null;
    return currentUser.is_platform_admin ? "平台超级管理员" : "工作区成员";
  }, [currentUser, activeWorkspace]);

  // 登录态恢复与成功回调的监听
  useEffect(() => {
    if (currentUser) {
      setIsLoginModalOpen(false);
      if (loginCallback) {
        loginCallback();
        setLoginCallback(null);
      }
    }
  }, [currentUser, loginCallback]);

  // 包裹的视图切换，如果是游客状态则拦截核心页并弹窗登录
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

  async function restoreCurrentUser() {
    try {
      const cached = readCachedUser();
      if (cached) {
        setCurrentUser(cached);
        await refreshAccessToken();
      }
    } catch {
      // Quiet fail - clear stale session data if token refresh fails
      setCurrentUser(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      }
    }
  }

  async function handleLogout() {
    try {
      await postJson<void>("/api/auth/logout", {});
    } catch {
      // Quiet fail
    } finally {
      if (typeof window !== "undefined") {
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      }
      setCurrentUser(null);
    }
  }

  async function refreshAccessToken() {
    const response = await postJson<AuthTokenResponse>("/api/auth/refresh", {});
    if (typeof window !== "undefined") {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.access_token);
    }
  }

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
      const activeModels = await getJson<ModelSummary[]>("/api/admin/models");
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

  async function handlePasswordAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoggingIn(true);
    setLoginMessage("");
    try {
      const response =
        loginMode === "register"
          ? await postJson<DevLoginResponse>("/api/auth/register", {
              display_name: loginForm.displayName,
              email: loginForm.email,
              password: loginForm.password,
            })
          : await postJson<DevLoginResponse>("/api/auth/login", {
              email: loginForm.email,
              password: loginForm.password,
            });
      if (response.access_token && typeof window !== "undefined") {
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.access_token);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      setCurrentUser(response.user);

      if (inviteToken && response.user.email?.toLowerCase() === invitedClaims?.sub?.toLowerCase()) {
        if (loginMode === "register") {
          try {
            await postJson("/api/invitations/accept", { token: inviteToken });
            setInviteToken(null);
            setInvitedClaims(null);
            const url = new URL(window.location.href);
            url.searchParams.delete("token");
            window.history.replaceState({}, document.title, url.pathname + url.search);
            await refreshAll();
          } catch (err) {
            console.error("Auto-accept invitation failed:", err);
          }
        }
      }
    } catch {
      setLoginMessage(
        loginMode === "register"
          ? "注册失败：邮箱可能已存在，密码至少 8 位"
          : "登录失败：请检查邮箱、密码以及数据库连接"
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleDevLogin() {
    setIsLoggingIn(true);
    setLoginMessage("");
    try {
      const email = inviteToken && invitedClaims ? invitedClaims.sub : (loginForm.email || null);
      const displayName = loginForm.displayName || "开发用户";
      const response = await postJson<DevLoginResponse>("/api/auth/dev-login", {
        display_name: displayName,
        email: email,
      });
      if (response.access_token && typeof window !== "undefined") {
        localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, response.access_token);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(response.user));
      }
      setCurrentUser(response.user);

      if (inviteToken && response.user.email?.toLowerCase() === invitedClaims?.sub?.toLowerCase()) {
        try {
          await postJson("/api/invitations/accept", { token: inviteToken });
          setInviteToken(null);
          setInvitedClaims(null);
          const url = new URL(window.location.href);
          url.searchParams.delete("token");
          window.history.replaceState({}, document.title, url.pathname + url.search);
          await refreshAll();
        } catch (err) {
          console.error("Auto-accept invitation failed:", err);
        }
      }
    } catch {
      setLoginMessage("开发登录失败：请确认数据库已连接并完成迁移");
    } finally {
      setIsLoggingIn(false);
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
      const result = await deleteJson<DeleteAssetResponse>(`/api/assets/${assetId}`);
      if (result.deleted) {
        setAssets((current) => current.filter((asset) => asset.id !== result.asset_id));
      }
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
    try {
      const response = await getJson<ProjectCanvasSummary>(`/api/projects/${projectId}/canvas`);
      setProjectCanvas(normalizeCanvas(response.canvas));
    } catch {
      setProjectCanvas(createEmptyCanvas());
    }
  }

  async function handleCreateOrder(planId: string) {
    if (!activeWorkspace) {
      setAdminMessage("创建订单失败：请先选择一个工作区");
      return;
    }
    setIsCreatingOrder(true);
    setAdminMessage("");
    try {
      const order = await postJson<OrderSummary>("/api/billing/orders", {
        workspace_id: activeWorkspace.id,
        plan_id: planId,
      });
      setPendingOrder(order);
      setAdminMessage(`订单已创建！请点击下方的「模拟支付」完成升级。`);
    } catch (err: any) {
      setAdminMessage(`创建订单失败: ${err.message || err}`);
    } finally {
      setIsCreatingOrder(false);
    }
  }

  async function handleMockPay() {
    if (!pendingOrder) return;
    setIsPayingOrder(true);
    setAdminMessage("");
    try {
      await postJson<OrderSummary>(`/api/admin/billing/orders/${pendingOrder.id}/mock-pay`, {});
      setPendingOrder(null);
      setAdminMessage(`支付成功！已升级套餐并充值点数。`);
      await refreshAll();
    } catch (err: any) {
      setAdminMessage(`模拟支付失败: ${err.message || err}`);
    } finally {
      setIsPayingOrder(false);
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

  async function handleAcceptInvitation() {
    if (!inviteToken) return;
    setIsAcceptingInvite(true);
    setInviteError(null);
    try {
      await postJson("/api/invitations/accept", { token: inviteToken });
      setInviteToken(null);
      setInvitedClaims(null);
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, document.title, url.pathname + url.search);
      await refreshAll();
    } catch (err: any) {
      setInviteError(err.message || "接受邀请失败");
    } finally {
      setIsAcceptingInvite(false);
    }
  }

  function handleCancelInvitation() {
    setInviteToken(null);
    setInvitedClaims(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState({}, document.title, url.pathname + url.search);
  }

  function renderActiveView() {
    switch (activeView) {
      case "square":
        return (
          <ModelSquare
            currentUser={currentUser}
            triggerLogin={triggerLogin}
            onUseTemplate={(template) => {
              setIsNewProjectModalOpen(true);
              setActiveView("workbench");
            }}
            onNavigateToView={handleViewChange}
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
          />
        );
      case "workbench":
        return (
          <DashboardView
            activeWorkspace={activeWorkspace}
            isApiOnline={isApiOnline}
            formattedCredits={formattedCredits}
            projects={projects}
            tasks={tasks}
            transactions={transactions}
            setIsNewProjectModalOpen={setIsNewProjectModalOpen}
            setActiveView={setActiveView}
            setSelectedProjectId={setSelectedProjectId}
            loadProjectAssets={loadProjectAssets}
            loadProjectCanvas={loadProjectCanvas}
            setProjectsViewMode={setProjectsViewMode}
            customers={customers}
            brandKits={brandKits}
          />
        );
      case "projects":
        return (
          <ProjectsView
            activeWorkspace={activeWorkspace}
            projects={projects}
            setProjects={setProjects}
            setSelectedProjectId={setSelectedProjectId}
            selectedProject={selectedProject}
            projectsViewMode={projectsViewMode}
            setProjectsViewMode={setProjectsViewMode}
            assets={assets}
            setAssets={setAssets}
            projectCanvas={projectCanvas}
            setProjectCanvas={setProjectCanvas}
            loadProjectAssets={loadProjectAssets}
            loadProjectCanvas={loadProjectCanvas}
            customers={customers}
            brandKits={brandKits}
            currentRole={currentRole ?? "工作区成员"}
            currentUser={currentUser}
            transactions={transactions}
            setTransactions={setTransactions as any}
            setTasks={setTasks}
            setSelectedTaskId={setSelectedTaskId}
            setTaskDetail={setTaskDetail}
            deletingAssetId={deletingAssetId}
            deleteAsset={deleteAsset}
            setPreviewAsset={setPreviewAsset}
            setIsNewProjectModalOpen={setIsNewProjectModalOpen}
            models={models}
          />
        );
      case "customers":
        return (
          <CustomersView
            customers={customers}
            setCustomers={setCustomers}
            selectedCustomer={selectedCustomer}
            setSelectedCustomerId={setSelectedCustomerId}
            projects={projects}
            brandKits={brandKits}
            setBrandKits={setBrandKits}
            customerEditForm={customerEditForm}
            setCustomerEditForm={setCustomerEditForm}
            handleSaveCustomer={handleSaveCustomer}
            isSavingCustomer={isSavingCustomer}
            setActiveView={setActiveView}
            setSelectedProjectId={setSelectedProjectId}
          />
        );
      case "assets":
        return (
          <AssetsView
            assets={assets}
            setAssets={setAssets}
            selectedProject={selectedProject}
            activeWorkspace={activeWorkspace}
            currentUser={currentUser!}
            setPreviewAsset={setPreviewAsset}
            deleteAsset={deleteAsset}
            deletingAssetId={deletingAssetId}
          />
        );
      case "history":
        return (
          <HistoryView
            assets={assets}
            selectedProject={selectedProject}
            exportCurrentProject={exportCurrentProject}
          />
        );
      case "credits":
        return (
          <CreditsView
            activeWorkspace={activeWorkspace}
            plans={plans}
            transactions={transactions}
            rechargeRecords={rechargeRecords}
            pendingOrder={pendingOrder}
            isPayingOrder={isPayingOrder}
            isCreatingOrder={isCreatingOrder}
            creditsTab={creditsTab}
            setCreditsTab={setCreditsTab}
            handleMockPay={handleMockPay}
            handleCreateOrder={handleCreateOrder}
            formattedCredits={formattedCredits}
            formattedRecharge={formattedRecharge}
            formattedGift={formattedGift}
            formattedRefund={formattedRefund}
          />
        );
      case "admin":
        return (
          <AdminConsole
            activeWorkspace={activeWorkspace}
            isApiOnline={isApiOnline}
            formattedCredits={formattedCredits}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            onBack={() => {
              setActiveView("workbench");
              void loadActiveModels();
            }}
          />
        );
      default:
        return null;
    }
  }

  const isNoSidebar = (activeView === "projects" && projectsViewMode === "detail") || !currentUser || activeView === "admin";

  const renderHeader = () => {
    return (
      <header className="rv-global-header">
        {/* 左侧：菜单开关 + Logo */}
        <div className="header-left">
          <button 
            type="button" 
            className="rv-header-toggle-btn"
            onClick={() => {
              const nextState = !isSidebarCollapsed;
              setIsSidebarCollapsed(nextState);
              localStorage.setItem("reveria.sidebarCollapsed", String(nextState));
            }}
            title={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            <Menu size={18} />
          </button>
          
          <div 
            className="header-brand" 
            onClick={() => handleViewChange("square")}
          >
            <div className="brand-logo-icon">R</div>
            <span className="brand-logo-text">Reveria</span>
          </div>
        </div>
        
        {/* 中间：全局搜索框 */}
        <div className="header-middle">
          <div className="header-search-bar">
            <span className="search-category-tag">模型</span>
            <div className="search-input-wrapper">
              <input 
                type="text" 
                placeholder="搜索感兴趣的 AI 绘图模板、模型或标签..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="search-action-icons">
                <Camera size={16} className="camera-icon" onClick={() => alert("以图搜图功能即将开放")} />
                <Search size={16} className="search-icon" />
              </div>
            </div>
          </div>
        </div>
        
        {/* 右侧：动作与用户状态 */}
        <div className="header-right">
          {/* 开始创作 按钮 */}
          <button 
            type="button" 
            className="btn-create-magic"
            onClick={() => {
              if (!currentUser) {
                triggerLogin(() => handleViewChange("workbench"));
              } else {
                handleViewChange("workbench");
              }
            }}
          >
            <Sparkles size={14} />
            <span>开始创作</span>
            <ChevronDown size={12} className="chevron-down-icon" />
          </button>
          
          {/* 文档 按钮 */}
          <button 
            type="button" 
            className="btn-publish-project"
            onClick={() => {
              alert("文档中心功能即将开放，敬请期待！");
            }}
            style={{ display: "flex", alignItems: "center", gap: "6px" }}
          >
            <FileText size={14} />
            <span>文档</span>
          </button>

          {currentUser ? (
            <>
              {/* PRO 算力额度 */}
              <div className="pro-credits-badge">
                <span className="pro-label">PRO</span>
                <span className="credits-val">{formattedCredits} 点</span>
              </div>
              
              {/* 系统后台入口（仅管理员） */}
              {currentUser.is_platform_admin && (
                <button
                  type="button"
                  className="btn-admin-entrance"
                  onClick={() => handleViewChange("admin")}
                  title="进入系统管理后台"
                >
                  后台管理
                </button>
              )}
              
              {/* 消息与任务图标 */}
              <div className="header-icon-actions">
                <button type="button" className="icon-btn-item" title="消息通知" onClick={() => alert("暂无新通知")}>
                  <Bell size={18} />
                </button>
                <button type="button" className="icon-btn-item" title="任务列表" onClick={() => alert("当前无正在进行的算力任务")}>
                  <ClipboardList size={18} />
                </button>
              </div>
              
              {/* 用户头像与菜单 */}
              <div className="user-profile-menu-container">
                <button
                  type="button"
                  className="user-profile-menu-trigger"
                  onClick={() => setIsHeaderUserDropdownOpen(!isHeaderUserDropdownOpen)}
                >
                  <div className="user-avatar-circle" style={{ margin: 0 }}>
                    {(currentUser.display_name || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <span className="user-display-name">
                    {currentUser.display_name}
                  </span>
                  <ChevronDown size={14} style={{ color: "#a8a29e", transform: isHeaderUserDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>

                {isHeaderUserDropdownOpen && (
                  <div className="header-user-dropdown">
                    <div className="dropdown-header">
                      <strong>{currentUser.display_name}</strong>
                      <span>{currentUser.email || "开发用户"}</span>
                    </div>

                    <button
                      className="dropdown-item"
                      type="button"
                      onClick={() => {
                        setIsHeaderUserDropdownOpen(false);
                        handleViewChange("history");
                      }}
                    >
                      <History size={14} />
                      <span>生成历史</span>
                    </button>

                    <button
                      className="dropdown-item"
                      type="button"
                      onClick={() => {
                        setIsHeaderUserDropdownOpen(false);
                        handleViewChange("credits");
                      }}
                    >
                      <Coins size={14} />
                      <span>点数中心</span>
                    </button>

                    <div className="dropdown-divider" />

                    <button
                      className="dropdown-item logout"
                      type="button"
                      onClick={() => {
                        setIsHeaderUserDropdownOpen(false);
                        void handleLogout();
                      }}
                    >
                      <LogOut size={14} />
                      <span>退出登录</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 未登录时的登入按钮 */
            <button
              type="button"
              className="btn-login-entrance"
              onClick={() => {
                setLoginCallback(null);
                setIsLoginModalOpen(true);
              }}
            >
              登入
            </button>
          )}
        </div>
      </header>
    );
  };

  const isNoHeader = activeView === "admin" || (activeView === "projects" && projectsViewMode === "detail");

  return (
    <div className="rv-app-wrapper" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {!isNoHeader && renderHeader()}
      
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

        {renderActiveView()}

        {previewAsset ? (
          <AssetPreviewDialog asset={previewAsset} setPreviewAsset={setPreviewAsset} />
        ) : null}

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
