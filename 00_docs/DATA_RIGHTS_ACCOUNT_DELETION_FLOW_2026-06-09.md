# 账号数据导出与删除申请流程

日期：2026-06-09  
适用项目：`01_apps/ai_prompt_video_studio`

## 1. 本轮已落地

- 新增 `GET /api/account/export`，登录后导出当前账号的数据摘要。
- 新增 `POST /api/account/data-rights-request`，登录后提交数据权利请求。
- 新增 `GET /api/account/data-rights-requests`，登录后查看当前账号提交过的数据权利请求。
- 删除账号申请会写入 `runs/privacy-requests/{ownerUserId}.jsonl`。
- “我的 / 设置”新增“数据与账号”区域。
- 用户可以下载账号数据摘要 JSON。
- 用户可以提交删除账号申请备注。
- 删除账号申请必须重新输入当前登录密码，并输入“删除账号”完成二次确认；前端按钮和后端接口都会校验身份与确认标记。
- 用户可以在“数据与账号”区域查看最近的数据权利申请状态，并手动刷新。
- 申请记录会返回状态标签和下一步说明，方便手机端用户理解当前进度。
- 管理员可以在“数据权利审核队列”查看所有请求，并更新 `verifying`、`approved`、`processing`、`completed`、`rejected` 状态。
- 新增公开账号删除说明页 `/legal/delete-account.html`，用于商店审核、已卸载用户和无法登录用户查看删除路径。
- “我的 / 设置”的“合规与协议”区域已链接到公开账号删除说明页。
- `npm run compliance:check` 已检查前端入口和后端接口是否存在。

## 2. 当前能力边界

当前实现是上架准备基础，不是完整自动删除系统：

- 数据导出为摘要版，最多返回每类 100 条记录。
- 删除账号申请只记录请求，不会自动删除账号、任务、素材或输出文件。
- 删除请求已做当前密码校验，并已提供管理员状态流转入口；仍需要后续接入保留期判断、真实删除执行和完整通知流程。
- 公开删除页当前仍使用 TODO 联系邮箱和工单入口，正式上架前必须替换为真实公开渠道。
- 当前导出不会打包本地视频文件，只返回输出文件名称、类型、URL、大小和更新时间。

这样设计的原因是：当前项目还处在本机原型到云端化之间，直接做自动删除容易误删本地 SQLite、runs 文件和 libTV 输出。先记录申请和导出摘要，能满足产品流程闭环，也给后续正式删除流程留出审计空间。

## 3. 接口说明

### 导出账号数据摘要

```http
GET /api/account/export
```

返回内容：

- 当前用户公开信息。
- 导出时间。
- 数据行数摘要。
- 视频任务摘要。
- 商品和素材摘要。
- 批量任务摘要。
- 选品商品和账号资产摘要。
- 输出文件摘要。
- 数据权利请求记录。
- 合规页面 URL。

### 提交数据权利请求

```http
POST /api/account/data-rights-request
```

请求体：

```json
{
  "type": "delete_account",
  "scope": "account-and-generated-content",
  "reason": "用户填写的备注",
  "currentPassword": "当前登录密码",
  "confirmation": "DELETE_ACCOUNT"
}
```

当前支持类型：

- `export_data`
- `delete_account`
- `delete_data`
- `correct_data`

删除账号请求必须带有当前登录密码和确认标记；缺少密码或确认时返回 `400`，密码不正确时返回 `401`。

返回 `202`，表示请求已记录，待人工复核。

### 查看数据权利请求

```http
GET /api/account/data-rights-requests
```

返回当前账号提交过的请求记录。

记录中包含：

- `status`：机器状态，例如 `received`。
- `statusLabel`：面向用户的状态文案，例如“已收到”。
- `nextStep`：下一步处理说明。
- `identityVerified`：是否已完成当前密码校验。

### 管理员查看全部数据权利请求

```http
GET /api/admin/data-rights-requests
```

仅管理员可用。返回全部用户的数据权利申请记录，用于人工复核。

### 管理员更新请求状态

```http
POST /api/admin/data-rights-requests/{requestId}/status
```

请求体：

```json
{
  "status": "verifying",
  "reviewNote": "管理员审核备注"
}
```

当前支持状态：

- `received`
- `verifying`
- `approved`
- `processing`
- `completed`
- `rejected`

更新后会写入 `reviewHistory`，保留审核人、时间、状态和备注。

## 4. 前端入口

位置：`我的 / 设置 -> 数据与账号`

包含：

- `导出账号数据摘要`
- `删除申请备注`
- `当前登录密码`
- `二次确认`
- `提交删除账号申请`
- `申请状态`
- `刷新状态`
- 最近 5 条申请记录，展示申请编号、类型、状态、提交时间、身份校验结果、下一步和备注。

管理员账号额外显示：

- `数据权利审核队列`
- `刷新队列`
- 状态流转按钮：核验中、已通过、处理中、已完成、未通过。

手机端下，该区域会自动变为单列，避免按钮和输入框挤压。

## 5. 正式发布前还需要补齐

- 删除范围选择：账号、上传图片、提示词包、生成任务、视频输出、日志、证据包。
- 法定或业务保留期判断。
- 对象存储文件删除。
- PostgreSQL 多表软删除或匿名化。
- 删除完成通知。
- 数据导出完整包，包括原始图片、提示词包、视频文件和证据包。

## 6. 验收命令

```bash
npm run compliance:check
npm run release:check
```

当前 `release:check` 已通过。

## 7. 官方来源

- Apple User Privacy and Data Use：<https://developer.apple.com/app-store/user-privacy-and-data-use/>
- Google Play User Data policy：<https://support.google.com/googleplay/android-developer/answer/10144311>
- Google Play account deletion requirements：<https://support.google.com/googleplay/android-developer/answer/13327111>
