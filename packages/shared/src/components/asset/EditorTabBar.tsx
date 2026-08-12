import React from "react";
import { Blend, Eraser, ImageMinus, Scissors, SlidersHorizontal, Sparkles, Sun, Type, User } from "lucide-react";
import type { CanvasTool } from "./CanvasToolbar";

export type EditorTab = "portrait" | "color" | "professional" | "local" | "mask" | "liquify" | "erase" | "background" | "overlay";

interface Props {
  activeTab: EditorTab;
  disabled: boolean;
  onSelect: (tab: EditorTab, tool: CanvasTool) => void;
}

const TABS: Array<{ id: EditorTab; label: string; tool: CanvasTool; icon: React.ElementType }> = [
  { id: "color", label: "调色", tool: "move", icon: Sun },
  { id: "professional", label: "专业", tool: "move", icon: SlidersHorizontal },
  { id: "local", label: "修复", tool: "healing", icon: Scissors },
  { id: "mask", label: "蒙版", tool: "mask", icon: Blend },
  { id: "portrait", label: "人像", tool: "move", icon: User },
  { id: "liquify", label: "液化", tool: "liquify", icon: Sparkles },
  { id: "erase", label: "消除", tool: "erase", icon: Eraser },
  { id: "background", label: "背景", tool: "move", icon: ImageMinus },
  { id: "overlay", label: "叠加", tool: "overlay", icon: Type },
];

export function EditorTabBar({ activeTab, disabled, onSelect }: Props) {
  return (
    <div className="right-vertical-tabs-bar">
      {TABS.map(({ id, label, tool, icon: Icon }) => (
        <button
          key={id}
          className={`vertical-tab-icon-btn ${activeTab === id ? "active" : ""}`}
          disabled={disabled}
          onClick={() => onSelect(id, tool)}
          title={label}
        >
          <Icon size={18} /><span>{label}</span>
        </button>
      ))}
    </div>
  );
}
