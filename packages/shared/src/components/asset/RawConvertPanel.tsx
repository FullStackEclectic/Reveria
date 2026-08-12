import React, { useRef, useState } from "react";
import {
  IMAGE_AND_RAW_ACCEPT,
  convertRawPathNative,
  nativeRawConvertAvailable,
  selectRawFilesNative,
} from "../../rawConvert";

interface Props {
  converting: boolean;
  progressLabel: string;
  onImport: (files: File[], applyCurrent: boolean) => void;
}

export function RawConvertPanel({ converting, progressLabel, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [applyCurrent, setApplyCurrent] = useState(true);
  const [picking, setPicking] = useState(false);

  const handlePick = async () => {
    if (converting || picking) return;
    if (await nativeRawConvertAvailable()) {
      setPicking(true);
      try {
        const paths = await selectRawFilesNative();
        if (!paths || paths.length === 0) return;
        const files: File[] = [];
        for (const path of paths) {
          files.push(await convertRawPathNative(path));
        }
        onImport(files, applyCurrent);
        return;
      } catch (error) {
        alert(error instanceof Error ? error.message : "RAW 显影失败");
        return;
      } finally {
        setPicking(false);
      }
    }
    inputRef.current?.click();
  };

  return (
    <div className="adjustment-subview batch-tools-panel">
      <div className="panel-title-large">RAW 转片</div>
      <p className="professional-help-text">
        桌面端从传感器数据做 Bayer 去马赛克、相机白平衡和 sRGB 显影。网页端会优先提取最大内嵌预览 JPEG，再导入项目用当前精修参数统一调色。
      </p>
      <label className="switch-item-row">
        <span>导入后同步当前精修参数</span>
        <input type="checkbox" checked={applyCurrent} disabled={converting || picking}
          onChange={(event) => setApplyCurrent(event.target.checked)} />
      </label>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept={IMAGE_AND_RAW_ACCEPT}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) onImport(files, applyCurrent);
        }}
      />
      <button type="button" className="panel-submit-btn" disabled={converting || picking}
        onClick={() => { void handlePick(); }}>
        {converting || picking ? progressLabel || "转换中…" : "选择 RAW 并转换"}
      </button>
      <p className="professional-help-text">
        也可在空画布「导入图片」中直接选择 RAW。桌面端会走同一套显影；网页上传时由服务端提取预览。
      </p>
    </div>
  );
}
