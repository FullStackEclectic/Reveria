import React, { useState } from "react";
import { RefreshCw, Monitor, Cpu, Users, Layers, ShieldCheck, FileText } from "lucide-react";
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
  const [activeChannelSubTab, setActiveChannelSubTab] = useState<"providers" | "models">("providers");
  const [adminMessage, setAdminMessage] = useState("");

  const tabItems = [
    { id: "system", label: "运行监测", icon: Monitor },
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
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "32px", background: "#ffffff", minHeight: "100vh", width: "100%", boxSizing: "border-box" }}>
              <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "24px", fontWeight: "700", margin: "0 0 4px 0", color: "var(--rv-color-text-main)" }}>大模型算力控制台</h2>
                  <p style={{ fontSize: "13px", color: "var(--rv-color-text-muted)", margin: 0 }}>
                    {activeWorkspace
                      ? `当前工作区: ${activeWorkspace.name} · ${isApiOnline ? "运营策略生效中" : "服务已断开"}`
                      : "大模型后台管理"}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  disabled={isRefreshing}
                  onClick={refreshAll}
                >
                  <RefreshCw
                    className={isRefreshing ? "spin" : undefined}
                    size={16}
                    aria-hidden="true"
                  />
                  刷新配置
                </button>
              </header>

              <section className="metrics" style={{ marginBottom: 0 }}>
                <Metric label="工作区算力余额" value={formattedCredits} />
                <Metric
                  label="已消耗算力"
                  value={`${costReport?.total_consumed_credits ?? 0} 点`}
                />
                <Metric label="上游供应商接入" value={`${providers.length} 家`} />
                <Metric label="激活算力模型" value={`${models.length} 个`} />
              </section>

              <SystemStatusPanel
                activeWorkspace={activeWorkspace}
                buildInfo={buildInfo}
                currentUser={currentUser}
                transactions={transactions}
                setTransactions={setTransactions}
                setWorkspaces={setWorkspaces}
                setAdminMessage={setAdminMessage}
              />
            </div>
          )}

          {activeTab === "channels" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "32px", background: "#ffffff", minHeight: "100vh", width: "100%", boxSizing: "border-box" }}>
              {/* 二级切换 Tab */}
              <div 
                className="assets-tabs-wrapper" 
                style={{ 
                  display: "flex", 
                  gap: "6px", 
                  background: "var(--rv-color-bg-sidebar)",
                  border: "1px solid var(--rv-color-border-thin)",
                  borderRadius: "var(--rv-radius-sm)",
                  padding: "4px",
                  alignSelf: "start"
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
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  服务商接入
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
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}
                >
                  算力模型库
                </button>
              </div>

              {activeChannelSubTab === "providers" ? (
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
              ) : (
                <ModelCatalogPanel
                  models={models}
                  setModels={setModels}
                  providers={providers}
                  pricingRules={pricingRules}
                  setPricingRules={setPricingRules}
                  setAdminMessage={setAdminMessage}
                />
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
