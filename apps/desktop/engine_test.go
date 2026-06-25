package main

import (
	"fmt"
	"os"
	"sync"
	"testing"
)

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
	// 1. 准备测试文件
	inputPath := "test_input.txt"
	outputPath := "test_output.txt"
	
	err := os.WriteFile(inputPath, []byte("Test Image Raw Data"), 0644)
	if err != nil {
		t.Fatalf("Failed to create test input file: %v", err)
	}
	defer func() {
		_ = os.Remove(inputPath)
		_ = os.Remove(outputPath)
	}()

	// 2. 调用 Rust 导出算法
	ret := CallExportImage(
		inputPath,
		outputPath,
		10.0,  // exposure
		15.0,  // contrast
		-5.0,  // saturation
		50.0,  // blurStrength
		0.0,   // eyeEnlarge
		0.0,   // slimFace
		"film.cube",
	)

	if ret != 0 {
		t.Errorf("CallExportImage failed with error code: %d", ret)
		return
	}

	// 3. 验证输出文件是否生成并正确拷贝
	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		t.Error("Output file was not created by Rust DLL")
		return
	}

	outBytes, err := os.ReadFile(outputPath)
	if err != nil {
		t.Errorf("Failed to read output file: %v", err)
		return
	}

	if string(outBytes) != "Test Image Raw Data" {
		t.Errorf("Expected output file content to be 'Test Image Raw Data', got '%s'", string(outBytes))
	} else {
		t.Log("CallExportImage completed successfully, output file matches input!")
	}
}

func TestBatchExportImages(t *testing.T) {
	// 1. 创建多个测试原图
	numTasks := 4
	tasks := make([]ExportTask, numTasks)
	
	for i := 0; i < numTasks; i++ {
		inPath := fmt.Sprintf("batch_in_%d.txt", i)
		outPath := fmt.Sprintf("batch_out_%d.txt", i)
		
		err := os.WriteFile(inPath, []byte(fmt.Sprintf("Raw Image Content %d", i)), 0644)
		if err != nil {
			t.Fatalf("Failed to create batch input %d: %v", i, err)
		}
		
		tasks[i] = ExportTask{
			AssetID:      fmt.Sprintf("asset-uuid-%d", i),
			InputPath:    inPath,
			OutputPath:   outPath,
			Exposure:     float64(i * 10),
			Contrast:     5.0,
			Saturation:   0.0,
			BlurStrength: 30.0,
			LUTFile:      "",
		}
	}

	// 确保测试结束清理所有临时文件
	defer func() {
		for i := 0; i < numTasks; i++ {
			_ = os.Remove(tasks[i].InputPath)
			_ = os.Remove(tasks[i].OutputPath)
		}
	}()

	// 2. 多线程并发执行
	var mu sync.Mutex
	completedCount := 0
	results := make(map[string]int32)

	BatchExportImages(tasks, func(assetID string, errCode int32) {
		mu.Lock()
		defer mu.Unlock()
		completedCount++
		results[assetID] = errCode
	})

	// 3. 验证并发控制和执行结果
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

		// 验证文件导出
		outBytes, err := os.ReadFile(tasks[i].OutputPath)
		if err != nil {
			t.Errorf("Failed to read output file for task %d: %v", i, err)
			continue
		}
		expectedContent := fmt.Sprintf("Raw Image Content %d", i)
		if string(outBytes) != expectedContent {
			t.Errorf("Task %d output file content mismatch: expected '%s', got '%s'", i, expectedContent, string(outBytes))
		}
	}
	
	t.Logf("BatchExportImages success! All %d tasks ran through Worker Pool and successfully exported.", numTasks)
}
