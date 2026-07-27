import type { FacePoints, FaceRegions } from "../../../utils/faceMesh";

/**
 * 需要上传到 Shader 的人脸关键点。
 * 顺序即打包顺序，每个 vec4 装两个点（xy / zw），宏由本表自动生成。
 */
export const FACE_POINT_KEYS = [
  "forehead",
  "glabella",
  "browLeft",
  "browRight",
  "eyeLeft",
  "eyeRight",
  "underEyeLeft",
  "underEyeRight",
  "eyeOuterLeft",
  "eyeOuterRight",
  "noseBridge",
  "noseTip",
  "noseAlaLeft",
  "noseAlaRight",
  "nostrilLeft",
  "nostrilRight",
  "nasolabialLeft",
  "nasolabialRight",
  "cheekLeft",
  "cheekRight",
  "cheekboneLeft",
  "cheekboneRight",
  "mouthCenter",
  "mouthLeft",
  "mouthRight",
  "upperLip",
  "lowerLip",
  "mouthInner",
  "marionetteLeft",
  "marionetteRight",
  "chin",
  "chinCrease",
  "jawLeft",
  "jawRight",
  "neck",
  "faceCenter",
] as const;

export type FacePointKey = (typeof FACE_POINT_KEYS)[number];

/** 两个点共用一个 vec4 */
export const FACE_POINT_VEC4_COUNT = Math.ceil(FACE_POINT_KEYS.length / 2);

/** 驼峰转 SHOUT_CASE：underEyeLeft -> UNDER_EYE_LEFT */
function macroName(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

/**
 * 生成 `#define FP_EYE_LEFT u_face_pts[2].xy` 形式的宏，
 * 以及脸部尺度 `#define FACE_WIDTH u_face_scale.x`。
 */
export function buildFacePointDefines(): string {
  const points = FACE_POINT_KEYS.map((key, index) => {
    const swizzle = index % 2 === 0 ? "xy" : "zw";
    return `#define FP_${macroName(key)} u_face_pts[${Math.floor(index / 2)}].${swizzle}`;
  });
  const scales = [
    "#define FACE_WIDTH  u_face_scale.x",
    "#define FACE_HEIGHT u_face_scale.y",
    "#define EYE_SPAN    u_face_scale.z",
    "#define MOUTH_WIDTH u_face_scale.w",
  ];
  return [...points, ...scales].join("\n  ");
}

/** 按声明顺序把关键点打包成 Float32Array */
export function packFacePoints(face?: FacePoints | null): Float32Array {
  const packed = new Float32Array(FACE_POINT_VEC4_COUNT * 4);
  const regions = face?.regions;
  if (!regions) return packed;
  FACE_POINT_KEYS.forEach((key, index) => {
    const point = regions[key as keyof FaceRegions] as { x: number; y: number } | undefined;
    if (!point || typeof point.x !== "number" || typeof point.y !== "number") return;
    packed[index * 2] = point.x;
    packed[index * 2 + 1] = point.y;
  });
  return packed;
}

/** 脸部尺度，供 shader 按人脸大小自适应局部半径 */
export function packFaceScale(face?: FacePoints | null): [number, number, number, number] {
  const regions = face?.regions;
  if (!regions) return [0, 0, 0, 0];
  return [regions.faceWidth, regions.faceHeight, regions.eyeSpan, regions.mouthWidth];
}
