Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "         Reveria 本地运行环境健康度检查           " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. 软件环境检查
$go = Get-Command go -ErrorAction SilentlyContinue
$node = Get-Command node -ErrorAction SilentlyContinue
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
$wails = Get-Command wails -ErrorAction SilentlyContinue

if ($go) { Write-Host "[✓] Go: $(go version)" -ForegroundColor Green } else { Write-Warning "[✗] 未找到 Go" }
if ($node) { Write-Host "[✓] Node: $(node -v)" -ForegroundColor Green } else { Write-Warning "[✗] 未找到 Node" }
if ($pnpm) { Write-Host "[✓] pnpm: v$(pnpm -v)" -ForegroundColor Green } else { Write-Warning "[✗] 未找到 pnpm" }
if ($wails) { Write-Host "[✓] Wails CLI: 已安装" -ForegroundColor Green } else { Write-Warning "[✗] 未找到 Wails CLI" }

# 2. 依赖检查
if (Test-Path "node_modules") {
    Write-Host "[✓] Node 依赖已安装" -ForegroundColor Green
} else {
    Write-Warning "[!] node_modules 目录不存在，请先运行 pnpm env:init"
}

# 3. 环境变量文件
if (Test-Path ".env") {
    Write-Host "[✓] .env 配置文件已就绪" -ForegroundColor Green
} else {
    Write-Warning "[!] .env 配置文件缺失，请运行 pnpm env:init 自动生成"
}

# 4. 后端环境完整性
if (Test-Path "services/api") {
    Write-Host "[✓] 后端目录结构正常" -ForegroundColor Green
    if (Test-Path "services/api/reveria.db") {
        Write-Host "[✓] 找到本地 SQLite 数据库文件 (reveria.db)" -ForegroundColor Green
    } else {
        Write-Host "[!] reveria.db 未创建，将在首次运行 services/api 时自动生成并执行数据迁移。" -ForegroundColor Yellow
    }
} else {
    Write-Warning "[✗] 未找到 services/api 后端服务目录"
}

Write-Host "`n检查完成！" -ForegroundColor Cyan
