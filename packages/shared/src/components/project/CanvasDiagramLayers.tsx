import React from "react";
import { CanvasConnection, CanvasItem } from "../../types";

interface CanvasDiagramLayersProps {
  items: CanvasItem[];
  connections: CanvasConnection[];
  guides: { type: "v" | "h"; value: number }[];
  zoom: number;
}

/** 连线的贝塞尔控制点最多向外偏移 100，留一倍余量避免曲线被裁掉。 */
const CONNECTION_PADDING = 200;
/** 对齐辅助线需要在视觉上贯穿整个视口，向元素包围盒外延伸这么多画布单位。 */
const GUIDE_OVERHANG = 8000;

function getConnectionPoints(from: CanvasItem, to: CanvasItem) {
  const fromCx = from.x + from.w / 2;
  const fromCy = from.y + from.h / 2;
  const toCx = to.x + to.w / 2;
  const toCy = to.y + to.h / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  let x1 = fromCx;
  let y1 = fromCy;
  let x2 = toCx;
  let y2 = toCy;

  if (Math.abs(dx) > Math.abs(dy)) {
    x1 = dx > 0 ? from.x + from.w : from.x;
    x2 = dx > 0 ? to.x : to.x + to.w;
  } else {
    y1 = dy > 0 ? from.y + from.h : from.y;
    y2 = dy > 0 ? to.y : to.y + to.h;
  }
  return { x1, y1, x2, y2, dx };
}

/**
 * 计算元素集合在画布坐标系下的包围盒。
 * 覆盖层必须跟着包围盒走，否则负坐标或超远坐标上的元素会落在覆盖层之外而不渲染。
 */
function getItemsExtent(items: CanvasItem[]) {
  if (items.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const item of items) {
    if (item.x < minX) minX = item.x;
    if (item.y < minY) minY = item.y;
    if (item.x + item.w > maxX) maxX = item.x + item.w;
    if (item.y + item.h > maxY) maxY = item.y + item.h;
  }
  return { minX, minY, maxX, maxY };
}

export function CanvasDiagramLayers({ items, connections, guides, zoom }: CanvasDiagramLayersProps) {
  const extent = getItemsExtent(items);

  const connectionLeft = extent.minX - CONNECTION_PADDING;
  const connectionTop = extent.minY - CONNECTION_PADDING;
  const connectionWidth = Math.max(1, extent.maxX - extent.minX + CONNECTION_PADDING * 2);
  const connectionHeight = Math.max(1, extent.maxY - extent.minY + CONNECTION_PADDING * 2);

  const guideXs = guides.filter((guide) => guide.type === "v").map((guide) => guide.value);
  const guideYs = guides.filter((guide) => guide.type === "h").map((guide) => guide.value);
  const guideLeft = Math.min(extent.minX, ...guideXs) - GUIDE_OVERHANG;
  const guideTop = Math.min(extent.minY, ...guideYs) - GUIDE_OVERHANG;
  const guideWidth = Math.max(1, Math.max(extent.maxX, ...guideXs) + GUIDE_OVERHANG - guideLeft);
  const guideHeight = Math.max(1, Math.max(extent.maxY, ...guideYs) + GUIDE_OVERHANG - guideTop);

  return (
    <>
      {connections.length > 0 ? (
        <svg
          className="canvas-connections-svg"
          viewBox={`${connectionLeft} ${connectionTop} ${connectionWidth} ${connectionHeight}`}
          style={{
            position: "absolute",
            left: `${connectionLeft}px`,
            top: `${connectionTop}px`,
            width: `${connectionWidth}px`,
            height: `${connectionHeight}px`,
            pointerEvents: "none",
            zIndex: 1,
            overflow: "visible",
          }}
        >
          <defs>
            <marker id="arrow-marker" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="rgba(15, 118, 110, 0.45)" />
            </marker>
          </defs>
          {connections.map((connection) => {
            const from = items.find((item) => item.id === connection.fromItemId);
            const to = items.find((item) => item.id === connection.toItemId);
            if (!from || !to) return null;
            const { x1, y1, x2, y2, dx } = getConnectionPoints(from, to);
            const distance = Math.min(100, Math.abs(dx) * 0.4);
            const direction = dx > 0 ? distance : -distance;
            const path = `M ${x1} ${y1} C ${x1 + direction} ${y1}, ${x2 - direction} ${y2}, ${x2} ${y2}`;
            return (
              <path
                key={connection.id}
                d={path}
                stroke={connection.color || "rgba(15, 118, 110, 0.45)"}
                strokeWidth="2.5"
                fill="none"
                markerEnd="url(#arrow-marker)"
                strokeDasharray="4 4"
              />
            );
          })}
        </svg>
      ) : null}

      {guides.length > 0 ? (
        <svg
          className="canvas-guides-svg"
          viewBox={`${guideLeft} ${guideTop} ${guideWidth} ${guideHeight}`}
          style={{
            position: "absolute",
            left: `${guideLeft}px`,
            top: `${guideTop}px`,
            width: `${guideWidth}px`,
            height: `${guideHeight}px`,
            pointerEvents: "none",
            zIndex: 20,
            overflow: "visible",
          }}
        >
          {guides.map((guide, index) => guide.type === "v" ? (
            <line
              key={`${guide.type}-${guide.value}-${index}`}
              x1={guide.value}
              y1={guideTop}
              x2={guide.value}
              y2={guideTop + guideHeight}
              stroke="#ef4444"
              strokeWidth={1 / zoom}
              strokeDasharray="4 4"
            />
          ) : (
            <line
              key={`${guide.type}-${guide.value}-${index}`}
              x1={guideLeft}
              y1={guide.value}
              x2={guideLeft + guideWidth}
              y2={guide.value}
              stroke="#ef4444"
              strokeWidth={1 / zoom}
              strokeDasharray="4 4"
            />
          ))}
        </svg>
      ) : null}
    </>
  );
}
