$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridgeDir = Join-Path $root "02_services\libtv_runner"

if (-not (Test-Path -LiteralPath $bridgeDir)) {
    throw "libTV bridge directory not found: $bridgeDir"
}

& (Join-Path $bridgeDir "start_n8n_bridge.ps1")
