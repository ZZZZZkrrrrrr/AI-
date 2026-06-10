# 生产监控、烟测与回滚交接包

更新时间：2026-06-10  
公网域名：https://www.zkraiflow.top  
状态：交接包已准备，等待托管平台真实监控、审核账号和回滚动作确认。

## 1. 当前结论

项目现在已经有公网域名、生产环境变量模板、公开页面烟测、认证/CORS/Cookie 交接包、worker/storage 迁移计划。下一步公开上线前，还需要确认上线后出了问题能发现、能降级、能回滚。

这份交接包不表示已经可以公开发布。它把上线后的运维门禁固定下来：

- 公共页面和 `/api/healthz` 必须持续可用。
- 带审核账号的 `cloud:smoke` 必须能验证登录后的 API。
- 真实视频生成必须能用 `LIBTV_DEFAULT_DRY_RUN=true` 快速降级。
- 并发必须能通过 `BATCH_MAX_WORKERS` 降低。
- 上传、生成结果、隐私请求不能因为重启丢失。
- 日志不能记录 API Key、明文密码、完整 Cookie、私有客户素材。
- 上线第一周必须有每日检查责任人。

## 2. 上线前必须准备的证据

| 证据 | 验证方式 | 当前状态 |
| --- | --- | --- |
| 公开页面可访问 | `npm run public:check` | 已有基础烟测 |
| PWA 公开资源可访问 | `npm run pwa:public-smoke` | 已有基础烟测 |
| 生产认证/CORS/Cookie 交接 | `npm run production:auth-plan` | 已接入 |
| 生产环境变量模板 | `npm run production:profile` | 已接入，仍需替换托管平台真实值 |
| 带账号登录烟测 | `SMOKE_BASE_URL=https://www.zkraiflow.top SMOKE_USERNAME=<account> SMOKE_PASSWORD=<secret> npm run cloud:smoke` | 等待审核账号 |
| worker/storage 迁移计划 | `npm run cloud:worker-plan` | 已接入 |
| 移动端真实会话 | `npm run mobile:qa` 加真机验证 | 等待工具链/真机 |
| 回滚动作 | 托管平台上一版构建和环境变量回滚 | 等待平台确认 |

## 3. 第一周每日检查

| 检查项 | 负责人 | 频率 |
| --- | --- | --- |
| 首页、支持页、隐私页、删除账号页是否可访问 | platform | 每天 |
| `/api/healthz` 是否 ready | platform | 每天 |
| 登录、刷新、退出是否正常 | engineering | 每天 |
| dry-run 创建任务是否正常 | product-engineering | 每天 |
| 上传文件和生成结果是否能读取 | platform | 每天 |
| libTV worker 队列和错误率 | engineering | 启用真实生成后每天 |
| 数据导出/删除请求队列 | product-legal | 每天 |
| 客服邮箱和商店反馈 | business-ops | 每天 |

## 4. 回滚方案

### Web/PWA 白屏或无法打开

1. 回滚上一版 `dist` 或上一版容器。
2. 保持 support/legal/delete-account 页面可访问。
3. 运行 `npm run public:check`。
4. 记录失败版本、回滚时间、影响页面。

### 登录、Cookie 或 CORS 故障

1. 恢复上一版 `PUBLIC_APP_ORIGIN` 和 `CORS_ALLOWED_ORIGINS`。
2. 恢复上一版 `CONSOLE_AUTH_COOKIE_SECURE` 和 `CONSOLE_AUTH_COOKIE_SAMESITE`。
3. 保持 `CONSOLE_AUTH_REQUIRED=true`。
4. 运行 `npm run production:auth-plan` 和带账号的 `npm run cloud:smoke`。

### 视频生成或供应商故障

1. 设置 `LIBTV_DEFAULT_DRY_RUN=true`。
2. 把 `BATCH_MAX_WORKERS` 降到 1 或 2。
3. 保留上传、提示词生成、dry-run 流程。
4. 记录供应商、错误类型、队列影响和成本影响。

### 存储持久化故障

1. 暂停公开扩量和商店提交。
2. 恢复上一版 `RUN_STORAGE_DIR` 或挂载卷。
3. 从备份恢复文件。
4. 验证上传、dry-run、数据导出、删除请求。

### 隐私或删除账号入口故障

1. 暂停商店提交和公开推广。
2. 恢复上一版 legal/support 页面。
3. 保持客服邮箱可联系。
4. 运行 `npm run compliance:check` 和 `npm run public:check`。

## 5. 日志红线

不要写入日志或提交到仓库：

- API Key
- 明文密码或密码哈希
- 完整 Cookie
- 私有客户上传原图或原视频
- 私有供应商控制台截图
- 未脱敏客服工单
- 身份证、营业执照等非公开证件

如果日志要发给商店审核、客服或外部协作方，必须先脱敏。

## 6. 常用命令

```bash
npm run production:ops-plan
npm run production:auth-plan
npm run production:profile
npm run public:check
npm run cloud:smoke
npm run cloud:worker-plan
npm run compliance:check
npm run release:check
```

## 7. 解除阻断条件

只有同时满足下面条件，才能认为“生产可运维”这项完成：

1. 托管平台确认健康检查路径。
2. 公开 `public:check` 通过。
3. 带审核账号的 `cloud:smoke` 通过。
4. worker/storage 方案在生产环境验证。
5. 回滚上一版构建或容器的动作可执行。
6. 环境变量回滚动作可执行。
7. dry-run 降级开关可执行。
8. 第一周每日检查负责人已确认。
9. 日志脱敏规则已确认。

## 8. 关联文件

- `deploy/production-observability-rollback-plan.json`
- `scripts/check-production-observability-plan.mjs`
- `deploy/production-release-runbook.md`
- `deploy/cloud-deployment-action-plan.json`
- `deploy/production-auth-cors-handoff.json`
- `deploy/libtv-worker-storage-plan.json`
- `scripts/production-smoke-test.mjs`
- `store/release-blockers-register.json`
- `store/operator-inputs-register.json`
