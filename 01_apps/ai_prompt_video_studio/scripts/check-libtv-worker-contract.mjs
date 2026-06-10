import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = findWorkspaceRoot(appRoot);
const passes = [];
const failures = [];
const warnings = [];

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

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function requireValue(value, label) {
  if (value !== undefined && value !== null && String(value).trim()) {
    pass(`${label} is present.`);
    return true;
  }
  fail(`${label} is missing.`);
  return false;
}

function requireIncludes(source, marker, label) {
  if (String(source || "").includes(marker)) {
    pass(label);
    return true;
  }
  fail(`${label}: missing marker "${marker}".`);
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

function requireSetIncludes(values, requiredValues, label) {
  const set = new Set(Array.isArray(values) ? values : []);
  for (const value of requiredValues) {
    if (set.has(value)) pass(`${label} includes ${value}.`);
    else fail(`${label} is missing ${value}.`);
  }
}

function requireCommandExists(command, packageScripts, label) {
  const match = /^npm run ([\w:-]+)/.exec(String(command || ""));
  if (!match) {
    warn(`${label} uses a non-npm command: ${command}`);
    return;
  }
  if (packageScripts[match[1]]) pass(`${label} command exists: ${command}.`);
  else fail(`${label} references a missing package script: ${command}.`);
}

const contract = await readJson("deploy/libtv-worker-api-contract.json");
const workerPlanText = await readText("deploy/libtv-worker-storage-plan.json");
const workerPlan = workerPlanText ? JSON.parse(workerPlanText) : null;
const cloudPlanText = await readText("deploy/cloud-deployment-action-plan.json");
const cloudPlan = cloudPlanText ? JSON.parse(cloudPlanText) : null;
const packageJson = await readJson("package.json");
const packageScripts = packageJson?.scripts || {};
const contractDoc = await readText("00_docs/LIBTV_WORKER_API_CONTRACT_2026-06-10.md");
const runbook = await readText("deploy/production-release-runbook.md");

if (contract) {
  if (contract.schemaVersion === "libtv-worker-api-contract-v1") pass("Worker API contract schema version is current.");
  else fail("Worker API contract schemaVersion must be libtv-worker-api-contract-v1.");

  requireValue(contract.updatedAt, "Worker API contract updatedAt");
  requireIncludes(contract.targetOrigin, "https://www.zkraiflow.top", "Worker contract targets the public production origin.");
  requireIncludes(contract.visibility, "private", "Worker contract is private to the API service.");
  requireValue(contract.objective, "Worker API contract objective");

  requireArray(contract.security?.allowedCallers, "Worker contract allowed callers", 1);
  requireIncludes(contract.security?.browserAccess, "forbidden", "Worker contract forbids browser access.");
  requireIncludes(contract.security?.auth, "service-token", "Worker contract requires service-token authentication.");
  requireIncludes(contract.security?.tokenFormat, "Bearer", "Worker contract documents bearer token format.");
  requireArray(contract.security?.secretRules, "Worker contract secret rules", 3);

  requireSetIncludes(contract.statusEnum, ["accepted", "queued", "running", "succeeded", "failed", "cancelled"], "Worker status enum");
  requireArray(contract.errorCodes, "Worker error code map", 6);
  for (const errorCode of contract.errorCodes || []) {
    const label = `Worker error code ${errorCode.code || "unknown"}`;
    requireValue(errorCode.code, `${label} code`);
    if (typeof errorCode.userVisible === "boolean") pass(`${label} has userVisible flag.`);
    else fail(`${label} must declare userVisible.`);
    requireValue(errorCode.meaning, `${label} meaning`);
  }

  requireIncludes(contract.idempotency?.key, "taskId", "Worker idempotency uses taskId.");
  requireIncludes(contract.idempotency?.header, "idempotency-key", "Worker idempotency header is documented.");
  if (Number(contract.timeouts?.pilotMaxConcurrentTasks || 0) > 0 && Number(contract.timeouts?.pilotMaxConcurrentTasks || 0) <= 5) {
    pass("Worker pilot concurrency is conservative.");
  } else {
    fail("Worker pilot concurrency should be between 1 and 5.");
  }
  requireArray(contract.storageContract?.requiredResultFields, "Worker storage result fields", 5);

  const endpoints = Array.isArray(contract.endpoints) ? contract.endpoints : [];
  const endpointIds = new Set(endpoints.map((endpoint) => endpoint.id));
  for (const endpointId of ["worker-health", "submit-generation-task", "read-worker-task-status", "cancel-worker-task"]) {
    if (endpointIds.has(endpointId)) pass(`Worker contract includes ${endpointId}.`);
    else fail(`Worker contract is missing ${endpointId}.`);
  }

  for (const endpoint of endpoints) {
    const label = `Worker endpoint ${endpoint.id || endpoint.path || "unknown"}`;
    requireValue(endpoint.method, `${label} method`);
    requireValue(endpoint.path, `${label} path`);
    requireValue(endpoint.auth, `${label} auth`);
    requireArray(endpoint.responseFields, `${label} response fields`, 3);
    if (Number(endpoint.timeoutMs || 0) > 0) pass(`${label} has timeout.`);
    else fail(`${label} must declare timeoutMs.`);
    if (endpoint.id === "submit-generation-task") {
      requireSetIncludes(endpoint.requiredRequestFields, [
        "taskId",
        "runDir",
        "productAssetRefs",
        "promptPackage",
        "videoMode",
        "dryRun",
        "operatorUserId"
      ], `${label} required request fields`);
      requireValue(endpoint.statusCodes?.["202"], `${label} 202 status code`);
      requireValue(endpoint.statusCodes?.["409"], `${label} 409 conflict status code`);
    }
  }

  requireArray(contract.apiIntegrationRules, "Worker API integration rules", 4);
  requireArray(contract.acceptanceChecks, "Worker contract acceptance checks", 4);
  for (const check of contract.acceptanceChecks || []) {
    requireValue(check.id, "Worker contract acceptance check id");
    requireValue(check.evidence, `Worker contract acceptance check ${check.id || "unknown"} evidence`);
    requireCommandExists(check.command, packageScripts, `Worker contract acceptance check ${check.id || "unknown"}`);
  }
}

if (workerPlan) {
  if (workerPlan.workerApiContract === "deploy/libtv-worker-api-contract.json") {
    pass("Worker/storage plan references the worker API contract.");
  } else {
    fail("Worker/storage plan must reference deploy/libtv-worker-api-contract.json as workerApiContract.");
  }
  const contractEvidence = JSON.stringify(workerPlan);
  requireIncludes(contractEvidence, "cloud:worker-contract", "Worker/storage plan includes cloud:worker-contract verification.");
}

if (cloudPlan) {
  const workerStream = (cloudPlan.workstreams || []).find((item) => item.id === "libtv-worker-service");
  if (workerStream) {
    pass("Cloud deployment action plan includes libtv-worker-service.");
    requireIncludes(JSON.stringify(workerStream), "deploy/libtv-worker-api-contract.json", "Cloud worker stream references the API contract.");
    if (String(workerStream.status || "").includes("contract-ready")) pass("Cloud worker stream is contract-ready.");
    else fail("Cloud worker stream should be contract-ready after adding the API contract.");
  } else {
    fail("Cloud deployment action plan is missing libtv-worker-service.");
  }
}

if (contractDoc) {
  for (const marker of [
    "deploy/libtv-worker-api-contract.json",
    "cloud:worker-contract",
    "CANCELLED_BY_USER",
    "idempotency-key",
    "LIBTV_WORKER_TOKEN"
  ]) {
    requireIncludes(contractDoc, marker, `Worker API contract document includes ${marker}`);
  }
} else {
  fail("Worker API contract document is missing.");
}

if (runbook) {
  requireIncludes(runbook, "deploy/libtv-worker-api-contract.json", "Production runbook references the worker API contract.");
  requireIncludes(runbook, "npm run cloud:worker-contract", "Production runbook references the worker contract check.");
}

for (const file of [
  "deploy/libtv-worker-api-contract.json",
  "deploy/libtv-worker-storage-plan.json",
  "deploy/cloud-deployment-action-plan.json",
  "00_docs/LIBTV_WORKER_API_CONTRACT_2026-06-10.md",
  "00_docs/LIBTV_WORKER_STORAGE_MIGRATION_2026-06-10.md",
  "deploy/production-release-runbook.md"
]) {
  if (await fileExists(file)) pass(`Evidence file exists: ${file}.`);
  else fail(`Evidence file is missing: ${file}.`);
}

if (!packageScripts["cloud:worker-contract"]) {
  fail("package.json should define npm run cloud:worker-contract.");
}

console.log("libTV worker API contract check");
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
