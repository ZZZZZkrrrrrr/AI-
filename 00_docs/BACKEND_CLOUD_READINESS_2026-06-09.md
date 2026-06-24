# 后端云端化与公开发布准备清单

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 1. 本轮已落地

- 新增 `GET /api/healthz`，用于云平台、反向代理、负载均衡的健康检查。
- `/api/healthz` 不需要登录，不读取业务数据，不返回密钥，只返回服务名、状态、时间和是否启用登录保护。
- 新增 `scripts/check-cloud-readiness.mjs`。
- 新增 `npm run cloud:check`，默认审计模式，只输出阻断项和提醒项，不泄露真实环境变量值。
- 新增 `npm run cloud:check:strict`，严格模式下遇到公开发布阻断项会失败，适合上线前门禁。
- 新增 `npm run cloud:smoke`，用于部署后检查公开健康接口、PWA manifest、公开法务页、支持页，以及可选的登录态 API。
- 补齐 `.env.example` 中后端实际使用但之前未列出的变量：`SEEDANCE_API_URL`、`SEEDANCE_MODEL`、`RUN_STORAGE_DIR`、`PYTHON_EXE`、`FFMPEG_EXE`、`MODEL_REQUEST_TIMEOUT_MS`、`CONSOLE_AUTH_PASSWORD_SHA256`。
- 已新增公开合规页面和 `npm run compliance:check`，发布前可以检查隐私政策、用户协议、AI 生成内容说明、PWA 缓存和设置页入口。
- 已新增 `npm run release:check`，串起合规页面检查、云端严格审计、截图计划、商店材料检查和 App 健康检查。
- 已新增账号数据摘要导出接口、删除账号申请记录接口和管理员数据权利审核队列，满足后续 App 上架对数据权利入口和处理闭环的基础要求。
- 2026-06-12 已把文生图新增的 `outputs/text-to-image`、`text_image_canvas_nodes` 和 `video_task_source_links` 纳入云端化计划：`deploy/cloud-deployment-action-plan.json` 新增 `text-image-canvas-storage`，`npm run cloud:check` 会检查该工作流和生产运行手册是否覆盖文生图存储与来源关联迁移。

本轮验证结果：

- `node --check server.js` 通过。
- 临时端口访问 `/api/healthz` 返回 `200`。
- `npm run cloud:check` 通过审计模式，当前无阻断项。
- `npm run cloud:smoke` 已可用于真实部署域名和登录账号的部署后验收。
- `npm run pwa:check` 通过。

当前云端化提醒项：

- `LIBTV_BRIDGE_URL` 仍指向 localhost，需要迁到云端 Worker 服务或私有网络地址。
- `LIBTV_REGISTER_SCRIPT` 仍是 Windows 本机路径，需要改成 Worker 内部路径、容器路径或服务调用。
- `LIBTV_DB_PATH` 仍是 Windows 本机 SQLite 路径，需要迁移到托管数据库或 Worker 可访问的持久卷。
- `RUN_STORAGE_DIR` 未设置，生产环境应改为挂载卷或对象存储方案。
- 文生图当前仍写入本地 `outputs/text-to-image`，画布节点和视频任务来源关联仍在 SQLite `text_image_canvas_nodes`、`video_task_source_links`；公开多用户发布前需要迁移到对象存储 + PostgreSQL，并让证据包引用 `textImageCanvasNodeId` 和任务来源关联记录。
- `LIBTV_DEFAULT_DRY_RUN=true`，真实出片前需要明确切换为实际执行模式。

## 2. 当前后端定位

当前后端仍是“本机生产控制台后端”，不是完整 SaaS 后端：

- 一个 `server.js` 承担静态文件、鉴权、API、SQLite、任务队列、文件读写、模型调用、libTV 桥接。
- 数据主要依赖 SQLite 和本机 runs/output 目录。
- libTV 任务依赖本机桥接服务、Python 脚本、SQLite 路径和 ffmpeg。
- 已有登录保护、会话 Cookie、用户归属字段，适合作为内测基础。
- 已经有批量任务执行逻辑，但仍在同一个 Node 进程内运行，不适合大规模并发。

结论：第一阶段可以作为“私有部署 + 小范围内测”的 Web/PWA 服务；公开给普通用户前，必须把存储、任务执行、鉴权边界、审计日志和合规材料补齐。

## 3. 目标云端架构

```text
Mobile Web / PWA / Capacitor App
        |
        v
HTTPS Domain / CDN / Reverse Proxy
        |
        v
Node API Service
        |
        +--> PostgreSQL: users, projects, tasks, assets, usage, audit logs
        +--> Object Storage: images, prompts, text-image outputs, generated videos, evidence packs
        +--> Queue: AI analysis, prompt generation, video generation, stitching
        +--> Worker Service
              |
              +--> AI model providers
              +--> libTV runner
              +--> ffmpeg
              +--> compliance metadata writer
```

生产环境不建议让手机 App 直接访问任何本机路径、SQLite 文件或模型密钥。App 只访问 HTTPS API；所有密钥、队列、文件路径和模型调用都留在服务端。

## 4. 云端化分阶段

### 第 0 阶段：当前本机内测

目标：

- 保留现有 Node 服务和本机 libTV。
- 用 `npm run pwa:check`、`npm run cloud:check`、`npm run app:health` 做每轮验收。
- 给 1-3 个内部用户验证手机端创建、素材预览、批量任务和视频结果查看。

停止条件：

- `/api/healthz` 可访问。
- 登录保护启用。
- 真实密钥只在 `.env` 或云平台环境变量内。
- 手机端核心路径能完成一次“商品图 -> 提示词 -> 视频任务 -> 结果查看”。

### 第 1 阶段：HTTPS 私有云部署

目标：

- 前端使用静态部署或同源 Node 静态服务。
- 后端部署到云主机、容器平台或托管 Node 服务。
- 统一 HTTPS 域名，先做单租户私有部署。
- `CONSOLE_AUTH_REQUIRED=true`，关闭开放注册。

必须完成：

- 配置 `RUN_STORAGE_DIR` 到持久化挂载卷。
- 设置 `CONSOLE_AUTH_PASSWORD` 或 `CONSOLE_AUTH_PASSWORD_SHA256`。
- 设置云端日志保存和错误告警。
- 将 `/api/healthz` 接入平台健康检查。
- 为 `/api/config`、任务提交、文件访问保留登录保护。

### 第 2 阶段：存储与数据库迁移

目标：

- SQLite 迁移到 PostgreSQL。
- runs/output 文件迁移到对象存储。
- 文件表只保存对象 key、MIME、大小、哈希、归属用户和生命周期。

核心表：

- `users`
- `teams`
- `memberships`
- `products`
- `product_assets`
- `prompt_packages`
- `generation_tasks`
- `task_events`
- `video_outputs`
- `text_image_canvas_nodes`
- `text_image_outputs`
- `compliance_checks`
- `evidence_packs`
- `usage_ledger`
- `api_audit_logs`

每张业务表至少保留：

- `tenant_id`
- `owner_user_id`
- `created_at`
- `updated_at`
- `deleted_at`

文生图迁移要求：

- 图片文件迁移到对象存储或持久化媒体卷，数据库只保存 `object_key`、`mime`、`size`、`hash`、`owner_user_id`、`tenant_id` 和保留期。
- `text_image_canvas_nodes` 从 SQLite 迁移到 PostgreSQL，继续保留节点位置、尺寸、提示词摘要、模型、生成时间和图片引用。
- 节点删除应先做软删除或画布解除关联，不应默认删除底层图片，避免误删素材。
- 图片被送入视频生成时，AI 证据包必须记录 `textImageCanvasNodeId`、生成模型、提示词摘要和源文件哈希。

### 第 3 阶段：Worker 与队列

目标：

- Node API 只负责鉴权、参数校验、任务创建、状态查询。
- AI 分析、提示词生成、视频生成、拼接、合规证据包生成放到 Worker。
- Worker 从队列取任务，执行后写回状态和事件。

建议任务状态：

- `draft`
- `queued`
- `running`
- `needs_user_action`
- `compliance_required`
- `succeeded`
- `failed`
- `cancelled`

需要补齐：

- 队列重试次数和退避策略。
- 单用户并发上限。
- 单租户额度。
- 失败原因归类。
- 幂等任务 ID。
- 任务取消和恢复。

### 第 4 阶段：公开 App / 多用户

目标：

- 支持多用户、多团队、权限隔离。
- 支持账户删除、数据导出、数据保留策略。
- 支持支付、套餐、额度、发票或订单记录。
- 支持 App Store / Google Play / 国内应用商店需要的材料。

必须准备：

- 隐私政策。
- 用户协议。
- AI 生成内容标识说明。
- 数据删除入口。
- SDK 清单和权限说明。
- App 备案或对应市场要求材料。
- 审核账号和审核说明。

## 5. 合规和上架影响

### 隐私与数据

这个产品会处理商品图片、提示词、生成视频、账号信息和任务日志。公开发布时，隐私政策要明确：

- 收集哪些数据。
- 为什么收集。
- 是否发送给第三方 AI 服务。
- 图片、提示词、视频和日志保存多久。
- 用户如何删除账号和数据。
- 是否用于模型训练或质量改进。
- 联系方式和数据权利请求入口。

### AI 生成内容标识

产品输出视频、图片、文本提示词时，应在发布前清单中保留：

- 显式 AI 生成标识。
- 文件元数据或证据包中的隐式标识字段。
- 生成来源、任务 ID、时间、模型、操作者。
- 用户不得删除、篡改、伪造或隐匿 AI 标识的提示。

### 国内发布

如果在中国境内提供 App 或手机网页服务，需要提前准备：

- 网站 ICP 备案。
- App 备案。
- 域名、服务器、主体信息一致。
- 隐私合规检测材料。
- AI 生成内容标识和平台规则说明。
- 如果后续提供公开生成式 AI 服务，还需要另行评估生成式 AI 服务、深度合成、算法备案等义务。

## 6. 工程验收命令

当前建议固定使用：

```bash
npm run pwa:check
npm run cloud:check
npm run app:health
```

上线前使用：

```bash
npm run cloud:check:strict
```

部署后使用：

```bash
SMOKE_BASE_URL=https://app.example.com npm run cloud:smoke
```

如需同时检查登录态、运行配置、用户数据权利 API 和管理员数据权利审核队列：

```bash
SMOKE_BASE_URL=https://app.example.com SMOKE_USERNAME=review@example.com SMOKE_PASSWORD=*** npm run cloud:smoke
```

其中：

- `pwa:check` 检查 App 安装资产。
- `cloud:check` 检查后端公开部署风险。
- `cloud:smoke` 检查已经部署出来的公开 URL 和可选登录态 API。
- `app:health` 检查 PWA 资产、App 结构、生产构建和入口体积。
- `cloud:check:strict` 用于真正发布前的失败门禁。

## 7. 下一轮建议

优先做这三件事：

1. 把 `server.js` 的配置、鉴权、存储、任务队列拆成独立模块，降低云端改造风险。
2. 为文件输出设计对象存储接口，先保留本地实现，再接入 OSS/S3/R2。
3. 为账号删除申请增加保留期判断、真实删除执行和完整数据包导出。

## 8. 官方来源

- Apple App Review Guidelines：<https://developer.apple.com/app-store/review/guidelines/>
- Apple User Privacy and Data Use：<https://developer.apple.com/app-store/user-privacy-and-data-use/>
- Google Play User Data policy：<https://support.google.com/googleplay/android-developer/answer/10144311>
- Google Play Data safety section：<https://support.google.com/googleplay/android-developer/answer/10787469>
- Google Play account deletion requirements：<https://support.google.com/googleplay/android-developer/answer/13327111>
- 工业和信息化部 APP 备案通知：<https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2023/art_920db564162e4312916a01bed6540ad8.html>
- 《人工智能生成合成内容标识办法》：<https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm>
