# 移动端试点邀请包

更新时间：2026-06-10  
公开入口：`https://www.zkraiflow.top`  
结构化文件：`01_apps/ai_prompt_video_studio/store/pilot-invite-pack.json`  
校验命令：`npm run pilot:invite-pack`

## 1. 用途

这不是公开发布，也不是商店审核提交。它是给 3-5 位真实小白用户或内部运营同事使用的试点邀请包，用来验证手机端大按钮首页、PWA 安装、创建流程、素材结果、设置页反馈、隐私和数据权益入口。

建议至少邀请 5 位测试者，其中至少 3 位非技术用户。每位测试者安排 30-45 分钟，不提前讲复杂流程，只看他们能不能自己完成。

## 2. 当前允许的渠道

允许：

- 手机网页：打开 `https://www.zkraiflow.top`
- PWA：仅在 Android/iOS 真机安装验证后扩大使用

暂不允许：

- TestFlight iOS beta
- Google Play internal/closed/open testing
- App Store 或 Google Play 正式提交
- 国内安卓商店提交

原因是 iOS/Android 原生构建、签名、商店截图、审核账号、持久化存储、libTV worker 和法律/联系人最终信息仍未全部关闭。

## 3. 邀请话术

可以发给测试者：

> 这是 AI 视频工作台的手机端小范围试用，不是公开发布。请用手机打开 `https://www.zkraiflow.top`。你只需要尝试完成一个简单任务：选择首页的大按钮，添加演示商品图，生成或粘贴提示词，提交 dry-run 任务，然后找到结果。如果你卡住、看不懂、按钮太小、文字重叠或不知道下一步，请在“我的/设置”里的反馈入口提交。请不要上传私人商品图、客户资料、密码或敏感业务文件。预计需要 30-45 分钟。

## 4. 测试前必须确认

运行：

- `npm run pilot:invite-pack`
- `npm run pilot:readiness`
- `npm run pilot:feedback`
- `npm run mobile:qa:evidence`
- `npm run public:check`
- `npm run pwa:public-smoke`
- `npm run release:evidence`
- `npm run product:report`

人工确认：

- 已指定试点负责人
- 已指定反馈处理人
- 已指定回滚负责人
- 测试者已经收到安全说明
- dry-run 状态仍然符合当前云端和 worker 准备情况

## 5. 不要上传或入库

不要上传到 App 或放进仓库：

- 私人商品图
- 客户资料
- 平台密码
- API Key
- Cookie
- 审核账号真实密码
- Android keystore
- Apple 证书或描述文件
- 未脱敏生产日志

仓库里只能放脱敏截图、测试结果摘要、命令结果和阻断项编号。

## 6. 试点任务脚本

测试者要完成：

1. 打开 `https://www.zkraiflow.top`。
2. 看首页，选择一个大按钮。
3. 添加演示商品素材。
4. 生成或粘贴提示词包。
5. 提交 dry-run 任务。
6. 找到素材、结果、支持、隐私、AI 说明、账号删除或数据导出入口。
7. 在手机设置页提交一次反馈。

## 7. 成功标准

- 至少 3/5 测试者能在不被人工引导的情况下完成 dry-run 路径。
- 至少 4/5 测试者能说清楚自己点了哪个首页大按钮。
- 至少 4/5 测试者能找到反馈入口。
- 至少 4/5 测试者能找到隐私、AI 说明、账号删除或数据权益入口。
- 扩大试点前没有未解决的 P0 问题。

P0 指：无法继续核心流程、无法找到数据权益/法律/支持入口、出现隐私安全问题、登录/上传/安装直接阻断。

## 8. 停止规则

出现以下情况就暂停继续邀请：

- 连续两位测试者无法完成登录、上传、数据删除/导出或反馈提交。
- 反馈或截图暴露私人数据。
- PWA 安装后打开了错误域名、错误图标、错误名称或空白离线页。
- 签名文件、密钥、审核密码进入仓库材料。
- 持久化存储、worker 健康检查和回滚证据没完成，但有人准备打开真实视频生成。

## 9. 官方依据

- web.dev PWA installation：`https://web.dev/learn/pwa/installation`
- Chrome Lighthouse PWA installability：`https://developer.chrome.com/docs/lighthouse/pwa/installable-manifest`
- Apple TestFlight beta testing：`https://developer.apple.com/help/app-store-connect/test-a-beta-version/overview-of-testing-with-testflight/`
- Google Play testing：`https://support.google.com/googleplay/android-developer/answer/9845334`
- Google Play Data safety：`https://support.google.com/googleplay/android-developer/answer/10787469`
