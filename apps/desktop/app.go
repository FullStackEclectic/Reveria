package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
	"github.com/zalando/go-keyring"
)

const desktopCredentialService = "Reveria"

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

func (a *App) SaveAuthTokens(accessToken, refreshToken string) error {
	if strings.TrimSpace(accessToken) == "" || strings.TrimSpace(refreshToken) == "" {
		return os.ErrInvalid
	}
	if err := keyring.Set(desktopCredentialService, "access_token", accessToken); err != nil {
		return err
	}
	if err := keyring.Set(desktopCredentialService, "refresh_token", refreshToken); err != nil {
		_ = keyring.Delete(desktopCredentialService, "access_token")
		return err
	}
	return nil
}

func (a *App) LoadAuthTokens() map[string]string {
	tokens := map[string]string{}
	if token, err := keyring.Get(desktopCredentialService, "access_token"); err == nil {
		tokens["access_token"] = token
	}
	if token, err := keyring.Get(desktopCredentialService, "refresh_token"); err == nil {
		tokens["refresh_token"] = token
	}
	return tokens
}

func (a *App) ClearAuthTokens() error {
	var firstErr error
	for _, account := range []string{"access_token", "refresh_token"} {
		if err := keyring.Delete(desktopCredentialService, account); err != nil && err != keyring.ErrNotFound && firstErr == nil {
			firstErr = err
		}
	}
	return firstErr
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

const defaultDesktopCacheLimit int64 = 512 * 1024 * 1024

func desktopCacheLimit() int64 {
	if raw := strings.TrimSpace(os.Getenv("REVERIA_DESKTOP_MAX_CACHE_FILE_BYTES")); raw != "" {
		if value, err := strconv.ParseInt(raw, 10, 64); err == nil && value > 0 {
			return value
		}
	}
	return defaultDesktopCacheLimit
}

func desktopAssetCacheDir() (string, error) {
	root, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(root, "Reveria", "assets")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return dir, nil
}

func downloadAssetToCache(rawURL string) (string, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" || parsed.User != nil {
		return "", &url.Error{Op: "download", URL: rawURL, Err: os.ErrInvalid}
	}
	cacheDir, err := desktopAssetCacheDir()
	if err != nil {
		return "", err
	}
	ext := strings.ToLower(filepath.Ext(parsed.Path))
	if len(ext) > 10 || strings.ContainsAny(ext, `/\\`) {
		ext = ""
	}
	cacheIdentity := parsed.Scheme + "://" + parsed.Host + parsed.Path
	digest := sha256.Sum256([]byte(cacheIdentity))
	cachePath := filepath.Join(cacheDir, hex.EncodeToString(digest[:])+ext)
	if info, statErr := os.Stat(cachePath); statErr == nil && info.Size() > 0 {
		return cachePath, nil
	}

	requestCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	req, err := http.NewRequestWithContext(requestCtx, http.MethodGet, rawURL, nil)
	if err != nil {
		return "", err
	}
	resp, err := (&http.Client{Timeout: 2 * time.Minute}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", &url.Error{Op: "download", URL: rawURL, Err: os.ErrPermission}
	}

	tempFile, err := os.CreateTemp(cacheDir, ".reveria-download-*")
	if err != nil {
		return "", err
	}
	tempPath := tempFile.Name()
	committed := false
	defer func() {
		_ = tempFile.Close()
		if !committed {
			_ = os.Remove(tempPath)
		}
	}()
	written, err := io.Copy(tempFile, io.LimitReader(resp.Body, desktopCacheLimit()+1))
	if err != nil {
		return "", err
	}
	if written > desktopCacheLimit() {
		return "", os.ErrInvalid
	}
	if err := tempFile.Close(); err != nil {
		return "", err
	}
	if err := os.Rename(tempPath, cachePath); err != nil {
		return "", err
	}
	committed = true
	return cachePath, nil
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
	if inputPath == "" || func() bool { _, err := os.Stat(inputPath); return err != nil }() {
		if fileURL == "" {
			return -104
		}
		cachedPath, err := downloadAssetToCache(fileURL)
		if err != nil {
			return -105
		}
		inputPath = cachedPath
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
