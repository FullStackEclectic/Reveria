import React, { FormEvent, useEffect, useState } from "react";
import { Save, RefreshCw, Globe, ShieldAlert, Server } from "lucide-react";
import { getJson, postJson } from "../../utils";

interface ClientSettings {
  id: string;
  site_title: string;
  site_announcement: string;
  upstream_api_url: string;
  upstream_api_key: string;
  allow_user_register: boolean;
  gift_credits_on_register: number;
  price_rate: number;
  billing_mode: string;
  bridge_main_station_url: string;
  bridge_internal_secret: string;
  bridge_text_model: string;
  bridge_image_model: string;
  bridge_video_model: string;
  bridge_text_pools: string;
  bridge_image_pools: string;
  bridge_video_pools: string;
}

interface ClientSettingsPanelProps {
  mode: "bridge" | "standalone";
  onSettingsSaved?: (billingMode: string) => void;
}

// 智能二级联动模型与资源池过滤选择器组件
function DualModelSelector({
  title,
  models,
  selectedPoolsString,
  selectedModelsString,
  onPoolsChange,
  onModelsChange
}: {
  title: string;
  models: any[];
  selectedPoolsString: string;
  selectedModelsString: string;
  onPoolsChange: (newPools: string) => void;
  onModelsChange: (newModels: string) => void;
}) {
  const allPools = (() => {
    const poolSet = new Set<string>();
    models.forEach(m => {
      if (m.tags) {
        m.tags.split(",").forEach((t: string) => {
          const cleaned = t.trim();
          if (cleaned) poolSet.add(cleaned);
        });
      } else {
        poolSet.add("未分类");
      }
    });
    return Array.from(poolSet).sort();
  })();

  const selectedPools = selectedPoolsString ? selectedPoolsString.split(",").map(p => p.trim()).filter(Boolean) : [];
  const selectedModels = selectedModelsString ? selectedModelsString.split(",").map(m => m.trim()).filter(Boolean) : [];

  const handleTogglePool = (pool: string) => {
    let nextPools = [...selectedPools];
    if (nextPools.includes(pool)) {
      nextPools = nextPools.filter(p => p !== pool);
    } else {
      nextPools.push(pool);
    }
    onPoolsChange(nextPools.join(","));
  };

  const filteredModels = models.filter(m => {
    if (selectedPools.length === 0) return false;
    const mTags = m.tags ? m.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : ["未分类"];
    return mTags.some((tag: string) => selectedPools.includes(tag));
  });

  const handleToggleModel = (id: string) => {
    let nextModels = [...selectedModels];
    if (nextModels.includes(id)) {
      nextModels = nextModels.filter(m => m !== id);
    } else {
      nextModels.push(id);
    }
    onModelsChange(nextModels.join(","));
  };

  const handleSelectAllFilteredModels = () => {
    const nextModels = Array.from(new Set([...selectedModels, ...filteredModels.map(m => m.id)]));
    onModelsChange(nextModels.join(","));
  };

  const handleClearFilteredModels = () => {
    const filteredIds = filteredModels.map(m => m.id);
    const nextModels = selectedModels.filter(id => !filteredIds.includes(id));
    onModelsChange(nextModels.join(","));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "12px" }}>
      <div style={{
        fontSize: "13px",
        fontWeight: "700",
        color: "var(--rv-color-text-main)",
        borderBottom: "1px dashed var(--rv-color-border-thin)",
        paddingBottom: "6px",
        marginTop: "4px"
      }}>
        {title}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
          第一层：配置当前板块接入的主站资源池 (Tags)
        </span>
        {allPools.length === 0 ? (
          <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", padding: "4px 0" }}>
            暂未同步到主站关联标签，请在下方点击“重新拉取主站模型”。
          </div>
        ) : (
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "14px",
            background: "#ffffff",
            padding: "10px 14px",
            borderRadius: "6px",
            border: "1px solid var(--rv-color-border-thin)",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.01)"
          }}>
            {allPools.map(pool => {
              const isChecked = selectedPools.includes(pool);
              return (
                <label
                  key={pool}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: isChecked ? "#0284c7" : "var(--rv-color-text-main)",
                    cursor: "pointer",
                    userSelect: "none"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleTogglePool(pool)}
                    style={{ cursor: "pointer", accentColor: "#0284c7", width: "14px", height: "14px" }}
                  />
                  <span>{pool}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
            第二层：在选中的资源池内，勾选分站最终开放的精选大模型
          </span>
          {selectedPools.length > 0 && filteredModels.length > 0 && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleSelectAllFilteredModels}
                style={{ border: 0, background: "transparent", color: "#0284c7", fontSize: "11px", fontWeight: "600", cursor: "pointer", padding: 0 }}
              >
                全选
              </button>
              <span style={{ color: "#cbd5e1", fontSize: "11px" }}>|</span>
              <button
                type="button"
                onClick={handleClearFilteredModels}
                style={{ border: 0, background: "transparent", color: "#64748b", fontSize: "11px", fontWeight: "600", cursor: "pointer", padding: 0 }}
              >
                清空
              </button>
            </div>
          )}
        </div>

        {selectedPools.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", border: "1px dashed var(--rv-color-border-thin)", borderRadius: "8px", fontSize: "12px", color: "var(--rv-color-text-muted)", background: "#f8fafc" }}>
            请先在上方勾选接入的资源池，之后才会在此展现对应资源池下的具体模型供您精细挑选。
          </div>
        ) : filteredModels.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", border: "1px dashed var(--rv-color-border-thin)", borderRadius: "8px", fontSize: "12px", color: "var(--rv-color-text-muted)", background: "#f8fafc" }}>
            选中的资源池下暂无可供配置的模型选项。
          </div>
        ) : (
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            maxHeight: "140px",
            overflowY: "auto",
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid var(--rv-color-border-thin)",
            background: "#ffffff"
          }}>
            {filteredModels.map(m => {
              const isSelected = selectedModels.includes(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => handleToggleModel(m.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "20px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    userSelect: "none",
                    transition: "all 0.2s",
                    border: isSelected ? "1px solid #0284c7" : "1px solid #e2e8f0",
                    background: isSelected ? "rgba(2, 132, 199, 0.08)" : "#f8fafc",
                    color: isSelected ? "#0284c7" : "#475569"
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#cbd5e1";
                      e.currentTarget.style.background = "#f1f5f9";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.background = "#f8fafc";
                    }
                  }}
                >
                  {m.display_name || m.name}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientSettingsPanel({ mode, onSettingsSaved }: ClientSettingsPanelProps) {
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        const res = await getJson<any>("/api/admin/settings");
        const configData = res.data || res;
        setSettings(configData);

        try {
          const modelsList = await getJson<any[]>("/api/admin/models?all=true");
          setAvailableModels(modelsList || []);
        } catch (e) {
          console.error("加载可用模型列表失败", e);
        }
      } catch (err) {
        setMessage("加载系统配置失败：" + (err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function fetchBridgeModels() {
    if (!settings) return;
    if (!settings.bridge_main_station_url) {
      alert("请先填写并保存主站 API 根地址");
      return;
    }

    setIsRefreshingModels(true);
    setMessage("");
    try {
      const updatedSettings = { ...settings, billing_mode: "bridge" };
      await postJson("/api/admin/settings", updatedSettings);
      setSettings(updatedSettings);

      const modelsList = await getJson<any[]>("/api/admin/models?all=true");
      setAvailableModels(modelsList || []);
      setMessage("成功同步主站模型列表！共获取到 " + (modelsList?.length || 0) + " 个模型供配置勾选。");
    } catch (err) {
      setMessage("同步主站模型列表失败：" + (err as Error).message);
    } finally {
      setIsRefreshingModels(false);
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    setMessage("");
    try {
      const updatedSettings = { ...settings, billing_mode: mode };
      await postJson("/api/admin/settings", updatedSettings);
      setSettings(updatedSettings);
      setMessage(mode === "bridge" ? "共通对接配置已保存成功！" : "自营上游配置已保存成功！");
      if (onSettingsSaved) {
        onSettingsSaved(mode);
      }
    } catch (err) {
      setMessage("保存配置失败：" + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "150px", color: "var(--rv-color-text-muted)" }}>
        <RefreshCw size={20} className="spin" style={{ marginRight: "8px" }} />
        <span>正在加载对接参数...</span>
      </div>
    );
  }

  return (
    <div style={{
      background: "#ffffff",
      borderRadius: "12px",
      border: "1px solid var(--rv-color-border-thin)",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.015)",
      overflow: "hidden"
    }}>
      {/* 头部装饰条，Bridge 和 Standalone 颜色区隔以显得高档 */}
      <div style={{
        height: "4px",
        background: mode === "bridge" 
          ? "linear-gradient(90deg, #0284c7, #0ea5e9)" 
          : "linear-gradient(90deg, var(--rv-color-primary), #10b981)"
      }} />

      <div style={{ padding: "24px" }}>
        <h3 style={{
          fontSize: "14px",
          fontWeight: "700",
          margin: "0 0 16px 0",
          color: "var(--rv-color-text-main)",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          {mode === "bridge" ? (
            <>
              <Globe size={16} style={{ color: "#0284c7" }} />
              <span>主站共通对接参数配置 (Bridge Mode)</span>
            </>
          ) : (
            <>
              <Server size={16} style={{ color: "var(--rv-color-primary)" }} />
              <span>自营渠道上游代理设置 (Standalone Mode)</span>
            </>
          )}
        </h3>

        {message && (
          <div style={{
            padding: "10px 14px",
            borderRadius: "6px",
            background: message.includes("失败") || message.includes("出错") ? "#fff5f5" : "#f0fdf4",
            border: `1px solid ${message.includes("失败") || message.includes("出错") ? "#fed7d7" : "#bbf7d0"}`,
            color: message.includes("失败") || message.includes("出错") ? "#c53030" : "#15803d",
            fontSize: "12px",
            fontWeight: "500",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            {message.includes("失败") || message.includes("出错") ? <ShieldAlert size={14} /> : null}
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {mode === "bridge" ? (
            /* 1. 共通模式专属表单 */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
                    主站 API 根地址 <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={settings?.bridge_main_station_url || ""}
                    onChange={(e) => setSettings(settings ? { ...settings, bridge_main_station_url: e.target.value } : null)}
                    placeholder="如 https://main-station.com"
                    style={{
                      height: "38px",
                      width: "100%",
                      padding: "0 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--rv-color-border-thin)",
                      fontSize: "12px",
                      outline: "none"
                    }}
                    required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
                    内部桥接通信密钥 (Bridge Secret)
                  </label>
                  <input
                    type="password"
                    value={settings?.bridge_internal_secret || ""}
                    onChange={(e) => setSettings(settings ? { ...settings, bridge_internal_secret: e.target.value } : null)}
                    placeholder="填入与主站对接的密钥"
                    style={{
                      height: "38px",
                      width: "100%",
                      padding: "0 12px",
                      borderRadius: "6px",
                      border: "1px solid var(--rv-color-border-thin)",
                      fontSize: "12px",
                      outline: "none"
                    }}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
                  主站 API KEY / Token (选填)
                </label>
                <input
                  type="password"
                  value={settings?.upstream_api_key || ""}
                  onChange={(e) => setSettings(settings ? { ...settings, upstream_api_key: e.target.value } : null)}
                  placeholder="分站调用主站大模型所使用的 Token"
                  style={{
                    height: "38px",
                    width: "100%",
                    padding: "0 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--rv-color-border-thin)",
                    fontSize: "12px",
                    outline: "none"
                  }}
                  autoComplete="new-password"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "#f8fafc", padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "4px" }}>
                <DualModelSelector
                  title="允许开放的文本大模型 (Bridge Text Models)"
                  models={availableModels.filter(m => m.model_type === "chat")}
                  selectedPoolsString={settings?.bridge_text_pools || ""}
                  selectedModelsString={settings?.bridge_text_model || ""}
                  onPoolsChange={(val) => setSettings(settings ? { ...settings, bridge_text_pools: val } : null)}
                  onModelsChange={(val) => setSettings(settings ? { ...settings, bridge_text_model: val } : null)}
                />

                <DualModelSelector
                  title="允许开放的创意生图模型 (Bridge Image Models)"
                  models={availableModels.filter(m => m.model_type === "image")}
                  selectedPoolsString={settings?.bridge_image_pools || ""}
                  selectedModelsString={settings?.bridge_image_model || ""}
                  onPoolsChange={(val) => setSettings(settings ? { ...settings, bridge_image_pools: val } : null)}
                  onModelsChange={(val) => setSettings(settings ? { ...settings, bridge_image_model: val } : null)}
                />

                <DualModelSelector
                  title="允许开放的生成视频模型 (Bridge Video Models)"
                  models={availableModels.filter(m => m.model_type === "video")}
                  selectedPoolsString={settings?.bridge_video_pools || ""}
                  selectedModelsString={settings?.bridge_video_model || ""}
                  onPoolsChange={(val) => setSettings(settings ? { ...settings, bridge_video_pools: val } : null)}
                  onModelsChange={(val) => setSettings(settings ? { ...settings, bridge_video_model: val } : null)}
                />

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "12px", marginTop: "4px" }}>
                  <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", flex: 1, paddingRight: "16px", lineHeight: 1.5 }}>
                    先在第一层勾选接入的主站资源池（Tags 标签），然后在第二层勾选分站对用户开放的具体模型。
                  </span>
                  <button
                    type="button"
                    onClick={fetchBridgeModels}
                    disabled={isRefreshingModels}
                    style={{
                      background: "#0284c7",
                      color: "#ffffff",
                      border: 0,
                      borderRadius: "6px",
                      padding: "6px 14px",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "background 0.2s"
                    }}
                  >
                    <RefreshCw size={12} className={isRefreshingModels ? "spin" : ""} />
                    <span>{isRefreshingModels ? "同步中..." : "重新拉取主站模型"}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* 2. 自营模式代理表单 */
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
                  上游 API 中转站根地址 (API URL) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="url"
                  value={settings?.upstream_api_url || ""}
                  onChange={(e) => setSettings(settings ? { ...settings, upstream_api_url: e.target.value } : null)}
                  placeholder="如 https://api.openai.com 或中转转发网关"
                  style={{
                    height: "38px",
                    width: "100%",
                    padding: "0 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--rv-color-border-thin)",
                    fontSize: "12px",
                    outline: "none"
                  }}
                  required
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
                  上游 API 密钥 (API Key) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="password"
                  value={settings?.upstream_api_key || ""}
                  onChange={(e) => setSettings(settings ? { ...settings, upstream_api_key: e.target.value } : null)}
                  placeholder="填入上游渠道密钥 sk-..."
                  style={{
                    height: "38px",
                    width: "100%",
                    padding: "0 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--rv-color-border-thin)",
                    fontSize: "12px",
                    outline: "none"
                  }}
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "16px", marginTop: "4px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                background: mode === "bridge" ? "#0284c7" : "var(--rv-color-primary)",
                color: "#ffffff",
                border: 0,
                borderRadius: "6px",
                padding: "8px 20px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: mode === "bridge" ? "0 4px 12px rgba(2, 132, 199, 0.15)" : "0 4px 12px rgba(15, 118, 110, 0.15)",
                transition: "all 0.2s"
              }}
            >
              {isSaving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
              <span>{isSaving ? "正在保存..." : mode === "bridge" ? "保存共通对接配置" : "保存自营上游配置"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
