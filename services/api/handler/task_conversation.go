package handler

import (
	"encoding/json"
	"strings"

	"reveria/services/api/database"
	"reveria/services/api/model"
)

func buildConversationMessages(task model.GenerationTask, currentPrompt string) []upstreamChatMessage {
	messages := make([]upstreamChatMessage, 0, 41)
	var input struct {
		Messages []upstreamChatMessage `json:"messages"`
	}
	_ = json.Unmarshal([]byte(task.InputPayload), &input)
	if len(input.Messages) > 0 {
		start := 0
		if len(input.Messages) > 40 {
			start = len(input.Messages) - 40
		}
		for _, message := range input.Messages[start:] {
			role := strings.TrimSpace(message.Role)
			content := strings.TrimSpace(message.Content)
			if (role != "user" && role != "assistant") || content == "" {
				continue
			}
			contentRunes := []rune(content)
			if len(contentRunes) > 32768 {
				content = string(contentRunes[:32768])
			}
			messages = append(messages, upstreamChatMessage{Role: role, Content: content})
		}
	} else if task.ConversationID != nil && strings.TrimSpace(*task.ConversationID) != "" {
		var previousTasks []model.GenerationTask
		database.DB.
			Where(
				"project_id = ? AND conversation_id = ? AND task_type = ? AND status = ? AND id <> ? AND created_at < ?",
				task.ProjectID,
				*task.ConversationID,
				"text",
				"succeeded",
				task.ID,
				task.CreatedAt,
			).
			Order("created_at desc").
			Limit(20).
			Find(&previousTasks)

		for index := len(previousTasks) - 1; index >= 0; index-- {
			previous := previousTasks[index]
			var payload map[string]any
			if json.Unmarshal([]byte(previous.InputPayload), &payload) != nil {
				continue
			}
			prompt, _ := payload["prompt"].(string)
			prompt = strings.TrimSpace(prompt)
			if prompt == "" || previous.OutputPayload == nil {
				continue
			}

			var output map[string]any
			if json.Unmarshal([]byte(*previous.OutputPayload), &output) != nil {
				continue
			}
			answer, _ := output["output"].(string)
			if strings.TrimSpace(answer) == "" {
				answer, _ = output["summary"].(string)
			}
			answer = strings.TrimSpace(answer)
			if answer == "" {
				continue
			}

			messages = append(messages,
				upstreamChatMessage{Role: "user", Content: prompt},
				upstreamChatMessage{Role: "assistant", Content: answer},
			)
		}
	}

	messages = append(messages, upstreamChatMessage{Role: "user", Content: currentPrompt})
	return messages
}
