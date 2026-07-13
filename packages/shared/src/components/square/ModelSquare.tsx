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
import { TemplateDetailModal } from "./TemplateDetailModal";

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
    if (!currentUser) {
      setTemplates([]);
      setModels([]);
      setLoading(false);
      return;
    }
    async function initSquareData() {
      setLoading(true);
      try {
        const [tempsRes, modelsRes] = await Promise.all([
          getJson<any>("/api/prompt-templates"),
          getJson<any[]>("/api/models")
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
  }, [currentUser]);

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
      desc: "全新 4K 极清视频通道发布，动态平滑防波动，突破时空局限。点击查看首帧效果预览。",
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
                              {Math.floor((idx + 1) * 314)} 活跃
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
                                  {temp.default_width}×{temp.default_height}
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

