import React from "react";
import { CanvasItem, AssetSummary, ProjectCanvasDocument } from "../../types";
import { assetUrl, postJson } from "../../utils";

export interface CanvasSelectionOverlayProps {
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  projectCanvas: ProjectCanvasDocument;
  setProjectCanvas: React.Dispatch<React.SetStateAction<ProjectCanvasDocument>>;
  assets: AssetSummary[];
  setAssets: React.Dispatch<React.SetStateAction<AssetSummary[]>>;
  zoom: number;
  panX: number;
  panY: number;
  realResolutions: Record<string, string>;
  workspaceId: string;
  projectId: string;

  processingItemId: string;
  setProcessingItemId: (id: string) => void;
  processingType: string;
  setProcessingType: (type: "remove-bg" | "upscale" | "erase" | "") => void;

  connectionSourceId: string;
  setConnectionSourceId: (id: string) => void;

  handleDrawSimilar: (asset: AssetSummary | null) => void;
  removeCanvasItem?: (id: string) => void;
}

export const CanvasSelectionOverlay: React.FC<CanvasSelectionOverlayProps> = ({
  selectedItemId,
  setSelectedItemId,
  projectCanvas,
  setProjectCanvas,
  assets,
  setAssets,
  zoom,
  panX,
  panY,
  realResolutions,
  workspaceId,
  projectId,
  processingItemId,
  setProcessingItemId,
  processingType,
  setProcessingType,
  connectionSourceId,
  setConnectionSourceId,
  handleDrawSimilar,
  removeCanvasItem,
}) => {
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

  const displayRes = (() => {
    const meta = asset.metadata;
    if (meta && typeof meta.width === "number" && typeof meta.height === "number") {
      return `${meta.width} x ${meta.height}`;
    }

    const dimensionFields = [meta?.dimensions, meta?.size_str, meta?.resolution, meta?.image_size, meta?.size];
    for (const value of dimensionFields) {
      if (typeof value !== "string") continue;
      const match = value.match(/(\d{2,5})\s*[xX×]\s*(\d{2,5})/);
      if (match) {
        return `${match[1]} x ${match[2]}`;
      }
    }

    return realResolutions[asset.id] || "读取原图尺寸中";
  })();

  const isConnectingSource = connectionSourceId === item.id;

  const handleMagicAction = async (action: "remove-bg" | "upscale" | "erase") => {
    setProcessingItemId(item.id);
    setProcessingType(action);
    try {
      const response = await postJson<{ success: boolean; message?: string; asset: AssetSummary }>(
        "/api/workflows/magic-action",
        {
          workspace_id: workspaceId,
          project_id: projectId,
          asset_id: asset.id,
          action: action,
        }
      );

      if (response.success && response.asset) {
        // 1. 将新资产插入全局 assets
        setAssets((curr) => [response.asset, ...curr]);
        // 2. 更新画布卡片关联的资产 ID 与标题
        setProjectCanvas((curr) => ({
          ...curr,
          items: curr.items.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  asset_id: response.asset.id,
                  title:
                    action === "remove-bg"
                      ? `${i.title} (已去底色)`
                      : action === "upscale"
                      ? `${i.title} (放大2x)`
                      : `${i.title} (中心擦除)`,
                }
              : i
          ),
        }));
      } else {
        alert(`处理失败: ${response.message || "未知服务商错误"}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`处理失败: ${err.message || err}`);
    } finally {
      setProcessingItemId("");
      setProcessingType("");
    }
  };

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
        {displayPrompt.length > 25 ? `${displayPrompt.slice(0, 25)}...` : displayPrompt}
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
          {/* 以下三项是本地像素运算，不是 AI 推理，文案需与 handler/workflow.go RunMagicAction 的实际行为一致 */}
          <button
            type="button"
            onClick={() => void handleMagicAction("remove-bg")}
            disabled={processingItemId === item.id}
            title="取左上角底色并透明化，仅适用于纯色背景图"
          >
            去底色
          </button>
          <button
            type="button"
            onClick={() => void handleMagicAction("upscale")}
            disabled={processingItemId === item.id}
            title="双三次插值放大 2 倍，不会补充新细节"
          >
            放大 2x
          </button>
          <button
            type="button"
            onClick={() => void handleMagicAction("erase")}
            disabled={processingItemId === item.id}
            title="擦除画面正中央 25% 区域为透明"
          >
            中心擦除
          </button>

          <div className="canvas-toolbar-divider" />

          {/* 智能连线功能按钮 */}
          <button
            type="button"
            onClick={() => setConnectionSourceId(isConnectingSource ? "" : item.id)}
            className={isConnectingSource ? "btn-active-connection" : ""}
            style={{
              color: isConnectingSource ? "var(--rv-color-primary)" : "inherit",
              fontWeight: isConnectingSource ? "bold" : "normal",
            }}
            title="创建与此卡片的连线"
          >
            {isConnectingSource ? "请选择终点卡片..." : "连接"}
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
            download={asset.metadata?.file_name || `asset-${asset.id}.png`}
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
              // 不能用 document.querySelector(".canvas-remove")：每张卡片都有同名按钮，
              // 全局选择器只会命中 DOM 中的第一张卡片，导致删错对象。
              if (removeCanvasItem) {
                removeCanvasItem(item.id);
              }
              setSelectedItemId("");
            }}
            title="从画布删除"
          >
            删除
          </button>
        </div>
      </div>
    </React.Fragment>
  );
};
