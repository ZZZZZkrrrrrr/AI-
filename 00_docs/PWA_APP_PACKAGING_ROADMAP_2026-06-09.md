# PWA / App 封装工程落地路线

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 0. 已落地进展

2026-06-09 已完成 PWA 基础改造：

- 已新增 `public/manifest.webmanifest`。
- 已新增 `public/offline.html`。
- 已新增 `public/sw.js`。
- 已新增 `public/icons/icon-192.png`、`public/icons/icon-512.png`、`public/icons/icon-maskable-512.png`。
- 已新增 `src/shared/pwa/registerServiceWorker.js`。
- 已在 `src/main.jsx` 注册 Service Worker，且仅在生产构建启用。
- 已在 `index.html` 增加 manifest、theme color、Apple mobile web app 元信息，并修正页面标题。
- 已在 `src/App.jsx` 增加 PWA 新版本提示条，避免自动刷新打断用户编辑。
- 已在 `src/App.jsx` 增加手机端 4 入口底部导航，开始从桌面后台导航转向移动端 App Shell。
- 已在 `src/App.jsx` 接入 `beforeinstallprompt` / `appinstalled`，并增加手机端 PWA 安装提示卡片。
- 已在 `src/App.jsx` 增加 iOS Safari 安装候选检测；不支持原生安装弹窗时，提示用户通过 Safari 分享按钮添加到主屏幕。
- 已在 `src/App.jsx` 的单条视频创建页增加手机端创建向导层，先把复杂工作台组织成 5 步移动端流程。
- 已在 `src/App.jsx` 和 `src/styles.css` 为单条视频创建页增加手机端 `资料 / 提示词 / 视频` 分段切换，降低长页面操作成本。
- 已在 `src/App.jsx` 和 `src/styles.css` 为单条视频创建页资料输入增加手机端 `商品图 / 提示词包 / 商品信息` 二级分段。
- 已在 `src/App.jsx` 和 `src/styles.css` 为单条视频创建页资料输入分段增加手机端 `上一步 / 下一步` 操作和缺失资料提示。
- 已在 `src/App.jsx` 和 `src/styles.css` 为单条视频创建页手机端生成前提示增加 `必须补齐` / `建议补充` 分级展示。
- 已在 `src/App.jsx` 和 `src/styles.css` 为单条视频创建页手机端增加生成前合规风险提示，覆盖 AI 标识、功效宣传、绝对化用语、授权资质和价格承诺。
- 已在 `src/styles.css` 增加底部导航样式、安全区适配和手机端底部留白。
- 已在 `src/styles.css` 增加手机端 PWA 安装提示样式，桌面端默认不显示。
- 已在 `src/styles.css` 增加 iOS 手动安装引导的单按钮样式。
- 已在 `src/styles.css` 增加手机端创建向导样式，桌面端默认不显示。
- 已在 `vite.config.js` 增加 Rollup `manualChunks`，把 React、图标库和 xlsx 从主入口包拆出。
- 已将主入口 JS 从约 667KB 降到约 482KB，消除了 Vite 的 500KB chunk 警告，但后续功能应优先拆分主入口。
- 已新增 `scripts/check-bundle-budget.mjs`，并将 `npm run build` 改为构建后检查主入口 JS 体积；超过 500KiB 会失败，超过 485KiB 会警告。
- 已新增 `scripts/report-bundle-size.mjs` 和 `npm run build:report`，用于输出 JS/CSS 产物原始体积、gzip 体积和入口标记；当前入口约 465.26KiB，gzip 约 131.14KiB。
- 已新增 `scripts/check-pwa-assets.mjs` 和 `npm run pwa:check`，用于校验 PWA manifest、Service Worker 生命周期事件、离线页和 192/512/maskable 图标资产。
- 已补充 Web App Manifest `id`、`display_override` 和 3 个桌面快捷入口：创建、素材、我的；`pwa:check` 会检查这些安装元数据。
- 已新增 `scripts/capture-web-screenshots.mjs`、`npm run screenshots:capture` 和 `store/screenshot-plan.json`，用于自动生成 Web/PWA 截图并纳入截图计划检查。
- 已新增 `scripts/check-mobile-readiness.mjs` 和 `npm run mobile:check`，用于校验手机端底部导航、PWA 安装引导、移动端卡片视图、低频页懒加载和安全区样式。
- 已新增 `store/submission-readiness.json`、`scripts/check-store-readiness.mjs`、`npm run store:check` 和 `npm run store:check:strict`，用于检查 App Store、Google Play 和国内渠道上架材料缺口。
- 已新增 `capacitor.config.json`、`scripts/check-capacitor-readiness.mjs` 和 `npm run capacitor:check`，用于固定 App ID、App 名称、`dist` 打包目录和原生封装安全配置。
- 已新增 `scripts/report-app-structure.mjs` 和 `npm run analyze:app`，用于输出 `App.jsx` 最大函数和拆分候选；当前 `App.jsx` 约 17023 行，优先拆分候选为 `SelectionAssetsOverviewPage`、`ProductLibraryPage`、`BatchPage`、`ProductScoringPage`。
- 已新增 `npm run app:health`，一键串起移动端就绪检查、PWA 资产检查、结构分析、构建、体积守卫、体积报告和 Capacitor 配置检查，作为后续模块拆分的默认验收命令。
- 已新增 `APP_MODULE_SPLIT_PLAN_2026-06-09.md`，明确下一阶段模块拆分顺序、懒加载目标、验收命令和停止条件。
- 已新增后端公开探活接口 `GET /api/healthz`，用于云平台、反向代理和负载均衡健康检查。
- 已新增 `scripts/check-cloud-readiness.mjs`、`npm run cloud:check` 和 `npm run cloud:check:strict`，用于审计后端公开部署前的密钥、鉴权、本机路径、存储和 libTV 桥接风险。
- 已新增 `BACKEND_CLOUD_READINESS_2026-06-09.md`，把后端云端化、合规和上架准备拆成可执行阶段。
- 已新增公开合规页面 `public/legal/`，覆盖隐私政策、用户协议、AI 生成内容说明，并加入 Service Worker 预缓存。
- 已新增公开账号删除说明页 `/legal/delete-account.html`，并加入 Service Worker 预缓存，供商店审核、无法登录用户和已卸载用户查看删除路径。
- 已在 `src/App.jsx` 的“我的 / 设置”增加合规与协议入口，手机端用户和审核人员可以直接打开对应页面。
- 已新增 `scripts/check-compliance-assets.mjs`、`npm run compliance:check` 和 `npm run release:check`，把合规页面、云端审计、PWA 资产、结构分析和生产构建串成发布验收命令。
- 已新增 `COMPLIANCE_RELEASE_CHECKLIST_2026-06-09.md`，固化正式上架前需要替换的主体、联系方式、第三方服务、SDK、账号删除和数据导出材料。
- 已新增账号数据摘要导出和删除账号申请接口，并在“我的 / 设置”增加“数据与账号”入口。
- 已新增 `DATA_RIGHTS_ACCOUNT_DELETION_FLOW_2026-06-09.md`，固化数据导出、删除申请、当前边界和正式发布前待补流程。
- 已新增 `ACCOUNT_DELETION_PUBLIC_ENTRY_2026-06-09.md`，固化公开账号删除入口、当前边界和正式上线前待补材料。
- 已在单条视频创建页增加 `AI 证据包` 下载能力，并新增 `AI_DISCLOSURE_EVIDENCE_PACK_2026-06-09.md` 记录 AI 标识证据包字段和后续服务端归档路线。
- 已将“我的 / 设置”抽成 `src/features/settings/SettingsPage.jsx` 并懒加载，主入口 JS 降到约 470.70KiB，减少移动端首屏压力。
- 已将“视频拼接”抽成 `src/features/stitch/VideoStitchPage.jsx` 并懒加载，主入口 JS 继续降到约 465.26KiB。
- 已为“视频拼接”增加手机端视频选择卡片，移动端隐藏宽表格，保留选择、状态、完成时间和打开视频操作。
- 已新增 `MOBILE_READINESS_GATE_2026-06-09.md`，固化移动端体验自动门禁的检查范围、命令和后续真机截图增强方向。
- 已新增 `STORE_SUBMISSION_READINESS_2026-06-09.md`，固化上架材料、隐私披露、账号删除、截图、备案和 Capacitor 原生工程的准备顺序。
- 已新增 `CAPACITOR_PACKAGING_READINESS_2026-06-09.md`，固化 Capacitor 配置、检查命令、原生工程生成顺序和后续真机验证项。
- 已在 `src/App.jsx` 和 `src/styles.css` 为素材页增加手机端卡片视图，移动端隐藏表格、桌面端保留表格。
- 已在 `src/App.jsx` 和 `src/styles.css` 为素材页增加手机端图片缩略图和视频输出内联预览。
- 已在 `src/App.jsx` 和 `src/styles.css` 为素材页增加手机端复制路径/链接和打开可访问文件操作，并接入通知中心。
- 已在 `src/App.jsx` 和 `src/styles.css` 为任务看板、libTV 任务增加手机端卡片视图，移动端隐藏表格、桌面端保留表格。
- 已在 `src/App.jsx` 和 `src/styles.css` 为批量生成页增加手机端批次卡片视图，移动端隐藏重复的桌面批次列表。
- 已在 `src/App.jsx` 和 `src/styles.css` 为批量生成执行明细增加手机端商品任务卡片视图，移动端隐藏执行结果宽表格。
- 已在 `src/App.jsx` 和 `src/styles.css` 为批量生成待创建任务表增加手机端可编辑任务卡片视图，移动端隐藏待创建任务宽表格。
- 已运行 `npm run build:report` 验证通过。

仍需处理：

- 主入口 JS 已低于 500KB，但 `App.jsx` 仍是超大单文件，后续还需要做真正的路由级懒加载和功能模块拆分。
- 当前已具备手机端 App Shell 的底部导航基础、创建向导层、创建页一级/二级分段切换、输入分段推进按钮、生成前阻断/建议/合规风险提示、批次状态卡片、批次待创建任务卡片、批次商品任务卡片和视频拼接选择卡片；后续应继续做模块拆分和懒加载。
- Service Worker 目前使用基础缓存策略，后续要继续完善离线态 UI 和缓存版本策略。

## 1. 推荐路线

不要直接把当前桌面后台套成 App。推荐路线：

1. 先做移动端 Web。
2. 再做 PWA。
3. 后端迁到云端。
4. 再用 Capacitor 封装 iOS/Android。
5. Android 需要轻量上架时，可在 PWA 成熟后考虑 Trusted Web Activity。

原因：

- 当前 App 依赖本机 SQLite、Windows 路径、Python、ffmpeg、libTV 本机桥接，手机端无法直接运行。
- 当前 UI 是后台控制台，不是移动端创作流程。
- App Store 对“纯网页套壳”有最小功能要求。
- PWA 能最快验证用户是否真的需要这个产品。

## 2. 当前项目工程诊断

### 前端

现状：

- React 19 + Vite。
- `src/App.jsx` 文件过大，承载大量页面、业务规则、表单状态和展示逻辑。
- `src/styles.css` 有桌面最小宽度和大量宽表格布局。
- 已有部分移动端媒体查询，但属于补丁式适配。
- `npm run build` 可通过。
- 构建后主业务 chunk 超过 500KB，需要拆包。

问题：

- 移动端首屏加载偏重。
- 手机端导航信息过载。
- 宽表格不适合手机。
- 页面组件不易复用到 Capacitor。

### 后端

现状：

- `server.js` 是单文件 Node HTTP 服务。
- 包含静态服务、鉴权、API、任务执行、SQLite、文件输出、模型调用。
- 登录和用户归属已有基础。
- 运行依赖 `.env`、本机路径、SQLite、libTV bridge。

问题：

- 不适合多用户生产。
- 不适合水平扩容。
- 长任务和文件处理缺少独立 worker。
- session 在内存中，服务重启会丢。
- CORS、CSRF、限流、审计还不完整。

## 3. PWA 第一阶段改造

### 必做文件

新增：

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/offline.html`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon-maskable-512.png`

修改：

- `index.html`
- `src/main.jsx`

### Manifest 字段

建议：

- `name`: AI 视频工作台
- `short_name`: AI 视频
- `start_url`: `/`
- `scope`: `/`
- `display`: `standalone`
- `background_color`: `#eef1ef`
- `theme_color`: `#126a63`
- `orientation`: 不强制锁定，保持自适应。
- `icons`: 192、512、maskable。

### Service Worker 策略

静态资源：

- 预缓存核心 HTML、JS、CSS、图标、离线页。
- 使用版本号控制更新。

API：

- 不缓存创建任务、上传、生成、删除类接口。
- `GET /api/config` 可短缓存。
- 任务详情和资产列表可使用 stale-while-revalidate，但要小心登录态。

离线：

- 离线时可打开首页壳和历史缓存。
- 创建/生成按钮显示“网络恢复后再试”。
- 不做离线视频生成。

更新：

- 新版本 SW 安装后提示“发现新版本，刷新更新”。
- 不要静默刷新用户正在编辑的表单。

### 安装引导

Android Chrome：

- 监听 `beforeinstallprompt`。
- 在“我的”页和首页顶部展示安装按钮。

iOS Safari：

- 无 `beforeinstallprompt`。
- 展示简短引导：分享按钮 > 添加到主屏幕。
- 只在用户多次访问后提示，避免打扰。

## 4. 前端重构路线

### 目录结构

建议：

```text
src/
  app/
    AppShell.jsx
    DesktopShell.jsx
    MobileShell.jsx
    routes.jsx
  shared/
    api/
    components/
    hooks/
    utils/
    domain/
  features/
    home/
    create/
    tasks/
    assets/
    account/
    studio/
    batch/
    selection/
    settings/
```

### 拆包策略

第一步：

- 桌面后台模块懒加载。
- 批量导入页懒加载 `xlsx`。
- 视频拼接页懒加载。
- 设置页懒加载。

第二步：

- 首页、创建、任务详情作为移动端核心首屏包。
- 其他页面按路由拆包。

### 移动端 Shell

移动端 Shell 包含：

- 顶部标题栏。
- 底部导航。
- 安全区适配。
- 全局通知。
- 登录态守卫。
- PWA 更新提示。

桌面 Shell 包含：

- 侧边栏。
- 顶部运行状态。
- 完整模块导航。

### 路由建议

移动端：

```text
/m/home
/m/create
/m/create/single
/m/tasks/:id
/m/assets
/m/assets/:id
/m/review/:taskId
/m/me
```

桌面端：

```text
/dashboard
/studio
/batch
/selection
/assets
/settings
```

可以先用 hash 路由兼容当前实现，后续改为正式路由。

## 5. 后端云端化路线

### 目标架构

```text
Browser / PWA / Capacitor App
        |
        v
API Gateway / HTTPS
        |
        v
Node API Service
        |
        +--> PostgreSQL
        +--> Redis / Queue
        +--> Object Storage
        +--> Worker Service
                  |
                  +--> AI Models
                  +--> Video Generation
                  +--> ffmpeg
                  +--> libTV Runner
```

### 数据库

SQLite 适合本地原型。生产建议 PostgreSQL。

核心表：

- users
- teams
- memberships
- products
- product_assets
- prompt_packages
- generation_tasks
- task_events
- video_outputs
- compliance_checks
- evidence_packs
- usage_ledger
- billing_plans
- api_audit_logs

每张业务表都应有：

- `tenant_id`
- `owner_user_id`
- `created_at`
- `updated_at`
- `deleted_at`

### 文件存储

对象存储目录建议：

```text
tenants/{tenantId}/users/{userId}/products/{productId}/images/
tenants/{tenantId}/tasks/{taskId}/inputs/
tenants/{tenantId}/tasks/{taskId}/outputs/
tenants/{tenantId}/tasks/{taskId}/evidence/
```

文件上传要求：

- 文件大小限制。
- MIME 类型校验。
- 图片压缩和缩略图。
- 视频转码。
- 私有读写。
- 临时签名 URL。

### 队列

生成任务必须进队列，不应在 API 请求里直接跑完。

任务状态：

- draft
- queued
- analyzing
- prompt_generating
- compliance_checking
- video_generating
- reviewing
- succeeded
- failed
- cancelled

任务事件：

- 每个步骤写入 `task_events`。
- 前端通过 SSE/WebSocket 订阅。
- 刷新后通过 API 拉完整状态。

### 用户和额度

需要实现：

- 注册/登录。
- 团队空间。
- 用户角色。
- 生成额度。
- 并发限制。
- 模型成本记录。
- 失败退回规则。

### 安全

生产必须补：

- HTTPS。
- CORS 白名单。
- CSRF 保护。
- HttpOnly + Secure Cookie。
- 登录失败限制。
- API rate limit。
- 上传限流。
- 审计日志。
- 密钥托管，不把模型 Key 暴露给客户端。

## 6. Capacitor 封装路线

### 什么时候开始

满足这些条件再开始：

- 手机端 Web 流程已经稳定。
- PWA 可安装。
- 后端已云端化。
- 视频结果可以通过对象存储访问。
- 登录和任务恢复稳定。
- 隐私政策和用户协议完成。

### 原生能力

App 第一版建议接入：

- 相机/相册：上传商品图。
- 文件选择：上传 Word 提示词包。
- 分享：分享视频或任务链接。
- 保存到相册：保存生成视频。
- 推送通知：长任务完成提醒。
- 深链：打开任务详情。
- 安全存储：保存轻量 token 或设备标识。

这些能力能证明 App 不只是网页套壳。

### 权限文案

需要准备：

- 相机权限：用于拍摄商品图片生成视频。
- 相册权限：用于选择商品图和保存生成视频。
- 通知权限：用于提醒生成任务完成或失败。
- 文件权限：用于导入提示词包和导出结果。

### iOS 注意

- App Store 审核需要测试账号。
- 不能只有网页壳。
- 如果涉及数字内容或订阅，要处理苹果内购规则。
- 隐私详情要准确说明收集的数据。

### Android 注意

- Google Play 需要 Data Safety。
- 国内应用商店需要 APP 备案、隐私合规、SDK 清单。
- 权限要最小化申请。

## 7. Trusted Web Activity 路线

如果先只做 Android，可在 PWA 成熟后用 TWA。

前提：

- PWA 质量足够好。
- HTTPS 域名。
- Web App Manifest。
- Service Worker。
- Android 与网站通过 Digital Asset Links 验证。
- `assetlinks.json` 配置正确。

限制：

- 不解决 iOS。
- 原生能力较 Capacitor 弱。
- 国内渠道适配仍要单独验证。

## 8. 合规落地清单

### AI 生成内容标识

产品内置：

- 视频结果页显示“AI 生成/辅助生成”。
- 导出视频加可见或可识别标识。
- 保存生成日志：模型、时间、用户、素材、任务 ID。
- 用户协议约束不得去除或误导 AI 标识。

### 直播电商选品证据

产品内置：

- 商品资质字段。
- 价格依据字段。
- 授权/品牌证明字段。
- 功效/性能证明字段。
- 用户评价来源字段。
- 选品审核记录。
- 证据包导出。

### 隐私和数据

必须准备：

- 隐私政策。
- 用户协议。
- 第三方 SDK 清单。
- 数据收集清单。
- 数据删除入口。
- 数据导出入口。
- 未成年人保护说明。

### 备案和上架

中国大陆：

- 网站 ICP 备案。
- APP 备案。
- 域名证书。
- 应用商店隐私合规检测。

iOS：

- App 隐私详情。
- 审核账号。
- 截图和说明。

Android：

- Google Play Data Safety。
- 国内商店软著/备案/隐私检测材料按渠道准备。

## 9. 8 周落地计划

### 第 1 周：移动端骨架

- 建立 MobileShell。
- 底部导航。
- 移动首页。
- 移动创建入口。
- 登录页移动端检查。

### 第 2 周：单条创建向导

- 商品资料页。
- 提示词包页。
- AI 预检页。
- 提示词编辑页。
- 任务提交。

### 第 3 周：任务和结果

- 移动任务详情。
- 任务事件恢复。
- 视频审核页。
- 下载/分享入口。
- 错误状态统一。

### 第 4 周：PWA

- manifest。
- icons。
- service worker。
- offline page。
- 安装引导。
- 更新提示。

### 第 5 周：代码拆分

- 拆 `App.jsx`。
- 路由级懒加载。
- xlsx 懒加载。
- 表格移动卡片化。
- 首屏性能优化。

### 第 6 周：云端基础

- PostgreSQL schema。
- 对象存储。
- 队列。
- Worker。
- 持久化 session。

### 第 7 周：合规与商业化基础

- AI 标识。
- 证据包。
- 额度账本。
- 隐私政策。
- 用户协议。

### 第 8 周：App 封装预研

- Capacitor 初始化。
- 相册/文件/分享插件验证。
- 推送链路验证。
- 内测包。
- 上架材料清单。

## 10. 首批可执行开发任务

建议按这个顺序开工：

1. `src/app/MobileShell.jsx`
2. `src/features/mobile-home/MobileHome.jsx`
3. `src/features/create/CreateVideoWizard.jsx`
4. `src/features/tasks/MobileTaskDetail.jsx`
5. `src/features/review/MobileVideoReview.jsx`
6. `public/manifest.webmanifest`
7. `public/sw.js`
8. `public/offline.html`
9. `src/shared/pwa/registerServiceWorker.js`
10. `server.js` 增加生产 CORS 白名单配置
11. `server.js` 把 session 改为持久化存储
12. 设计 PostgreSQL 迁移脚本

## 11. 官方资料

- PWA Web App Manifest：<https://web.dev/learn/pwa/web-app-manifest>
- PWA Installation：<https://web.dev/learn/pwa/installation>
- MDN Making PWAs installable：<https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable>
- Capacitor Docs：<https://capacitorjs.com/docs>
- Android Trusted Web Activities：<https://developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities>
- Android Adaptive Navigation：<https://developer.android.com/develop/adaptive-apps/guides/build-adaptive-navigation>
- Apple App Review Guidelines：<https://developer.apple.com/app-store/review/guidelines/>
- Apple App Privacy Details：<https://developer.apple.com/app-store/app-privacy-details/>
- Google Play User Data：<https://support.google.com/googleplay/android-developer/answer/10144311>
- WCAG 2.2 Target Size：<https://www.w3.org/TR/WCAG22/#target-size-minimum>
- 《人工智能生成合成内容标识办法》：<https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm>
- 《直播电商监督管理办法》：<https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2026/art_ce66ea61fcec4583b5dbd677f470088b.html>
- 工信部 APP 备案通知：<https://www.miit.gov.cn/jgsj/xgj/wjfb/art/2023/art_dd783a581c9644a4aee10afa582811db.html>
- 《生成式人工智能服务管理暂行办法》：<https://www.cac.gov.cn/2023-07/13/c_1690898326795531.htm>
