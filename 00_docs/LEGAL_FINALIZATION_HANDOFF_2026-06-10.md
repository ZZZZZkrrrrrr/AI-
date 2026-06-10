# 法务终稿与隐私上架交接包

更新时间：2026-06-10  
项目：AI Prompt Video Studio  
公网域名：https://www.zkraiflow.top  
状态：交接包已准备，等待真实运营/法务输入。本文不是法律意见，正式上架前需要由实际运营主体或法务确认。

## 1. 当前结论

现在项目已经有隐私政策、用户协议、AI 说明、账号删除、支持页、数据导出/删除请求入口和隐私表单草案。但这些页面仍属于预发布草案，不能直接当作最终法务文本提交商店。

不要为了通过检查而删除“预发布/草案”提示。只有下面这些真实信息确认后，才能把法律页面改成终稿：

| 输入项 | 当前占位 | 写入位置 |
| --- | --- | --- |
| 客服邮箱 | TODO_CONTACT_EMAIL | `store/submission-readiness.json`、`public/support.html`、隐私政策、审核说明 |
| 客服电话或联系策略 | TODO_CONTACT_PHONE | `store/submission-readiness.json`、`public/support.html`、审核说明 |
| 支持响应承诺 | TODO_SUPPORT_SLA | `public/support.html`、审核说明 |
| 运营主体名称 | TODO_OPERATOR_LEGAL_ENTITY | 隐私政策、用户协议、支持页、国内分发资料 |
| 最终服务商和 SDK 清单 | TODO_FINAL_PROVIDER_LIST | 隐私政策、数据安全草案、商店隐私表单 |
| 数据保存和删除周期 | TODO_RETENTION_POLICY | 隐私政策、账号删除页、生产部署手册 |
| AI 服务商是否训练/保留数据 | TODO_AI_PROVIDER_DATA_TRAINING_POLICY | 隐私政策、AI 说明、数据安全草案 |
| AI 生成内容标识策略 | TODO_AI_GENERATED_CONTENT_LABELING_POLICY | AI 说明、AI 证据包、国内合规资料 |
| 账号删除处理方式 | TODO_ACCOUNT_DELETION_HANDLING | 账号删除页、Google Play 数据删除表单 |

## 2. 需要终稿确认的页面

| 页面 | 文件 | 终稿前必须确认 |
| --- | --- | --- |
| 法律中心 | `public/legal/index.html` | 所有链接页面都已是终稿，移除预发布措辞 |
| 隐私政策 | `public/legal/privacy.html` | 收集哪些数据、如何收集、用途、共享对象、服务商、保存周期、删除方式、联系方式 |
| 用户协议 | `public/legal/terms.html` | 运营主体、用户上传内容权利、AI 使用边界、禁止行为、责任限制、终止规则 |
| AI 生成内容说明 | `public/legal/ai-disclosure.html` | AI 服务商范围、人工审核责任、生成内容标识、用户发布前审核义务 |
| 账号删除 | `public/legal/delete-account.html` | App 内入口、公开网页入口、身份核验、删除范围、处理时限、保留例外 |
| 支持页 | `public/support.html` | 可联系的邮箱/电话、响应时限、隐私和删除入口、域名一致性 |

## 3. 商店表单交接

Apple App Store Connect：

- App Privacy 不能填 Not Collected，因为当前产品有账号、上传素材、任务记录、生成结果和诊断数据。
- 需要确认所有第三方伙伴和服务商，包括 AI、视频生成、托管、存储、日志、崩溃统计、支付、推送、客服、分析工具。
- 隐私政策链接必须是 `https://www.zkraiflow.top/legal/privacy.html`，并且 App 内也要容易访问。

Google Play Console：

- Data safety 要覆盖收集、共享、加密传输、数据删除和第三方代码行为。
- 如果 App 允许创建账号，就必须同时提供 App 内删除入口和公开网页删除入口。
- 当前公开删除入口是 `https://www.zkraiflow.top/legal/delete-account.html`，但终稿前还要确认删除范围、时限和保留例外。

国内分发：

- 需要确认运营主体、ICP备案号、APP 备案号、展示位置、权限说明和 AI 生成内容标识策略。
- 如果面向国内公开分发，AI 生成内容标识和深度合成/生成式 AI 相关要求需要由法务复核。

## 4. 不要写进仓库

- 真实审核账号密码
- API Key
- Apple / Google 账号密码
- Android keystore 和密码
- 私有合同、证件原件、营业执照扫描件
- 私有客户素材
- 未公开的服务商商业合同

## 5. 自动检查

新增检查命令：

```bash
npm run legal:finalization-plan
```

推荐在每次准备发版前运行：

```bash
npm run legal:finalization-plan
npm run compliance:check
npm run store:check
npm run owner:inputs
npm run release:check
```

`legal:finalization-plan` 只证明交接包完整，不代表法律页面已经是终稿。真正解除发布阻断时，需要同时满足：

1. 所有 TODO 输入被真实值替换。
2. 公开法律页面删除预发布措辞。
3. Apple 隐私标签和 Google Data safety 与生产行为一致。
4. 账号删除流程在生产环境可用。
5. 法务或运营负责人在仓库外完成终稿确认。

## 6. 官方依据

- Apple App Privacy Details: https://developer.apple.com/app-store/app-privacy-details/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Google Play User Data policy: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play account deletion requirements: https://support.google.com/googleplay/android-developer/answer/13327111
- 生成式 AI / AI 合成内容标识相关要求：https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm

## 7. 关联文件

- `store/legal-finalization-handoff.json`
- `scripts/check-legal-finalization-plan.mjs`
- `store/privacy-data-safety-draft.json`
- `store/privacy-form-fill-checklist.md`
- `store/submission-readiness.json`
- `store/release-blockers-register.json`
- `store/operator-inputs-register.json`
- `public/legal/privacy.html`
- `public/legal/terms.html`
- `public/legal/ai-disclosure.html`
- `public/legal/delete-account.html`
- `public/support.html`
