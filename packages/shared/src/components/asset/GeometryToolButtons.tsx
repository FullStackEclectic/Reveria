import { Crop, FlipHorizontal2, FlipVertical2, RotateCw, Scaling } from "lucide-react";

interface Props {
  disabled: boolean;
  cropping: boolean;
  transforming: boolean;
  onToggleCrop: () => void;
  onToggleTransform: () => void;
  onRotate: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
}

export function GeometryToolButtons({
  disabled,
  cropping,
  transforming,
  onToggleCrop,
  onToggleTransform,
  onRotate,
  onFlipHorizontal,
  onFlipVertical,
}: Props) {
  return (
    <>
      <button className={`tool-icon-btn ${cropping ? "active" : ""}`} disabled={disabled || transforming} onClick={onToggleCrop} title="裁剪">
        <Crop size={15} />
      </button>
      <button className={`tool-icon-btn ${transforming ? "active" : ""}`} disabled={disabled || cropping} onClick={onToggleTransform} title="自由变形">
        <Scaling size={15} />
      </button>
      <button className="tool-icon-btn" disabled={disabled || cropping || transforming} onClick={onRotate} title="顺时针旋转 90°">
        <RotateCw size={15} />
      </button>
      <button className="tool-icon-btn" disabled={disabled || cropping || transforming} onClick={onFlipHorizontal} title="水平翻转">
        <FlipHorizontal2 size={15} />
      </button>
      <button className="tool-icon-btn" disabled={disabled || cropping || transforming} onClick={onFlipVertical} title="垂直翻转">
        <FlipVertical2 size={15} />
      </button>
    </>
  );
}
