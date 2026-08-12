import React, { useEffect, useState } from "react";
import type { AssetSummary } from "../../types";
import { formatFileSize } from "../../utils";
import { parseExif, type ExifEntry } from "./retouch/exif";

interface Props {
  asset: AssetSummary;
  sourceUrl: string;
  preserveExif: boolean;
  onPreserveExifChange: (value: boolean) => void;
  onCommit: () => void;
}

export function ExifPanel({ asset, sourceUrl, preserveExif, onPreserveExifChange, onCommit }: Props) {
  const [entries, setEntries] = useState<ExifEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(sourceUrl)
      .then((response) => response.arrayBuffer())
      .then((buffer) => { if (!cancelled) setEntries(parseExif(buffer)); })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sourceUrl]);

  const basicEntries: ExifEntry[] = [
    asset.metadata.mime_type ? { label: "文件类型", value: asset.metadata.mime_type } : null,
    typeof asset.metadata.size === "number" ? { label: "文件大小", value: formatFileSize(asset.metadata.size) } : null,
  ].filter((entry): entry is ExifEntry => entry !== null);
  const visibleEntries = [...basicEntries, ...entries];

  return (
    <section className="adjustment-group exif-group">
      <h4 className="group-header">EXIF 与文件信息</h4>
      <div className="switch-item-row">
        <span>JPEG 导出保留 EXIF</span>
        <label className="switch-toggle">
          <input
            type="checkbox"
            aria-label="JPEG 导出保留 EXIF"
            checked={preserveExif}
            onChange={(event) => onPreserveExifChange(event.target.checked)}
            onBlur={onCommit}
          />
          <span className="switch-slider" />
        </label>
      </div>
      <p className="professional-help-text">EXIF 可能包含拍摄时间、相机信息和定位数据，公开发布前请按用途选择是否保留。</p>
      <div className="exif-list">
        {loading ? <span className="exif-empty">正在读取源文件</span> : visibleEntries.length > 0 ? visibleEntries.map((entry) => (
          <div key={`${entry.label}-${entry.value}`} className="exif-row">
            <span>{entry.label}</span><strong title={entry.value}>{entry.value}</strong>
          </div>
        )) : <span className="exif-empty">源文件未包含可读取的 EXIF</span>}
      </div>
    </section>
  );
}
