package handler

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log"
	"os"
	"time"

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
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

// accessTokenTTL Access Token 有效期
const accessTokenTTL = 24 * time.Hour

// refreshTokenTTL Refresh Token 有效期
const refreshTokenTTL = 7 * 24 * time.Hour

// GenerateAccessToken 签发一个 JWT Access Token
func GenerateAccessToken(userID uuid.UUID) (string, error) {
	claims := jwtClaims{
		UserID: userID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(accessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "reveria-api",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// GenerateRefreshToken 签发一个 JWT Refresh Token（有效期更长）
func GenerateRefreshToken(userID uuid.UUID) (string, error) {
	claims := jwtClaims{
		UserID: userID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(refreshTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "reveria-api",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

// ParseAccessToken 校验并解析 JWT Token，返回 user_id
func ParseAccessToken(tokenStr string) (uuid.UUID, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &jwtClaims{}, func(token *jwt.Token) (any, error) {
		// 确认签名算法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret, nil
	})

	if err != nil {
		return uuid.Nil, err
	}

	claims, ok := token.Claims.(*jwtClaims)
	if !ok || !token.Valid {
		return uuid.Nil, errors.New("invalid token claims")
	}

	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return uuid.Nil, errors.New("invalid user_id in token")
	}

	return userID, nil
}
