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
      <section className="metrics">
        <Metric label="当前套餐" value={planName} />
        <Metric label="存储空间额度" value={quotaGB} />
        <Metric label="最大成员限制" value={`${memberLimit} 人`} />
        <Metric label="点数余额" value={formattedCredits} />
      </section>

      <div style={{ marginBottom: "12px", fontSize: "14px", fontWeight: "600", color: "#6b645d" }}>
        点数明细
      </div>
      <section className="metrics" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <Metric label="充值点数 (永久)" value={`${formattedRecharge} 点`} />
        <Metric label="赠送点数 (有效期30天)" value={`${formattedGift} 点`} />
        <Metric label="退款点数 (永久)" value={`${formattedRefund} 点`} />
      </section>

      {pendingOrder && (
        <div
          className="panel pending-order-panel"
          style={{
            border: "2px solid var(--accent-color, #6366f1)",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
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
              <h3 style={{ margin: 0, color: "var(--accent-color, #6366f1)" }}>
                待支付订阅订单
              </h3>
              <span style={{ fontSize: "12px" }}>
                创建于: {new Date(pendingOrder.created_at).toLocaleString()}
              </span>
            </div>
            <span
              className="badge pending"
              style={{
                backgroundColor: "#fef3c7",
                color: "#d97706",
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
              <p style={{ margin: "4px 0" }}>
                订单编号: <code>{pendingOrder.id}</code>
              </p>
              <p style={{ margin: "4px 0", fontSize: "18px", fontWeight: "bold" }}>
                金额: ¥{(pendingOrder.amount_cents / 100).toFixed(2)} 元
              </p>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={isPayingOrder}
              onClick={() => void handleMockPay()}
              style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
            >
              {isPayingOrder ? "正在支付..." : "💰 模拟付款成功"}
            </button>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginBottom: "20px" }}>
        <div className="panel-header">
          <h3>套餐订阅方案</h3>
          <span>升级套餐以提升成员数量与存储配额，并获取更多月度赠送点数</span>
        </div>
        <div
          className="plans-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
            marginTop: "16px",
          }}
        >
          {plans.map((plan) => {
            const isCurrent =
              activeWorkspace?.plan_id === plan.id ||
              (!activeWorkspace?.plan_id && plan.price_cents === 0);
            return (
              <div
                className={`plan-card ${isCurrent ? "active" : ""}`}
                key={plan.id}
                style={{
                  border: isCurrent ? "2px solid #10b981" : "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  backgroundColor: isCurrent ? "#f0fdf4" : "transparent",
                }}
              >
                {isCurrent && (
                  <span
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      backgroundColor: "#10b981",
                      color: "#fff",
                      fontSize: "11px",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      fontWeight: "bold",
                    }}
                  >
                    正在使用
                  </span>
                )}
                <div>
                  <h4 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>{plan.name}</h4>
                  <p
                    className="price"
                    style={{ margin: "0 0 16px 0", fontSize: "24px", fontWeight: "bold" }}
                  >
                    ¥{(plan.price_cents / 100).toFixed(2)}{" "}
                    <span style={{ fontSize: "14px", fontWeight: "normal", color: "#6b7280" }}>
                      / 月
                    </span>
                  </p>
                  <ul style={{ paddingLeft: "20px", margin: "0 0 20px 0", lineHeight: "1.6" }}>
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
                  className={isCurrent ? "secondary-button current" : "primary-button"}
                  type="button"
                  disabled={isCurrent || isCreatingOrder}
                  onClick={() => void handleCreateOrder(plan.id)}
                  style={{ width: "100%" }}
                >
                  {isCurrent ? "当前套餐" : isCreatingOrder ? "正在下单..." : "立即订购"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div
          className="panel-header"
          style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "12px", marginBottom: "16px" }}
        >
          <div style={{ display: "flex", gap: "16px" }}>
            <button
              type="button"
              onClick={() => setCreditsTab("transactions")}
              style={{
                border: "none",
                background: "none",
                fontSize: "16px",
                fontWeight: creditsTab === "transactions" ? "bold" : "normal",
                color: creditsTab === "transactions" ? "var(--accent-color, #6366f1)" : "#6b7280",
                borderBottom:
                  creditsTab === "transactions"
                    ? "2px solid var(--accent-color, #6366f1)"
                    : "none",
                paddingBottom: "8px",
                cursor: "pointer",
              }}
            >
              消费流水 (Transactions)
            </button>
            <button
              type="button"
              onClick={() => setCreditsTab("recharges")}
              style={{
                border: "none",
                background: "none",
                fontSize: "16px",
                fontWeight: creditsTab === "recharges" ? "bold" : "normal",
                color: creditsTab === "recharges" ? "var(--accent-color, #6366f1)" : "#6b7280",
                borderBottom:
                  creditsTab === "recharges"
                    ? "2px solid var(--accent-color, #6366f1)"
                    : "none",
                paddingBottom: "8px",
                cursor: "pointer",
              }}
            >
              充值历史 (Recharges)
            </button>
          </div>
        </div>

        {creditsTab === "transactions" ? (
          <div className="project-list">
            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af" }}>
                暂无积分消费流水记录
              </div>
            ) : (
              transactions.map((transaction) => (
                <div
                  className="project-row"
                  key={transaction.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div>
                    <strong style={{ display: "block" }}>{transaction.transaction_type}</strong>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      {transaction.reason ?? "无备注"}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <small
                      style={{
                        fontWeight: "bold",
                        color: transaction.amount > 0 ? "#10b981" : "#ef4444",
                        fontSize: "14px",
                      }}
                    >
                      {transaction.amount > 0 ? "+" : ""}
                      {transaction.amount} 点
                    </small>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="project-list">
            {rechargeRecords.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af" }}>
                暂无充值历史记录
              </div>
            ) : (
              rechargeRecords.map((record) => (
                <div
                  className="project-row"
                  key={record.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "12px",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                >
                  <div>
                    <strong style={{ display: "block" }}>
                      {record.recharge_type === "plan_monthly"
                        ? "套餐赠送 (Subscription)"
                        : "系统补点 (Adjustment)"}
                    </strong>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>
                      订单号:{" "}
                      {record.order_id ? <code>{record.order_id}</code> : "管理员补发"}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <small style={{ fontWeight: "bold", color: "#10b981", fontSize: "14px" }}>
                      +{record.credits_added} 点
                    </small>
                    <span style={{ display: "block", fontSize: "10px", color: "#9ca3af" }}>
                      {new Date(record.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </PageFrame>
  );
}
