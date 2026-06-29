import React from "react";
import { Sparkles, LayoutTemplate, Upload, Image as ImageIcon, X } from "lucide-react";
import { PromptTemplate, AIAdvancedParams, AssetSummary } from "../../types";
import { assetUrl } from "../../utils";
import { AIAdvancedParamsPanel } from "../admin/AIAdvancedParamsPanel";

interface TemplateConfigViewProps {
  activeTemplate: PromptTemplate;
  promptInput: string;
  setPromptInput: (val: string) => void;
  negativePromptInput: string;
  setNegativePromptInput: (val: string) => void;
  uploadedImages: string[];
  setUploadedImages: (urls: string[]) => void;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  advParams: AIAdvancedParams;
  setAdvParams: (val: AIAdvancedParams) => void;
  handleStartGeneration: () => void;
  projectAssets: AssetSummary[];
}

export const TemplateConfigView: React.FC<TemplateConfigViewProps> = ({
  activeTemplate,
  promptInput,
  setPromptInput,
  negativePromptInput,
  setNegativePromptInput,
  uploadedImages,
  setUploadedImages,
  isUploading,
  fileInputRef,
  handleUploadImage,
  advParams,
  setAdvParams,
  handleStartGeneration,
  projectAssets
}) => {
  const [isRefSelectorOpen, setIsRefSelectorOpen] = React.useState(false);

  return (
    <div
      style={{
        padding: "24px",
        display: "grid",
        gridTemplateColumns: "580px 1fr",
        gap: "24px",
        height: "100%",
        overflow: "hidden",
        background: "#ffffff"
      }}
    >
      {/* 左栏：效果图高保真预览 */}
      <div 
        style={{ 
          display: "flex", 
          flexDirection: "column", 
          height: "100%", 
          borderRadius: "var(--rv-radius-md)",
          border: "1px solid var(--rv-color-border-thin)",
          overflow: "hidden",
          background: "var(--rv-color-bg-sidebar)",
          position: "relative",
          boxShadow: "inset 0 0 20px rgba(0,0,0,0.02)"
        }}
      >
        {activeTemplate.preview_url ? (
          <img
            src={assetUrl(activeTemplate.preview_url)}
            alt={activeTemplate.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)", color: "var(--rv-color-text-muted)" }}>
            <LayoutTemplate size={48} style={{ strokeWidth: 1.2, opacity: 0.4 }} />
            <span style={{ fontSize: "12px", opacity: 0.6 }}>极简提示词模板 · 暂无效果图</span>
          </div>
        )}

        {/* 推荐模型气泡 */}
        <div 
          style={{ 
            position: "absolute", 
            top: "12px", 
            left: "12px", 
            background: "rgba(255, 255, 255, 0.85)", 
            backdropFilter: "blur(4px)", 
            border: "1px solid rgba(15, 118, 110, 0.15)", 
            borderRadius: "100px", 
            padding: "4px 12px", 
            display: "flex", 
            alignItems: "center", 
            gap: "6px", 
            boxShadow: "0 4px 12px rgba(0,0,0,0.05)" 
          }}
        >
          <Sparkles size={12} style={{ color: "var(--rv-color-primary)" }} />
          <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-primary)" }}>
            {activeTemplate.model_id ? `模型：${activeTemplate.model_id}` : "模型：默认自动路由"}
          </span>
        </div>
      </div>

      {/* 右栏：参数配置与立即生成 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%", overflowY: "auto", paddingRight: "8px", position: "relative" }}>
        
        {/* 正向提示词 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>提示词参数微调</span>
          <textarea
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="在此微调正向提示词..."
            style={{
              width: "100%",
              height: "80px",
              background: "var(--rv-color-bg-sidebar)",
              border: "1px solid var(--rv-color-border-thin)",
              color: "var(--rv-color-text-main)",
              borderRadius: "var(--rv-radius-xs)",
              padding: "10px 12px",
              fontSize: "12px",
              lineHeight: "1.5",
              fontFamily: "JetBrains Mono, monospace",
              outline: "none",
              resize: "none",
              transition: "all 0.2s"
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = "var(--rv-color-primary)"}
            onBlur={(e) => e.currentTarget.style.borderColor = "var(--rv-color-border-thin)"}
          />
        </div>

        {/* 生图模式展示反向提示词 */}
        {(activeTemplate.workflow_type === "image-generation" || activeTemplate.workflow_type === "video-generation") && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>反向提示词 (Negative Prompt)</span>
            <textarea
              value={negativePromptInput}
              onChange={(e) => setNegativePromptInput(e.target.value)}
              placeholder="例如：watermark, blurry, bad quality..."
              style={{
                width: "100%",
                height: "50px",
                background: "rgba(239, 68, 68, 0.02)",
                border: "1px solid rgba(239, 68, 68, 0.15)",
                color: "var(--rv-color-text-main)",
                borderRadius: "var(--rv-radius-xs)",
                padding: "8px 12px",
                fontSize: "12px",
                lineHeight: "1.5",
                fontFamily: "JetBrains Mono, monospace",
                outline: "none",
                resize: "none",
                transition: "all 0.2s"
              }}
            />
          </div>
        )}

        {/* 参考图上传区 */}
        {activeTemplate.need_image && activeTemplate.need_image > 0 ? (() => {
          // 智能提取所选的宽高比例
          const targetW = advParams?.width || 1024;
          const targetH = advParams?.height || 1024;
          const ratioVal = targetW / targetH;

          // 限制最大显示边界，使上传框完美契合选定的图片宽高比
          let boxWidth = 240;
          let boxHeight = 240;
          if (ratioVal === 1) {
            boxWidth = 140;
            boxHeight = 140;
          } else if (ratioVal > 1) {
            boxWidth = 240;
            boxHeight = Math.round(240 / ratioVal);
          } else {
            boxHeight = 160;
            boxWidth = Math.round(160 * ratioVal);
          }

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>
                参考照片 (需要 {activeTemplate.need_image} 张)
              </span>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: `${boxWidth}px`,
                  height: `${boxHeight}px`,
                  borderRadius: "var(--rv-radius-xs)",
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
                      src={assetUrl(uploadedImages[0])}
                      alt="参考图"
                      style={{ width: "100%", height: "100%", objectFit: "contain", background: "#f8fafc" }}
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

              {/* 上传与素材库双选按钮组 */}
              <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    padding: "6px 12px",
                    background: "rgba(0, 0, 0, 0.02)",
                    border: "1px solid var(--rv-color-border-thin)",
                    borderRadius: "var(--rv-radius-xs)",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: "700",
                    color: "var(--rv-color-text-main)",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0, 0, 0, 0.05)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0, 0, 0, 0.02)"}
                >
                  本地上传
                </button>
                <button
                  type="button"
                  onClick={() => setIsRefSelectorOpen(true)}
                  style={{
                    flex: 1,
                    padding: "6px 12px",
                    background: "var(--rv-color-primary-light)",
                    border: "1px solid rgba(15, 118, 110, 0.15)",
                    borderRadius: "var(--rv-radius-xs)",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: "700",
                    color: "var(--rv-color-primary)",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(15, 118, 110, 0.15)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "var(--rv-color-primary-light)"}
                >
                  选择项目素材库
                </button>
              </div>
            </div>
          );
        })() : (
          <div style={{ display: "flex", gap: "10px", padding: "10px", background: "rgba(15,118,110,0.05)", border: "1px solid rgba(15,118,110,0.1)", borderRadius: "var(--rv-radius-xs)" }}>
            <ImageIcon size={14} style={{ color: "var(--rv-color-primary)", marginTop: "2px", flexShrink: 0 }} />
            <div style={{ fontSize: "11px", color: "var(--rv-color-primary)", lineHeight: "1.4" }}>
              本模板不需要参考图，可直接在下方微调参数并生成。
            </div>
          </div>
        )}

        {/* 嵌入 Civitai 风格的高级参数微调面板 */}
        {activeTemplate.show_ratio !== false && (
          <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "12px", marginTop: "4px" }}>
            <AIAdvancedParamsPanel
              value={advParams}
              onChange={setAdvParams}
              showAdvancedToggle={true}
            />
          </div>
        )}

        {/* 立即生成触发按钮 */}
        <div style={{ marginTop: "14px", paddingTop: "8px", borderTop: "1px solid var(--rv-color-border-thin)", flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleStartGeneration}
            disabled={isUploading || ((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0)}
            style={{
              width: "100%",
              minHeight: "42px",
              background: "var(--rv-color-primary)",
              border: 0,
              borderRadius: "var(--rv-radius-xs)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              cursor: (isUploading || ((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0)) ? "not-allowed" : "pointer",
              opacity: (isUploading || ((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0)) ? 0.6 : 1,
              transition: "all 0.2s",
              boxShadow: "var(--rv-shadow-md)"
            }}
            onMouseEnter={(e) => {
              if (!isUploading && !((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0)) {
                e.currentTarget.style.background = "hsl(170, 80%, 20%)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isUploading && !((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0)) {
                e.currentTarget.style.background = "var(--rv-color-primary)";
              }
            }}
          >
            <Sparkles size={16} />
            立即在画布生成
          </button>
          {((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0) && (
            <p style={{ margin: "6px 0 0", fontSize: "10px", color: "#ef4444", textAlign: "center" }}>
              请先上传参考照片以激活生成
            </p>
          )}
        </div>

        {/* 项目素材库选择弹窗 Overlay */}
        {isRefSelectorOpen && (
          <div
            style={{
              position: "absolute",
              top: "0",
              left: "0",
              width: "100%",
              height: "100%",
              background: "var(--rv-color-bg-sidebar)",
              zIndex: 100,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.05)",
              borderRadius: "var(--rv-radius-md)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: "bold", color: "var(--rv-color-text-main)" }}>选择项目内的参考图</span>
              <button
                type="button"
                onClick={() => setIsRefSelectorOpen(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--rv-color-text-muted)" }}
              >
                <X size={16} />
              </button>
            </div>
            {projectAssets && projectAssets.length > 0 ? (
              <div 
                className="gen-ref-selector-grid" 
                style={{ 
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gridAutoRows: "90px",
                  gap: "10px",
                  overflowY: "auto", 
                  flex: 1, 
                  paddingBottom: "16px",
                  maxHeight: "none"
                }}
              >
                {projectAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="gen-ref-selector-item"
                    onClick={() => {
                      setUploadedImages([asset.thumbnail_url || asset.file_url || ""]);
                      setIsRefSelectorOpen(false);
                    }}
                    title={asset.name || "素材"}
                    style={{ 
                      cursor: "pointer",
                      height: "100%",
                      width: "100%",
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: "1px solid var(--rv-color-border-thin)",
                      position: "relative"
                    }}
                  >
                    <img src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")} alt={asset.name || "资产"} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "40px 10px", color: "var(--rv-color-text-muted)", fontSize: "11px", textAlign: "center", lineHeight: "1.6" }}>
                当前项目内无可用图片资产。<br />请先通过本地上传或从左侧素材区添加。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
