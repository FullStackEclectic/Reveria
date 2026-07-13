package model

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"strings"

	"gorm.io/gorm"
)

const encryptedSecretPrefix = "enc:v1:"

func secretKey() []byte {
	value := os.Getenv("REVERIA_SECRET_KEY")
	if value == "" {
		value = os.Getenv("JWT_SECRET")
	}
	if value == "" {
		return nil
	}
	sum := sha256.Sum256([]byte(value))
	return sum[:]
}

func SecretEncryptionConfigured() bool {
	return len(secretKey()) > 0
}

func encryptSecret(value string) (string, error) {
	if value == "" || strings.HasPrefix(value, encryptedSecretPrefix) || len(secretKey()) == 0 {
		return value, nil
	}
	block, err := aes.NewCipher(secretKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}
	ciphertext := gcm.Seal(nonce, nonce, []byte(value), nil)
	return encryptedSecretPrefix + base64.RawStdEncoding.EncodeToString(ciphertext), nil
}

func decryptSecret(value string) (string, error) {
	if !strings.HasPrefix(value, encryptedSecretPrefix) {
		return value, nil
	}
	if len(secretKey()) == 0 {
		return "", fmt.Errorf("缺少数据库密钥解密配置")
	}
	payload, err := base64.RawStdEncoding.DecodeString(strings.TrimPrefix(value, encryptedSecretPrefix))
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(secretKey())
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil || len(payload) < gcm.NonceSize() {
		return "", fmt.Errorf("密钥密文格式不合法")
	}
	returnValue, err := gcm.Open(nil, payload[:gcm.NonceSize()], payload[gcm.NonceSize():], nil)
	return string(returnValue), err
}

func (provider *Provider) BeforeSave(_ *gorm.DB) error {
	encrypted, err := encryptSecret(provider.ApiKey)
	provider.ApiKey = encrypted
	return err
}

func (provider *Provider) AfterFind(_ *gorm.DB) error {
	decrypted, err := decryptSecret(provider.ApiKey)
	provider.ApiKey = decrypted
	return err
}

func (settings *ClientSettings) BeforeSave(_ *gorm.DB) error {
	upstream, err := encryptSecret(settings.UpstreamAPIKey)
	if err != nil {
		return err
	}
	bridge, err := encryptSecret(settings.BridgeInternalSecret)
	settings.UpstreamAPIKey = upstream
	settings.BridgeInternalSecret = bridge
	return err
}

func (settings *ClientSettings) AfterFind(_ *gorm.DB) error {
	upstream, err := decryptSecret(settings.UpstreamAPIKey)
	if err != nil {
		return err
	}
	bridge, err := decryptSecret(settings.BridgeInternalSecret)
	settings.UpstreamAPIKey = upstream
	settings.BridgeInternalSecret = bridge
	return err
}
