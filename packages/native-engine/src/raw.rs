use std::fs::File;
use std::io::{Cursor, Read};
use std::path::Path;

use image::codecs::jpeg::JpegEncoder;
use image::{imageops, ColorType, RgbaImage};
use rawloader::{Orientation, RawImage, RawImageData};
use rayon::prelude::*;

use crate::color::clamp01;

const XYZ_TO_SRGB: [[f32; 3]; 3] = [
    [3.240_454_2, -1.537_138_5, -0.498_531_4],
    [-0.969_266_0, 1.876_010_8, 0.041_556_0],
    [0.055_643_4, -0.204_025_9, 1.057_225_2],
];

pub fn convert_raw_to_jpeg(input_path: &Path, output_path: &Path) -> Result<(), String> {
    let mut file = File::open(input_path).map_err(|error| format!("打开 RAW 失败：{error}"))?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes)
        .map_err(|error| format!("读取 RAW 失败：{error}"))?;
    let jpeg = convert_raw_bytes_to_jpeg(&bytes)?;
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("创建输出目录失败：{error}"))?;
    }
    std::fs::write(output_path, jpeg).map_err(|error| format!("写入 JPEG 失败：{error}"))
}

pub fn convert_raw_bytes_to_jpeg(bytes: &[u8]) -> Result<Vec<u8>, String> {
    match develop_raw_bytes(bytes) {
        Ok(image) => encode_jpeg(&image),
        Err(demosaic_error) => extract_largest_jpeg(bytes).ok_or(demosaic_error),
    }
}

fn develop_raw_bytes(bytes: &[u8]) -> Result<RgbaImage, String> {
    let image = rawloader::decode(&mut Cursor::new(bytes))
        .map_err(|error| format!("RAW 解码失败：{error}"))?;
    develop_raw_image(image)
}

fn develop_raw_image(raw: RawImage) -> Result<RgbaImage, String> {
    let width = raw.width;
    let height = raw.height;
    if width < 2 || height < 2 {
        return Err("RAW 画面尺寸无效".to_string());
    }
    let linear = linearize_raw(&raw)?;
    let rgb = if raw.cpp >= 3 || raw.is_monochrome() {
        packed_to_rgb(&linear, width, height, raw.cpp)
    } else {
        demosaic_bilinear(&linear, width, height, &raw.cfa)
    };
    let developed = apply_color(&rgb, width, height, &raw);
    let cropped = crop_rgb(&developed, width, height, raw.crops);
    Ok(apply_orientation(cropped, raw.orientation))
}

fn linearize_raw(raw: &RawImage) -> Result<Vec<f32>, String> {
    let count = raw.width * raw.height * raw.cpp.max(1);
    match &raw.data {
        RawImageData::Integer(data) => {
            if data.len() < count {
                return Err("RAW 像素数据不完整".to_string());
            }
            Ok(data[..count]
                .iter()
                .enumerate()
                .map(|(index, value)| {
                    let channel = index % raw.cpp.max(1);
                    scale_sample(*value as f32, raw, channel)
                })
                .collect())
        }
        RawImageData::Float(data) => {
            if data.len() < count {
                return Err("RAW 像素数据不完整".to_string());
            }
            Ok(data[..count]
                .iter()
                .enumerate()
                .map(|(index, value)| {
                    let channel = index % raw.cpp.max(1);
                    scale_sample(*value, raw, channel)
                })
                .collect())
        }
    }
}

fn scale_sample(value: f32, raw: &RawImage, channel: usize) -> f32 {
    let channel = channel.min(3);
    let black = raw.blacklevels[channel] as f32;
    let white = (raw.whitelevels[channel] as f32).max(black + 1.0);
    ((value - black) / (white - black)).clamp(0.0, 1.0)
}

fn packed_to_rgb(linear: &[f32], width: usize, height: usize, cpp: usize) -> Vec<f32> {
    let mut rgb = vec![0.0; width * height * 3];
    for index in 0..width * height {
        if cpp >= 3 {
            rgb[index * 3] = linear[index * cpp];
            rgb[index * 3 + 1] = linear[index * cpp + 1];
            rgb[index * 3 + 2] = linear[index * cpp + 2];
        } else {
            let value = linear[index];
            rgb[index * 3] = value;
            rgb[index * 3 + 1] = value;
            rgb[index * 3 + 2] = value;
        }
    }
    rgb
}

fn demosaic_bilinear(linear: &[f32], width: usize, height: usize, cfa: &rawloader::CFA) -> Vec<f32> {
    let radius = if cfa.width > 2 || cfa.height > 2 { 2isize } else { 1isize };
    let mut rgb = vec![0.0; width * height * 3];
    rgb.par_chunks_mut(3)
        .enumerate()
        .for_each(|(index, pixel)| {
            let x = index % width;
            let y = index / width;
            let native = cfa.color_at(y, x);
            for channel in 0..3 {
                if native == channel || (channel == 1 && native == 3) {
                    pixel[channel] = linear[index];
                    continue;
                }
                let mut sum = 0.0;
                let mut count = 0.0;
                for dy in -radius..=radius {
                    for dx in -radius..=radius {
                        if dx == 0 && dy == 0 {
                            continue;
                        }
                        let nx = x as isize + dx;
                        let ny = y as isize + dy;
                        if nx < 0 || ny < 0 || nx >= width as isize || ny >= height as isize {
                            continue;
                        }
                        let neighbor = cfa.color_at(ny as usize, nx as usize);
                        if neighbor == channel || (channel == 1 && neighbor == 3) {
                            sum += linear[ny as usize * width + nx as usize];
                            count += 1.0;
                        }
                    }
                }
                pixel[channel] = if count > 0.0 { sum / count } else { linear[index] };
            }
        });
    rgb
}

fn apply_color(rgb: &[f32], width: usize, height: usize, raw: &RawImage) -> Vec<f32> {
    let mut wb = raw.wb_coeffs;
    if !wb[0].is_finite() || wb[0] <= 0.0 || !wb[1].is_finite() || wb[1] <= 0.0 {
        wb = raw.neutralwb();
    }
    for coeff in &mut wb {
        if !coeff.is_finite() || *coeff <= 0.0 {
            *coeff = 1.0;
        }
    }
    let cam_to_xyz = raw.cam_to_xyz_normalized();
    let mut output = vec![0.0; width * height * 3];
    output.par_chunks_mut(3).enumerate().for_each(|(index, pixel)| {
        let mut camera = [
            rgb[index * 3] * wb[0],
            rgb[index * 3 + 1] * wb[1],
            rgb[index * 3 + 2] * wb[2],
        ];
        for channel in &mut camera {
            *channel = (*channel).max(0.0);
        }
        let mut xyz = [0.0; 3];
        for row in 0..3 {
            xyz[row] = cam_to_xyz[row][0] * camera[0]
                + cam_to_xyz[row][1] * camera[1]
                + cam_to_xyz[row][2] * camera[2]
                + cam_to_xyz[row][3] * camera[1];
        }
        for row in 0..3 {
            let linear = (XYZ_TO_SRGB[row][0] * xyz[0]
                + XYZ_TO_SRGB[row][1] * xyz[1]
                + XYZ_TO_SRGB[row][2] * xyz[2])
                .max(0.0);
            pixel[row] = srgb_gamma(linear);
        }
    });
    output
}

fn srgb_gamma(value: f32) -> f32 {
    if value <= 0.003_130_8 {
        12.92 * value
    } else {
        1.055 * value.powf(1.0 / 2.4) - 0.055
    }
}

fn crop_rgb(rgb: &[f32], width: usize, height: usize, crops: [usize; 4]) -> RgbaImage {
    let top = crops[0].min(height.saturating_sub(1));
    let right = crops[1].min(width);
    let bottom = crops[2].min(height);
    let left = crops[3].min(width.saturating_sub(1));
    let crop_width = width.saturating_sub(left + right).max(1);
    let crop_height = height.saturating_sub(top + bottom).max(1);
    let mut image = RgbaImage::new(crop_width as u32, crop_height as u32);
    for y in 0..crop_height {
        for x in 0..crop_width {
            let source = ((y + top) * width + (x + left)) * 3;
            image.put_pixel(
                x as u32,
                y as u32,
                image::Rgba([
                    to_u8(rgb[source]),
                    to_u8(rgb[source + 1]),
                    to_u8(rgb[source + 2]),
                    255,
                ]),
            );
        }
    }
    image
}

fn apply_orientation(image: RgbaImage, orientation: Orientation) -> RgbaImage {
    match orientation {
        Orientation::Rotate90 => imageops::rotate90(&image),
        Orientation::Rotate180 => imageops::rotate180(&image),
        Orientation::Rotate270 => imageops::rotate270(&image),
        Orientation::HorizontalFlip => imageops::flip_horizontal(&image),
        Orientation::VerticalFlip => imageops::flip_vertical(&image),
        Orientation::Transpose => imageops::flip_horizontal(&imageops::rotate90(&image)),
        Orientation::Transverse => imageops::flip_horizontal(&imageops::rotate270(&image)),
        _ => image,
    }
}

fn encode_jpeg(image: &RgbaImage) -> Result<Vec<u8>, String> {
    let mut buffer = Vec::new();
    let rgb = image::DynamicImage::ImageRgba8(image.clone()).to_rgb8();
    JpegEncoder::new_with_quality(&mut buffer, 92)
        .encode(rgb.as_raw(), rgb.width(), rgb.height(), ColorType::Rgb8.into())
        .map_err(|error| format!("JPEG 编码失败：{error}"))?;
    Ok(buffer)
}

pub fn extract_largest_jpeg(bytes: &[u8]) -> Option<Vec<u8>> {
    let mut best: Option<&[u8]> = None;
    let mut index = 0;
    while index + 1 < bytes.len() {
        if bytes[index] != 0xff || bytes[index + 1] != 0xd8 {
            index += 1;
            continue;
        }
        let mut end = index + 2;
        while end + 1 < bytes.len() {
            if bytes[end] == 0xff && bytes[end + 1] == 0xd9 {
                let slice = &bytes[index..end + 2];
                if slice.len() > 20_000 && best.map(|item| item.len()).unwrap_or(0) < slice.len() {
                    best = Some(slice);
                }
                index = end + 1;
                break;
            }
            end += 1;
        }
        if end + 1 >= bytes.len() {
            break;
        }
        index += 1;
    }
    best.map(|item| item.to_vec())
}

fn to_u8(value: f32) -> u8 {
    (clamp01(value) * 255.0).round() as u8
}

#[cfg(test)]
mod tests {
    use super::*;
    use rawloader::CFA;

    #[test]
    fn extract_largest_jpeg_skips_tiny_thumbnails() {
        let tiny = [0xff, 0xd8, 0x00, 0x01, 0xff, 0xd9];
        let mut large = vec![0xff, 0xd8];
        large.extend(std::iter::repeat(0x7f).take(24_000));
        large.extend_from_slice(&[0xff, 0xd9]);
        let mut mixed = tiny.to_vec();
        mixed.extend_from_slice(&[0, 0, 0, 0]);
        mixed.extend_from_slice(&large);
        let extracted = extract_largest_jpeg(&mixed).unwrap();
        assert_eq!(extracted.len(), large.len());
    }

    #[test]
    fn bilinear_demosaic_recovers_solid_red_from_rggb() {
        let width = 8;
        let height = 8;
        let cfa = CFA::new("RGGB");
        let mut linear = vec![0.0; width * height];
        for y in 0..height {
            for x in 0..width {
                if cfa.color_at(y, x) == 0 {
                    linear[y * width + x] = 0.8;
                }
            }
        }
        let rgb = demosaic_bilinear(&linear, width, height, &cfa);
        let red = rgb[3 * 3];
        let green = rgb[3 * 3 + 1];
        let blue = rgb[3 * 3 + 2];
        assert!(red > 0.5, "red={red}");
        assert!(green < 0.2, "green={green}");
        assert!(blue < 0.2, "blue={blue}");
    }

    #[test]
    fn convert_raw_bytes_rejects_empty_payload() {
        assert!(convert_raw_bytes_to_jpeg(&[]).is_err());
    }
}
