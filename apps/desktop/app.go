package main

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name, now calling the Rust DLL via Go FFI
func (a *App) Greet(name string) string {
	return CallGreet(name)
}

// SelectSavePath 弹出保存文件对话框，返回用户选择的路径，取消返回空字符串
func (a *App) SelectSavePath(defaultFilename string) string {
	path, err := wailsRuntime.SaveFileDialog(a.ctx, wailsRuntime.SaveDialogOptions{
		Title:           "选择导出图片保存位置",
		DefaultFilename: defaultFilename,
		Filters: []wailsRuntime.FileFilter{
			{
				DisplayName: "图片文件 (*.jpg;*.jpeg;*.png)",
				Pattern:     "*.jpg;*.jpeg;*.png",
			},
		},
	})
	if err != nil || path == "" {
		return ""
	}
	return path
}

// ExportRetouchedImage 导出精修图片，返回 0 表示成功，负数表示错误码
func (a *App) ExportRetouchedImage(
	fileURL string,
	localPath string,
	outputPath string,
	exposure float64,
	contrast float64,
	saturation float64,
	blurStrength float64,
	eyeEnlarge float64,
	slimFace float64,
	lutFile string,
) int32 {
	inputPath := localPath

	// 如果 localPath 为空或者文件不存在，则从 fileURL 下载到临时文件
	if inputPath == "" {
		if fileURL == "" {
			return -104 // 缺少输入源
		}

		fullURL := fileURL
		if strings.HasPrefix(fileURL, "/") {
			fullURL = "http://127.0.0.1:4100" + fileURL
		}

		resp, err := http.Get(fullURL)
		if err != nil {
			return -105 // 下载失败
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return -106 // 响应状态错误
		}

		ext := filepath.Ext(fileURL)
		if ext == "" {
			ext = ".jpg"
		}
		tmpFile, err := os.CreateTemp("", "reveria-retouch-*"+ext)
		if err != nil {
			return -107 // 创建临时文件失败
		}
		tmpPath := tmpFile.Name()
		defer os.Remove(tmpPath)
		defer tmpFile.Close()

		_, err = io.Copy(tmpFile, resp.Body)
		if err != nil {
			return -108 // 保存临时文件失败
		}
		_ = tmpFile.Close() // 提前关闭以释放句柄

		inputPath = tmpPath
	} else {
		// 校验本地文件是否存在，不存在则尝试用 fileURL 下载
		if _, err := os.Stat(inputPath); os.IsNotExist(err) {
			if fileURL != "" {
				fullURL := fileURL
				if strings.HasPrefix(fileURL, "/") {
					fullURL = "http://127.0.0.1:4100" + fileURL
				}
				resp, err := http.Get(fullURL)
				if err == nil && resp.StatusCode == http.StatusOK {
					ext := filepath.Ext(fileURL)
					if ext == "" {
						ext = ".jpg"
					}
					tmpFile, err := os.CreateTemp("", "reveria-retouch-*"+ext)
					if err == nil {
						tmpPath := tmpFile.Name()
						defer os.Remove(tmpPath)
						_, copyErr := io.Copy(tmpFile, resp.Body)
						tmpFile.Close()
						if copyErr == nil {
							inputPath = tmpPath
						}
					}
				}
			}
		}
	}

	// 再次确认文件是否存在
	if _, err := os.Stat(inputPath); os.IsNotExist(err) {
		return -109 // 输入文件不存在
	}

	// 确认输出路径的父级目录存在
	outDir := filepath.Dir(outputPath)
	if err := os.MkdirAll(outDir, 0755); err != nil {
		return -110 // 创建输出目录失败
	}

	// 调用 Rust 引擎核心导出
	ret := CallExportImage(
		inputPath,
		outputPath,
		exposure,
		contrast,
		saturation,
		blurStrength,
		eyeEnlarge,
		slimFace,
		lutFile,
	)

	return ret
}

