$ProjectRoot = $PWD.Path
if ($PSScriptRoot -and (Test-Path "$PSScriptRoot\..\pnpm-workspace.yaml")) {
    $ProjectRoot = (Get-Item "$PSScriptRoot\..").FullName
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
Start-Process powershell -WorkingDirectory $ProjectRoot -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "cd services/api; go run main.go"

Write-Host "Starting Web (Next.js)..."
Start-Process powershell -WorkingDirectory $ProjectRoot -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "cd apps/web-next; pnpm dev"

Write-Host "Starting Desktop (Wails)..."
Start-Process powershell -WorkingDirectory $ProjectRoot -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "cd apps/desktop; wails dev"
