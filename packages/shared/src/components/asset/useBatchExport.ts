import { useCallback, useRef, useState } from "react";
import type { AssetSummary } from "../../types";
import { assetTitle } from "../../utils";
import { normalizeRetouchSettings, type RetouchSettings } from "./editorConstants";
import type { ExportFormat, ExportImageOptions } from "./EditorHeader";
import type { LutData } from "./retouch/lut";
import {
  DEFAULT_BATCH_NAME_PATTERN,
  formatBatchFilename,
  joinExportPath,
  resizeDataUrl,
  type BatchSettingsMode,
} from "./retouch/batchExport";
import type { BatchRenderJob } from "./BatchExportRunner";

interface Options {
  projectAssets: AssetSummary[];
  selectedAssetIds: Set<string>;
  settings: RetouchSettings;
  onSaveSettings: (assetId: string, settings: RetouchSettings) => Promise<boolean>;
  onLoadSettings?: (assetId: string) => Promise<RetouchSettings | undefined>;
  onExportImage: (
    assetId: string,
    settings: RetouchSettings,
    dataUrl: string,
    format: ExportFormat,
    options?: ExportImageOptions,
  ) => Promise<boolean>;
  resolveLut: (id: string) => LutData | null;
}

interface QueueItem {
  job: BatchRenderJob;
  index: number;
  total: number;
}

export function useBatchExport({
  projectAssets, selectedAssetIds, settings, onSaveSettings, onLoadSettings, onExportImage, resolveLut,
}: Options) {
  const [format, setFormat] = useState<ExportFormat>("jpeg");
  const [maxEdge, setMaxEdge] = useState(0);
  const [namePattern, setNamePattern] = useState(DEFAULT_BATCH_NAME_PATTERN);
  const [settingsMode, setSettingsMode] = useState<BatchSettingsMode>("current");
  const [syncBeforeExport, setSyncBeforeExport] = useState(false);
  const [running, setRunning] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [currentJob, setCurrentJob] = useState<BatchRenderJob | null>(null);

  const queueRef = useRef<QueueItem[]>([]);
  const activeRef = useRef<QueueItem | null>(null);
  const outputDirRef = useRef("");
  const optionsRef = useRef({ format, maxEdge, namePattern });
  optionsRef.current = { format, maxEdge, namePattern };
  const resultsRef = useRef({ ok: 0, fail: 0 });
  const runningRef = useRef(false);

  const selectedAssets = projectAssets.filter((asset) => selectedAssetIds.has(asset.id));

  const finish = useCallback(() => {
    runningRef.current = false;
    activeRef.current = null;
    setRunning(false);
    setCurrentJob(null);
    const { ok, fail } = resultsRef.current;
    const dir = outputDirRef.current;
    if (fail === 0) {
      alert(dir ? `已导出 ${ok} 张到：${dir}` : `已导出 ${ok} 张`);
    } else {
      alert(`导出完成：成功 ${ok} 张，失败 ${fail} 张`);
    }
  }, []);

  const startNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (!next) {
      finish();
      return;
    }
    activeRef.current = next;
    setProgressIndex(next.index);
    setProgressTotal(next.total);
    setCurrentJob(next.job);
  }, [finish]);

  const applyCurrentToSelected = async () => {
    if (selectedAssets.length === 0) {
      alert("请先勾选需要同步的图片");
      return false;
    }
    const confirmed = window.confirm(`确定将当前调整参数同步到已选中的 ${selectedAssets.length} 张图片吗？`);
    if (!confirmed) return false;
    try {
      for (const asset of selectedAssets) {
        await onSaveSettings(asset.id, settings);
      }
      alert(`已成功同步参数到 ${selectedAssets.length} 张图片`);
      return true;
    } catch (error) {
      console.error("同步失败:", error);
      alert("同步失败，请重试");
      return false;
    }
  };

  const handleJobComplete = useCallback(async (dataUrl: string) => {
    const item = activeRef.current;
    if (!item) return;
    const { format: exportFormat, maxEdge: edge, namePattern: pattern } = optionsRef.current;
    try {
      let output = dataUrl;
      if (edge > 0) {
        output = await resizeDataUrl(dataUrl, { maxEdge: edge, format: exportFormat, quality: 0.95 });
      }
      const filename = formatBatchFilename(pattern, {
        name: assetTitle(item.job.asset),
        index: item.index,
        total: item.total,
      }, exportFormat);
      const outputPath = outputDirRef.current
        ? joinExportPath(outputDirRef.current, filename)
        : undefined;
      const saved = await onExportImage(item.job.asset.id, item.job.settings, output, exportFormat, {
        filename, outputPath, silent: true,
      });
      if (saved) resultsRef.current.ok += 1;
      else resultsRef.current.fail += 1;
    } catch (error) {
      console.error("批量导出单张失败:", error);
      resultsRef.current.fail += 1;
    }
    window.setTimeout(startNext, 350);
  }, [onExportImage, startNext]);

  const handleJobError = useCallback((message: string) => {
    console.error(message);
    resultsRef.current.fail += 1;
    window.setTimeout(startNext, 200);
  }, [startNext]);

  const startExport = async () => {
    if (runningRef.current || selectedAssets.length === 0) {
      if (selectedAssets.length === 0) alert("请先在胶片栏勾选要导出的图片");
      return;
    }
    runningRef.current = true;
    setRunning(true);
    resultsRef.current = { ok: 0, fail: 0 };
    outputDirRef.current = "";
    try {
      const wailsApp = (window as any).go?.main?.App;
      if (wailsApp?.SelectDirectory) {
        const directory = await wailsApp.SelectDirectory();
        if (!directory) {
          runningRef.current = false;
          setRunning(false);
          return;
        }
        outputDirRef.current = directory;
      }
      if (syncBeforeExport) {
        for (const asset of selectedAssets) {
          await onSaveSettings(asset.id, settings);
        }
      }
      const total = selectedAssets.length;
      const items: QueueItem[] = [];
      for (let index = 0; index < selectedAssets.length; index += 1) {
        const asset = selectedAssets[index];
        let nextSettings = settings;
        if (settingsMode === "saved" && !syncBeforeExport && onLoadSettings) {
          nextSettings = await onLoadSettings(asset.id) ?? settings;
        }
        const snapshot = normalizeRetouchSettings(nextSettings);
        items.push({
          index: index + 1,
          total,
          job: { asset, settings: snapshot, lut: resolveLut(snapshot.lut_file) },
        });
      }
      queueRef.current = items;
      startNext();
    } catch (error) {
      runningRef.current = false;
      setRunning(false);
      alert(error instanceof Error ? error.message : "批量导出启动失败");
    }
  };

  return {
    format, setFormat, maxEdge, setMaxEdge, namePattern, setNamePattern,
    settingsMode, setSettingsMode, syncBeforeExport, setSyncBeforeExport,
    running, currentJob, selectedCount: selectedAssets.length,
    progressLabel: `正在导出 ${progressIndex}/${progressTotal}`,
    applyCurrentToSelected, startExport, handleJobComplete, handleJobError,
  };
}
