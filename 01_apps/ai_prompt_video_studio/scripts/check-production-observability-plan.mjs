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

function commandScriptName(command) {
  const match = /npm run ([\w:-]+)/.exec(String(command || ""));
  return match?.[1] || "";
}

const plan = await readJson("deploy/production-observability-rollback-plan.json");
const packageJson = await readJson("package.json");
const packageScripts = packageJson?.scripts || {};
const blockerRegister = await readJson("store/release-blockers-register.json");
const cloudPlan = await readJson("deploy/cloud-deployment-action-plan.json");
const operatorInputs = await readJson("store/operator-inputs-register.json");
const smokeScript = await readText("scripts/production-smoke-test.mjs");
const serverSource = await readText("server.js");
const runbookText = await readText("deploy/production-release-runbook.md");
const docText = await readText("00_docs/PRODUCTION_OBSERVABILITY_ROLLBACK_2026-06-10.md");

if (plan) {
  if (plan.schemaVersion === "production-observability-rollback-plan-v1") pass("Production observability plan schema version is current.");
  else fail("Production observability plan schemaVersion must be production-observability-rollback-plan-v1.");

  requireValue(plan.updatedAt, "Production observability plan updatedAt");
  requireIncludes(plan.status, "pending-hosting-observability-evidence", "Production observability plan keeps hosting evidence unresolved.");
  requireIncludes(plan.publicOrigin, "https://www.zkraiflow.top", "Production observability plan uses the public production domain.");
  requireArray(plan.releasePrinciples, "Release principles", 5);

  const healthSurfaces = Array.isArray(plan.healthSurfaces) ? plan.healthSurfaces : [];
  requireArray(healthSurfaces, "Health surfaces", 4);
  const healthSurfaceIds = new Set(healthSurfaces.map((item) => item.id));
  for (const id of ["api-healthz", "public-pages", "authenticated-smoke", "worker-and-storage"]) {
    if (healthSurfaceIds.has(id)) pass(`Health surface exists: ${id}.`);
    else fail(`Health surface is missing: ${id}.`);
  }
  for (const surface of healthSurfaces) {
    const label = surface.id || "unnamed-surface";
    requireValue(surface.url, `Health surface ${label} URL`);
    requireValue(surface.currentEvidence, `Health surface ${label} current evidence`);
    requireArray(surface.mustShow, `Health surface ${label} must-show list`, 3);
    requireArray(surface.mustNotShow, `Health surface ${label} must-not-show list`, 3);
  }

  const monitoringSignals = Array.isArray(plan.monitoringSignals) ? plan.monitoringSignals : [];
  requireArray(monitoringSignals, "Monitoring signals", 6);
  const monitoringIds = new Set(monitoringSignals.map((item) => item.id));
  for (const id of ["availability", "authentication", "creation-workflow", "storage", "worker", "privacy-ops"]) {
    if (monitoringIds.has(id)) pass(`Monitoring signal exists: ${id}.`);
    else fail(`Monitoring signal is missing: ${id}.`);
  }
  for (const signal of monitoringSignals) {
    const label = signal.id || "unnamed-signal";
    requireValue(signal.owner, `Monitoring signal ${label} owner`);
    requireValue(signal.frequency, `Monitoring signal ${label} frequency`);
    requireArray(signal.signals, `Monitoring signal ${label} signal list`, 3);
    requireValue(signal.evidenceCommand, `Monitoring signal ${label} evidence command`);
  }

  const playbooks = Array.isArray(plan.rollbackPlaybooks) ? plan.rollbackPlaybooks : [];
  requireArray(playbooks, "Rollback playbooks", 5);
  const playbookIds = new Set(playbooks.map((item) => item.id));
  for (const id of [
    "web-pwa-blank-screen",
    "auth-cookie-cors-failure",
    "worker-or-provider-failure",
    "storage-persistence-failure",
    "privacy-or-deletion-flow-failure"
  ]) {
    if (playbookIds.has(id)) pass(`Rollback playbook exists: ${id}.`);
    else fail(`Rollback playbook is missing: ${id}.`);
  }
  for (const playbook of playbooks) {
    const label = playbook.id || "unnamed-playbook";
    requireValue(playbook.trigger, `Rollback playbook ${label} trigger`);
    requireArray(playbook.rollbackActions, `Rollback playbook ${label} actions`, 3);
    requireArray(playbook.verification, `Rollback playbook ${label} verification`, 2);
  }

  requireArray(plan.logSafetyRules, "Log safety rules", 6);
  const logRules = plan.logSafetyRules.join("\n");
  for (const marker of ["API keys", "passwords", "session cookies", "customer assets", "Authorization", "Cookie"]) {
    requireIncludes(logRules, marker, `Log safety rules cover ${marker}.`);
  }

  requireArray(plan.incidentResponse, "Incident response levels", 3);
  for (const item of plan.incidentResponse || []) {
    const label = item.severity || "unnamed-severity";
    requireArray(item.examples, `Incident ${label} examples`, 2);
    requireArray(item.response, `Incident ${label} response actions`, 2);
  }

  requireArray(plan.releaseGates, "Observability release gates", 4);
  for (const gate of plan.releaseGates || []) {
    const label = gate.id || "unnamed-gate";
    requireIncludes(gate.status, "blocked", `Observability gate ${label} stays blocked until real evidence.`);
    requireArray(gate.requiredEvidence, `Observability gate ${label} required evidence`, 3);
  }

  requireArray(plan.verificationCommands, "Observability verification commands", 7);
  for (const command of plan.verificationCommands || []) {
    const script = commandScriptName(command);
    if (!script) continue;
    if (packageScripts[script]) pass(`Observability verification command exists: npm run ${script}.`);
    else fail(`Observability verification command references missing npm script: npm run ${script}.`);
  }

  for (const evidenceFile of plan.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`Observability evidence exists: ${evidenceFile}.`);
    else fail(`Observability evidence file is missing: ${evidenceFile}.`);
  }

  requireArray(plan.doNotCommit, "Observability do-not-commit list", 6);
}

if (serverSource.includes('"/api/healthz"') && serverSource.includes('status: "ready"') && serverSource.includes("authRequired")) {
  pass("Server exposes a non-secret public health endpoint.");
} else {
  fail("Server should expose /api/healthz with ready status and authRequired summary.");
}

if (smokeScript.includes("/api/healthz") && smokeScript.includes("SMOKE_EXPECT_AUTH_REQUIRED") && smokeScript.includes("SMOKE_USERNAME") && smokeScript.includes("SMOKE_PASSWORD")) {
  pass("Production smoke script covers health and authenticated checks.");
} else {
  fail("Production smoke script should cover health and authenticated checks.");
}

for (const marker of ["LIBTV_DEFAULT_DRY_RUN", "BATCH_MAX_WORKERS", "RUN_STORAGE_DIR", "npm run cloud:smoke", "回滚", "日志"]) {
  requireIncludes(runbookText, marker, `Production runbook includes ${marker}.`);
}

const opsBlocker = (blockerRegister?.blockers || []).find((item) => item.id === "production-observability-rollback");
if (opsBlocker) {
  pass("Release blocker register includes production-observability-rollback.");
  if ((opsBlocker.verificationCommands || []).includes("npm run production:ops-plan")) pass("Observability blocker references production:ops-plan.");
  else fail("Observability blocker should reference npm run production:ops-plan.");
  for (const evidence of [
    "deploy/production-observability-rollback-plan.json",
    "00_docs/PRODUCTION_OBSERVABILITY_ROLLBACK_2026-06-10.md",
    "scripts/check-production-observability-plan.mjs"
  ]) {
    if ((opsBlocker.evidenceFiles || []).includes(evidence)) pass(`Observability blocker references evidence: ${evidence}.`);
    else fail(`Observability blocker is missing evidence reference: ${evidence}.`);
  }
} else {
  fail("Release blocker register is missing production-observability-rollback.");
}

const observabilityWorkstream = (cloudPlan?.workstreams || []).find((item) => item.id === "observability-and-rollback");
if (observabilityWorkstream) {
  pass("Cloud deployment plan includes observability-and-rollback.");
  const text = JSON.stringify(observabilityWorkstream);
  requireIncludes(text, "production:ops-plan", "Cloud observability workstream references production:ops-plan.");
  requireIncludes(text, "deploy/production-observability-rollback-plan.json", "Cloud observability workstream references observability handoff.");
} else {
  fail("Cloud deployment plan is missing observability-and-rollback.");
}

const runtimeGroup = (operatorInputs?.inputGroups || []).find((group) => group.id === "production-runtime");
if (runtimeGroup) {
  pass("Operator inputs include production-runtime group.");
  const text = JSON.stringify(runtimeGroup);
  requireIncludes(text, "persistentStorage", "Production runtime inputs cover persistent storage.");
  requireIncludes(text, "libtvWorker", "Production runtime inputs cover libTV worker.");
} else {
  fail("Operator inputs are missing production-runtime group.");
}

if (docText) {
  for (const marker of [
    "生产监控",
    "https://www.zkraiflow.top",
    "npm run production:ops-plan",
    "LIBTV_DEFAULT_DRY_RUN",
    "BATCH_MAX_WORKERS",
    "RUN_STORAGE_DIR",
    "日志红线",
    "回滚"
  ]) {
    requireIncludes(docText, marker, `Production observability runbook includes ${marker}`);
  }
} else {
  fail("Production observability runbook is missing: 00_docs/PRODUCTION_OBSERVABILITY_ROLLBACK_2026-06-10.md.");
}

if (!packageScripts["production:ops-plan"]) fail("package.json should define npm run production:ops-plan.");

console.log("Production observability/rollback plan check");
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
