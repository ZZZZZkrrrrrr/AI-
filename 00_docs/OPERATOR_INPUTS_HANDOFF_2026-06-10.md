# App 上线运营输入交接清单

更新时间：2026-06-10  
公网域名：`https://www.zkraiflow.top`  
状态：公开页面和基础 smoke 已通过；仍在收集上线前必须由账号/运营/法务/基础设施负责人提供的真实值。

## 1. 这份清单解决什么

代码、移动端界面、PWA、截图计划和公网链接已经有自动检查。但正式给外部用户使用或提交 App Store / Google Play / 国内安卓商店前，还需要一批不能由代码自动生成的真实信息。

机器可读登记表：`01_apps/ai_prompt_video_studio/store/operator-inputs-register.json`  
自动检查命令：`npm run owner:inputs`

## 2. P0 必填

| 输入项 | 当前状态 | 写入位置 | 验证方式 |
| --- | --- | --- | --- |
| 客服邮箱 | 待提供 | `store/submission-readiness.json`、`public/support.html`、审核说明 | `npm run owner:inputs`、`npm run store:check` |
| 客服电话或业务联系电话 | 待提供 | `store/submission-readiness.json`、`public/support.html`、审核说明 | `npm run owner:inputs`、`npm run store:check` |
| 审核账号用户名 | 待创建 | 密码管理器、App Store/Google Play 审核说明 | `npm run review:seed`、`npm run cloud:smoke` |
| 审核账号密码引用 | 待创建 | 只写密码管理器条目名，不写真实密码 | `npm run review:seed`、`npm run cloud:smoke` |
| 运营主体名称 | 待确认 | 隐私政策、用户协议、支持页、上架资料 | `npm run compliance:check`、`npm run store:check` |
| 生产环境 Cookie/CORS | 待服务器环境验证 | 托管平台环境变量 | `npm run cloud:check:strict`、`npm run cloud:smoke` |
| 持久化存储 | 待基础设施确认 | `RUN_STORAGE_DIR` 或对象存储方案 | 重启后上传/导出/删除请求 smoke |

## 3. P1 必填

| 输入项 | 当前状态 | 写入位置 | 验证方式 |
| --- | --- | --- | --- |
| 最终 AI/视频/云服务商清单 | 待法务/工程确认 | 隐私草案、隐私政策、Data safety 表单 | `npm run store:check` |
| 数据保留与删除周期 | 待法务确认 | 隐私政策、发布手册、数据安全草案 | `npm run compliance:check` |
| libTV worker 生产拓扑 | 待设计 | 生产环境变量、部署手册 | `npm run cloud:check:strict` |
| Android SDK + JDK 17+ | 待安装 | 开发机或 CI 环境 | `npm run capacitor:check` |
| macOS/Xcode/Apple 签名 | 待配置 | Xcode、Apple Developer 后台 | Xcode Archive |
| 原生商店截图 | 待原生构建后捕获 | `store/screenshots/`、商店后台 | `npm run screenshots:check` |

## 4. 国内分发必填

| 输入项 | 当前状态 | 写入位置 |
| --- | --- | --- |
| ICP 备案号 | 待提供 | `store/submission-readiness.json`、公开页展示位置 |
| APP 备案号 | 待提供 | `store/submission-readiness.json`、App 内或公开页展示位置 |
| 备案号展示位置 | 待确认 | 设置页、支持页或法律页 |
| 国内安卓渠道 | 待选择 | 上架行动计划、隐私材料 |

## 5. 不要写进仓库

不要把这些内容写入项目文件：

- 真实账号密码
- API Key
- 签名证书私钥
- Android keystore 密码
- Apple 账号密码
- MFA 恢复码
- 私有客户素材
- 身份证、营业执照等非公开证件原件

仓库里只记录“已放在某个密码管理器条目/托管平台 Secret 名称里”。

## 6. 收齐后的验证顺序

1. 填入客服邮箱、电话、运营主体。
2. 创建审核账号，把密码放到密码管理器。
3. 在生产环境设置 `PUBLIC_APP_ORIGIN`、`CORS_ALLOWED_ORIGINS`、`CONSOLE_AUTH_COOKIE_SECURE=true`、`RUN_STORAGE_DIR`。
4. 执行：

```bash
npm run owner:inputs
npm run public:check
npm run store:check
npm run review:seed
npm run cloud:smoke
npm run release:check
```

5. Android/iOS 原生构建完成后，再补：

```bash
npm run capacitor:sync
npm run capacitor:check
npm run mobile:qa
npm run screenshots:check
```

