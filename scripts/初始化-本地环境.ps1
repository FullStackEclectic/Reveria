Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "           Reveria 本地环境初始化脚本             " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. 检查 Go 环境
if (Get-Command go -ErrorAction SilentlyContinue) {
    $goVer = go version
    Write-Host "[✓] 找到 Go 环境: $goVer" -ForegroundColor Green
} else {
    Write-Host "[✗] 未找到 Go 环境，请先安装 Go 1.21+" -ForegroundColor Red
    Exit 1
}

# 2. 检查 Node.js & pnpm 环境
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = node -v
    Write-Host "[✓] 找到 Node.js 环境: $nodeVer" -ForegroundColor Green
} else {
    Write-Host "[✗] 未找到 Node.js，请先安装 Node.js 18+" -ForegroundColor Red
    Exit 1
}

if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    $pnpmVer = pnpm -v
    Write-Host "[✓] 找到 pnpm: v$pnpmVer" -ForegroundColor Green
} else {
    Write-Host "[!] 未找到 pnpm，正在通过 npm 全局安装 pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
}

# 3. 检查并安装 Wails CLI
if (Get-Command wails -ErrorAction SilentlyContinue) {
    $wailsVer = wails version
    Write-Host "[✓] 找到 Wails CLI" -ForegroundColor Green
} else {
    Write-Host "[!] 未找到 Wails CLI，正在为您安装 Wails..." -ForegroundColor Yellow
    go install github.com/wailsapp/wails/v2/cmd/wails@latest
    if (Get-Command wails -ErrorAction SilentlyContinue) {
        Write-Host "[✓] Wails CLI 安装成功！" -ForegroundColor Green
    } else {
        Write-Host "[!] 请确保 Go bin 目录（通常为 `$HOME/go/bin` 或 `%USERPROFILE%\go\bin`）已加入系统环境变量 PATH 中。" -ForegroundColor Yellow
    }
}

# 4. 初始化环境变量文件
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "[✓] 已根据 .env.example 生成 .env 文件" -ForegroundColor Green
    }
} else {
    Write-Host "[✓] .env 配置文件已存在" -ForegroundColor Green
}

# 5. 安装 NPM 依赖
Write-Host "正在安装项目依赖，请稍候..." -ForegroundColor Cyan
pnpm install
Write-Host "[✓] 所有依赖安装完成！" -ForegroundColor Green

Write-Host "`n环境初始化完成！您可以使用 pnpm dev:all 启动全部服务。" -ForegroundColor Green
