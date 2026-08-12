import React from "react";
import type { OverlayLayer } from "./editorConstants";
import {
  BLEND_MODES, BLEND_MODE_LABELS, MAX_OVERLAYS, OVERLAY_PRESETS, type OverlayKind,
} from "./retouch/overlays";
import type { useOverlays } from "./useOverlays";

interface Props {
  overlays: OverlayLayer[];
  overlayState: ReturnType<typeof useOverlays>;
}

const FONT_OPTIONS = [
  { value: "system-ui, sans-serif", label: "系统黑体" },
  { value: "serif", label: "衬线" },
  { value: '"Times New Roman", serif', label: "Times" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "monospace", label: "等宽" },
];

export function OverlayPanel({ overlays, overlayState }: Props) {
  const { selected, setSelectedId, add, update, remove, maskTool, setMaskTool,
    brushSize, setBrushSize, editingMask, setEditingMask, commitCurrent } = overlayState;

  const commit = (changes: Partial<OverlayLayer>) => {
    if (!selected) return;
    update({ ...selected, ...changes }, true);
  };

  return (
    <div className="adjustment-subview overlay-panel">
      <div className="panel-title-large">叠加层</div>
      <p className="professional-help-text">文字、光漏、天空、渐变和双色调按图层顺序合成，支持 12 种混合模式与蒙版擦除。</p>
      <div className="overlay-add-row">
        {([
          ["text", "文字"],
          ["preset", "特效"],
          ["gradient", "渐变"],
          ["duotone", "双色调"],
        ] as Array<[OverlayKind, string]>).map(([kind, label]) => (
          <button key={kind} type="button" className="lut-import-btn"
            disabled={overlays.length >= MAX_OVERLAYS} onClick={() => add(kind)}>{label}</button>
        ))}
      </div>
      <div className="overlay-layer-list">
        {overlays.length === 0 && <p className="professional-help-text">尚未添加叠加层。</p>}
        {overlays.map((layer) => (
          <button key={layer.id} type="button"
            className={`overlay-layer-item ${selected?.id === layer.id ? "active" : ""}`}
            onClick={() => setSelectedId(layer.id)}>
            <span>{layer.name}</span>
            <i>{BLEND_MODE_LABELS[layer.blend]}</i>
          </button>
        ))}
      </div>
      {selected && (
        <>
          <label className="switch-item-row">
            <span>启用</span>
            <input type="checkbox" checked={selected.enabled}
              onChange={(event) => commit({ enabled: event.target.checked })} />
          </label>
          <label className="professional-field">
            <span>不透明度 {selected.opacity}</span>
            <input type="range" min={0} max={100} value={selected.opacity}
              onChange={(event) => update({ ...selected, opacity: Number(event.target.value) })}
              onMouseUp={() => commitCurrent()} onTouchEnd={() => commitCurrent()} />
          </label>
          <label className="professional-field">
            <span>混合模式</span>
            <select value={selected.blend} onChange={(event) => commit({ blend: event.target.value as OverlayLayer["blend"] })}>
              {BLEND_MODES.map((mode) => (
                <option key={mode} value={mode}>{BLEND_MODE_LABELS[mode]}</option>
              ))}
            </select>
          </label>
          {selected.kind === "text" && (
            <>
              <label className="professional-field">
                <span>文字</span>
                <input type="text" value={selected.text} maxLength={200}
                  onChange={(event) => update({ ...selected, text: event.target.value })}
                  onBlur={() => commitCurrent()} />
              </label>
              <label className="professional-field">
                <span>字体</span>
                <select value={selected.font_family} onChange={(event) => commit({ font_family: event.target.value })}>
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>{font.label}</option>
                  ))}
                </select>
              </label>
              <label className="professional-field">
                <span>字号 {selected.font_size}</span>
                <input type="range" min={2} max={32} value={selected.font_size}
                  onChange={(event) => update({ ...selected, font_size: Number(event.target.value) })}
                  onMouseUp={() => commitCurrent()} />
              </label>
              <label className="professional-field">
                <span>字重 {selected.font_weight}</span>
                <input type="range" min={300} max={900} step={100} value={selected.font_weight}
                  onChange={(event) => update({ ...selected, font_weight: Number(event.target.value) })}
                  onMouseUp={() => commitCurrent()} />
              </label>
              <label className="switch-item-row">
                <span>斜体</span>
                <input type="checkbox" checked={selected.italic === 1}
                  onChange={(event) => commit({ italic: event.target.checked ? 1 : 0 })} />
              </label>
              <label className="professional-field">
                <span>颜色</span>
                <input type="color" value={selected.color} onChange={(event) => commit({ color: event.target.value })} />
              </label>
              <label className="professional-field">
                <span>对齐</span>
                <select value={selected.align} onChange={(event) => commit({ align: event.target.value as OverlayLayer["align"] })}>
                  <option value="left">左</option>
                  <option value="center">中</option>
                  <option value="right">右</option>
                </select>
              </label>
              <label className="professional-field">
                <span>旋转 {selected.rotation}°</span>
                <input type="range" min={-180} max={180} value={selected.rotation}
                  onChange={(event) => update({ ...selected, rotation: Number(event.target.value) })}
                  onMouseUp={() => commitCurrent()} />
              </label>
              <label className="professional-field">
                <span>字距 {selected.tracking}</span>
                <input type="range" min={-50} max={100} value={selected.tracking}
                  onChange={(event) => update({ ...selected, tracking: Number(event.target.value) })}
                  onMouseUp={() => commitCurrent()} />
              </label>
              <label className="professional-field">
                <span>弧形变形 {selected.warp}</span>
                <input type="range" min={-100} max={100} value={selected.warp}
                  onChange={(event) => update({ ...selected, warp: Number(event.target.value) })}
                  onMouseUp={() => commitCurrent()} />
              </label>
              <p className="professional-help-text">在画布上拖动可移动文字位置。</p>
            </>
          )}
          {selected.kind === "preset" && (
            <div className="id-photo-chip-row">
              {OVERLAY_PRESETS.map((preset) => (
                <button key={preset.id} type="button"
                  className={`id-photo-chip ${selected.preset_id === preset.id ? "active" : ""}`}
                  onClick={() => commit({ preset_id: preset.id })}>{preset.label}</button>
              ))}
            </div>
          )}
          {selected.kind === "gradient" && (
            <>
              <label className="professional-field">
                <span>类型</span>
                <select value={selected.gradient_type}
                  onChange={(event) => commit({ gradient_type: event.target.value as OverlayLayer["gradient_type"] })}>
                  <option value="linear">线性</option>
                  <option value="radial">径向</option>
                </select>
              </label>
              <label className="professional-field">
                <span>起点</span>
                <input type="color" value={selected.gradient_from}
                  onChange={(event) => commit({ gradient_from: event.target.value })} />
              </label>
              <label className="professional-field">
                <span>终点</span>
                <input type="color" value={selected.gradient_to}
                  onChange={(event) => commit({ gradient_to: event.target.value })} />
              </label>
              <label className="professional-field">
                <span>角度 {selected.gradient_angle}°</span>
                <input type="range" min={0} max={360} value={selected.gradient_angle}
                  onChange={(event) => update({ ...selected, gradient_angle: Number(event.target.value) })}
                  onMouseUp={() => commitCurrent()} />
              </label>
            </>
          )}
          {selected.kind === "duotone" && (
            <>
              <label className="professional-field">
                <span>阴影色</span>
                <input type="color" value={selected.duotone_shadow}
                  onChange={(event) => commit({ duotone_shadow: event.target.value })} />
              </label>
              <label className="professional-field">
                <span>高光色</span>
                <input type="color" value={selected.duotone_highlight}
                  onChange={(event) => commit({ duotone_highlight: event.target.value })} />
              </label>
            </>
          )}
          <section className="adjustment-group">
            <h4 className="group-header">蒙版擦除</h4>
            <label className="switch-item-row">
              <span>在画布上涂抹蒙版</span>
              <input type="checkbox" checked={editingMask}
                onChange={(event) => setEditingMask(event.target.checked)} />
            </label>
            <div className="overlay-add-row">
              <button type="button" className={`lut-import-btn ${maskTool === "erase" ? "active" : ""}`}
                onClick={() => setMaskTool("erase")}>擦除</button>
              <button type="button" className={`lut-import-btn ${maskTool === "paint" ? "active" : ""}`}
                onClick={() => setMaskTool("paint")}>恢复</button>
            </div>
            <label className="professional-field">
              <span>笔刷 {brushSize}</span>
              <input type="range" min={20} max={180} value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))} />
            </label>
            <button type="button" className="lut-import-btn"
              onClick={() => commit({ mask_points: [] })}>清除蒙版</button>
          </section>
          <button type="button" className="panel-clear-btn" onClick={() => remove(selected.id)}>删除图层</button>
        </>
      )}
    </div>
  );
}
