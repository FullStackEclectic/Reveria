import React, { useState } from "react";
import { RefreshCw, LayoutDashboard, Cpu, Users, ShieldCheck, FileText, Settings, Badge } from "lucide-react";
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
import { SystemSettingsPanel } from "./SystemSettingsPanel";
import { PlanManagementPanel } from "./PlanManagementPanel";

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
  const [activeTab, setActiveTab] = useState<"system" | "channels" | "plans" | "members" | "workflows" | "templates" | "settings">("system");
  const [activeChannelSubTab, setActiveChannelSubTab] = useState<"providers" | "models" | "test">("providers");
  const [adminMessage, setAdminMessage] = useState("");

  const tabItems = [
    { id: "system", label: "系统大盘", icon: LayoutDashboard },
    { id: "channels", label: "算力通道", icon: Cpu },
    { id: "plans", label: "套餐管理", icon: Badge },
    { id: "members", label: "人员管理", icon: Users },
    { id: "workflows", label: "调度配置", icon: ShieldCheck },
    { id: "templates", label: "提示词模板", icon: FileText },
    { id: "settings", label: "系统设置", icon: Settings },
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

          {activeTab === "plans" && <PlanManagementPanel />}

          {activeTab === "channels" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "32px", background: "#f8fafc", minHeight: "100vh", width: "100%", boxSizing: "border-box" }}>
              <header style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "16px", marginBottom: "8px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px 0", color: "var(--rv-color-text-main)" }}>系统算力渠道管理</h2>
                <p style={{ fontSize: "12px", color: "var(--rv-color-text-muted)", margin: 0 }}>配置上游服务商与 API 令牌，并为模型制定本地零售定价。</p>
              </header>

              <ClientSettingsPanel onSettingsSaved={() => { void refreshAll(); }} />

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
                )}
              </div>
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

          {activeTab === "settings" && (
            <div style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh", width: "100%", boxSizing: "border-box" }}>
              {/* 页头大标题 */}
              <header style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "16px", marginBottom: "20px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "700", margin: "0 0 4px 0", color: "var(--rv-color-text-main)" }}>系统全局设置</h2>
                <p style={{ fontSize: "12px", color: "var(--rv-color-text-muted)", margin: 0 }}>配置修图分站的系统运营基本参数、用户注册机制与赠送点数策略。</p>
              </header>
              <SystemSettingsPanel onSettingsSaved={refreshAll} />
            </div>
          )}

        </section>
      </main>
    </div>
  );
}
