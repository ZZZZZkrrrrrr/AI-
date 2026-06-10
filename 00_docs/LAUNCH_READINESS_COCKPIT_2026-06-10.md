# Workflow App 上线驾驶舱

生成日期：2026-06-10  
项目路径：`D:\Organized\Projects\codex_project\workflow\01_apps\ai_prompt_video_studio`  
公网入口：`https://www.zkraiflow.top`  
当前结论：可以继续内部迭代和小范围试用；暂不建议公开发布或提交应用商店。

## 1. 发布决策

| 场景 | 结论 | 原因 |
| --- | --- | --- |
| 内部继续迭代 / 小范围试用 | 可以继续 | 公网页面、移动端大按钮、PWA、截图计划、Capacitor 工程和发布检查已有基础证据 |
| 公开给外部用户 | 暂不通过 | 还需要生产 Cookie/CORS、审核账号、持久化存储、libTV worker 和 owner 输入 |
| App Store / Google Play 提交 | 暂不通过 | 还需要审核账号、法务终稿、原生截图、Android/iOS 真机验证和商店资料终稿 |
| 国内安卓商店 / 中国公开分发 | 暂不通过 | 还需要运营主体、ICP备案、APP 备案和展示位置 |

## 2. 已有证据

| 领域 | 当前状态 | 验证入口 |
| --- | --- | --- |
| Pilot release readiness | pilot-ready-with-manual-production-gates | pilot:readiness / PILOT_RELEASE_READINESS |
| 公网域名 | https://www.zkraiflow.top | public:check / PUBLIC_DOMAIN_READINESS |
| 移动端新手入口 | internal-ready-with-manual-gates | mobile:check / mobile:qa / screenshots:check |
| PWA 资源 | internal-ready | pwa:check / public:check |
| Capacitor 原生工程 | native-projects-generated | capacitor:sync / capacitor:check |
| Web 首轮截图 | mobile-web-390, mobile-web-430, tablet-web-768 | screenshots:check |
| 运营输入追踪 | collecting-owner-inputs | owner:inputs |

## 3. 当前阻断概览

阻断项数量：12  
严重度分布：launch-blocker: 2, store-blocker: 4, production-blocker: 4, native-store-blocker: 1, domestic-store-blocker: 1

| 阻断项 | 负责人 | 级别 | 状态 | 下一步 |
| --- | --- | --- | --- | --- |
| public-domain-and-https | business-ops | launch-blocker | public-pages-smoke-passed-pending-auth-cors | Set PUBLIC_APP_ORIGIN=https://www.zkraiflow.top in the production runtime. |
| support-contact | business-ops | store-blocker | waiting-for-owner-input | Create or choose a monitored support inbox. |
| legal-finalization | product-legal | store-blocker | drafting | Confirm operator identity and support contacts. |
| review-demo-account | product-ops | store-blocker | pending-real-credentials | Create a dedicated review account in the review environment. |
| cloud-cors-cookie-origin | engineering | production-blocker | production-profile-ready-pending-hosting-verification | Set NODE_ENV=production. |
| production-observability-rollback | platform | production-blocker | handoff-ready-pending-hosting-observability-evidence | Confirm hosting health check path and alert target. |
| persistent-storage | platform | production-blocker | production-path-template-ready-waiting-volume | Choose mounted volume or object storage adapter. |
| libtv-worker-migration | engineering | production-blocker | worker-contract-ready-waiting-target | Choose worker topology: private worker service, co-located process, or queue worker. |
| native-build-toolchains | engineering | native-store-blocker | waiting-for-toolchain | Install Android SDK and set ANDROID_HOME or ANDROID_SDK_ROOT. |
| native-store-screenshots | product-design | store-blocker | blocked-until-native-build | Use current web screenshots as layout baseline. |
| mobile-device-qa-completion | product-design | launch-blocker | manual-qa-pending | Run npm run mobile:qa and keep the plan current. |
| china-filing-and-operator | business-legal | domestic-store-blocker | domain-provided-filing-pending | Confirm operator legal entity. |

## 4. 需要 owner 提供的 P0/P1 输入

缺失必填输入数量：18

| 输入项 | 负责人 | 当前值 | 验证方式 |
| --- | --- | --- | --- |
| Support email | business-ops | TODO_CONTACT_EMAIL | npm run store:check; npm run public:check |
| Support phone or business contact number | business-ops | TODO_CONTACT_PHONE | npm run store:check; npm run public:check |
| Reviewer username | product-ops | TODO_REVIEW_USERNAME | REVIEW_BASE_URL=https://www.zkraiflow.top REVIEW_USERNAME=<account> REVIEW_PASSWORD=<secret> npm run review:seed; SMOKE_BASE_URL=https://www.zkraiflow.top SMOKE_USERNAME=<account> SMOKE_PASSWORD=<secret> npm run cloud:smoke |
| Reviewer password secret reference | product-ops | TODO_PASSWORD_MANAGER_REFERENCE | npm run review:seed; npm run cloud:smoke |
| Operator legal entity | product-legal | TODO_OPERATOR_LEGAL_ENTITY | npm run store:check; npm run compliance:check |
| Final provider and SDK list | product-legal | TODO_FINAL_PROVIDER_LIST | npm run store:check; npm run compliance:check |
| Retention and deletion policy | product-legal | TODO_RETENTION_POLICY | npm run compliance:check; npm run store:check |
| Persistent run storage | engineering | TODO_PRODUCTION_RUN_STORAGE | npm run cloud:check:strict; restart persistence smoke |
| libTV worker endpoint and runtime | engineering | TODO_LIBTV_WORKER | npm run cloud:check:strict; real video task smoke |
| Android SDK and JDK 17+ | engineering | TODO_ANDROID_TOOLCHAIN | npm run capacitor:check; Android Studio Gradle build |
| macOS, Xcode, and Apple signing | engineering | TODO_IOS_TOOLCHAIN | npm run capacitor:check on macOS; Xcode archive/signing validation |
| Android upload signing key | engineering | TODO_ANDROID_UPLOAD_KEYSTORE_SECRET_REF | npm run native:release-plan; Android Gradle bundleRelease on secure build machine |

## 5. 上线工作流建议

1. 先补客服邮箱、客服电话、运营主体、审核账号和密码管理器引用。
2. 在生产环境设置 `PUBLIC_APP_ORIGIN`、`CORS_ALLOWED_ORIGINS`、`CONSOLE_AUTH_COOKIE_SECURE=true`、`RUN_STORAGE_DIR`。
3. 使用审核账号执行 `npm run review:seed` 和 `npm run cloud:smoke`。
4. 安装 Android SDK/JDK 17+，并在 macOS/Xcode 完成 iOS 构建签名。
5. 用原生 App 捕获 App Store / Google Play 截图，替换或补齐 web-first-pass 截图。
6. 法务确认隐私政策、用户协议、AI 说明、数据保留周期和服务商清单。
7. 国内分发前补 ICP 备案号、APP 备案号和展示位置。

## 6. 常用命令

| 命令 | 用途 |
| --- | --- |
| npm run legal:finalization-plan | Check legal finalization handoff for privacy pages, store forms, account deletion, AI disclosure, and owner-provided legal inputs |
| npm run production:auth-plan | Check production origin, authenticated CORS, Secure/SameSite cookies, and public smoke handoff |
| npm run production:ops-plan | Check production health surfaces, week-one monitoring, rollback playbooks, log safety, and incident response |
| npm run cloud:worker-plan | Check libTV worker and persistent storage migration plan |
| npm run review:access-plan | Check store review account access handoff |
| npm run store:console-plan | Check App Store Connect, Google Play Console, and domestic Android submission handoff |
| npm run pilot:readiness | Check the controlled mobile web and PWA pilot scope, gates, runbook, and evidence before inviting testers |
| npm run pilot:feedback | Check the mobile pilot feedback form, support feedback API, admin triage queue, and no-secret evidence rules |
| npm run release:evidence | Check that every release blocker has non-secret closure evidence requirements |
| npm run screenshots:native-plan | Check native store screenshot handoff |
| npm run native:release-plan | Check native release signing handoff, Android upload key plan, iOS signing plan, and no-secret rules |
| npm run china:distribution-plan | Check China distribution and filing handoff |
| npm run public:check | 验证公网 URL、隐私/支持/删除账号页面、PWA manifest 和健康检查 |
| npm run owner:brief | 生成 owner 最短填写清单和生产环境变量预置清单 |
| npm run owner:form | 从登记表重新生成可分发的上线资料收集表 |
| npm run owner:inputs | 列出必须由运营/法务/账号持有人提供的真实值 |
| npm run mobile:qa | 验证移动端用户路径、真机/原生 App 待测项和截图证据 |
| npm run cloud:check:strict | 验证生产环境变量、Cookie/CORS、存储和 libTV worker 准备度 |
| npm run store:check | 验证上架资料、隐私表单草案、审核说明和截图计划 |
| npm run release:check | 总门禁：合规、云端、公网、运营输入、截图、移动端、商店、构建和封装 |

## 7. 商店发布计划

| 事项 | 负责人 | 状态 | 判断 |
| --- | --- | --- | --- |
| Public HTTPS web base | business-ops | public-pages-smoke-passed-pending-auth-cors | 需要继续推进 |
| Store contact and support channel | business-ops | waiting-for-owner-input | 需要继续推进 |
| Privacy labels and data safety forms | product-legal | drafting | 需要继续推进 |
| Review demo account and notes | product-ops | pending | 需要继续推进 |
| Store listing copy and preview messaging | product-ops | draft-structured | 可用于当前阶段 |
| App Store / Google Play console submission | product-ops | handoff-ready-waiting-owner-console-finalization | 需要继续推进 |
| Native iOS and Android packaging | engineering | native-projects-generated | 可用于当前阶段 |
| Store-accurate screenshots | product-design | web-first-pass-captured | 可用于当前阶段 |
| China distribution compliance | business-legal | waiting-for-owner-input | 需要继续推进 |

## 8. 云端发布计划

| 事项 | 负责人 | 状态 | 判断 |
| --- | --- | --- | --- |
| Public origin and authenticated CORS | engineering | production-profile-ready | 可用于当前阶段 |
| Production authentication cookie hardening | engineering | production-profile-ready | 可用于当前阶段 |
| Persistent run and asset storage | platform | production-path-template-ready-waiting-volume | 需要继续推进 |
| libTV worker service migration | engineering | worker-contract-ready-waiting-target | 需要继续推进 |
| Production execution switches and limits | product-engineering | release-guard-ready | 可用于当前阶段 |
| Provider secrets and secret hygiene | engineering | template-ready | 可用于当前阶段 |
| Observability, health checks, and rollback | platform | smoke-template-ready | 可用于当前阶段 |

## 9. 不要写入仓库

- 真实审核账号密码
- API Key
- Android keystore 和密码
- Apple 账号密码、证书私钥、MFA 恢复码
- 私有客户素材
- 身份证、营业执照等非公开证件原件

## 10. 证据文件

- `store/operator-inputs-register.json`
- `00_docs/OWNER_QUICK_INPUTS_2026-06-10.md`
- `00_docs/PRODUCTION_ENV_PRESET_CHECKLIST_2026-06-10.md`
- `00_docs/OWNER_INPUT_COLLECTION_FORM_2026-06-10.md`
- `store/release-blockers-register.json`
- `store/release-evidence-register.json`
- `store/pilot-release-readiness.json`
- `00_docs/PILOT_RELEASE_READINESS_2026-06-10.md`
- `00_docs/PILOT_FEEDBACK_LOOP_2026-06-10.md`
- `scripts/check-pilot-feedback-readiness.mjs`
- `00_docs/RELEASE_EVIDENCE_REGISTER_2026-06-10.md`
- `store/submission-readiness.json`
- `store/mobile-device-qa-plan.json`
- `store/screenshot-plan.json`
- `00_docs/OPERATOR_INPUTS_HANDOFF_2026-06-10.md`
- `00_docs/PUBLIC_DOMAIN_READINESS_2026-06-09.md`
- `deploy/libtv-worker-storage-plan.json`
- `00_docs/LIBTV_WORKER_STORAGE_MIGRATION_2026-06-10.md`
- `deploy/production-auth-cors-handoff.json`
- `00_docs/PRODUCTION_AUTH_CORS_HANDOFF_2026-06-10.md`
- `deploy/production-observability-rollback-plan.json`
- `00_docs/PRODUCTION_OBSERVABILITY_ROLLBACK_2026-06-10.md`
- `store/review-access-handoff.json`
- `00_docs/REVIEW_ACCOUNT_ACCESS_RUNBOOK_2026-06-10.md`
- `store/store-console-submission-handoff.json`
- `00_docs/STORE_CONSOLE_SUBMISSION_HANDOFF_2026-06-10.md`
- `store/legal-finalization-handoff.json`
- `00_docs/LEGAL_FINALIZATION_HANDOFF_2026-06-10.md`
- `store/native-store-screenshot-handoff.json`
- `00_docs/NATIVE_STORE_SCREENSHOT_HANDOFF_2026-06-10.md`
- `store/native-release-signing-handoff.json`
- `00_docs/NATIVE_RELEASE_SIGNING_HANDOFF_2026-06-10.md`
- `store/china-distribution-compliance-handoff.json`
- `00_docs/CHINA_DISTRIBUTION_COMPLIANCE_HANDOFF_2026-06-10.md`
- `00_docs/MOBILE_DEVICE_QA_PLAN_2026-06-09.md`
