import React from "react";

interface CategoryEditModalProps {
  [key: string]: any;
}

export function CategoryEditModal(props: CategoryEditModalProps) {
      {/* 4. 高颜值内联模态弹窗 - 分类创建与编辑 */}
      {showCatModal && (
        <div
          onClick={() => setShowCatModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.35)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            animation: "fadeIn 0.2s ease-out"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "360px",
              background: "#ffffff",
              borderRadius: "14px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.05)",
              border: "1px solid rgba(226, 232, 240, 0.8)",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              animation: "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>
                {editingCatId ? "编辑分类" : "新建分类"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCatModal(false)}
                style={{ background: "transparent", border: 0, color: "#64748b", cursor: "pointer", display: "flex", padding: "4px" }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* 分类名称 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>分类名称</span>
                <input
                  type="text"
                  placeholder="请输入分类名称 (如：写真大片)"
                  value={catFormName}
                  onChange={(e) => setCatFormName(e.target.value)}
                  style={{ background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-main)", borderRadius: "var(--rv-radius-xs)", padding: "8px 12px", fontSize: "12px", width: "100%", outline: "none" }}
                />
              </div>

              {/* 上级分类 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>上级父级分类 (可选)</span>
                <select
                  value={catFormParentId}
                  onChange={(e) => setCatFormParentId(e.target.value)}
                  style={{ background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", padding: "8px", fontSize: "12px", outline: "none", cursor: "pointer", width: "100%" }}
                >
                  <option value="">(无/设为一级顶级分类)</option>
                  {rootCats
                    .filter((c) => c.id !== editingCatId) // 防止选择自己
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              {/* 排序 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>显示排序</span>
                <input
                  type="number"
                  value={catFormSort}
                  onChange={(e) => setCatFormSort(Number(e.target.value))}
                  style={{ background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", color: "var(--rv-color-text-main)", borderRadius: "var(--rv-radius-xs)", padding: "8px 12px", fontSize: "12px", width: "100%", outline: "none" }}
                />
              </div>
            </div>

            {/* 底部操作按钮 */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="button"
                className="secondary-button"
                style={{ minHeight: "34px", padding: "0 16px", fontSize: "12px" }}
                onClick={() => setShowCatModal(false)}
              >
                取消
              </button>
              <button
                type="button"
                className="primary-button"
                style={{ minHeight: "34px", padding: "0 18px", fontSize: "12px", background: tabColors[activeTab].primary }}
                onClick={handleSaveCategory}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
}
