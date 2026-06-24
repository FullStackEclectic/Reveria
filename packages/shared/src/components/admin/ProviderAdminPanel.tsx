import React, { FormEvent, useState } from "react";
import { Plus, Cpu, RefreshCw, X, Check, ShieldAlert, Layers } from "lucide-react";
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
  refreshAll?: () => Promise<void>;
}

export function ProviderAdminPanel({
  providers,
  setProviders,
  setAdminMessage,
  refreshAll,
}: ProviderAdminPanelProps) {
  const [name, setName] = useState("OpenAI Compatible");
  const [providerType, setProviderType] = useState("openai");
  const [apiUrl, setApiUrl] = useState("https://api.openai.com");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);

  // 代理拉取模型状态
  const [activeProvider, setActiveProvider] = useState<ProviderSummary | null>(null);
  const [showModelsModal, setShowModelsModal] = useState(false);
  const [upstreamModels, setUpstreamModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  
  // 勾选及定价的状态管理
  const [modelConfigs, setModelConfigs] = useState<Record<string, { selected: boolean; type: string; cost: number }>>({});

  // 创建服务商
  async function handleCreateProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const provider = await postJson<ProviderSummary>("/api/admin/providers", {
        name,
        provider_type: providerType,
        api_url: apiUrl || null,
        api_key: apiKey || null,
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

  // 服务商状态启用/禁用
  async function updateProviderEnabled(provider: ProviderSummary, newEnabled: boolean) {
    try {
      await postJson(`/api/admin/providers/${provider.id}/enabled`, { enabled: newEnabled });
      setProviders((current) =>
        current.map((item) => (item.id === provider.id ? { ...item, enabled: newEnabled } : item))
      );
      setAdminMessage(`${provider.name} 已${newEnabled ? "启用" : "停用"}`);
    } catch {
      setAdminMessage("供应商状态更新失败");
    }
  }

  // 删除服务商
  async function handleDeleteProvider(providerId: string) {
    if (!window.confirm("确定要删除该供应商吗？这会级联删除其关联的所有算力模型！")) {
      return;
    }
    try {
      await deleteJson(`/api/admin/providers/${providerId}`);
      setProviders((current) => current.filter((item) => item.id !== providerId));
      setAdminMessage("供应商已成功删除");
    } catch (err: any) {
      console.error("Delete provider failed:", err);
      setAdminMessage("供应商删除失败");
    }
  }

  // 1. 发起拉取模型列表请求
  async function handleFetchUpstreamModels(provider: ProviderSummary) {
    setActiveProvider(provider);
    setIsLoadingModels(true);
    setUpstreamModels([]);
    setModelConfigs({});
    setAdminMessage(`正在拉取 ${provider.name} 的可用模型列表...`);
    
    try {
      // 真实请求后端代理获取模型 ID 数组
      const models = await postJson<string[]>("/api/admin/providers/fetch-upstream-models", {
        api_url: provider.api_url,
        api_key: provider.api_key
      });

      setUpstreamModels(models);

      // 智能根据 ID 初始化模型类型与基准定价
      const initialConfigs: Record<string, { selected: boolean; type: string; cost: number }> = {};
      models.forEach((id) => {
        const lid = id.toLowerCase();
        let type = "chat";
        let cost = 10; // 默认对话模型 10 点数

        if (lid.includes("sd") || lid.includes("stable") || lid.includes("flux") || lid.includes("dall") || lid.includes("image") || lid.includes("midjourney")) {
          type = "image";
          cost = 50;  // 默认绘图模型 50 点数
        } else if (lid.includes("kling") || lid.includes("sora") || lid.includes("video") || lid.includes("runway") || lid.includes("luma") || lid.includes("minimax")) {
          type = "video";
          cost = 200; // 默认视频模型 200 点数
        }

        initialConfigs[id] = {
          selected: false, // 默认不勾选，由管理员按需勾选导入
          type,
          cost
        };
      });

      setModelConfigs(initialConfigs);
      setShowModelsModal(true);
      setAdminMessage(`成功拉取 ${models.length} 个上游模型`);
    } catch (err: any) {
      console.error(err);
      setAdminMessage(`拉取模型失败：请确保 API 请求地址和密钥正确且网络连通 (${err?.message || err})`);
    } finally {
      setIsLoadingModels(false);
    }
  }

  // 2. 批量提交导入选中的模型
  async function handleBatchImportModels(e: FormEvent) {
    e.preventDefault();
    if (!activeProvider) return;

    // 筛选出被勾选的模型
    const itemsToImport = Object.keys(modelConfigs)
      .filter((id) => modelConfigs[id].selected)
      .map((id) => ({
        id: `${activeProvider.id}-${id}`, // 加上服务商 ID 前缀防止同名模型冲突
        provider_id: activeProvider.id,
        name: id,
        display_name: `${id} (${activeProvider.name})`,
        model_type: modelConfigs[id].type,
        credits_cost: modelConfigs[id].cost
      }));

    if (itemsToImport.length === 0) {
      alert("请至少勾选一个需要导入的模型！");
      return;
    }

    try {
      await postJson("/api/admin/models/batch-import", itemsToImport);
      setAdminMessage(`成功导入/更新了 ${itemsToImport.length} 个模型！`);
      setShowModelsModal(false);
      setActiveProvider(null);
      if (refreshAll) {
        await refreshAll();
      }
    } catch (err) {
      console.error(err);
      setAdminMessage("批量导入模型保存失败");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* 双栏布局 */}
      <div className="admin-subpanel-grid" style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: "20px" }}>
        
        {/* 服务商配置表单 */}
        <div className="panel" style={{ minHeight: "auto", display: "flex", flexDirection: "column" }}>
          <div className="panel-header" style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "12px", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>上游算力服务商接入</h3>
            <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>管理大模型中台网关的上游接口参数</span>
          </div>

          <form onSubmit={handleCreateProvider} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>供应商名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="如 12ZX-AI, 官方OpenAI等" />
            </div>

            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>通道协议类型</label>
              <select
                value={providerType}
                onChange={(e) => setProviderType(e.target.value)}
                style={{ minHeight: "36px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-sm)", padding: "0 10px", background: "#ffffff" }}
              >
                <option value="openai">OpenAI Compatible (通用主流协议)</option>
                <option value="gemini">Google Gemini</option>
                <option value="volcengine">字节火山引擎</option>
              </select>
            </div>

            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>API 请求地址 (Base URL)</label>
              <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="如 https://api.openai.com" required />
            </div>

            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>接口密钥 (API Key)</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="填入该通道的 sk-..." required />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--rv-color-text-main)", cursor: "pointer" }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: "auto" }} />
                默认启用该通道
              </label>
              <button className="primary-button" type="submit" style={{ minHeight: "34px", padding: "0 16px" }}>
                <Plus size={16} />
                添加服务商
              </button>
            </div>
          </form>
        </div>

        {/* 服务商列表 */}
        <div className="panel" style={{ minHeight: "auto", display: "flex", flexDirection: "column" }}>
          <div className="panel-header" style={{ borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "12px", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>已接入算力服务商</h3>
            <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>当前系统注册在库的所有上游渠道列表</span>
          </div>

          <div style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>渠道大盘 ({providers.length})</span>
            {providers.length > 0 ? (
              <div style={{ display: "grid", gap: "10px" }}>
                {providers.map((provider) => (
                  <div key={provider.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: provider.enabled ? "var(--rv-color-primary-light)" : "rgba(0,0,0,0.04)", color: provider.enabled ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)", display: "grid", placeItems: "center" }}>
                        <Cpu size={16} />
                      </div>
                      <div>
                        <strong style={{ display: "block", fontSize: "12px", color: "var(--rv-color-text-main)" }}>{provider.name}</strong>
                        <span style={{ display: "block", fontSize: "9px", color: "var(--rv-color-text-muted)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px", whiteSpace: "nowrap" }}>
                          {provider.api_url}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      {/* 1. 一键拉取并定价按钮 */}
                      <button
                        onClick={() => void handleFetchUpstreamModels(provider)}
                        disabled={isLoadingModels && activeProvider?.id === provider.id}
                        style={{
                          border: "1px solid var(--rv-color-primary)",
                          background: "rgba(15, 118, 110, 0.05)",
                          color: "var(--rv-color-primary)",
                          padding: "4px 8px",
                          fontSize: "10px",
                          fontWeight: "700",
                          borderRadius: "4px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        type="button"
                      >
                        {isLoadingModels && activeProvider?.id === provider.id ? (
                          <RefreshCw size={10} className="spin" />
                        ) : (
                          <Plus size={10} />
                        )}
                        获取并定价模型
                      </button>

                      {/* 2. 状态切换 */}
                      <button
                        onClick={() => void updateProviderEnabled(provider, !provider.enabled)}
                        style={{
                          border: "1px solid",
                          borderColor: provider.enabled ? "#dc2626" : "var(--rv-color-border-thin)",
                          background: provider.enabled ? "#fee2e2" : "#ffffff",
                          color: provider.enabled ? "#b91c1c" : "var(--rv-color-text-main)",
                          padding: "4px 8px",
                          fontSize: "10px",
                          fontWeight: "700",
                          borderRadius: "4px",
                          cursor: "pointer"
                        }}
                        type="button"
                      >
                        {provider.enabled ? "禁用" : "启用"}
                      </button>

                      {/* 3. 删除按钮 */}
                      <button
                        onClick={() => void handleDeleteProvider(provider.id)}
                        style={{
                          border: "1px solid #dc2626",
                          background: "#fee2e2",
                          color: "#b91c1c",
                          padding: "4px 8px",
                          fontSize: "10px",
                          fontWeight: "700",
                          borderRadius: "4px",
                          cursor: "pointer"
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
                <p>暂无供应商通道，请在左侧表单接入一个以开启拉取</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. 精致的上游模型批量配置及计费导入 Modal */}
      {showModelsModal && activeProvider && (
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
            animation: "fadeIn 0.2s"
          }}
        >
          <div 
            className="panel"
            style={{
              width: "680px",
              maxHeight: "80vh",
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
            {/* Modal 头 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>上游模型列表定价导入</h3>
                <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>
                  从 {activeProvider.name} 拉取到的模型。请分类标记并设定单次扣点价格。
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowModelsModal(false);
                  setActiveProvider(null);
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

            {/* 模型列表及计费选择 */}
            <form onSubmit={handleBatchImportModels} style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, minHeight: 0 }}>
              <div 
                style={{ 
                  flex: 1, 
                  overflowY: "auto", 
                  border: "1px solid var(--rv-color-border-thin)", 
                  borderRadius: "8px", 
                  background: "rgba(0,0,0,0.005)"
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "rgba(0,0,0,0.02)", borderBottom: "1px solid var(--rv-color-border-thin)", fontWeight: "bold", color: "var(--rv-color-text-muted)" }}>
                      <th style={{ padding: "10px 14px", width: "40px" }}>
                        <input
                          type="checkbox"
                          checked={
                            upstreamModels.length > 0 &&
                            upstreamModels.every((id) => modelConfigs[id]?.selected)
                          }
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setModelConfigs((prev) => {
                              const updated = { ...prev };
                              upstreamModels.forEach((id) => {
                                if (updated[id]) {
                                  updated[id] = { ...updated[id], selected: isChecked };
                                }
                              });
                              return updated;
                            });
                          }}
                          style={{ cursor: "pointer", width: "auto" }}
                        />
                      </th>
                      <th style={{ padding: "10px 14px" }}>模型名称 (Model ID)</th>
                      <th style={{ padding: "10px 14px", width: "140px" }}>模型类型</th>
                      <th style={{ padding: "10px 14px", width: "120px" }}>计费点数/次</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upstreamModels.length > 0 ? (
                      upstreamModels.map((id) => {
                        const config = modelConfigs[id] || { selected: false, type: "chat", cost: 10 };
                        return (
                          <tr key={id} style={{ borderBottom: "1px solid var(--rv-color-border-thin)" }}>
                            {/* 选择框 */}
                            <td style={{ padding: "8px 14px" }}>
                              <input
                                type="checkbox"
                                checked={config.selected}
                                onChange={(e) => {
                                  setModelConfigs((prev) => ({
                                    ...prev,
                                    [id]: { ...prev[id], selected: e.target.checked }
                                  }));
                                }}
                                style={{ cursor: "pointer", width: "auto" }}
                              />
                            </td>
                            {/* 模型 ID */}
                            <td style={{ padding: "8px 14px" }}>
                              <code style={{ fontFamily: "monospace", color: "var(--rv-color-text-main)" }}>{id}</code>
                            </td>
                            {/* 模型类型 */}
                            <td style={{ padding: "8px 14px" }}>
                              <select
                                value={config.type}
                                disabled={!config.selected}
                                onChange={(e) => {
                                  setModelConfigs((prev) => ({
                                    ...prev,
                                    [id]: { ...prev[id], type: e.target.value }
                                  }));
                                }}
                                style={{ minHeight: "28px", fontSize: "11px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "4px", background: "#ffffff", width: "100%" }}
                              >
                                <option value="chat">💬 对话 (Chat)</option>
                                <option value="image">🎨 图像 (Image)</option>
                                <option value="video">🎬 视频 (Video)</option>
                              </select>
                            </td>
                            {/* 计费点数 */}
                            <td style={{ padding: "8px 14px" }}>
                              <input
                                type="number"
                                min={0}
                                disabled={!config.selected}
                                value={config.cost}
                                onChange={(e) => {
                                  setModelConfigs((prev) => ({
                                    ...prev,
                                    [id]: { ...prev[id], cost: Number(e.target.value) }
                                  }));
                                }}
                                style={{
                                  height: "28px",
                                  fontSize: "11px",
                                  borderRadius: "4px",
                                  border: "1px solid var(--rv-color-border-thin)",
                                  padding: "0 8px",
                                  width: "90px"
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ padding: "30px 0", textAlign: "center", color: "var(--rv-color-text-muted)" }}>
                          未拉取到模型列表
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 安全警告说明 */}
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
                  <strong>批量计费定价建议：</strong> 对话模型（如 deepseek）消耗较低，推荐预设为 10 点；生图模型（如 Stable Diffusion）推荐设定 50 点；视频模型消耗极大推荐设定为 200 点以上。系统将依据该设置在生成流水中进行额度划拨扣除。
                </span>
              </div>

              {/* 脚部动作 */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModelsModal(false);
                    setActiveProvider(null);
                  }}
                  className="secondary-button"
                  style={{ minHeight: "34px", fontSize: "12px", borderRadius: "8px" }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  style={{ minHeight: "34px", fontSize: "12px", borderRadius: "8px", padding: "0 20px" }}
                >
                  <Plus size={12} />
                  一键导入选中模型
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
