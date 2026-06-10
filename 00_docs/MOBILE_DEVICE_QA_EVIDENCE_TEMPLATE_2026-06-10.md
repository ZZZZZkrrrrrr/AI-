# 移动端真机验收证据模板

更新时间：2026-06-10  
公开入口：`https://www.zkraiflow.top`  
模板文件：`01_apps/ai_prompt_video_studio/store/mobile-device-qa-evidence-template.json`  
校验命令：`npm run mobile:qa:evidence`

## 1. 这份模板解决什么问题

现在项目已经有移动端网页截图、PWA 检查、Capacitor 封装计划、审核账号交接和商店资料草案，但正式给外部用户或商店审核前，还缺少一份“真机验收证据应该怎么填”的固定格式。

这份模板把测试者、设备、用例、截图、失败记录和禁止入库内容统一起来。后面你找同事或真实小白用户测试时，不需要重新解释测试格式，只要让他们按模板记录结果。

## 2. 最新官方依据

- Apple App Store Connect 截图规格：`https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/`
- Apple App Review Guidelines：`https://developer.apple.com/app-store/review/guidelines/`
- Google Play 预览素材规范：`https://support.google.com/googleplay/android-developer/answer/9866151`
- Google Play Data safety：`https://support.google.com/googleplay/android-developer/answer/10787469`
- PWA 安装体验：`https://web.dev/learn/pwa/installation`

这些资料决定了几个验收重点：商店截图必须来自真实或最终构建界面，PWA 要能安装并从主屏启动，隐私/数据删除/支持入口要在移动端可见，审核账号不能把真实密码写进代码仓库。

## 3. 测试者安排

建议一轮至少 5 位测试者，其中至少 3 位非技术用户。每位测试者只做一轮 30-45 分钟任务，不提前讲复杂流程，只给目标：

1. 打开 `https://www.zkraiflow.top`。
2. 从首页选择一个大按钮入口。
3. 上传或选择演示商品图。
4. 生成或粘贴提示词包。
5. 提交 dry-run 任务。
6. 找到素材/结果。
7. 找到反馈、隐私、AI 说明、账号删除或数据导出入口。

通过标准不是“页面能打开”，而是小白用户能自己完成路径、知道下一步在哪里、遇到错误时知道该反馈给谁。

## 4. 必填证据

每条证据建议保存为：

`store/evidence/mobile-device-qa/YYYY-MM-DD/<device-id>/<case-id>-redacted.png`

每条测试记录至少包含：

- 测试时间
- 测试者编号，例如 `T01-redacted`
- 设备目标，例如 `mobile-web-public`、`android-chrome-pwa`、`ios-safari-pwa`
- 对应套件和用例 ID
- 结果：`pass`、`fail` 或 `blocked`
- 脱敏截图路径
- 简短问题描述
- 如果失败，关联到 `store/release-blockers-register.json` 的阻断项

## 5. 不要放进仓库

不要放进仓库的内容：

- 真实审核账号密码
- Cookie、Token、API Key
- Android keystore、iOS 证书、签名文件
- 未脱敏的生产日志
- 私人商品图、客户素材、聊天记录
- 商店后台里带账号、付款、身份信息的截图

真实密码只放密码管理器。仓库里只记录“密码管理器条目名称”或“由发布负责人已确认”。

## 6. 发布前关闭标准

外部试用前：

- `npm run mobile:qa` 通过。
- `npm run mobile:qa:evidence` 通过。
- 所有 P0 的 `mobile-web-public` 用例至少有 1 位非技术用户通过。
- Android/iOS 原生用例如果仍是 blocked，只能继续内部网页/PWA 试用，不能提交原生商店。
- 失败或 blocked 的 P0 用例必须登记到 `store/release-blockers-register.json`。

商店提交前：

- Android 和 iOS 原生构建不再处于 blocked 状态。
- App Store / Google Play 截图来自最终原生构建或商店认可的设备族截图。
- 截图不出现本地路径、TODO URL、测试账号密码、私人素材或未定稿法律文案。

## 7. 当前状态

当前状态是“模板就绪，等待真实设备结果”。它不会假装真机已经完成，但已经把后续验收要收集的证据格式固定下来了。
