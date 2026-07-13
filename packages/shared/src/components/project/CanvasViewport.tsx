import React, { useRef, useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { CanvasItem, AssetSummary, ProjectCanvasDocument } from "../../types";
import { CanvasItemCard, getCardColorStyle } from "./CanvasItemCard";
import { CanvasSelectionOverlay } from "./CanvasSelectionOverlay";
import { CanvasDiagramLayers } from "./CanvasDiagramLayers";
import { CanvasSelectionBox } from "./CanvasSelectionBox";
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
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);
  const batchDragStartOffsets = useRef<{ id: string; startX: number; startY: number }[]>([]);

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
            const idx = nextConns.findIndex(
              (c) => c.fromItemId === connectionSourceId && c.toItemId === itemId
            );
            if (idx === -1) {
              nextConns.push({
                id: `conn-${Date.now()}`,
                fromItemId: connectionSourceId,
                toItemId: itemId,
              });
            } else {
              nextConns.splice(idx, 1);
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

    const isShiftPressed = e.shiftKey;
    let nextSelected = [...selectedItemIds];
    if (!nextSelected.includes(itemId)) {
      if (isShiftPressed) {
        nextSelected.push(itemId);
      } else {
        nextSelected = [itemId];
      }
    } else if (isShiftPressed) {
      nextSelected = nextSelected.filter(id => id !== itemId);
    }
    
    setSelectedItemIds(nextSelected);
    setSelectedItemId(nextSelected.length === 1 ? nextSelected[0] : "");

    setDraggingCanvasItemId(itemId);
    const item = projectCanvas.items.find((i) => i.id === itemId);
    if (!item) return;

    // 联动平移项集合计算
    let linkedItemIds = [...nextSelected];
    
    // 如果是画框，寻找并联动包裹的所有子卡片
    if (item.type === "frame") {
      const frameRect = { x1: item.x, y1: item.y, x2: item.x + item.w, y2: item.y + item.h };
      const frameChildrenIds = visibleItems.filter(child => 
        child.id !== item.id &&
        child.x >= frameRect.x1 &&
        child.y >= frameRect.y1 &&
        (child.x + child.w) <= frameRect.x2 &&
        (child.y + child.h) <= frameRect.y2
      ).map(child => child.id);
      
      linkedItemIds = Array.from(new Set([...linkedItemIds, ...frameChildrenIds]));
    }
    
    // 把当前正在拖拽的卡片放在首位
    linkedItemIds = linkedItemIds.filter(id => id !== itemId);
    linkedItemIds.unshift(itemId);

    batchDragStartOffsets.current = linkedItemIds.map(id => {
      const linkedItem = projectCanvas.items.find(i => i.id === id);
      return {
        id,
        startX: linkedItem ? linkedItem.x : 0,
        startY: linkedItem ? linkedItem.y : 0,
      };
    });

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
            setSelectedItemIds([]);
            
            if (!readOnly) {
              setSelectionBox({
                startX: e.clientX,
                startY: e.clientY,
                curX: e.clientX,
                curY: e.clientY
              });
            }
          }
        }
      }}
      onMouseMove={(e) => {
        if (isPanning) {
          const dx = e.clientX - dragStart.current.x;
          const dy = e.clientY - dragStart.current.y;
          setPanX(dragStart.current.panX + dx);
          setPanY(dragStart.current.panY + dy);
        } else if (selectionBox) {
          setSelectionBox({
            ...selectionBox,
            curX: e.clientX,
            curY: e.clientY
          });
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

            // --- 对齐吸附 Snapping 算法 (只应用于主拖拽卡片) ---
            const otherItems = visibleItems.filter((i) => !batchDragStartOffsets.current.some(b => b.id === i.id));
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

            // 计算实际的主卡片位移
            const actualDx = snappedX - itemDragStart.current.itemX;
            const actualDy = snappedY - itemDragStart.current.itemY;

            // 平移所有联动元素
            batchDragStartOffsets.current.forEach(offset => {
              const elX = Math.round((offset.startX + actualDx) / snapGrid) * snapGrid;
              const elY = Math.round((offset.startY + actualDy) / snapGrid) * snapGrid;
              
              const el = document.getElementById(`canvas-item-${offset.id}`);
              if (el) {
                el.style.left = `${elX}px`;
                el.style.top = `${elY}px`;
              }
            });

            currentTempCoords.current = { x: snappedX, y: snappedY, w: item.w, h: item.h };

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

        if (selectionBox) {
          const rectX1 = (Math.min(selectionBox.startX, selectionBox.curX) - panX) / zoom;
          const rectY1 = (Math.min(selectionBox.startY, selectionBox.curY) - panY) / zoom;
          const rectX2 = (Math.max(selectionBox.startX, selectionBox.curX) - panX) / zoom;
          const rectY2 = (Math.max(selectionBox.startY, selectionBox.curY) - panY) / zoom;

          const newlySelected = visibleItems.filter((item) => {
            const itemX1 = item.x;
            const itemY1 = item.y;
            const itemX2 = item.x + item.w;
            const itemY2 = item.y + item.h;
            return !(itemX2 < rectX1 || itemX1 > rectX2 || itemY2 < rectY1 || itemY1 > rectY2);
          }).map((item) => item.id);

          setSelectedItemIds(newlySelected);
          setSelectedItemId(newlySelected.length === 1 ? newlySelected[0] : "");
          setSelectionBox(null);
        }

        if ((draggingCanvasItemId || resizingItemId) && setProjectCanvas) {
          const targetId = draggingCanvasItemId || resizingItemId;
          const { x, y, w, h } = currentTempCoords.current;

          if (x !== 0 || y !== 0 || w !== 0 || h !== 0) {
            if (pushToHistory) pushToHistory(projectCanvas);

            if (draggingCanvasItemId && batchDragStartOffsets.current.length > 1) {
              const actualDx = x - itemDragStart.current.itemX;
              const actualDy = y - itemDragStart.current.itemY;
              const snapGrid = 8;

              setProjectCanvas((current) => {
                const nextItems = current.items.map((i) => {
                  const offset = batchDragStartOffsets.current.find((b) => b.id === i.id);
                  if (offset) {
                    const elX = Math.round((offset.startX + actualDx) / snapGrid) * snapGrid;
                    const elY = Math.round((offset.startY + actualDy) / snapGrid) * snapGrid;
                    return { ...i, x: elX, y: elY };
                  }
                  return i;
                });
                return { ...current, items: nextItems };
              });
            } else {
              setProjectCanvas((current) => ({
                ...current,
                items: current.items.map((i) =>
                  i.id === targetId ? { ...i, x, y, w, h } : i
                ),
              }));
            }
          }
        }
        setDraggingCanvasItemId("");
        setResizingItemId("");
        batchDragStartOffsets.current = [];
        currentTempCoords.current = { x: 0, y: 0, w: 0, h: 0 };
      }}
      onMouseLeave={() => {
        setIsPanning(false);
        setActiveGuides([]);
        setSelectionBox(null);

        if ((draggingCanvasItemId || resizingItemId) && setProjectCanvas) {
          const targetId = draggingCanvasItemId || resizingItemId;
          const { x, y, w, h } = currentTempCoords.current;

          if (x !== 0 || y !== 0 || w !== 0 || h !== 0) {
            if (pushToHistory) pushToHistory(projectCanvas);

            if (draggingCanvasItemId && batchDragStartOffsets.current.length > 1) {
              const actualDx = x - itemDragStart.current.itemX;
              const actualDy = y - itemDragStart.current.itemY;
              const snapGrid = 8;

              setProjectCanvas((current) => {
                const nextItems = current.items.map((i) => {
                  const offset = batchDragStartOffsets.current.find((b) => b.id === i.id);
                  if (offset) {
                    const elX = Math.round((offset.startX + actualDx) / snapGrid) * snapGrid;
                    const elY = Math.round((offset.startY + actualDy) / snapGrid) * snapGrid;
                    return { ...i, x: elX, y: elY };
                  }
                  return i;
                });
                return { ...current, items: nextItems };
              });
            } else {
              setProjectCanvas((current) => ({
                ...current,
                items: current.items.map((i) =>
                  i.id === targetId ? { ...i, x, y, w, h } : i
                ),
              }));
            }
          }
        }
        setDraggingCanvasItemId("");
        setResizingItemId("");
        batchDragStartOffsets.current = [];
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
        <CanvasDiagramLayers items={visibleItems} connections={visibleConnections} guides={activeGuides} zoom={zoom} />

        {visibleItems.length ? (
          visibleItems.map((item) => {
            const asset = item.asset_id ? assets.find((a) => a.id === item.asset_id) : null;
            const colors = getCardColorStyle(item.color);
            const isSelected = selectedItemId === item.id || selectedItemIds.includes(item.id);

            return (
              <CanvasItemCard
                key={item.id}
                item={item}
                projectId={projectId}
                asset={asset}
                assets={assets}
                isSelected={isSelected}
                showResizeHandles={isSelected && selectedItemId === item.id}
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

      {/* 框选的虚线外框 */}
      {selectionBox ? <CanvasSelectionBox selection={selectionBox} viewportRect={viewportRef.current?.getBoundingClientRect()} /> : null}
    </div>
  );
}
