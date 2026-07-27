import { useEffect, useRef, useState } from "react";
import type { AssetSummary } from "../../types";
import { getJson, postJson } from "../../utils";
import { generateMaskDataUrl, type EraseMaskCircle } from "./EraseOverlay";
import type { EraseIntent } from "./ErasePanel";

interface Options {
  asset?: AssetSummary;
  sourceUrl: string;
  masks: EraseMaskCircle[];
  intent: EraseIntent;
  onMasksClear: () => void;
  onAssetsRefresh?: () => void;
}

export function useEraseTask({ asset, sourceUrl, masks, intent, onMasksClear, onAssetsRefresh }: Options) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeAssetIDRef = useRef(asset?.id);

  const stopPolling = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => {
    activeAssetIDRef.current = asset?.id;
    stopPolling();
    setIsSubmitting(false);
    setTaskStatus(null);
    return () => stopPolling();
  }, [asset?.id]);

  const poll = (taskID: string, assetID: string, deadline: number) => {
    timerRef.current = setTimeout(async () => {
      if (activeAssetIDRef.current !== assetID) return;
      try {
        const task = await getJson<any>(`/api/tasks/${taskID}`);
        if (activeAssetIDRef.current !== assetID) return;
        if (task?.status === "succeeded") {
          stopPolling();
          setTaskStatus("succeeded");
          setIsSubmitting(false);
          onAssetsRefresh?.();
          return;
        }
        if (task?.status === "failed" || task?.status === "cancelled") {
          stopPolling();
          setTaskStatus("failed");
          setIsSubmitting(false);
          return;
        }
        if (Date.now() >= deadline) {
          stopPolling();
          setIsSubmitting(false);
          setTaskStatus("error");
          return;
        }
        setTaskStatus(task?.status ?? "running");
      } catch {
        // 短暂网络错误保留任务轮询，直到截止时间。
      }
      poll(taskID, assetID, deadline);
    }, 3000);
  };

  const submit = async () => {
    if (!asset?.file_url || !asset.project_id || masks.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setTaskStatus("preparing");
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.crossOrigin = "anonymous";
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = sourceUrl;
      });
      const maskData = generateMaskDataUrl(masks, image.naturalWidth, image.naturalHeight);
      if (!maskData) throw new Error("生成遮罩失败");
      const response = await postJson<any>("/api/tasks", {
        workspace_id: asset.workspace_id,
        project_id: asset.project_id,
        task_type: "image_inpainting",
        input_payload: {
          image_url: asset.file_url,
          mask_data: maskData,
          prompt: intent === "watermark" ? "remove watermark" : "",
          size: "1024x1024",
        },
      });
      const task = response?.data ?? response;
      if (!task?.id) throw new Error("创建任务失败");
      onMasksClear();
      setTaskStatus("pending");
      poll(task.id, asset.id, Date.now() + 300_000);
    } catch (error) {
      console.error("消除任务提交失败:", error);
      setTaskStatus("error");
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, taskStatus, setTaskStatus, submit };
}
