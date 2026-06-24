import React, { FormEvent, useState, useEffect } from "react";
import { Plus, Server, Settings2, ShieldCheck, TestTube2, Image, Send, Cpu } from "lucide-react";
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

  // Model Form
  const [providerId, setProviderId] = useState("");
  const [modelName, setModelName] = useState("gpt-4.1");
  const [displayName, setDisplayName] = useState("主力文本模型");
  const [capability, setCapability] = useState("text");
  const [qualityTier, setQualityTier] = useState("high");
  const [costTier, setCostTier] = useState("standard");
  const [modelEnabled, setModelEnabled] = useState(true);

  // Pricing Rule Form
  const [ruleName, setRuleName] = useState("brief 分析基础价");
  const [taskType, setTaskType] = useState("brief_analysis");
  const [ruleModelId, setRuleModelId] = useState("");
  const [unit, setUnit] = useState("task");
  const [minCredits, setMinCredits] = useState(20);
  const [maxCredits, setMaxCredits] = useState(0);
  const [ruleEnabled, setRuleEnabled] = useState(true);

  // Model Test Form
  const [testModelId, setTestModelId] = useState("");
  const [testPrompt, setTestPrompt] = useState("请用一句话说明你能为传媒工作室做什么。");
  const [testResult, setTestResult] = useState<any>(null);
  const [imageTestResult, setImageTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

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
    return providers.find((p) => p.id === id)?.name ?? "未知供应商";
  }

  async function handleCreateModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const model = await postJson<ModelSummary>("/api/admin/models", {
        provider_id: providerId,
        name: modelName,
        display_name: displayName || null,
        capability: [capability],
        input_modalities: ["text"],
        output_modalities: capability === "image_generation" ? ["image"] : ["text"],
        quality_tier: qualityTier || null,
        cost_tier: costTier || null,
        enabled: modelEnabled,
      });
      setModels((current) => [model, ...current]);
      setAdminMessage(`已添加模型：${model.display_name ?? model.name}`);
    } catch {
      setAdminMessage("模型保存失败：启用文本模型必须绑定已启用供应商");
    }
  }

  async function updateModelEnabled(model: ModelSummary, enabled: boolean) {
    try {
      const updated = await postJson<ModelSummary>(
        `/api/admin/models/${model.id}/enabled`,
        { enabled }
      );
      setModels((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setAdminMessage(`${updated.display_name ?? updated.name} 已${updated.enabled ? "启用" : "停用"}`);
    } catch {
      setAdminMessage("模型启停失败：启用文本模型必须绑定已启用供应商");
    }
  }

  async function handleDeleteModel(modelId: string) {
    if (!window.confirm("确定要删除该模型吗？")) {
      return;
    }
    try {
      await deleteJson(`/api/admin/models/${modelId}`);
      setModels((current) => current.filter((item) => item.id !== modelId));
      setAdminMessage("模型已成功删除");
    } catch (err: any) {
      console.error("Delete model failed:", err);
      setAdminMessage(`模型删除失败：${err?.message || err}`);
    }
  }

  async function handleCreatePricingRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const rule = await postJson<PricingRuleSummary>("/api/admin/pricing-rules", {
        name: ruleName,
        task_type: taskType || null,
        model_id: ruleModelId || null,
        unit: unit || null,
        cost_formula: null,
        credit_formula: null,
        min_credits: minCredits > 0 ? minCredits : null,
        max_credits: maxCredits > 0 ? maxCredits : null,
        enabled: ruleEnabled,
      });
      setPricingRules((current) => [rule, ...current]);
      setAdminMessage(`已添加定价规则：${rule.name}`);
    } catch {
      setAdminMessage("定价规则添加失败，请检查网络或表单内容");
    }
  }

  async function handleTestModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!testModelId) return;
    setIsTesting(true);
    setTestResult(null);
    setImageTestResult(null);
    try {
      const result = await postJson<any>(
        "/api/admin/models/test-text",
        {
          model_id: testModelId,
          prompt: testPrompt,
        }
      );
      setTestResult(result);
      setAdminMessage("模型测试已完成");
    } catch {
      setAdminMessage("模型测试失败：模型、供应商或上游调用不可用");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleTestImageModel() {
    if (!testModelId) return;
    setIsTesting(true);
    setTestResult(null);
    setImageTestResult(null);
    try {
      const result = await postJson<any>(
        "/api/admin/models/test-image",
        {
          model_id: testModelId,
          prompt: testPrompt,
          size: "1024x1024",
        }
      );
      setImageTestResult(result);
      setAdminMessage("图片模型测试已完成");
    } catch {
      setAdminMessage("图片模型测试失败：请选择已启用的图片生成模型");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: "560px" }}>
      {/* 子导航栏 */}
      <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--rv-color-border-thin)", paddingBottom: "10px", marginBottom: "20px", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setSubTab("catalog")}
            className={`assets-filter-btn ${subTab === "catalog" ? "active" : ""}`}
            style={{ borderRadius: "6px" }}
            type="button"
          >
            <Server size={13} />
            模型目录
          </button>
          <button
            onClick={() => setSubTab("pricing")}
            className={`assets-filter-btn ${subTab === "pricing" ? "active" : ""}`}
            style={{ borderRadius: "6px" }}
            type="button"
          >
            <Settings2 size={13} />
            计费定价
          </button>
          <button
            onClick={() => setSubTab("test")}
            className={`assets-filter-btn ${subTab === "test" ? "active" : ""}`}
            style={{ borderRadius: "6px" }}
            type="button"
          >
            <TestTube2 size={13} />
            模型调试探针
          </button>
        </div>
        <span style={{ fontSize: "11px", color: "var(--rv-color-text-muted)" }}>
          {subTab === "catalog" && "系统算力模型注册目录"}
          {subTab === "pricing" && "自定义任务点数收费定价准则"}
          {subTab === "test" && "直接测试大模型接口连通性"}
        </span>
      </div>

      {/* 1. 模型目录 */}
      {subTab === "catalog" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: "20px" }}>
          <form onSubmit={handleCreateModel} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "16px" }}>
            <div className="assets-form-field" style={{ gridColumn: "span 2" }}>
              <label>上游供应商渠道</label>
              <select value={providerId} onChange={(e) => setProviderId(e.target.value)} style={{ minHeight: "36px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-sm)", padding: "0 10px", background: "#ffffff" }}>
                <option value="">选择供应商</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} {p.enabled ? "" : "(未启用)"}</option>
                ))}
              </select>
            </div>

            <div className="assets-form-field">
              <label>模型代码 (Model Name)</label>
              <input value={modelName} onChange={(e) => setModelName(e.target.value)} required />
            </div>

            <div className="assets-form-field">
              <label>展示名称</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>

            <div className="assets-form-field">
              <label>主要能力</label>
              <select
                value={capability}
                onChange={(e) => {
                  setCapability(e.target.value);
                  setDisplayName(e.target.value === "image_generation" ? "主力图片模型" : "主力文本模型");
                }}
                style={{ minHeight: "36px", border: "1px solid var(--rv-color-border-thin)", borderRadius: "var(--rv-radius-sm)", padding: "0 10px", background: "#ffffff" }}
              >
                <option value="text">文本生成 (Text)</option>
                <option value="image_generation">图像生成 (Image)</option>
              </select>
            </div>

            <div className="assets-form-field">
              <label>启用模型</label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--rv-color-text-main)", cursor: "pointer", height: "36px" }}>
                <input type="checkbox" checked={modelEnabled} onChange={(e) => setModelEnabled(e.target.checked)} style={{ width: "auto" }} />
                激活并接入路由
              </label>
            </div>

            <button className="primary-button" type="submit" style={{ gridColumn: "span 2", minHeight: "36px", marginTop: "4px" }}>
              <Plus size={16} />
              登记接入模型
            </button>
          </form>

          <div>
            <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>系统模型清单 ({models.length})</span>
            {models.length > 0 ? (
              <div style={{ display: "grid", gap: "8px", maxHeight: "300px", overflowY: "auto", paddingRight: "4px" }}>
                {models.map((model) => (
                  <div key={model.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.01)", border: "1px solid var(--rv-color-border-thin)", borderRadius: "8px", padding: "10px 14px" }}>
                    <div>
                      <strong style={{ display: "block", fontSize: "12px", color: "var(--rv-color-text-main)" }}>{model.display_name ?? model.name}</strong>
                      <span style={{ display: "block", fontSize: "10px", color: "var(--rv-color-text-muted)", marginTop: "1px" }}>
                        {model.name} · {providerNameFor(model.provider_id)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => {
                          setTestModelId(model.id);
                          setSubTab("test");
                        }}
                        style={{ border: "1px solid var(--rv-color-border-thin)", background: "#ffffff", padding: "3px 8px", fontSize: "10px", borderRadius: "4px" }}
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
                          borderRadius: "4px"
                        }}
                        type="button"
                      >
                        {model.enabled ? "停用" : "启用"}
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
                          borderRadius: "4px"
                        }}
                        type="button"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state compact-empty" style={{ minHeight: "180px" }}>
                <p>暂无模型接入</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. 计费定价 */}
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
              <label>启用规则</label>
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
            <span style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "var(--rv-color-text-muted)", marginBottom: "10px" }}>现行定价标准 ({pricingRules.length})</span>
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
                <p>暂无定价规则</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. 模型测试 */}
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
                <Image size={14} />
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
    </div>
  );
}
