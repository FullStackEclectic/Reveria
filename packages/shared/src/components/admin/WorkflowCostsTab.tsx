import React from "react";
import { WorkspaceCostReportResponse } from "../../types";
import { formatMicroCost } from "../../utils";

interface WorkflowCostsTabProps {
  costReport: WorkspaceCostReportResponse | null;
}

export function WorkflowCostsTab({ costReport }: WorkflowCostsTabProps) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {costReport ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", height: "100%", minHeight: 0 }}>
          {/* 指标面板 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "16px", flexShrink: 0 }}>
            <div className="workflow-cost-card">
              <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>总任务消耗点数</span>
              <strong style={{ display: "block", fontSize: "18px", color: "var(--rv-color-primary)", marginTop: "6px", fontWeight: "850" }}>
                {(costReport.total_consumed_credits ?? (costReport as any).total_actual_credits ?? 0)} 点
              </strong>
            </div>
            <div className="workflow-cost-card">
              <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>退款释放点数</span>
              <strong style={{ display: "block", fontSize: "18px", color: "var(--rv-color-primary)", marginTop: "6px", fontWeight: "850" }}>
                {(costReport.total_refunded_credits ?? 0)} 点
              </strong>
            </div>
            <div className="workflow-cost-card">
              <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>失败任务数</span>
              <strong style={{ display: "block", fontSize: "18px", color: "#dc2626", marginTop: "6px", fontWeight: "850" }}>
                {(costReport.failed_model_call_count ?? 0)} 次
              </strong>
            </div>
            <div className="workflow-cost-card">
              <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", fontWeight: "700" }}>上游折算算力成本</span>
              <strong style={{ display: "block", fontSize: "18px", color: "var(--rv-color-text-main)", marginTop: "6px", fontWeight: "850" }}>
                {formatMicroCost(costReport.provider_cost_micro ?? (costReport as any).total_upstream_cost ?? 0)}
              </strong>
            </div>
            <div className="workflow-cost-card" style={{ background: "rgba(15, 118, 110, 0.04)", border: "1px solid rgba(15, 118, 110, 0.15)" }}>
              <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-primary)", fontWeight: "700" }}>算力销售整体毛利</span>
              <strong style={{ display: "block", fontSize: "18px", color: "var(--rv-color-primary)", marginTop: "6px", fontWeight: "850" }}>
                {((costReport.margin_rate ?? 0) * 100).toFixed(2)}%
              </strong>
            </div>
          </div>

          {/* 归因分析 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", flex: 1, minHeight: 0 }}>
            <div className="workflow-content-card" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
              <h4 style={{ fontSize: "14px", fontWeight: "800", margin: "0 0 16px 0", color: "var(--rv-color-text-main)", borderBottom: "1px solid rgba(0,0,0,0.04)", paddingBottom: "10px", flexShrink: 0 }}>
                项目算力归因排行
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", flex: 1 }}>
                {(costReport.projects || []).map((proj) => (
                  <div key={proj.project_id} style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.04)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", alignItems: "center" }}>
                    <div>
                      <strong style={{ color: "var(--rv-color-text-main)" }}>{proj.project_name}</strong>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", marginTop: "3px" }}>
                        {proj.task_count} 次生成 · 预算 {proj.budget_credits ?? "不设限"}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ color: "var(--rv-color-primary)" }}>{proj.consumed_credits} 点</strong>
                      <div style={{ fontSize: "10px", color: proj.margin_rate >= 0 ? "#059669" : "#dc2626", marginTop: "3px", fontWeight: "800" }}>
                        {(proj.margin_rate * 100).toFixed(1)}% 毛利
                      </div>
                    </div>
                  </div>
                ))}
                {(!costReport.projects || costReport.projects.length === 0) && (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--rv-color-text-muted)", fontSize: "13px" }}>
                    暂无项目算力归因数据
                  </div>
                )}
              </div>
            </div>

            <div className="workflow-content-card" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
              <h4 style={{ fontSize: "14px", fontWeight: "800", margin: "0 0 16px 0", color: "var(--rv-color-text-main)", borderBottom: "1px solid rgba(0,0,0,0.04)", paddingBottom: "10px", flexShrink: 0 }}>
                任务类型算力归因
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", flex: 1 }}>
                {(costReport.task_types || []).map((type) => (
                  <div key={type.task_type} style={{ display: "flex", justifyContent: "space-between", background: "#f8fafc", border: "1px solid rgba(15, 23, 42, 0.04)", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", alignItems: "center" }}>
                    <div>
                      <strong style={{ color: "var(--rv-color-text-main)" }}>{type.task_type}</strong>
                      <span style={{ display: "block", fontSize: "11px", color: "var(--rv-color-text-muted)", marginTop: "3px" }}>
                        {type.task_count} 次执行 · 预算预估 {type.estimated_credits} 点
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <strong style={{ color: "var(--rv-color-primary)" }}>{type.actual_credits} 点</strong>
                      <div style={{ fontSize: "10px", color: type.margin_rate >= 0 ? "#059669" : "#dc2626", marginTop: "3px", fontWeight: "800" }}>
                        {(type.margin_rate * 100).toFixed(1)}% 毛利
                      </div>
                    </div>
                  </div>
                ))}
                {(!costReport.task_types || costReport.task_types.length === 0) && (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--rv-color-text-muted)", fontSize: "13px" }}>
                    暂无任务类型算力归因数据
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="workflow-content-card" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--rv-color-text-muted)" }}>
          正在加载大盘成本与毛利报表...
        </div>
      )}
    </div>
  );
}
