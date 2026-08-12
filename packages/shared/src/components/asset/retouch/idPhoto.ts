export interface IdPhotoSpec {
  id: string;
  label: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
}

export interface IdPhotoColor {
  id: string;
  label: string;
  color: string;
}

/** 常用证件照规格，像素按 300 DPI 换算。 */
export const ID_PHOTO_SPECS: IdPhotoSpec[] = [
  { id: "one-inch", label: "一寸", widthMm: 25, heightMm: 35, widthPx: 295, heightPx: 413 },
  { id: "small-one", label: "小一寸", widthMm: 22, heightMm: 32, widthPx: 260, heightPx: 378 },
  { id: "large-one", label: "大一寸", widthMm: 33, heightMm: 48, widthPx: 390, heightPx: 567 },
  { id: "two-inch", label: "二寸", widthMm: 35, heightMm: 49, widthPx: 413, heightPx: 579 },
  { id: "passport", label: "护照", widthMm: 33, heightMm: 48, widthPx: 390, heightPx: 567 },
];

export const ID_PHOTO_COLORS: IdPhotoColor[] = [
  { id: "white", label: "白底", color: "#ffffff" },
  { id: "blue", label: "蓝底", color: "#438edb" },
  { id: "red", label: "红底", color: "#c41e3a" },
];

export interface IdPhotoCrop {
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
}

/** 在旋转后的画面中居中裁出证件照比例。 */
export function fitIdPhotoCrop(
  imageWidth: number,
  imageHeight: number,
  spec: IdPhotoSpec,
): IdPhotoCrop {
  const imageAspect = Math.max(imageWidth, 1) / Math.max(imageHeight, 1);
  const targetAspect = spec.widthPx / spec.heightPx;
  const cropRatio = targetAspect / imageAspect;
  if (cropRatio <= 1) {
    const crop_width = cropRatio;
    return { crop_x: (1 - crop_width) / 2, crop_y: 0, crop_width, crop_height: 1 };
  }
  const crop_height = 1 / cropRatio;
  return { crop_x: 0, crop_y: (1 - crop_height) / 2, crop_width: 1, crop_height };
}
