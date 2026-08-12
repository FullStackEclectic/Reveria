import React from "react";
import type { ImageHistogram } from "./retouch/histogram";

interface Props {
  histogram: ImageHistogram | null;
}

function channelPoints(values: number[]): string {
  const last = Math.max(1, values.length - 1);
  return `0,72 ${values.map((value, index) => `${(index / last) * 240},${72 - value * 68}`).join(" ")} 240,72`;
}

export function HistogramPanel({ histogram }: Props) {
  return (
    <section className="adjustment-group professional-histogram-group">
      <h4 className="group-header">实时直方图</h4>
      <div className="histogram-chart" aria-label="当前成片 RGB 直方图">
        {histogram ? (
          <svg viewBox="0 0 240 72" preserveAspectRatio="none">
            <polygon points={channelPoints(histogram.red)} className="histogram-red" />
            <polygon points={channelPoints(histogram.green)} className="histogram-green" />
            <polygon points={channelPoints(histogram.blue)} className="histogram-blue" />
            <polyline points={channelPoints(histogram.luminance)} className="histogram-luminance" />
          </svg>
        ) : <span>正在分析当前成片</span>}
      </div>
      <div className="histogram-axis"><span>阴影</span><span>中间调</span><span>高光</span></div>
    </section>
  );
}
