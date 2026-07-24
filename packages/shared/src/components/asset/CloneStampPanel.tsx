import React from "react";
import { Crosshair, RotateCcw } from "lucide-react";
import { MAX_CLONE_STAMPS } from "./editorConstants";

interface Props {
  brushSize: number;
  strength: number;
  stampCount: number;
  hasSource: boolean;
  samplingSource: boolean;
  onBrushSizeChange: (value: number) => void;
  onStrengthChange: (value: number) => void;
  onSample: () => void;
  onClear: () => void;
}

export function CloneStampPanel(props: Props) {
  return (
    <div className="adjustment-subview local-healing-panel">
      <div className="panel-title-large">仿制图章</div>
      <button type="button" className={`clone-sample-btn ${props.samplingSource ? "active" : ""}`} onClick={props.onSample}>
        <Crosshair size={14} />
        {props.samplingSource ? "等待取样" : props.hasSource ? "重新取样" : "设置取样点"}
      </button>
      <section className="adjustment-group clone-controls">
        <div className="slider-item">
          <div className="slider-label"><span>画笔大小</span><span className="value">{props.brushSize}px</span></div>
          <input type="range" min="8" max="120" value={props.brushSize} onChange={(event) => props.onBrushSizeChange(Number(event.target.value))} />
        </div>
        <div className="slider-item">
          <div className="slider-label"><span>不透明度</span><span className="value">{props.strength}</span></div>
          <input type="range" min="10" max="100" value={props.strength} onChange={(event) => props.onStrengthChange(Number(event.target.value))} />
        </div>
      </section>
      <div className="healing-spot-summary"><span>图章</span><span>{props.stampCount} / {MAX_CLONE_STAMPS}</span></div>
      <button type="button" className="healing-clear-btn" disabled={props.stampCount === 0} onClick={props.onClear}>
        <RotateCcw size={14} />清除全部图章
      </button>
    </div>
  );
}
