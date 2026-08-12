import React from "react";
import { Hand, Maximize2, Minimize2, Undo2 } from "lucide-react";
import { MAX_LIQUIFY_STROKES } from "./editorConstants";
import type { LiquifyTool } from "./LiquifyOverlay";
import { SliderItem } from "./SliderItem";
import type { RetouchSettings } from "./editorConstants";

interface Props {
  tool: LiquifyTool;
  brushSize: number;
  strength: number;
  strokeCount: number;
  onToolChange: (tool: LiquifyTool) => void;
  onBrushSizeChange: (size: number) => void;
  onStrengthChange: (strength: number) => void;
  onClear: () => void;
  settings: RetouchSettings;
  onBodyChange: (key: keyof RetouchSettings, value: number) => void;
  onBodyCommit: () => void;
}

const TOOLS: { id: LiquifyTool; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "push", label: "推拉", icon: <Hand size={14} />, hint: "沿拖动方向搬运像素" },
  { id: "pucker", label: "收缩", icon: <Minimize2 size={14} />, hint: "以笔刷中心向内收缩" },
  { id: "bloat", label: "膨胀", icon: <Maximize2 size={14} />, hint: "以笔刷中心向外膨胀" },
  { id: "restore", label: "还原", icon: <Undo2 size={14} />, hint: "擦除笔刷范围内的液化" },
];

export function LiquifyPanel({
  tool, brushSize, strength, strokeCount,
  onToolChange, onBrushSizeChange, onStrengthChange, onClear,
  settings, onBodyChange, onBodyCommit,
}: Props) {
  return (
    <div className="adjustment-subview">
      <div className="panel-title-large">高精液化</div>

      <div className="liquify-tool-row">
        {TOOLS.map((item) => (
          <button
            key={item.id}
            className={`liquify-tool-btn ${tool === item.id ? "active" : ""}`}
            onClick={() => onToolChange(item.id)}
            title={item.hint}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="slider-item">
        <div className="slider-label">
          <span>笔刷大小</span>
          <span className="value">{brushSize}</span>
        </div>
        <input
          type="range" min={12} max={220} value={brushSize}
          onChange={(event) => onBrushSizeChange(Number(event.target.value))}
        />
      </div>

      <div className="slider-item">
        <div className="slider-label">
          <span>力度</span>
          <span className="value">{strength}</span>
        </div>
        <input
          type="range" min={5} max={100} value={strength}
          onChange={(event) => onStrengthChange(Number(event.target.value))}
        />
      </div>

      <div className="panel-hint-text">
        已记录 {strokeCount} / {MAX_LIQUIFY_STROKES} 笔。液化随参数一同保存，可用撤销回退。
      </div>

      <button className="panel-clear-btn" disabled={strokeCount === 0} onClick={onClear}>
        清除全部液化
      </button>

      <section className="adjustment-group body-shape-group">
        <h4 className="group-header">身体塑形</h4>
        <p className="professional-help-text">先用主体中心与腰线适配构图，再调节塑形参数；复杂姿态可继续使用上方液化笔刷精修。</p>
        <SliderItem label="主体中心" value={settings.body_center_x} min={0} max={100}
          onChange={(value) => onBodyChange("body_center_x", value)} onAutoSave={onBodyCommit} />
        <SliderItem label="腰线位置" value={settings.body_waist_y} min={10} max={90}
          onChange={(value) => onBodyChange("body_waist_y", value)} onAutoSave={onBodyCommit} />
        <SliderItem label="瘦腰" value={settings.body_waist} min={-100} max={100}
          onChange={(value) => onBodyChange("body_waist", value)} onAutoSave={onBodyCommit} />
        <SliderItem label="肩宽" value={settings.body_shoulders} min={-100} max={100}
          onChange={(value) => onBodyChange("body_shoulders", value)} onAutoSave={onBodyCommit} />
        <SliderItem label="胯宽" value={settings.body_hips} min={-100} max={100}
          onChange={(value) => onBodyChange("body_hips", value)} onAutoSave={onBodyCommit} />
        <SliderItem label="瘦腿" value={settings.body_legs} min={-100} max={100}
          onChange={(value) => onBodyChange("body_legs", value)} onAutoSave={onBodyCommit} />
        <SliderItem label="腿长" value={settings.body_leg_length} min={-100} max={100}
          onChange={(value) => onBodyChange("body_leg_length", value)} onAutoSave={onBodyCommit} />
      </section>
    </div>
  );
}
