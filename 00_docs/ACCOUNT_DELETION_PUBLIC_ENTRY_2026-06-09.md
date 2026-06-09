# 账号删除公开入口

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 1. 本轮落地

已新增公开页面：

- `/legal/delete-account.html`

已接入：

- 合规首页 `/legal/index.html`
- 隐私政策 `/legal/privacy.html`
- 用户协议 `/legal/terms.html`
- AI 生成内容说明 `/legal/ai-disclosure.html`
- PWA Service Worker 预缓存
- “我的 / 设置”的“合规与协议”入口
- `npm run compliance:check`
- `npm run store:check`

## 2. 页面用途

这个页面用于解决商店审核和真实用户使用中的一个关键问题：

- 用户在 App 内可以提交删除账号申请。
- 用户已经卸载 App、无法登录、或审核人员只拿到公开 URL 时，也能看到账号删除路径。
- 隐私政策和商店表单可以引用同一个公开页面。

当前页面说明了：

- App 内提交删除申请的步骤。
- App 内重新输入当前登录密码的身份校验要求。
- App 内二次确认的要求。
- 管理员审核队列和状态流转。
- 无法登录或已卸载 App 时的公开申请渠道。
- 删除范围。
- 可能保留的数据。
- 处理时限需要正式发布前补齐。

## 3. 当前边界

当前仍是产品化准备版：

- 删除申请会记录到后端，不会自动删除账号或业务数据。
- 公开页面中的联系邮箱、工单入口仍是 TODO。
- 正式提交 Google Play 或 App Store 前，需要部署到公开 HTTPS 域名。
- 需要由运营、法务和安全负责人确认删除处理时限、身份核验方式和保留期。

## 4. 当前检查结果

本轮执行：

```bash
npm run compliance:check
npm run store:check
```

结果：

- `compliance:check`：6 个页面检查通过，0 失败。
- `store:check`：31 项通过，0 阻断，25 个正式上架前 warning。

新增页面后，合规检查会验证：

- `/legal/delete-account.html` 存在。
- 页面包含删除账号、申请、无法登录、删除范围、可能保留和处理时限。
- Service Worker 预缓存该页面。
- 设置页链接到该页面。

## 5. 正式上线前补齐

1. 替换 `TODO_CONTACT_EMAIL`。
2. 替换 `TODO_PUBLIC_SUPPORT_URL`。
3. 将 `TODO_PUBLIC_BASE_URL/legal/delete-account.html` 替换为真实 HTTPS URL。
4. 在隐私政策、Google Play Data safety、App Store 隐私详情中保持同一删除口径。
5. 明确删除请求确认时间、身份核验方式、预计完成时间和无法删除时的说明。
6. 将真实处理流程接入客服、工单或后台运营队列。

## 6. 官方资料

- Google Play account deletion requirements：<https://support.google.com/googleplay/android-developer/answer/13327111>
- Google Play User Data Policy：<https://support.google.com/googleplay/android-developer/answer/10144311>
- Apple App Review Guidelines：<https://developer.apple.com/app-store/review/guidelines/>
