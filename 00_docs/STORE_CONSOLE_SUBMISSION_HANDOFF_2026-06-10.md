# 商店后台提交交接清单

生成日期：2026-06-10  
公网入口：`https://www.zkraiflow.top`  
适用范围：App Store Connect、Google Play Console、国内安卓渠道。  
当前结论：资料结构已经可交接，但还不能提交审核；缺 owner 真实输入、法务终稿、审核账号、生产 smoke、签名包、原生截图和部分商店后台问卷答案。

## 1. 先不要提交审核

当前可以继续内部试用和资料准备，但不要点 App Store / Google Play 的正式提交审核。原因：

- 客服邮箱和电话仍是占位值。
- 审核账号用户名和密码引用未提供。
- 隐私政策、用户协议、AI 说明、账号删除页仍有预发布措辞。
- Apple App Privacy 和 Google Play Data safety 还只是草稿。
- Android/iOS 原生包还没有签名上传证据。
- 原生 App Store / Google Play 截图仍未从原生包捕获。
- 生产环境登录、CORS、Secure Cookie、持久化存储、worker 和回滚证据仍需最终验证。

## 2. App Store Connect 要填的内容

| 后台位置 | 当前来源 | 状态 |
| --- | --- | --- |
| App 信息、名称、Bundle ID | `store/submission-readiness.json`, `capacitor.config.json`, `ios/App/App.xcodeproj/project.pbxproj` | Bundle ID 已统一，最终名称待确认 |
| 副标题、描述、关键词 | `store/store-listing-copy-draft.json` | 草稿已结构化 |
| 支持 URL、隐私政策 URL | `store/submission-readiness.json`, `public/support.html`, `public/legal/privacy.html` | URL 已指向公网，联系方式待补 |
| 截图 | `store/native-store-screenshot-handoff.json` | 原生截图待捕获 |
| App Privacy | `store/privacy-data-safety-draft.json` | 草稿，需法务终稿 |
| 审核信息 | `store/review-notes-template.json`, `store/review-access-handoff.json` | 模板已就绪，缺真实审核账号 |
| 构建版本 | `store/native-release-signing-handoff.json` | 缺 Xcode archive 和上传证据 |
| 年龄分级 / 出口合规 | 商店后台问卷 | 待账号持有人确认 |

## 3. Google Play Console 要填的内容

| 后台位置 | 当前来源 | 状态 |
| --- | --- | --- |
| App 名称、短描述、完整描述 | `store/store-listing-copy-draft.json` | 草稿已结构化 |
| 分类、联系邮箱、隐私政策 | `store/submission-readiness.json` | 分类有草稿，邮箱待补 |
| App access | `store/review-notes-template.json` | 模板已就绪，缺真实账号 |
| Data safety | `store/privacy-data-safety-draft.json`, `store/privacy-form-fill-checklist.md` | 草稿，需法务终稿 |
| Account deletion | `public/legal/delete-account.html` | 页面已存在，流程需生产验证 |
| 截图、Feature graphic | `store/screenshot-plan.json`, `store/native-store-screenshot-handoff.json` | web 基线已捕获，原生截图和 1024x500 图待制作 |
| AAB 包 | `store/native-release-signing-handoff.json` | 缺 Android SDK/JDK17、签名和上传证据 |
| 内容分级、目标受众、广告声明 | 商店后台问卷 | 待账号持有人确认 |

## 4. 国内安卓渠道要补的内容

| 内容 | 当前来源 | 状态 |
| --- | --- | --- |
| 运营主体 | `store/operator-inputs-register.json`, `store/submission-readiness.json` | 待 owner 输入 |
| ICP 备案号 | `store/submission-readiness.json` | 待 owner 输入 |
| APP 备案号 | `store/submission-readiness.json` | 待 owner 输入 |
| 备案展示位置 | `store/submission-readiness.json` | 待 owner 输入 |
| 权限、SDK、隐私、AI 生成内容说明 | `store/china-distribution-compliance-handoff.json` | 交接已建，待渠道确认 |
| 签名 APK/AAB 和截图 | `store/native-release-signing-handoff.json`, `store/native-store-screenshot-handoff.json` | 待原生构建 |

## 5. 推荐执行顺序

1. 先补 owner 输入：客服邮箱、电话、运营主体、审核账号、生产存储、worker、签名资料。
2. 用 `npm run owner:inputs` 确认缺口。
3. 用 `npm run legal:finalization-plan` 和 `npm run compliance:check` 确认法务终稿。
4. 用 `npm run review:seed` 创建审核演示数据，再用 `npm run cloud:smoke` 验证审核账号。
5. 用 `npm run native:release-plan`、`npm run capacitor:check`、Android Studio、Xcode 完成签名包。
6. 从原生包捕获 iOS 和 Android 商店截图。
7. 在 App Store Connect / Google Play Console 填写资料。
8. 最后运行 `npm run release:check`，确认只剩商店后台人工提交动作。

## 6. 验证命令

| 命令 | 用途 |
| --- | --- |
| `npm run store:console-plan` | 检查商店后台提交交接是否完整 |
| `npm run store:check` | 检查基础上架资料 |
| `npm run owner:inputs` | 列出仍需 owner 提供的真实值 |
| `npm run legal:finalization-plan` | 检查法务终稿交接 |
| `npm run review:access-plan` | 检查审核账号交接 |
| `npm run native:release-plan` | 检查原生签名和发布包交接 |
| `npm run screenshots:native-plan` | 检查原生商店截图交接 |
| `npm run release:check` | 总发布门禁 |

## 7. 官方依据

- Apple App Store Connect app information: https://developer.apple.com/help/app-store-connect/reference/app-information/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple screenshots and previews: https://developer.apple.com/help/app-store-connect/manage-app-information/upload-app-previews-and-screenshots/
- Google Play create and set up your app: https://support.google.com/googleplay/android-developer/answer/9859152
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play app access credentials: https://support.google.com/googleplay/android-developer/answer/15748846
- Google Play preview assets: https://support.google.com/googleplay/android-developer/answer/9866151

## 8. 不要放进仓库

- Apple ID 或 Google 账号密码
- 审核账号真实密码
- Android keystore、Apple p12、provisioning profile
- Provider API Key
- 私有客户素材
- 带账号、付款、团队信息的商店后台截图
- 未脱敏生产日志

