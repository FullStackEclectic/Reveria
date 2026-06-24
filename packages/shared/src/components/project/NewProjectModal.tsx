import { FormEvent, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { CustomerSummary, BrandKitSummary, ProjectSummary, WorkspaceSummary, UserSummary } from "../../types";
import { postJson } from "../../utils";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspace?: WorkspaceSummary;
  currentUser: UserSummary | null;
  customers: CustomerSummary[];
  brandKits: BrandKitSummary[];
  onSuccess: (
    project: ProjectSummary,
    customer?: CustomerSummary,
    brandKit?: BrandKitSummary,
    selectedCustomerId?: string,
    selectedBrandKitId?: string
  ) => void;
  onError: (msg: string) => void;
}

export function NewProjectModal({
  isOpen,
  onClose,
  activeWorkspace,
  currentUser,
  customers,
  brandKits,
  onSuccess,
  onError,
}: NewProjectModalProps) {
  const [projectCreationMode, setProjectCreationMode] = useState<"standalone" | "existing" | "new_bundle">("standalone");
  const [selectedCustomerIdForNewProject, setSelectedCustomerIdForNewProject] = useState("");
  const [selectedBrandKitIdForNewProject, setSelectedBrandKitIdForNewProject] = useState("");
  const [newProjectFields, setNewProjectFields] = useState({
    name: "新创意项目",
    brief: "",
  });
  const [isCreatingBusinessBundle, setIsCreatingBusinessBundle] = useState(false);

  const [businessForm, setBusinessForm] = useState({
    customerName: "星河咖啡",
    industry: "餐饮",
    brandName: "星河咖啡品牌库",
    toneOfVoice: "温暖、轻快、有生活感",
    stylePrompt: "暖色自然光、手作咖啡、干净排版、小红书生活方式视觉",
    projectName: "小红书开业推广",
    brief: "新店开业三天，主推手作拿铁 and 社区友好氛围，需要产出封面方向、文案角度和短视频脚本方向。",
  });

  if (!isOpen) return null;

  async function handleProjectCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      onError("创建项目失败：请先连接 API 并创建工作区");
      return;
    }
    setIsCreatingBusinessBundle(true);

    try {
      let createdProject: ProjectSummary;

      if (projectCreationMode === "standalone") {
        createdProject = await postJson<ProjectSummary>("/api/projects", {
          workspace_id: workspaceId,
          customer_id: null,
          brand_kit_id: null,
          created_by: currentUser?.id ?? null,
          name: newProjectFields.name,
          brief: newProjectFields.brief || null,
        });
        onSuccess(createdProject);
      } else if (projectCreationMode === "existing") {
        createdProject = await postJson<ProjectSummary>("/api/projects", {
          workspace_id: workspaceId,
          customer_id: selectedCustomerIdForNewProject || null,
          brand_kit_id: selectedBrandKitIdForNewProject || null,
          created_by: currentUser?.id ?? null,
          name: newProjectFields.name,
          brief: newProjectFields.brief || null,
        });
        onSuccess(
          createdProject,
          undefined,
          undefined,
          selectedCustomerIdForNewProject || undefined,
          selectedBrandKitIdForNewProject || undefined
        );
      } else {
        // new_bundle mode
        const customer = await postJson<CustomerSummary>("/api/customers", {
          workspace_id: workspaceId,
          name: businessForm.customerName,
          industry: businessForm.industry || null,
          notes: null,
        });
        const brandKit = await postJson<BrandKitSummary>("/api/brand-kits", {
          workspace_id: workspaceId,
          customer_id: customer.id,
          name: businessForm.brandName,
          tone_of_voice: businessForm.toneOfVoice || null,
          style_prompt: businessForm.stylePrompt || null,
        });
        createdProject = await postJson<ProjectSummary>("/api/projects", {
          workspace_id: workspaceId,
          customer_id: customer.id,
          brand_kit_id: brandKit.id,
          created_by: currentUser?.id ?? null,
          name: businessForm.projectName,
          brief: businessForm.brief || null,
        });

        onSuccess(createdProject, customer, brandKit);
      }
      onClose();
    } catch (err: any) {
      onError(`创建项目失败: ${err?.message || "未知错误"}`);
    } finally {
      setIsCreatingBusinessBundle(false);
    }
  }

  return (
    <div className="asset-dialog-backdrop" style={{ zIndex: 100 }} onClick={onClose}>
      <div className="asset-dialog" style={{ maxWidth: "640px", width: "100%", padding: "24px" }} onClick={(e) => e.stopPropagation()}>
        <div className="panel-header" style={{ marginBottom: "20px" }}>
          <h3>新建客户项目</h3>
          <span>创建独立的创意项目，或与特定客户/品牌关联</span>
        </div>

        <div className="tab-select-group">
          <button
            className={`tab-select-btn ${projectCreationMode === "standalone" ? "active" : ""}`}
            type="button"
            onClick={() => setProjectCreationMode("standalone")}
          >
            独立项目
          </button>
          <button
            className={`tab-select-btn ${projectCreationMode === "existing" ? "active" : ""}`}
            type="button"
            onClick={() => setProjectCreationMode("existing")}
          >
            关联已有客户
          </button>
          <button
            className={`tab-select-btn ${projectCreationMode === "new_bundle" ? "active" : ""}`}
            type="button"
            onClick={() => setProjectCreationMode("new_bundle")}
          >
            一键创建新客户
          </button>
        </div>

        <form className="form-grid business-form" onSubmit={handleProjectCreateSubmit}>
          {projectCreationMode === "standalone" && (
            <>
              <label>
                项目名称
                <input
                  required
                  placeholder="例如：内部周会创意策划"
                  value={newProjectFields.name}
                  onChange={(event) =>
                    setNewProjectFields({
                      ...newProjectFields,
                      name: event.target.value,
                    })
                  }
                />
              </label>
              <label className="wide-field" style={{ marginTop: "12px" }}>
                项目 Brief
                <textarea
                  className="workflow-input"
                  placeholder="在此输入项目的具体创意要求或大纲..."
                  value={newProjectFields.brief}
                  onChange={(event) =>
                    setNewProjectFields({
                      ...newProjectFields,
                      brief: event.target.value,
                    })
                  }
                  rows={4}
                />
              </label>
            </>
          )}

          {projectCreationMode === "existing" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <label>
                  选择客户
                  <select
                    required
                    value={selectedCustomerIdForNewProject}
                    onChange={(event) => {
                      const cid = event.target.value;
                      setSelectedCustomerIdForNewProject(cid);
                      const matchingBrand = brandKits.find((b) => b.customer_id === cid);
                      setSelectedBrandKitIdForNewProject(matchingBrand?.id ?? "");
                    }}
                  >
                    <option value="">请选择客户...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  选择品牌库
                  <select
                    value={selectedBrandKitIdForNewProject}
                    onChange={(event) => setSelectedBrandKitIdForNewProject(event.target.value)}
                  >
                    <option value="">未绑定品牌库</option>
                    {brandKits
                      .filter((b) => !selectedCustomerIdForNewProject || b.customer_id === selectedCustomerIdForNewProject)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <label style={{ marginTop: "12px" }}>
                项目名称
                <input
                  required
                  placeholder="例如：618 大促设计案"
                  value={newProjectFields.name}
                  onChange={(event) =>
                    setNewProjectFields({
                      ...newProjectFields,
                      name: event.target.value,
                    })
                  }
                />
              </label>
              <label className="wide-field" style={{ marginTop: "12px" }}>
                项目 Brief
                <textarea
                  className="workflow-input"
                  placeholder="在此输入项目的具体创意要求..."
                  value={newProjectFields.brief}
                  onChange={(event) =>
                    setNewProjectFields({
                      ...newProjectFields,
                      brief: event.target.value,
                    })
                  }
                  rows={4}
                />
              </label>
            </>
          )}

          {projectCreationMode === "new_bundle" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <label>
                  客户名称
                  <input
                    required
                    placeholder="例如：星河咖啡"
                    value={businessForm.customerName}
                    onChange={(event) =>
                      setBusinessForm({
                        ...businessForm,
                        customerName: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  行业
                  <input
                    placeholder="例如：餐饮"
                    value={businessForm.industry}
                    onChange={(event) =>
                      setBusinessForm({
                        ...businessForm,
                        industry: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px" }}>
                <label>
                  品牌库名称
                  <input
                    required
                    placeholder="例如：星河咖啡品牌库"
                    value={businessForm.brandName}
                    onChange={(event) =>
                      setBusinessForm({
                        ...businessForm,
                        brandName: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  文案口吻
                  <input
                    placeholder="例如：温暖、轻快、有生活感"
                    value={businessForm.toneOfVoice}
                    onChange={(event) =>
                      setBusinessForm({
                        ...businessForm,
                        toneOfVoice: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <label className="wide-field" style={{ marginTop: "12px" }}>
                品牌视觉风格提示
                <textarea
                  className="workflow-input small-input"
                  placeholder="例如：暖色自然光、手作咖啡、小红书生活方式视觉风格"
                  value={businessForm.stylePrompt}
                  onChange={(event) =>
                    setBusinessForm({
                      ...businessForm,
                      stylePrompt: event.target.value,
                    })
                  }
                  rows={2}
                />
              </label>
              <label style={{ marginTop: "12px" }}>
                项目名称
                <input
                  required
                  placeholder="例如：小红书开业推广"
                  value={businessForm.projectName}
                  onChange={(event) =>
                    setBusinessForm({
                      ...businessForm,
                      projectName: event.target.value,
                    })
                  }
                />
              </label>
              <label className="wide-field" style={{ marginTop: "12px" }}>
                项目 Brief
                <textarea
                  className="workflow-input"
                  placeholder="在此输入项目的具体创意要求或文案大纲..."
                  value={businessForm.brief}
                  onChange={(event) =>
                    setBusinessForm({
                      ...businessForm,
                      brief: event.target.value,
                    })
                  }
                  rows={3}
                />
              </label>
            </>
          )}

          <div className="task-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
            <button
              className="secondary-button"
              type="button"
              onClick={onClose}
            >
              取消
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={isCreatingBusinessBundle}
            >
              {isCreatingBusinessBundle ? (
                <Loader2 className="spin" size={18} aria-hidden="true" />
              ) : (
                <Sparkles size={18} aria-hidden="true" />
              )}
              {isCreatingBusinessBundle ? "创建中..." : "确认创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
