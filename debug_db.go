package main

import (
	"fmt"
	"log"
	"os"

	"reveria/services/api/database"
	"reveria/services/api/model"
)

func main() {
	// 设置环境变量
	os.Setenv("DATABASE_TYPE", "sqlite")
	os.Setenv("DATABASE_URL", "services/api/reveria.db")

	database.InitDatabase()

	fmt.Println("=== 数据库调试信息 ===")

	// 1. 用户
	var users []model.User
	database.DB.Limit(5).Find(&users)
	fmt.Printf("用户数: %d\n", len(users))
	for _, u := range users {
		email := ""
		if u.Email != nil {
			email = *u.Email
		}
		fmt.Printf(" - ID: %s, Email: %s, Admin: %v\n", u.ID, email, u.IsPlatformAdmin)
	}

	// 2. 工作区
	var workspaces []model.Workspace
	database.DB.Find(&workspaces)
	fmt.Printf("\n工作区数: %d\n", len(workspaces))
	for _, ws := range workspaces {
		fmt.Printf(" - ID: %s, Name: %s, Recharge: %d, Gift: %d, Refund: %d\n",
			ws.ID, ws.Name, ws.RechargeBalance, ws.GiftBalance, ws.RefundBalance)
	}

	// 3. 模型
	var models []model.Model
	database.DB.Find(&models)
	fmt.Printf("\n模型数: %d\n", len(models))
	for _, m := range models {
		fmt.Printf(" - ID: %s, Name: %s, Cost: %f, Method: %s, Enabled: %v\n",
			m.ID, m.Name, m.CreditsCost, m.BillingMethod, m.Enabled)
	}

	// 4. 最近的任务
	var tasks []model.GenerationTask
	database.DB.Order("created_at desc").Limit(5).Find(&tasks)
	fmt.Printf("\n最近 5 个生成任务:\n")
	for _, t := range tasks {
		modelName := ""
		if t.SelectedModel != nil {
			modelName = *t.SelectedModel
		}
		errMsg := ""
		if t.ErrorMessage != nil {
			errMsg = *t.ErrorMessage
		}
		fmt.Printf(" - ID: %s, Status: %s, Model: %s, Est: %d, Frozen: %d, Created: %s, Err: %s\n",
			t.ID, t.Status, modelName, t.EstimatedCredits, t.FrozenCredits, t.CreatedAt.Format("15:04:05"), errMsg)
	}

	// 5. 最近的流水记录
	var txs []model.CreditTransaction
	database.DB.Order("created_at desc").Limit(5).Find(&txs)
	fmt.Printf("\n最近 5 笔交易流水:\n")
	for _, tx := range txs {
		reason := ""
		if tx.Reason != nil {
			reason = *tx.Reason
		}
		fmt.Printf(" - ID: %s, WS: %s, Type: %s, Amount: %d, Reason: %s\n",
			tx.ID, tx.WorkspaceID, tx.TransactionType, tx.Amount, reason)
	}
}
