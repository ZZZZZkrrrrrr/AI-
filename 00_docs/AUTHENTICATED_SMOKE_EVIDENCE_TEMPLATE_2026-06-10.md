# 认证生产冒烟证据模板

更新时间：2026-06-10  
公开入口：`https://www.zkraiflow.top`  
结构化文件：`01_apps/ai_prompt_video_studio/store/authenticated-smoke-evidence-template.json`  
校验命令：`npm run production:smoke-template`

## 1. 用途

这份模板用于关闭“审核账号 + 生产认证冒烟 + Cookie/CORS 证明”的证据缺口。它不会保存真实审核密码，也不会保存原始 Cookie，只规定审核账号准备好以后要如何记录脱敏结果。

当前状态仍是：模板就绪，等待真实审核账号和生产环境运行结果。

## 2. 官方依据

- Apple App Review：`https://developer.apple.com/app-store/review/`
- Google Play 登录凭据要求：`https://support.google.com/googleplay/android-developer/answer/15748846`
- MDN Set-Cookie：`https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie`
- MDN CORS：`https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS`

Google Play 明确要求受限功能要提供可复用、持续有效、不同地区可访问的登录凭据。对这个项目来说，审核账号必须能访问创建、素材、结果、数据权益和支持路径。

## 3. 准备项

需要在仓库外准备：

- 审核账号用户名
- 审核账号真实密码，放密码管理器或商店后台审核字段
- `PUBLIC_APP_ORIGIN=https://www.zkraiflow.top`
- 生产 `CORS_ALLOWED_ORIGINS`
- HTTPS 下的安全 Cookie 配置
- dry-run 或真实生成开关的当前说明

不要把真实密码、Cookie、Token、API Key、原始生产日志放进仓库。

## 4. 推荐命令

未登录公开冒烟：

```bash
SMOKE_BASE_URL=https://www.zkraiflow.top npm run cloud:smoke
```

认证公开冒烟：

```bash
SMOKE_BASE_URL=https://www.zkraiflow.top SMOKE_USERNAME=<review account> SMOKE_PASSWORD=<from password manager> npm run cloud:smoke
```

审核数据种子：

```bash
REVIEW_BASE_URL=https://www.zkraiflow.top REVIEW_USERNAME=<review account> REVIEW_PASSWORD=<from password manager> npm run review:seed
```

模板检查：

```bash
npm run production:smoke-template
```

## 5. 必须记录的脱敏结果

记录到 `store/evidence/auth-smoke/YYYY-MM-DD/authenticated-smoke-redacted.json`：

- 执行时间
- 公开域名
- 命令摘要，密码写成 `<password-manager>`
- passes/failures/warnings
- 登录是否成功
- session API 是否返回 authenticated
- 用户角色是否是审核安全角色
- `/api/config` 是否没有暴露 provider key
- 数据导出/删除请求路径是否可访问
- Set-Cookie 只记录脱敏属性，例如 Secure、SameSite、HttpOnly
- CORS 只记录允许来源摘要，不记录敏感请求头或 Cookie 值
- 对应未关闭 blocker ID

## 6. 不要放进仓库

不要放进仓库：

- 真实审核密码
- Session Cookie 值
- Authorization header
- 原始 Set-Cookie header
- API Key
- 私人上传素材
- 未脱敏生产日志

仓库里只能保存脱敏 JSON、通过数量、失败数量、Cookie 属性摘要、密码管理器条目名称和 blocker ID。

## 7. 关闭标准

这个门槛关闭前必须满足：

1. 审核账号真实存在，密码在仓库外保存。
2. `npm run review:seed` 能在 `https://www.zkraiflow.top` 或审核环境成功。
3. 认证版 `npm run cloud:smoke` 在 `https://www.zkraiflow.top` 成功。
4. Cookie 的 Secure/SameSite/HttpOnly 属性有脱敏证据。
5. CORS 允许来源和生产授权计划一致。
6. App Store Connect / Google Play Console 里的审核说明和这个账号路径一致。

这些未完成前，不应该关闭 `review-demo-account`、`cloud-cors-cookie-origin` 或 `public-domain-and-https`。 
