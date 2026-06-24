import React from "react";
import { CanvasItem, AssetSummary, ProjectCanvasDocument } from "../../types";
import { assetUrl } from "../../utils";

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

export interface CanvasItemCardProps {
  item: CanvasItem;
  asset: AssetSummary | null | undefined;
  isSelected: boolean;
  readOnly: boolean;
  colors: { background: string; text: string; border: string };
  processingItemId: string;
  processingType: string;
  removeCanvasItem?: (id: string) => void;
  updateCanvasNote: (id: string, text: string) => void;
  setProjectCanvas?: React.Dispatch<React.SetStateAction<ProjectCanvasDocument>>;
  onMouseDownCard: (e: React.MouseEvent, itemId: string) => void;
  handleResizeStart: (e: React.MouseEvent, itemId: string, handle: "top-left" | "top-right" | "bottom-left" | "bottom-right") => void;
}

export const CanvasItemCard: React.FC<CanvasItemCardProps> = ({
  item,
  asset,
  isSelected,
  readOnly,
  colors,
  processingItemId,
  processingType,
  removeCanvasItem,
  updateCanvasNote,
  setProjectCanvas,
  onMouseDownCard,
  handleResizeStart,
}) => {
  const isAssetCard = item.type === "asset" && asset;

  return (
    <article
      className={`canvas-item theme-card-${item.color || "default"} ${
        isAssetCard ? "canvas-item-asset" : ""
      } ${isSelected && !readOnly ? "selected" : ""}`}
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
      onMouseDown={(e) => onMouseDownCard(e, item.id)}
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
        asset.asset_type === "video" || (asset.file_url && asset.file_url.toLowerCase().endsWith(".mp4")) ? (
          <video
            src={assetUrl(asset.file_url ?? "")}
            controls
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            draggable={false}
          />
        ) : asset.file_url || asset.thumbnail_url ? (
          <img
            alt=""
            src={assetUrl(asset.file_url ?? asset.thumbnail_url ?? "")}
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
};
