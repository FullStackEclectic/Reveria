import { useEffect, useRef, useState } from "react";
import { RetouchRenderer, type RetouchRendererHandle } from "./RetouchRenderer";
import { detectFacePoints, type FacePoints } from "../../utils/faceMesh";
import { assetUrl } from "../../utils";
import type { AssetSummary } from "../../types";
import type { ExportFormat } from "./EditorHeader";
import type { RetouchSettings } from "./editorConstants";
import type { LutData } from "./retouch/lut";

export interface BatchRenderJob {
  asset: AssetSummary;
  settings: RetouchSettings;
  lut?: LutData | null;
}

interface Props {
  job: BatchRenderJob;
  format: ExportFormat;
  onComplete: (dataUrl: string) => void;
  onError: (message: string) => void;
}

/**
 * 离屏精修渲染：加载素材、检测人脸后导出当前帧。
 * 画布保持真实分辨率，仅在视觉上隐藏，避免部分浏览器跳过离屏 WebGL。
 */
export function BatchExportRunner({ job, format, onComplete, onError }: Props) {
  const rendererRef = useRef<RetouchRendererHandle>(null);
  const [facePoints, setFacePoints] = useState<FacePoints | null>(null);
  const [faceSettled, setFaceSettled] = useState(false);
  const [drawCount, setDrawCount] = useState(0);
  const capturedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  const imageUrl = assetUrl(job.asset.file_url ?? job.asset.thumbnail_url ?? "");

  useEffect(() => {
    capturedRef.current = false;
    setFacePoints(null);
    setFaceSettled(false);
    setDrawCount(0);
    if (!imageUrl) {
      onErrorRef.current("素材缺少可访问的原图");
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = imageUrl;
    image.onload = async () => {
      try {
        const points = await detectFacePoints(image);
        if (!cancelled) {
          setFacePoints(points);
          setFaceSettled(true);
        }
      } catch {
        if (!cancelled) {
          setFacePoints(null);
          setFaceSettled(true);
        }
      }
    };
    image.onerror = () => {
      if (!cancelled) onErrorRef.current("批量导出时图片加载失败");
    };
    return () => { cancelled = true; };
  }, [job.asset.id, imageUrl]);

  useEffect(() => {
    if (!faceSettled || drawCount < 1 || capturedRef.current) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (capturedRef.current) return;
        const dataUrl = await rendererRef.current?.exportImage(format, format === "png" ? undefined : 0.95);
        if (!dataUrl) {
          onErrorRef.current("无法读取批量渲染结果");
          return;
        }
        capturedRef.current = true;
        onCompleteRef.current(dataUrl);
      })();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [faceSettled, drawCount, format]);

  return (
    <div className="batch-export-runner" aria-hidden>
      <RetouchRenderer
        ref={rendererRef}
        imageUrl={imageUrl}
        settings={job.settings}
        showOriginal={false}
        facePoints={facePoints}
        lut={job.lut ?? undefined}
        cutoutUrl={assetUrl(job.settings.background_cutout_url)}
        backgroundImageUrl={assetUrl(job.settings.background_image_url)}
        onError={onError}
        onRendered={() => setDrawCount((count) => count + 1)}
      />
    </div>
  );
}
