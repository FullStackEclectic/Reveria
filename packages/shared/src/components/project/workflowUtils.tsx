import { ReactNode } from "react";
import {
  FileText,
  Palette,
  Sparkles,
  Image,
  Layers,
  Film,
} from "lucide-react";

export const quickTasks = [
  { label: "图像", type: "image-generation" },
  { label: "客户 brief 分析", type: "brief-analysis" },
  { label: "品牌风格提取", type: "brand-style-extract" },
  { label: "三套创意方向", type: "creative-directions" },
  { label: "小红书封面批量生成", type: "xiaohongshu-cover-batch" },
  { label: "短视频脚本和分镜", type: "short-video-script-storyboard" },
] as const;

export function isWorkflowRunnable(type: string): boolean {
  return (
    type === "brief-analysis" ||
    type === "brand-style-extract" ||
    type === "creative-directions" ||
    type === "image-generation" ||
    type === "xiaohongshu-cover-batch" ||
    type === "short-video-script-storyboard"
  );
}

export function getWorkflowIcon(type: string, size = 16): ReactNode {
  switch (type) {
    case "brief-analysis":
      return <FileText size={size} />;
    case "brand-style-extract":
      return <Palette size={size} />;
    case "creative-directions":
      return <Sparkles size={size} />;
    case "image-generation":
      return <Image size={size} />;
    case "xiaohongshu-cover-batch":
      return <Layers size={size} />;
    case "short-video-script-storyboard":
      return <Film size={size} />;
    default:
      return <Sparkles size={size} />;
  }
}

export function getWorkflowDesc(type: string): string {
  switch (type) {
    case "brief-analysis":
      return "分析客户原始 Brief，提取项目核心诉求与切入点";
    case "brand-style-extract":
      return "提取并定义品牌风格调性，建立文案与视觉指南";
    case "creative-directions":
      return "生成三套差异化的创意方向与具体实施策略";
    case "image-generation":
      return "使用 AI 绘图大模型生成高清图片与视觉创意素材";
    case "xiaohongshu-cover-batch":
      return "批量策划高点击率的小红书封面文案与排版创意";
    case "short-video-script-storyboard":
      return "生成完整的短视频脚本、镜头分镜和配音脚本";
    default:
      return "智能生成工作流";
  }
}

// 尺寸缩略图样式计算
export function getRatioBoxStyle(ratio: string): Record<string, string> {
  switch (ratio) {
    case "1:1":
    case "1:1(2k)":
      return { width: "12px", height: "12px" };
    case "3:2":
      return { width: "15px", height: "10px" };
    case "2:3":
      return { width: "10px", height: "15px" };
    case "4:3":
      return { width: "14px", height: "10.5px" };
    case "3:4":
      return { width: "10.5px", height: "14px" };
    case "9:16":
    case "9:16(2k)":
    case "9:16(4k)":
      return { width: "9px", height: "16px" };
    case "16:9(2k)":
    case "16:9(4k)":
      return { width: "16px", height: "9px" };
    default:
      return { width: "12px", height: "12px" };
  }
}

// Quality 翻译为中文标签
export function getQualityLabel(q: string): string {
  switch (q) {
    case "auto": return "自动";
    case "high": return "高";
    case "medium": return "中";
    case "low": return "低";
    default: return "中";
  }
}
