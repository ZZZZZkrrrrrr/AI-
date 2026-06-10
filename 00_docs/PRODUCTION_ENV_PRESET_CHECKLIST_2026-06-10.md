# 生产环境变量预置清单

生成日期：2026-06-10  
公网域名：`https://www.zkraiflow.top`  
来源：`deploy/production.env.example`

这份清单给工程部署使用。先把非敏感变量复制到托管平台环境变量，再把敏感变量放进 Secret 管理器；不要把真实密钥、密码或 token 写回仓库。

## 非敏感变量

| 分类 | 变量 | 模板值 | 状态 | 处理动作 |
| --- | --- | --- | --- | --- |
| 公网登录与安全 | NODE_ENV | production | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 公网登录与安全 | PORT | 3001 | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 公网登录与安全 | PUBLIC_APP_ORIGIN | https://www.zkraiflow.top | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 公网登录与安全 | CORS_ALLOWED_ORIGINS | https://www.zkraiflow.top,capacitor://localhost,https://localhost | 模板可用 | Web/PWA 只保留公网域名；原生包远程调用 API 时再保留对应 WebView origin。 |
| 公网登录与安全 | CORS_ALLOW_CREDENTIALS | true | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 公网登录与安全 | CORS_ALLOW_LOCALHOST | false | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 公网登录与安全 | CONSOLE_AUTH_REQUIRED | true | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 公网登录与安全 | CONSOLE_AUTH_USER | admin@example.com | 待替换 | 替换为生产真实值后写入托管平台环境变量。 |
| 公网登录与安全 | CONSOLE_AUTH_ALLOW_REGISTRATION | false | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 公网登录与安全 | CONSOLE_AUTH_SESSION_HOURS | 24 | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 公网登录与安全 | CONSOLE_AUTH_COOKIE_SECURE | true | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 公网登录与安全 | CONSOLE_AUTH_COOKIE_SAMESITE | Lax | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| AI/视频服务商 | QIANWEN_MODEL | qwen3.6-plus | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| AI/视频服务商 | QIANWEN_BASE_URL | https://dashscope.aliyuncs.com/compatible-mode/v1 | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| AI/视频服务商 | QIANWEN_VL_MODEL | qwen3-vl-flash | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| AI/视频服务商 | SEEDANCE_API_URL | https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| AI/视频服务商 | SEEDANCE_MODEL | doubao-seedance-2-0-fast-260128 | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| AI/视频服务商 | DOUBAO_SEED_PRO_API_URL | https://ark.cn-beijing.volces.com/api/v3/chat/completions | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| AI/视频服务商 | DOUBAO_SEED_PRO_MODEL | doubao-seed-2-0-pro-260215 | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| AI/视频服务商 | SEEDREAM_API_URL | https://ark.cn-beijing.volces.com/api/v3/images/generations | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| AI/视频服务商 | SEEDREAM_MODEL | doubao-seedream-4-5-251128 | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 运行限制 | BATCH_MAX_WORKERS | 3 | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 运行限制 | MODEL_REQUEST_TIMEOUT_MS | 360000 | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 持久化与工具路径 | RUN_STORAGE_DIR | /var/lib/ai-video-studio/runs | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 持久化与工具路径 | PYTHON_EXE | python3 | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 持久化与工具路径 | FFMPEG_EXE | ffmpeg | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| libTV worker | LIBTV_BRIDGE_URL | https://libtv-worker.internal.example.com | 待替换 | 替换为生产真实值后写入托管平台环境变量。 |
| libTV worker | LIBTV_REGISTER_SCRIPT | /app/services/libtv_runner/register_task_input.py | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| libTV worker | LIBTV_DB_PATH | /data/ai_product.sqlite | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| libTV worker | LIBTV_DEFAULT_DRY_RUN | false | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| libTV worker | LIBTV_AUTO_COMPLIANCE | true | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| libTV worker | LIBTV_SEARCH_ENABLED | true | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 部署后 smoke 验收 | SMOKE_BASE_URL | https://www.zkraiflow.top | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 部署后 smoke 验收 | SMOKE_EXPECT_AUTH_REQUIRED | true | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |
| 部署后 smoke 验收 | SMOKE_TIMEOUT_MS | 15000 | 模板可用 | 可先按模板复制到生产环境，再用 smoke 验收。 |

## Secret / 凭证变量

| 分类 | 变量 | 设置位置 | 状态 | 处理动作 |
| --- | --- | --- | --- | --- |
| 公网登录与安全 | CONSOLE_AUTH_PASSWORD | Secret/密码管理器 | 待替换 | 在托管平台 Secret 或密码管理器创建，不写入仓库。 |
| 公网登录与安全 | CONSOLE_AUTH_PASSWORD_SHA256 | Secret/密码管理器 | 待替换 | 在托管平台 Secret 或密码管理器创建，不写入仓库。 |
| AI/视频服务商 | QIANWEN_API_KEY | Secret/密码管理器 | 待替换 | 在托管平台 Secret 或密码管理器创建，不写入仓库。 |
| AI/视频服务商 | QIANWEN_VL_API_KEY | Secret/密码管理器 | 待替换 | 在托管平台 Secret 或密码管理器创建，不写入仓库。 |
| AI/视频服务商 | ARK_API_KEY | Secret/密码管理器 | 待替换 | 在托管平台 Secret 或密码管理器创建，不写入仓库。 |
| libTV worker | LIBTV_WORKER_TOKEN | Secret/密码管理器 | 待替换 | 在托管平台 Secret 或密码管理器创建，不写入仓库。 |
| 部署后 smoke 验收 | SMOKE_USERNAME | Secret/密码管理器 | 待替换 | 在托管平台 Secret 或密码管理器创建，不写入仓库。 |
| 部署后 smoke 验收 | SMOKE_PASSWORD | Secret/密码管理器 | 待替换 | 在托管平台 Secret 或密码管理器创建，不写入仓库。 |

## 推荐部署顺序

1. 设置 `NODE_ENV=production`、`PUBLIC_APP_ORIGIN=https://www.zkraiflow.top` 和精确 `CORS_ALLOWED_ORIGINS`。
2. 设置 `CONSOLE_AUTH_COOKIE_SECURE=true`，生产账号启用强密码或 SHA256 密码。
3. 配置 `RUN_STORAGE_DIR` 到可持久化卷，确认重启后上传、导出和删除请求仍在。
4. 把 libTV 从本地路径迁移到 worker/private service，替换 `LIBTV_BRIDGE_URL`、`LIBTV_REGISTER_SCRIPT`、`LIBTV_DB_PATH`。
5. 创建 AI/视频服务商 Secret，保留服务商名称和模型名在公开配置里。
6. 用审核账号运行 `npm run review:seed` 和 `npm run cloud:smoke`。
7. 最后运行 `npm run release:check`。

## 必须人工确认

- 生产环境不能保留 localhost worker、Windows 本地路径或空密码。
- `CORS_ALLOWED_ORIGINS` 不要用通配符。
- `LIBTV_DEFAULT_DRY_RUN=false` 只应在 worker 已通过真实 smoke 后启用。
- 移动端原生包如果远程调用该 API，需要保留 `capacitor://localhost` 或对应 WebView origin。
