import React, { useId, useRef, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import type { LutEntry } from "./useLutLibrary";

interface Props {
  entries: LutEntry[];
  activeId: string;
  intensity: number;
  onSelect: (id: string) => void;
  onIntensityChange: (value: number) => void;
  onCommit: () => void;
  onImport: (file: File) => Promise<void>;
  onDelete: (id: string) => void;
}

/**
 * 3D LUT 面板：内置 LUT 由公式生成，用户可导入标准 .cube 文件。
 * 选中的 LUT 会通过 `settings.lut_file` 保存，并在渲染管线末端按强度叠加。
 */
export function LutPanel({
  entries, activeId, intensity, onSelect, onIntensityChange, onCommit, onImport, onDelete,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      await onImport(file);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "导入失败");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="lut-panel">
      <div className="lut-cards-grid">
        <button
          className={`lut-card-btn ${activeId === "" ? "active" : ""}`}
          onClick={() => { onSelect(""); onCommit(); }}
        >
          无滤镜
        </button>
        {entries.map((entry) => (
          <div key={entry.id} className="lut-card-wrapper">
            <button
              className={`lut-card-btn ${activeId === entry.id ? "active" : ""}`}
              onClick={() => { onSelect(entry.id); onCommit(); }}
              title={entry.builtin ? "内置 LUT" : "导入的 LUT"}
            >
              {entry.name}
            </button>
            {!entry.builtin && (
              <button
                className="lut-delete-btn"
                title="删除该 LUT"
                onClick={() => {
                  if (activeId === entry.id) { onSelect(""); onCommit(); }
                  onDelete(entry.id);
                }}
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
      </div>

      {activeId !== "" && (
        <div className="slider-item">
          <div className="slider-label">
            <span>LUT 强度</span>
            <span className="value">{Math.round(intensity)}</span>
          </div>
          <input
            type="range" min={0} max={100} value={intensity}
            onChange={(event) => onIntensityChange(Number(event.target.value))}
            onMouseUp={onCommit}
            onTouchEnd={onCommit}
          />
        </div>
      )}

      <label htmlFor={inputId} className="lut-import-btn">
        <Upload size={12} />
        <span>{importing ? "导入中..." : "导入 .cube 文件"}</span>
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".cube"
        style={{ display: "none" }}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      {error && <div className="lut-import-error">{error}</div>}
    </div>
  );
}
