# App 发布渠道决策说明

日期：2026-06-10  
项目：`01_apps/ai_prompt_video_studio`  
公网域名：`https://www.zkraiflow.top`

## 结论

当前最适合的顺序是：

1. 手机端网页先做小范围试用。
2. PWA 作为第一阶段“像 App 一样安装到桌面”的版本。
3. Android Capacitor 包在生产登录、存储、隐私表、真机测试和签名完成后再上。
4. iOS Capacitor 包最后上，因为 App Review 对“只是网页套壳”的风险更高，需要证明它是完整可用的移动工作流。
5. 国内安卓渠道单独排期，需要主体、备案、隐私和渠道材料。

不要现在直接把网页套成 App 去提交商店。当前项目已经具备移动网页、PWA 资源、公开合规页面和 Capacitor 工程基础，但正式外部发布仍被生产云端、支持联系方式、隐私表、审核账号、签名和真机验证卡住。

## 官方依据

- MDN PWA installable guidance: `https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable`
- Capacitor workflow: `https://capacitorjs.com/docs/basics/workflow`
- Apple App Store Review Guidelines 4.2 Minimum Functionality: `https://developer.apple.com/app-store/review/guidelines/#minimum-functionality`
- Apple App Privacy Details: `https://developer.apple.com/app-store/app-privacy-details/`
- Google Play Data safety: `https://support.google.com/googleplay/android-developer/answer/10787469`
- Google Play account deletion requirements: `https://support.google.com/googleplay/android-developer/answer/13327111`

## 渠道 1：手机端网页

状态：可作为内测入口，但外部公开仍需生产账号链路验证。

适合现在做：

- 直接使用 `https://www.zkraiflow.top/`。
- 用户无需安装，最适合快速验证“小白按钮风格”和创作流程。
- 已有 390px 手机端截图证据，包括首页、通知、图文模式、创建、素材、我的页面。

上线前必须补齐：

- 生产环境登录、CORS、安全 Cookie 验证。
- 持久化存储验证。
- 真实支持邮箱/联系方式。
- 隐私和 AI 生成内容说明去掉预发布措辞。

## 渠道 2：PWA

状态：内部资源已准备，等待生产域名上的安装验证。

适合在手机网页稳定后马上做：

- Android Chrome 可走安装提示。
- iOS Safari 走“分享 > 添加到主屏幕”的引导。
- 不需要 App Store / Google Play 审核，迭代最快。

上线前必须补齐：

- 在 `https://www.zkraiflow.top` 上验证 manifest、Service Worker、离线页、更新提示。
- 登录态和 API 在 HTTPS 下稳定。
- PWA 安装后的首页、创建、素材、我的页面不出现桌面端布局泄漏。

## 渠道 3：Android Capacitor

状态：原生工程已有基础，等待 Android 工具链、签名、隐私表和真机验证。

适合在 PWA 通过后做：

- 面向需要 Google Play 或 APK 分发的用户。
- 可以复用当前 React/Vite 构建产物。
- Capacitor 路径是：先构建网页包，再同步到 Android/iOS 工程，再用原生工具链构建。

上线前必须补齐：

- Android SDK、JDK 17+、签名证书。
- Google Play Data safety 表。
- 审核账号和演示数据。
- 真机验证登录、文件选择、下载/打开链接、安全区、账号删除申请。

## 渠道 4：iOS Capacitor

状态：等待 macOS/Xcode、Apple Developer、隐私表、审核账号和真机验证。

为什么要放后面：

- iOS 审核对“最小功能”和“网页套壳”更敏感。
- 必须让审核人员看到清楚的移动端工作流，而不是一个桌面后台网页。
- 需要 iPhone/iPad 截图、隐私营养标签、审核账号和演示步骤。

上线前必须补齐：

- Xcode Archive / 签名。
- Apple App Privacy Details。
- 审核账号、审核说明和样例任务。
- iPhone/iPad 安全区、文件选择、支持/隐私页面、数据导出、删除账号申请验证。

## 渠道 5：国内安卓渠道

状态：等待主体、备案和渠道政策确认。

上线前必须补齐：

- 运营主体。
- ICP 备案和 App 备案材料。
- 国内渠道要求的隐私、权限、联系方式、截图和审核说明。
- 如涉及生成式 AI、视频生成或电商带货场景，需要保留 AI 标识和内容风险说明。

## 当前项目新增的落地物

- `store/release-channel-plan.json`：机器可读的发布渠道决策表。
- `scripts/check-release-channel-plan.mjs`：发布渠道检查脚本。
- `npm run release:channels`：单独检查发布渠道计划。
- `npm run release:check`：已把发布渠道计划纳入整体验收。

## 下一步建议

下一轮优先做“生产域名真实登录 + PWA 安装验证”的证据闭环。完成后，手机网页和 PWA 就可以作为第一批外部试用版本；原生 Android/iOS 继续等签名、真机和商店材料。
