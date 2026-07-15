package handler

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"os"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// jwtSecret 用于签发和校验 JWT 的密钥
// 优先从环境变量 JWT_SECRET 读取，否则启动时随机生成一个（仅适用于开发环境）
var jwtSecret []byte

func init() {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = os.Getenv("REVERIA_SECRET_KEY")
	}
	if secret != "" {
		if len(secret) < 24 {
			log.Fatal("[JWT] 签名密钥长度不能少于 24 字节")
		}
		jwtSecret = []byte(secret)
		log.Println("[JWT] 已加载环境变量中的签名密钥。")
	} else {
		if os.Getenv("GIN_MODE") == "release" || os.Getenv("REVERIA_ENV") == "production" {
			log.Fatal("[JWT] 生产环境必须设置 JWT_SECRET 或 REVERIA_SECRET_KEY")
		}
		// 开发模式下自动生成随机密钥
		randomBytes := make([]byte, 32)
		if _, err := rand.Read(randomBytes); err != nil {
			log.Fatalf("[JWT] 生成随机密钥失败: %v", err)
		}
		jwtSecret = randomBytes
		log.Printf("[JWT] 未设置签名密钥，已生成临时开发密钥（指纹 %s）", hex.EncodeToString(randomBytes[:4]))
		log.Println("[JWT] ⚠️  注意：每次重启服务都会生成新密钥，所有已登录用户将被迫重新登录。")
		log.Println("[JWT] ⚠️  生产环境请务必设置 JWT_SECRET 环境变量！")
	}
}

// jwtClaims 自定义 JWT Claims
type jwtClaims struct {
	UserID    string `json:"user_id"`
	SessionID string `json:"session_id"`
	TokenType string `json:"token_type"`
	jwt.RegisteredClaims
}

// accessTokenTTL Access Token 有效期
const accessTokenTTL = 15 * time.Minute

// refreshTokenTTL Refresh Token 有效期
const refreshTokenTTL = 30 * 24 * time.Hour

// GenerateAccessToken 签发一个 JWT Access Token
func GenerateAccessToken(userID, sessionID uuid.UUID) (string, error) {
	now := time.Now()
	claims := jwtClaims{
		UserID: userID.String(), SessionID: sessionID.String(), TokenType: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			ExpiresAt: jwt.NewNumericDate(now.Add(accessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "reveria-api",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// GenerateRefreshToken 签发一个 JWT Refresh Token（有效期更长）
func GenerateRefreshToken(userID, sessionID uuid.UUID) (string, error) {
	now := time.Now()
	claims := jwtClaims{
		UserID: userID.String(), SessionID: sessionID.String(), TokenType: "refresh",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			ExpiresAt: jwt.NewNumericDate(now.Add(refreshTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "reveria-api",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ParseAccessToken 校验并解析 JWT Token，返回 user_id
func parseToken(tokenStr, expectedType string) (*jwtClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &jwtClaims{}, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithIssuer("reveria-api"))

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*jwtClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}
	if claims.TokenType != expectedType || claims.ID == "" {
		return nil, errors.New("invalid token type")
	}
	return claims, nil
}

func parseTokenIDs(claims *jwtClaims) (uuid.UUID, uuid.UUID, error) {
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return uuid.Nil, uuid.Nil, errors.New("invalid user_id in token")
	}
	sessionID, err := uuid.Parse(claims.SessionID)
	if err != nil {
		return uuid.Nil, uuid.Nil, errors.New("invalid session_id in token")
	}
	return userID, sessionID, nil
}

func ParseAccessTokenDetails(tokenStr string) (uuid.UUID, uuid.UUID, error) {
	claims, err := parseToken(tokenStr, "access")
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	userID, sessionID, err := parseTokenIDs(claims)
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	var count int64
	if err := database.DB.Model(&model.AuthSession{}).
		Where("id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > ?", sessionID, userID, time.Now()).
		Count(&count).Error; err != nil || count != 1 {
		return uuid.Nil, uuid.Nil, errors.New("session expired or revoked")
	}
	return userID, sessionID, nil
}

func ParseRefreshToken(tokenStr string) (uuid.UUID, uuid.UUID, error) {
	claims, err := parseToken(tokenStr, "refresh")
	if err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	return parseTokenIDs(claims)
}

func ParseAccessToken(tokenStr string) (uuid.UUID, error) {
	userID, _, err := ParseAccessTokenDetails(tokenStr)
	return userID, err
}
