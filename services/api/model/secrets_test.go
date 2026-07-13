package model

import (
	"strings"
	"testing"
)

func TestSecretEncryptionRoundTrip(t *testing.T) {
	t.Setenv("REVERIA_SECRET_KEY", "0123456789abcdef0123456789abcdef")
	encrypted, err := encryptSecret("provider-secret")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(encrypted, encryptedSecretPrefix) || strings.Contains(encrypted, "provider-secret") {
		t.Fatalf("密钥没有正确加密: %q", encrypted)
	}
	decrypted, err := decryptSecret(encrypted)
	if err != nil {
		t.Fatal(err)
	}
	if decrypted != "provider-secret" {
		t.Fatalf("解密结果 = %q", decrypted)
	}
}
