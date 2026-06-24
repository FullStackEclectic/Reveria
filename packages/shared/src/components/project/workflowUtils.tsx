import { ReactNode } from "react";
import {
  FileText,
  Image,
  Film,
  Sparkles
} from "lucide-react";

export const quickTasks = [
  { label: "图像", type: "image-generation" },
  { label: "文本", type: "text-generation" },
  { label: "视频", type: "video-generation" },
] as const;

export function isWorkflowRunnable(type: string): boolean {
  return (
    type === "image-generation" ||
    type === "text-generation" ||
    type === "video-generation"
  );
}

export function getWorkflowIcon(type: string, size = 16): ReactNode {
  switch (type) {
    case "text-generation":
      return <FileText size={size} />;
    case "image-generation":
      return <Image size={size} />;
    case "video-generation":
      return <Film size={size} />;
    default:
      return <Sparkles size={size} />;
  }
}

export function getWorkflowDesc(type: string): string {
  switch (type) {
    case "text-generation":
      return "使用 AI 语言大模型进行文本创作、文案撰写与创意策划";
    case "image-generation":
      return "使用 AI 绘图大模型生成高清图片与视觉创意素材";
    case "video-generation":
      return "使用 AI 视频生成大模型生成动态视觉效果与短视频素材";
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
