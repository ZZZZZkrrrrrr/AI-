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
    || /secret\s*[:=]\s*(?!TODO_|<secret>|hosting-secret|redacted)/i.test(text)
    || /token\s*[:=]\s*(?!TODO_|<token>|redacted|secret-manager|hosting-secret)/i.test(text)
    || /cookie\s*[:=]\s*(?!redacted|<redacted>)/i.test(text);
}

const templatePath = "deploy/libtv-worker-smoke-evidence-template.json";
const docPath = "00_docs/LIBTV_WORKER_SMOKE_EVIDENCE_TEMPLATE_2026-06-10.md";
const scriptPath = "scripts/check-libtv-worker-smoke-evidence-template.mjs";
const commandName = "cloud:worker-smoke-template";
const command = `npm run ${commandName}`;

const template = await readJson(templatePath);
const workerPlan = await readJson("deploy/libtv-worker-storage-plan.json");
const cloudPlan = await readJson("deploy/cloud-deployment-action-plan.json");
const packageJson = await readJson("package.json");
const docText = await readText(docPath);
const packageScripts = packageJson?.scripts || {};

if (template) {
  if (template.schemaVersion === "libtv-worker-smoke-evidence-template-v1") pass("libTV worker smoke template schema version is current.");
  else fail("libTV worker smoke template schemaVersion must be libtv-worker-smoke-evidence-template-v1.");

  requireValue(template.updatedAt, "libTV worker smoke template updatedAt");
  requireIncludes(template.status, "waiting-worker-target", "libTV worker smoke template keeps worker target unresolved.");
  requireIncludes(template.targetOrigin, "https://www.zkraiflow.top", "libTV worker smoke template targets the public production domain.");
  requireIncludes(template.workerVisibility, "private-api-to-worker-only", "libTV worker template keeps worker private to API.");
  requireValue(template.purpose, "libTV worker smoke template purpose");

  if (looksSecretLike(JSON.stringify(template))) fail("libTV worker smoke template appears to contain secret-like material.");
  else pass("libTV worker smoke template does not contain obvious secret-like material.");

  requireArray(template.officialReferences, "libTV worker official references", 4);
  for (const reference of template.officialReferences || []) {
    if (reference.name && /^https:\/\//i.test(String(reference.url || ""))) pass(`Official reference is HTTPS: ${reference.name}.`);
    else fail("Official references must include name and HTTPS URL.");
    requireValue(reference.whyItMatters, `Official reference ${reference.name || "unknown"} rationale`);
  }

  requireArray(template.requiredInputsOutsideRepository, "Required outside-repository worker inputs", 5);
  for (const input of template.requiredInputsOutsideRepository || []) {
    requireValue(input.id, "Worker owner input id");
    requireIncludes(input.status, "waiting-owner-input", `Worker owner input ${input.id || "unknown"} waits for owner input.`);
    requireArray(input.acceptedShapes, `Worker owner input ${input.id || "unknown"} accepted shapes`, 2);
    requireArray(input.doNotStore, `Worker owner input ${input.id || "unknown"} do-not-store list`, 2);
  }

  const scenarioIds = new Set((template.smokeScenarios || []).map((scenario) => scenario.id));
  requireArray(template.smokeScenarios, "libTV worker smoke scenarios", 9);
  for (const id of [
    "worker-health-ready",
    "unauthorized-access-rejected",
    "submit-dry-run-task",
    "idempotent-resubmit",
    "poll-status-to-terminal",
    "cancel-running-or-queued-task",
    "failure-code-mapping",
    "result-import-to-api",
    "worker-restart-resume"
  ]) {
    if (scenarioIds.has(id)) pass(`Worker smoke scenario exists: ${id}.`);
    else fail(`Worker smoke scenario is missing: ${id}.`);
  }
  for (const scenario of template.smokeScenarios || []) {
    const label = scenario.id || "unknown-scenario";
    requireIncludes(scenario.status, "waiting-worker-target", `Worker smoke scenario ${label} remains waiting for worker target.`);
    requireValue(scenario.request, `Worker smoke scenario ${label} request`);
    requireArray(scenario.expected, `Worker smoke scenario ${label} expected results`, 2);
    requireArray(scenario.evidenceRequired, `Worker smoke scenario ${label} evidence requirements`, 2);
  }

  const sample = template.sampleEvidenceRecord || {};
  if (sample.schemaVersion === "libtv-worker-smoke-result-v1") pass("Sample libTV worker smoke record schema is present.");
  else fail("Sample libTV worker smoke record schemaVersion should be libtv-worker-smoke-result-v1.");
  requireIncludes(sample.targetOrigin, "https://www.zkraiflow.top", "Sample libTV worker smoke record uses public origin.");
  requireIncludes(sample.apiOrigin, "https://www.zkraiflow.top", "Sample libTV worker smoke record uses public API origin.");
  requireArray(sample.verifiedScenarios, "Sample libTV worker verified scenarios", 9);
  requireArray(sample.evidenceFiles, "Sample libTV worker evidence files", 1);
  requireArray(sample.followUpBlockers, "Sample libTV worker follow-up blockers", 3);
  requireValue(sample.runtimePackage?.type, "Sample libTV worker runtime package type");
  requireValue(sample.storage?.restartEvidenceFile, "Sample libTV worker storage restart evidence link");

  requireIncludes(template.evidenceRules?.fileNaming, "store/evidence/libtv-worker/", "libTV worker evidence file naming points to libtv-worker folder.");
  requireArray(template.evidenceRules?.allowedInRepository, "libTV worker allowed repository evidence", 4);
  requireArray(template.evidenceRules?.doNotStore, "libTV worker do-not-store list", 7);
  requireArray(template.closeoutGates, "libTV worker closeout gates", 7);

  for (const linkedFile of template.linkedFiles || []) {
    if (await fileExists(linkedFile)) pass(`libTV worker smoke template linked file exists: ${linkedFile}.`);
    else fail(`libTV worker smoke template linked file is missing: ${linkedFile}.`);
  }
}

const workerService = (workerPlan?.workstreams || []).find((workstream) => workstream.id === "libtv-worker-service");
const workerTemplateLink = workerService?.workerSmokeEvidenceTemplate || {};
if (workerTemplateLink.status === "template-ready-waiting-worker-target") pass("Worker/storage plan links worker smoke template status.");
else fail("Worker/storage libtv-worker-service workstream should link workerSmokeEvidenceTemplate.status as template-ready-waiting-worker-target.");
for (const [key, expected] of [
  ["templateFile", templatePath],
  ["runbook", docPath],
  ["checkScript", scriptPath],
  ["checkCommand", command]
]) {
  if (workerTemplateLink[key] === expected) pass(`Worker/storage worker smoke template ${key} links ${expected}.`);
  else fail(`Worker/storage worker smoke template ${key} should be ${expected}.`);
}
if ((workerService?.verificationCommands || []).includes(command)) pass("Worker/storage libtv-worker-service workstream verifies the worker smoke template.");
else fail(`Worker/storage libtv-worker-service workstream should include ${command}.`);
if ((workerService?.evidenceFiles || []).includes(templatePath)) pass("Worker/storage libtv-worker-service workstream links the worker smoke template.");
else fail(`Worker/storage libtv-worker-service workstream should link ${templatePath}.`);

const cloudWorkerService = (cloudPlan?.workstreams || []).find((workstream) => workstream.id === "libtv-worker-service");
const cloudTemplateLink = cloudWorkerService?.workerSmokeEvidenceTemplate || {};
if (cloudTemplateLink.status === "template-ready-waiting-worker-target") pass("Cloud deployment plan links worker smoke template status.");
else fail("Cloud deployment libtv-worker-service workstream should link workerSmokeEvidenceTemplate.status as template-ready-waiting-worker-target.");
for (const [key, expected] of [
  ["templateFile", templatePath],
  ["runbook", docPath],
  ["checkScript", scriptPath],
  ["checkCommand", command]
]) {
  if (cloudTemplateLink[key] === expected) pass(`Cloud deployment worker smoke template ${key} links ${expected}.`);
  else fail(`Cloud deployment worker smoke template ${key} should be ${expected}.`);
}

if (packageScripts[commandName]) pass(`package.json exposes npm run ${commandName}.`);
else fail(`package.json should expose npm run ${commandName}.`);

if (await fileExists(docPath)) pass("libTV worker smoke runbook exists.");
else fail(`libTV worker smoke runbook is missing: ${docPath}.`);

if (docText) {
  for (const marker of [
    "https://www.zkraiflow.top",
    "npm run cloud:worker-smoke-template",
    "LIBTV_WORKER_TOKEN",
    "dry-run",
    "不要放进仓库",
    "健康检查",
    "结果导入",
    "失败映射"
  ]) {
    requireIncludes(docText, marker, `libTV worker smoke runbook includes ${marker}`);
  }
}

console.log("libTV worker smoke evidence template check");
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
