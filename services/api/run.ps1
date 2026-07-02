Get-Content -Path "d:\Code\Go\Reveria\.env" | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') {
        $key = $Matches[1].Trim()
        $val = $Matches[2].Trim()
        Set-Item -Path "Env:\$key" -Value $val
    }
}
$env:DATABASE_TYPE = "sqlite"
$env:DATABASE_URL = "reveria.db"
go run main.go
