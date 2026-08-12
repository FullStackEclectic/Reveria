import React, { useEffect, useState } from "react";
import { ID_PHOTO_COLORS, ID_PHOTO_SPECS, type IdPhotoColor, type IdPhotoSpec } from "./retouch/idPhoto";

interface Props {
  hasCutout: boolean;
  applying: boolean;
  onApply: (spec: IdPhotoSpec, color: IdPhotoColor) => void;
  onRequestCutout: () => void;
}

export function IdPhotoPanel({ hasCutout, applying, onApply, onRequestCutout }: Props) {
  const [specId, setSpecId] = useState(ID_PHOTO_SPECS[0].id);
  const [colorId, setColorId] = useState(ID_PHOTO_COLORS[0].id);
  const spec = ID_PHOTO_SPECS.find((item) => item.id === specId) ?? ID_PHOTO_SPECS[0];
  const color = ID_PHOTO_COLORS.find((item) => item.id === colorId) ?? ID_PHOTO_COLORS[0];

  useEffect(() => {
    if (!ID_PHOTO_SPECS.some((item) => item.id === specId)) setSpecId(ID_PHOTO_SPECS[0].id);
  }, [specId]);

  return (
    <div className="adjustment-subview batch-tools-panel">
      <div className="panel-title-large">证件照</div>
      <p className="professional-help-text">
        按标准尺寸居中裁切，并换成白 / 蓝 / 红底。导出时按 300 DPI 像素输出。
      </p>
      {!hasCutout && (
        <p className="professional-help-text">尚未抠图。建议先提取透明前景，换底色才会只作用于背景。</p>
      )}
      <section className="adjustment-group">
        <h4 className="group-header">规格</h4>
        <div className="id-photo-chip-row">
          {ID_PHOTO_SPECS.map((item) => (
            <button key={item.id} type="button"
              className={`id-photo-chip ${specId === item.id ? "active" : ""}`}
              onClick={() => setSpecId(item.id)}>
              {item.label}
              <span>{item.widthMm}×{item.heightMm}mm</span>
            </button>
          ))}
        </div>
      </section>
      <section className="adjustment-group">
        <h4 className="group-header">底色</h4>
        <div className="id-photo-chip-row">
          {ID_PHOTO_COLORS.map((item) => (
            <button key={item.id} type="button"
              className={`id-photo-chip ${colorId === item.id ? "active" : ""}`}
              onClick={() => setColorId(item.id)}>
              <i className="id-photo-swatch" style={{ background: item.color }} />
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <button type="button" className="lut-import-btn" onClick={onRequestCutout} disabled={applying}>
        {hasCutout ? "重新抠图" : "先智能抠图"}
      </button>
      <button type="button" className="panel-submit-btn" disabled={applying} onClick={() => onApply(spec, color)}>
        应用证件照规格
      </button>
    </div>
  );
}
