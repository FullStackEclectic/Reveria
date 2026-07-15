package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
)

func TestDownloadAssetToCacheReusesLocalMaterial(t *testing.T) {
	cacheRoot := t.TempDir()
	t.Setenv("LOCALAPPDATA", cacheRoot)
	t.Setenv("XDG_CACHE_HOME", cacheRoot)

	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		w.Header().Set("Content-Type", "image/jpeg")
		_, _ = w.Write([]byte("image-content"))
	}))
	defer server.Close()

	firstPath, err := downloadAssetToCache(server.URL + "/api/files/material.jpg?access_token=first")
	if err != nil {
		t.Fatal(err)
	}
	secondPath, err := downloadAssetToCache(server.URL + "/api/files/material.jpg?access_token=refreshed")
	if err != nil {
		t.Fatal(err)
	}
	if firstPath != secondPath {
		t.Fatalf("同一云端素材生成了不同缓存路径: %s != %s", firstPath, secondPath)
	}
	if requests.Load() != 1 {
		t.Fatalf("云端素材请求次数 = %d, want 1", requests.Load())
	}
	if data, err := os.ReadFile(firstPath); err != nil || string(data) != "image-content" {
		t.Fatalf("缓存素材内容异常: %q, err=%v", data, err)
	}
	wantDir := filepath.Join(cacheRoot, "Reveria", "assets")
	if filepath.Dir(firstPath) != wantDir {
		t.Fatalf("缓存目录 = %s, want %s", filepath.Dir(firstPath), wantDir)
	}
}
