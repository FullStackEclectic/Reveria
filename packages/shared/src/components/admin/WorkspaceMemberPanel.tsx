import React, { FormEvent, useState } from "react";
import { 
  Users, 
  UserCheck, 
  Shield, 
  Search, 
  Copy, 
  Check, 
  Plus, 
  Trash2, 
  X, 
  ShieldAlert, 
  UserPlus, 
  Activity, 
  UserX,
  Sliders
} from "lucide-react";
import { WorkspaceMemberSummary, WorkspaceSummary, UserSummary } from "../../types";
import { postJson, deleteJson } from "../../utils";

interface WorkspaceMemberPanelProps {
  workspaceMembers: WorkspaceMemberSummary[];
  setWorkspaceMembers: React.Dispatch<React.SetStateAction<WorkspaceMemberSummary[]>>;
  activeWorkspace?: WorkspaceSummary;
  currentUser: UserSummary | null;
  setCurrentUser: (user: UserSummary | null) => void;
  adminUsers: UserSummary[];
  setAdminUsers: React.Dispatch<React.SetStateAction<UserSummary[]>>;
  setAdminMessage: (msg: string) => void;
  refreshAll?: () => Promise<void>;
}

const CURRENT_USER_STORAGE_KEY = "reveria.currentUser";

export function WorkspaceMemberPanel({
  workspaceMembers,
  setWorkspaceMembers,
  activeWorkspace,
  currentUser,
  setCurrentUser,
  adminUsers,
  setAdminUsers,
  setAdminMessage,
  refreshAll,
}: WorkspaceMemberPanelProps) {
  // 检索与筛选状态
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "admin" | "workspace">("all");
  
  // 复制 UUID 的反馈提示状态
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 席位配置 Modal 状态
  const [showSeatModal, setShowSeatModal] = useState(false);
  const [selectedUserForSeat, setSelectedUserForSeat] = useState<UserSummary | null>(null);
  
  // 席位表单字段
  const [role, setRole] = useState("member");
  const [status, setStatus] = useState("active");
  const [dailyLimit, setDailyLimit] = useState(0);
  const [monthlyLimit, setMonthlyLimit] = useState(0);

  // 触发复制 UUID
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setAdminMessage(`已成功复制 UUID: ${id}`);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  // 平台超管授权 Toggle
  async function handleTogglePlatformAdmin(user: UserSummary) {
    const targetStatus = !user.is_platform_admin;
    try {
      await postJson(`/api/admin/users/${user.id}/platform-admin`, {
        is_platform_admin: targetStatus
      });
      
      setAdminUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, is_platform_admin: targetStatus } : item))
      );
      
      if (currentUser?.id === user.id) {
        const updatedUser = { ...user, is_platform_admin: targetStatus };
        setCurrentUser(updatedUser);
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updatedUser));
      }
      setAdminMessage(`已成功${targetStatus ? "授予" : "撤销"} ${user.display_name} 平台超级管理员权限`);
      
      if (refreshAll) {
        await refreshAll();
      }
    } catch {
      setAdminMessage("超管权限更改失败：不能撤销最后一个超管，或当前账户权限不足");
    }
  }

  // 打开席位编辑 / 加入工作区弹窗
  const openSeatingModal = (user: UserSummary) => {
    const existingMember = workspaceMembers.find((m) => m.user_id === user.id);
    setSelectedUserForSeat(user);
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
    setShowSeatModal(true);
  };

  // 提交席位分配
  async function handleUpsertWorkspaceMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      setAdminMessage("席位分配失败：未连接 API 或没有选定工作区");
      return;
    }
    if (!selectedUserForSeat) return;

    try {
      const member = await postJson<WorkspaceMemberSummary>(
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
      
      setWorkspaceMembers((current) => [
        member,
        ...current.filter((item) => item.user_id !== member.user_id),
      ]);
      setAdminMessage(`已保存工作区席位配置：${selectedUserForSeat.display_name}`);
      setShowSeatModal(false);
      setSelectedUserForSeat(null);
      
      if (refreshAll) {
        await refreshAll();
      }
    } catch {
      setAdminMessage("席位保存失败：账户无权限或数据库连接错误");
    }
  }

  // 移除工作区席位
  async function handleRemoveWorkspaceMember(user: UserSummary) {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) return;
    
    if (!window.confirm(`确定要将用户 ${user.display_name} 移出当前工作区 (${activeWorkspace.name}) 吗？`)) {
      return;
    }

    try {
      await deleteJson("/api/admin/workspace-members", {
        workspace_id: workspaceId,
        user_id: user.id
      });

      setWorkspaceMembers((current) => current.filter((item) => item.user_id !== user.id));
      setAdminMessage(`已成功将用户 ${user.display_name} 从工作区席位移除`);
      
      if (refreshAll) {
        await refreshAll();
      }
    } catch (err: any) {
      console.error(err);
      setAdminMessage("移出成员失败：不能删除唯一的席位所有者，或网络超时");
    }
  }

  // 本地过滤大盘用户列表
  const filteredUsers = adminUsers.filter((user) => {
    const lowerQuery = searchQuery.toLowerCase();
    const matchesSearch = 
      user.display_name.toLowerCase().includes(lowerQuery) ||
      (user.email ?? "").toLowerCase().includes(lowerQuery) ||
      user.id.toLowerCase().includes(lowerQuery);
    
    if (filterTab === "admin") {
      return matchesSearch && user.is_platform_admin;
    }
    if (filterTab === "workspace") {
      return matchesSearch && workspaceMembers.some((m) => m.user_id === user.id);
    }
    return matchesSearch;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. 顶栏指标卡片 */}
      <div 
        style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "20px" 
        }}
      >
        <div className="panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", minHeight: "auto" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(15, 118, 110, 0.08)", color: "var(--rv-color-primary)", display: "grid", placeItems: "center" }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>系统总用户</div>
            <strong style={{ fontSize: "24px", fontWeight: "800", color: "var(--rv-color-text-main)" }}>{adminUsers.length}</strong>
          </div>
        </div>

        <div className="panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", minHeight: "auto" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(245, 158, 11, 0.08)", color: "#d97706", display: "grid", placeItems: "center" }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>平台超级管理员</div>
            <strong style={{ fontSize: "24px", fontWeight: "800", color: "var(--rv-color-text-main)" }}>
              {adminUsers.filter((u) => u.is_platform_admin).length}
            </strong>
          </div>
        </div>

        <div className="panel" style={{ padding: "20px", display: "flex", alignItems: "center", gap: "16px", minHeight: "auto" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(99, 102, 241, 0.08)", color: "#4f46e5", display: "grid", placeItems: "center" }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>当前工作区席位</div>
            <strong style={{ fontSize: "24px", fontWeight: "800", color: "var(--rv-color-text-main)" }}>{workspaceMembers.length}</strong>
          </div>
        </div>
      </div>

      {/* 2. 检索和 Tab 筛选区域 */}
      <div 
        className="panel" 
        style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "20px",
          padding: "24px"
        }}
      >
        <div 
          style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px"
          }}
        >
          {/* 左侧 Tab 过滤 */}
          <div 
            style={{ 
              display: "flex", 
              gap: "4px", 
              background: "rgba(0,0,0,0.02)",
              border: "1px solid var(--rv-color-border-thin)",
              borderRadius: "8px",
              padding: "4px"
            }}
          >
            {[
              { id: "all", label: "全部系统用户" },
              { id: "admin", label: "超级管理员" },
              { id: "workspace", label: "工作区成员" }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id as any)}
                style={{
                  border: 0,
                  background: filterTab === tab.id ? "#ffffff" : "transparent",
                  color: filterTab === tab.id ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                  padding: "8px 16px",
                  fontSize: "12px",
                  fontWeight: "700",
                  borderRadius: "6px",
                  cursor: "pointer",
                  boxShadow: filterTab === tab.id ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
                  transition: "all 0.2s"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 右侧搜索框 */}
          <div style={{ position: "relative", minWidth: "280px" }}>
            <Search 
              size={16} 
              style={{ 
                position: "absolute", 
                left: "12px", 
                top: "50%", 
                transform: "translateY(-50%)", 
                color: "var(--rv-color-text-muted)" 
              }} 
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索用户名、邮箱或 UUID..."
              style={{
                width: "100%",
                height: "38px",
                paddingLeft: "36px",
                paddingRight: "12px",
                fontSize: "12px",
                borderRadius: "8px",
                border: "1px solid var(--rv-color-border-thin)",
                background: "#ffffff",
                outline: "none",
                transition: "border-color 0.2s"
              }}
            />
          </div>
        </div>

        {/* 3. 用户表格展示 */}
        <div style={{ overflowX: "auto" }}>
          <table 
            style={{ 
              width: "100%", 
              borderCollapse: "collapse",
              fontSize: "13px",
              textAlign: "left"
            }}
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>
                <th style={{ padding: "12px 16px" }}>基本信息</th>
                <th style={{ padding: "12px 16px" }}>用户 UUID</th>
                <th style={{ padding: "12px 16px" }}>平台全局角色</th>
                <th style={{ padding: "12px 16px" }}>工作区席位</th>
                <th style={{ padding: "12px 16px", textAlign: "right" }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const initial = user.display_name.charAt(0).toUpperCase();
                  const isCurrentUser = currentUser?.id === user.id;
                  
                  // 判断该用户是否已在当前工作区席位列表中
                  const wsMember = workspaceMembers.find((m) => m.user_id === user.id);
                  
                  return (
                    <tr 
                      key={user.id} 
                      style={{ 
                        borderBottom: "1px solid var(--rv-color-border-thin)",
                        transition: "background 0.2s"
                      }}
                      className="user-row-hover"
                    >
                      {/* 头像与基础信息 */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            background: user.is_platform_admin ? "rgba(245, 158, 11, 0.12)" : "rgba(120, 113, 108, 0.1)",
                            color: user.is_platform_admin ? "#d97706" : "var(--rv-color-text-muted)",
                            fontWeight: "800",
                            fontSize: "14px",
                            display: "grid",
                            placeItems: "center",
                            flexShrink: 0
                          }}>
                            {initial}
                          </div>
                          <div>
                            <strong style={{ display: "block", color: "var(--rv-color-text-main)" }}>
                              {user.display_name} {isCurrentUser && <span style={{ fontSize: "10px", color: "var(--rv-color-primary)", fontWeight: "500", verticalAlign: "middle" }}>(我)</span>}
                            </strong>
                            <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>
                              {user.email ?? "无邮箱登记"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 复制 UUID */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <code style={{ fontSize: "11px", fontFamily: "monospace", color: "var(--rv-color-text-muted)", background: "rgba(0,0,0,0.03)", padding: "2px 6px", borderRadius: "4px" }}>
                            {user.id.slice(0, 8)}...
                          </code>
                          <button
                            type="button"
                            onClick={() => handleCopyId(user.id)}
                            style={{
                              border: 0,
                              background: "transparent",
                              cursor: "pointer",
                              padding: "4px",
                              color: copiedId === user.id ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                              display: "inline-flex",
                              alignItems: "center"
                            }}
                            title="复制完整 UUID"
                          >
                            {copiedId === user.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      </td>

                      {/* 全局平台管理角色 */}
                      <td style={{ padding: "14px 16px" }}>
                        {user.is_platform_admin ? (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "10px",
                            fontWeight: "700",
                            color: "#b45309",
                            background: "rgba(245, 158, 11, 0.08)",
                            padding: "2px 8px",
                            borderRadius: "4px"
                          }}>
                            <UserCheck size={12} />
                            超级管理员
                          </span>
                        ) : (
                          <span style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            color: "var(--rv-color-text-muted)",
                            background: "rgba(120, 113, 108, 0.08)",
                            padding: "2px 8px",
                            borderRadius: "4px"
                          }}>
                            普通用户
                          </span>
                        )}
                      </td>

                      {/* 当前工作区席位及配额 */}
                      <td style={{ padding: "14px 16px" }}>
                        {wsMember ? (
                          <div>
                            <span style={{
                              display: "inline-block",
                              fontSize: "10px",
                              fontWeight: "700",
                              background: wsMember.role === "owner" ? "rgba(180, 83, 9, 0.08)" : wsMember.role === "admin" ? "rgba(15, 118, 110, 0.08)" : "rgba(120, 113, 108, 0.08)",
                              color: wsMember.role === "owner" ? "#b45309" : wsMember.role === "admin" ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                              padding: "2px 6px",
                              borderRadius: "4px"
                            }}>
                              {wsMember.role === "owner" ? "所有者" : wsMember.role === "admin" ? "管理员" : "成员"}
                            </span>
                            <div style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", marginTop: "4px" }}>
                              日上限: {wsMember.daily_credit_limit ? `${wsMember.daily_credit_limit}点` : "无限制"}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontStyle: "italic" }}>
                            未加入工作区
                          </span>
                        )}
                      </td>

                      {/* 操作控制列 */}
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                          {/* 1. 超管一键切换 */}
                          <button
                            type="button"
                            onClick={() => handleTogglePlatformAdmin(user)}
                            className="secondary-button"
                            style={{
                              padding: "6px 10px",
                              fontSize: "11px",
                              minHeight: "28px",
                              color: user.is_platform_admin ? "#dc2626" : "var(--rv-color-text-main)",
                              borderColor: user.is_platform_admin ? "rgba(220, 38, 38, 0.2)" : "var(--rv-color-border-thin)"
                            }}
                          >
                            {user.is_platform_admin ? "撤销超管" : "设为超管"}
                          </button>

                          {/* 2. 工作区席位配置 */}
                          <button
                            type="button"
                            onClick={() => openSeatingModal(user)}
                            className="secondary-button"
                            style={{
                              padding: "6px 10px",
                              fontSize: "11px",
                              minHeight: "28px",
                              background: wsMember ? "transparent" : "var(--rv-color-primary-light)",
                              color: wsMember ? "var(--rv-color-primary)" : "var(--rv-color-primary)",
                              border: "1px solid var(--rv-color-primary)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}
                          >
                            <Sliders size={12} />
                            {wsMember ? "修改配额" : "分配席位"}
                          </button>

                          {/* 3. 一键移出席位 */}
                          {wsMember && (
                            <button
                              type="button"
                              onClick={() => handleRemoveWorkspaceMember(user)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "1px solid rgba(220, 38, 38, 0.15)",
                                background: "rgba(220, 38, 38, 0.02)",
                                color: "#dc2626",
                                width: "28px",
                                height: "28px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                              className="member-delete-btn"
                              title="将该用户从当前工作区席位移除"
                            >
                              <UserX size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: "40px 0", textAlign: "center" }}>
                    <div className="empty-state compact-empty" style={{ minHeight: "150px" }}>
                      <p>未找到符合筛选条件的用户记录</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. 精致的席位分配磨砂模态框 (Modal) */}
      {showSeatModal && selectedUserForSeat && (
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
                onClick={() => {
                  setShowSeatModal(false);
                  setSelectedUserForSeat(null);
                }}
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

            {/* 用户快速简报 */}
            <div 
              style={{ 
                background: "rgba(15, 118, 110, 0.04)", 
                border: "1px solid rgba(15, 118, 110, 0.1)", 
                borderRadius: "8px", 
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--rv-color-primary)", color: "#ffffff", display: "grid", placeItems: "center", fontWeight: "bold" }}>
                {selectedUserForSeat.display_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <strong style={{ display: "block", fontSize: "12px", color: "var(--rv-color-text-main)" }}>
                  {selectedUserForSeat.display_name}
                </strong>
                <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)" }}>
                  {selectedUserForSeat.email ?? selectedUserForSeat.id}
                </span>
              </div>
            </div>

            {/* 表单提交 */}
            <form onSubmit={handleUpsertWorkspaceMember} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="assets-form-field">
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>席位角色</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ 
                      minHeight: "38px", 
                      border: "1px solid var(--rv-color-border-thin)", 
                      borderRadius: "8px", 
                      padding: "0 10px", 
                      background: "#ffffff",
                      fontSize: "12px"
                    }}
                  >
                    <option value="owner">所有者 (Owner)</option>
                    <option value="admin">管理员 (Admin)</option>
                    <option value="member">普通成员 (Member)</option>
                  </select>
                </div>

                <div className="assets-form-field">
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>成员状态</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    style={{ 
                      minHeight: "38px", 
                      border: "1px solid var(--rv-color-border-thin)", 
                      borderRadius: "8px", 
                      padding: "0 10px", 
                      background: "#ffffff",
                      fontSize: "12px"
                    }}
                  >
                    <option value="active">正常启用</option>
                    <option value="suspended">封禁挂起</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div className="assets-form-field">
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>日消费点数上限</label>
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                    placeholder="0 代表不设限"
                    style={{ height: "38px", borderRadius: "8px", fontSize: "12px" }}
                  />
                </div>

                <div className="assets-form-field">
                  <label style={{ fontSize: "11px", fontWeight: "700" }}>月消费点数上限</label>
                  <input
                    type="number"
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                    placeholder="0 代表不设限"
                    style={{ height: "38px", borderRadius: "8px", fontSize: "12px" }}
                  />
                </div>
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
                  <strong>分配警告:</strong> 点数上限指该用户在<strong>当前选定的工作区</strong>内的消费额度限制，系统级别将自动在其触发任务时扣减相应点数。
                </span>
              </div>

              {/* 动作按钮 */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowSeatModal(false);
                    setSelectedUserForSeat(null);
                  }}
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
      )}
    </div>
  );
}
