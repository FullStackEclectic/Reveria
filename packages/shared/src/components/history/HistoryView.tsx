import React from "react";
import { AssetSummary, ProjectSummary } from "../../types";
import { PageFrame } from "../common/PageFrame";
import "./HistoryView.css";


interface HistoryViewProps {
  assets: AssetSummary[];
  selectedProject: ProjectSummary | undefined;
  exportCurrentProject: (format: "json" | "markdown") => void;
}

function getWorkflowBadge(taskType: string) {
  let tagText = "图";
  let textColor = "#6366f1";
  let bgColor = "rgba(99, 102, 241, 0.1)";

  const t = (taskType || "").toLowerCase();
  if (t.includes("video")) {
    tagText = "视";
    textColor = "#a855f7";
    bgColor = "rgba(168, 85, 247, 0.1)";
  } else if (t.includes("text")) {
    tagText = "文";
    textColor = "#f97316";
    bgColor = "rgba(249, 115, 22, 0.1)";
  }

  return (
    <span 
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "18px",
        height: "18px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 800,
        color: textColor,
        backgroundColor: bgColor,
        marginRight: "8px",
        flexShrink: 0
      }}
    >
      {tagText}
    </span>
  );
}

export function HistoryList({ assets }: { assets: AssetSummary[] }) {
  const workflowAssets = assets.filter(
    (asset) => asset.asset_type === "workflow_output",
  );

  if (!workflowAssets.length) {
    return (
      <div className="empty-state compact-empty">
        <p>当前项目还没有生成历史。</p>
      </div>
    );
  }

  return (
    <div className="history-list">
      {workflowAssets.map((asset) => (
        <div className="history-row" key={asset.id}>
          <div className="history-row-header">
            <div className="history-row-header-left">
              {getWorkflowBadge(asset.metadata.task_type || "")}
              <strong>{asset.metadata.title ?? asset.asset_type}</strong>
            </div>
            <span className="meta-desc">
              {asset.metadata.task_type ?? asset.source} · {asset.asset_type}
            </span>
          </div>
          <pre>{JSON.stringify(asset.metadata.output, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

export function HistoryView({
  assets,
  selectedProject,
  exportCurrentProject,
}: HistoryViewProps) {
  return (
    <PageFrame
      title="项目生成记录"
      status={`${assets.length} 条当前项目历史 · 来源于工作流输出`}
      action={
        <div className="topbar-actions">
          <button
            className="secondary-button"
            type="button"
            disabled={!selectedProject}
            onClick={() => exportCurrentProject("json")}
          >
            导出 JSON
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={!selectedProject}
            onClick={() => exportCurrentProject("markdown")}
          >
            导出 Markdown
          </button>
        </div>
      }
    >
      <section className="page-grid">
        <div className="panel detail-panel">
          <div className="panel-header">
            <h3>{selectedProject?.name ?? "项目生成历史"}</h3>
            <span>workflow_output</span>
          </div>
          <HistoryList assets={assets} />
        </div>
      </section>
    </PageFrame>
  );
}
