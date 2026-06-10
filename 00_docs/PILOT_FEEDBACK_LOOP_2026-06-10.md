# Workflow App 试点反馈闭环

日期：2026-06-10  
适用入口：https://www.zkraiflow.top  
检查命令：`npm run pilot:feedback`

## 当前结论

手机端“我的/设置”页已经有试用反馈入口。试点用户可以提交功能异常、看不懂/不好用、安装到桌面、速度卡顿、新能力建议和其他反馈；管理员可以在同一页面查看反馈队列，并标记排查中、已排期、已修复或已关闭。

这套反馈闭环只适合小范围试点和内部运营，不等于客服体系已经完整上线。正式公开发布前仍需要补齐真实客服邮箱、电话或业务联系政策、支持 SLA、生产监控和回滚负责人。

## 用户侧设计

- 入口放在“我的/设置”页的 App 准备中心下方，适合手机用户单手找到。
- 表单只保留 4 个字段：问题类型、影响程度、发生了什么、联系方式。
- 提交按钮要求至少 6 个字，避免空反馈。
- 反馈提交后，用户可以看到最近 4 条反馈和处理状态。
- 不要求用户上传截图，避免误收私有商品图、账号信息或聊天记录。

## 管理员侧设计

- 管理员可以在“试用反馈处理”队列里查看全部试点反馈。
- 处理状态只做轻量流转：排查中、已排期、已修复、已关闭。
- 队列用于试点期间每日复盘，不替代正式工单系统。
- 管理员备注和状态会写入非敏感 JSONL 记录，后续可迁移到数据库或工单系统。

## 后端与数据

- 用户反馈接口：`POST /api/support/feedback`
- 用户反馈列表：`GET /api/support/feedback`
- 管理员反馈列表：`GET /api/admin/support-feedback`
- 管理员更新状态：`POST /api/admin/support-feedback/:id/status`
- 存储位置：`RUN_STORAGE_DIR/support-feedback/*.jsonl`

不要写入仓库或反馈记录：

- 密码、验证码、API Key、签名证书
- 原始截图、私有商品图、客户数据
- 未脱敏生产日志
- Store Console、App Store Connect、Google Play Console 的私有截图

## 试点前检查

在 `D:\Organized\Projects\codex_project\workflow\01_apps\ai_prompt_video_studio` 执行：

```bash
npm run pilot:feedback
npm run mobile:check
npm run release:check
```

## 后续升级

1. 小范围试点：继续使用 JSONL 队列和管理员处理。
2. 外部试点：补真实客服邮箱、SLA、回滚负责人和每日复盘节奏。
3. 公开发布：接入正式工单系统或数据库表，支持附件脱敏、工单编号、负责人、优先级和导出。

