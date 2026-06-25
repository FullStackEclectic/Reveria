import React, { useState, useEffect } from "react";
import { Save, X, Upload, Sparkles } from "lucide-react";
import { PromptTemplate, ModelSummary } from "../../types";
import { uploadAsset, assetUrl } from "../../utils";
import { AIAdvancedParamsPanel, AIAdvancedParams } from "./AIAdvancedParamsPanel";

interface TemplateFormProps {
  initialData: Partial<PromptTemplate> | null;
  models: ModelSummary[];
  onSubmit: (data: Partial<PromptTemplate>) => void;
  onCancel: () => void;
}

export function TemplateForm({
  initialData,
  models,
  onSubmit,
  onCancel
}: TemplateFormProps) {
  const isEdit = !!initialData?.id;

  // 表单基础字段状态
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [workflowType, setWorkflowType] = useState("image-generation");
  const [needImage, setNeedImage] = useState(0);
  const [showRatio, setShowRatio] = useState(true);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [modelId, setModelId] = useState("");
  
  // 高级参数状态 (托管给 AIAdvancedParams)
  const [advParams, setAdvParams] = useState<AIAdvancedParams>({});
  
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 装载初始数据
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setContent(initialData.content || "");
      setWorkflowType(initialData.workflow_type || "image-generation");
      setNeedImage(initialData.need_image ?? 0);
      setShowRatio(initialData.show_ratio !== false);
      setNegativePrompt(initialData.negative_prompt || "");
      setPreviewUrl(initialData.preview_url || "");
      setModelId(initialData.model_id || "");

      let parsed: AIAdvancedParams = {};
      try {
        if (initialData.advanced_params) {
          parsed = JSON.parse(initialData.advanced_params);
        }
      } catch (err) {
        console.error("解析高级配置 JSON 错误:", err);
      }
      setAdvParams(parsed);
    } else {
      // 默认新增状态
      setTitle("");
      setContent("");
      setWorkflowType("image-generation");
      setNeedImage(0);
      setShowRatio(true);
      setNegativePrompt("");
      setPreviewUrl("");
      setModelId("");
      setAdvParams({
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
        detail_enhancement: false
      });
    }
    setErrorMsg("");
  }, [initialData]);

  // 处理封面图上传
  const handleUploadPreview = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const asset = await uploadAsset(formData);
      const url = asset.file_url || asset.thumbnail_url || "";
      setPreviewUrl(url);
    } catch (err: any) {
      setErrorMsg("上传效果图失败：" + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 处理提交保存
  const handleSave = () => {
    if (!title.trim()) {
      setErrorMsg("模板标题不能为空");
      return;
    }
    if (!content.trim()) {
      setErrorMsg("模板预设正向提示词内容不能为空");
      return;
    }

    // 回传数据
    onSubmit({
      ...initialData,
      title: title.trim(),
      content: content.trim(),
      workflow_type: workflowType,
      need_image: needImage,
      show_ratio: showRatio,
      negative_prompt: negativePrompt.trim(),
      preview_url: previewUrl,
      model_id: modelId,
      advanced_params: JSON.stringify(advParams),
      default_width: advParams.width || 768,
      default_height: advParams.height || 1152
    });
  };

  return (
    <div
      style={{
        background: "#ffffff",
        padding: "24px",
        borderRadius: "var(--rv-radius-md)",
        border: "1px solid rgba(226, 232, 240, 0.8)",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03)",
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        gap: "28px",
        flexShrink: 0,
        animation: "slideDown 0.3s ease-out",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
      }}
    >
      {/* 左栏：基础与 AI 配置面板 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", borderRight: "1px solid var(--rv-color-border-thin)", paddingRight: "24px", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--rv-color-text-main)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <span>⚙️ 核心参数与生成配置</span>
        </div>

        {errorMsg && (
          <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "var(--rv-radius-xs)", fontSize: "11px", color: "#dc2626", fontWeight: "600" }}>
            {errorMsg}
          </div>
        )}

        {/* 封面上传卡片 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>模板封面效果图</span>
          <div style={{ position: "relative", width: "100%", height: "150px", borderRadius: "var(--rv-radius-xs)", border: "2px dashed var(--rv-color-border-thin)", background: "var(--rv-color-bg-sidebar)", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
            {previewUrl ? (
              <>
                <img src={assetUrl(previewUrl)} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  type="button"
                  onClick={() => setPreviewUrl("")}
                  style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(239, 68, 68, 0.9)", border: 0, color: "#fff", cursor: "pointer", fontSize: "11px", width: "22px", height: "22px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 4px rgba(0,0,0,0.15)", fontWeight: "bold" }}
                  title="删除封面"
                >
                  ×
                </button>
              </>
            ) : (
              <label style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", color: "var(--rv-color-text-muted)" }}>
                <Upload size={20} style={{ opacity: 0.6 }} />
                <span style={{ fontSize: "11px", fontWeight: "600" }}>{isUploading ? "上传中..." : "上传效果图"}</span>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleUploadPreview}
                />
              </label>
            )}
          </div>
        </div>

        {/* 工作流类型 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>关联工作流类型</span>
          <select
            value={workflowType}
            onChange={(e) => setWorkflowType(e.target.value)}
            style={{ background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-main)", borderRadius: "var(--rv-radius-xs)", padding: "8px 12px", fontSize: "12px", outline: "none", cursor: "pointer", width: "100%" }}
          >
            <option value="image-generation">图像生成 (文生图/图生图)</option>
            <option value="video-generation">视频生成 (视频大类)</option>
            <option value="text-generation">文本生成 (创意分析)</option>
          </select>
        </div>

        {/* 推荐模型 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>推荐大模型</span>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            style={{ background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-main)", borderRadius: "var(--rv-radius-xs)", padding: "8px 12px", fontSize: "12px", outline: "none", cursor: "pointer", width: "100%" }}
          >
            <option value="">(使用全局默认模型)</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.display_name || m.name}
              </option>
            ))}
          </select>
        </div>

        {/* 参考图片需求 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>参考图片需求</span>
          <select
            value={needImage}
            onChange={(e) => setNeedImage(Number(e.target.value))}
            style={{ background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-main)", borderRadius: "var(--rv-radius-xs)", padding: "8px 12px", fontSize: "12px", outline: "none", cursor: "pointer", width: "100%" }}
          >
            <option value={0}>不需要参考图片</option>
            <option value={1}>需要 1 张参考图片</option>
            <option value={2}>需要多张参考图片</option>
          </select>
        </div>

        {/* 尺寸比例选择器显隐 */}
        <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--rv-color-text-main)", cursor: "pointer", marginTop: "4px", padding: "6px 0" }}>
          <input
            type="checkbox"
            checked={showRatio}
            onChange={(e) => setShowRatio(e.target.checked)}
            style={{ width: "15px", height: "15px", accentColor: "var(--rv-color-primary)", cursor: "pointer" }}
          />
          <span style={{ fontWeight: "700" }}>显示尺寸比例选择器</span>
        </label>

        {/* 高级 AI 参数调节器 */}
        <div style={{ marginTop: "8px", borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "12px" }}>
          <AIAdvancedParamsPanel
            value={advParams}
            onChange={setAdvParams}
            showAdvancedToggle={true}
          />
        </div>
      </div>

      {/* 右栏：核心提示词创作区 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
        <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--rv-color-text-main)", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <span>📝 提示词模板创作</span>
        </div>

        {/* 标题 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>模板标题</span>
          <input
            type="text"
            placeholder="模板标题 (如: 最美证件照 / 奇幻机甲大片...)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-main)", borderRadius: "var(--rv-radius-xs)", padding: "10px 14px", fontSize: "13px", fontWeight: "700", width: "100%", outline: "none" }}
          />
        </div>

        {/* 正向提示词 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minHeight: "220px" }}>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>正向提示词 (Positive Prompt)</span>
          <textarea
            placeholder="在这里输入提示词模板的默认内容。画板调用此模板时会自动读取..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ flex: 1, height: "100%", minHeight: "150px", background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-main)", borderRadius: "var(--rv-radius-xs)", padding: "12px 14px", fontSize: "12px", fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, monospace", lineHeight: "1.6", outline: "none", resize: "vertical" }}
          />
        </div>

        {/* 反向提示词 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>反向提示词 (Negative Prompt)</span>
          <textarea
            placeholder="在这里输入反向提示词 (Negative Prompt)，使用红色高亮以便和正向词做出区隔。如：watermark, blurry, bad anatomy..."
            rows={4}
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            style={{ background: "rgba(239, 68, 68, 0.02)", border: "1px solid rgba(239, 68, 68, 0.15)", color: "#1e293b", borderRadius: "var(--rv-radius-xs)", padding: "10px 14px", fontSize: "12px", fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, monospace", lineHeight: "1.6", outline: "none", resize: "none" }}
          />
        </div>

        {/* 动作按钮栏 */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "12px", borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "16px" }}>
          <button
            type="button"
            className="primary-button"
            style={{ minHeight: "38px", padding: "0 22px", fontSize: "12px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}
            onClick={handleSave}
          >
            {isEdit ? <Save size={14} /> : <Sparkles size={14} />}
            {isEdit ? "保存修改" : "创建模板"}
          </button>
          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: "38px", padding: "0 22px", fontSize: "12px", fontWeight: "700" }}
            onClick={onCancel}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
