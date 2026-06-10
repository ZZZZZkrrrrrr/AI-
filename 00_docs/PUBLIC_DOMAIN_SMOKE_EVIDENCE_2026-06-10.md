# 公网域名基础烟测证据

日期：2026-06-10
项目：`01_apps/ai_prompt_video_studio`
公网入口：`https://www.zkraiflow.top`

## 1. 本轮结论

`https://www.zkraiflow.top` 的基础公开页面与健康检查已完成自动化烟测：

- 命令：`npm run public:check`
- 结果：30 passes，0 blockers，2 warnings
- 脱敏证据：`01_apps/ai_prompt_video_studio/store/evidence/public-domain-smoke-2026-06-10.json`
- 剩余提醒：支持邮箱、支持电话仍等待 owner 输入

这条证据证明公网入口、支持页、隐私页、删除账号页、健康检查和 PWA manifest 可以公开访问。它不证明登录、创建任务、上传、生成、CORS/Cookie 会话已经可用于外部发布；这些仍需要 review-safe 审核账号和生产环境认证 smoke。

## 2. 已验证内容

| 项目 | 当前证据 |
| --- | --- |
| 首页 `/` | HTTPS 可访问，返回非空 HTML |
| 支持页 `/support.html` | HTTPS 可访问，返回非空 HTML |
| 隐私政策 `/legal/privacy.html` | HTTPS 可访问，返回非空 HTML |
| 删除账号 `/legal/delete-account.html` | HTTPS 可访问，返回非空 HTML |
| 健康检查 `/api/healthz` | JSON 可解析，`ok=true`，`status=ready`，`authRequired=true` |
| PWA manifest `/manifest.webmanifest` | JSON 可解析，包含应用名称、短名称和图标 |
| 生产模板 | `PUBLIC_APP_ORIGIN`、`CORS_ALLOWED_ORIGINS`、`SMOKE_BASE_URL` 均指向 `https://www.zkraiflow.top` |

## 3. 仍未关闭的门槛

| 门槛 | 状态 | 需要的证据 |
| --- | --- | --- |
| 支持邮箱 | `waiting-owner-input` | 真实、可监控的支持邮箱 |
| 支持电话或联系政策 | `waiting-owner-input` | 真实电话，或确认“不公开电话、使用邮箱/工单”的政策 |
| 认证 smoke | `blocked-until-review-account` | 审核账号登录、会话、受保护 API 通过 |
| 生产 CORS/Cookie | `pending-hosting-verification` | 生产运行时配置和登录态验证 |

## 4. 后续执行顺序

1. 继续把 `npm run public:check` 保留为每次部署后的公开页面烟测。
2. owner 补齐支持邮箱/电话后，更新 `store/submission-readiness.json` 与 `public/support.html`。
3. 创建 review-safe 审核账号后运行 `npm run cloud:smoke`。
4. 认证 smoke 通过后，再更新 `public-domain-and-auth-smoke` 证据包状态。
