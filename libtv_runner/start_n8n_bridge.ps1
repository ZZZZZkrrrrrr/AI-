$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BridgeScript = Join-Path $ScriptDir "libtv_n8n_bridge.py"
$LogsDir = Join-Path $ScriptDir "logs"
$OutLog = Join-Path $LogsDir "n8n-bridge.out.log"
$ErrLog = Join-Path $LogsDir "n8n-bridge.err.log"
$Port = 8799

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

$existing = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
if ($existing) {
    Write-Output "LibTV n8n bridge is already listening on port $Port. Process ID: $($existing.OwningProcess)"
    exit 0
}

$process = Start-Process `
    -FilePath "py" `
    -ArgumentList @("-3", $BridgeScript, "--host", "0.0.0.0", "--port", "$Port") `
    -WindowStyle Hidden `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -PassThru

Start-Sleep -Seconds 2
$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener) {
    Write-Error "Failed to start LibTV n8n bridge. Check $ErrLog"
}

Write-Output "LibTV n8n bridge started. Process ID: $($process.Id). URL: http://127.0.0.1:$Port"
