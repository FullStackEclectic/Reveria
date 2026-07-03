# 停止 Reveria 开发服务器的脚本，清理占用端口和相关的进程

$ports = @(4100, 3000, 1420)
$processNames = @("wails", "reveria_api", "api")

Write-Host "=== 正在停止 Reveria 开发服务器 ===" -ForegroundColor Cyan

# 1. 根据端口查找并杀死进程
foreach ($port in $ports) {
    Write-Host "检查端口 $port..." -ForegroundColor Gray
    # 获取占用该端口的 TCP 连接
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        # 提取唯一的 OwningProcess ID
        $pids = $connections.OwningProcess | Select-Object -Unique
        foreach ($pid in $pids) {
            $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "发现端口 $port 被进程 $($proc.Name) (PID: $pid) 占用，正在终止..." -ForegroundColor Yellow
                try {
                    Stop-Process -Id $pid -Force
                    Write-Host "成功终止进程 (PID: $pid)" -ForegroundColor Green
                } catch {
                    Write-Warning "终止进程 (PID: $pid) 失败: $_"
                }
            }
        }
    } else {
        Write-Host "端口 $port 未被占用。" -ForegroundColor DarkGray
    }
}

# 2. 根据进程名清理残留进程（特别是没有直接绑定 TCP 端口的 Wails 命令行工具等）
foreach ($name in $processNames) {
    Write-Host "检查进程名 $name..." -ForegroundColor Gray
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    if ($procs) {
        foreach ($proc in $procs) {
            Write-Host "发现残留进程 $($proc.Name) (PID: $($proc.Id))，正在终止..." -ForegroundColor Yellow
            try {
                Stop-Process -Id $proc.Id -Force
                Write-Host "成功终止进程 $name (PID: $($proc.Id))" -ForegroundColor Green
            } catch {
                Write-Warning "终止进程 $name (PID: $($proc.Id)) 失败: $_"
                }
            }
        }
    }
}

Write-Host "=== 开发服务器停止清理完成 ===" -ForegroundColor Cyan
