$ProjectRoot = $PWD.Path
if ($PSScriptRoot -and (Test-Path "$PSScriptRoot\..\pnpm-workspace.yaml")) {
    $ProjectRoot = (Get-Item "$PSScriptRoot\..").FullName
}

Write-Host "Starting Go Backend..."
Start-Process powershell -WorkingDirectory $ProjectRoot -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "cd services/api; go run main.go"

Write-Host "Starting Web (Next.js)..."
Start-Process powershell -WorkingDirectory $ProjectRoot -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "cd apps/web-next; pnpm dev"

Write-Host "Starting Desktop (Wails)..."
Start-Process powershell -WorkingDirectory $ProjectRoot -ArgumentList "-ExecutionPolicy Bypass", "-NoExit", "-Command", "cd apps/desktop; wails dev"
