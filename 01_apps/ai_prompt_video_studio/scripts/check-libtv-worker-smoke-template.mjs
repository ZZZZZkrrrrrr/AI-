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
    || /token\s*[:=]\s*(?!<LIBTV_WORKER_TOKEN>|hosting secret|hosting-secret|redacted)/i.test(text)
    || /password\s*[:=]\s*(?!TODO_|<secret>|password-manager|redacted)/i.test(text)
    || /secret\s*[:=]\s*(?!TODO_|<secret>|hosting-secret|hosting secret|redacted)/i.test(text);
}

const templatePath = "deploy/libtv-worker-smoke-evidence-template.json";
const docPath = "00_docs/LIBTV_WORKER_SMOKE_EVIDENCE_TEMPLATE_2026-06-10.md";
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
  requireIncludes(template.workerVisibility, "private", "libTV worker smoke template keeps worker private.");
  requireValue(template.purpose, "libTV worker smoke template purpose");

  if (looksSecretLike(JSON.stringify(template))) fail("libTV worker smoke template appears to contain secret-like material.");
  else pass("libTV worker smoke template does not contain obvious secret-like material.");

  requireArray(template.officialReferences, "libTV worker official references", 4);
  for (const reference of template.officialReferences || []) {
    if (reference.name && /^https:\/\//i.test(String(reference.url || ""))) pass(`Official reference is HTTPS: ${reference.name}.`);
    else fail("Official references must include name and HTTPS URL.");
    requireValue(reference.whyItMatters, `Official reference ${reference.name || "unknown"} rationale`);
  }

  requireArray(template.requiredInputsOutsideRepository, "Worker outside-repository inputs", 5);
  for (const input of template.requiredInputsOutsideRepository || []) {
    requireValue(input.id, "Worker outside-repository input id");
    requireIncludes(input.status, "waiting", `Worker outside-repository input ${input.id || "unknown"} waits for external input.`);
    requireValue(input.description, `Worker outside-repository input ${input.id || "unknown"} description`);
  }

  const scenarioIds = new Set((template.smokeScenarios || []).map((scenario) => scenario.id));
  requireArray(template.smokeScenarios, "Worker smoke scenarios", 9);
  for (const id of [
    "worker-health-ready",
    "worker-auth-rejects-browser",
    "submit-dry-run-task",
    "idempotent-resubmit",
    "poll-status-until-terminal",
    "cancel-running-task",
    "failure-code-mapping",
    "result-import",
    "worker-restart-recovery"
  ]) {
    if (scenarioIds.has(id)) pass(`Worker smoke scenario exists: ${id}.`);
    else fail(`Worker smoke scenario is missing: ${id}.`);
  }
  for (const scenario of template.smokeScenarios || []) {
    const label = scenario.id || "unknown-scenario";
    requireValue(scenario.endpoint, `Worker smoke scenario ${label} endpoint`);
    requireArray(scenario.expectedEvidence, `Worker smoke scenario ${label} expected evidence`, 3);
    if (scenario.priority === "P0" && String(scenario.status || "").includes("waiting")) {
      warn(`${label} remains ${scenario.status}; keep real generation gated.`);
    } else {
      pass(`Worker smoke scenario ${label} status is ${scenario.status || "documented"}.`);
    }
  }

  const sample = template.sampleEvidenceRecord || {};
  if (sample.schemaVersion === "libtv-worker-smoke-result-v1") pass("Sample worker smoke result schema is present.");
  else fail("Sample worker smoke result schemaVersion should be libtv-worker-smoke-result-v1.");
  requireIncludes(sample.targetOrigin, "https://www.zkraiflow.top", "Sample worker smoke result uses public origin.");
  requireArray(sample.verifiedScenarios, "Sample worker smoke verified scenarios", 8);
  requireArray(sample.linkedEvidence, "Sample worker smoke linked evidence", 2);
  requireArray(sample.followUpBlockers, "Sample worker smoke follow-up blockers", 3);

  requireIncludes(template.evidenceRules?.fileNaming, "store/evidence/libtv-worker/", "Worker smoke evidence file naming points to libtv-worker evidence folder.");
  requireArray(template.evidenceRules?.allowedInRepository, "Worker smoke allowed repository evidence", 5);
  requireArray(template.evidenceRules?.doNotStore, "Worker smoke do-not-store list", 6);
  requireArray(template.closeoutGates, "Worker smoke closeout gates", 8);

  for (const linkedFile of template.linkedFiles || []) {
    if (await fileExists(linkedFile)) pass(`Worker smoke linked file exists: ${linkedFile}.`);
    else fail(`Worker smoke linked file is missing: ${linkedFile}.`);
  }
}

const workerSmokeTemplate = (workerPlan?.workstreams || []).find((workstream) => workstream.id === "libtv-worker-service")?.workerSmokeEvidenceTemplate || {};
if (workerSmokeTemplate.status === "template-ready-waiting-worker-target") pass("Worker/storage plan links worker smoke evidence template status.");
else fail("Worker/storage libtv-worker-service workstream should link workerSmokeEvidenceTemplate.status as template-ready-waiting-worker-target.");
for (const [key, expected] of [
  ["templateFile", "deploy/libtv-worker-smoke-evidence-template.json"],
  ["runbook", "00_docs/LIBTV_WORKER_SMOKE_EVIDENCE_TEMPLATE_2026-06-10.md"],
  ["checkScript", "scripts/check-libtv-worker-smoke-template.mjs"],
  ["checkCommand", "npm run cloud:worker-smoke-template"]
]) {
  if (workerSmokeTemplate[key] === expected) pass(`Worker/storage plan worker smoke ${key} links ${expected}.`);
  else fail(`Worker/storage plan worker smoke ${key} should be ${expected}.`);
}

const cloudWorkerTemplate = (cloudPlan?.workstreams || []).find((workstream) => workstream.id === "libtv-worker-service")?.workerSmokeEvidenceTemplate || {};
if (cloudWorkerTemplate.status === "template-ready-waiting-worker-target") pass("Cloud deployment plan links worker smoke evidence template status.");
else fail("Cloud deployment libtv-worker-service workstream should link workerSmokeEvidenceTemplate.status as template-ready-waiting-worker-target.");

if (packageScripts["cloud:worker-smoke-template"]) pass("package.json exposes npm run cloud:worker-smoke-template.");
else fail("package.json should expose npm run cloud:worker-smoke-template.");

if (await fileExists(docPath)) pass("libTV worker smoke runbook exists.");
else fail(`libTV worker smoke runbook is missing: ${docPath}.`);

if (docText) {
  for (const marker of [
    "https://www.zkraiflow.top",
    "npm run cloud:worker-smoke-template",
    "LIBTV_WORKER_TOKEN",
    "不要放进仓库",
    "health",
    "idempotency",
    "resultRefs"
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
