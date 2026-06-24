# Cloudflare Tunnel 1033 Recovery

Last updated: 2026-06-11

Public URLs:
- `https://zkraiflow.top/`
- `https://www.zkraiflow.top/`

## What Happened

Cloudflare returned `Error 1033: Cloudflare Tunnel error`.

For this project, that usually means one of these is true:

1. `cloudflared` is not running.
2. The tunnel is running but cannot connect to Cloudflare edge.
3. The tunnel config points to the wrong local origin port.
4. The local app service is down.

On 2026-06-11, the local app was running on `http://127.0.0.1:3001/`, but the tunnel config still pointed to `http://127.0.0.1:5173`. The tunnel was also not running when the error was reported.

## Current Working Config

File:

```text
D:\Organized\Projects\codex_project\workflow\02_services\cloudflare_tunnel\config.yml
```

Expected origin:

```yaml
ingress:
  - hostname: zkraiflow.top
    service: http://127.0.0.1:3001
  - hostname: www.zkraiflow.top
    service: http://127.0.0.1:3001
  - service: http_status:404
```

## Quick Recovery

Start the app first:

```powershell
Set-Location -LiteralPath "D:\Organized\Projects\codex_project\workflow\01_apps\ai_prompt_video_studio"
npm run start
```

If the app is already started in the background, confirm it:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:3001/" -UseBasicParsing
```

Start the tunnel:

```powershell
Set-Location -LiteralPath "D:\Organized\Projects\codex_project\workflow"
powershell -ExecutionPolicy Bypass -File "02_services\cloudflare_tunnel\start_cloudflare_tunnel.ps1"
```

Verify:

```powershell
Invoke-WebRequest -Uri "https://www.zkraiflow.top/#/tasks" -UseBasicParsing
Invoke-WebRequest -Uri "https://zkraiflow.top/" -UseBasicParsing
```

Expected result: HTTP `200`, title `AI 视频工作台`.

## Process Checks

Check app service:

```powershell
Get-NetTCPConnection -LocalPort 3001 -State Listen
```

Check tunnel process:

```powershell
Get-Process | Where-Object { $_.ProcessName -like "*cloudflared*" }
```

Check tunnel connection:

```powershell
Set-Location -LiteralPath "D:\Organized\Projects\codex_project\workflow"
.\02_services\cloudflare_tunnel\cloudflared.exe tunnel info zkraiflow-local
```

## Logs

Tunnel logs:

```text
D:\Organized\Projects\codex_project\workflow\02_services\cloudflare_tunnel\logs\cloudflared.err.log
D:\Organized\Projects\codex_project\workflow\02_services\cloudflare_tunnel\logs\cloudflared.out.log
```

App logs:

```text
D:\Organized\Projects\codex_project\workflow\01_apps\ai_prompt_video_studio\api.runtime.log
D:\Organized\Projects\codex_project\workflow\01_apps\ai_prompt_video_studio\api.err.log
```

## Next Hardening Step

For a real production handoff, install `cloudflared` as a Windows service or move the app to a server/cloud host. A manually started hidden process will stop after machine reboot, logout, crash, or manual termination.
