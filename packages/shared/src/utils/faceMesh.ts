export interface FacePoint {
  x: number;
  y: number;
}

/**
 * 人脸各部位关键点（均为 0~1 的 UV 坐标）。
 * 由 MediaPipe FaceMesh 的 468 个 landmark 归并而来，供精修 Shader 定位局部区域。
 */
export interface FaceRegions {
  // 额头与眉间
  forehead: FacePoint;      // 抬头纹区域中心
  glabella: FacePoint;      // 川字纹（眉间）
  browLeft: FacePoint;
  browRight: FacePoint;
  // 眼部
  eyeLeft: FacePoint;
  eyeRight: FacePoint;
  underEyeLeft: FacePoint;  // 黑眼圈 / 眼袋 / 卧蚕
  underEyeRight: FacePoint;
  eyeOuterLeft: FacePoint;  // 眼周纹（鱼尾纹）
  eyeOuterRight: FacePoint;
  // 鼻部
  noseBridge: FacePoint;    // 鼻背纹
  noseTip: FacePoint;
  noseAlaLeft: FacePoint;   // 鼻翼
  noseAlaRight: FacePoint;
  nostrilLeft: FacePoint;   // 鼻孔
  nostrilRight: FacePoint;
  // 面颊与法令纹
  nasolabialLeft: FacePoint;
  nasolabialRight: FacePoint;
  cheekLeft: FacePoint;
  cheekRight: FacePoint;
  cheekboneLeft: FacePoint;
  cheekboneRight: FacePoint;
  // 口部
  mouthCenter: FacePoint;
  mouthLeft: FacePoint;
  mouthRight: FacePoint;
  upperLip: FacePoint;
  lowerLip: FacePoint;
  mouthInner: FacePoint;    // 牙齿区域中心
  marionetteLeft: FacePoint;
  marionetteRight: FacePoint;
  // 下颌与颈部
  chin: FacePoint;
  chinCrease: FacePoint;
  jawLeft: FacePoint;
  jawRight: FacePoint;
  neck: FacePoint;          // 颈纹 / 双下巴阴影
  // 整体度量
  faceCenter: FacePoint;
  faceWidth: number;
  faceHeight: number;
  eyeSpan: number;          // 双眼间距，作为局部半径的基准尺度
  mouthWidth: number;
}

export interface FacePoints {
  // 既有渲染管线依赖的标量字段（保持兼容）
  eyeLeftX: number;
  eyeLeftY: number;
  eyeRightX: number;
  eyeRightY: number;
  eyeLeftRadiusX: number;
  eyeLeftRadiusY: number;
  eyeRightRadiusX: number;
  eyeRightRadiusY: number;
  faceCx: number;
  faceWidth: number;
  // 扩展的分区关键点
  regions: FaceRegions;
}

let meshInstance: any = null;
let loadPromise: Promise<any> | null = null;

async function getFaceMesh(): Promise<any> {
  if (meshInstance) return meshInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const { FaceMesh } = await import("@mediapipe/face_mesh");
    const fm = new FaceMesh({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
    });
    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    await new Promise<void>((resolve) => {
      fm.onResults(() => resolve());
      const offscreen = document.createElement("canvas");
      offscreen.width = 1;
      offscreen.height = 1;
      fm.send({ image: offscreen });
    });
    meshInstance = fm;
    return fm;
  })();
  return loadPromise;
}

function avg(landmarks: any[], ...indices: number[]): FacePoint {
  let x = 0;
  let y = 0;
  for (const i of indices) {
    x += landmarks[i].x;
    y += landmarks[i].y;
  }
  return { x: x / indices.length, y: y / indices.length };
}

/** 在两点之间线性插值，用于推导 FaceMesh 未直接给出的区域（如木偶纹、颈部）。 */
function lerpPoint(a: FacePoint, b: FacePoint, t: number): FacePoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** 沿 from→to 方向从 to 继续外推，用于颈部等落在网格之外的区域。 */
function extrapolate(from: FacePoint, to: FacePoint, t: number): FacePoint {
  return { x: to.x + (to.x - from.x) * t, y: to.y + (to.y - from.y) * t };
}

function distance(a: FacePoint, b: FacePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 将 468 点 landmark 归并为精修所需的区域中心。
 * 索引取自 MediaPipe 官方 canonical face model。
 */
function buildRegions(lm: any[]): FaceRegions {
  const foreheadTop = avg(lm, 10);
  const foreheadMid = avg(lm, 151);
  const glabella = avg(lm, 9);
  const browLeft = avg(lm, 105, 55);
  const browRight = avg(lm, 334, 285);

  const eyeLeft = avg(lm, 33, 133, 159, 145);
  const eyeRight = avg(lm, 362, 263, 386, 374);
  const eyeOuterLeft = avg(lm, 33);
  const eyeOuterRight = avg(lm, 263);
  const lidLowerLeft = avg(lm, 145);
  const lidUpperLeft = avg(lm, 159);
  const lidLowerRight = avg(lm, 374);
  const lidUpperRight = avg(lm, 386);
  // 眼袋 / 黑眼圈位于下眼睑再往下约一个眼高处
  const underEyeLeft = extrapolate(lidUpperLeft, lidLowerLeft, 0.9);
  const underEyeRight = extrapolate(lidUpperRight, lidLowerRight, 0.9);

  const noseBridge = avg(lm, 6, 195);
  const noseTip = avg(lm, 1, 4);
  const noseAlaLeft = avg(lm, 129);
  const noseAlaRight = avg(lm, 358);
  const nostrilLeft = avg(lm, 98);
  const nostrilRight = avg(lm, 327);

  const mouthLeft = avg(lm, 61);
  const mouthRight = avg(lm, 291);
  const upperLip = avg(lm, 0, 13);
  const lowerLip = avg(lm, 14, 17);
  const mouthCenter = avg(lm, 13, 14);
  const mouthInner = avg(lm, 13, 14, 78, 308);

  // 法令纹：鼻翼到嘴角连线的中点略偏外
  const nasolabialLeft = lerpPoint(noseAlaLeft, mouthLeft, 0.5);
  const nasolabialRight = lerpPoint(noseAlaRight, mouthRight, 0.5);

  const cheekLeft = avg(lm, 50, 205);
  const cheekRight = avg(lm, 280, 425);
  const cheekboneLeft = avg(lm, 116);
  const cheekboneRight = avg(lm, 345);

  const chin = avg(lm, 152);
  const chinCrease = avg(lm, 175, 199);
  const jawLeft = avg(lm, 172, 132);
  const jawRight = avg(lm, 397, 361);

  // 木偶纹：嘴角向下颌方向延伸
  const marionetteLeft = lerpPoint(mouthLeft, jawLeft, 0.4);
  const marionetteRight = lerpPoint(mouthRight, jawRight, 0.4);

  // 颈部落在网格之外，由鼻尖→下巴方向外推
  const neck = extrapolate(noseTip, chin, 0.55);

  const faceLeft = avg(lm, 234);
  const faceRight = avg(lm, 454);
  const faceWidth = Math.abs(faceRight.x - faceLeft.x);
  const faceHeight = Math.abs(chin.y - foreheadTop.y);

  return {
    forehead: lerpPoint(foreheadMid, glabella, 0.35),
    glabella,
    browLeft,
    browRight,
    eyeLeft,
    eyeRight,
    underEyeLeft,
    underEyeRight,
    eyeOuterLeft,
    eyeOuterRight,
    noseBridge,
    noseTip,
    noseAlaLeft,
    noseAlaRight,
    nostrilLeft,
    nostrilRight,
    nasolabialLeft,
    nasolabialRight,
    cheekLeft,
    cheekRight,
    cheekboneLeft,
    cheekboneRight,
    mouthCenter,
    mouthLeft,
    mouthRight,
    upperLip,
    lowerLip,
    mouthInner,
    marionetteLeft,
    marionetteRight,
    chin,
    chinCrease,
    jawLeft,
    jawRight,
    neck,
    faceCenter: { x: (faceLeft.x + faceRight.x) / 2, y: (foreheadTop.y + chin.y) / 2 },
    faceWidth,
    faceHeight,
    eyeSpan: distance(eyeLeft, eyeRight),
    mouthWidth: distance(mouthLeft, mouthRight),
  };
}

export async function detectFacePoints(imgEl: HTMLImageElement): Promise<FacePoints | null> {
  if (typeof window === "undefined") return null;
  try {
    const fm = await getFaceMesh();

    return await new Promise<FacePoints | null>((resolve) => {
      let resolved = false;

      fm.onResults((results: any) => {
        if (resolved) return;
        resolved = true;
        const lm = results.multiFaceLandmarks?.[0];
        if (!lm) { resolve(null); return; }

        const regions = buildRegions(lm);
        const leftRadiusX = Math.max(0.015, Math.abs(lm[33].x - lm[133].x) * 0.5);
        const leftRadiusY = Math.max(0.01, Math.abs(lm[159].y - lm[145].y) * 0.8);
        const rightRadiusX = Math.max(0.015, Math.abs(lm[362].x - lm[263].x) * 0.5);
        const rightRadiusY = Math.max(0.01, Math.abs(lm[386].y - lm[374].y) * 0.8);

        resolve({
          eyeLeftX: regions.eyeLeft.x, eyeLeftY: regions.eyeLeft.y,
          eyeRightX: regions.eyeRight.x, eyeRightY: regions.eyeRight.y,
          eyeLeftRadiusX: leftRadiusX, eyeLeftRadiusY: leftRadiusY,
          eyeRightRadiusX: rightRadiusX, eyeRightRadiusY: rightRadiusY,
          faceCx: regions.faceCenter.x,
          faceWidth: regions.faceWidth,
          regions,
        });
      });

      fm.send({ image: imgEl });
      // timeout fallback
      setTimeout(() => { if (!resolved) { resolved = true; resolve(null); } }, 3000);
    });
  } catch {
    return null;
  }
}
