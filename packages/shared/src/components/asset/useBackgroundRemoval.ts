import { useEffect, useRef, useState } from "react";
import type { AssetSummary } from "../../types";
import { getJson, postJson, uploadAsset } from "../../utils";
import { normalizeRetouchSettings, type RetouchSettings } from "./editorConstants";

export type BackgroundTaskStatus = "pending" | "running" | "succeeded" | "failed" | "error" | null;

interface Options {
  asset?: AssetSummary;
  settings: RetouchSettings;
  onCommit: (settings: RetouchSettings) => void;
  onAssetsRefresh?: () => void;
}

function outputURL(task: any): string {
  let output = task?.output_payload;
  if (typeof output === "string") {
    try { output = JSON.parse(output); } catch { return ""; }
  }
  return typeof output?.url === "string" ? output.url : "";
}

/** 管理抠图任务、轮询及自定义背景素材上传，不在工作台主组件堆积异步状态。 */
export function useBackgroundRemoval({ asset, settings, onCommit, onAssetsRefresh }: Options) {
  const [taskStatus, setTaskStatus] = useState<BackgroundTaskStatus>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAssetIDRef = useRef(asset?.id);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

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
          const cutoutURL = outputURL(task);
          if (!cutoutURL) {
            fail("任务已完成，但未返回透明前景素材");
            return;
          }
          const next = normalizeRetouchSettings({
            ...settingsRef.current,
            background_cutout_url: cutoutURL,
            background_mode: "transparent",
          });
          onCommit(next);
          setTaskStatus("succeeded");
          setErrorMessage("");
          setIsSubmitting(false);
          onAssetsRefresh?.();
          return;
        }
        if (task?.status === "failed" || task?.status === "cancelled") {
          fail(task?.error_message || "抠图失败，请检查模型和定价配置后重试");
          setTaskStatus("failed");
          return;
        }
        if (Date.now() >= deadline) {
          fail("抠图等待超时，可稍后在任务历史中查看结果");
          return;
        }
        setTaskStatus(task?.status === "pending" ? "pending" : "running");
        pollTask(taskID, assetID, deadline);
      } catch {
        if (Date.now() >= deadline) fail("无法获取抠图任务状态");
        else pollTask(taskID, assetID, deadline);
      }
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
        task_type: "image_background_removal",
        input_payload: { image_url: asset.file_url, size: "auto" },
      });
      const task = response?.data ?? response;
      if (!task?.id) throw new Error("创建抠图任务失败");
      pollTask(task.id, asset.id, Date.now() + 300_000);
    } catch (error) {
      fail(error instanceof Error ? error.message : "提交抠图任务失败");
    }
  };

  const uploadBackground = async (file: File) => {
    if (!asset?.project_id || isUploading) return;
    setIsUploading(true);
    setErrorMessage("");
    try {
      const formData = new FormData();
      formData.append("workspace_id", asset.workspace_id);
      formData.append("project_id", asset.project_id);
      if (asset.customer_id) formData.append("customer_id", asset.customer_id);
      formData.append("file", file);
      const uploaded = await uploadAsset(formData);
      const next = normalizeRetouchSettings({
        ...settingsRef.current,
        background_image_url: uploaded.file_url ?? "",
        background_mode: settingsRef.current.background_cutout_url ? "image" : "original",
      });
      onCommit(next);
      onAssetsRefresh?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "背景图片上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  return { taskStatus, errorMessage, isSubmitting, isUploading, submit, uploadBackground };
}
