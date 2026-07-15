import React from "react";
import { Sparkles, LayoutTemplate, Upload, Image as ImageIcon, X } from "lucide-react";
import { PromptTemplate, AssetSummary, TemplateExecutionConfig } from "../../types";
import { assetUrl, assetTitle } from "../../utils";
import { AIAdvancedParamsPanel, AIAdvancedParams } from "../admin/AIAdvancedParamsPanel";
import { TemplateSceneEditor } from "../common/TemplateSceneEditor";

interface TemplateConfigViewProps {
  activeTemplate: PromptTemplate;
  promptInput: string;
  setPromptInput: (val: string) => void;
  negativePromptInput: string;
  setNegativePromptInput: (val: string) => void;
  uploadedImages: string[];
  setUploadedImages: (urls: string[]) => void;
  isUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleUploadImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  advParams: AIAdvancedParams;
  setAdvParams: (val: AIAdvancedParams) => void;
  executionConfig: TemplateExecutionConfig;
  setExecutionConfig: React.Dispatch<React.SetStateAction<TemplateExecutionConfig>>;
  handleStartGeneration: () => void;
  projectAssets: AssetSummary[];
  selectedModelId: string;
  setSelectedModelId: (val: string) => void;
  availableModels: any[];
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
  executionConfig,
  setExecutionConfig,
  handleStartGeneration,
  projectAssets,
  selectedModelId,
  setSelectedModelId,
  availableModels
}) => {
  const [isRefSelectorOpen, setIsRefSelectorOpen] = React.useState(false);
  const isReferenceRequired = executionConfig.reference_mode === "required";
  const showReferenceUpload = executionConfig.reference_mode !== "none";

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
            {(() => {
              const matched = availableModels.find((m: any) => m.id === selectedModelId);
              return matched ? `模型：${matched.display_name}` : `模型：${selectedModelId || "默认自动路由"}`;
            })()}
          </span>
        </div>

      </div>

      {/* 右栏：参数配置与立即生成 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%", overflowY: "auto", paddingRight: "8px", position: "relative" }}>
        
        {/* 模型选择下拉框 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>选择生成算力模型</span>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            style={{
              width: "100%",
              height: "36px",
              background: "var(--rv-color-bg-sidebar)",
              border: "1px solid var(--rv-color-border-thin)",
              color: "var(--rv-color-text-main)",
              borderRadius: "var(--rv-radius-xs)",
              padding: "0 10px",
              fontSize: "12px",
              outline: "none",
              cursor: "pointer"
            }}
          >
            {availableModels.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.display_name} ({m.name})
              </option>
            ))}
            {availableModels.length === 0 && (
              <option value={selectedModelId}>{selectedModelId || "默认智能路由"}</option>
            )}
          </select>
        </div>

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

        {activeTemplate.workflow_type === "image-generation" && executionConfig.output_mode === "scenes" && (
          <TemplateSceneEditor
            scenes={executionConfig.scenes}
            maxScenes={executionConfig.max_outputs}
            onChange={(scenes) => setExecutionConfig((current) => ({ ...current, scenes }))}
          />
        )}

        {activeTemplate.workflow_type === "image-generation" && executionConfig.output_mode === "variants" && (
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "42px", padding: "0 12px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", fontSize: "12px", fontWeight: 700, color: "var(--rv-color-text-main)" }}>
            生成变体数量
            <input
              type="number"
              min={1}
              max={executionConfig.max_outputs}
              value={advParams.image_count ?? 2}
              onChange={(event) => setAdvParams({ ...advParams, image_count: Math.max(1, Math.min(Number(event.target.value) || 1, executionConfig.max_outputs)) })}
              style={{ width: "72px", height: "30px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "4px", padding: "0 8px", fontSize: "12px" }}
            />
          </label>
        )}

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
        {showReferenceUpload ? (() => {
          const boxWidth = 150;
          const boxHeight = 150;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>
                参考照片（{isReferenceRequired ? "必填" : "可选"}）
              </span>
              <div 
                style={{ 
                  display: "flex", 
                  justifyContent: "center", 
                  alignItems: "center", 
                  padding: "16px 0", 
                  background: "var(--rv-color-bg-sidebar)", 
                  borderRadius: "var(--rv-radius-xs)", 
                  border: "1px dashed var(--rv-color-border-thin)",
                  width: "100%",
                  boxSizing: "border-box"
                }}
              >
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: `${boxWidth}px`,
                    height: `${boxHeight}px`,
                    borderRadius: "var(--rv-radius-xs)",
                    border: "1.5px dashed rgba(15, 118, 110, 0.25)",
                    background: "#ffffff",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.02)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--rv-color-primary)";
                    e.currentTarget.style.background = "var(--rv-color-primary-light)";
                    e.currentTarget.style.transform = "scale(1.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(15, 118, 110, 0.25)";
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  {isUploading ? (
                    <div style={{ fontSize: "11px", color: "var(--rv-color-primary)", fontWeight: "bold" }}>上传中...</div>
                  ) : uploadedImages.length > 0 ? (
                    <>
                      <img
                        src={assetUrl(uploadedImages[0])}
                        alt="参考图"
                        style={{ width: "100%", height: "100%", objectFit: "contain", background: "#ffffff" }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedImages([]);
                        }}
                        style={{
                          position: "absolute",
                          top: "6px",
                          right: "6px",
                          background: "rgba(0,0,0,0.5)",
                          border: 0,
                          borderRadius: "100px",
                          width: "18px",
                          height: "18px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          cursor: "pointer",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.9)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,0,0,0.5)"}
                      >
                        <X size={10} />
                      </button>
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

              {/* 上传与素材库双选按钮组 */}
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1,
                    padding: "7px 12px",
                    background: "#ffffff",
                    border: "1px solid var(--rv-color-border-thin)",
                    borderRadius: "var(--rv-radius-xs)",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: "700",
                    color: "var(--rv-color-text-main)",
                    transition: "all 0.2s",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--rv-color-bg-sidebar)";
                    e.currentTarget.style.borderColor = "rgba(0,0,0,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.borderColor = "var(--rv-color-border-thin)";
                  }}
                >
                  本地上传
                </button>
                <button
                  type="button"
                  onClick={() => setIsRefSelectorOpen(true)}
                  style={{
                    flex: 1,
                    padding: "7px 12px",
                    background: "var(--rv-color-primary)",
                    border: "1px solid var(--rv-color-primary)",
                    borderRadius: "var(--rv-radius-xs)",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: "700",
                    color: "#ffffff",
                    transition: "all 0.2s",
                    boxShadow: "0 1px 3px rgba(15, 118, 110, 0.15)"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "hsl(170, 80%, 20%)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "var(--rv-color-primary)"}
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
              modelId={selectedModelId}
            />
          </div>
        )}

        {/* 立即生成触发按钮 */}
        <div style={{ marginTop: "14px", paddingTop: "8px", borderTop: "1px solid var(--rv-color-border-thin)", flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleStartGeneration}
            disabled={isUploading || (isReferenceRequired && uploadedImages.length === 0)}
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
              cursor: (isUploading || (isReferenceRequired && uploadedImages.length === 0)) ? "not-allowed" : "pointer",
              opacity: (isUploading || (isReferenceRequired && uploadedImages.length === 0)) ? 0.6 : 1,
              transition: "all 0.2s",
              boxShadow: "var(--rv-shadow-md)"
            }}
            onMouseEnter={(e) => {
              if (!isUploading && !(isReferenceRequired && uploadedImages.length === 0)) {
                e.currentTarget.style.background = "hsl(170, 80%, 20%)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isUploading && !(isReferenceRequired && uploadedImages.length === 0)) {
                e.currentTarget.style.background = "var(--rv-color-primary)";
              }
            }}
          >
            <Sparkles size={16} />
            {executionConfig.output_mode === "scenes" ? `生成 ${executionConfig.scenes.length} 个场景` : "立即在画布生成"}
          </button>
          {(isReferenceRequired && uploadedImages.length === 0) && (
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
            {(() => {
              const imageAssets = projectAssets.filter(asset => asset.asset_type === "image");
              return imageAssets.length > 0 ? (
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
                  {imageAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="gen-ref-selector-item"
                      onClick={() => {
                        setUploadedImages([asset.file_url || asset.thumbnail_url || ""]);
                        setIsRefSelectorOpen(false);
                      }}
                      title={assetTitle(asset) || "素材"}
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
                      <img src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")} alt={assetTitle(asset) || "资产"} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "40px 10px", color: "var(--rv-color-text-muted)", fontSize: "11px", textAlign: "center", lineHeight: "1.6" }}>
                  当前项目内无可用图片资产。<br />请先通过本地上传或从左侧素材区添加。
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
