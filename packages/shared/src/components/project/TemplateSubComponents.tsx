import React from "react";
import { Folder, Sparkles, LayoutTemplate } from "lucide-react";
import { PromptTemplate, TemplateCategory } from "../../types";
import { assetUrl } from "../../utils";

// ================= 子组件：模板卡片 =================
interface TemplateCardProps {
  tpl: PromptTemplate;
  onClick: () => void;
}

export function TemplateCard({ tpl, onClick }: TemplateCardProps) {
  return (
    <div
      className="tpl-card-container"
      onClick={onClick}
      style={{
        position: "relative",
        borderRadius: "12px",
        overflow: "hidden",
        cursor: "pointer",
        height: "250px",
        background: "var(--rv-color-bg-sidebar)",
        border: "1px solid var(--rv-color-border-thin)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.03)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }}
      onMouseEnter={(e) => {
        const overlay = e.currentTarget.querySelector('.tpl-card-hover-overlay') as HTMLElement;
        const title = e.currentTarget.querySelector('.tpl-card-hover-title') as HTMLElement;
        const badge = e.currentTarget.querySelector('.tpl-card-hover-badge') as HTMLElement;
        const img = e.currentTarget.querySelector('.tpl-card-img') as HTMLElement;
        if (overlay) overlay.style.opacity = "1";
        if (title) title.style.transform = "translateY(0)";
        if (badge) badge.style.transform = "translateY(0)";
        if (img) img.style.transform = "scale(1.05)";
      }}
      onMouseLeave={(e) => {
        const overlay = e.currentTarget.querySelector('.tpl-card-hover-overlay') as HTMLElement;
        const title = e.currentTarget.querySelector('.tpl-card-hover-title') as HTMLElement;
        const badge = e.currentTarget.querySelector('.tpl-card-hover-badge') as HTMLElement;
        const img = e.currentTarget.querySelector('.tpl-card-img') as HTMLElement;
        if (overlay) overlay.style.opacity = "0";
        if (title) title.style.transform = "translateY(8px)";
        if (badge) badge.style.transform = "translateY(-8px)";
        if (img) img.style.transform = "scale(1)";
      }}
    >
      {/* 精美封面大图 */}
      {tpl.preview_url ? (
        <img 
          src={assetUrl(tpl.preview_url)} 
          alt="" 
          className="tpl-card-img"
          onError={(e) => { 
            e.currentTarget.src = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60"; 
          }} 
          style={{ 
            width: "100%", 
            height: "100%", 
            objectFit: "cover",
            transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
          }} 
        />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", color: "var(--rv-color-text-muted)" }}>
          <LayoutTemplate size={28} style={{ opacity: 0.3 }} />
        </div>
      )}

      {/* 常驻右下角极简徽章 */}
      {tpl.need_image && tpl.need_image > 0 ? (
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            right: "10px",
            background: "rgba(245, 158, 11, 0.85)",
            backdropFilter: "blur(4px)",
            color: "#ffffff",
            fontSize: "9px",
            fontWeight: "bold",
            padding: "3px 8px",
            borderRadius: "20px",
            pointerEvents: "none",
            zIndex: 5,
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
          }}
        >
          垫图
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            right: "10px",
            background: "rgba(15, 118, 110, 0.75)",
            backdropFilter: "blur(4px)",
            color: "#ffffff",
            fontSize: "9px",
            fontWeight: "bold",
            padding: "3px 8px",
            borderRadius: "20px",
            pointerEvents: "none",
            zIndex: 5,
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
          }}
        >
          绘图
        </div>
      )}

      {/* 鼠标悬浮滑出遮罩层 */}
      <div
        className="tpl-card-hover-overlay"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%)",
          opacity: 0,
          transition: "opacity 0.3s ease",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "14px",
          boxSizing: "border-box",
          zIndex: 10
        }}
      >
        {/* 配置角标 */}
        <div
          className="tpl-card-hover-badge"
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: "var(--rv-color-primary)",
            color: "#fff",
            fontSize: "9px",
            fontWeight: "bold",
            padding: "3px 8px",
            borderRadius: "20px",
            display: "flex",
            alignItems: "center",
            gap: "3px",
            transform: "translateY(-8px)",
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        >
          配置
          <Sparkles size={8} />
        </div>

        {/* 标题 */}
        <span
          className="tpl-card-hover-title"
          style={{
            fontSize: "12px",
            fontWeight: "bold",
            color: "#ffffff",
            textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            width: "100%",
            transform: "translateY(8px)",
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        >
          {tpl.title}
        </span>
      </div>
    </div>
  );
}

// ================= 子组件：分类侧边栏 =================
interface CategorySidebarProps {
  isLoading: boolean;
  currentCats: TemplateCategory[];
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  expandedCategoryIds: string[];
  setExpandedCategoryIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function CategorySidebar({
  isLoading,
  currentCats,
  selectedCategoryId,
  setSelectedCategoryId,
  expandedCategoryIds,
  setExpandedCategoryIds
}: CategorySidebarProps) {
  const rootCats = currentCats.filter((c) => !c.parent_id);
  const getSubCats = (parentId: string) => currentCats.filter((c) => c.parent_id === parentId);
  
  const toggleExpand = (catId: string) => {
    setExpandedCategoryIds(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  return (
    <aside
      style={{
        background: "rgba(0, 0, 0, 0.02)",
        borderRight: "1px solid var(--rv-color-border-thin)",
        padding: "16px 12px",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        height: "100%"
      }}
    >
      {isLoading && currentCats.length === 0 ? (
        <div style={{ padding: "20px", color: "var(--rv-color-text-muted)", fontSize: "12px", textAlign: "center" }}>加载中...</div>
      ) : currentCats.length === 0 ? (
        <div style={{ padding: "20px", color: "var(--rv-color-text-muted)", fontSize: "12px", textAlign: "center" }}>暂无分类</div>
      ) : (
        rootCats.map((root) => {
          const isSelected = selectedCategoryId === root.id;
          const subs = getSubCats(root.id);
          const hasSubs = subs.length > 0;
          const isExpanded = expandedCategoryIds.includes(root.id);

          return (
            <div key={root.id} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId(root.id);
                  if (hasSubs) {
                    toggleExpand(root.id);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: "var(--rv-radius-xs)",
                  border: 0,
                  background: isSelected ? "var(--rv-color-primary-light)" : "transparent",
                  color: isSelected ? "var(--rv-color-primary)" : "var(--rv-color-text-main)",
                  fontWeight: isSelected ? "700" : "600",
                  fontSize: "13px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.color = "var(--rv-color-text-main)";
                    e.currentTarget.style.background = "rgba(0, 0, 0, 0.02)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.color = "var(--rv-color-text-muted)";
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                  <Folder size={14} style={{ opacity: isSelected ? 1 : 0.6, flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{root.name}</span>
                </div>
                {hasSubs && (
                  <span style={{ fontSize: "9px", opacity: 0.6, flexShrink: 0 }}>
                    {isExpanded ? "▲" : "▼"}
                  </span>
                )}
              </button>

              {/* 子分类展开渲染 */}
              {hasSubs && isExpanded && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "12px", marginTop: "2px", borderLeft: "1px dashed var(--rv-color-border-thin)", marginLeft: "18px" }}>
                  {subs.map((sub) => {
                    const isSubSelected = selectedCategoryId === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSelectedCategoryId(sub.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: "var(--rv-radius-xs)",
                          border: 0,
                          background: isSubSelected ? "rgba(15, 118, 110, 0.06)" : "transparent",
                          color: isSubSelected ? "var(--rv-color-primary)" : "var(--rv-color-text-muted)",
                          fontWeight: isSubSelected ? "700" : "500",
                          fontSize: "12px",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => {
                          if (!isSubSelected) {
                            e.currentTarget.style.color = "var(--rv-color-text-main)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSubSelected) {
                            e.currentTarget.style.color = "var(--rv-color-text-muted)";
                          }
                        }}
                      >
                        <span style={{ opacity: 0.5 }}>└─</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </aside>
  );
}
