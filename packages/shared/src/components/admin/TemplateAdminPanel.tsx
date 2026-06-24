import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, FolderPlus, Sparkles, X } from "lucide-react";
import { TemplateCategory, PromptTemplate, ModelSummary } from "../../types";
import { getJson, postJson, putJson, deleteJson, assetUrl } from "../../utils";
import { TemplateForm } from "./TemplateForm";

export function TemplateAdminPanel() {
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("image-generation");

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // 新建/编辑分类弹窗状态
  const [showCatModal, setShowCatModal] = useState(false);
  const [catFormName, setCatFormName] = useState("");
  const [catFormSort, setCatFormSort] = useState(0);
  const [catFormParentId, setCatFormParentId] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  // 编辑与新建模板状态
  const [editingTemplate, setEditingTemplate] = useState<Partial<PromptTemplate> | null>(null);
  const [showAddTemplate, setShowAddTemplate] = useState(false);

  const [models, setModels] = useState<ModelSummary[]>([]);

  // 大类主题配色映射
  const tabColors: Record<string, { bg: string; text: string; primary: string; hover: string; dark: string }> = {
    "image-generation": {
      bg: "rgba(15, 118, 110, 0.08)",
      text: "#0f766e",
      primary: "#0f766e",
      hover: "rgba(15, 118, 110, 0.04)",
      dark: "#0d9488"
    },
    "video-generation": {
      bg: "rgba(79, 70, 229, 0.08)",
      text: "#4f46e5",
      primary: "#4f46e5",
      hover: "rgba(79, 70, 229, 0.04)",
      dark: "#6366f1"
    },
    "text-generation": {
      bg: "rgba(217, 119, 6, 0.08)",
      text: "#d97706",
      primary: "#d97706",
      hover: "rgba(217, 119, 6, 0.04)",
      dark: "#f59e0b"
    }
  };

  // 1. 初始化拉取数据
  async function loadData() {
    setIsLoading(true);
    setErrorMsg("");
    try {
      const catRes = await getJson<{ success: boolean; data: TemplateCategory[] }>(
        "/api/admin/template-categories"
      );
      if (catRes.success) {
        setCategories(catRes.data);
      }

      const tplRes = await getJson<{ success: boolean; data: PromptTemplate[] }>(
        "/api/admin/prompt-templates"
      );
      if (tplRes.success) {
        setTemplates(tplRes.data);
      }

      const modelsRes = await getJson<{ success: boolean; data: ModelSummary[] }>(
        "/api/admin/models"
      );
      if (modelsRes.success) {
        setModels(modelsRes.data);
      }
    } catch (err: any) {
      setErrorMsg("数据加载失败：" + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // 自动淡出通知
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(""), 3000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(""), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMsg]);

  // Tab 大类切换处理器
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSelectedCategoryId(""); // 切换Tab重置具体子类筛选，右侧默认全量平铺该大类的模板
  };

  // 打开创建分类弹窗
  const openCreateCatModal = () => {
    setEditingCatId(null);
    setCatFormName("");
    setCatFormSort(0);
    setCatFormParentId("");
    setShowCatModal(true);
  };

  // 打开编辑分类弹窗
  const openEditCatModal = (cat: TemplateCategory) => {
    setEditingCatId(cat.id);
    setCatFormName(cat.name);
    setCatFormSort(cat.sort_order);
    setCatFormParentId(cat.parent_id || "");
    setShowCatModal(true);
  };

  // 保存或更新分类
  const handleSaveCategory = async () => {
    if (!catFormName.trim()) {
      setErrorMsg("分类名称不能为空");
      return;
    }
    try {
      if (editingCatId) {
        const res = await putJson<{ success: boolean; data: TemplateCategory }>(
          `/api/admin/template-categories/${editingCatId}`,
          {
            name: catFormName.trim(),
            sort_order: Number(catFormSort),
            parent_id: catFormParentId ? catFormParentId : null,
            workflow_type: activeTab
          }
        );
        if (res.success) {
          setCategories((curr) =>
            curr
              .map((c) => (c.id === res.data.id ? res.data : c))
              .sort((a, b) => a.sort_order - b.sort_order)
          );
          setSuccessMsg("分类更新成功");
        }
      } else {
        const res = await postJson<{ success: boolean; data: TemplateCategory }>(
          "/api/admin/template-categories",
          {
            name: catFormName.trim(),
            sort_order: Number(catFormSort),
            parent_id: catFormParentId ? catFormParentId : null,
            workflow_type: activeTab
          }
        );
        if (res.success) {
          setCategories((curr) => [...curr, res.data].sort((a, b) => a.sort_order - b.sort_order));
          setSuccessMsg("分类创建成功");
          if (!selectedCategoryId) {
            setSelectedCategoryId(res.data.id);
          }
        }
      }
      setShowCatModal(false);
    } catch (err: any) {
      setErrorMsg("保存分类失败：" + err.message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("确定要删除该分类吗？如果分类下有子分类或模板，删除会失败。")) return;
    try {
      const res = await deleteJson<{ success: boolean; message: string }>(
        `/api/admin/template-categories/${id}`
      );
      if (res.success) {
        setCategories((curr) => curr.filter((c) => c.id !== id));
        setSuccessMsg("分类删除成功");
        if (selectedCategoryId === id) {
          setSelectedCategoryId("");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "删除分类失败，可能下属仍有子分类或模板");
    }
  };

  // ==========================================
  // 模板操作
  // ==========================================
  async function handleAddTemplate(formData: Partial<PromptTemplate>) {
    try {
      // 必须关联一个有效的分类。如果用户在全量平铺时新建，默认归到该大类的首个分类下
      let targetCatId = selectedCategoryId;
      if (!targetCatId) {
        const firstCat = currentCats[0];
        if (!firstCat) {
          setErrorMsg("请先在左侧新建至少一个分类后再添加模板");
          return;
        }
        targetCatId = firstCat.id;
      }

      const res = await postJson<{ success: boolean; data: PromptTemplate }>(
        "/api/admin/prompt-templates",
        {
          ...formData,
          category_id: targetCatId,
          workflow_type: activeTab
        }
      );
      if (res.success) {
        setTemplates((curr) => [res.data, ...curr]);
        setShowAddTemplate(false);
        setSuccessMsg("提示词模板创建成功");
      }
    } catch (err: any) {
      setErrorMsg("创建模板失败：" + err.message);
    }
  }

  async function handleUpdateTemplate(formData: Partial<PromptTemplate>) {
    try {
      const res = await putJson<{ success: boolean; data: PromptTemplate }>(
        `/api/admin/prompt-templates/${formData.id}`,
        formData
      );
      if (res.success) {
        setTemplates((curr) => curr.map((t) => (t.id === res.data.id ? res.data : t)));
        setEditingTemplate(null);
        setSuccessMsg("提示词模板更新成功");
      }
    } catch (err: any) {
      setErrorMsg("更新模板失败：" + err.message);
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("确定要删除该提示词模板吗？")) return;
    try {
      const res = await deleteJson<{ success: boolean; message: string }>(
        `/api/admin/prompt-templates/${id}`
      );
      if (res.success) {
        setTemplates((curr) => curr.filter((t) => t.id !== id));
        setSuccessMsg("模板删除成功");
      }
    } catch (err: any) {
      setErrorMsg("删除模板失败：" + err.message);
    }
  }

  // 1. 过滤当前大类 Tab 下的分类
  const currentCats = categories.filter((c) => c.workflow_type === activeTab);

  // 2. 梳理分类树结构
  const rootCats = currentCats.filter((c) => !c.parent_id);
  const getSubCats = (parentId: string) => currentCats.filter((c) => c.parent_id === parentId);

  const orderedCategories: TemplateCategory[] = [];
  rootCats.forEach((root) => {
    orderedCategories.push(root);
    getSubCats(root.id).forEach((sub) => {
      orderedCategories.push(sub);
    });
  });

  // 3. 筛选具体分类下的模板列表（支持智能聚合，未选分类时显示大类下的所有模板）
  const selectedCategoryIds: string[] = [];
  if (selectedCategoryId) {
    selectedCategoryIds.push(selectedCategoryId);
    currentCats.forEach((c) => {
      if (c.parent_id === selectedCategoryId) {
        selectedCategoryIds.push(c.id);
      }
    });
  }

  const filteredTemplates = templates.filter((t) => {
    const matchesTab = t.workflow_type === activeTab;
    if (!matchesTab) return false;
    if (selectedCategoryIds.length > 0) {
      return selectedCategoryIds.includes(t.category_id);
    }
    return true; // 没选中具体分类时列出大类下的全部模板
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        background: "#ffffff",
        padding: "32px",
        height: "100vh",
        width: "100%",
        borderRadius: "0",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
        boxSizing: "border-box",
        overflow: "hidden"
      }}
    >
      {/* 浮动提示消息 */}
      {successMsg && (
        <div style={{ position: "fixed", top: "24px", right: "24px", background: "#0f766e", color: "#fff", padding: "12px 28px", borderRadius: "10px", boxShadow: "0 10px 25px -5px rgba(15,118,110,0.3)", zIndex: 10000, fontSize: "13px", fontWeight: "700", animation: "slideIn 0.2s ease-out" }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ position: "fixed", top: "24px", right: "24px", background: "#ef4444", color: "#fff", padding: "12px 28px", borderRadius: "10px", boxShadow: "0 10px 25px -5px rgba(239,68,68,0.3)", zIndex: 10000, fontSize: "13px", fontWeight: "700", animation: "slideIn 0.2s ease-out" }}>
          {errorMsg}
        </div>
      )}

      {/* 顶部 Segmented Control 大类 Tabs 选择器 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          paddingBottom: "20px",
          borderBottom: "1px solid #f1f5f9"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>提示词模板管理</h2>
            <p style={{ margin: 0, fontSize: "11px", color: "#64748b" }}>配置不同工作流的分类结构与大模型预设提示词</p>
          </div>

          {/* 分段按钮 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#f1f5f9",
              padding: "4px",
              borderRadius: "10px",
              gap: "2px"
            }}
          >
            {(["image-generation", "video-generation", "text-generation"] as const).map((tab) => {
              const isActive = activeTab === tab;
              const meta = tabColors[tab];
              const label = tab === "image-generation" ? "🎨 图像大类" : tab === "video-generation" ? "🎬 视频大类" : "✍️ 文本大类";
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  style={{
                    border: 0,
                    borderRadius: "8px",
                    padding: "8px 18px",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    background: isActive ? "#ffffff" : "transparent",
                    color: isActive ? meta.text : "#475569",
                    boxShadow: isActive ? "0 2px 8px -1px rgba(0,0,0,0.06)" : "none",
                    transition: "all 0.2s ease"
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 顶部操作区 */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            className="secondary-button"
            style={{ minHeight: "36px", padding: "0 16px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}
            onClick={openCreateCatModal}
          >
            <FolderPlus size={14} />
            新建子类
          </button>
          <button
            type="button"
            className="primary-button"
            style={{
              minHeight: "36px",
              padding: "0 18px",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: tabColors[activeTab].primary
            }}
            onClick={() => {
              setEditingTemplate(null);
              setShowAddTemplate(!showAddTemplate);
            }}
          >
            <Plus size={15} />
            新建提示词模板
          </button>
        </div>
      </div>

      {/* 主体交互布局：左侧分类树 + 右侧模板 Grid 网格 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: "20px",
          flex: 1,
          overflow: "hidden"
        }}
      >
        {/* 左侧：分类管理树卡片 */}
        <aside
          style={{
            paddingRight: "20px",
            borderRight: "1px solid #f1f5f9",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            overflow: "hidden"
          }}
        >
          <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#334155", display: "flex", alignItems: "center", gap: "6px" }}>
            <FolderPlus size={15} style={{ color: tabColors[activeTab].primary }} />
            分类树状结构
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", flex: 1, paddingRight: "4px" }}>
            {/* 重置选择/显示全部 */}
            <div
              onClick={() => setSelectedCategoryId("")}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "700",
                color: !selectedCategoryId ? tabColors[activeTab].text : "#475569",
                background: !selectedCategoryId ? tabColors[activeTab].bg : "transparent",
                border: !selectedCategoryId ? `1px solid ${tabColors[activeTab].primary}15` : "1px solid transparent",
                transition: "all 0.15s"
              }}
            >
              🌐 显示当前大类全部模板
            </div>

            {orderedCategories.length === 0 ? (
              <div style={{ padding: "30px 0", color: "#94a3b8", fontSize: "12px", textAlign: "center" }}>
                暂无分类，请点击上方“新建子类”创建。
              </div>
            ) : (
              orderedCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const isSub = !!cat.parent_id;

                return (
                  <div
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      paddingLeft: isSub ? "28px" : "12px",
                      borderRadius: "8px",
                      background: isSelected ? tabColors[activeTab].bg : "transparent",
                      border: isSelected ? `1px solid ${tabColors[activeTab].primary}15` : "1px solid transparent",
                      cursor: "pointer",
                      color: isSelected ? tabColors[activeTab].text : isSub ? "#64748b" : "#334155",
                      transition: "all 0.15s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                      <span style={{ fontSize: "12px", fontWeight: isSelected ? "700" : isSub ? "500" : "600", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {isSub ? `└─ ${cat.name}` : cat.name}
                      </span>
                      <span style={{ fontSize: "9px", color: "#94a3b8", opacity: 0.7 }}>({cat.sort_order})</span>
                    </div>

                    <div style={{ display: "flex", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        style={{ background: "transparent", border: 0, color: "#64748b", cursor: "pointer", padding: "2px" }}
                        onClick={() => openEditCatModal(cat)}
                        title="编辑分类"
                      >
                        <Edit2 size={11} />
                      </button>
                      <button
                        type="button"
                        style={{ background: "transparent", border: 0, color: "#ef4444", cursor: "pointer", padding: "2px" }}
                        onClick={() => handleDeleteCategory(cat.id)}
                        title="删除分类"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* 右侧：列表显示大屏 */}
        <main
          style={{
            paddingLeft: "10px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          {/* 新增/修改模板内联表单 */}
          {showAddTemplate && (
            <div style={{ marginBottom: "20px" }}>
              <TemplateForm
                initialData={{ workflow_type: activeTab }}
                models={models}
                onSubmit={handleAddTemplate}
                onCancel={() => setShowAddTemplate(false)}
              />
            </div>
          )}

          {editingTemplate && (
            <div style={{ marginBottom: "20px" }}>
              <TemplateForm
                initialData={editingTemplate}
                models={models}
                onSubmit={handleUpdateTemplate}
                onCancel={() => setEditingTemplate(null)}
              />
            </div>
          )}

          {/* 模板列表网格 */}
          <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
            {filteredTemplates.length === 0 ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "#94a3b8" }}>
                <Sparkles size={32} style={{ strokeWidth: 1.5, opacity: 0.4 }} />
                <span style={{ fontSize: "13px" }}>当前大类分类下尚无模板数据，请点击右上方“新建模板”进行录入。</span>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
                  gap: "18px"
                }}
              >
                {filteredTemplates.map((tpl) => {
                  if (editingTemplate?.id === tpl.id) return null;

                  return (
                    <div
                      key={tpl.id}
                      style={{
                        background: "#ffffff",
                        borderRadius: "12px",
                        border: "1px solid rgba(226, 232, 240, 0.8)",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        transition: "all 0.25s ease",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.03)",
                        position: "relative"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-4px)";
                        e.currentTarget.style.borderColor = tabColors[activeTab].primary;
                        e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.08)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.borderColor = "rgba(226, 232, 240, 0.8)";
                        e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.03)";
                      }}
                    >
                      {/* 封面效果图区 */}
                      <div style={{ height: "120px", width: "100%", overflow: "hidden", background: "#f8fafc", position: "relative" }}>
                        {tpl.preview_url ? (
                          <img
                            src={assetUrl(tpl.preview_url)}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          // 高端渐变抽象占位
                          <div style={{
                            width: "100%",
                            height: "100%",
                            background: `linear-gradient(135deg, ${tabColors[activeTab].primary} 0%, rgba(255,255,255,0.7) 100%)`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0.15
                          }} />
                        )}

                        {/* 绝对定位顶部大类胶囊标签 */}
                        <div style={{ position: "absolute", top: "10px", left: "10px" }}>
                          <span style={{ fontSize: "9px", background: "rgba(255,255,255,0.9)", color: tabColors[activeTab].text, padding: "3px 8px", borderRadius: "100px", fontWeight: "800", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                            {activeTab === "video-generation" ? "🎬 视频大类" : activeTab === "text-generation" ? "✍️ 文本创意" : "🎨 图像大类"}
                          </span>
                        </div>
                      </div>

                      {/* 核心描述卡片 */}
                      <div style={{ padding: "14px", display: "flex", flexDirection: "column", flex: 1, gap: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "800", color: "#1e293b", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flex: 1 }}>
                            {tpl.title}
                          </span>

                          {/* 右侧悬停操作按钮组 */}
                          <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTemplate(tpl);
                                setShowAddTemplate(false);
                              }}
                              style={{ background: "transparent", border: 0, padding: "2px", color: "#64748b", cursor: "pointer", transition: "color 0.2s" }}
                              title="修改模板"
                              onMouseEnter={(e) => e.currentTarget.style.color = tabColors[activeTab].primary}
                              onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTemplate(tpl.id)}
                              style={{ background: "transparent", border: 0, padding: "2px", color: "#ef4444", cursor: "pointer" }}
                              title="删除模板"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* 特征微胶囊 */}
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {tpl.need_image && tpl.need_image > 0 ? (
                            <span style={{ fontSize: "9px", background: "rgba(245, 158, 11, 0.06)", color: "hsl(35, 90%, 40%)", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>
                              📸 需参考图
                            </span>
                          ) : null}
                          {tpl.show_ratio !== false ? (
                            <span style={{ fontSize: "9px", background: "rgba(59, 130, 246, 0.06)", color: "hsl(215, 80%, 45%)", padding: "2px 6px", borderRadius: "4px", fontWeight: "700" }}>
                              📐 可选比例
                            </span>
                          ) : null}
                        </div>

                        {/* 代码提示词预热容器 */}
                        <div
                          style={{
                            flex: 1,
                            margin: "4px 0 0",
                            background: "#f8fafc",
                            border: "1px solid rgba(226, 232, 240, 0.6)",
                            padding: "8px 10px",
                            borderRadius: "6px",
                            maxHeight: "85px",
                            overflowY: "auto",
                            fontSize: "11px",
                            color: "#475569",
                            fontFamily: "JetBrains Mono, monospace",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                            lineHeight: "1.5"
                          }}
                        >
                          {tpl.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

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
                {editingCatId ? "📝 编辑分类" : "➕ 新建分类"}
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
    </div>
  );
}
