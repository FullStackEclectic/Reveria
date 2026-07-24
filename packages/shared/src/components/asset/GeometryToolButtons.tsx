import { Crop, FlipHorizontal2, FlipVertical2, RotateCw } from "lucide-react";

interface Props {
  disabled: boolean;
  cropping: boolean;
  onToggleCrop: () => void;
  onRotate: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
}

export function GeometryToolButtons({
  disabled,
  cropping,
  onToggleCrop,
  onRotate,
  onFlipHorizontal,
  onFlipVertical,
}: Props) {
  return (
    <>
      <button className={`tool-icon-btn ${cropping ? "active" : ""}`} disabled={disabled} onClick={onToggleCrop} title="裁剪">
        <Crop size={15} />
      </button>
      <button className="tool-icon-btn" disabled={disabled || cropping} onClick={onRotate} title="顺时针旋转 90°">
        <RotateCw size={15} />
      </button>
      <button className="tool-icon-btn" disabled={disabled || cropping} onClick={onFlipHorizontal} title="水平翻转">
        <FlipHorizontal2 size={15} />
      </button>
      <button className="tool-icon-btn" disabled={disabled || cropping} onClick={onFlipVertical} title="垂直翻转">
        <FlipVertical2 size={15} />
      </button>
    </>
  );
}
