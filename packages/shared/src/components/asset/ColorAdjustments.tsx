import React from "react";
import { RetouchSettings } from "./editorConstants";

interface ColorAdjustmentsProps {
  settings: RetouchSettings;
  handleSliderChange: (key: keyof RetouchSettings, val: number) => void;
  handleAutoSave: () => void;
}

export function ColorAdjustments({
  settings,
  handleSliderChange,
  handleAutoSave,
}: ColorAdjustmentsProps) {
  return (
    <div className="adjustment-subview">
      <div className="panel-title-large">色彩调节</div>

      {/* 基础调色参数 */}
      <section className="adjustment-group">
        <h4 className="group-header">基础参数</h4>

        <div className="slider-item">
          <div className="slider-label">
            <span>曝光调节</span>
            <span className="value">{settings.exposure > 0 ? `+${settings.exposure}` : settings.exposure}%</span>
          </div>
          <input 
            type="range" min="-100" max="100" 
            value={settings.exposure}
            onChange={(e) => handleSliderChange("exposure", Number(e.target.value))}
            onMouseUp={handleAutoSave}
          />
        </div>

        <div className="slider-item">
          <div className="slider-label">
            <span>对比度</span>
            <span className="value">{settings.contrast > 0 ? `+${settings.contrast}` : settings.contrast}%</span>
          </div>
          <input 
            type="range" min="-100" max="100" 
            value={settings.contrast}
            onChange={(e) => handleSliderChange("contrast", Number(e.target.value))}
            onMouseUp={handleAutoSave}
          />
        </div>

        <div className="slider-item">
          <div className="slider-label">
            <span>色彩饱和度</span>
            <span className="value">{settings.saturation > 0 ? `+${settings.saturation}` : settings.saturation}%</span>
          </div>
          <input 
            type="range" min="-100" max="100" 
            value={settings.saturation}
            onChange={(e) => handleSliderChange("saturation", Number(e.target.value))}
            onMouseUp={handleAutoSave}
          />
        </div>
      </section>

      {/* LUT 大师创意预设 */}
      <section className="adjustment-group" style={{ marginTop: "24px" }}>
        <h4 className="group-header">创意 LUT 映射</h4>
        <div className="lut-cards-grid">
          {[
            { name: "无滤镜", file: "" },
            { name: "中性高级灰", file: "gray.cube" },
            { name: "日系清透", file: "japanese.cube" },
            { name: "复古胶片", file: "film.cube" },
            { name: "温暖秋色", file: "autumn.cube" },
          ].map((lut) => (
            <button 
              key={lut.name}
              className={`lut-card-btn ${settings.lut_file === lut.file ? "active" : ""}`}
              onClick={() => {
                handleSliderChange("lut_file", lut.file as any);
                // Trigger auto save
                setTimeout(() => handleAutoSave(), 50);
              }}
            >
              {lut.name}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
