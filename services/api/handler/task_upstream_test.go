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
