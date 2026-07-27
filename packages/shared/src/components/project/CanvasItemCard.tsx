import React, { useEffect, useRef } from "react";
import { Sparkles, Image as ImageIcon, Loader2 } from "lucide-react";
import { CanvasItem, AssetSummary, ProjectCanvasDocument } from "../../types";
import { assetUrl, getJson, putJson, assetTitle, getAssetMetadata } from "../../utils";

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
  projectId?: string; // 关联的项目 ID
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
  assets?: AssetSummary[];
  showResizeHandles?: boolean;
}

export const CanvasItemCard: React.FC<CanvasItemCardProps> = ({
  item,
  projectId,
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
  assets,
  showResizeHandles = true,
}) => {
  const [progressText, setProgressText] = React.useState<string>("正在努力渲染画面场景...");
  // 画板节点局部大图切换选中的 asset.id
  const [selectedId, setSelectedId] = React.useState<string>("");
  // 自愈保存的最近一次载荷指纹，用于抵消 StrictMode 下 state updater 的重复调用
  const lastSavedPayloadRef = useRef("");

  // 智能断网/刷新自愈：如果检测到是正在生成的 AI 节点且附带 task_id，自动启动查询或轮询，将真实结果写回后端
  useEffect(() => {
    const isAiGen = item.type === "note" && item.title && (item.title.includes("正在生成") || item.title.includes("生成中"));
    if (!isAiGen || !item.task_id || readOnly || !setProjectCanvas || !projectId) return;

    let isMounted = true;
    let pollInterval: any;

    // 必须回传完整画布文档：后端是整体覆盖式 upsert，
    // 只发 items 会把服务端的 boards / activeBoardId / connections / pan / zoom 全部抹掉。
    const saveCanvasDoc = async (doc: ProjectCanvasDocument) => {
      const payload = JSON.stringify({ ...doc, version: 1 });
      if (lastSavedPayloadRef.current === payload) return;
      lastSavedPayloadRef.current = payload;
      try {
        await putJson(`/api/projects/${projectId}/canvas`, { canvas: JSON.parse(payload) });
      } catch (e) {
        lastSavedPayloadRef.current = "";
        console.error("[CanvasItemCard] 自愈保存失败:", e);
      }
    };

    const checkStatus = async () => {
      try {
        const res = await getJson<any>(`/api/tasks/${item.task_id}`);
        if (!isMounted) return;

        // 兼容处理包装格式 { success: true, data: ... } 或直接返回的对象
        const taskData = (res && typeof res.success === "boolean" && res.data) ? res.data : res;
        if (!taskData || !taskData.status) return;

        const status = taskData.status;
        if (status === "pending") {
          setProgressText("任务排队中，请稍候...");
        } else if (status === "running") {
          let text = "AI 画面正在努力渲染中...";
          if (taskData.output_payload) {
            try {
              const parsed = JSON.parse(taskData.output_payload);
              if (parsed && parsed.progress_text) {
                text = parsed.progress_text;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
          setProgressText(text);
        }

        if (status === "succeeded") {
          clearInterval(pollInterval);

          const assetsRes = await getJson<AssetSummary[] | { success: boolean; data: AssetSummary[] }>(
            `/api/assets?project_id=${encodeURIComponent(projectId)}`
          );
          if (!isMounted) return;

          let assetsData: AssetSummary[] = [];
          if (Array.isArray(assetsRes)) {
            assetsData = assetsRes;
          } else if (assetsRes && typeof assetsRes === "object" && Array.isArray((assetsRes as any).data)) {
            assetsData = (assetsRes as any).data;
          }

          // 按 task_id 精确定位本卡片对应任务的产物。
          // 刷新后可能有多张卡片同时自愈，取 assetsData[0] 会让它们全部绑到同一张图。
          const produced = assetsData
            .filter((asset) => asset.task_id === item.task_id)
            .sort((a, b) => (a.output_index ?? 0) - (b.output_index ?? 0))[0];

          if (produced) {
            setProjectCanvas((current) => {
              // 卡片已不在当前文档里（切了项目或被删除）时放弃，避免把别的项目内容写回本项目
              if (!current.items.some((i: CanvasItem) => i.id === item.id)) {
                return current;
              }
              const nextItems = current.items.map((i: CanvasItem) =>
                i.id === item.id
                  ? {
                      id: item.id,
                      type: "asset" as const,
                      asset_id: produced.id,
                      title: assetTitle(produced) || item.title,
                      x: i.x,
                      y: i.y,
                      w: i.w,
                      h: i.h,
                      board_id: i.board_id,
                    }
                  : i
              );
              const nextDoc = { ...current, items: nextItems };
              void saveCanvasDoc(nextDoc);
              return nextDoc;
            });
          }
        } else if (status === "failed") {
          clearInterval(pollInterval);

          const errorMsg = taskData.error_message || "未知服务商内部错误";
          setProjectCanvas((current) => {
            // 同上：卡片不在当前文档里就放弃，避免跨项目写串
            if (!current.items.some((i: CanvasItem) => i.id === item.id)) {
              return current;
            }
            const nextItems = current.items.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    title: `AI 生成失败`,
                    text: `生成时发生错误，请重试。\n具体原因: ${errorMsg}`,
                  }
                : i
            );
            const nextDoc = { ...current, items: nextItems };
            void saveCanvasDoc(nextDoc);
            return nextDoc;
          });
        }
      } catch (err) {
        console.error("[CanvasItemCard] 自愈轮询异常:", err);
      }
    };

    void checkStatus();
    pollInterval = setInterval(checkStatus, 4000);

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [item.id, item.task_id, projectId, readOnly]);

  const isAssetCard = item.type === "asset" && asset;

  // 聚类获取当前生成资产同批次下的所有图片
  const getSiblingImages = () => {
    if (!assets || !asset || asset.asset_type !== "image" || asset.source !== "generated") {
      return [];
    }
    const meta = getAssetMetadata(asset);
    const prompt = (meta?.prompt || "").trim();
    if (!prompt) return [];

    if (!asset.created_at) return [];
    const createdTime = new Date(asset.created_at).getTime();

    return assets.filter((a: AssetSummary) => {
      if (a.asset_type !== "image" || a.source !== "generated") return false;
      const m = getAssetMetadata(a);
      const p = (m?.prompt || "").trim();
      if (p !== prompt) return false;
      if (!a.created_at) return false;
      const t = new Date(a.created_at).getTime();
      return Math.abs(t - createdTime) <= 10000; // 10秒内
    });
  };

  const siblings = getSiblingImages();
  const activeSiblingId = selectedId || (asset ? asset.id : "");
  const activeSibling = (siblings.length >= 2 && siblings.find((s: AssetSummary) => s.id === activeSiblingId)) || asset;

    const isFrame = item.type === "frame";

  return (
    <article
      className={`canvas-item theme-card-${item.color || "default"} ${
        isAssetCard ? "canvas-item-asset" : ""
      } ${isFrame ? "canvas-item-frame" : ""} ${isSelected && !readOnly ? "selected" : ""}`}
      id={`canvas-item-${item.id}`}
      onDragStart={(e) => e.preventDefault()}
      style={{
        left: item.x,
        top: item.y,
        width: item.w,
        height: item.h,
        backgroundColor: isFrame ? "transparent" : colors.background,
        borderColor: isFrame ? "transparent" : (isSelected && !readOnly ? "var(--rv-color-primary)" : colors.border),
        boxShadow: isFrame ? "none" : undefined,
        color: colors.text,
        zIndex: isFrame ? (isSelected ? 12 : 1) : (isSelected ? 15 : "auto"),
        // 画框是个空心容器，整块矩形若接收指针事件，就会挡住框内所有卡片
        //（画框 z-index=1 高于普通卡片的 auto），导致卡片一进框就再也点不中。
        // 这里让画框本体对指针透明，只保留标题栏 / 手柄 / 删除按钮可点。
        // pointer-events:none 不阻断子元素事件向上冒泡，onMouseDown 仍能正常触发。
        pointerEvents: isFrame ? "none" : undefined,
      }}
      onMouseDown={(e) => onMouseDownCard(e, item.id)}
    >
      {/* AI 运行中覆盖层 */}
      {processingItemId === item.id && (
        <div className="canvas-item-processing-overlay" onMouseDown={(e) => e.stopPropagation()}>
          <div className="processing-spinner" />
          <span>
            {processingType === "remove-bg"
              ? "去底色处理中..."
              : processingType === "upscale"
              ? "放大 2x 处理中..."
              : "中心擦除处理中..."}
          </span>
        </div>
      )}

      {/* 调节大小手柄。画框本体是 pointer-events:none，手柄需显式恢复可点。 */}
      {isSelected && !readOnly && showResizeHandles && (
        <>
          <div className="resize-handle top-left" style={{ pointerEvents: "auto" }} onMouseDown={(e) => handleResizeStart(e, item.id, "top-left")} />
          <div className="resize-handle top-right" style={{ pointerEvents: "auto" }} onMouseDown={(e) => handleResizeStart(e, item.id, "top-right")} />
          <div className="resize-handle bottom-left" style={{ pointerEvents: "auto" }} onMouseDown={(e) => handleResizeStart(e, item.id, "bottom-left")} />
          <div className="resize-handle bottom-right" style={{ pointerEvents: "auto" }} onMouseDown={(e) => handleResizeStart(e, item.id, "bottom-right")} />
        </>
      )}

      {!readOnly && removeCanvasItem && (
        <button
          className="canvas-remove"
          type="button"
          style={{ pointerEvents: "auto" }}
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
        ) : siblings.length >= 2 && activeSibling ? ( (() => {
          // 动态根据卡片高度等比计算尺寸
          const baseHeight = item.h || 320;
          const bottomBarH = Math.max(56, Math.round(baseHeight * 0.08));
          const thumbS = Math.max(44, Math.round(baseHeight * 0.06));
          const thumbG = Math.max(6, Math.round(baseHeight * 0.008));
          const padY = Math.max(6, Math.round(baseHeight * 0.008));
          const padX = Math.max(8, Math.round(baseHeight * 0.012));
          const fSize = Math.max(9, Math.round(baseHeight * 0.015));
          const labelPadY = Math.max(2, Math.round(baseHeight * 0.004));
          const labelPadX = Math.max(6, Math.round(baseHeight * 0.01));
          const labelRad = Math.max(3, Math.round(baseHeight * 0.005));
          const labelDist = Math.max(6, Math.round(baseHeight * 0.01));
          const borderW = Math.max(2, Math.round(baseHeight * 0.003));
          const borderRad = Math.max(4, Math.round(baseHeight * 0.008));

          return (
            <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", overflow: "hidden", pointerEvents: "auto" }}>
              {/* 上侧：主图显示 */}
              <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", minHeight: 0 }}>
                <img
                  alt="AI focus sibling"
                  src={assetUrl(activeSibling.file_url ?? activeSibling.thumbnail_url ?? "")}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                />
                {/* 微型多图标签 */}
                <div style={{ 
                  position: "absolute", 
                  bottom: `${labelDist}px`, 
                  left: `${labelDist}px`, 
                  background: "rgba(0,0,0,0.6)", 
                  color: "#fff", 
                  padding: `${labelPadY}px ${labelPadX}px`, 
                  borderRadius: `${labelRad}px`, 
                  fontSize: `${fSize}px`, 
                  pointerEvents: "none" 
                }}>
                  画廊 {siblings.findIndex(s => s.id === activeSibling.id) + 1}/{siblings.length}
                </div>
              </div>
              
              {/* 下侧：宽幅水平缩略图选项卡 (等比缩放) */}
              <div 
                style={{ 
                  height: `${bottomBarH}px`, 
                  display: "flex", 
                  flexDirection: "row", 
                  gap: `${thumbG}px`, 
                  padding: `${padY}px ${padX}px`, 
                  overflowX: "auto", 
                  background: "var(--rv-color-bg-sidebar)",
                  borderTop: "1px solid var(--rv-color-border-thin)",
                  boxSizing: "border-box"
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {siblings.map((s: AssetSummary, idx: number) => {
                  const isSel = s.id === activeSibling.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      style={{
                        width: `${thumbS}px`,
                        height: `${thumbS}px`,
                        borderRadius: `${borderRad}px`,
                        overflow: "hidden",
                        border: isSel ? `${borderW}px solid var(--rv-color-primary)` : `${borderW}px solid transparent`,
                        cursor: "pointer",
                        opacity: isSel ? 1 : 0.6,
                        boxSizing: "border-box",
                        flexShrink: 0
                      }}
                    >
                      <img 
                        src={assetUrl(s.thumbnail_url ?? s.file_url ?? "")} 
                        alt={`sib ${idx}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
        ) : asset.file_url || asset.thumbnail_url ? (
          <img
            alt=""
            src={assetUrl(asset.file_url ?? asset.thumbnail_url ?? "")}
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          />
        ) : (
          <div className="canvas-item-fallback">{asset.asset_type}</div>
        )
      ) : item.type === "frame" ? (
        <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative" }}>
          {/* 画框标题栏 */}
          <div
            style={{
              position: "absolute",
              top: "-24px",
              left: "4px",
              fontSize: "12px",
              fontWeight: "bold",
              color: colors.text || "var(--rv-color-primary)",
              pointerEvents: "auto",
              userSelect: "none"
            }}
          >
            {readOnly ? (
              <span>{item.title || "画框"}</span>
            ) : (
              <input
                type="text"
                value={item.title || "画框"}
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
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  background: "transparent",
                  border: 0,
                  outline: 0,
                  fontSize: "12px",
                  fontWeight: "bold",
                  color: colors.text || "var(--rv-color-primary)",
                  padding: 0,
                  margin: 0,
                  width: "120px"
                }}
              />
            )}
          </div>
          {/* 画框的主体空心区 */}
          <div
            style={{
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              borderRadius: "var(--rv-radius-xs)",
              background: "rgba(15, 118, 110, 0.02)",
              border: isSelected && !readOnly ? "2px dashed var(--rv-color-primary)" : "2px dashed rgba(15, 118, 110, 0.25)",
              pointerEvents: "none"
            }}
          />
        </div>
      ) : (() => {
        const isAiGenerationNode = item.type === "note" && item.title && (item.title.includes("正在生成") || item.title.includes("生成中"));
        
        if (isAiGenerationNode) {
          const displayPrompt = (item.text || "").replace(/^提示词:\s*/, "");
          return (
            <div 
              style={{ 
                display: "flex", 
                flexDirection: "column", 
                height: "100%", 
                background: "#ffffff", 
                borderRadius: "10px", 
                overflow: "hidden", 
                boxShadow: "0 4px 15px rgba(0,0,0,0.04)",
                border: "1px solid var(--rv-color-border-thin)",
                boxSizing: "border-box"
              }}
            >
              {/* 头部 Bar */}
              <div 
                style={{ 
                  background: "linear-gradient(135deg, var(--rv-color-primary) 0%, #6366f1 100%)", 
                  padding: "6px 12px", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  color: "#ffffff",
                  height: "28px",
                  boxSizing: "border-box",
                  flexShrink: 0
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: "bold" }}>
                  <Sparkles size={11} style={{ animation: "pulse 1.5s infinite" }} />
                  <span>AI 创意画面渲染中...</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div 
                    title={displayPrompt}
                    style={{
                      cursor: "help",
                      fontSize: "9px",
                      background: "rgba(255,255,255,0.18)",
                      borderRadius: "4px",
                      padding: "1px 5px",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                      fontWeight: "normal",
                      userSelect: "none"
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    提示词
                  </div>
                  <div 
                    style={{ 
                      fontSize: "8px", 
                      background: "rgba(255,255,255,0.25)", 
                      padding: "1px 5px", 
                      borderRadius: "100px", 
                      fontWeight: "bold" 
                    }}
                  >
                    RUNNING
                  </div>
                </div>
              </div>
              
              {/* 主体：“以图为主”的 AI 画面占位渲染预留区 */}
              <div 
                style={{ 
                  flex: 1, 
                  background: "radial-gradient(circle at center, rgba(15, 118, 110, 0.04) 0%, rgba(99, 102, 241, 0.02) 100%)", 
                  display: "flex", 
                  flexDirection: "column", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: "10px",
                  position: "relative",
                  overflow: "hidden",
                  minHeight: 0
                }}
              >
                {/* 旋转加呼吸的双重 Loader 动画 */}
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ImageIcon size={32} style={{ color: "var(--rv-color-primary)", opacity: 0.35, strokeWidth: 1.5 }} />
                  <Loader2 
                    size={48} 
                    style={{ 
                      position: "absolute", 
                      color: "var(--rv-color-primary)", 
                      opacity: 0.45, 
                      animation: "spin 3s linear infinite",
                      strokeWidth: 1.2
                    }} 
                  />
                </div>
                
                <span style={{ fontSize: "10px", color: "var(--rv-color-text-muted)", fontWeight: "bold", textAlign: "center", padding: "0 16px" }}>
                  {progressText}
                </span>

                {/* 底部跑马灯进度条 */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", background: "rgba(0,0,0,0.02)" }}>
                  <div 
                    className="shimmer-slide-bar"
                    style={{ 
                      height: "100%", 
                      width: "60%", 
                      background: "linear-gradient(90deg, var(--rv-color-primary) 0%, #6366f1 100%)",
                      borderRadius: "100px"
                    }} 
                  />
                </div>
              </div>
            </div>
          );
        }

        return (
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
        );
      })()}
    </article>
  );
};
