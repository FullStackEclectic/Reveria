import { useState, useEffect } from "react";
import { PlanSummary, OrderSummary, RechargeRecordSummary } from "../types";
import { getJson, postJson } from "../utils";

interface UseOrderFlowProps {
  currentUser: any;
  activeWorkspace: any;
  setAdminMessage: (msg: string) => void;
}

export function useOrderFlow({
  currentUser,
  activeWorkspace,
  setAdminMessage,
}: UseOrderFlowProps) {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [rechargeRecords, setRechargeRecords] = useState<RechargeRecordSummary[]>([]);
  const [pendingOrder, setPendingOrder] = useState<OrderSummary | null>(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [creditsTab, setCreditsTab] = useState<"transactions" | "recharges">("transactions");

  // 初始化加载商业套餐列表和账单流水
  useEffect(() => {
    if (!currentUser) {
      setPlans([]);
      return;
    }
    async function loadBillingBasic() {
      try {
        const p = await getJson<PlanSummary[]>("/api/billing/plans");
        setPlans(p);
      } catch (err) {
        console.error("Failed to load plans:", err);
      }
    }
    void loadBillingBasic();
  }, [currentUser]);

  // 当工作区变更时，自动加载该工作区下的订单及充值记录
  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) return;

    async function loadWorkspaceBilling() {
      try {
        const recharges = await getJson<RechargeRecordSummary[]>(
          `/api/credits/${workspaceId}/recharges`
        );
        setRechargeRecords(recharges);

        const orders = await getJson<OrderSummary[]>(
          `/api/credits/${workspaceId}/orders`
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
    const plan = plans.find((p) => p.id === planId);
    if (!plan) {
      alert("创建订单失败：无效的套餐");
      return;
    }
    setIsCreatingOrder(true);
    try {
      const res = await postJson<{
        success: boolean;
        message: string;
        data: {
          order_id: string;
          status: string;
          pay_url: string;
          amount_cents: number;
        };
      }>("/api/billing/orders", {
        workspace_id: workspaceId,
        plan_id: planId,
        amount_cents: plan.price_cents,
        payment_provider: "stripe",
      });
      if (res.success && res.data) {
        const order: OrderSummary = {
          id: res.data.order_id,
          workspace_id: workspaceId,
          plan_id: planId,
          amount_cents: res.data.amount_cents,
          payment_provider: "stripe",
          status: res.data.status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setPendingOrder(order);
        setAdminMessage(`已成功生成支付订单，实付金额: ¥${(order.amount_cents / 100).toFixed(2)} 元`);
      } else {
        alert("订单生成失败: " + (res.message || "未知错误"));
      }
    } catch (err: any) {
      alert("订单生成失败: " + (err.message || err));
    } finally {
      setIsCreatingOrder(false);
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
    creditsTab,
    setCreditsTab,
    handleCreateOrder,
  };
}
