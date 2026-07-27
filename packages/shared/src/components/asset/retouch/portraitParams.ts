/**
 * 人像精修参数的唯一声明源。
 *
 * 这张表同时驱动四件事，任何一处新增参数都不会出现「滑块动了但画面没变」的假交互：
 *   1. `RetouchSettings` 的类型定义与默认值；
 *   2. 右侧人像面板的 UI 渲染（分组、标题、量程）；
 *   3. 打包进 `u_portrait[]` 的 uniform 顺序；
 *   4. Shader 中 `#define P_XXX` 的下标，由本表自动生成，无需手工对齐。
 */

export type PortraitGroupId =
  | "blemish"
  | "skin"
  | "reshape"
  | "teeth"
  | "eye"
  | "makeup"
  | "hair"
  | "body";

export interface PortraitGroupMeta {
  id: PortraitGroupId;
  name: string;
  /** 该组是否依赖人脸关键点，未检出人脸时给出提示 */
  requiresFace: boolean;
}

export const PORTRAIT_GROUPS: PortraitGroupMeta[] = [
  { id: "blemish", name: "祛除瑕疵", requiresFace: true },
  { id: "skin", name: "皮肤调整", requiresFace: false },
  { id: "reshape", name: "面部重塑", requiresFace: true },
  { id: "eye", name: "眼睛增强", requiresFace: true },
  { id: "teeth", name: "牙齿美化", requiresFace: true },
  { id: "makeup", name: "妆容调整", requiresFace: true },
  { id: "hair", name: "头发调整", requiresFace: true },
  { id: "body", name: "全身美型", requiresFace: false },
];

export interface PortraitParamMeta {
  /** 同时作为 RetouchSettings 的字段名与 shader 宏名后缀 */
  key: string;
  label: string;
  group: PortraitGroupId;
  /** 组内小标题，用于把长列表切成若干段 */
  section?: string;
  min: number;
  max: number;
  /** 开关型参数在 UI 上渲染为 Switch，取值仅 0 / 1 */
  kind?: "slider" | "switch";
  badge?: "new" | "beta";
  help?: string;
  /** 与另一参数联动（法令纹左右），UI 提供锁链按钮 */
  pairWith?: string;
}

/**
 * 表的顺序同时决定 UI 展示顺序与 uniform 打包下标。
 * 下标在每次构建时由本表重新推导，不参与持久化，因此可以自由调整顺序。
 * 全部默认 0，保证未调节的图片渲染结果等同原图，「重置效果」也能真正归零。
 */
export const PORTRAIT_PARAMS = [
  // ---------- 祛除瑕疵：面部祛瑕疵 ----------
  { key: "acne_removal", label: "祛痘", group: "blemish", section: "面部祛瑕疵", min: 0, max: 100 },
  { key: "spot_removal", label: "祛斑", group: "blemish", section: "面部祛瑕疵", min: 0, max: 100 },
  { key: "mole_removal", label: "祛痣", group: "blemish", section: "面部祛瑕疵", min: 0, max: 100 },
  {
    key: "texture_retain", label: "质感保留", group: "blemish", section: "面部祛瑕疵",
    min: 0, max: 100, help: "回补高频细节，避免祛瑕疵后皮肤过于塑料感",
  },
  { key: "shine_removal", label: "祛油光", group: "blemish", section: "面部祛瑕疵", min: 0, max: 100 },
  {
    key: "dark_circle_removal", label: "祛黑眼圈", group: "blemish", section: "面部祛瑕疵",
    min: 0, max: 100, help: "提亮下眼睑并中和青紫色偏",
  },
  { key: "eye_bag_removal", label: "祛眼袋", group: "blemish", section: "面部祛瑕疵", min: 0, max: 100 },
  { key: "nostril_flaw_removal", label: "祛鼻孔瑕疵", group: "blemish", section: "面部祛瑕疵", min: 0, max: 100, badge: "new" },
  { key: "lip_wrinkle_removal", label: "唇纹修整", group: "blemish", section: "面部祛瑕疵", min: 0, max: 100 },
  {
    key: "double_chin_removal", label: "祛双下巴", group: "blemish", section: "面部祛瑕疵",
    min: 0, max: 100, help: "收紧下颌轮廓并淡化颈部投影",
  },
  { key: "double_chin_shadow", label: "双下巴阴影", group: "blemish", section: "面部祛瑕疵", min: 0, max: 100 },
  { key: "jawline_enhance", label: "下颌线增强", group: "blemish", section: "面部祛瑕疵", min: 0, max: 100, badge: "new" },
  {
    key: "beard_removal", label: "祛胡须", group: "blemish", section: "面部祛瑕疵",
    min: 0, max: 100, help: "淡化下半脸胡茬，配合胡型保护可保留原有胡型",
  },
  { key: "neck_wrinkle_removal", label: "祛颈纹", group: "blemish", section: "面部祛瑕疵", min: 0, max: 100 },
  {
    key: "protect_beard", label: "胡型保护", group: "blemish", section: "面部祛瑕疵",
    min: 0, max: 1, kind: "switch", help: "开启后祛瑕疵与磨皮不会侵蚀成形的胡须区域",
  },
  {
    key: "protect_makeup", label: "妆容保护", group: "blemish", section: "面部祛瑕疵",
    min: 0, max: 1, kind: "switch", help: "开启后高饱和的唇妆与腮红不参与祛瑕疵",
  },

  // ---------- 祛除瑕疵：面部祛纹 ----------
  { key: "forehead_wrinkle", label: "祛抬头纹", group: "blemish", section: "面部祛纹", min: 0, max: 100 },
  { key: "frown_wrinkle", label: "祛川字纹", group: "blemish", section: "面部祛纹", min: 0, max: 100 },
  { key: "eye_wrinkle", label: "祛眼周纹", group: "blemish", section: "面部祛纹", min: 0, max: 100 },
  { key: "nose_wrinkle", label: "祛鼻背纹", group: "blemish", section: "面部祛纹", min: 0, max: 100 },
  {
    key: "nasolabial_left", label: "祛法令纹（左）", group: "blemish", section: "面部祛纹",
    min: 0, max: 100, pairWith: "nasolabial_right",
  },
  {
    key: "nasolabial_right", label: "祛法令纹（右）", group: "blemish", section: "面部祛纹",
    min: 0, max: 100, pairWith: "nasolabial_left",
  },
  { key: "cheek_wrinkle", label: "祛脸颊纹", group: "blemish", section: "面部祛纹", min: 0, max: 100 },
  { key: "marionette_wrinkle", label: "祛木偶纹", group: "blemish", section: "面部祛纹", min: 0, max: 100 },
  { key: "mouth_wrinkle", label: "祛嘴周纹", group: "blemish", section: "面部祛纹", min: 0, max: 100 },

  // ---------- 皮肤调整 ----------
  { key: "blur_strength", label: "极细磨皮", group: "skin", min: 0, max: 100 },
  { key: "skin_whiten", label: "皮肤美白", group: "skin", min: 0, max: 100 },
  {
    key: "skin_flatness", label: "皮肤平整度", group: "skin",
    min: 0, max: 100, help: "压制皮肤中频起伏，保留五官边缘",
  },
  {
    key: "neutral_gray_smooth", label: "中性灰磨皮", group: "skin",
    min: 0, max: 100, badge: "new", help: "只修明暗不动色彩的专业磨皮，最大限度保留皮肤纹理",
  },
  { key: "skin_texture", label: "皮肤纹理", group: "skin", min: -100, max: 100 },
  { key: "skin_tone", label: "肤色均匀", group: "skin", min: 0, max: 100 },
  { key: "skin_highlight", label: "皮肤高光", group: "skin", min: -100, max: 100 },
  { key: "yellow_forehead", label: "去泛黄额头", group: "skin", min: 0, max: 100 },
  { key: "dark_nose", label: "去泛黑鼻头", group: "skin", min: 0, max: 100 },
  { key: "facial_noise", label: "去面部杂色", group: "skin", min: 0, max: 100 },

  // ---------- 面部重塑 ----------
  { key: "slim_face", label: "瘦脸", group: "reshape", min: 0, max: 100 },
  { key: "bone_shape", label: "捏骨头型", group: "reshape", min: -100, max: 100 },
  { key: "forehead_width", label: "额头宽度", group: "reshape", min: -100, max: 100 },
  { key: "cheekbone", label: "颧骨收放", group: "reshape", min: -100, max: 100 },
  { key: "mid_bone", label: "中庭收放", group: "reshape", min: -100, max: 100 },
  { key: "chin_width", label: "下巴宽度", group: "reshape", min: -100, max: 100, badge: "new" },
  { key: "chin_crease", label: "下巴纹缩窄", group: "reshape", min: 0, max: 100 },
  { key: "nose_width", label: "鼻子宽度", group: "reshape", min: -100, max: 100, badge: "new" },
  { key: "nose_length", label: "鼻子长度", group: "reshape", min: -100, max: 100, badge: "new" },
  { key: "mouth_width", label: "嘴巴宽度", group: "reshape", min: -100, max: 100, badge: "new" },

  // ---------- 眼睛增强 ----------
  { key: "eye_enlarge", label: "大眼", group: "eye", min: 0, max: 100 },
  { key: "eye_brighten", label: "亮眼", group: "eye", min: 0, max: 100 },
  { key: "tear_trough", label: "卧蚕塑造", group: "eye", min: -100, max: 100 },

  // ---------- 牙齿美化 ----------
  {
    key: "teeth_whiten", label: "牙齿美白", group: "teeth",
    min: 0, max: 100, help: "仅作用于口腔内偏黄的牙面，不影响唇色",
  },

  // ---------- 妆容调整 ----------
  { key: "blush_flat", label: "腮红平整", group: "makeup", min: 0, max: 100 },

  // ---------- 头发调整 ----------
  { key: "hair_volume", label: "发量丰盈", group: "hair", min: -100, max: 100 },

  // ---------- 全身美型 ----------
  {
    key: "body_blemish_removal", label: "身体祛瑕疵", group: "body",
    min: 0, max: 100, help: "对人脸以外的肤色区域做瑕疵抑制",
  },
] as const satisfies readonly PortraitParamMeta[];

export type PortraitParamKey = (typeof PORTRAIT_PARAMS)[number]["key"];

/**
 * 人像参数字段集合，由声明表的 key 直接映射而来并混入 `RetouchSettings`。
 * 用映射类型而非 `Record<string, number>`，这样既不会给 `RetouchSettings`
 * 引入字符串索引签名（否则 `lut_file` 等非 number 字段会冲突），
 * 又保证表里加一个参数，类型上立刻就有对应字段。
 */
export type PortraitSettings = { [K in PortraitParamKey]: number };

export const PORTRAIT_PARAM_KEYS = PORTRAIT_PARAMS.map(
  (param) => param.key,
) as PortraitParamKey[];

export const PORTRAIT_PARAM_MAP = Object.fromEntries(
  PORTRAIT_PARAMS.map((param) => [param.key, param]),
) as Record<PortraitParamKey, PortraitParamMeta>;

export const DEFAULT_PORTRAIT_PARAMS = Object.fromEntries(
  PORTRAIT_PARAMS.map((param) => [param.key, 0]),
) as PortraitSettings;

/** 每个 vec4 装 4 个参数，shader 中按下标寻址 */
export const PORTRAIT_VEC4_COUNT = Math.ceil(PORTRAIT_PARAMS.length / 4);

/**
 * 生成 `#define P_ACNE_REMOVAL u_portrait[0].x` 形式的宏。
 * 下标由本表顺序推导，杜绝手写下标与 TS 侧不一致。
 */
export function buildPortraitDefines(): string {
  return PORTRAIT_PARAM_KEYS
    .map((key, index) => {
      const component = "xyzw"[index % 4];
      return `#define P_${key.toUpperCase()} u_portrait[${Math.floor(index / 4)}].${component}`;
    })
    .join("\n  ");
}

/** 按声明顺序把设置值打包成 Float32Array，供 gl.uniform4fv 上传 */
export function packPortraitParams(
  source: PortraitSettings,
  neutral: boolean,
): Float32Array {
  const packed = new Float32Array(PORTRAIT_VEC4_COUNT * 4);
  if (neutral) return packed;
  PORTRAIT_PARAM_KEYS.forEach((key, index) => {
    const value = source[key];
    packed[index] = typeof value === "number" && Number.isFinite(value) ? value : 0;
  });
  return packed;
}
