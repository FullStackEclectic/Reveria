import React, { FormEvent, useState } from "react";
import { Users, UserPlus, UserCog, BadgeAlert } from "lucide-react";
import { WorkspaceMemberSummary, WorkspaceSummary, UserSummary } from "../../types";
import { postJson } from "../../utils";

interface WorkspaceMemberPanelProps {
  workspaceMembers: WorkspaceMemberSummary[];
  setWorkspaceMembers: React.Dispatch<React.SetStateAction<WorkspaceMemberSummary[]>>;
  activeWorkspace?: WorkspaceSummary;
  currentUser: UserSummary | null;
  setAdminMessage: (msg: string) => void;
}

export function WorkspaceMemberPanel({
  workspaceMembers,
  setWorkspaceMembers,
  activeWorkspace,
  currentUser,
  setAdminMessage,
}: WorkspaceMemberPanelProps) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("admin");
  const [status, setStatus] = useState("active");
  const [dailyLimit, setDailyLimit] = useState(0);
  const [monthlyLimit, setMonthlyLimit] = useState(0);

  async function handleUpsertWorkspaceMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      setAdminMessage("成员保存失败：请先连接 API 并创建工作区");
      return;
    }
    if (!userId) {
      setAdminMessage("成员保存失败：用户 ID 必填");
      return;
    }
    try {
      const member = await postJson<WorkspaceMemberSummary>(
        "/api/admin/workspace-members",
        {
          workspace_id: workspaceId,
          operator_id: currentUser?.id ?? null,
          user_id: userId,
          role,
          status: status || "active",
          daily_credit_limit: dailyLimit > 0 ? dailyLimit : null,
          monthly_credit_limit: monthlyLimit > 0 ? monthlyLimit : null,
        }
      );
      setWorkspaceMembers((current) => [
        member,
        ...current.filter((item) => item.user_id !== member.user_id),
      ]);
      setAdminMessage(`已保存成员：${member.display_name}`);
      setUserId("");
      setDailyLimit(0);
      setMonthlyLimit(0);
    } catch {
      setAdminMessage("成员保存失败：需要 owner/admin 权限和数据库连接");
    }
  }

  const handleSelectMember = (member: WorkspaceMemberSummary) => {
    setUserId(member.user_id);
    setRole(member.role);
    setStatus(member.status);
    setDailyLimit(member.daily_credit_limit || 0);
    setMonthlyLimit(member.monthly_credit_limit || 0);
  };

  return (
    <div className="admin-subpanel-grid" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "20px" }}>
      {/* 成员添加/编辑表单 */}
      <div className="panel" style={{ minHeight: "auto", display: "flex", flexDirection: "column" }}>
        <div className="panel-header" style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "12px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>席位与配额设置</h3>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>授权用户进入当前工作区并分配点数额度</span>
        </div>

        <form onSubmit={handleUpsertWorkspaceMember} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="assets-form-field">
            <label style={{ fontSize: "10px", fontWeight: "700" }}>用户唯一标识 ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="输入用户 UUID"
              required
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>系统角色</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{ minHeight: "36px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-sm)", padding: "0 10px", background: "#ffffff" }}
              >
                <option value="owner">所有者 (Owner)</option>
                <option value="admin">管理员 (Admin)</option>
                <option value="member">普通成员 (Member)</option>
              </select>
            </div>

            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ minHeight: "36px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-sm)", padding: "0 10px", background: "#ffffff" }}
              >
                <option value="active">正常启用</option>
                <option value="suspended">封禁挂起</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>日消费点数上限</label>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                placeholder="0 代表不设限"
              />
            </div>

            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>月消费点数上限</label>
              <input
                type="number"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                placeholder="0 代表不设限"
              />
            </div>
          </div>

          <button className="primary-button" type="submit" style={{ width: "100%", minHeight: "36px", marginTop: "10px" }}>
            <UserPlus size={16} />
            保存席位与分配配额
          </button>
        </form>
      </div>

      {/* 工作区成员看板 */}
      <div className="panel" style={{ minHeight: "auto", display: "flex", flexDirection: "column" }}>
        <div className="panel-header" style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "12px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>工作区席位清单</h3>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>管理已加入该项目工作区的成员与额度状况</span>
        </div>

        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>当前席位列表 ({workspaceMembers.length})</span>
          {workspaceMembers.length > 0 ? (
            <div style={{ display: "grid", gap: "8px", maxHeight: "360px", overflowY: "auto", paddingRight: "4px" }}>
              {workspaceMembers.map((member) => {
                const initial = member.display_name.charAt(0).toUpperCase();
                const isActive = member.status === "active";
                return (
                  <div
                    key={member.id}
                    onClick={() => handleSelectMember(member)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(0,0,0,0.01)",
                      border: "1px solid var(--rv-color-border-thin)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      cursor: "pointer",
                      transition: "var(--rv-transition-default)"
                    }}
                    className="member-row-hover"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: isActive ? "var(--rv-color-primary)" : "#e7e5e4",
                        color: "#ffffff",
                        fontWeight: "800",
                        fontSize: "13px",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0
                      }}>
                        {initial}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "block", fontSize: "12px", color: "var(--rv-color-text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {member.display_name}
                        </strong>
                        <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {member.email ?? member.user_id}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{
                          display: "inline-block",
                          fontSize: "9px",
                          fontWeight: "700",
                          background: member.role === "owner" ? "rgba(139, 92, 26, 0.08)" : member.role === "admin" ? "rgba(15, 118, 110, 0.08)" : "rgba(115, 111, 106, 0.08)",
                          color: member.role === "owner" ? "#8b5a1a" : member.role === "admin" ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                          padding: "1px 5px",
                          borderRadius: "3px"
                        }}>
                          {member.role === "owner" ? "所有者" : member.role === "admin" ? "管理员" : "成员"}
                        </span>
                        <div style={{ fontSize: "9px", color: "var(--rv-color-text-muted)", marginTop: "2px" }}>
                          日: {member.daily_credit_limit ? `${member.daily_credit_limit}点` : "无限制"} · 月: {member.monthly_credit_limit ? `${member.monthly_credit_limit}点` : "无限制"}
                        </div>
                      </div>

                      {!isActive && (
                        <span title="账户已挂起/停用" style={{ display: "inline-flex", alignItems: "center" }}>
                          <BadgeAlert size={16} style={{ color: "#dc2626" }} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state compact-empty" style={{ minHeight: "180px" }}>
              <p>暂无工作区授权席位</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
