import React, { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { AssetSummary } from "../../types";
import { SliderItem } from "./SliderItem";
import { ExifPanel } from "./ExifPanel";
import { HistogramPanel } from "./HistogramPanel";
import type { RetouchSettings, WatermarkPosition } from "./editorConstants";
import { suggestBorderColor, type ImageHistogram } from "./retouch/histogram";
import { encodeWatermarkImageFile } from "./retouch/outputDecorations";
import "./ProfessionalAdjustments.css";

interface Props {
  asset: AssetSummary;
  sourceUrl: string;
  settings: RetouchSettings;
  histogram: ImageHistogram | null;
  onChange: (key: keyof RetouchSettings, value: number | string) => void;
  onPatch: (changes: Partial<RetouchSettings>) => void;
  onCommit: () => void;
  onExportLut?: () => void;
}

function SwitchRow({ label, checked, onChange, onCommit }: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onCommit: () => void;
}) {
  return (
    <div className="switch-item-row">
      <span>{label}</span>
      <label className="switch-toggle">
        <input type="checkbox" aria-label={label} checked={checked}
          onChange={(event) => onChange(event.target.checked)} onBlur={onCommit} />
        <span className="switch-slider" />
      </label>
    </div>
  );
}

export function ProfessionalAdjustments({
  asset, sourceUrl, settings, histogram, onChange, onPatch, onCommit, onExportLut,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const [watermarkError, setWatermarkError] = useState("");

  const slider = (key: keyof RetouchSettings, label: string, min: number, max: number) => (
    <SliderItem
      label={label}
      value={settings[key] as number}
      min={min}
      max={max}
      onChange={(value) => onChange(key, value)}
      onAutoSave={onCommit}
    />
  );

  const handleWatermarkFile = async (file: File) => {
    setUploadingWatermark(true);
    setWatermarkError("");
    try {
      const dataUrl = await encodeWatermarkImageFile(file);
      onPatch({ watermark_image_url: dataUrl, watermark_enabled: 1 });
    } catch (error) {
      setWatermarkError(error instanceof Error ? error.message : "水印图片读取失败");
    } finally {
      setUploadingWatermark(false);
    }
  };

  return (
    <div className="adjustment-subview professional-adjustments">
      <div className="panel-title-large">专业成片</div>
      <HistogramPanel histogram={histogram} />

      <section className="adjustment-group">
        <h4 className="group-header">镜头校正</h4>
        {slider("lens_distortion", "畸变校正", -100, 100)}
        {slider("fringing_amount", "色散", -100, 100)}
        {slider("perspective_horizontal", "水平透视", -100, 100)}
        {slider("perspective_vertical", "垂直透视", -100, 100)}
        <p className="professional-help-text">畸变：向左校正桶形，向右校正枕形。色散：向左偏蓝，向右偏红。透视：校正左右或上下汇聚线。</p>
      </section>

      <section className="adjustment-group">
        <h4 className="group-header">暗角</h4>
        {slider("vignette_amount", "暗角数量", -100, 100)}
        {slider("vignette_highlights", "高光", 0, 100)}
        {slider("vignette_midpoint", "中点", 0, 100)}
        {slider("vignette_feather", "羽化", 0, 100)}
        {slider("vignette_roundness", "圆度", -100, 100)}
      </section>

      <section className="adjustment-group">
        <h4 className="group-header">胶片颗粒</h4>
        {slider("grain_amount", "颗粒数量", 0, 100)}
        {slider("grain_highlights", "高光", 0, 100)}
        {slider("grain_size", "大小", 1, 100)}
        {slider("grain_roughness", "粗糙度", 0, 100)}
      </section>

      <section className="adjustment-group output-decoration-group">
        <h4 className="group-header">水印</h4>
        <SwitchRow label="启用水印" checked={Boolean(settings.watermark_enabled)}
          onChange={(checked) => onChange("watermark_enabled", checked ? 1 : 0)} onCommit={onCommit} />
        {settings.watermark_enabled > 0 && (
          <>
            <label className="professional-field">
              <span>水印文字</span>
              <input type="text" maxLength={120} value={settings.watermark_text}
                onChange={(event) => onChange("watermark_text", event.target.value)} onBlur={onCommit}
                placeholder="输入品牌名或版权信息" />
            </label>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleWatermarkFile(file);
                event.target.value = "";
              }} />
            <button type="button" className="lut-import-btn" disabled={uploadingWatermark}
              onClick={() => fileRef.current?.click()}>
              <ImagePlus size={14} />
              {uploadingWatermark ? "读取中..." : settings.watermark_image_url ? "更换水印图片" : "上传水印图片"}
            </button>
            {settings.watermark_image_url && (
              <button type="button" className="panel-clear-btn"
                onClick={() => onPatch({ watermark_image_url: "" })}>
                移除图片水印
              </button>
            )}
            {watermarkError && <p className="professional-help-text">{watermarkError}</p>}
            <label className="professional-field">
              <span>位置</span>
              <select value={settings.watermark_position}
                onChange={(event) => onChange("watermark_position", event.target.value as WatermarkPosition)}
                onBlur={onCommit}>
                <option value="top-left">左上</option><option value="top-right">右上</option>
                <option value="bottom-left">左下</option><option value="bottom-right">右下</option>
                <option value="center">居中</option>
              </select>
            </label>
            {slider("watermark_opacity", "不透明度", 0, 100)}
            {slider("watermark_size", "大小", 1, 15)}
            <label className="professional-color-field">
              <span>文字颜色</span>
              <input type="color" value={settings.watermark_color}
                onChange={(event) => onChange("watermark_color", event.target.value)} onBlur={onCommit} />
            </label>
          </>
        )}
      </section>

      <section className="adjustment-group output-decoration-group">
        <h4 className="group-header">边框</h4>
        <SwitchRow label="启用内嵌边框" checked={Boolean(settings.border_enabled)}
          onChange={(checked) => onChange("border_enabled", checked ? 1 : 0)} onCommit={onCommit} />
        {settings.border_enabled > 0 && (
          <>
            {slider("border_size", "宽度", 0, 20)}
            {slider("border_radius", "圆角", 0, 50)}
            <label className="professional-color-field">
              <span>边框颜色</span>
              <input type="color" value={settings.border_color}
                onChange={(event) => onChange("border_color", event.target.value)} onBlur={onCommit} />
            </label>
            <button type="button" className="lut-import-btn" disabled={!histogram}
              onClick={() => histogram && onPatch({ border_color: suggestBorderColor(histogram) })}>
              智能自动配色
            </button>
            <p className="professional-help-text">根据当前成片直方图估算画框色，亮图压暗、暗图略提亮，并保留画面色相。</p>
          </>
        )}
      </section>

      {onExportLut && (
        <section className="adjustment-group">
          <h4 className="group-header">导出 LUT</h4>
          <p className="professional-help-text">将当前调色参数导出为标准 .cube 文件，可在 Premiere、DaVinci Resolve 等软件中使用。</p>
          <button type="button" className="lut-import-btn" onClick={onExportLut}>导出 .cube 文件</button>
        </section>
      )}

      <ExifPanel
        asset={asset}
        sourceUrl={sourceUrl}
        preserveExif={Boolean(settings.preserve_exif)}
        onPreserveExifChange={(checked) => onChange("preserve_exif", checked ? 1 : 0)}
        onCommit={onCommit}
      />
    </div>
  );
}
