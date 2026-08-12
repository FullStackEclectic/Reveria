import React from "react";

interface Props {
  isSubmitting: boolean;
  taskStatus: string | null;
  errorMessage: string;
  onSubmit: () => void;
}

export function UpscalePanel({ isSubmitting, taskStatus, errorMessage, onSubmit }: Props) {
  const statusText = taskStatus === "succeeded" ? "已完成，结果已写入素材库"
    : taskStatus === "failed" || taskStatus === "error" ? "处理失败，请重试"
    : taskStatus === "pending" || taskStatus === "running" ? "正在增强细节…"
    : "";

  return (
    <div className="adjustment-subview batch-tools-panel">
      <div className="panel-title-large">AI 变清晰</div>
      <p className="professional-help-text">
        调用上游超分接口增强细节，结果作为新素材进入项目库，走任务队列与积分结算。
      </p>
      <button type="button" className="panel-submit-btn" disabled={isSubmitting} onClick={onSubmit}>
        {isSubmitting ? "提交中…" : "开始变清晰"}
      </button>
      {statusText && <p className="professional-help-text">{statusText}</p>}
      {errorMessage && <div className="lut-import-error">{errorMessage}</div>}
    </div>
  );
}
