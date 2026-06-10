# App 上架与分发准备清单

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 1. 本轮落地

已新增机器可读上架清单：

- `store/submission-readiness.json`
- `store/launch-action-plan.json`
- `store/screenshot-plan.json`
- `store/screenshots/README.md`
- `capacitor.config.json`
- `public/support.html`

已新增检查命令：

```bash
npm run store:check
npm run store:check:strict
npm run screenshots:check
npm run screenshots:capture
npm run capacitor:check
```

已接入发布检查：

```bash
npm run release:check
```

默认 `store:check` 不阻断内测发布，只输出正式上架前必须补齐的材料。  
`store:check:strict` 用于真正提交 App Store、Google Play 或国内安卓渠道前；只要还有占位 URL、备案号、截图、原生工程等未完成项，就会失败。

## 2. 当前状态

本轮执行：

```bash
npm run store:check
```

结果：

- Passes：70
- Blockers：0
- Warnings：21

这些 warnings 是预期状态，表示当前项目已经有 PWA、移动端、合规页面、数据权利入口、公开支持页、截图计划和发布检查基础，但还没有进入正式商店提交阶段。

本轮已进一步生成 Capacitor Android 与 iOS 原生工程模板，`capacitor:check` 已达到 0 warning。商店检查中原本“iOS/Android native project is not present yet”的两项 warning 已清除；剩余 iOS/Android 状态仍显示 `project-generated`，表示工程已存在，但签名、真机验证、商店截图和正式构建还没完成。

新增 `store/launch-action-plan.json` 后，warnings 不再只是散落的 TODO，而是被映射到 7 条可执行上架工作流：

- `public-web-base`：公开 HTTPS 域名、支持页、营销页、隐私政策和删除账号 URL。
- `contact-and-support`：审核和用户支持邮箱/电话。
- `privacy-and-data-safety`：Apple 隐私标签、Google Data safety、预发布法务措辞清理。
- `review-demo-account`：审核账号、审核说明和演示数据。
- `native-capacitor-packaging`：iOS/Android Capacitor 原生工程、签名和设备验证。
- `store-screenshots`：Web 首轮截图到原生商店截图的转换。
- `china-distribution-compliance`：运营主体、ICP备案、APP 备案和国内渠道材料。

`npm run store:check` 现在会验证这份行动清单的 schema、里程碑、负责人、状态、验收证据和对应 warnings，避免后续上架推进只靠人工记忆。

`screenshots:check` 当前结果：

- Passes：计划检查通过
- Blockers：0
- 说明：当前会验证截图计划、Web/PWA 已捕获图片和 PNG 尺寸；App Store / Google Play 原生截图仍要等 Capacitor 工程。

`capacitor:check` 当前结果：

- Passes：13
- Blockers：0
- Warnings：6

这些 warnings 说明 Capacitor 配置已经准备好，但尚未安装 Capacitor 依赖和生成 iOS/Android 原生工程。

## 3. 官方要求映射

### Apple App Store

当前关注点：

- App 不能只是网页套壳，必须有足够的 App 化功能和实用价值。
- 需要在 App Store Connect 填写隐私详情，包括第三方代码涉及的数据实践。
- 需要隐私政策 URL。
- 如果提交原生包，需要测试账号、审核说明、截图和权限说明。

本项目对应动作：

- 已有移动端 App Shell、创建流程、任务/素材/拼接卡片、设置页、法务页和数据权利入口。
- 已有公开支持页 `/support.html`，用于承接商店支持 URL、审核说明、常见问题和账号数据入口说明。
- `store/submission-readiness.json` 已记录 Apple 隐私标签草稿字段。
- 正式提交前仍需补：公开 HTTPS 隐私政策 URL、支持 URL、测试账号、App Store 真实截图、Capacitor iOS 工程。

### Google Play

当前关注点：

- 需要 Play Console Data safety 表单。
- 需要隐私政策链接，并且隐私政策、Data safety、应用行为要一致。
- 如果 App 内允许创建账号，也要提供 App 内账号删除路径和网页删除入口。
- 第三方 SDK/代码的数据行为也要纳入披露。

本项目对应动作：

- 已有 `/api/account/export`、`/api/account/data-rights-request`、设置页入口、公开支持页 `/support.html` 和公开删除说明页 `/legal/delete-account.html`。
- `store/submission-readiness.json` 已记录 Google Data safety 草稿字段。
- 正式提交前仍需补：真实公开 HTTPS 域名、公开 HTTPS 隐私政策 URL、真实联系渠道、Google Play 真实截图、Capacitor Android 原生工程、最终 SDK/权限表。

### 国内应用商店

当前关注点：

- 在中国境内从事互联网信息服务的 App 主办者需要按要求履行 APP 备案。
- 上架前通常还要准备 ICP 备案、APP 备案号、运营主体、域名、隐私合规检测、SDK 清单和权限说明。

本项目对应动作：

- `store/submission-readiness.json` 已预留运营主体、域名、ICP备案号、APP备案号和展示位置字段。
- 正式提交前仍需补：主体信息、公开域名、ICP备案、APP备案、备案号在应用内展示位置、国内渠道截图与隐私检测材料。

## 4. 当前 Warnings 处理顺序

优先顺序：

1. 购买/配置公开域名，部署 HTTPS。
2. 把 `/support.html`、`/legal/privacy.html`、`/legal/terms.html`、`/legal/ai-disclosure.html` 发布到公开 URL。
3. 将 `/legal/delete-account.html` 部署到公开 HTTPS 域名，并替换 `TODO_PUBLIC_BASE_URL/legal/delete-account.html`。
4. 确认运营主体、联系邮箱、客服电话或工单入口。
5. 完成隐私政策正式版，替换内测准备版措辞。
6. 补 App Store / Google Play / 国内渠道截图。
7. 安装 Capacitor 依赖，生成 iOS/Android 工程。
8. 审核原生权限、SDK 和数据安全表单。
9. 完成 ICP / APP 备案后，在应用和商店材料中展示。
10. 运行 `npm run store:check:strict`，通过后再提交商店。

## 5. 与现有发布检查的关系

`release:check` 当前包含：

- `npm run compliance:check`
- `npm run cloud:check:strict`
- `npm run screenshots:check`
- `npm run store:check`
- `npm run app:health`

其中：

- `compliance:check` 检查本地法务页、AI 标识证据包、数据权利入口。
- `cloud:check:strict` 检查云端部署阻断项。
- `store:check` 汇总上架材料缺口。
- `app:health` 检查移动端就绪、PWA 资产、结构分析和构建体积。

## 6. 官方资料

- Apple App Review Guidelines：<https://developer.apple.com/app-store/review/guidelines/>
- Apple App Privacy Details：<https://developer.apple.com/app-store/app-privacy-details/>
- Apple App Store Connect - Manage App Privacy：<https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy>
- Google Play User Data Policy：<https://support.google.com/googleplay/android-developer/answer/10144311>
- Google Play Data safety：<https://support.google.com/googleplay/android-developer/answer/10787469>
- Google Play account deletion requirements：<https://support.google.com/googleplay/android-developer/answer/13327111>
- Capacitor Docs：<https://capacitorjs.com/docs>
- 工业和信息化部 APP 备案通知：<https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2023/art_920db564162e4312916a01bed6540ad8.html>
