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

function parseEnv(text) {
  const data = new Map();
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data.set(key, value);
  }
  return data;
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

function valueOf(env, key) {
  return String(env.get(key) || "").trim();
}

function parseOriginList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

const handoff = await readJson("deploy/production-auth-cors-handoff.json");
const packageJson = await readJson("package.json");
const packageScripts = packageJson?.scripts || {};
const blockerRegister = await readJson("store/release-blockers-register.json");
const launchPlan = await readJson("store/launch-action-plan.json");
const cloudPlan = await readJson("deploy/cloud-deployment-action-plan.json");
const operatorInputs = await readJson("store/operator-inputs-register.json");
const productionEnvText = await readText("deploy/production.env.example");
const productionEnv = parseEnv(productionEnvText);
const smokeScript = await readText("scripts/production-smoke-test.mjs");
const docText = await readText("00_docs/PRODUCTION_AUTH_CORS_HANDOFF_2026-06-10.md");

if (handoff) {
  if (handoff.schemaVersion === "production-auth-cors-handoff-v1") pass("Production auth/CORS handoff schema version is current.");
  else fail("Production auth/CORS handoff schemaVersion must be production-auth-cors-handoff-v1.");

  requireValue(handoff.updatedAt, "Production auth/CORS handoff updatedAt");
  requireIncludes(handoff.status, "pending-hosting-authenticated-smoke", "Production auth/CORS handoff keeps hosting authenticated smoke unresolved.");
  requireIncludes(handoff.publicOrigin, "https://www.zkraiflow.top", "Production auth/CORS handoff uses the public production domain.");
  requireArray(handoff.officialBasis, "Production auth/CORS official basis", 5);

  for (const basis of handoff.officialBasis || []) {
    if (basis.name && /^https:\/\//i.test(String(basis.url || ""))) pass(`Official basis is linkable: ${basis.name}.`);
    else fail("Official basis entries must include name and HTTPS URL.");
    requireValue(basis.requirement, `Official basis ${basis.name || "unnamed"} requirement`);
  }

  const runtimeValues = Array.isArray(handoff.runtimeValues) ? handoff.runtimeValues : [];
  requireArray(runtimeValues, "Runtime values", 10);
  const runtimeKeys = new Set(runtimeValues.map((item) => item.key));
  for (const key of [
    "NODE_ENV",
    "PUBLIC_APP_ORIGIN",
    "CORS_ALLOWED_ORIGINS",
    "CORS_ALLOW_CREDENTIALS",
    "CORS_ALLOW_LOCALHOST",
    "CONSOLE_AUTH_REQUIRED",
    "CONSOLE_AUTH_ALLOW_REGISTRATION",
    "CONSOLE_AUTH_COOKIE_SECURE",
    "CONSOLE_AUTH_COOKIE_SAMESITE",
    "SMOKE_BASE_URL",
    "SMOKE_EXPECT_AUTH_REQUIRED"
  ]) {
    if (runtimeKeys.has(key)) pass(`Runtime value is documented: ${key}.`);
    else fail(`Runtime value is missing from handoff: ${key}.`);
  }

  for (const item of runtimeValues) {
    const key = item.key || "unnamed-key";
    requireValue(item.expectedTemplateValue, `Runtime value ${key} expected template value`);
    requireValue(item.releaseReason, `Runtime value ${key} release reason`);
    const actual = valueOf(productionEnv, key);
    if (!actual) {
      fail(`deploy/production.env.example is missing ${key}.`);
      continue;
    }
    if (key === "CORS_ALLOWED_ORIGINS") {
      const origins = parseOriginList(actual);
      if (origins.includes("https://www.zkraiflow.top")) pass("Production CORS allowlist includes https://www.zkraiflow.top.");
      else fail("Production CORS allowlist must include https://www.zkraiflow.top.");
      if (origins.includes("*")) fail("Production CORS allowlist must not include wildcard *.");
      else pass("Production CORS allowlist does not include wildcard *.");
    } else if (actual === String(item.expectedTemplateValue)) {
      pass(`deploy/production.env.example matches ${key}.`);
    } else {
      fail(`deploy/production.env.example ${key} expected ${item.expectedTemplateValue}, got ${actual}.`);
    }
  }

  if (valueOf(productionEnv, "CONSOLE_AUTH_COOKIE_SAMESITE").toLowerCase() === "none" && valueOf(productionEnv, "CONSOLE_AUTH_COOKIE_SECURE") !== "true") {
    fail("SameSite=None requires CONSOLE_AUTH_COOKIE_SECURE=true.");
  } else {
    pass("Cookie SameSite/Secure pairing is valid in the production template.");
  }

  requireArray(handoff.originModels, "Origin models", 3);
  const originModelIds = new Set((handoff.originModels || []).map((item) => item.id));
  for (const id of ["same-origin-web-pwa", "capacitor-remote-api", "split-web-api-domain"]) {
    if (originModelIds.has(id)) pass(`Origin model exists: ${id}.`);
    else fail(`Origin model is missing: ${id}.`);
  }

  requireArray(handoff.smokeGates, "Production auth smoke gates", 5);
  const smokeGateIds = new Set((handoff.smokeGates || []).map((item) => item.id));
  for (const id of ["public-health", "authenticated-login", "cors-credentials", "cookie-persistence", "logout-and-expiry"]) {
    if (smokeGateIds.has(id)) pass(`Smoke gate exists: ${id}.`);
    else fail(`Smoke gate is missing: ${id}.`);
  }
  for (const gate of handoff.smokeGates || []) {
    const label = gate.id || "unnamed-gate";
    requireValue(gate.status, `Smoke gate ${label} status`);
    requireValue(gate.command, `Smoke gate ${label} command`);
    requireArray(gate.requiredEvidence, `Smoke gate ${label} required evidence`, 3);
  }

  requireArray(handoff.releaseGates, "Production auth release gates", 3);
  for (const gate of handoff.releaseGates || []) {
    const label = gate.id || "unnamed-gate";
    requireIncludes(gate.status, "blocked", `Release gate ${label} stays blocked until real hosting evidence.`);
    requireArray(gate.requiredEvidence, `Release gate ${label} required evidence`, 3);
  }

  requireArray(handoff.verificationCommands, "Production auth verification commands", 6);
  for (const command of handoff.verificationCommands || []) {
    const script = commandScriptName(command);
    if (!script) continue;
    if (packageScripts[script]) pass(`Production auth verification command exists: npm run ${script}.`);
    else fail(`Production auth verification command references missing npm script: npm run ${script}.`);
  }

  for (const evidenceFile of handoff.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`Production auth evidence exists: ${evidenceFile}.`);
    else fail(`Production auth evidence file is missing: ${evidenceFile}.`);
  }

  requireArray(handoff.doNotCommit, "Production auth do-not-commit list", 5);
}

if (smokeScript.includes("SMOKE_USERNAME") && smokeScript.includes("SMOKE_PASSWORD") && smokeScript.includes("/api/auth/login")) {
  pass("Production smoke script supports authenticated login.");
} else {
  fail("Production smoke script should support authenticated login with SMOKE_USERNAME/SMOKE_PASSWORD.");
}
if (smokeScript.includes("SMOKE_EXPECT_AUTH_REQUIRED") && smokeScript.includes("/api/healthz")) {
  pass("Production smoke script verifies public auth requirement through health check.");
} else {
  fail("Production smoke script should verify authRequired through /api/healthz.");
}

const publicBlocker = (blockerRegister?.blockers || []).find((item) => item.id === "public-domain-and-https");
if (publicBlocker) {
  pass("Release blocker register includes public-domain-and-https.");
  if ((publicBlocker.verificationCommands || []).includes("npm run production:auth-plan")) pass("Public domain blocker references production:auth-plan.");
  else fail("Public domain blocker should reference npm run production:auth-plan.");
} else {
  fail("Release blocker register is missing public-domain-and-https.");
}

const authBlocker = (blockerRegister?.blockers || []).find((item) => item.id === "cloud-cors-cookie-origin");
if (authBlocker) {
  pass("Release blocker register includes cloud-cors-cookie-origin.");
  if ((authBlocker.verificationCommands || []).includes("npm run production:auth-plan")) pass("Auth/CORS blocker references production:auth-plan.");
  else fail("Auth/CORS blocker should reference npm run production:auth-plan.");
  for (const evidence of [
    "deploy/production-auth-cors-handoff.json",
    "00_docs/PRODUCTION_AUTH_CORS_HANDOFF_2026-06-10.md",
    "scripts/check-production-auth-cors-plan.mjs"
  ]) {
    if ((authBlocker.evidenceFiles || []).includes(evidence)) pass(`Auth/CORS blocker references evidence: ${evidence}.`);
    else fail(`Auth/CORS blocker is missing evidence reference: ${evidence}.`);
  }
} else {
  fail("Release blocker register is missing cloud-cors-cookie-origin.");
}

const publicMilestone = (launchPlan?.milestones || []).find((item) => item.id === "public-web-base");
if (publicMilestone) {
  pass("Launch action plan includes public-web-base.");
  const milestoneText = JSON.stringify(publicMilestone);
  requireIncludes(milestoneText, "production:auth-plan", "Public web milestone references production auth plan.");
  requireIncludes(milestoneText, "deploy/production-auth-cors-handoff.json", "Public web milestone references auth/CORS handoff evidence.");
} else {
  fail("Launch action plan is missing public-web-base.");
}

const cloudWorkstreamText = JSON.stringify((cloudPlan?.workstreams || []).filter((item) => ["public-origin-cors", "auth-cookie-hardening", "observability-and-rollback"].includes(item.id)));
requireIncludes(cloudWorkstreamText, "production:auth-plan", "Cloud deployment plan references production auth plan.");
requireIncludes(cloudWorkstreamText, "deploy/production-auth-cors-handoff.json", "Cloud deployment plan references auth/CORS handoff evidence.");

const productionRuntimeGroup = (operatorInputs?.inputGroups || []).find((group) => group.id === "production-runtime");
if (productionRuntimeGroup) {
  pass("Operator inputs include production-runtime group.");
  const groupText = JSON.stringify(productionRuntimeGroup);
  requireIncludes(groupText, "PUBLIC_APP_ORIGIN", "Production runtime owner inputs include PUBLIC_APP_ORIGIN.");
  requireIncludes(groupText, "CORS_ALLOWED_ORIGINS", "Production runtime owner inputs include CORS_ALLOWED_ORIGINS.");
} else {
  fail("Operator inputs are missing production-runtime group.");
}

if (docText) {
  for (const marker of [
    "生产认证",
    "https://www.zkraiflow.top",
    "CONSOLE_AUTH_COOKIE_SECURE",
    "CORS_ALLOWED_ORIGINS",
    "SMOKE_BASE_URL",
    "npm run production:auth-plan",
    "MDN Set-Cookie",
    "MDN Access-Control-Allow-Origin"
  ]) {
    requireIncludes(docText, marker, `Production auth/CORS runbook includes ${marker}`);
  }
} else {
  fail("Production auth/CORS runbook is missing: 00_docs/PRODUCTION_AUTH_CORS_HANDOFF_2026-06-10.md.");
}

if (!packageScripts["production:auth-plan"]) fail("package.json should define npm run production:auth-plan.");

console.log("Production auth/CORS handoff check");
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
