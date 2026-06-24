import React from "react";
import {
  WorkspaceSummary,
  PlanSummary,
  OrderSummary,
  RechargeRecordSummary,
  CreditTransactionSummary,
} from "../../types";
import { PageFrame } from "../common/PageFrame";
import { Metric } from "../common/Metric";
import "./CreditsView.css";


interface CreditsViewProps {
  activeWorkspace: WorkspaceSummary | undefined;
  plans: PlanSummary[];
  transactions: CreditTransactionSummary[];
  rechargeRecords: RechargeRecordSummary[];
  pendingOrder: OrderSummary | null;
  isPayingOrder: boolean;
  isCreatingOrder: boolean;
  creditsTab: "transactions" | "recharges";
  setCreditsTab: (tab: "transactions" | "recharges") => void;
  handleMockPay: () => Promise<void>;
  handleCreateOrder: (planId: string) => Promise<void>;
  formattedCredits: string;
  formattedRecharge: string;
  formattedGift: string;
  formattedRefund: string;
}

export function CreditsView({
  activeWorkspace,
  plans,
  transactions,
  rechargeRecords,
  pendingOrder,
  isPayingOrder,
  isCreatingOrder,
  creditsTab,
  setCreditsTab,
  handleMockPay,
  handleCreateOrder,
  formattedCredits,
  formattedRecharge,
  formattedGift,
  formattedRefund,
}: CreditsViewProps) {
  const currentPlan = plans.find((p) => p.id === activeWorkspace?.plan_id);
  const planName = currentPlan ? currentPlan.name : "免费版";
  const rawQuota = activeWorkspace?.storage_quota ?? 1073741824;
  const quotaGB = (rawQuota / (1024 * 1024 * 1024)).toFixed(0) + " GB";
  const memberLimit = currentPlan ? currentPlan.max_members : 2;

  return (
    <PageFrame
      eyebrow="商业计费"
      title="套餐与点数中心"
      status={`${activeWorkspace?.name ?? "默认工作区"} · ${formattedCredits} 点`}
    >
      <section className="metrics-container">
        <div className="credits-metric-card">
          <span className="metric-label">当前套餐</span>
          <span className="metric-value">{planName}</span>
        </div>
        <div className="credits-metric-card">
          <span className="metric-label">存储空间额度</span>
          <span className="metric-value">{quotaGB}</span>
        </div>
        <div className="credits-metric-card">
          <span className="metric-label">最大成员限制</span>
          <span className="metric-value">{memberLimit} 人</span>
        </div>
        <div className="credits-metric-card">
          <span className="metric-label">点数余额</span>
          <span className="metric-value" style={{ color: "#6366f1" }}>{formattedCredits}</span>
        </div>
      </section>

      <div style={{ marginBottom: "12px", fontSize: "14px", fontWeight: "700", color: "#1c1917" }}>
        点数明细
      </div>
      <section className="metrics-container" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <div className="credits-metric-card">
          <span className="metric-label">充值点数 (永久)</span>
          <span className="metric-value">{formattedRecharge} 点</span>
        </div>
        <div className="credits-metric-card">
          <span className="metric-label">赠送点数 (有效期30天)</span>
          <span className="metric-value" style={{ color: "#f97316" }}>{formattedGift} 点</span>
        </div>
        <div className="credits-metric-card">
          <span className="metric-label">退款点数 (永久)</span>
          <span className="metric-value">{formattedRefund} 点</span>
        </div>
      </section>

      {pendingOrder && (
        <div className="panel credits-pending-order-card">
          <div
            className="panel-header"
            style={{
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h3 style={{ margin: 0, color: "#f97316", fontWeight: 800, fontSize: "16px" }}>
                待支付订阅订单
              </h3>
              <span style={{ fontSize: "12px", color: "#78716c" }}>
                创建于: {new Date(pendingOrder.created_at).toLocaleString()}
              </span>
            </div>
            <span
              className="badge pending"
              style={{
                backgroundColor: "#ffedd5",
                color: "#ea580c",
                padding: "4px 8px",
                borderRadius: "4px",
                fontSize: "12px",
                fontWeight: "bold",
              }}
            >
              待支付
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ margin: "4px 0", color: "#57534e", fontSize: "13px" }}>
                订单编号: <code style={{ background: "rgba(234, 88, 12, 0.05)", padding: "2px 6px", borderRadius: "4px" }}>{pendingOrder.id}</code>
              </p>
              <p style={{ margin: "4px 0", fontSize: "18px", fontWeight: "bold", color: "#1c1917" }}>
                金额: ¥{(pendingOrder.amount_cents / 100).toFixed(2)} 元
              </p>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={isPayingOrder}
              onClick={() => void handleMockPay()}
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", color: "#ffffff", borderRadius: "8px", padding: "10px 20px", fontWeight: "600", cursor: "pointer" }}
            >
              {isPayingOrder ? "正在支付..." : "💰 模拟付款成功"}
            </button>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: "24px", background: "none", border: "none", boxShadow: "none", padding: 0 }}>
        <div className="panel-header" style={{ marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#1c1917" }}>套餐订阅方案</h3>
          <span style={{ fontSize: "12px", color: "#78716c" }}>升级套餐以提升成员数量与存储配额，并获取更多月度赠送点数</span>
        </div>
        <div className="plans-grid-modern">
          {plans.map((plan) => {
            const isCurrent =
              activeWorkspace?.plan_id === plan.id ||
              (!activeWorkspace?.plan_id && plan.price_cents === 0);
            return (
              <div
                className={`plan-card-modern ${isCurrent ? "active-plan" : ""}`}
                key={plan.id}
              >
                {isCurrent && (
                  <span className="plan-badge-active">正在使用</span>
                )}
                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#1c1917", fontWeight: 800 }}>{plan.name}</h4>
                  <p
                    className="price"
                    style={{ margin: "0 0 16px 0", fontSize: "24px", fontWeight: "800", color: isCurrent ? "#6366f1" : "#1c1917" }}
                  >
                    ¥{(plan.price_cents / 100).toFixed(2)}{" "}
                    <span style={{ fontSize: "14px", fontWeight: "normal", color: "#78716c" }}>
                      / 月
                    </span>
                  </p>
                  <ul style={{ paddingLeft: "20px", margin: "0 0 20px 0", lineHeight: "1.6", color: "#57534e", fontSize: "13px" }}>
                    <li>
                      月度赠送点数: <strong>{plan.monthly_credits.toLocaleString()}</strong> 点
                    </li>
                    <li>
                      云存储配额:{" "}
                      <strong>
                        {(plan.storage_quota_bytes / (1024 * 1024 * 1024)).toFixed(0)} GB
                      </strong>
                    </li>
                    <li>
                      成员席位限制: <strong>{plan.max_members}</strong> 人
                    </li>
                    {plan.price_cents > 0 ? (
                      <li>支持高阶大模型与高毛利任务</li>
                    ) : (
                      <li>仅支持基础模型任务</li>
                    )}
                  </ul>
                </div>
                <button
                  className={isCurrent ? "secondary-button" : "primary-button"}
                  type="button"
                  disabled={isCurrent || isCreatingOrder}
                  onClick={() => void handleCreateOrder(plan.id)}
                  style={{ width: "100%", borderRadius: "8px", minHeight: "38px" }}
                >
                  {isCurrent ? "当前套餐" : isCreatingOrder ? "正在下单..." : "立即订购"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="credits-table-panel">
        <div className="credits-tab-bar">
          <button
            type="button"
            className={`credits-tab-capsule ${creditsTab === "transactions" ? "active" : ""}`}
            onClick={() => setCreditsTab("transactions")}
          >
            消费流水 (Transactions)
          </button>
          <button
            type="button"
            className={`credits-tab-capsule ${creditsTab === "recharges" ? "active" : ""}`}
            onClick={() => setCreditsTab("recharges")}
          >
            充值历史 (Recharges)
          </button>
        </div>

        {creditsTab === "transactions" ? (
          <div className="credits-list">
            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#a8a29e", fontSize: "13px" }}>
                暂无积分消费流水记录
              </div>
            ) : (
              <table className="credits-data-table">
                <thead>
                  <tr>
                    <th>交易类型</th>
                    <th>关联备注</th>
                    <th style={{ textAlign: "right" }}>点数变更</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td><strong>{transaction.transaction_type}</strong></td>
                      <td>{transaction.reason ?? "无备注"}</td>
                      <td style={{ textAlign: "right", fontWeight: "bold", color: transaction.amount > 0 ? "#10b981" : "#ef4444", fontSize: "14px" }}>
                        {transaction.amount > 0 ? "+" : ""}
                        {transaction.amount} 点
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="credits-list">
            {rechargeRecords.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#a8a29e", fontSize: "13px" }}>
                暂无充值历史记录
              </div>
            ) : (
              <table className="credits-data-table">
                <thead>
                  <tr>
                    <th>来源项目</th>
                    <th>订单单号 / 说明</th>
                    <th>时间</th>
                    <th style={{ textAlign: "right" }}>变更数值</th>
                  </tr>
                </thead>
                <tbody>
                  {rechargeRecords.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>
                          {record.recharge_type === "plan_monthly"
                            ? "套餐赠送 (Subscription)"
                            : "系统补点 (Adjustment)"}
                        </strong>
                      </td>
                      <td>
                        {record.order_id ? <code>{record.order_id}</code> : <span style={{ color: "#78716c" }}>管理员补发</span>}
                      </td>
                      <td style={{ fontSize: "12px", color: "#78716c" }}>
                        {new Date(record.created_at).toLocaleString()}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "bold", color: "#10b981", fontSize: "14px" }}>
                        +{record.credits_added} 点
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
