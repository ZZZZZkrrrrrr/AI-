# Owner 最短填写清单

生成日期：2026-06-10  
公网域名：`https://www.zkraiflow.top`  
用途：把上线阻断中必须由你、运营、法务、账号持有人或工程负责人确认的资料压缩成一张最短答复表。

## 直接回复模板

把下面内容补齐后发回即可。真实密码、API Key、签名证书和私有证件不要写在这里。

```text
1. Support email: TODO_contactEmail
2. Support phone or business contact number: TODO_contactPhone
3. Reviewer username: TODO_reviewUsername
4. Reviewer password secret reference: SECRET_REF_reviewPasswordSecretRef
5. Operator legal entity: TODO_operatorLegalName
6. Final provider and SDK list: TODO_finalProviderList
7. Retention and deletion policy: TODO_retentionPolicy
8. Persistent run storage: TODO_persistentStorage
9. libTV worker endpoint and runtime: TODO_libtvWorker
10. Android SDK and JDK 17+: TODO_androidToolchain
11. macOS, Xcode, and Apple signing: TODO_iosToolchain
12. Android upload signing key: TODO_androidSigning
13. Google Play App Signing status: TODO_googlePlayAppSigning
14. Apple Developer signing and App Store record: TODO_iosSigning
15. Native App Store and Google Play screenshots: TODO_nativeStoreScreenshots
16. ICP filing number: TODO_icpFilingNumber
17. APP filing number: TODO_appFilingNumber
18. Filing number display location: TODO_filingDisplayLocation
```

## 必填问题

缺少必填项：18

| 序号 | 填写方式 | 负责人 | 资料项 | 目标格式 | 你该怎么填 | 当前值 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 可直接填写 | business-ops | Support email | Monitored email address, for example support@example.com. | 填真实公开资料 | TODO_CONTACT_EMAIL | npm run store:check; npm run public:check |
| 2 | 可直接填写 | business-ops | Support phone or business contact number | Reachable support or business phone number in international format when possible. | 填真实公开资料 | TODO_CONTACT_PHONE | npm run store:check; npm run public:check |
| 3 | 可直接填写 | product-ops | Reviewer username | Dedicated account, not a personal admin account. | 填真实公开资料 | TODO_REVIEW_USERNAME | REVIEW_BASE_URL=https://www.zkraiflow.top REVIEW_USERNAME=<account> REVIEW_PASSWORD=<secret> npm run review:seed; SMOKE_BASE_URL=https://www.zkraiflow.top SMOKE_USERNAME=<account> SMOKE_PASSWORD=<secret> npm run cloud:smoke |
| 4 | 只给引用 | product-ops | Reviewer password secret reference | Password-manager item or hosting secret name, never the real password. | 填密码管理器条目名或托管平台 Secret 名称 | TODO_PASSWORD_MANAGER_REFERENCE | npm run review:seed; npm run cloud:smoke |
| 5 | 可直接填写 | product-legal | Operator legal entity | Registered company or individual operator name used for store/deployment records. | 填真实公开资料 | TODO_OPERATOR_LEGAL_ENTITY | npm run store:check; npm run compliance:check |
| 6 | 可直接填写 | product-legal | Final provider and SDK list | AI model, video provider, hosting, storage, logging, crash reporting, analytics, payment, push, support, and domestic SDK decisions. | 填真实公开资料 | TODO_FINAL_PROVIDER_LIST | npm run store:check; npm run compliance:check |
| 7 | 可直接填写 | product-legal | Retention and deletion policy | Retention periods for accounts, uploads, generated outputs, task logs, operational logs, exports, and deletion requests. | 填真实公开资料 | TODO_RETENTION_POLICY | npm run compliance:check; npm run store:check |
| 8 | 工程确认 | engineering | Persistent run storage | Mounted volume path or object-storage adapter that survives restart. | 填负责环境/路径/完成状态 | TODO_PRODUCTION_RUN_STORAGE | npm run cloud:check:strict; restart persistence smoke |
| 9 | 工程确认 | engineering | libTV worker endpoint and runtime | Private worker URL plus cloud-safe register script and database path. | 填负责环境/路径/完成状态 | TODO_LIBTV_WORKER | npm run cloud:check:strict; real video task smoke |
| 10 | 工程确认 | engineering | Android SDK and JDK 17+ | ANDROID_HOME or ANDROID_SDK_ROOT plus JDK 17 or newer. | 填负责环境/路径/完成状态 | TODO_ANDROID_TOOLCHAIN | npm run capacitor:check; Android Studio Gradle build |
| 11 | 工程确认 | engineering | macOS, Xcode, and Apple signing | macOS/Xcode environment with Apple Developer team and signing configured. | 填负责环境/路径/完成状态 | TODO_IOS_TOOLCHAIN | npm run capacitor:check on macOS; Xcode archive/signing validation |
| 12 | 工程确认 | engineering | Android upload signing key | Password-manager or CI secret reference for the Android upload keystore and signing passwords; do not store the real keystore in the repository. | 填负责环境/路径/完成状态 | TODO_ANDROID_UPLOAD_KEYSTORE_SECRET_REF | npm run native:release-plan; Android Gradle bundleRelease on secure build machine |
| 13 | 工程确认 | engineering | Google Play App Signing status | Play Console app signing enrollment and upload-key status. | 填负责环境/路径/完成状态 | TODO_GOOGLE_PLAY_APP_SIGNING_STATUS | npm run native:release-plan; Play Console release upload validation |
| 14 | 工程确认 | engineering | Apple Developer signing and App Store record | Apple Developer Team, distribution certificate reference, App Store provisioning profile, and App Store Connect app record. | 填负责环境/路径/完成状态 | TODO_APPLE_SIGNING_TEAM_PROFILE | npm run native:release-plan; Xcode archive/signing validation; App Store Connect build processing |
| 15 | 工程确认 | engineering | Native App Store and Google Play screenshots | Final native screenshots by required device family, using review-safe data and final legal copy. | 填负责环境/路径/完成状态 | TODO_NATIVE_STORE_SCREENSHOTS | npm run screenshots:check; npm run mobile:qa |
| 16 | 可直接填写 | business-legal | ICP filing number | Valid ICP filing number for www.zkraiflow.top. | 填真实公开资料 | TODO_ICP_FILING_NUMBER | npm run store:check |
| 17 | 可直接填写 | business-legal | APP filing number | Valid APP filing number for mobile app distribution in China. | 填真实公开资料 | TODO_APP_FILING_NUMBER | npm run store:check |
| 18 | 可直接填写 | business-legal | Filing number display location | Public page or Settings location where filing information is visible. | 填真实公开资料 | TODO_DISPLAY_APP_FILING_NUMBER_IN_APP | npm run store:check; npm run mobile:check |

## 先填哪几项

| 优先级 | 资料 | 原因 |
| --- | --- | --- |
| P0 | 客服邮箱、客服电话、运营主体 | 会同时影响公网支持页、隐私政策、商店资料和审核说明。 |
| P0 | 审核账号用户名、审核密码引用 | 没有审核账号就无法做真实生产 smoke 和商店审核。 |
| P0 | 生产持久化存储、libTV worker | 没有这两项，外部用户的素材/任务记录和真实视频生成不可稳定上线。 |
| P1 | 服务商清单、数据保留与删除周期 | 会影响隐私政策、AI 说明、Apple 隐私标签和 Google Data safety。 |
| P1 | Android/iOS 工具链、原生截图 | 会影响 App Store、Google Play 和国内安卓商店提交。 |
| P1 | ICP/APP 备案号和展示位置 | 会影响中国大陆公开分发。 |

## 安全边界

- 可以公开写入仓库：客服邮箱、客服电话、运营主体、备案号、备案展示位置、公开服务商名称。
- 只写引用名：审核账号密码、API Key、对象存储密钥、worker token、Android keystore、Apple 证书私钥。
- 不写入仓库：真实密码、MFA 恢复码、身份证/营业执照原件、客户私有素材、未公开合同。
