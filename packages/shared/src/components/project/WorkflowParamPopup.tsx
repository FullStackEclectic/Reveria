import React from "react";

interface WorkflowParamPopupProps {
  selectedWorkflow: string | null;
  paramPopupRef: React.RefObject<HTMLDivElement | null>;
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
}

export const WorkflowParamPopup: React.FC<WorkflowParamPopupProps> = ({
  selectedWorkflow,
  paramPopupRef,
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
  getQualityLabel
}) => {
  return (
    <div className="gen-param-popup" ref={paramPopupRef} onClick={(e) => e.stopPropagation()}>
      {/* 1. 质量 */}
      {selectedWorkflow === "image-generation" && (
        <div className="gen-param-section">
          <span className="gen-param-section-title">质量</span>
          <div className="gen-btn-group">
            {(["auto", "high", "medium", "low"] as const).map((q) => (
              <button
                key={q}
                type="button"
                className={`gen-selector-item ${quality === q ? "active" : ""}`}
                onClick={() => setQuality(q)}
              >
                {getQualityLabel(q)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2. 尺寸微调 */}
      <div className="gen-param-section">
        <span className="gen-param-section-title">尺寸微调 (PX)</span>
        <div className="gen-custom-dim-row">
          <div className="gen-dim-input">
            <span>W</span>
            <input
              type="number"
              value={width}
              onChange={(e) => {
                setWidth(Number(e.target.value));
                setAspectRatio("自定义");
              }}
            />
          </div>
          <span style={{ color: "rgba(185, 178, 165, 0.4)", fontWeight: "bold" }}>×</span>
          <div className="gen-dim-input">
            <span>H</span>
            <input
              type="number"
              value={height}
              onChange={(e) => {
                setHeight(Number(e.target.value));
                setAspectRatio("自定义");
              }}
            />
          </div>
        </div>
      </div>

      {/* 3. 比例预设 */}
      <div className="gen-param-section">
        <span className="gen-param-section-title">比例预设</span>
        <div className="gen-preset-grid">
          {(["1:1", "3:2", "2:3", "4:3", "3:4", "9:16", "1:1(2k)", "16:9(2k)", "9:16(2k)", "16:9(4k)", "9:16(4k)", "auto"] as const).map((ratio) => (
            <button
              key={ratio}
              type="button"
              className={`gen-preset-btn ${aspectRatio === ratio ? "active" : ""}`}
              onClick={() => handlePresetRatio(ratio)}
            >
              <div className="gen-preset-ratio-box" style={getRatioBoxStyle(ratio)} />
              <span className="gen-preset-ratio-text">{ratio}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. 图片张数 */}
      {selectedWorkflow === "image-generation" && (
        <div className="gen-param-section">
          <span className="gen-param-section-title">生成数量 (当前消耗: {12 * imageCount} 点)</span>
          <div className="gen-btn-group" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "2px" }}>
            {([1, 2, 3, 4, 5] as const).map((num) => (
              <button
                key={num}
                type="button"
                className={`gen-selector-item ${imageCount === num ? "active" : ""}`}
                onClick={() => setImageCount(num)}
              >
                {num} 张
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
