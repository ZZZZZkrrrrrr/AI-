# PWA 公网资源烟测证据

日期：2026-06-10
项目：`01_apps/ai_prompt_video_studio`
公网入口：`https://www.zkraiflow.top`

## 1. 本轮结论

`https://www.zkraiflow.top` 的 PWA 公网资源已完成自动化烟测：

- 命令：`npm run pwa:public-smoke`
- 结果：31 passes，0 blockers，0 warnings
- 脱敏证据：`01_apps/ai_prompt_video_studio/store/evidence/pwa-public-smoke-2026-06-10.json`
- 自动门禁：`npm run pwa:prod-plan` 已读取该证据并校验内容

这说明生产域名上的 manifest、Service Worker、离线页和 PWA 图标已经可访问且结构有效。它还不能等同于“PWA 可以公开发布”，因为真机安装、离线重启、版本更新和登录态仍需要 Android/iOS 设备及审核账号验证。

## 2. 已验证内容

| 资源 | 当前证据 |
| --- | --- |
| `/manifest.webmanifest` | 可访问、JSON 有效、`display=standalone`、`start_url=/`、`scope=/`、图标和快捷入口存在 |
| `/sw.js` | 可访问，包含 `install`、`activate`、`fetch`、`message`、`SKIP_WAITING` 和 API 缓存排除逻辑 |
| `/offline.html` | 可访问，是完整 HTML，并能向用户说明离线状态 |
| `/icons/icon-192.png` | 生产域名可访问，PNG 非空 |
| `/icons/icon-512.png` | 生产域名可访问，PNG 非空 |
| `/icons/icon-maskable-512.png` | 生产域名可访问，PNG 非空 |

## 3. 官方依据

- MDN PWA installable guidance：`https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable`
- MDN Service Worker API：`https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API`
- web.dev Web app manifest icons：`https://web.dev/learn/pwa/web-app-manifest`
- web.dev Add a web app manifest：`https://web.dev/articles/add-manifest`

这些资料共同支撑本项目的检查范围：PWA 要能被浏览器安装，需要公开 HTTPS 入口、有效 manifest、合适图标和可工作的 Service Worker；Service Worker 需要正确处理生命周期和离线访问；图标至少要覆盖 192px、512px，并考虑 maskable icon。

## 4. 仍未关闭的门槛

| 门槛 | 状态 | 需要的证据 |
| --- | --- | --- |
| Android Chrome 安装 | `pending-production-device` | 真机安装提示、桌面图标、独立窗口启动截图 |
| iOS Safari 添加到主屏幕 | `pending-production-device` | Safari 引导、添加到主屏幕、启动后安全区截图 |
| 离线重启 | `pending-production-device` | 真机飞行模式重启后的缓存壳或离线页截图 |
| 版本更新提示 | `pending-deployment-cycle` | 发布新 Service Worker 后出现更新提示并点击刷新 |
| 登录态 PWA 重启 | `blocked-until-review-account` | 审核账号登录、关闭重启后会话仍可用 |

## 5. 后续执行顺序

1. 保留 `npm run pwa:public-smoke` 作为每次部署后的公开资源烟测。
2. 用 Android Chrome 和 iOS Safari 分别做真机安装验证。
3. 准备 review-safe 审核账号后运行 `npm run cloud:smoke`。
4. 真机证据补齐后，再考虑把 PWA 作为外部试用主入口。
