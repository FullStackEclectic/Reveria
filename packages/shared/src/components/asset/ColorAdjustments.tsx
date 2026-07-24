import React from "react";
import { CurveKey, CurvePoints, RetouchSettings } from "./editorConstants";
import { HslAdjustments } from "./HslAdjustments";
import { CurveAdjustments } from "./CurveAdjustments";
import { ToneMappingAdjustments } from "./ToneMappingAdjustments";

interface Props {
  settings: RetouchSettings;
  handleSliderChange: (key: keyof RetouchSettings, val: number) => void;
  handleCurveChange: (key: CurveKey, val: CurvePoints) => void;
  handleAutoSave: (snapshot?: RetouchSettings) => void;
}

function Slider({
  label, value, min, max,
  onChange, onMouseUp,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; onMouseUp: () => void;
}) {
  const display = value > 0 ? `+${value}` : `${value}`;
  return (
    <div className="slider-item">
      <div className="slider-label">
        <span>{label}</span>
        <span className="value">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onMouseUp}
      />
    </div>
  );
}

export function ColorAdjustments({ settings, handleSliderChange, handleCurveChange, handleAutoSave }: Props) {
  const bind = (key: keyof RetouchSettings, min = -100, max = 100) => ({
    value: settings[key] as number,
    min, max,
    onChange: (v: number) => handleSliderChange(key, v),
    onMouseUp: handleAutoSave,
  });

  return (
    <div className="adjustment-subview">
      <div className="panel-title-large">色彩调节</div>

      <section className="adjustment-group">
        <h4 className="group-header">光影</h4>
        <Slider label="曝光" {...bind("exposure")} />
        <Slider label="对比度" {...bind("contrast")} />
        <Slider label="高光" {...bind("highlights")} />
        <Slider label="阴影" {...bind("shadows")} />
        <Slider label="白色色阶" {...bind("whites")} />
        <Slider label="黑色色阶" {...bind("blacks")} />
      </section>

      <section className="adjustment-group">
        <h4 className="group-header">色彩</h4>
        <Slider label="饱和度" {...bind("saturation")} />
        <Slider label="自然饱和度" {...bind("vibrance")} />
        <Slider label="色温（冷→暖）" {...bind("temperature")} />
        <Slider label="色调（品红→绿）" {...bind("tint")} />
        <Slider label="去雾" {...bind("dehaze", 0, 100)} />
      </section>

      <section className="adjustment-group">
        <h4 className="group-header">细节</h4>
        <Slider label="清晰度" {...bind("clarity")} />
        <Slider label="锐化" {...bind("sharpness", 0, 100)} />
      </section>

      <section className="adjustment-group curve-adjustment-group">
        <h4 className="group-header">RGB 曲线</h4>
        <CurveAdjustments
          settings={settings}
          onChange={handleCurveChange}
          onCommit={(key, value) => handleAutoSave({ ...settings, [key]: value })}
        />
      </section>

      <section className="adjustment-group" style={{ marginTop: "24px" }}>
        <h4 className="group-header">分色调整 HSL</h4>
        <HslAdjustments
          settings={settings}
          handleSliderChange={handleSliderChange}
          handleAutoSave={handleAutoSave}
        />
      </section>

      <section className="adjustment-group tone-mapping-group">
        <h4 className="group-header">色调映射</h4>
        <ToneMappingAdjustments
          settings={settings}
          onChange={handleSliderChange}
          onCommit={handleAutoSave}
        />
      </section>

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
