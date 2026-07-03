import React, { useEffect, useState } from "react";
import { Badge, Save, RefreshCw, AlertCircle } from "lucide-react";
import { PlanSummary } from "../../types";
import { getJson, putJson } from "../../utils";

type PlanDraft = PlanSummary;

function formatStorageGB(bytes: number) {
  if (!bytes) return 0;
  return Math.round(bytes / (1024 * 1024 * 1024));
}

function storageGBToBytes(gb: number) {
  return Math.max(0, Math.round(gb * 1024 * 1024 * 1024));
}

export function PlanManagementPanel() {
  const [plans, setPlans] = useState<PlanDraft[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [isReadOnlyFallback, setIsReadOnlyFallback] = useState(false);

  const loadPlans = async () => {
    setIsLoading(true);
    setMessage("");
    setIsReadOnlyFallback(false);
    try {
      const data = await getJson<PlanSummary[]>("/api/admin/plans");
      setPlans(data);
    } catch (err) {
      console.error(err);
      try {
        const fallback = await getJson<PlanSummary[]>("/api/billing/plans");
        setPlans(fallback);
        setIsReadOnlyFallback(true);
        setMessage("管理接口暂不可用，当前展示公开套餐列表。保存功能需要重启 API 服务并确认管理员接口已生效。");
      } catch (fallbackErr) {
        console.error(fallbackErr);
        setPlans([]);
        setMessage("套餐配置加载失败，请确认 API 服务已重启，且当前账号拥有平台管理员权限。");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const updatePlan = (id: string, patch: Partial<PlanDraft>) => {
    setPlans((current) => current.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));
  };

  const savePlan = async (plan: PlanDraft) => {
    if (isReadOnlyFallback) {
      setMessage("当前是只读预览数据，请重启 API 服务后重新加载再保存。");
      return;
    }

    setSavingId(plan.id);
    setMessage("");
    try {
      const saved = await putJson<PlanSummary>(`/api/admin/plans/${plan.id}`, {
        name: plan.name.trim(),
        badge_label: (plan.badge_label ?? "").trim().toUpperCase(),
        price_cents: plan.price_cents,
        monthly_credits: plan.monthly_credits,
        max_members: plan.max_members,
        storage_quota_bytes: plan.storage_quota_bytes,
        enabled: plan.enabled,
        is_points_package: !!plan.is_points_package,
      });
      setPlans((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      setMessage(`套餐「${saved.name}」已保存。`);
    } catch (err) {
      console.error(err);
      setMessage("套餐保存失败，请检查字段是否合法。");
    } finally {
      setSavingId("");
    }
  };

  const subscriptionPlans = plans.filter((plan) => !plan.is_points_package);
  const pointPackages = plans.filter((plan) => plan.is_points_package);

  const renderPlanRows = (items: PlanDraft[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {items.map((plan) => (
        <div
          key={plan.id}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(180px, 1.2fr) 92px 110px 110px 100px 120px 76px 86px",
            gap: "10px",
            alignItems: "center",
            padding: "12px",
            border: "1px solid var(--rv-color-border-thin)",
            borderRadius: "10px",
            background: "#ffffff",
          }}
        >
          <input
            value={plan.name}
            onChange={(e) => updatePlan(plan.id, { name: e.target.value })}
            style={{ height: "34px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "0 10px", fontSize: "12px", fontWeight: 700 }}
          />
          <input
            value={plan.badge_label ?? ""}
            maxLength={12}
            onChange={(e) => updatePlan(plan.id, { badge_label: e.target.value.toUpperCase() })}
            placeholder="PRO"
            style={{ height: "34px", border: "1px solid #f59e0b", borderRadius: "999px", padding: "0 10px", fontSize: "12px", fontWeight: 800, color: "#b45309", textAlign: "center", background: "#fffbeb" }}
          />
          <input
            type="number"
            min={0}
            value={Math.round(plan.price_cents / 100)}
            onChange={(e) => updatePlan(plan.id, { price_cents: Number(e.target.value) * 100 })}
            style={{ height: "34px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "0 10px", fontSize: "12px" }}
          />
          <input
            type="number"
            min={0}
            value={plan.monthly_credits}
            onChange={(e) => updatePlan(plan.id, { monthly_credits: Number(e.target.value) })}
            style={{ height: "34px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "0 10px", fontSize: "12px" }}
          />
          <input
            type="number"
            min={1}
            value={plan.max_members}
            onChange={(e) => updatePlan(plan.id, { max_members: Number(e.target.value) })}
            style={{ height: "34px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "0 10px", fontSize: "12px" }}
          />
          <input
            type="number"
            min={0}
            disabled={!!plan.is_points_package}
            value={formatStorageGB(plan.storage_quota_bytes)}
            onChange={(e) => updatePlan(plan.id, { storage_quota_bytes: storageGBToBytes(Number(e.target.value)) })}
            style={{ height: "34px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "0 10px", fontSize: "12px", opacity: plan.is_points_package ? 0.5 : 1 }}
          />
          <label style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "12px", color: "#57534e" }}>
            <input
              type="checkbox"
              checked={plan.enabled}
              onChange={(e) => updatePlan(plan.id, { enabled: e.target.checked })}
            />
            启用
          </label>
          <button
            type="button"
            disabled={savingId === plan.id || isReadOnlyFallback}
            onClick={() => void savePlan(plan)}
            className="primary-button"
            style={{ height: "34px", padding: "0 12px", borderRadius: "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
          >
            {savingId === plan.id ? <RefreshCw size={13} className="spin" /> : <Save size={13} />}
            {isReadOnlyFallback ? "只读" : "保存"}
          </button>
        </div>
      ))}
      {!items.length && (
        <div style={{ padding: "28px", border: "1px dashed var(--rv-color-border-thin)", borderRadius: "12px", background: "#ffffff", color: "#78716c", fontSize: "13px", textAlign: "center" }}>
          暂无套餐数据。请点击右上角重新加载，系统会自动初始化默认订阅套餐与点数包。
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "32px", background: "#f8fafc", minHeight: "100vh", boxSizing: "border-box" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 4px", color: "var(--rv-color-text-main)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Badge size={19} /> 套餐管理
          </h2>
          <p style={{ fontSize: "12px", color: "var(--rv-color-text-muted)", margin: 0 }}>
            维护订阅套餐、点数包和顶部余额胶囊展示的短标识。短标识建议控制在 4-8 个字符，例如 FREE、PRO、TEAM。
          </p>
        </div>
        <button type="button" className="secondary-button" disabled={isLoading} onClick={() => void loadPlans()}>
          <RefreshCw size={14} className={isLoading ? "spin" : undefined} />
          重新加载
        </button>
      </header>

      {message && (
        <div className="notice" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={15} />
          {message}
        </div>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: "12px", background: "#ffffff", border: "1px solid var(--rv-color-border-thin)", borderRadius: "14px", padding: "16px", boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1.2fr) 92px 110px 110px 100px 120px 76px 86px", gap: "10px", padding: "0 12px", color: "#78716c", fontSize: "11px", fontWeight: 800 }}>
          <span>套餐名称</span>
          <span>短标识</span>
          <span>价格/元</span>
          <span>积分</span>
          <span>成员数</span>
          <span>存储/GB</span>
          <span>状态</span>
          <span>操作</span>
        </div>

        {isLoading ? (
          <div style={{ padding: "40px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#78716c", fontSize: "13px" }}>
            <RefreshCw size={15} className="spin" />
            正在加载套餐配置...
          </div>
        ) : (
          <>
            <h3 style={{ margin: "6px 0 0", fontSize: "14px", color: "#1c1917" }}>订阅套餐</h3>
            {renderPlanRows(subscriptionPlans)}

            <h3 style={{ margin: "14px 0 0", fontSize: "14px", color: "#1c1917" }}>点数直充包</h3>
            {renderPlanRows(pointPackages)}
          </>
        )}
      </section>
    </div>
  );
}
