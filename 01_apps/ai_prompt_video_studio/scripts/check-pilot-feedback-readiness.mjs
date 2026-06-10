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
    if (existsSync(path.join(current, "00_docs")) && existsSync(path.join(current, "01_apps"))) {
      return current;
    }
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return path.resolve(startDir, "..", "..");
}

function resolveProjectPath(relativePath) {
  if (relativePath.startsWith("00_docs/")) return path.join(workspaceRoot, relativePath);
  return path.join(appRoot, relativePath);
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

function requireIncludes(source, marker, label) {
  if (String(source || "").includes(marker)) {
    pass(label);
    return;
  }
  fail(`${label}: missing marker "${marker}".`);
}

function requirePattern(source, pattern, label) {
  if (pattern.test(String(source || ""))) {
    pass(label);
    return;
  }
  fail(`${label}: pattern not found.`);
}

function commandScriptName(command) {
  const match = /npm run ([\w:-]+)/.exec(String(command || ""));
  return match?.[1] || "";
}

function looksSecretLike(value) {
  const text = String(value || "");
  return /sk-[A-Za-z0-9_-]{20,}/.test(text)
    || /AIza[A-Za-z0-9_-]{20,}/.test(text)
    || /ghp_[A-Za-z0-9_]{20,}/.test(text)
    || /xox[baprs]-[A-Za-z0-9-]{20,}/.test(text)
    || /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(text)
    || /password\s*[:=]\s*(?!TODO_|<secret>|password-manager|secret ref)/i.test(text);
}

const packageJson = await readJson("package.json");
const pilotPlan = await readJson("store/pilot-release-readiness.json");
const releaseEvidence = await readJson("store/release-evidence-register.json");
const submission = await readJson("store/submission-readiness.json");
const operatorInputs = await readJson("store/operator-inputs-register.json");
const mobileQaPlan = await readJson("store/mobile-device-qa-plan.json");
const serverSource = await readText("server.js");
const settingsSource = await readText("src/features/settings/SettingsPage.jsx");
const stylesSource = await readText("src/styles.css");
const mobileCheckSource = await readText("scripts/check-mobile-readiness.mjs");
const docText = await readText("00_docs/PILOT_FEEDBACK_LOOP_2026-06-10.md");
const packageScripts = packageJson?.scripts || {};

if (packageScripts["pilot:feedback"]) pass("package.json exposes npm run pilot:feedback.");
else fail("package.json should expose npm run pilot:feedback.");

if (packageScripts["release:check"]?.includes("npm run pilot:feedback")) pass("release:check includes pilot:feedback.");
else fail("release:check should include npm run pilot:feedback.");

for (const marker of [
  "function supportFeedbackPath",
  "function supportFeedbackDir",
  "function normalizeSupportFeedbackPayload",
  "async function createSupportFeedback",
  "async function readSupportFeedback",
  "async function readAllSupportFeedback",
  "async function updateSupportFeedbackStatus",
  "/api/support/feedback",
  "/api/admin/support-feedback",
  "RUN_STORAGE_DIR"
]) {
  requireIncludes(serverSource, marker, `Server includes ${marker}`);
}
requirePattern(serverSource, /message\.length < 6/, "Server rejects empty or too-short pilot feedback.");
requirePattern(serverSource, /support-feedback.*jsonl/s, "Server stores pilot feedback under support-feedback JSONL files.");
requirePattern(serverSource, /requireDataRightsAdmin\(session\)[\s\S]*readAllSupportFeedback/, "Admin feedback list is protected by admin permission.");

for (const marker of [
  "PilotFeedbackPanel",
  "AdminPilotFeedbackQueue",
  "PILOT_FEEDBACK_CATEGORIES",
  "PILOT_FEEDBACK_SEVERITIES",
  "PILOT_FEEDBACK_REVIEW_STATUSES",
  "/api/support/feedback",
  "/api/admin/support-feedback",
  "试用反馈",
  "提交反馈",
  "反馈队列"
]) {
  requireIncludes(settingsSource, marker, `Settings page includes ${marker}`);
}
requirePattern(settingsSource, /pilotFeedbackMessage\.trim\(\)\.length < 6/, "Settings page prevents empty pilot feedback submissions.");
requirePattern(settingsSource, /window\.innerWidth[\s\S]*window\.innerHeight/, "Settings page records coarse viewport context.");
requirePattern(settingsSource, /navigator\.userAgent/, "Settings page records user agent context for triage.");

for (const marker of [
  ".pilot-feedback-section",
  ".pilot-feedback-grid",
  ".pilot-feedback-actions",
  ".pilot-feedback-card",
  ".pilot-feedback-admin-list",
  ".pilot-feedback-admin-card"
]) {
  requireIncludes(stylesSource, marker, `Styles include ${marker}`);
}
requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*\.pilot-feedback-grid[\s\S]*grid-template-columns:\s*1fr/s, "Mobile CSS collapses pilot feedback form to one column.");
requirePattern(stylesSource, /\.pilot-feedback-actions\s*\{[\s\S]*grid-template-columns:/, "Pilot feedback actions use stable grid sizing.");

for (const marker of [
  "PilotFeedbackPanel",
  "/api/support/feedback",
  ".pilot-feedback-grid",
  ".pilot-feedback-card"
]) {
  requireIncludes(mobileCheckSource, marker, `Mobile readiness check covers ${marker}`);
}

const feedbackGate = (pilotPlan?.gates || []).find((gate) => gate.id === "pilot-feedback-loop");
if (feedbackGate) {
  pass("Pilot release readiness includes pilot-feedback-loop gate.");
  if ((feedbackGate.commands || []).includes("npm run pilot:feedback")) pass("Pilot feedback gate includes npm run pilot:feedback.");
  else fail("Pilot feedback gate should include npm run pilot:feedback.");
  for (const evidenceFile of feedbackGate.evidence || []) {
    if (await fileExists(evidenceFile)) pass(`Pilot feedback gate evidence exists: ${evidenceFile}.`);
    else fail(`Pilot feedback gate evidence file is missing: ${evidenceFile}.`);
  }
} else {
  fail("Pilot release readiness should include pilot-feedback-loop gate.");
}

const feedbackEvidence = (releaseEvidence?.bundles || []).find((bundle) => bundle.id === "pilot-feedback-loop-proof");
if (feedbackEvidence) {
  pass("Release evidence register includes pilot-feedback-loop-proof.");
  for (const command of feedbackEvidence.verificationCommands || []) {
    const script = commandScriptName(command);
    if (!script) continue;
    if (packageScripts[script]) pass(`Pilot feedback evidence command exists: npm run ${script}.`);
    else fail(`Pilot feedback evidence references missing npm script: npm run ${script}.`);
  }
  for (const sourceFile of feedbackEvidence.sourceFiles || []) {
    if (await fileExists(sourceFile)) pass(`Pilot feedback evidence source exists: ${sourceFile}.`);
    else fail(`Pilot feedback evidence source file is missing: ${sourceFile}.`);
  }
} else {
  fail("Release evidence register should include pilot-feedback-loop-proof.");
}

if ((releaseEvidence?.verificationCommands || []).includes("npm run pilot:feedback")) pass("Release evidence top-level commands include pilot:feedback.");
else fail("Release evidence top-level commands should include npm run pilot:feedback.");
if ((operatorInputs?.closeoutCommands || []).includes("npm run pilot:feedback")) pass("Operator inputs closeout includes pilot:feedback.");
else fail("Operator inputs closeout should include npm run pilot:feedback.");

if (submission?.pilotFeedback?.status === "internal-ready") pass("Submission readiness tracks pilotFeedback status.");
else fail("Submission readiness should track pilotFeedback.status as internal-ready.");

const feedbackCase = (mobileQaPlan?.testSuites || [])
  .flatMap((suite) => suite.cases || [])
  .find((testCase) => testCase.id === "pilot-feedback-submit");
if (feedbackCase) pass("Mobile QA plan includes pilot-feedback-submit case.");
else fail("Mobile QA plan should include pilot-feedback-submit case.");

if (docText) {
  for (const marker of [
    "试点反馈闭环",
    "npm run pilot:feedback",
    "POST /api/support/feedback",
    "GET /api/admin/support-feedback",
    "RUN_STORAGE_DIR/support-feedback",
    "不要写入仓库或反馈记录"
  ]) {
    requireIncludes(docText, marker, `Pilot feedback runbook includes ${marker}`);
  }
  if (looksSecretLike(docText)) fail("Pilot feedback runbook appears to contain secret-like material.");
  else pass("Pilot feedback runbook does not contain obvious secret-like material.");
} else {
  fail("Pilot feedback runbook is missing.");
}

console.log("Pilot feedback readiness check");
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
