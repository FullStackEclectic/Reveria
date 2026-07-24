import React from "react";
import { CheckSquare, Eraser, Eye, Move, RotateCcw, Sliders, Sparkles, Wand2 } from "lucide-react";
import { GeometryToolButtons } from "./GeometryToolButtons";
import { CropRect } from "./CropOverlay";
import { RetouchSettings } from "./editorConstants";

interface Props {
  hasAsset: boolean;
  zoomPercent: number;
  setZoomPercent: React.Dispatch<React.SetStateAction<number>>;
  settings: RetouchSettings;
  cropDraft: CropRect | null;
  setCropDraft: React.Dispatch<React.SetStateAction<CropRect | null>>;
  activeCanvasTool: "move" | "healing" | "clone";
  setActiveCanvasTool: (tool: "move" | "healing" | "clone") => void;
  cloneSource: { x: number; y: number } | null;
  setCloneSampling: (sampling: boolean) => void;
  setActiveTab: (tab: "portrait" | "color" | "local" | "other") => void;
  onRotate: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showOriginal: boolean;
  setShowOriginal: (show: boolean) => void;
  onReset: () => void;
}

export function CanvasToolbar({
  hasAsset, zoomPercent, setZoomPercent, settings, cropDraft, setCropDraft,
  activeCanvasTool, setActiveCanvasTool, cloneSource, setCloneSampling, setActiveTab,
  onRotate, onFlipHorizontal, onFlipVertical, canUndo, canRedo, onUndo, onRedo,
  showOriginal, setShowOriginal, onReset,
}: Props) {
  const selectHealing = () => { setCropDraft(null); setActiveCanvasTool("healing"); setActiveTab("local"); };
  const selectClone = () => {
    setCropDraft(null); setActiveCanvasTool("clone"); setActiveTab("local");
    if (!cloneSource) setCloneSampling(true);
  };
  return (
    <div className="retouch-canvas-toolbar">
      <div className="tool-dropdown-group">
        <span className="zoom-text">{zoomPercent}%</span>
        <button className="utility-btn" disabled={!hasAsset} onClick={() => setZoomPercent((value) => Math.max(50, value - 10))}>-</button>
        <button className="utility-btn" disabled={!hasAsset} onClick={() => setZoomPercent((value) => Math.min(300, value + 10))}>+</button>
      </div>
      <div className="tool-divider" />
      <div className="photo-edit-tools">
        <button className={`tool-icon-btn ${activeCanvasTool === "move" ? "active" : ""}`} disabled={!hasAsset} onClick={() => setActiveCanvasTool("move")} title="移动工具 (M)"><Move size={15} /></button>
        <GeometryToolButtons disabled={!hasAsset} cropping={cropDraft !== null} onToggleCrop={() => setCropDraft(cropDraft ? null : { x: settings.crop_x, y: settings.crop_y, width: settings.crop_width, height: settings.crop_height })} onRotate={onRotate} onFlipHorizontal={onFlipHorizontal} onFlipVertical={onFlipVertical} />
        <button className={`tool-icon-btn ${activeCanvasTool === "healing" ? "active" : ""}`} disabled={!hasAsset} title="污点修复画笔 (J)" onClick={selectHealing}><Wand2 size={15} /></button>
        <button className="tool-icon-btn" disabled={!hasAsset} title="参考辅助线 (U)"><Sliders size={15} /></button>
        <button className="tool-icon-btn" disabled={!hasAsset} title="高精液化 (W)"><Sparkles size={15} /></button>
        <button className={`tool-icon-btn ${activeCanvasTool === "clone" ? "active" : ""}`} disabled={!hasAsset} title="仿制图章 (S)" onClick={selectClone}><CheckSquare size={15} /></button>
        <button className="tool-icon-btn" disabled={!hasAsset} title="智能消除 (E)"><Eraser size={15} /></button>
      </div>
      <div className="tool-divider" />
      <div className="toolbar-right-actions">
        <button className="undo-btn" disabled={!canUndo} onClick={onUndo} title="撤销 (Ctrl+Z)"><RotateCcw size={13} style={{ transform: "scaleX(-1)" }} /></button>
        <button className="redo-btn" disabled={!canRedo} onClick={onRedo} title="重做 (Ctrl+Shift+Z / Ctrl+Y)"><RotateCcw size={13} /></button>
        <button className={`compare-btn ${showOriginal ? "active" : ""}`} disabled={!hasAsset} onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onMouseLeave={() => setShowOriginal(false)} title="按住临时查看修改前原图"><Eye size={15} /><span>对比原图</span></button>
        <button className="reset-btn" disabled={!hasAsset} onClick={onReset} title="恢复所有调节项至零位"><RotateCcw size={13} /><span>重置效果</span></button>
      </div>
    </div>
  );
}
