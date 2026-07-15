import React from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { AISession } from "../../types";

interface SessionHeaderProps {
  activeSession: AISession | null;
  sessions: AISession[];
  currentSessionId: string;
  setCurrentSessionId: (id: string) => void;
  isSessionDropdownOpen: boolean;
  setIsSessionDropdownOpen: (open: boolean) => void;
  sessionDropdownRef: React.RefObject<HTMLDivElement | null>;
  handleRemoveSession: (sessionId: string, e: React.MouseEvent) => void;
  handleCreateNewSession: () => void;
  onClose?: () => void;
}

export const SessionHeader: React.FC<SessionHeaderProps> = ({
  activeSession,
  sessions,
  currentSessionId,
  setCurrentSessionId,
  isSessionDropdownOpen,
  setIsSessionDropdownOpen,
  sessionDropdownRef,
  handleRemoveSession,
  handleCreateNewSession,
  onClose
}) => {
  return (
    <div 
      className="panel-header"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid var(--rv-color-border-thin)",
        margin: 0,
        background: "rgba(185, 178, 165, 0.05)",
        flexShrink: 0
      }}
    >
      {/* 会话下拉选择 */}
      <div style={{ position: "relative" }} ref={sessionDropdownRef}>
        <button
          type="button"
          className="gen-session-dropdown-trigger"
          onClick={() => setIsSessionDropdownOpen(!isSessionDropdownOpen)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            background: "transparent",
            border: "none",
            fontSize: "14px",
            fontWeight: "bold",
            color: "var(--rv-color-text-main)",
            cursor: "pointer",
            padding: "4px 8px",
            borderRadius: "4px"
          }}
        >
          <span>{activeSession?.title || "AI 对话"}</span>
          <ChevronDown size={12} />
        </button>

        {isSessionDropdownOpen && (
          <div
            className="gen-mode-dropdown-menu"
            style={{
              position: "absolute",
              top: "32px",
              bottom: "auto",
              left: "8px",
              width: "220px",
              maxHeight: "300px",
              overflowY: "auto",
              zIndex: 200,
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), var(--rv-shadow-lg)",
              background: "var(--rv-color-bg-sidebar, #ffffff)",
              border: "1px solid var(--rv-color-border-thin)",
              borderRadius: "6px",
              padding: "4px"
            }}
          >
            <div style={{ padding: "6px 10px", fontSize: "10px", fontWeight: "bold", color: "var(--rv-color-text-muted)", borderBottom: "1px solid rgba(185, 178, 165, 0.1)" }}>
              历史会话列表
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  style={{
                    padding: "6px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    boxSizing: "border-box",
                    background: s.id === currentSessionId ? "rgba(185, 178, 165, 0.08)" : "transparent",
                    borderRadius: "4px",
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    if (s.id !== currentSessionId) e.currentTarget.style.background = "rgba(185, 178, 165, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (s.id !== currentSessionId) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* 左侧可点击切换区域 */}
                  <div
                    onClick={() => {
                      setCurrentSessionId(s.id);
                      setIsSessionDropdownOpen(false);
                    }}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      cursor: "pointer",
                      textAlign: "left",
                      overflow: "hidden",
                      paddingRight: "6px"
                    }}
                  >
                    <span style={{ fontSize: "11px", fontWeight: "bold", color: s.id === currentSessionId ? "var(--rv-color-primary)" : "var(--rv-color-text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>
                      {s.title}
                    </span>
                    <span style={{ fontSize: "9px", color: "var(--rv-color-text-muted)", marginTop: "2px" }}>
                      {new Date(s.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  {/* 右侧微型删除垃圾桶 */}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveSession(s.id, e)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: "10px",
                      padding: "4px",
                      opacity: 0.5,
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "3px"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                      e.currentTarget.style.color = "#ef4444";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.5";
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "inherit";
                    }}
                    title="删除此会话"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 新建与关闭 */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          type="button"
          onClick={handleCreateNewSession}
          title="开启新对话"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "22px",
            height: "22px",
            border: "none",
            background: "rgba(185, 178, 165, 0.08)",
            color: "var(--rv-color-text-main)",
            borderRadius: "50%",
            cursor: "pointer",
            fontSize: "11px",
            transition: "background 0.2s"
          }}
        >
          <Plus size={13} />
        </button>
        {onClose && (
          <button
            type="button"
            className="gen-drawer-close"
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              color: "var(--rv-color-text-muted)",
              borderRadius: "4px",
              transition: "all 0.2s"
            }}
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
