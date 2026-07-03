import React, { useRef, useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { CanvasItem, AssetSummary, ProjectCanvasDocument } from "../../types";
import { CanvasItemCard, getCardColorStyle } from "./CanvasItemCard";
import { CanvasSelectionOverlay } from "./CanvasSelectionOverlay";
import { assetUrl } from "../../utils";

export interface CanvasViewportProps {
  projectCanvas: ProjectCanvasDocument;
  setProjectCanvas?: React.Dispatch<React.SetStateAction<ProjectCanvasDocument>>;
  activeBoardId: string;
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  assets: AssetSummary[];
  setAssets: React.Dispatch<React.SetStateAction<AssetSummary[]>>;
  readOnly?: boolean;

  // Viewport Position & Scale States
  panX: number;
  setPanX: React.Dispatch<React.SetStateAction<number> | ((prev: number) => number)>;
  panY: number;
  setPanY: React.Dispatch<React.SetStateAction<number> | ((prev: number) => number)>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number> | ((prev: number) => number)>;

  removeCanvasItem?: (id: string) => void;
  setWorkflowRefAsset: (asset: AssetSummary | null) => void;
  setIsRightDrawerOpen: (open: boolean) => void;
  workspaceId: string;
  projectId: string;

  // 历史撤销回调
  pushToHistory?: (canvas: ProjectCanvasDocument) => void;
}

// 连线首尾控制点计算函数
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
    if (dx > 0) {
      x1 = from.x + from.w;
      y1 = from.y + from.h / 2;
      x2 = to.x;
      y2 = to.y + to.h / 2;
    } else {
      x1 = from.x;
      y1 = from.y + from.h / 2;
      x2 = to.x + to.w;
      y2 = to.y + to.h / 2;
    }
  } else {
    if (dy > 0) {
      x1 = from.x + from.w / 2;
      y1 = from.y + from.h;
      x2 = to.x + to.w / 2;
      y2 = to.y;
    } else {
      x1 = from.x + from.w / 2;
      y1 = from.y;
      x2 = to.x + to.w / 2;
      y2 = to.y + to.h;
    }
  }

  return { x1, y1, x2, y2, dx, dy };
}

export function CanvasViewport({
  projectCanvas,
  setProjectCanvas,
  activeBoardId,
  selectedItemId,
  setSelectedItemId,
  assets,
  setAssets,
  readOnly = false,
  panX,
  setPanX,
  panY,
  setPanY,
  zoom,
  setZoom,
  removeCanvasItem,
  setWorkflowRefAsset,
  setIsRightDrawerOpen,
  workspaceId,
  projectId,
  pushToHistory,
}: CanvasViewportProps) {
  const visibleItems = projectCanvas.items.filter(
    (item) => (item.board_id || "default") === activeBoardId
  );

  const visibleConnections = (projectCanvas.connections || []).filter((conn) => {
    const fromExists = visibleItems.some((i) => i.id === conn.fromItemId);
    const toExists = visibleItems.some((i) => i.id === conn.toItemId);
    return fromExists && toExists;
  });

  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingCanvasItemId, setDraggingCanvasItemId] = useState("");
  const [resizingItemId, setResizingItemId] = useState("");
  const [resizingHandle, setResizingHandle] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("bottom-right");
  const itemResizeStart = useRef({ x: 0, y: 0, itemX: 0, itemY: 0, itemW: 0, itemH: 0 });

  const [processingItemId, setProcessingItemId] = useState("");
  const [processingType, setProcessingType] = useState<"remove-bg" | "upscale" | "erase" | "">("");

  // 连线模式状态
  const [connectionSourceId, setConnectionSourceId] = useState("");

  // 对齐吸附线状态
  const [activeGuides, setActiveGuides] = useState<{ type: "v" | "h"; value: number }[]>([]);

  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const itemDragStart = useRef({ x: 0, y: 0, itemX: 0, itemY: 0 });

  const [realResolutions, setRealResolutions] = useState<Record<string, string>>({});
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const currentTempCoords = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    visibleItems.forEach((item) => {
      if (item.type === "asset" && item.asset_id) {
        const asset = assets.find((a) => a.id === item.asset_id);
        if (asset && (asset.file_url || asset.thumbnail_url) && !realResolutions[asset.id]) {
          const img = new Image();
          img.src = assetUrl(asset.file_url ?? asset.thumbnail_url ?? "");
          img.onload = () => {
            setRealResolutions((prev) => ({
              ...prev,
              [asset.id]: `${img.naturalWidth} x ${img.naturalHeight}`,
            }));
            setImageRatios((prev) => ({
              ...prev,
              [asset.id]: img.naturalWidth / img.naturalHeight,
            }));
          };
        }
      }
    });
  }, [visibleItems, assets, realResolutions]);

  const handleResizeStart = (e: React.MouseEvent, itemId: string, handle: typeof resizingHandle) => {
    e.stopPropagation();
    e.preventDefault();
    const item = projectCanvas.items.find((i) => i.id === itemId);
    if (!item) return;
    setResizingItemId(itemId);
    setResizingHandle(handle);
    currentTempCoords.current = { x: item.x, y: item.y, w: item.w, h: item.h };
    itemResizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      itemX: item.x,
      itemY: item.y,
      itemW: item.w,
      itemH: item.h,
    };
  };

  const handleDrawSimilar = (asset: AssetSummary | null) => {
    if (!asset) return;
    setWorkflowRefAsset(asset);
    setIsRightDrawerOpen(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA";
      if (isInput) return;
      if (e.code === "Space") {
        setSpacePressed(true);
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const viewportRef = useRef<HTMLDivElement>(null);

  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    panXRef.current = panX;
  }, [panX]);
  useEffect(() => {
    panYRef.current = panY;
  }, [panY]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();

      const currentZoom = zoomRef.current;
      const currentPanX = panXRef.current;
      const currentPanY = panYRef.current;

      if (e.ctrlKey) {
        const zoomFactor = 1.05;
        let nextZoom = currentZoom;
        if (e.deltaY < 0) {
          nextZoom = Math.min(3.0, currentZoom * zoomFactor);
        } else {
          nextZoom = Math.max(0.1, currentZoom / zoomFactor);
        }

        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const canvasX = (mouseX - currentPanX) / currentZoom;
        const canvasY = (mouseY - currentPanY) / currentZoom;

        const updatePanX = mouseX - canvasX * nextZoom;
        const updatePanY = mouseY - canvasY * nextZoom;

        setPanX(updatePanX);
        setPanY(updatePanY);
        setZoom(nextZoom);
      } else {
        const speed = 1.0;
        if (e.shiftKey) {
          setPanX((prev) => prev - e.deltaY * speed);
        } else {
          setPanX((prev) => prev - e.deltaX * speed);
          setPanY((prev) => prev - e.deltaY * speed);
        }
      }
    };

    viewport.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleNativeWheel);
    };
  }, [setZoom, setPanX, setPanY]);

  const updateCanvasNote = (itemId: string, text: string) => {
    if (readOnly || !setProjectCanvas) return;
    if (pushToHistory) pushToHistory(projectCanvas);
    setProjectCanvas((curr) => ({
      ...curr,
      items: curr.items.map((i) => (i.id === itemId ? { ...i, text } : i)),
    }));
  };

  const onMouseDownCard = (e: React.MouseEvent, itemId: string) => {
    if (spacePressed || e.button !== 0 || readOnly) return;
    e.stopPropagation();

    // 如果处于连线准备状态，则点击另一张卡片代表连线终点
    if (connectionSourceId) {
      if (connectionSourceId !== itemId) {
        if (pushToHistory) pushToHistory(projectCanvas);
        if (setProjectCanvas) {
          setProjectCanvas((curr) => {
            const nextConns = curr.connections ? [...curr.connections] : [];
            const exists = nextConns.some(
              (c) => c.fromItemId === connectionSourceId && c.toItemId === itemId
            );
            if (!exists) {
              nextConns.push({
                id: `conn-${Date.now()}`,
                fromItemId: connectionSourceId,
                toItemId: itemId,
              });
            }
            return {
              ...curr,
              connections: nextConns,
            };
          });
        }
      }
      setConnectionSourceId("");
      return;
    }

    setSelectedItemId(itemId);
    setDraggingCanvasItemId(itemId);
    const item = projectCanvas.items.find((i) => i.id === itemId);
    if (!item) return;

    currentTempCoords.current = { x: item.x, y: item.y, w: item.w, h: item.h };
    itemDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      itemX: item.x,
      itemY: item.y,
    };
  };

  return (
    <div
      ref={viewportRef}
      className={`canvas-viewport ${spacePressed ? "cursor-grab" : ""} ${
        isPanning ? "cursor-grabbing" : ""
      }`}
      style={{
        backgroundImage:
          "linear-gradient(rgba(185, 178, 165, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(185, 178, 165, 0.08) 1px, transparent 1px)",
        backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
        backgroundPosition: `${panX}px ${panY}px`,
      }}
      onMouseDown={(e) => {
        if (e.button === 1 || e.button === 2 || spacePressed) {
          setIsPanning(true);
          dragStart.current = { x: e.clientX, y: e.clientY, panX, panY };
          e.preventDefault();
        } else {
          if (e.target === e.currentTarget) {
            setSelectedItemId("");
            setConnectionSourceId("");
          }
        }
      }}
      onMouseMove={(e) => {
        if (isPanning) {
          const dx = e.clientX - dragStart.current.x;
          const dy = e.clientY - dragStart.current.y;
          setPanX(dragStart.current.panX + dx);
          setPanY(dragStart.current.panY + dy);
        } else if (draggingCanvasItemId && !readOnly) {
          const item = projectCanvas.items.find((i) => i.id === draggingCanvasItemId);
          if (item) {
            const dx = (e.clientX - itemDragStart.current.x) / zoom;
            const dy = (e.clientY - itemDragStart.current.y) / zoom;
            const snapGrid = 8;
            const targetX = itemDragStart.current.itemX + dx;
            const targetY = itemDragStart.current.itemY + dy;

            let snappedX = Math.round(targetX / snapGrid) * snapGrid;
            let snappedY = Math.round(targetY / snapGrid) * snapGrid;

            // --- 对齐吸附 Snapping 算法 ---
            const otherItems = visibleItems.filter((i) => i.id !== draggingCanvasItemId);
            const snapThreshold = 10;
            const guides: typeof activeGuides = [];
            let snappedToOtherX = false;
            let snappedToOtherY = false;

            for (const other of otherItems) {
              const otherLeft = other.x;
              const otherRight = other.x + other.w;
              const otherCenterX = other.x + other.w / 2;
              
              const otherTop = other.y;
              const otherBottom = other.y + other.h;
              const otherCenterY = other.y + other.h / 2;

              if (!snappedToOtherX) {
                if (Math.abs(targetX - otherLeft) < snapThreshold) {
                  snappedX = otherLeft;
                  guides.push({ type: "v", value: otherLeft });
                  snappedToOtherX = true;
                } else if (Math.abs(targetX + item.w - otherRight) < snapThreshold) {
                  snappedX = otherRight - item.w;
                  guides.push({ type: "v", value: otherRight });
                  snappedToOtherX = true;
                } else if (Math.abs(targetX - otherRight) < snapThreshold) {
                  snappedX = otherRight;
                  guides.push({ type: "v", value: otherRight });
                  snappedToOtherX = true;
                } else if (Math.abs(targetX + item.w - otherLeft) < snapThreshold) {
                  snappedX = otherLeft - item.w;
                  guides.push({ type: "v", value: otherLeft });
                  snappedToOtherX = true;
                } else if (Math.abs(targetX + item.w / 2 - otherCenterX) < snapThreshold) {
                  snappedX = otherCenterX - item.w / 2;
                  guides.push({ type: "v", value: otherCenterX });
                  snappedToOtherX = true;
                }
              }

              if (!snappedToOtherY) {
                if (Math.abs(targetY - otherTop) < snapThreshold) {
                  snappedY = otherTop;
                  guides.push({ type: "h", value: otherTop });
                  snappedToOtherY = true;
                } else if (Math.abs(targetY + item.h - otherBottom) < snapThreshold) {
                  snappedY = otherBottom - item.h;
                  guides.push({ type: "h", value: otherBottom });
                  snappedToOtherY = true;
                } else if (Math.abs(targetY - otherBottom) < snapThreshold) {
                  snappedY = otherBottom;
                  guides.push({ type: "h", value: otherBottom });
                  snappedToOtherY = true;
                } else if (Math.abs(targetY + item.h - otherTop) < snapThreshold) {
                  snappedY = otherTop - item.h;
                  guides.push({ type: "h", value: otherTop });
                  snappedToOtherY = true;
                } else if (Math.abs(targetY + item.h / 2 - otherCenterY) < snapThreshold) {
                  snappedY = otherCenterY - item.h / 2;
                  guides.push({ type: "h", value: otherCenterY });
                  snappedToOtherY = true;
                }
              }
            }

            setActiveGuides(guides);

            currentTempCoords.current = { x: snappedX, y: snappedY, w: item.w, h: item.h };

            const element = document.getElementById(`canvas-item-${draggingCanvasItemId}`);
            if (element) {
              element.style.left = `${snappedX}px`;
              element.style.top = `${snappedY}px`;
            }

            // 同步覆盖层元素
            const toolbar = document.querySelector(".canvas-floating-toolbar") as HTMLElement;
            const labelLeft = document.querySelector(".canvas-selection-label-left") as HTMLElement;
            const labelRight = document.querySelector(".canvas-selection-label-right") as HTMLElement;
            
            const screenX = snappedX * zoom + panX;
            const screenY = snappedY * zoom + panY;
            const screenW = item.w * zoom;

            if (toolbar) {
              toolbar.style.left = `${screenX + screenW / 2}px`;
              toolbar.style.top = `${screenY - 54}px`;
            }
            if (labelLeft) {
              labelLeft.style.left = `${screenX}px`;
              labelLeft.style.top = `${screenY - 20}px`;
            }
            if (labelRight) {
              labelRight.style.left = `${screenX + screenW}px`;
              labelRight.style.top = `${screenY - 20}px`;
            }
          }
        } else if (resizingItemId && !readOnly) {
          const item = projectCanvas.items.find((i) => i.id === resizingItemId);
          if (item) {
            const dx = (e.clientX - itemResizeStart.current.x) / zoom;
            const dy = (e.clientY - itemResizeStart.current.y) / zoom;
            const snapGrid = 8;
            
            let nextX = item.x;
            let nextY = item.y;
            let nextW = item.w;
            let nextH = item.h;

            const isAsset = item.type === "asset";
            const ratio = isAsset ? (imageRatios[item.asset_id ?? ""] || item.w / item.h) : 1;

            if (isAsset) {
              if (resizingHandle === "bottom-right") {
                nextW = Math.max(100, itemResizeStart.current.itemW + dx);
                nextH = nextW / ratio;
              } else if (resizingHandle === "bottom-left") {
                nextW = Math.max(100, itemResizeStart.current.itemW - dx);
                nextH = nextW / ratio;
                nextX = itemResizeStart.current.itemX + (itemResizeStart.current.itemW - nextW);
              } else if (resizingHandle === "top-right") {
                nextW = Math.max(100, itemResizeStart.current.itemW + dx);
                nextH = nextW / ratio;
                nextY = itemResizeStart.current.itemY + (itemResizeStart.current.itemH - nextH);
              } else if (resizingHandle === "top-left") {
                nextW = Math.max(100, itemResizeStart.current.itemW - dx);
                nextH = nextW / ratio;
                nextX = itemResizeStart.current.itemX + (itemResizeStart.current.itemW - nextW);
                nextY = itemResizeStart.current.itemY + (itemResizeStart.current.itemH - nextH);
              }
            } else {
              if (resizingHandle === "bottom-right") {
                nextW = Math.max(100, itemResizeStart.current.itemW + dx);
                nextH = Math.max(80, itemResizeStart.current.itemH + dy);
              } else if (resizingHandle === "bottom-left") {
                const targetW = itemResizeStart.current.itemW - dx;
                if (targetW >= 100) {
                  nextW = targetW;
                  nextX = itemResizeStart.current.itemX + dx;
                }
                nextH = Math.max(80, itemResizeStart.current.itemH + dy);
              } else if (resizingHandle === "top-right") {
                nextW = Math.max(100, itemResizeStart.current.itemW + dx);
                const targetH = itemResizeStart.current.itemH - dy;
                if (targetH >= 80) {
                  nextH = targetH;
                  nextY = itemResizeStart.current.itemY + dy;
                }
              } else if (resizingHandle === "top-left") {
                const targetW = itemResizeStart.current.itemW - dx;
                const targetH = itemResizeStart.current.itemH - dy;
                if (targetW >= 100) {
                  nextW = targetW;
                  nextX = itemResizeStart.current.itemX + dx;
                }
                if (targetH >= 80) {
                  nextH = targetH;
                  nextY = itemResizeStart.current.itemY + dy;
                }
              }
            }

            const snappedX = Math.round(nextX / snapGrid) * snapGrid;
            const snappedY = Math.round(nextY / snapGrid) * snapGrid;
            const snappedW = Math.round(nextW / snapGrid) * snapGrid;
            const snappedH = Math.round(nextH / snapGrid) * snapGrid;

            currentTempCoords.current = { x: snappedX, y: snappedY, w: snappedW, h: snappedH };

            const element = document.getElementById(`canvas-item-${resizingItemId}`);
            if (element) {
              element.style.left = `${snappedX}px`;
              element.style.top = `${snappedY}px`;
              element.style.width = `${snappedW}px`;
              element.style.height = `${snappedH}px`;
            }

            const toolbar = document.querySelector(".canvas-floating-toolbar") as HTMLElement;
            const labelLeft = document.querySelector(".canvas-selection-label-left") as HTMLElement;
            const labelRight = document.querySelector(".canvas-selection-label-right") as HTMLElement;
            
            const screenX = snappedX * zoom + panX;
            const screenY = snappedY * zoom + panY;
            const screenW = snappedW * zoom;

            if (toolbar) {
              toolbar.style.left = `${screenX + screenW / 2}px`;
              toolbar.style.top = `${screenY - 54}px`;
            }
            if (labelLeft) {
              labelLeft.style.left = `${screenX}px`;
              labelLeft.style.top = `${screenY - 20}px`;
            }
            if (labelRight) {
              labelRight.style.left = `${screenX + screenW}px`;
              labelRight.style.top = `${screenY - 20}px`;
              if (isAsset) {
                const asset = assets.find((a) => a.id === item.asset_id);
                labelRight.innerText = realResolutions[asset?.id ?? ""] || `${snappedW} x ${snappedH}`;
              }
            }
          }
        }
      }}
      onMouseUp={() => {
        setIsPanning(false);
        setActiveGuides([]);
        if ((draggingCanvasItemId || resizingItemId) && setProjectCanvas) {
          const targetId = draggingCanvasItemId || resizingItemId;
          const { x, y, w, h } = currentTempCoords.current;
          if (x !== 0 || y !== 0 || w !== 0 || h !== 0) {
            if (pushToHistory) pushToHistory(projectCanvas);
            setProjectCanvas((current) => ({
              ...current,
              items: current.items.map((i) =>
                i.id === targetId ? { ...i, x, y, w, h } : i
              ),
            }));
          }
        }
        setDraggingCanvasItemId("");
        setResizingItemId("");
        currentTempCoords.current = { x: 0, y: 0, w: 0, h: 0 };
      }}
      onMouseLeave={() => {
        setIsPanning(false);
        setActiveGuides([]);
        if ((draggingCanvasItemId || resizingItemId) && setProjectCanvas) {
          const targetId = draggingCanvasItemId || resizingItemId;
          const { x, y, w, h } = currentTempCoords.current;
          if (x !== 0 || y !== 0 || w !== 0 || h !== 0) {
            if (pushToHistory) pushToHistory(projectCanvas);
            setProjectCanvas((current) => ({
              ...current,
              items: current.items.map((i) =>
                i.id === targetId ? { ...i, x, y, w, h } : i
              ),
            }));
          }
        }
        setDraggingCanvasItemId("");
        setResizingItemId("");
        currentTempCoords.current = { x: 0, y: 0, w: 0, h: 0 };
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="canvas-surface"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* 智能连接线绘制层 */}
        {visibleConnections.length > 0 && (
          <svg
            className="canvas-connections-svg"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "10000px",
              height: "10000px",
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            <defs>
              <marker
                id="arrow-marker"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="rgba(15, 118, 110, 0.45)" />
              </marker>
            </defs>
            {visibleConnections.map((conn) => {
              const fromItem = visibleItems.find((i) => i.id === conn.fromItemId);
              const toItem = visibleItems.find((i) => i.id === conn.toItemId);
              if (!fromItem || !toItem) return null;

              const { x1, y1, x2, y2, dx } = getConnectionPoints(fromItem, toItem);

              const controlDistance = Math.min(100, Math.abs(dx) * 0.4);
              const cx1 = x1 + (dx > 0 ? controlDistance : -controlDistance);
              const cy1 = y1;
              const cx2 = x2 - (dx > 0 ? controlDistance : -controlDistance);
              const cy2 = y2;

              const pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

              return (
                <path
                  key={conn.id}
                  d={pathD}
                  stroke="rgba(15, 118, 110, 0.45)"
                  strokeWidth="2.5"
                  fill="none"
                  markerEnd="url(#arrow-marker)"
                  strokeDasharray="4 4"
                />
              );
            })}
          </svg>
        )}

        {/* 辅助对齐参考线 */}
        {activeGuides.length > 0 && (
          <svg
            className="canvas-guides-svg"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "10000px",
              height: "10000px",
              pointerEvents: "none",
              zIndex: 20,
            }}
          >
            {activeGuides.map((guide, idx) =>
              guide.type === "v" ? (
                <line
                  key={idx}
                  x1={guide.value}
                  y1={-99999}
                  x2={guide.value}
                  y2={99999}
                  stroke="#ef4444"
                  strokeWidth={1 / zoom}
                  strokeDasharray="4 4"
                />
              ) : (
                <line
                  key={idx}
                  x1={-99999}
                  y1={guide.value}
                  x2={99999}
                  y2={guide.value}
                  stroke="#ef4444"
                  strokeWidth={1 / zoom}
                  strokeDasharray="4 4"
                />
              )
            )}
          </svg>
        )}

        {visibleItems.length ? (
          visibleItems.map((item) => {
            const asset = item.asset_id ? assets.find((a) => a.id === item.asset_id) : null;
            const colors = getCardColorStyle(item.color);
            const isSelected = selectedItemId === item.id;

            return (
              <CanvasItemCard
                key={item.id}
                item={item}
                projectId={projectId}
                asset={asset}
                assets={assets}
                isSelected={isSelected}
                readOnly={readOnly}
                colors={colors}
                processingItemId={processingItemId}
                processingType={processingType}
                removeCanvasItem={removeCanvasItem}
                updateCanvasNote={updateCanvasNote}
                setProjectCanvas={setProjectCanvas}
                onMouseDownCard={onMouseDownCard}
                handleResizeStart={handleResizeStart}
              />
            );
          })
        ) : (
          <div className="canvas-empty-overlay">
            <div className="canvas-empty">
              <Sparkles
                size={24}
                style={{ marginBottom: "8px", color: "var(--rv-color-primary)" }}
              />
              <h4>当前画板无元素</h4>
              <p style={{ fontSize: "12px", color: "#6b645d" }}>
                {readOnly
                  ? "工作区成员尚未在画布上添加内容。"
                  : "点击上方按钮添加卡片，按住空格键拖拽平移，使用 Ctrl+滚轮缩放。"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 选中卡片屏幕空间覆盖层 */}
      {!readOnly && selectedItemId && (
        <CanvasSelectionOverlay
          selectedItemId={selectedItemId}
          setSelectedItemId={setSelectedItemId}
          projectCanvas={projectCanvas}
          setProjectCanvas={setProjectCanvas!}
          assets={assets}
          setAssets={setAssets}
          zoom={zoom}
          panX={panX}
          panY={panY}
          realResolutions={realResolutions}
          workspaceId={workspaceId}
          projectId={projectId}
          processingItemId={processingItemId}
          setProcessingItemId={setProcessingItemId}
          processingType={processingType}
          setProcessingType={setProcessingType}
          connectionSourceId={connectionSourceId}
          setConnectionSourceId={setConnectionSourceId}
          handleDrawSimilar={handleDrawSimilar}
        />
      )}
    </div>
  );
}
