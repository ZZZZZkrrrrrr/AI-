# Workflow App 小范围试点发布准备清单

日期：2026-06-10  
试点入口：https://www.zkraiflow.top  
检查命令：`npm run pilot:readiness`

## 当前结论

可以继续做小范围试点，但不要把它当成公开发布或商店上架。当前适合先让内部人员、熟悉业务的朋友、设计/QA/审核准备人员试用手机端网页；PWA 安装可以继续验证，但需要补 Android Chrome 和 iOS Safari 的真实设备安装证据。

不要提交商店审核。App Store、Google Play、国内安卓商店仍然需要真实审核账号、客服联系方式、法务终稿、原生签名包、原生截图、生产鉴权、持久化存储和 libTV worker 证据。

## 试点范围

允许：

- 手机端网页：首页大按钮、图文/视频模式切换、通知面板、创建页、素材页、拼接页、设置页。
- PWA 安装引导：先验证 Android Chrome 和 iOS Safari 的安装路径。
- 审核准备：检查隐私、AI 说明、账号删除、客服入口和数据权利入口。
- 干跑任务：在真实视频生成关闭时验证任务创建和结果展示路径。

不允许：

- 不要公开宣传为正式上线。
- 不要开放付费或大规模真实视频生成。
- 不要提交 App Store、Google Play 或国内安卓商店审核。
- 不要把真实密码、API Key、签名证书、私有素材、未脱敏日志放进仓库。
- 不要仅凭试点反馈关闭 release blocker。

## 试点前必跑

在 `D:\Organized\Projects\codex_project\workflow\01_apps\ai_prompt_video_studio` 执行：

```bash
npm run pilot:readiness
npm run release:check
```

如果只想快速确认手机端和通知面板：

```bash
npm run mobile:check
npm run mobile:qa
npm run public:check
```

## 上线前操作规则

1. 先确定试点名单、时间范围、客服负责人和回滚负责人。
2. 保持 `LIBTV_DEFAULT_DRY_RUN=true`，直到持久化存储和 worker 真实验证完成。
3. 生产环境需要配置 `PUBLIC_APP_ORIGIN=https://www.zkraiflow.top`。
4. 鉴权测试前，先在密码管理器里创建专用审核/试点账号，不要写进仓库。
5. PWA 作为主要入口前，必须补 Android Chrome 安装、iOS 添加到主屏幕、离线页、更新提示的真实设备证据。
6. 试点反馈只能进入问题清单；公开发布和商店上架仍按 blocker 台账逐项关闭。

## 本轮新增证据

- `store/pilot-release-readiness.json`
- `scripts/check-pilot-release-readiness.mjs`
- `00_docs/PILOT_RELEASE_READINESS_2026-06-10.md`

