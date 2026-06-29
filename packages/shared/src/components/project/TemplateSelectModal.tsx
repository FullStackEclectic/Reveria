import React, { useEffect, useState, useRef } from "react";
import { X, Sparkles, Folder, ArrowLeft, LayoutTemplate, Upload, Image as ImageIcon } from "lucide-react";
import { TemplateCategory, PromptTemplate, AssetSummary } from "../../types";
import { getJson, uploadAsset, assetUrl } from "../../utils";
import { AIAdvancedParamsPanel, AIAdvancedParams } from "../admin/AIAdvancedParamsPanel";
import { TemplateConfigView } from "./TemplateConfigView";
import { TemplateCard, CategorySidebar } from "./TemplateSubComponents";

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

  // 项目图片素材资产列表（用于参考图的素材库选择）
  const [projectAssets, setProjectAssets] = useState<AssetSummary[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 智能加载当前项目下的所有资产（素材库）以供微调面板选择参考图
  useEffect(() => {
    if (projectId) {
      getJson<AssetSummary[] | { success: boolean; data: AssetSummary[] }>(
        `/api/assets?project_id=${encodeURIComponent(projectId)}`
      )
        .then((res) => {
          if (Array.isArray(res)) {
            setProjectAssets(res);
          } else if (res && typeof res === "object" && Array.isArray((res as any).data)) {
            setProjectAssets((res as any).data);
          } else {
            setProjectAssets([]);
          }
        })
        .catch(() => setProjectAssets([]));
    }
  }, [projectId]);

  // 监听选中模板，自动初始化正反向提示词和高级参数，以修复文本框及画布生成空白的 Bug
  useEffect(() => {
    if (activeTemplate) {
      setPromptInput(activeTemplate.content || "");
      setNegativePromptInput(activeTemplate.negative_prompt || "");
      setUploadedImages([]);
      
      if (activeTemplate.advanced_params) {
        try {
          const parsed = JSON.parse(activeTemplate.advanced_params);
          setAdvParams(parsed || {});
        } catch (e) {
          setAdvParams({});
        }
      } else {
        setAdvParams({});
      }
    } else {
      setPromptInput("");
      setNegativePromptInput("");
      setUploadedImages([]);
      setAdvParams({});
    }
  }, [activeTemplate]);

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
          <TemplateConfigView
            activeTemplate={activeTemplate}
            promptInput={promptInput}
            setPromptInput={setPromptInput}
            negativePromptInput={negativePromptInput}
            setNegativePromptInput={setNegativePromptInput}
            uploadedImages={uploadedImages}
            setUploadedImages={setUploadedImages}
            isUploading={isUploading}
            fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
            handleUploadImage={handleUploadImage}
            advParams={advParams}
            setAdvParams={setAdvParams}
            handleStartGeneration={handleStartGeneration}
            projectAssets={projectAssets}
          />
        ) : (
          /* 模板分类与列表选择页 */
          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", overflow: "hidden", height: "100%" }}>
            {/* 左侧栏：分类选择 */}
            <CategorySidebar
              isLoading={isLoading}
              currentCats={currentCats}
              selectedCategoryId={selectedCategoryId}
              setSelectedCategoryId={setSelectedCategoryId}
              expandedCategoryIds={expandedCategoryIds}
              setExpandedCategoryIds={setExpandedCategoryIds}
            />

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
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: "16px"
                  }}
                >
                  {filteredTemplates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      tpl={tpl}
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
                    />
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
        .tpl-card-container:hover .tpl-card-img {
          transform: scale(1.08);
        }
        .tpl-card-container:hover .tpl-card-hover-overlay {
          opacity: 1 !important;
        }
        .tpl-card-container:hover .tpl-card-hover-badge {
          transform: translateY(0) !important;
        }
        .tpl-card-container:hover .tpl-card-hover-title {
          transform: translateY(0) !important;
        }
      `}</style>
    </div>
  );
}


