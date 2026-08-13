package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"
)

// pollUpstreamTask 轮询 12ZX-AI 异步任务进度
func pollUpstreamTask(ctx context.Context, task model.GenerationTask, upstreamTaskID string, settings model.ClientSettings) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	timeout := time.NewTimer(15 * time.Minute) // 视频生成最长等待 15 分钟
	defer timeout.Stop()

	pollURL := fmt.Sprintf("%s/v1/tasks/%s", settings.UpstreamAPIURL, upstreamTaskID)

	for {
		select {
		case <-ctx.Done():
			return
		case <-timeout.C:
			handleTaskFailure(task.ID, "TIMEOUT", "生成任务等待超时")
			return
		case <-ticker.C:
			if !renewTaskLease(task.ID) {
				return
			}
			req, err := http.NewRequestWithContext(ctx, "GET", pollURL, nil)
			if err != nil {
				continue
			}
			req.Header.Set("Authorization", "Bearer "+settings.UpstreamAPIKey)

			client := &http.Client{
				Transport: insecureTransport,
				Timeout:   10 * time.Second,
			}
			resp, err := client.Do(req)
			if err != nil {
				continue
			}

			respBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				if resp.StatusCode == http.StatusPaymentRequired {
					failTaskFromUpstream(task.ID, resp.StatusCode, fmt.Sprintf("GATEWAY_%d", resp.StatusCode), upstreamCircuitMessage)
					return
				}
				continue
			}

			var taskData map[string]any
			if err := json.Unmarshal(respBytes, &taskData); err != nil {
				continue
			}

			status, _ := taskData["status"].(string)
			// 12ZX-AI 状态一般是 success / failed / processing
			if status == "success" || status == "succeeded" {
				var urls []string
				if resURL, ok := taskData["result_url"].(string); ok && resURL != "" {
					urls = append(urls, resURL)
				} else if dataList, ok := taskData["data"].([]any); ok && len(dataList) > 0 {
					for _, item := range dataList {
						if m, ok := item.(map[string]any); ok {
							if u, _ := m["url"].(string); u != "" {
								urls = append(urls, u)
							}
						}
					}
				}
				if len(urls) > 0 {
					handleTaskSuccess(task, urls)
					return
				}
			} else if status == "failed" || status == "fail" {
				reason, _ := taskData["error_message"].(string)
				if reason == "" {
					reason, _ = taskData["message"].(string)
				}
				handleTaskFailure(task.ID, "GATEWAY_TASK_FAILED", "上游厂商生成失败: "+reason)
				return
			} else {
				progressText := "上游正在努力渲染多图场景中，请稍候..."
				if pct, ok := taskData["progress"].(float64); ok {
					progressText = fmt.Sprintf("AI 正在绘制画面 (进度 %.0f%%)...", pct)
				} else if pctStr, ok := taskData["progress"].(string); ok {
					progressText = fmt.Sprintf("AI 正在绘制画面 (进度 %s)...", pctStr)
				}
				progressJSON := fmt.Sprintf(`{"progress_text":%q}`, progressText)
				database.DB.Model(&model.GenerationTask{}).
					Where("id = ? AND status = ? AND worker_id = ?", task.ID, "running", taskWorkerID).
					Update("output_payload", progressJSON)
			}
		}
	}
}
