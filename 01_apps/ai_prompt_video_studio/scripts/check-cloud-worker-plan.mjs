import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
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

function requireValue(value, label) {
  if (value !== undefined && value !== null && String(value).trim()) {
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
  if (String(source || "").includes(marker)) {
    pass(label);
    return;
  }
  fail(`${label}: missing marker "${marker}".`);
}

const plan = await readJson("deploy/libtv-worker-storage-plan.json");
const packageJson = await readJson("package.json");
const packageScripts = packageJson?.scripts || {};
const docText = await readText("00_docs/LIBTV_WORKER_STORAGE_MIGRATION_2026-06-10.md");

if (plan) {
  if (plan.schemaVersion === "libtv-worker-storage-plan-v1") {
    pass("Worker/storage plan schema version is current.");
  } else {
    fail("Worker/storage plan schemaVersion must be libtv-worker-storage-plan-v1.");
  }

  requireValue(plan.targetOrigin, "Target origin");
  requireIncludes(plan.targetOrigin, "https://www.zkraiflow.top", "Target origin uses the public production domain.");
  requireIncludes(plan.workerApiContract, "deploy/libtv-worker-api-contract.json", "Worker/storage plan links the worker API contract.");
  requireValue(plan.recommendedFirstProductionMode, "Recommended first production mode");
  requireArray(plan.nonGoalsForFirstRelease, "First-release non-goals", 3);

  for (const key of ["publicClient", "apiService", "workerService", "storage", "database", "network"]) {
    requireValue(plan.topology?.[key], `Topology ${key}`);
  }

  const requiredEnvNames = new Set((plan.requiredEnvironment || []).map((item) => item.name));
  for (const envName of [
    "RUN_STORAGE_DIR",
    "LIBTV_BRIDGE_URL",
    "LIBTV_WORKER_TOKEN",
    "LIBTV_REGISTER_SCRIPT",
    "LIBTV_DB_PATH",
    "LIBTV_DEFAULT_DRY_RUN",
    "SMOKE_BASE_URL"
  ]) {
    if (requiredEnvNames.has(envName)) pass(`Required environment includes ${envName}.`);
    else fail(`Required environment is missing ${envName}.`);
  }

  const contractIds = new Set((plan.workerContracts || []).map((item) => item.id));
  for (const contractId of ["worker-health", "submit-generation-task", "read-worker-task-status", "cancel-worker-task"]) {
    if (contractIds.has(contractId)) pass(`Worker contract includes ${contractId}.`);
    else fail(`Worker contract is missing ${contractId}.`);
  }

  for (const contract of plan.workerContracts || []) {
    const label = contract.id || contract.path || "unnamed-contract";
    requireValue(contract.method, `Worker contract ${label} method`);
    requireValue(contract.path, `Worker contract ${label} path`);
    requireValue(contract.auth, `Worker contract ${label} auth`);
    requireArray(contract.responseFields, `Worker contract ${label} response fields`, 2);
  }

  const workstreams = Array.isArray(plan.workstreams) ? plan.workstreams : [];
  const workstreamIds = new Set(workstreams.map((item) => item.id));
  for (const id of [
    "persistent-storage",
    "libtv-worker-service",
    "private-network-auth",
    "queue-retry-limits",
    "smoke-and-rollback"
  ]) {
    if (workstreamIds.has(id)) pass(`Workstream includes ${id}.`);
    else fail(`Workstream is missing ${id}.`);
  }

  for (const item of workstreams) {
    const label = item.id || "unnamed-workstream";
    requireValue(item.owner, `Workstream ${label} owner`);
    requireValue(item.status, `Workstream ${label} status`);
    requireValue(item.objective, `Workstream ${label} objective`);
    requireArray(item.ownerInputs, `Workstream ${label} owner inputs`, 2);
    requireArray(item.implementationSteps, `Workstream ${label} implementation steps`, 3);
    requireArray(item.acceptanceCriteria, `Workstream ${label} acceptance criteria`, 3);
    requireArray(item.verificationCommands, `Workstream ${label} verification commands`, 1);

    for (const command of item.verificationCommands || []) {
      const match = /^npm run ([\w:-]+)/.exec(command);
      if (!match) continue;
      if (packageScripts[match[1]]) pass(`Workstream ${label} verification command exists: ${command}.`);
      else fail(`Workstream ${label} references missing npm script: ${command}.`);
    }

    for (const evidenceFile of item.evidenceFiles || []) {
      if (await fileExists(evidenceFile)) pass(`Workstream ${label} evidence exists: ${evidenceFile}.`);
      else fail(`Workstream ${label} evidence file is missing: ${evidenceFile}.`);
    }
  }

  const persistentStorage = workstreams.find((item) => item.id === "persistent-storage");
  if ((persistentStorage?.verificationCommands || []).includes("npm run storage:restart-template")) {
    pass("Persistent-storage workstream verifies the storage restart template.");
  } else {
    fail("Persistent-storage workstream should include npm run storage:restart-template.");
  }
  if ((persistentStorage?.evidenceFiles || []).includes("deploy/persistent-storage-restart-evidence-template.json")) {
    pass("Persistent-storage workstream links the storage restart evidence template.");
  } else {
    fail("Persistent-storage workstream should link deploy/persistent-storage-restart-evidence-template.json.");
  }

  const libtvWorkerService = workstreams.find((item) => item.id === "libtv-worker-service");
  const workerSmokeTemplate = libtvWorkerService?.workerSmokeEvidenceTemplate || {};
  if (workerSmokeTemplate.status === "template-ready-waiting-worker-target") {
    pass("libTV worker workstream links the worker smoke evidence template status.");
  } else {
    fail("libTV worker workstream should link workerSmokeEvidenceTemplate.status as template-ready-waiting-worker-target.");
  }
  for (const [key, expected] of [
    ["templateFile", "deploy/libtv-worker-smoke-evidence-template.json"],
    ["runbook", "00_docs/LIBTV_WORKER_SMOKE_EVIDENCE_TEMPLATE_2026-06-10.md"],
    ["checkScript", "scripts/check-libtv-worker-smoke-evidence-template.mjs"],
    ["checkCommand", "npm run cloud:worker-smoke-template"]
  ]) {
    if (workerSmokeTemplate[key] === expected) pass(`libTV worker smoke template ${key} links ${expected}.`);
    else fail(`libTV worker smoke template ${key} should be ${expected}.`);
  }
  if ((libtvWorkerService?.verificationCommands || []).includes("npm run cloud:worker-smoke-template")) {
    pass("libTV worker workstream verifies the worker smoke template.");
  } else {
    fail("libTV worker workstream should include npm run cloud:worker-smoke-template.");
  }
  if ((libtvWorkerService?.evidenceFiles || []).includes("deploy/libtv-worker-smoke-evidence-template.json")) {
    pass("libTV worker workstream links the worker smoke evidence template.");
  } else {
    fail("libTV worker workstream should link deploy/libtv-worker-smoke-evidence-template.json.");
  }

  requireArray(plan.releaseGates, "Release gates", 3);
  for (const gate of plan.releaseGates || []) {
    const label = gate.id || "unnamed-gate";
    requireValue(gate.status, `Release gate ${label} status`);
    requireArray(gate.requiredEvidence, `Release gate ${label} required evidence`, 2);
  }
}

if (docText) {
  for (const marker of [
    "libTV Worker 与持久化存储迁移方案",
    "https://www.zkraiflow.top",
    "RUN_STORAGE_DIR",
    "LIBTV_BRIDGE_URL",
    "Worker 接口契约",
    "npm run cloud:worker-plan"
  ]) {
    requireIncludes(docText, marker, `Migration document includes ${marker}`);
  }
} else {
  fail("Migration document is missing: 00_docs/LIBTV_WORKER_STORAGE_MIGRATION_2026-06-10.md.");
}

if (!packageScripts["cloud:worker-plan"]) {
  fail("package.json should define npm run cloud:worker-plan.");
}

if (!packageScripts["cloud:worker-contract"]) {
  fail("package.json should define npm run cloud:worker-contract.");
}

if (!packageScripts["storage:restart-template"]) {
  fail("package.json should define npm run storage:restart-template.");
}

console.log("Cloud worker/storage migration plan check");
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
