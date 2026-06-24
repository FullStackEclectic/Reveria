import { FormEvent, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ProjectSummary, CustomerSummary, BrandKitSummary } from "../../types";
import { putJson, deleteJson } from "../../utils";

interface ProjectSettingsPanelProps {
  selectedProject: ProjectSummary;
  customers: CustomerSummary[];
  brandKits: BrandKitSummary[];
  currentRole: string;
  setProjects: React.Dispatch<React.SetStateAction<ProjectSummary[]>>;
  setSelectedProjectId: (id: string) => void;
  setProjectsViewMode: (mode: "list" | "detail") => void;
}

export function ProjectSettingsPanel({
  selectedProject,
  customers,
  brandKits,
  currentRole,
  setProjects,
  setSelectedProjectId,
  setProjectsViewMode,
}: ProjectSettingsPanelProps) {
  const [projectEditForm, setProjectEditForm] = useState({
    customer_id: "",
    brand_kit_id: "",
    name: "",
    brief: "",
    status: "draft",
    budget_credits: 0,
  });
  const [isSavingProject, setIsSavingProject] = useState(false);

  // Sync edit form with selected project
  useEffect(() => {
    setProjectEditForm({
      customer_id: selectedProject.customer_id ?? "",
      brand_kit_id: selectedProject.brand_kit_id ?? "",
      name: selectedProject.name,
      brief: selectedProject.brief ?? "",
      status: selectedProject.status,
      budget_credits: selectedProject.budget_credits ?? 0,
    });
  }, [selectedProject.id, selectedProject.customer_id, selectedProject.brand_kit_id, selectedProject.name, selectedProject.brief, selectedProject.status, selectedProject.budget_credits]);

  async function handleSaveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingProject(true);
    try {
      const project = await putJson<ProjectSummary>(
        `/api/projects/${selectedProject.id}`,
        {
          customer_id: projectEditForm.customer_id || null,
          brand_kit_id: projectEditForm.brand_kit_id || null,
          name: projectEditForm.name,
          brief: projectEditForm.brief || null,
          status: projectEditForm.status,
          budget_credits:
            projectEditForm.budget_credits > 0
              ? projectEditForm.budget_credits
              : null,
        }
      );
      setProjects((current) =>
        current.map((item) => (item.id === project.id ? project : item))
      );
      alert(`已保存项目：${project.name}`);
    } catch (err: any) {
      alert(`保存项目失败: ${err.message || err}`);
    } finally {
      setIsSavingProject(false);
    }
  }

  async function handleDeleteProject() {
    if (!window.confirm(`确定要永久删除项目 "${selectedProject.name}" 吗？\n删除后其绑定的画布和评论将被清除，关联资产和任务将不受影响。`)) {
      return;
    }
    setIsSavingProject(true);
    try {
      await deleteJson(`/api/projects/${selectedProject.id}`);
      setProjects((current) => current.filter((p) => p.id !== selectedProject.id));
      setSelectedProjectId("");
      setProjectsViewMode("list");
      alert("项目已成功删除");
    } catch (err: any) {
      alert(`删除项目失败: ${err.message || err}`);
    } finally {
      setIsSavingProject(false);
    }
  }

  return (
    <div className="panel" style={{ minHeight: "auto" }}>
      <div className="panel-header">
        <h3>编辑项目属性</h3>
        <span>修改名称、状态与绑定客户</span>
      </div>
      <form className="form-grid detail-form" onSubmit={handleSaveProject} style={{ marginTop: "12px" }}>
        <label>
          项目名称
          <input
            required
            value={projectEditForm.name}
            onChange={(event) =>
              setProjectEditForm((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
          />
        </label>
        <label>
          状态
          <select
            disabled={
              (currentRole !== "owner" && currentRole !== "admin") &&
              (selectedProject.status === "delivered" || selectedProject.status === "archived")
            }
            value={projectEditForm.status}
            onChange={(event) =>
              setProjectEditForm((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
          >
            <option value="draft">草稿</option>
            <option value="active">进行中</option>
            <option value="reviewing">审核中</option>
            <option value="delivered" disabled={currentRole !== "owner" && currentRole !== "admin"}>已交付</option>
            <option value="archived" disabled={currentRole !== "owner" && currentRole !== "admin"}>已归档</option>
          </select>
        </label>
        <label>
          客户
          <select
            value={projectEditForm.customer_id}
            onChange={(event) =>
              setProjectEditForm((current) => ({
                ...current,
                customer_id: event.target.value,
                brand_kit_id: "",
              }))
            }
          >
            <option value="">未绑定客户</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          品牌库
          <select
            value={projectEditForm.brand_kit_id}
            onChange={(event) =>
              setProjectEditForm((current) => ({
                ...current,
                brand_kit_id: event.target.value,
              }))
            }
          >
            <option value="">未绑定品牌库</option>
            {brandKits
              .filter((b) => !projectEditForm.customer_id || b.customer_id === projectEditForm.customer_id)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
        </label>
        <label className="wide-field">
          预算限制 (点数)
          <input
            type="number"
            disabled={currentRole !== "owner" && currentRole !== "admin"}
            value={projectEditForm.budget_credits}
            onChange={(event) =>
              setProjectEditForm((current) => ({
                ...current,
                budget_credits: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="wide-field">
          项目 Brief
          <textarea
            className="workflow-input"
            value={projectEditForm.brief}
            onChange={(event) =>
              setProjectEditForm((current) => ({
                ...current,
                brief: event.target.value,
              }))
            }
            rows={2}
          />
        </label>
        <div className="task-actions" style={{ display: "flex", justifyContent: "flex-end", width: "100%", gridColumn: "span 2", marginTop: "8px" }}>
          <button className="primary-button" type="submit" disabled={isSavingProject}>
            {isSavingProject && <Loader2 className="spin" size={18} />}
            保存修改
          </button>
        </div>
        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--rv-color-border-thin)", width: "100%", gridColumn: "span 2" }}>
          <h4 style={{ color: "#ef4444", fontSize: "14px", fontWeight: "bold", marginBottom: "8px" }}>危险区域</h4>
          <p style={{ fontSize: "11px", color: "var(--rv-color-text-muted)", margin: "0 0 12px 0" }}>永久删除该项目。此操作无法撤销，项目下的画布和评论将被永久清除。</p>
          <button
            type="button"
            className="secondary-button"
            style={{ borderColor: "#ef4444", color: "#ef4444" }}
            onClick={handleDeleteProject}
            disabled={isSavingProject}
          >
            删除此项目
          </button>
        </div>
      </form>
    </div>
  );
}
