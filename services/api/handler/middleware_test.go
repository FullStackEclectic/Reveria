package handler

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGetStorageDirFromRepositoryRoot(t *testing.T) {
	repositoryRoot := t.TempDir()
	serviceDir := filepath.Join(repositoryRoot, "services", "api")
	if err := os.MkdirAll(serviceDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(serviceDir, "go.mod"), []byte("module example\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	previousDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(repositoryRoot); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(previousDir) })
	t.Setenv("REVERIA_STORAGE_DIR", "storage/uploads")

	want := filepath.Join(serviceDir, "storage", "uploads")
	if got := getStorageDir(); got != want {
		t.Fatalf("getStorageDir() = %q, want %q", got, want)
	}
}

func TestGetStorageDirKeepsAbsolutePath(t *testing.T) {
	want := filepath.Join(t.TempDir(), "custom-storage")
	t.Setenv("REVERIA_STORAGE_DIR", want)

	if got := getStorageDir(); got != filepath.Clean(want) {
		t.Fatalf("getStorageDir() = %q, want %q", got, want)
	}
}
