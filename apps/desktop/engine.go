package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"
)

var (
	nativeEngine    *syscall.LazyDLL
	procAdd         *syscall.LazyProc
	procGreetV2     *syscall.LazyProc
	procExportImage *syscall.LazyProc
	procExportV2    *syscall.LazyProc
	procLastErrorV2 *syscall.LazyProc
	dllLoaded       = false
)

func init() {
	if runtime.GOOS != "windows" {
		log.Println("当前操作系统不是 Windows，暂不使用 syscall 动态加载 DLL")
		return
	}

	dllPath := findDLLPath()
	log.Println("正在加载 DLL:", dllPath)
	nativeEngine = syscall.NewLazyDLL(dllPath)
	if err := nativeEngine.Load(); err != nil {
		log.Printf("Rust 原生引擎加载失败，将使用 WebGL 导出：%v", err)
		return
	}
	procAdd = nativeEngine.NewProc("add")
	procGreetV2 = nativeEngine.NewProc("greet_v2")
	procExportImage = nativeEngine.NewProc("export_image")
	procExportV2 = nativeEngine.NewProc("export_image_v2")
	procLastErrorV2 = nativeEngine.NewProc("last_error_message_v2")
	for name, proc := range map[string]*syscall.LazyProc{
		"add":                   procAdd,
		"greet_v2":              procGreetV2,
		"export_image":          procExportImage,
		"export_image_v2":       procExportV2,
		"last_error_message_v2": procLastErrorV2,
	} {
		if err := proc.Find(); err != nil {
			log.Printf("Rust 原生引擎缺少导出符号 %s：%v", name, err)
			return
		}
	}
	dllLoaded = true
}

func findDLLPath() string {
	if wd, err := os.Getwd(); err == nil {
		p1 := filepath.Clean(filepath.Join(wd, "../../packages/native-engine/target/release/native_engine.dll"))
		if _, err := os.Stat(p1); err == nil {
			return p1
		}
		p2 := filepath.Clean(filepath.Join(wd, "../packages/native-engine/target/release/native_engine.dll"))
		if _, err := os.Stat(p2); err == nil {
			return p2
		}
		p3 := filepath.Clean(filepath.Join(wd, "packages/native-engine/target/release/native_engine.dll"))
		if _, err := os.Stat(p3); err == nil {
			return p3
		}
	}

	if exePath, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exePath)
		p1 := filepath.Join(exeDir, "native_engine.dll")
		if _, err := os.Stat(p1); err == nil {
			return p1
		}
		p2 := filepath.Clean(filepath.Join(exeDir, "../../../packages/native-engine/target/release/native_engine.dll"))
		if _, err := os.Stat(p2); err == nil {
			return p2
		}
	}

	return "native_engine.dll"
}

func CallAdd(a, b int32) int32 {
	if !dllLoaded {
		return a + b
	}
	ret, _, _ := procAdd.Call(uintptr(a), uintptr(b))
	return int32(ret)
}

func CallGreet(name string) string {
	if !dllLoaded {
		return "DLL Not Loaded (Fallback): Hello " + name
	}
	cName, err := syscall.BytePtrFromString(name)
	if err != nil {
		return "Error converting name to C string"
	}

	return callNativeString(procGreetV2, uintptr(unsafe.Pointer(cName)))
}

// CallExportImage 调用 Rust DLL 核心算法对原图进行高精处理并导出
func CallExportImage(
	inputPath string,
	outputPath string,
	exposure float64,
	contrast float64,
	saturation float64,
	blurStrength float64,
	eyeEnlarge float64,
	slimFace float64,
	lutFile string,
) int32 {
	// Windows x64 ABI 使用 XMM 寄存器传递浮点参数，syscall.Proc.Call 不能可靠地
	// 直接调用带 float64 参数的 C ABI。统一转为 JSON 字符串调用 v2 接口。
	if eyeEnlarge != 0 || slimFace != 0 {
		return -120
	}
	settingsJSON, err := json.Marshal(map[string]any{
		"exposure":      exposure,
		"contrast":      contrast,
		"saturation":    saturation,
		"blur_strength": blurStrength,
		"lut_path":      lutFile,
	})
	if err != nil {
		return -121
	}
	code, _ := CallExportImageV2(inputPath, outputPath, string(settingsJSON))
	return code
}

// CallExportImageV2 使用仅包含 UTF-8 字符串参数的 ABI 调用 Rust 引擎。
func CallExportImageV2(inputPath, outputPath, settingsJSON string) (int32, string) {
	if !dllLoaded {
		return -100, "Rust 原生图像引擎未加载"
	}
	// Rust 侧错误信息按线程保存；锁定 OS 线程保证失败调用与错误读取一一对应，
	// 同时允许批量任务并发执行而不互相覆盖错误详情。
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	cInput, err := syscall.BytePtrFromString(inputPath)
	if err != nil {
		return -101, "输入路径包含非法字符"
	}
	cOutput, err := syscall.BytePtrFromString(outputPath)
	if err != nil {
		return -102, "输出路径包含非法字符"
	}
	cSettings, err := syscall.BytePtrFromString(settingsJSON)
	if err != nil {
		return -103, "精修参数包含非法字符"
	}
	ret, _, callErr := procExportV2.Call(
		uintptr(unsafe.Pointer(cInput)),
		uintptr(unsafe.Pointer(cOutput)),
		uintptr(unsafe.Pointer(cSettings)),
	)
	code := int32(ret)
	if code == 0 {
		return 0, ""
	}
	detail := nativeEngineLastError()
	if detail == "" && callErr != syscall.Errno(0) {
		detail = callErr.Error()
	}
	return code, detail
}

func nativeEngineLastError() string {
	if !dllLoaded || procLastErrorV2 == nil {
		return ""
	}
	return callNativeString(procLastErrorV2)
}

// ExportTask 导出任务参数
type ExportTask struct {
	AssetID      string  `json:"asset_id"`
	InputPath    string  `json:"input_path"`
	OutputPath   string  `json:"output_path"`
	Exposure     float64 `json:"exposure"`
	Contrast     float64 `json:"contrast"`
	Saturation   float64 `json:"saturation"`
	BlurStrength float64 `json:"blur_strength"`
	EyeEnlarge   float64 `json:"eye_enlarge"`
	SlimFace     float64 `json:"slim_face"`
	LUTFile      string  `json:"lut_file"`
}

// BatchExportImages 并发受控的批量大图导出
// 使用有界信号量 (Worker Pool) 限制最大并发数为 CPU 核心数的一半，保障用户本机显存和系统的稳定，杜绝崩溃。
func BatchExportImages(tasks []ExportTask, onProgress func(assetID string, errCode int32)) {
	maxConcurrency := runtime.NumCPU() / 2
	if maxConcurrency < 1 {
		maxConcurrency = 1
	}

	sem := make(chan struct{}, maxConcurrency)

	for _, task := range tasks {
		sem <- struct{}{} // 抢占信号量槽位
		go func(t ExportTask) {
			defer func() { <-sem }() // 任务结束释放信号量

			ret := CallExportImage(
				t.InputPath,
				t.OutputPath,
				t.Exposure,
				t.Contrast,
				t.Saturation,
				t.BlurStrength,
				t.EyeEnlarge,
				t.SlimFace,
				t.LUTFile,
			)

			if onProgress != nil {
				onProgress(t.AssetID, ret)
			}
		}(task)
	}

	// 阻塞等待所有并发 Goroutine 执行完毕才返回
	for i := 0; i < maxConcurrency; i++ {
		sem <- struct{}{}
	}
}

func callNativeString(proc *syscall.LazyProc, prefixArgs ...uintptr) string {
	if proc == nil {
		return ""
	}
	buffer := make([]byte, 4096)
	args := append(prefixArgs, uintptr(unsafe.Pointer(&buffer[0])), uintptr(len(buffer)))
	required, _, _ := proc.Call(args...)
	if required == 0 {
		return ""
	}
	if int(required) >= len(buffer) {
		buffer = make([]byte, int(required)+1)
		args = append(prefixArgs, uintptr(unsafe.Pointer(&buffer[0])), uintptr(len(buffer)))
		required, _, _ = proc.Call(args...)
	}
	return string(buffer[:min(int(required), len(buffer)-1)])
}
