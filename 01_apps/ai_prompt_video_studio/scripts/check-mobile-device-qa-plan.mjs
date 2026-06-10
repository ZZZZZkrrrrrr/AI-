import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const planPath = "store/mobile-device-qa-plan.json";
const strict = process.argv.includes("--strict");
const passes = [];
const warnings = [];
const blockers = [];

const requiredDeviceIds = [
  "mobile-web-390",
  "mobile-web-430",
  "tablet-web-768",
  "android-device",
  "ios-device"
];

const requiredSuiteIds = [
  "beginner-home",
  "operation-density",
  "intent-navigation",
  "auth-session",
  "upload-create",
  "assets-results",
  "settings-legal-data-rights",
  "pwa-install",
  "android-native",
  "ios-native",
  "store-screenshots",
  "accessibility-safe-area"
];

const statusAllowlist = new Set([
  "automated-pass",
  "web-evidence-captured",
  "manual-ready",
  "manual-pending",
  "internal-ready",
  "internal-ready-with-manual-gates",
  "blocked-until-toolchain",
  "blocked-until-macos-xcode",
  "blocked-until-native-build",
  "blocked-until-review-account",
  "blocked-until-production-origin"
]);

function pass(message) {
  passes.push(message);
}

function warn(message) {
  warnings.push(message);
}

function block(message) {
  blockers.push(message);
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function resolveProjectPath(relativePath) {
  const text = String(relativePath || "");
  if (path.isAbsolute(text)) return text;
  if (text.startsWith("00_docs/")) return path.join(workspaceRoot, text);
  return path.join(appRoot, text);
}

async function fileExists(relativePath) {
  try {
    const info = await stat(resolveProjectPath(relativePath));
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(resolveProjectPath(relativePath), "utf8"));
  } catch (error) {
    block(`${relativePath} is missing or invalid JSON: ${error.message}`);
    return null;
  }
}

function checkHttpsReference(reference, label) {
  if (reference.name && /^https:\/\//i.test(String(reference.url || ""))) {
    pass(`${label}: ${reference.name} has an HTTPS reference.`);
  } else {
    block(`${label}: official reference entries must include name and HTTPS URL.`);
  }
}

function checkStatus(status, label) {
  const text = String(status || "").trim();
  if (!text) {
    block(`${label} is missing status.`);
    return;
  }
  if (!statusAllowlist.has(text)) {
    warn(`${label} uses an unrecognized status: ${text}.`);
    return;
  }
  if (/^blocked-|^manual-pending$/.test(text)) {
    warn(`${label} is ${text}; keep it out of external release until verified.`);
    return;
  }
  pass(`${label} status is ${text}.`);
}

function checkNpmCommand(command, packageJson, label) {
  const match = String(command || "").match(/^npm run ([^\s]+)/);
  if (!match) {
    warn(`${label} has a non-npm manual command: ${command}.`);
    return;
  }
  const script = match[1];
  if (packageJson?.scripts?.[script]) {
    pass(`${label} command exists: ${command}.`);
  } else {
    block(`${label} references a missing npm script: ${command}.`);
  }
}

async function checkEvidence(evidence, label, { requireAtLeastOneFile = false } = {}) {
  if (!Array.isArray(evidence) || !evidence.length) {
    block(`${label} must declare evidence files or references.`);
    return;
  }

  let existingFileCount = 0;
  for (const item of evidence) {
    const text = String(item || "").trim();
    if (!text) {
      block(`${label} has an empty evidence entry.`);
      continue;
    }
    if (/^https:\/\//i.test(text)) {
      pass(`${label} has external evidence reference: ${text}.`);
      continue;
    }
    if (await fileExists(text)) {
      existingFileCount += 1;
      pass(`${label} evidence exists: ${text}.`);
    } else {
      block(`${label} evidence file is missing: ${text}.`);
    }
  }

  if (requireAtLeastOneFile && existingFileCount < 1) {
    block(`${label} must include at least one existing local evidence file.`);
  }
}

function checkDeviceCoverage(suite, deviceIds) {
  const requiredDevices = Array.isArray(suite.requiredDevices) ? suite.requiredDevices : [];
  if (!requiredDevices.length) {
    block(`Suite ${suite.id} must list requiredDevices.`);
    return;
  }
  for (const deviceId of requiredDevices) {
    if (deviceIds.has(deviceId)) pass(`Suite ${suite.id} targets device ${deviceId}.`);
    else block(`Suite ${suite.id} references unknown device ${deviceId}.`);
  }
}

function checkCase(testCase, suiteId) {
  const label = `Suite ${suiteId} case ${testCase?.id || "unknown"}`;
  if (!isObject(testCase)) {
    block(`Suite ${suiteId} has a non-object test case.`);
    return;
  }
  if (testCase.id && testCase.title && testCase.channel && testCase.priority) {
    pass(`${label} has identity fields.`);
  } else {
    block(`${label} needs id, title, channel, and priority.`);
  }
  checkStatus(testCase.status, label);
  if (Array.isArray(testCase.steps) && testCase.steps.length >= 2) {
    pass(`${label} has executable steps.`);
  } else {
    block(`${label} needs at least two executable steps.`);
  }
  if (testCase.expectedResult) pass(`${label} has an expected result.`);
  else block(`${label} is missing expectedResult.`);
  if (Array.isArray(testCase.evidence) && testCase.evidence.length) {
    pass(`${label} declares evidence.`);
  } else {
    warn(`${label} should declare evidence files.`);
  }
}

const packageJson = await readJson("package.json");
const plan = await readJson(planPath);

if (plan) {
  if (plan.schemaVersion === "mobile-device-qa-plan-v1") {
    pass("Mobile device QA plan schema version is current.");
  } else {
    block("Mobile device QA plan schemaVersion must be mobile-device-qa-plan-v1.");
  }

  if (plan.updatedAt) pass("Mobile device QA plan has updatedAt.");
  else block("Mobile device QA plan is missing updatedAt.");

  checkStatus(plan.status, "Mobile device QA plan");

  if (plan.objective) pass("Mobile device QA plan has an objective.");
  else block("Mobile device QA plan is missing objective.");

  const officialReferences = Array.isArray(plan.officialReferences) ? plan.officialReferences : [];
  if (officialReferences.length >= 4) pass("Mobile device QA plan includes official references.");
  else block("Mobile device QA plan should include at least four official references.");
  for (const reference of officialReferences) checkHttpsReference(reference, "Mobile device QA official basis");

  const manualEvidenceTemplate = plan.manualEvidenceTemplate || {};
  if (manualEvidenceTemplate.status === "template-ready-waiting-real-device-results") {
    pass("Mobile device QA plan links a manual evidence template that waits for real-device results.");
  } else {
    block("Mobile device QA plan should link a template-ready manual evidence template.");
  }
  for (const [key, expected] of [
    ["templateFile", "store/mobile-device-qa-evidence-template.json"],
    ["runbook", "00_docs/MOBILE_DEVICE_QA_EVIDENCE_TEMPLATE_2026-06-10.md"],
    ["checkScript", "scripts/check-mobile-qa-evidence-template.mjs"],
    ["checkCommand", "npm run mobile:qa:evidence"],
    ["publicOrigin", "https://www.zkraiflow.top"]
  ]) {
    if (manualEvidenceTemplate[key] === expected) pass(`Mobile device QA manual evidence template links ${expected}.`);
    else block(`Mobile device QA manual evidence template ${key} should be ${expected}.`);
  }
  for (const evidenceFile of [
    manualEvidenceTemplate.templateFile,
    manualEvidenceTemplate.runbook,
    manualEvidenceTemplate.checkScript
  ]) {
    if (await fileExists(evidenceFile)) pass(`Mobile device QA manual evidence file exists: ${evidenceFile}.`);
    else block(`Mobile device QA manual evidence file is missing: ${evidenceFile}.`);
  }

  for (const script of plan.requiredScripts || []) {
    if (packageJson?.scripts?.[script]) pass(`Required QA script exists: ${script}.`);
    else block(`Required QA script is missing from package.json: ${script}.`);
  }

  for (const script of [
    "mobile:check",
    "mobile:qa",
    "mobile:qa:evidence",
    "pwa:check",
    "pwa:prod-plan",
    "pwa:public-smoke",
    "screenshots:check",
    "capacitor:check",
    "store:check",
    "review:seed:dry",
    "release:check"
  ]) {
    if (packageJson?.scripts?.[script]) pass(`Core release script exists: ${script}.`);
    else block(`Core release script is missing: ${script}.`);
  }

  const devices = Array.isArray(plan.deviceMatrix) ? plan.deviceMatrix : [];
  const deviceIds = new Set(devices.map((device) => device.id));
  for (const requiredDeviceId of requiredDeviceIds) {
    if (deviceIds.has(requiredDeviceId)) pass(`Required QA device exists: ${requiredDeviceId}.`);
    else block(`Required QA device is missing: ${requiredDeviceId}.`);
  }

  for (const device of devices) {
    const label = `Device ${device.id || "unknown"}`;
    if (device.id && device.label && device.channel && device.platform) {
      pass(`${label} has identity fields.`);
    } else {
      block(`${label} needs id, label, channel, and platform.`);
    }
    checkStatus(device.status, label);
    await checkEvidence(device.evidence, label, { requireAtLeastOneFile: true });
    if (/^blocked-/.test(String(device.status || "")) && !device.blocker) {
      block(`${label} is blocked but does not name the blocker.`);
    }
  }

  const suites = Array.isArray(plan.testSuites) ? plan.testSuites : [];
  const suiteIds = new Set(suites.map((suite) => suite.id));
  for (const requiredSuiteId of requiredSuiteIds) {
    if (suiteIds.has(requiredSuiteId)) pass(`Required QA suite exists: ${requiredSuiteId}.`);
    else block(`Required QA suite is missing: ${requiredSuiteId}.`);
  }

  for (const suite of suites) {
    if (!isObject(suite)) {
      block("QA suite must be an object.");
      continue;
    }
    const label = `Suite ${suite.id || "unknown"}`;
    if (suite.id && suite.title && suite.owner) pass(`${label} has identity fields.`);
    else block(`${label} needs id, title, and owner.`);
    checkStatus(suite.status, label);
    checkDeviceCoverage(suite, deviceIds);
    await checkEvidence(suite.evidence, label, { requireAtLeastOneFile: true });

    const commands = Array.isArray(suite.automationCommands) ? suite.automationCommands : [];
    if (commands.length) {
      for (const command of commands) checkNpmCommand(command, packageJson, label);
    } else {
      warn(`${label} should list automationCommands.`);
    }

    const cases = Array.isArray(suite.cases) ? suite.cases : [];
    if (cases.length >= 2) pass(`${label} has at least two test cases.`);
    else block(`${label} should have at least two test cases.`);
    for (const testCase of cases) checkCase(testCase, suite.id);
  }

  const suiteById = new Map(suites.map((suite) => [suite.id, suite]));
  const beginnerEvidence = suiteById.get("beginner-home")?.evidence || [];
  if (beginnerEvidence.includes("store/screenshots/mobile-web-390/01-home.png")
    && beginnerEvidence.includes("store/screenshots/mobile-web-390/03-home-image.png")) {
    pass("Beginner home QA links video and image/text mode screenshots.");
  } else {
    block("Beginner home QA must link both video and image/text mode screenshots.");
  }

  const densityEvidence = suiteById.get("operation-density")?.evidence || [];
  if (densityEvidence.includes("00_docs/MOBILE_OPERATION_DENSITY_ACCEPTANCE_2026-06-10.md")
    && densityEvidence.includes("src/styles.css")) {
    pass("Operation density QA links the acceptance document and mobile styles.");
  } else {
    block("Operation density QA must link the acceptance document and mobile styles.");
  }
  const densityCommands = suiteById.get("operation-density")?.automationCommands || [];
  if (densityCommands.includes("npm run mobile:density")) {
    pass("Operation density QA runs the mobile density gate.");
  } else {
    block("Operation density QA must run npm run mobile:density.");
  }
  if (beginnerEvidence.includes("store/screenshots/mobile-web-390/02-home-notifications.png")) {
    pass("Beginner home QA links the compact notification panel screenshot.");
  } else {
    block("Beginner home QA must link the compact notification panel screenshot.");
  }

  const pwaEvidence = suiteById.get("pwa-install")?.evidence || [];
  if (pwaEvidence.includes("store/screenshots/mobile-web-390/08-pwa-install-guide.png")) {
    pass("PWA install QA links the mobile install guidance screenshot.");
  } else {
    block("PWA install QA must link the mobile install guidance screenshot.");
  }
  if (pwaEvidence.includes("store/pwa-production-smoke-plan.json")) {
    pass("PWA install QA links the production smoke plan.");
  } else {
    block("PWA install QA must link the production smoke plan.");
  }

  const intentEvidence = suiteById.get("intent-navigation")?.evidence || [];
  if (intentEvidence.includes("store/screenshots/mobile-web-390/04-create-prompt-intent.png")) {
    pass("Intent navigation QA links the prompt-package guided screenshot.");
  } else {
    block("Intent navigation QA must link the prompt-package guided screenshot.");
  }

  const androidStatus = String(suiteById.get("android-native")?.status || "");
  if (/blocked-until-toolchain|manual-ready|web-evidence-captured|automated-pass/.test(androidStatus)) {
    pass("Android native QA has a clear readiness state.");
  } else {
    block("Android native QA needs a clear readiness or blocker status.");
  }

  const iosStatus = String(suiteById.get("ios-native")?.status || "");
  if (/blocked-until-macos-xcode|manual-ready|web-evidence-captured|automated-pass/.test(iosStatus)) {
    pass("iOS native QA has a clear readiness state.");
  } else {
    block("iOS native QA needs a clear readiness or blocker status.");
  }

  const decisionRules = Array.isArray(plan.releaseDecisionRules) ? plan.releaseDecisionRules : [];
  if (decisionRules.length >= 4) pass("Mobile QA plan has release decision rules.");
  else block("Mobile QA plan needs release decision rules.");
}

console.log("Mobile device QA plan check");
console.log(`Passes: ${passes.length}`);
console.log(`Blockers: ${blockers.length}`);
console.log(`Warnings: ${warnings.length}`);

if (blockers.length) {
  console.log("\nBlockers");
  for (const message of blockers) console.log(`- ${message}`);
}

if (warnings.length) {
  console.log("\nWarnings");
  for (const message of warnings) console.log(`- ${message}`);
}

if (blockers.length || (strict && warnings.length)) process.exit(1);
