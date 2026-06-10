$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$cloudflared = Join-Path $root "cloudflared.exe"
$config = Join-Path $root "config.yml"
$logs = Join-Path $root "logs"

New-Item -ItemType Directory -Force -Path $logs | Out-Null

if (-not (Test-Path -LiteralPath $cloudflared)) {
  throw "cloudflared.exe not found: $cloudflared"
}

if (-not (Test-Path -LiteralPath $config)) {
  throw "config.yml not found: $config"
}

Start-Process `
  -FilePath $cloudflared `
  -ArgumentList @("--config", $config, "tunnel", "run", "zkraiflow-local") `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput (Join-Path $logs "cloudflared.out.log") `
  -RedirectStandardError (Join-Path $logs "cloudflared.err.log")

Write-Host "Cloudflare Tunnel started for https://zkraiflow.top"
