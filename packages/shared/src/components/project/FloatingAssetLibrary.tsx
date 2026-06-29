import React, { useState, useRef, useEffect } from "react";
import { X, Search, Sparkles, Image as ImageIcon, Folder, Plus, Maximize2, Minimize2 } from "lucide-react";
import { AssetSummary } from "../../types";
import { assetUrl } from "../../utils";

interface FloatingAssetLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  assets: AssetSummary[];
  setPreviewAsset: (asset: AssetSummary | null) => void;
  addAssetToCanvas: (asset: AssetSummary) => void;
  addWorkflowResultToCanvas: (title: string, output: any) => void;
}

export function FloatingAssetLibrary({
  isOpen,
  onClose,
  assets,
  setPreviewAsset,
  addAssetToCanvas,
  addWorkflowResultToCanvas
}: FloatingAssetLibraryProps) {
  const [position, setPosition] = useState({ x: 120, y: 150 });
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "upload" | "ai">("all");
  const [toastMsg, setToastMsg] = useState("");

  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  // 一闪而过的提示通知
  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    const timer = setTimeout(() => setToastMsg(""), 2000);
    return () => clearTimeout(timer);
  };

  if (!isOpen) return null;

  // 鼠标拖拽逻辑
  const handleMouseDown = (e: React.MouseEvent) => {
    // 过滤掉按钮、输入框的拖拽干扰
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("input")) return;
    
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition({
      x: Math.max(10, dragRef.current.posX + dx),
      y: Math.max(10, dragRef.current.posY + dy)
    });
  };

  const handleMouseUp = () => {
    dragRef.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  // 区分 AI 生成 与 本地上传
  const getFilteredAssets = () => {
    return assets.filter((asset) => {
      // 1. 判断是否是 AI 生成 (workflow_output 类型或 source 为 ai)
      const isAi = asset.asset_type === "workflow_output" || asset.source === "ai";
      
      // 2. 根据 Tab 过滤
      if (activeTab === "ai" && !isAi) return false;
      if (activeTab === "upload" && isAi) return false;

      // 3. 根据搜索框模糊匹配
      if (searchQuery.trim() !== "") {
        const title = (asset.metadata?.title || asset.metadata?.file_name || "").toLowerCase();
        if (!title.includes(searchQuery.toLowerCase())) return false;
      }

      return true;
    });
  };

  const filteredAssets = getFilteredAssets();

  // 双击或点击添加到画布的动作
  const handleAddAction = (asset: AssetSummary) => {
    if (asset.asset_type === "workflow_output") {
      addWorkflowResultToCanvas(asset.metadata?.title ?? "AI 创意产物", asset.metadata?.output);
      triggerToast(`已将 AI 产出放置到画布 🎉`);
    } else {
      addAssetToCanvas(asset);
      triggerToast(`已将参考素材放置到画布 🎨`);
    }
  };

  return (
    <div
      ref={windowRef}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: "720px",
        height: isCollapsed ? "48px" : "520px",
        background: "rgba(255, 255, 255, 0.88)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.5)",
        borderRadius: "16px",
        boxShadow: "0 24px 48px -12px rgba(0,0,0,0.12), 0 8px 16px -8px rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        zIndex: 9999,
        overflow: "hidden",
        resize: isCollapsed ? "none" : "both",
        minWidth: "380px",
        minHeight: isCollapsed ? "48px" : "300px",
        transition: "height 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
      }}
    >
      {/* 头部：可拖拽区域 */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          height: "48px",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(0, 0, 0, 0.03)",
          borderBottom: isCollapsed ? "none" : "1px solid var(--rv-color-border-thin)",
          cursor: "move",
          userSelect: "none",
          flexShrink: 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Folder size={16} style={{ color: "var(--rv-color-primary)" }} />
          <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>
            项目资产与历史库 ({assets.length})
          </span>
          <span style={{ fontSize: "9px", background: "rgba(0,0,0,0.06)", padding: "2px 6px", borderRadius: "10px", color: "var(--rv-color-text-muted)" }}>
            双击折叠
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--rv-color-text-muted)", display: "flex", alignItems: "center" }}
            title={isCollapsed ? "展开窗口" : "折叠窗口"}
          >
            {isCollapsed ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--rv-color-text-muted)", fontSize: "16px", display: "flex", alignItems: "center" }}
            title="关闭素材库"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* 主体内容：在非折叠状态下渲染 */}
      {!isCollapsed && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "14px", overflow: "hidden", gap: "12px" }}>
          {/* 工具栏：搜索与 TAB */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
            {/* 搜索框 */}
            <div style={{ position: "relative", flex: 1, minWidth: "160px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--rv-color-text-muted)" }} />
              <input
                type="text"
                placeholder="搜索资产名/创意标题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px 6px 30px",
                  borderRadius: "20px",
                  border: "1px solid var(--rv-color-border-thin)",
                  background: "#ffffff",
                  fontSize: "11px",
                  color: "var(--rv-color-text-main)",
                  outline: "none",
                  transition: "all 0.2s"
                }}
              />
            </div>

            {/* TAB 分类胶囊按钮 */}
            <div style={{ display: "flex", background: "rgba(0,0,0,0.04)", padding: "2px", borderRadius: "20px", gap: "2px" }}>
              {(["all", "upload", "ai"] as const).map((tab) => {
                const label = tab === "all" ? "全部展示" : tab === "upload" ? "本地上传" : "AI 生成";
                const isAct = activeTab === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      border: 0,
                      padding: "4px 10px",
                      borderRadius: "18px",
                      fontSize: "10px",
                      fontWeight: isAct ? "bold" : "normal",
                      cursor: "pointer",
                      background: isAct ? "#ffffff" : "transparent",
                      color: isAct ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                      boxShadow: isAct ? "0 2px 6px rgba(0,0,0,0.05)" : "none",
                      transition: "all 0.2s"
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 资产渲染大列表 */}
          <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
            {filteredAssets.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--rv-color-text-muted)", gap: "10px", padding: "40px 0" }}>
                <Sparkles size={24} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: "11px" }}>没有匹配的项目资产，您可以尝试切换标签或上传/生成新资产。</span>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
                  gridAutoRows: "110px",
                  gap: "10px"
                }}
              >
                {filteredAssets.map((asset) => {
                  const isAi = asset.asset_type === "workflow_output" || asset.source === "ai";
                  const imageUrl = asset.thumbnail_url || asset.file_url || "";
                  const title = asset.metadata?.title || asset.metadata?.file_name || (isAi ? "AI 生成图" : "本地素材");

                  return (
                    <div
                      key={asset.id}
                      className="asset-library-card"
                      onDoubleClick={() => handleAddAction(asset)}
                      style={{
                        position: "relative",
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: "1px solid var(--rv-color-border-thin)",
                        background: "rgba(0,0,0,0.01)",
                        cursor: "pointer",
                        height: "100%",
                        width: "100%"
                      }}
                    >
                      {/* 图片预览 */}
                      {imageUrl ? (
                        <img
                          src={assetUrl(imageUrl)}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc", color: "var(--rv-color-text-muted)" }}>
                          <ImageIcon size={20} style={{ opacity: 0.3 }} />
                          <span style={{ fontSize: "8px", marginTop: "4px" }}>数据</span>
                        </div>
                      )}

                      {/* 常驻徽章 (AI vs 本地) */}
                      <span
                        style={{
                          position: "absolute",
                          left: "6px",
                          top: "6px",
                          fontSize: "8px",
                          fontWeight: "bold",
                          padding: "2px 5px",
                          borderRadius: "4px",
                          background: isAi ? "rgba(15, 118, 110, 0.85)" : "rgba(245, 158, 11, 0.85)",
                          color: "#ffffff",
                          backdropFilter: "blur(2px)",
                          zIndex: 5
                        }}
                      >
                        {isAi ? "AI" : "上传"}
                      </span>

                      {/* 鼠标悬浮滑出遮罩层 */}
                      <div
                        className="asset-card-overlay"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: "rgba(0,0,0,0.7)",
                          opacity: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          transition: "opacity 0.2s ease",
                          zIndex: 10
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleAddAction(asset)}
                          style={{
                            border: 0,
                            background: "var(--rv-color-primary)",
                            color: "#ffffff",
                            fontSize: "10px",
                            fontWeight: "bold",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "3px"
                          }}
                        >
                          <Plus size={10} /> 放置画布
                        </button>
                        {imageUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewAsset(asset)}
                            style={{
                              border: "1px solid rgba(255,255,255,0.4)",
                              background: "transparent",
                              color: "#ffffff",
                              fontSize: "9px",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              cursor: "pointer"
                            }}
                          >
                            🔍 预览大图
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 消息通知 Toast */}
      {toastMsg && (
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 118, 110, 0.9)",
            backdropFilter: "blur(4px)",
            color: "#ffffff",
            fontSize: "10px",
            padding: "6px 16px",
            borderRadius: "20px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 10000,
            pointerEvents: "none",
            animation: "fadeIn 0.2s"
          }}
        >
          {toastMsg}
        </div>
      )}

      <style>{`
        .asset-library-card:hover .asset-card-overlay {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
