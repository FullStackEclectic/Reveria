import React, { useRef } from "react";
import { Aperture, ImagePlus, Palette, ScanLine, SquareDashed, Undo2 } from "lucide-react";
import type { BackgroundMode, RetouchSettings } from "./editorConstants";
import type { BackgroundTaskStatus } from "./useBackgroundRemoval";

interface Props {
  settings: RetouchSettings;
  taskStatus: BackgroundTaskStatus;
  errorMessage: string;
  isSubmitting: boolean;
  isUploading: boolean;
  onSubmit: () => void;
  onUpload: (file: File) => void;
  onChange: (changes: Partial<RetouchSettings>) => void;
  onCommit: (changes?: Partial<RetouchSettings>) => void;
  onClear: () => void;
}

const MODES: Array<{ id: BackgroundMode; label: string; icon: React.ElementType }> = [
  { id: "transparent", label: "透明", icon: SquareDashed },
  { id: "solid", label: "纯色", icon: Palette },
  { id: "blur", label: "虚化", icon: Aperture },
  { id: "image", label: "图片", icon: ImagePlus },
];

const STATUS_TEXT: Record<string, string> = {
  pending: "任务已提交，正在排队...",
  running: "AI 正在识别主体边缘...",
  succeeded: "透明前景已生成并保存",
  failed: "抠图失败",
  error: "抠图任务异常",
};

export function BackgroundPanel({
  settings, taskStatus, errorMessage, isSubmitting, isUploading,
  onSubmit, onUpload, onChange, onCommit, onClear,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const hasCutout = Boolean(settings.background_cutout_url);

  return (
    <div className="adjustment-subview background-panel">
      <div className="panel-title-large">抠图与背景</div>

      <button className="panel-submit-btn background-cutout-btn" disabled={isSubmitting} onClick={onSubmit}>
        <ScanLine size={15} />
        {isSubmitting ? "处理中..." : hasCutout ? "重新智能抠图" : "智能抠图"}
      </button>

      {(taskStatus || errorMessage) && (
        <div className={`panel-hint-text ${taskStatus === "succeeded" ? "hint-success" : errorMessage ? "hint-error" : ""}`}>
          {errorMessage || (taskStatus ? STATUS_TEXT[taskStatus] : "")}
        </div>
      )}

      <div className="background-mode-grid">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`liquify-tool-btn ${settings.background_mode === id ? "active" : ""}`}
            disabled={!hasCutout || (id === "image" && !settings.background_image_url)}
            onClick={() => onCommit({ background_mode: id })}
            title={label}
          >
            <Icon size={14} /><span>{label}</span>
          </button>
        ))}
      </div>

      {settings.background_mode === "solid" && (
        <label className="background-color-row">
          <span>背景颜色</span>
          <input
            type="color"
            value={settings.background_color}
            onChange={(event) => onChange({ background_color: event.target.value })}
            onBlur={() => onCommit()}
          />
        </label>
      )}

      {settings.background_mode === "blur" && (
        <div className="slider-item">
          <div className="slider-label"><span>虚化强度</span><span className="value">{settings.background_blur}</span></div>
          <input type="range" min={0} max={40} value={settings.background_blur}
            onChange={(event) => onChange({ background_blur: Number(event.target.value) })}
            onMouseUp={() => onCommit()} onTouchEnd={() => onCommit()} />
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) onUpload(file);
        event.target.value = "";
      }} />
      <button className="lut-import-btn" disabled={isUploading} onClick={() => fileRef.current?.click()}>
        <ImagePlus size={14} />{isUploading ? "上传中..." : settings.background_image_url ? "更换背景图片" : "上传背景图片"}
      </button>

      {settings.background_mode === "image" && settings.background_image_url && (
        <>
          <div className="slider-item">
            <div className="slider-label"><span>背景缩放</span><span className="value">{Math.round(settings.background_image_scale * 100)}%</span></div>
            <input type="range" min={50} max={300} value={settings.background_image_scale * 100}
              onChange={(event) => onChange({ background_image_scale: Number(event.target.value) / 100 })}
              onMouseUp={() => onCommit()} onTouchEnd={() => onCommit()} />
          </div>
          <div className="slider-item">
            <div className="slider-label"><span>水平位置</span><span className="value">{Math.round(settings.background_image_x * 100)}</span></div>
            <input type="range" min={-100} max={100} value={settings.background_image_x * 100}
              onChange={(event) => onChange({ background_image_x: Number(event.target.value) / 100 })}
              onMouseUp={() => onCommit()} onTouchEnd={() => onCommit()} />
          </div>
          <div className="slider-item">
            <div className="slider-label"><span>垂直位置</span><span className="value">{Math.round(settings.background_image_y * 100)}</span></div>
            <input type="range" min={-100} max={100} value={settings.background_image_y * 100}
              onChange={(event) => onChange({ background_image_y: Number(event.target.value) / 100 })}
              onMouseUp={() => onCommit()} onTouchEnd={() => onCommit()} />
          </div>
        </>
      )}

      <button className="panel-clear-btn" disabled={!hasCutout} onClick={onClear}>
        <Undo2 size={13} /> 恢复原背景
      </button>
    </div>
  );
}
