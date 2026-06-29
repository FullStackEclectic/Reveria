import React from "react";
import { Plus, Trash2, HelpCircle } from "lucide-react";

export interface AIAdvancedParams {
  vae?: string;
  loras?: { name: string; weight: number }[];
  embeddings?: { name: string; weight: number }[];
  controlnets?: { model: string; weight: number; control_mode?: string }[];
  denoising_strength?: number;
  aspect_ratio?: string; // "portrait" (768x1152), "landscape" (1152x768), "square" (1024x1024), "custom"
  width?: number;
  height?: number;
  sampler?: string;
  scheduler?: string;
  steps?: number;
  cfg_scale?: number;
  seed?: number; // -1 代表随机
  clip_skip?: number;
  ensd?: number;
  detail_enhancement?: boolean;
}

interface AIAdvancedParamsPanelProps {
  value: AIAdvancedParams;
  onChange: (val: AIAdvancedParams) => void;
  showAdvancedToggle?: boolean; // 是否显示“先进的”开关
}

export function AIAdvancedParamsPanel({
  value,
  onChange,
  showAdvancedToggle = true
}: AIAdvancedParamsPanelProps) {
  // 合并默认值
  const params: AIAdvancedParams = {
    vae: "automatic",
    loras: [],
    embeddings: [],
    controlnets: [],
    denoising_strength: 0.5,
    aspect_ratio: "portrait",
    width: 768,
    height: 1152,
    sampler: "euler",
    scheduler: "normal",
    steps: 28,
    cfg_scale: 7.0,
    seed: -1,
    clip_skip: 2,
    ensd: 13337,
    detail_enhancement: false,
    ...value
  };

  const updateParam = (key: keyof AIAdvancedParams, val: any) => {
    onChange({
      ...params,
      [key]: val
    });
  };

  // 快捷尺寸比例与 getRatioBoxStyle 图示样式计算
  const getRatioBoxStyle = (ratio: string): React.CSSProperties => {
    switch (ratio) {
      case "1:1":
      case "1:1(2k)":
        return { width: "10px", height: "10px", border: "1px solid currentColor", borderRadius: "1px", display: "inline-block", flexShrink: 0 };
      case "3:2":
        return { width: "12px", height: "8px", border: "1px solid currentColor", borderRadius: "1px", display: "inline-block", flexShrink: 0 };
      case "2:3":
        return { width: "8px", height: "12px", border: "1px solid currentColor", borderRadius: "1px", display: "inline-block", flexShrink: 0 };
      case "4:3":
        return { width: "11px", height: "8px", border: "1px solid currentColor", borderRadius: "1px", display: "inline-block", flexShrink: 0 };
      case "3:4":
        return { width: "8px", height: "11px", border: "1px solid currentColor", borderRadius: "1px", display: "inline-block", flexShrink: 0 };
      case "9:16":
      case "9:16(2k)":
      case "9:16(4k)":
        return { width: "7px", height: "13px", border: "1px solid currentColor", borderRadius: "1px", display: "inline-block", flexShrink: 0 };
      case "16:9(2k)":
      case "16:9(4k)":
        return { width: "13px", height: "7px", border: "1px solid currentColor", borderRadius: "1px", display: "inline-block", flexShrink: 0 };
      default:
        return { width: "10px", height: "10px", border: "1px solid currentColor", borderRadius: "1px", display: "inline-block", flexShrink: 0 };
    }
  };

  const handleRatioClick = (ratio: string) => {
    let w = 1024;
    let h = 1024;
    switch (ratio) {
      case "1:1": w = 1024; h = 1024; break;
      case "3:2": w = 1200; h = 800; break;
      case "2:3": w = 800; h = 1200; break;
      case "4:3": w = 1024; h = 768; break;
      case "3:4": w = 768; h = 1024; break;
      case "9:16": w = 576; h = 1024; break;
      case "1:1(2k)": w = 2048; h = 2048; break;
      case "16:9(2k)": w = 2048; h = 1152; break;
      case "9:16(2k)": w = 1152; h = 2048; break;
      case "16:9(4k)": w = 3840; h = 2160; break;
      case "9:16(4k)": w = 2160; h = 3840; break;
      case "custom":
      default:
        w = params.width || 1024;
        h = params.height || 1024;
        break;
    }
    onChange({
      ...params,
      aspect_ratio: ratio,
      width: w,
      height: h
    });
  };

  // VAE 选项
  const vaeOptions = [
    { value: "automatic", label: "自动的" },
    { value: "none", label: "None (使用模型内置)" },
    { value: "kl-f8-anime2.ckpt", label: "kl-f8-anime2.ckpt" },
    { value: "animeVAE.pt", label: "animeVAE.pt" },
    { value: "vae-ft-mse-840000-ema-pruned.safetensors", label: "vae-ft-mse-840000" }
  ];

  // 采样器与调度器
  const samplerOptions = [
    { value: "euler", label: "Euler" },
    { value: "euler_a", label: "Euler a" },
    { value: "dpmpp_2m_sde", label: "DPM++ 2M SDE" },
    { value: "dpmpp_2m", label: "DPM++ 2M" },
    { value: "dpmpp_sde", label: "DPM++ SDE" },
    { value: "ddim", label: "DDIM" },
    { value: "heun", label: "Heun" }
  ];

  const schedulerOptions = [
    { value: "normal", label: "普通的 (Normal)" },
    { value: "karras", label: "Karras" },
    { value: "exponential", label: "Exponential" },
    { value: "sgm_uniform", label: "SGM Uniform" }
  ];

  // 状态折叠
  const [showAdvancedSection, setShowAdvancedSection] = React.useState(false);
  const [isAdvancedSamplerEnabled, setIsAdvancedSamplerEnabled] = React.useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "100%" }}>
      {/* 行 1：LoRA + Embeddings 并排 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {/* 1. LoRA 配置 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)", display: "flex", alignItems: "center", gap: "4px" }}>
              LoRA 权重预设
            </span>
            <button
              type="button"
              onClick={() => {
                const currentLoras = params.loras || [];
                updateParam("loras", [...currentLoras, { name: "", weight: 0.8 }]);
              }}
              style={{
                background: "rgba(15, 118, 110, 0.08)",
                border: 0,
                color: "var(--rv-color-primary)",
                padding: "3px 8px",
                borderRadius: "var(--rv-radius-xs)",
                fontSize: "10px",
                cursor: "pointer",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "2px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--rv-color-primary-light)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(15, 118, 110, 0.08)"}
            >
              <Plus size={10} />
              添加 LoRA
            </button>
          </div>
          
          {(params.loras || []).length === 0 ? (
            <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", textAlign: "center", padding: "10px 0", border: "1px dashed var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", opacity: 0.8, background: "#ffffff" }}>
              未配置 LoRA（可选）
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(params.loras || []).map((lora, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "6px", background: "var(--rv-color-bg-sidebar)", padding: "10px", borderRadius: "var(--rv-radius-xs)", border: "1px solid var(--rv-color-border-thin)" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="LoRA 模型名称"
                      value={lora.name}
                      onChange={(e) => {
                        const nextLoras = [...(params.loras || [])];
                        nextLoras[idx].name = e.target.value;
                        updateParam("loras", nextLoras);
                      }}
                      style={{ flex: 1, border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "4px 8px", fontSize: "11px", background: "#ffffff", color: "var(--rv-color-text-main)", outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const nextLoras = (params.loras || []).filter((_, i) => i !== idx);
                        updateParam("loras", nextLoras);
                      }}
                      style={{ background: "transparent", border: 0, color: "#ef4444", cursor: "pointer", padding: "4px" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", width: "32px" }}>权重:</span>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={lora.weight}
                      onChange={(e) => {
                        const nextLoras = [...(params.loras || [])];
                        nextLoras[idx].weight = Number(e.target.value);
                        updateParam("loras", nextLoras);
                      }}
                      style={{ flex: 1, accentColor: "var(--rv-color-primary)", height: "4px", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "11px", color: "var(--rv-color-primary)", fontWeight: "bold", width: "30px", textAlign: "right" }}>{lora.weight.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. 嵌入 (Embeddings) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)", display: "flex", alignItems: "center", gap: "4px" }}>
              Embeddings 嵌入预设
            </span>
            <button
              type="button"
              onClick={() => {
                const currentEmbeddings = params.embeddings || [];
                updateParam("embeddings", [...currentEmbeddings, { name: "", weight: 1.0 }]);
              }}
              style={{
                background: "rgba(15, 118, 110, 0.08)",
                border: 0,
                color: "var(--rv-color-primary)",
                padding: "3px 8px",
                borderRadius: "var(--rv-radius-xs)",
                fontSize: "10px",
                cursor: "pointer",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "2px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--rv-color-primary-light)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(15, 118, 110, 0.08)"}
            >
              <Plus size={10} />
              添加嵌入
            </button>
          </div>

          {(params.embeddings || []).length === 0 ? (
            <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", textAlign: "center", padding: "10px 0", border: "1px dashed var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", opacity: 0.8, background: "#ffffff" }}>
              未配置嵌入（可选）
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(params.embeddings || []).map((emb, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "6px", background: "var(--rv-color-bg-sidebar)", padding: "10px", borderRadius: "var(--rv-radius-xs)", border: "1px solid var(--rv-color-border-thin)" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      type="text"
                      placeholder="嵌入标识 (如: easynegative)"
                      value={emb.name}
                      onChange={(e) => {
                        const next = [...(params.embeddings || [])];
                        next[idx].name = e.target.value;
                        updateParam("embeddings", next);
                      }}
                      style={{ flex: 1, border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "4px 8px", fontSize: "11px", background: "#ffffff", color: "var(--rv-color-text-main)", outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = (params.embeddings || []).filter((_, i) => i !== idx);
                        updateParam("embeddings", next);
                      }}
                      style={{ background: "transparent", border: 0, color: "#ef4444", cursor: "pointer", padding: "4px" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", width: "32px" }}>权重:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="1.5"
                      step="0.05"
                      value={emb.weight}
                      onChange={(e) => {
                        const next = [...(params.embeddings || [])];
                        next[idx].weight = Number(e.target.value);
                        updateParam("embeddings", next);
                      }}
                      style={{ flex: 1, accentColor: "var(--rv-color-primary)", height: "4px", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "11px", color: "var(--rv-color-primary)", fontWeight: "bold", width: "30px", textAlign: "right" }}>{emb.weight.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 行 2：ControlNet + VAE 并排 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" }}>
        {/* 3. ControlNet 配置 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)", display: "flex", alignItems: "center", gap: "4px" }}>
              ControlNet 约束层
            </span>
            <button
              type="button"
              onClick={() => {
                const currentCn = params.controlnets || [];
                updateParam("controlnets", [...currentCn, { model: "", weight: 1.0, control_mode: "balanced" }]);
              }}
              style={{
                background: "rgba(15, 118, 110, 0.08)",
                border: 0,
                color: "var(--rv-color-primary)",
                padding: "3px 8px",
                borderRadius: "var(--rv-radius-xs)",
                fontSize: "10px",
                cursor: "pointer",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "2px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--rv-color-primary-light)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(15, 118, 110, 0.08)"}
            >
              <Plus size={10} />
              添加 CN
            </button>
          </div>

          {(params.controlnets || []).length === 0 ? (
            <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", textAlign: "center", padding: "8px 0", border: "1px dashed var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", opacity: 0.8, background: "#ffffff" }}>
              未加载 ControlNet 单元（可选）
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(params.controlnets || []).map((cn, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "6px", background: "var(--rv-color-bg-sidebar)", padding: "10px", borderRadius: "var(--rv-radius-xs)", border: "1px solid var(--rv-color-border-thin)" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <select
                      value={cn.model}
                      onChange={(e) => {
                        const next = [...(params.controlnets || [])];
                        next[idx].model = e.target.value;
                        updateParam("controlnets", next);
                      }}
                      style={{ flex: 1, border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "4px 6px", fontSize: "11px", background: "#ffffff", color: "var(--rv-color-text-main)", outline: "none", cursor: "pointer" }}
                    >
                      <option value="">-- 选择控制模型 --</option>
                      <option value="control_v11p_sd15_canny">Canny 边缘提取</option>
                      <option value="control_v11f1p_sd15_depth">Depth 深度估计</option>
                      <option value="control_v11p_sd15_openpose">OpenPose 姿态骨架</option>
                      <option value="control_v11p_sd15_softedge">SoftEdge 软边缘</option>
                      <option value="control_v11e_sd15_ip2p">Instruct Pix2Pix</option>
                      <option value="control_v11f1e_sd15_tile">Tile 分块超分</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (params.controlnets || []).filter((_, i) => i !== idx);
                        updateParam("controlnets", next);
                      }}
                      style={{ background: "transparent", border: 0, color: "#ef4444", cursor: "pointer", padding: "4px" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", width: "30px" }}>权重:</span>
                      <input
                        type="range"
                        min="0.1"
                        max="2.0"
                        step="0.05"
                        value={cn.weight}
                        onChange={(e) => {
                          const next = [...(params.controlnets || [])];
                          next[idx].weight = Number(e.target.value);
                          updateParam("controlnets", next);
                        }}
                        style={{ flex: 1, accentColor: "var(--rv-color-primary)", height: "4px", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "10px", color: "var(--rv-color-primary)", fontWeight: "bold", width: "24px", textAlign: "right" }}>{cn.weight.toFixed(1)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)" }}>模式:</span>
                      <select
                        value={cn.control_mode || "balanced"}
                        onChange={(e) => {
                          const next = [...(params.controlnets || [])];
                          next[idx].control_mode = e.target.value;
                          updateParam("controlnets", next);
                        }}
                        style={{ flex: 1, border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "2px 4px", fontSize: "10px", background: "#ffffff", outline: "none", cursor: "pointer" }}
                      >
                        <option value="balanced">均衡模式</option>
                        <option value="prompt_important">提示词更重要</option>
                        <option value="controlnet_important">ControlNet更重要</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. VAE 选择 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>VAE 配件</span>
            <span title="选择变分自编码器模型来优化图像色彩与瑕疵" style={{ display: "inline-flex", alignItems: "center" }}>
              <HelpCircle size={12} style={{ color: "var(--rv-color-text-muted)", cursor: "help" }} />
            </span>
          </div>
          <select
            value={params.vae}
            onChange={(e) => updateParam("vae", e.target.value)}
            style={{ background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-main)", borderRadius: "var(--rv-radius-xs)", padding: "7px 10px", fontSize: "12px", outline: "none", cursor: "pointer", width: "100%", transition: "all 0.2s" }}
          >
            {vaeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 行 3：去噪强度 + 宽高比例 并排 */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "16px", alignItems: "start" }}>
        {/* 5. 去噪强度 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>去噪强度 (Denoising)</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={params.denoising_strength}
              onChange={(e) => updateParam("denoising_strength", Math.max(0, Math.min(1, Number(e.target.value))))}
              style={{ width: "50px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "1px 4px", fontSize: "11px", textAlign: "center", color: "var(--rv-color-primary)", fontWeight: "700", background: "transparent" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={params.denoising_strength}
              onChange={(e) => updateParam("denoising_strength", Number(e.target.value))}
              style={{ flex: 1, accentColor: "var(--rv-color-primary)", cursor: "pointer", height: "4px" }}
            />
          </div>
        </div>

        {/* 6. 尺寸比例快速卡片选择器 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>宽高比例</span>
          <div className="gen-preset-grid">
            {(["1:1", "3:2", "2:3", "4:3", "3:4", "9:16", "1:1(2k)", "16:9(2k)", "9:16(2k)", "16:9(4k)", "9:16(4k)", "custom"] as const).map((ratio) => (
              <button
                key={ratio}
                type="button"
                className={`gen-preset-btn ${params.aspect_ratio === ratio ? "active" : ""}`}
                onClick={() => handleRatioClick(ratio)}
              >
                {ratio === "custom" ? (
                  <div style={{ width: "10px", height: "10px", border: "1.5px dashed currentColor", borderRadius: "1px", display: "inline-block", flexShrink: 0 }} />
                ) : (
                  <div className="gen-preset-ratio-box" style={getRatioBoxStyle(ratio)} />
                )}
                <span className="gen-preset-ratio-text" style={{ fontSize: "10px" }}>{ratio === "custom" ? "自定义" : ratio}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 宽度与高度滑块 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "rgba(0, 0, 0, 0.01)", padding: "10px", borderRadius: "var(--rv-radius-xs)", border: "1px solid var(--rv-color-border-thin)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>宽度 (Width)</span>
          <input
            type="number"
            disabled={params.aspect_ratio !== "custom"}
            value={params.width}
            onChange={(e) => updateParam("width", Number(e.target.value))}
            style={{ width: "100%", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "4px 8px", fontSize: "11px", fontWeight: "bold", background: params.aspect_ratio !== "custom" ? "rgba(0, 0, 0, 0.04)" : "#ffffff", color: "var(--rv-color-text-main)" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>高度 (Height)</span>
          <input
            type="number"
            disabled={params.aspect_ratio !== "custom"}
            value={params.height}
            onChange={(e) => updateParam("height", Number(e.target.value))}
            style={{ width: "100%", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "4px 8px", fontSize: "11px", fontWeight: "bold", background: params.aspect_ratio !== "custom" ? "rgba(0, 0, 0, 0.04)" : "#ffffff", color: "var(--rv-color-text-main)" }}
          />
        </div>
      </div>

      {/* 7. 采样与生成细节 */}
      <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "12px" }}>
        {showAdvancedToggle && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>抽样方法</span>
            <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isAdvancedSamplerEnabled}
                onChange={(e) => setIsAdvancedSamplerEnabled(e.target.checked)}
                style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "var(--rv-color-primary)" }}
              />
              <span style={{ marginLeft: "6px", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-primary)" }}>先进的 (Advanced)</span>
            </label>
          </div>
        )}

        {isAdvancedSamplerEnabled && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>采样器 (Sampler)</span>
              <select
                value={params.sampler}
                onChange={(e) => updateParam("sampler", e.target.value)}
                style={{ background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-main)", borderRadius: "var(--rv-radius-xs)", padding: "6px 8px", fontSize: "11px", outline: "none", cursor: "pointer" }}
              >
                {samplerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>调度程序 (Scheduler)</span>
              <select
                value={params.scheduler}
                onChange={(e) => updateParam("scheduler", e.target.value)}
                style={{ background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-main)", borderRadius: "var(--rv-radius-xs)", padding: "6px 8px", fontSize: "11px", outline: "none", cursor: "pointer" }}
              >
                {schedulerOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 采样步骤 & CFG Scale */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>采样步骤 (Steps)</span>
              <input
                type="number"
                min="1"
                max="150"
                value={params.steps}
                onChange={(e) => updateParam("steps", Math.max(1, Math.min(150, Number(e.target.value))))}
                style={{ width: "50px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "1px 4px", fontSize: "10px", textAlign: "center", color: "var(--rv-color-primary)", fontWeight: "700" }}
              />
            </div>
            <input
              type="range"
              min="1"
              max="150"
              value={params.steps}
              onChange={(e) => updateParam("steps", Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--rv-color-primary)", cursor: "pointer", height: "4px" }}
            />
          </div>

          {/* CFG Scale */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>CFG 尺度 (提示词相关性)</span>
              <input
                type="number"
                min="1"
                max="30"
                step="0.5"
                value={params.cfg_scale}
                onChange={(e) => updateParam("cfg_scale", Math.max(1, Math.min(30, Number(e.target.value))))}
                style={{ width: "50px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "1px 4px", fontSize: "10px", textAlign: "center", color: "var(--rv-color-primary)", fontWeight: "700" }}
              />
            </div>
            <input
              type="range"
              min="1"
              max="30"
              step="0.5"
              value={params.cfg_scale}
              onChange={(e) => updateParam("cfg_scale", Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--rv-color-primary)", cursor: "pointer", height: "4px" }}
            />
          </div>

          {/* Seed */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>种子 (Seed)</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                type="text"
                placeholder="随机为空"
                value={params.seed === -1 ? "" : params.seed}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  updateParam("seed", val === "" ? -1 : Number(val));
                }}
                style={{ flex: 1, border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "6px 10px", fontSize: "11px", background: "#ffffff", color: "var(--rv-color-text-main)", outline: "none" }}
              />
              <button
                type="button"
                onClick={() => updateParam("seed", -1)}
                style={{
                  background: params.seed === -1 ? "var(--rv-color-primary)" : "var(--rv-color-bg-sidebar)",
                  border: "1px solid var(--rv-color-border-thin)",
                  color: params.seed === -1 ? "#ffffff" : "var(--rv-color-text-main)",
                  borderRadius: "var(--rv-radius-xs)",
                  padding: "0 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s"
                }}
                title="随机种子"
              >
                🎲 随机
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 8. 高级设置（折叠面板） */}
      <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "12px" }}>
        <div
          onClick={() => setShowAdvancedSection(!showAdvancedSection)}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontSize: "12px", fontWeight: "700", color: "var(--rv-color-primary)", padding: "4px 0" }}
        >
          <span>✨ 高级设置</span>
          <span style={{ fontSize: "10px" }}>{showAdvancedSection ? "▲" : "▼"}</span>
        </div>

        {showAdvancedSection && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", background: "rgba(0, 0, 0, 0.01)", padding: "12px", borderRadius: "var(--rv-radius-xs)", border: "1px solid var(--rv-color-border-thin)", marginTop: "8px", animation: "fadeIn 0.2s ease-out" }}>
            
            {/* Clip Skip */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>跳过剪辑 (Clip Skip)</span>
                <span style={{ fontSize: "10px", color: "var(--rv-color-primary)", fontWeight: "bold" }}>{params.clip_skip}</span>
              </div>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={params.clip_skip}
                onChange={(e) => updateParam("clip_skip", Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--rv-color-primary)", cursor: "pointer", height: "4px" }}
              />
            </div>

            {/* ENSD */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>ENSD</span>
              <input
                type="number"
                value={params.ensd}
                onChange={(e) => updateParam("ensd", Number(e.target.value))}
                style={{ width: "100%", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "4px 8px", fontSize: "11px", background: "#ffffff", color: "var(--rv-color-text-main)" }}
              />
            </div>

            {/* 细节增强开关 */}
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: "var(--rv-color-text-main)", cursor: "pointer", padding: "4px 0" }}>
              <input
                type="checkbox"
                checked={params.detail_enhancement}
                onChange={(e) => updateParam("detail_enhancement", e.target.checked)}
                style={{ width: "14px", height: "14px", accentColor: "var(--rv-color-primary)", cursor: "pointer" }}
              />
              <span style={{ fontWeight: "600" }}>启用细节增强 (Detail Enhancement)</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
