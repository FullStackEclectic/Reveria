import { useRef, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { AssetSummary, UserSummary, WorkflowResult } from "../../types";
import { assetUrl, assetTitle, getAssetMetadata } from "../../utils";

interface WorkflowHistoryFeedProps {
  aiAssets: AssetSummary[];
  currentUser: UserSummary | null;
  selectedProjectId: string;
  feedbacks: Record<string, "up" | "down" | "">;
  handleFeedback: (assetId: string, type: "up" | "down") => void;
  handleReedit: (promptText?: string) => void;
  handleRegenerate: (promptText?: string, type?: string) => void;
  addAssetToCanvas?: (asset: AssetSummary) => void;
  addWorkflowResultToCanvas: (title: string, output: any) => void;
  isRunningWorkflow: boolean;
  workflowResult: WorkflowResult | null;
  setPreviewAsset: (asset: AssetSummary | null) => void;
}

export function WorkflowHistoryFeed({
  aiAssets,
  currentUser,
  selectedProjectId,
  feedbacks,
  handleFeedback,
  handleReedit,
  handleRegenerate,
  addAssetToCanvas,
  addWorkflowResultToCanvas,
  isRunningWorkflow,
  workflowResult,
  setPreviewAsset,
}: WorkflowHistoryFeedProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到最新消息
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiAssets.length, isRunningWorkflow, workflowResult]);

  function getQualityLabel(q: string) {
    switch (q) {
      case "auto": return "自动";
      case "high": return "高";
      case "medium": return "中";
      case "low": return "低";
      default: return "中";
    }
  }

  function renderWorkflowTextOutput(output: any) {
    if (!output) return null;
    
    if (typeof output === "string") {
      return <div className="gen-result-text-container">{output}</div>;
    }
    
    if (typeof output === "object") {
      if (output.result && typeof output.result === "string") {
        return <div className="gen-result-text-container">{output.result}</div>;
      }
      if (output.message && typeof output.message === "string" && !output.result) {
        return <div className="gen-result-text-container">{output.message}</div>;
      }
      
      const keys = Object.keys(output);
      return (
        <div className="gen-result-text-container">
          {keys.map((key) => {
            const val = output[key];
            if (!val) return null;
            if (key === "status" || key === "task_type") return null;
            
            const displayVal = typeof val === "object" ? JSON.stringify(val, null, 2) : String(val);
            return (
              <div key={key} className="gen-result-text-section">
                <div className="gen-result-text-title">{key}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{displayVal}</div>
              </div>
            );
          })}
        </div>
      );
    }
    
    return <pre className="plain-pre">{JSON.stringify(output, null, 2)}</pre>;
  }

  return (
    <div className="gen-chat-feed">
      {aiAssets.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "var(--rv-color-text-muted)", fontSize: "12px", textAlign: "center", padding: "40px 20px" }}>
          <Sparkles size={24} style={{ color: "var(--rv-color-primary)", opacity: 0.7 }} />
          <span>欢迎使用 AI 创意工坊！在下方输入创意灵感，一键召唤您的智能创意助手。</span>
        </div>
      ) : (
        aiAssets.map((asset) => {
          const isImage = asset.asset_type === "image";
          const meta = getAssetMetadata(asset);
          const promptText = meta?.prompt || meta?.brief || (isImage ? "创意绘图" : "文字工作流");
          const rawModelName = meta?.model || "GPT Image 2";
          const modelName = typeof rawModelName === "string" ? rawModelName.replace(/\s*\(.*?\)\s*/g, "") : String(rawModelName);
          const sizeStr = meta?.size_str || meta?.dimensions || (typeof meta?.size === "string" ? meta.size : "16:9(2k)");
          const qualityStr = meta?.quality || "medium";
          
          return (
            <div key={asset.id} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* 用户气泡 */}
              <div className="gen-msg-bubble gen-msg-user" style={{ alignSelf: "flex-end", flexDirection: "row-reverse" }}>
                <div className="gen-avatar-user">{currentUser?.display_name?.slice(0, 1).toUpperCase() || "U"}</div>
                <div className="gen-msg-body" style={{ alignItems: "flex-end" }}>
                  <div className="gen-msg-text">{promptText}</div>
                </div>
              </div>

              {/* AI 气泡 */}
              <div className="gen-msg-bubble gen-msg-ai">
                <div className="gen-avatar-ai">AI</div>
                <div className="gen-msg-body">
                  {/* 元信息 */}
                  <div className="gen-msg-ai-meta">
                    <span>✨ {isImage ? "图像" : "创意生成"}</span>
                    <span>·</span>
                    <span style={{ fontWeight: 600 }}>{modelName}</span>
                    {isImage && (
                      <>
                        <span>·</span>
                        <span>{getQualityLabel(qualityStr)}</span>
                        <span>·</span>
                        <span>{sizeStr}</span>
                      </>
                    )}
                  </div>

                  {/* 卡片内容 */}
                  <div className="gen-msg-ai-content">
                    {isImage ? (
                      <div className="gen-result-images">
                        <div 
                          className="gen-result-image-wrapper"
                          onClick={() => setPreviewAsset(asset)}
                          title="点击放大预览图片"
                        >
                          <img src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")} alt="AI output" />
                        </div>
                      </div>
                    ) : (
                      renderWorkflowTextOutput(asset.metadata?.output)
                    )}

                    {/* 底栏动作条 */}
                    <div className="gen-msg-actions">
                      <div className="gen-action-icons">
                        <button
                          type="button"
                          className="gen-action-icon-btn"
                          title="以此为基础编辑"
                          onClick={() => handleReedit(promptText)}
                        >
                          <span style={{ fontSize: "12px" }}>✏️</span>
                        </button>
                        <button
                          type="button"
                          className="gen-action-icon-btn"
                          title="重新生成"
                          onClick={() => handleRegenerate(promptText, asset.metadata?.task_type)}
                        >
                          <span style={{ fontSize: "12px" }}>🔄</span>
                        </button>
                        <button
                          type="button"
                          className={`gen-action-icon-btn ${feedbacks[asset.id] === "up" ? "active" : ""}`}
                          title="点赞"
                          onClick={() => handleFeedback(asset.id, "up")}
                        >
                          <span style={{ fontSize: "12px" }}>👍</span>
                        </button>
                        <button
                          type="button"
                          className={`gen-action-icon-btn ${feedbacks[asset.id] === "down" ? "active" : ""}`}
                          title="点踩"
                          onClick={() => handleFeedback(asset.id, "down")}
                        >
                          <span style={{ fontSize: "12px" }}>👎</span>
                        </button>
                      </div>

                      {/* 一键插入画布 */}
                      {isImage ? (
                        addAssetToCanvas && (
                          <button
                            type="button"
                            className="gen-canvas-insert-btn"
                            onClick={() => addAssetToCanvas(asset)}
                          >
                            <Sparkles size={11} />
                            <span>添加至画布</span>
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          className="gen-canvas-insert-btn"
                          onClick={() => addWorkflowResultToCanvas(asset.metadata?.title || "AI生成结果", asset.metadata?.output)}
                        >
                          <Sparkles size={11} />
                          <span>添加至画布</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* 正在运行加载中气泡 */}
      {isRunningWorkflow && (
        <div className="gen-msg-bubble gen-msg-ai">
          <div className="gen-avatar-ai">AI</div>
          <div className="gen-msg-body">
            <div className="gen-msg-ai-meta">正在呼唤创意模型...</div>
            <div className="gen-loading-state">
              <Loader2 className="spin" size={14} />
              <span>AI 正在全力构思并生成您的创意产物，请稍候...</span>
            </div>
          </div>
        </div>
      )}

      {/* 失败的气泡展示 */}
      {workflowResult && workflowResult.task?.status === "failed" && !isRunningWorkflow && (
        <div className="gen-msg-bubble gen-msg-ai">
          <div className="gen-avatar-ai">AI</div>
          <div className="gen-msg-body">
            <div className="gen-msg-ai-meta" style={{ color: "#ef4444" }}>❌ 生成失败</div>
            <div className="gen-msg-ai-content" style={{ color: "#ef4444", fontSize: "11px", borderColor: "rgba(239, 68, 68, 0.2)", background: "rgba(239, 68, 68, 0.03)" }}>
              {(workflowResult.output as any)?.message || "工作流执行失败，请检查 API 连接状态"}
            </div>
          </div>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}
