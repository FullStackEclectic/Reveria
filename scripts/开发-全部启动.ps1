Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "         Reveria 全部开发服务一键启动中...        " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 启动 Go 后端 API 服务
Write-Host "正在启动 Go 后端 API 服务 (127.0.0.1:4100)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Reveria Go API Backend'; cd services/api; go run main.go"

# 启动网页端 Next.js 服务器
Write-Host "正在启动 Next.js 网页端与后台主站 (localhost:3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Reveria Web-Next Console'; cd apps/web-next; pnpm dev"

# 启动 Wails 桌面端开发环境
Write-Host "正在启动 Wails 桌面客户端热调试窗口 (localhost:1420)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$Host.UI.RawUI.WindowTitle='Reveria Desktop Window (Wails)'; cd apps/desktop; wails dev"

Write-Host "`n启动完成！已在新窗口中拉起以下服务：" -ForegroundColor Green
Write-Host "1. 后端 API 服务 -> 监听 4100 端口" -ForegroundColor Green
Write-Host "2. 网页端 & 管理后台 -> 访问 http://localhost:3000" -ForegroundColor Green
Write-Host "3. Wails 桌面外壳 -> 弹窗桌面应用视窗" -ForegroundColor Green
