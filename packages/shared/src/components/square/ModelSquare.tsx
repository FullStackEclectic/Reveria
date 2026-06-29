import React, { useEffect, useState } from "react";
import { 
  Sparkles, 
  Search, 
  Layers, 
  Tv, 
  FileText, 
  Image as ImageIcon,
  ArrowRight,
  TrendingUp,
  Cpu,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  User,
  Zap,
  Star,
  Home,
  BookOpen,
  Compass,
  LayoutTemplate,
  Award,
  FolderKanban,
  BriefcaseBusiness,
  UsersRound,
  Boxes,
  X,
  ArrowLeft,
  Upload
} from "lucide-react";
import { getJson, API_BASE } from "../../utils";
import { AIAdvancedParamsPanel, AIAdvancedParams } from "../admin/AIAdvancedParamsPanel";
import "./ModelSquare.css";

interface ModelSquareProps {
  currentUser: any;
  triggerLogin: (callback?: () => void) => void;
  onUseTemplate: (template: any) => void;
  onNavigateToView: (view: any) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categories: any[];
  setCategories: (cats: any[]) => void;
  selectedWorkflowType: string;
  setSelectedWorkflowType: (type: string) => void;
  selectedCategoryId: string;
  setSelectedCategoryId: (id: string) => void;
  projects?: any[];
  onUseTemplateWithProject?: (template: any, projectId: string) => void;
  selectedSubCategoryId: string;
  setSelectedSubCategoryId: (id: string) => void;
}

export function ModelSquare({
  currentUser,
  triggerLogin,
  onUseTemplate,
  onNavigateToView,
  searchQuery,
  setSearchQuery,
  categories,
  setCategories,
  selectedWorkflowType,
  setSelectedWorkflowType,
  selectedCategoryId,
  setSelectedCategoryId,
  selectedSubCategoryId,
  setSelectedSubCategoryId,
  projects = [],
  onUseTemplateWithProject,
}: ModelSquareProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [chosenRootCats, setChosenRootCats] = useState<any[]>([]);
  const [hotBlockRootCat, setHotBlockRootCat] = useState<string>("all");
  const [randomRootCats, setRandomRootCats] = useState<any[]>([]);
  
  // 轮播 Banner 状态
  const [activeSlide, setActiveSlide] = useState<number>(0);
  const [selectedDetailTemplate, setSelectedDetailTemplate] = useState<any | null>(null);

  // 1. 初始化拉取公开数据
  useEffect(() => {
    async function initSquareData() {
      setLoading(true);
      try {
        const [tempsRes, modelsRes] = await Promise.all([
          getJson<any>("/api/prompt-templates"),
          getJson<any[]>("/api/admin/models")
        ]);

        if (tempsRes && tempsRes.success) {
          setTemplates(tempsRes.data || []);
        }
        if (Array.isArray(modelsRes)) {
          setModels(modelsRes);
        }
      } catch (err) {
        console.error("Failed to load square portal data:", err);
      } finally {
        setLoading(false);
      }
    }
    void initSquareData();
  }, []);

  useEffect(() => {
    if (categories.length > 0) {
      const roots = categories.filter(c => !c.parent_id);
      setChosenRootCats(roots.slice(0, 2));
    }
  }, [categories]);

  useEffect(() => {
    if (categories.length > 0 && templates.length > 0 && randomRootCats.length === 0) {
      const roots = categories.filter(c => !c.parent_id);
      if (roots.length > 0) {
        const rootsWithTemplates = roots.filter(root => 
          templates.some(t => {
            const cat = categories.find(c => c.id === t.category_id);
            return cat && (cat.id === root.id || cat.parent_id === root.id);
          })
        );
        
        const shuffle = (arr: any[]) => {
          const newArr = [...arr];
          for (let i = newArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
          }
          return newArr;
        };

        let chosen = shuffle(rootsWithTemplates);
        if (chosen.length < 3) {
          const remainingRoots = roots.filter(r => !rootsWithTemplates.some(wt => wt.id === r.id));
          const chosenRemaining = shuffle(remainingRoots);
          chosen = [...chosen, ...chosenRemaining];
        }

        setRandomRootCats(chosen.slice(0, 3));
      }
    }
  }, [categories, templates, randomRootCats]);

  // Banner 自动轮播 (5秒切换)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // 2. 最终过滤后的模板卡片
  const filteredTemplates = templates.filter(t => {
    // 匹配工作流类型
    if (selectedWorkflowType !== "all") {
      const parentCat = categories.find(c => c.id === t.category_id);
      if (!parentCat || parentCat.workflow_type !== selectedWorkflowType) {
        return false;
      }
    }
    // 匹配分类 ID
    if (selectedCategoryId !== "all") {
      const currentCat = categories.find(c => c.id === t.category_id);
      const matchesSelf = t.category_id === selectedCategoryId;
      const matchesParent = currentCat && currentCat.parent_id === selectedCategoryId;
      if (!matchesSelf && !matchesParent) {
        return false;
      }
    }
    // 匹配二级分类 ID
    if (selectedSubCategoryId !== "all") {
      if (t.category_id !== selectedSubCategoryId) {
        return false;
      }
    }
    // 匹配搜索词
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      const titleMatch = t.title?.toLowerCase().includes(query);
      const contentMatch = t.content?.toLowerCase().includes(query);
      if (!titleMatch && !contentMatch) {
        return false;
      }
    }
    return true;
  });

  // 3. 过滤后的模型
  const filteredModels = models.filter(m => {
    if (selectedWorkflowType !== "all") {
      return m.workflow_type === selectedWorkflowType;
    }
    return true;
  });

  const getWorkflowBadge = (type: string) => {
    switch (type) {
      case "image-generation":
        return <span className="square-badge badge-image"><ImageIcon size={10} /> 图像</span>;
      case "video-generation":
        return <span className="square-badge badge-video"><Tv size={10} /> 视频</span>;
      case "text-generation":
        return <span className="square-badge badge-text"><FileText size={10} /> 文本</span>;
      default:
        return <span className="square-badge badge-other">通用</span>;
    }
  };

  const handleUseTemplate = (template: any) => {
    if (!currentUser) {
      triggerLogin(() => onUseTemplate(template));
    } else {
      onUseTemplate(template);
    }
  };

  // 根据模型名称或顺序映射高还原度插图
  const getModelCoverImage = (index: number, name: string) => {
    const lowerName = (name || "").toLowerCase();
    if (lowerName.includes("text") || lowerName.includes("gpt") || lowerName.includes("qwen")) {
      return `${API_BASE}/api/files/model_anime.png`;
    }
    if (lowerName.includes("video")) {
      return `${API_BASE}/api/files/model_cg_car.png`;
    }
    if (lowerName.includes("sd") || lowerName.includes("diffusion")) {
      return `${API_BASE}/api/files/model_cyberpunk.png`;
    }
    const mod = index % 4;
    if (mod === 0) return `${API_BASE}/api/files/model_anime.png`;
    if (mod === 1) return `${API_BASE}/api/files/model_portrait.png`;
    if (mod === 2) return `${API_BASE}/api/files/model_cg_car.png`;
    return `${API_BASE}/api/files/model_cyberpunk.png`;
  };

  // 精选小推荐静态列表
  const featuredTools = [
    { title: "原创角色创建者", desc: "从零设计创意动漫角色及人像", badge: "爆款", color: "#ec4899", icon: Sparkles },
    { title: "动漫实验室", desc: "动漫人物、场景及动作快捷融合", badge: "新", color: "#10b981", icon: ImageIcon },
    { title: "照片级工作室", desc: "生成照相馆级的高清人像与写真", badge: "精选", color: "#3b82f6", icon: User },
    { title: "无缝视频", desc: "从首帧开始生成稳定抗噪视频", badge: "极速", color: "#a855f7", icon: Tv },
    { title: "智能编辑", desc: "重绘、扩图并精雕细琢任何区域", badge: "强大", color: "#f59e0b", icon: Layers },
    { title: "从零开始建", desc: "搭建你的专属创意工作区和画板", badge: "自由", color: "#ef4444", icon: LayoutTemplate },
    { title: "数字分身", desc: "极简上传生成属于你的数字形象", badge: "爆款", color: "#06b6d4", icon: Compass },
    { title: "社交媒体趋势", desc: "自动跟踪监控当下热门生图风格", badge: "热门", color: "#84cc16", icon: TrendingUp },
  ];

  // 并排 Banner 定义
  const slides = [
    {
      title: "Happy Horse 1.1",
      desc: "马儿泡澡，狂热折扣进行中！上传生图瓜分大礼。",
      tag: "限时促销",
      image: `${API_BASE}/api/files/banner_happy_horse.png`
    },
    {
      title: "Tensor Forge Cup 2026",
      desc: "赛场狂热，一句话赢下你的世界杯！上传生图即刻瓜分百万点数，点击加入限时战局。",
      tag: "限时挑战赛",
      image: `${API_BASE}/api/files/banner_tensor_forge.png`
    },
    {
      title: "Seedance 2.0 智能视频",
      desc: "全新 4K 极清视频通道发布，动态平滑防波动，突破时空局限。点击体验首帧高精度模拟。",
      tag: "重磅发布",
      image: `${API_BASE}/api/files/banner_seedance.png`
    }
  ];

  return (
    <div className="square-portal-container">
      {/* 右侧大内容区 */}
      <div className="square-right-scroll-wrapper">
        
            {/* Banner 并排小卡片区 */}
            <section className="square-banners-row">
              {slides.map((slide, idx) => (
                <div 
                  key={idx} 
                  className="square-banner-card"
                  style={{
                    backgroundImage: slide.image ? `url(${slide.image})` : "linear-gradient(135deg, #1e1b4b 0%, #311042 100%)"
                  }}
                  onClick={() => {
                    if (!currentUser) triggerLogin();
                    else onNavigateToView("workbench");
                  }}
                >
                  <div className="banner-card-overlay"></div>
                  <div className="banner-card-content">
                    <span className="banner-card-tag">{slide.tag}</span>
                    <h3 className="banner-card-title">{slide.title}</h3>
                    <p className="banner-card-desc">{slide.desc}</p>
                  </div>
                </div>
              ))}
              
              <button 
                type="button" 
                className="banner-scroll-arrow-right" 
                title="更多推荐" 
                onClick={() => alert("已加载全部推荐")}
              >
                <ChevronRight size={16} />
              </button>
            </section>

        {/* 主体大版面 */}
        <div className="square-main-content-flow">
          


          {/* 精选功能推荐网格 */}
          <section className="square-content-section" style={{ marginTop: "24px" }}>
            <h3 className="section-title-label">精选</h3>
            <div className="featured-tools-grid">
              {featuredTools.map((tool, idx) => {
                const Icon = tool.icon;
                return (
                  <div key={idx} className="featured-tool-card" onClick={() => handleUseTemplate(null)}>
                    <div className="tool-icon-wrapper" style={{ background: `${tool.color}15`, color: tool.color }}>
                      <Icon size={16} />
                    </div>
                    <div className="tool-text">
                      <h4>
                        {tool.title}
                        <span className="tool-badge-pill" style={{ background: tool.color }}>{tool.badge}</span>
                      </h4>
                      <p>{tool.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 热门分类 (Hot Categories) 区块 - 完全还原图三卡片样式，推荐分类而非模型 */}
          <section className="square-content-section" style={{ marginTop: "32px" }}>
            <div className="section-header-bar" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: "12px", paddingBottom: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                <h3 className="section-title-label" style={{ margin: 0 }}><Cpu size={16} /> 热门分类 (Hot Categories)</h3>
                <span className="view-more-btn" style={{ fontSize: "12px", color: "#a8a29e", cursor: "pointer" }} onClick={() => alert("已加载全部热门分类")}>查看更多 (View More) &gt;</span>
              </div>
              
              {/* 一级分类过滤胶囊标签栏 (移至标题下方，但依然处于底部分割线之上) */}
              <div className="square-hot-filter-bar" style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "4px 0 0 0" }}>
                <span 
                  className={`sub-category-capsule ${hotBlockRootCat === "all" ? "active" : ""}`}
                  onClick={() => setHotBlockRootCat("all")}
                >
                  全部
                </span>
                {categories.filter(c => !c.parent_id).map((cat) => (
                  <span 
                    key={cat.id}
                    className={`sub-category-capsule ${hotBlockRootCat === cat.id ? "active" : ""}`}
                    onClick={() => setHotBlockRootCat(cat.id)}
                  >
                    {cat.name}
                  </span>
                ))}
              </div>
            </div>

            {/* 热门二级分类卡片网格 */}
            {loading ? (
              <div className="square-flow-loading">
                <span className="loader-ring"></span>
              </div>
            ) : categories.filter(c => c.parent_id).length === 0 ? (
              <div className="square-empty-state">暂无分类数据</div>
            ) : (
              <div className="models-cover-grid" style={{ marginBottom: "24px" }}>
                {categories
                  .filter(c => {
                    if (!c.parent_id) return false;
                    if (hotBlockRootCat !== "all") {
                      return c.parent_id === hotBlockRootCat;
                    }
                    return true;
                  })
                  .slice(0, 5)
                  .map((subCat, idx) => {
                    const parent = categories.find(p => p.id === subCat.parent_id);
                    const parentName = parent ? parent.name.replace("大类", "") : "IMAGE";
                    
                    // 获取根据分类名称映射的封面图
                    const getCategoryCoverImage = (name: string, index: number) => {
                      const n = (name || "").toLowerCase();
                      if (n.includes("动漫") || n.includes("漫画") || index === 0) {
                        return `${API_BASE}/api/files/model_anime.png`;
                      }
                      if (n.includes("写真") || n.includes("摄影") || index === 1) {
                        return `${API_BASE}/api/files/model_portrait.png`;
                      }
                      if (n.includes("3d") || n.includes("cgi") || index === 2) {
                        return `${API_BASE}/api/files/model_cg_car.png`;
                      }
                      if (n.includes("科幻") || n.includes("未来") || index === 3) {
                        return `${API_BASE}/api/files/model_cyberpunk.png`;
                      }
                      return `${API_BASE}/api/files/banner_seedance.png`;
                    };

                    const favCountVal = Math.floor((idx + 1) * 85 + 24);

                    return (
                      <div 
                        key={subCat.id} 
                        className={`model-cover-card ${selectedSubCategoryId === subCat.id ? "active-border" : ""}`}
                        onClick={() => {
                          if (parent) setSelectedCategoryId(parent.id);
                          setSelectedSubCategoryId(subCat.id);
                        }}
                        style={{ border: selectedSubCategoryId === subCat.id ? "1.5px solid #1c1917" : "" }}
                      >
                        <div 
                          className="card-cover-image"
                          style={{ backgroundImage: `url(${getCategoryCoverImage(subCat.name, idx)})` }}
                        >
                          <div className="cover-badge-top">
                            <span 
                              className="model-type-badge"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                background: "rgba(255, 255, 255, 0.8)",
                                backdropFilter: "blur(8px)",
                                border: "1px solid rgba(255, 255, 255, 0.3)",
                                color: "#1c1917",
                                fontSize: "10px",
                                fontWeight: "800",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
                                letterSpacing: "0.2px"
                              }}
                            >
                              {parentName} | {subCat.name}
                            </span>
                          </div>
                          <div className="cover-overlay-glow"></div>
                          <div className="cover-title-bottom" style={{ display: "flex", justifyContent: "flex-end", width: "calc(100% - 24px)", left: "12px", right: "12px", bottom: "12px", position: "absolute", zIndex: 4 }}>
                            <span style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.85)", display: "flex", alignItems: "center", gap: "3px", fontWeight: "700" }}>
                              ⚡ {Math.floor((idx + 1) * 314)} 活跃
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
            )}


          </section>

          {/* 随机一级分类推荐专区 */}
          {loading ? (
            <div className="square-flow-loading">
              <span className="loader-ring"></span>
            </div>
          ) : randomRootCats.length === 0 ? (
            <section className="square-content-section" style={{ marginTop: "40px", marginBottom: "60px" }}>
              <div className="square-empty-state">
                <Bookmark size={32} />
                <p>暂无已发布的分类专区</p>
              </div>
            </section>
          ) : (
            randomRootCats.map((rootCat) => {
              const catTemplates = templates.filter(t => {
                const cat = categories.find(c => c.id === t.category_id);
                return cat && (cat.id === rootCat.id || cat.parent_id === rootCat.id);
              });

              return (
                <section key={rootCat.id} className="square-content-section" style={{ marginTop: "40px", marginBottom: "40px" }}>
                  <div className="section-header-bar">
                    <h3 className="section-title-label"><TrendingUp size={16} /> {rootCat.name}</h3>
                    <span className="desc">一键同步画板配置，直接拉取高级参数</span>
                  </div>

                  {catTemplates.length === 0 ? (
                    <div className="square-empty-state">
                      <Bookmark size={32} />
                      <p>该分类下暂无已发布的工作流模板</p>
                    </div>
                  ) : (
                    <div className="templates-cover-grid">
                      {catTemplates.map((temp, idx) => {
                        const associatedCat = categories.find(c => c.id === temp.category_id);
                        return (
                          <div 
                            key={temp.id} 
                            className="template-cover-card"
                            onClick={() => setSelectedDetailTemplate(temp)}
                            style={{ cursor: "pointer" }}
                          >
                            <div 
                              className="temp-image-header"
                              style={{ backgroundImage: `url(${getModelCoverImage(idx, temp.title)})`, height: "200px" }}
                            >
                              <div className="cover-badge-top">
                                <span 
                                  className="cat-pill"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    background: "rgba(255, 255, 255, 0.8)",
                                    backdropFilter: "blur(8px)",
                                    border: "1px solid rgba(255, 255, 255, 0.3)",
                                    color: "#1c1917",
                                    fontSize: "10px",
                                    fontWeight: "800",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
                                  }}
                                >
                                  {associatedCat?.name || "精选预设"}
                                </span>
                              </div>
                              <div className="cover-overlay-glow"></div>
                              <div className="cover-title-bottom" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "calc(100% - 24px)", left: "12px", right: "12px", bottom: "12px", position: "absolute", zIndex: 4 }}>
                                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#ffffff", textShadow: "0 1px 4px rgba(0,0,0,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }} title={temp.title}>
                                  {temp.title}
                                </h4>
                                <span style={{ fontSize: "10px", color: "rgba(255, 255, 255, 0.85)", display: "flex", alignItems: "center", gap: "3px", fontWeight: "700" }}>
                                  ⚡ {temp.default_width}×{temp.default_height}
                                </span>
                              </div>
                              <button 
                                className="temp-hover-btn-use" 
                                style={{ pointerEvents: "none" }}
                              >
                                立即生成 <ArrowRight size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          )}

        </div>
      </div>

      {/* 模板详情弹窗 (Workflow Template Detail Modal) */}
      {selectedDetailTemplate && (
        <TemplateDetailModal
          template={selectedDetailTemplate}
          categoryName={categories.find(c => c.id === selectedDetailTemplate.category_id)?.name || "精选预设"}
          coverImage={getModelCoverImage(templates.indexOf(selectedDetailTemplate), selectedDetailTemplate.title)}
          onClose={() => setSelectedDetailTemplate(null)}
          onStart={() => {
            const temp = selectedDetailTemplate;
            setSelectedDetailTemplate(null);
            handleUseTemplate(temp);
          }}
          projects={projects}
          onUseWithProject={(projectId) => {
            if (onUseTemplateWithProject) {
              onUseTemplateWithProject(selectedDetailTemplate, projectId);
            }
            setSelectedDetailTemplate(null);
          }}
        />
      )}
    </div>
  );
}

interface TemplateDetailModalProps {
  template: any;
  categoryName: string;
  coverImage: string;
  onClose: () => void;
  onStart: () => void;
  projects?: any[];
  onUseWithProject?: (projectId: string) => void;
}

function TemplateDetailModal({
  template,
  categoryName,
  coverImage,
  onClose,
  onStart,
  projects = [],
  onUseWithProject,
}: TemplateDetailModalProps) {
  const [targetProjectId, setTargetProjectId] = useState<string>("new");
  const [promptInput, setPromptInput] = useState(template.content || "");
  const [negativePromptInput, setNegativePromptInput] = useState(template.negative_prompt || "deformed, blurry, bad teeth");
  
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 初始化并双向绑定高级 Civitai 风格微调参数（LoRA, VAE, 去噪强度, 宽高比例等）
  const [advParams, setAdvParams] = useState<AIAdvancedParams>({
    negative_prompt: template.negative_prompt || "deformed, blurry, bad teeth",
    loras: template.loras ? (typeof template.loras === "string" ? JSON.parse(template.loras) : template.loras) : [
      { name: "AnimeStyle", weight: 0.8 }
    ],
    embeddings: [],
    controlnets: [],
    vae: "auto",
    denoising_strength: 0.6,
    aspect_ratio: "2:3",
    width: 768,
    height: 1152,
  });

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setUploadedImages([event.target.result as string]);
      }
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div 
      className="login-modal-overlay" 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ 
        zIndex: 1100,
        fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
      }}
    >
      <div
        className="rv-template-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "94vw",
          maxWidth: "1480px",
          height: "92vh",
          maxHeight: "960px",
          background: "#ffffff",
          border: "1px solid var(--rv-color-border-thin)",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "grid",
          gridTemplateRows: "64px 1fr 68px",
          overflow: "hidden",
          animation: "cardZoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
        }}
      >
        {/* 1. 顶部 Header 区域 */}
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
            <button
              type="button"
              onClick={onClose}
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
                borderRadius: "4px",
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

            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px", borderLeft: "1px solid var(--rv-color-border-thin)", paddingLeft: "16px" }}>
              <Sparkles size={14} style={{ color: "var(--rv-color-primary)" }} />
              <span style={{ fontSize: "15px", fontWeight: "700", color: "#1c1917" }}>
                {template.title}
              </span>
              <span style={{ fontSize: "10px", background: "rgba(15, 118, 110, 0.08)", color: "var(--rv-color-primary)", padding: "2px 6px", borderRadius: "2px", fontWeight: "bold" }}>
                {template.workflow_type === "video-generation" ? "视频生成" : template.workflow_type === "text-generation" ? "文本生成" : "图像生成"}
              </span>
            </div>
          </div>

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

        {/* 2. 主体左右双栏 Remix 布局 */}
        <div
          style={{
            padding: "24px",
            display: "grid",
            gridTemplateColumns: "600px 1fr",
            gap: "24px",
            height: "100%",
            overflow: "hidden",
            background: "#ffffff",
            boxSizing: "border-box"
          }}
        >
          {/* 左栏：高清封面大图高保真预览 */}
          <div 
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              height: "100%", 
              borderRadius: "12px",
              border: "1px solid var(--rv-color-border-thin)",
              overflow: "hidden",
              background: "var(--rv-color-bg-sidebar)",
              position: "relative",
              boxShadow: "inset 0 0 20px rgba(0,0,0,0.02)"
            }}
          >
            <img
              src={coverImage}
              alt={template.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />

            {/* 推荐模型悬浮气泡标 */}
            <div 
              style={{ 
                position: "absolute", 
                top: "12px", 
                left: "12px", 
                background: "rgba(255, 255, 255, 0.9)", 
                backdropFilter: "blur(6px)", 
                border: "1px solid rgba(15, 118, 110, 0.2)", 
                borderRadius: "100px", 
                padding: "4px 12px", 
                display: "flex", 
                alignItems: "center", 
                gap: "6px", 
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                zIndex: 5
              }}
            >
              <Sparkles size={12} style={{ color: "var(--rv-color-primary)" }} />
              <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--rv-color-primary)" }}>
                {template.model_id ? `模型：${template.model_id}` : "模型：默认智能推荐"}
              </span>
            </div>
          </div>

          {/* 右栏：参数配置与一键生成（可上下纵向拉伸滚动） */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%", overflowY: "auto", paddingRight: "8px", boxSizing: "border-box" }}>
            
            {/* 1. 正向提示词 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#1c1917" }}>提示词参数微调</span>
              <textarea
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                placeholder="在此微调正向提示词..."
                style={{
                  width: "100%",
                  height: "80px",
                  background: "var(--rv-color-bg-sidebar)",
                  border: "1px solid var(--rv-color-border-thin)",
                  color: "#1c1917",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  fontFamily: "JetBrains Mono, monospace",
                  outline: "none",
                  resize: "none",
                  transition: "all 0.2s",
                  boxSizing: "border-box"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "var(--rv-color-primary)"}
                onBlur={(e) => e.currentTarget.style.borderColor = "var(--rv-color-border-thin)"}
              />
            </div>

            {/* 2. 反向提示词 */}
            {(template.workflow_type === "image-generation" || template.workflow_type === "video-generation" || !template.workflow_type) && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#1c1917" }}>反向提示词 (Negative Prompt)</span>
                <textarea
                  value={negativePromptInput}
                  onChange={(e) => setNegativePromptInput(e.target.value)}
                  placeholder="例如：watermark, blurry, bad quality..."
                  style={{
                    width: "100%",
                    height: "54px",
                    background: "rgba(239, 68, 68, 0.02)",
                    border: "1px solid rgba(239, 68, 68, 0.15)",
                    color: "#1c1917",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "12px",
                    lineHeight: "1.5",
                    fontFamily: "JetBrains Mono, monospace",
                    outline: "none",
                    resize: "none",
                    transition: "all 0.2s",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            )}

            {/* 3. 参考图上传区 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#1c1917" }}>
                参考照片 (需要 1 张)
              </span>
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  height: "90px",
                  borderRadius: "6px",
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

            {/* 4. 高级 Civitai 风格微调参数（LoRA 滑块, VAE, 宽高比等） */}
            <div style={{ borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "12px", marginTop: "4px" }}>
              <AIAdvancedParamsPanel
                value={advParams}
                onChange={setAdvParams}
                showAdvancedToggle={true}
              />
            </div>

          </div>
        </div>

        {/* 3. 底部固定操作栏（带有项目选择联动） */}
        <footer style={{ 
          padding: "14px 24px", 
          borderTop: "1px solid var(--rv-color-border-thin)", 
          flexShrink: 0,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "16px",
          background: "#fafafa",
          height: "68px",
          boxSizing: "border-box"
        }}>
          {/* 已有项目选择下拉框 */}
          {projects.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>应用至项目:</span>
              <select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "20px",
                  padding: "5px 12px",
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "#334155",
                  outline: "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <option value="new">🆕 + 新建客户项目</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    📁 {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "600" }}>
              提示：创建后将同步配置至 AI 画布
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                borderRadius: "30px",
                fontSize: "12px",
                fontWeight: "700",
                color: "#64748b",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#ffffff"}
            >
              取消
            </button>
            
            <button
              type="button"
              onClick={() => {
                if (targetProjectId === "new") {
                  onStart();
                } else {
                  if (onUseWithProject) {
                    onUseWithProject(targetProjectId);
                  }
                }
              }}
              disabled={isUploading}
              style={{
                padding: "8px 20px",
                background: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
                border: 0,
                borderRadius: "30px",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: "750",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                cursor: isUploading ? "not-allowed" : "pointer",
                opacity: isUploading ? 0.6 : 1,
                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 4px 14px rgba(15, 118, 110, 0.25)"
              }}
              onMouseEnter={(e) => {
                if (!isUploading) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(15, 118, 110, 0.35)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isUploading) {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(15, 118, 110, 0.25)";
                }
              }}
            >
              <Sparkles size={14} />
              {targetProjectId === "new" ? "应用并创建项目" : "同步到选中项目"}
            </button>
          </div>
        </footer>

      </div>
    </div>
  );
}
