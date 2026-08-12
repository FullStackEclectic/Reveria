param(
    [switch]$SkipNativePackage
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ApiBase = [Environment]::GetEnvironmentVariable("VITE_REVERIA_API_BASE")

if ([string]::IsNullOrWhiteSpace($ApiBase)) {
    throw "生产打包必须设置 VITE_REVERIA_API_BASE，例如：https://api.example.com"
}

$ParsedApiBase = $null
if (-not [Uri]::TryCreate($ApiBase.Trim(), [UriKind]::Absolute, [ref]$ParsedApiBase) -or
    ($ParsedApiBase.Scheme -ne "https" -and $ParsedApiBase.Scheme -ne "http")) {
    throw "VITE_REVERIA_API_BASE 必须是有效的 HTTP(S) 绝对地址。"
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command,
        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw $FailureMessage
    }
}

Push-Location $ProjectRoot
try {
	if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
		throw "未找到 Cargo，无法构建 Rust 原生图像引擎。"
	}
	Write-Host "[1/5] 测试并构建 Rust 原生图像引擎"
	Invoke-CheckedCommand { cargo test --manifest-path packages/native-engine/Cargo.toml } "Rust 原生图像引擎测试失败。"
	Invoke-CheckedCommand { cargo build --release --manifest-path packages/native-engine/Cargo.toml } "Rust 原生图像引擎构建失败。"

	Write-Host "[2/5] 验证共享层测试"
	Invoke-CheckedCommand { pnpm --filter @reveria/shared test } "共享层测试失败。"

	Write-Host "[3/5] 构建网页端生产包"
	Invoke-CheckedCommand { pnpm web:build } "网页端生产构建失败。"

	Write-Host "[4/5] 构建桌面端前端资源"
	Invoke-CheckedCommand { pnpm desktop:build } "桌面端前端生产构建失败。"

	if ($SkipNativePackage) {
		Write-Host "[5/5] 已按参数跳过 Wails 原生打包"
	} else {
        if (-not (Get-Command wails -ErrorAction SilentlyContinue)) {
            throw "未找到 Wails CLI，无法生成桌面端原生安装产物。"
        }
		Write-Host "[5/5] 生成 Wails Windows 原生包"
		Push-Location (Join-Path $ProjectRoot "apps/desktop")
		try {
			Invoke-CheckedCommand { wails build -clean } "Wails 原生打包失败。"
		} finally {
			Pop-Location
		}
		$NativeDll = Join-Path $ProjectRoot "packages/native-engine/target/release/native_engine.dll"
		$DesktopBin = Join-Path $ProjectRoot "apps/desktop/build/bin"
		if (-not (Test-Path -LiteralPath $NativeDll -PathType Leaf)) {
			throw "Rust 原生图像引擎 DLL 未生成：$NativeDll"
		}
		Copy-Item -LiteralPath $NativeDll -Destination (Join-Path $DesktopBin "native_engine.dll") -Force
	}

    Write-Host "生产打包验证完成。"
} finally {
    Pop-Location
}
