# Workflow App 产品化总体验收矩阵

更新时间：2026-06-09  
项目路径：`D:\Organized\Projects\codex_project\workflow\01_apps\ai_prompt_video_studio`  
状态：内部产品化推进中，尚未达到正式公开上架完成态。

## 1. 总体判断

当前项目已经具备内部试用基础：

- 手机端首页已改成更适合小白的大按钮入口，支持图文/视频模式切换。
- PWA 基础资源、manifest、公开支持/合规页面已具备。
- Capacitor Android/iOS 工程已生成，并可同步最新网页包。
- 云端部署环境模板、行动计划和生产运行手册已补齐。
- 隐私、AI 生成内容、账号删除、数据导出、商店文案、审核说明、截图计划已结构化。
- `release:check` 已串起移动端、PWA、云端、截图、商店、构建和原生封装检查。
- 发布阻断项已整理到 `store/release-blockers-register.json`，可以按负责人和验证命令推进。

但还不能直接正式上架：

- 正式域名、客服联系方式、运营主体、备案号仍是占位。
- 生产环境 Cookie/CORS/存储/libTV worker 还没有真实部署验证。
- Android SDK、JDK 17+、macOS/Xcode 真机构建环境仍需配置。
- App Store / Google Play / 国内安卓商店的真机截图和审核账号仍待准备。
- 法务文本仍带预发布/内测措辞，需要正式审核。

## 2. 验收矩阵

| 领域 | 当前状态 | 已有证据 | 未完成项 | 自动检查 |
| --- | --- | --- | --- | --- |
| 小白友好移动端 | 内部可用 | 大按钮首页、图文/视频切换、移动截图、`MOBILE_BUTTON_STYLE_ACCEPTANCE` | 真实用户测试、细节动效、更多空状态 | `npm run mobile:check`、`npm run screenshots:check` |
| PWA 和公开页面 | 内部可用 | manifest、PWA 图标、support/legal 页面 | 正式域名、正式法律文本、公开 HTTPS 验证 | `npm run pwa:check`、`npm run compliance:check` |
| App 封装 | 工程已生成 | Capacitor 配置、Android/iOS 工程、同步脚本 | Android SDK、JDK 17+、macOS/Xcode、真机测试、签名 | `npm run capacitor:sync`、`npm run capacitor:check` |
| 后端云端化 | 有运行手册 | `production.env.example`、云端行动计划、生产 runbook、烟测脚本 | 真实云环境、持久化存储、libTV worker、正式密钥、监控 | `npm run cloud:check:strict`、`npm run cloud:smoke` |
| 隐私与合规 | 草案结构完整 | 隐私政策、AI 说明、账号删除、数据安全草案、填表清单 | 正式主体、联系方式、保留期限、服务商清单、法务审核 | `npm run compliance:check`、`npm run store:check` |
| 商店上架 | 文案和计划完整 | 上架文案草案、审核说明模板、审核演示数据脚本、截图计划、发布行动计划 | 真实审核账号、真机截图、正式 URL、商店后台填写 | `npm run store:check`、`npm run review:seed:dry` |
| 发布总线 | 已自动化 | `release:check`、`product:report` | 真实生产 smoke 和真机报告 | `npm run release:check`、`npm run product:report` |
| 阻断项管理 | 已结构化 | 发布阻断项登记表、负责人、解除动作、验证命令 | 逐项填入真实证据并关闭 | `npm run product:report` |

## 3. 必须满足的正式发布门槛

正式给外部用户使用前，至少满足：

1. `npm run release:check` 通过，且不再有关键 TODO 占位。
2. `npm run cloud:smoke` 能对公开 HTTPS 域名通过。
3. 正式 `PUBLIC_APP_ORIGIN`、`CORS_ALLOWED_ORIGINS`、`CONSOLE_AUTH_COOKIE_SECURE=true` 已配置。
4. 上传文件、生成结果、数据导出、删除请求使用持久化存储。
5. libTV 不再依赖开发机 localhost 或 Windows 本地路径。
6. Android 真机或模拟器完成登录、上传、任务、结果、设置、隐私页验证。
7. iOS 在 macOS/Xcode 上完成签名、登录、上传、任务、结果、设置、隐私页验证。
8. 隐私政策、用户协议、AI 说明、账号删除页面去掉内测措辞。
9. App Store、Google Play、国内安卓商店截图不包含私密数据、本地路径、密钥、TODO URL。
10. 审核账号可登录，并有稳定演示数据。

## 4. 优先级路线

### P0：外部可访问基础

- 选择正式域名和托管平台。
- 配置 HTTPS、Cookie、CORS、服务端密钥。
- 配置持久化 `RUN_STORAGE_DIR`。
- 完成 `npm run cloud:smoke`。

### P1：App 真机可用

- 安装 Android SDK 和 JDK 17+。
- 在 Android Studio 完成 Gradle 构建。
- 在 macOS/Xcode 完成 iOS 构建和签名。
- 用真机截图替换 web-first-pass 截图。

### P2：上架资料可提交

- 填写正式支持邮箱、电话、运营主体、备案信息。
- 选择最终 App 名称。
- 按 `store/store-listing-copy-draft.json` 完成商店文案。
- 按 `store/privacy-form-fill-checklist.md` 完成 Apple/Google 隐私表单。
- 设置 `REVIEW_BASE_URL`、`REVIEW_USERNAME`、`REVIEW_PASSWORD` 后执行 `npm run review:seed`，灌入非私密审核演示数据。

### P3：合规和运营闭环

- 确认数据保留期限。
- 确认 AI/视频服务商、云存储、日志、监控、崩溃统计和客服服务商清单。
- 验证账号删除请求的处理闭环。
- 建立发布后每日监控和回滚记录。

## 5. 自动化入口

| 命令 | 用途 |
| --- | --- |
| `npm run product:report` | 输出产品化总体验收矩阵 |
| `npm run release:check` | 发布前总检查 |
| `npm run mobile:check` | 移动端小白模式和基础体验检查 |
| `npm run screenshots:check` | 截图计划和截图证据检查 |
| `npm run pwa:check` | PWA 资源检查 |
| `npm run capacitor:check` | App 封装工程检查 |
| `npm run cloud:check:strict` | 云端部署准备检查 |
| `npm run cloud:smoke` | 公开环境部署后烟测 |
| `npm run compliance:check` | 合规页面检查 |
| `npm run store:check` | 商店上架资料检查 |
| `npm run review:seed:dry` | 检查审核演示数据脚本和样例载荷 |
| `npm run review:seed` | 对审核环境写入演示商品、账号素材和 dry-run 批量任务 |

## 6. 关联材料

- 产品与移动端设计：`00_docs/APP_产品化与移动端设计方案_2026-06-09.md`
- 小白按钮风格验收：`00_docs/MOBILE_BUTTON_STYLE_ACCEPTANCE_2026-06-09.md`
- PWA/App 封装路线：`00_docs/PWA_APP_PACKAGING_ROADMAP_2026-06-09.md`
- Capacitor 准备度：`00_docs/CAPACITOR_PACKAGING_READINESS_2026-06-09.md`
- 云端运行手册：`01_apps/ai_prompt_video_studio/deploy/production-release-runbook.md`
- 商店提交总表：`01_apps/ai_prompt_video_studio/store/submission-readiness.json`
- 发布阻断项登记表：`01_apps/ai_prompt_video_studio/store/release-blockers-register.json`
- 上架文案：`01_apps/ai_prompt_video_studio/store/store-listing-copy-draft.json`
- 隐私填表清单：`01_apps/ai_prompt_video_studio/store/privacy-form-fill-checklist.md`
