# 停止 Reveria 开发服务器，并清理完整进程树。

$ErrorActionPreference = "Continue"
$ports = @(4100, 3000, 1420)
$processNames = @("wails", "reveria_api", "api")
$projectRoot = (Get-Item (Join-Path $PSScriptRoot "..")).FullName
$statePath = Join-Path $projectRoot ".reveria-dev-processes.json"

Write-Host "=== 正在停止 Reveria 开发服务器 ===" -ForegroundColor Cyan

function Stop-ProcessTree([int]$processId) {
    if ($processId -le 0) { return }
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $process) { return }
    Write-Host "终止进程树 $($process.Name) (PID: $processId)..." -ForegroundColor Yellow
    & taskkill.exe /PID $processId /T /F 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "已终止进程树 (PID: $processId)" -ForegroundColor Green
    }
}

# 1. 先按启动脚本记录的窗口 PID 清理完整进程树
if (Test-Path $statePath) {
    try {
        $state = Get-Content -Raw $statePath | ConvertFrom-Json
        foreach ($entry in @($state.PSObject.Properties)) {
            $rootPid = [int]$entry.Value
            Stop-ProcessTree $rootPid
        }
    } catch {
        Write-Warning "读取开发进程状态失败，将继续按端口清理: $_"
    }
}

# 2. 根据端口查找并杀死进程树
foreach ($port in $ports) {
    Write-Host "检查端口 $port..." -ForegroundColor Gray
    # 获取占用该端口的 TCP 连接
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        # 提取唯一的 OwningProcess ID
        $ownerPids = $connections.OwningProcess | Select-Object -Unique
        foreach ($ownerPid in $ownerPids) {
            Stop-ProcessTree ([int]$ownerPid)
        }
    } else {
        Write-Host "端口 $port 未被占用。" -ForegroundColor DarkGray
    }
}

# 3. 清理残留进程（特别是没有直接绑定 TCP 端口的 Wails 命令行工具等）
foreach ($name in $processNames) {
    Write-Host "检查进程名 $name..." -ForegroundColor Gray
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($procs) {
        foreach ($proc in $procs) {
            Write-Host "发现残留进程 $($proc.Name) (PID: $($proc.Id))，正在终止..." -ForegroundColor Yellow
            try {
                Stop-ProcessTree $proc.Id
            } catch {
                Write-Warning "终止进程 $name (PID: $($proc.Id)) 失败: $_"
            }
        }
    }
}

# 4. 处理旧版本脚本遗留的 go run API 进程，并等待端口释放
$allProcesses = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue)
$apiProcesses = $allProcesses | Where-Object {
    if ($_.CommandLine -notmatch 'go(?:\.exe)?[" ]+run[" ]+main\.go') { return $false }
    $parentId = $_.ParentProcessId
    $parent = $allProcesses | Where-Object { $_.ProcessId -eq $parentId } | Select-Object -First 1
    $parent -and $parent.CommandLine -match 'services[\\/]api'
}
foreach ($apiProcess in $apiProcesses) {
    Stop-ProcessTree ([int]$apiProcess.ProcessId)
}

$deadline = (Get-Date).AddSeconds(10)
do {
    $occupied = @(Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue)
    if ($occupied.Count -eq 0) { break }
    Start-Sleep -Milliseconds 250
} while ((Get-Date) -lt $deadline)

if (Test-Path $statePath) { Remove-Item $statePath -Force -ErrorAction SilentlyContinue }
$remaining = @(Get-NetTCPConnection -State Listen -LocalPort $ports -ErrorAction SilentlyContinue)
if ($remaining.Count -gt 0) {
    $remainingPorts = ($remaining.LocalPort | Select-Object -Unique) -join ", "
    Write-Error "以下端口仍被占用: $remainingPorts"
    exit 1
}

Write-Host "=== 开发服务器停止清理完成，端口已释放 ===" -ForegroundColor Cyan
