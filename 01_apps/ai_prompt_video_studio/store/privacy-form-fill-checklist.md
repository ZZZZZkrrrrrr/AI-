# App 隐私与数据安全表单填写清单

更新时间：2026-06-09  
适用范围：手机网页、PWA、Capacitor iOS App、Capacitor Android App  
状态：草案，可用于上架前内部核对，不替代正式法务审核。

## 0. 填表前先准备

正式填写 Apple、Google Play 或国内安卓商店资料前，先准备这些信息：

| 材料 | 当前状态 | 用途 |
| --- | --- | --- |
| 公开隐私政策 URL | TODO | Apple、Google、国内安卓商店都需要 |
| 公开账号删除 URL | TODO | Google Play 账号删除要求，国内商店也常要求 |
| 客服邮箱和电话 | TODO | 商店联系信息、用户投诉、隐私请求 |
| 运营主体名称 | TODO | 国内安卓商店、ICP备案、APP 备案 |
| ICP 备案号和 APP 备案号 | TODO | 国内公开分发 |
| AI/视频服务商清单 | 未定 | 判断用户上传内容是否共享给服务提供商 |
| 云存储、日志、监控、崩溃统计服务商 | 未定 | 判断诊断数据、文件和任务日志处理方式 |
| 数据保存期限 | 未定 | 隐私政策、删除请求、商店审核 |

当前推荐的统一口径：

- 不接入广告 SDK。
- 不接入第三方分析 SDK，除非后续明确新增。
- 不做跨 App/跨网站追踪。
- 用户上传的图片、提示词、商品信息和生成结果，可能会共享给 AI/视频生成服务商，仅用于完成用户发起的任务。
- Android 当前只声明 `INTERNET` 权限；相册、文件保存、分享、通知、相机、麦克风等能力一旦新增，必须重新审查。

## 1. Apple App Store Connect：App Privacy

官方依据：[Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)。

Apple 要求披露 App 及第三方伙伴代码的数据收集实践，并判断数据是否关联用户、是否用于追踪、用途是什么。当前项目建议按下面口径填写。

### 1.1 顶层问题

| App Store Connect 问题 | 当前建议填写 | 上架前确认 |
| --- | --- | --- |
| Do you or your third-party partners collect data from this app? | Yes | 因为有账号、上传素材、任务记录和生成结果 |
| Tracking | No | 仅在未接入广告、归因、跨站追踪、数据经纪等能力时成立 |
| Privacy Policy URL | 填正式 HTTPS 隐私政策 URL | 替换 `TODO_PUBLIC_PRIVACY_POLICY_URL` |
| User Privacy Choices URL | 可填账号删除或数据请求页面 | 建议填公开账号删除 URL |

### 1.2 建议勾选的数据类别

| Apple 类别 | 是否建议勾选 | 本项目对应数据 | 用途 | 是否关联用户 |
| --- | --- | --- | --- | --- |
| Identifiers | 是 | user id、session、账号标识 | App Functionality | 是 |
| Contact Info | 条件勾选 | 如果 username 允许邮箱或手机号，则勾选 | App Functionality | 是 |
| Photos or Videos | 是 | 商品图、参考图、生成视频结果 | App Functionality、Product Personalization | 是 |
| User Content | 是 | 提示词包、商品描述、AI 生成提示词、生成结果、证据包 | App Functionality | 是 |
| Usage Data | 是 | 任务 id、任务状态、批量任务、操作时间、用量记录 | App Functionality | 是 |
| Diagnostics | 是 | 错误信息、健康检查、失败原因、性能和稳定性日志 | App Functionality | 部分关联用户 |

### 1.3 当前不建议勾选的数据类别

如果产品没有新增对应功能，不要勾选：

- Location
- Contacts
- Health and Fitness
- Financial Info
- Purchases
- Browsing History
- Search History
- Sensitive Info

### 1.4 Apple 填写时的注意点

1. 如果用户名允许用户填邮箱，保守做法是把它当作 Contact Info；另一种做法是限制用户名不使用邮箱/手机号。
2. 如果后续接入 Apple 登录、微信登录、手机号登录、支付、广告、分析、归因或崩溃 SDK，必须重新审查。
3. 如果生产日志保存 IP 地址、设备标识或更细的设备信息，需要补到对应类别。
4. 不要为了看起来“更轻”而选择 Not Collected，当前产品明确会收集账号、上传内容和任务数据。

## 2. Google Play Console：Data Safety

官方依据：[Google Play Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)、[Google Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)、[Google Play account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)。

Google Play 需要说明是否收集、是否共享、是否加密传输、用户是否能删除数据，以及每类数据的用途。

### 2.1 顶层问题

| Google Play 问题 | 当前建议填写 | 上架前确认 |
| --- | --- | --- |
| Does your app collect or share any required user data types? | Yes | 账号、上传文件、生成结果、任务记录都属于用户数据 |
| Is all user data collected by your app encrypted in transit? | Yes, only after production HTTPS is enforced | 未配置 HTTPS 前不能这样承诺 |
| Do you provide a way for users to request that their data is deleted? | Yes | App 内设置页和公开删除页面都要可用 |
| Account creation | Yes | 当前已有注册/登录 |
| Web deletion link | 填正式 HTTPS 账号删除 URL | 替换 `TODO_PUBLIC_BASE_URL/legal/delete-account.html` |

### 2.2 建议填写的数据类型

| Google 类别 | 数据类型 | Collected | Shared | 用途 |
| --- | --- | --- | --- | --- |
| Personal info | Name or username、User IDs | Yes | No | Account management、App functionality |
| Photos and videos | Photos、Videos | Yes | Yes | App functionality、Personalization |
| Files and docs | Files and docs | Yes | Yes | App functionality |
| App activity | App interactions、Other user-generated content | Yes | No | App functionality |
| App info and performance | Crash logs、Diagnostics、Other app performance data | Yes | No | App functionality、Security, fraud prevention, and compliance |

Shared 口径说明：

- 商品图、提示词、商品信息、生成结果如果发送给 AI/视频生成服务商，应视为共享给服务提供商。
- 账号信息、任务状态、错误日志当前不计划共享给广告或数据经纪服务。
- 如果后续接入第三方分析、崩溃统计、客服、支付、对象存储或推送服务，要重新判断是否 Shared。

Analytics 口径说明：

- 当前建议不要默认选择 Analytics，因为项目没有第三方分析 SDK。
- 如果上线后会收集用户行为来分析产品使用情况、功能热度或转化漏斗，再补选 Analytics。
- 仅用于用户任务执行、额度、成本、安全、客服排障的记录，优先按 App functionality 或 Security 处理。

### 2.3 Google 账号删除要求

因为 App 允许创建账号，需要同时满足：

1. App 内能找到删除账号或删除数据请求入口。
2. 卸载 App 后，用户仍能通过公开网页发起删除请求。
3. 删除说明要说清楚会删除哪些数据、哪些数据会因法律/安全/争议处理继续保留。
4. Google Play Console 里的删除链接必须是可公开访问的 HTTPS 页面。

当前证据：

- App 设置页已有数据导出和删除请求入口。
- 服务端已有 `/api/account/export` 和 `/api/account/data-rights-request`。
- 公开删除页面已有草案，但正式域名、联系方式和删除时限仍是发布前阻断项。

## 3. 国内安卓商店和中国公开分发

参考依据：

- [工信部 APP 备案相关通知](https://www.miit.gov.cn/)
- [互联网信息服务深度合成管理规定](https://www.gov.cn/zhengce/zhengceku/2022-12/12/content_5731431.htm)
- [生成式人工智能服务管理暂行办法](https://www.gov.cn/zhengce/zhengceku/202307/content_6891752.htm)
- [人工智能生成合成内容标识办法](https://www.cac.gov.cn/)

国内商店通常会比 Apple/Google 多要运营主体、备案、权限说明、隐私合规截图和 AI 内容说明。不同渠道表单名称会变化，但材料可以按下面准备。

### 3.1 基础材料

| 材料 | 当前建议 | 状态 |
| --- | --- | --- |
| 应用名称 | AI Prompt Video Studio 或正式中文名 | 待定 |
| 应用分类 | 效率/工具/视频创作 | 待定 |
| 运营主体 | 填真实公司或个体主体 | TODO |
| ICP 备案号 | 绑定公开域名 | TODO |
| APP 备案号 | 国内公开分发前准备 | TODO |
| 隐私政策 URL | 公开 HTTPS 页面 | TODO |
| 用户协议 URL | 公开 HTTPS 页面 | TODO |
| 账号删除 URL | 公开 HTTPS 页面 | TODO |
| 客服邮箱/电话 | 可联系、可响应 | TODO |

### 3.2 权限说明

| 权限 | 当前状态 | 面向用户的说明 |
| --- | --- | --- |
| 网络访问 | 必需 | 用于登录、提交 AI 生成任务、查看结果、打开帮助和合规页面 |
| 文件/相册读取 | Web 端通过文件选择器使用；Native 插件待审查 | 用于上传商品图、提示词包或素材 |
| 相册保存/系统分享 | 暂未声明 | 仅在支持保存或分享生成视频时添加 |
| 相机 | 暂未声明 | 仅在支持直接拍摄商品图时添加 |
| 麦克风 | 暂未声明 | 当前不需要 |
| 通知 | 暂未声明 | 仅在支持任务完成提醒时添加 |

原则：不要提前申请暂时不用的敏感权限。新增权限时，同步更新隐私政策、商店权限说明、截图和自动检查。

### 3.3 AI 生成内容说明

建议在国内分发材料中明确：

1. App 用于商品图理解、提示词生成、短视频生成和视频拼接。
2. 用户应确保上传素材、商品信息、肖像、商标、音乐和文案拥有合法使用权。
3. AI 生成结果可能存在错误、夸大、侵权或不合规风险，用户发布前需要人工审核。
4. App 内已有 AI 生成内容说明和合规预检/证据包设计。
5. 如果最终产品面向公众提供生成合成内容发布或传播能力，应由法务确认显式标识、隐式标识、深度合成和生成式 AI 相关要求。

## 4. 上架前阻断项

这些事项没完成前，不建议提交正式审核：

1. 所有 `TODO_PUBLIC_*` URL 替换为正式 HTTPS 地址。
2. 隐私政策、用户协议、AI 生成内容说明、账号删除页面去掉“内测/预发布”措辞。
3. 填好客服邮箱、电话、运营主体、ICP 备案号、APP 备案号。
4. 确认生产环境启用 HTTPS、安全 Cookie、固定 CORS 来源、服务端密钥管理。
5. 确认 AI/视频服务商、云存储、日志、监控、崩溃统计、支付、推送、客服、分析 SDK 清单。
6. 确认账号删除不仅能提交请求，还能按流程删除或匿名化账号、文件、任务、生成结果和服务商侧数据。
7. 确认截图和审核演示账号不暴露本地路径、真实用户数据、密钥或未备案域名。
8. 在真机或模拟器完成 iOS、Android 封装验证。

## 5. 变更触发重新审查

只要出现下面任一变化，就重新跑隐私和数据安全审查：

- 新增广告、统计分析、归因、崩溃统计、支付、推送、客服、社交登录 SDK。
- 新增相册保存、相机、麦克风、定位、通讯录、蓝牙、剪贴板、后台任务等权限。
- 用户数据开始同步到新的云服务或第三方服务商。
- AI 供应商、视频生成服务商、对象存储、日志系统发生变化。
- 从只做工具变成公开社区、模板市场、内容分发平台或素材交易平台。
- 增加付费订阅、会员、积分、企业账号或团队协作。

## 6. 关联文件

- 机器可读数据流草案：`store/privacy-data-safety-draft.json`
- 商店提交总表：`store/submission-readiness.json`
- 审核说明模板：`store/review-notes-template.json`
- 发布行动计划：`store/launch-action-plan.json`
- 公开隐私政策草案：`public/legal/privacy.html`
- 公开账号删除草案：`public/legal/delete-account.html`
