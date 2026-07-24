import React, { FormEvent, useState } from "react";
import { Coins, X, ShieldAlert } from "lucide-react";
import { WorkspaceSummary, UserSummary } from "../../types";
import { postJson } from "../../utils";

interface AdjustCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserSummary | null;
  activeWorkspace?: WorkspaceSummary;
  currentUser: UserSummary | null;
  transactions: any[];
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  setWorkspaces: React.Dispatch<React.SetStateAction<WorkspaceSummary[]>>;
  setAdminMessage: (msg: string) => void;
}

export function AdjustCreditsModal({
  isOpen,
  onClose,
  user,
  activeWorkspace,
  currentUser,
  transactions,
  setTransactions,
  setWorkspaces,
  setAdminMessage,
}: AdjustCreditsModalProps) {
  const [amount, setAmount] = useState(1000);
  const [reason, setReason] = useState("管理员手动补点");

  if (!isOpen || !user) return null;

  async function handleAdjustCredits(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      setAdminMessage("点数调整失败：未连接 API 或没有选定工作区");
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
      setAdminMessage(`已为用户 ${user?.display_name} 所在工作区成功调整额度，当前余额 ${result.balance}`);
      onClose();
    } catch {
      setAdminMessage("点数调整失败：需要 owner/admin 权限 且 数据库连接");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        animation: "fadeIn 0.2s ease"
      }}
    >
      <div
        className="panel"
        style={{
          width: "460px",
          padding: "28px",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          minHeight: "auto"
        }}
      >
        {/* 头部 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>用户额度调整补给站</h3>
            <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>
              为该用户对应的当前工作区手动增加或扣减算力额度
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 0,
              background: "rgba(0,0,0,0.03)",
              borderRadius: "50%",
              width: "28px",
              height: "28px",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              color: "var(--rv-color-text-muted)"
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 调额目标成员卡片 */}
        <div
          style={{
            background: "rgba(15, 118, 110, 0.04)",
            border: "1px solid rgba(15, 118, 110, 0.1)",
            borderRadius: "8px",
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: "12px"
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "var(--rv-color-primary)",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontWeight: "bold",
              fontSize: "14px"
            }}
          >
            {user.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <strong style={{ display: "block", fontSize: "13px", color: "var(--rv-color-text-main)" }}>
              {user.display_name}
            </strong>
            <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)" }}>
              {user.email ?? "无邮箱登记"} (工作区: {activeWorkspace?.name ?? "-"})
            </span>
          </div>
        </div>

        {/* 调额表单 */}
        <form onSubmit={handleAdjustCredits} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="assets-form-field">
            <label style={{ fontSize: "11px", fontWeight: "700" }}>调整额度 (输入负数则扣减)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={{ minHeight: "38px", width: "100%", borderRadius: "8px", fontSize: "12px" }}
              required
            />
          </div>

          <div className="assets-form-field">
            <label style={{ fontSize: "11px", fontWeight: "700" }}>调整事由 / 备注说明</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ minHeight: "38px", width: "100%", borderRadius: "8px", fontSize: "12px" }}
              placeholder="如：测试增发或人工扣减"
              required
            />
          </div>

          <div
            style={{
              background: "rgba(245, 158, 11, 0.03)",
              border: "1px solid rgba(245, 158, 11, 0.15)",
              borderRadius: "8px",
              padding: "10px 12px",
              display: "flex",
              gap: "8px",
              color: "#d97706"
            }}
          >
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span style={{ fontSize: "10px", lineHeight: "1.4" }}>
              <strong>调额注意:</strong> 额度改动将直接反映在当前活跃工作区 <strong>{activeWorkspace?.name}</strong> 的可用算力余额中。
            </span>
          </div>

          {/* 按钮 */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              className="secondary-button"
              style={{ minHeight: "36px", fontSize: "12px", borderRadius: "8px" }}
            >
              取消
            </button>
            <button
              type="submit"
              className="primary-button"
              style={{ minHeight: "36px", fontSize: "12px", borderRadius: "8px", padding: "0 16px" }}
            >
              <Coins size={14} />
              确认提交额度调整
            </button>
          </div>
        </form>

        {/* 底部流水明细 */}
        <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "16px" }}>
          <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>最近流水纪录</span>
          {transactions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {transactions.slice(0, 3).map((transaction) => (
                <div
                  key={transaction.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "rgba(0,0,0,0.01)",
                    border: "1px solid var(--rv-color-border-thin)",
                    borderRadius: "6px",
                    padding: "8px 12px"
                  }}
                >
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
