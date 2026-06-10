# App 上线资料收集表

生成日期：2026-06-10  
公网域名：`https://www.zkraiflow.top`  
状态：`collecting-owner-inputs`  

这份表给运营、法务、账号持有人和工程负责人使用。它只收集“上线必须有人确认的真实值或凭证位置”，不要把真实密码、API Key、签名密钥、证书私钥、MFA 恢复码或私有客户素材写进仓库。

## 使用方式

1. 按负责人分发表格，先收齐“待提供”的必填项。
2. 公开信息可以写入仓库，例如客服邮箱、客服电话、运营主体、备案展示位置。
3. 敏感信息只记录密码管理器条目名、托管平台 Secret 名称或负责人的确认结论。
4. 收齐后由工程把非敏感值写回对应文件或生产环境，再运行验收命令。

## 最快上线顺序

| 顺序 | 事项 | 为什么先做 |
| --- | --- | --- |
| 1 | 客服邮箱、客服电话、运营主体 | 影响公网支持页、隐私政策和商店资料。 |
| 2 | 审核账号和密码管理器引用 | 影响 App Store / Google Play 审核和生产 smoke。 |
| 3 | 生产 Cookie/CORS、持久化存储、libTV worker | 影响外部用户登录、任务记录、上传素材和真实生成。 |
| 4 | 最终服务商清单、数据保留与删除周期 | 影响隐私政策、AI 说明和数据安全表单。 |
| 5 | Android/iOS 工具链、签名和原生截图 | 影响原生商店提交。 |
| 6 | ICP 备案号、APP 备案号、展示位置 | 影响国内公开分发。 |

## 当前缺口汇总

缺少必填项：18

| 负责人 | 分组 | 资料项 | 当前值 | 目标格式 | 安全边界 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| business-ops | Store contact and user support | Support email | TODO_CONTACT_EMAIL | Monitored email address, for example support@example.com. | 可提供当前资料项；不要提交：Mail admin password；Mailbox recovery code | npm run store:check; npm run public:check |
| business-ops | Store contact and user support | Support phone or business contact number | TODO_CONTACT_PHONE | Reachable support or business phone number in international format when possible. | 可提供当前资料项；不要提交：Personal private phone if it should not appear in store records | npm run store:check; npm run public:check |
| product-ops | Reviewer account and seeded demo data | Reviewer username | TODO_REVIEW_USERNAME | Dedicated account, not a personal admin account. | 可提供当前资料项；不要提交：Real password；MFA recovery code | REVIEW_BASE_URL=https://www.zkraiflow.top REVIEW_USERNAME=<account> REVIEW_PASSWORD=<secret> npm run review:seed; SMOKE_BASE_URL=https://www.zkraiflow.top SMOKE_USERNAME=<account> SMOKE_PASSWORD=<secret> npm run cloud:smoke |
| product-ops | Reviewer account and seeded demo data | Reviewer password secret reference | TODO_PASSWORD_MANAGER_REFERENCE | Password-manager item or hosting secret name, never the real password. | 只提供密码管理器条目或托管平台 Secret 名称，不提供真实密钥/密码。 | npm run review:seed; npm run cloud:smoke |
| product-legal | Legal operator and final privacy wording | Operator legal entity | TODO_OPERATOR_LEGAL_ENTITY | Registered company or individual operator name used for store/deployment records. | 可提供当前资料项；不要提交：Identity document image；Business license scan unless intentionally public | npm run store:check; npm run compliance:check |
| product-legal | Legal operator and final privacy wording | Final provider and SDK list | TODO_FINAL_PROVIDER_LIST | AI model, video provider, hosting, storage, logging, crash reporting, analytics, payment, push, support, and domestic SDK decisions. | 可提供当前资料项；不要提交：Provider API keys；Contract documents | npm run store:check; npm run compliance:check |
| product-legal | Legal operator and final privacy wording | Retention and deletion policy | TODO_RETENTION_POLICY | Retention periods for accounts, uploads, generated outputs, task logs, operational logs, exports, and deletion requests. | 可提供公开业务信息；确认后再写入仓库。 | npm run compliance:check; npm run store:check |
| engineering | Production runtime, storage, and worker settings | Persistent run storage | TODO_PRODUCTION_RUN_STORAGE | Mounted volume path or object-storage adapter that survives restart. | 可提供当前资料项；不要提交：Cloud storage secret key | npm run cloud:check:strict; restart persistence smoke |
| engineering | Production runtime, storage, and worker settings | libTV worker endpoint and runtime | TODO_LIBTV_WORKER | Private worker URL plus cloud-safe register script and database path. | 可提供当前资料项；不要提交：Worker service token；Private network credentials | npm run cloud:check:strict; real video task smoke |
| engineering | Native builds, signing, and store screenshots | Android SDK and JDK 17+ | TODO_ANDROID_TOOLCHAIN | ANDROID_HOME or ANDROID_SDK_ROOT plus JDK 17 or newer. | 可提供当前资料项；不要提交：Android signing key；Keystore password | npm run capacitor:check; Android Studio Gradle build |
| engineering | Native builds, signing, and store screenshots | macOS, Xcode, and Apple signing | TODO_IOS_TOOLCHAIN | macOS/Xcode environment with Apple Developer team and signing configured. | 可提供当前资料项；不要提交：Apple account password；Signing certificate private key | npm run capacitor:check on macOS; Xcode archive/signing validation |
| engineering | Native builds, signing, and store screenshots | Android upload signing key | TODO_ANDROID_UPLOAD_KEYSTORE_SECRET_REF | Password-manager or CI secret reference for the Android upload keystore and signing passwords; do not store the real keystore in the repository. | 只提供密码管理器条目或托管平台 Secret 名称，不提供真实密钥/密码。 | npm run native:release-plan; Android Gradle bundleRelease on secure build machine |
| engineering | Native builds, signing, and store screenshots | Google Play App Signing status | TODO_GOOGLE_PLAY_APP_SIGNING_STATUS | Play Console app signing enrollment and upload-key status. | 可提供当前资料项；不要提交：Play Console password；Signing certificate private material | npm run native:release-plan; Play Console release upload validation |
| engineering | Native builds, signing, and store screenshots | Apple Developer signing and App Store record | TODO_APPLE_SIGNING_TEAM_PROFILE | Apple Developer Team, distribution certificate reference, App Store provisioning profile, and App Store Connect app record. | 可提供当前资料项；不要提交：Apple account password；p12 certificate；Signing certificate private key；Provisioning profile file | npm run native:release-plan; Xcode archive/signing validation; App Store Connect build processing |
| engineering | Native builds, signing, and store screenshots | Native App Store and Google Play screenshots | TODO_NATIVE_STORE_SCREENSHOTS | Final native screenshots by required device family, using review-safe data and final legal copy. | 可提供当前资料项；不要提交：Private customer assets；Secrets；Local filesystem paths in screenshots | npm run screenshots:check; npm run mobile:qa |
| business-legal | China distribution and filing | ICP filing number | TODO_ICP_FILING_NUMBER | Valid ICP filing number for www.zkraiflow.top. | 可提供公开业务信息；确认后再写入仓库。 | npm run store:check |
| business-legal | China distribution and filing | APP filing number | TODO_APP_FILING_NUMBER | Valid APP filing number for mobile app distribution in China. | 可提供公开业务信息；确认后再写入仓库。 | npm run store:check |
| business-legal | China distribution and filing | Filing number display location | TODO_DISPLAY_APP_FILING_NUMBER_IN_APP | Public page or Settings location where filing information is visible. | 可提供公开业务信息；确认后再写入仓库。 | npm run store:check; npm run mobile:check |

## business-ops

### Store contact and user support

负责人：`business-ops`  
当前状态：`waiting-for-owner-input`  
上线影响：Apple, Google, domestic Android stores, users, and reviewers need a monitored support channel before submission.

| 级别 | 资料项 | 状态 | 目标格式 | 填写区 | 写入位置 | 验收方式 | 安全边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 必填 | Support email | 待提供 | Monitored email address, for example support@example.com. | 线下填写；敏感项只填引用名 | store/submission-readiness.json#/app/contactEmail; public/support.html; store/review-notes-template.json review contact fields | npm run store:check; npm run public:check | 可提供当前资料项；不要提交：Mail admin password；Mailbox recovery code |
| 必填 | Support phone or business contact number | 待提供 | Reachable support or business phone number in international format when possible. | 线下填写；敏感项只填引用名 | store/submission-readiness.json#/app/contactPhone; public/support.html; store/review-notes-template.json review contact fields | npm run store:check; npm run public:check | 可提供当前资料项；不要提交：Personal private phone if it should not appear in store records |
| 可选 | Support response commitment | 可选 | Plain wording such as: We respond within 2 business days. | 线下填写；敏感项只填引用名 | public/support.html; store/review-notes-template.json | npm run compliance:check | 可提供公开业务信息；确认后再写入仓库。 |

## product-ops

### Reviewer account and seeded demo data

负责人：`product-ops`  
当前状态：`pending-real-credentials`  
上线影响：Store reviewers cannot validate restricted creation, assets, settings, data rights, and dry-run task flows without a stable review account.

| 级别 | 资料项 | 状态 | 目标格式 | 填写区 | 写入位置 | 验收方式 | 安全边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 必填 | Review environment URL | 已有初值，待验收 | Public HTTPS app origin. | 线下填写；敏感项只填引用名 | release password manager; store/review-notes-template.json | npm run public:check | 可提供公开业务信息；确认后再写入仓库。 |
| 必填 | Reviewer username | 待提供 | Dedicated account, not a personal admin account. | 线下填写；敏感项只填引用名 | release password manager; App Store Connect review notes; Google Play app access instructions | REVIEW_BASE_URL=https://www.zkraiflow.top REVIEW_USERNAME=<account> REVIEW_PASSWORD=<secret> npm run review:seed; SMOKE_BASE_URL=https://www.zkraiflow.top SMOKE_USERNAME=<account> SMOKE_PASSWORD=<secret> npm run cloud:smoke | 可提供当前资料项；不要提交：Real password；MFA recovery code |
| 必填 | Reviewer password secret reference | 待提供 | Password-manager item or hosting secret name, never the real password. | 线下填写；敏感项只填引用名 | release password manager; private submission checklist | npm run review:seed; npm run cloud:smoke | 只提供密码管理器条目或托管平台 Secret 名称，不提供真实密钥/密码。 |
| 必填 | Seeded review data evidence | 已有初值，待验收 | Successful run log or release checklist note showing demo product, asset, and dry-run batch are present. | 线下填写；敏感项只填引用名 | release checklist outside repository or non-secret evidence note | npm run review:seed; npm run cloud:smoke | 可提供当前资料项；不要提交：Private customer product images |

## product-legal

### Legal operator and final privacy wording

负责人：`product-legal`  
当前状态：`drafting`  
上线影响：Privacy pages, store privacy labels, account deletion wording, and China filings must match the real operator and production data flow.

| 级别 | 资料项 | 状态 | 目标格式 | 填写区 | 写入位置 | 验收方式 | 安全边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 必填 | Operator legal entity | 待提供 | Registered company or individual operator name used for store/deployment records. | 线下填写；敏感项只填引用名 | store/submission-readiness.json#/china/operatorName; public/legal/privacy.html; public/legal/terms.html; public/support.html | npm run store:check; npm run compliance:check | 可提供当前资料项；不要提交：Identity document image；Business license scan unless intentionally public |
| 必填 | Final provider and SDK list | 待提供 | AI model, video provider, hosting, storage, logging, crash reporting, analytics, payment, push, support, and domestic SDK decisions. | 线下填写；敏感项只填引用名 | store/privacy-data-safety-draft.json; store/privacy-form-fill-checklist.md; public/legal/privacy.html | npm run store:check; npm run compliance:check | 可提供当前资料项；不要提交：Provider API keys；Contract documents |
| 必填 | Retention and deletion policy | 待提供 | Retention periods for accounts, uploads, generated outputs, task logs, operational logs, exports, and deletion requests. | 线下填写；敏感项只填引用名 | public/legal/privacy.html; store/privacy-data-safety-draft.json; deploy/production-release-runbook.md | npm run compliance:check; npm run store:check | 可提供公开业务信息；确认后再写入仓库。 |

## engineering

### Production runtime, storage, and worker settings

负责人：`engineering`  
当前状态：`pending-runtime-verification`  
上线影响：Public login, task creation, uploads, data rights, and real video generation are not production-safe until runtime variables, persistent storage, and worker paths are verified.

| 级别 | 资料项 | 状态 | 目标格式 | 填写区 | 写入位置 | 验收方式 | 安全边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 必填 | PUBLIC_APP_ORIGIN | 已有初值，待验收 | https://www.zkraiflow.top | 线下填写；敏感项只填引用名 | hosting environment; deploy/production.env.example | npm run public:check; npm run cloud:check:strict | 可提供公开业务信息；确认后再写入仓库。 |
| 必填 | CORS_ALLOWED_ORIGINS | 已有初值，待验收 | Exact allowlist, no wildcard for authenticated APIs. | 线下填写；敏感项只填引用名 | hosting environment; deploy/production.env.example | npm run cloud:check:strict; npm run cloud:smoke | 可提供公开业务信息；确认后再写入仓库。 |
| 必填 | Persistent run storage | 待提供 | Mounted volume path or object-storage adapter that survives restart. | 线下填写；敏感项只填引用名 | hosting environment RUN_STORAGE_DIR; deploy/production-release-runbook.md | npm run cloud:check:strict; restart persistence smoke | 可提供当前资料项；不要提交：Cloud storage secret key |
| 必填 | libTV worker endpoint and runtime | 待提供 | Private worker URL plus cloud-safe register script and database path. | 线下填写；敏感项只填引用名 | hosting environment LIBTV_BRIDGE_URL; hosting environment LIBTV_REGISTER_SCRIPT; hosting environment LIBTV_DB_PATH | npm run cloud:check:strict; real video task smoke | 可提供当前资料项；不要提交：Worker service token；Private network credentials |

### Native builds, signing, and store screenshots

负责人：`engineering`  
当前状态：`waiting-for-toolchain`  
上线影响：App Store and Google Play packages need signed native builds, real-device QA, and final native screenshots.

| 级别 | 资料项 | 状态 | 目标格式 | 填写区 | 写入位置 | 验收方式 | 安全边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 必填 | Android SDK and JDK 17+ | 待提供 | ANDROID_HOME or ANDROID_SDK_ROOT plus JDK 17 or newer. | 线下填写；敏感项只填引用名 | developer machine environment; CI environment if used | npm run capacitor:check; Android Studio Gradle build | 可提供当前资料项；不要提交：Android signing key；Keystore password |
| 必填 | macOS, Xcode, and Apple signing | 待提供 | macOS/Xcode environment with Apple Developer team and signing configured. | 线下填写；敏感项只填引用名 | Xcode project settings; Apple Developer account | npm run capacitor:check on macOS; Xcode archive/signing validation | 可提供当前资料项；不要提交：Apple account password；Signing certificate private key |
| 必填 | Android upload signing key | 待提供 | Password-manager or CI secret reference for the Android upload keystore and signing passwords; do not store the real keystore in the repository. | 线下填写；敏感项只填引用名 | release password manager; CI secret store if release builds are automated; android/release-signing.properties on secure build machine only | npm run native:release-plan; Android Gradle bundleRelease on secure build machine | 只提供密码管理器条目或托管平台 Secret 名称，不提供真实密钥/密码。 |
| 必填 | Google Play App Signing status | 待提供 | Play Console app signing enrollment and upload-key status. | 线下填写；敏感项只填引用名 | Google Play Console; private release checklist | npm run native:release-plan; Play Console release upload validation | 可提供当前资料项；不要提交：Play Console password；Signing certificate private material |
| 必填 | Apple Developer signing and App Store record | 待提供 | Apple Developer Team, distribution certificate reference, App Store provisioning profile, and App Store Connect app record. | 线下填写；敏感项只填引用名 | Apple Developer account; Xcode signing settings; App Store Connect | npm run native:release-plan; Xcode archive/signing validation; App Store Connect build processing | 可提供当前资料项；不要提交：Apple account password；p12 certificate；Signing certificate private key；Provisioning profile file |
| 必填 | Native App Store and Google Play screenshots | 待提供 | Final native screenshots by required device family, using review-safe data and final legal copy. | 线下填写；敏感项只填引用名 | store/screenshots/; App Store Connect; Google Play Console | npm run screenshots:check; npm run mobile:qa | 可提供当前资料项；不要提交：Private customer assets；Secrets；Local filesystem paths in screenshots |

## business-legal

### China distribution and filing

负责人：`business-legal`  
当前状态：`domain-provided-filing-pending`  
上线影响：Domestic Android stores and China public distribution need legal operator, ICP filing, APP filing, and display location.

| 级别 | 资料项 | 状态 | 目标格式 | 填写区 | 写入位置 | 验收方式 | 安全边界 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 必填 | ICP filing number | 待提供 | Valid ICP filing number for www.zkraiflow.top. | 线下填写；敏感项只填引用名 | store/submission-readiness.json#/china/icpFilingNumber; public/support.html or public legal page display location | npm run store:check | 可提供公开业务信息；确认后再写入仓库。 |
| 必填 | APP filing number | 待提供 | Valid APP filing number for mobile app distribution in China. | 线下填写；敏感项只填引用名 | store/submission-readiness.json#/china/appFilingNumber; public/support.html or in-app settings display location | npm run store:check | 可提供公开业务信息；确认后再写入仓库。 |
| 必填 | Filing number display location | 待提供 | Public page or Settings location where filing information is visible. | 线下填写；敏感项只填引用名 | store/submission-readiness.json#/china/filingDisplayLocation; public/support.html; src/features/settings/SettingsPage.jsx if shown in-app | npm run store:check; npm run mobile:check | 可提供公开业务信息；确认后再写入仓库。 |


## 收齐后的验收顺序

```bash
npm run owner:form
npm run owner:inputs
npm run public:check
npm run store:check
npm run cloud:check:strict
npm run review:seed
npm run cloud:smoke
npm run release:check
```

## 不要写入仓库

- 真实审核账号密码
- API Key、访问 Token、Cookie
- Android keystore、签名证书、证书私钥和密码
- Apple 账号密码、证书私钥、MFA 恢复码
- 私有客户素材、身份证、营业执照原件或非公开合同
