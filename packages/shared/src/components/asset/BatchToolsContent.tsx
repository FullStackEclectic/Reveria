import React, { useState } from "react";
import { BatchExportPanel } from "./BatchExportPanel";
import { IdPhotoPanel } from "./IdPhotoPanel";
import { UpscalePanel } from "./UpscalePanel";
import type { useBatchExport } from "./useBatchExport";
import type { useUpscaleTask } from "./useUpscaleTask";
import type { IdPhotoColor, IdPhotoSpec } from "./retouch/idPhoto";
import "./ProfessionalAdjustments.css";

type ToolsSection = "batch" | "id-photo" | "upscale";

interface Props {
  batch: ReturnType<typeof useBatchExport>;
  totalCount: number;
  hasCutout: boolean;
  upscale: ReturnType<typeof useUpscaleTask>;
  onApplyIdPhoto: (spec: IdPhotoSpec, color: IdPhotoColor) => void;
  onRequestCutout: () => void;
}

export function BatchToolsContent({ batch, totalCount, hasCutout, upscale, onApplyIdPhoto, onRequestCutout }: Props) {
  const [section, setSection] = useState<ToolsSection>("batch");
  return (
    <>
      <div className="batch-tools-nav">
        <button type="button" className={section === "batch" ? "active" : ""} onClick={() => setSection("batch")}>批量</button>
        <button type="button" className={section === "id-photo" ? "active" : ""} onClick={() => setSection("id-photo")}>证件照</button>
        <button type="button" className={section === "upscale" ? "active" : ""} onClick={() => setSection("upscale")}>变清晰</button>
      </div>
      {section === "batch" && (
        <BatchExportPanel
          selectedCount={batch.selectedCount} totalCount={totalCount}
          format={batch.format} maxEdge={batch.maxEdge} namePattern={batch.namePattern}
          settingsMode={batch.settingsMode} syncBeforeExport={batch.syncBeforeExport}
          running={batch.running} progressLabel={batch.progressLabel}
          onFormatChange={batch.setFormat} onMaxEdgeChange={batch.setMaxEdge}
          onNamePatternChange={batch.setNamePattern} onSettingsModeChange={batch.setSettingsMode}
          onSyncBeforeExportChange={batch.setSyncBeforeExport}
          onApplyCurrent={() => { void batch.applyCurrentToSelected(); }}
          onExport={() => { void batch.startExport(); }}
        />
      )}
      {section === "id-photo" && (
        <IdPhotoPanel hasCutout={hasCutout} applying={false}
          onApply={onApplyIdPhoto} onRequestCutout={onRequestCutout} />
      )}
      {section === "upscale" && (
        <UpscalePanel isSubmitting={upscale.isSubmitting} taskStatus={upscale.taskStatus}
          errorMessage={upscale.errorMessage} onSubmit={() => { void upscale.submit(); }} />
      )}
    </>
  );
}
