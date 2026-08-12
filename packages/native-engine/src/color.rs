use crate::settings::ExportSettings;

pub type Rgb = [f32; 3];

pub fn clamp01(value: f32) -> f32 {
    value.clamp(0.0, 1.0)
}

pub fn luma(color: Rgb) -> f32 {
    color[0] * 0.299 + color[1] * 0.587 + color[2] * 0.114
}

pub fn smoothstep(edge0: f32, edge1: f32, value: f32) -> f32 {
    if (edge1 - edge0).abs() < f32::EPSILON {
        return if value < edge0 { 0.0 } else { 1.0 };
    }
    let t = ((value - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

pub fn mix(a: Rgb, b: Rgb, amount: f32) -> Rgb {
    let t = amount.clamp(0.0, 1.0);
    [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
    ]
}

pub fn skin_mask(color: Rgb) -> f32 {
    let y = luma(color);
    let cb = -0.168_736 * color[0] - 0.331_264 * color[1] + 0.5 * color[2] + 0.5;
    let cr = 0.5 * color[0] - 0.418_688 * color[1] - 0.081_312 * color[2] + 0.5;
    let mut mask = smoothstep(0.27, 0.33, cb) * (1.0 - smoothstep(0.47, 0.53, cb));
    mask *= smoothstep(0.49, 0.53, cr) * (1.0 - smoothstep(0.65, 0.70, cr));
    mask *= smoothstep(0.12, 0.26, y) * (1.0 - smoothstep(0.93, 1.0, y));
    mask.clamp(0.0, 1.0)
}

pub fn apply_color_pipeline(mut rgb: Rgb, settings: &ExportSettings) -> Rgb {
    let original_luma = luma(rgb);
    let exposure = 1.0 + settings.exposure * 0.01;
    for channel in &mut rgb {
        *channel *= exposure;
    }

    let highlight_mask = smoothstep(0.5, 1.0, original_luma);
    let shadow_mask = 1.0 - smoothstep(0.0, 0.5, original_luma);
    let white_mask = smoothstep(0.8, 1.0, original_luma);
    let black_mask = 1.0 - smoothstep(0.0, 0.2, original_luma);
    let level_delta = settings.highlights * 0.003 * highlight_mask
        + settings.shadows * 0.003 * shadow_mask
        + settings.whites * 0.002 * white_mask
        + settings.blacks * 0.002 * black_mask;
    for channel in &mut rgb {
        *channel += level_delta;
        *channel = (*channel - 0.5) * (1.0 + settings.contrast * 0.01) + 0.5;
    }

    rgb[0] += settings.temperature * 0.0008 - settings.tint * 0.0002;
    rgb[1] += settings.tint * 0.0004;
    rgb[2] -= settings.temperature * 0.0008 + settings.tint * 0.0002;
    rgb = adjust_saturation(rgb, 1.0 + settings.saturation * 0.01);

    if settings.vibrance.abs() > 0.001 {
        let gray = luma(rgb);
        let current_saturation =
            ((rgb[0] - gray).powi(2) + (rgb[1] - gray).powi(2) + (rgb[2] - gray).powi(2)).sqrt();
        rgb = adjust_saturation(
            rgb,
            1.0 + settings.vibrance * 0.01 * (1.0 - current_saturation * 1.5),
        );
    }
    if settings.dehaze > 0.001 {
        for channel in &mut rgb {
            *channel = (*channel - 0.5) * (1.0 + settings.dehaze * 0.005) + 0.5;
        }
        rgb = adjust_saturation(rgb, 1.0 + settings.dehaze * 0.003);
    }

    let mut hsl = rgb_to_hsl(rgb.map(clamp01));
    apply_hsl_channel(
        &mut hsl,
        0.0,
        0.05,
        settings.hsl_red_h,
        settings.hsl_red_s,
        settings.hsl_red_l,
    );
    apply_hsl_channel(
        &mut hsl,
        0.069,
        0.027,
        settings.hsl_orange_h,
        settings.hsl_orange_s,
        settings.hsl_orange_l,
    );
    apply_hsl_channel(
        &mut hsl,
        0.132,
        0.035,
        settings.hsl_yellow_h,
        settings.hsl_yellow_s,
        settings.hsl_yellow_l,
    );
    apply_hsl_channel(
        &mut hsl,
        0.271,
        0.1,
        settings.hsl_green_h,
        settings.hsl_green_s,
        settings.hsl_green_l,
    );
    apply_hsl_channel(
        &mut hsl,
        0.438,
        0.062,
        settings.hsl_aqua_h,
        settings.hsl_aqua_s,
        settings.hsl_aqua_l,
    );
    apply_hsl_channel(
        &mut hsl,
        0.583,
        0.083,
        settings.hsl_blue_h,
        settings.hsl_blue_s,
        settings.hsl_blue_l,
    );
    apply_hsl_channel(
        &mut hsl,
        0.729,
        0.062,
        settings.hsl_purple_h,
        settings.hsl_purple_s,
        settings.hsl_purple_l,
    );
    apply_hsl_channel(
        &mut hsl,
        0.875,
        0.083,
        settings.hsl_magenta_h,
        settings.hsl_magenta_s,
        settings.hsl_magenta_l,
    );
    hsl[0] = hsl[0].rem_euclid(1.0);
    rgb = hsl_to_rgb(hsl);

    let midpoint = 0.5 - settings.tone_balance * 0.0025;
    let tone_luma = luma(rgb);
    let shadow_mask = 1.0 - smoothstep(midpoint - 0.25, midpoint + 0.15, tone_luma);
    let highlight_mask = smoothstep(midpoint - 0.15, midpoint + 0.25, tone_luma);
    let shadow_color = hsl_to_rgb([settings.shadow_tone_hue / 360.0, 1.0, 0.5]);
    let highlight_color = hsl_to_rgb([settings.highlight_tone_hue / 360.0, 1.0, 0.5]);
    let shadow_luma = luma(shadow_color);
    let highlight_luma = luma(highlight_color);
    for index in 0..3 {
        rgb[index] += (shadow_color[index] - shadow_luma)
            * settings.shadow_tone_saturation
            * 0.0035
            * shadow_mask;
        rgb[index] += (highlight_color[index] - highlight_luma)
            * settings.highlight_tone_saturation
            * 0.0035
            * highlight_mask;
        rgb[index] = apply_curve(rgb[index], &settings.curve_rgb);
    }
    rgb[0] = apply_curve(rgb[0], &settings.curve_red);
    rgb[1] = apply_curve(rgb[1], &settings.curve_green);
    rgb[2] = apply_curve(rgb[2], &settings.curve_blue);
    rgb.map(clamp01)
}

fn adjust_saturation(color: Rgb, amount: f32) -> Rgb {
    let gray = luma(color);
    [
        gray + (color[0] - gray) * amount,
        gray + (color[1] - gray) * amount,
        gray + (color[2] - gray) * amount,
    ]
}

fn apply_curve(value: f32, curve: &[f32; 5]) -> f32 {
    let scaled = clamp01(value) * 4.0;
    let index = scaled.floor().min(3.0) as usize;
    let fraction = scaled - index as f32;
    curve[index] + (curve[index + 1] - curve[index]) * fraction
}

fn apply_hsl_channel(hsl: &mut Rgb, center: f32, half_width: f32, dh: f32, ds: f32, dl: f32) {
    let direct_distance = (hsl[0] - center).abs();
    let distance = direct_distance.min(1.0 - direct_distance);
    let weight = (1.0 - smoothstep(0.0, half_width, distance)) * smoothstep(0.05, 0.15, hsl[1]);
    if weight > 0.001 {
        hsl[0] += dh * 0.005 * weight;
        hsl[1] = (hsl[1] * (1.0 + ds * 0.01 * weight)).clamp(0.0, 1.0);
        hsl[2] = (hsl[2] + dl * 0.003 * weight).clamp(0.0, 1.0);
    }
}

pub fn rgb_to_hsl(color: Rgb) -> Rgb {
    let max = color[0].max(color[1]).max(color[2]);
    let min = color[0].min(color[1]).min(color[2]);
    let lightness = (max + min) * 0.5;
    let delta = max - min;
    if delta <= 0.0001 {
        return [0.0, 0.0, lightness];
    }
    let saturation = if lightness > 0.5 {
        delta / (2.0 - max - min)
    } else {
        delta / (max + min)
    };
    let hue = if max == color[0] {
        ((color[1] - color[2]) / delta + if color[1] < color[2] { 6.0 } else { 0.0 }) / 6.0
    } else if max == color[1] {
        ((color[2] - color[0]) / delta + 2.0) / 6.0
    } else {
        ((color[0] - color[1]) / delta + 4.0) / 6.0
    };
    [hue, saturation, lightness]
}

pub fn hsl_to_rgb(hsl: Rgb) -> Rgb {
    if hsl[1] < 0.0001 {
        return [hsl[2]; 3];
    }
    let q = if hsl[2] < 0.5 {
        hsl[2] * (1.0 + hsl[1])
    } else {
        hsl[2] + hsl[1] - hsl[2] * hsl[1]
    };
    let p = 2.0 * hsl[2] - q;
    [
        hue_to_rgb(p, q, hsl[0] + 1.0 / 3.0),
        hue_to_rgb(p, q, hsl[0]),
        hue_to_rgb(p, q, hsl[0] - 1.0 / 3.0),
    ]
}

fn hue_to_rgb(p: f32, q: f32, mut t: f32) -> f32 {
    if t < 0.0 {
        t += 1.0;
    }
    if t > 1.0 {
        t -= 1.0;
    }
    if t < 1.0 / 6.0 {
        return p + (q - p) * 6.0 * t;
    }
    if t < 0.5 {
        return q;
    }
    if t < 2.0 / 3.0 {
        return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    }
    p
}
