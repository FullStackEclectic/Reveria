import React, { useState } from "react";
import { RefreshCw, Monitor, Cpu, Users, Layers, ShieldCheck } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"system" | "providers" | "members" | "models" | "workflows">("system");
  const [adminMessage, setAdminMessage] = useState("");

  const tabItems = [
    { id: "system", label: "运行监测", icon: Monitor },
    { id: "providers", label: "服务接入", icon: Cpu },
    { id: "members", label: "席位配额", icon: Users },
    { id: "models", label: "算力模型", icon: Layers },
    { id: "workflows", label: "调度配置", icon: ShieldCheck },
  ] as const;

  return (
    <PageFrame
      eyebrow="Admin Console"
      title="大模型算力控制台"
      status={
        activeWorkspace
          ? `当前工作区: ${activeWorkspace.name} · ${isApiOnline ? "运营策略生效中" : "服务已断开"}`
          : "大模型后台管理"
      }
      action={
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
      }
    >
      {/* 1. 全局统计指标卡片 */}
      <section className="metrics" style={{ marginBottom: "20px" }}>
        <Metric label="工作区算力余额" value={formattedCredits} />
        <Metric
          label="已消耗算力"
          value={`${costReport?.total_consumed_credits ?? 0} 点`}
        />
        <Metric label="上游供应商接入" value={`${providers.length} 家`} />
        <Metric label="激活算力模型" value={`${models.length} 个`} />
      </section>

      {/* 通知与反馈信息 */}
      {adminMessage && (
        <div className="notice" style={{ marginBottom: "16px" }}>
          {adminMessage}
        </div>
      )}

      {/* 2. 控制台大分类 Tab 导航 */}
      <div className="assets-tabs-wrapper" style={{ marginBottom: "20px", display: "flex", gap: "4px" }}>
        {tabItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              className={`assets-tab-btn ${isActive ? "active" : ""}`}
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setAdminMessage("");
              }}
              type="button"
              style={{ minHeight: "38px" }}
            >
              <Icon size={14} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* 3. 子 Tab 视图分发 */}
      <section className="admin-tab-content">
        {activeTab === "system" && (
          <SystemStatusPanel
            activeWorkspace={activeWorkspace}
            buildInfo={buildInfo}
            currentUser={currentUser}
            transactions={transactions}
            setTransactions={setTransactions}
            setWorkspaces={setWorkspaces}
            setAdminMessage={setAdminMessage}
          />
        )}

        {activeTab === "providers" && (
          <ProviderAdminPanel
            providers={providers}
            setProviders={setProviders}
            adminUsers={adminUsers}
            setAdminUsers={setAdminUsers}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            setAdminMessage={setAdminMessage}
          />
        )}

        {activeTab === "members" && (
          <WorkspaceMemberPanel
            workspaceMembers={workspaceMembers}
            setWorkspaceMembers={setWorkspaceMembers}
            activeWorkspace={activeWorkspace}
            currentUser={currentUser}
            setAdminMessage={setAdminMessage}
          />
        )}

        {activeTab === "models" && (
          <ModelCatalogPanel
            models={models}
            setModels={setModels}
            providers={providers}
            pricingRules={pricingRules}
            setPricingRules={setPricingRules}
            setAdminMessage={setAdminMessage}
          />
        )}

        {activeTab === "workflows" && (
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
        )}
      </section>
    </PageFrame>
  );
}
