package handler

import (
	"fmt"
	"strings"
)

type generationScene struct {
	ID     string
	Title  string
	Prompt string
}

func parseGenerationScenes(payload map[string]any) []generationScene {
	rawScenes, ok := payload["scenes"].([]any)
	if !ok {
		return nil
	}

	scenes := make([]generationScene, 0, len(rawScenes))
	for _, rawScene := range rawScenes {
		sceneMap, ok := rawScene.(map[string]any)
		if !ok {
			continue
		}
		scene := generationScene{
			ID:     strings.TrimSpace(stringValue(sceneMap["id"])),
			Title:  strings.TrimSpace(stringValue(sceneMap["title"])),
			Prompt: strings.TrimSpace(stringValue(sceneMap["prompt"])),
		}
		if scene.Title == "" || scene.Prompt == "" {
			continue
		}
		if scene.ID == "" {
			scene.ID = fmt.Sprintf("scene-%d", len(scenes)+1)
		}
		scenes = append(scenes, scene)
		if len(scenes) == 16 {
			break
		}
	}
	return scenes
}

func buildScenePrompt(globalPrompt string, scene generationScene) string {
	parts := make([]string, 0, 3)
	if prompt := strings.TrimSpace(globalPrompt); prompt != "" {
		parts = append(parts, prompt)
	}
	parts = append(parts, fmt.Sprintf("当前场景：%s。%s", scene.Title, scene.Prompt))
	parts = append(parts, "仅生成一张完整画面，禁止拼图、多格和组图")
	return strings.Join(parts, "\n")
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return fmt.Sprint(value)
}
