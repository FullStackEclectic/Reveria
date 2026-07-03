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

  // 状态：是否打开专属消费/充值日志完整 Modal
  const [isAllLogsOpen, setIsAllLogsOpen] = React.useState(false);
  const [allLogsTab, setAllLogsTab] = React.useState<"transactions" | "recharges">("transactions");

  // 状态：日志搜索与过滤
  const [logSearchQuery, setLogSearchQuery] = React.useState("");
  const [logTypeFilter, setLogTypeFilter] = React.useState("all");
  const [logStartDate, setLogStartDate] = React.useState("");
  const [logEndDate, setLogEndDate] = React.useState("");
  const [copyFeedback, setCopyFeedback] = React.useState("");

  // 状态：日志分页
  const [logCurrentPage, setLogCurrentPage] = React.useState(1);
  const pageSize = 10; // 每页 10 条记录

  // 如果页面刚加载时 pointsPackages 还没加载出来，防崩溃保护
  React.useEffect(() => {
    if (pointsPackages.length > 0 && !selectedPkgId) {
      setSelectedPkgId(pointsPackages[0].id);
    }
  }, [pointsPackages, selectedPkgId]);

  // 当搜索条件或日期变更时，重置当前页码到第 1 页
  React.useEffect(() => {
    setLogCurrentPage(1);
  }, [logSearchQuery, logTypeFilter, logStartDate, logEndDate, allLogsTab]);

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

  // --- 强大日志统计计算 ---
  const totalConsumed = filteredTransactions
    .filter(t => t.transaction_type === "consume")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalRefunded = filteredTransactions
    .filter(t => t.transaction_type === "refund")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalRechargeCredits = rechargeRecords
    .reduce((sum, r) => sum + r.credits_added, 0);

  // --- 强大日志搜索过滤处理 ---
  const searchedTransactions = filteredTransactions.filter(t => {
    if (logTypeFilter !== "all" && t.transaction_type !== logTypeFilter) {
      return false;
    }
    // 日期段筛选
    if (logStartDate) {
      const start = new Date(logStartDate + "T00:00:00");
      const tDate = new Date(t.created_at || Date.now());
      if (tDate < start) return false;
    }
    if (logEndDate) {
      const end = new Date(logEndDate + "T23:59:59");
      const tDate = new Date(t.created_at || Date.now());
      if (tDate > end) return false;
    }
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      const matchReason = t.reason?.toLowerCase().includes(q);
      const matchType = t.transaction_type.toLowerCase().includes(q);
      const matchTaskId = t.task_id?.toLowerCase().includes(q);
      const matchId = t.id.toLowerCase().includes(q);
      return matchReason || matchType || matchTaskId || matchId;
    }
    return true;
  });

  const searchedRecharges = rechargeRecords.filter(r => {
    // 日期段筛选
    if (logStartDate) {
      const start = new Date(logStartDate + "T00:00:00");
      const rDate = new Date(r.created_at);
      if (rDate < start) return false;
    }
    if (logEndDate) {
      const end = new Date(logEndDate + "T23:59:59");
      const rDate = new Date(r.created_at);
      if (rDate > end) return false;
    }
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      const matchType = r.recharge_type.toLowerCase().includes(q);
      const matchId = r.id.toLowerCase().includes(q);
      const matchOrderId = r.order_id?.toLowerCase().includes(q);
      return matchType || matchId || matchOrderId;
    }
    return true;
  });

  // 对过滤后的结果进行分页切片
  const paginatedTransactions = searchedTransactions.slice(
    (logCurrentPage - 1) * pageSize,
    logCurrentPage * pageSize
  );
  const totalTxPages = Math.ceil(searchedTransactions.length / pageSize) || 1;

  const paginatedRecharges = searchedRecharges.slice(
    (logCurrentPage - 1) * pageSize,
    logCurrentPage * pageSize
  );
  const totalRechargePages = Math.ceil(searchedRecharges.length / pageSize) || 1;

  // 一键复制小工具
  const triggerCopy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(""), 1500);
  };

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
                          setAllLogsTab("transactions");
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
                          setAllLogsTab("recharges");
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

      {/* 专门的完整消费与充值流水日志 Modal (宽度加宽至 1024px 级别，具备分页及起止日期精确查询) */}
      {isAllLogsOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
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
            maxWidth: "1024px", // 加宽至 1024px
            maxHeight: "88vh",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: "1px solid #e7e5e4"
          }}>
            {/* Modal 头部 */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e7e5e4",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#1c1917" }}>日志中心</h3>
                <span style={{ fontSize: "12px", color: "#78716c" }}>查询该工作区下所有历史消费明细、入账记录及时间段筛选</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAllLogsOpen(false)}
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

            {/* 数据指标简易看板 Banner */}
            <div style={{
              padding: "16px 24px",
              background: "#fcfbfb",
              borderBottom: "1px solid #e7e5e4",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "12px"
            }}>
              <div style={{ borderLeft: "3px solid #6366f1", paddingLeft: "10px" }}>
                <span style={{ fontSize: "11px", color: "#78716c", display: "block" }}>累计消费总额</span>
                <span style={{ fontSize: "15px", fontWeight: "800", color: "#ef4444" }}>-{formatCredits(totalConsumed)} 积分</span>
              </div>
              <div style={{ borderLeft: "3px solid #10b981", paddingLeft: "10px" }}>
                <span style={{ fontSize: "11px", color: "#78716c", display: "block" }}>自动退回积分</span>
                <span style={{ fontSize: "15px", fontWeight: "800", color: "#10b981" }}>+{formatCredits(totalRefunded)} 积分</span>
              </div>
              <div style={{ borderLeft: "3px solid #f59e0b", paddingLeft: "10px" }}>
                <span style={{ fontSize: "11px", color: "#78716c", display: "block" }}>总充值入账</span>
                <span style={{ fontSize: "15px", fontWeight: "800", color: "#f59e0b" }}>+{formatCredits(totalRechargeCredits)} 积分</span>
              </div>
              <div style={{ borderLeft: "3px solid #1c1917", paddingLeft: "10px" }}>
                <span style={{ fontSize: "11px", color: "#78716c", display: "block" }}>当前结余积分</span>
                <span style={{ fontSize: "15px", fontWeight: "800", color: "#1c1917" }}>{formattedCredits} 积分</span>
              </div>
            </div>

            {/* Modal Tabs */}
            <div style={{
              padding: "12px 24px",
              background: "#fafaf9",
              borderBottom: "1px solid #e7e5e4",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className={`credits-tab-capsule ${allLogsTab === "transactions" ? "active" : ""}`}
                  onClick={() => setAllLogsTab("transactions")}
                  style={{ fontSize: "12px" }}
                >
                  消费流水日志 ({searchedTransactions.length} / {filteredTransactions.length}条)
                </button>
                <button
                  type="button"
                  className={`credits-tab-capsule ${allLogsTab === "recharges" ? "active" : ""}`}
                  onClick={() => setAllLogsTab("recharges")}
                  style={{ fontSize: "12px" }}
                >
                  充值入账日志 ({searchedRecharges.length} / {rechargeRecords.length}条)
                </button>
              </div>
            </div>

            {/* 主流多维度高级筛选过滤器面板 + 时间段选择器 Date Range Pickers */}
            <div style={{
              padding: "16px 24px",
              background: "#ffffff",
              borderBottom: "1px solid #e7e5e4",
              display: "flex",
              gap: "16px",
              alignItems: "center",
              flexWrap: "wrap"
            }}>
              {/* 模糊搜索 */}
              <div style={{ flex: "1 1 200px", minWidth: "200px" }}>
                <span style={{ fontSize: "11px", color: "#78716c", fontWeight: "700", display: "block", marginBottom: "4px" }}>模糊检索:</span>
                <input
                  type="text"
                  placeholder="搜索备注、任务 ID、流水 ID..."
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #d6d3d1",
                    fontSize: "12px",
                    outline: "none"
                  }}
                />
              </div>

              {/* 日期筛选：起始日期 */}
              <div style={{ width: "135px" }}>
                <span style={{ fontSize: "11px", color: "#78716c", fontWeight: "700", display: "block", marginBottom: "4px" }}>起始日期 (年月日):</span>
                <input
                  type="date"
                  value={logStartDate}
                  onChange={(e) => setLogStartDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: "6px",
                    border: "1px solid #d6d3d1",
                    fontSize: "12px",
                    outline: "none",
                    background: "#ffffff"
                  }}
                />
              </div>

              {/* 日期筛选：截止日期 */}
              <div style={{ width: "135px" }}>
                <span style={{ fontSize: "11px", color: "#78716c", fontWeight: "700", display: "block", marginBottom: "4px" }}>截止日期 (年月日):</span>
                <input
                  type="date"
                  value={logEndDate}
                  onChange={(e) => setLogEndDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: "6px",
                    border: "1px solid #d6d3d1",
                    fontSize: "12px",
                    outline: "none",
                    background: "#ffffff"
                  }}
                />
              </div>

              {/* 交易类型下拉框 */}
              {allLogsTab === "transactions" && (
                <div>
                  <span style={{ fontSize: "11px", color: "#78716c", fontWeight: "700", display: "block", marginBottom: "4px" }}>交易类型:</span>
                  <select
                    value={logTypeFilter}
                    onChange={(e) => setLogTypeFilter(e.target.value)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: "6px",
                      border: "1px solid #d6d3d1",
                      fontSize: "12px",
                      background: "#ffffff",
                      cursor: "pointer",
                      minWidth: "120px"
                    }}
                  >
                    <option value="all">显示全部类型</option>
                    <option value="consume">仅看扣费 (consume)</option>
                    <option value="refund">仅看退回 (refund)</option>
                  </select>
                </div>
              )}

              {/* 重置筛选 */}
              {(logSearchQuery || logStartDate || logEndDate || (allLogsTab === "transactions" && logTypeFilter !== "all")) && (
                <button
                  type="button"
                  onClick={() => {
                    setLogSearchQuery("");
                    setLogStartDate("");
                    setLogEndDate("");
                    setLogTypeFilter("all");
                  }}
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "none",
                    color: "#ef4444",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: "700",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    marginTop: "16px"
                  }}
                >
                  清除所有筛选 ×
                </button>
              )}
            </div>

            {/* Modal 内容区域 (带有完整的纵向滚动及分页) */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {allLogsTab === "transactions" ? (
                <div>
                  {paginatedTransactions.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "#a8a29e", fontSize: "13px" }}>
                      没有符合筛选条件的消费流水日志记录
                    </div>
                  ) : (
                    <>
                      <table className="credits-data-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th>流水号 ID</th>
                            <th>交易类型</th>
                            <th>积分变更</th>
                            <th>结余账户</th>
                            <th>备注原因说明</th>
                            <th>追踪标识 (Task/Project)</th>
                            <th>记录时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTransactions.map((transaction) => {
                            const isMinus = transaction.transaction_type === "consume";
                            return (
                              <tr key={transaction.id} style={{ transition: "all 0.15s ease" }}>
                                <td>
                                  <code 
                                    onClick={() => triggerCopy(transaction.id, "流水")}
                                    style={{ cursor: "pointer", fontSize: "10px", padding: "2px 4px", background: "#f5f5f4" }}
                                    title="点击复制流水 ID"
                                  >
                                    {transaction.id.substring(0, 8)}...
                                  </code>
                                </td>
                                <td>
                                  <span style={{
                                    background: isMinus ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)",
                                    color: isMinus ? "#ef4444" : "#10b981",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontWeight: "700",
                                    fontSize: "11px"
                                  }}>
                                    {transaction.transaction_type}
                                  </span>
                                </td>
                                <td style={{ fontWeight: "bold", color: isMinus ? "#ef4444" : "#10b981", fontSize: "13px" }}>
                                  {isMinus ? "-" : "+"}
                                  {formatCredits(transaction.amount)} 积分
                                </td>
                                <td style={{ fontSize: "12px", color: "#78716c", fontWeight: "600" }}>
                                  {formatCredits(transaction.balance_after)} 积分
                                </td>
                                <td style={{ fontSize: "12px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {transaction.reason ?? "无"}
                                </td>
                                <td>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                    {transaction.task_id && (
                                      <span 
                                        onClick={() => triggerCopy(transaction.task_id!, "任务")}
                                        style={{ fontSize: "10px", color: "#6366f1", cursor: "pointer", textDecoration: "underline" }}
                                        title="点击复制任务 ID"
                                      >
                                        任务: {transaction.task_id.substring(0, 8)}...
                                      </span>
                                    )}
                                    {transaction.project_id && (
                                      <span 
                                        onClick={() => triggerCopy(transaction.project_id!, "项目")}
                                        style={{ fontSize: "10px", color: "#78716c", cursor: "pointer" }}
                                        title="点击复制项目 ID"
                                      >
                                        项目: {transaction.project_id.substring(0, 8)}...
                                      </span>
                                    )}
                                    {!transaction.task_id && !transaction.project_id && (
                                      <span style={{ fontSize: "10px", color: "#a8a29e" }}>无绑定</span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ fontSize: "11px", color: "#78716c" }}>
                                  {new Date(transaction.created_at || Date.now()).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* 翻页组件 (分页) */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "16px",
                        paddingTop: "14px",
                        borderTop: "1px solid #f5f5f4"
                      }}>
                        <span style={{ fontSize: "12px", color: "#78716c" }}>
                          已筛选出 {searchedTransactions.length} 条记录 · 第 {logCurrentPage} / {totalTxPages} 页
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            disabled={logCurrentPage === 1}
                            onClick={() => setLogCurrentPage(prev => Math.max(1, prev - 1))}
                            style={{
                              padding: "5px 12px",
                              borderRadius: "6px",
                              border: "1px solid #d6d3d1",
                              fontSize: "12px",
                              background: logCurrentPage === 1 ? "#fafaf9" : "#ffffff",
                              color: logCurrentPage === 1 ? "#a8a29e" : "#1c1917",
                              cursor: logCurrentPage === 1 ? "not-allowed" : "pointer"
                            }}
                          >
                            上一页
                          </button>
                          <button
                            type="button"
                            disabled={logCurrentPage === totalTxPages}
                            onClick={() => setLogCurrentPage(prev => Math.min(totalTxPages, prev + 1))}
                            style={{
                              padding: "5px 12px",
                              borderRadius: "6px",
                              border: "1px solid #d6d3d1",
                              fontSize: "12px",
                              background: logCurrentPage === totalTxPages ? "#fafaf9" : "#ffffff",
                              color: logCurrentPage === totalTxPages ? "#a8a29e" : "#1c1917",
                              cursor: logCurrentPage === totalTxPages ? "not-allowed" : "pointer"
                            }}
                          >
                            下一页
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {paginatedRecharges.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px", color: "#a8a29e", fontSize: "13px" }}>
                      没有符合筛选条件的充值日志记录
                    </div>
                  ) : (
                    <>
                      <table className="credits-data-table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th>流水 ID</th>
                            <th>入账来源</th>
                            <th>积分变更</th>
                            <th>关联充值订单 / 操作员</th>
                            <th>入账时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedRecharges.map((record) => (
                            <tr key={record.id}>
                              <td>
                                <code 
                                  onClick={() => triggerCopy(record.id, "充值")}
                                  style={{ cursor: "pointer", fontSize: "10px", padding: "2px 4px" }}
                                  title="点击复制充值记录 ID"
                                >
                                  {record.id.substring(0, 8)}...
                                </code>
                              </td>
                              <td>
                                <span style={{
                                  background: "rgba(16, 185, 129, 0.08)",
                                  color: "#10b981",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontWeight: "700",
                                  fontSize: "11px"
                                }}>
                                  {record.recharge_type === "plan_monthly" ? "套餐赠送" : "在线直充"}
                                </span>
                              </td>
                              <td style={{ fontWeight: "bold", color: "#10b981", fontSize: "13px" }}>
                                +{record.credits_added} 积分
                              </td>
                              <td>
                                {record.order_id ? (
                                  <code 
                                    onClick={() => triggerCopy(record.order_id!, "订单")}
                                    style={{ cursor: "pointer", fontSize: "11px" }}
                                    title="点击复制关联订单 ID"
                                  >
                                    订单: {record.order_id.substring(0, 8)}...
                                  </code>
                                ) : (
                                  <span style={{ color: "#78716c", fontSize: "12px" }}>管理员手动补积分</span>
                                )}
                              </td>
                              <td style={{ fontSize: "11px", color: "#78716c" }}>
                                {new Date(record.created_at).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* 翻页组件 (分页) */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginTop: "16px",
                        paddingTop: "14px",
                        borderTop: "1px solid #f5f5f4"
                      }}>
                        <span style={{ fontSize: "12px", color: "#78716c" }}>
                          已筛选出 {searchedRecharges.length} 条记录 · 第 {logCurrentPage} / {totalRechargePages} 页
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            disabled={logCurrentPage === 1}
                            onClick={() => setLogCurrentPage(prev => Math.max(1, prev - 1))}
                            style={{
                              padding: "5px 12px",
                              borderRadius: "6px",
                              border: "1px solid #d6d3d1",
                              fontSize: "12px",
                              background: logCurrentPage === 1 ? "#fafaf9" : "#ffffff",
                              color: logCurrentPage === 1 ? "#a8a29e" : "#1c1917",
                              cursor: logCurrentPage === 1 ? "not-allowed" : "pointer"
                            }}
                          >
                            上一页
                          </button>
                          <button
                            type="button"
                            disabled={logCurrentPage === totalRechargePages}
                            onClick={() => setLogCurrentPage(prev => Math.min(totalRechargePages, prev + 1))}
                            style={{
                              padding: "5px 12px",
                              borderRadius: "6px",
                              border: "1px solid #d6d3d1",
                              fontSize: "12px",
                              background: logCurrentPage === totalRechargePages ? "#fafaf9" : "#ffffff",
                              color: logCurrentPage === totalRechargePages ? "#a8a29e" : "#1c1917",
                              cursor: logCurrentPage === totalRechargePages ? "not-allowed" : "pointer"
                            }}
                          >
                            下一页
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Modal 底部 */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #e7e5e4",
              background: "#fafaf9",
              display: "flex",
              justifyContent: "flex-end"
            }}>
              <button
                type="button"
                onClick={() => setIsAllLogsOpen(false)}
                style={{
                  background: "#1c1917",
                  border: "none",
                  color: "#ffffff",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontWeight: "600",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                关闭日志中心
              </button>
            </div>
          </div>
        </div>
      )}
    </PageFrame>
  );
}
