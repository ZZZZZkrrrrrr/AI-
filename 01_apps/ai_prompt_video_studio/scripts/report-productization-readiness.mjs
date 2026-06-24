import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = findWorkspaceRoot(appRoot);
const passes = [];
const warnings = [];
const blockers = [];

function findWorkspaceRoot(startDir) {
  let current = path.resolve(startDir);
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "00_docs")) && existsSync(path.join(current, "01_apps"))) {
      return current;
    }
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return path.resolve(startDir, "..", "..");
}

function appPath(relativePath) {
  return path.join(appRoot, relativePath);
}

function workspacePath(relativePath) {
  return path.join(workspaceRoot, relativePath);
}

function resolvePath(relativePath) {
  if (relativePath.startsWith("00_docs/") || relativePath === ".gitignore") return workspacePath(relativePath);
  return appPath(relativePath);
}

async function fileExists(relativePath) {
  try {
    const info = await stat(resolvePath(relativePath));
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function readText(relativePath) {
  try {
    return await readFile(resolvePath(relativePath), "utf8");
  } catch {
    return "";
  }
}

async function readJson(relativePath) {
  const text = await readText(relativePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    blockers.push(`${relativePath} is invalid JSON: ${error.message}`);
    return null;
  }
}

function pass(message) {
  passes.push(message);
}

function warn(message) {
  warnings.push(message);
}

function block(message) {
  blockers.push(message);
}

function isPlaceholder(value) {
  const text = String(value || "").trim();
  return !text || /^TODO_/i.test(text) || /^(pending|draft|not-started|planned|waiting-for-owner-input|waiting-for-domain|waiting-for-infrastructure)$/i.test(text);
}

function compactStatus(value) {
  const text = String(value || "").trim();
  return text || "missing";
}

function checkRequiredFiles(files, domainLabel) {
  return Promise.all(files.map(async (file) => {
    if (await fileExists(file)) {
      pass(`${domainLabel}: ${file} exists.`);
      return true;
    }
    block(`${domainLabel}: ${file} is missing.`);
    return false;
  }));
}

function checkPackageScripts(packageJson, scripts, domainLabel) {
  const available = packageJson?.scripts || {};
  for (const script of scripts) {
    if (available[script]) pass(`${domainLabel}: npm script ${script} exists.`);
    else block(`${domainLabel}: npm script ${script} is missing.`);
  }
}

function statusBucket(status) {
  const value = String(status || "").toLowerCase();
  if (["ready", "done", "approved", "ok", "internal-ready", "internal-ready-with-manual-gates", "pilot-ready-with-manual-production-gates", "captured", "captured-first-pass", "draft-structured", "template-ready", "native-projects-generated", "config-ready", "web-first-pass-captured", "production-profile-ready", "release-guard-ready", "smoke-template-ready"].includes(value)) return "usable";
  if (/pending|draft|planned|waiting|not-started|generated|collecting-owner-inputs/.test(value)) return "needs-input";
  return value ? "review" : "missing";
}

function collectPlanStatuses(plan, planLabel) {
  const rows = [];
  for (const item of plan?.milestones || plan?.workstreams || []) {
    const status = compactStatus(item.status);
    const bucket = statusBucket(status);
    rows.push({ id: item.id, title: item.title, status, bucket });
    if (bucket === "usable") pass(`${planLabel}: ${item.id} is ${status}.`);
    else warn(`${planLabel}: ${item.id} is ${status}.`);
  }
  return rows;
}

function checkNoPlaceholderObject(value, label, keys) {
  for (const key of keys) {
    const item = value?.[key];
    if (isPlaceholder(item)) warn(`${label}: ${key} still needs final production value.`);
    else pass(`${label}: ${key} is filled.`);
  }
}

const packageJson = await readJson("package.json");
const submission = await readJson("store/submission-readiness.json");
const launchPlan = await readJson("store/launch-action-plan.json");
const cloudPlan = await readJson("deploy/cloud-deployment-action-plan.json");
const screenshotPlan = await readJson("store/screenshot-plan.json");
const blockerRegister = await readJson("store/release-blockers-register.json");
const mobileQaPlan = await readJson("store/mobile-device-qa-plan.json");
const operatorInputs = await readJson("store/operator-inputs-register.json");
const releaseChannelPlan = await readJson("store/release-channel-plan.json");
const releaseEvidence = await readJson("store/release-evidence-register.json");
const pilotRelease = await readJson("store/pilot-release-readiness.json");

const domains = [
  {
    id: "mobile-beginner-ux",
    label: "Mobile beginner UX",
    status: "internal-ready",
    files: [
      "00_docs/MOBILE_BUTTON_STYLE_ACCEPTANCE_2026-06-09.md",
      "00_docs/MOBILE_BEGINNER_MODE_DESIGN_2026-06-09.md",
      "store/screenshot-plan.json",
      "store/native-store-screenshot-handoff.json",
      "00_docs/NATIVE_STORE_SCREENSHOT_HANDOFF_2026-06-10.md",
      "scripts/check-native-screenshot-handoff.mjs",
      "store/screenshots/mobile-web-390/01-home.png",
      "store/screenshots/mobile-web-390/02-home-notifications.png",
      "store/screenshots/mobile-web-390/03-home-image.png",
      "store/screenshots/mobile-web-390/08-pwa-install-guide.png"
    ],
    scripts: ["mobile:check", "screenshots:check", "screenshots:native-plan"]
  },
  {
    id: "mobile-device-qa",
    label: "Mobile device and user QA",
    status: mobileQaPlan?.status || "missing",
    files: [
      "store/mobile-device-qa-plan.json",
      "store/mobile-device-qa-evidence-template.json",
      "scripts/check-mobile-device-qa-plan.mjs",
      "scripts/check-mobile-qa-evidence-template.mjs",
      "00_docs/MOBILE_DEVICE_QA_EVIDENCE_TEMPLATE_2026-06-10.md",
      "00_docs/MOBILE_DEVICE_QA_PLAN_2026-06-09.md"
    ],
    scripts: ["mobile:qa", "mobile:qa:evidence", "release:check"]
  },
  {
    id: "text-image-canvas",
    label: "Text-image canvas productization",
    status: "internal-ready",
    files: [
      "src/features/textImage/TextImagePage.jsx",
      "scripts/check-text-image-canvas-readiness.mjs",
      "00_docs/TEXT_IMAGE_CANVAS_PRODUCTIZATION_2026-06-11.md",
      "00_docs/BACKEND_CLOUD_READINESS_2026-06-09.md",
      "deploy/cloud-deployment-action-plan.json",
      "deploy/libtv-worker-storage-plan.json",
      "server.js"
    ],
    scripts: ["text-image:check", "cloud:check", "app:health"]
  },
  {
    id: "pwa-and-public-pages",
    label: "PWA and public pages",
    status: "internal-ready",
    files: [
      "public/manifest.webmanifest",
      "public/support.html",
      "public/legal/privacy.html",
      "public/legal/terms.html",
      "public/legal/ai-disclosure.html",
      "public/legal/delete-account.html",
      "store/pwa-production-smoke-plan.json",
      "store/pwa-device-install-evidence-template.json",
      "scripts/check-pwa-production-smoke-plan.mjs",
      "scripts/check-pwa-device-install-evidence-template.mjs",
      "scripts/check-pwa-public-smoke.mjs",
      "store/screenshots/mobile-web-390/08-pwa-install-guide.png",
      "scripts/check-public-domain-readiness.mjs",
      "00_docs/PWA_PRODUCTION_INSTALL_SMOKE_2026-06-10.md",
      "00_docs/PWA_DEVICE_INSTALL_EVIDENCE_TEMPLATE_2026-06-10.md",
      "00_docs/PUBLIC_DOMAIN_READINESS_2026-06-09.md"
    ],
    scripts: ["pwa:check", "pwa:prod-plan", "pwa:device-template", "pwa:public-smoke", "public:check", "compliance:check"]
  },
  {
    id: "release-channel-decision",
    label: "App release channel decision",
    status: releaseChannelPlan ? "internal-ready-with-manual-gates" : "missing",
    files: [
      "store/release-channel-plan.json",
      "scripts/check-release-channel-plan.mjs",
      "00_docs/APP_RELEASE_CHANNEL_DECISION_2026-06-10.md",
      "00_docs/PWA_APP_PACKAGING_ROADMAP_2026-06-09.md",
      "00_docs/CAPACITOR_PACKAGING_READINESS_2026-06-09.md"
    ],
    scripts: ["release:channels", "release:check"]
  },
  {
    id: "pilot-release-readiness",
    label: "Pilot release readiness",
    status: pilotRelease?.status || "missing",
    files: [
      "store/pilot-release-readiness.json",
      "store/pilot-invite-pack.json",
      "00_docs/PILOT_RELEASE_READINESS_2026-06-10.md",
      "00_docs/PILOT_INVITE_PACK_2026-06-10.md",
      "scripts/check-pilot-invite-pack.mjs",
      "scripts/check-pilot-release-readiness.mjs",
      "store/release-channel-plan.json",
      "store/release-blockers-register.json",
      "store/mobile-device-qa-plan.json",
      "store/pwa-production-smoke-plan.json",
      "store/release-evidence-register.json"
    ],
    scripts: ["pilot:invite-pack", "pilot:readiness", "release:check"]
  },
  {
    id: "pilot-feedback-loop",
    label: "Pilot feedback loop",
    status: submission?.pilotFeedback?.status || "missing",
    files: [
      "00_docs/PILOT_FEEDBACK_LOOP_2026-06-10.md",
      "scripts/check-pilot-feedback-readiness.mjs",
      "src/features/settings/SettingsPage.jsx",
      "src/styles.css",
      "server.js",
      "store/pilot-release-readiness.json",
      "store/mobile-device-qa-plan.json",
      "store/release-evidence-register.json"
    ],
    scripts: ["pilot:feedback", "mobile:check", "release:check"]
  },
  {
    id: "native-app-packaging",
    label: "Native app packaging",
    status: submission?.distribution?.capacitorStatus || "missing",
    files: [
      "store/native-release-signing-handoff.json",
      "00_docs/NATIVE_RELEASE_SIGNING_HANDOFF_2026-06-10.md",
      "scripts/check-native-release-signing-plan.mjs",
      "capacitor.config.json",
      "android/app/build.gradle",
      "android/app/src/main/AndroidManifest.xml",
      "android/release-signing.example.properties",
      "android/.gitignore",
      "ios/App/App/Info.plist",
      "ios/App/App.xcodeproj/project.pbxproj",
      ".gitignore",
      "00_docs/CAPACITOR_PACKAGING_READINESS_2026-06-09.md"
    ],
    scripts: ["native:release-plan", "capacitor:sync", "capacitor:check"]
  },
  {
    id: "cloud-backend",
    label: "Cloud backend readiness",
    status: "planned-with-runbook",
    files: [
      "deploy/production.env.example",
      "deploy/production-auth-cors-handoff.json",
      "deploy/production-observability-rollback-plan.json",
      "deploy/cloud-deployment-action-plan.json",
      "deploy/libtv-worker-storage-plan.json",
      "deploy/libtv-worker-api-contract.json",
      "deploy/libtv-worker-smoke-evidence-template.json",
      "deploy/persistent-storage-restart-evidence-template.json",
      "store/authenticated-smoke-evidence-template.json",
      "deploy/production-release-runbook.md",
      "scripts/generate-production-handoff.mjs",
      "scripts/check-persistent-storage-evidence-template.mjs",
      "scripts/check-libtv-worker-contract.mjs",
      "scripts/check-libtv-worker-smoke-evidence-template.mjs",
      "scripts/check-production-auth-cors-plan.mjs",
      "scripts/check-authenticated-smoke-evidence-template.mjs",
      "scripts/check-production-observability-plan.mjs",
      "00_docs/PRODUCTION_AUTH_CORS_HANDOFF_2026-06-10.md",
      "00_docs/AUTHENTICATED_SMOKE_EVIDENCE_TEMPLATE_2026-06-10.md",
      "00_docs/PERSISTENT_STORAGE_RESTART_EVIDENCE_TEMPLATE_2026-06-10.md",
      "00_docs/PRODUCTION_OBSERVABILITY_ROLLBACK_2026-06-10.md",
      "00_docs/PRODUCTION_DEPLOYMENT_HANDOFF_2026-06-10.md",
      "scripts/production-smoke-test.mjs",
      "00_docs/BACKEND_CLOUD_READINESS_2026-06-09.md",
      "00_docs/LIBTV_WORKER_API_CONTRACT_2026-06-10.md",
      "00_docs/LIBTV_WORKER_STORAGE_MIGRATION_2026-06-10.md",
      "00_docs/LIBTV_WORKER_SMOKE_EVIDENCE_TEMPLATE_2026-06-10.md"
    ],
    scripts: ["cloud:check", "cloud:check:strict", "cloud:worker-contract", "cloud:worker-plan", "cloud:worker-smoke-template", "storage:restart-template", "production:auth-plan", "production:ops-plan", "production:profile", "production:smoke-template", "production:handoff", "cloud:smoke"]
  },
  {
    id: "privacy-compliance",
    label: "Privacy, AI disclosure, and data rights",
    status: submission?.privacy?.dataSafetyDraftStatus || "missing",
    files: [
      "store/legal-finalization-handoff.json",
      "00_docs/LEGAL_FINALIZATION_HANDOFF_2026-06-10.md",
      "scripts/check-legal-finalization-plan.mjs",
      "store/privacy-data-safety-draft.json",
      "store/privacy-form-fill-checklist.md",
      "00_docs/COMPLIANCE_RELEASE_CHECKLIST_2026-06-09.md",
      "00_docs/DATA_RIGHTS_ACCOUNT_DELETION_FLOW_2026-06-09.md",
      "00_docs/AI_DISCLOSURE_EVIDENCE_PACK_2026-06-09.md"
    ],
    scripts: ["store:check", "compliance:check", "legal:finalization-plan"]
  },
  {
    id: "store-submission",
    label: "Store submission and review",
    status: submission?.review?.reviewNotesStatus || "missing",
    files: [
      "store/submission-readiness.json",
      "store/store-console-submission-handoff.json",
      "00_docs/STORE_CONSOLE_SUBMISSION_HANDOFF_2026-06-10.md",
      "scripts/check-store-console-submission-plan.mjs",
      "store/store-listing-copy-draft.json",
      "store/review-notes-template.json",
      "store/review-access-handoff.json",
      "store/authenticated-smoke-evidence-template.json",
      "00_docs/REVIEW_ACCOUNT_ACCESS_RUNBOOK_2026-06-10.md",
      "00_docs/AUTHENTICATED_SMOKE_EVIDENCE_TEMPLATE_2026-06-10.md",
      "scripts/check-review-access-plan.mjs",
      "scripts/check-authenticated-smoke-evidence-template.mjs",
      "store/legal-finalization-handoff.json",
      "00_docs/LEGAL_FINALIZATION_HANDOFF_2026-06-10.md",
      "scripts/check-legal-finalization-plan.mjs",
      "store/china-distribution-compliance-handoff.json",
      "00_docs/CHINA_DISTRIBUTION_COMPLIANCE_HANDOFF_2026-06-10.md",
      "scripts/check-china-distribution-plan.mjs",
      "store/release-blockers-register.json",
      "scripts/seed-review-demo.mjs",
      "store/launch-action-plan.json",
      "00_docs/STORE_SUBMISSION_READINESS_2026-06-09.md"
    ],
    scripts: ["store:check", "store:console-plan", "review:access-plan", "production:smoke-template", "review:seed", "review:seed:dry", "legal:finalization-plan", "china:distribution-plan"]
  },
  {
    id: "owner-provided-inputs",
    label: "Owner-provided launch inputs",
    status: operatorInputs?.status || "missing",
    files: [
      "store/operator-inputs-register.json",
      "scripts/generate-release-input-shortlists.mjs",
      "scripts/generate-owner-input-form.mjs",
      "scripts/check-operator-inputs.mjs",
      "00_docs/OWNER_QUICK_INPUTS_2026-06-10.md",
      "00_docs/PRODUCTION_ENV_PRESET_CHECKLIST_2026-06-10.md",
      "00_docs/OWNER_INPUT_COLLECTION_FORM_2026-06-10.md",
      "00_docs/OPERATOR_INPUTS_HANDOFF_2026-06-10.md"
    ],
    scripts: ["owner:brief", "owner:form", "owner:inputs", "store:check", "cloud:smoke"]
  },
  {
    id: "release-evidence-closure",
    label: "Release evidence closure",
    status: releaseEvidence?.status || "missing",
    files: [
      "store/release-evidence-register.json",
      "store/evidence/README.md",
      "00_docs/RELEASE_EVIDENCE_REGISTER_2026-06-10.md",
      "scripts/check-release-evidence-register.mjs",
      "store/release-blockers-register.json",
      "store/operator-inputs-register.json",
      "store/submission-readiness.json"
    ],
    scripts: ["release:evidence", "release:check"]
  }
];

for (const domain of domains) {
  await checkRequiredFiles(domain.files, domain.label);
  checkPackageScripts(packageJson, domain.scripts, domain.label);
  const bucket = statusBucket(domain.status);
  if (bucket === "usable") pass(`${domain.label}: status ${domain.status} is usable for current phase.`);
  else warn(`${domain.label}: status ${domain.status} still needs production follow-up.`);
}

checkPackageScripts(packageJson, ["product:report", "release:check", "release:channels", "pilot:readiness", "pilot:feedback", "release:evidence", "launch:cockpit"], "Productization automation");
await checkRequiredFiles([
  "00_docs/PRODUCTIZATION_ACCEPTANCE_MATRIX_2026-06-09.md",
  "00_docs/LAUNCH_READINESS_COCKPIT_2026-06-10.md",
  "scripts/generate-launch-cockpit.mjs"
], "Productization automation");

const blockerRows = [];
if (!blockerRegister) {
  block("Release blockers register is missing or invalid.");
} else {
  if (blockerRegister.schemaVersion === "release-blockers-register-v1") {
    pass("Release blockers register schema version is current.");
  } else {
    block("Release blockers register schemaVersion must be release-blockers-register-v1.");
  }
  if (blockerRegister.status === "active") pass("Release blockers register is active.");
  else warn(`Release blockers register status is ${compactStatus(blockerRegister.status)}.`);

  const blockersList = Array.isArray(blockerRegister.blockers) ? blockerRegister.blockers : [];
  if (blockersList.length >= 8) pass("Release blockers register covers launch blockers.");
  else warn("Release blockers register should cover public web, cloud, native builds, screenshots, review account, legal, and China filing.");

  const requiredBlockerIds = [
    "public-domain-and-https",
    "support-contact",
    "legal-finalization",
    "review-demo-account",
    "cloud-cors-cookie-origin",
    "production-observability-rollback",
    "persistent-storage",
    "libtv-worker-migration",
    "native-build-toolchains",
    "native-store-screenshots",
    "mobile-device-qa-completion",
    "china-filing-and-operator"
  ];
  const blockerIds = new Set(blockersList.map((item) => item.id));
  for (const id of requiredBlockerIds) {
    if (blockerIds.has(id)) pass(`Release blockers register includes ${id}.`);
    else warn(`Release blockers register is missing ${id}.`);
  }

  const commandWhitelist = packageJson?.scripts || {};
  for (const item of blockersList) {
    const label = item.id || item.area || "unnamed-blocker";
    blockerRows.push({
      id: label,
      owner: compactStatus(item.owner),
      status: compactStatus(item.status),
      severity: compactStatus(item.severity)
    });
    if (item.id && item.area && item.owner && item.status && item.severity) pass(`Release blocker ${label} has identity fields.`);
    else warn(`Release blocker ${label} should have id, area, owner, status, and severity.`);
    if (Array.isArray(item.sourceWarnings) && item.sourceWarnings.length) pass(`Release blocker ${label} maps source warnings.`);
    else warn(`Release blocker ${label} should map source warnings.`);
    if (Array.isArray(item.unblockActions) && item.unblockActions.length >= 2) pass(`Release blocker ${label} has unblock actions.`);
    else warn(`Release blocker ${label} should have at least two unblock actions.`);
    if (Array.isArray(item.verificationCommands) && item.verificationCommands.length) pass(`Release blocker ${label} has verification commands.`);
    else warn(`Release blocker ${label} should have verification commands.`);
    for (const command of item.verificationCommands || []) {
      const match = String(command).match(/^npm run ([^\s]+)/);
      if (!match) continue;
      if (commandWhitelist[match[1]]) pass(`Release blocker ${label} verification command exists: ${command}.`);
      else warn(`Release blocker ${label} references missing npm script: ${command}.`);
    }
    if (Array.isArray(item.evidenceFiles) && item.evidenceFiles.length) {
      pass(`Release blocker ${label} declares evidence files.`);
      for (const evidenceFile of item.evidenceFiles) {
        if (await fileExists(evidenceFile)) pass(`Release blocker ${label} evidence exists: ${evidenceFile}.`);
        else warn(`Release blocker ${label} evidence file is missing: ${evidenceFile}.`);
      }
    } else {
      warn(`Release blocker ${label} should declare evidence files.`);
    }
  }
}

checkNoPlaceholderObject(submission?.app || {}, "Store app metadata", [
  "supportUrl",
  "marketingUrl",
  "privacyPolicyUrl",
  "accountDeletionUrl",
  "contactEmail",
  "contactPhone"
]);
checkNoPlaceholderObject(submission?.china || {}, "China distribution metadata", [
  "operatorName",
  "domain",
  "icpFilingNumber",
  "appFilingNumber",
  "filingDisplayLocation"
]);

const launchRows = collectPlanStatuses(launchPlan, "Store launch plan");
const cloudRows = collectPlanStatuses(cloudPlan, "Cloud deployment plan");

if (screenshotPlan?.sets?.some((set) => set.id === "mobile-web-390" && set.status === "captured")) {
  pass("Screenshot plan has captured mobile-web-390 evidence.");
} else {
  warn("Screenshot plan should keep mobile-web-390 captured evidence.");
}

if (screenshotPlan?.sets?.some((set) => /blocked-until-native-build/.test(String(set.status)))) {
  warn("Native store screenshots still wait for iOS/Android builds.");
}

const matrixRows = domains.map((domain) => ({
  id: domain.id,
  label: domain.label,
  status: compactStatus(domain.status),
  bucket: statusBucket(domain.status)
}));

console.log("Productization readiness report");
console.log(`Passes: ${passes.length}`);
console.log(`Blockers: ${blockers.length}`);
console.log(`Warnings: ${warnings.length}`);

console.log("\nReadiness Matrix");
console.log("Area".padEnd(36), "Status".padEnd(28), "Bucket");
console.log("-".repeat(78));
for (const row of matrixRows) {
  console.log(row.label.padEnd(36), row.status.padEnd(28), row.bucket);
}

console.log("\nStore Launch Plan");
for (const row of launchRows) {
  console.log(`- ${row.id}: ${row.status}`);
}

console.log("\nCloud Deployment Plan");
for (const row of cloudRows) {
  console.log(`- ${row.id}: ${row.status}`);
}

console.log("\nRelease Blocker Register");
for (const row of blockerRows) {
  console.log(`- ${row.id}: ${row.severity}, ${row.status}, owner=${row.owner}`);
}

if (blockers.length) {
  console.log("\nBlockers");
  for (const message of blockers) console.log(`- ${message}`);
}

if (warnings.length) {
  console.log("\nWarnings");
  for (const message of warnings) console.log(`- ${message}`);
}

if (blockers.length) process.exit(1);
