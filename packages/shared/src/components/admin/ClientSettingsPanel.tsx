import React, { FormEvent, useEffect, useState } from "react";
import { Save, RefreshCw, Server, ShieldAlert } from "lucide-react";
import { getJson, postJson } from "../../utils";

interface ClientSettings {
  id: string;
  site_title: string;
  site_announcement: string;
  upstream_api_url: string;
  upstream_api_key: string;
  upstream_api_key_configured?: boolean;
  allow_user_register: boolean;
  gift_credits_on_register: number;
  price_rate: number;
}

interface ClientSettingsPanelProps {
  onSettingsSaved?: () => void;
}

export function ClientSettingsPanel({ onSettingsSaved }: ClientSettingsPanelProps) {
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        const res = await getJson<any>("/api/admin/settings");
        const configData = res.data || res;
        setSettings(configData);
      } catch (err) {
        setMessage("加载系统配置失败：" + (err as Error).message);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    setMessage("");
    try {
      await postJson("/api/admin/settings", settings);
      setMessage("自营上游配置已保存成功！");
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (err) {
      setMessage("保存配置失败：" + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestUpstream() {
    if (!settings) return;
    setIsTesting(true);
    setMessage("");
    try {
      const res = await postJson<{ success?: boolean; message?: string }>("/api/admin/settings/test-upstream", {
        upstream_api_url: settings.upstream_api_url,
        upstream_api_key: settings.upstream_api_key,
      });
      setMessage(res.message || "主站网关联调成功");
    } catch (err) {
      setMessage("联调失败：" + (err as Error).message);
    } finally {
      setIsTesting(false);
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
      <div style={{
        height: "4px",
        background: "linear-gradient(90deg, var(--rv-color-primary), #10b981)"
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
          <Server size={16} style={{ color: "var(--rv-color-primary)" }} />
          <span>自营渠道上游代理设置</span>
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
                placeholder={settings?.upstream_api_key_configured ? "已配置，留空表示不修改" : "填入上游渠道密钥 sk-..."}
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

          <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "16px", marginTop: "4px", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              disabled={isSaving || isTesting}
              onClick={() => void handleTestUpstream()}
              style={{
                background: "#ffffff",
                color: "var(--rv-color-text-main)",
                border: "1px solid var(--rv-color-border-thin)",
                borderRadius: "6px",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {isTesting ? "正在联调..." : "测试主站连通"}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                background: "var(--rv-color-primary)",
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
                boxShadow: "0 4px 12px rgba(15, 118, 110, 0.15)",
                transition: "all 0.2s"
              }}
            >
              {isSaving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
              <span>{isSaving ? "正在保存..." : "保存自营上游配置"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
