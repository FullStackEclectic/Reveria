import { useState, useEffect } from "react";
import { PlanSummary, OrderSummary, RechargeRecordSummary } from "../types";
import { getJson, postJson } from "../utils";

interface UseOrderFlowProps {
  activeWorkspace: any;
  setTransactions: any;
  setAdminMessage: (msg: string) => void;
}

export function useOrderFlow({
  activeWorkspace,
  setTransactions,
  setAdminMessage,
}: UseOrderFlowProps) {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [rechargeRecords, setRechargeRecords] = useState<RechargeRecordSummary[]>([]);
  const [pendingOrder, setPendingOrder] = useState<OrderSummary | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [isPayingOrder, setIsPayingOrder] = useState(false);
  const [creditsTab, setCreditsTab] = useState<"transactions" | "recharges">("transactions");

  // 初始化加载商业套餐列表和账单流水
  useEffect(() => {
    async function loadBillingBasic() {
      try {
        const p = await getJson<PlanSummary[]>("/api/plans");
        setPlans(p);
      } catch (err) {
        console.error("Failed to load plans:", err);
      }
    }
    void loadBillingBasic();
  }, []);

  // 当工作区变更时，自动加载该工作区下的订单及充值记录
  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) return;

    async function loadWorkspaceBilling() {
      try {
        const recharges = await getJson<RechargeRecordSummary[]>(
          `/api/workspaces/${workspaceId}/recharges`
        );
        setRechargeRecords(recharges);

        const orders = await getJson<OrderSummary[]>(
          `/api/workspaces/${workspaceId}/orders`
        );
        const pending = orders.find((o) => o.status === "pending") || null;
        setPendingOrder(pending);
      } catch (err) {
        console.error("Failed to load billing metrics:", err);
      }
    }
    void loadWorkspaceBilling();
  }, [activeWorkspace]);

  // 创建套餐/积分购买订单
  async function handleCreateOrder(planId: string) {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      alert("创建订单失败：请选择有效的工作区");
      return;
    }
    setIsCreatingOrder(true);
    try {
      const order = await postJson<OrderSummary>(
        `/api/workspaces/${workspaceId}/orders`,
        { plan_id: planId }
      );
      setPendingOrder(order);
      setAdminMessage(`已成功生成支付订单，实付金额: ¥${(order.amount_cents / 100).toFixed(2)} 元`);
    } catch (err: any) {
      alert("订单生成失败: " + (err.message || err));
    } finally {
      setIsCreatingOrder(false);
    }
  }

  // 模拟支付
  async function handleMockPay() {
    if (!pendingOrder) return;
    setIsPayingOrder(true);
    try {
      const order = await postJson<OrderSummary>(
        `/api/orders/${pendingOrder.id}/mock-pay`,
        {}
      );
      if (order.status === "paid") {
        setPendingOrder(null);
        setAdminMessage("订单模拟付款成功！算力额度与套餐已即时到账。");
        
        // 刷新充值记录和流水
        const workspaceId = activeWorkspace?.id;
        if (workspaceId) {
          const recharges = await getJson<RechargeRecordSummary[]>(
            `/api/workspaces/${workspaceId}/recharges`
          );
          setRechargeRecords(recharges);
          
          const txs = await getJson<any[]>(
            `/api/workspaces/${workspaceId}/transactions`
          );
          setTransactions(txs);
        }
      } else {
        alert("付款失败，订单状态异常");
      }
    } catch (err: any) {
      alert("支付失败: " + (err.message || err));
    } finally {
      setIsPayingOrder(false);
    }
  }

  return {
    plans,
    setPlans,
    rechargeRecords,
    setRechargeRecords,
    pendingOrder,
    setPendingOrder,
    isCreatingOrder,
    isPayingOrder,
    creditsTab,
    setCreditsTab,
    handleCreateOrder,
    handleMockPay,
  };
}
