import React from "react";
import type { AssetSummary } from "../../types";
import { SliderItem } from "./SliderItem";
import { ExifPanel } from "./ExifPanel";
import { HistogramPanel } from "./HistogramPanel";
import type { RetouchSettings, WatermarkPosition } from "./editorConstants";
import type { ImageHistogram } from "./retouch/histogram";
import "./ProfessionalAdjustments.css";

interface Props {
  asset: AssetSummary;
  sourceUrl: string;
  settings: RetouchSettings;
  histogram: ImageHistogram | null;
  onChange: (key: keyof RetouchSettings, value: number | string) => void;
  onCommit: () => void;
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

export function ProfessionalAdjustments({ asset, sourceUrl, settings, histogram, onChange, onCommit }: Props) {
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

  return (
    <div className="adjustment-subview professional-adjustments">
      <div className="panel-title-large">专业成片</div>
      <HistogramPanel histogram={histogram} />

      <section className="adjustment-group">
        <h4 className="group-header">镜头校正</h4>
        {slider("lens_distortion", "畸变校正", -100, 100)}
        <p className="professional-help-text">向左校正桶形畸变，向右校正枕形畸变。</p>
      </section>

      <section className="adjustment-group">
        <h4 className="group-header">暗角</h4>
        {slider("vignette_amount", "暗角数量", -100, 100)}
        {slider("vignette_midpoint", "中点", 0, 100)}
        {slider("vignette_feather", "羽化", 0, 100)}
        {slider("vignette_roundness", "圆度", -100, 100)}
      </section>

      <section className="adjustment-group">
        <h4 className="group-header">胶片颗粒</h4>
        {slider("grain_amount", "颗粒数量", 0, 100)}
        {slider("grain_size", "大小", 1, 100)}
        {slider("grain_roughness", "粗糙度", 0, 100)}
      </section>

      <section className="adjustment-group output-decoration-group">
        <h4 className="group-header">水印</h4>
        <SwitchRow label="启用文字水印" checked={Boolean(settings.watermark_enabled)}
          onChange={(checked) => onChange("watermark_enabled", checked ? 1 : 0)} onCommit={onCommit} />
        {settings.watermark_enabled > 0 && (
          <>
            <label className="professional-field">
              <span>水印文字</span>
              <input type="text" maxLength={120} value={settings.watermark_text}
                onChange={(event) => onChange("watermark_text", event.target.value)} onBlur={onCommit}
                placeholder="输入品牌名或版权信息" />
            </label>
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
            {slider("watermark_size", "字号", 1, 15)}
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
          </>
        )}
      </section>

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
