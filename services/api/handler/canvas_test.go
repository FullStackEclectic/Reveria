package handler

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func TestValidateProjectCanvasAcceptsFullDocument(t *testing.T) {
	// 一份带画板、画框、连线与视口信息的完整文档必须整体通过校验。
	canvas := json.RawMessage(`{
		"version": 1,
		"items": [
			{"id": "a", "type": "asset", "title": "图", "x": 0, "y": 0, "w": 180, "h": 140},
			{"id": "b", "type": "note", "title": "备注", "x": 10, "y": 10, "w": 220, "h": 140},
			{"id": "c", "type": "frame", "title": "画框", "x": -500, "y": -500, "w": 480, "h": 360}
		],
		"boards": [{"id": "default", "name": "主画板"}],
		"activeBoardId": "default",
		"connections": [{"id": "conn-1", "fromItemId": "a", "toItemId": "b"}],
		"panX": -120.5,
		"panY": 88,
		"zoom": 0.75
	}`)

	ok, reason := validateProjectCanvas(canvas)
	if !ok {
		t.Fatalf("完整画布文档应通过校验，却被拒绝：%s", reason)
	}
}

func TestValidateProjectCanvasRejectsMalformedDocuments(t *testing.T) {
	cases := []struct {
		name        string
		canvas      string
		wantMessage string
	}{
		{
			name:        "非 JSON 对象",
			canvas:      `[1, 2, 3]`,
			wantMessage: "合法的 JSON 对象",
		},
		{
			name:        "缺少 version",
			canvas:      `{"items": []}`,
			wantMessage: "缺少 version",
		},
		{
			name:        "version 不为 1",
			canvas:      `{"version": 2, "items": []}`,
			wantMessage: "版本号不受支持",
		},
		{
			name:        "version 为字符串",
			canvas:      `{"version": "1", "items": []}`,
			wantMessage: "版本号不受支持",
		},
		{
			name:        "缺少 items",
			canvas:      `{"version": 1}`,
			wantMessage: "缺少 items",
		},
		{
			name:        "items 不是数组",
			canvas:      `{"version": 1, "items": {"a": 1}}`,
			wantMessage: "items 字段必须是数组",
		},
		{
			name:        "boards 不是数组",
			canvas:      `{"version": 1, "items": [], "boards": "default"}`,
			wantMessage: "boards 字段必须是数组",
		},
		{
			name:        "connections 不是数组",
			canvas:      `{"version": 1, "items": [], "connections": 5}`,
			wantMessage: "connections 字段必须是数组",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ok, reason := validateProjectCanvas(json.RawMessage(tc.canvas))
			if ok {
				t.Fatalf("非法画布 %q 不应通过校验", tc.canvas)
			}
			if !strings.Contains(reason, tc.wantMessage) {
				t.Fatalf("拒绝原因 = %q, 期望包含 %q", reason, tc.wantMessage)
			}
		})
	}
}

func TestValidateProjectCanvasAllowsOmittedOptionalArrays(t *testing.T) {
	// boards / connections 是可选字段，缺失或显式为 null 都应放行。
	for _, canvas := range []string{
		`{"version": 1, "items": []}`,
		`{"version": 1, "items": [], "boards": null, "connections": null}`,
	} {
		ok, reason := validateProjectCanvas(json.RawMessage(canvas))
		if !ok {
			t.Fatalf("画布 %q 应通过校验，却被拒绝：%s", canvas, reason)
		}
	}
}

func TestValidateProjectCanvasRejectsTooManyItems(t *testing.T) {
	items := make([]string, 0, canvasItemLimit+1)
	for i := 0; i <= canvasItemLimit; i++ {
		items = append(items, fmt.Sprintf(`{"id":"i%d","type":"note","title":"n","x":0,"y":0,"w":100,"h":100}`, i))
	}
	canvas := fmt.Sprintf(`{"version": 1, "items": [%s]}`, strings.Join(items, ","))

	ok, reason := validateProjectCanvas(json.RawMessage(canvas))
	if ok {
		t.Fatalf("元素数量 %d 超过上限 %d，不应通过校验", canvasItemLimit+1, canvasItemLimit)
	}
	if !strings.Contains(reason, "超过上限") {
		t.Fatalf("拒绝原因 = %q, 期望包含 %q", reason, "超过上限")
	}
}

func TestValidateProjectCanvasRejectsOversizedPayload(t *testing.T) {
	// 体积检查必须发生在 json.Unmarshal 之前，避免超大载荷先被完整解析进内存。
	filler := strings.Repeat("x", canvasMaxBytes)
	canvas := fmt.Sprintf(`{"version": 1, "items": [], "note": %q}`, filler)

	ok, reason := validateProjectCanvas(json.RawMessage(canvas))
	if ok {
		t.Fatal("超过体积上限的画布不应通过校验")
	}
	if !strings.Contains(reason, "过大") {
		t.Fatalf("拒绝原因 = %q, 期望包含 %q", reason, "过大")
	}
}

func TestValidateProjectCanvasItemLimitMatchesFrontend(t *testing.T) {
	// 前端 packages/shared/src/utils.ts 的 CANVAS_ITEM_LIMIT 必须与这里一致，
	// 否则前端放行的文档会在保存时被后端拒绝。
	if canvasItemLimit != 2000 {
		t.Fatalf("canvasItemLimit = %d, 需与前端 CANVAS_ITEM_LIMIT 同步更新", canvasItemLimit)
	}
}
