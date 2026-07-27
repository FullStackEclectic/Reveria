package handler

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"testing"

	"github.com/google/uuid"
	"reveria/services/api/model"
)

func TestDecodeImageDataURL(t *testing.T) {
	payload := base64.StdEncoding.EncodeToString([]byte("image-bytes"))
	decoded, mimeType, err := decodeImageDataURL("data:image/png;base64," + payload)
	if err != nil {
		t.Fatal(err)
	}
	if string(decoded) != "image-bytes" || mimeType != "image/png" {
		t.Fatalf("decoded=%q mime=%q", decoded, mimeType)
	}
}

func TestValidateTransparentPNG(t *testing.T) {
	transparent := image.NewNRGBA(image.Rect(0, 0, 2, 2))
	transparent.SetNRGBA(0, 0, color.NRGBA{R: 255, A: 255})
	var transparentPNG bytes.Buffer
	if err := png.Encode(&transparentPNG, transparent); err != nil {
		t.Fatal(err)
	}
	if err := validateTransparentPNG(transparentPNG.Bytes()); err != nil {
		t.Fatalf("透明 PNG 被拒绝: %v", err)
	}

	opaque := image.NewNRGBA(image.Rect(0, 0, 2, 2))
	for y := 0; y < 2; y++ {
		for x := 0; x < 2; x++ {
			opaque.SetNRGBA(x, y, color.NRGBA{R: 255, G: 255, B: 255, A: 255})
		}
	}
	var opaquePNG bytes.Buffer
	if err := png.Encode(&opaquePNG, opaque); err != nil {
		t.Fatal(err)
	}
	if err := validateTransparentPNG(opaquePNG.Bytes()); err == nil {
		t.Fatal("不透明 PNG 不应通过抠图结果校验")
	}
}

func TestParseUpstreamImageURLs(t *testing.T) {
	urls := parseUpstreamImageURLs([]byte(`{"data":[{"url":"https://example.com/a.png"},{"b64_json":"YWJj"}]}`))
	if len(urls) != 2 || urls[0] != "https://example.com/a.png" || urls[1] != "data:image/png;base64,YWJj" {
		t.Fatalf("解析结果异常: %#v", urls)
	}
}

func TestBackgroundRemovalSize(t *testing.T) {
	cases := []struct {
		width, height int
		want          string
	}{
		{1600, 900, "1536x1024"},
		{900, 1600, "1024x1536"},
		{1200, 1100, "1024x1024"},
	}
	for _, testCase := range cases {
		if got := backgroundRemovalSize(testCase.width, testCase.height); got != testCase.want {
			t.Fatalf("backgroundRemovalSize(%d, %d) = %q, want %q", testCase.width, testCase.height, got, testCase.want)
		}
	}
}

func TestValidateCutoutAspect(t *testing.T) {
	cutout := image.NewNRGBA(image.Rect(0, 0, 300, 200))
	var data bytes.Buffer
	if err := png.Encode(&data, cutout); err != nil {
		t.Fatal(err)
	}
	if err := validateCutoutAspect(data.Bytes(), map[string]any{"source_width": 1500.0, "source_height": 1000.0}); err != nil {
		t.Fatalf("同比例结果被拒绝: %v", err)
	}
	if err := validateCutoutAspect(data.Bytes(), map[string]any{"source_width": 1000.0, "source_height": 1000.0}); err == nil {
		t.Fatal("宽高比失配的结果不应通过校验")
	}
}

func TestCompressReferenceImage(t *testing.T) {
	source := image.NewRGBA(image.Rect(0, 0, 2400, 1200))
	for y := 0; y < 1200; y++ {
		for x := 0; x < 2400; x++ {
			source.SetRGBA(x, y, color.RGBA{R: uint8(x), G: uint8(y), B: uint8(x + y), A: 255})
		}
	}
	var input bytes.Buffer
	if err := png.Encode(&input, source); err != nil {
		t.Fatal(err)
	}
	compressed, err := compressReferenceImage(input.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	decoded, format, err := image.Decode(bytes.NewReader(compressed))
	if err != nil {
		t.Fatal(err)
	}
	if format != "jpeg" || decoded.Bounds().Dx() != 2048 || decoded.Bounds().Dy() != 1024 {
		t.Fatalf("compressed format=%s size=%dx%d", format, decoded.Bounds().Dx(), decoded.Bounds().Dy())
	}
}

func TestExtensionForGeneratedContent(t *testing.T) {
	imageTask := model.GenerationTask{ID: uuid.New(), TaskType: "image_generation"}
	if got := extensionForGeneratedContent(imageTask, "image/png", []byte{}); got != ".png" {
		t.Fatalf("png extension = %q", got)
	}
	videoTask := model.GenerationTask{ID: uuid.New(), TaskType: "video_generation"}
	if got := extensionForGeneratedContent(videoTask, "video/mp4", []byte{}); got != ".mp4" {
		t.Fatalf("video extension = %q", got)
	}
}
