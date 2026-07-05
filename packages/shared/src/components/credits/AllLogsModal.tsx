import React from "react";
import { CreditTransactionSummary, RechargeRecordSummary } from "../../types";
import { formatCredits } from "../../utils";

interface AllLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: CreditTransactionSummary[];
  rechargeRecords: RechargeRecordSummary[];
  formattedCredits: string;
}

/**
 * 完整消费与充值流水日志弹窗，具备分页、多条件筛选、日期区间查询能力
 */
export function AllLogsModal({
  isOpen,
  onClose,
  transactions,
  rechargeRecords,
  formattedCredits,
}: AllLogsModalProps) {
  const [allLogsTab, setAllLogsTab] = React.useState<"transactions" | "recharges">("transactions");
  const [logSearchQuery, setLogSearchQuery] = React.useState("");
  const [logTypeFilter, setLogTypeFilter] = React.useState("all");
  const [logStartDate, setLogStartDate] = React.useState("");
  const [logEndDate, setLogEndDate] = React.useState("");
  const [logCurrentPage, setLogCurrentPage] = React.useState(1);
  const [copyFeedback, setCopyFeedback] = React.useState("");
  const pageSize = 10;

  // 当筛选条件变更时重置页码
  React.useEffect(() => {
    setLogCurrentPage(1);
  }, [logSearchQuery, logTypeFilter, logStartDate, logEndDate, allLogsTab]);

  const filteredTransactions = transactions.filter(t => t.transaction_type !== "freeze");

  // 统计指标
  const totalConsumed = filteredTransactions
    .filter(t => t.transaction_type === "consume")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalRefunded = filteredTransactions
    .filter(t => t.transaction_type === "refund")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalRechargeCredits = rechargeRecords
    .reduce((sum, r) => sum + r.credits_added, 0);

  // 搜索过滤
  const searchedTransactions = filteredTransactions.filter(t => {
    if (logTypeFilter !== "all" && t.transaction_type !== logTypeFilter) return false;
    if (logStartDate) {
      const start = new Date(logStartDate + "T00:00:00");
      if (new Date(t.created_at || Date.now()) < start) return false;
    }
    if (logEndDate) {
      const end = new Date(logEndDate + "T23:59:59");
      if (new Date(t.created_at || Date.now()) > end) return false;
    }
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      return (
        t.reason?.toLowerCase().includes(q) ||
        t.transaction_type.toLowerCase().includes(q) ||
        t.task_id?.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const searchedRecharges = rechargeRecords.filter(r => {
    if (logStartDate) {
      const start = new Date(logStartDate + "T00:00:00");
      if (new Date(r.created_at) < start) return false;
    }
    if (logEndDate) {
      const end = new Date(logEndDate + "T23:59:59");
      if (new Date(r.created_at) > end) return false;
    }
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      return (
        r.recharge_type.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.order_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // 分页
  const paginatedTransactions = searchedTransactions.slice(
    (logCurrentPage - 1) * pageSize, logCurrentPage * pageSize
  );
  const totalTxPages = Math.ceil(searchedTransactions.length / pageSize) || 1;
  const paginatedRecharges = searchedRecharges.slice(
    (logCurrentPage - 1) * pageSize, logCurrentPage * pageSize
  );
  const totalRechargePages = Math.ceil(searchedRecharges.length / pageSize) || 1;

  const triggerCopy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(""), 1500);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 复制反馈气泡 */}
      {copyFeedback && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          backgroundColor: "#1c1917", color: "#ffffff", padding: "8px 16px",
          borderRadius: "8px", fontSize: "12px", fontWeight: "700", zIndex: 99999,
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)", display: "flex", alignItems: "center", gap: "6px"
        }}>
          ✓ 已成功复制 {copyFeedback} ID
        </div>
      )}

      {/* 遮罩层 */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "rgba(28, 25, 23, 0.4)", backdropFilter: "blur(8px)",
        display: "flex", justifyContent: "center", alignItems: "center",
        zIndex: 9999, padding: "24px", animation: "fadeIn 0.2s ease"
      }}>
        <div style={{
          background: "#ffffff", borderRadius: "16px", width: "90%", maxWidth: "1024px",
          maxHeight: "88vh", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #e7e5e4"
        }}>
          {/* 头部 */}
          <div style={{
            padding: "20px 24px", borderBottom: "1px solid #e7e5e4",
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#1c1917" }}>日志中心</h3>
              <span style={{ fontSize: "12px", color: "#78716c" }}>查询该工作区下所有历史消费明细、入账记录及时间段筛选</span>
            </div>
            <button type="button" onClick={onClose} style={{
              background: "#f5f5f4", border: "none", borderRadius: "50%", width: "30px", height: "30px",
              display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer", color: "#57534e", fontWeight: "bold"
            }}>×</button>
          </div>

          {/* 数据指标看板 */}
          <div style={{
            padding: "16px 24px", background: "#fcfbfb", borderBottom: "1px solid #e7e5e4",
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px"
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

          {/* Tab 栏 */}
          <div style={{
            padding: "12px 24px", background: "#fafaf9", borderBottom: "1px solid #e7e5e4",
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" className={`credits-tab-capsule ${allLogsTab === "transactions" ? "active" : ""}`}
                onClick={() => setAllLogsTab("transactions")} style={{ fontSize: "12px" }}>
                消费流水日志 ({searchedTransactions.length} / {filteredTransactions.length}条)
              </button>
              <button type="button" className={`credits-tab-capsule ${allLogsTab === "recharges" ? "active" : ""}`}
                onClick={() => setAllLogsTab("recharges")} style={{ fontSize: "12px" }}>
                充值入账日志 ({searchedRecharges.length} / {rechargeRecords.length}条)
              </button>
            </div>
          </div>

          {/* 筛选器面板 */}
          <div style={{
            padding: "16px 24px", background: "#ffffff", borderBottom: "1px solid #e7e5e4",
            display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap"
          }}>
            <div style={{ flex: "1 1 200px", minWidth: "200px" }}>
              <span style={{ fontSize: "11px", color: "#78716c", fontWeight: "700", display: "block", marginBottom: "4px" }}>模糊检索:</span>
              <input type="text" placeholder="搜索备注、任务 ID、流水 ID..." value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "6px 12px", borderRadius: "6px", border: "1px solid #d6d3d1", fontSize: "12px", outline: "none" }} />
            </div>
            <div style={{ width: "135px" }}>
              <span style={{ fontSize: "11px", color: "#78716c", fontWeight: "700", display: "block", marginBottom: "4px" }}>起始日期 (年月日):</span>
              <input type="date" value={logStartDate} onChange={(e) => setLogStartDate(e.target.value)}
                style={{ width: "100%", padding: "5px 8px", borderRadius: "6px", border: "1px solid #d6d3d1", fontSize: "12px", outline: "none", background: "#ffffff" }} />
            </div>
            <div style={{ width: "135px" }}>
              <span style={{ fontSize: "11px", color: "#78716c", fontWeight: "700", display: "block", marginBottom: "4px" }}>截止日期 (年月日):</span>
              <input type="date" value={logEndDate} onChange={(e) => setLogEndDate(e.target.value)}
                style={{ width: "100%", padding: "5px 8px", borderRadius: "6px", border: "1px solid #d6d3d1", fontSize: "12px", outline: "none", background: "#ffffff" }} />
            </div>
            {allLogsTab === "transactions" && (
              <div>
                <span style={{ fontSize: "11px", color: "#78716c", fontWeight: "700", display: "block", marginBottom: "4px" }}>交易类型:</span>
                <select value={logTypeFilter} onChange={(e) => setLogTypeFilter(e.target.value)}
                  style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #d6d3d1", fontSize: "12px", background: "#ffffff", cursor: "pointer", minWidth: "120px" }}>
                  <option value="all">显示全部类型</option>
                  <option value="consume">仅看扣费 (consume)</option>
                  <option value="refund">仅看退回 (refund)</option>
                </select>
              </div>
            )}
            {(logSearchQuery || logStartDate || logEndDate || (allLogsTab === "transactions" && logTypeFilter !== "all")) && (
              <button type="button" onClick={() => { setLogSearchQuery(""); setLogStartDate(""); setLogEndDate(""); setLogTypeFilter("all"); }}
                style={{ background: "rgba(239, 68, 68, 0.08)", border: "none", color: "#ef4444", fontSize: "12px", cursor: "pointer", fontWeight: "700", padding: "6px 12px", borderRadius: "6px", marginTop: "16px" }}>
                清除所有筛选 ×
              </button>
            )}
          </div>

          {/* 内容区域 */}
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
                          <th>流水号 ID</th><th>交易类型</th><th>积分变更</th>
                          <th>结余账户</th><th>备注原因说明</th><th>追踪标识 (Task/Project)</th><th>记录时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.map((transaction) => {
                          const isMinus = transaction.transaction_type === "consume";
                          return (
                            <tr key={transaction.id} style={{ transition: "all 0.15s ease" }}>
                              <td><code onClick={() => triggerCopy(transaction.id, "流水")} style={{ cursor: "pointer", fontSize: "10px", padding: "2px 4px", background: "#f5f5f4" }} title="点击复制流水 ID">{transaction.id.substring(0, 8)}...</code></td>
                              <td><span style={{ background: isMinus ? "rgba(239, 68, 68, 0.08)" : "rgba(16, 185, 129, 0.08)", color: isMinus ? "#ef4444" : "#10b981", padding: "2px 6px", borderRadius: "4px", fontWeight: "700", fontSize: "11px" }}>{transaction.transaction_type}</span></td>
                              <td style={{ fontWeight: "bold", color: isMinus ? "#ef4444" : "#10b981", fontSize: "13px" }}>{isMinus ? "-" : "+"}{formatCredits(transaction.amount)} 积分</td>
                              <td style={{ fontSize: "12px", color: "#78716c", fontWeight: "600" }}>{formatCredits(transaction.balance_after)} 积分</td>
                              <td style={{ fontSize: "12px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{transaction.reason ?? "无"}</td>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                  {transaction.task_id && (
                                    <span onClick={() => triggerCopy(transaction.task_id!, "任务")} style={{ fontSize: "10px", color: "#6366f1", cursor: "pointer", textDecoration: "underline" }} title="点击复制任务 ID">
                                      任务: {transaction.task_id.substring(0, 8)}...
                                    </span>
                                  )}
                                  {transaction.project_id && (
                                    <span onClick={() => triggerCopy(transaction.project_id!, "项目")} style={{ fontSize: "10px", color: "#78716c", cursor: "pointer" }} title="点击复制项目 ID">
                                      项目: {transaction.project_id.substring(0, 8)}...
                                    </span>
                                  )}
                                  {!transaction.task_id && !transaction.project_id && (
                                    <span style={{ fontSize: "10px", color: "#a8a29e" }}>无绑定</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ fontSize: "11px", color: "#78716c" }}>{new Date(transaction.created_at || Date.now()).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {renderPagination(logCurrentPage, totalTxPages, setLogCurrentPage, searchedTransactions.length)}
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
                          <th>流水 ID</th><th>入账来源</th><th>积分变更</th><th>关联充值订单 / 操作员</th><th>入账时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRecharges.map((record) => (
                          <tr key={record.id}>
                            <td><code onClick={() => triggerCopy(record.id, "充值")} style={{ cursor: "pointer", fontSize: "10px", padding: "2px 4px" }} title="点击复制充值记录 ID">{record.id.substring(0, 8)}...</code></td>
                            <td><span style={{ background: "rgba(16, 185, 129, 0.08)", color: "#10b981", padding: "2px 6px", borderRadius: "4px", fontWeight: "700", fontSize: "11px" }}>{record.recharge_type === "plan_monthly" ? "套餐赠送" : "在线直充"}</span></td>
                            <td style={{ fontWeight: "bold", color: "#10b981", fontSize: "13px" }}>+{record.credits_added} 积分</td>
                            <td>
                              {record.order_id ? (
                                <code onClick={() => triggerCopy(record.order_id!, "订单")} style={{ cursor: "pointer", fontSize: "11px" }} title="点击复制关联订单 ID">
                                  订单: {record.order_id.substring(0, 8)}...
                                </code>
                              ) : (
                                <span style={{ color: "#78716c", fontSize: "12px" }}>管理员手动补积分</span>
                              )}
                            </td>
                            <td style={{ fontSize: "11px", color: "#78716c" }}>{new Date(record.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {renderPagination(logCurrentPage, totalRechargePages, setLogCurrentPage, searchedRecharges.length)}
                  </>
                )}
              </div>
            )}
          </div>

          {/* 底部 */}
          <div style={{
            padding: "16px 24px", borderTop: "1px solid #e7e5e4", background: "#fafaf9",
            display: "flex", justifyContent: "flex-end"
          }}>
            <button type="button" onClick={onClose} style={{
              background: "#1c1917", border: "none", color: "#ffffff", padding: "8px 16px",
              borderRadius: "8px", fontWeight: "600", fontSize: "13px", cursor: "pointer"
            }}>关闭日志中心</button>
          </div>
        </div>
      </div>
    </>
  );
}

/** 分页控件 */
function renderPagination(
  currentPage: number,
  totalPages: number,
  setPage: React.Dispatch<React.SetStateAction<number>>,
  totalCount: number,
) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #f5f5f4"
    }}>
      <span style={{ fontSize: "12px", color: "#78716c" }}>
        已筛选出 {totalCount} 条记录 · 第 {currentPage} / {totalPages} 页
      </span>
      <div style={{ display: "flex", gap: "8px" }}>
        <button type="button" disabled={currentPage === 1}
          onClick={() => setPage(prev => Math.max(1, prev - 1))}
          style={{
            padding: "5px 12px", borderRadius: "6px", border: "1px solid #d6d3d1", fontSize: "12px",
            background: currentPage === 1 ? "#fafaf9" : "#ffffff",
            color: currentPage === 1 ? "#a8a29e" : "#1c1917",
            cursor: currentPage === 1 ? "not-allowed" : "pointer"
          }}>上一页</button>
        <button type="button" disabled={currentPage === totalPages}
          onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
          style={{
            padding: "5px 12px", borderRadius: "6px", border: "1px solid #d6d3d1", fontSize: "12px",
            background: currentPage === totalPages ? "#fafaf9" : "#ffffff",
            color: currentPage === totalPages ? "#a8a29e" : "#1c1917",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer"
          }}>下一页</button>
      </div>
    </div>
  );
}
