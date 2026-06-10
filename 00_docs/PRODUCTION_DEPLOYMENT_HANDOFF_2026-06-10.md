# Production Deployment Handoff

Generated: 2026-06-10

Project: `D:\Organized\Projects\codex_project\workflow\01_apps\ai_prompt_video_studio`

Public origin: `https://www.zkraiflow.top`

Use this file as the hosting-platform handoff. Do not paste real API keys, passwords, signing keys, cookies, or private certificates into this repository.

## 1. Environment Values To Copy

These values come from `deploy/production.env.example`. Copy them into the production hosting platform, then replace the placeholders in the platform secret manager.

| Variable | Production value | Status |
| --- | --- | --- |
| NODE_ENV | production | template-ready |
| PORT | 3001 | template-ready |
| PUBLIC_APP_ORIGIN | https://www.zkraiflow.top | template-ready |
| CORS_ALLOWED_ORIGINS | https://www.zkraiflow.top,capacitor://localhost,https://localhost | template-ready |
| CORS_ALLOW_CREDENTIALS | true | template-ready |
| CORS_ALLOW_LOCALHOST | false | template-ready |
| CONSOLE_AUTH_REQUIRED | true | template-ready |
| CONSOLE_AUTH_USER | admin@example.com | replace before deploy |
| CONSOLE_AUTH_ALLOW_REGISTRATION | false | template-ready |
| CONSOLE_AUTH_SESSION_HOURS | 24 | template-ready |
| CONSOLE_AUTH_COOKIE_SECURE | true | template-ready |
| CONSOLE_AUTH_COOKIE_SAMESITE | Lax | template-ready |
| QIANWEN_MODEL | qwen3.6-plus | template-ready |
| QIANWEN_BASE_URL | https://dashscope.aliyuncs.com/compatible-mode/v1 | template-ready |
| QIANWEN_VL_MODEL | qwen3-vl-flash | template-ready |
| SEEDANCE_API_URL | https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks | template-ready |
| SEEDANCE_MODEL | doubao-seedance-2-0-fast-260128 | template-ready |
| DOUBAO_SEED_PRO_API_URL | https://ark.cn-beijing.volces.com/api/v3/chat/completions | template-ready |
| DOUBAO_SEED_PRO_MODEL | doubao-seed-2-0-pro-260215 | template-ready |
| SEEDREAM_API_URL | https://ark.cn-beijing.volces.com/api/v3/images/generations | template-ready |
| SEEDREAM_MODEL | doubao-seedream-4-5-251128 | template-ready |
| BATCH_MAX_WORKERS | 3 | template-ready |
| MODEL_REQUEST_TIMEOUT_MS | 360000 | template-ready |
| RUN_STORAGE_DIR | /var/lib/ai-video-studio/runs | template-ready |
| PYTHON_EXE | python3 | template-ready |
| FFMPEG_EXE | ffmpeg | template-ready |
| LIBTV_BRIDGE_URL | https://libtv-worker.internal.example.com | replace before deploy |
| LIBTV_REGISTER_SCRIPT | /app/services/libtv_runner/register_task_input.py | template-ready |
| LIBTV_DB_PATH | /data/ai_product.sqlite | template-ready |
| LIBTV_DEFAULT_DRY_RUN | false | template-ready |
| LIBTV_AUTO_COMPLIANCE | true | template-ready |
| LIBTV_SEARCH_ENABLED | true | template-ready |
| SMOKE_BASE_URL | https://www.zkraiflow.top | template-ready |
| SMOKE_EXPECT_AUTH_REQUIRED | true | template-ready |
| SMOKE_TIMEOUT_MS | 15000 | template-ready |

## 2. Secret Values To Create

Store these as hosting secrets or password-manager items. Keep real values outside git.

| Secret | Where to set it | Status |
| --- | --- | --- |
| CONSOLE_AUTH_PASSWORD | set in secret manager | replace before deploy |
| CONSOLE_AUTH_PASSWORD_SHA256 | set in secret manager | replace before deploy |
| QIANWEN_API_KEY | set in secret manager | replace before deploy |
| QIANWEN_VL_API_KEY | set in secret manager | replace before deploy |
| ARK_API_KEY | set in secret manager | replace before deploy |
| LIBTV_WORKER_TOKEN | set in secret manager | replace before deploy |
| SMOKE_USERNAME | set in secret manager | replace before deploy |
| SMOKE_PASSWORD | set in secret manager | replace before deploy |

## 3. Owner Inputs Still Needed

| Owner | Input | Current value | Write to | Verification |
| --- | --- | --- | --- | --- |
| business-ops | Support email | TODO_CONTACT_EMAIL | store/submission-readiness.json#/app/contactEmail; public/support.html; store/review-notes-template.json review contact fields | npm run store:check; npm run public:check |
| business-ops | Support phone or business contact number | TODO_CONTACT_PHONE | store/submission-readiness.json#/app/contactPhone; public/support.html; store/review-notes-template.json review contact fields | npm run store:check; npm run public:check |
| product-ops | Reviewer username | TODO_REVIEW_USERNAME | release password manager; App Store Connect review notes; Google Play app access instructions | REVIEW_BASE_URL=https://www.zkraiflow.top REVIEW_USERNAME=<account> REVIEW_PASSWORD=<secret> npm run review:seed; SMOKE_BASE_URL=https://www.zkraiflow.top SMOKE_USERNAME=<account> SMOKE_PASSWORD=<secret> npm run cloud:smoke |
| product-ops | Reviewer password secret reference | TODO_PASSWORD_MANAGER_REFERENCE | release password manager; private submission checklist | npm run review:seed; npm run cloud:smoke |
| product-legal | Operator legal entity | TODO_OPERATOR_LEGAL_ENTITY | store/submission-readiness.json#/china/operatorName; public/legal/privacy.html; public/legal/terms.html; public/support.html | npm run store:check; npm run compliance:check |
| product-legal | Final provider and SDK list | TODO_FINAL_PROVIDER_LIST | store/privacy-data-safety-draft.json; store/privacy-form-fill-checklist.md; public/legal/privacy.html | npm run store:check; npm run compliance:check |
| product-legal | Retention and deletion policy | TODO_RETENTION_POLICY | public/legal/privacy.html; store/privacy-data-safety-draft.json; deploy/production-release-runbook.md | npm run compliance:check; npm run store:check |
| engineering | Persistent run storage | TODO_PRODUCTION_RUN_STORAGE | hosting environment RUN_STORAGE_DIR; deploy/production-release-runbook.md | npm run cloud:check:strict; restart persistence smoke |
| engineering | libTV worker endpoint and runtime | TODO_LIBTV_WORKER | hosting environment LIBTV_BRIDGE_URL; hosting environment LIBTV_REGISTER_SCRIPT; hosting environment LIBTV_DB_PATH | npm run cloud:check:strict; real video task smoke |
| engineering | Android SDK and JDK 17+ | TODO_ANDROID_TOOLCHAIN | developer machine environment; CI environment if used | npm run capacitor:check; Android Studio Gradle build |
| engineering | macOS, Xcode, and Apple signing | TODO_IOS_TOOLCHAIN | Xcode project settings; Apple Developer account | npm run capacitor:check on macOS; Xcode archive/signing validation |
| engineering | Android upload signing key | TODO_ANDROID_UPLOAD_KEYSTORE_SECRET_REF | release password manager; CI secret store if release builds are automated; android/release-signing.properties on secure build machine only | npm run native:release-plan; Android Gradle bundleRelease on secure build machine |
| engineering | Google Play App Signing status | TODO_GOOGLE_PLAY_APP_SIGNING_STATUS | Google Play Console; private release checklist | npm run native:release-plan; Play Console release upload validation |
| engineering | Apple Developer signing and App Store record | TODO_APPLE_SIGNING_TEAM_PROFILE | Apple Developer account; Xcode signing settings; App Store Connect | npm run native:release-plan; Xcode archive/signing validation; App Store Connect build processing |
| engineering | Native App Store and Google Play screenshots | TODO_NATIVE_STORE_SCREENSHOTS | store/screenshots/; App Store Connect; Google Play Console | npm run screenshots:check; npm run mobile:qa |
| business-legal | ICP filing number | TODO_ICP_FILING_NUMBER | store/submission-readiness.json#/china/icpFilingNumber; public/support.html or public legal page display location | npm run store:check |
| business-legal | APP filing number | TODO_APP_FILING_NUMBER | store/submission-readiness.json#/china/appFilingNumber; public/support.html or in-app settings display location | npm run store:check |
| business-legal | Filing number display location | TODO_DISPLAY_APP_FILING_NUMBER_IN_APP | store/submission-readiness.json#/china/filingDisplayLocation; public/support.html; src/features/settings/SettingsPage.jsx if shown in-app | npm run store:check; npm run mobile:check |

## 4. Production Blockers

These are not code blockers; they require real hosting, storage, worker, reviewer, or business inputs before public launch.

| Blocker | Owner | Status | Next action | Verification |
| --- | --- | --- | --- | --- |
| public-domain-and-https | business-ops | public-pages-smoke-passed-pending-auth-cors | Set PUBLIC_APP_ORIGIN=https://www.zkraiflow.top in the production runtime.; Set CORS_ALLOWED_ORIGINS=https://www.zkraiflow.top,capacitor://localhost,https://localhost. | npm run production:auth-plan; npm run production:smoke-template; npm run cloud:smoke; npm run store:check; npm run product:report |
| cloud-cors-cookie-origin | engineering | production-profile-ready-pending-hosting-verification | Set NODE_ENV=production.; Set CONSOLE_AUTH_COOKIE_SECURE=true. | npm run production:auth-plan; npm run production:profile; npm run cloud:check:strict; npm run cloud:smoke |
| production-observability-rollback | platform | handoff-ready-pending-hosting-observability-evidence | Confirm hosting health check path and alert target.; Run authenticated npm run cloud:smoke against https://www.zkraiflow.top with a review-safe account. | npm run production:ops-plan; npm run production:auth-plan; npm run public:check; npm run cloud:smoke; npm run product:report |
| persistent-storage | platform | production-path-template-ready-waiting-volume | Choose mounted volume or object storage adapter.; Set RUN_STORAGE_DIR. | npm run storage:restart-template; npm run production:profile; npm run cloud:check:strict; npm run cloud:smoke; npm run review:seed |
| libtv-worker-migration | engineering | worker-contract-ready-waiting-target | Choose worker topology: private worker service, co-located process, or queue worker.; Create LIBTV_WORKER_TOKEN in the hosting secret manager. | npm run production:profile; npm run cloud:worker-contract; npm run cloud:worker-plan; npm run cloud:worker-smoke-template; npm run cloud:check:strict; npm run cloud:smoke |
| mobile-device-qa-completion | product-design | manual-qa-pending | Run npm run mobile:qa and keep the plan current.; Run npm run mobile:qa:evidence before inviting testers and use store/mobile-device-qa-evidence-template.json for result capture. | npm run mobile:qa; npm run mobile:qa:evidence; npm run pwa:device-template; npm run release:check; Android Studio Gradle build; Xcode archive/signing validation |

## 5. Cloud Workstreams

| Order | Workstream | Status | Production values | Next actions |
| --- | --- | --- | --- | --- |
| 1 | Public origin and authenticated CORS | production-profile-ready | PUBLIC_APP_ORIGIN=https://www.zkraiflow.top; CORS_ALLOWED_ORIGINS=https://www.zkraiflow.top,capacitor://localhost,https://localhost; CORS_ALLOW_CREDENTIALS=true; CORS_ALLOW_LOCALHOST=false | Confirm the hosting platform uses https://www.zkraiflow.top as the production origin; Configure environment variables in hosting platform |
| 2 | Production authentication cookie hardening | production-profile-ready | NODE_ENV=production; CONSOLE_AUTH_COOKIE_SECURE=true; CONSOLE_AUTH_COOKIE_SAMESITE=Lax for same-origin; CONSOLE_AUTH_COOKIE_SAMESITE=None for cross-origin App/API | Choose SameSite policy after deployment topology is final; Set cookie variables in production environment |
| 3 | Persistent run and asset storage | production-path-template-ready-waiting-volume | RUN_STORAGE_DIR=/var/lib/ai-video-studio/runs | Pick mounted volume or object storage adapter; Set RUN_STORAGE_DIR |
| 4 | libTV worker service migration | worker-contract-ready-waiting-target | LIBTV_BRIDGE_URL=https://libtv-worker.internal.example.com; LIBTV_WORKER_TOKEN=<hosting-secret>; LIBTV_REGISTER_SCRIPT=/app/services/libtv_runner/register_task_input.py; LIBTV_DB_PATH=/data/ai_product.sqlite | Decide worker topology; Create LIBTV_WORKER_TOKEN in the hosting secret manager |
| 5 | Production execution switches and limits | release-guard-ready | LIBTV_DEFAULT_DRY_RUN=false only after worker validation; BATCH_MAX_WORKERS=3; MODEL_REQUEST_TIMEOUT_MS=360000 | Keep dry-run true until domain, storage, and worker are ready; Set production worker limit |
| 6 | Provider secrets and secret hygiene | template-ready | QIANWEN_API_KEY=<hosting-secret>; QIANWEN_VL_API_KEY=<hosting-secret>; ARK_API_KEY=<hosting-secret>; CONSOLE_AUTH_PASSWORD_SHA256=<hosting-secret> | Store keys in deployment secret manager; Use password hash rather than plaintext where possible |
| 7 | Observability, health checks, and rollback | smoke-template-ready | GET /api/healthz is load balancer health check; SMOKE_BASE_URL=https://www.zkraiflow.top; SMOKE_USERNAME=<review-safe-admin-or-demo-account>; SMOKE_PASSWORD=<hosting-secret>; PRODUCTION_AUTH_CORS_HANDOFF=deploy/production-auth-cors-handoff.json; PRODUCTION_OBSERVABILITY_ROLLBACK_PLAN=deploy/production-observability-rollback-plan.json; Release artifact is built from npm run build; Rollback target keeps previous dist and server environment | Add hosting health check to deployment platform; Run npm run production:ops-plan before public launch |

## 6. Deployment Order

1. Configure hosting environment variables from section 1.
2. Create hosting secrets from section 2.
3. Confirm `https://www.zkraiflow.top/api/healthz` returns ok after deploy.
4. Create the review-safe account and seed demo data with `npm run review:seed`.
5. Run `npm run cloud:smoke` against `https://www.zkraiflow.top`.
6. Run `npm run release:check` before packaging native builds or store submission.
7. Keep `LIBTV_DEFAULT_DRY_RUN=true` in staging until the worker endpoint is proven with a real smoke test.

## 7. Commands

| Command | Purpose |
| --- | --- |
| npm run production:profile | Verify the production env template for www.zkraiflow.top. |
| npm run cloud:check:strict | Audit local environment and cloud readiness warnings. |
| npm run cloud:smoke | Verify deployed health, auth, legal pages, and protected APIs. |
| npm run review:seed | Seed reviewer-safe demo product, account asset, and dry-run batch. |
| npm run release:check | Run the full local release gate. |
