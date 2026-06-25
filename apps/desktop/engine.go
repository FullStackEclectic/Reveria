package main

import (
	"log"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"
)

var (
	nativeEngine    *syscall.LazyDLL
	procAdd         *syscall.LazyProc
	procGreet       *syscall.LazyProc
	procFreeStr     *syscall.LazyProc
	procExportImage *syscall.LazyProc
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
	procAdd = nativeEngine.NewProc("add")
	procGreet = nativeEngine.NewProc("greet")
	procFreeStr = nativeEngine.NewProc("free_string")
	procExportImage = nativeEngine.NewProc("export_image")
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

	ret, _, _ := procGreet.Call(uintptr(unsafe.Pointer(cName)))
	if ret == 0 {
		return "Null pointer returned from DLL"
	}

	defer procFreeStr.Call(ret)
	return GoString(ret)
}

// float64ToUintptr 将 Go float64 转换为 syscall 可传递的 uintptr 位模式 (仅限64位系统)
func float64ToUintptr(val float64) uintptr {
	bits := math.Float64bits(val)
	return uintptr(bits)
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
	if !dllLoaded {
		return -100
	}

	cInput, err := syscall.BytePtrFromString(inputPath)
	if err != nil {
		return -101
	}
	cOutput, err := syscall.BytePtrFromString(outputPath)
	if err != nil {
		return -102
	}
	cLut, err := syscall.BytePtrFromString(lutFile)
	if err != nil {
		return -103
	}

	ret, _, _ := procExportImage.Call(
		uintptr(unsafe.Pointer(cInput)),
		uintptr(unsafe.Pointer(cOutput)),
		float64ToUintptr(exposure),
		float64ToUintptr(contrast),
		float64ToUintptr(saturation),
		float64ToUintptr(blurStrength),
		float64ToUintptr(eyeEnlarge),
		float64ToUintptr(slimFace),
		uintptr(unsafe.Pointer(cLut)),
	)

	return int32(ret)
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

func GoString(ptr uintptr) string {
	if ptr == 0 {
		return ""
	}
	var bytes []byte
	for i := 0; ; i++ {
		b := *(*byte)(unsafe.Pointer(ptr + uintptr(i)))
		if b == 0 {
			break
		}
		bytes = append(bytes, b)
	}
	return string(bytes)
}
