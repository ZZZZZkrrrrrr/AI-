# 发布证据登记表

生成日期：2026-06-10  
公网入口：`https://www.zkraiflow.top`  
当前结论：证据槽位已经建好，但外部发布和商店提交仍未完成。现在每个 blocker 都有对应的“要用什么证据关闭”的清单。

## 1. 这份文件解决什么问题

之前我们已经有上架资料、法务交接、云端交接、审核账号交接、原生签名交接、截图交接和商店后台交接。现在补上证据登记表，用来回答三个问题：

1. 哪个 blocker 还没关。
2. 关闭它需要什么证据。
3. 哪些证据可以放进仓库，哪些必须留在密码管理器、云平台或商店后台。

## 2. 新增文件

- `store/release-evidence-register.json`
- `store/evidence/README.md`
- `scripts/check-release-evidence-register.mjs`

## 3. 每个 blocker 的证据口径

| 证据包 | 覆盖内容 | 当前状态 |
| --- | --- | --- |
| `public-domain-and-auth-smoke` | 公网域名、认证 smoke、CORS、Cookie | 公网页面已验证，认证 smoke 待审核账号 |
| `support-contact-and-public-pages` | 客服邮箱、电话、支持页 | 待 owner 输入 |
| `legal-privacy-data-safety-final` | 法务终稿、隐私、Data safety | 草稿已结构化，待法务终稿 |
| `review-account-and-demo-seed` | 审核账号、演示数据、审核路径 | 模板已就绪，待真实账号 |
| `production-observability-and-rollback` | 监控、回滚、日志安全 | 交接已建，待平台证据 |
| `persistent-storage-restart-proof` | 持久化存储、重启后文件保留 | 待生产存储 |
| `libtv-worker-cloud-proof` | libTV 云端 worker | 方案已建，待云端 worker |
| `native-build-signing-upload-proof` | Android/iOS 签名与上传包 | 交接已建，待工具链和签名 |
| `native-store-screenshot-proof` | 原生商店截图 | Web 基线已捕获，待原生截图 |
| `mobile-device-qa-proof` | 真机/PWA/原生 QA | Web QA 已有，待真实设备证据 |
| `store-console-submission-proof` | App Store / Google Play 后台提交 | 交接已建，待后台最终填写 |
| `china-filing-and-domestic-distribution-proof` | 国内备案和渠道资料 | 待运营主体与备案号 |

## 4. 证据存放规则

可以放在 `store/evidence/`：

- 已脱敏的命令结果摘要。
- 已脱敏的公网 smoke 说明。
- 不含账号、账单、客户、密钥、签名材料的截图。
- 指向外部私有证据的简短清单说明。

不要放进仓库：

- 真实密码、API Key、Cookie、keystore、p12、provisioning profile、签名密码。
- 私有客户素材或客户生成结果。
- 未脱敏的商店后台、云平台、账单、日志、支持工单截图。
- 身份证、营业执照原件、账号恢复信息。

## 5. 验证命令

| 命令 | 用途 |
| --- | --- |
| `npm run release:evidence` | 检查证据登记表覆盖所有 blocker |
| `npm run owner:inputs` | 检查 owner 真实输入缺口 |
| `npm run store:check` | 检查基础上架资料 |
| `npm run store:console-plan` | 检查商店后台交接 |
| `npm run production:auth-plan` | 检查生产认证/CORS/Cookie 交接 |
| `npm run production:ops-plan` | 检查生产监控与回滚交接 |
| `npm run cloud:smoke` | 验证生产/审核环境 smoke |
| `npm run native:release-plan` | 检查原生签名与发布包交接 |
| `npm run screenshots:native-plan` | 检查原生商店截图交接 |
| `npm run mobile:qa` | 检查手机端真机 QA 计划 |
| `npm run china:distribution-plan` | 检查国内分发合规交接 |
| `npm run release:check` | 总发布门禁 |

## 6. 关闭 blocker 的顺序

1. 先补 owner 输入和 secret 引用，不要把 secret 写进仓库。
2. 跑对应证据包的验证命令。
3. 必要时把脱敏证据摘要放到 `store/evidence/`。
4. 跑 `npm run release:evidence`。
5. 跑 `npm run release:check`。
6. 只有目标环境验证通过后，才更新 blocker 状态。

