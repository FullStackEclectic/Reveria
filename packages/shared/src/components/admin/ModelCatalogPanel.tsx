import React, { FormEvent, useState, useEffect } from "react";
import { Plus, Server, Settings2, TestTube2, Send, Cpu, Trash2, Edit2, Check } from "lucide-react";
import { ModelSummary, ProviderSummary, PricingRuleSummary } from "../../types";
import { postJson, deleteJson } from "../../utils";

interface ModelCatalogPanelProps {
  models: ModelSummary[];
  setModels: React.Dispatch<React.SetStateAction<ModelSummary[]>>;
  providers: ProviderSummary[];
  pricingRules: PricingRuleSummary[];
  setPricingRules: React.Dispatch<React.SetStateAction<PricingRuleSummary[]>>;
  setAdminMessage: (msg: string) => void;
}

export function ModelCatalogPanel({
  models,
  setModels,
  providers,
  pricingRules,
  setPricingRules,
  setAdminMessage,
}: ModelCatalogPanelProps) {
  const [subTab, setSubTab] = useState<"catalog" | "pricing" | "test">("catalog");

  // 新增模型表单字段
  const [providerId, setProviderId] = useState("");
  const [modelName, setModelName] = useState("gpt-4o");
  const [displayName, setDisplayName] = useState("GPT-4o (主力模型)");
  const [modelType, setModelType] = useState("chat"); // chat, image, video
  const [creditsCost, setCreditsCost] = useState(10);
  const [modelEnabled, setModelEnabled] = useState(true);

  // 定价规则表单
  const [ruleName, setRuleName] = useState("大纲分析基础计费");
  const [taskType, setTaskType] = useState("brief_analysis");
  const [ruleModelId, setRuleModelId] = useState("");
  const [unit, setUnit] = useState("task");
  const [minCredits, setMinCredits] = useState(20);
  const [maxCredits, setMaxCredits] = useState(0);
  const [ruleEnabled, setRuleEnabled] = useState(true);

  // 测试探针
  const [testModelId, setTestModelId] = useState("");
  const [testPrompt, setTestPrompt] = useState("请用一句话自我介绍。");
  const [testResult, setTestResult] = useState<any>(null);
  const [imageTestResult, setImageTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  // 编辑模式状态（用于行内快捷修改定价点数）
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingCost, setEditingCost] = useState<number>(0);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId && providers[0]?.id) {
      setProviderId(providers[0].id);
    }
  }, [providerId, providers]);

  useEffect(() => {
    if (!testModelId && models[0]?.id) {
      setTestModelId(models[0].id);
    }
  }, [models, testModelId]);

  function providerNameFor(id?: string | null) {
    return providers.find((p) => p.id === id)?.name ?? "未知渠道";
  }

  // 手动登记创建模型
  async function handleCreateModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!providerId) {
      setAdminMessage("配置失败：必须选择绑定的供应商通道");
      return;
    }
    
    // 如果没有输入 ID，则以 "服务商ID-模型Code" 组合作为 ID 防止命名冲突
    const customId = `${providerId}-${modelName}`;
    
    try {
      const model = await postJson<ModelSummary>("/api/admin/models", {
        id: customId,
        provider_id: providerId,
        name: modelName,
        display_name: displayName,
        model_type: modelType,
        credits_cost: creditsCost,
        enabled: modelEnabled,
      });

      setModels((current) => [
        model,
        ...current.filter((item) => item.id !== model.id)
      ]);
      setAdminMessage(`已手动接入模型：${model.display_name ?? model.name}`);
      setModelName("");
      setDisplayName("");
    } catch (err: any) {
      console.error(err);
      setAdminMessage("接入模型失败：请确保数据库在线");
    }
  }

  // 保存快速编辑后的计费价格
  async function handleSaveQuickCost(model: ModelSummary) {
    try {
      const updated = await postJson<ModelSummary>("/api/admin/models", {
        id: model.id,
        provider_id: model.provider_id,
        name: model.name,
        display_name: model.display_name,
        model_type: model.model_type,
        credits_cost: editingCost,
        enabled: model.enabled
      });
      setModels((current) =>
        current.map((item) => (item.id === model.id ? updated : item))
      );
      setAdminMessage(`模型 ${model.name} 单次价格已修改为 ${editingCost} 点`);
      setEditingModelId(null);
    } catch {
      setAdminMessage("修改价格失败：服务端通讯故障");
    }
  }

  // 模型启用/停用
  async function updateModelEnabled(model: ModelSummary, enabled: boolean) {
    try {
      await postJson(`/api/admin/models/${model.id}/enabled`, { enabled });
      setModels((current) =>
        current.map((item) => (item.id === model.id ? { ...item, enabled } : item))
      );
      setAdminMessage(`${model.display_name ?? model.name} 已${enabled ? "启用" : "停用"}`);
    } catch {
      setAdminMessage("更新状态失败");
    }
  }

  // 删除模型
  function handleDeleteModel(modelId: string) {
    setDeleteTargetId(modelId);
  }

  async function confirmDeleteModel() {
    if (!deleteTargetId) return;
    try {
      await deleteJson(`/api/admin/models/${deleteTargetId}`);
      setModels((current) => current.filter((item) => item.id !== deleteTargetId));
      setAdminMessage("模型已成功删除");
    } catch (err: any) {
      console.error("Delete model failed:", err);
      setAdminMessage("删除模型失败");
    } finally {
      setDeleteTargetId(null);
    }
  }

  // 创建计费定价规则
  async function handleCreatePricingRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const rule = await postJson<PricingRuleSummary>("/api/admin/pricing-rules", {
        name: ruleName,
        task_type: taskType || null,
        model_id: ruleModelId || null,
        unit: unit || null,
        min_credits: minCredits > 0 ? minCredits : null,
        max_credits: maxCredits > 0 ? maxCredits : null,
        enabled: ruleEnabled,
      });
      setPricingRules((current) => [rule, ...current]);
      setAdminMessage(`已添加定价规则：${rule.name}`);
    } catch {
      setAdminMessage("规则保存失败");
    }
  }

  // 测试文本模型
  async function handleTestModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!testModelId) return;
    setIsTesting(true);
    setTestResult(null);
    setImageTestResult(null);
    try {
      const result = await postJson<any>("/api/admin/models/test-text", {
        model_id: testModelId,
        prompt: testPrompt,
      });
      setTestResult(result);
      setAdminMessage("模型测试已完成");
    } catch {
      setAdminMessage("模型测试失败");
    } finally {
      setIsTesting(false);
    }
  }

  // 测试生图模型
  async function handleTestImageModel() {
    if (!testModelId) return;
    setIsTesting(true);
    setTestResult(null);
    setImageTestResult(null);
    try {
      const result = await postJson<any>("/api/admin/models/test-image", {
        model_id: testModelId,
        prompt: testPrompt,
        size: "1024x1024",
      });
      setImageTestResult(result);
      setAdminMessage("生图通道测试成功");
    } catch {
      setAdminMessage("生图测试失败");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: "560px" }}>
      {/* 子导航页签 */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "10px", marginBottom: "20px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setSubTab("catalog")}
            className={`assets-filter-btn ${subTab === "catalog" ? "active" : ""}`}
            style={{ borderRadius: "6px" }}
            type="button"
          >
            <Server size={13} />
            模型目录与定价
          </button>
          <button
            onClick={() => setSubTab("pricing")}
            className={`assets-filter-btn ${subTab === "pricing" ? "active" : ""}`}
            style={{ borderRadius: "6px" }}
            type="button"
          >
            <Settings2 size={13} />
            调度计费公式
          </button>
          <button
            onClick={() => setSubTab("test")}
            className={`assets-filter-btn ${subTab === "test" ? "active" : ""}`}
            style={{ borderRadius: "6px" }}
            type="button"
          >
            <TestTube2 size={13} />
            连通性测试探针
          </button>
        </div>
        <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>
          {subTab === "catalog" && "系统内运行大模型的列表清单及计费设定"}
          {subTab === "pricing" && "自定义任务的加价与浮动点数收费公式"}
          {subTab === "test" && "直接呼叫上游大模型通道接口以测试配置是否可用"}
        </span>
      </div>

      {/* 1. 模型目录 */}
      {subTab === "catalog" && (
        <div className="admin-subpanel-grid" style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: "20px" }}>
          {/* 左侧手动接入 */}
          <form onSubmit={handleCreateModel} style={{ display: "flex", flexDirection: "column", gap: "12px", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "16px" }}>
            <span style={{ display: "block", fontSize: "12px", fontWeight: "bold", borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "6px" }}>手动接入模型</span>

            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>所属上游通道</label>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={{ minHeight: "36px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-sm)", padding: "0 10px", background: "#ffffff" }} required>
                <option value="">选择供应商</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.enabled ? "" : "(未启用)"}</option>
                ))}
              </select>
            </div>

            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>模型识别码 (Model Code)</label>
              <input value={modelName} onChange={(e) => setModelName(e.target.value)} required placeholder="如 gpt-4o" />
            </div>

            <div className="assets-form-field">
              <label style={{ fontSize: "10px", fontWeight: "700" }}>显示名称</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="如 GPT-4o (主力模型)" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="assets-form-field">
                <label style={{ fontSize: "10px", fontWeight: "700" }}>模型类型</label>
                <select
                  value={modelType}
                  onChange={(e) => setModelType(e.target.value)}
                  style={{ minHeight: "36px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-sm)", padding: "0 10px", background: "#ffffff" }}
                >
                  <option value="chat">💬 对话</option>
                  <option value="image">🎨 图像</option>
                  <option value="video">🎬 视频</option>
                </select>
              </div>

              <div className="assets-form-field">
                <label style={{ fontSize: "10px", fontWeight: "700" }}>单次扣除点数</label>
                <input type="number" min={0} value={creditsCost} onChange={(e) => setCreditsCost(Number(e.target.value))} required />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--rv-color-text-main)", cursor: "pointer" }}>
                <input type="checkbox" checked={modelEnabled} onChange={(e) => setModelEnabled(e.target.checked)} style={{ width: "auto" }} />
                激活并挂载路由
              </label>
              <button className="primary-button" type="submit" style={{ minHeight: "34px", padding: "0 16px" }}>
                <Plus size={14} />
                手动登记接入
              </button>
            </div>
          </form>

          {/* 右侧大模型清单表格 */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>现行算力模型库 ({models.length})</span>
            <div style={{ flex: 1, border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(0,0,0,0.01)", borderBottom: "1px solid var(--rv-color-border-thin)", fontWeight: "bold", color: "var(--rv-color-text-muted)" }}>
                    <th style={{ padding: "10px 14px" }}>模型展示名 / ID</th>
                    <th style={{ padding: "10px 14px", width: "90px" }}>分类类型</th>
                    <th style={{ padding: "10px 14px", width: "130px" }}>计费扣点/次</th>
                    <th style={{ padding: "10px 14px", width: "140px", textAlign: "right" }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {models.length > 0 ? (
                    models.map((model) => {
                      const isEditing = editingModelId === model.id;
                      
                      // 模型类型标识
                      let typeLabel = "💬 对话";
                      let typeColor = "rgba(59, 130, 246, 0.08)";
                      let textColor = "#2563eb";
                      
                      if (model.model_type === "image") {
                        typeLabel = "🎨 图像";
                        typeColor = "rgba(16, 185, 129, 0.08)";
                        textColor = "#059669";
                      } else if (model.model_type === "video") {
                        typeLabel = "🎬 视频";
                        typeColor = "rgba(139, 92, 246, 0.08)";
                        textColor = "#7c3aed";
                      }

                      return (
                        <tr key={model.id} style={{ borderBottom: "1px solid var(--rv-color-border-thin)", transition: "background 0.2s" }} className="user-row-hover">
                          {/* 模型详情 */}
                          <td style={{ padding: "10px 14px" }}>
                            <strong style={{ display: "block", color: "var(--rv-color-text-main)" }}>{model.display_name ?? model.name}</strong>
                            <span style={{ display: "block", fontSize: "9px", color: "var(--rv-color-text-muted)", marginTop: "2px" }}>
                              Code: <code style={{ fontFamily: "monospace" }}>{model.name}</code> · {providerNameFor(model.provider_id)}
                            </span>
                          </td>
                          {/* 模型类型 */}
                          <td style={{ padding: "10px 14px" }}>
                            <span style={{ fontSize: "10px", fontWeight: "bold", background: typeColor, color: textColor, padding: "2px 6px", borderRadius: "4px", display: "inline-block" }}>
                              {typeLabel}
                            </span>
                          </td>
                          {/* 模型计费，支持行内直接修改 */}
                          <td style={{ padding: "10px 14px" }}>
                            {isEditing ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <input
                                  type="number"
                                  min={0}
                                  value={editingCost}
                                  onChange={(e) => setEditingCost(Number(e.target.value))}
                                  style={{ width: "65px", height: "26px", border: "1px solid var(--rv-color-primary)", borderRadius: "4px", padding: "0 6px", fontSize: "11px" }}
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveQuickCost(model)}
                                  style={{ border: 0, background: "var(--rv-color-primary)", color: "#ffffff", width: "24px", height: "24px", borderRadius: "4px", cursor: "pointer", display: "grid", placeItems: "center" }}
                                >
                                  <Check size={12} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span><strong>{model.credits_cost ?? 0}</strong> 点</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingModelId(model.id);
                                    setEditingCost(model.credits_cost ?? 0);
                                  }}
                                  style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--rv-color-text-muted)", display: "inline-flex", alignItems: "center" }}
                                  title="修改单次计费"
                                >
                                  <Edit2 size={11} />
                                </button>
                              </div>
                            )}
                          </td>
                          {/* 操作 */}
                          <td style={{ padding: "10px 14px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <button
                                onClick={() => {
                                  setTestModelId(model.id);
                                  setSubTab("test");
                                }}
                                style={{ border: "1px solid var(--rv-color-border-thin)", background: "#ffffff", padding: "3px 8px", fontSize: "10px", borderRadius: "4px", cursor: "pointer" }}
                                type="button"
                              >
                                测试
                              </button>
                              <button
                                onClick={() => void updateModelEnabled(model, !model.enabled)}
                                style={{
                                  border: "1px solid",
                                  borderColor: model.enabled ? "#dc2626" : "var(--rv-color-border-thin)",
                                  background: model.enabled ? "#fee2e2" : "#ffffff",
                                  color: model.enabled ? "#b91c1c" : "var(--rv-color-text-main)",
                                  padding: "3px 8px",
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  borderRadius: "4px",
                                  cursor: "pointer"
                                }}
                                type="button"
                              >
                                {model.enabled ? "禁用" : "启用"}
                              </button>
                              <button
                                onClick={() => void handleDeleteModel(model.id)}
                                style={{
                                  border: "1px solid #dc2626",
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  padding: "3px 8px",
                                  fontSize: "10px",
                                  fontWeight: "700",
                                  borderRadius: "4px",
                                  cursor: "pointer"
                                }}
                                type="button"
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} style={{ padding: "40px 0", textAlign: "center", color: "var(--rv-color-text-muted)" }}>
                        暂无大模型接入，请利用左侧手动接入，或者在“服务商接入”一键拉取。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. 计费定价规则 (保持原样) */}
      {subTab === "pricing" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: "20px" }}>
          <form onSubmit={handleCreatePricingRule} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "16px" }}>
            <div className="assets-form-field" style={{ gridColumn: "span 2" }}>
              <label>规则名</label>
              <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} required />
            </div>

            <div className="assets-form-field">
              <label>任务代码 (Task Type)</label>
              <input value={taskType} onChange={(e) => setTaskType(e.target.value)} required />
            </div>

            <div className="assets-form-field">
              <label>限定匹配模型</label>
              <select value={ruleModelId} onChange={(e) => setRuleModelId(e.target.value)} style={{ minHeight: "36px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-sm)", padding: "0 10px", background: "#ffffff" }}>
                <option value="">不限定模型</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name ?? m.name}</option>
                ))}
              </select>
            </div>

            <div className="assets-form-field">
              <label>计费单元</label>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} required />
            </div>

            <div className="assets-form-field">
              <label>最小点数 (基准价)</label>
              <input type="number" value={minCredits} onChange={(e) => setMinCredits(Number(e.target.value))} required />
            </div>

            <div className="assets-form-field">
              <label>最大点数 (封顶价)</label>
              <input type="number" value={maxCredits} onChange={(e) => setMaxCredits(Number(e.target.value))} required />
            </div>

            <div className="assets-form-field">
              <label>规则状态</label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--rv-color-text-main)", cursor: "pointer", height: "36px" }}>
                <input type="checkbox" checked={ruleEnabled} onChange={(e) => setRuleEnabled(e.target.checked)} style={{ width: "auto" }} />
                激活并扣点扣款
              </label>
            </div>

            <button className="primary-button" type="submit" style={{ gridColumn: "span 2", minHeight: "36px", marginTop: "4px" }}>
              <Plus size={16} />
              添加扣点定价规则
            </button>
          </form>

          <div>
            <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>现行调度计费规则 ({pricingRules.length})</span>
            {pricingRules.length > 0 ? (
              <div style={{ display: "grid", gap: "8px", maxHeight: "300px", overflowY: "auto", paddingRight: "4px" }}>
                {pricingRules.map((rule) => (
                  <div key={rule.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "10px 14px" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "12px", color: "var(--rv-color-text-main)" }}>{rule.name}</strong>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", marginTop: "1px" }}>
                        类型: {rule.task_type ?? "全部任务"} · 费率: {rule.min_credits ?? 0}点/{rule.unit ?? "task"}
                      </span>
                    </div>
                    <span style={{ fontSize: "9px", background: rule.enabled ? "rgba(16, 185, 129, 0.08)" : "rgba(115,111,106,0.08)", color: rule.enabled ? "#10b981" : "var(--rv-color-text-muted)", padding: "2px 5px", borderRadius: "3px", fontWeight: "700" }}>
                      {rule.enabled ? "已启用" : "已挂起"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty" style={{ minHeight: "180px" }}>
                <p>暂无规则，将默认退回模型定价结算</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. 模型连通性测试 */}
      {subTab === "test" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <form onSubmit={handleTestModel} style={{ display: "flex", flexDirection: "column", gap: "12px", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "16px" }}>
            <div className="assets-form-field">
              <label>目标测试模型</label>
              <select value={testModelId} onChange={(e) => setTestModelId(e.target.value)} style={{ minHeight: "36px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-sm)", padding: "0 10px", background: "#ffffff" }} required>
                <option value="">选择模型</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>{m.display_name ?? m.name} {m.enabled ? "" : "(未启用)"}</option>
                ))}
              </select>
            </div>

            <div className="assets-form-field">
              <label>测试 Prompt 输入</label>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                style={{ width: "100%", borderRadius: "var(--rv-radius-sm)", border: "1px solid var(--rv-color-border-thin)", padding: "10px", outline: "none", fontSize: "13px" }}
                rows={5}
                required
              />
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button className="primary-button" type="submit" style={{ flex: 1, minHeight: "36px" }} disabled={isTesting || !testModelId}>
                <Send size={14} />
                {isTesting ? "测试中..." : "测试文本模型"}
              </button>
              <button className="secondary-button" type="button" onClick={handleTestImageModel} style={{ flex: 1, minHeight: "36px" }} disabled={isTesting || !testModelId}>
                <Send size={14} />
                {isTesting ? "测试中..." : "测试图片模型"}
              </button>
            </div>
          </form>

          <div style={{ display: "flex", flexDirection: "column", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", background: "#ffffff", padding: "16px", minHeight: "260px", overflow: "hidden" }}>
            <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "8px", marginBottom: "12px" }}>测试返回结果明细</span>
            
            <div style={{ flex: 1, overflowY: "auto" }}>
              {testResult && (
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--rv-color-text-muted)", marginBottom: "8px" }}>
                    <span>商渠道: <strong>{testResult.provider ?? "未知"}</strong></span>
                    <span>接入模型: <strong>{testResult.model ?? "未知"}</strong></span>
                  </div>
                  <pre style={{ margin: 0, padding: 0, fontSize: "12px", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace", color: "var(--rv-color-text-main)" }}>
                    {testResult.output}
                  </pre>
                </div>
              )}

              {imageTestResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}>
                  {(imageTestResult.image_url || imageTestResult.b64_json) ? (
                    <img
                      alt="模型输出图片"
                      src={imageTestResult.image_url ?? `data:image/png;base64,${imageTestResult.b64_json}`}
                      style={{ maxWidth: "100%", maxHeight: "240px", borderRadius: "6px", border: "1px solid var(--rv-color-border-thin)", objectFit: "contain" }}
                    />
                  ) : (
                    <div style={{ fontSize: "12px", color: "#dc2626" }}>图片输出错误或无内容</div>
                  )}
                  <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", textAlign: "center" }}>{imageTestResult.revised_prompt ?? "图片调试返回成功"}</span>
                </div>
              )}

              {!testResult && !imageTestResult && (
                <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--rv-color-text-muted)", fontSize: "12px" }}>
                  {isTesting ? "正在向上游大模型API发送请求探针，请稍候..." : "请在左侧选择已启用模型，输入 Prompt 并启动测试"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTargetId && (
        <div 
          className="delete-confirmation-overlay"
          onClick={() => setDeleteTargetId(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div 
            className="panel delete-confirmation-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "420px",
              padding: "24px",
              background: "#ffffff",
              borderRadius: "16px",
              boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              minHeight: "auto"
            }}
          >
            <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0, color: "#b91c1c" }}>确定要删除该模型吗？</h3>
            <p style={{ fontSize: "13px", color: "var(--rv-color-text-muted)", margin: 0, lineHeight: "1.5" }}>
              这会导致前端生图或视频对话无法选择此算力节点。此操作不可撤销，请谨慎操作。
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "8px" }}>
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="secondary-button"
                style={{ minHeight: "32px", fontSize: "12px", borderRadius: "8px" }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteModel()}
                style={{
                  minHeight: "32px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  padding: "0 16px",
                  border: "none",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
