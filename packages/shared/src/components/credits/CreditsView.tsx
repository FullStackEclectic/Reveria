import React from "react";
import {
  WorkspaceSummary,
  PlanSummary,
  OrderSummary,
  RechargeRecordSummary,
  CreditTransactionSummary,
} from "../../types";
import { PageFrame } from "../common/PageFrame";
import { formatCredits } from "../../utils";
import "./CreditsView.css";
import { Check, Zap } from "lucide-react";
import { AllLogsModal } from "./AllLogsModal";

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
  const filteredTransactions = transactions.filter(t => t.transaction_type !== "freeze");
  const rechargeBalance = activeWorkspace?.recharge_balance ?? 0;
  const planName = currentPlan 
    ? currentPlan.name 
    : rechargeBalance > 0 
      ? "按量付费版 (Credits Base)" 
      : "免费体验版";

  const pointsPackages = plans.filter((p) => p.is_points_package);
  const subscriptionPlans = plans.filter((p) => !p.is_points_package);

  // 状态：当前选中的充值包商品 ID
  const [selectedPkgId, setSelectedPkgId] = React.useState<string>("");

  // 状态：是否打开日志中心 Modal
  const [isAllLogsOpen, setIsAllLogsOpen] = React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState("");

  // 如果页面刚加载时 pointsPackages 还没加载出来，防崩溃保护
  React.useEffect(() => {
    if (pointsPackages.length > 0 && !selectedPkgId) {
      setSelectedPkgId(pointsPackages[0].id);
    }
  }, [pointsPackages, selectedPkgId]);



  // 控制首屏只显示最近 5 条流水，保障一屏内显示
  const displayedTransactions = filteredTransactions.slice(0, 5);
  const displayedRecharges = rechargeRecords.slice(0, 5);

  // 空间和席位额度计算
  const rawQuota = activeWorkspace?.storage_quota ?? 1073741824;
  const quotaGB = (rawQuota / (1024 * 1024 * 1024)).toFixed(0);
  // 假定当前使用了 1.2 GB 空间进行可视化展示
  const usedStorageGB = 1.2;
  const storagePercent = Math.min(100, Math.max(5, (usedStorageGB / parseFloat(quotaGB)) * 100));

  const memberLimit = currentPlan ? currentPlan.max_members : 2;
  // 假定当前使用了 2 个成员席位
  const usedMembers = 2;
  const memberPercent = Math.min(100, Math.max(10, (usedMembers / memberLimit) * 100));


  return (
    <PageFrame
      eyebrow="商业计费"
      title="套餐与积分中心"
      status={`${activeWorkspace?.name ?? "默认工作区"} · ${formattedCredits} 积分`}
    >
      {/* 复制成功气泡反馈 */}
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
          <Check size={14} /> 已成功复制 {copyFeedback} ID 
        </div>
      )}

      {/* 待支付订单提示 */}
      {pendingOrder && (
        <div className="panel credits-pending-order-card" style={{ marginBottom: "20px" }}>
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
              <h3 style={{ margin: 0, color: "#f97316", fontWeight: 800, fontSize: "15px" }}>
                待支付订阅/充值订单
              </h3>
              <span style={{ fontSize: "11px", color: "#78716c" }}>
                创建于: {new Date(pendingOrder.created_at).toLocaleString()}
              </span>
            </div>
            <span
              className="badge pending"
              style={{
                backgroundColor: "#ffedd5",
                color: "#ea580c",
                padding: "3px 6px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: "bold",
              }}
            >
              待支付
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={{ margin: "2px 0", color: "#57534e", fontSize: "12px" }}>
                订单编号: <code style={{ background: "rgba(234, 88, 12, 0.05)", padding: "2px 6px", borderRadius: "4px" }}>{pendingOrder.id}</code>
              </p>
              <p style={{ margin: "2px 0", fontSize: "16px", fontWeight: "bold", color: "#1c1917" }}>
                金额: ¥{(pendingOrder.amount_cents / 100).toFixed(2)} 元
              </p>
            </div>
            <button
              className="primary-button"
              type="button"
              disabled={isPayingOrder}
              onClick={() => void handleMockPay()}
              style={{ background: "linear-gradient(135deg, #f97316, #ea580c)", border: "none", color: "#ffffff", borderRadius: "8px", padding: "8px 16px", fontWeight: "600", cursor: "pointer", fontSize: "13px" }}
            >
              {isPayingOrder ? "正在支付..." : "模拟付款成功"}
            </button>
          </div>
        </div>
      )}

      {/* 核心大双栏布局 */}
      <div className="credits-layout-container">
        
        {/* 左侧主栏：点数卡片与快捷充值、账单明细 */}
        <div className="credits-main-column">
          
          {/* 钱包卡片 */}
          <div className="credits-wallet-card">
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#c7d2fe", letterSpacing: "1px", textTransform: "uppercase" }}>
              账户积分余额
            </div>
            <div style={{ fontSize: "40px", fontWeight: "900", color: "#ffffff", margin: "8px 0 16px 0", display: "flex", alignItems: "center", gap: "6px" }}>
              <Zap size={32} /> {formattedCredits} <span style={{ fontSize: "16px", fontWeight: "600", color: "#e0e7ff" }}>积分</span>
            </div>
            <div className="wallet-details-grid">
              <div className="wallet-detail-item">
                <span className="wallet-detail-label">充值积分</span>
                <span className="wallet-detail-val">{formattedRecharge} 积分</span>
              </div>
              <div className="wallet-detail-item">
                <span className="wallet-detail-label">赠送积分</span>
                <span className="wallet-detail-val" style={{ color: "#fcd34d" }}>{formattedGift} 积分</span>
              </div>
              <div className="wallet-detail-item">
                <span className="wallet-detail-label">退款积分</span>
                <span className="wallet-detail-val">{formattedRefund} 积分</span>
              </div>
            </div>
          </div>

          {/* 快捷点数充值面板 */}
          <div className="quick-recharge-panel">
            <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "800", color: "#1c1917" }}>在线积分直充</h3>
            <span style={{ fontSize: "12px", color: "#78716c" }}>积分即充即用，永久有效，支持大模型生成和对话</span>
            
            <div className="quick-package-grid">
              {pointsPackages.map((pkg) => {
                const isSelected = selectedPkgId === pkg.id;
                return (
                  <div
                    key={pkg.id}
                    className={`quick-package-capsule ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedPkgId(pkg.id)}
                  >
                    <span style={{ fontSize: "16px", fontWeight: "800", color: isSelected ? "#4f46e5" : "#1c1917" }}>
                      {pkg.monthly_credits} 积分
                    </span>
                    <span style={{ fontSize: "11px", color: "#78716c", marginTop: "2px" }}>
                      ¥{(pkg.price_cents / 100).toFixed(0)} 元
                    </span>
                  </div>
                );
              })}
            </div>

            {selectedPkgId && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #f5f5f4" }}>
                <div>
                  <span style={{ fontSize: "12px", color: "#78716c" }}>应付金额</span>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#4f46e5", marginTop: "2px" }}>
                    ¥{((pointsPackages.find(p => p.id === selectedPkgId)?.price_cents ?? 0) / 100).toFixed(2)} 元
                  </div>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  disabled={isCreatingOrder}
                  onClick={() => void handleCreateOrder(selectedPkgId)}
                  style={{ borderRadius: "8px", minHeight: "36px", background: "linear-gradient(135deg, #4f46e5, #6366f1)", border: "none", color: "#ffffff", fontWeight: "600", padding: "0 24px", fontSize: "13px" }}
                >
                  {isCreatingOrder ? "订单生成中..." : "立即充值积分"}
                </button>
              </div>
            )}
          </div>

          {/* 消费流水明细 (首屏精简至 5 条，保障一屏内显示) */}
          <div className="credits-table-panel" style={{ padding: "20px" }}>
            <div className="credits-tab-bar" style={{ marginBottom: "14px" }}>
              <button
                type="button"
                className={`credits-tab-capsule ${creditsTab === "transactions" ? "active" : ""}`}
                onClick={() => setCreditsTab("transactions")}
                style={{ fontSize: "13px" }}
              >
                消费流水 (Transactions)
              </button>
              <button
                type="button"
                className={`credits-tab-capsule ${creditsTab === "recharges" ? "active" : ""}`}
                onClick={() => setCreditsTab("recharges")}
                style={{ fontSize: "13px" }}
              >
                充值历史 (Recharges)
              </button>
            </div>

            {creditsTab === "transactions" ? (
              <div className="credits-list">
                {displayedTransactions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px", color: "#a8a29e", fontSize: "12px" }}>
                    暂无积分消费流水记录
                  </div>
                ) : (
                  <>
                    <table className="credits-data-table">
                      <thead>
                        <tr>
                          <th>交易类型</th>
                          <th>关联备注</th>
                          <th style={{ textAlign: "right" }}>积分变更</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedTransactions.map((transaction) => {
                          const isMinus = transaction.transaction_type === "consume";
                          return (
                            <tr key={transaction.id}>
                              <td><strong>{transaction.transaction_type}</strong></td>
                              <td>{transaction.reason ?? "无备注"}</td>
                              <td style={{ textAlign: "right", fontWeight: "bold", color: isMinus ? "#ef4444" : "#10b981", fontSize: "13px" }}>
                                {isMinus ? "-" : "+"}
                                {transaction.amount} 积分
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    
                    <div style={{ textAlign: "center", marginTop: "14px", borderTop: "1px solid #f5f5f4", paddingTop: "12px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAllLogsOpen(true);
                        }}
                        style={{ background: "none", border: "none", color: "#6366f1", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                      >
                        管理并查看全部流水日志 &rarr;
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="credits-list">
                {displayedRecharges.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px", color: "#a8a29e", fontSize: "12px" }}>
                    暂无充值历史记录
                  </div>
                ) : (
                  <>
                    <table className="credits-data-table">
                      <thead>
                        <tr>
                          <th>来源</th>
                          <th>订单单号 / 说明</th>
                          <th>时间</th>
                          <th style={{ textAlign: "right" }}>变更数值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRecharges.map((record) => (
                          <tr key={record.id}>
                            <td>
                              <strong>
                                {record.recharge_type === "plan_monthly"
                                  ? "套餐赠送"
                                  : "积分充值"}
                              </strong>
                            </td>
                            <td>
                              {record.order_id ? <code>{record.order_id.substring(0, 8)}...</code> : <span style={{ color: "#78716c" }}>系统补发</span>}
                            </td>
                            <td style={{ fontSize: "11px", color: "#78716c" }}>
                              {new Date(record.created_at).toLocaleString()}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: "bold", color: "#10b981", fontSize: "13px" }}>
                              +{record.credits_added} 积分
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    <div style={{ textAlign: "center", marginTop: "14px", borderTop: "1px solid #f5f5f4", paddingTop: "12px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAllLogsOpen(true);
                        }}
                        style={{ background: "none", border: "none", color: "#6366f1", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                      >
                        管理并查看全部充值日志 &rarr;
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 右侧边栏：工作区特权指示、包月方案升级 */}
        <div className="credits-side-column">
          
          {/* 特权配额状态卡 */}
          <div className="side-resource-card">
            <h3 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "800", color: "#1c1917", display: "flex", alignItems: "center", gap: "6px" }}>
              {planName}
            </h3>
            
            <div className="resource-progress-item">
              <div className="progress-header">
                <span>云存储空间 (已使用)</span>
                <span>{usedStorageGB} GB / {quotaGB} GB</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${storagePercent}%` }}></div>
              </div>
            </div>

            <div className="resource-progress-item" style={{ marginTop: "18px" }}>
              <div className="progress-header">
                <span>工作区席位 (成员)</span>
                <span>{usedMembers} / {memberLimit} 人</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${memberPercent}%`, background: "linear-gradient(90deg, #3b82f6, #2563eb)" }}></div>
              </div>
            </div>
          </div>

          {/* 垂直小型订阅升级列表 */}
          <div className="compact-plans-panel">
            <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "800", color: "#1c1917" }}>包月套餐订阅</h3>
            <span style={{ fontSize: "12px", color: "#78716c" }}>订阅以升级空间与席位配额，并获赠高额月度积分</span>
            
            <div style={{ marginTop: "12px" }}>
              {subscriptionPlans.map((plan) => {
                const isCurrent =
                  activeWorkspace?.plan_id === plan.id ||
                  (!activeWorkspace?.plan_id && plan.price_cents === 0);
                
                return (
                  <div key={plan.id} className="compact-plan-row">
                    <div className="compact-plan-info">
                      <span style={{ fontSize: "14px", fontWeight: "800", color: "#1c1917" }}>
                        {plan.name}
                      </span>
                      <span style={{ fontSize: "12px", color: "#4f46e5", fontWeight: "700" }}>
                        ¥{(plan.price_cents / 100).toFixed(0)} <span style={{ fontSize: "11px", fontWeight: "normal", color: "#78716c" }}>/ 月</span>
                      </span>
                      <span style={{ fontSize: "11px", color: "#78716c", marginTop: "2px" }}>
                        送 {plan.monthly_credits.toLocaleString()} 积分 · 容纳 {plan.max_members} 人 · {(plan.storage_quota_bytes / (1024 * 1024 * 1024)).toFixed(0)}GB
                      </span>
                    </div>
                    <div>
                      <button
                        className={isCurrent ? "secondary-button" : "primary-button"}
                        type="button"
                        disabled={isCurrent || isCreatingOrder}
                        onClick={() => void handleCreateOrder(plan.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          minHeight: "30px",
                          fontWeight: "700",
                          border: isCurrent ? "1px solid #e7e5e4" : "none",
                          background: isCurrent ? "#fafaf9" : "#4f46e5",
                          color: isCurrent ? "#78716c" : "#ffffff",
                          cursor: "pointer"
                        }}
                      >
                        {isCurrent ? "使用中" : "订阅"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      <AllLogsModal
        isOpen={isAllLogsOpen}
        onClose={() => setIsAllLogsOpen(false)}
        transactions={transactions}
        rechargeRecords={rechargeRecords}
        formattedCredits={formattedCredits}
      />
    </PageFrame>
  );
}
