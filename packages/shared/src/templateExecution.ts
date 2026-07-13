import {
  PromptTemplate,
  TemplateExecutionConfig,
  TemplateScene,
} from "./types";

export const DEFAULT_PRODUCT_SCENES: TemplateScene[] = [
  { id: "product-main", title: "产品主图", prompt: "以精美的产品特写展示卖点与工艺品质" },
  { id: "product-wearing", title: "模特佩戴图", prompt: "由单个模特佩戴，展示实际佩戴效果与时尚氛围" },
  { id: "product-detail", title: "产品细节图", prompt: "近距离展示产品的精细纹路、材质工艺与细节" },
  { id: "product-white", title: "产品白底图", prompt: "在纯白背景上展示产品的真实结构与本色" },
  { id: "product-selling-point", title: "材质卖点图", prompt: "突出材质、工艺和核心卖点，体现精致做工" },
  { id: "product-gift", title: "礼物氛围图", prompt: "在精美礼品包装场景中展示产品与送礼氛围" },
];

export function createTemplateScene(index: number): TemplateScene {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `scene-${Date.now()}-${index}`;
  return { id, title: `场景 ${index}`, prompt: "" };
}

export function parseTemplateExecutionConfig(template: Partial<PromptTemplate>): TemplateExecutionConfig {
  if (template.execution_config) {
    try {
      const parsed = JSON.parse(template.execution_config) as Partial<TemplateExecutionConfig>;
      const scenes = Array.isArray(parsed.scenes)
        ? parsed.scenes
            .filter((scene): scene is TemplateScene => !!scene && typeof scene.title === "string" && typeof scene.prompt === "string")
            .map((scene, index) => ({ ...scene, id: scene.id || `scene-${index + 1}` }))
        : [];
      return {
        version: 1,
        operation: parsed.operation || ((template.need_image ?? 0) > 0 ? "image-to-image" : "text-to-image"),
        output_mode: parsed.output_mode || "single",
        reference_mode: parsed.reference_mode || ((template.need_image ?? 0) > 0 ? "required" : "none"),
        max_outputs: Math.max(1, Math.min(parsed.max_outputs || 12, 16)),
        scenes,
      };
    } catch {
      // 旧数据会继续走下方的兼容规则。
    }
  }

  let legacyImageCount = 1;
  try {
    if (template.advanced_params) {
      const advanced = JSON.parse(template.advanced_params) as { image_count?: number };
      legacyImageCount = advanced.image_count || 1;
    }
  } catch {
    legacyImageCount = 1;
  }

  const isLegacySceneTemplate = template.title?.includes("多图") === true;
  return {
    version: 1,
    operation: (template.need_image ?? 0) > 0 ? "image-to-image" : "text-to-image",
    output_mode: isLegacySceneTemplate ? "scenes" : legacyImageCount > 1 ? "variants" : "single",
    reference_mode: (template.need_image ?? 0) > 0 ? "required" : "none",
    max_outputs: 12,
    scenes: isLegacySceneTemplate ? DEFAULT_PRODUCT_SCENES.map((scene) => ({ ...scene })) : [],
  };
}

export function serializeTemplateExecutionConfig(config: TemplateExecutionConfig): string {
  return JSON.stringify({
    ...config,
    version: 1,
    max_outputs: Math.max(1, Math.min(config.max_outputs, 16)),
    scenes: config.output_mode === "scenes" ? config.scenes : [],
  });
}
