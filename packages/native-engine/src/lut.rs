use std::fs;
use std::path::Path;

use crate::color::{clamp01, mix, Rgb};

#[derive(Clone, Debug)]
pub struct CubeLut {
    size: usize,
    values: Vec<Rgb>,
    domain_min: Rgb,
    domain_max: Rgb,
}

impl CubeLut {
    pub fn load(path: &Path) -> Result<Self, String> {
        let content =
            fs::read_to_string(path).map_err(|error| format!("读取 LUT 失败：{error}"))?;
        Self::parse(&content)
    }

    pub fn parse(content: &str) -> Result<Self, String> {
        let mut size = None;
        let mut values = Vec::new();
        let mut domain_min = [0.0, 0.0, 0.0];
        let mut domain_max = [1.0, 1.0, 1.0];
        for raw_line in content.lines() {
            let line = raw_line.trim();
            if line.is_empty() || line.starts_with('#') || line.starts_with("TITLE") {
                continue;
            }
            let parts: Vec<_> = line.split_whitespace().collect();
            match parts.first().copied() {
                Some("LUT_1D_SIZE") => return Err("暂不支持一维 LUT".to_string()),
                Some("LUT_3D_SIZE") => {
                    size = parts.get(1).and_then(|value| value.parse::<usize>().ok());
                }
                Some("DOMAIN_MIN") => domain_min = parse_rgb(&parts[1..])?,
                Some("DOMAIN_MAX") => domain_max = parse_rgb(&parts[1..])?,
                _ if parts.len() >= 3 => values.push(parse_rgb(&parts[..3])?),
                _ => {}
            }
        }
        let size = size.ok_or_else(|| "LUT 缺少 LUT_3D_SIZE".to_string())?;
        if !(2..=65).contains(&size) {
            return Err("LUT 边长必须在 2 到 65 之间".to_string());
        }
        let expected = size * size * size;
        if values.len() != expected {
            return Err(format!(
                "LUT 数据不完整：期望 {expected} 个采样点，实际 {} 个",
                values.len()
            ));
        }
        if (0..3).any(|index| domain_max[index] <= domain_min[index]) {
            return Err("LUT DOMAIN_MAX 必须大于 DOMAIN_MIN".to_string());
        }
        Ok(Self {
            size,
            values,
            domain_min,
            domain_max,
        })
    }

    pub fn apply(&self, color: Rgb, intensity: f32) -> Rgb {
        let normalized = [
            ((color[0] - self.domain_min[0]) / (self.domain_max[0] - self.domain_min[0]))
                .clamp(0.0, 1.0),
            ((color[1] - self.domain_min[1]) / (self.domain_max[1] - self.domain_min[1]))
                .clamp(0.0, 1.0),
            ((color[2] - self.domain_min[2]) / (self.domain_max[2] - self.domain_min[2]))
                .clamp(0.0, 1.0),
        ];
        let scale = (self.size - 1) as f32;
        let x = normalized[0] * scale;
        let y = normalized[1] * scale;
        let z = normalized[2] * scale;
        let x0 = x.floor() as usize;
        let y0 = y.floor() as usize;
        let z0 = z.floor() as usize;
        let x1 = (x0 + 1).min(self.size - 1);
        let y1 = (y0 + 1).min(self.size - 1);
        let z1 = (z0 + 1).min(self.size - 1);
        let fx = x - x0 as f32;
        let fy = y - y0 as f32;
        let fz = z - z0 as f32;
        let c00 = mix(self.at(x0, y0, z0), self.at(x1, y0, z0), fx);
        let c10 = mix(self.at(x0, y1, z0), self.at(x1, y1, z0), fx);
        let c01 = mix(self.at(x0, y0, z1), self.at(x1, y0, z1), fx);
        let c11 = mix(self.at(x0, y1, z1), self.at(x1, y1, z1), fx);
        let graded = mix(mix(c00, c10, fy), mix(c01, c11, fy), fz).map(clamp01);
        mix(color, graded, intensity.clamp(0.0, 1.0))
    }

    fn at(&self, red: usize, green: usize, blue: usize) -> Rgb {
        self.values[blue * self.size * self.size + green * self.size + red]
    }
}

fn parse_rgb(parts: &[&str]) -> Result<Rgb, String> {
    if parts.len() < 3 {
        return Err("LUT 颜色数据列数不足".to_string());
    }
    let mut result = [0.0; 3];
    for index in 0..3 {
        result[index] = parts[index]
            .parse::<f32>()
            .map_err(|_| format!("LUT 包含非法数值：{}", parts[index]))?;
        if !result[index].is_finite() {
            return Err("LUT 包含非有限数值".to_string());
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_interpolates_cube_lut() {
        let lut = CubeLut::parse(
            "LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n",
        )
        .unwrap();
        let output = lut.apply([0.25, 0.5, 0.75], 1.0);
        assert!((output[0] - 0.25).abs() < 0.001);
        assert!((output[1] - 0.5).abs() < 0.001);
        assert!((output[2] - 0.75).abs() < 0.001);
    }
}
