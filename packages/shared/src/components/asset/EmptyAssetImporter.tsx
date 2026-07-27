import React from "react";
import { FolderOpen, Image as ImageIcon } from "lucide-react";

interface Props {
  onUpload?: (file: File) => Promise<void>;
}

async function uploadFiles(files: FileList | null, onUpload?: (file: File) => Promise<void>) {
  if (!files || !onUpload) return;
  for (const file of Array.from(files)) {
    await onUpload(file);
  }
}

/** 工作台没有素材时显示的图片及目录导入入口。 */
export function EmptyAssetImporter({ onUpload }: Props) {
  return (
    <div className="retouch-empty-import-container">
      <div className="import-cards-grid">
        <div className="import-card" onClick={() => document.getElementById("file-import-input")?.click()}>
          <div className="import-icon-container">
            <ImageIcon size={48} className="import-icon" />
          </div>
          <span className="import-label">导入图片</span>
          <input
            type="file"
            id="file-import-input"
            multiple
            accept="image/*"
            style={{ display: "none" }}
            onChange={(event) => void uploadFiles(event.target.files, onUpload)}
          />
        </div>
        <div className="import-card" onClick={() => document.getElementById("folder-import-input")?.click()}>
          <div className="import-icon-container">
            <FolderOpen size={48} className="import-icon" />
          </div>
          <span className="import-label">导入整个目录</span>
          <input
            type="file"
            id="folder-import-input"
            {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
            multiple
            style={{ display: "none" }}
            onChange={(event) => void uploadFiles(event.target.files, onUpload)}
          />
        </div>
      </div>
    </div>
  );
}
