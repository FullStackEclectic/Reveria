import React from "react";
import { formatCredits } from "../../utils";

interface TaskDetailModalProps {
  selectedTaskGroup: any;
  onClose: () => void;
  previewImageUrl: string | null;
  setPreviewImageUrl: (url: string | null) => void;
}

export function TaskDetailModal({
  selectedTaskGroup,
  onClose,
  previewImageUrl,
  setPreviewImageUrl,
}: TaskDetailModalProps) {
  const [copyFeedback, setCopyFeedback] = React.useState("");

  const triggerCopy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(""), 1500);
  };

  const detailSubTaskGroups = React.useMemo(() => {
    if (!selectedTaskGroup) return [];
    
    const subMap: Record<string, {
      taskId: string;
      prompt: string;
      createdAt: string;
      assets: any[];
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

  if (!selectedTaskGroup) return null;

  return (
    <>
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
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}>
          ✓ 已成功复制 {copyFeedback} ID
        </div>
      )}

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
          maxHeight: "90vh",
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
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#1c1917" }}>会话详情时间线</h3>
              <span style={{ fontSize: "12px", color: "#78716c" }}>查看单组连续对话下的每一次迭代过程及生成资产</span>
            </div>
            <button
              type="button"
              onClick={onClose}
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
                fontWeight: "bold"
              }}
            >
              ×
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
                  {/* 对话轮次头部 (Prompt) */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "14px",
                    borderBottom: "1px dashed #f5f5f4",
                    paddingBottom: "10px"
                  }}>
                    <div style={{ flex: 1, paddingRight: "16px" }}>
                      <span style={{
                        fontSize: "10px",
                        color: "#6366f1",
                        fontWeight: "800",
                        textTransform: "uppercase",
                        display: "block",
                        marginBottom: "4px"
                      }}>
                        ROUND #{index + 1} · 算力任务
                      </span>
                      <p style={{ margin: 0, fontSize: "13.5px", fontWeight: "600", color: "#1c1917", lineHeight: "1.5" }}>
                        {subGroup.prompt}
                      </p>
                    </div>
                    <span style={{ fontSize: "11px", color: "#a8a29e", flexShrink: 0 }}>
                      {new Date(subGroup.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* 对话生成的媒体资产 (图片/视频) */}
                  {subMediaAssets.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "10px", marginBottom: "12px" }}>
                      {subMediaAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="history-detail-media-card"
                          style={{
                            aspectRatio: "1",
                            borderRadius: "8px",
                            overflow: "hidden",
                            background: "#f5f5f4",
                            position: "relative",
                            cursor: "pointer",
                            border: "1px solid #e7e5e4"
                          }}
                          onClick={() => setPreviewImageUrl(asset.url)}
                        >
                          <img
                            src={asset.url}
                            alt="生成缩略图"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                          <div style={{
                            position: "absolute",
                            bottom: 0, left: 0, right: 0,
                            background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                            padding: "6px 8px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}>
                            <span style={{ fontSize: "9px", color: "#ffffff", opacity: 0.8 }}>
                              {asset.asset_type === "video" ? "视频" : "图像"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 对话生成的文本资产 */}
                  {subTextAssets.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {subTextAssets.map((asset) => {
                        const wordCount = asset.content ? asset.content.length : 0;
                        return (
                          <div
                            key={asset.id}
                            style={{
                              background: "#fafaf9",
                              borderRadius: "8px",
                              padding: "12px 16px",
                              border: "1px solid #e7e5e4"
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                              <span style={{ fontSize: "11px", fontWeight: "700", color: "#57534e" }}>
                                📄 生成文本建议 ({wordCount} 字)
                              </span>
                            </div>
                            <p style={{
                              margin: 0,
                              fontSize: "12px",
                              color: "#57534e",
                              lineHeight: "1.6",
                              whiteSpace: "pre-wrap",
                              background: "#ffffff",
                              padding: "10px",
                              borderRadius: "6px",
                              border: "1px solid #f5f5f4"
                            }}>
                              {asset.content}
                            </p>
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
              onClick={onClose}
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
    </>
  );
}
