import { useEffect, useRef, useState } from "react";
import type { AssetSummary } from "../../types";
import { getJson, postJson } from "../../utils";

export type UpscaleTaskStatus = "pending" | "running" | "succeeded" | "failed" | "error" | null;

interface Options {
  asset?: AssetSummary;
  onAssetsRefresh?: () => void;
}

function outputURL(task: any): string {
  let output = task?.output_payload;
  if (typeof output === "string") {
    try { output = JSON.parse(output); } catch { return ""; }
  }
  return typeof output?.url === "string" ? output.url : "";
}

export function useUpscaleTask({ asset, onAssetsRefresh }: Options) {
  const [taskStatus, setTaskStatus] = useState<UpscaleTaskStatus>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAssetIDRef = useRef(asset?.id);

  const stopPolling = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => {
    activeAssetIDRef.current = asset?.id;
    stopPolling();
    setTaskStatus(null);
    setErrorMessage("");
    setIsSubmitting(false);
    return () => stopPolling();
  }, [asset?.id]);

  const fail = (message: string) => {
    stopPolling();
    setTaskStatus("error");
    setErrorMessage(message);
    setIsSubmitting(false);
  };

  const pollTask = (taskID: string, assetID: string, deadline: number) => {
    timerRef.current = setTimeout(async () => {
      if (activeAssetIDRef.current !== assetID) return;
      try {
        const task = await getJson<any>(`/api/tasks/${taskID}`);
        if (activeAssetIDRef.current !== assetID) return;
        if (task?.status === "succeeded") {
          if (!outputURL(task)) {
            fail("任务已完成，但未返回超分结果");
            return;
          }
          setTaskStatus("succeeded");
          setErrorMessage("");
          setIsSubmitting(false);
          stopPolling();
          onAssetsRefresh?.();
          return;
        }
        if (task?.status === "failed" || task?.status === "cancelled") {
          fail(task?.error_message || "变清晰失败，请检查模型和定价配置后重试");
          return;
        }
        if (Date.now() >= deadline) {
          fail("等待超时，请稍后在历史中查看任务状态");
          return;
        }
        setTaskStatus(task?.status === "pending" ? "pending" : "running");
      } catch {
        if (Date.now() >= deadline) {
          fail("无法获取变清晰任务状态");
          return;
        }
      }
      pollTask(taskID, assetID, deadline);
    }, 3000);
  };

  const submit = async () => {
    if (!asset?.file_url || !asset.project_id || isSubmitting) return;
    stopPolling();
    setIsSubmitting(true);
    setTaskStatus("pending");
    setErrorMessage("");
    try {
      const response = await postJson<any>("/api/tasks", {
        workspace_id: asset.workspace_id,
        project_id: asset.project_id,
        task_type: "image_upscale",
        input_payload: { image_url: asset.file_url, size: "auto" },
      });
      const task = response?.data ?? response;
      if (!task?.id) throw new Error("创建变清晰任务失败");
      pollTask(task.id, asset.id, Date.now() + 300_000);
    } catch (error) {
      fail(error instanceof Error ? error.message : "提交变清晰任务失败");
    }
  };

  return { taskStatus, errorMessage, isSubmitting, submit };
}
