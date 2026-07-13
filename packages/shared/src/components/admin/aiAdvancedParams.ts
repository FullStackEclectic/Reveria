export interface AIAdvancedParams {
  image_count?: number;
  vae?: string;
  loras?: { name: string; weight: number }[];
  embeddings?: { name: string; weight: number }[];
  controlnets?: { model: string; weight: number; control_mode?: string }[];
  denoising_strength?: number;
  aspect_ratio?: string;
  width?: number;
  height?: number;
  sampler?: string;
  scheduler?: string;
  steps?: number;
  cfg_scale?: number;
  seed?: number;
  clip_skip?: number;
  ensd?: number;
  detail_enhancement?: boolean;
  negative_prompt?: string;
}
