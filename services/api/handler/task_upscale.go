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
	"strings"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"
)

const upscalePrompt = "Upscale this photograph and enhance fine details, textures, and sharpness. Preserve the original composition, subject identity, colors, lighting, and aspect ratio. Do not crop, restyle, or add new objects."

// handleUpscaleTask 通过统一图像编辑端点做超分增强，结果作为新素材归档。
func handleUpscaleTask(ctx context.Context, task model.GenerationTask, settings model.ClientSettings, gatewayModelName string) {
	var payload map[string]any
	_ = json.Unmarshal([]byte(task.InputPayload), &payload)
	imageURL, _ := payload["image_url"].(string)
	sizeStr, _ := payload["size"].(string)
	if strings.TrimSpace(imageURL) == "" {
		handleTaskFailure(task.ID, "UPSCALE_IMAGE_MISSING", "变清晰任务缺少源图")
		return
	}
	imageBytes, err := loadTaskSourceImage(task, imageURL)
	if err != nil {
		handleTaskFailure(task.ID, "UPSCALE_IMAGE_LOAD_FAILED", err.Error())
		return
	}
	if len(imageBytes) > 4_500_000 {
		imageBytes, err = compressReferenceImage(imageBytes)
		if err != nil {
			handleTaskFailure(task.ID, "UPSCALE_IMAGE_COMPRESS_FAILED", "变清晰源图压缩失败: "+err.Error())
			return
		}
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(imageBytes))
	if err != nil {
		handleTaskFailure(task.ID, "UPSCALE_IMAGE_DECODE_FAILED", "无法读取变清晰源图尺寸")
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

	progress := `{"progress_text":"AI 正在增强细节与清晰度..."}`
	database.DB.Model(&task).Update("output_payload", progress)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	imageField, err := writer.CreateFormFile("image", "source.png")
	if err != nil {
		handleTaskFailure(task.ID, "UPSCALE_REQUEST_BUILD_FAILED", "创建变清晰请求失败")
		return
	}
	_, _ = io.Copy(imageField, bytes.NewReader(imageBytes))
	_ = writer.WriteField("prompt", upscalePrompt)
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
		handleTaskFailure(task.ID, "UPSCALE_HTTP_CLIENT_ERROR", "创建变清晰请求失败: "+err.Error())
		return
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+settings.UpstreamAPIKey)

	resp, err := (&http.Client{Transport: insecureTransport, Timeout: 120 * time.Second}).Do(req)
	if err != nil {
		handleTaskFailure(task.ID, "UPSCALE_TIMEOUT", "调用变清晰网关超时: "+err.Error())
		return
	}
	defer resp.Body.Close()
	responseBytes, _ := io.ReadAll(io.LimitReader(resp.Body, maxUploadBytes()+1))
	if resp.StatusCode != http.StatusOK {
		handleTaskFailure(task.ID, fmt.Sprintf("UPSCALE_GATEWAY_%d", resp.StatusCode), upstreamErrorMessage(responseBytes, "变清晰网关调用失败"))
		return
	}

	urls := parseUpstreamImageURLs(responseBytes)
	if len(urls) == 0 {
		handleTaskFailure(task.ID, "NO_UPSCALE_RESULT", "变清晰网关未返回图片")
		return
	}
	handleTaskSuccess(task, urls[:1])
}
