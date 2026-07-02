import { Sparkles, Plus } from "lucide-react";
import { AssetSummary } from "../../types";
import { assetUrl, assetTitle } from "../../utils";

interface ProjectLibraryPanelProps {
  assets: AssetSummary[];
  setPreviewAsset: (asset: AssetSummary | null) => void;
  addWorkflowResultToCanvas: (title: string, output: any) => void;
}

export function ProjectLibraryPanel({
  assets,
  setPreviewAsset,
  addWorkflowResultToCanvas,
}: ProjectLibraryPanelProps) {
  const imageAssets = assets.filter((asset) => asset.asset_type === "image");
  
  // 过滤生成历史：只要是工作流产物或者是生成文档/视频，都算作生成历史
  const workflowAssets = assets.filter((asset) => asset.source === "workflow" || asset.asset_type === "document" || asset.asset_type === "video");

  return (
    <div className="rv-right-drawer-scrollable" style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px" }}>
      {/* 1. 本地库 */}
      <div>
        <div className="panel-header" style={{ marginBottom: "12px" }}>
          <h3>项目素材库</h3>
          <span style={{ fontSize: "11px", color: "#a1a1aa" }}>{imageAssets.length} 个图片</span>
        </div>
        {imageAssets.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
            {imageAssets.slice(0, 8).map((asset) => (
              <button
                className="image-strip-item"
                key={asset.id}
                type="button"
                title={assetTitle(asset)}
                onClick={() => setPreviewAsset(asset)}
              >
                {asset.thumbnail_url || asset.file_url ? (
                  <img alt="" src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")} />
                ) : (
                  <Plus size={18} />
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state compact-empty" style={{ background: "rgba(255,255,255,0.03)", padding: "16px", borderRadius: "8px" }}>
            <p style={{ fontSize: "11px", color: "#71717a", margin: 0 }}>素材库为空，请在下方工作流中生成或从素材页导入。</p>
          </div>
        )}
      </div>

      {/* 2. 生成历史 */}
      <div>
        <div className="panel-header" style={{ marginBottom: "12px" }}>
          <h3>生成历史</h3>
          <span style={{ fontSize: "11px", color: "#a1a1aa" }}>AI 创意产物</span>
        </div>
        <div style={{ maxHeight: "360px", overflowY: "auto" }}>
          {!workflowAssets.length ? (
            <div className="empty-state compact-empty">
              <p>当前项目还没有生成历史。</p>
            </div>
          ) : (
            <div className="history-list">
              {workflowAssets.map((asset) => {
                // 安全解析 metadata JSON 字符串
                const meta = typeof asset.metadata === "string"
                  ? (() => {
                      try {
                        return JSON.parse(asset.metadata);
                      } catch {
                        return {};
                      }
                    })()
                  : asset.metadata || {};

                const taskType = meta.task_type || asset.asset_type || "";
                const title = meta.title ?? (taskType === "text" ? "AI 文本生成结果" : "AI 生成结果");
                const outputVal = meta.output ?? meta.summary ?? asset.file_url ?? "";

                return (
                  <div className="history-row" key={asset.id} style={{ marginBottom: "12px", borderBottom: "1px solid #f5f5f4", paddingBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <strong style={{ fontSize: "13px", color: "#1c1917" }}>{title}</strong>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          type="button"
                          className="mini-action-button"
                          onClick={() => addWorkflowResultToCanvas(title, outputVal)}
                          style={{ minHeight: "24px", fontSize: "10px", display: "inline-flex", alignItems: "center", gap: "4px", padding: "0 6px" }}
                        >
                          <Sparkles size={10} /> Add to Canvas
                        </button>
                        <span style={{ fontSize: "10px", color: "#78716c" }}>
                          {taskType} · {asset.asset_type}
                        </span>
                      </div>
                    </div>
                    {taskType === "text" || asset.asset_type === "document" ? (
                      <div style={{
                        background: "#f5f5f4",
                        padding: "8px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        color: "#292524",
                        maxHeight: "120px",
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        lineHeight: "1.4"
                      }}>
                        {typeof outputVal === "string" ? outputVal : JSON.stringify(outputVal)}
                      </div>
                    ) : (
                      <pre style={{
                        margin: 0,
                        padding: "6px",
                        background: "#f5f5f4",
                        borderRadius: "4px",
                        fontSize: "10px",
                        overflowX: "auto"
                      }}>
                        {typeof outputVal === "string" ? outputVal : JSON.stringify(outputVal, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
