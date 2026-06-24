import { FormEvent, useEffect, useMemo, useState } from "react";
import { LogOut, History, Coins, Settings, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("reveria.sidebarCollapsed") === "true";
    }
    return false;
  });
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
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
    displayName: "开发用户",
    email: "dev@reveria.local",
    password: "",
  });
  const [loginMode, setLoginMode] = useState<"login" | "register" | "dev">("login");
  const [loginMessage, setLoginMessage] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeView, setActiveView] = useState<AppView>("workbench");
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

  const formattedCredits = formatCredits(activeWorkspace?.credit_balance);
  const formattedRecharge = formatCredits(activeWorkspace?.recharge_balance);
  const formattedGift = formatCredits(activeWorkspace?.gift_balance);
  const formattedRefund = formatCredits(activeWorkspace?.refund_balance);

  const currentRole = useMemo(() => {
    if (!currentUser || !activeWorkspace) return null;
    return currentUser.is_platform_admin ? "平台超级管理员" : "工作区成员";
  }, [currentUser, activeWorkspace]);

  async function restoreCurrentUser() {
    try {
      const cached = readCachedUser();
      if (cached) {
        setCurrentUser(cached);
        await refreshAccessToken();
      }
    } catch {
      // Quiet fail
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
      setSelectedProjectId((current) => current || firstProjectId);
      if (firstProjectId) {
        void loadProjectAssets(firstProjectId);
        void loadProjectCanvas(firstProjectId);
      }
      try {
        const activeModels = await getJson<ModelSummary[]>("/api/admin/models");
        setModels(activeModels.filter((m) => m.enabled));
      } catch (err) {
        console.error("Failed to load active models in dashboard:", err);
      }
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
            onBack={() => setActiveView("workbench")}
          />
        );
      default:
        return null;
    }
  }

  const isNoSidebar = activeView === "projects" && projectsViewMode === "detail";

  if (!currentUser) {
    return (
      <LoginView
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
    );
  }

  return (
    <main className={`app-shell ${isSidebarCollapsed ? "collapsed" : ""} ${isNoSidebar ? "no-sidebar" : ""}`}>
      {!isNoSidebar && (
        <Sidebar
          currentUser={currentUser!}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          isUserDropdownOpen={isUserDropdownOpen}
          setIsUserDropdownOpen={setIsUserDropdownOpen}
          activeView={activeView}
          setActiveView={setActiveView}
          setAdminMessage={setAdminMessage}
          setProjectsViewMode={setProjectsViewMode}
          handleLogout={handleLogout}
          formattedCredits={formattedCredits}
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
  );
}
