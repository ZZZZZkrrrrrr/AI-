# 生产认证、CORS 与 Cookie 上线交接包

更新时间：2026-06-10  
公网域名：https://www.zkraiflow.top  
状态：交接包已准备，等待托管平台真实环境变量和带账号的公网烟测。

## 1. 当前结论

`https://www.zkraiflow.top` 已经作为公网入口写入发布资料，公开页面和未登录烟测已经有基础证据。但正式对外发布前，还必须证明登录、Cookie、CORS、受保护 API 和移动端会话在生产环境可用。

这份交接包不解除发布阻断。它的作用是把生产认证相关事项固定成可检查清单，避免出现这些问题：

- 本地 `.env` 能跑，但线上没有设置 `PUBLIC_APP_ORIGIN`。
- 线上 CORS 允许了 `*`，但又需要带 Cookie 登录。
- Cookie 没有 `Secure=true`，HTTPS 生产环境会话不可靠。
- PWA 可以打开，但登录刷新后丢失。
- App WebView 可以打开，但跨源 API 请求不带会话。
- 没有审核账号，所以 `cloud:smoke` 只能测公开页面，不能测登录后的功能。

## 2. 首发推荐方案

首发建议采用同源部署：

| 项目 | 推荐值 |
| --- | --- |
| Web/PWA | `https://www.zkraiflow.top` |
| API | 同一个域名下的 `/api/*` |
| Cookie | `Secure=true`，`SameSite=Lax` |
| CORS | 显式允许 `https://www.zkraiflow.top`，不要使用 `*` |
| App WebView | 先按 Capacitor 生成包验证，再决定是否需要远程 API 跨源 Cookie |

只有在 Web/PWA 和 API 分域，或 Capacitor App 直接从 WebView 调远程 API 时，才考虑 `SameSite=None`。如果使用 `SameSite=None`，必须同时保持 `Secure=true`，并做 Android/iOS 真机验证。

## 3. 必填环境变量

| 变量 | 生产模板值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `production` | 使用生产模式 |
| `PUBLIC_APP_ORIGIN` | `https://www.zkraiflow.top` | 公开入口和 CORS 基准 |
| `CORS_ALLOWED_ORIGINS` | `https://www.zkraiflow.top,capacitor://localhost,https://localhost` | 明确允许来源 |
| `CORS_ALLOW_CREDENTIALS` | `true` | 允许带 Cookie 请求 |
| `CORS_ALLOW_LOCALHOST` | `false` | 生产环境关闭本地来源 |
| `CONSOLE_AUTH_REQUIRED` | `true` | 保持登录保护 |
| `CONSOLE_AUTH_ALLOW_REGISTRATION` | `false` | 首发不开放自由注册 |
| `CONSOLE_AUTH_COOKIE_SECURE` | `true` | Cookie 只走 HTTPS |
| `CONSOLE_AUTH_COOKIE_SAMESITE` | `Lax` | 同源 Web/PWA 首发默认 |
| `SMOKE_BASE_URL` | `https://www.zkraiflow.top` | 烟测目标 |
| `SMOKE_EXPECT_AUTH_REQUIRED` | `true` | 防止误把公开无登录当成功 |

## 4. 必须完成的烟测

| 关卡 | 当前状态 | 验证方式 |
| --- | --- | --- |
| 公开健康检查 | 已有未登录基础烟测 | `npm run public:check` |
| 公开法律/PWA 页面 | 已有未登录基础烟测 | `npm run pwa:public-smoke` |
| 登录烟测 | 等待审核账号 | `SMOKE_BASE_URL=https://www.zkraiflow.top SMOKE_USERNAME=<account> SMOKE_PASSWORD=<secret> npm run cloud:smoke` |
| CORS 带凭证请求 | 等待托管平台真实环境变量 | `npm run production:auth-plan`、`npm run cloud:check:strict` |
| PWA 刷新后登录保持 | 等待真实设备 | `npm run mobile:qa` |
| Android/iOS App 登录保持 | 等待原生构建 | Android Studio / Xcode 验证 |

审核账号密码不要写入仓库，只能从密码管理器或托管平台 secret 注入。

## 5. 提交商店前的解除条件

只有同时满足下面条件，才能把 `cloud-cors-cookie-origin` 和 `public-domain-and-https` 相关阻断改成完成：

1. 托管平台已经设置所有必填环境变量。
2. `deploy/production.env.example` 仍然只是模板，没有真实密钥。
3. `npm run production:auth-plan` 通过。
4. `npm run production:profile` 通过。
5. `npm run cloud:check:strict` 在生产配置下无阻断。
6. 带审核账号的 `npm run cloud:smoke` 针对 `https://www.zkraiflow.top` 通过。
7. 手机浏览器、安装后的 PWA、Android/iOS App 会话行为通过验证。
8. 失败时有回滚方案：能关闭真实生成、降并发、回滚环境变量或回滚上一版构建。

## 6. 常用命令

```bash
npm run production:auth-plan
npm run production:profile
npm run cloud:check:strict
npm run public:check
npm run cloud:smoke
npm run mobile:qa
npm run release:check
```

## 7. 官方依据

- MDN Set-Cookie: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie
- MDN Access-Control-Allow-Origin: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin
- Capacitor Configuration: https://capacitorjs.com/docs/config
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/

## 8. 关联文件

- `deploy/production-auth-cors-handoff.json`
- `scripts/check-production-auth-cors-plan.mjs`
- `deploy/production.env.example`
- `deploy/production-release-runbook.md`
- `deploy/cloud-deployment-action-plan.json`
- `store/release-blockers-register.json`
- `store/launch-action-plan.json`
- `scripts/production-smoke-test.mjs`
