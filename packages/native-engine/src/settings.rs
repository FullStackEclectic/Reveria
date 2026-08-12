use serde::Deserialize;

pub const IDENTITY_CURVE: [f32; 5] = [0.0, 0.25, 0.5, 0.75, 1.0];

#[derive(Clone, Debug, Deserialize)]
#[serde(default)]
pub struct ExportSettings {
    pub exposure: f32,
    pub contrast: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub whites: f32,
    pub blacks: f32,
    pub saturation: f32,
    pub vibrance: f32,
    pub temperature: f32,
    pub tint: f32,
    pub dehaze: f32,
    pub clarity: f32,
    pub sharpness: f32,
    pub rotation: u8,
    pub flip_horizontal: f32,
    pub flip_vertical: f32,
    pub crop_x: f32,
    pub crop_y: f32,
    pub crop_width: f32,
    pub crop_height: f32,
    pub hsl_red_h: f32,
    pub hsl_red_s: f32,
    pub hsl_red_l: f32,
    pub hsl_orange_h: f32,
    pub hsl_orange_s: f32,
    pub hsl_orange_l: f32,
    pub hsl_yellow_h: f32,
    pub hsl_yellow_s: f32,
    pub hsl_yellow_l: f32,
    pub hsl_green_h: f32,
    pub hsl_green_s: f32,
    pub hsl_green_l: f32,
    pub hsl_aqua_h: f32,
    pub hsl_aqua_s: f32,
    pub hsl_aqua_l: f32,
    pub hsl_blue_h: f32,
    pub hsl_blue_s: f32,
    pub hsl_blue_l: f32,
    pub hsl_purple_h: f32,
    pub hsl_purple_s: f32,
    pub hsl_purple_l: f32,
    pub hsl_magenta_h: f32,
    pub hsl_magenta_s: f32,
    pub hsl_magenta_l: f32,
    pub curve_rgb: [f32; 5],
    pub curve_red: [f32; 5],
    pub curve_green: [f32; 5],
    pub curve_blue: [f32; 5],
    pub shadow_tone_hue: f32,
    pub shadow_tone_saturation: f32,
    pub highlight_tone_hue: f32,
    pub highlight_tone_saturation: f32,
    pub tone_balance: f32,
    pub blur_strength: f32,
    pub neutral_gray_smooth: f32,
    pub skin_texture: f32,
    pub skin_whiten: f32,
    pub skin_highlight: f32,
    pub lut_path: String,
    pub lut_intensity: f32,
    pub output_quality: u8,
}

impl Default for ExportSettings {
    fn default() -> Self {
        Self {
            exposure: 0.0,
            contrast: 0.0,
            highlights: 0.0,
            shadows: 0.0,
            whites: 0.0,
            blacks: 0.0,
            saturation: 0.0,
            vibrance: 0.0,
            temperature: 0.0,
            tint: 0.0,
            dehaze: 0.0,
            clarity: 0.0,
            sharpness: 0.0,
            rotation: 0,
            flip_horizontal: 0.0,
            flip_vertical: 0.0,
            crop_x: 0.0,
            crop_y: 0.0,
            crop_width: 1.0,
            crop_height: 1.0,
            hsl_red_h: 0.0,
            hsl_red_s: 0.0,
            hsl_red_l: 0.0,
            hsl_orange_h: 0.0,
            hsl_orange_s: 0.0,
            hsl_orange_l: 0.0,
            hsl_yellow_h: 0.0,
            hsl_yellow_s: 0.0,
            hsl_yellow_l: 0.0,
            hsl_green_h: 0.0,
            hsl_green_s: 0.0,
            hsl_green_l: 0.0,
            hsl_aqua_h: 0.0,
            hsl_aqua_s: 0.0,
            hsl_aqua_l: 0.0,
            hsl_blue_h: 0.0,
            hsl_blue_s: 0.0,
            hsl_blue_l: 0.0,
            hsl_purple_h: 0.0,
            hsl_purple_s: 0.0,
            hsl_purple_l: 0.0,
            hsl_magenta_h: 0.0,
            hsl_magenta_s: 0.0,
            hsl_magenta_l: 0.0,
            curve_rgb: IDENTITY_CURVE,
            curve_red: IDENTITY_CURVE,
            curve_green: IDENTITY_CURVE,
            curve_blue: IDENTITY_CURVE,
            shadow_tone_hue: 220.0,
            shadow_tone_saturation: 0.0,
            highlight_tone_hue: 40.0,
            highlight_tone_saturation: 0.0,
            tone_balance: 0.0,
            blur_strength: 0.0,
            neutral_gray_smooth: 0.0,
            skin_texture: 0.0,
            skin_whiten: 0.0,
            skin_highlight: 0.0,
            lut_path: String::new(),
            lut_intensity: 100.0,
            output_quality: 95,
        }
    }
}

impl ExportSettings {
    pub fn normalize(&mut self) {
        macro_rules! clamp100 {
            ($($field:ident),+ $(,)?) => {
                $(self.$field = finite_or(self.$field, 0.0).clamp(-100.0, 100.0);)+
            };
        }
        clamp100!(
            exposure,
            contrast,
            highlights,
            shadows,
            whites,
            blacks,
            saturation,
            vibrance,
            temperature,
            tint,
            clarity,
            hsl_red_h,
            hsl_red_s,
            hsl_red_l,
            hsl_orange_h,
            hsl_orange_s,
            hsl_orange_l,
            hsl_yellow_h,
            hsl_yellow_s,
            hsl_yellow_l,
            hsl_green_h,
            hsl_green_s,
            hsl_green_l,
            hsl_aqua_h,
            hsl_aqua_s,
            hsl_aqua_l,
            hsl_blue_h,
            hsl_blue_s,
            hsl_blue_l,
            hsl_purple_h,
            hsl_purple_s,
            hsl_purple_l,
            hsl_magenta_h,
            hsl_magenta_s,
            hsl_magenta_l,
            tone_balance,
            skin_texture,
            skin_highlight,
        );
        self.dehaze = finite_or(self.dehaze, 0.0).clamp(0.0, 100.0);
        self.sharpness = finite_or(self.sharpness, 0.0).clamp(0.0, 100.0);
        self.blur_strength = finite_or(self.blur_strength, 0.0).clamp(0.0, 100.0);
        self.neutral_gray_smooth = finite_or(self.neutral_gray_smooth, 0.0).clamp(0.0, 100.0);
        self.skin_whiten = finite_or(self.skin_whiten, 0.0).clamp(0.0, 100.0);
        self.shadow_tone_hue = finite_or(self.shadow_tone_hue, 220.0).rem_euclid(360.0);
        self.highlight_tone_hue = finite_or(self.highlight_tone_hue, 40.0).rem_euclid(360.0);
        self.shadow_tone_saturation = finite_or(self.shadow_tone_saturation, 0.0).clamp(0.0, 100.0);
        self.highlight_tone_saturation =
            finite_or(self.highlight_tone_saturation, 0.0).clamp(0.0, 100.0);
        self.crop_x = finite_or(self.crop_x, 0.0).clamp(0.0, 1.0);
        self.crop_y = finite_or(self.crop_y, 0.0).clamp(0.0, 1.0);
        self.crop_width = finite_or(self.crop_width, 1.0).clamp(0.001, 1.0 - self.crop_x);
        self.crop_height = finite_or(self.crop_height, 1.0).clamp(0.001, 1.0 - self.crop_y);
        self.rotation %= 4;
        self.lut_intensity = finite_or(self.lut_intensity, 100.0).clamp(0.0, 100.0);
        self.output_quality = self.output_quality.clamp(1, 100);
        normalize_curve(&mut self.curve_rgb);
        normalize_curve(&mut self.curve_red);
        normalize_curve(&mut self.curve_green);
        normalize_curve(&mut self.curve_blue);
    }
}

fn finite_or(value: f32, fallback: f32) -> f32 {
    if value.is_finite() {
        value
    } else {
        fallback
    }
}

fn normalize_curve(curve: &mut [f32; 5]) {
    for point in curve {
        *point = finite_or(*point, 0.0).clamp(0.0, 1.0);
    }
}
