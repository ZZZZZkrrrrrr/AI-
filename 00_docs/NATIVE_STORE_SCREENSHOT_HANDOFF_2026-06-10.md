# 原生商店截图交接方案

日期：2026-06-10  
适用项目：`01_apps/ai_prompt_video_studio`

## 1. 目标

当前项目已经有移动网页截图，可以证明手机端布局、按钮风格、通知面板、PWA 安装提示和主要页面路径。商店提交前，还需要从最终 Android/iOS 原生包里重新截图，不能只用网页截图替代。

本方案把网页截图基线转成原生截图执行清单：等 Android SDK/JDK 17 和 macOS/Xcode 准备好后，直接按此清单截图、命名、验收。

## 2. 官方要求摘要

- Apple App Store Connect：iPhone 6.9 英寸竖屏可用 `1260x2736`、`1290x2796`、`1320x2868`；iPhone 6.5 英寸竖屏可用 `1242x2688`、`1284x2778`。
- Google Play：截图需为 JPEG 或 24-bit PNG 且无 alpha；最小边不低于 `320px`，最大边不超过 `3840px`；推荐至少 4 张、最低 `1080px` 分辨率，并使用 9:16 竖屏或 16:9 横屏。本项目优先按 `1080x1920` 或 `1440x2560` 竖屏捕获。

官方链接：

- Apple screenshot specifications：<https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications>
- Google Play preview asset guidelines：<https://support.google.com/googleplay/android-developer/answer/9866151>

## 3. 必拍场景

| 顺序 | 场景 | 网页基线 | 原生截图目标 |
|---|---|---|---|
| 1 | 首页 | `store/screenshots/mobile-web-390/01-home.png` | 展示视频模式、大按钮、底部导航 |
| 2 | 创建 | `store/screenshots/mobile-web-390/05-create.png` | 展示商品资料、提示词包、dry-run 生成入口 |
| 3 | 素材 | `store/screenshots/mobile-web-390/06-assets.png` | 展示移动端卡片、任务状态、结果入口 |
| 4 | 我的 | `store/screenshots/mobile-web-390/07-settings.png` | 展示安装、隐私、支持、数据导出、删除账号入口 |

## 4. 输出目录和命名

```text
store/screenshots/ios-app-store-iphone/
  01-home.png
  02-create.png
  03-assets.png
  04-settings.png

store/screenshots/google-play-phone/
  01-home.png
  02-create.png
  03-assets.png
  04-settings.png

store/screenshots/domestic-android-store/
  01-home.png
  02-create.png
  03-assets.png
  04-settings.png
```

## 5. 截图前门禁

- `npm run release:check` 通过。
- 审核账号真实用户名和密码管理器引用已准备好。
- `npm run review:seed` 已在审核环境跑通。
- Android：SDK、JDK 17+、Gradle 构建和真机/模拟器安装通过。
- iOS：macOS、Xcode、签名或 store-accurate simulator 启动通过。
- 支持页、隐私政策、删除账号页不再包含最终上架不可接受的占位信息。

## 6. 质量要求

- 第一张截图必须能看出这是 AI 视频工作台，而不是泛化营销页。
- 不要加设备框、下载按钮、排名、奖项、限时促销或夸张营销语。
- 不展示本地路径、TODO、localhost、API key、密码、私有客户素材。
- 不展示未确认的备案号、未确认联系方式或未最终审核的法律文字。
- 按最终提交语言分别截图，中文渠道使用中文，英文渠道使用英文或最终本地化语言。

## 7. 验收命令

```bash
npm run screenshots:native-plan
npm run screenshots:check
npm run mobile:qa
npm run store:check
npm run release:check
```

`screenshots:native-plan` 验证本交接包、目标目录、官方依据、场景映射和截图前门禁；真正的原生截图仍需要在 Android/iOS 工具链准备好后人工捕获。
