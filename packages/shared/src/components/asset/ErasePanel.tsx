import React from "react";
import { Eraser, RotateCcw } from "lucide-react";
import type { EraseMode } from "./EraseOverlay";

export type EraseIntent = "erase" | "watermark";

interface Props {
  mode: EraseMode;
  brushSize: number;
  maskCount: number;
  intent: EraseIntent;
  onModeChange: (mode: EraseMode) => void;
  onBrushSizeChange: (size: number) => void;
  onIntentChange: (intent: EraseIntent) => void;
  onClear: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  taskStatus?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  preparing: "正在生成遮罩...",
  pending:   "任务已提交，排队中...",
  running:   "AI 正在处理...",
  succeeded: "消除成功！新图片已添加到素材库",
  failed:    "消除失败，请重试",
  error:     "提交失败，请检查网络后重试",
};

export function ErasePanel({
  mode, brushSize, maskCount, intent,
  onModeChange, onBrushSizeChange, onIntentChange, onClear,
  onSubmit, isSubmitting = false, taskStatus,
}: Props) {
  const statusLabel = taskStatus ? STATUS_LABEL[taskStatus] ?? taskStatus : null;
  const isSuccess = taskStatus === "succeeded";
  const isError = taskStatus === "failed" || taskStatus === "error";

  return (
    <div className="adjustment-subview">
      <div className="panel-title-large">AI 修复</div>

      <div className="liquify-tool-row">
        <button
          className={`liquify-tool-btn ${intent === "erase" ? "active" : ""}`}
          onClick={() => onIntentChange("erase")}
          title="涂抹需要消除的对象"
        >
          <Eraser size={14} />
          <span>智能消除</span>
        </button>
        <button
          className={`liquify-tool-btn ${intent === "watermark" ? "active" : ""}`}
          onClick={() => onIntentChange("watermark")}
          title="涂抹需要去除的水印"
        >
          <RotateCcw size={14} />
          <span>去水印</span>
        </button>
      </div>

      <div className="liquify-tool-row" style={{ marginTop: 8 }}>
        <button
          className={`liquify-tool-btn ${mode === "mark" ? "active" : ""}`}
          onClick={() => onModeChange("mark")}
          title="涂抹需要处理的区域"
        >
          <Eraser size={14} />
          <span>涂抹</span>
        </button>
        <button
          className={`liquify-tool-btn ${mode === "restore" ? "active" : ""}`}
          onClick={() => onModeChange("restore")}
          title="擦除已标记的区域"
        >
          <RotateCcw size={14} />
          <span>还原</span>
        </button>
      </div>

      <div className="slider-item">
        <div className="slider-label">
          <span>笔刷大小</span>
          <span className="value">{brushSize}</span>
        </div>
        <input
          type="range" min={12} max={180} value={brushSize}
          onChange={(event) => onBrushSizeChange(Number(event.target.value))}
        />
      </div>

      {statusLabel ? (
        <div className={`panel-hint-text ${isSuccess ? "hint-success" : isError ? "hint-error" : ""}`}>
          {statusLabel}
        </div>
      ) : (
        <div className="panel-hint-text">
          已标记 {maskCount} 个区域。涂抹完成后点击提交，由 AI {intent === "watermark" ? "去除水印" : "自动填充内容"}。
        </div>
      )}

      <button
        className="panel-clear-btn"
        disabled={maskCount === 0 || isSubmitting}
        onClick={onClear}
      >
        清除全部标记
      </button>

      <button
        className="panel-submit-btn"
        disabled={maskCount === 0 || isSubmitting}
        title={maskCount === 0 ? (intent === "watermark" ? "请先涂抹需要去除的水印" : "请先涂抹需要消除的区域") : undefined}
        onClick={onSubmit}
      >
        {isSubmitting ? "处理中..." : (intent === "watermark" ? "提交去水印" : "提交 AI 消除")}
      </button>
    </div>
  );
}
