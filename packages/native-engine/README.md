# Reveria Rust 原生图像引擎

该 crate 为 Wails 桌面端提供全分辨率本地图像处理。它不会联网，也不维护业务数据。

## 已实现管线

- JPEG、PNG、WebP 解码与编码，保留 PNG/WebP Alpha 通道
- Rayon 并行像素处理
- 曝光、对比度、高光、阴影、白色、黑色
- 饱和度、自然饱和度、色温、色调、去朦胧
- 清晰度、锐化
- YCbCr 肤色保护双边磨皮、中性灰磨皮、皮肤纹理、美白与高光
- HSL 八通道、RGB 五点曲线、阴影/高光分离色调
- 旋转、翻转、裁剪
- 标准 `.cube` 3D LUT 解析与三线性插值

## ABI

生产调用使用：

```text
export_image_v2(input_path, output_path, settings_json) -> i32
last_error_message_v2(output_buffer, capacity) -> usize
greet_v2(name, output_buffer, capacity) -> usize
```

路径与设置通过 UTF-8 C 字符串传递，避免 Windows x64 下直接传递浮点参数的 ABI 差异。字符串结果写入 Go 分配的缓冲区，Go 不需要解引用或释放 Rust 指针。`export_image`、`last_error_message` 和 `free_string` 仅为旧调用兼容保留。

导出返回 `0` 表示成功，负数表示失败。Go 调用方在同一 OS 线程读取错误缓冲区，批量任务之间不会覆盖错误详情。

## 构建与测试

```powershell
pnpm native:test
pnpm native:build
```

Windows release DLL 位于 `packages/native-engine/target/release/native_engine.dll`。发布脚本会将它复制到 `apps/desktop/build/bin/Reveria.exe` 同目录。

## 回退边界

Face Mesh 五官形变、局部修复、液化、局部蒙版和背景合成依赖浏览器运行期数据。当前包含这些效果时由前端自动回退 WebGL 最终画面导出，避免生成与预览不一致的文件。
