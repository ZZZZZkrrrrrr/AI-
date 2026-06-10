# Cloud Security Deployment Profile

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 本轮目标

把当前 App 从“本地控制台可用”推进到“可安全接入手机网页、PWA、Capacitor 包壳 App 的云端 API”。这轮重点不是新增功能，而是补齐公开发布前必须有的后端边界：

- 浏览器/App 只能从白名单来源调用后端 API。
- 登录 Cookie 在生产 HTTPS 下支持 `Secure` 与 `SameSite` 配置。
- 本地开发配置和生产部署配置拆开，避免 localhost、Windows 路径、本地 SQLite 路径直接进入上线环境。
- `cloud:check` 能在发布前发现 CORS、Cookie、持久化目录、libTV 本地依赖等风险。

## 已落地工程改动

- `server.js` 新增 `PUBLIC_APP_ORIGIN`、`CORS_ALLOWED_ORIGINS`、`CORS_ALLOW_CREDENTIALS`、`CORS_ALLOW_LOCALHOST`。
- `server.js` 不再固定返回 `Access-Control-Allow-Origin: *`，改成按请求 `Origin` 匹配白名单。
- `server.js` 登录 Cookie 新增 `CONSOLE_AUTH_COOKIE_SECURE` 与 `CONSOLE_AUTH_COOKIE_SAMESITE`。
- `.env.example` 补齐本地开发所需的 App 来源、跨域和 Cookie 示例。
- 新增 `deploy/production.env.example`，给云平台或容器环境直接填生产变量。
- 新增 `deploy/cloud-deployment-action-plan.json`，把云端上线 warning 拆成负责人、输入、生产变量、验收证据和下一步动作。
- 新增 `scripts/production-smoke-test.mjs` 和 `npm run cloud:smoke`，用于部署后验证公开 URL、PWA、法务页、支持页和可选登录态 API。
- `scripts/check-cloud-readiness.mjs` 新增 CORS 白名单、生产 Cookie、安全来源和生产模板检查。
- `scripts/check-cloud-readiness.mjs` 现在会验证云端部署行动清单 schema、工作流、warning 映射、烟测脚本和验收证据。

## 推荐部署模式

### 1. 同源 Web/PWA

适合第一阶段上线验证。

```text
https://app.example.com
  ├─ 静态前端 / PWA
  └─ /api/* -> Node API
```

推荐配置：

```env
NODE_ENV=production
PUBLIC_APP_ORIGIN=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_LOCALHOST=false
CONSOLE_AUTH_COOKIE_SECURE=true
CONSOLE_AUTH_COOKIE_SAMESITE=Lax
```

这个模式最稳，因为浏览器、PWA、API 都在同一个 HTTPS 域名下，Cookie 行为最接近普通网站登录。

### 2. 前后端分域

适合把静态前端放 CDN、API 放托管 Node 服务。

```text
https://app.example.com  -> 静态前端
https://api.example.com  -> Node API
```

推荐配置：

```env
PUBLIC_APP_ORIGIN=https://app.example.com
CORS_ALLOWED_ORIGINS=https://app.example.com
CORS_ALLOW_CREDENTIALS=true
CONSOLE_AUTH_COOKIE_SECURE=true
CONSOLE_AUTH_COOKIE_SAMESITE=None
```

注意：如果跨站登录依赖 Cookie，`SameSite=None` 必须配合 `Secure=true`。如果后续改成 Bearer Token 或原生安全存储，Cookie 策略可以重新设计。

### 3. Capacitor 包壳 App 访问远端 API

适合先用 Web/PWA 验证产品，再打包成 iOS/Android App。

```text
Capacitor WebView
  -> https://api.example.com
```

推荐配置：

```env
CORS_ALLOWED_ORIGINS=https://app.example.com,capacitor://localhost,https://localhost
CORS_ALLOW_CREDENTIALS=true
CONSOLE_AUTH_COOKIE_SECURE=true
CONSOLE_AUTH_COOKIE_SAMESITE=None
```

如果 App 内 WebView 与远端 API 是跨来源关系，登录态 Cookie 通常需要 `SameSite=None; Secure`。上线前要用真机测试登录、刷新、任务轮询、视频预览、退出登录。

## 不应上线的配置

- `Access-Control-Allow-Origin: *` 用于带登录态的公开 API。
- `CORS_ALLOW_LOCALHOST=true` 留在生产环境。
- `CONSOLE_AUTH_COOKIE_SECURE=false` 留在生产 HTTPS 环境。
- `LIBTV_BRIDGE_URL=http://127.0.0.1:8799` 直接用于公网服务。
- `LIBTV_REGISTER_SCRIPT`、`LIBTV_DB_PATH` 使用 Windows 本机路径。
- `RUN_STORAGE_DIR` 为空，导致生成素材、隐私请求、任务产物落在临时文件系统。

## 发布前检查

本轮后建议固定执行：

```bash
npm run cloud:check
npm run cloud:check:strict
npm run cloud:smoke
npm run release:check
```

当前云端检查仍保留的提醒项是合理的，因为项目还在本地内测阶段：

- Cookie Secure 未启用。
- 真实公开来源未写入 `.env`。
- libTV 仍指向本地桥接服务。
- libTV 脚本和数据库仍是本机路径。
- `RUN_STORAGE_DIR` 未指定生产持久化目录。
- `LIBTV_DEFAULT_DRY_RUN=true`。

这些提醒在“公网发布/应用商店审核前”必须逐项清零或形成明确豁免记录。

`npm run cloud:smoke` 应在真实部署域名上执行。最小检查只需要：

```bash
SMOKE_BASE_URL=https://app.example.com npm run cloud:smoke
```

如需验证登录态和管理员数据权利审核队列，额外提供审核账号：

```bash
SMOKE_BASE_URL=https://app.example.com SMOKE_USERNAME=review@example.com SMOKE_PASSWORD=*** npm run cloud:smoke
```

## 云端行动清单

`deploy/cloud-deployment-action-plan.json` 已把当前云端 warning 映射成 7 条生产部署工作流：

- `public-origin-cors`：公开 HTTPS 域名、PWA/App/API 来源白名单和 authenticated CORS。
- `auth-cookie-hardening`：`Secure` 与 `SameSite` Cookie 策略，区分同源 PWA 与跨源 App/API。
- `persistent-storage`：上传、生成结果、隐私导出和任务产物的持久化目录或对象存储。
- `libtv-worker-service`：把本地 libTV 桥接、Windows 脚本路径、本地数据库迁移到云端 worker 或私网服务。
- `production-execution-switches`：从 dry-run 切换到真实生成时的开关、并发和成本保护。
- `provider-secrets`：AI provider key 与控制台密码只放在部署平台 secret 中。
- `observability-and-rollback`：`/api/healthz`、`npm run cloud:smoke`、日志、烟测和回滚路径。

本轮后 `npm run cloud:check:strict` 结果：

- Passes：47
- Blockers：0
- Warnings：7

这 7 个 warnings 是真实生产信息或基础设施尚未就绪，不应在没有域名、worker、持久化和密钥策略前强行清零。

## 官方资料

- Capacitor Config：<https://capacitorjs.com/docs/config>
- MDN Set-Cookie：<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie>
- MDN Access-Control-Allow-Origin：<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin>
- Google Play User Data policy：<https://support.google.com/googleplay/android-developer/answer/10144311>
- Apple App Review Guidelines：<https://developer.apple.com/app-store/review/guidelines/>
