package handler

import (
	"strings"
	"testing"
)

func TestParseGenerationScenes(t *testing.T) {
	payload := map[string]any{
		"scenes": []any{
			map[string]any{"id": "main", "title": "主图", "prompt": "突出产品"},
			map[string]any{"title": "细节图", "prompt": "展示工艺"},
			map[string]any{"title": "", "prompt": "应该被跳过"},
		},
	}

	scenes := parseGenerationScenes(payload)
	if len(scenes) != 2 {
		t.Fatalf("parseGenerationScenes() returned %d scenes, want 2", len(scenes))
	}
	if scenes[1].ID != "scene-2" {
		t.Fatalf("generated scene id = %q, want scene-2", scenes[1].ID)
	}
}

func TestBuildScenePrompt(t *testing.T) {
	prompt := buildScenePrompt("锁定产品结构", generationScene{Title: "白底图", Prompt: "纯白背景"})
	for _, expected := range []string{"锁定产品结构", "当前场景：白底图", "纯白背景", "禁止拼图"} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("buildScenePrompt() missing %q: %s", expected, prompt)
		}
	}
}
