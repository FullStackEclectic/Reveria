import React, { useState } from "react";
import { Settings, BarChart3, Play } from "lucide-react";
import { WorkflowTemplateSummary, WorkspaceCostReportResponse, GenerationTaskSummary, UserSummary } from "../../types";
import { WorkflowTemplatesTab } from "./WorkflowTemplatesTab";
import { WorkflowCostsTab } from "./WorkflowCostsTab";
import { WorkflowTasksTab } from "./WorkflowTasksTab";

interface WorkflowTaskPanelProps {
  workflowTemplates: WorkflowTemplateSummary[];
  setWorkflowTemplates: React.Dispatch<React.SetStateAction<WorkflowTemplateSummary[]>>;
  costReport: WorkspaceCostReportResponse | null;
  tasks: GenerationTaskSummary[];
  setTasks: React.Dispatch<React.SetStateAction<GenerationTaskSummary[]>>;
  currentUser: UserSummary | null;
  setTransactions: React.Dispatch<React.SetStateAction<any[]>>;
  setAdminMessage: (msg: string) => void;
}

export function WorkflowTaskPanel({
  workflowTemplates,
  setWorkflowTemplates,
  costReport,
  tasks,
  setTasks,
  currentUser,
  setTransactions,
  setAdminMessage,
}: WorkflowTaskPanelProps) {
  const [subTab, setSubTab] = useState<"templates" | "costs" | "tasks">("templates");

  return (
    <div className="workflow-panel-container">
      {/* 注入调度配置专属的高级 CSS 样式规则 */}
      <style dangerouslySetInnerHTML={{__html: `
        .workflow-panel-container {
          display: flex;
          flex-direction: column;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          /* 高度占满屏幕，并扣除顶部导航的高度 */
          height: calc(100vh - 165px);
          min-height: 520px;
          box-sizing: border-box;
        }
        
        /* 药丸状子 TAB 导航 */
        .workflow-tabs-wrapper {
          display: flex;
          gap: 6px;
          background: rgba(15, 23, 42, 0.04);
          border: 1px solid rgba(0, 0, 0, 0.03);
          border-radius: 12px;
          padding: 5px;
          align-self: flex-start;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.015);
          margin-bottom: 20px;
          flex-shrink: 0;
        }
        
        .workflow-tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          border: none;
          background: transparent;
          color: var(--rv-color-text-muted);
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .workflow-tab-btn:hover {
          color: var(--rv-color-text-main);
          background: rgba(15, 23, 42, 0.02);
        }
        
        .workflow-tab-btn.active {
          background: #ffffff;
          color: var(--rv-color-primary);
          box-shadow: 0 4px 12px rgba(15, 118, 110, 0.08), 0 2px 4px rgba(0, 0, 0, 0.02);
        }
        
        /* 高级大卡片 */
        .workflow-content-card {
          background: #ffffff !important;
          border: 1px solid rgba(0, 0, 0, 0.04) !important;
          border-radius: 16px !important;
          box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.03), 0 8px 12px -6px rgba(0, 0, 0, 0.02) !important;
          padding: 24px !important;
          box-sizing: border-box;
        }
        
        /* 扁平微调输入域 */
        .workflow-form-input, .workflow-form-textarea {
          width: 100%;
          background: #f8fafc !important;
          border: 1px solid rgba(15, 23, 42, 0.08) !important;
          border-radius: 8px !important;
          padding: 10px 14px !important;
          font-size: 13px !important;
          color: var(--rv-color-text-main) !important;
          transition: all 0.25s ease-in-out !important;
          box-sizing: border-box;
          outline: none;
        }
        
        .workflow-form-input:focus, .workflow-form-textarea:focus {
          background: #ffffff !important;
          border-color: var(--rv-color-primary) !important;
          box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12) !important;
        }
        
        .workflow-form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        
        .workflow-form-field label {
          font-size: 12px;
          font-weight: 700;
          color: var(--rv-color-text-muted);
          padding-left: 2px;
        }
        
        /* 渐变主按钮 */
        .workflow-primary-gradient-btn {
          background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%) !important;
          border: none !important;
          color: #ffffff !important;
          border-radius: 8px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          padding: 12px 20px !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          box-shadow: 0 4px 14px rgba(15, 118, 110, 0.25) !important;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        
        .workflow-primary-gradient-btn:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 20px rgba(15, 118, 110, 0.35) !important;
        }
        
        .workflow-primary-gradient-btn:active {
          transform: translateY(1px) !important;
        }
        
        /* 工作流看板卡片 */
        .workflow-item-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          padding: 14px 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.01);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .workflow-item-card:hover {
          border-color: rgba(0, 0, 0, 0.08);
          box-shadow: 0 6px 16px rgba(0,0,0,0.03);
          transform: translateX(3px);
        }
        
        /* 财务指标卡 */
        .workflow-cost-card {
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          padding: 16px 20px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.015);
          transition: all 0.2s ease;
        }
        
        .workflow-cost-card:hover {
          border-color: rgba(15, 118, 110, 0.15);
          box-shadow: 0 6px 18px rgba(15, 118, 110, 0.04);
          transform: translateY(-1px);
        }
        
        /* 任务条目列 */
        .workflow-task-row {
          display: flex;
          align-items: center;
          background: #ffffff;
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-sizing: border-box;
        }
        
        .workflow-task-row:hover {
          border-color: rgba(0, 0, 0, 0.08);
          background: #fafafa;
        }
        
        .workflow-task-row.selected {
          background: rgba(15, 118, 110, 0.05) !important;
          border-color: var(--rv-color-primary) !important;
          box-shadow: 0 4px 12px rgba(15, 118, 110, 0.06) !important;
        }
        
        /* 协作批注气泡 */
        .workflow-comment-bubble {
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.04);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.01);
        }
        
        /* 现代化极客 Pre 代码框 */
        .workflow-pre-console {
          background: #0f172a !important;
          padding: 12px 14px !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          border-radius: 10px !important;
          font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
          font-size: 11px !important;
          line-height: 1.5 !important;
          color: #38bdf8 !important;
          overflow-y: auto;
          margin: 6px 0 0 0 !important;
          white-space: pre-wrap;
          word-break: break-all;
        }
        
        /* 任务检索过滤面板 */
        .workflow-filter-bar {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(0, 0, 0, 0.04);
          border-radius: 12px;
          padding: 10px 16px;
          margin-bottom: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.01);
          align-items: center;
          flex-shrink: 0;
        }
        
        .workflow-filter-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .workflow-filter-item label {
          font-size: 10px;
          font-weight: 800;
          color: var(--rv-color-text-muted);
          text-transform: uppercase;
        }
        
        .workflow-filter-select, .workflow-filter-input {
          background: #f8fafc;
          border: 1px solid rgba(15, 23, 42, 0.06);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 11px;
          color: var(--rv-color-text-main);
          outline: none;
          transition: border-color 0.2s;
        }
        
        .workflow-filter-select:focus, .workflow-filter-input:focus {
          border-color: var(--rv-color-primary);
          background: #ffffff;
        }
      `}} />

      {/* 现代化 Pill-like TAB 导航 */}
      <div className="workflow-tabs-wrapper">
        <button
          onClick={() => setSubTab("templates")}
          className={`workflow-tab-btn ${subTab === "templates" ? "active" : ""}`}
          type="button"
        >
          <Settings size={14} />
          工作流引擎模板
        </button>
        <button
          onClick={() => setSubTab("costs")}
          className={`workflow-tab-btn ${subTab === "costs" ? "active" : ""}`}
          type="button"
        >
          <BarChart3 size={14} />
          成本利润分析
        </button>
        <button
          onClick={() => setSubTab("tasks")}
          className={`workflow-tab-btn ${subTab === "tasks" ? "active" : ""}`}
          type="button"
        >
          <Play size={14} />
          任务队列监控
        </button>
      </div>

      {subTab === "templates" && (
        <WorkflowTemplatesTab
          workflowTemplates={workflowTemplates}
          setWorkflowTemplates={setWorkflowTemplates}
          setAdminMessage={setAdminMessage}
        />
      )}

      {subTab === "costs" && (
        <WorkflowCostsTab
          costReport={costReport}
        />
      )}

      {subTab === "tasks" && (
        <WorkflowTasksTab
          tasks={tasks}
          setTasks={setTasks}
          setTransactions={setTransactions}
          setAdminMessage={setAdminMessage}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
