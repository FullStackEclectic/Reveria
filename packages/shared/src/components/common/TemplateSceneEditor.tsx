import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import { TemplateScene } from "../../types";
import { createTemplateScene } from "../../templateExecution";

interface TemplateSceneEditorProps {
  scenes: TemplateScene[];
  onChange: (scenes: TemplateScene[]) => void;
  maxScenes: number;
}

export function TemplateSceneEditor({ scenes, onChange, maxScenes }: TemplateSceneEditorProps) {
  const updateScene = (index: number, patch: Partial<TemplateScene>) => {
    onChange(scenes.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, ...patch } : scene));
  };

  const moveScene = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= scenes.length) return;
    const next = [...scenes];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const duplicateScene = (index: number) => {
    if (scenes.length >= maxScenes) return;
    const source = scenes[index];
    const duplicate = { ...createTemplateScene(scenes.length + 1), title: `${source.title} 副本`, prompt: source.prompt };
    onChange([...scenes.slice(0, index + 1), duplicate, ...scenes.slice(index + 1)]);
  };

  return (
    <div style={{ border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-xs)", overflow: "hidden", background: "#ffffff" }}>
      <div style={{ minHeight: "40px", padding: "0 10px 0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--rv-color-bg-sidebar)", borderBottom: "1px solid var(--rv-color-border-thin)" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--rv-color-text-main)" }}>场景画面（{scenes.length}/{maxScenes}）</span>
        <button
          type="button"
          onClick={() => onChange([...scenes, createTemplateScene(scenes.length + 1)])}
          disabled={scenes.length >= maxScenes}
          title="添加场景"
          style={{ border: 0, background: "transparent", color: "var(--rv-color-primary)", display: "inline-flex", alignItems: "center", gap: "4px", cursor: scenes.length >= maxScenes ? "not-allowed" : "pointer", opacity: scenes.length >= maxScenes ? 0.4 : 1, fontSize: "11px", fontWeight: 700 }}
        >
          <Plus size={14} /> 添加场景
        </button>
      </div>

      {scenes.map((scene, index) => (
        <div key={scene.id} style={{ display: "grid", gridTemplateColumns: "32px minmax(110px, 0.32fr) minmax(220px, 1fr) 96px", gap: "8px", alignItems: "center", padding: "9px 10px", borderBottom: index === scenes.length - 1 ? 0 : "1px solid var(--rv-color-border-thin)" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--rv-color-text-muted)", textAlign: "center" }}>{String(index + 1).padStart(2, "0")}</span>
          <input
            value={scene.title}
            onChange={(event) => updateScene(index, { title: event.target.value })}
            placeholder="场景名称"
            style={{ minWidth: 0, height: "34px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "4px", padding: "0 9px", fontSize: "11px", fontWeight: 700, outline: "none" }}
          />
          <textarea
            value={scene.prompt}
            onChange={(event) => updateScene(index, { prompt: event.target.value })}
            placeholder="这张图的构图、场景和展示要求"
            rows={2}
            style={{ minWidth: 0, minHeight: "48px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "4px", padding: "7px 9px", fontSize: "11px", lineHeight: 1.45, resize: "vertical", outline: "none" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 22px)", gap: "2px", justifyContent: "end" }}>
            <button type="button" title="上移" disabled={index === 0} onClick={() => moveScene(index, -1)} className="icon-button"><ChevronUp size={13} /></button>
            <button type="button" title="下移" disabled={index === scenes.length - 1} onClick={() => moveScene(index, 1)} className="icon-button"><ChevronDown size={13} /></button>
            <button type="button" title="复制" disabled={scenes.length >= maxScenes} onClick={() => duplicateScene(index)} className="icon-button"><Copy size={13} /></button>
            <button type="button" title="删除" disabled={scenes.length <= 1} onClick={() => onChange(scenes.filter((_, sceneIndex) => sceneIndex !== index))} className="icon-button" style={{ color: "#dc2626" }}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
