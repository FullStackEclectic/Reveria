import React from "react";
import { ShieldAlert, UserPlus, X } from "lucide-react";
import { postJson } from "../../utils";

interface SeatAllocationModalProps {
  showSeatModal: boolean;
  selectedUserForSeat: any;
  onClose: () => void;
  activeWorkspace: any;
  members: any[];
  setMembers: React.Dispatch<React.SetStateAction<any[]>>;
  setAdminMessage: (msg: string) => void;
  currentUser: any;
}

export function SeatAllocationModal({
  showSeatModal,
  selectedUserForSeat,
  onClose,
  activeWorkspace,
  members,
  setMembers,
  setAdminMessage,
  currentUser,
}: SeatAllocationModalProps) {
  const [role, setRole] = React.useState("member");
  const [status, setStatus] = React.useState("active");
  const [dailyLimit, setDailyLimit] = React.useState(0);
  const [monthlyLimit, setMonthlyLimit] = React.useState(0);

  React.useEffect(() => {
    if (selectedUserForSeat) {
      const existingMember = members.find((m) => m.user_id === selectedUserForSeat.id);
      if (existingMember) {
        setRole(existingMember.role);
        setStatus(existingMember.status || "active");
        setDailyLimit(existingMember.daily_credit_limit || 0);
        setMonthlyLimit(existingMember.monthly_credit_limit || 0);
      } else {
        setRole("member");
        setStatus("active");
        setDailyLimit(0);
        setMonthlyLimit(0);
      }
    }
  }, [selectedUserForSeat, members]);

  if (!showSeatModal || !selectedUserForSeat) return null;

  async function handleUpsertWorkspaceMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      setAdminMessage("席位分配失败：未连接 API 或没有选定工作区");
      return;
    }
    if (!selectedUserForSeat) return;

    try {
      const member = await postJson<any>(
        "/api/admin/workspace-members",
        {
          workspace_id: workspaceId,
          operator_id: currentUser?.id ?? null,
          user_id: selectedUserForSeat.id,
          role,
          status: status || "active",
          daily_credit_limit: dailyLimit > 0 ? dailyLimit : null,
          monthly_credit_limit: monthlyLimit > 0 ? monthlyLimit : null,
        }
      );
      
      setMembers((current) => [
        member,
        ...current.filter((item) => item.user_id !== member.user_id),
      ]);
      setAdminMessage(`已保存工作区席位配置：${selectedUserForSeat.display_name}`);
      onClose();
    } catch {
      setAdminMessage("席位保存失败：账户无权限或数据库连接错误");
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
          width: "440px",
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
        {/* Modal 头部 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>工作区席位与配额设置</h3>
            <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>
              为该用户在当前工作区分配系统角色并设定点数上限
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

        {/* 用户基础信息卡片 */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "var(--rv-color-bg-base)",
          padding: "12px 16px",
          borderRadius: "8px",
          border: "1px solid var(--rv-color-border-sub)"
        }}>
          <div className="user-avatar-circle" style={{ margin: 0, width: "36px", height: "36px", fontSize: "13px" }}>
            {(selectedUserForSeat.display_name || "U").slice(0, 1).toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontWeight: "600", fontSize: "13px" }}>{selectedUserForSeat.display_name}</span>
            <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>
              {selectedUserForSeat.email || "本地外部账户"}
            </span>
          </div>
        </div>

        {/* 表单提交 */}
        <form onSubmit={handleUpsertWorkspaceMember} style={{ display: "flex", flexDirection: "column", gap: "16px", margin: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="assets-form-field">
              <label style={{ fontSize: "11px", fontWeight: "700" }}>席位角色</label>
              <select 
                value={role} 
                onChange={(e) => setRole(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--rv-color-border-sub)", outline: "none", fontSize: "12px" }}
              >
                <option value="owner">工作区所有者 (Owner)</option>
                <option value="admin">工作区管理员 (Admin)</option>
                <option value="member">常规协作者 (Member)</option>
                <option value="guest">受邀访客 (Guest)</option>
              </select>
            </div>
            
            <div className="assets-form-field">
              <label style={{ fontSize: "11px", fontWeight: "700" }}>成员状态</label>
              <select 
                value={status} 
                onChange={(e) => setStatus(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--rv-color-border-sub)", outline: "none", fontSize: "12px" }}
              >
                <option value="joined">已激活 (Active)</option>
                <option value="pending">待接受邀请 (Pending)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="assets-form-field">
              <label style={{ fontSize: "11px", fontWeight: "700" }}>
                单日消费上限 (积分)
              </label>
              <input 
                type="number"
                min="0"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                placeholder="0 表示不设上限"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--rv-color-border-sub)", outline: "none", fontSize: "12px" }}
              />
            </div>
            
            <div className="assets-form-field">
              <label style={{ fontSize: "11px", fontWeight: "700" }}>
                单月消费上限 (积分)
              </label>
              <input 
                type="number"
                min="0"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                placeholder="0 表示不设上限"
                style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--rv-color-border-sub)", outline: "none", fontSize: "12px" }}
              />
            </div>
          </div>

          <div style={{
            display: "flex",
            gap: "8px",
            alignItems: "flex-start",
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(245,158,11,0.05)",
            color: "var(--rv-color-warning)",
            border: "1px solid rgba(245,158,11,0.12)"
          }}>
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span style={{ fontSize: "10px", lineHeight: "1.4" }}>
              <strong>分配警告:</strong> 点数上限指该用户在<strong>当前选定的工作区</strong>内的消费额度限制，系统级别将自动在其触发任务时扣减相应点数。
            </span>
          </div>

          {/* 动作按钮 */}
          <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "4px" }}>
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
              <UserPlus size={14} />
              保存席位配额
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
