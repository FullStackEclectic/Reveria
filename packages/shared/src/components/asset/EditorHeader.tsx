import React from "react";
import { ArrowLeft, Download, Save } from "lucide-react";

export type ExportFormat = "jpeg" | "png" | "webp";

interface Props {
  title: string;
  hasAsset: boolean;
  isSaving: boolean;
  isExporting: boolean;
  exportFormat: ExportFormat;
  onClose: () => void;
  onSave: () => void;
  onExport: () => void;
  onExportFormatChange: (format: ExportFormat) => void;
}

/** 精修工作台顶部导航、保存与单图导出操作。 */
export function EditorHeader({
  title,
  hasAsset,
  isSaving,
  isExporting,
  exportFormat,
  onClose,
  onSave,
  onExport,
  onExportFormatChange,
}: Props) {
  return (
    <header className="editor-header">
      <div className="header-left-side">
        <button className="back-btn" onClick={onClose}>
          <ArrowLeft size={16} />
        </button>
        <div className="breadcrumb-path">
          <span className="proj-name">批量照片精修</span>
          <span className="separator">&gt;</span>
          <span className="file-name" title={title || "导入图片"}>{title || "未导入图片"}</span>
        </div>
      </div>

      <div className="header-center-tabs">
        <button className="center-tab active">图像精修</button>
        <button className="center-tab" disabled title="RAW 转片功能即将开放">RAW转片</button>
        <button className="center-tab" disabled title="批量导出功能即将开放">批量导出</button>
      </div>

      <div className="editor-action-area">
        <button className="btn-save" disabled={isSaving || !hasAsset} onClick={onSave}>
          <Save size={14} />
          {isSaving ? "同步中..." : "保存参数"}
        </button>
        <button className="btn-export" disabled={isExporting || !hasAsset} onClick={onExport}>
          <Download size={14} />
          {isExporting ? "导出中..." : "导出"}
        </button>
        <select
          className="export-format-select"
          value={exportFormat}
          onChange={(event) => onExportFormatChange(event.target.value as ExportFormat)}
          disabled={!hasAsset}
          aria-label="导出格式"
        >
          <option value="jpeg">JPEG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
        </select>
      </div>
    </header>
  );
}
