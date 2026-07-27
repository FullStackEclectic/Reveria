import React from "react";
import {
  Brush, CircleDashed, Eraser, Eye, EyeOff, Pipette, Plus, ScanLine, SunMedium, Trash2,
} from "lucide-react";
import { MAX_LOCAL_MASKS, type LocalMask, type LocalMaskType } from "./editorConstants";
import type { LocalMaskBrushTool } from "./LocalMaskOverlay";

interface Props {
  masks: LocalMask[];
  selectedMaskId: string | null;
  brushTool: LocalMaskBrushTool;
  brushSize: number;
  brushFlow: number;
  showOverlay: boolean;
  onAdd: (type: LocalMaskType) => void;
  onSelect: (id: string) => void;
  onChange: (mask: LocalMask) => void;
  onCommit: (mask: LocalMask) => void;
  onDelete: (id: string) => void;
  onBrushToolChange: (tool: LocalMaskBrushTool) => void;
  onBrushSizeChange: (value: number) => void;
  onBrushFlowChange: (value: number) => void;
  onShowOverlayChange: (show: boolean) => void;
}

const MASK_TYPES: Array<{ type: LocalMaskType; label: string; icon: React.ElementType }> = [
  { type: "brush", label: "画笔", icon: Brush },
  { type: "linear", label: "渐变", icon: ScanLine },
  { type: "radial", label: "径向", icon: CircleDashed },
  { type: "color", label: "颜色", icon: Pipette },
  { type: "luminance", label: "亮度", icon: SunMedium },
];

const ADJUSTMENTS: Array<{ key: keyof LocalMask["adjustments"]; label: string }> = [
  { key: "exposure", label: "曝光" },
  { key: "contrast", label: "对比度" },
  { key: "saturation", label: "饱和度" },
  { key: "temperature", label: "色温" },
  { key: "tint", label: "色调" },
];

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display?: string;
  onChange: (value: number) => void;
  onCommit: () => void;
}

function MaskSlider({ label, value, min, max, step = 1, display, onChange, onCommit }: SliderProps) {
  return (
    <div className="slider-item local-mask-slider">
      <div className="slider-label"><span>{label}</span><span className="value">{display ?? Math.round(value)}</span></div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onMouseUp={onCommit} onTouchEnd={onCommit}
      />
    </div>
  );
}

export function LocalMaskPanel({
  masks, selectedMaskId, brushTool, brushSize, brushFlow, showOverlay,
  onAdd, onSelect, onChange, onCommit, onDelete,
  onBrushToolChange, onBrushSizeChange, onBrushFlowChange, onShowOverlayChange,
}: Props) {
  const selected = masks.find((mask) => mask.id === selectedMaskId) ?? null;
  const patch = (changes: Partial<LocalMask>, commit = false) => {
    if (!selected) return;
    const next = { ...selected, ...changes };
    onChange(next);
    if (commit) onCommit(next);
  };
  const patchAdjustment = (key: keyof LocalMask["adjustments"], value: number, commit = false) => {
    if (!selected) return;
    const next = { ...selected, adjustments: { ...selected.adjustments, [key]: value } };
    onChange(next);
    if (commit) onCommit(next);
  };

  return (
    <div className="adjustment-subview local-mask-panel">
      <div className="panel-title-large">局部蒙版</div>

      <div className="local-mask-add-grid">
        {MASK_TYPES.map(({ type, label, icon: Icon }) => (
          <button key={type} disabled={masks.length >= MAX_LOCAL_MASKS} onClick={() => onAdd(type)} title={`添加${label}蒙版`}>
            <Icon size={14} /><span>{label}</span>
          </button>
        ))}
      </div>

      <div className="local-mask-list">
        {masks.length === 0 && <div className="panel-hint-text">暂无局部蒙版</div>}
        {masks.map((mask) => (
          <div key={mask.id} className={`local-mask-list-row ${mask.id === selectedMaskId ? "active" : ""}`}>
            <button className="local-mask-select-btn" onClick={() => onSelect(mask.id)}>{mask.name}</button>
            <button
              className="local-mask-icon-btn"
              onClick={() => { const next = { ...mask, enabled: !mask.enabled }; onChange(next); onCommit(next); }}
              title={mask.enabled ? "停用蒙版" : "启用蒙版"}
            >
              {mask.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            <button className="local-mask-icon-btn danger" onClick={() => onDelete(mask.id)} title="删除蒙版">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {selected && (
        <>
          <input
            className="local-mask-name-input"
            value={selected.name}
            maxLength={40}
            onChange={(event) => patch({ name: event.target.value })}
            onBlur={() => onCommit(selected)}
            aria-label="蒙版名称"
          />

          <div className="local-mask-toggle-row">
            <label><input type="checkbox" checked={selected.inverted} onChange={(event) => patch({ inverted: event.target.checked }, true)} />反相</label>
            <label><input type="checkbox" checked={showOverlay} onChange={(event) => onShowOverlayChange(event.target.checked)} />显示蒙版</label>
          </div>

          <MaskSlider label="蒙版强度" value={selected.opacity * 100} min={0} max={100} display={`${Math.round(selected.opacity * 100)}%`}
            onChange={(value) => patch({ opacity: value / 100 })} onCommit={() => onCommit(selected)} />
          <MaskSlider label="羽化" value={selected.feather * 100} min={1} max={100} display={`${Math.round(selected.feather * 100)}%`}
            onChange={(value) => patch({ feather: value / 100 })} onCommit={() => onCommit(selected)} />

          {selected.type === "brush" && (
            <>
              <div className="local-mask-brush-tools">
                <button className={brushTool === "paint" ? "active" : ""} onClick={() => onBrushToolChange("paint")}><Brush size={14} />绘制</button>
                <button className={brushTool === "erase" ? "active" : ""} onClick={() => onBrushToolChange("erase")}><Eraser size={14} />擦除</button>
              </div>
              <MaskSlider label="画笔大小" value={brushSize} min={10} max={240} display={`${brushSize}px`}
                onChange={onBrushSizeChange} onCommit={() => undefined} />
              <MaskSlider label="流量" value={brushFlow} min={5} max={100} display={`${brushFlow}%`}
                onChange={onBrushFlowChange} onCommit={() => undefined} />
              <div className="local-mask-toggle-row single">
                <label><input type="checkbox" checked={selected.edge_aware} onChange={(event) => patch({ edge_aware: event.target.checked }, true)} />边缘感知</label>
              </div>
              {selected.edge_aware && (
                <MaskSlider label="边缘容差" value={selected.edge_tolerance * 100} min={2} max={100} display={`${Math.round(selected.edge_tolerance * 100)}%`}
                  onChange={(value) => patch({ edge_tolerance: value / 100 })} onCommit={() => onCommit(selected)} />
              )}
              <button className="panel-clear-btn" disabled={selected.points.length === 0} onClick={() => patch({ points: [] }, true)}>
                <Eraser size={13} /> 清空画笔
              </button>
            </>
          )}

          {selected.type === "radial" && (
            <MaskSlider label="旋转" value={selected.rotation} min={-180} max={180} display={`${Math.round(selected.rotation)}°`}
              onChange={(value) => patch({ rotation: value })} onCommit={() => onCommit(selected)} />
          )}

          {selected.type === "color" && (
            <>
              <MaskSlider label="目标色相" value={selected.color_hue} min={0} max={360} display={`${Math.round(selected.color_hue)}°`}
                onChange={(value) => patch({ color_hue: value })} onCommit={() => onCommit(selected)} />
              <MaskSlider label="色相范围" value={selected.color_range} min={1} max={180} display={`${Math.round(selected.color_range)}°`}
                onChange={(value) => patch({ color_range: value })} onCommit={() => onCommit(selected)} />
              <MaskSlider label="最低饱和度" value={selected.color_saturation_min * 100} min={0} max={100} display={`${Math.round(selected.color_saturation_min * 100)}%`}
                onChange={(value) => patch({ color_saturation_min: value / 100 })} onCommit={() => onCommit(selected)} />
            </>
          )}

          {selected.type === "luminance" && (
            <>
              <MaskSlider label="最低亮度" value={selected.luminance_min * 100} min={0} max={100} display={`${Math.round(selected.luminance_min * 100)}%`}
                onChange={(value) => patch({ luminance_min: Math.min(value / 100, selected.luminance_max) })} onCommit={() => onCommit(selected)} />
              <MaskSlider label="最高亮度" value={selected.luminance_max * 100} min={0} max={100} display={`${Math.round(selected.luminance_max * 100)}%`}
                onChange={(value) => patch({ luminance_max: Math.max(value / 100, selected.luminance_min) })} onCommit={() => onCommit(selected)} />
            </>
          )}

          <div className="local-mask-section-title"><Plus size={13} />局部调整</div>
          {ADJUSTMENTS.map(({ key, label }) => (
            <MaskSlider key={key} label={label} value={selected.adjustments[key]} min={-100} max={100}
              onChange={(value) => patchAdjustment(key, value)} onCommit={() => onCommit(selected)} />
          ))}
        </>
      )}
    </div>
  );
}
