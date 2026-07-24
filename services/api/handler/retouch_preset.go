package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

const maxRetouchPresetSettingsBytes = 64 * 1024

type saveRetouchPresetRequest struct {
	Name     string          `json:"name"`
	Settings json.RawMessage `json:"settings"`
}

type retouchPresetResponse struct {
	ID        uuid.UUID       `json:"id"`
	Name      string          `json:"name"`
	Settings  json.RawMessage `json:"settings"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

func validateRetouchPresetPayload(req saveRetouchPresetRequest) (string, string, error) {
	name := strings.TrimSpace(req.Name)
	if name == "" || utf8.RuneCountInString(name) > 80 {
		return "", "", errors.New("预设名称不能为空且不能超过 80 个字符")
	}
	if len(req.Settings) == 0 || len(req.Settings) > maxRetouchPresetSettingsBytes {
		return "", "", errors.New("预设参数为空或过大")
	}
	var settings map[string]any
	if err := json.Unmarshal(req.Settings, &settings); err != nil || settings == nil {
		return "", "", errors.New("预设参数必须是 JSON 对象")
	}
	return name, string(req.Settings), nil
}

func presetResponse(preset model.RetouchPreset) retouchPresetResponse {
	return retouchPresetResponse{
		ID:        preset.ID,
		Name:      preset.Name,
		Settings:  json.RawMessage(preset.SettingsJSON),
		CreatedAt: preset.CreatedAt,
		UpdatedAt: preset.UpdatedAt,
	}
}

// ListRetouchPresets 返回当前用户的全部自定义修图预设。
func ListRetouchPresets(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var presets []model.RetouchPreset
	if err := database.DB.Where("user_id = ?", userID).Order("updated_at desc").Find(&presets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "读取修图预设失败"})
		return
	}
	items := make([]retouchPresetResponse, 0, len(presets))
	for _, preset := range presets {
		if json.Valid([]byte(preset.SettingsJSON)) {
			items = append(items, presetResponse(preset))
		}
	}
	c.JSON(http.StatusOK, gin.H{"presets": items})
}

// SaveRetouchPreset 按名称新建或更新当前用户的修图预设。
func SaveRetouchPreset(c *gin.Context) {
	var req saveRetouchPresetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "输入参数有误"})
		return
	}
	name, settingsJSON, err := validateRetouchPresetPayload(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)
	now := time.Now()
	var preset model.RetouchPreset
	err = database.DB.Where("user_id = ? AND name = ?", userID, name).First(&preset).Error
	status := http.StatusOK
	if errors.Is(err, gorm.ErrRecordNotFound) {
		preset = model.RetouchPreset{
			ID: uuid.New(), UserID: userID, Name: name, SettingsJSON: settingsJSON,
			CreatedAt: now, UpdatedAt: now,
		}
		status = http.StatusCreated
		if err := database.DB.Create(&preset).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "创建修图预设失败"})
			return
		}
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "读取修图预设失败"})
		return
	} else {
		preset.SettingsJSON = settingsJSON
		preset.UpdatedAt = now
		if err := database.DB.Save(&preset).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新修图预设失败"})
			return
		}
	}
	c.JSON(status, presetResponse(preset))
}

// DeleteRetouchPreset 删除当前用户拥有的指定修图预设。
func DeleteRetouchPreset(c *gin.Context) {
	presetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "预设 ID 格式错误"})
		return
	}
	userID := c.MustGet("user_id").(uuid.UUID)
	result := database.DB.Where("id = ? AND user_id = ?", presetID, userID).Delete(&model.RetouchPreset{})
	if result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除修图预设失败"})
		return
	}
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到修图预设"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
