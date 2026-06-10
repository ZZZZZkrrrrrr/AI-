# 审核账号访问交接包

日期：2026-06-10  
适用项目：`01_apps/ai_prompt_video_studio`  
公开域名：`https://www.zkraiflow.top/`

## 1. 目标

给 App Store、Google Play 和国内安卓商店审核人员准备一套可复用、无隐私数据、可访问全部受限功能的审核账号流程。

这份文档不保存真实密码。真实密码只放在发布密码管理器、商店后台的审核字段或私有交接渠道。

## 2. 审核账号要求

- 使用专门的审核账号，不使用个人管理员账号。
- 账号必须在审核期间持续有效，不因地区、设备、时间或一次性验证码失效。
- 审核账号关闭 MFA、OTP、设备绑定和地理限制。
- 账号内只放演示商品、演示素材、dry-run 任务，不放真实客户数据。
- 如果审核账号密码变更，需要重新执行 seed 和 smoke 验证。

## 3. 演示数据准备

```bash
REVIEW_BASE_URL=https://www.zkraiflow.top REVIEW_USERNAME=<account> REVIEW_PASSWORD=<secret> npm run review:seed
```

本地结构检查可以先运行：

```bash
npm run review:seed:dry
```

成功后应看到：

- 演示商品 `review-demo-product-001`。
- 演示账号素材 `review-demo-account-001`。
- 演示 dry-run 批量任务 `Review demo dry-run batch`。
- 审核账号可以访问数据导出和删除申请相关 API。

## 4. 审核路径

1. 打开 `https://www.zkraiflow.top/` 并登录审核账号。
2. 在首页查看视频模式的大按钮入口。
3. 切换到图文模式，点击“提示词包”，确认创建页直接进入提示词包步骤。
4. 打开创建页，查看商品图、商品资料、提示词包和 dry-run 视频生成配置。
5. 打开素材页，确认手机端显示卡片，而不是桌面表格。
6. 打开视频拼接页，确认移动端拼接流程可查看。
7. 打开“我的”，查看安装入口、隐私政策、帮助支持、账号数据导出和删除账号入口。

## 5. 提交到商店后台时填写

Apple App Review Information：

- 联系人姓名、电话、邮箱。
- 审核账号用户名。
- 审核账号密码。
- 备注：说明这是 AI 短视频工作流工具，演示账号只包含 review-safe 数据，视频生成可用 dry-run 审核，不会产生真实付费出片。

Google Play App access：

- Access type：部分功能需要登录。
- Instruction name：Review account access for AI Prompt Video Studio。
- Username：审核账号用户名。
- Password：审核账号密码。
- Additional instructions：从 `store/review-notes-template.json` 的 `googlePlayAppAccess.additionalInstructionsDraft` 复制并按最终账号调整。

## 6. 验收命令

```bash
npm run review:access-plan
npm run store:check
npm run review:seed:dry
SMOKE_BASE_URL=https://www.zkraiflow.top SMOKE_USERNAME=<account> SMOKE_PASSWORD=<secret> npm run cloud:smoke
```

## 7. 不允许入库

- 真实审核密码。
- MFA 恢复码。
- 密码管理器导出。
- 私有客户素材。
- API key、签名证书、商店账号密码。

## 8. 官方依据

- Apple App Review：<https://developer.apple.com/app-store/review/>
- Google Play 登录凭据要求：<https://support.google.com/googleplay/android-developer/answer/15748846>
- Google Play 审核准备：<https://support.google.com/googleplay/android-developer/answer/9859455>
