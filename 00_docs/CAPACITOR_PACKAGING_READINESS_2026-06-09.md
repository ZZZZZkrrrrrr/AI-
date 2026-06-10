# Capacitor App 封装准备

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 1. 本轮落地

已新增：

- `capacitor.config.json`
- `scripts/check-capacitor-readiness.mjs`
- `npm run capacitor:check`
- `npm run capacitor:sync`
- `android/` 原生工程
- `ios/` 原生工程模板

已安装：

- `@capacitor/core`
- `@capacitor/cli`
- `@capacitor/android`
- `@capacitor/ios`

已接入：

```bash
npm run app:health
npm run release:check
```

`app:health` 会先构建 Web 产物，再检查 Capacitor 配置是否适合进入原生打包阶段。

## 2. 当前配置

`capacitor.config.json` 当前固定：

- `appId`: `top.zkraiflow.aivideostudio`
- `appName`: `AI Video Studio`
- `webDir`: `dist`
- Android scheme：`https`
- iOS scheme：`capacitor`
- 禁用 cleartext。
- 禁用 Android mixed content。
- 禁用 Android WebView debugging。
- 发布日志行为使用 `production`。

当前没有配置 `server.url`。这是刻意保守的选择：商店包应使用 `dist` 里的本地 Web 资产，而不是依赖一个开发服务器地址。

## 3. 当前检查结果

本轮执行：

```bash
npm run capacitor:check
```

结果：

- Passes：29
- Blockers：0
- Warnings：3

当前 warnings 是预期状态：

- `ANDROID_HOME` / `ANDROID_SDK_ROOT` 未设置，当前机器还不能可靠执行 Android Gradle 构建。
- 当前 Java 是 JDK 8，而 Android Gradle Plugin 8.x 构建应使用 JDK 17 或更新版本。
- iOS build 与 signing 仍需在 macOS / Xcode 环境中验证。

这表示当前已完成“封装配置准备 + 原生工程模板生成 + 原生静态配置检查”。Android 和 iOS 工程都已经存在，并已同步当前 `dist` Web 资产。Android `allowBackup` 已关闭，manifest 未启用 cleartext，iOS 未声明宽泛 ATS 例外。后续还没有完成的部分是 Android SDK/JDK17 构建、iOS Xcode signing、真机验证、商店截图和正式提交构建。

## 4. 下一阶段执行顺序

进入原生封装时，建议按顺序执行：

1. 确认公开 HTTPS 后端和 API 域名。
2. 确认隐私政策、账号删除页和 Store 元数据都已替换 TODO。
3. 配置原生权限、图标、启动图、包名和签名。
4. Android 侧用选定 JDK / Android SDK 运行 Gradle 构建。
5. iOS 侧在 macOS / Xcode 中配置 signing，并运行真机或模拟器构建。
6. 用真机检查登录、上传、生成、任务状态、素材预览、账号删除入口和离线页。
7. 准备 App Store / Google Play / 国内渠道截图。
8. 运行 `npm run release:check`。
9. 运行 `npm run store:check:strict`。

## 5. 已执行命令

本轮已执行：

```bash
npm install @capacitor/core@8.4.0 @capacitor/android@8.4.0 @capacitor/ios@8.4.0
npm install --save-dev @capacitor/cli@8.4.0
npx cap add android
npx cap add ios
```

后续每次 Web 产物变更后执行：

```bash
npm run build
npm run capacitor:sync
```

之后按平台分别打开原生工程：

```bash
npx cap open android
npx cap open ios
```

## 6. 仍需验证的原生能力

- Android Gradle 构建和签名。
- iOS Xcode 构建和 signing。
- 文件选择和相册访问权限。
- 保存视频到相册。
- 系统分享。
- 推送通知。
- 深链或 Universal Links / App Links。
- 安全区和键盘遮挡。
- 后台任务状态恢复。
- 原生 WebView 中的 Service Worker / 离线页行为。

## 7. 官方资料

- Capacitor Docs：<https://capacitorjs.com/docs>
- Capacitor Configuration：<https://capacitorjs.com/docs/config>
- Capacitor Android：<https://capacitorjs.com/docs/android>
- Capacitor iOS：<https://capacitorjs.com/docs/ios>
