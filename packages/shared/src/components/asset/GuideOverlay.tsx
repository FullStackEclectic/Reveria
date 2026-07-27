import React from "react";

export type GuideKind = "none" | "thirds" | "golden" | "grid" | "diagonal" | "center";

export const GUIDE_OPTIONS: { id: GuideKind; label: string }[] = [
  { id: "none", label: "关闭" },
  { id: "thirds", label: "三分线" },
  { id: "golden", label: "黄金分割" },
  { id: "grid", label: "网格" },
  { id: "diagonal", label: "对角线" },
  { id: "center", label: "中心十字" },
];

/** 黄金分割比例位置 */
const PHI = 0.618;

function linePositions(kind: GuideKind): { vertical: number[]; horizontal: number[] } {
  switch (kind) {
    case "thirds":
      return { vertical: [1 / 3, 2 / 3], horizontal: [1 / 3, 2 / 3] };
    case "golden":
      return { vertical: [1 - PHI, PHI], horizontal: [1 - PHI, PHI] };
    case "grid":
      return {
        vertical: [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875],
        horizontal: [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875],
      };
    case "center":
      return { vertical: [0.5], horizontal: [0.5] };
    default:
      return { vertical: [], horizontal: [] };
  }
}

/**
 * 构图参考辅助线。纯视觉叠加，不参与渲染管线，也不写入 RetouchSettings，
 * 因此不会影响导出结果。
 */
export function GuideOverlay({ kind }: { kind: GuideKind }) {
  if (kind === "none") return null;
  const { vertical, horizontal } = linePositions(kind);

  return (
    <svg className="guide-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {vertical.map((position) => (
        <line key={`v-${position}`} x1={position * 100} y1="0" x2={position * 100} y2="100" />
      ))}
      {horizontal.map((position) => (
        <line key={`h-${position}`} x1="0" y1={position * 100} x2="100" y2={position * 100} />
      ))}
      {kind === "diagonal" && (
        <>
          <line x1="0" y1="0" x2="100" y2="100" />
          <line x1="100" y1="0" x2="0" y2="100" />
        </>
      )}
    </svg>
  );
}
