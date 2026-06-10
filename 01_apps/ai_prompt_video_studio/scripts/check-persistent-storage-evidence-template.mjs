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
    || /cookie\s*[:=]\s*(?!redacted|<redacted>)/i.test(text);
}

const templatePath = "deploy/persistent-storage-restart-evidence-template.json";
const docPath = "00_docs/PERSISTENT_STORAGE_RESTART_EVIDENCE_TEMPLATE_2026-06-10.md";
const template = await readJson(templatePath);
const cloudPlan = await readJson("deploy/cloud-deployment-action-plan.json");
const workerPlan = await readJson("deploy/libtv-worker-storage-plan.json");
const packageJson = await readJson("package.json");
const docText = await readText(docPath);
const packageScripts = packageJson?.scripts || {};

if (template) {
  if (template.schemaVersion === "persistent-storage-restart-evidence-template-v1") pass("Persistent storage evidence template schema version is current.");
  else fail("Persistent storage evidence template schemaVersion must be persistent-storage-restart-evidence-template-v1.");

  requireValue(template.updatedAt, "Persistent storage evidence template updatedAt");
  requireIncludes(template.status, "waiting-production-volume", "Persistent storage template keeps production volume unresolved.");
  requireIncludes(template.targetOrigin, "https://www.zkraiflow.top", "Persistent storage template targets the public production domain.");
  requireValue(template.purpose, "Persistent storage template purpose");

  if (looksSecretLike(JSON.stringify(template))) fail("Persistent storage template appears to contain secret-like material.");
  else pass("Persistent storage template does not contain obvious secret-like material.");

  requireArray(template.officialReferences, "Persistent storage official references", 4);
  for (const reference of template.officialReferences || []) {
    if (reference.name && /^https:\/\//i.test(String(reference.url || ""))) pass(`Official reference is HTTPS: ${reference.name}.`);
    else fail("Official references must include name and HTTPS URL.");
    requireValue(reference.whyItMatters, `Official reference ${reference.name || "unknown"} rationale`);
  }

  requireArray(template.requiredInputsOutsideRepository, "Required outside-repository storage inputs", 2);
  for (const input of template.requiredInputsOutsideRepository || []) {
    requireValue(input.id, "Storage owner input id");
    requireIncludes(input.status, "waiting-owner-input", `Storage owner input ${input.id || "unknown"} waits for owner input.`);
    requireArray(input.acceptedShapes, `Storage owner input ${input.id || "unknown"} accepted shapes`, 2);
    requireArray(input.doNotStore, `Storage owner input ${input.id || "unknown"} do-not-store list`, 2);
  }

  const storageTargetIds = new Set((template.storageTargets || []).map((target) => target.id));
  requireArray(template.storageTargets, "Storage targets", 5);
  for (const id of ["uploads", "generated-runs", "data-exports", "deletion-requests", "review-demo-seed"]) {
    if (storageTargetIds.has(id)) pass(`Storage target exists: ${id}.`);
    else fail(`Storage target is missing: ${id}.`);
  }
  for (const target of template.storageTargets || []) {
    requireValue(target.pathUnderRunStorage, `Storage target ${target.id || "unknown"} path`);
    requireArray(target.mustSurvive, `Storage target ${target.id || "unknown"} survival list`, 2);
    requireValue(target.exampleEvidence, `Storage target ${target.id || "unknown"} example evidence`);
  }

  requireArray(template.restartScenario?.preRestart, "Storage restart pre-restart steps", 4);
  requireArray(template.restartScenario?.restartActions, "Storage restart actions", 2);
  requireArray(template.restartScenario?.postRestart, "Storage restart post-restart checks", 5);

  const artifactIds = new Set((template.requiredSmokeArtifacts || []).map((artifact) => artifact.id));
  requireArray(template.requiredSmokeArtifacts, "Required storage smoke artifacts", 5);
  for (const id of ["run-storage-path-proof", "upload-survives-restart", "result-survives-restart", "privacy-artifacts-survive-restart", "backup-retention-recorded"]) {
    if (artifactIds.has(id)) pass(`Required storage smoke artifact exists: ${id}.`);
    else fail(`Required storage smoke artifact is missing: ${id}.`);
  }
  for (const artifact of template.requiredSmokeArtifacts || []) {
    requireIncludes(artifact.status, "waiting", `Storage smoke artifact ${artifact.id || "unknown"} remains waiting for production evidence.`);
    requireArray(artifact.evidenceRequired, `Storage smoke artifact ${artifact.id || "unknown"} evidence requirements`, 3);
  }

  const sample = template.sampleEvidenceRecord || {};
  if (sample.schemaVersion === "persistent-storage-restart-result-v1") pass("Sample storage restart record schema is present.");
  else fail("Sample storage restart record schemaVersion should be persistent-storage-restart-result-v1.");
  requireIncludes(sample.targetOrigin, "https://www.zkraiflow.top", "Sample storage restart record uses public origin.");
  requireArray(sample.verifiedArtifacts, "Sample storage restart verified artifacts", 5);
  requireArray(sample.evidenceFiles, "Sample storage restart evidence files", 1);
  requireArray(sample.followUpBlockers, "Sample storage restart follow-up blockers", 3);

  requireIncludes(template.evidenceRules?.fileNaming, "store/evidence/storage-restart/", "Storage evidence file naming points to storage-restart folder.");
  requireArray(template.evidenceRules?.allowedInRepository, "Storage allowed repository evidence", 4);
  requireArray(template.evidenceRules?.doNotStore, "Storage do-not-store list", 5);
  requireArray(template.closeoutGates, "Storage closeout gates", 6);

  for (const linkedFile of template.linkedFiles || []) {
    if (await fileExists(linkedFile)) pass(`Storage template linked file exists: ${linkedFile}.`);
    else fail(`Storage template linked file is missing: ${linkedFile}.`);
  }
}

const cloudStorageTemplate = (cloudPlan?.workstreams || []).find((workstream) => workstream.id === "persistent-storage")?.restartEvidenceTemplate || {};
if (cloudStorageTemplate.status === "template-ready-waiting-production-volume") pass("Cloud deployment plan links storage restart evidence template status.");
else fail("Cloud deployment persistent-storage workstream should link restartEvidenceTemplate.status as template-ready-waiting-production-volume.");
for (const [key, expected] of [
  ["templateFile", "deploy/persistent-storage-restart-evidence-template.json"],
  ["runbook", "00_docs/PERSISTENT_STORAGE_RESTART_EVIDENCE_TEMPLATE_2026-06-10.md"],
  ["checkScript", "scripts/check-persistent-storage-evidence-template.mjs"],
  ["checkCommand", "npm run storage:restart-template"]
]) {
  if (cloudStorageTemplate[key] === expected) pass(`Cloud deployment storage template ${key} links ${expected}.`);
  else fail(`Cloud deployment storage template ${key} should be ${expected}.`);
}

const workerStorageWorkstream = (workerPlan?.workstreams || []).find((workstream) => workstream.id === "persistent-storage");
if ((workerStorageWorkstream?.verificationCommands || []).includes("npm run storage:restart-template")) pass("Worker/storage persistent-storage workstream verifies the restart template.");
else fail("Worker/storage persistent-storage workstream should include npm run storage:restart-template.");
if ((workerStorageWorkstream?.evidenceFiles || []).includes("deploy/persistent-storage-restart-evidence-template.json")) pass("Worker/storage persistent-storage workstream links the storage restart template.");
else fail("Worker/storage persistent-storage workstream should link deploy/persistent-storage-restart-evidence-template.json.");

if (packageScripts["storage:restart-template"]) pass("package.json exposes npm run storage:restart-template.");
else fail("package.json should expose npm run storage:restart-template.");

if (await fileExists(docPath)) pass("Persistent storage restart runbook exists.");
else fail(`Persistent storage restart runbook is missing: ${docPath}.`);

if (docText) {
  for (const marker of [
    "https://www.zkraiflow.top",
    "npm run storage:restart-template",
    "RUN_STORAGE_DIR",
    "不要放进仓库",
    "上传",
    "数据导出",
    "删除请求"
  ]) {
    requireIncludes(docText, marker, `Persistent storage runbook includes ${marker}`);
  }
}

console.log("Persistent storage restart evidence template check");
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
