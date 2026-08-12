import React from "react";
import type { ExportFormat } from "./EditorHeader";
import type { BatchSettingsMode } from "./retouch/batchExport";
import { DEFAULT_BATCH_NAME_PATTERN } from "./retouch/batchExport";

interface Props {
  selectedCount: number;
  totalCount: number;
  format: ExportFormat;
  maxEdge: number;
  namePattern: string;
  settingsMode: BatchSettingsMode;
  syncBeforeExport: boolean;
  running: boolean;
  progressLabel: string;
  onFormatChange: (format: ExportFormat) => void;
  onMaxEdgeChange: (value: number) => void;
  onNamePatternChange: (value: string) => void;
  onSettingsModeChange: (mode: BatchSettingsMode) => void;
  onSyncBeforeExportChange: (value: boolean) => void;
  onApplyCurrent: () => void;
  onExport: () => void;
}

const SIZE_OPTIONS = [
  { value: 0, label: "原尺寸" },
  { value: 2048, label: "长边 2048" },
  { value: 1920, label: "长边 1920" },
  { value: 1080, label: "长边 1080" },
];

export function BatchExportPanel({
  selectedCount, totalCount, format, maxEdge, namePattern, settingsMode, syncBeforeExport,
  running, progressLabel, onFormatChange, onMaxEdgeChange, onNamePatternChange,
  onSettingsModeChange, onSyncBeforeExportChange, onApplyCurrent, onExport,
}: Props) {
  return (
    <div className="adjustment-subview batch-tools-panel">
      <div className="panel-title-large">批量处理</div>
      <p className="professional-help-text">
        在胶片栏勾选图片。当前已选 {selectedCount} / {totalCount} 张。
      </p>

      <section className="adjustment-group">
        <h4 className="group-header">统一风格</h4>
        <p className="professional-help-text">把当前精修参数同步到勾选图片，用于统一磨皮、调色和美型。</p>
        <button type="button" className="lut-import-btn" disabled={selectedCount === 0 || running} onClick={onApplyCurrent}>
          同步当前参数到已选图片
        </button>
      </section>

      <section className="adjustment-group">
        <h4 className="group-header">批量导出</h4>
        <label className="professional-field">
          <span>参数来源</span>
          <select value={settingsMode} disabled={running} onChange={(event) => onSettingsModeChange(event.target.value as BatchSettingsMode)}>
            <option value="current">当前图片参数</option>
            <option value="saved">各图已保存参数</option>
          </select>
        </label>
        <label className="professional-field">
          <span>格式</span>
          <select value={format} disabled={running} onChange={(event) => onFormatChange(event.target.value as ExportFormat)}>
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </label>
        <label className="professional-field">
          <span>尺寸</span>
          <select value={maxEdge} disabled={running} onChange={(event) => onMaxEdgeChange(Number(event.target.value))}>
            {SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="professional-field">
          <span>文件名</span>
          <input
            type="text"
            value={namePattern}
            disabled={running}
            placeholder={DEFAULT_BATCH_NAME_PATTERN}
            onChange={(event) => onNamePatternChange(event.target.value)}
          />
        </label>
        <p className="professional-help-text">可用变量：{"{name}"} 原文件名、{"{index}"} 序号、{"{total}"} 总数。</p>
        <label className="switch-item-row">
          <span>导出前先同步当前参数</span>
          <input type="checkbox" checked={syncBeforeExport} disabled={running}
            onChange={(event) => onSyncBeforeExportChange(event.target.checked)} />
        </label>
        <button type="button" className="panel-submit-btn" disabled={selectedCount === 0 || running} onClick={onExport}>
          {running ? progressLabel : `导出已选 ${selectedCount} 张`}
        </button>
      </section>
    </div>
  );
}
