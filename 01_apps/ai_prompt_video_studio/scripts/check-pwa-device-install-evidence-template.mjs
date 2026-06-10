import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = findWorkspaceRoot(appRoot);
const passes = [];
const warnings = [];
const failures = [];

function findWorkspaceRoot(startDir) {
  let current = path.resolve(startDir);
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "00_docs")) && existsSync(path.join(current, "01_apps"))) return current;
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return path.resolve(startDir, "..", "..");
}

function resolveProjectPath(relativePath) {
  const text = String(relativePath || "");
  if (path.isAbsolute(text)) return text;
  if (text.startsWith("00_docs/")) return path.join(workspaceRoot, text);
  return path.join(appRoot, text);
}

async function readText(relativePath) {
  try {
    return await readFile(resolveProjectPath(relativePath), "utf8");
  } catch {
    return "";
  }
}

async function readJson(relativePath) {
  const text = await readText(relativePath);
  if (!text) {
    fail(`${relativePath} is missing or empty.`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${relativePath} is invalid JSON: ${error.message}`);
    return null;
  }
}

async function fileExists(relativePath) {
  try {
    const info = await stat(resolveProjectPath(relativePath));
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

function pass(message) {
  passes.push(message);
}

function warn(message) {
  warnings.push(message);
}

function fail(message) {
  failures.push(message);
}

function requireValue(value, label) {
  if (String(value || "").trim()) {
    pass(`${label} is present.`);
    return true;
  }
  fail(`${label} is missing.`);
  return false;
}

function requireArray(value, label, minimum = 1) {
  if (Array.isArray(value) && value.length >= minimum) {
    pass(`${label} has ${value.length} item(s).`);
    return true;
  }
  fail(`${label} should contain at least ${minimum} item(s).`);
  return false;
}

function requireIncludes(source, marker, label) {
  if (String(source || "").includes(marker)) pass(label);
  else fail(`${label}: missing marker "${marker}".`);
}

function looksSecretLike(value) {
  const text = String(value || "");
  return /sk-[A-Za-z0-9_-]{20,}/.test(text)
    || /AIza[A-Za-z0-9_-]{20,}/.test(text)
    || /ghp_[A-Za-z0-9_]{20,}/.test(text)
    || /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(text)
    || /password\s*[:=]\s*(?!TODO_|<secret>|password-manager|redacted)/i.test(text)
    || /cookie\s*[:=]\s*(?!redacted|<redacted>)/i.test(text);
}

const templatePath = "store/pwa-device-install-evidence-template.json";
const docPath = "00_docs/PWA_DEVICE_INSTALL_EVIDENCE_TEMPLATE_2026-06-10.md";
const template = await readJson(templatePath);
const plan = await readJson("store/pwa-production-smoke-plan.json");
const packageJson = await readJson("package.json");
const docText = await readText(docPath);

if (template) {
  if (template.schemaVersion === "pwa-device-install-evidence-template-v1") pass("PWA device install evidence template schema version is current.");
  else fail("PWA device install evidence template schemaVersion must be pwa-device-install-evidence-template-v1.");

  requireValue(template.updatedAt, "PWA device evidence template updatedAt");
  requireIncludes(template.status, "waiting-production-device-results", "PWA device evidence template keeps real device evidence unresolved.");
  requireIncludes(template.publicOrigin, "https://www.zkraiflow.top", "PWA device evidence template uses the public production domain.");
  requireValue(template.purpose, "PWA device evidence template purpose");

  if (looksSecretLike(JSON.stringify(template))) fail("PWA device evidence template appears to contain secret-like material.");
  else pass("PWA device evidence template does not contain obvious secret-like material.");

  requireArray(template.officialReferences, "PWA device official references", 4);
  for (const reference of template.officialReferences || []) {
    if (reference.name && /^https:\/\//i.test(String(reference.url || ""))) pass(`Official reference is HTTPS: ${reference.name}.`);
    else fail("Official references must include name and HTTPS URL.");
    requireValue(reference.whyItMatters, `Official reference ${reference.name || "unknown"} rationale`);
  }

  const deviceIds = new Set((template.requiredDevices || []).map((device) => device.id));
  requireArray(template.requiredDevices, "PWA required devices", 2);
  for (const id of ["android-chrome", "ios-safari"]) {
    if (deviceIds.has(id)) pass(`PWA required device exists: ${id}.`);
    else fail(`PWA required device is missing: ${id}.`);
  }
  for (const device of template.requiredDevices || []) {
    requireIncludes(device.status, "pending-real-device", `PWA device ${device.id || "unknown"} remains pending real-device evidence.`);
    requireArray(device.mustCapture, `PWA device ${device.id || "unknown"} capture list`, 5);
  }

  const caseIds = new Set((template.deviceTestCases || []).map((testCase) => testCase.id));
  requireArray(template.deviceTestCases, "PWA device test cases", 6);
  for (const id of ["android-install-home-launch", "ios-add-home-launch", "offline-relaunch", "ios-public-pages", "update-banner", "authenticated-relaunch"]) {
    if (caseIds.has(id)) pass(`PWA device test case exists: ${id}.`);
    else fail(`PWA device test case is missing: ${id}.`);
  }
  for (const testCase of template.deviceTestCases || []) {
    const label = testCase.id || "unknown-case";
    if (deviceIds.has(testCase.deviceId)) pass(`PWA device test case ${label} targets ${testCase.deviceId}.`);
    else fail(`PWA device test case ${label} targets unknown device ${testCase.deviceId}.`);
    requireArray(testCase.steps, `PWA device test case ${label} steps`, 3);
    requireArray(testCase.expectedEvidence, `PWA device test case ${label} expected evidence`, 3);
    if (testCase.priority === "P0" && /pending|blocked/.test(String(testCase.status || ""))) {
      warn(`${label} remains ${testCase.status}; keep PWA pilot expansion gated.`);
    } else {
      pass(`PWA device test case ${label} status is ${testCase.status || "documented"}.`);
    }
  }

  const sample = template.sampleEvidenceRecord || {};
  if (sample.schemaVersion === "pwa-device-install-result-v1") pass("Sample PWA device evidence record schema is present.");
  else fail("Sample PWA device evidence record schemaVersion should be pwa-device-install-result-v1.");
  requireIncludes(sample.publicOrigin, "https://www.zkraiflow.top", "Sample PWA device evidence record uses public origin.");
  requireArray(sample.evidenceFiles, "Sample PWA device evidence files", 1);

  requireIncludes(template.evidenceRules?.fileNaming, "store/evidence/pwa-device/", "PWA evidence file naming points to pwa-device evidence folder.");
  requireArray(template.evidenceRules?.allowedInRepository, "PWA allowed repository evidence", 4);
  requireArray(template.evidenceRules?.doNotStore, "PWA do-not-store list", 5);
  requireArray(template.closeoutGates, "PWA device closeout gates", 5);

  for (const linkedFile of template.linkedFiles || []) {
    if (await fileExists(linkedFile)) pass(`PWA device linked file exists: ${linkedFile}.`);
    else fail(`PWA device linked file is missing: ${linkedFile}.`);
  }
}

const planTemplate = plan?.deviceInstallEvidenceTemplate || {};
if (planTemplate.status === "template-ready-waiting-production-device-results") {
  pass("PWA production smoke plan links the device install evidence template status.");
} else {
  fail("PWA production smoke plan should link deviceInstallEvidenceTemplate.status as template-ready-waiting-production-device-results.");
}
for (const [key, expected] of [
  ["templateFile", "store/pwa-device-install-evidence-template.json"],
  ["runbook", "00_docs/PWA_DEVICE_INSTALL_EVIDENCE_TEMPLATE_2026-06-10.md"],
  ["checkScript", "scripts/check-pwa-device-install-evidence-template.mjs"],
  ["checkCommand", "npm run pwa:device-template"]
]) {
  if (planTemplate[key] === expected) pass(`PWA production smoke plan device template ${key} links ${expected}.`);
  else fail(`PWA production smoke plan device template ${key} should be ${expected}.`);
}

if (packageJson?.scripts?.["pwa:device-template"]) pass("package.json exposes npm run pwa:device-template.");
else fail("package.json should expose npm run pwa:device-template.");

if (await fileExists(docPath)) pass("PWA device evidence runbook exists.");
else fail(`PWA device evidence runbook is missing: ${docPath}.`);

if (docText) {
  for (const marker of [
    "https://www.zkraiflow.top",
    "npm run pwa:device-template",
    "Android Chrome",
    "iOS Safari",
    "不要放进仓库",
    "离线",
    "主屏幕"
  ]) {
    requireIncludes(docText, marker, `PWA device evidence runbook includes ${marker}`);
  }
}

console.log("PWA device install evidence template check");
console.log(`Passes: ${passes.length}`);
console.log(`Failures: ${failures.length}`);
console.log(`Warnings: ${warnings.length}`);

if (warnings.length) {
  console.log("\nWarnings");
  for (const message of warnings) console.log(`- ${message}`);
}

if (failures.length) {
  console.error("\nFailures");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}
