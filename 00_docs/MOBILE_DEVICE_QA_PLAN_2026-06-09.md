# 移动端真机与小白用户验收计划

更新时间：2026-06-09  
项目路径：`D:\Organized\Projects\codex_project\workflow\01_apps\ai_prompt_video_studio`  
状态：内部可验收，正式上架前仍需 Android/iOS 真机构建、生产域名、审核账号和商店截图。

## 1. 本轮目标

这轮补齐的是“交付给真实用户之前怎么验收”的部分。之前已经做了大按钮首页、图文/视频切换、PWA、Capacitor、截图计划和合规材料，但还缺一层面向真实手机、真实审核账号、真实用户路径的验收标准。

新增机器可读清单：`01_apps/ai_prompt_video_studio/store/mobile-device-qa-plan.json`  
新增自动检查命令：`npm run mobile:qa`  
发布总检查已接入：`npm run release:check`

## 2. 最新官方依据

- Apple 截图规格：`https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/`
- Google Play 预览素材规范：`https://support.google.com/googleplay/android-developer/answer/9866151`
- PWA 安装体验：`https://web.dev/learn/pwa/installation`
- Capacitor 官方文档：`https://capacitorjs.com/docs`
- Google Play Data safety：`https://support.google.com/googleplay/android-developer/answer/10787469`

这些依据决定了验收重点：截图必须来自真实界面，PWA 必须能安装和独立启动，App 封装必须经过平台构建和真机行为检查，隐私/数据入口必须在移动端可见。

## 3. 小白友好按钮风格怎么定

参考你给的截图，适合这个项目的手机端首页应采用“任务入口优先”的结构，而不是传统后台仪表盘：

1. 首屏先问用户“你想先做什么”，不要先展示数据表、参数和复杂状态。
2. 顶部使用 `图文 / 视频` 分段切换，让用户先选任务类型。
3. 主区域使用两列大按钮卡片，每个按钮只承载一个明确任务。
4. 图标用圆形高亮底，文字放在图标下方，按钮高度保持稳定。
5. 新手入口只保留高频动作，例如“一键做视频”“图生视频”“提示词包”“素材结果”“我的数据”。
6. 专业参数放到创建页，不堆在首页。
7. 重要入口可以用 `HOT`、`MAX`、`Pro` 这类小徽标，但不要让徽标抢主标题。
8. 底部保留 4 个以内主导航，适合拇指点击。

当前项目已经采用了这条路线：移动端首页有图文/视频切换、两列大按钮入口、底部导航，并且“提示词包”等入口能直达创建页对应步骤。

## 4. 真机验收设备

| 设备/视口 | 当前状态 | 用途 |
| --- | --- | --- |
| 390px 手机网页 | 已有截图证据 | 验证小屏按钮、底部导航、创建页、资产页、设置页 |
| 430px 手机网页 | 已有截图证据 | 验证大屏手机密度、拼接页和资产卡片 |
| 768px 平板网页 | 已有截图证据 | 验证平板布局不过度拥挤 |
| Android App | 待工具链 | 需要 Android SDK、JDK 17+、Gradle 构建、真机安装 |
| iPhone App | 待 macOS/Xcode | 需要 Xcode 签名、构建、真机或商店尺寸模拟器 |

## 5. 必测用户路径

| 路径 | 验收重点 | 当前证据 |
| --- | --- | --- |
| 小白首页 | 图文/视频切换、大按钮、图标、徽标、底部导航 | `store/screenshots/mobile-web-390/01-home.png`、`02-home-image.png` |
| 定向进入创建 | 点“提示词包”后直接进入提示词步骤 | `store/screenshots/mobile-web-390/03-create-prompt-intent.png` |
| 登录与审核账号 | 审核账号可登录，关闭重开后状态清晰 | 待正式审核账号 |
| 上传与创建 | 文件选择、提示词、dry-run 任务提交 | 网页路径可验收，真机待测 |
| 素材与结果 | 卡片视图可读，不依赖桌面表格 | `store/screenshots/mobile-web-390/05-assets.png` |
| 设置与合规 | 隐私、条款、AI 说明、数据导出、删除请求可见 | `store/screenshots/mobile-web-390/06-settings.png` |
| PWA 安装 | Android 可安装，iOS 有手动添加指引，离线页清晰 | `public/manifest.webmanifest`、`public/sw.js` |
| Android App | 返回键、文件选择、外链、权限、明文流量、安全区 | 待 Android 构建 |
| iOS App | 刘海/底部安全区、文件选择、外链、签名、ATS | 待 Xcode 构建 |
| 商店截图 | App Store/Google Play 真机尺寸、无隐私泄漏 | Web first-pass 已有，原生待捕获 |

## 6. 发布门槛

内部试用可以继续，但正式给外部用户或提交商店前必须满足：

1. `npm run release:check` 通过。
2. `npm run mobile:qa` 无阻断项；P0 手动用例有真实验收记录。
3. Android 和 iOS 真机路径不再是 blocked 状态。
4. 生产 HTTPS 域名、Cookie、CORS、持久化存储、审核账号已经准备好。
5. App Store / Google Play 截图来自最终构建，不使用本地网页临时截图代替。
6. 截图和审核账号不暴露本地路径、TODO URL、密钥、私人商品素材或未定稿法务文案。
7. 隐私政策、AI 说明、账号删除、数据导出路径在手机端都能被普通用户找到。

## 7. 下一步优先级

P0：补生产域名和审核账号，跑通 `cloud:smoke` 与审核演示数据。  
P1：配置 Android SDK/JDK 17+，完成 Android 真机安装和返回键/文件选择测试。  
P1：在 macOS/Xcode 上完成 iOS 构建签名和安全区测试。  
P2：用最终原生 App 重新捕获 App Store / Google Play 截图。  
P2：找 3-5 个非技术用户，只给他们手机首页，让他们完成“上传商品图 -> 生成提示词 -> 创建 dry-run 任务 -> 查看结果 -> 找到删除账号入口”。

