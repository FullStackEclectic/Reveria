import React, { FormEvent, useEffect, useState } from "react";
import { Save, RefreshCw, Users, ShieldAlert, Laptop } from "lucide-react";
import { getJson, postJson } from "../../utils";

interface ClientSettings {
  id: string;
  site_title: string;
  site_announcement: string;
  allow_user_register: boolean;
  gift_credits_on_register: number;
  price_rate: number;
  upstream_api_url: string;
  upstream_api_key: string;
}

interface SystemSettingsPanelProps {
  onSettingsSaved?: () => void;
}

export function SystemSettingsPanel({ onSettingsSaved }: SystemSettingsPanelProps) {
  const [settings, setSettings] = useState<ClientSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        const res = await getJson<any>("/api/admin/settings");
        const configData = res.data || res;
        setSettings(configData);
      } catch (err) {
        setMessage("加载站点配置失败：" + (err as Error).message);
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
      setMessage("站点全局设置已保存成功！");
      if (onSettingsSaved) {
        onSettingsSaved();
      }
    } catch (err) {
      setMessage("保存配置失败：" + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "200px", color: "var(--rv-color-text-muted)" }}>
        <RefreshCw size={20} className="spin" style={{ marginRight: "8px" }} />
        <span>正在加载站点配置...</span>
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
      {/* 头部装饰条 */}
      <div style={{
        height: "4px",
        background: "linear-gradient(90deg, var(--rv-color-primary), #10b981)"
      }} />

      <div style={{ padding: "28px" }}>
        <h3 style={{
          fontSize: "16px",
          fontWeight: "700",
          margin: "0 0 20px 0",
          color: "var(--rv-color-text-main)",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <Laptop size={18} style={{ color: "var(--rv-color-primary)" }} />
          <span>站点运营与基本参数设置</span>
        </h3>

        {message && (
          <div style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: message.includes("失败") || message.includes("出错") ? "#fff5f5" : "#f0fdf4",
            border: `1px solid ${message.includes("失败") || message.includes("出错") ? "#fed7d7" : "#bbf7d0"}`,
            color: message.includes("失败") || message.includes("出错") ? "#c53030" : "#15803d",
            fontSize: "13px",
            fontWeight: "500",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            {message.includes("失败") || message.includes("出错") ? <ShieldAlert size={16} /> : null}
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* 站点基本配置卡片 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid var(--rv-color-border-thin)" }}>
            <h4 style={{ fontSize: "13px", fontWeight: "700", margin: 0, color: "var(--rv-color-text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "3px", height: "14px", background: "var(--rv-color-primary)", borderRadius: "2px" }} />
              站点基本信息
            </h4>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
                  分站站点标题 (Site Title)
                </label>
                <input
                  type="text"
                  value={settings?.site_title || ""}
                  onChange={(e) => setSettings(settings ? { ...settings, site_title: e.target.value } : null)}
                  placeholder="如 Reveria AI 算力中心"
                  style={{
                    height: "38px",
                    width: "100%",
                    padding: "0 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--rv-color-border-thin)",
                    fontSize: "12px",
                    outline: "none",
                    background: "#ffffff"
                  }}
                  required
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
                  全局系统公告 (System Announcement)
                </label>
                <textarea
                  value={settings?.site_announcement || ""}
                  onChange={(e) => setSettings(settings ? { ...settings, site_announcement: e.target.value } : null)}
                  placeholder="在前台首页顶端展现的公告，支持纯文本..."
                  style={{
                    minHeight: "75px",
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--rv-color-border-thin)",
                    fontSize: "12px",
                    outline: "none",
                    resize: "vertical",
                    background: "#ffffff",
                    lineHeight: "1.5"
                  }}
                />
              </div>
            </div>
          </div>

          {/* 用户注册与零售加价率卡片 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "#f8fafc", padding: "20px", borderRadius: "10px", border: "1px solid var(--rv-color-border-thin)" }}>
            <h4 style={{ fontSize: "13px", fontWeight: "700", margin: 0, color: "var(--rv-color-text-main)", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "3px", height: "14px", background: "#10b981", borderRadius: "2px" }} />
              前台注册与全局加价率
            </h4>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
                  新用户自助注册默认赠送积分 (体验额度)
                </label>
                <input
                  type="number"
                  value={settings?.gift_credits_on_register ?? 0}
                  onChange={(e) => setSettings(settings ? { ...settings, gift_credits_on_register: Number(e.target.value) } : null)}
                  style={{
                    height: "38px",
                    width: "100%",
                    padding: "0 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--rv-color-border-thin)",
                    fontSize: "12px",
                    outline: "none",
                    background: "#ffffff"
                  }}
                  min="0"
                  required
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)" }}>
                  全局算力定价加价率 (Price Rate)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings?.price_rate ?? 1.0}
                  onChange={(e) => setSettings(settings ? { ...settings, price_rate: Number(e.target.value) } : null)}
                  style={{
                    height: "38px",
                    width: "100%",
                    padding: "0 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--rv-color-border-thin)",
                    fontSize: "12px",
                    outline: "none",
                    background: "#ffffff"
                  }}
                  min="0.1"
                  max="10.0"
                  required
                />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
              <input
                type="checkbox"
                id="allow_user_register"
                checked={settings?.allow_user_register || false}
                onChange={(e) => setSettings(settings ? { ...settings, allow_user_register: e.target.checked } : null)}
                style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#10b981" }}
              />
              <label htmlFor="allow_user_register" style={{ fontSize: "12px", fontWeight: "500", color: "var(--rv-color-text-main)", cursor: "pointer", userSelect: "none" }}>
                允许开放普通用户前台自助注册
              </label>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "20px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                background: "var(--rv-color-primary)",
                color: "#ffffff",
                border: 0,
                borderRadius: "6px",
                padding: "10px 24px",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(15, 118, 110, 0.15)",
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(15, 118, 110, 0.25)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(15, 118, 110, 0.15)";
              }}
            >
              {isSaving ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
              <span>{isSaving ? "正在保存配置..." : "保存全局站点配置"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
