mod color;
mod lut;
mod pipeline;
mod settings;

use std::cell::RefCell;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::panic::{catch_unwind, UnwindSafe};
use std::path::Path;

use settings::ExportSettings;

thread_local! {
    static LAST_ERROR: RefCell<String> = const { RefCell::new(String::new()) };
}

#[no_mangle]
pub extern "C" fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[no_mangle]
pub extern "C" fn greet(name: *const c_char) -> *mut c_char {
    let name = match read_c_string(name, "name") {
        Ok(value) => value,
        Err(_) => "Guest".to_string(),
    };
    into_c_string(format!(
        "Hello {name}, this is Rust native-engine speaking!"
    ))
}

#[no_mangle]
/// # Safety
///
/// `name` 必须是有效的 NUL 结尾字符串；`output` 必须指向至少 `capacity` 字节的可写内存。
pub unsafe extern "C" fn greet_v2(
    name: *const c_char,
    output: *mut c_char,
    capacity: usize,
) -> usize {
    let name = match read_c_string(name, "name") {
        Ok(value) => value,
        Err(_) => "Guest".to_string(),
    };
    write_utf8_buffer(
        &format!("Hello {name}, this is Rust native-engine speaking!"),
        output,
        capacity,
    )
}

#[no_mangle]
/// # Safety
///
/// `value` 必须是本动态库通过 `CString::into_raw` 返回且尚未释放的指针。
pub unsafe extern "C" fn free_string(value: *mut c_char) {
    if !value.is_null() {
        drop(CString::from_raw(value));
    }
}

#[no_mangle]
/// # Safety
///
/// `value` 必须指向以 NUL 结尾且在调用期间有效的 C 字符串。
pub unsafe extern "C" fn string_length(value: *const c_char) -> usize {
    if value.is_null() {
        return 0;
    }
    CStr::from_ptr(value).to_bytes().len()
}

#[no_mangle]
pub extern "C" fn last_error_message() -> *mut c_char {
    let message = LAST_ERROR.with(|last| last.borrow().clone());
    into_c_string(message)
}

#[no_mangle]
/// # Safety
///
/// `output` 必须为空指针，或指向至少 `capacity` 字节的可写内存。
pub unsafe extern "C" fn last_error_message_v2(output: *mut c_char, capacity: usize) -> usize {
    let message = LAST_ERROR.with(|last| last.borrow().clone());
    write_utf8_buffer(&message, output, capacity)
}

#[no_mangle]
pub extern "C" fn export_image_v2(
    input_path: *const c_char,
    output_path: *const c_char,
    settings_json: *const c_char,
) -> i32 {
    run_export(|| {
        let input = read_c_string(input_path, "input_path")?;
        let output = read_c_string(output_path, "output_path")?;
        let json = read_c_string(settings_json, "settings_json")?;
        let mut settings: ExportSettings =
            serde_json::from_str(&json).map_err(|error| format!("精修参数 JSON 无效：{error}"))?;
        settings.normalize();
        pipeline::process_and_save_image(Path::new(&input), Path::new(&output), &settings)
    })
}

// 兼容旧版 Go 调用。新代码应使用 export_image_v2，避免跨 FFI 直接传递浮点参数。
#[no_mangle]
pub extern "C" fn export_image(
    input_path: *const c_char,
    output_path: *const c_char,
    exposure: f64,
    contrast: f64,
    saturation: f64,
    blur_strength: f64,
    _eye_enlarge: f64,
    _slim_face: f64,
    lut_file: *const c_char,
) -> i32 {
    run_export(|| {
        let input = read_c_string(input_path, "input_path")?;
        let output = read_c_string(output_path, "output_path")?;
        let lut_path = if lut_file.is_null() {
            String::new()
        } else {
            read_c_string(lut_file, "lut_file")?
        };
        let mut settings = ExportSettings {
            exposure: exposure as f32,
            contrast: contrast as f32,
            saturation: saturation as f32,
            blur_strength: blur_strength as f32,
            lut_path,
            ..Default::default()
        };
        settings.normalize();
        pipeline::process_and_save_image(Path::new(&input), Path::new(&output), &settings)
    })
}

fn run_export<F>(operation: F) -> i32
where
    F: FnOnce() -> Result<(), String> + UnwindSafe,
{
    clear_last_error();
    match catch_unwind(operation) {
        Ok(result) => finish_export(result),
        Err(_) => {
            set_last_error("原生图像引擎发生未预期的内部错误".to_string());
            -5
        }
    }
}

fn finish_export(result: Result<(), String>) -> i32 {
    match result {
        Ok(()) => 0,
        Err(message) => {
            set_last_error(message);
            -4
        }
    }
}

fn read_c_string(value: *const c_char, name: &str) -> Result<String, String> {
    if value.is_null() {
        return Err(format!("{name} 不能为空"));
    }
    unsafe { CStr::from_ptr(value) }
        .to_str()
        .map(str::to_owned)
        .map_err(|_| format!("{name} 不是有效的 UTF-8 字符串"))
}

fn into_c_string(value: String) -> *mut c_char {
    CString::new(value.replace('\0', " "))
        .unwrap_or_default()
        .into_raw()
}

unsafe fn write_utf8_buffer(value: &str, output: *mut c_char, capacity: usize) -> usize {
    let required = value.len();
    if output.is_null() || capacity == 0 {
        return required;
    }
    let count = required.min(capacity.saturating_sub(1));
    std::ptr::copy_nonoverlapping(value.as_ptr(), output.cast::<u8>(), count);
    *output.add(count) = 0;
    required
}

fn clear_last_error() {
    LAST_ERROR.with(|last| last.borrow_mut().clear());
}

fn set_last_error(message: String) {
    LAST_ERROR.with(|last| *last.borrow_mut() = message);
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};
    use std::ffi::CString;
    use tempfile::tempdir;

    #[test]
    fn ffi_export_decodes_processes_and_encodes_real_image() {
        let directory = tempdir().unwrap();
        let input = directory.path().join("input.png");
        let output = directory.path().join("output.png");
        RgbaImage::from_pixel(12, 10, Rgba([120, 80, 60, 255]))
            .save(&input)
            .unwrap();
        let input_c = CString::new(input.to_string_lossy().as_bytes()).unwrap();
        let output_c = CString::new(output.to_string_lossy().as_bytes()).unwrap();
        let settings_c = CString::new(r#"{"exposure":25,"contrast":10}"#).unwrap();
        let code = export_image_v2(input_c.as_ptr(), output_c.as_ptr(), settings_c.as_ptr());
        assert_eq!(code, 0);
        let decoded = image::open(&output).unwrap().to_rgba8();
        assert_ne!(decoded.get_pixel(0, 0), &Rgba([120, 80, 60, 255]));
    }

    #[test]
    fn ffi_reports_invalid_json() {
        let input = CString::new("missing.png").unwrap();
        let output = CString::new("output.png").unwrap();
        let settings = CString::new("{").unwrap();
        assert_eq!(
            export_image_v2(input.as_ptr(), output.as_ptr(), settings.as_ptr()),
            -4
        );
        let message = last_error_message();
        assert!(!message.is_null());
        let text = unsafe { CStr::from_ptr(message) }
            .to_string_lossy()
            .into_owned();
        unsafe { free_string(message) };
        assert!(text.contains("JSON"));
    }
}
