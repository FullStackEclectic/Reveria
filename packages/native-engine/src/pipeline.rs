use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

use image::codecs::jpeg::JpegEncoder;
use image::{imageops, ColorType, ImageFormat, RgbaImage};
use rayon::prelude::*;

use crate::color::{apply_color_pipeline, clamp01, luma, mix, skin_mask, smoothstep, Rgb};
use crate::lut::CubeLut;
use crate::settings::ExportSettings;

pub fn process_and_save_image(
    input_path: &Path,
    output_path: &Path,
    settings: &ExportSettings,
) -> Result<(), String> {
    if !input_path.is_file() {
        return Err(format!("输入文件不存在：{}", input_path.display()));
    }
    let source = image::open(input_path)
        .map_err(|error| format!("图片解码失败：{error}"))?
        .to_rgba8();
    let lut = if settings.lut_path.trim().is_empty() || settings.lut_intensity <= 0.0 {
        None
    } else {
        Some(CubeLut::load(Path::new(settings.lut_path.trim()))?)
    };
    let processed = process_image(&source, settings, lut.as_ref());
    let transformed = apply_geometry(processed, settings);
    save_image(&transformed, output_path, settings.output_quality)
}

pub fn process_image(
    source: &RgbaImage,
    settings: &ExportSettings,
    lut: Option<&CubeLut>,
) -> RgbaImage {
    let detailed = apply_spatial_pipeline(source, settings);
    let mut output = detailed.clone();
    output.par_chunks_mut(4).for_each(|pixel| {
        let mut rgb = [
            pixel[0] as f32 / 255.0,
            pixel[1] as f32 / 255.0,
            pixel[2] as f32 / 255.0,
        ];
        rgb = apply_color_pipeline(rgb, settings);
        if let Some(cube) = lut {
            rgb = cube.apply(rgb, settings.lut_intensity * 0.01);
        }
        pixel[0] = to_u8(rgb[0]);
        pixel[1] = to_u8(rgb[1]);
        pixel[2] = to_u8(rgb[2]);
    });
    output
}

fn apply_spatial_pipeline(source: &RgbaImage, settings: &ExportSettings) -> RgbaImage {
    let width = source.width() as usize;
    let height = source.height() as usize;
    let source_bytes = source.as_raw();
    let mut output = source.clone();
    let smoothing_enabled = settings.blur_strength > 0.001 || settings.neutral_gray_smooth > 0.001;
    let detail_enabled = settings.clarity.abs() > 0.001
        || settings.sharpness > 0.001
        || settings.skin_texture.abs() > 0.001;
    if !smoothing_enabled
        && !detail_enabled
        && settings.skin_whiten <= 0.001
        && settings.skin_highlight.abs() <= 0.001
    {
        return output;
    }

    output
        .par_chunks_mut(4)
        .enumerate()
        .for_each(|(index, pixel)| {
            let x = index % width;
            let y = index / width;
            let original = rgb_at(source_bytes, width, x, y);
            let skin = skin_mask(original);
            let mut rgb = original;
            let local = if smoothing_enabled {
                bilateral_at(source_bytes, width, height, x, y, 2, original)
            } else {
                original
            };
            if settings.blur_strength > 0.001 {
                rgb = mix(rgb, local, skin * settings.blur_strength * 0.01);
            }
            if settings.neutral_gray_smooth > 0.001 {
                let delta = luma(local) - luma(rgb);
                let amount = skin * settings.neutral_gray_smooth * 0.01;
                for channel in &mut rgb {
                    *channel += delta * amount;
                }
            }

            if detail_enabled {
                let soft = box_blur_at(source_bytes, width, height, x, y, 1);
                for channel in 0..3 {
                    let high_frequency = original[channel] - soft[channel];
                    rgb[channel] += high_frequency * settings.sharpness * 0.04;
                    rgb[channel] += high_frequency * settings.clarity * 0.5;
                    rgb[channel] += high_frequency * settings.skin_texture * 0.012 * skin;
                }
            }
            if settings.skin_whiten > 0.001 {
                let delta = settings.skin_whiten * 0.0015 * skin;
                for channel in &mut rgb {
                    *channel += delta;
                }
            }
            if settings.skin_highlight.abs() > 0.001 {
                let highlight = smoothstep(0.55, 0.92, luma(rgb));
                let delta = settings.skin_highlight * 0.0016 * highlight * skin;
                for channel in &mut rgb {
                    *channel += delta;
                }
            }
            pixel[0] = to_u8(rgb[0]);
            pixel[1] = to_u8(rgb[1]);
            pixel[2] = to_u8(rgb[2]);
        });
    output
}

fn bilateral_at(
    bytes: &[u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    radius: isize,
    center: Rgb,
) -> Rgb {
    let mut sum = [0.0; 3];
    let mut total = 0.0;
    for offset_y in -radius..=radius {
        for offset_x in -radius..=radius {
            let sample_x = (x as isize + offset_x).clamp(0, width as isize - 1) as usize;
            let sample_y = (y as isize + offset_y).clamp(0, height as isize - 1) as usize;
            let sample = rgb_at(bytes, width, sample_x, sample_y);
            let spatial_distance = (offset_x * offset_x + offset_y * offset_y) as f32;
            let color_distance = (sample[0] - center[0]).powi(2)
                + (sample[1] - center[1]).powi(2)
                + (sample[2] - center[2]).powi(2);
            let weight = (-spatial_distance / 8.0).exp() * (-color_distance * 15.0).exp();
            for channel in 0..3 {
                sum[channel] += sample[channel] * weight;
            }
            total += weight;
        }
    }
    if total <= f32::EPSILON {
        center
    } else {
        sum.map(|value| value / total)
    }
}

fn box_blur_at(
    bytes: &[u8],
    width: usize,
    height: usize,
    x: usize,
    y: usize,
    radius: isize,
) -> Rgb {
    let mut sum = [0.0; 3];
    let mut count = 0.0;
    for offset_y in -radius..=radius {
        for offset_x in -radius..=radius {
            let sample_x = (x as isize + offset_x).clamp(0, width as isize - 1) as usize;
            let sample_y = (y as isize + offset_y).clamp(0, height as isize - 1) as usize;
            let sample = rgb_at(bytes, width, sample_x, sample_y);
            for channel in 0..3 {
                sum[channel] += sample[channel];
            }
            count += 1.0;
        }
    }
    sum.map(|value| value / count)
}

fn rgb_at(bytes: &[u8], width: usize, x: usize, y: usize) -> Rgb {
    let offset = (y * width + x) * 4;
    [
        bytes[offset] as f32 / 255.0,
        bytes[offset + 1] as f32 / 255.0,
        bytes[offset + 2] as f32 / 255.0,
    ]
}

fn apply_geometry(mut image: RgbaImage, settings: &ExportSettings) -> RgbaImage {
    image = match settings.rotation % 4 {
        1 => imageops::rotate90(&image),
        2 => imageops::rotate180(&image),
        3 => imageops::rotate270(&image),
        _ => image,
    };
    if settings.flip_horizontal > 0.5 {
        image = imageops::flip_horizontal(&image);
    }
    if settings.flip_vertical > 0.5 {
        image = imageops::flip_vertical(&image);
    }
    let width = image.width();
    let height = image.height();
    let x = ((settings.crop_x * width as f32).round() as u32).min(width.saturating_sub(1));
    let y = ((settings.crop_y * height as f32).round() as u32).min(height.saturating_sub(1));
    let crop_width = ((settings.crop_width * width as f32).round() as u32).clamp(1, width - x);
    let crop_height = ((settings.crop_height * height as f32).round() as u32).clamp(1, height - y);
    imageops::crop_imm(&image, x, y, crop_width, crop_height).to_image()
}

fn save_image(image: &RgbaImage, output_path: &Path, quality: u8) -> Result<(), String> {
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("创建输出目录失败：{error}"))?;
    }
    let format = ImageFormat::from_path(output_path)
        .map_err(|_| "输出格式仅支持 JPEG、PNG 和 WebP".to_string())?;
    if format == ImageFormat::Jpeg {
        let file =
            File::create(output_path).map_err(|error| format!("创建输出文件失败：{error}"))?;
        let mut encoder = JpegEncoder::new_with_quality(BufWriter::new(file), quality);
        let rgb = image::DynamicImage::ImageRgba8(image.clone()).to_rgb8();
        encoder
            .encode(
                rgb.as_raw(),
                rgb.width(),
                rgb.height(),
                ColorType::Rgb8.into(),
            )
            .map_err(|error| format!("JPEG 编码失败：{error}"))
    } else {
        image::DynamicImage::ImageRgba8(image.clone())
            .save_with_format(output_path, format)
            .map_err(|error| format!("图片编码失败：{error}"))
    }
}

fn to_u8(value: f32) -> u8 {
    (clamp01(value) * 255.0).round() as u8
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    #[test]
    fn processing_changes_pixels_instead_of_copying_input() {
        let source = RgbaImage::from_pixel(8, 8, Rgba([120, 80, 60, 255]));
        let settings = ExportSettings {
            exposure: 20.0,
            saturation: 15.0,
            ..Default::default()
        };
        let output = process_image(&source, &settings, None);
        assert_ne!(source.get_pixel(0, 0), output.get_pixel(0, 0));
        assert_eq!(output.get_pixel(0, 0)[3], 255);
    }

    #[test]
    fn skin_smoothing_reduces_local_difference() {
        let mut source = RgbaImage::from_pixel(7, 7, Rgba([190, 135, 110, 255]));
        source.put_pixel(3, 3, Rgba([215, 105, 95, 255]));
        let before = source.get_pixel(3, 3)[1].abs_diff(source.get_pixel(3, 2)[1]);
        let settings = ExportSettings {
            blur_strength: 100.0,
            ..Default::default()
        };
        let output = process_image(&source, &settings, None);
        let after = output.get_pixel(3, 3)[1].abs_diff(output.get_pixel(3, 2)[1]);
        assert!(
            after < before,
            "磨皮后局部色差应降低：before={before}, after={after}"
        );
    }

    #[test]
    fn geometry_rotates_and_crops_output() {
        let source = RgbaImage::from_pixel(10, 6, Rgba([10, 20, 30, 255]));
        let settings = ExportSettings {
            rotation: 1,
            crop_width: 0.5,
            crop_height: 0.5,
            ..Default::default()
        };
        let output = apply_geometry(source, &settings);
        assert_eq!(output.dimensions(), (3, 5));
    }
}
