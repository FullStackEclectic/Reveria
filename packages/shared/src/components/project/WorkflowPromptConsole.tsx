import React from "react";
import { Zap, Loader2, Image, ChevronDown, Sparkles, X } from "lucide-react";
import { AssetSummary, ModelSummary, WorkflowType } from "../../types";
import { assetUrl, assetTitle } from "../../utils";
import { WorkflowParamPopup } from "./WorkflowParamPopup";

interface WorkflowPromptConsoleProps {
  selectedWorkflow: WorkflowType | null;
  setSelectedWorkflow: (w: WorkflowType | null) => void;
  workflowInput: string;
  setWorkflowInput: (val: string) => void;
  isRunningWorkflow: boolean;
  refAsset: AssetSummary | null;
  setRefAsset: (asset: AssetSummary | null) => void;
  isUploadingRef: boolean;
  setIsUploadingRef: (val: boolean) => void;
  inputRows: number;
  handleTextareaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  isModeDropdownOpen: boolean;
  setIsModeDropdownOpen: (val: boolean) => void;
  isParamPopupOpen: boolean;
  setIsParamPopupOpen: (val: boolean) => void;
  isRefMenuOpen: boolean;
  setIsRefMenuOpen: (val: boolean) => void;
  isRefSelectorOpen: boolean;
  setIsRefSelectorOpen: (val: boolean) => void;
  quality: "auto" | "high" | "medium" | "low";
  setQuality: (q: "auto" | "high" | "medium" | "low") => void;
  width: number;
  setWidth: (w: number) => void;
  height: number;
  setHeight: (h: number) => void;
  aspectRatio: string;
  setAspectRatio: (r: string) => void;
  imageCount: number;
  setImageCount: (c: number) => void;
  handlePresetRatio: (ratio: string) => void;
  getRatioBoxStyle: (ratio: string) => React.CSSProperties;
  getQualityLabel: (quality: string) => string;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  isModelDropdownOpen: boolean;
  setIsModelDropdownOpen: (val: boolean) => void;
  runWorkflow: () => void;
  costPoints: number;
  isRunnable: boolean;
  getAvailableModels: () => { id: string; name: string; display_name: string }[];
  paramBadgeRef: React.RefObject<HTMLButtonElement>;
  paramPopupRef: React.RefObject<HTMLDivElement>;
  modelTriggerRef: React.RefObject<HTMLButtonElement>;
  modelDropdownRef: React.RefObject<HTMLDivElement>;
  refMenuTriggerRef: React.RefObject<HTMLDivElement>;
  fileRefInputRef: React.RefObject<HTMLInputElement>;
  handleUploadRefImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  imageAssets: AssetSummary[];
  quickTasks: readonly { type: WorkflowType; label: string }[];
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export const WorkflowPromptConsole: React.FC<WorkflowPromptConsoleProps> = ({
  selectedWorkflow,
  setSelectedWorkflow,
  workflowInput,
  setWorkflowInput,
  isRunningWorkflow,
  refAsset,
  setRefAsset,
  isUploadingRef,
  setIsUploadingRef,
  inputRows,
  handleTextareaChange,
  isModeDropdownOpen,
  setIsModeDropdownOpen,
  isParamPopupOpen,
  setIsParamPopupOpen,
  isRefMenuOpen,
  setIsRefMenuOpen,
  isRefSelectorOpen,
  setIsRefSelectorOpen,
  quality,
  setQuality,
  width,
  setWidth,
  height,
  setHeight,
  aspectRatio,
  setAspectRatio,
  imageCount,
  setImageCount,
  handlePresetRatio,
  getRatioBoxStyle,
  getQualityLabel,
  selectedModel,
  setSelectedModel,
  isModelDropdownOpen,
  setIsModelDropdownOpen,
  runWorkflow,
  costPoints,
  isRunnable,
  getAvailableModels,
  paramBadgeRef,
  paramPopupRef,
  modelTriggerRef,
  modelDropdownRef,
  refMenuTriggerRef,
  fileRefInputRef,
  handleUploadRefImage,
  imageAssets,
  quickTasks,
  textareaRef
}) => {
  const selectedWorkflowLabel =
    quickTasks.find((task) => task.type === selectedWorkflow)?.label ?? "工作流";

  return (
    <div className="gen-sticky-bottom">
      <div className="gen-prompt-card">
        
        <div className="gen-prompt-top-row" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "10px 12px 6px 12px" }}>
          {(selectedWorkflow === "image-generation" || selectedWorkflow === "video-generation") && (
            <div style={{ flexShrink: 0, display: "flex", justifyContent: "flex-start" }}>
              {refAsset ? (
                <div className="gen-ref-image-preview">
                  <img 
                    src={assetUrl(refAsset.thumbnail_url ?? refAsset.file_url ?? "")} 
                    alt="Reference" 
                  />
                  <button
                    type="button"
                    className="gen-ref-image-remove"
                    onClick={() => setRefAsset(null)}
                    title="移除参考图"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div style={{ position: "relative" }} ref={refMenuTriggerRef}>
                  <button
                    type="button"
                    className="gen-ref-image-btn"
                    onClick={() => setIsRefMenuOpen(!isRefMenuOpen)}
                    title="添加参考图"
                  >
                    <Image size={15} />
                    <span style={{ fontSize: "9px", marginTop: "2px", fontWeight: "600" }}>
                      {isUploadingRef ? "上传中..." : "参考图"}
                    </span>
                  </button>

                  {isRefMenuOpen && (
                    <div 
                      className="gen-mode-dropdown-menu"
                      style={{
                        bottom: "38px",
                        left: "0",
                        top: "auto",
                        width: "154px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px",
                        padding: "4px",
                        zIndex: 100,
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), var(--rv-shadow-lg)"
                      }}
                    >
                      <button
                        type="button"
                        className="gen-mode-dropdown-item"
                        onClick={() => {
                          setIsRefMenuOpen(false);
                          fileRefInputRef.current?.click();
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 10px",
                          textAlign: "left",
                          width: "100%",
                          border: 0,
                          background: "transparent",
                          fontSize: "11px",
                          cursor: "pointer",
                          borderRadius: "4px",
                        }}
                      >
                        上传本地照片
                      </button>
                      <button
                        type="button"
                        className="gen-mode-dropdown-item"
                        onClick={() => {
                          setIsRefMenuOpen(false);
                          setIsRefSelectorOpen(true);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 10px",
                          textAlign: "left",
                          width: "100%",
                          border: 0,
                          background: "transparent",
                          fontSize: "11px",
                          cursor: "pointer",
                          borderRadius: "4px",
                        }}
                      >
                        从项目素材选择
                      </button>
                    </div>
                  )}
                </div>
              )}
              
              <input
                type="file"
                ref={fileRefInputRef}
                onChange={handleUploadRefImage}
                accept="image/*"
                style={{ display: "none" }}
              />
            </div>
          )}

          <div className="gen-prompt-input-wrapper" style={{ width: "100%" }}>
            <textarea
              ref={textareaRef}
              className="gen-prompt-textarea"
              placeholder={
                selectedWorkflow === "text-generation"
                  ? "输入创意需求、提问，或让 AI 为您润色文案..."
                  : "描述你想要生成的画面，例如: 一个科幻机甲战士，赛博朋克风格，8k 高清..."
              }
              value={workflowInput}
              onChange={handleTextareaChange}
              rows={inputRows}
            />
          </div>
        </div>

        <div className="gen-prompt-actions-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px 10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
            <div style={{ position: "relative" }}>
              <button
                className="gen-mode-badge"
                type="button"
                onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                style={{ border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <span>{selectedWorkflowLabel}</span>
                <ChevronDown size={10} />
              </button>

              {isModeDropdownOpen && (
                <div className="gen-mode-dropdown-menu">
                  {quickTasks.map((t) => (
                    <button
                      key={t.type}
                      className={`gen-mode-dropdown-item ${selectedWorkflow === t.type ? "active" : ""}`}
                      type="button"
                      onClick={() => {
                        setSelectedWorkflow(t.type);
                        setIsModeDropdownOpen(false);
                        setIsParamPopupOpen(false);
                      }}
                    >
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(selectedWorkflow === "image-generation" || selectedWorkflow === "video-generation") && (
              <button
                ref={paramBadgeRef}
                type="button"
                className="gen-param-badge"
                onClick={() => setIsParamPopupOpen(!isParamPopupOpen)}
                style={{ border: "none", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", marginLeft: "6px" }}
              >
                <span>
                  {selectedWorkflow === "image-generation"
                    ? `${getQualityLabel(quality)} · ${aspectRatio} · ${imageCount}张`
                    : `比例：${aspectRatio}`}
                </span>
                <ChevronDown size={10} />
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, position: "relative" }}>
            <button
              ref={modelTriggerRef}
              className="gen-model-trigger"
              type="button"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              title={`当前选择模型: ${getAvailableModels().find((m) => m.id === selectedModel)?.display_name || selectedModel}`}
            >
              AI
            </button>

            {isModelDropdownOpen && (
              <div className="gen-model-dropdown-menu" ref={modelDropdownRef} onClick={(e) => e.stopPropagation()}>
                <div className="gen-model-dropdown-title">选择模型</div>
                {getAvailableModels().map((m) => (
                  <button
                    key={m.id}
                    className={`gen-model-dropdown-item ${selectedModel === m.id ? "active" : ""}`}
                    type="button"
                    onClick={() => {
                      setSelectedModel(m.id);
                      setIsModelDropdownOpen(false);
                    }}
                  >
                    <span className="gen-model-dot" />
                    <span>{m.display_name}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              className="gen-submit-btn"
              type="button"
              disabled={isRunningWorkflow || !isRunnable || !workflowInput.trim()}
              onClick={runWorkflow}
              style={{
                border: "none",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                cursor: isRunningWorkflow ? "not-allowed" : "pointer",
                background: isRunningWorkflow ? "var(--rv-color-bg-tertiary)" : undefined
              }}
            >
              {isRunningWorkflow ? (
                <Loader2 className="spin" size={12} />
              ) : (
                <Zap size={11} fill="currentColor" />
              )}
              <span>
                {isRunningWorkflow 
                  ? "发送中..." 
                  : selectedWorkflow === "text-generation"
                    ? `${costPoints} 积分/M tokens`
                    : `${costPoints * imageCount}`
                }
              </span>
            </button>
          </div>
        </div>

        {(selectedWorkflow === "image-generation" || selectedWorkflow === "video-generation") && isParamPopupOpen && (
          <WorkflowParamPopup
            selectedWorkflow={selectedWorkflow}
            paramPopupRef={paramPopupRef}
            quality={quality}
            setQuality={setQuality}
            width={width}
            setWidth={setWidth}
            height={height}
            setHeight={setHeight}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            imageCount={imageCount}
            setImageCount={setImageCount}
            handlePresetRatio={handlePresetRatio}
            getRatioBoxStyle={getRatioBoxStyle}
            getQualityLabel={getQualityLabel}
          />
        )}

        {isRefSelectorOpen && (
          <div className="gen-ref-selector-overlay">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--rv-color-text-main)" }}>选择项目内的参考图</span>
              <button
                type="button"
                onClick={() => setIsRefSelectorOpen(false)}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--rv-color-text-muted)", padding: "2px" }}
              >
                <X size={14} />
              </button>
            </div>
            {imageAssets.length > 0 ? (
              <div className="gen-ref-selector-grid">
                {imageAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="gen-ref-selector-item"
                    onClick={() => {
                      setRefAsset(asset);
                      setIsRefSelectorOpen(false);
                    }}
                    title={assetTitle(asset)}
                  >
                    <img src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")} alt={assetTitle(asset)} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "24px 10px", color: "var(--rv-color-text-muted)", fontSize: "11px", textAlign: "center", lineHeight: "1.4" }}>
                项目中无可用图片资产。<br />请先通过左侧“库与历史”或素材管理导入图片。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
