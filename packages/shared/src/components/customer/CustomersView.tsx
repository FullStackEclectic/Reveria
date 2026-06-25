import React, { FormEvent, useState } from "react";
import { Loader2, Save, Plus, Trash2, Edit, ArrowLeft, Search, Briefcase, FileText } from "lucide-react";
import { CustomerSummary, ProjectSummary, BrandKitSummary } from "../../types";
import { postJson, putJson, deleteJson } from "../../utils";
import "./CustomersView.css";


interface CustomersViewProps {
  customers: CustomerSummary[];
  setCustomers: React.Dispatch<React.SetStateAction<CustomerSummary[]>>;
  selectedCustomer: CustomerSummary | undefined;
  setSelectedCustomerId: (id: string) => void;
  projects: ProjectSummary[];
  brandKits: BrandKitSummary[];
  setBrandKits: React.Dispatch<React.SetStateAction<BrandKitSummary[]>>;
  customerEditForm: any;
  setCustomerEditForm: (form: any) => void;
  handleSaveCustomer: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  isSavingCustomer: boolean;
  setActiveView: (view: any) => void;
  setSelectedProjectId: (id: string) => void;
}

// 动态 HSL 首字母头像渐变生成器
function getAvatarGradient(name: string) {
  if (!name) return "linear-gradient(135deg, #0f766e, #0d9488)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 45) % 360;
  const s = 50 + (Math.abs(hash >> 8) % 12);
  const l = 42 + (Math.abs(hash >> 16) % 8);
  return `linear-gradient(135deg, hsl(${h1}, ${s}%, ${l}%), hsl(${h2}, ${s}%, ${l - 8}%))`;
}

// 提取首字符
function getFirstChar(name: string) {
  if (!name) return "C";
  const trimed = name.trim();
  return trimed.charAt(0).toUpperCase();
}

export function CustomersView({
  customers,
  setCustomers,
  selectedCustomer,
  setSelectedCustomerId,
  projects,
  brandKits,
  setBrandKits,
  customerEditForm,
  setCustomerEditForm,
  handleSaveCustomer,
  isSavingCustomer,
  setActiveView,
  setSelectedProjectId,
}: CustomersViewProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "brands">("profile");
  const [searchTerm, setSearchTerm] = useState("");
  const [hoveredCustomerId, setHoveredCustomerId] = useState("");

  // Inline Customer Create
  const [isAddingCustomerInline, setIsAddingCustomerInline] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Brand Kit local states
  const [editingBrandKit, setEditingBrandKit] = useState<BrandKitSummary | null>(null);
  const [isAddingBrand, setIsAddingBrand] = useState(false);
  const [newBrandKitName, setNewBrandKitName] = useState("");
  const [isCreatingBrandKit, setIsCreatingBrandKit] = useState(false);
  const [isSavingBrandKit, setIsSavingBrandKit] = useState(false);
  const [isDeletingBrandKitId, setIsDeletingBrandKitId] = useState("");
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);

  // Filter lists
  const filteredCustomers = customers.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      (c.industry && c.industry.toLowerCase().includes(term))
    );
  });

  const customerProjects = selectedCustomer
    ? projects.filter((p) => p.customer_id === selectedCustomer.id)
    : [];

  const customerBrandKits = selectedCustomer
    ? brandKits.filter((b) => b.customer_id === selectedCustomer.id)
    : [];

  // Reset detail sub-states on switching customer
  React.useEffect(() => {
    setEditingBrandKit(null);
    setIsAddingBrand(false);
    setNewBrandKitName("");
    setActiveTab("profile");
  }, [selectedCustomer?.id]);

  async function handleDeleteCustomerById(customer: CustomerSummary) {
    if (
      !window.confirm(
        `确定要删除客户「${customer.name}」吗？删除后该客户名下的品牌库与项目将变为未绑定客户状态，此操作无法撤销。`
      )
    ) {
      return;
    }
    setIsDeletingCustomer(true);
    try {
      await deleteJson(`/api/customers/${customer.id}`);
      const remaining = customers.filter((c) => c.id !== customer.id);
      setCustomers(remaining);
      if (selectedCustomer?.id === customer.id) {
        if (remaining.length > 0) {
          setSelectedCustomerId(remaining[0].id);
        } else {
          setSelectedCustomerId("");
        }
      }
    } catch (err: any) {
      alert(`删除客户失败: ${err?.message || err}`);
    } finally {
      setIsDeletingCustomer(false);
    }
  }

  async function handleCreateCustomerInline(e: FormEvent) {
    e.preventDefault();
    if (!newCustomerName.trim()) return;
    setIsCreatingCustomer(true);
    try {
      const workspaceId = customers[0]?.workspace_id || "00000000-0000-0000-0000-000000000000";
      const created = await postJson<CustomerSummary>("/api/customers", {
        workspace_id: workspaceId,
        name: newCustomerName.trim(),
        industry: "未指定",
        notes: "",
      });
      setCustomers((current) => [created, ...current]);
      setSelectedCustomerId(created.id);
      setNewCustomerName("");
      setIsAddingCustomerInline(false);
    } catch (err: any) {
      alert(`创建客户失败: ${err?.message || err}`);
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  async function handleCreateBrandKit(e: FormEvent) {
    e.preventDefault();
    if (!newBrandKitName.trim() || !selectedCustomer) return;
    setIsCreatingBrandKit(true);
    try {
      const brand = await postJson<BrandKitSummary>("/api/brand-kits", {
        workspace_id: selectedCustomer.workspace_id,
        customer_id: selectedCustomer.id,
        name: newBrandKitName.trim(),
      });
      setBrandKits((current) => [brand, ...current]);
      setNewBrandKitName("");
      setIsAddingBrand(false);
    } catch (err: any) {
      alert(`创建品牌库失败: ${err?.message || err}`);
    } finally {
      setIsCreatingBrandKit(false);
    }
  }

  async function handleUpdateBrandKit(e: FormEvent) {
    e.preventDefault();
    if (!editingBrandKit) return;
    setIsSavingBrandKit(true);
    try {
      const updated = await putJson<BrandKitSummary>(`/api/brand-kits/${editingBrandKit.id}`, {
        customer_id: editingBrandKit.customer_id,
        name: editingBrandKit.name,
        tone_of_voice: editingBrandKit.tone_of_voice || null,
        style_prompt: editingBrandKit.style_prompt || null,
        notes: editingBrandKit.notes || null,
      });
      setBrandKits((current) => current.map((b) => (b.id === updated.id ? updated : b)));
      setEditingBrandKit(null);
    } catch (err: any) {
      alert(`保存品牌库失败: ${err?.message || err}`);
    } finally {
      setIsSavingBrandKit(false);
    }
  }

  async function handleDeleteBrandKit(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm("确定要删除该品牌库吗？")) return;
    setIsDeletingBrandKitId(id);
    try {
      await deleteJson(`/api/brand-kits/${id}`);
      setBrandKits((current) => current.filter((b) => b.id !== id));
      if (editingBrandKit?.id === id) {
        setEditingBrandKit(null);
      }
    } catch (err: any) {
      alert(`删除品牌库失败: ${err?.message || err}`);
    } finally {
      setIsDeletingBrandKitId("");
    }
  }

  return (
    <section className="customer-workspace">
      <section className="customer-page-grid">
        
        {/* 左侧客户搜索与选择列表 */}
        <div className="customer-panel list-panel">
          <div className="customer-panel-header">
            <h3>客户合作列表</h3>
            <span>点击查看业务资产</span>
          </div>

          {/* 毛玻璃快速搜索条与新增按钮 */}
          <div className="rv-search-bar-container">
            <div className="rv-search-input-wrapper">
              <Search className="rv-search-icon" size={14} />
              <input
                className="rv-input-modern rv-search-input"
                placeholder="搜索名称或行业..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => setIsAddingCustomerInline(!isAddingCustomerInline)}
              title="快速录入客户"
              style={{
                width: "32px",
                height: "32px",
                minWidth: "32px",
                minHeight: "32px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, display: "block" }}
              >
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>

          {/* 行内直接添加客户输入层 */}
          {isAddingCustomerInline && (
            <form onSubmit={handleCreateCustomerInline} className="rv-inline-add-form">
              <input
                required
                autoFocus
                className="rv-input-modern"
                placeholder="客户名称，如：蓝天科技"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                style={{ fontSize: "12px" }}
              />
              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => { setIsAddingCustomerInline(false); setNewCustomerName(""); }}
                  style={{ padding: "2px 8px", fontSize: "11px" }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isCreatingCustomer}
                  style={{ padding: "2px 8px", fontSize: "11px" }}
                >
                  {isCreatingCustomer ? <Loader2 className="spin" size={12} /> : "创建"}
                </button>
              </div>
            </form>
          )}

          {/* 过滤列表渲染 */}
          <div className="customer-list-container">
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((customer) => {
                const isSelected = selectedCustomer?.id === customer.id;
                const associatedProjects = projects.filter((p) => p.customer_id === customer.id).length;
                const isDeleting = isDeletingCustomer && selectedCustomer?.id === customer.id;
                return (
                  <div
                    className={isSelected ? "customer-project-row selected" : "customer-project-row"}
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    onMouseEnter={() => setHoveredCustomerId(customer.id)}
                    onMouseLeave={() => setHoveredCustomerId("")}
                  >
                    {/* HSL 微渐变首字母头像 */}
                    <span
                      className="rv-avatar rv-avatar-sm"
                      style={{ background: getAvatarGradient(customer.name) }}
                    >
                      {getFirstChar(customer.name)}
                    </span>

                    <div className="info-content">
                      <strong>{customer.name}</strong>
                      <span className="rv-badge rv-badge-neutral" style={{ alignSelf: "flex-start" }}>
                        {customer.industry || "未填写行业"}
                      </span>
                    </div>

                    {/* 右侧部分：平时显示项目数，Hover 时显示快捷删除按钮 */}
                    <div style={{ display: "flex", alignItems: "center", minWidth: "50px", justifyContent: "flex-end" }}>
                      {hoveredCustomerId === customer.id ? (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteCustomerById(customer);
                          }}
                          disabled={isDeletingCustomer}
                          title="快速删除客户"
                          style={{
                            padding: "4px",
                            border: 0,
                            display: "flex",
                            alignItems: "center"
                          }}
                        >
                          {isDeleting ? (
                            <Loader2 className="spin" size={14} />
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      ) : (
                        <small style={{ color: "var(--rv-color-text-muted)", fontSize: "11px" }}>
                          {associatedProjects} 项目
                        </small>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ padding: "40px 10px", textAlign: "center", color: "var(--rv-color-text-muted)", fontSize: "12px" }}>
                无匹配的合作客户。
              </div>
            )}
          </div>
        </div>

        {/* 右侧详情面板 */}
        <div className="customer-panel detail-panel">
          {selectedCustomer ? (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "20px" }}>
              
              {/* Pro 风格 Hero 名片区 */}
              <div className="customer-hero-section">
                <span
                  className="rv-avatar rv-avatar-lg"
                  style={{ background: getAvatarGradient(selectedCustomer.name) }}
                >
                  {getFirstChar(selectedCustomer.name)}
                </span>
                <div className="customer-hero-meta">
                  <h2>{selectedCustomer.name}</h2>
                  <div className="customer-hero-info">
                    <span className="rv-badge rv-badge-primary">{selectedCustomer.industry || "通用行业"}</span>
                    <span>
                      共 {customerProjects.length} 个关联项目 · {customerBrandKits.length} 个专属 brand-kit 资产
                    </span>
                  </div>
                </div>
              </div>

              {/* 透明下划线 Tab */}
              <div className="tab-select-underline">
                <button
                  className={`tab-select-underline-btn ${activeTab === "profile" ? "active" : ""}`}
                  type="button"
                  onClick={() => setActiveTab("profile")}
                >
                  客户官方建档
                </button>
                <button
                  className={`tab-select-underline-btn ${activeTab === "brands" ? "active" : ""}`}
                  type="button"
                  onClick={() => setActiveTab("brands")}
                >
                  核心品牌资产
                </button>
              </div>

              {/* Tab 内容区 */}
              <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
                {activeTab === "profile" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                    <form className="form-grid detail-form" onSubmit={handleSaveCustomer}>
                      <label>
                        客户官方名称
                        <input
                          required
                          className="rv-input-modern"
                          value={customerEditForm.name}
                          onChange={(event) =>
                            setCustomerEditForm((current: any) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        所属细分行业
                        <input
                          className="rv-input-modern"
                          value={customerEditForm.industry}
                          onChange={(event) =>
                            setCustomerEditForm((current: any) => ({
                              ...current,
                              industry: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="wide-field">
                        合作跟进备注
                        <textarea
                          className="rv-input-modern"
                          rows={4}
                          value={customerEditForm.notes}
                          onChange={(event) =>
                            setCustomerEditForm((current: any) => ({
                              ...current,
                              notes: event.target.value,
                            }))
                          }
                          placeholder="在此处填写客户偏好、周期性需求或其他合作备注信息..."
                        />
                      </label>
                      <div className="form-actions-bar">
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => handleDeleteCustomerById(selectedCustomer)}
                          disabled={isDeletingCustomer}
                          style={{ padding: "8px 16px" }}
                        >
                          {isDeletingCustomer ? (
                            <Loader2 className="spin" size={16} />
                          ) : (
                            <Trash2 size={16} />
                          )}
                          删除客户
                        </button>
                        <button
                          className="primary-button"
                          type="submit"
                          disabled={isSavingCustomer}
                          style={{ padding: "8px 16px" }}
                        >
                          {isSavingCustomer ? (
                            <Loader2 className="spin" size={16} />
                          ) : (
                            <Save size={16} />
                          )}
                          保存基本档案
                        </button>
                      </div>
                    </form>

                    {/* 穿透跳转的关联项目模块 */}
                    <div className="associated-projects-section">
                      <h4>
                        <Briefcase size={14} style={{ color: "var(--rv-color-primary)" }} />
                        关联业务项目
                      </h4>
                      {customerProjects.length > 0 ? (
                        <div className="rv-project-slide-list">
                          {customerProjects.map((project) => (
                            <button
                              key={project.id}
                              type="button"
                              className="rv-project-slide-card"
                              onClick={() => {
                                setSelectedProjectId(project.id);
                                setActiveView("projects");
                              }}
                            >
                              <strong>{project.name}</strong>
                              <span className="rv-badge rv-badge-primary" style={{ alignSelf: "flex-start" }}>
                                {project.status === "active" ? "制作中" :
                                 project.status === "draft" ? "草稿" :
                                 project.status === "reviewing" ? "评审中" :
                                 project.status === "delivered" ? "已交付" : project.status}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: "12px", color: "var(--rv-color-text-muted)", margin: 0 }}>
                          当前客户暂无关联项目。
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === "brands" && (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                    {editingBrandKit ? (
                      /* 编辑单一品牌库表单 */
                      <form className="form-grid detail-form" onSubmit={handleUpdateBrandKit}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", gridColumn: "span 2", marginBottom: "10px" }}>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setEditingBrandKit(null)}
                            style={{ padding: "6px", minHeight: "32px", display: "flex", alignItems: "center" }}
                          >
                            <ArrowLeft size={16} />
                          </button>
                          <h4 style={{ margin: 0, fontSize: "14px", color: "#1c1917", fontWeight: "600" }}>配置品牌库配置项：{editingBrandKit.name}</h4>
                        </div>

                        <label className="wide-field">
                          品牌库显称
                          <input
                            required
                            className="rv-input-modern"
                            value={editingBrandKit.name}
                            onChange={(event) =>
                              setEditingBrandKit((current: any) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="wide-field">
                          文案语气与口吻 (Tone of voice)
                          <textarea
                            className="rv-input-modern"
                            rows={3}
                            value={editingBrandKit.tone_of_voice ?? ""}
                            placeholder="定义品牌文字气质，如：温暖治愈、科普严谨、幽默网感..."
                            onChange={(event) =>
                              setEditingBrandKit((current: any) => ({
                                ...current,
                                tone_of_voice: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="wide-field">
                          默认视觉风格提示词 (Style Prompt)
                          <textarea
                            className="rv-input-modern"
                            rows={3}
                            value={editingBrandKit.style_prompt ?? ""}
                            placeholder="配图生成的主力指示词，如：小红书日常风、极简北欧风、清新自然光..."
                            onChange={(event) =>
                              setEditingBrandKit((current: any) => ({
                                ...current,
                                style_prompt: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <label className="wide-field">
                          特定品牌备注
                          <textarea
                            className="rv-input-modern"
                            rows={2}
                            value={editingBrandKit.notes ?? ""}
                            placeholder="如常驻Logo位置、主色调RGB配置要求等..."
                            onChange={(event) =>
                              setEditingBrandKit((current: any) => ({
                                ...current,
                                notes: event.target.value,
                              }))
                            }
                          />
                        </label>

                        <div className="form-actions-bar">
                          <button
                            className="primary-button"
                            type="submit"
                            disabled={isSavingBrandKit}
                            style={{ padding: "8px 16px" }}
                          >
                            {isSavingBrandKit ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                            保存品牌配置
                          </button>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => setEditingBrandKit(null)}
                            style={{ padding: "8px 16px" }}
                          >
                            取消
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* 品牌列表 Grid 排版 */
                      <div className="brand-assets-container">
                        <div className="brand-assets-grid">
                          
                          {/* 磨砂加号卡片 */}
                          {!isAddingBrand ? (
                            <button
                              type="button"
                              className="rv-brand-add-card"
                              onClick={() => setIsAddingBrand(true)}
                            >
                              <Plus size={20} />
                              <span>添加核心品牌资产</span>
                            </button>
                          ) : (
                            <form
                              onSubmit={handleCreateBrandKit}
                              className="rv-brand-grid-card"
                            >
                              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
                                <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--rv-color-text-muted)" }}>新资产名称</span>
                                <input
                                  required
                                  autoFocus
                                  className="rv-input-modern"
                                  placeholder="如：吉列男士系列"
                                  value={newBrandKitName}
                                  onChange={(e) => setNewBrandKitName(e.target.value)}
                                  style={{ width: "100%", fontSize: "12px", padding: "6px 8px" }}
                                />
                              </div>
                              <div style={{ display: "flex", gap: "6px", width: "100%", justifyContent: "flex-end", marginTop: "12px" }}>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() => { setIsAddingBrand(false); setNewBrandKitName(""); }}
                                  style={{ padding: "2px 8px", fontSize: "11px" }}
                                >
                                  取消
                                </button>
                                <button
                                  type="submit"
                                  className="primary-button"
                                  disabled={isCreatingBrandKit}
                                  style={{ padding: "2px 8px", fontSize: "11px" }}
                                >
                                  {isCreatingBrandKit ? <Loader2 className="spin" size={12} /> : "创建"}
                                </button>
                              </div>
                            </form>
                          )}

                          {/* 已有品牌渲染 */}
                          {customerBrandKits.map((brand) => (
                            <div key={brand.id} className="rv-brand-grid-card">
                              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
                                <div className="brand-card-header">
                                  <strong>{brand.name}</strong>
                                  
                                  {/* 操作按钮区 */}
                                  <div className="brand-card-actions">
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() => setEditingBrandKit(brand)}
                                      title="配置品牌细节"
                                      style={{ padding: "4px", borderRadius: "6px", background: "transparent", border: 0 }}
                                    >
                                      <Edit size={13} style={{ color: "var(--rv-color-text-muted)" }} />
                                    </button>
                                    <button
                                      type="button"
                                      className="danger-button"
                                      onClick={(e) => {
                                        void handleDeleteBrandKit(brand.id, e);
                                      }}
                                      disabled={isDeletingBrandKitId === brand.id}
                                      title="移去该品牌"
                                      style={{ padding: "4px", borderRadius: "6px", background: "transparent", border: 0 }}
                                    >
                                      {isDeletingBrandKitId === brand.id ? (
                                        <Loader2 className="spin" size={12} />
                                      ) : (
                                        <Trash2 size={13} style={{ color: "#ef4444" }} />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* 配置项微型内凹容器 */}
                                <div className="rv-code-container">
                                  <div className="rv-code-line">
                                    <strong>口吻:</strong>
                                    <span>
                                      {brand.tone_of_voice || "未配置口吻"}
                                    </span>
                                  </div>
                                  <div className="rv-code-line">
                                    <strong>视觉:</strong>
                                    <span>
                                      {brand.style_prompt || "未配置提示词"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {customerBrandKits.length === 0 && (
                          <div style={{ padding: "40px 10px", textAlign: "center", color: "var(--rv-color-text-muted)", fontSize: "12px" }}>
                            当前客户尚无专属品牌资产库，请点击上方按钮录入。
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="customer-empty-state">
              <FileText size={48} style={{ opacity: 0.15 }} />
              <p>请在左侧列表中选定或录入一个客户以展开详情</p>
            </div>
          )}
        </div>
      </section>
    </section>
  );
}
