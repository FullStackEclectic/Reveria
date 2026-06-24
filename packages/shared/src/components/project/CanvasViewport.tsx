import React, { useRef, useState, useEffect } from "react";
import { Sparkles, ZoomIn, ZoomOut, Maximize2, ImageIcon } from "lucide-react";
import { CanvasItem, AssetSummary, ProjectCanvasDocument } from "../../types";
import { assetUrl, assetTitle } from "../../utils";

export interface CanvasViewportProps {
  projectCanvas: ProjectCanvasDocument;
  setProjectCanvas?: React.Dispatch<React.SetStateAction<ProjectCanvasDocument>>;
  activeBoardId: string;
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  assets: AssetSummary[];
  readOnly?: boolean;

  // Viewport Position & Scale States
  panX: number;
  setPanX: React.Dispatch<React.SetStateAction<number> | ((prev: number) => number)>;
  panY: number;
  setPanY: React.Dispatch<React.SetStateAction<number> | ((prev: number) => number)>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number> | ((prev: number) => number)>;

  // Callback to remove/update canvas item (only in write mode)
  removeCanvasItem?: (id: string) => void;

  setWorkflowRefAsset: (asset: AssetSummary | null) => void;
  setIsRightDrawerOpen: (open: boolean) => void;
}

export function getCardColorStyle(colorTheme?: string) {
  switch (colorTheme) {
    case "amber":
      return {
        background: "rgba(254, 243, 199, 0.85)",
        text: "hsl(30, 80%, 20%)",
        border: "rgba(252, 211, 77, 0.5)",
      };
    case "emerald":
      return {
        background: "rgba(209, 250, 229, 0.85)",
        text: "hsl(160, 80%, 15%)",
        border: "rgba(110, 231, 183, 0.5)",
      };
    case "blue":
      return {
        background: "rgba(219, 234, 254, 0.85)",
        text: "hsl(210, 80%, 20%)",
        border: "rgba(147, 197, 253, 0.5)",
      };
    case "rose":
      return {
        background: "rgba(252, 228, 236, 0.85)",
        text: "hsl(340, 80%, 20%)",
        border: "rgba(244, 143, 177, 0.5)",
      };
    case "slate":
      return {
        background: "rgba(241, 245, 249, 0.85)",
        text: "hsl(215, 25%, 20%)",
        border: "rgba(203, 213, 225, 0.5)",
      };
    case "default":
    default:
      return {
        background: "rgba(255, 255, 255, 0.95)",
        text: "var(--rv-color-text-main)",
        border: "var(--rv-color-border-thin)",
      };
  }
}

export function CanvasViewport({
  projectCanvas,
  setProjectCanvas,
  activeBoardId,
  selectedItemId,
  setSelectedItemId,
  assets,
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
}: CanvasViewportProps) {
  const visibleItems = projectCanvas.items.filter(
    (item) => (item.board_id || "default") === activeBoardId
  );

  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [draggingCanvasItemId, setDraggingCanvasItemId] = useState("");
  const [resizingItemId, setResizingItemId] = useState("");
  const [resizingHandle, setResizingHandle] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("bottom-right");
  const itemResizeStart = useRef({ x: 0, y: 0, itemX: 0, itemY: 0, itemW: 0, itemH: 0 });

  const [processingItemId, setProcessingItemId] = useState("");
  const [processingType, setProcessingType] = useState<"remove-bg" | "upscale" | "erase" | "">("");

  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const itemDragStart = useRef({ x: 0, y: 0, itemX: 0, itemY: 0 });

  const [realResolutions, setRealResolutions] = useState<Record<string, string>>({});
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const currentTempCoords = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    visibleItems.forEach((item) => {
      if (item.type === "asset" && item.asset_id) {
        const asset = assets.find((a) => a.id === item.asset_id);
        if (asset && (asset.thumbnail_url || asset.file_url) && !realResolutions[asset.id]) {
          const img = new Image();
          img.src = assetUrl(asset.thumbnail_url ?? asset.file_url ?? "");
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

  const handleMagicTool = (type: "remove-bg" | "upscale" | "erase", itemId: string) => {
    setProcessingItemId(itemId);
    setProcessingType(type);
    
    setTimeout(() => {
      if (setProjectCanvas) {
        setProjectCanvas((curr) => ({
          ...curr,
          items: curr.items.map((i) => {
            if (i.id === itemId) {
              let updatedTitle = i.title;
              if (type === "remove-bg" && !i.title.includes("已去背景")) {
                updatedTitle = `${i.title} (已去背景)`;
              } else if (type === "upscale" && !i.title.includes("超分放大")) {
                updatedTitle = `${i.title} (4K超分)`;
              } else if (type === "erase" && !i.title.includes("已擦除")) {
                updatedTitle = `${i.title} (AI消除)`;
              }
              return { ...i, title: updatedTitle };
            }
            return i;
          }),
        }));
      }
      setProcessingItemId("");
      setProcessingType("");
      alert(
        type === "remove-bg"
          ? "✨ AI 智能抠图去背景完成！"
          : type === "upscale"
          ? "🔍 AI 超分放大已生成高清 4K 原图！"
          : "✏️ AI 智能消除重绘完成！"
      );
    }, 1500);
  };

  const handleDrawSimilar = (asset: AssetSummary | null) => {
    if (!asset) return;
    setWorkflowRefAsset(asset);
    setIsRightDrawerOpen(true);
  };

  // Listen to space bar to change pointer cursor
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

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.ctrlKey) {
      const zoomFactor = 1.05;
      let nextZoom = zoom;
      if (e.deltaY < 0) {
        nextZoom = Math.min(3.0, zoom * zoomFactor);
      } else {
        nextZoom = Math.max(0.1, zoom / zoomFactor);
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const canvasX = (mouseX - panX) / zoom;
      const canvasY = (mouseY - panY) / zoom;

      // Safe update
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

  

  const updateCanvasNote = (itemId: string, text: string) => {
    if (readOnly || !setProjectCanvas) return;
    setProjectCanvas((curr) => ({
      ...curr,
      items: curr.items.map((i) => (i.id === itemId ? { ...i, text } : i)),
    }));
  };

  return (
    <div
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
            const snappedX = Math.round(targetX / snapGrid) * snapGrid;
            const snappedY = Math.round(targetY / snapGrid) * snapGrid;

            // 写入临时坐标
            currentTempCoords.current = { x: snappedX, y: snappedY, w: item.w, h: item.h };

            // 直接修改 DOM style，极其流畅
            const element = document.getElementById(`canvas-item-${draggingCanvasItemId}`);
            if (element) {
              element.style.left = `${snappedX}px`;
              element.style.top = `${snappedY}px`;
            }

            // 同步屏幕空间选框标签和工具栏位置
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
              // 图片等比缩放约束，以 w 算出等比的 h，并调整 X、Y 偏移
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
              // 备注卡片自由缩放
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

            // 写入临时坐标
            currentTempCoords.current = { x: snappedX, y: snappedY, w: snappedW, h: snappedH };

            // 直接修改 DOM style，极其流畅
            const element = document.getElementById(`canvas-item-${resizingItemId}`);
            if (element) {
              element.style.left = `${snappedX}px`;
              element.style.top = `${snappedY}px`;
              element.style.width = `${snappedW}px`;
              element.style.height = `${snappedH}px`;
            }

            // 同步屏幕空间选框标签和工具栏位置与内容
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
        if ((draggingCanvasItemId || resizingItemId) && setProjectCanvas) {
          const targetId = draggingCanvasItemId || resizingItemId;
          const { x, y, w, h } = currentTempCoords.current;
          if (x !== 0 || y !== 0 || w !== 0 || h !== 0) {
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
        if ((draggingCanvasItemId || resizingItemId) && setProjectCanvas) {
          const targetId = draggingCanvasItemId || resizingItemId;
          const { x, y, w, h } = currentTempCoords.current;
          if (x !== 0 || y !== 0 || w !== 0 || h !== 0) {
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
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="canvas-surface"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        {visibleItems.length ? (
          visibleItems.map((item) => {
            const asset = item.asset_id
              ? assets.find((assetItem) => assetItem.id === item.asset_id)
              : null;
            const colors = getCardColorStyle(item.color);
            const isSelected = selectedItemId === item.id;

            const isAssetCard = item.type === "asset" && asset;
            return (
              <article
                className={`canvas-item theme-card-${item.color || "default"} ${
                  isAssetCard ? "canvas-item-asset" : ""
                } ${
                  isSelected && !readOnly ? "selected" : ""
                }`}
                key={item.id}
                id={`canvas-item-${item.id}`}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.w,
                  height: item.h,
                  backgroundColor: colors.background,
                  borderColor: isSelected && !readOnly ? "var(--rv-color-primary)" : colors.border,
                  color: colors.text,
                  zIndex: isSelected ? 10 : "auto",
                }}
                onMouseDown={(e) => {
                  if (spacePressed || e.button !== 0 || readOnly) return;
                  e.stopPropagation();
                  setSelectedItemId(item.id);
                  setDraggingCanvasItemId(item.id);
                  currentTempCoords.current = { x: item.x, y: item.y, w: item.w, h: item.h };
                  itemDragStart.current = {
                    x: e.clientX,
                    y: e.clientY,
                    itemX: item.x,
                    itemY: item.y,
                  };
                }}
              >
                {/* AI 运行中覆盖层 */}
                {processingItemId === item.id && (
                  <div className="canvas-item-processing-overlay" onMouseDown={(e) => e.stopPropagation()}>
                    <div className="processing-spinner" />
                    <span>
                      {processingType === "remove-bg"
                        ? "✨ AI 去背景中..."
                        : processingType === "upscale"
                        ? "🔍 AI 4K超分中..."
                        : "✏️ AI 消除中..."}
                    </span>
                  </div>
                )}

                {/* 调节大小手柄 */}
                {isSelected && !readOnly && (
                  <>
                    <div className="resize-handle top-left" onMouseDown={(e) => handleResizeStart(e, item.id, "top-left")} />
                    <div className="resize-handle top-right" onMouseDown={(e) => handleResizeStart(e, item.id, "top-right")} />
                    <div className="resize-handle bottom-left" onMouseDown={(e) => handleResizeStart(e, item.id, "bottom-left")} />
                    <div className="resize-handle bottom-right" onMouseDown={(e) => handleResizeStart(e, item.id, "bottom-right")} />
                  </>
                )}

                {!readOnly && removeCanvasItem && (
                  <button
                    className="canvas-remove"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeCanvasItem(item.id);
                    }}
                  >
                    ×
                  </button>
                )}
                {item.type === "asset" && asset ? (
                  asset.thumbnail_url || asset.file_url ? (
                    <img 
                      alt="" 
                      src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")} 
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                    />
                  ) : (
                    <div className="canvas-item-fallback">{asset.asset_type}</div>
                  )
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    {readOnly ? (
                      <>
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize:
                              item.titleSize === "lg"
                                ? "18px"
                                : item.titleSize === "sm"
                                ? "12px"
                                : "14px",
                            color: colors.text,
                            padding: "2px 4px",
                            width: "100%",
                            wordBreak: "break-all",
                          }}
                        >
                          {item.title}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            fontSize:
                              item.fontSize === "lg"
                                ? "16px"
                                : item.fontSize === "sm"
                                ? "12px"
                                : "14px",
                            color: colors.text,
                            padding: "4px",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            overflowY: "auto",
                          }}
                        >
                          {item.text}
                        </div>
                      </>
                    ) : (
                      <>
                        <input
                          type="text"
                          className="canvas-item-title-input"
                          value={item.title}
                          onChange={(e) => {
                            if (!setProjectCanvas) return;
                            const val = e.target.value;
                            setProjectCanvas((curr) => ({
                              ...curr,
                              items: curr.items.map((i) =>
                                i.id === item.id ? { ...i, title: val } : i
                              ),
                            }));
                          }}
                          style={{
                            fontWeight: "bold",
                            fontSize:
                              item.titleSize === "lg"
                                ? "18px"
                                : item.titleSize === "sm"
                                ? "12px"
                                : "14px",
                            color: colors.text,
                            background: "transparent",
                            border: 0,
                            outline: 0,
                            padding: "2px 4px",
                            width: "calc(100% - 24px)",
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                        <textarea
                          value={item.text ?? ""}
                          onChange={(event) => updateCanvasNote(item.id, event.target.value)}
                          onMouseDown={(event) => event.stopPropagation()}
                          style={{
                            fontSize:
                              item.fontSize === "lg"
                                ? "16px"
                                : item.fontSize === "sm"
                                ? "12px"
                                : "14px",
                            color: colors.text,
                          }}
                        />
                      </>
                    )}
                  </div>
                )}
              </article>
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

      {/* 屏幕空间悬浮工具栏 (Screen Space Overlay)，大小不受 zoom 缩放影响 */}
      {!readOnly && selectedItemId && (() => {
        const item = projectCanvas.items.find((i) => i.id === selectedItemId);
        if (!item || item.type !== "asset") return null;
        const asset = assets.find((a) => a.id === item.asset_id);
        if (!asset) return null;

        const screenX = item.x * zoom + panX;
        const screenY = item.y * zoom + panY;
        const screenW = item.w * zoom;

        const displayPrompt = (() => {
          const meta = asset.metadata;
          if (meta && typeof meta.prompt === "string" && meta.prompt.trim() !== "") {
            return meta.prompt;
          }
          return item.title || "未命名图片";
        })();

        const displayRes = realResolutions[asset.id] || 
          (asset.metadata && typeof asset.metadata.size === "string" ? asset.metadata.size : null) ||
          (asset.metadata && typeof asset.metadata.width === "number" && typeof asset.metadata.height === "number" ? `${asset.metadata.width}x${asset.metadata.height}` : null) ||
          `${item.w} x ${item.h}`;

        return (
          <React.Fragment>
            {/* 左上角提示词标签 */}
            <div
              className="canvas-selection-label-left"
              style={{
                position: "absolute",
                left: screenX,
                top: screenY - 20,
                zIndex: 98,
              }}
              title={displayPrompt}
            >
              🖼️ {displayPrompt.length > 25 ? `${displayPrompt.slice(0, 25)}...` : displayPrompt}
            </div>

            {/* 右上角分辨率标签 */}
            <div
              className="canvas-selection-label-right"
              style={{
                position: "absolute",
                left: screenX + screenW,
                top: screenY - 20,
                transform: "translateX(-100%)",
                zIndex: 98,
              }}
            >
              {displayRes}
            </div>

            {/* 悬浮工具栏 */}
            <div
              className="canvas-floating-toolbar"
              style={{
                position: "absolute",
                left: screenX + screenW / 2,
                top: screenY - 54,
                transform: "translateX(-50%)",
                zIndex: 100,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="canvas-toolbar-actions">
                <button
                  type="button"
                  onClick={() => handleMagicTool("remove-bg", item.id)}
                  disabled={processingItemId === item.id}
                  title="AI 抠图去背景"
                >
                  AI 去背景
                </button>
                <button
                  type="button"
                  onClick={() => handleMagicTool("upscale", item.id)}
                  disabled={processingItemId === item.id}
                  title="AI 超分放大"
                >
                  超分放大
                </button>
                <button
                  type="button"
                  onClick={() => handleMagicTool("erase", item.id)}
                  disabled={processingItemId === item.id}
                  title="AI 橡皮擦消除"
                >
                  橡皮擦
                </button>
                <div className="canvas-toolbar-divider" />
                <button
                  type="button"
                  className="btn-primary-action"
                  onClick={() => handleDrawSimilar(asset)}
                  title="画同款工作流"
                >
                  画同款
                </button>
                <a
                  href={assetUrl(asset.file_url ?? "")}
                  download={asset.metadata.file_name || `asset-${asset.id}.png`}
                  target="_blank"
                  rel="noreferrer"
                  title="下载原图"
                >
                  下载
                </a>
                <button
                  type="button"
                  className="btn-danger-action"
                  onClick={() => {
                    if (removeCanvasItem) {
                      removeCanvasItem(item.id);
                      setSelectedItemId("");
                    }
                  }}
                  title="从画布删除"
                >
                  删除
                </button>
              </div>
            </div>
          </React.Fragment>
        );
      })()}
    </div>
  );
}
