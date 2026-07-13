package handler

import (
	"net"
	"net/url"
	"os"
	"strconv"
	"strings"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func isSafeRemoteURL(rawURL string) bool {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil {
		return false
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return false
	}
	addresses, err := net.LookupIP(host)
	if err != nil || len(addresses) == 0 {
		return false
	}
	for _, address := range addresses {
		if address.IsLoopback() || address.IsPrivate() || address.IsLinkLocalUnicast() || address.IsUnspecified() || address.IsMulticast() {
			return false
		}
	}
	return true
}

func storedFileNameFromURL(rawURL string) (string, bool) {
	parsed, err := url.Parse(rawURL)
	if err != nil || !strings.HasPrefix(parsed.Path, "/api/files/") {
		return "", false
	}
	name := strings.TrimPrefix(parsed.Path, "/api/files/")
	if name == "" || strings.ContainsAny(name, `/\\`) || strings.Contains(name, "..") {
		return "", false
	}
	return name, true
}

const defaultMaxUploadBytes int64 = 100 * 1024 * 1024

func maxUploadBytes() int64 {
	if raw := os.Getenv("REVERIA_MAX_UPLOAD_BYTES"); raw != "" {
		if value, err := strconv.ParseInt(raw, 10, 64); err == nil && value > 0 {
			return value
		}
	}
	return defaultMaxUploadBytes
}

func reserveStorage(workspaceID uuid.UUID, size int64) bool {
	if size <= 0 {
		return true
	}
	result := database.DB.Model(&model.Workspace{}).
		Where("id = ? AND (storage_quota = 0 OR storage_used + ? <= storage_quota)", workspaceID, size).
		UpdateColumn("storage_used", gorm.Expr("storage_used + ?", size))
	return result.Error == nil && result.RowsAffected == 1
}

func releaseStorage(workspaceID uuid.UUID, size int64) {
	if size <= 0 {
		return
	}
	database.DB.Model(&model.Workspace{}).Where("id = ?", workspaceID).
		UpdateColumn("storage_used", gorm.Expr("CASE WHEN storage_used >= ? THEN storage_used - ? ELSE 0 END", size, size))
}
