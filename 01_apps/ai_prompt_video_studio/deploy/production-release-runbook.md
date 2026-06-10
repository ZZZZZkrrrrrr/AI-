# 生产发布运行手册

更新时间：2026-06-09  
适用范围：手机网页、PWA、Capacitor iOS App、Capacitor Android App、后端 API、libTV worker  
状态：草案。用于部署和上架前执行，不替代平台账号、法务和安全审核。

## 1. 目标架构

首个公开版本建议采用稳妥的三段式架构：

| 层级 | 推荐形态 | 必须满足 |
| --- | --- | --- |
| Web/PWA | HTTPS 静态站点或同源 Node 服务 | 首页、PWA manifest、legal/support 页面公开可访问 |
| API 服务 | Node 服务，开启登录保护 | 固定 CORS 来源、安全 Cookie、服务端密钥、健康检查 |
| 持久化与 worker | 挂载卷/对象存储 + 私有 libTV worker | 上传、生成结果、隐私请求和视频任务不依赖本地桌面路径 |

优先推荐同源部署：`https://www.zkraiflow.top` 同时提供 Web/PWA 和 API。这样 Cookie、CORS、PWA 安装和审核路径最简单。  
如果 Web/PWA 与 API 分域部署，必须提前验证跨域 Cookie、`SameSite=None`、`Secure=true` 和 CORS 凭证请求。

官方参考：

- Capacitor 配置：[https://capacitorjs.com/docs/config](https://capacitorjs.com/docs/config)
- Cookie Secure/SameSite：[https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- CORS 来源控制：[https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin)
- Apple 审核指南：[https://developer.apple.com/app-store/review/guidelines/](https://developer.apple.com/app-store/review/guidelines/)
- Google Play 用户数据政策：[https://support.google.com/googleplay/android-developer/answer/10144311](https://support.google.com/googleplay/android-developer/answer/10144311)

## 2. 发布阶段

### 阶段 0：锁定发布信息

必须先确认：

1. 公开域名和 HTTPS 证书。
2. App 最终名称、中文名称、包名、Bundle ID。
3. 运营主体、客服邮箱、客服电话。
4. 隐私政策、用户协议、AI 生成内容说明、账号删除页面的正式 URL。
5. AI/视频服务商、云存储、日志、监控、崩溃统计、推送、支付、客服、分析 SDK 清单。

对应文件：

- `store/submission-readiness.json`
- `store/store-listing-copy-draft.json`
- `store/privacy-data-safety-draft.json`
- `store/privacy-form-fill-checklist.md`

### 阶段 1：配置生产环境变量

从 `deploy/production.env.example` 复制到托管平台的环境变量，不要提交真实密钥。

关键值：

```env
NODE_ENV=production
PUBLIC_APP_ORIGIN=https://www.zkraiflow.top
CORS_ALLOWED_ORIGINS=https://www.zkraiflow.top,capacitor://localhost,https://localhost
CORS_ALLOW_CREDENTIALS=true
CORS_ALLOW_LOCALHOST=false
CONSOLE_AUTH_REQUIRED=true
CONSOLE_AUTH_COOKIE_SECURE=true
CONSOLE_AUTH_COOKIE_SAMESITE=Lax
RUN_STORAGE_DIR=/var/lib/ai-video-studio/runs
LIBTV_BRIDGE_URL=https://libtv-worker.internal.example.com
LIBTV_WORKER_TOKEN=<hosting-secret>
LIBTV_DEFAULT_DRY_RUN=true
```

同源 Web/PWA 推荐 `CONSOLE_AUTH_COOKIE_SAMESITE=Lax`。  
如果 Capacitor App 直接访问远程 API 且不是同源上下文，才考虑 `SameSite=None`，同时必须保持 `CONSOLE_AUTH_COOKIE_SECURE=true`。

发布前阻断：

- `CONSOLE_AUTH_REQUIRED=false`
- `CONSOLE_AUTH_COOKIE_SECURE=false`
- `CORS_ALLOWED_ORIGINS=*`
- API Key 写入前端代码或仓库
- `RUN_STORAGE_DIR` 使用临时目录
- `LIBTV_BRIDGE_URL` 指向本机 `localhost`
- `LIBTV_REGISTER_SCRIPT` 或 `LIBTV_DB_PATH` 使用 Windows 本地路径

### 阶段 2：准备持久化存储

生产环境至少需要保存：

| 数据 | 建议存储 | 删除要求 |
| --- | --- | --- |
| 上传商品图、提示词包、素材 | 挂载卷或对象存储 | 账号删除时删除或匿名化 |
| 生成结果、视频链接、证据包 | 挂载卷或对象存储 | 账号删除时删除或解除关联 |
| 任务、批量任务、账号数据 | 数据库或受保护文件存储 | 支持导出、删除请求和管理员处理 |
| 隐私请求记录 | 独立目录或数据库表 | 保留处理证据，避免泄露 |
| 日志和错误 | 托管日志系统 | 设置保留期限和脱敏策略 |

验收方式：

1. 上传一张测试商品图。
2. 创建一条 dry-run 任务。
3. 重启 API 服务。
4. 确认任务、素材、结果和删除请求记录仍可读取。
5. 执行账号导出，确认不会导出密钥或内部路径。

### 阶段 3：迁移 libTV worker

首个公开版本不要依赖开发机上的 Windows 路径或本地 SQLite。

推荐方案：

| 方案 | 适用 | 风险 |
| --- | --- | --- |
| 私有 worker 服务 | 长期推荐 | 需要打包 Python、ffmpeg、libTV 依赖 |
| 同机后台进程 + 挂载卷 | 小规模内测 | 资源隔离和扩容能力弱 |
| 队列 + worker | 多用户生产 | 需要队列、重试、限流、成本控制 |

worker 必须提供：

1. 健康检查。
2. 任务提交。
3. 任务状态查询。
4. 失败原因回传。
5. 输出文件或 URL 回传。
6. 超时、重试、并发上限。

在 worker 验证完成前，保持：

```env
LIBTV_DEFAULT_DRY_RUN=true
BATCH_MAX_WORKERS=3
```

Worker API 契约以 `deploy/libtv-worker-api-contract.json` 为准，人工说明见 `00_docs/LIBTV_WORKER_API_CONTRACT_2026-06-10.md`。部署 worker 前先执行：

```bash
npm run cloud:worker-contract
npm run cloud:worker-plan
```

这两个检查必须通过，才能继续把 `LIBTV_BRIDGE_URL` 指向真实 worker 并配置 `LIBTV_WORKER_TOKEN`。

### 阶段 4：部署 Web/PWA 和 API

每次部署前执行：

```bash
npm run release:check
npm run build
```

部署后执行：

```bash
npm run cloud:smoke
```

至少验证：

1. `/api/healthz` 返回正常。
2. 未登录访问受保护 API 会被拒绝。
3. 登录、刷新、退出正常。
4. 首页、创建页、素材页、拼接页、设置页可打开。
5. 隐私政策、用户协议、AI 说明、账号删除、支持页面无需登录可打开。
6. PWA manifest 和图标可加载。
7. 账号导出和删除请求入口可用。

### 阶段 5：联调 Capacitor App

每次生产包前执行：

```bash
npm run capacitor:sync
npm run capacitor:check
```

Android 真机/模拟器必须验证：

1. 首次打开不会白屏。
2. 登录 Cookie 能保持。
3. 文件选择器可上传商品图或提示词包。
4. 底部导航、安全区域和大按钮不被系统手势遮挡。
5. 结果下载、外部链接、隐私页、账号删除页可打开。
6. 返回键行为符合预期。
7. 仅申请实际需要的权限。

iOS 真机/模拟器必须验证：

1. Safe Area 正常。
2. WebView 不依赖本地开发地址。
3. 登录、上传、任务轮询、结果查看正常。
4. 隐私、帮助、账号删除等外部页面能打开。
5. Xcode signing、Bundle ID、图标、启动图和版本号正确。

### 阶段 6：审核前最终检查

提交 Apple、Google Play 或国内安卓商店前，必须确认：

1. `npm run release:check` 通过。
2. `npm run cloud:smoke` 针对公开 HTTPS 域名通过。
3. `npm run screenshots:check` 通过，且真机截图已经替换或补齐。
4. `npm run store:check` 通过，且不再有 TODO URL、联系方式、备案、审核账号等占位提醒。
5. 隐私政策与 `store/privacy-data-safety-draft.json` 一致。
6. 上架文案与 `store/store-listing-copy-draft.json` 一致。
7. 审核账号可登录，并有稳定演示数据。
8. 账号删除网页可公开访问。

## 3. 回滚预案

上线前必须准备回滚方式：

| 场景 | 回滚动作 |
| --- | --- |
| Web/PWA 白屏 | 回滚上一版 `dist` 或上一版容器镜像 |
| API 登录失败 | 回滚环境变量或 Cookie SameSite/Secure 配置 |
| 视频 worker 故障 | 设置 `LIBTV_DEFAULT_DRY_RUN=true`，保留任务但停止真实生成 |
| 生成成本异常 | 降低 `BATCH_MAX_WORKERS`，暂停真实生成 |
| 隐私/删除请求故障 | 暂停上架提交，恢复数据请求处理入口 |
| 商店审核被拒 | 保留拒审信息，更新对应文案、截图、权限或合规文件后再提交 |

回滚证据需要记录：

1. 发布版本。
2. 回滚时间。
3. 回滚原因。
4. 影响用户范围。
5. 后续修复项。

## 4. 发布后监控

上线后第一周每日检查：

1. 登录失败率。
2. 任务创建失败率。
3. AI/视频服务商错误率。
4. 存储容量和大文件增长。
5. 账号删除和数据导出请求。
6. 支持邮箱和商店评论。
7. Android/iOS 崩溃或白屏反馈。

不要在日志里保存：

- API Key
- 明文密码
- 完整 Cookie
- 真实用户上传原图的公开直链
- 不必要的身份证、联系方式、支付信息

## 5. 当前未完成项

这些事项仍需业务或基础设施确认：

1. 正式域名和 HTTPS 部署目标。
2. 生产 AI/视频服务商清单。
3. libTV worker 拓扑。
4. 持久化存储方案。
5. 生产日志、监控和保留期限。
6. 客服邮箱、电话、运营主体。
7. ICP 备案号、APP 备案号。
8. Android SDK、JDK 17+、macOS/Xcode 真机构建环境。
