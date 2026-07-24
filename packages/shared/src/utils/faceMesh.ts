export interface FacePoints {
  eyeLeftX: number;   // 0-1 UV
  eyeLeftY: number;
  eyeRightX: number;
  eyeRightY: number;
  eyeLeftRadiusX: number;
  eyeLeftRadiusY: number;
  eyeRightRadiusX: number;
  eyeRightRadiusY: number;
  faceCx: number;     // face center x
  faceWidth: number;  // face width in UV
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

function avg(landmarks: any[], ...indices: number[]): [number, number] {
  let x = 0, y = 0;
  for (const i of indices) { x += landmarks[i].x; y += landmarks[i].y; }
  return [x / indices.length, y / indices.length];
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

        // Left eye center: landmarks 33 (outer), 133 (inner), 159 (upper), 145 (lower)
        const [lx, ly] = avg(lm, 33, 133, 159, 145);
        // Right eye center: landmarks 362 (outer), 263 (inner), 386 (upper), 374 (lower)
        const [rx, ry] = avg(lm, 362, 263, 386, 374);
        const leftRadiusX = Math.max(0.015, Math.abs(lm[33].x - lm[133].x) * 0.5);
        const leftRadiusY = Math.max(0.01, Math.abs(lm[159].y - lm[145].y) * 0.8);
        const rightRadiusX = Math.max(0.015, Math.abs(lm[362].x - lm[263].x) * 0.5);
        const rightRadiusY = Math.max(0.01, Math.abs(lm[386].y - lm[374].y) * 0.8);
        // Face horizontal extent: landmarks 234 (left cheek), 454 (right cheek)
        const faceLeft = lm[234].x;
        const faceRight = lm[454].x;

        resolve({
          eyeLeftX: lx, eyeLeftY: ly,
          eyeRightX: rx, eyeRightY: ry,
          eyeLeftRadiusX: leftRadiusX, eyeLeftRadiusY: leftRadiusY,
          eyeRightRadiusX: rightRadiusX, eyeRightRadiusY: rightRadiusY,
          faceCx: (faceLeft + faceRight) / 2,
          faceWidth: Math.abs(faceRight - faceLeft),
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
