import { useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { IDENTITY_CURVE, MAX_CLONE_STAMPS, MAX_HEALING_SPOTS, RetouchSettings,
  VS_SOURCE, FS_SOURCE, UNIFORM_NAMES, packPortraitParams,
  packFacePoints, packFaceScale, type CurvePoints,
} from "./editorConstants";
import { bakeLiquifyMap } from "./retouch/liquifyMap";
import { isFreeTransformActive, LIQUIFY_MAP_SIZE } from "./retouch/settings";
import {
  bakeLocalMaskAtlas,
  LOCAL_MASK_ATLAS_HEIGHT,
  LOCAL_MASK_ATLAS_WIDTH,
  packLocalMasks,
} from "./retouch/localMasks";
import type { LutData } from "./retouch/lut";
import { FacePoints } from "../../utils/faceMesh";
import { calculateHistogram, type ImageHistogram } from "./retouch/histogram";
import { exportDecoratedCanvas } from "./retouch/outputDecorations";

export interface RetouchRendererHandle {
  exportImage: (format?: "jpeg" | "png" | "webp", quality?: number) => Promise<string | null>;
  sampleColor: (x: number, y: number) => [number, number, number] | null;
  getHistogram: () => ImageHistogram | null;
}

interface Props {
  imageUrl: string;
  settings: RetouchSettings;
  showOriginal: boolean;
  facePoints?: FacePoints | null;
  /** 已解析的 3D LUT，由上层按 settings.lut_file 查表得到 */
  lut?: LutData | null;
  cutoutUrl?: string;
  backgroundImageUrl?: string;
  selectedLocalMaskId?: string | null;
  showLocalMaskOverlay?: boolean;
  className?: string;
  onError?: (message: string) => void;
  onRendered?: () => void;
}

const TEXTURE_UNIT_IMAGE = 0;
const TEXTURE_UNIT_LIQUIFY = 1;
const TEXTURE_UNIT_LUT = 2;
const TEXTURE_UNIT_CUTOUT = 3;
const TEXTURE_UNIT_BACKGROUND = 4;
const TEXTURE_UNIT_LOCAL_MASK = 5;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "未知错误";
    gl.deleteShader(shader);
    throw new Error(`${type === gl.VERTEX_SHADER ? "顶点" : "片元"}着色器编译失败: ${log}`);
  }
  return shader;
}

/** 创建一个像素纹理，作为 LUT / 位移贴图未就绪时的占位，避免采样器悬空 */
function createPlaceholderTexture(gl: WebGLRenderingContext, r: number, g: number, b: number, a = 255): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array([r, g, b, a]));
  return tex;
}

function parseHexColor(value: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return [1, 1, 1];
  const encoded = Number.parseInt(match[1], 16);
  return [((encoded >> 16) & 255) / 255, ((encoded >> 8) & 255) / 255, (encoded & 255) / 255];
}

function applyUniforms(
  gl: WebGLRenderingContext,
  locs: Record<string, WebGLUniformLocation | null>,
  s: RetouchSettings,
  showOriginal: boolean,
  w: number,
  h: number,
  fp: FacePoints | null | undefined,
  lut: LutData | null | undefined,
  liquifyActive: boolean,
  cutoutReady: boolean,
  backgroundImageReady: boolean,
  backgroundImageSize: [number, number],
  selectedLocalMaskId: string | null | undefined,
  showLocalMaskOverlay: boolean | undefined,
) {
  gl.uniform2f(locs["u_texSize"], w, h);
  const z = showOriginal;
  gl.uniform1f(locs["u_exposure"],     z ? 0 : s.exposure);
  gl.uniform1f(locs["u_contrast"],     z ? 0 : s.contrast);
  gl.uniform1f(locs["u_highlights"],   z ? 0 : s.highlights);
  gl.uniform1f(locs["u_shadows"],      z ? 0 : s.shadows);
  gl.uniform1f(locs["u_whites"],       z ? 0 : s.whites);
  gl.uniform1f(locs["u_blacks"],       z ? 0 : s.blacks);
  gl.uniform1f(locs["u_saturation"],   z ? 0 : s.saturation);
  gl.uniform1f(locs["u_vibrance"],     z ? 0 : s.vibrance);
  gl.uniform1f(locs["u_temperature"],  z ? 0 : s.temperature);
  gl.uniform1f(locs["u_tint"],         z ? 0 : s.tint);
  gl.uniform1f(locs["u_dehaze"],       z ? 0 : s.dehaze);
  gl.uniform1f(locs["u_clarity"],      z ? 0 : s.clarity);
  gl.uniform1f(locs["u_sharpness"],    z ? 0 : s.sharpness);
  gl.uniform1f(locs["u_luma_denoise"], z ? 0 : s.luma_denoise);
  gl.uniform1f(locs["u_chroma_denoise"], z ? 0 : s.chroma_denoise);
  gl.uniform1f(locs["u_grain_amount"], z ? 0 : s.grain_amount);
  gl.uniform1f(locs["u_grain_size"], s.grain_size);
  gl.uniform1f(locs["u_grain_roughness"], s.grain_roughness);
  gl.uniform1f(locs["u_grain_highlights"], s.grain_highlights);
  gl.uniform1f(locs["u_lens_distortion"], z ? 0 : s.lens_distortion);
  gl.uniform1f(locs["u_fringing_amount"], z ? 0 : s.fringing_amount);
  gl.uniform1f(locs["u_perspective_horizontal"], z ? 0 : s.perspective_horizontal);
  gl.uniform1f(locs["u_perspective_vertical"], z ? 0 : s.perspective_vertical);
  gl.uniform1f(locs["u_vignette_amount"], z ? 0 : s.vignette_amount);
  gl.uniform1f(locs["u_vignette_midpoint"], s.vignette_midpoint);
  gl.uniform1f(locs["u_vignette_feather"], s.vignette_feather);
  gl.uniform1f(locs["u_vignette_roundness"], s.vignette_roundness);
  gl.uniform1f(locs["u_vignette_highlights"], s.vignette_highlights);
  gl.uniform1f(locs["u_body_center_x"], s.body_center_x);
  gl.uniform1f(locs["u_body_waist_y"], s.body_waist_y);
  gl.uniform1f(locs["u_body_waist"], z ? 0 : s.body_waist);
  gl.uniform1f(locs["u_body_shoulders"], z ? 0 : s.body_shoulders);
  gl.uniform1f(locs["u_body_hips"], z ? 0 : s.body_hips);
  gl.uniform1f(locs["u_body_legs"], z ? 0 : s.body_legs);
  gl.uniform1f(locs["u_body_leg_length"], z ? 0 : s.body_leg_length);
  const ftPoints = s.free_transform_points;
  const ftActive = !z && isFreeTransformActive(ftPoints);
  gl.uniform1f(locs["u_free_transform_enabled"], ftActive ? 1 : 0);
  gl.uniform2f(locs["u_ft_tl"], ftPoints[0][0], ftPoints[0][1]);
  gl.uniform2f(locs["u_ft_tr"], ftPoints[1][0], ftPoints[1][1]);
  gl.uniform2f(locs["u_ft_br"], ftPoints[2][0], ftPoints[2][1]);
  gl.uniform2f(locs["u_ft_bl"], ftPoints[3][0], ftPoints[3][1]);
  gl.uniform2f(locs["u_ft_mt"], ftPoints[4][0], ftPoints[4][1]);
  gl.uniform2f(locs["u_ft_mr"], ftPoints[5][0], ftPoints[5][1]);
  gl.uniform2f(locs["u_ft_mb"], ftPoints[6][0], ftPoints[6][1]);
  gl.uniform2f(locs["u_ft_ml"], ftPoints[7][0], ftPoints[7][1]);
  gl.uniform1f(locs["u_border_enabled"], !z && s.border_enabled ? 1 : 0);
  gl.uniform1f(locs["u_border_size"], s.border_size);
  gl.uniform1f(locs["u_border_radius"], s.border_radius);
  const [borderRed, borderGreen, borderBlue] = parseHexColor(s.border_color);
  gl.uniform3f(locs["u_border_color"], borderRed, borderGreen, borderBlue);
  gl.uniform1f(locs["u_rotation"], s.rotation);
  gl.uniform1f(locs["u_flip_horizontal"], s.flip_horizontal);
  gl.uniform1f(locs["u_flip_vertical"], s.flip_vertical);
  gl.uniform1f(locs["u_crop_x"], s.crop_x);
  gl.uniform1f(locs["u_crop_y"], s.crop_y);
  gl.uniform1f(locs["u_crop_width"], s.crop_width);
  gl.uniform1f(locs["u_crop_height"], s.crop_height);
  gl.uniform1f(locs["u_hsl_red_h"],     z ? 0 : s.hsl_red_h);
  gl.uniform1f(locs["u_hsl_red_s"],     z ? 0 : s.hsl_red_s);
  gl.uniform1f(locs["u_hsl_red_l"],     z ? 0 : s.hsl_red_l);
  gl.uniform1f(locs["u_hsl_orange_h"],  z ? 0 : s.hsl_orange_h);
  gl.uniform1f(locs["u_hsl_orange_s"],  z ? 0 : s.hsl_orange_s);
  gl.uniform1f(locs["u_hsl_orange_l"],  z ? 0 : s.hsl_orange_l);
  gl.uniform1f(locs["u_hsl_yellow_h"],  z ? 0 : s.hsl_yellow_h);
  gl.uniform1f(locs["u_hsl_yellow_s"],  z ? 0 : s.hsl_yellow_s);
  gl.uniform1f(locs["u_hsl_yellow_l"],  z ? 0 : s.hsl_yellow_l);
  gl.uniform1f(locs["u_hsl_green_h"],   z ? 0 : s.hsl_green_h);
  gl.uniform1f(locs["u_hsl_green_s"],   z ? 0 : s.hsl_green_s);
  gl.uniform1f(locs["u_hsl_green_l"],   z ? 0 : s.hsl_green_l);
  gl.uniform1f(locs["u_hsl_aqua_h"],    z ? 0 : s.hsl_aqua_h);
  gl.uniform1f(locs["u_hsl_aqua_s"],    z ? 0 : s.hsl_aqua_s);
  gl.uniform1f(locs["u_hsl_aqua_l"],    z ? 0 : s.hsl_aqua_l);
  gl.uniform1f(locs["u_hsl_blue_h"],    z ? 0 : s.hsl_blue_h);
  gl.uniform1f(locs["u_hsl_blue_s"],    z ? 0 : s.hsl_blue_s);
  gl.uniform1f(locs["u_hsl_blue_l"],    z ? 0 : s.hsl_blue_l);
  gl.uniform1f(locs["u_hsl_purple_h"],  z ? 0 : s.hsl_purple_h);
  gl.uniform1f(locs["u_hsl_purple_s"],  z ? 0 : s.hsl_purple_s);
  gl.uniform1f(locs["u_hsl_purple_l"],  z ? 0 : s.hsl_purple_l);
  gl.uniform1f(locs["u_hsl_magenta_h"], z ? 0 : s.hsl_magenta_h);
  gl.uniform1f(locs["u_hsl_magenta_s"], z ? 0 : s.hsl_magenta_s);
  gl.uniform1f(locs["u_hsl_magenta_l"], z ? 0 : s.hsl_magenta_l);
  const setCurve = (name: string, points: CurvePoints) => {
    gl.uniform4f(locs[`u_curve_${name}_a`], points[0], points[1], points[2], points[3]);
    gl.uniform1f(locs[`u_curve_${name}_b`], points[4]);
  };
  setCurve("rgb", z ? IDENTITY_CURVE : s.curve_rgb);
  setCurve("red", z ? IDENTITY_CURVE : s.curve_red);
  setCurve("green", z ? IDENTITY_CURVE : s.curve_green);
  setCurve("blue", z ? IDENTITY_CURVE : s.curve_blue);
  gl.uniform1f(locs["u_shadow_tone_hue"], s.shadow_tone_hue);
  gl.uniform1f(locs["u_shadow_tone_saturation"], z ? 0 : s.shadow_tone_saturation);
  gl.uniform1f(locs["u_highlight_tone_hue"], s.highlight_tone_hue);
  gl.uniform1f(locs["u_highlight_tone_saturation"], z ? 0 : s.highlight_tone_saturation);
  gl.uniform1f(locs["u_tone_balance"], z ? 0 : s.tone_balance);

  const healingUniform = new Float32Array(MAX_HEALING_SPOTS * 4);
  if (!z) {
    s.healing_spots.slice(-MAX_HEALING_SPOTS).forEach((spot, index) => {
      healingUniform.set([spot.x, spot.y, spot.radius, spot.strength], index * 4);
    });
  }
  gl.uniform4fv(locs["u_heal_spots[0]"], healingUniform);
  const cloneTargets = new Float32Array(MAX_CLONE_STAMPS * 4);
  const cloneSources = new Float32Array(MAX_CLONE_STAMPS * 2);
  if (!z) {
    s.clone_stamps.slice(-MAX_CLONE_STAMPS).forEach((stamp, index) => {
      cloneTargets.set([stamp.x, stamp.y, stamp.radius, stamp.strength], index * 4);
      cloneSources.set([stamp.sourceX, stamp.sourceY], index * 2);
    });
  }
  gl.uniform4fv(locs["u_clone_targets[0]"], cloneTargets);
  gl.uniform2fv(locs["u_clone_sources[0]"], cloneSources);

  // 人脸关键点：对比原图时置零，形变与局部修饰一并失效
  const hasFace = !z && fp != null;
  gl.uniform1f(locs["u_face_detected"], hasFace ? 1 : 0);
  gl.uniform4fv(locs["u_face_pts[0]"], packFacePoints(hasFace ? fp : null));
  const scale = packFaceScale(hasFace ? fp : null);
  gl.uniform4f(locs["u_face_scale"], scale[0], scale[1], scale[2], scale[3]);
  gl.uniform1f(locs["u_eye_left_radius_x"], fp ? fp.eyeLeftRadiusX : 0.04);
  gl.uniform1f(locs["u_eye_left_radius_y"], fp ? fp.eyeLeftRadiusY : 0.02);
  gl.uniform1f(locs["u_eye_right_radius_x"], fp ? fp.eyeRightRadiusX : 0.04);
  gl.uniform1f(locs["u_eye_right_radius_y"], fp ? fp.eyeRightRadiusY : 0.02);

  // 全部人像参数按声明表顺序打包上传
  gl.uniform4fv(locs["u_portrait[0]"], packPortraitParams(s, z));

  gl.uniform1i(locs["u_image"], TEXTURE_UNIT_IMAGE);
  gl.uniform1i(locs["u_liquify_map"], TEXTURE_UNIT_LIQUIFY);
  gl.uniform1i(locs["u_lut"], TEXTURE_UNIT_LUT);
  gl.uniform1f(locs["u_liquify_enabled"], !z && liquifyActive ? 1 : 0);

  const lutActive = !z && lut != null && s.lut_file !== "" && s.lut_intensity > 0;
  gl.uniform1f(locs["u_lut_enabled"], lutActive ? 1 : 0);
  gl.uniform1f(locs["u_lut_size"], lut ? lut.size : 2);
  gl.uniform1f(locs["u_lut_intensity"], s.lut_intensity);

  gl.uniform1i(locs["u_cutout"], TEXTURE_UNIT_CUTOUT);
  gl.uniform1i(locs["u_background_image"], TEXTURE_UNIT_BACKGROUND);
  const backgroundModes = { original: 0, transparent: 1, solid: 2, blur: 3, image: 4 } as const;
  const cutoutActive = !z && cutoutReady && s.background_mode !== "original";
  let backgroundMode = cutoutActive ? backgroundModes[s.background_mode] : 0;
  if (backgroundMode === 4 && !backgroundImageReady) backgroundMode = 1;
  const [red, green, blue] = parseHexColor(s.background_color);
  gl.uniform1f(locs["u_cutout_enabled"], cutoutActive ? 1 : 0);
  gl.uniform1f(locs["u_background_mode"], backgroundMode);
  gl.uniform3f(locs["u_background_color"], red, green, blue);
  gl.uniform1f(locs["u_background_blur"], s.background_blur);
  gl.uniform1f(locs["u_background_image_ready"], backgroundImageReady ? 1 : 0);
  gl.uniform2f(locs["u_background_image_size"], backgroundImageSize[0], backgroundImageSize[1]);
  gl.uniform1f(locs["u_background_image_scale"], s.background_image_scale);
  gl.uniform2f(locs["u_background_image_offset"], s.background_image_x, s.background_image_y);

  const localMasks = packLocalMasks(s.local_masks, z);
  gl.uniform1i(locs["u_local_mask_atlas"], TEXTURE_UNIT_LOCAL_MASK);
  gl.uniform4fv(locs["u_local_meta[0]"], localMasks.meta);
  gl.uniform4fv(locs["u_local_geometry_a[0]"], localMasks.geometryA);
  gl.uniform4fv(locs["u_local_geometry_b[0]"], localMasks.geometryB);
  gl.uniform4fv(locs["u_local_range[0]"], localMasks.range);
  gl.uniform4fv(locs["u_local_sample[0]"], localMasks.sample);
  gl.uniform4fv(locs["u_local_adjust_a[0]"], localMasks.adjustmentA);
  gl.uniform4fv(locs["u_local_adjust_b[0]"], localMasks.adjustmentB);
  const previewIndex = selectedLocalMaskId
    ? s.local_masks.findIndex((mask) => mask.id === selectedLocalMaskId)
    : -1;
  gl.uniform1f(locs["u_local_preview_index"], previewIndex);
  gl.uniform1f(locs["u_local_preview_enabled"], !z && showLocalMaskOverlay && previewIndex >= 0 ? 1 : 0);
}

export const RetouchRenderer = forwardRef<RetouchRendererHandle, Props>(
  function RetouchRenderer({
    imageUrl, settings, showOriginal, facePoints, lut, cutoutUrl, backgroundImageUrl,
    selectedLocalMaskId, showLocalMaskOverlay, className, onError, onRendered,
  }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const locsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const texRef = useRef<WebGLTexture | null>(null);
  const liquifyTexRef = useRef<WebGLTexture | null>(null);
  const lutTexRef = useRef<WebGLTexture | null>(null);
  const cutoutTexRef = useRef<WebGLTexture | null>(null);
  const backgroundTexRef = useRef<WebGLTexture | null>(null);
  const localMaskTexRef = useRef<WebGLTexture | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<[number, number]>([1, 1]);
  const [sourceSize, setSourceSize] = useState<[number, number]>([1, 1]);
  const [cutoutReady, setCutoutReady] = useState(false);
  const [backgroundImageReady, setBackgroundImageReady] = useState(false);
  const [backgroundImageSize, setBackgroundImageSize] = useState<[number, number]>([1, 1]);

  // 液化位移贴图只在笔画变化时重新烘焙
  const liquifyPixels = useMemo(
    () => (settings.liquify_strokes.length > 0 ? bakeLiquifyMap(settings.liquify_strokes) : null),
    [settings.liquify_strokes],
  );
  const localMaskPixels = useMemo(
    () => bakeLocalMaskAtlas(settings.local_masks, sourceSize[0] / Math.max(sourceSize[1], 1)),
    [settings.local_masks, sourceSize],
  );

  const resizeOutput = (gl: WebGLRenderingContext, sourceWidth: number, sourceHeight: number) => {
    const canvas = canvasRef.current!;
    const quarterTurn = Math.round(settings.rotation) % 2 !== 0;
    const orientedWidth = quarterTurn ? sourceHeight : sourceWidth;
    const orientedHeight = quarterTurn ? sourceWidth : sourceHeight;
    canvas.width = Math.max(1, Math.round(orientedWidth * settings.crop_width));
    canvas.height = Math.max(1, Math.round(orientedHeight * settings.crop_height));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  useImperativeHandle(ref, () => ({
    async exportImage(format = "jpeg", quality = 0.95) {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return exportDecoratedCanvas(canvas, settings, format, quality);
    },
    sampleColor(x, y) {
      const sourceCanvas = sourceCanvasRef.current;
      const context = sourceCanvas?.getContext("2d", { willReadFrequently: true });
      if (!sourceCanvas || !context) return null;
      const px = Math.min(sourceCanvas.width - 1, Math.max(0, Math.round(x * (sourceCanvas.width - 1))));
      const py = Math.min(sourceCanvas.height - 1, Math.max(0, Math.round(y * (sourceCanvas.height - 1))));
      const pixel = context.getImageData(px, py, 1, 1).data;
      return [pixel[0] / 255, pixel[1] / 255, pixel[2] / 255];
    },
    getHistogram() {
      const canvas = canvasRef.current;
      if (!canvas || canvas.width <= 0 || canvas.height <= 0) return null;
      const sample = document.createElement("canvas");
      const scale = Math.min(1, 256 / Math.max(canvas.width, canvas.height));
      sample.width = Math.max(1, Math.round(canvas.width * scale));
      sample.height = Math.max(1, Math.round(canvas.height * scale));
      const context = sample.getContext("2d", { willReadFrequently: true });
      if (!context) return null;
      context.drawImage(canvas, 0, 0, sample.width, sample.height);
      return calculateHistogram(context.getImageData(0, 0, sample.width, sample.height).data);
    },
  }));

  // 编译 Shader，只执行一次
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) {
      onError?.("当前环境不支持 WebGL，无法进行图像精修");
      return;
    }
    glRef.current = gl;

    let prog: WebGLProgram;
    try {
      const vs = compileShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
      prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(`着色器链接失败: ${gl.getProgramInfoLog(prog) ?? "未知错误"}`);
      }
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    } catch (error) {
      console.error(error);
      onError?.(error instanceof Error ? error.message : String(error));
      return;
    }
    gl.useProgram(prog);
    programRef.current = prog;

    for (const name of UNIFORM_NAMES) {
      locsRef.current[name] = gl.getUniformLocation(prog, name);
    }

    // 未启用时也要给采样器绑定合法纹理：位移贴图取 0.5 表示零位移
    liquifyTexRef.current = createPlaceholderTexture(gl, 128, 128, 0);
    lutTexRef.current = createPlaceholderTexture(gl, 0, 0, 0);
    cutoutTexRef.current = createPlaceholderTexture(gl, 0, 0, 0, 0);
    backgroundTexRef.current = createPlaceholderTexture(gl, 0, 0, 0);
    localMaskTexRef.current = createPlaceholderTexture(gl, 0, 0, 0);

    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    return () => {
      gl.deleteProgram(prog);
      if (liquifyTexRef.current) gl.deleteTexture(liquifyTexRef.current);
      if (lutTexRef.current) gl.deleteTexture(lutTexRef.current);
      if (cutoutTexRef.current) gl.deleteTexture(cutoutTexRef.current);
      if (backgroundTexRef.current) gl.deleteTexture(backgroundTexRef.current);
      if (localMaskTexRef.current) gl.deleteTexture(localMaskTexRef.current);
      if (texRef.current) gl.deleteTexture(texRef.current);
    };
  }, []);

  // 加载纹理（仅当 imageUrl 变化时）
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !programRef.current || !imageUrl) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      if (cancelled) return;
      sizeRef.current = [img.naturalWidth, img.naturalHeight];
      setSourceSize([img.naturalWidth, img.naturalHeight]);
      const sourceCanvas = document.createElement("canvas");
      const sampleScale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
      sourceCanvas.width = Math.max(1, Math.round(img.naturalWidth * sampleScale));
      sourceCanvas.height = Math.max(1, Math.round(img.naturalHeight * sampleScale));
      sourceCanvas.getContext("2d", { willReadFrequently: true })
        ?.drawImage(img, 0, 0, sourceCanvas.width, sourceCanvas.height);
      sourceCanvasRef.current = sourceCanvas;
      resizeOutput(gl, img.naturalWidth, img.naturalHeight);

      if (texRef.current) gl.deleteTexture(texRef.current);
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_IMAGE);
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      texRef.current = tex;

      applyUniforms(gl, locsRef.current, settings, showOriginal,
        img.naturalWidth, img.naturalHeight, facePoints, lut, liquifyPixels != null,
        cutoutReady, backgroundImageReady, backgroundImageSize,
        selectedLocalMaskId, showLocalMaskOverlay);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      onRendered?.();
    };
    img.onerror = () => {
      if (!cancelled) onError?.("图片加载失败，请检查素材是否可访问");
    };
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // 液化位移贴图变化时重新上传
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !liquifyTexRef.current) return;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_LIQUIFY);
    gl.bindTexture(gl.TEXTURE_2D, liquifyTexRef.current);
    if (liquifyPixels) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, LIQUIFY_MAP_SIZE, LIQUIFY_MAP_SIZE, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, liquifyPixels);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([128, 128, 0, 255]));
    }
  }, [liquifyPixels]);

  // LUT 纹理变化时重新上传
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !lutTexRef.current) return;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_LUT);
    gl.bindTexture(gl.TEXTURE_2D, lutTexRef.current);
    if (lut) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lut.size * lut.size, lut.size, 0,
        gl.RGBA, gl.UNSIGNED_BYTE, lut.pixels);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 255]));
    }
  }, [lut]);

  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !cutoutTexRef.current) return;
    setCutoutReady(false);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_CUTOUT);
    gl.bindTexture(gl.TEXTURE_2D, cutoutTexRef.current);
    if (!cutoutUrl) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_CUTOUT);
      gl.bindTexture(gl.TEXTURE_2D, cutoutTexRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      setCutoutReady(true);
    };
    image.onerror = () => { if (!cancelled) onError?.("透明前景加载失败，请重新抠图"); };
    image.src = cutoutUrl;
    return () => { cancelled = true; };
  }, [cutoutUrl]);

  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !backgroundTexRef.current) return;
    setBackgroundImageReady(false);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_BACKGROUND);
    gl.bindTexture(gl.TEXTURE_2D, backgroundTexRef.current);
    if (!backgroundImageUrl) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
      setBackgroundImageSize([1, 1]);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_BACKGROUND);
      gl.bindTexture(gl.TEXTURE_2D, backgroundTexRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      setBackgroundImageSize([image.naturalWidth, image.naturalHeight]);
      setBackgroundImageReady(true);
    };
    image.onerror = () => { if (!cancelled) onError?.("背景图片加载失败，请重新上传"); };
    image.src = backgroundImageUrl;
    return () => { cancelled = true; };
  }, [backgroundImageUrl]);

  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !localMaskTexRef.current) return;
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_LOCAL_MASK);
    gl.bindTexture(gl.TEXTURE_2D, localMaskTexRef.current);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
      LOCAL_MASK_ATLAS_WIDTH, LOCAL_MASK_ATLAS_HEIGHT, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, localMaskPixels);
  }, [localMaskPixels]);

  // 参数变化只更新 uniform + redraw，不重建 Shader 或纹理
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !texRef.current || !programRef.current) return;
    const [w, h] = sizeRef.current;
    resizeOutput(gl, w, h);
    gl.useProgram(programRef.current);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_IMAGE);
    gl.bindTexture(gl.TEXTURE_2D, texRef.current);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_LIQUIFY);
    gl.bindTexture(gl.TEXTURE_2D, liquifyTexRef.current);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_LUT);
    gl.bindTexture(gl.TEXTURE_2D, lutTexRef.current);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_CUTOUT);
    gl.bindTexture(gl.TEXTURE_2D, cutoutTexRef.current);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_BACKGROUND);
    gl.bindTexture(gl.TEXTURE_2D, backgroundTexRef.current);
    gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT_LOCAL_MASK);
    gl.bindTexture(gl.TEXTURE_2D, localMaskTexRef.current);
    applyUniforms(gl, locsRef.current, settings, showOriginal, w, h, facePoints, lut, liquifyPixels != null,
      cutoutReady, backgroundImageReady, backgroundImageSize,
      selectedLocalMaskId, showLocalMaskOverlay);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    onRendered?.();
  }, [settings, showOriginal, facePoints, lut, liquifyPixels, cutoutReady, backgroundImageReady,
    backgroundImageSize, localMaskPixels, selectedLocalMaskId, showLocalMaskOverlay, onRendered]);

  return <canvas ref={canvasRef} className={className} />;
});
