import React, { useEffect } from "react";
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
}) => {
  // 智能断网/刷新自愈：如果检测到是正在生成的 AI 节点且附带 task_id，自动启动查询或轮询，将真实结果写回后端
  useEffect(() => {
    const isAiGen = item.type === "note" && item.title && (item.title.includes("正在生成") || item.title.includes("生成中"));
    if (!isAiGen || !item.task_id || readOnly || !setProjectCanvas || !projectId) return;

    let isMounted = true;
    let pollInterval: any;

    const saveCanvasData = async (updatedItems: any[]) => {
      try {
        await putJson(`/api/projects/${projectId}/canvas`, {
          canvas: {
            items: updatedItems,
            version: 1
          }
        });
      } catch (e) {
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

          if (assetsData.length > 0) {
            const latestAsset = assetsData[0];
            
            setProjectCanvas((current) => {
              const nextItems = current.items.map((i: CanvasItem) =>
                i.id === item.id
                  ? {
                      id: item.id,
                      type: "asset" as const,
                      asset_id: latestAsset.id,
                      title: assetTitle(latestAsset) || item.title,
                      x: i.x,
                      y: i.y,
                      w: i.w,
                      h: i.h,
                      board_id: i.board_id,
                    }
                  : i
              );
              void saveCanvasData(nextItems);
              return { ...current, items: nextItems };
            });
          }
        } else if (status === "failed") {
          clearInterval(pollInterval);

          const errorMsg = taskData.error_message || "未知服务商内部错误";
          setProjectCanvas((current) => {
            const nextItems = current.items.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    title: `AI 生成失败`,
                    text: `生成时发生错误，请重试。\n具体原因: ${errorMsg}`,
                  }
                : i
            );
            void saveCanvasData(nextItems);
            return { ...current, items: nextItems };
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

  const [progressText, setProgressText] = React.useState<string>("正在努力渲染画面场景...");
  // 画板节点局部大图切换选中的 asset.id
  const [selectedId, setSelectedId] = React.useState<string>("");

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
              ? "AI 去背景中..."
              : processingType === "upscale"
              ? "AI 4K超分中..."
              : "AI 消除中..."}
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
        ) : siblings.length >= 2 && activeSibling ? (
          /* 画布上的微型多图切换画廊组件 */
          <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden", pointerEvents: "auto" }}>
            {/* 左侧：主图显示 */}
            <div style={{ flex: 1, height: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
              <img
                alt="AI focus sibling"
                src={assetUrl(activeSibling.file_url ?? activeSibling.thumbnail_url ?? "")}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              />
              {/* 微型多图标签 */}
              <div style={{ position: "absolute", bottom: "6px", left: "6px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "2px 6px", borderRadius: "3px", fontSize: "9px", pointerEvents: "none" }}>
                画廊 1/{siblings.length}
              </div>
            </div>
            
            {/* 右侧：超细垂直缩略图选项卡 (阻止拖拽干扰) */}
            <div 
              style={{ 
                width: "36px", 
                display: "flex", 
                flexDirection: "column", 
                gap: "4px", 
                padding: "4px 2px", 
                overflowY: "auto", 
                background: "var(--rv-color-bg-sidebar)",
                borderLeft: "1px solid var(--rv-color-border-thin)",
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
                      width: "28px",
                      height: "28px",
                      borderRadius: "4px",
                      overflow: "hidden",
                      border: isSel ? "1.5px solid var(--rv-color-primary)" : "1.5px solid transparent",
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
