import React, { FormEvent, useState } from "react";
import { Coins, HardDrive, CheckCircle2, User, Key, GitBranch, LayoutGrid } from "lucide-react";
import { WorkspaceSummary, UserSummary } from "../../types";
import { postJson } from "../../utils";

interface SystemStatusPanelProps {
  activeWorkspace?: WorkspaceSummary;
  buildInfo: any;
  currentUser: UserSummary | null;
  transactions: any[];
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  setWorkspaces: React.Dispatch<React.SetStateAction<WorkspaceSummary[]>>;
  setAdminMessage: (msg: string) => void;
}

export function SystemStatusPanel({
  activeWorkspace,
  buildInfo,
  currentUser,
  transactions,
  setTransactions,
  setWorkspaces,
  setAdminMessage,
}: SystemStatusPanelProps) {
  const [amount, setAmount] = useState(1000);
  const [reason, setReason] = useState("管理员手动补点");

  async function handleAdjustCredits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      setAdminMessage("点数调整失败：请先连接 API 并创建工作区");
      return;
    }
    try {
      const result = await postJson<{
        balance: number;
        transaction: any;
      }>("/api/admin/credits/adjust", {
        workspace_id: workspaceId,
        operator_id: currentUser?.id ?? null,
        amount,
        reason: reason || null,
      });
      setWorkspaces((current) =>
        current.map((workspace) =>
          workspace.id === workspaceId
            ? { ...workspace, credit_balance: result.balance }
            : workspace
        )
      );
      setTransactions((current) => [result.transaction, ...current]);
      setAdminMessage(`点数已调整，当前余额 ${result.balance}`);
    } catch {
      setAdminMessage("点数调整失败：需要 owner/admin 权限 且 数据库连接");
    }
  }

  return (
    <div className="admin-subpanel-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "20px" }}>
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

      {/* 点数调整及流水 */}
      <div className="panel" style={{ minHeight: "auto", display: "flex", flexDirection: "column" }}>
        <div className="panel-header" style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "12px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>点数补给站</h3>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>平台用户工作区额度手动增减与流水</span>
        </div>

        <form onSubmit={handleAdjustCredits} style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
          <div className="assets-form-field">
            <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>调整额度 (支持负数扣减)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ minHeight: "36px", width: "100%" }}
              required
            />
          </div>

          <div className="assets-form-field">
            <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>调整事由 / 备注说明</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ minHeight: "36px", width: "100%" }}
              placeholder="如：管理员测试增发"
              required
            />
          </div>

          <button className="primary-button" type="submit" style={{ width: "100%", minHeight: "36px" }}>
            <Coins size={16} />
            确认提交额度调整
          </button>
        </form>

        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>最近流水纪录</span>
          {transactions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {transactions.slice(0, 3).map((transaction) => (
                <div key={transaction.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "6px", padding: "8px 12px" }}>
                  <div style={{ minWidth: 0, paddingRight: "8px" }}>
                    <strong style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-main)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {transaction.transaction_type}
                    </strong>
                    <span style={{ display: "block", fontSize: "9px", color: "var(--rv-color-text-muted)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", marginTop: "1px" }}>
                      {transaction.reason ?? "无备注"}
                    </span>
                  </div>
                  <strong style={{ fontSize: "11px", color: transaction.amount > 0 ? "#047857" : "#b91c1c", whiteSpace: "nowrap" }}>
                    {transaction.amount > 0 ? "+" : ""}
                    {transaction.amount} 点
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty" style={{ minHeight: "80px" }}>
              <p>暂无流水明细记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
