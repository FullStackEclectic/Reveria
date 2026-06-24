import React, { FormEvent, useState } from "react";
import { Plus, Server, UserCheck, ShieldAlert, Cpu } from "lucide-react";
import { ProviderSummary, UserSummary } from "../../types";
import { postJson, deleteJson } from "../../utils";

interface ProviderAdminPanelProps {
  providers: ProviderSummary[];
  setProviders: React.Dispatch<React.SetStateAction<ProviderSummary[]>>;
  adminUsers: UserSummary[];
  setAdminUsers: React.Dispatch<React.SetStateAction<UserSummary[]>>;
  currentUser: UserSummary | null;
  setCurrentUser: (user: UserSummary | null) => void;
  setAdminMessage: (msg: string) => void;
}

const CURRENT_USER_STORAGE_KEY = "reveria.currentUser";

export function ProviderAdminPanel({
  providers,
  setProviders,
  adminUsers,
  setAdminUsers,
  currentUser,
  setCurrentUser,
  setAdminMessage,
}: ProviderAdminPanelProps) {
  const [name, setName] = useState("OpenAI Compatible");
  const [providerType, setProviderType] = useState("openai-compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState("");
  const [enabled, setEnabled] = useState(true);

  async function handleCreateProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const provider = await postJson<ProviderSummary>("/api/admin/providers", {
        name,
        provider_type: providerType,
        base_url: baseUrl || null,
        api_key: apiKey || null,
        region: region || null,
        enabled,
      });
      setProviders((current) => [provider, ...current]);
      setApiKey("");
      setAdminMessage(`已添加供应商：${provider.name}`);
    } catch (err: any) {
      console.error("Create provider failed:", err);
      setAdminMessage(`供应商保存失败：${err?.message || err}`);
    }
  }

  async function updateProviderEnabled(provider: ProviderSummary, newEnabled: boolean) {
    try {
      const updated = await postJson<ProviderSummary>(
        `/api/admin/providers/${provider.id}/enabled`,
        { enabled: newEnabled }
      );
      setProviders((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setAdminMessage(`${updated.name} 已${updated.enabled ? "启用" : "停用"}`);
    } catch {
      setAdminMessage("供应商启停失败：启用前必须完整配置 Base URL 和 API Key");
    }
  }

  async function handleDeleteProvider(providerId: string) {
    if (!window.confirm("确定要删除该供应商吗？这会级联删除其关联的所有模型！")) {
      return;
    }
    try {
      await deleteJson(`/api/admin/providers/${providerId}`);
      setProviders((current) => current.filter((item) => item.id !== providerId));
      setAdminMessage("供应商已成功删除");
    } catch (err: any) {
      console.error("Delete provider failed:", err);
      setAdminMessage(`供应商删除失败：${err?.message || err}`);
    }
  }

  async function updatePlatformAdmin(user: UserSummary, isPlatformAdmin: boolean) {
    try {
      const updated = await postJson<UserSummary>(
        `/api/admin/users/${user.id}/platform-admin`,
        { is_platform_admin: isPlatformAdmin }
      );
      setAdminUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      if (currentUser?.id === updated.id) {
        setCurrentUser(updated);
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updated));
      }
      setAdminMessage(`${updated.display_name} 已${updated.is_platform_admin ? "设为" : "撤销"}平台管理员`);
    } catch {
      setAdminMessage("平台管理员更新失败：不能撤销最后一个管理员，或当前账号无权限");
    }
  }

  return (
    <div className="admin-subpanel-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "20px" }}>
      {/* 供应商接入管理 */}
      <div className="panel" style={{ minHeight: "auto", display: "flex", flexDirection: "column" }}>
        <div className="panel-header" style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "12px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>上游算力供应商</h3>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>管理支持该工作区运行的底层大模型接口</span>
        </div>

        <form onSubmit={handleCreateProvider} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          <div className="assets-form-field">
            <label style={{ fontSize: "10px", fontWeight: "700" }}>供应商名称</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="assets-form-field">
            <label style={{ fontSize: "10px", fontWeight: "700" }}>供应商类型</label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value)}
              style={{ minHeight: "36px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-sm)", padding: "0 10px", background: "#ffffff" }}
            >
              <option value="openai-compatible">OpenAI Compatible</option>
              <option value="google">Google Gemini</option>
              <option value="bytedance">字节火山引擎</option>
              <option value="xai">xAI</option>
            </select>
          </div>

          <div className="assets-form-field" style={{ gridColumn: "span 2" }}>
            <label style={{ fontSize: "10px", fontWeight: "700" }}>接口 Base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="如 https://api.openai.com/v1" />
          </div>

          <div className="assets-form-field" style={{ gridColumn: "span 2" }}>
            <label style={{ fontSize: "10px", fontWeight: "700" }}>密钥 API Key</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="填入加密的 API Token" />
          </div>

          <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--rv-color-text-main)", cursor: "pointer" }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: "auto" }} />
              默认启用此上游渠道
            </label>
            <button className="primary-button" type="submit" style={{ minHeight: "34px", padding: "0 16px" }}>
              <Plus size={16} />
              添加供应商
            </button>
          </div>
        </form>

        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>已登记的供应商</span>
          {providers.length > 0 ? (
            <div style={{ display: "grid", gap: "10px" }}>
              {providers.map((provider) => (
                <div key={provider.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "6px", background: provider.enabled ? "var(--rv-color-primary-light)" : "rgba(0,0,0,0.04)", color: provider.enabled ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)", display: "grid", placeItems: "center" }}>
                      <Cpu size={16} />
                    </div>
                    <div>
                      <strong style={{ display: "block", fontSize: "12px", color: "var(--rv-color-text-main)" }}>{provider.name}</strong>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", marginTop: "1px" }}>{provider.provider_type}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => void updateProviderEnabled(provider, !provider.enabled)}
                      style={{
                        border: "1px solid",
                        borderColor: provider.enabled ? "#dc2626" : "var(--rv-color-border-thin)",
                        background: provider.enabled ? "#fee2e2" : "#ffffff",
                        color: provider.enabled ? "#b91c1c" : "var(--rv-color-text-main)",
                        padding: "4px 10px",
                        fontSize: "10px",
                        fontWeight: "700",
                        borderRadius: "4px"
                      }}
                      type="button"
                    >
                      {provider.enabled ? "停用" : "启用"}
                    </button>
                    <button
                      onClick={() => void handleDeleteProvider(provider.id)}
                      style={{
                        border: "1px solid #dc2626",
                        background: "#fee2e2",
                        color: "#b91c1c",
                        padding: "4px 10px",
                        fontSize: "10px",
                        fontWeight: "700",
                        borderRadius: "4px"
                      }}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty" style={{ minHeight: "120px" }}>
              <p>暂无供应商接入，请使用上方表单登记第一个</p>
            </div>
          )}
        </div>
      </div>

      {/* 平台管理员列表 */}
      <div className="panel" style={{ minHeight: "auto", display: "flex", flexDirection: "column" }}>
        <div className="panel-header" style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "12px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>平台管理员</h3>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>管理拥有全系统大后台管理访问权限的账户</span>
        </div>

        <div style={{ background: "rgba(245, 158, 11, 0.04)", border: "1px solid rgba(245, 158, 11, 0.2)", borderRadius: "8px", padding: "12px 14px", display: "flex", gap: "10px", color: "#b45309", marginBottom: "20px" }}>
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div style={{ fontSize: "11px", lineHeight: "1.4" }}>
            <strong>安全提示:</strong> 拥有该权限的用户可浏览任意工作区报表、编辑核心接口账密、为用户调整点数。请谨慎赋予此权限。
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>平台管理员用户 ({adminUsers.length})</span>
          {adminUsers.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {adminUsers.map((user) => (
                <div key={user.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--rv-color-primary-light)", color: "var(--rv-color-primary)", display: "grid", placeItems: "center" }}>
                      <UserCheck size={16} />
                    </div>
                    <div>
                      <strong style={{ display: "block", fontSize: "12px", color: "var(--rv-color-text-main)" }}>{user.display_name}</strong>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", marginTop: "1px" }}>{user.email ?? user.id}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => void updatePlatformAdmin(user, !user.is_platform_admin)}
                    style={{
                      border: "1px solid",
                      borderColor: "var(--rv-color-border-thin)",
                      background: "#ffffff",
                      color: "#dc2626",
                      padding: "4px 10px",
                      fontSize: "10px",
                      fontWeight: "700",
                      borderRadius: "4px"
                    }}
                    type="button"
                  >
                    撤销
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty" style={{ minHeight: "120px" }}>
              <p>暂无系统管理员</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
