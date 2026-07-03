import React, { useState, useEffect } from "react";
import { FolderKanban, Trash2 } from "lucide-react";
import { ProjectSummary } from "../../types";
import "./ProjectCard.css";

interface ProjectCardProps {
  project: ProjectSummary;
  customerName?: string;
  onClick: () => void;
  onDelete?: () => void;
}

export function ProjectCard({
  project,
  customerName,
  onClick,
  onDelete,
}: ProjectCardProps) {
  const [imageError, setImageError] = useState(false);

  // 当项目的 cover_url 更新时，重置图片错误状态，尝试加载新图片
  useEffect(() => {
    setImageError(false);
  }, [project.cover_url]);

  // Figma-like Cover SVG Templates
  const renderCanvasSVG = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135" fill="none" style={{ width: "100%", height: "100%" }}>
      <rect width="240" height="135" fill="#fcfbfa" />
      <pattern id="grid-canvas-proj" width="12" height="12" patternUnits="userSpaceOnUse">
        <path d="M 12 0 L 0 0 0 12" fill="none" stroke="rgba(185, 178, 165, 0.08)" strokeWidth="1" />
      </pattern>
      <rect width="240" height="135" fill="url(#grid-canvas-proj)" />

      {/* Node A */}
      <rect x="25" y="25" width="60" height="40" rx="4" fill="#ffffff" stroke="rgba(15, 118, 110, 0.25)" strokeWidth="1.5" />
      <rect x="33" y="33" width="44" height="6" rx="2" fill="rgba(15, 118, 110, 0.12)" />
      <rect x="33" y="44" width="30" height="4" rx="2" fill="rgba(115, 111, 106, 0.1)" />

      {/* Node B */}
      <rect x="145" y="45" width="70" height="45" rx="4" fill="#ffffff" stroke="rgba(15, 118, 110, 0.2)" strokeWidth="1.5" />
      <circle cx="180" cy="68" r="14" fill="rgba(15, 118, 110, 0.08)" />
      <path d="M 175 68 L 185 68 M 180 63 L 180 73" stroke="rgba(15, 118, 110, 0.4)" strokeWidth="1.5" strokeLinecap="round" />

      {/* Curve Connection */}
      <path d="M 85 45 C 115 45, 115 67, 145 67" stroke="rgba(15, 118, 110, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" />

      {/* Selection outline */}
      <rect x="23" y="23" width="64" height="44" rx="2" fill="none" stroke="#0ea5e9" strokeWidth="1" />
      <rect x="21" y="21" width="5" height="5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1" />
      <rect x="84" y="21" width="5" height="5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1" />
      <rect x="21" y="64" width="5" height="5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1" />
      <rect x="84" y="64" width="5" height="5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="1" />
    </svg>
  );

  const renderImageSVG = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135" fill="none" style={{ width: "100%", height: "100%" }}>
      <rect width="240" height="135" fill="#f9f8f6" />
      <pattern id="grid-img-proj" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(185, 178, 165, 0.06)" strokeWidth="1" />
      </pattern>
      <rect width="240" height="135" fill="url(#grid-img-proj)" />

      {/* Image box */}
      <rect x="75" y="15" width="90" height="90" rx="8" fill="#ffffff" stroke="rgba(185, 178, 165, 0.25)" strokeWidth="1" />
      <path d="M 85 95 L 115 65 C 120 60, 128 60, 133 65 L 155 87" stroke="rgba(185, 178, 165, 0.4)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 125 95 L 140 80 C 143 77, 147 77, 150 80 L 158 88" stroke="rgba(185, 178, 165, 0.4)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="105" cy="40" r="8" fill="rgba(234, 179, 8, 0.15)" stroke="rgba(234, 179, 8, 0.4)" strokeWidth="1" />

      {/* Sparkles */}
      <path d="M 190 20 L 193 26 L 199 29 L 193 32 L 190 38 L 187 32 L 181 29 L 187 26 Z" fill="rgba(15, 118, 110, 0.18)" stroke="rgba(15, 118, 110, 0.4)" strokeWidth="1" />
      <path d="M 50 70 L 52 74 L 56 76 L 52 78 L 50 82 L 48 78 L 44 76 L 48 74 Z" fill="rgba(15, 118, 110, 0.12)" stroke="rgba(15, 118, 110, 0.3)" strokeWidth="1" />

      {/* Prompt block */}
      <rect x="40" y="105" width="160" height="20" rx="10" fill="#ffffff" stroke="rgba(15, 118, 110, 0.2)" strokeWidth="1" />
      <circle cx="50" cy="115" r="3" fill="#0f766e" />
      <rect x="58" y="113" width="100" height="4" rx="2" fill="rgba(15, 118, 110, 0.15)" />
    </svg>
  );

  const renderThumbnailSVG = (projectType?: string) => {
    if (projectType === "retouch") {
      return renderImageSVG();
    }
    return renderCanvasSVG();
  };

  const getIconBgColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "rgba(16, 185, 129, 0.1)"; // 极淡绿
      case "running":
      case "active":
        return "rgba(99, 102, 241, 0.1)"; // 极淡紫蓝
      default:
        return "rgba(245, 158, 11, 0.1)"; // 极淡琥珀
    }
  };

  const getIconColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "#10b981";
      case "running":
      case "active":
        return "#6366f1";
      default:
        return "#f59e0b";
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case "delivered":
        return "已交付";
      case "running":
      case "active":
        return "进行中";
      default:
        return "草稿";
    }
  };

  const showCover = !!project.cover_url && !imageError;

  return (
    <div className="project-card-figma" onClick={onClick}>
      {/* 上部：项目缩略图预览（优先显示项目内略缩图，降级为Figma风占位SVG） */}
      <div className="thumbnail-area">
        {showCover ? (
          <img
            src={project.cover_url}
            alt={project.name}
            className="project-cover-image"
            onError={() => setImageError(true)}
          />
        ) : (
          renderThumbnailSVG(project.project_type)
        )}

        {/* 类型浮动指示器 */}
        <span className={`project-type-tag type-${project.project_type || "ai_canvas"}`}>
          {project.project_type === "retouch" ? "批量修图" : "AI画布"}
        </span>

        {/* 删除按钮 */}
        {onDelete && (
          <button
            className="project-delete-btn"
            type="button"
            title="删除项目"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* 下部：项目基础信息及状态 */}
      <div className="info-area">
        <div
          className="icon-wrapper"
          style={{ backgroundColor: getIconBgColor(project.status) }}
        >
          <FolderKanban size={15} color={getIconColor(project.status)} />
        </div>

        <div className="text-wrapper">
          <span className="title" title={project.name}>{project.name}</span>
          <span className="metadata">
            {customerName || "个人项目"} · 已消耗 {project.consumed_credits || 0} 点 · {getStatusText(project.status)}
          </span>
        </div>
      </div>
    </div>
  );
}
