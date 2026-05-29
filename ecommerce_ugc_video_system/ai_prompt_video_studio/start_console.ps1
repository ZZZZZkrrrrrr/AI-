$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location -LiteralPath '$root'; npm run api *> api.runtime.log") `
  -WorkingDirectory $root `
  -WindowStyle Hidden

Start-Sleep -Seconds 2

Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location -LiteralPath '$root'; npm run dev *> vite.runtime.log") `
  -WorkingDirectory $root `
  -WindowStyle Hidden

Write-Output "前端控制台: http://localhost:5173"
Write-Output "后端 API: http://localhost:3001"
