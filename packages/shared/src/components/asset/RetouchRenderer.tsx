import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { IDENTITY_CURVE, MAX_CLONE_STAMPS, MAX_HEALING_SPOTS, RetouchSettings, VS_SOURCE, FS_SOURCE, UNIFORM_NAMES, type CurvePoints } from "./editorConstants";
import { FacePoints } from "../../utils/faceMesh";

export interface RetouchRendererHandle {
  exportImage: (format?: "jpeg" | "png", quality?: number) => string | null;
}

interface Props {
  imageUrl: string;
  settings: RetouchSettings;
  showOriginal: boolean;
  facePoints?: FacePoints | null;
  className?: string;
}

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

function applyUniforms(
  gl: WebGLRenderingContext,
  locs: Record<string, WebGLUniformLocation | null>,
  s: RetouchSettings,
  showOriginal: boolean,
  w: number,
  h: number,
  fp?: FacePoints | null,
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
  gl.uniform1f(locs["u_blur"],         z ? 0 : s.blur_strength / 100);
  gl.uniform1f(locs["u_skin_whiten"],  z ? 0 : s.skin_whiten);
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
  // Face warp uniforms
  const hasFace = !z && fp != null ? 1.0 : 0.0;
  gl.uniform1f(locs["u_face_detected"], hasFace);
  gl.uniform1f(locs["u_eye_left_x"],   fp ? fp.eyeLeftX  : 0);
  gl.uniform1f(locs["u_eye_left_y"],   fp ? fp.eyeLeftY  : 0);
  gl.uniform1f(locs["u_eye_right_x"],  fp ? fp.eyeRightX : 0);
  gl.uniform1f(locs["u_eye_right_y"],  fp ? fp.eyeRightY : 0);
  gl.uniform1f(locs["u_eye_left_radius_x"], fp ? fp.eyeLeftRadiusX : 0.04);
  gl.uniform1f(locs["u_eye_left_radius_y"], fp ? fp.eyeLeftRadiusY : 0.02);
  gl.uniform1f(locs["u_eye_right_radius_x"], fp ? fp.eyeRightRadiusX : 0.04);
  gl.uniform1f(locs["u_eye_right_radius_y"], fp ? fp.eyeRightRadiusY : 0.02);
  gl.uniform1f(locs["u_face_cx"],      fp ? fp.faceCx    : 0);
  gl.uniform1f(locs["u_face_width"],   fp ? fp.faceWidth : 0);
  gl.uniform1f(locs["u_eye_enlarge"],  z ? 0 : s.eye_enlarge);
  gl.uniform1f(locs["u_eye_brighten"], z ? 0 : s.eye_brighten);
  gl.uniform1f(locs["u_slim_face"],    z ? 0 : s.slim_face);
}

export const RetouchRenderer = forwardRef<RetouchRendererHandle, Props>(
  function RetouchRenderer({ imageUrl, settings, showOriginal, facePoints, className }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const locsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const texRef = useRef<WebGLTexture | null>(null);
  const sizeRef = useRef<[number, number]>([1, 1]);

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
    exportImage(format = "jpeg", quality = 0.95) {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return canvas.toDataURL(`image/${format}`, quality);
    },
  }));

  // 编译 Shader，只执行一次
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!gl) return;
    glRef.current = gl;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VS_SOURCE);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS_SOURCE);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs!);
    gl.attachShader(prog, fs!);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    programRef.current = prog;

    for (const name of UNIFORM_NAMES) {
      locsRef.current[name] = gl.getUniformLocation(prog, name);
    }

    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    return () => { gl.deleteProgram(prog); };
  }, []);

  // 加载纹理（仅当 imageUrl 变化时）
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !imageUrl) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current!;
      sizeRef.current = [img.naturalWidth, img.naturalHeight];
      resizeOutput(gl, img.naturalWidth, img.naturalHeight);

      if (texRef.current) gl.deleteTexture(texRef.current);
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      texRef.current = tex;

      applyUniforms(gl, locsRef.current, settings, showOriginal, img.naturalWidth, img.naturalHeight, facePoints);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  // 参数变化只更新 uniform + redraw，不重建 Shader 或纹理
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !texRef.current) return;
    const [w, h] = sizeRef.current;
    resizeOutput(gl, w, h);
    gl.useProgram(programRef.current);
    gl.bindTexture(gl.TEXTURE_2D, texRef.current);
    applyUniforms(gl, locsRef.current, settings, showOriginal, w, h, facePoints);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [settings, showOriginal, facePoints]);

  return <canvas ref={canvasRef} className={className} />;
});
