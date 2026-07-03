package main

import (
	"fmt"
	"log"
	"os"

	"reveria/services/api/database"
	"reveria/services/api/model"
)

func main() {
	os.Setenv("DATABASE_TYPE", "sqlite")
	os.Setenv("DATABASE_URL", "reveria.db")

	database.InitDatabase()

	fmt.Println("--- 1. client_settings ---")
	var settings model.ClientSettings
	if err := database.DB.First(&settings).Error; err == nil {
		fmt.Printf("BillingMode: '%s'\n", settings.BillingMode)
		fmt.Printf("UpstreamAPIURL: '%s'\n", settings.UpstreamAPIURL)
		fmt.Printf("UpstreamAPIKey: '%s'\n", settings.UpstreamAPIKey)
		fmt.Printf("BridgeMainStationURL: '%s'\n", settings.BridgeMainStationURL)
	} else {
		log.Printf("获取 client_settings 失败: %v\n", err)
	}

	fmt.Println("\n--- 2. providers ---")
	var providers []model.Provider
	if err := database.DB.Find(&providers).Error; err == nil {
		for _, p := range providers {
			fmt.Printf("ID: %s | Name: %s | ApiURL: %s | ApiKey: %s\n", p.ID, p.Name, p.ApiURL, p.ApiKey)
		}
	} else {
		log.Printf("获取 providers 失败: %v\n", err)
	}

	fmt.Println("\n--- 3. models ---")
	var models []model.Model
	if err := database.DB.Find(&models).Error; err == nil {
		for _, m := range models {
			fmt.Printf("ID: %s | Name: %s | ProviderID: %s | Enabled: %v\n", m.ID, m.Name, m.ProviderID, m.Enabled)
		}
	} else {
		log.Printf("获取 models 失败: %v\n", err)
	}

	fmt.Println("\n--- 4. prompt_templates ---")
	var templates []model.PromptTemplate
	if err := database.DB.Find(&templates).Error; err == nil {
		for _, t := range templates {
			fmt.Printf("Title: %s | ModelID: %s | WorkflowType: %s\n", t.Title, t.ModelID, t.WorkflowType)
		}
	} else {
		log.Printf("获取 prompt_templates 失败: %v\n", err)
	}
}
