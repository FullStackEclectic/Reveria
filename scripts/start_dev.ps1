$ProjectRoot = $PWD.Path
if ($PSScriptRoot -and (Test-Path "$PSScriptRoot\..\pnpm-workspace.yaml")) {
    $ProjectRoot = (Get-Item "$PSScriptRoot\..").FullName
}
$StatePath = Join-Path $ProjectRoot ".reveria-dev-processes.json"
$Ports = @(4100, 3000, 1420)

$occupied = @(Get-NetTCPConnection -State Listen -LocalPort $Ports -ErrorAction SilentlyContinue)
if ($occupied.Count -gt 0) {
    $occupiedPorts = ($occupied.LocalPort | Select-Object -Unique) -join ", "
    Write-Error "开发端口已被占用: $occupiedPorts。请先运行 scripts/stop_dev.ps1。"
    exit 1
}

$EnvFile = Join-Path $ProjectRoot ".env"
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#") -or -not $line.Contains("=")) {
            return
        }
        $parts = $line.Split("=", 2)
        $name = $parts[0].Trim()
        $value = $parts[1].Trim().Trim('"').Trim("'")
        if ($name) {
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "Loaded local environment from $EnvFile"
}

# 旧版 .env 可能只有遗留 DATABASE_URL。未显式选择数据库类型时，本地开发继续使用现有 SQLite 数据。
if ([string]::IsNullOrWhiteSpace($env:DATABASE_TYPE)) {
    $env:DATABASE_TYPE = "sqlite"
    $env:DATABASE_URL = "reveria.db"
}

Write-Host "Starting Go Backend..."
$backendProcess = Start-Process powershell -PassThru -WorkingDirectory $ProjectRoot -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "cd services/api; go run main.go"

Write-Host "Starting Web (Next.js)..."
$webProcess = Start-Process powershell -PassThru -WorkingDirectory $ProjectRoot -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "cd apps/web-next; pnpm dev"

Write-Host "Starting Desktop (Wails)..."
$desktopProcess = Start-Process powershell -PassThru -WorkingDirectory $ProjectRoot -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "cd apps/desktop; wails dev"

@{
    backend = $backendProcess.Id
    web = $webProcess.Id
    desktop = $desktopProcess.Id
} | ConvertTo-Json | Set-Content -Path $StatePath -Encoding UTF8
Write-Host "开发进程已记录到 $StatePath"
