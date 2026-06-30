import { useRef, useEffect, useState } from "react";
import { Sparkles, Loader2, Image, ChevronRight } from "lucide-react";
import { AssetSummary, UserSummary, WorkflowResult } from "../../types";
import { assetUrl, assetTitle, getAssetMetadata } from "../../utils";

interface WorkflowHistoryFeedProps {
  aiAssets: AssetSummary[];
  currentUser: UserSummary | null;
  selectedProjectId: string;
  feedbacks: Record<string, "up" | "down" | "">;
  handleFeedback: (assetId: string, type: "up" | "down") => void;
  handleReedit: (promptText?: string, refImageUrl?: string) => void;
  handleRegenerate: (promptText?: string, type?: string, refImageUrl?: string) => void;
  addAssetToCanvas?: (asset: AssetSummary) => void;
  addWorkflowResultToCanvas: (title: string, output: any) => void;
  isRunningWorkflow: boolean;
  workflowResult: WorkflowResult | null;
  setPreviewAsset: (asset: AssetSummary | null) => void;
  activeTask?: any;
  activeProgress?: number;
}

interface GroupedChatItem {
  type: "single" | "gallery";
  asset?: AssetSummary;
  assets?: AssetSummary[];
  id: string;
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
  activeTask,
  activeProgress = 0,
}: WorkflowHistoryFeedProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // 每一组 Gallery 的当前选中项，键为 gallery.id，值为选中的 asset.id
  const [selectedAssetMap, setSelectedAssetMap] = useState<Record<string, string>>({});

  // 自动滚动到最新消息
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiAssets.length, isRunningWorkflow, workflowResult, activeTask?.status, activeProgress]);

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

  // 对连续的、同一次生成的、相同提示词的 asset 进行智能聚类分组
  function groupAIAssets(assets: AssetSummary[]): GroupedChatItem[] {
    const result: GroupedChatItem[] = [];
    let currentGroup: AssetSummary[] = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      const isGeneratedImage = asset.asset_type === "image" && asset.source === "generated";

      if (!isGeneratedImage) {
        if (currentGroup.length > 0) {
          result.push(createGroupedItem(currentGroup));
          currentGroup = [];
        }
        result.push({
          type: "single",
          asset: asset,
          id: asset.id
        });
        continue;
      }

      if (currentGroup.length === 0) {
        currentGroup.push(asset);
      } else {
        const prevAsset = currentGroup[currentGroup.length - 1];
        const prevMeta = getAssetMetadata(prevAsset);
        const currMeta = getAssetMetadata(asset);

        const prevPrompt = (prevMeta?.prompt || "").trim();
        const currPrompt = (currMeta?.prompt || "").trim();

        const prevTime = prevAsset.created_at ? new Date(prevAsset.created_at).getTime() : 0;
        const currTime = asset.created_at ? new Date(asset.created_at).getTime() : 0;

        const isSamePrompt = prevPrompt === currPrompt && prevPrompt !== "";
        const isCloseTime = Math.abs(currTime - prevTime) <= 10000; // 10秒内判定为同批次

        if (isSamePrompt && isCloseTime) {
          currentGroup.push(asset);
        } else {
          result.push(createGroupedItem(currentGroup));
          currentGroup = [asset];
        }
      }
    }

    if (currentGroup.length > 0) {
      result.push(createGroupedItem(currentGroup));
    }

    return result;
  }

  function createGroupedItem(group: AssetSummary[]): GroupedChatItem {
    if (group.length === 1) {
      return {
        type: "single",
        asset: group[0],
        id: group[0].id
      };
    }
    return {
      type: "gallery",
      assets: group,
      id: `gallery_${group[0].id}`
    };
  }

  const chatItems = groupAIAssets(aiAssets);

  return (
    <div className="gen-chat-feed">
      {chatItems.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", color: "var(--rv-color-text-muted)", fontSize: "12px", textAlign: "center", padding: "40px 20px" }}>
          <Sparkles size={24} style={{ color: "var(--rv-color-primary)", opacity: 0.7 }} />
          <span>欢迎使用 AI 创意工坊！在下方输入创意灵感，一键召唤您的智能创意助手。</span>
        </div>
      ) : (
        chatItems.map((item) => {
          if (item.type === "single" && item.asset) {
            const asset = item.asset;
            const isImage = asset.asset_type === "image";
            const meta = getAssetMetadata(asset);
            const promptText = meta?.prompt || meta?.brief || (isImage ? "创意绘图" : "文字工作流");
            const rawModelName = meta?.model || "GPT Image 2";
            const modelName = typeof rawModelName === "string" ? rawModelName.replace(/\s*\(.*?\)\s*/g, "") : String(rawModelName);
            const sizeStr = meta?.size_str || meta?.dimensions || (typeof meta?.size === "string" ? meta.size : "16:9(2k)");
            const qualityStr = meta?.quality || "medium";

            return (
              <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* 用户提问气泡 */}
                <div className="gen-msg-bubble gen-msg-user" style={{ alignSelf: "flex-end", flexDirection: "row-reverse" }}>
                  <div className="gen-avatar-user">{currentUser?.display_name?.slice(0, 1).toUpperCase() || "U"}</div>
                  <div className="gen-msg-body" style={{ alignItems: "flex-end" }}>
                    {meta?.ref_image_url && (
                      <div 
                        className="gen-user-ref-preview"
                        style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "6px",
                          overflow: "hidden",
                          border: "1px solid var(--rv-color-border-thin)",
                          marginBottom: "6px",
                          boxShadow: "var(--rv-shadow-sm)",
                          cursor: "pointer",
                          background: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                        onClick={() => setPreviewAsset({ ...asset, file_url: meta.ref_image_url })}
                        title="点击预览此任务的参考图"
                      >
                        <img 
                          src={assetUrl(meta.ref_image_url)} 
                          alt="Reference input" 
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        />
                      </div>
                    )}
                    <div className="gen-msg-text">{promptText}</div>
                  </div>
                </div>

                {/* AI 答案单图气泡 */}
                <div className="gen-msg-bubble gen-msg-ai">
                  <div className="gen-avatar-ai">AI</div>
                  <div className="gen-msg-body">
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

                    <div className="gen-msg-ai-content">
                      {isImage ? (
                        <div className="gen-result-images">
                          <div 
                            className="gen-result-image-wrapper"
                            onClick={() => setPreviewAsset(asset)}
                            title="点击放大预览图片"
                          >
                            <img src={assetUrl(asset.file_url ?? asset.thumbnail_url ?? "")} alt="AI output" />
                          </div>
                        </div>
                      ) : (
                        renderWorkflowTextOutput(asset.metadata?.output)
                      )}

                      <div className="gen-msg-actions">
                        <div className="gen-action-icons">
                          <button
                            type="button"
                            className="gen-action-icon-btn"
                            title="以此为基础编辑"
                            onClick={() => handleReedit(promptText, meta?.ref_image_url)}
                          >
                            <span style={{ fontSize: "12px" }}>✏️</span>
                          </button>
                          <button
                            type="button"
                            className="gen-action-icon-btn"
                            title="重新生成"
                            onClick={() => handleRegenerate(promptText, asset.metadata?.task_type, meta?.ref_image_url)}
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
          } else if (item.type === "gallery" && item.assets) {
            // 一图多图聚合画廊气泡
            const batchAssets = item.assets;
            const activeId = selectedAssetMap[item.id] || batchAssets[0].id;
            const activeAsset = batchAssets.find(a => a.id === activeId) || batchAssets[0];
            
            const meta = getAssetMetadata(activeAsset);
            const promptText = meta?.prompt || meta?.brief || "创意绘图";
            const rawModelName = meta?.model || "GPT Image 2";
            const modelName = typeof rawModelName === "string" ? rawModelName.replace(/\s*\(.*?\)\s*/g, "") : String(rawModelName);
            const sizeStr = meta?.size_str || meta?.dimensions || (typeof meta?.size === "string" ? meta.size : "1:1");
            const qualityStr = meta?.quality || "medium";

            return (
              <div key={item.id} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* 用户提问气泡 */}
                <div className="gen-msg-bubble gen-msg-user" style={{ alignSelf: "flex-end", flexDirection: "row-reverse" }}>
                  <div className="gen-avatar-user">{currentUser?.display_name?.slice(0, 1).toUpperCase() || "U"}</div>
                  <div className="gen-msg-body" style={{ alignItems: "flex-end" }}>
                    {meta?.ref_image_url && (
                      <div 
                        className="gen-user-ref-preview"
                        style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "6px",
                          overflow: "hidden",
                          border: "1px solid var(--rv-color-border-thin)",
                          marginBottom: "6px",
                          boxShadow: "var(--rv-shadow-sm)",
                          cursor: "pointer",
                          background: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                        onClick={() => setPreviewAsset({ ...activeAsset, file_url: meta.ref_image_url })}
                        title="点击预览此任务的参考图"
                      >
                        <img 
                          src={assetUrl(meta.ref_image_url)} 
                          alt="Reference input" 
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        />
                      </div>
                    )}
                    <div className="gen-msg-text">{promptText}</div>
                  </div>
                </div>

                {/* AI 批量生图聚合画廊气泡 */}
                <div className="gen-msg-bubble gen-msg-ai">
                  <div className="gen-avatar-ai">AI</div>
                  <div className="gen-msg-body">
                    <div className="gen-msg-ai-meta">
                      <span>✨ 多图画廊 (已生成 {batchAssets.length} 张)</span>
                      <span>·</span>
                      <span style={{ fontWeight: 600 }}>{modelName}</span>
                      <span>·</span>
                      <span>{getQualityLabel(qualityStr)}</span>
                      <span>·</span>
                      <span>{sizeStr}</span>
                    </div>

                    <div className="gen-msg-ai-content" style={{ padding: "12px", background: "var(--rv-color-bg-sidebar)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "12px" }}>
                      
                      {/* 横向 Flex 画廊结构：左侧大预览，右侧垂直小图排开 */}
                      <div style={{ display: "flex", gap: "12px", width: "100%", boxSizing: "border-box" }}>
                        
                        {/* 左侧：选中大图预览区 */}
                        <div 
                          style={{ 
                            flex: 1, 
                            height: "360px", 
                            borderRadius: "8px", 
                            overflow: "hidden", 
                            border: "1px solid var(--rv-color-border-thin)",
                            background: "rgba(0,0,0,0.02)",
                            cursor: "zoom-in",
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          onClick={() => setPreviewAsset(activeAsset)}
                          title="点击放大预览"
                        >
                          <img 
                            src={assetUrl(activeAsset.file_url ?? activeAsset.thumbnail_url ?? "")} 
                            alt="AI gallery focus" 
                            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
                          />
                        </div>

                        {/* 右侧：垂直缩略图选项卡 */}
                        <div 
                          style={{ 
                            width: "56px", 
                            display: "flex", 
                            flexDirection: "column", 
                            gap: "8px", 
                            overflowY: "auto", 
                            maxHeight: "360px",
                            paddingRight: "2px"
                          }}
                        >
                          {batchAssets.map((asset, index) => {
                            const isSelected = asset.id === activeId;
                            return (
                              <div
                                key={asset.id}
                                onClick={() => setSelectedAssetMap(prev => ({ ...prev, [item.id]: asset.id }))}
                                style={{
                                  width: "48px",
                                  height: "48px",
                                  borderRadius: "6px",
                                  overflow: "hidden",
                                  border: isSelected 
                                    ? "2px solid var(--rv-color-primary)" 
                                    : "2px solid var(--rv-color-border-thin)",
                                  boxShadow: isSelected ? "0 0 8px rgba(15, 118, 110, 0.4)" : "none",
                                  cursor: "pointer",
                                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                  opacity: isSelected ? 1 : 0.7,
                                  background: "#ffffff",
                                  boxSizing: "border-box"
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.opacity = "1";
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.opacity = "0.7";
                                }}
                              >
                                <img 
                                  src={assetUrl(asset.thumbnail_url ?? asset.file_url ?? "")} 
                                  alt={`Thumbnail ${index + 1}`}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 底栏动作条 (关联当前选中的 activeAsset) */}
                      <div className="gen-msg-actions" style={{ marginTop: "12px", borderTop: "1px solid var(--rv-color-border-thin)", paddingTop: "8px" }}>
                        <div className="gen-action-icons">
                          <button
                            type="button"
                            className="gen-action-icon-btn"
                            title="以此为基础编辑"
                            onClick={() => handleReedit(promptText, meta?.ref_image_url)}
                          >
                            <span style={{ fontSize: "12px" }}>✏️</span>
                          </button>
                          <button
                            type="button"
                            className="gen-action-icon-btn"
                            title="重新生成"
                            onClick={() => handleRegenerate(promptText, activeAsset.metadata?.task_type, meta?.ref_image_url)}
                          >
                            <span style={{ fontSize: "12px" }}>🔄</span>
                          </button>
                          <button
                            type="button"
                            className={`gen-action-icon-btn ${feedbacks[activeAsset.id] === "up" ? "active" : ""}`}
                            title="点赞"
                            onClick={() => handleFeedback(activeAsset.id, "up")}
                          >
                            <span style={{ fontSize: "12px" }}>👍</span>
                          </button>
                          <button
                            type="button"
                            className={`gen-action-icon-btn ${feedbacks[activeAsset.id] === "down" ? "active" : ""}`}
                            title="点踩"
                            onClick={() => handleFeedback(activeAsset.id, "down")}
                          >
                            <span style={{ fontSize: "12px" }}>👎</span>
                          </button>
                        </div>

                        {addAssetToCanvas && (
                          <button
                            type="button"
                            className="gen-canvas-insert-btn"
                            onClick={() => addAssetToCanvas(activeAsset)}
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
          }
          return null;
        })
      )}

      {/* 正在进行中的后台任务临时气泡 (透出排队/进度百分比, 以及当初垫图和描述) */}
      {activeTask && (activeTask.status === "pending" || activeTask.status === "running" || activeTask.status === "queue" || activeTask.status === "processing") && (() => {
        let activePrompt = "";
        let activeRefImageUrl = "";
        if (activeTask.input_payload) {
          try {
            const payloadObj = typeof activeTask.input_payload === "string" 
              ? JSON.parse(activeTask.input_payload) 
              : activeTask.input_payload;
            activePrompt = payloadObj?.prompt || "";
            activeRefImageUrl = payloadObj?.ref_image_url || "";
          } catch (e) {}
        }
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px", width: "100%" }}>
            {/* 1. 进行中：用户提问卡片 */}
            <div className="gen-msg-bubble gen-msg-user" style={{ alignSelf: "flex-end", flexDirection: "row-reverse" }}>
              <div className="gen-avatar-user">{currentUser?.display_name?.slice(0, 1).toUpperCase() || "U"}</div>
              <div className="gen-msg-body" style={{ alignItems: "flex-end" }}>
                {activeRefImageUrl && (
                  <div 
                    className="gen-user-ref-preview"
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "6px",
                      overflow: "hidden",
                      border: "1px solid var(--rv-color-border-thin)",
                      marginBottom: "6px",
                      boxShadow: "var(--rv-shadow-sm)",
                      background: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    <img 
                      src={assetUrl(activeRefImageUrl)} 
                      alt="Reference input" 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    />
                  </div>
                )}
                <div className="gen-msg-text">{activePrompt || "创意绘图"}</div>
              </div>
            </div>

            {/* 2. 进行中：AI 进度反馈骨架卡片 */}
            <div className="gen-msg-bubble gen-msg-ai">
              <div className="gen-avatar-ai">AI</div>
              <div className="gen-msg-body">
                <div className="gen-msg-ai-meta">
                  <span>✨ 图像生成</span>
                  <span>·</span>
                  <span style={{ fontWeight: 600 }}>{activeTask.selected_model ? String(activeTask.selected_model).replace(/\s*\(.*?\)\s*/g, "") : "gpt-image-2"}</span>
                </div>

                <div className="gen-msg-ai-content">
                  <div 
                    style={{
                      width: "100%",
                      height: "220px",
                      borderRadius: "10px",
                      border: "1px dashed var(--rv-color-border-thin)",
                      background: "rgba(185, 178, 165, 0.03)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "12px",
                      padding: "20px",
                      boxSizing: "border-box",
                      position: "relative",
                      overflow: "hidden"
                    }}
                  >
                    <Loader2 size={24} style={{ color: "var(--rv-color-primary)", animation: "spin 2s linear infinite" }} />
                    <span style={{ fontSize: "12px", color: "var(--rv-color-text-main)", fontWeight: "bold" }}>
                      {activeProgress > 0 ? `⚡ 正在生成 ${activeProgress}%` : "⌛ 思考排队中..."}
                    </span>
                    
                    {/* 进度条 */}
                    <div style={{ width: "80%", height: "4px", background: "rgba(185, 178, 165, 0.15)", borderRadius: "2px", overflow: "hidden", marginTop: "4px" }}>
                      <div 
                        style={{
                          width: `${activeProgress}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, var(--rv-color-primary-light, #c084fc), var(--rv-color-primary))",
                          borderRadius: "2px",
                          transition: "width 0.4s ease-out"
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
