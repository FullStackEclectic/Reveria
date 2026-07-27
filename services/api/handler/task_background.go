package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	_ "golang.org/x/image/webp"
)

const backgroundRemovalPrompt = "Remove the entire background and return only the original foreground subject on a fully transparent background. Preserve fine hair, fur, translucent edges, product contours, colors, lighting, and all subject details. Do not add or replace any content."

// handleBackgroundRemovalTask 通过统一图像编辑端点生成带 alpha 的前景 PNG。
func handleBackgroundRemovalTask(ctx context.Context, task model.GenerationTask, settings model.ClientSettings, gatewayModelName string) {
	var payload map[string]any
	_ = json.Unmarshal([]byte(task.InputPayload), &payload)
	imageURL, _ := payload["image_url"].(string)
	sizeStr, _ := payload["size"].(string)
	if strings.TrimSpace(imageURL) == "" {
		handleTaskFailure(task.ID, "BACKGROUND_IMAGE_MISSING", "抠图任务缺少源图")
		return
	}
	imageBytes, err := loadTaskSourceImage(task, imageURL)
	if err != nil {
		handleTaskFailure(task.ID, "BACKGROUND_IMAGE_LOAD_FAILED", err.Error())
		return
	}
	if len(imageBytes) > 4_500_000 {
		imageBytes, err = compressReferenceImage(imageBytes)
		if err != nil {
			handleTaskFailure(task.ID, "BACKGROUND_IMAGE_COMPRESS_FAILED", "抠图源图压缩失败: "+err.Error())
			return
		}
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(imageBytes))
	if err != nil {
		handleTaskFailure(task.ID, "BACKGROUND_IMAGE_DECODE_FAILED", "无法读取抠图源图尺寸")
		return
	}
	if sizeStr == "" || sizeStr == "auto" {
		sizeStr = backgroundRemovalSize(config.Width, config.Height)
	}
	payload["source_width"] = config.Width
	payload["source_height"] = config.Height
	if normalizedPayload, marshalErr := json.Marshal(payload); marshalErr == nil {
		task.InputPayload = string(normalizedPayload)
		database.DB.Model(&model.GenerationTask{}).Where("id = ?", task.ID).Update("input_payload", task.InputPayload)
	}

	progress := `{"progress_text":"AI 正在识别主体并提取透明前景..."}`
	database.DB.Model(&task).Update("output_payload", progress)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	imageField, err := writer.CreateFormFile("image", "source.png")
	if err != nil {
		handleTaskFailure(task.ID, "BACKGROUND_REQUEST_BUILD_FAILED", "创建抠图请求失败")
		return
	}
	_, _ = io.Copy(imageField, bytes.NewReader(imageBytes))
	_ = writer.WriteField("prompt", backgroundRemovalPrompt)
	if strings.TrimSpace(gatewayModelName) != "" {
		_ = writer.WriteField("model", gatewayModelName)
	}
	_ = writer.WriteField("n", "1")
	_ = writer.WriteField("size", sizeStr)
	_ = writer.WriteField("response_format", "b64_json")
	_ = writer.Close()

	endpoint := fmt.Sprintf("%s/v1/images/edits", settings.UpstreamAPIURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, body)
	if err != nil {
		handleTaskFailure(task.ID, "BACKGROUND_HTTP_CLIENT_ERROR", "创建抠图请求失败: "+err.Error())
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+settings.UpstreamAPIKey)

	resp, err := (&http.Client{Transport: insecureTransport, Timeout: 120 * time.Second}).Do(req)
	if err != nil {
		handleTaskFailure(task.ID, "BACKGROUND_TIMEOUT", "调用抠图网关超时: "+err.Error())
		return
	}
	defer resp.Body.Close()
	responseBytes, _ := io.ReadAll(io.LimitReader(resp.Body, maxUploadBytes()+1))
	if resp.StatusCode != http.StatusOK {
		handleTaskFailure(task.ID, fmt.Sprintf("BACKGROUND_GATEWAY_%d", resp.StatusCode), upstreamErrorMessage(responseBytes, "抠图网关调用失败"))
		return
	}

	urls := parseUpstreamImageURLs(responseBytes)
	if len(urls) == 0 {
		handleTaskFailure(task.ID, "NO_BACKGROUND_RESULT", "抠图网关未返回透明图片")
		return
	}
	handleTaskSuccess(task, urls[:1])
}

func backgroundRemovalSize(width, height int) string {
	if width <= 0 || height <= 0 {
		return "1024x1024"
	}
	ratio := float64(width) / float64(height)
	if ratio > 1.15 {
		return "1536x1024"
	}
	if ratio < 0.87 {
		return "1024x1536"
	}
	return "1024x1024"
}

func loadTaskSourceImage(task model.GenerationTask, imageURL string) ([]byte, error) {
	if fileName, local := storedFileNameFromURL(imageURL); local {
		fileURL := "/api/files/" + fileName
		var count int64
		if database.DB.Model(&model.Asset{}).
			Where("workspace_id = ? AND (file_url = ? OR thumbnail_url = ?)", task.WorkspaceID, fileURL, fileURL).
			Count(&count).Error != nil || count == 0 {
			return nil, fmt.Errorf("抠图源图不属于当前工作区")
		}
		data, err := os.ReadFile(filepath.Join(getStorageDir(), fileName))
		if err == nil {
			return data, nil
		}
	}
	if !isSafeRemoteURL(imageURL) {
		return nil, fmt.Errorf("抠图源图地址不允许访问")
	}
	resp, err := (&http.Client{Transport: insecureTransport, Timeout: 30 * time.Second}).Get(imageURL)
	if err != nil {
		return nil, fmt.Errorf("下载抠图源图失败")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("下载抠图源图失败")
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxUploadBytes()+1))
	if err != nil || int64(len(data)) > maxUploadBytes() {
		return nil, fmt.Errorf("抠图源图超过大小限制")
	}
	return data, nil
}

func upstreamErrorMessage(data []byte, fallback string) string {
	var response map[string]any
	_ = json.Unmarshal(data, &response)
	if errorData, ok := response["error"].(map[string]any); ok {
		if message, ok := errorData["message"].(string); ok && strings.TrimSpace(message) != "" {
			return message
		}
	}
	return fallback
}

func parseUpstreamImageURLs(data []byte) []string {
	var response map[string]any
	if json.Unmarshal(data, &response) != nil {
		return nil
	}
	var urls []string
	items, _ := response["data"].([]any)
	for _, item := range items {
		entry, _ := item.(map[string]any)
		if url, _ := entry["url"].(string); strings.TrimSpace(url) != "" {
			urls = append(urls, strings.TrimSpace(url))
		} else if encoded, _ := entry["b64_json"].(string); strings.TrimSpace(encoded) != "" {
			urls = append(urls, "data:image/png;base64,"+strings.TrimSpace(encoded))
		}
	}
	return urls
}
