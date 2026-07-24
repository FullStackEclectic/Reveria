import React from "react";
import { Check, Star } from "lucide-react";
import { AssetSummary } from "../../types";
import { assetTitle, assetUrl } from "../../utils";
import "./AssetEditorWorkbench.css";

interface AssetFilmstripProps {
  assets: AssetSummary[];
  currentAsset?: AssetSummary;
  selectedAssetIds: Set<string>;
  ratings: Record<string, number>;
  onSelectAsset: (asset: AssetSummary) => void;
  onToggleSelection: (assetId: string) => void;
  onRate: (assetId: string, rating: number) => void;
}

export function AssetFilmstrip({
  assets,
  currentAsset,
  selectedAssetIds,
  ratings,
  onSelectAsset,
  onToggleSelection,
  onRate,
}: AssetFilmstripProps) {
  if (assets.length === 0) return null;

  return (
    <footer className="editor-bottom-filmstrip">
      <div className="filmstrip-header-row">
        <div className="header-left">
          <span className="label active">本源图</span>
          <span className="label">已选 {selectedAssetIds.size} 张 (共 {assets.length} 张)</span>
        </div>
        <div className="header-right">
          <span className="file-resolution">RGB / 8-Bit / Adobe RGB (1998)</span>
        </div>
      </div>

      <div className="filmstrip-scroll-container">
        {assets.map((item, index) => {
          const active = currentAsset?.id === item.id;
          const thumbUrl = item.thumbnail_url ?? item.file_url ?? "";
          const currentRating = ratings[item.id] || 0;
          const isSelected = selectedAssetIds.has(item.id);

          return (
            <div
              key={item.id}
              className={`filmstrip-card ${active ? "active" : ""} ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectAsset(item)}
            >
              <div className="thumbnail-box">
                <img src={assetUrl(thumbUrl)} alt={assetTitle(item)} loading="lazy" />
                <span className="index-badge">{index + 1}</span>
                {item.selection_status === "approved" && (
                  <span className="approved-icon"><Check size={10} /></span>
                )}
                <input
                  type="checkbox"
                  className="select-checkbox"
                  checked={isSelected}
                  onChange={(event) => {
                    event.stopPropagation();
                    onToggleSelection(item.id);
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
              <div className="metadata-box">
                <span className="filename" title={assetTitle(item)}>{assetTitle(item)}</span>
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${currentRating >= star ? "active" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRate(item.id, star);
                      }}
                    >
                      <Star size={9} fill={currentRating >= star ? "currentColor" : "none"} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </footer>
  );
}
