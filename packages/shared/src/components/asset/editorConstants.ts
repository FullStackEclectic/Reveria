/**
 * 精修参数与 Shader 的统一出口。
 *
 * 实现已按域拆分到 `./retouch/` 下（参数声明表、设置归一化、GLSL 分块、预设），
 * 本文件仅做再导出，保持既有 import 路径不变。
 */
export {
  IDENTITY_CURVE,
  MAX_HEALING_SPOTS,
  MAX_CLONE_STAMPS,
  MAX_LIQUIFY_STROKES,
  LIQUIFY_MAP_SIZE,
  LIQUIFY_MAX_SHIFT,
  DEFAULT_SETTINGS,
  normalizeRetouchSettings,
} from "./retouch/settings";
export type {
  CurvePoints,
  CurveKey,
  HealingSpot,
  CloneStamp,
  LiquifyMode,
  LiquifyStroke,
  RetouchSettings,
} from "./retouch/settings";

export {
  PORTRAIT_GROUPS,
  PORTRAIT_PARAMS,
  PORTRAIT_PARAM_KEYS,
  PORTRAIT_PARAM_MAP,
  DEFAULT_PORTRAIT_PARAMS,
  PORTRAIT_VEC4_COUNT,
  packPortraitParams,
} from "./retouch/portraitParams";
export type {
  PortraitGroupId,
  PortraitGroupMeta,
  PortraitParamMeta,
  PortraitParamKey,
  PortraitSettings,
} from "./retouch/portraitParams";

export {
  FACE_POINT_KEYS,
  FACE_POINT_VEC4_COUNT,
  packFacePoints,
  packFaceScale,
} from "./retouch/faceUniforms";

export { VS_SOURCE, FS_SOURCE, UNIFORM_NAMES } from "./retouch/shader";
export { PRESET_EFFECTS } from "./retouch/presets";
