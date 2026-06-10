# 原生 App 签名与发布包交接

生成日期：2026-06-10  
公网入口：`https://www.zkraiflow.top`  
当前结论：原生工程身份已经统一，但还不能提交 App Store / Google Play；缺 Android SDK/JDK 17、Android 上传密钥、Google Play App Signing、macOS/Xcode、Apple Developer 签名资料、真实发布包和真机证据。

## 1. 当前 App 身份

| 项目 | 当前值 | 状态 |
| --- | --- | --- |
| Capacitor appId | `top.zkraiflow.aivideostudio` | 已统一 |
| Android applicationId | `top.zkraiflow.aivideostudio` | 已统一 |
| iOS Bundle ID | `top.zkraiflow.aivideostudio` | 已统一 |
| App 名称 | `AI Video Studio` | 可继续，但最终上架名需要 owner 确认 |
| Android 版本 | `versionCode 1`, `versionName 1.0` | 首版占位 |
| iOS 版本 | `CURRENT_PROJECT_VERSION 1`, `MARKETING_VERSION 1.0` | 首版占位 |

## 2. 不要放进仓库的内容

- Android `.jks` / `.keystore`
- `android/release-signing.properties`
- Android 签名密码、别名密码
- Apple `.p12`、私钥、证书密码
- `.mobileprovision` / `.provisionprofile`
- `.xcarchive` / `.ipa`
- Apple 或 Google 账号密码
- 审核账号真实密码

仓库只保留模板：`android/release-signing.example.properties`。真实值放到安全构建机、密码管理器或 CI secret。

## 3. Android 发布流程

1. 安装 Android SDK，并设置 `ANDROID_HOME` 或 `ANDROID_SDK_ROOT`。
2. 使用 JDK 17 或更新版本。
3. 从 `android/release-signing.example.properties` 复制出本地 `android/release-signing.properties`。
4. 在安全位置生成或保存 Android upload keystore，真实密码不要提交到仓库。
5. 执行 `npm run capacitor:sync`。
6. 执行 `npm run native:release-plan` 和 `npm run capacitor:check`。
7. 在 `android` 目录执行 `.\gradlew.bat bundleRelease`，生成 `.aab`。
8. 在 Google Play Console 开启或确认 Play App Signing，并使用 upload key 上传。
9. 记录上传成功、版本号、截图和设备验证证据。

## 4. iOS 发布流程

1. 在 macOS 上安装 Xcode。
2. 在 Apple Developer 创建或确认 App ID：`top.zkraiflow.aivideostudio`。
3. 配置 Apple Developer Team、Distribution Certificate 和 App Store Provisioning Profile。
4. 执行 `npm run capacitor:sync`。
5. 在 Xcode 打开 `ios/App/App.xcworkspace`，确认 Release 签名。
6. Archive 生成发布包，并上传到 App Store Connect。
7. 等 App Store Connect 处理完成后选择 build，补审核账号、隐私信息和截图。

## 5. 每次上传前的版本规则

- Android 每次上传必须递增 `versionCode`。
- iOS 每次上传必须递增 `CURRENT_PROJECT_VERSION`。
- `versionName` / `MARKETING_VERSION` 只在对用户展示的新版本变化时调整。
- 修改版本后重新运行 `npm run native:release-plan`、`npm run capacitor:check`、`npm run release:check`。

## 6. 当前必须补齐的输入

| 输入 | 负责方 | 存放位置 | 仓库记录方式 |
| --- | --- | --- | --- |
| Android SDK + JDK 17 | 工程 | 开发机或 CI | 只记录验证结果 |
| Android upload keystore | 工程/账号持有人 | 密码管理器或 CI secret | 只记录 secret 引用 |
| Google Play App Signing 状态 | 账号持有人 | Play Console | 只记录状态 |
| Apple Developer Team | 账号持有人 | Apple Developer / Xcode | 只记录 Team 名称或占位 |
| iOS Distribution Certificate | 账号持有人 | macOS keychain 或 CI secret | 只记录 secret 引用 |
| App Store Provisioning Profile | 账号持有人 | Apple Developer / Xcode | 不提交 profile 文件 |
| 上架 App 名称 | owner | Store Console | 记录最终文本 |

## 7. 验证命令

| 命令 | 用途 |
| --- | --- |
| `npm run native:release-plan` | 检查签名交接、版本、Bundle ID、密钥忽略规则和阻断项 |
| `npm run capacitor:sync` | 重新构建网页并同步到 Android/iOS |
| `npm run capacitor:check` | 检查 Capacitor、Android、iOS 基础发布状态 |
| `npm run screenshots:native-plan` | 检查原生商店截图交接 |
| `npm run mobile:qa` | 检查手机端真实设备 QA 计划 |
| `npm run release:check` | 总发布门禁 |

## 8. 官方依据

- Android App signing: https://developer.android.com/studio/publish/app-signing
- Google Play App Signing: https://support.google.com/googleplay/android-developer/answer/9842756
- Apple App Store provisioning profile: https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile/
- App Store Connect upload builds: https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
- Capacitor configuration: https://capacitorjs.com/docs/config

## 9. 本轮交接文件

- `store/native-release-signing-handoff.json`
- `scripts/check-native-release-signing-plan.mjs`
- `android/release-signing.example.properties`
- `android/.gitignore`
- `.gitignore`
- `store/release-blockers-register.json`
- `store/operator-inputs-register.json`
