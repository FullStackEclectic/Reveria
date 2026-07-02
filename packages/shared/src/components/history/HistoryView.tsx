import React from "react";
import { AssetSummary, ProjectSummary } from "../../types";
import { PageFrame } from "../common/PageFrame";
import { assetUrl } from "../../utils"; // 核心：引入静态资源全路径转换函数
import "./HistoryView.css";

interface HistoryViewProps {
  assets: AssetSummary[];
  selectedProject: ProjectSummary | undefined;
  exportCurrentProject: (format: "json" | "markdown") => void;
  addWorkflowResultToCanvas?: (title: string, output: any) => void;
}

export function HistoryView({
  assets,
  selectedProject,
  exportCurrentProject,
  addWorkflowResultToCanvas,
}: HistoryViewProps) {
  // 1. 本地状态
  const [activeTab, setActiveTab] = React.useState<"all" | "text" | "image" | "video">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [copyFeedback, setCopyFeedback] = React.useState("");
  const [previewImageUrl, setPreviewImageUrl] = React.useState<string | null>(null);

  // 选中的对话会话组 (包含该时间段连续多轮对话下的所有资产)
  const [selectedTaskGroup, setSelectedTaskGroup] = React.useState<any | null>(null);

  const pageSize = 12; // 紧凑行排版每页 12 条会话

  // 2. 解析资产元数据
  const parsedItems = React.useMemo(() => {
    return assets.map(asset => {
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
      return {
        ...asset,
        meta,
        taskType,
      };
    });
  }, [assets]);

  // 3. 核心体验革命：时间滑动窗口聚类算法
  const taskGroups = React.useMemo(() => {
    const sortedItems = [...parsedItems].sort((a, b) => {
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    const groups: {
      taskId: string;      
      taskType: string;    
      createdAt: string;   
      lastActiveAt: string;
      prompts: string[];   
      model: string;       
      assets: typeof parsedItems;
    }[] = [];

    const TIME_THRESHOLD_MS = 10 * 60 * 1000; 

    sortedItems.forEach(item => {
      const itemTime = new Date(item.created_at || Date.now()).getTime();
      const promptText = item.meta.prompt || (item as any).reason || "AI 创意工作流运行";

      let matchedGroup = groups.find(g => {
        const timeDiff = Math.abs(itemTime - new Date(g.lastActiveAt).getTime());
        return timeDiff <= TIME_THRESHOLD_MS;
      });

      if (matchedGroup) {
        matchedGroup.assets.push(item);
        matchedGroup.lastActiveAt = item.created_at || new Date().toISOString();
        if (promptText && !matchedGroup.prompts.includes(promptText)) {
          matchedGroup.prompts.push(promptText);
        }
        if (item.meta.model && item.meta.model !== "GPT-4o") {
          matchedGroup.model = item.meta.model;
        }
      } else {
        groups.push({
          taskId: (item as any).task_id || item.meta.task_id || `group-${item.id}`,
          taskType: item.taskType || item.asset_type || "image",
          createdAt: item.created_at || new Date().toISOString(),
          lastActiveAt: item.created_at || new Date().toISOString(),
          prompts: [promptText],
          model: item.meta.model || "GPT-4o",
          assets: [item]
        });
      }
    });

    return groups.sort((a, b) => {
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    });
  }, [parsedItems]);

  // 4. 计算统计
  const stats = React.useMemo(() => {
    const text = taskGroups.filter(g => g.taskType.includes("text") || g.assets.some(a => a.asset_type === "document")).length;
    const image = taskGroups.filter(g => g.taskType.includes("image") || g.assets.some(a => a.asset_type === "image")).length;
    const video = taskGroups.filter(g => g.taskType.includes("video") || g.assets.some(a => a.asset_type === "video")).length;
    return {
      all: taskGroups.length,
      text,
      image,
      video,
    };
  }, [taskGroups]);

  // 5. 多维条件过滤
  const filteredGroups = React.useMemo(() => {
    return taskGroups.filter(group => {
      if (activeTab === "text") {
        if (!group.taskType.includes("text") && !group.assets.some(a => a.asset_type === "document")) return false;
      } else if (activeTab === "image") {
        if (!group.taskType.includes("image") && !group.assets.some(a => a.asset_type === "image")) return false;
      } else if (activeTab === "video") {
        if (!group.taskType.includes("video") && !group.assets.some(a => a.asset_type === "video")) return false;
      }

      if (startDate) {
        const start = new Date(startDate + "T00:00:00");
        const gDate = new Date(group.lastActiveAt);
        if (gDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate + "T23:59:59");
        const gDate = new Date(group.lastActiveAt);
        if (gDate > end) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPrompts = group.prompts.some(p => p.toLowerCase().includes(q));
        const matchTaskId = group.taskId.toLowerCase().includes(q);
        const matchModel = group.model.toLowerCase().includes(q);
        const matchAssetVal = group.assets.some(a => {
          const content = a.meta.output || a.meta.summary || a.file_url || "";
          return typeof content === "string" && content.toLowerCase().includes(q);
        });
        return matchPrompts || matchTaskId || matchModel || matchAssetVal;
      }

      return true;
    });
  }, [taskGroups, activeTab, startDate, endDate, searchQuery]);

  // 翻页重置
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, startDate, endDate]);

  // 分页切片
  const paginatedGroups = React.useMemo(() => {
    return filteredGroups.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  }, [filteredGroups, currentPage]);

  const totalPages = Math.ceil(filteredGroups.length / pageSize) || 1;

  // 复制与追加画布工具
  const triggerCopy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(""), 1500);
  };

  const handleAddToCanvas = (title: string, output: any) => {
    if (addWorkflowResultToCanvas) {
      addWorkflowResultToCanvas(title, output);
      triggerCopy("", "追加内容至工作台画布成功！");
    } else {
      triggerCopy("", "已成功复制节点数据，您可以前往画布白板进行粘贴");
    }
  };

  // 6. 弹窗内部：将聚合的资产按具体的单次提问（task_id）重新细分，还原真实对话时间线
  const detailSubTaskGroups = React.useMemo(() => {
    if (!selectedTaskGroup) return [];
    
    const subMap: Record<string, {
      taskId: string;
      prompt: string;
      createdAt: string;
      assets: typeof parsedItems;
    }> = {};

    selectedTaskGroup.assets.forEach((asset: any) => {
      const subId = asset.task_id || asset.meta.task_id || `sub-${asset.id}`;
      if (!subMap[subId]) {
        subMap[subId] = {
          taskId: subId,
          prompt: asset.meta.prompt || asset.reason || "AI 创意生成",
          createdAt: asset.created_at || new Date().toISOString(),
          assets: []
        };
      }
      subMap[subId].assets.push(asset);
    });

    return Object.values(subMap).sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [selectedTaskGroup]);

  return (
    <PageFrame
      title="项目生成记录"
      status={`${assets.length} 条资产已智能归集成 ${taskGroups.length} 组连续对话`}
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
      {/* 复制反馈 */}
      {copyFeedback && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#1c1917",
          color: "#ffffff",
          padding: "8px 16px",
          borderRadius: "8px",
          fontSize: "12px",
          fontWeight: "700",
          zIndex: 99999,
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)"
        }}>
          ✓ {copyFeedback}
        </div>
      )}

      {/* 图片放大预览 */}
      {previewImageUrl && (
        <div 
          onClick={() => setPreviewImageUrl(null)}
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.85)",
            display: "flex", justifyContent: "center", alignItems: "center",
            zIndex: 999999,
            cursor: "zoom-out",
            animation: "fadeIn 0.2s ease"
          }}
        >
          <img src={previewImageUrl} alt="原图预览" style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain", borderRadius: "8px" }} />
        </div>
      )}

      {/* 📊 数据指标看板 */}
      <section className="metrics-container" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginBottom: "20px" }}>
        <div className="credits-metric-card" style={{ cursor: "pointer", borderLeft: "4px solid #6366f1" }} onClick={() => setActiveTab("all")}>
          <span className="metric-label">📊 连续对话总笔数</span>
          <span className="metric-value">{stats.all} 组对话</span>
        </div>
        <div className="credits-metric-card" style={{ cursor: "pointer", borderLeft: "4px solid #f97316" }} onClick={() => setActiveTab("text")}>
          <span className="metric-label">💬 文本/多轮问答</span>
          <span className="metric-value">{stats.text} 组日志</span>
        </div>
        <div className="credits-metric-card" style={{ cursor: "pointer", borderLeft: "4px solid #3b82f6" }} onClick={() => setActiveTab("image")}>
          <span className="metric-label">🎨 图像设计绘画组</span>
          <span className="metric-value">{stats.image} 组日志</span>
        </div>
        <div className="credits-metric-card" style={{ cursor: "pointer", borderLeft: "4px solid #a855f7" }} onClick={() => setActiveTab("video")}>
          <span className="metric-label">🎬 视频分镜头生成</span>
          <span className="metric-value">{stats.video} 组日志</span>
        </div>
      </section>

      {/* 主面板 */}
      <div className="credits-table-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* tabs */}
        <div className="credits-tab-bar" style={{ margin: 0, paddingBottom: "10px" }}>
          <button
            type="button"
            className={`credits-tab-capsule ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            显示全部 ({stats.all})
          </button>
          <button
            type="button"
            className={`credits-tab-capsule ${activeTab === "text" ? "active" : ""}`}
            onClick={() => setActiveTab("text")}
          >
            💬 文本对话 ({stats.text})
          </button>
          <button
            type="button"
            className={`credits-tab-capsule ${activeTab === "image" ? "active" : ""}`}
            onClick={() => setActiveTab("image")}
          >
            🎨 图片生成 ({stats.image})
          </button>
          <button
            type="button"
            className={`credits-tab-capsule ${activeTab === "video" ? "active" : ""}`}
            onClick={() => setActiveTab("video")}
          >
            🎬 视频生成 ({stats.video})
          </button>
        </div>

        {/* 筛选栏 */}
        <div style={{
          display: "flex",
          gap: "16px",
          alignItems: "center",
          flexWrap: "wrap",
          paddingBottom: "16px",
          borderBottom: "1px solid #f5f5f4"
        }}>
          <div style={{ flex: "1 1 240px" }}>
            <input
              type="text"
              placeholder="🔍 检索对话 Prompt 提示词、流水ID、模型名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d6d3d1",
                fontSize: "13px",
                outline: "none"
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#78716c", fontWeight: "700" }}>会话时间:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid #d6d3d1",
                fontSize: "12px",
                outline: "none",
                background: "#ffffff"
              }}
            />
            <span style={{ fontSize: "12px", color: "#78716c" }}>至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid #d6d3d1",
                fontSize: "12px",
                outline: "none",
                background: "#ffffff"
              }}
            />
          </div>

          {(searchQuery || startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setStartDate("");
                setEndDate("");
              }}
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "none",
                color: "#ef4444",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: "700",
                padding: "8px 14px",
                borderRadius: "8px"
              }}
            >
              清除筛选 ×
            </button>
          )}
        </div>

        {/* 主 Timeline 列表 */}
        {paginatedGroups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px", color: "#a8a29e" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>💬</div>
            <div style={{ fontSize: "13px" }}>没有符合过滤条件的生成对话历史</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {paginatedGroups.map((group) => {
              const isGroupText = group.taskType.includes("text") || group.assets.every(a => a.asset_type === "document");
              const isGroupVideo = group.taskType.includes("video") || group.assets.some(a => a.asset_type === "video");

              const displayPrompt = group.prompts[group.prompts.length - 1] || "AI 创意会话";
              const isMultiRound = group.prompts.length > 1;

              return (
                <div
                  key={group.taskId}
                  onClick={() => setSelectedTaskGroup(group)}
                  className="task-stream-card"
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e7e5e4",
                    borderRadius: "10px",
                    padding: "12px 18px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.01)"
                  }}
                  title="点击弹出查看该连续会话下的多轮具体问答与产物"
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: "18px",
                      backgroundColor: isGroupText ? "#fff7ed" : isGroupVideo ? "#faf5ff" : "#eff6ff",
                      width: "32px", height: "32px",
                      borderRadius: "8px",
                      display: "flex", justifyContent: "center", alignItems: "center"
                    }}>
                      {isGroupText ? "💬" : isGroupVideo ? "🎬" : "🎨"}
                    </span>
                    <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: "16px", overflow: "hidden" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#6366f1", background: "rgba(99, 102, 241, 0.08)", padding: "2px 6px", borderRadius: "4px", flexShrink: 0 }}>
                        {group.model}
                      </span>
                      <span style={{ fontSize: "11px", color: "#78716c", background: "#f5f5f4", padding: "2px 6px", borderRadius: "4px", flexShrink: 0 }}>
                        {isMultiRound ? `${group.prompts.length} 轮问答 · ` : ""}{group.assets.length} 个结果
                      </span>
                      <p style={{
                        margin: 0,
                        fontSize: "13.5px",
                        fontWeight: "800",
                        color: "#1c1917",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "45vw",
                        flex: 1
                      }} title={group.prompts.join(" -> ")}>
                        {displayPrompt} {isMultiRound ? "..." : ""}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
                    <span style={{ fontSize: "12px", color: "#a8a29e" }}>
                      {new Date(group.lastActiveAt).toLocaleString()}
                    </span>
                    <span style={{ fontSize: "12px", color: "#6366f1", fontWeight: "700" }}>查看生成 &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid #f5f5f4"
          }}>
            <span style={{ fontSize: "13px", color: "#78716c" }}>
              共找到 {filteredGroups.length} 组连续对话 · 第 {currentPage} / {totalPages} 页
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "1px solid #d6d3d1",
                  fontSize: "12px",
                  background: currentPage === 1 ? "#fafaf9" : "#ffffff",
                  color: currentPage === 1 ? "#a8a29e" : "#1c1917",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer"
                }}
              >
                上一页
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                style={{
                  padding: "6px 14px",
                  borderRadius: "8px",
                  border: "1px solid #d6d3d1",
                  fontSize: "12px",
                  background: currentPage === totalPages ? "#fafaf9" : "#ffffff",
                  color: currentPage === totalPages ? "#a8a29e" : "#1c1917",
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer"
                }}
              >
                下一页
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 🔮 专属多轮生成对话详情 Modal 弹窗 */}
      {selectedTaskGroup && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(28, 25, 23, 0.4)",
          backdropFilter: "blur(8px)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          padding: "24px",
          animation: "fadeIn 0.2s ease"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "16px",
            width: "90%",
            maxWidth: "960px",
            maxHeight: "85vh",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid #e7e5e4"
          }}>
            
            {/* 弹窗头部 */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e7e5e4",
              background: "#fafaf9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start"
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#6366f1", background: "rgba(99, 102, 241, 0.08)", padding: "2px 6px", borderRadius: "4px" }}>
                    {selectedTaskGroup.model}
                  </span>
                  <span style={{ fontSize: "12px", color: "#78716c" }}>
                    会话建立: {new Date(selectedTaskGroup.createdAt).toLocaleString()}
                  </span>
                  <span style={{ fontSize: "11px", color: "#78716c", background: "#f5f5f4", padding: "2px 6px", borderRadius: "4px" }}>
                    共包含 {detailSubTaskGroups.length} 轮问答 · {selectedTaskGroup.assets.length} 个生成物
                  </span>
                </div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#1c1917", whiteSpace: "pre-wrap", lineHeight: "1.4" }}>
                  💬 多轮 AI 创作会话审计记录
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskGroup(null)}
                style={{
                  background: "#f5f5f4",
                  border: "none",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  cursor: "pointer",
                  color: "#57534e",
                  fontWeight: "bold",
                  marginLeft: "16px"
                }}
              >
                ✕
              </button>
            </div>

            {/* 弹窗多轮问答对话流主区域 */}
            <div style={{ padding: "24px", overflowY: "auto", flex: 1, background: "#fcfbfb", display: "flex", flexDirection: "column", gap: "20px" }}>
              {detailSubTaskGroups.map((subGroup, index) => {
                const subMediaAssets = subGroup.assets.filter(a => a.asset_type === "image" || a.asset_type === "video");
                const subTextAssets = subGroup.assets.filter(a => a.asset_type === "document" || a.taskType === "text");

                return (
                  <div
                    key={subGroup.taskId}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e7e5e4",
                      borderRadius: "14px",
                      padding: "20px",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.01)"
                    }}
                  >
                    {/* 问答对话头 (Prompt) */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      borderBottom: "1px solid #f5f5f4",
                      paddingBottom: "12px",
                      marginBottom: "16px",
                      gap: "16px"
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1 }}>
                        <span style={{
                          background: "#4f46e5",
                          color: "#ffffff",
                          fontSize: "11px",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontWeight: "800",
                          flexShrink: 0,
                          marginTop: "2px"
                        }}>
                          第 {index + 1} 轮提问
                        </span>
                        <span style={{ fontSize: "14px", fontWeight: "800", color: "#1c1917", lineHeight: "1.5" }}>
                          “ {subGroup.prompt} ”
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => triggerCopy(subGroup.prompt, "本轮 Prompt")}
                        style={{
                          background: "rgba(99, 102, 241, 0.06)",
                          border: "none",
                          color: "#4f46e5",
                          fontSize: "11px",
                          cursor: "pointer",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          fontWeight: "700",
                          flexShrink: 0
                        }}
                      >
                        复制 Prompt
                      </button>
                    </div>

                    {/* 这一轮里生成的图片/视频资产 */}
                    {subMediaAssets.length > 0 && (
                      <div style={{ marginBottom: subTextAssets.length > 0 ? "18px" : 0 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                          {subMediaAssets.map((asset: any) => {
                            const isVid = asset.asset_type === "video";
                            const fileUrl = asset.file_url || "";
                            
                            return (
                              <div
                                key={asset.id}
                                className="compact-media-item-card"
                                style={{
                                  width: "150px",
                                  height: "150px",
                                  borderRadius: "10px",
                                  border: "1px solid #e7e5e4",
                                  position: "relative",
                                  overflow: "hidden",
                                  background: "#f5f5f4",
                                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                                }}
                              >
                                {isVid ? (
                                  <video src={assetUrl(fileUrl)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <img src={assetUrl(fileUrl)} alt="生图产物" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                )}
                                
                                {/* 悬浮操作覆盖遮罩 */}
                                <div
                                  className="media-hover-overlay"
                                  style={{
                                    position: "absolute",
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: "rgba(28, 25, 23, 0.75)",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    gap: "8px",
                                    opacity: 0,
                                    transition: "opacity 0.2s ease"
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => isVid ? null : setPreviewImageUrl(assetUrl(fileUrl))}
                                    style={{ padding: "4px 8px", fontSize: "11px", color: "#fff", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "4px", cursor: isVid ? "default" : "pointer" }}
                                  >
                                    {isVid ? "🎥 视频文件" : "🔍 放大原图"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddToCanvas(subGroup.prompt, assetUrl(fileUrl))}
                                    style={{ padding: "4px 8px", fontSize: "11px", color: "#fff", background: "#4f46e5", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "700" }}
                                  >
                                    ⚡ 加至画布
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 这一轮里生成的文本文案 */}
                    {subTextAssets.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {subTextAssets.map((asset) => {
                          const content = asset.meta.output || asset.meta.summary || asset.file_url || "";
                          const title = asset.meta.title || "生成报告";
                          
                          return (
                            <div
                              key={asset.id}
                              style={{
                                background: "#fafaf9",
                                border: "1px solid #e7e5e4",
                                borderRadius: "8px",
                                padding: "14px"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", borderBottom: "1px solid #e7e5e4", paddingBottom: "6px" }}>
                                <span style={{ fontSize: "12px", fontWeight: "700", color: "#44403c" }}>{title}</span>
                                <div style={{ display: "flex", gap: "8px" }}>
                                  <button
                                    type="button"
                                    onClick={() => triggerCopy(typeof content === "string" ? content : JSON.stringify(content), "文本文案")}
                                    style={{ padding: "2px 8px", fontSize: "11px", cursor: "pointer", border: "1px solid #d6d3d1", background: "#fff", borderRadius: "4px" }}
                                  >
                                    复制文案
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAddToCanvas(title, content)}
                                    style={{ padding: "2px 8px", fontSize: "11px", cursor: "pointer", border: "none", background: "#4f46e5", color: "#fff", borderRadius: "4px", fontWeight: "700" }}
                                  >
                                    ⚡ 加至画布
                                  </button>
                                </div>
                              </div>
                              <div style={{
                                fontSize: "13px",
                                color: "#292524",
                                lineHeight: "1.6",
                                whiteSpace: "pre-wrap",
                                maxHeight: "200px",
                                overflowY: "auto"
                              }}>
                                {typeof content === "string" ? content : JSON.stringify(content, null, 2)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

            {/* 弹窗底部操作 */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #e7e5e4",
              background: "#fafaf9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontSize: "11px", color: "#78716c" }}>
                聚合会话 ID: <code onClick={() => triggerCopy(selectedTaskGroup.taskId, "会话组")} style={{ cursor: "pointer", background: "#e7e5e4", padding: "2px 4px" }}>{selectedTaskGroup.taskId}</code>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTaskGroup(null)}
                style={{
                  background: "#1c1917",
                  border: "none",
                  color: "#ffffff",
                  padding: "8px 20px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                关闭详情
              </button>
            </div>

          </div>
        </div>
      )}
    </PageFrame>
  );
}
