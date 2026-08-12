package main

import (
	"fmt"
	"image"
	"image/color"
	"image/png"
	"os"
	"sync"
	"testing"
)

func writeTestPNG(t *testing.T, path string, value uint8) {
	t.Helper()
	file, err := os.Create(path)
	if err != nil {
		t.Fatalf("创建测试图片失败：%v", err)
	}
	defer file.Close()
	img := image.NewRGBA(image.Rect(0, 0, 8, 8))
	for y := 0; y < 8; y++ {
		for x := 0; x < 8; x++ {
			img.SetRGBA(x, y, color.RGBA{R: value, G: 90, B: 70, A: 255})
		}
	}
	if err := png.Encode(file, img); err != nil {
		t.Fatalf("编码测试图片失败：%v", err)
	}
}

func readTestPixel(t *testing.T, path string) color.RGBA {
	t.Helper()
	file, err := os.Open(path)
	if err != nil {
		t.Fatalf("打开导出图片失败：%v", err)
	}
	defer file.Close()
	img, err := png.Decode(file)
	if err != nil {
		t.Fatalf("解码导出图片失败：%v", err)
	}
	return color.RGBAModel.Convert(img.At(0, 0)).(color.RGBA)
}

func TestCallAdd(t *testing.T) {
	result := CallAdd(2, 3)
	if result != 5 {
		t.Errorf("Expected 5, got %d", result)
	} else {
		t.Logf("CallAdd(2, 3) success: %d", result)
	}
}

func TestCallGreet(t *testing.T) {
	result := CallGreet("Antigravity")
	expected := "Hello Antigravity, this is Rust native-engine speaking!"
	if result != expected {
		t.Errorf("Expected '%s', got '%s'", expected, result)
	} else {
		t.Logf("CallGreet success: '%s'", result)
	}
}

func TestCallExportImage(t *testing.T) {
	inputPath := "test_input.png"
	outputPath := "test_output.png"
	writeTestPNG(t, inputPath, 120)
	defer func() {
		_ = os.Remove(inputPath)
		_ = os.Remove(outputPath)
	}()

	ret := CallExportImage(
		inputPath,
		outputPath,
		20.0, // exposure
		15.0, // contrast
		-5.0, // saturation
		50.0, // blurStrength
		0.0,  // eyeEnlarge
		0.0,  // slimFace
		"",
	)

	if ret != 0 {
		t.Errorf("CallExportImage failed with error code: %d", ret)
		return
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Rust DLL 未生成输出图片")
		return
	}
	pixel := readTestPixel(t, outputPath)
	if pixel.R == 120 && pixel.G == 90 && pixel.B == 70 {
		t.Fatalf("Rust 导出仍然只是复制原图，像素未发生变化：%v", pixel)
	}
}

func TestBatchExportImages(t *testing.T) {
	numTasks := 4
	tasks := make([]ExportTask, numTasks)

	for i := 0; i < numTasks; i++ {
		inPath := fmt.Sprintf("batch_in_%d.png", i)
		outPath := fmt.Sprintf("batch_out_%d.png", i)
		writeTestPNG(t, inPath, uint8(100+i*10))

		tasks[i] = ExportTask{
			AssetID:      fmt.Sprintf("asset-uuid-%d", i),
			InputPath:    inPath,
			OutputPath:   outPath,
			Exposure:     float64(10 + i*10),
			Contrast:     5.0,
			Saturation:   0.0,
			BlurStrength: 30.0,
			LUTFile:      "",
		}
	}

	defer func() {
		for i := 0; i < numTasks; i++ {
			_ = os.Remove(tasks[i].InputPath)
			_ = os.Remove(tasks[i].OutputPath)
		}
	}()

	var mu sync.Mutex
	completedCount := 0
	results := make(map[string]int32)

	BatchExportImages(tasks, func(assetID string, errCode int32) {
		mu.Lock()
		defer mu.Unlock()
		completedCount++
		results[assetID] = errCode
	})

	if completedCount != numTasks {
		t.Errorf("Expected %d tasks to complete, got %d", numTasks, completedCount)
	}

	for i := 0; i < numTasks; i++ {
		assetID := tasks[i].AssetID
		errCode, exists := results[assetID]
		if !exists {
			t.Errorf("Task %s did not trigger progress callback", assetID)
			continue
		}
		if errCode != 0 {
			t.Errorf("Task %s failed with error code: %d", assetID, errCode)
		}

		pixel := readTestPixel(t, tasks[i].OutputPath)
		originalRed := uint8(100 + i*10)
		if pixel.R == originalRed && pixel.G == 90 && pixel.B == 70 {
			t.Errorf("批量任务 %d 未改变图片像素", i)
		}
	}

	t.Logf("BatchExportImages 成功：%d 个任务均由 Rust 引擎处理并导出", numTasks)
}

func TestCallExportImageV2ReportsDetailedError(t *testing.T) {
	code, detail := CallExportImageV2("missing.png", "output.png", "{")
	if code == 0 {
		t.Fatal("无效 JSON 不应导出成功")
	}
	if detail == "" {
		t.Fatal("Rust 引擎错误应包含可读详情")
	}
}
