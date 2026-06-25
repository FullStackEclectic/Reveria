import React from "react";
import { HardDrive, CheckCircle2, User, Key, GitBranch, LayoutGrid } from "lucide-react";
import { WorkspaceSummary, UserSummary } from "../../types";

interface SystemStatusPanelProps {
  activeWorkspace?: WorkspaceSummary;
  buildInfo: any;
  currentUser: UserSummary | null;
}

export function SystemStatusPanel({
  activeWorkspace,
  buildInfo,
  currentUser,
}: SystemStatusPanelProps) {
  return (
    <div className="admin-subpanel-grid" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
      {/* 系统状态与环境检测 */}
      <div className="panel" style={{ minHeight: "auto", display: "flex", flexDirection: "column" }}>
        <div className="panel-header" style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "12px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>环境监测</h3>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>系统运行时服务属性及连接状态</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "rgba(255,255,255,0.4)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(15, 118, 110, 0.06)", display: "grid", placeItems: "center", color: "var(--rv-color-primary)" }}>
              <HardDrive size={18} />
            </div>
            <div>
              <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", textTransform: "uppercase", fontWeight: "700" }}>API 服务端</span>
              <strong style={{ display: "block", fontSize: "13px", color: "var(--rv-color-text-main)", marginTop: "2px" }}>
                {buildInfo ? `${buildInfo.service} ${buildInfo.version}` : "未连接"}
              </strong>
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.4)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(15, 118, 110, 0.06)", display: "grid", placeItems: "center", color: "var(--rv-color-primary)" }}>
              <Key size={18} />
            </div>
            <div>
              <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", textTransform: "uppercase", fontWeight: "700" }}>接口契约</span>
              <strong style={{ display: "block", fontSize: "13px", color: "var(--rv-color-text-main)", marginTop: "2px" }}>
                {buildInfo ? `v${buildInfo.api_contract}` : "-"}
              </strong>
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.4)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(15, 118, 110, 0.06)", display: "grid", placeItems: "center", color: "var(--rv-color-primary)" }}>
              <CheckCircle2 size={18} />
            </div>
            <div>
              <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", textTransform: "uppercase", fontWeight: "700" }}>数据库连接</span>
              <strong style={{ display: "block", fontSize: "13px", color: "var(--rv-color-text-main)", marginTop: "2px" }}>
                {buildInfo?.database_connected ? "已连接成功" : "未连接"}
              </strong>
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.4)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "14px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(15, 118, 110, 0.06)", display: "grid", placeItems: "center", color: "var(--rv-color-primary)" }}>
              <User size={18} />
            </div>
            <div>
              <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", textTransform: "uppercase", fontWeight: "700" }}>当前管理员</span>
              <strong style={{ display: "block", fontSize: "13px", color: "var(--rv-color-text-main)", marginTop: "2px" }}>
                {currentUser?.display_name ?? "未登录"}
              </strong>
            </div>
          </div>
        </div>

        <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <LayoutGrid size={15} style={{ color: "var(--rv-color-primary)" }} />
              <strong style={{ fontSize: "12px", color: "var(--rv-color-text-main)" }}>工作区实体绑定</strong>
            </div>
            <span style={{ fontSize: "10px", fontWeight: "700", background: activeWorkspace ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)", color: activeWorkspace ? "#10b981" : "#ef4444", padding: "2px 6px", borderRadius: "4px" }}>
              {activeWorkspace ? "ACTIVE" : "OFFLINE"}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", wordBreak: "break-all" }}>
            工作区名称: <strong style={{ color: "var(--rv-color-text-main)" }}>{activeWorkspace?.name ?? "未加载"}</strong>
          </div>

          <div style={{ height: "1px", background: "rgba(0,0,0,0.06)", margin: "10px 0" }} />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <GitBranch size={15} style={{ color: "var(--rv-color-primary)" }} />
              <strong style={{ fontSize: "12px", color: "var(--rv-color-text-main)" }}>构建 Git SHA 版本</strong>
            </div>
            <span style={{ fontSize: "10px", fontWeight: "700", background: buildInfo ? "rgba(14, 165, 233, 0.08)" : "rgba(239, 68, 68, 0.08)", color: buildInfo ? "#0ea5e9" : "#ef4444", padding: "2px 6px", borderRadius: "4px" }}>
              {buildInfo ? "READY" : "MISSING"}
            </span>
          </div>
          <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", wordBreak: "break-all" }}>
            SHA 值: <strong style={{ color: "var(--rv-color-text-main)" }}>{buildInfo?.git_sha ?? "暂无版本构建哈希"}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
