import React, { useEffect, useState, useRef } from "react";
import { X, Sparkles, Folder, ArrowLeft, LayoutTemplate, Upload, Image as ImageIcon } from "lucide-react";
import { TemplateCategory, PromptTemplate } from "../../types";
import { getJson, uploadAsset, assetUrl } from "../../utils";
import { AIAdvancedParamsPanel, AIAdvancedParams } from "../admin/AIAdvancedParamsPanel";

interface TemplateSelectModalProps {
  onClose: () => void;
  onGenerate: (
    template: PromptTemplate,
    payload: { prompt: string; negative_prompt: string; ratio: string; ref_image_url: string | null }
  ) => void;
  workspaceId: string;
  projectId: string;
  customerId?: string | null;
  currentUserId?: string | null;
}

export function TemplateSelectModal({
  onClose,
  onGenerate,
  workspaceId,
  projectId,
  customerId,
  currentUserId,
}: TemplateSelectModalProps) {
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("image-generation");
  const [isLoading, setIsLoading] = useState(false);

  // 展开的分类 ID
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);

  // 详情页交互状态
  const [activeTemplate, setActiveTemplate] = useState<PromptTemplate | null>(null);
  const [promptInput, setPromptInput] = useState("");
  const [negativePromptInput, setNegativePromptInput] = useState("");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 前台高阶生成参数微调状态
  const [advParams, setAdvParams] = useState<AIAdvancedParams>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadTemplates() {
      setIsLoading(true);
      try {
        const catRes = await getJson<{ success: boolean; data: TemplateCategory[] }>(
          "/api/template-categories"
        );
        if (catRes.success) {
          setCategories(catRes.data);
          if (catRes.data.length > 0) {
            // 默认选中并展开当前大类的首个一级分类
            const currentCats = catRes.data.filter(c => c.workflow_type === "image-generation");
            const firstRoot = currentCats.find(c => !c.parent_id);
            if (firstRoot) {
              setSelectedCategoryId(firstRoot.id);
              setExpandedCategoryIds([firstRoot.id]);
            } else if (currentCats.length > 0) {
              setSelectedCategoryId(currentCats[0].id);
            }
          }
        }

        const tplRes = await getJson<{ success: boolean; data: PromptTemplate[] }>(
          "/api/prompt-templates"
        );
        if (tplRes.success) {
          setTemplates(tplRes.data);
        }
      } catch (err) {
        console.error("加载画板模板失败:", err);
      } finally {
        setIsLoading(false);
      }
    }

    void loadTemplates();
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const currentCatsFiltered = categories.filter(c => c.workflow_type === tab);
    const firstRoot = currentCatsFiltered.find(c => !c.parent_id);
    if (firstRoot) {
      setSelectedCategoryId(firstRoot.id);
      setExpandedCategoryIds([firstRoot.id]);
    } else if (currentCatsFiltered.length > 0) {
      setSelectedCategoryId(currentCatsFiltered[0].id);
    } else {
      setSelectedCategoryId("");
    }
  };

  // 1. 过滤当前大类 Tab 下的分类
  const currentCats = categories.filter((c) => c.workflow_type === activeTab);

  // 2. 智能聚合选择：如果选中的是一级分类，自动包含该分类下所有二级子分类对应的模板
  const selectedCategoryIds = [selectedCategoryId];
  currentCats.forEach((c) => {
    if (c.parent_id === selectedCategoryId) {
      selectedCategoryIds.push(c.id);
    }
  });
  
  // 3. 过滤出符合大类和选中分类的模板
  const filteredTemplates = templates.filter(
    (t) => selectedCategoryIds.includes(t.category_id) && t.workflow_type === activeTab
  );

  // 上传图片处理
  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("workspace_id", workspaceId);
      formData.append("project_id", projectId);
      if (customerId) {
        formData.append("customer_id", customerId);
      }
      if (currentUserId) {
        formData.append("created_by", currentUserId);
      }
      formData.append("file", file);

      const asset = await uploadAsset(formData);
      if (asset.file_url || asset.thumbnail_url) {
        setUploadedImages([asset.thumbnail_url || asset.file_url || ""]);
      }
    } catch (err) {
      console.error("上传参考图失败:", err);
      alert("上传参考图失败，请稍后重试");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStartGeneration = () => {
    if (!activeTemplate) return;

    // 智能推导 ratio 字符串，以适配原有的卡片布局与大小算法
    let derivedRatio = "1:1";
    const aspect = advParams.aspect_ratio || "portrait";
    if (aspect === "portrait") {
      derivedRatio = "9:16(2k)";
    } else if (aspect === "landscape") {
      derivedRatio = "16:9(2k)";
    } else if (aspect === "square") {
      derivedRatio = "1:1(2k)";
    } else {
      // 自定义时根据宽高比来做智能适配
      const w = advParams.width || 1024;
      const h = advParams.height || 1024;
      if (w === h) derivedRatio = "1:1(2k)";
      else if (w > h) derivedRatio = "16:9(2k)";
      else derivedRatio = "9:16(2k)";
    }

    // 将微调后的所有高级参数重新序列化，回传进临时 template
    const finalTemplate: PromptTemplate = {
      ...activeTemplate,
      advanced_params: JSON.stringify(advParams),
      default_width: advParams.width || 768,
      default_height: advParams.height || 1152
    };

    onGenerate(finalTemplate, {
      prompt: promptInput,
      negative_prompt: negativePromptInput,
      ratio: derivedRatio,
      ref_image_url: uploadedImages.length > 0 ? uploadedImages[0] : null,
    });
    onClose();
  };

  return (
    <div
      className="rv-template-modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(28, 29, 33, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        animation: "fadeIn 0.2s ease-out",
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
      }}
    >
      <div
        className="rv-template-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "1400px",
          height: "880px",
          background: "var(--rv-color-bg-sidebar)",
          border: "1px solid var(--rv-color-border-thin)",
          borderRadius: "var(--rv-radius-lg)",
          boxShadow: "0 20px 40px rgba(28, 29, 33, 0.12), var(--rv-shadow-xl)",
          display: "grid",
          gridTemplateRows: "64px 1fr",
          overflow: "hidden",
          animation: "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
        }}
      >
        {/* 头部区域 */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            borderBottom: "1px solid var(--rv-color-border-thin)",
            background: "#ffffff"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {activeTemplate ? (
              <button
                type="button"
                onClick={() => setActiveTemplate(null)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--rv-color-text-muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  padding: "6px 12px 6px 4px",
                  borderRadius: "var(--rv-radius-xs)",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--rv-color-primary)";
                  e.currentTarget.style.background = "var(--rv-color-primary-light)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--rv-color-text-muted)";
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <ArrowLeft size={16} />
                返回模板列表
              </button>
            ) : (
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--rv-radius-xs)",
                  background: "var(--rv-color-primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--rv-color-primary)"
                }}
              >
                <LayoutTemplate size={16} />
              </div>
            )}

            {!activeTemplate && (
              <div>
                <h2 style={{ fontSize: "15px", fontWeight: "700", color: "var(--rv-color-text-main)", margin: 0 }}>预设提示词模板</h2>
                <p style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", margin: 0 }}>点击快速调用工作流和提示词直接在画板生成内容</p>
              </div>
            )}

            {activeTemplate && (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px", borderLeft: "1px solid var(--rv-color-border-thin)", paddingLeft: "16px" }}>
                <Sparkles size={14} style={{ color: "var(--rv-color-primary)" }} />
                <span style={{ fontSize: "15px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>
                  {activeTemplate.title}
                </span>
                <span style={{ fontSize: "10px", background: "rgba(15, 118, 110, 0.08)", color: "var(--rv-color-primary)", padding: "2px 6px", borderRadius: "2px", fontWeight: "bold" }}>
                  {activeTemplate.workflow_type === "video-generation" ? "视频生成" : activeTemplate.workflow_type === "text-generation" ? "文本生成" : "图像生成"}
                </span>
              </div>
            )}
          </div>

          {/* 前台大类切换 Segmented Tabs (仅在模板列表展示时显示) */}
          {!activeTemplate && (
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
                const label = tab === "image-generation" ? "🎨 图像大类" : tab === "video-generation" ? "🎬 视频大类" : "✍️ 文本大类";
                const tabColorsText = tab === "image-generation" ? "#0f766e" : tab === "video-generation" ? "#4f46e5" : "#d97706";
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => handleTabChange(tab)}
                    style={{
                      border: 0,
                      borderRadius: "8px",
                      padding: "6px 14px",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      background: isActive ? "#ffffff" : "transparent",
                      color: isActive ? tabColorsText : "#475569",
                      boxShadow: isActive ? "0 2px 6px rgba(0,0,0,0.05)" : "none",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--rv-color-text-muted)",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(0, 0, 0, 0.04)";
              e.currentTarget.style.color = "var(--rv-color-text-main)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--rv-color-text-muted)";
            }}
          >
            <X size={18} />
          </button>
        </header>

        {/* 主体交互区域 */}
        {activeTemplate ? (
          /* 模板配置与直接生成页：左右双栏 Remix 布局 */
          <div
            style={{
              padding: "24px",
              display: "grid",
              gridTemplateColumns: "580px 1fr",
              gap: "24px",
              height: "100%",
              overflow: "hidden",
              background: "#ffffff"
            }}
          >
            {/* 左栏：效果图高保真预览 */}
            <div 
              style={{ 
                display: "flex", 
                flexDirection: "column", 
                height: "100%", 
                borderRadius: "var(--rv-radius-md)",
                border: "1px solid var(--rv-color-border-thin)",
                overflow: "hidden",
                background: "var(--rv-color-bg-sidebar)",
                position: "relative",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.02)"
              }}
            >
              {activeTemplate.preview_url ? (
                <img
                  src={assetUrl(activeTemplate.preview_url)}
                  alt={activeTemplate.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px", background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)", color: "var(--rv-color-text-muted)" }}>
                  <LayoutTemplate size={48} style={{ strokeWidth: 1.2, opacity: 0.4 }} />
                  <span style={{ fontSize: "12px", opacity: 0.6 }}>极简提示词模板 · 暂无效果图</span>
                </div>
              )}

              {/* 推荐模型气泡 */}
              <div 
                style={{ 
                  position: "absolute", 
                  top: "12px", 
                  left: "12px", 
                  background: "rgba(255, 255, 255, 0.85)", 
                  backdropFilter: "blur(4px)", 
                  border: "1px solid rgba(15, 118, 110, 0.15)", 
                  borderRadius: "100px", 
                  padding: "4px 12px", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "6px", 
                  boxShadow: "0 4px 12px rgba(0,0,0,0.05)" 
                }}
              >
                <Sparkles size={12} style={{ color: "var(--rv-color-primary)" }} />
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--rv-color-primary)" }}>
                  {activeTemplate.model_id ? `模型：${activeTemplate.model_id}` : "模型：默认自动路由"}
                </span>
              </div>
            </div>

            {/* 右栏：参数配置与立即生成 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%", overflowY: "auto", paddingRight: "8px" }}>
              
              {/* 正向提示词 */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>提示词参数微调</span>
                <textarea
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  placeholder="在此微调正向提示词..."
                  style={{
                    width: "100%",
                    height: "80px",
                    background: "var(--rv-color-bg-sidebar)",
                    border: "1px solid var(--rv-color-border-thin)",
                    color: "var(--rv-color-text-main)",
                    borderRadius: "var(--rv-radius-xs)",
                    padding: "10px 12px",
                    fontSize: "12px",
                    lineHeight: "1.5",
                    fontFamily: "JetBrains Mono, monospace",
                    outline: "none",
                    resize: "none",
                    transition: "all 0.2s"
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "var(--rv-color-primary)"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "var(--rv-color-border-thin)"}
                />
              </div>

              {/* 生图模式展示反向提示词 */}
              {(activeTemplate.workflow_type === "image-generation" || activeTemplate.workflow_type === "video-generation") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>反向提示词 (Negative Prompt)</span>
                  <textarea
                    value={negativePromptInput}
                    onChange={(e) => setNegativePromptInput(e.target.value)}
                    placeholder="例如：watermark, blurry, bad quality..."
                    style={{
                      width: "100%",
                      height: "50px",
                      background: "rgba(239, 68, 68, 0.02)",
                      border: "1px solid rgba(239, 68, 68, 0.15)",
                      color: "var(--rv-color-text-main)",
                      borderRadius: "var(--rv-radius-xs)",
                      padding: "8px 12px",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      fontFamily: "JetBrains Mono, monospace",
                      outline: "none",
                      resize: "none",
                      transition: "all 0.2s"
                    }}
                  />
                </div>
              )}

              {/* 参考图上传区 */}
              {activeTemplate.need_image && activeTemplate.need_image > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)" }}>
                    参考照片 (需要 {activeTemplate.need_image} 张)
                  </span>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      height: "90px",
                      borderRadius: "var(--rv-radius-xs)",
                      border: "2px dashed var(--rv-color-border-thin)",
                      background: "var(--rv-color-bg-sidebar)",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      transition: "all 0.2s",
                      position: "relative",
                      overflow: "hidden"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--rv-color-primary)";
                      e.currentTarget.style.background = "var(--rv-color-primary-light)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--rv-color-border-thin)";
                      e.currentTarget.style.background = "var(--rv-color-bg-sidebar)";
                    }}
                  >
                    {isUploading ? (
                      <div style={{ fontSize: "11px", color: "var(--rv-color-primary)", fontWeight: "bold" }}>上传中...</div>
                    ) : uploadedImages.length > 0 ? (
                      <>
                        <img
                          src={uploadedImages[0]}
                          alt="参考图"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                        <div style={{ position: "absolute", bottom: "4px", right: "4px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "2px 6px", borderRadius: "2px", fontSize: "9px" }}>
                          更换图片
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload size={16} style={{ color: "var(--rv-color-text-muted)" }} />
                        <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>点击上传参考照片</span>
                      </>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleUploadImage}
                      accept="image/*"
                      style={{ display: "none" }}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "10px", padding: "10px", background: "rgba(15,118,110,0.05)", border: "1px solid rgba(15,118,110,0.1)", borderRadius: "var(--rv-radius-xs)" }}>
                  <ImageIcon size={14} style={{ color: "var(--rv-color-primary)", marginTop: "2px", flexShrink: 0 }} />
                  <div style={{ fontSize: "11px", color: "var(--rv-color-primary)", lineHeight: "1.4" }}>
                    本模板不需要参考图，可直接在下方微调参数并生成。
                  </div>
                </div>
              )}

              {/* 嵌入 Civitai 风格的高级参数微调面板 */}
              {activeTemplate.show_ratio !== false && (
                <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "12px", marginTop: "4px" }}>
                  <AIAdvancedParamsPanel
                    value={advParams}
                    onChange={setAdvParams}
                    showAdvancedToggle={true}
                  />
                </div>
              )}

              {/* 立即生成触发按钮 */}
              <div style={{ marginTop: "14px", paddingTop: "8px", borderTop: "1px solid var(--rv-color-border-thin)", flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleStartGeneration}
                  disabled={isUploading || ((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0)}
                  style={{
                    width: "100%",
                    minHeight: "42px",
                    background: "var(--rv-color-primary)",
                    border: 0,
                    borderRadius: "var(--rv-radius-xs)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: (isUploading || ((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0)) ? "not-allowed" : "pointer",
                    opacity: (isUploading || ((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0)) ? 0.6 : 1,
                    transition: "all 0.2s",
                    boxShadow: "var(--rv-shadow-md)"
                  }}
                  onMouseEnter={(e) => {
                    if (!isUploading && !((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0)) {
                      e.currentTarget.style.background = "hsl(170, 80%, 20%)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isUploading && !((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0)) {
                      e.currentTarget.style.background = "var(--rv-color-primary)";
                    }
                  }}
                >
                  <Sparkles size={16} />
                  立即在画布生成
                </button>
                {((activeTemplate.need_image ?? 0) > 0 && uploadedImages.length === 0) && (
                  <p style={{ margin: "6px 0 0", fontSize: "10px", color: "#ef4444", textAlign: "center" }}>
                    请先上传参考照片以激活生成
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* 模板分类与列表选择页 */
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", overflow: "hidden", height: "100%" }}>
            {/* 左侧栏：分类选择 */}
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
                (() => {
                  const rootCats = currentCats.filter((c) => !c.parent_id);
                  const getSubCats = (parentId: string) => currentCats.filter((c) => c.parent_id === parentId);
                  
                  const toggleExpand = (catId: string) => {
                    setExpandedCategoryIds(prev => 
                      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
                    );
                  };

                  return rootCats.map((root) => {
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
                  });
                })()
              )}
            </aside>

            {/* 右侧栏：模板卡片列表 */}
            <main style={{ padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", background: "#ffffff", height: "100%" }}>
              {isLoading ? (
                <div style={{ padding: "40px", color: "var(--rv-color-text-muted)", textAlign: "center", fontSize: "13px" }}>同步数据中...</div>
              ) : filteredTemplates.length === 0 ? (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--rv-color-text-muted)",
                    fontSize: "13px",
                    gap: "10px"
                  }}
                >
                  <Sparkles size={28} style={{ strokeWidth: 1.5, opacity: 0.3 }} />
                  <span>该分类下未录入模板，请在管理后台进行配置</span>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: "12px"
                  }}
                >
                  {filteredTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => {
                        setActiveTemplate(tpl);
                        setPromptInput(tpl.content);
                        setNegativePromptInput(tpl.negative_prompt || "");
                        setUploadedImages([]);
                        
                        let parsed: AIAdvancedParams = {};
                        try {
                          if (tpl.advanced_params) {
                            parsed = JSON.parse(tpl.advanced_params);
                          }
                        } catch (e) {
                          console.error("解析前台高级参数错误:", e);
                        }
                        setAdvParams(parsed);
                      }}
                      style={{
                        background: "var(--rv-color-bg-sidebar)",
                        border: "1px solid var(--rv-color-border-thin)",
                        borderRadius: "var(--rv-radius-xs)",
                        padding: "10px",
                        cursor: "pointer",
                        display: "flex",
                        gap: "12px",
                        transition: "all 0.2s",
                        height: "115px",
                        overflow: "hidden"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--rv-color-primary)";
                        e.currentTarget.style.background = "var(--rv-color-primary-light)";
                        e.currentTarget.style.boxShadow = "var(--rv-shadow-md)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--rv-color-border-thin)";
                        e.currentTarget.style.background = "var(--rv-color-bg-sidebar)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      {/* 左侧：精美封面缩略图 */}
                      <div style={{ width: "70px", height: "100%", borderRadius: "4px", overflow: "hidden", background: "var(--rv-color-bg-sidebar)", border: "1px solid var(--rv-color-border-thin)", flexShrink: 0 }}>
                        {tpl.preview_url ? (
                          <img src={assetUrl(tpl.preview_url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", color: "var(--rv-color-text-muted)" }}>
                            <LayoutTemplate size={20} style={{ opacity: 0.3 }} />
                          </div>
                        )}
                      </div>

                      {/* 右侧：标题与缩略信息 */}
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", overflow: "hidden" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "4px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--rv-color-text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tpl.title}</span>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <span style={{ fontSize: "8px", background: "rgba(15, 118, 110, 0.08)", color: "var(--rv-color-primary)", padding: "1px 4px", borderRadius: "2px", fontWeight: "bold" }}>
                                {tpl.workflow_type === "video-generation" ? "视频生成" : tpl.workflow_type === "text-generation" ? "文本生成" : "图像生成"}
                              </span>
                              {tpl.need_image && tpl.need_image > 0 ? (
                                <span style={{ fontSize: "8px", background: "rgba(245, 158, 11, 0.08)", color: "hsl(35, 90%, 40%)", padding: "1px 4px", borderRadius: "2px", fontWeight: "bold" }}>
                                  需图
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "2px", color: "var(--rv-color-primary)", fontSize: "10px", fontWeight: "700", flexShrink: 0 }}>
                            配置
                            <Sparkles size={8} />
                          </div>
                        </div>
                        <p style={{ margin: 0, fontSize: "10px", color: "var(--rv-color-text-muted)", lineHeight: "1.4", overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, textOverflow: "ellipsis", background: "#ffffff", padding: "4px 6px", borderRadius: "2px", border: "1px solid var(--rv-color-border-thin)", fontFamily: "monospace" }}>
                          {tpl.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </div>
        )}
      </div>
      {/* 帧动画样式 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
