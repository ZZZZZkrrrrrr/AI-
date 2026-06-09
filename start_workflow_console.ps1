$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $root "01_apps\ai_prompt_video_studio"
$bridgeDir = Join-Path $root "02_services\libtv_runner"

if (-not (Test-Path -LiteralPath $appDir)) {
    throw "Console app directory not found: $appDir"
}

if (-not (Test-Path -LiteralPath $bridgeDir)) {
    throw "libTV bridge directory not found: $bridgeDir"
}

if (-not (Test-Path -LiteralPath (Join-Path $appDir "node_modules"))) {
    Write-Output "Installing frontend/backend dependencies..."
    Push-Location $appDir
    npm install
    Pop-Location
}

Write-Output "Starting libTV bridge..."
& (Join-Path $bridgeDir "start_n8n_bridge.ps1")

Write-Output "Starting AI workflow console..."
& (Join-Path $appDir "start_console.ps1")

Write-Output "Frontend: http://localhost:5173"
Write-Output "Backend API: http://localhost:3001"
Write-Output "libTV bridge: http://127.0.0.1:8799"
