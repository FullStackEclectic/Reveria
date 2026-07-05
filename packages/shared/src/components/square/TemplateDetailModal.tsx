import React, { useState } from "react";
import { X, ArrowLeft, Upload, Sparkles } from "lucide-react";
import { AIAdvancedParamsPanel, AIAdvancedParams } from "../admin/AIAdvancedParamsPanel";

interface TemplateDetailModalProps {
  template: any;
  categoryName: string;
  coverImage: string;
  onClose: () => void;
  onStart: () => void;
  projects?: any[];
  onUseWithProject?: (projectId: string) => void;
}

export function TemplateDetailModal({
  template,
  categoryName,
  coverImage,
  onClose,
  onStart,
  projects = [],
  onUseWithProject,
}: TemplateDetailModalProps) {
  const [targetProjectId, setTargetProjectId] = useState<string>("new");
  const [promptInput, setPromptInput] = useState(template.content || "");
  const [negativePromptInput, setNegativePromptInput] = useState(template.negative_prompt || "deformed, blurry, bad teeth");
  
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 初始化并双向绑定高级 Civitai 风格微调参数（LoRA, VAE, 去噪强度, 宽高比例等）
  const [advParams, setAdvParams] = useState<AIAdvancedParams>({
    negative_prompt: template.negative_prompt || "deformed, blurry, bad teeth",
    loras: template.loras ? (typeof template.loras === "string" ? JSON.parse(template.loras) : template.loras) : [
      { name: "AnimeStyle", weight: 0.8 }
    ],
    embeddings: [],
    controlnets: [],
    vae: "auto",
    denoising_strength: 0.6,
    aspect_ratio: "2:3",
    width: 768,
    height: 1152,
  });

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUploadedImages([event.target.result as string]);
      }
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div 
      className="login-modal-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ 
        zIndex: 1100,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
      }}
    >
      <div
        className="rv-template-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "94vw",
          maxWidth: "1480px",
          height: "92vh",
          maxHeight: "960px",
          background: "#ffffff",
          border: "1px solid var(--rv-color-border-thin)",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "grid",
          gridTemplateRows: "64px 1fr 68px",
          overflow: "hidden",
          animation: "cardZoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
        }}
      >
        {/* 1. 顶部 Header 区域 */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            borderBottom: "1px solid var(--rv-color-border-thin)",
            background: "#ffffff"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: 0,
                color: "var(--rv-color-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "13px",
                fontWeight: "bold",
                padding: "6px 12px 6px 4px",
                borderRadius: "4px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--rv-color-primary)";
                e.currentTarget.style.background = "var(--rv-color-primary-light)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--rv-color-text-muted)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <ArrowLeft size={16} />
              返回模板列表
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px", borderLeft: "1px solid var(--rv-color-border-thin)", paddingLeft: "16px" }}>
              <Sparkles size={14} style={{ color: "var(--rv-color-primary)" }} />
              <span style={{ fontSize: "15px", fontWeight: "700", color: "#1c1917" }}>
                {template.title}
              </span>
              <span style={{ fontSize: "10px", background: "rgba(15, 118, 110, 0.08)", color: "var(--rv-color-primary)", padding: "2px 6px", borderRadius: "2px", fontWeight: "bold" }}>
                {template.workflow_type === "video-generation" ? "视频生成" : template.workflow_type === "text-generation" ? "文本生成" : "图像生成"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--rv-color-text-muted)",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0, 0, 0, 0.04)";
              e.currentTarget.style.color = "var(--rv-color-text-main)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--rv-color-text-muted)";
            }}
          >
            <X size={18} />
          </button>
        </header>

        {/* 2. 主体左右双栏 Remix 布局 */}
        <div
          style={{
            padding: "24px",
            display: "grid",
            gridTemplateColumns: "600px 1fr",
            gap: "24px",
            height: "100%",
            overflow: "hidden",
            background: "#ffffff",
            boxSizing: "border-box"
          }}
        >
          {/* 左栏：高清封面大图高保真预览 */}
          <div 
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              height: "100%", 
              borderRadius: "12px",
              border: "1px solid var(--rv-color-border-thin)",
              overflow: "hidden",
              background: "var(--rv-color-bg-sidebar)",
              position: "relative",
              boxShadow: "inset 0 0 20px rgba(0,0,0,0.02)"
            }}
          >
            <img
              src={coverImage}
              alt={template.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />

            {/* 推荐模型悬浮气泡标 */}
            <div 
              style={{ 
                position: "absolute", 
                top: "12px", 
                left: "12px", 
                background: "rgba(255, 255, 255, 0.9)", 
                backdropFilter: "blur(6px)", 
                border: "1px solid rgba(15, 118, 110, 0.2)", 
                borderRadius: "100px", 
                padding: "4px 12px", 
                display: "flex", 
                alignItems: "center", 
                gap: "6px", 
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                zIndex: 5
              }}
            >
              <Sparkles size={12} style={{ color: "var(--rv-color-primary)" }} />
              <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--rv-color-primary)" }}>
                {template.model_id ? `模型：${template.model_id}` : "模型：默认智能推荐"}
              </span>
            </div>
          </div>

          {/* 右栏：参数配置与一键生成（可上下纵向拉伸滚动） */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%", overflowY: "auto", paddingRight: "8px", boxSizing: "border-box" }}>
            
            {/* 1. 正向提示词 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#1c1917" }}>提示词参数微调</span>
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="在此微调正向提示词..."
                style={{
                  width: "100%",
                  height: "80px",
                  background: "var(--rv-color-bg-sidebar)",
                  border: "1px solid var(--rv-color-border-thin)",
                  color: "#1c1917",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  fontFamily: "JetBrains Mono, monospace",
                  outline: "none",
                  resize: "none",
                  transition: "all 0.2s",
                  boxSizing: "border-box"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--rv-color-primary)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--rv-color-border-thin)"}
              />
            </div>

            {/* 2. 反向提示词 */}
            {(template.workflow_type === "image-generation" || template.workflow_type === "video-generation" || !template.workflow_type) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#1c1917" }}>反向提示词 (Negative Prompt)</span>
                <textarea
                  value={negativePromptInput}
                  onChange={(e) => setNegativePromptInput(e.target.value)}
                  placeholder="例如：watermark, blurry, bad quality..."
                  style={{
                    width: "100%",
                    height: "54px",
                    background: "rgba(239, 68, 68, 0.02)",
                    border: "1px solid rgba(239, 68, 68, 0.15)",
                    color: "#1c1917",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    lineHeight: "1.5",
                    fontFamily: "JetBrains Mono, monospace",
                    outline: "none",
                    resize: "none",
                    transition: "all 0.2s",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            )}

            {/* 3. 参考图上传区 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#1c1917" }}>
                参考照片 (需要 1 张)
              </span>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: "90px",
                  borderRadius: "6px",
                  border: "2px dashed var(--rv-color-border-thin)",
                  background: "var(--rv-color-bg-sidebar)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  transition: "all 0.2s",
                  position: "relative",
                  overflow: "hidden"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--rv-color-primary)";
                  e.currentTarget.style.background = "var(--rv-color-primary-light)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--rv-color-border-thin)";
                  e.currentTarget.style.background = "var(--rv-color-bg-sidebar)";
                }}
              >
                {isUploading ? (
                  <div style={{ fontSize: "11px", color: "var(--rv-color-primary)", fontWeight: "bold" }}>上传中...</div>
                ) : uploadedImages.length > 0 ? (
                  <>
                    <img
                      src={uploadedImages[0]}
                      alt="参考图"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "2px 6px", borderRadius: "2px", fontSize: "9px" }}>
                      更换图片
                    </div>
                  </>
                ) : (
                  <>
                    <Upload size={16} style={{ color: "var(--rv-color-text-muted)" }} />
                    <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>点击上传参考照片</span>
                  </>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleUploadImage}
                  accept="image/*"
                  style={{ display: "none" }}
                />
              </div>
            </div>

            {/* 4. 高级 Civitai 风格微调参数（LoRA 滑块, VAE, 宽高比等） */}
            <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "12px", marginTop: "4px" }}>
              <AIAdvancedParamsPanel
                value={advParams}
                onChange={setAdvParams}
                showAdvancedToggle={true}
              />
            </div>

          </div>
        </div>

        {/* 3. 底部固定操作栏（带有项目选择联动） */}
        <footer style={{ 
          padding: "14px 24px", 
          borderTop: "1px solid var(--rv-color-border-thin)", 
          flexShrink: 0,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "16px",
          background: "#fafafa",
          height: "68px",
          boxSizing: "border-box"
        }}>
          {/* 已有项目选择下拉框 */}
          {projects.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>应用至项目:</span>
              <select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "20px",
                  padding: "5px 12px",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "#334155",
                  outline: "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <option value="new">🆕 + 新建客户项目</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>
              提示：创建后将同步配置至 AI 画布
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                borderRadius: "30px",
                fontSize: "12px",
                fontWeight: "700",
                color: "#64748b",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
            >
              取消
            </button>
            
            <button
              type="button"
              onClick={() => {
                if (targetProjectId === "new") {
                  onStart();
                } else {
                  if (onUseWithProject) {
                    onUseWithProject(targetProjectId);
                  }
                }
              }}
              disabled={isUploading}
              style={{
                padding: "8px 20px",
                background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                border: 0,
                borderRadius: "30px",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "750",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: isUploading ? "not-allowed" : "pointer",
                opacity: isUploading ? 0.6 : 1,
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 4px 14px rgba(15, 118, 110, 0.25)"
              }}
              onMouseEnter={(e) => {
                if (!isUploading) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(15, 118, 110, 0.35)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isUploading) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(15, 118, 110, 0.25)";
                }
              }}
            >
              <Sparkles size={14} />
              {targetProjectId === "new" ? "应用并创建项目" : "同步到选中项目"}
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}
