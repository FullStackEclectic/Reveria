package handler

import (
	"encoding/json"
	"testing"
)

func TestNormalizeTemplateExecutionConfig(t *testing.T) {
	raw := `{
		"version": 1,
		"operation": "image-to-image",
		"output_mode": "scenes",
		"reference_mode": "required",
		"max_outputs": 12,
		"scenes": [{"id":"main","title":"主图","prompt":"突出产品"}]
	}`

	normalized, needImage, err := normalizeTemplateExecutionConfig(raw, "image-generation", 0)
	if err != nil {
		t.Fatal(err)
	}
	if needImage != 1 {
		t.Fatalf("needImage = %d, want 1", needImage)
	}
	var config templateExecutionConfig
	if err := json.Unmarshal([]byte(normalized), &config); err != nil {
		t.Fatal(err)
	}
	if config.OutputMode != "scenes" || len(config.Scenes) != 1 {
		t.Fatalf("unexpected normalized config: %+v", config)
	}
}

func TestNormalizeTemplateExecutionConfigRejectsImageEditWithoutReference(t *testing.T) {
	raw := `{"version":1,"operation":"image-edit","output_mode":"single","reference_mode":"none","max_outputs":1,"scenes":[]}`
	if _, _, err := normalizeTemplateExecutionConfig(raw, "image-generation", 0); err == nil {
		t.Fatal("expected image-edit config without a required reference to fail")
	}
}
