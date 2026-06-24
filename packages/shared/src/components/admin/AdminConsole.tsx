import React, { useEffect, useState } from "react";
import { ShieldAlert, LogIn, RefreshCw, ChevronLeft } from "lucide-react";
import { AdminView } from "./AdminView";
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
import { fetchAdminData } from "../../utils";

interface AdminConsoleProps {
  activeWorkspace?: WorkspaceSummary;
  isApiOnline?: boolean;
  formattedCredits?: string;
  currentUser: UserSummary | null;
  setCurrentUser: (user: UserSummary | null) => void;
  // 选填：用于从 Next.js 或客户端控制返回主站
  onBack?: () => void;
}

export function AdminConsole({
  activeWorkspace,
  isApiOnline = true,
  formattedCredits = "0.00",
  currentUser,
  setCurrentUser,
  onBack,
}: AdminConsoleProps) {
  // 1. 超管自治状态定义
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [adminModels, setAdminModels] = useState<ModelSummary[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserSummary[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRuleSummary[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<WorkflowTemplateSummary[]>([]);
  const [costReport, setCostReport] = useState<WorkspaceCostReportResponse | null>(null);
  const [tasks, setTasks] = useState<GenerationTaskSummary[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [adminMessage, setAdminMessage] = useState("");
  const [buildInfo, setBuildInfo] = useState<any>(null);

  // 2. 独立拉取后台管理数据
  async function loadAdminData() {
    if (!currentUser || !currentUser.is_platform_admin) return;
    setIsRefreshing(true);
    setAdminMessage("");
    try {
      const data = await fetchAdminData(activeWorkspace?.id);
      setAdminUsers(data.userData);
      setProviders(data.providerData);
      setAdminModels(data.modelData);
      setPricingRules(data.pricingRuleData);
      setWorkflowTemplates(data.templateData);
      setWorkspaceMembers(data.memberData);
      setCostReport(data.costReportData);
      setTasks(data.taskData);
    } catch (err: any) {
      setAdminMessage("后台配置加载失败：需要超级管理员身份和数据库连接");
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  }

  // 3. 进入页面自动拉取
  useEffect(() => {
    if (currentUser?.is_platform_admin) {
      void loadAdminData();
    }
  }, [currentUser, activeWorkspace?.id]);

  // 4. 权限防御拦截 (非超管展示 403 磨砂质感极美界面)
  if (!currentUser || !currentUser.is_platform_admin) {
    return (
      <div 
        className="admin-forbidden-container"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "radial-gradient(circle at center, #1b263b 0%, #0d1b2a 100%)",
          color: "#e0e1dd",
          fontFamily: "'Outfit', 'Inter', sans-serif",
          padding: "20px",
          textAlign: "center"
        }}
      >
        <div 
          className="forbidden-card"
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "40px 30px",
            maxWidth: "480px",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
            animation: "fadeIn 0.6s ease"
          }}
        >
          <div 
            className="icon-shield"
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "rgba(224, 82, 99, 0.1)",
              border: "1px solid rgba(224, 82, 99, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              color: "#e05263"
            }}
          >
            <ShieldAlert size={40} />
          </div>

          <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "16px", letterSpacing: "-0.5px" }}>
            403 - 访问受限
          </h1>

          <p style={{ color: "#a5a5a5", fontSize: "15px", lineHeight: "1.6", marginBottom: "32px" }}>
            由于涉及大模型算力控制、席位划拨及供应商配置，该大区仅供 Reveria 系统超级管理员进入。请登录具有 `is_platform_admin` 权限的账户。
          </p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#e0e1dd",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s"
                }}
              >
                <ChevronLeft size={16} />
                返回主站
              </button>
            )}
            
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.href = "/";
                }
              }}
              style={{
                background: "linear-gradient(135deg, #415a77 0%, #1b263b 100%)",
                border: "none",
                color: "#e0e1dd",
                borderRadius: "8px",
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s",
                boxShadow: "0 4px 12px rgba(27, 38, 59, 0.3)"
              }}
            >
              <LogIn size={16} />
              前往登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. 渲染超级管理员控制台
  return (
    <div 
      className="admin-console-wrapper" 
      style={{ 
        minHeight: "100vh", 
        background: "var(--rv-color-bg-base)",
        color: "var(--rv-color-text-main)"
      }}
    >
      {onBack && (
        <div 
          className="admin-top-bar"
          style={{
            padding: "12px 24px",
            borderBottom: "1px solid var(--rv-color-border-thin)",
            background: "var(--rv-color-bg-sidebar)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--rv-color-text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "14px",
              fontWeight: "500",
              transition: "color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--rv-color-text-main)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--rv-color-text-muted)")}
          >
            <ChevronLeft size={16} />
            返回画板工作台
          </button>
          
          {isRefreshing && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "13px" }}>
              <RefreshCw size={14} className="spin" />
              正在同步算力配置...
            </div>
          )}
        </div>
      )}

      <AdminView
        activeWorkspace={activeWorkspace}
        isApiOnline={isApiOnline}
        formattedCredits={formattedCredits}
        isRefreshing={isRefreshing}
        refreshAll={loadAdminData}
        providers={providers}
        setProviders={setProviders}
        models={adminModels}
        setModels={setAdminModels}
        adminUsers={adminUsers}
        setAdminUsers={setAdminUsers}
        workspaceMembers={workspaceMembers}
        setWorkspaceMembers={setWorkspaceMembers}
        pricingRules={pricingRules}
        setPricingRules={setPricingRules}
        workflowTemplates={workflowTemplates}
        setWorkflowTemplates={setWorkflowTemplates}
        costReport={costReport}
        tasks={tasks}
        setTasks={setTasks}
        buildInfo={buildInfo}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        transactions={[]}
        setTransactions={() => {}}
        setWorkspaces={() => {}}
      />
    </div>
  );
}
