import React, { useState, useEffect, useRef } from "react";
import { 
  Sparkles, Wand2, UploadCloud, Image as ImageIcon, 
  Settings2, Activity, Zap, CheckCircle2, FolderOpen,
  Play, Compass, Layers, Check
} from "lucide-react";
import { AssetSummary } from "../../types";
import { assetTitle, assetUrl, uploadAsset } from "../../utils";
import { DEFAULT_SETTINGS } from "./editorConstants";
import "./RetouchView.css";

interface RetouchViewProps {
  assets: AssetSummary[];
  onEnterEditor: (asset: AssetSummary, initialSettings?: any) => void;
  onUploadAndEdit?: (file: File) => Promise<void>;
  onAssetAdded?: (asset: AssetSummary) => void;
  workspaceId?: string;
  projectId?: string;
}

interface RecentExport {
  id: string;
  title: string;
  path: string;
  time: string;
}

// 预设模板
const PRESETS = [
  {
    id: "wedding",
    emoji: "WED",
    title: "唯美婚礼",
    desc: "柔和磨皮，暖调高光，高精白皙",
    settings: { ...DEFAULT_SETTINGS, exposure: 15, contrast: -10, saturation: 8, temperature: 15, highlights: 10, blur_strength: 65, skin_whiten: 30, eye_enlarge: 20, slim_face: 15, lut_file: "wedding.3dlut" }
  },
  {
    id: "id_photo",
    emoji: "ID",
    title: "轻颜证件",
    desc: "通透美白，强效磨皮，精致五官",
    settings: { ...DEFAULT_SETTINGS, exposure: 20, contrast: 5, saturation: -5, whites: 10, blur_strength: 80, skin_whiten: 50, eye_enlarge: 35, slim_face: 30, lut_file: "id_photo.3dlut" }
  },
  {
    id: "outdoor",
    emoji: "OUT",
    title: "清新户外",
    desc: "鲜艳色彩，自适应光影，自然磨皮",
    settings: { ...DEFAULT_SETTINGS, exposure: 25, contrast: -5, saturation: 15, vibrance: 20, clarity: 15, blur_strength: 50, eye_enlarge: 15, slim_face: 10, lut_file: "fresh.3dlut" }
  },
  {
    id: "vintage",
    emoji: "RET",
    title: "复古港风",
    desc: "金红复古，胶片颗粒，经典阴影",
    settings: { ...DEFAULT_SETTINGS, exposure: -5, contrast: 20, saturation: 25, temperature: 10, shadows: -15, blur_strength: 40, eye_enlarge: 10, slim_face: 5, lut_file: "vintage.3dlut" }
  }
];

export function RetouchView({
  assets,
  onEnterEditor,
  onUploadAndEdit,
  onAssetAdded,
  workspaceId,
  projectId,
}: RetouchViewProps) {
  const images = assets.filter((a) => a.asset_type === "image");
  const [recentExports, setRecentExports] = useState<RecentExport[]>([]);
  
  // Before/After 滑块
  const [sliderPos, setSliderPos] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const sliderContainerRef = useRef<HTMLDivElement | null>(null);

  // 导入文件进度状态
  const [uploadStatus, setUploadStatus] = useState<{
    uploading: boolean;
    total: number;
    current: number;
  }>({ uploading: false, total: 0, current: 0 });

  // 载入最近导出记录
  const loadRecentExports = () => {
    try {
      const listStr = localStorage.getItem("reveria.recentExports") || "[]";
      setRecentExports(JSON.parse(listStr));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadRecentExports();
    const handleUpdate = () => {
      loadRecentExports();
    };
    window.addEventListener("recentExportsUpdated", handleUpdate);
    return () => {
      window.removeEventListener("recentExportsUpdated", handleUpdate);
    };
  }, []);

  // 批量/多选文件导入处理
  const handleBatchUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const filesArray = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (filesArray.length === 0) {
      alert("未选择任何有效的图片文件！");
      return;
    }

    if (!workspaceId || !projectId) {
      // 降级单张上传并打开编辑器
      if (onUploadAndEdit) {
        for (const file of filesArray) {
          await onUploadAndEdit(file);
        }
      }
      return;
    }

    setUploadStatus({ uploading: true, total: filesArray.length, current: 0 });

    try {
      for (let i = 0; i < filesArray.length; i++) {
        setUploadStatus(prev => ({ ...prev, current: i + 1 }));
        const file = filesArray[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("workspace_id", workspaceId);
        formData.append("project_id", projectId);
        formData.append("asset_type", "image");
        const asset = await uploadAsset(formData);
        if (onAssetAdded) {
          onAssetAdded(asset);
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(`导入失败: ${err.message || "未知错误"}`);
    } finally {
      setUploadStatus({ uploading: false, total: 0, current: 0 });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleBatchUpload(e.target.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onUploadAndEdit) {
      await onUploadAndEdit(e.dataTransfer.files[0]);
    }
  };

  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percentage);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleSliderMove(e.touches[0].clientX);
    }
  };

  const handleOpenPath = (path: string) => {
    navigator.clipboard.writeText(path).then(() => {
      alert(`已复制存储路径至剪贴板，您可在文件管理器中直接访问：\n${path}`);
    });
  };

  const handleApplyPreset = (preset: typeof PRESETS[0]) => {
    if (images.length === 0) {
      alert("当前项目中尚无图片素材，请先上传照片以应用该预设！");
      return;
    }
    onEnterEditor(images[0], preset.settings);
  };

  const compareImageSrc = images.length > 0 ? assetUrl(images[0].file_url ?? images[0].thumbnail_url ?? "") : "";

  if (images.length === 0) {
    return (
      <div className="retouch-import-empty-screen">
        {uploadStatus.uploading && (
          <div className="upload-progress-overlay">
            <div className="upload-progress-card">
              <div className="spinner-glow" />
              <h3>正在导入照片素材</h3>
              <p>正在导入第 {uploadStatus.current} 张，共 {uploadStatus.total} 张...</p>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${(uploadStatus.current / uploadStatus.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="import-cards-grid">
          {/* Card 1: Import Images */}
          <div 
            className="import-card" 
            onClick={() => document.getElementById("file-import-input")?.click()}
          >
            <div className="import-icon-container">
              <ImageIcon size={48} className="import-icon" />
            </div>
            <span className="import-label">导入图片</span>
            <input
              type="file"
              id="file-import-input"
              multiple
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleBatchUpload(e.target.files)}
            />
          </div>

          {/* Card 2: Import Folder */}
          <div 
            className="import-card" 
            onClick={() => document.getElementById("folder-import-input")?.click()}
          >
            <div className="import-icon-container">
              <FolderOpen size={48} className="import-icon" />
            </div>
            <span className="import-label">导入文件夹</span>
            <input
              type="file"
              id="folder-import-input"
              {...({
                webkitdirectory: "",
                directory: "",
              } as any)}
              multiple
              style={{ display: "none" }}
              onChange={(e) => handleBatchUpload(e.target.files)}
            />
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="retouch-view-container full-width-fluid">
      {/* 顶部宽屏交互横幅 - Draggable Compare Slider */}
      <section className="retouch-hero-section-fluid interactive-banner">
        <div className="hero-content">
          <div className="badge-glow">
            <Activity size={12} className="pulse-icon" /> 
            <span>RUST NATIVE ENGINE STATUS: ACTIVE</span>
          </div>
          <h1>Reveria AI 像素级人像精修</h1>
          <p>
            本地搭载高精双频滤波磨皮及 MLS 黄金比例液化算子。
            右侧大图支持鼠标**左右拖拽分界中线**，直观感受 AI 智能磨皮与人像调色前后的卓越品质对比。
          </p>
          
          <div className="hero-features-row">
            <div className="feature-item-pill">
              <Zap size={14} style={{ color: "#a855f7" }} />
              <span>300ms 智能防抖秒级保存</span>
            </div>
            <div className="feature-item-pill">
              <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
              <span>ICC 物理空间色彩映射</span>
            </div>
          </div>

          <div className="banner-upload-bar">
            <input 
              type="file" 
              id="quick-retouch-file-banner" 
              accept="image/*" 
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <label htmlFor="quick-retouch-file-banner" className="banner-upload-btn">
              <UploadCloud size={16} />
              <span>导入本地大图进行精修</span>
            </label>
            <span className="banner-upload-tip">或直接拖拽图片文件到页面任意位置</span>
          </div>
        </div>

        {/* 交互核心：左右拖拽对比滑块 */}
        <div 
          className="hero-slider-compare"
          ref={sliderContainerRef}
          onMouseMove={(e) => {
            if (e.buttons === 1 || isDraggingSlider) {
              handleSliderMove(e.clientX);
            }
          }}
          onMouseDown={(e) => {
            setIsDraggingSlider(true);
            handleSliderMove(e.clientX);
          }}
          onMouseUp={() => setIsDraggingSlider(false)}
          onMouseLeave={() => setIsDraggingSlider(false)}
          onTouchMove={handleTouchMove}
          onTouchStart={() => setIsDraggingSlider(true)}
          onTouchEnd={() => setIsDraggingSlider(false)}
        >
          {compareImageSrc ? (
            <>
              {/* Underlay (Before - 原图) */}
              <div className="slider-layer before-layer">
                <img src={compareImageSrc} alt="Before" draggable="false" />
                <div className="label-tag before-tag">原图 CAMERA RAW</div>
              </div>
              
              {/* Overlay (After) */}
              <div 
                className="slider-layer after-layer"
                style={{ clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)` }}
              >
                <img 
                  src={compareImageSrc} 
                  alt="After" 
                  className="retouched-filter-preview"
                  draggable="false" 
                />
                <div className="label-tag after-tag">精修后</div>
              </div>

              {/* 滑块拖拽中线 */}
              <div 
                className="slider-handle-line"
                style={{ left: `${sliderPos}%` }}
              >
                <div className="slider-handle-button">
                  <Wand2 size={14} className="spark-icon" />
                </div>
              </div>
            </>
          ) : (
            <div className="slider-placeholder" onDragOver={handleDragOver} onDrop={handleDrop}>
              <UploadCloud size={48} className="placeholder-icon" />
              <span>拖拽照片至此，立即体验拖动对比</span>
            </div>
          )}
        </div>
      </section>

      {/* 主工作区分割布局 */}
      <div className="retouch-main-layout">
        
        {/* 左侧：素材平铺网格 */}
        <div className="layout-left-content">
          <section className="retouch-assets-section-fluid">
            <div className="section-header-fluid">
              <div className="header-left">
                <h2>项目图片素材</h2>
                <p>点击选择已上传的图片，即可开启 WebGL 实时硬件级图像精修工作台</p>
              </div>
              <span className="count-tag-glow">共 {images.length} 张图片</span>
            </div>

            {images.length === 0 ? (
              <div className="empty-assets-state-fluid" onDragOver={handleDragOver} onDrop={handleDrop}>
                <ImageIcon size={64} className="empty-icon" />
                <h3>暂无可精修素材</h3>
                <p>点击上方或直接拖入大图以开始您的第一张 AI 人像处理</p>
              </div>
            ) : (
              <div className="retouch-assets-grid-fluid">
                {images.map((asset) => {
                  const title = assetTitle(asset);
                  const thumb = asset.thumbnail_url ?? asset.file_url ?? "";
                  return (
                    <div 
                      key={asset.id} 
                      className="retouch-asset-card-fluid"
                      onClick={() => onEnterEditor(asset)}
                    >
                      <div className="card-preview">
                        {thumb ? (
                          <img src={assetUrl(thumb)} alt={title} loading="lazy" />
                        ) : (
                          <div className="fallback-img">图片</div>
                        )}
                        <div className="card-hover-overlay">
                          <div className="action-button-glow">
                            <Wand2 size={16} />
                            <span>开始精修</span>
                          </div>
                        </div>
                      </div>
                      <div className="card-meta-fluid">
                        <span className="card-title" title={title}>{title}</span>
                        <div className="card-sub-info">
                          <span className="card-source">
                            {asset.source === "upload" ? "本地导入" : asset.source === "tethered" ? "相机联机" : "云端同步"}
                          </span>
                          {asset.selection_status === "approved" && <span className="status-badge approved">已选片</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* 右侧：真实可用的预设与导出历史 */}
        <div className="layout-right-sidebar">
          {/* 一键风格预设应用 */}
          <div className="sidebar-card">
            <h3>一键风格预设应用</h3>
            <div className="presets-list">
              {PRESETS.map((preset) => (
                <div 
                  key={preset.id} 
                  className="preset-row-card"
                  onClick={() => handleApplyPreset(preset)}
                >
                  <div className="preset-left">
                    <span className="emoji-circle">{preset.emoji}</span>
                    <div className="meta">
                      <h4>{preset.title}</h4>
                      <p>{preset.desc}</p>
                    </div>
                  </div>
                  <div className="preset-action">
                    <Play size={10} className="apply-icon" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. 最近导出记录 */}
          <div className="sidebar-card">
            <h3>最近精修导出历史</h3>
            {recentExports.length === 0 ? (
              <div className="empty-history">
                <p>暂无导出历史，大图保存后会在此静默累积。</p>
              </div>
            ) : (
              <div className="recent-exports-list">
                {recentExports.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="history-item"
                    onClick={() => handleOpenPath(item.path)}
                    title="点击复制图片物理存储路径"
                  >
                    <div className="history-meta">
                      <span className="title">{item.title}</span>
                      <span className="time">{item.time}</span>
                    </div>
                    <div className="history-action">
                      <FolderOpen size={14} className="folder-icon" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
