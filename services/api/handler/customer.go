package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"reveria/services/api/database"
	"reveria/services/api/model"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// CreateCustomerRequest 客户创建载荷
type CreateCustomerRequest struct {
	WorkspaceID uuid.UUID       `json:"workspace_id" binding:"required"`
	Name        string          `json:"name" binding:"required"`
	Industry    *string         `json:"industry"`
	ContactName *string         `json:"contact_name"`
	ContactInfo json.RawMessage `json:"contact_info"`
	Notes       *string         `json:"notes"`
}

// UpdateCustomerRequest 客户更新载荷
type UpdateCustomerRequest struct {
	Name        string          `json:"name" binding:"required"`
	Industry    *string         `json:"industry"`
	ContactName *string         `json:"contact_name"`
	ContactInfo json.RawMessage `json:"contact_info"`
	Notes       *string         `json:"notes"`
}

// ListCustomers 获取客户列表 (GET /customers)
func ListCustomers(c *gin.Context) {
	actorID := c.MustGet("user_id").(uuid.UUID)
	workspaceIDStr := c.Query("workspace_id")
	var workspaceID uuid.UUID
	var err error

	if workspaceIDStr == "" {
		// 自动获取该用户加入的第一个工作区以兼容前端并行初始化
		var memberRelation model.WorkspaceMember
		if err := database.DB.Where("user_id = ? AND status = 'joined'", actorID).First(&memberRelation).Error; err != nil {
			c.JSON(http.StatusOK, []model.Customer{})
			return
		}
		workspaceID = memberRelation.WorkspaceID
	} else {
		workspaceID, err = uuid.Parse(workspaceIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "工作区 ID 格式有误"})
			return
		}
	}

	if !hasWorkspaceRole(workspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权访问此工作区"})
		return
	}

	var customers []model.Customer
	if err := database.DB.Where("workspace_id = ?", workspaceID).Find(&customers).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "获取客户列表失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, customers)
}

// CreateCustomer 创建客户 (POST /customers)
func CreateCustomer(c *gin.Context) {
	var req CreateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入参数不合法"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	if !hasWorkspaceRole(req.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限在此工作区创建客户"})
		return
	}

	var contactInfoStr *string
	if len(req.ContactInfo) > 0 {
		s := string(req.ContactInfo)
		contactInfoStr = &s
	}

	customer := model.Customer{
		ID:          uuid.New(),
		WorkspaceID: req.WorkspaceID,
		Name:        req.Name,
		Industry:    req.Industry,
		ContactName: req.ContactName,
		ContactInfo: contactInfoStr,
		Notes:       req.Notes,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := database.DB.Create(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "保存客户数据失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, customer)
}

// GetCustomer 获取单个客户详情 (GET /customers/:id)
func GetCustomer(c *gin.Context) {
	customerIDStr := c.Param("id")
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "客户 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var customer model.Customer
	if err := database.DB.Where("id = ?", customerID).First(&customer).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定客户"})
		return
	}

	if !hasWorkspaceRole(customer.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限查看该客户详情"})
		return
	}

	c.JSON(http.StatusOK, customer)
}

// UpdateCustomer 更新客户 (PUT /customers/:id)
func UpdateCustomer(c *gin.Context) {
	customerIDStr := c.Param("id")
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "客户 ID 格式有误"})
		return
	}

	var req UpdateCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "请求输入参数不合法"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var customer model.Customer
	if err := database.DB.Where("id = ?", customerID).First(&customer).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定客户"})
		return
	}

	if !hasWorkspaceRole(customer.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限修改该客户资料"})
		return
	}

	var contactInfoStr *string
	if len(req.ContactInfo) > 0 {
		s := string(req.ContactInfo)
		contactInfoStr = &s
	}

	customer.Name = req.Name
	customer.Industry = req.Industry
	customer.ContactName = req.ContactName
	customer.ContactInfo = contactInfoStr
	customer.Notes = req.Notes
	customer.UpdatedAt = time.Now()

	if err := database.DB.Save(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "更新客户资料失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, customer)
}

// DeleteCustomer 删除客户 (DELETE /customers/:id)
func DeleteCustomer(c *gin.Context) {
	customerIDStr := c.Param("id")
	customerID, err := uuid.Parse(customerIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "客户 ID 格式有误"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)

	var customer model.Customer
	if err := database.DB.Where("id = ?", customerID).First(&customer).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "未找到指定客户"})
		return
	}

	if !hasWorkspaceRole(customer.WorkspaceID, actorID, []string{"owner", "admin", "member"}) {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "无权限删除该客户"})
		return
	}

	if err := database.DB.Delete(&customer).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "删除客户失败: " + err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
