import React from "react";
import { RotateCcw } from "lucide-react";
import { MAX_HEALING_SPOTS } from "./editorConstants";

interface Props {
  brushSize: number;
  strength: number;
  spotCount: number;
  onBrushSizeChange: (value: number) => void;
  onStrengthChange: (value: number) => void;
  onClear: () => void;
}

export function LocalHealingPanel({ brushSize, strength, spotCount, onBrushSizeChange, onStrengthChange, onClear }: Props) {
  return (
    <div className="adjustment-subview local-healing-panel">
      <div className="panel-title-large">污点修复</div>
      <section className="adjustment-group">
        <div className="slider-item">
          <div className="slider-label"><span>画笔大小</span><span className="value">{brushSize}px</span></div>
          <input type="range" min="8" max="120" value={brushSize} onChange={(event) => onBrushSizeChange(Number(event.target.value))} />
        </div>
        <div className="slider-item">
          <div className="slider-label"><span>修复强度</span><span className="value">{strength}</span></div>
          <input type="range" min="10" max="100" value={strength} onChange={(event) => onStrengthChange(Number(event.target.value))} />
        </div>
      </section>
      <div className="healing-spot-summary">
        <span>修复点</span>
        <span>{spotCount} / {MAX_HEALING_SPOTS}</span>
      </div>
      <button type="button" className="healing-clear-btn" disabled={spotCount === 0} onClick={onClear}>
        <RotateCcw size={14} />
        清除全部修复点
      </button>
    </div>
  );
}
