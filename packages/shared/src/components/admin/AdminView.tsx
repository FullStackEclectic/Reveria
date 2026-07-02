import React, { useState } from "react";
import { RefreshCw, LayoutDashboard, Cpu, Users, Layers, ShieldCheck, FileText, Settings, Globe, Server, CheckCircle, Info, HelpCircle } from "lucide-react";
import {
  WorkspaceSummary,
  ProviderSummary,
  ModelSummary,
  UserSummary,
  WorkspaceMemberSummary,
  PricingRuleSummary,
  WorkflowTemplateSummary,
  WorkspaceCostReportResponse,
  GenerationTaskSummary,
} from "../../types";
import "./AdminView.css";
import { getJson } from "../../utils";

import { Metric } from "../common/Metric";
import { PageFrame } from "../common/PageFrame";

// Subpanels
import { SystemStatusPanel } from "./SystemStatusPanel";
import { ProviderAdminPanel } from "./ProviderAdminPanel";
import { WorkspaceMemberPanel } from "./WorkspaceMemberPanel";
import { ModelCatalogPanel } from "./ModelCatalogPanel";
import { WorkflowTaskPanel } from "./WorkflowTaskPanel";
import { TemplateAdminPanel } from "./TemplateAdminPanel";
import { ClientSettingsPanel } from "./ClientSettingsPanel";

interface AdminViewProps {
  activeWorkspace?: WorkspaceSummary;
  isApiOnline: boolean;
  formattedCredits: string;
  isRefreshing: boolean;
  refreshAll: () => Promise<void>;
  providers: ProviderSummary[];
  setProviders: React.Dispatch<React.SetStateAction<ProviderSummary[]>>;
  models: ModelSummary[];
  setModels: React.Dispatch<React.SetStateAction<ModelSummary[]>>;
  adminUsers: UserSummary[];
  setAdminUsers: React.Dispatch<React.SetStateAction<UserSummary[]>>;
  workspaceMembers: WorkspaceMemberSummary[];
  setWorkspaceMembers: React.Dispatch<React.SetStateAction<WorkspaceMemberSummary[]>>;
  pricingRules: PricingRuleSummary[];
  setPricingRules: React.Dispatch<React.SetStateAction<PricingRuleSummary[]>>;
  workflowTemplates: WorkflowTemplateSummary[];
  setWorkflowTemplates: React.Dispatch<React.SetStateAction<WorkflowTemplateSummary[]>>;
  costReport: WorkspaceCostReportResponse | null;
  tasks: GenerationTaskSummary[];
  setTasks: React.Dispatch<React.SetStateAction<GenerationTaskSummary[]>>;
  buildInfo: any;
  currentUser: UserSummary | null;
  setCurrentUser: (user: UserSummary | null) => void;
  transactions: any[];
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  setWorkspaces: React.Dispatch<React.SetStateAction<WorkspaceSummary[]>>;
}

export function AdminView({
  activeWorkspace,
  isApiOnline,
  formattedCredits,
  isRefreshing,
  refreshAll,
  providers,
  setProviders,
  models,
  setModels,
  adminUsers,
  setAdminUsers,
  workspaceMembers,
  setWorkspaceMembers,
  pricingRules,
  setPricingRules,
  workflowTemplates,
  setWorkflowTemplates,
  costReport,
  tasks,
  setTasks,
  buildInfo,
  currentUser,
  setCurrentUser,
  transactions,
  setTransactions,
  setWorkspaces,
}: AdminViewProps) {
  const [activeTab, setActiveTab] = useState<"system" | "channels" | "members" | "workflows" | "templates">("system");
  const [activeChannelSubTab, setActiveChannelSubTab] = useState<"settings" | "providers" | "models" | "test">("settings");
  const [adminMessage, setAdminMessage] = useState("");
  const [billingMode, setBillingMode] = useState<string>("standalone");
  const [channelModeDraft, setChannelModeDraft] = useState<"bridge" | "standalone">("standalone");

  React.useEffect(() => {
    async function loadMode() {
      try {
        const res = await getJson<any>("/api/admin/settings");
        const configData = res.data || res;
        if (configData && configData.billing_mode) {
          setBillingMode(configData.billing_mode);
          setChannelModeDraft(configData.billing_mode === "bridge" ? "bridge" : "standalone");
        }
      } catch (e) {
        console.error("Failed to load billing mode in AdminView:", e);
      }
    }
    loadMode();
  }, []);

  const tabItems = [
    { id: "system", label: "系统大盘", icon: LayoutDashboard },
    { id: "channels", label: "算力通道", icon: Cpu },
    { id: "members", label: "人员管理", icon: Users },
    { id: "workflows", label: "调度配置", icon: ShieldCheck },
    { id: "templates", label: "提示词模板", icon: FileText },
  ] as const;

  return (
    <div 
      className="admin-app-shell" 
      style={{ 
        display: "grid", 
        gridTemplateColumns: "240px 1fr", 
        minHeight: "100vh",
        background: "var(--rv-color-bg-base)"
      }}
    >
      {/* 1. 左侧整列侧边栏 (顶天立地) */}
      <aside 
        className="admin-sidebar" 
        style={{ 
          background: "var(--rv-color-bg-sidebar)",
          borderRight: "1px solid var(--rv-color-border-thin)",
          display: "flex", 
          flexDirection: "column", 
          padding: "32px 16px",
          gap: "32px"
        }}
      >
        {/* 侧边栏品牌区域 */}
        <div className="brand" style={{ padding: "0 8px" }}>
          <div className="brand-mark" style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--rv-color-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "16px", marginBottom: "8px" }}>A</div>
          <div>
            <h1 style={{ fontSize: "16px", margin: 0, fontWeight: "700" }}>Admin Console</h1>
            <p style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", margin: 0 }}>大模型后台管理</p>
          </div>
        </div>

        {/* 侧边栏选项卡导航 */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {tabItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                className={`admin-nav-item-btn ${isActive ? "active" : ""}`}
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setAdminMessage("");
                }}
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  minHeight: "40px",
                  padding: "10px 14px",
                  border: "none",
                  borderRadius: "var(--rv-radius-sm)",
                  background: isActive ? "var(--rv-color-primary-light)" : "transparent",
                  color: isActive ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                  fontWeight: isActive ? "700" : "500",
                  fontSize: "13px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s ease"
                }}
              >
                <Icon size={16} style={{ color: isActive ? "var(--rv-color-primary)" : "inherit" }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 2. 右侧主内容区域 */}
      <main className="admin-main" style={{ padding: "0", minWidth: 0, display: "flex", flexDirection: "column", gap: "0" }}>
        {/* 通知与反馈信息 */}
        {adminMessage && (
          <div className="notice" style={{ margin: "24px" }}>
            {adminMessage}
          </div>
        )}

        {/* 子视图分发 */}
        <section className="admin-tab-content" style={{ minWidth: 0 }}>
          {activeTab === "system" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "32px", background: "#f8fafc", minHeight: "100vh", width: "100%", boxSizing: "border-box" }}>
              <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "22px", fontWeight: "800", margin: "0 0 4px 0", color: "var(--rv-color-text-main)" }}>系统运行数据仪表盘</h2>
                  <p style={{ fontSize: "12px", color: "var(--rv-color-text-muted)", margin: 0 }}>
                    {activeWorkspace
                      ? `当前活跃工作区: ${activeWorkspace.name} · ${isApiOnline ? "大模型运营策略与计费实时生效中" : "API 服务连接已断开"}`
                      : "大模型后台管理"}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={isRefreshing}
                  onClick={refreshAll}
                  style={{
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    border: "1px solid var(--rv-color-border-thin)",
                    background: "#ffffff"
                  }}
                >
                  <RefreshCw
                    className={isRefreshing ? "spin" : undefined}
                    size={15}
                    aria-hidden="true"
                  />
                  刷新配置
                </button>
              </header>

              <SystemStatusPanel
                activeWorkspace={activeWorkspace}
                buildInfo={buildInfo}
                currentUser={currentUser}
                tasks={tasks}
                transactions={transactions}
                formattedCredits={formattedCredits}
                costReport={costReport}
                providersCount={providers.length}
                modelsCount={models.length}
              />
            </div>
          )}

          {activeTab === "channels" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "32px", background: "#f8fafc", minHeight: "100vh", width: "100%", boxSizing: "border-box" }}>
              
              {/* 页头大标题 */}
              <header style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "16px", marginBottom: "8px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px 0", color: "var(--rv-color-text-main)" }}>系统算力计费与渠道管理</h2>
                <p style={{ fontSize: "12px", color: "var(--rv-color-text-muted)", margin: 0 }}>配置修图分站的计费接入模式，管理中转服务商接入并对各大算力模型进行零售定价。</p>
              </header>

              {/* 顶级双运行模式选择卡片 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                {/* 1. 主站数据共通模式卡片 */}
                <div
                  onClick={() => {
                    setChannelModeDraft("bridge");
                  }}
                  className="mode-card"
                  style={{
                    padding: "20px 24px",
                    borderRadius: "12px",
                    border: `2px solid ${channelModeDraft === "bridge" ? "#0284c7" : "var(--rv-color-border-thin)"}`,
                    background: channelModeDraft === "bridge" ? "rgba(2, 132, 199, 0.02)" : "#ffffff",
                    cursor: "pointer",
                    position: "relative",
                    boxShadow: channelModeDraft === "bridge" ? "0 10px 25px -5px rgba(2, 132, 199, 0.1), 0 8px 10px -6px rgba(2, 132, 199, 0.1)" : "0 4px 6px -1px rgba(0,0,0,0.05)"
                  }}
                >
                  {/* 生效状态角标 */}
                  {billingMode === "bridge" && (
                    <div style={{ position: "absolute", top: "12px", right: "12px", background: "#ecfdf5", color: "#059669", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", border: "1px solid #a7f3d0" }}>
                      当前已生效
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{
                      background: channelModeDraft === "bridge" ? "rgba(2, 132, 199, 0.08)" : "var(--rv-color-bg-base)",
                      color: channelModeDraft === "bridge" ? "#0284c7" : "var(--rv-color-text-muted)",
                      padding: "10px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Globe size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 4px 0", color: channelModeDraft === "bridge" ? "#0284c7" : "var(--rv-color-text-main)" }}>主站数据共通模式 (Bridge Mode)</h4>
                      <p style={{ fontSize: "12px", color: "var(--rv-color-text-muted)", margin: 0, lineHeight: 1.5 }}>
                        直接使用主站账号余额。免去分站维护本地大模型及服务商接入的麻烦，一处配置多端共享。
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. 独立自营模式卡片 */}
                <div
                  onClick={() => {
                    setChannelModeDraft("standalone");
                  }}
                  className="mode-card"
                  style={{
                    padding: "20px 24px",
                    borderRadius: "12px",
                    border: `2px solid ${channelModeDraft === "standalone" ? "var(--rv-color-primary)" : "var(--rv-color-border-thin)"}`,
                    background: channelModeDraft === "standalone" ? "rgba(15, 118, 110, 0.02)" : "#ffffff",
                    cursor: "pointer",
                    position: "relative",
                    boxShadow: channelModeDraft === "standalone" ? "0 10px 25px -5px rgba(15, 118, 110, 0.1), 0 8px 10px -6px rgba(15, 118, 110, 0.1)" : "0 4px 6px -1px rgba(0,0,0,0.05)"
                  }}
                >
                  {/* 生效状态角标 */}
                  {billingMode === "standalone" && (
                    <div style={{ position: "absolute", top: "12px", right: "12px", background: "#ecfdf5", color: "#059669", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px", border: "1px solid #a7f3d0" }}>
                      当前已生效
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                    <div style={{
                      background: channelModeDraft === "standalone" ? "rgba(15, 118, 110, 0.08)" : "var(--rv-color-bg-base)",
                      color: channelModeDraft === "standalone" ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                      padding: "10px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <Server size={22} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 4px 0", color: channelModeDraft === "standalone" ? "var(--rv-color-primary)" : "var(--rv-color-text-main)" }}>独立自营自建模式 (Standalone Mode)</h4>
                      <p style={{ fontSize: "12px", color: "var(--rv-color-text-muted)", margin: 0, lineHeight: 1.5 }}>
                        本地独立核算计费。站长需要自行添加 API 服务商密钥渠道，并为每个模型独立制定零售价。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 下方分流渲染：依据用户选择的运行模式草稿 channelModeDraft */}
              {channelModeDraft === "bridge" ? (
                /* Bridge 模式下的对接配置，采用双栏网格 */
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 320px",
                  gap: "24px",
                  alignItems: "start",
                  marginTop: "8px"
                }}>
                  {/* 左栏：主站共通表单 */}
                  <div style={{ minWidth: 0 }}>
                    <ClientSettingsPanel
                      mode="bridge"
                      onSettingsSaved={(newMode) => {
                        setBillingMode(newMode);
                        refreshAll();
                      }}
                    />
                  </div>
                  {/* 右栏：运行监测与指南 */}
                  <div style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid var(--rv-color-border-thin)",
                    padding: "24px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.015)",
                    position: "sticky",
                    top: "24px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                    flexShrink: 0
                  }}>
                    {/* 1. 状态监测卡片 */}
                    <div>
                      <h4 style={{ fontSize: "13px", fontWeight: "700", color: "var(--rv-color-text-main)", margin: "0 0 14px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Info size={15} style={{ color: "#0284c7" }} />
                        <span>算力运行状态监测</span>
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "12px", color: "var(--rv-color-text-muted)" }}>主项目网关连通性</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div className="pulse-indicator-blue" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#0284c7" }} />
                            <span style={{ fontSize: "12px", color: "#0284c7", fontWeight: "600" }}>通信就绪</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "12px", color: "var(--rv-color-text-muted)" }}>内部对账日志服务</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div className="pulse-indicator-green" style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} />
                            <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "600" }}>在线留痕</span>
                          </div>
                        </div>
                        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "8px", marginTop: "2px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: "12px", color: "var(--rv-color-text-muted)" }}>已同步主站模型</span>
                          <span style={{ fontSize: "12px", color: "var(--rv-color-text-main)", fontWeight: "700" }}>自动实时透传</span>
                        </div>
                      </div>
                    </div>
                    {/* 2. 指南 */}
                    <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "16px" }}>
                      <h4 style={{ fontSize: "13px", fontWeight: "700", color: "var(--rv-color-text-main)", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "6px" }}>
                        <HelpCircle size={15} style={{ color: "var(--rv-color-text-muted)" }} />
                        <span>共通模式指南</span>
                      </h4>
                      <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <li style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                          <div style={{ minWidth: "6px", height: "6px", borderRadius: "50%", background: "#0284c7", marginTop: "6px" }} />
                          <p style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", margin: 0, lineHeight: 1.5 }}>
                            <strong>额度折算率</strong>：用户充值消费以 1 credit = 5000 quota 的固定汇率，实时在主站 Quota 结算划扣。
                          </p>
                        </li>
                        <li style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                          <div style={{ minWidth: "6px", height: "6px", borderRadius: "50%", background: "#0284c7", marginTop: "6px" }} />
                          <p style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", margin: 0, lineHeight: 1.5 }}>
                            <strong>零配置同步</strong>：分站前台展示的模型列表直接来自主站，无需导入或单独定价。
                          </p>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standalone 自营管理，满宽展示 */
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "-8px" }}>
                  <div 
                    className="assets-tabs-wrapper" 
                    style={{ 
                      display: "flex", 
                      gap: "6px", 
                      background: "rgba(255, 255, 255, 0.8)",
                      border: "1px solid var(--rv-color-border-thin)",
                      borderRadius: "8px",
                      padding: "4px",
                      alignSelf: "start",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveChannelSubTab("providers")}
                      className={`assets-tab-btn ${activeChannelSubTab === "providers" ? "active" : ""}`}
                      style={{
                        border: 0,
                        background: activeChannelSubTab === "providers" ? "rgba(15, 118, 110, 0.08)" : "transparent",
                        color: activeChannelSubTab === "providers" ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: "700",
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        whiteSpace: "nowrap"
                      }}
                    >
                      服务商
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveChannelSubTab("models")}
                      className={`assets-tab-btn ${activeChannelSubTab === "models" ? "active" : ""}`}
                      style={{
                        border: 0,
                        background: activeChannelSubTab === "models" ? "rgba(15, 118, 110, 0.08)" : "transparent",
                        color: activeChannelSubTab === "models" ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: "700",
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        whiteSpace: "nowrap"
                      }}
                    >
                      模型库
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveChannelSubTab("test")}
                      className={`assets-tab-btn ${activeChannelSubTab === "test" ? "active" : ""}`}
                      style={{
                        border: 0,
                        background: activeChannelSubTab === "test" ? "rgba(15, 118, 110, 0.08)" : "transparent",
                        color: activeChannelSubTab === "test" ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: "700",
                        borderRadius: "6px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        whiteSpace: "nowrap"
                      }}
                    >
                      连通测试
                    </button>
                  </div>

                  {activeChannelSubTab === "providers" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                      {/* 置顶展示独立自营上游代理设置表单 */}
                      <ClientSettingsPanel
                        mode="standalone"
                        onSettingsSaved={(newMode) => {
                          setBillingMode(newMode);
                          refreshAll();
                        }}
                      />
                      
                      {/* 下方自营服务商列表 */}
                      <div style={{
                        background: "#ffffff",
                        borderRadius: "12px",
                        border: "1px solid var(--rv-color-border-thin)",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.015)",
                        padding: "24px"
                      }}>
                        <ProviderAdminPanel
                          providers={providers}
                          setProviders={setProviders}
                          adminUsers={adminUsers}
                          setAdminUsers={setAdminUsers}
                          currentUser={currentUser}
                          setCurrentUser={setCurrentUser}
                          setAdminMessage={setAdminMessage}
                          refreshAll={refreshAll}
                        />
                      </div>
                    </div>
                  )}

                  {activeChannelSubTab === "models" && (
                    <div style={{
                      background: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid var(--rv-color-border-thin)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.015)",
                      padding: "24px"
                    }}>
                      <ModelCatalogPanel
                        models={models}
                        setModels={setModels}
                        providers={providers}
                        pricingRules={pricingRules}
                        setPricingRules={setPricingRules}
                        setAdminMessage={setAdminMessage}
                        hideTest={true}
                        hidePricing={true}
                      />
                    </div>
                  )}
 

                  {activeChannelSubTab === "test" && (
                    <div style={{
                      background: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid var(--rv-color-border-thin)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.015)",
                      padding: "24px"
                    }}>
                      <ModelCatalogPanel
                        models={models}
                        setModels={setModels}
                        providers={providers}
                        pricingRules={pricingRules}
                        setPricingRules={setPricingRules}
                        setAdminMessage={setAdminMessage}
                        onlyShowTest={true}
                      />
                    </div>
                  )}               </div>
              )}
            </div>
          )}

          {activeTab === "members" && (
            <div style={{ padding: "32px", background: "#ffffff", minHeight: "100vh", width: "100%", boxSizing: "border-box" }}>
              <WorkspaceMemberPanel
                workspaceMembers={workspaceMembers}
                setWorkspaceMembers={setWorkspaceMembers}
                activeWorkspace={activeWorkspace}
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                adminUsers={adminUsers}
                setAdminUsers={setAdminUsers}
                setAdminMessage={setAdminMessage}
                refreshAll={refreshAll}
                transactions={transactions}
                setTransactions={setTransactions}
                setWorkspaces={setWorkspaces}
              />
            </div>
          )}

          {activeTab === "workflows" && (
            <div style={{ padding: "32px", background: "#ffffff", minHeight: "100vh", width: "100%", boxSizing: "border-box" }}>
              <WorkflowTaskPanel
                workflowTemplates={workflowTemplates}
                setWorkflowTemplates={setWorkflowTemplates}
                costReport={costReport}
                tasks={tasks}
                setTasks={setTasks}
                currentUser={currentUser}
                setTransactions={setTransactions}
                setAdminMessage={setAdminMessage}
                models={models}
                setModels={setModels}
                providers={providers}
                pricingRules={pricingRules}
                setPricingRules={setPricingRules}
              />
            </div>
          )}

          {activeTab === "templates" && (
            <TemplateAdminPanel />
          )}

        </section>
      </main>
    </div>
  );
}
