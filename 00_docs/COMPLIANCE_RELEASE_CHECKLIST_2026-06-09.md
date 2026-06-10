# 合规页面与发布验收清单

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 1. 本轮已落地

- 新增公开合规页面目录：`public/legal/`。
- 新增合规首页：`/legal/index.html`。
- 新增隐私政策：`/legal/privacy.html`。
- 新增用户协议：`/legal/terms.html`。
- 新增 AI 生成内容说明：`/legal/ai-disclosure.html`。
- 新增账号删除公开说明页：`/legal/delete-account.html`。
- 新增合规页面样式：`/legal/legal.css`。
- 已将这些页面加入 Service Worker 预缓存。
- 已在“我的 / 设置”页面增加“合规与协议”入口，手机端用户可以直接打开隐私政策、用户协议、AI 生成内容说明和账号删除公开说明页。
- 已在“我的 / 设置”页面增加“数据与账号”入口，支持导出账号数据摘要和提交删除账号申请。
- 已新增 `GET /api/account/export`、`POST /api/account/data-rights-request` 和 `GET /api/account/data-rights-requests`。
- 删除账号申请当前只记录请求，不会自动删除账号或业务数据。
- 删除账号申请已加入身份校验和二次确认，用户必须重新输入当前登录密码并输入“删除账号”，前端才允许提交，后端也会校验密码和 `DELETE_ACCOUNT` 确认标记。
- 已新增管理员数据权利审核队列，管理员可以查看全部请求，并将请求流转到核验中、已通过、处理中、已完成或未通过。
- 已在单条视频创建页新增 `AI 证据包` 下载按钮，导出任务 ID、模型通道、输入摘要、输出摘要和 AI 标识复核清单。
- 已在“我的 / 设置”的“数据与账号”区域展示最近的数据权利申请状态，用户提交删除账号申请后可以看到申请编号、状态和提交时间。
- 已新增 `AI_DISCLOSURE_EVIDENCE_PACK_2026-06-09.md`，记录 AI 生成内容证据包字段、边界和下一步。
- 已将 AI 证据包逻辑抽到 `src/shared/compliance/aiEvidencePack.js`，并让 `npm run compliance:check` 同时检查创建页入口和共享合规模块。
- 已将“我的 / 设置”抽到 `src/features/settings/SettingsPage.jsx` 并懒加载，`npm run compliance:check` 会检查设置页里的合规链接和数据权利入口。
- 新增 `scripts/check-compliance-assets.mjs`。
- 新增 `npm run compliance:check`，用于检查合规页面、关键主题、PWA 缓存和设置页入口。
- 新增 `npm run release:check`，串起合规检查、云端严格审计、上架材料检查、移动端就绪检查、PWA 检查、结构分析和生产构建。
- 新增 `npm run store:check` 和 `npm run store:check:strict`，用于区分内测阶段上架材料提醒和正式提交前严格门禁。
- 新增 `npm run capacitor:check` 和 `capacitor.config.json`，用于检查 App 封装前的基础配置和发布安全项。
- 新增 `STORE_SUBMISSION_READINESS_2026-06-09.md`，记录 App Store、Google Play、国内渠道、隐私披露、账号删除和 APP 备案的材料准备顺序。
- 新增 `ACCOUNT_DELETION_PUBLIC_ENTRY_2026-06-09.md`，记录公开账号删除入口的用途、边界和正式上线前待补项。
- 新增 `CAPACITOR_PACKAGING_READINESS_2026-06-09.md`，记录 Capacitor 配置、封装顺序和原生真机验证项。

当前验证结果：

- `npm run compliance:check` 通过，0 个失败项，并会检查 6 个合规页面、数据导出/删除申请/申请状态/身份校验/二次确认/管理员审核队列的前端入口和后端接口。
- `npm run release:check` 通过，入口 JS 仍低于 500KiB 预算。
- 合规检查仍提示 5 个“内测准备版文字需正式上架前复核”，这是预期提醒。

## 2. 页面用途

### 隐私政策

用于说明：

- 收集哪些数据。
- 为什么收集。
- 是否发送给第三方 AI 服务。
- 图片、提示词、视频、日志和账号数据如何保存。
- 用户如何删除账号、删除数据或导出数据。
- 联系方式和数据权利请求入口。

### 用户协议

用于说明：

- 账号使用规则。
- 用户上传内容责任。
- AI 生成结果复核责任。
- 禁止行为。
- 服务变更、暂停和终止。
- 收费、退款、争议解决等正式发布前需要补齐的条款。

### AI 生成内容说明

用于说明：

- AI 参与哪些环节。
- 如何标识 AI 生成或 AI 辅助生成内容。
- 用户不得删除、篡改、伪造或隐匿 AI 标识。
- 任务 ID、模型通道、生成时间和操作者如何留痕。
- 国内公开发布时需要进一步评估生成式 AI、深度合成、算法备案和 AI 生成合成内容标识义务。

## 3. 自动验收命令

开发过程中：

```bash
npm run compliance:check
```

公开发布前：

```bash
npm run release:check
```

`release:check` 当前包含：

- `npm run compliance:check`
- `npm run cloud:check:strict`
- `npm run store:check`
- `npm run app:health`

其中 `store:check` 会输出正式商店提交前的材料缺口，默认不阻断内测；`store:check:strict` 用于真正提交前把占位项作为失败处理。  
`app:health` 会继续执行移动端就绪检查、PWA 资产检查、App 结构分析、生产构建、入口体积守卫和 Capacitor 配置检查。

## 4. 正式上架前必须替换的内容

当前页面是“内测发布准备版”，正式发布前必须替换或补齐：

- 运营主体名称。
- 注册地址。
- 联系邮箱、客服电话或工单入口。
- 数据保护负责人或隐私联系人。
- 数据保存期限。
- 第三方 AI 服务商清单。
- SDK 清单。
- 权限清单。
- 账号删除入口。
- 公开账号删除说明页真实 URL。
- 数据导出入口。
- 收费、退款和订阅规则。
- App Store 隐私详情。
- Google Play 数据安全表单。
- 国内应用商店隐私合规检测材料。
- ICP 备案和 APP 备案材料。

## 5. 当前风险

- 目前仍是内测版法律文本，不能直接作为正式上架合同。
- 已有账号数据摘要导出、删除账号申请入口和管理员状态审核队列，但还没有完整自动删除、文件打包和保留期判断。
- 第三方 AI 服务商清单需要根据真实部署配置填写。
- AI 标识已经有产品提示、说明页面和用户侧证据包下载，但视频文件级隐式标识、服务端证据包归档和发布平台字段还需要继续落地。

## 6. 下一轮建议

1. 给删除账号申请增加保留期判断、真实删除执行、完成通知和管理员备注详情。
2. 将 AI 证据包写入服务端数据库和对象存储，并绑定任务、用户和视频结果。
3. 在视频结果页增加“下载合规证据包”入口。
4. 把第三方服务清单从配置生成到隐私政策页面，避免上线材料和真实配置不一致。

## 7. 官方来源

- Apple App Review Guidelines：<https://developer.apple.com/app-store/review/guidelines/>
- Apple User Privacy and Data Use：<https://developer.apple.com/app-store/user-privacy-and-data-use/>
- Google Play User Data policy：<https://support.google.com/googleplay/android-developer/answer/10144311>
- Google Play Data safety section：<https://support.google.com/googleplay/android-developer/answer/10787469>
- Google Play account deletion requirements：<https://support.google.com/googleplay/android-developer/answer/13327111>
- 工业和信息化部 APP 备案通知：<https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2023/art_920db564162e4312916a01bed6540ad8.html>
- 《人工智能生成合成内容标识办法》：<https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm>
