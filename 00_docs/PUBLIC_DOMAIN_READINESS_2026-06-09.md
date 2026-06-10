# 公网域名与公开页面验收记录

更新时间：2026-06-09  
公网域名：`https://www.zkraiflow.top`  
状态：域名、公开页面和无账号公开 smoke 已通过；生产登录、CORS、Cookie、审核账号和任务 smoke 仍需继续验证。

## 1. 本轮结论

你提供的域名已经可以作为项目当前的正式公网入口写入上架资料、隐私表单、账号删除 URL、PWA/云端配置模板和审核说明草稿。

本轮已经更新：

- `store/submission-readiness.json`
- `store/privacy-data-safety-draft.json`
- `deploy/production.env.example`
- `deploy/cloud-deployment-action-plan.json`
- `deploy/production-release-runbook.md`
- `store/launch-action-plan.json`
- `store/release-blockers-register.json`
- `scripts/check-public-domain-readiness.mjs`

## 2. 公开页面实测

| URL | 结果 | 用途 |
| --- | --- | --- |
| `https://www.zkraiflow.top/` | HTTP 200 | App/PWA 入口、营销页 |
| `https://www.zkraiflow.top/support.html` | HTTP 200 | 帮助与支持 |
| `https://www.zkraiflow.top/legal/privacy.html` | HTTP 200 | 隐私政策 |
| `https://www.zkraiflow.top/legal/terms.html` | HTTP 200 | 用户协议 |
| `https://www.zkraiflow.top/legal/ai-disclosure.html` | HTTP 200 | AI 生成内容说明 |
| `https://www.zkraiflow.top/legal/delete-account.html` | HTTP 200 | 删除账号与数据 |
| `https://www.zkraiflow.top/api/healthz` | HTTP 200 | API 健康检查 |

## 3. 公开 smoke 结果

已执行：

```bash
SMOKE_BASE_URL=https://www.zkraiflow.top
SMOKE_EXPECT_AUTH_REQUIRED=true
npm run cloud:smoke
npm run public:check
```

结果：

- Passes: 8
- Failures: 0
- 已验证：健康检查、PWA manifest、隐私政策、用户协议、AI 说明、删除账号页、支持页。
- 已跳过：登录和受保护 API，因为当前还没有 `SMOKE_USERNAME` / `SMOKE_PASSWORD` 审核账号。

## 4. 已替换的公开 URL

| 字段 | 当前值 |
| --- | --- |
| Support URL | `https://www.zkraiflow.top/support.html` |
| Marketing URL | `https://www.zkraiflow.top/` |
| Privacy Policy URL | `https://www.zkraiflow.top/legal/privacy.html` |
| Account Deletion URL | `https://www.zkraiflow.top/legal/delete-account.html` |
| Google Play Web Deletion URL | `https://www.zkraiflow.top/legal/delete-account.html` |
| Public App Origin | `https://www.zkraiflow.top` |
| Smoke Base URL | `https://www.zkraiflow.top` |
| China domain placeholder | `www.zkraiflow.top` |

## 5. 还不能视为正式发布完成

域名已解决，但这些仍是发布前门槛：

1. 生产运行环境要实际设置 `PUBLIC_APP_ORIGIN=https://www.zkraiflow.top`。
2. 生产运行环境要实际设置 `CORS_ALLOWED_ORIGINS=https://www.zkraiflow.top,capacitor://localhost,https://localhost`。
3. 生产环境要启用 `CONSOLE_AUTH_COOKIE_SECURE=true`。
4. 需要一个审核/演示账号，才能跑 `npm run cloud:smoke` 的登录和受保护 API 检查。
5. 客服邮箱、客服电话、运营主体、ICP备案号、APP 备案号仍需补齐。
6. Android/iOS 原生真机、商店截图、签名和上架后台仍需单独完成。

## 6. 下一步

先把生产环境变量按 `deploy/production.env.example` 同步到服务器或托管平台，然后使用审核账号执行：

```bash
npm run cloud:smoke
npm run release:check
```

如果 `cloud:smoke` 通过，`public-domain-and-https` 和 `cloud-cors-cookie-origin` 两个阻断项可以继续从“等待环境验证”推进到“生产验证通过”。
