package handler

import (
	"encoding/base64"
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
