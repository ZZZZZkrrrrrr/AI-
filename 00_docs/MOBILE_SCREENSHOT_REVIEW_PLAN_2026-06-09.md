# 移动端截图与审核素材计划

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 本轮目标

把“商店截图”从一个待办事项变成可执行、可检查的材料计划。当前项目已经具备移动端 Web/PWA 形态，但 iOS/Android 原生工程还未生成，所以本轮先固化：

- 手机网页/PWA 截图集。
- 平板网页截图集。
- App Store iPhone 截图目标。
- Google Play Android 截图目标。
- 国内安卓渠道截图占位和渠道选择提醒。
- 自动检查脚本，防止缺失关键场景。

## 已落地文件

- `store/screenshot-plan.json`：机器可读截图计划。
- `store/screenshots/README.md`：截图目录、命名和质量要求。
- `scripts/check-screenshot-plan.mjs`：截图计划检查脚本。
- `scripts/capture-web-screenshots.mjs`：使用 Chrome DevTools 协议捕获 Web/PWA 截图。
- `package.json`：新增 `npm run screenshots:check`、`npm run screenshots:check:strict` 和 `npm run screenshots:capture`。
- `store/submission-readiness.json`：新增截图计划状态和计划文件路径。
- `scripts/check-store-readiness.mjs`：开始检查截图计划文件与元数据。

## 第一批必须覆盖的产品画面

第一批截图要覆盖真实使用路径，而不是只展示单个好看的界面：

1. `home`：移动端工作台首页，展示运行状态、任务入口、底部导航。
2. `create`：创建任务，展示商品资料、提示词生成、视频任务入口。
3. `assets`：素材与结果，展示素材卡片、任务状态、结果预览。
4. `settings`：我的与合规，展示隐私政策、帮助支持、数据导出、删除账号入口。
5. `stitch`：视频拼接，展示移动端视频拼接和输出流程。

## 当前计划截图集

| 截图集 | 状态 | 用途 |
|---|---:|---|
| `mobile-web-390` | captured | 小屏手机网页/PWA，已拍 home/create/assets/settings |
| `mobile-web-430` | captured | 大屏手机网页/PWA，已拍 home/create/assets/stitch |
| `tablet-web-768` | captured | 平板网页，已拍 home/create/assets |
| `ios-app-store-iphone` | blocked-until-native-build | 等 Capacitor iOS 工程生成后，用真机或模拟器拍 |
| `google-play-phone` | blocked-until-native-build | 等 Capacitor Android 工程生成后，用真机或模拟器拍 |
| `domestic-android-store` | pending-channel-selection | 等确定国内渠道后按渠道尺寸补齐 |

## 截图质量要求

- 使用真实生产构建界面，不用纯营销图或占位图冒充 App 功能。
- 不展示 API Key、真实客户素材、个人数据、TODO URL、本地 Windows 路径。
- 首屏截图必须让审核人员立刻知道这是 AI 视频工作台，而不是普通 WebView 壳。
- 移动端文字必须在 390px 宽度下可读。
- 截图上的状态、按钮和说明要与实际功能一致。
- 中国区、英语区或其他市场需要分开准备本地化截图。

## 验收命令

```bash
npm run screenshots:check
npm run screenshots:capture
npm run store:check
npm run release:check
```

`screenshots:check` 当前会验证截图计划、已捕获 Web/PWA 截图文件和 PNG 尺寸。`screenshots:capture` 会先构建生产包，再启动临时本地服务，用 Chrome 捕获 Web/PWA 三组截图。

## 下一步建议

1. 准备一套无隐私风险的演示数据，避免截图出现真实客户素材。
2. 确定真实域名、支持 URL、隐私政策 URL 和账号删除 URL 后，重新拍设置页截图。
3. 安装 Capacitor 依赖并生成 iOS/Android 工程，再拍原生商店截图。
4. 国内渠道确定后，把对应渠道尺寸和权限说明补进 `store/screenshot-plan.json`。

## 官方资料

- Apple Screenshot specifications：<https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/>
- Apple App Review Guidelines：<https://developer.apple.com/app-store/review/guidelines/>
- Google Play preview asset guidelines：<https://support.google.com/googleplay/android-developer/answer/9866151>
- Google Play User Data policy：<https://support.google.com/googleplay/android-developer/answer/10144311>
