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
    || /password\s*[:=]\s*(?!TODO_|<secret>|<from password manager>|<password-manager>|password-manager|from password manager|password manager)/i.test(text)
    || /cookie\s*[:=]\s*(?!redacted|<redacted>)/i.test(text);
}

const templatePath = "store/authenticated-smoke-evidence-template.json";
const docPath = "00_docs/AUTHENTICATED_SMOKE_EVIDENCE_TEMPLATE_2026-06-10.md";
const template = await readJson(templatePath);
const reviewHandoff = await readJson("store/review-access-handoff.json");
const packageJson = await readJson("package.json");
const docText = await readText(docPath);
const packageScripts = packageJson?.scripts || {};

if (template) {
  if (template.schemaVersion === "authenticated-smoke-evidence-template-v1") pass("Authenticated smoke evidence template schema version is current.");
  else fail("Authenticated smoke evidence template schemaVersion must be authenticated-smoke-evidence-template-v1.");

  requireValue(template.updatedAt, "Authenticated smoke evidence template updatedAt");
  requireIncludes(template.status, "waiting-review-account-and-production-run", "Authenticated smoke template keeps review account and production run unresolved.");
  requireIncludes(template.publicOrigin, "https://www.zkraiflow.top", "Authenticated smoke template uses the public production domain.");
  requireValue(template.purpose, "Authenticated smoke template purpose");

  if (looksSecretLike(JSON.stringify(template))) fail("Authenticated smoke template appears to contain secret-like material.");
  else pass("Authenticated smoke template does not contain obvious secret-like material.");

  const officialReferences = Array.isArray(template.officialReferences) ? template.officialReferences : [];
  requireArray(officialReferences, "Authenticated smoke official references", 4);
  for (const reference of officialReferences) {
    if (reference.name && /^https:\/\//i.test(String(reference.url || ""))) pass(`Official reference is HTTPS: ${reference.name}.`);
    else fail("Official references must include name and HTTPS URL.");
    requireValue(reference.whyItMatters, `Official reference ${reference.name || "unknown"} rationale`);
  }

  requireArray(template.requiredInputsOutsideRepository, "Required outside-repository inputs", 4);
  for (const id of ["review-username", "review-password-secret-ref", "production-runtime-origin", "secure-cookie-runtime"]) {
    if ((template.requiredInputsOutsideRepository || []).some((input) => input.id === id)) pass(`Required outside-repository input exists: ${id}.`);
    else fail(`Required outside-repository input is missing: ${id}.`);
  }

  const commandPlan = template.commandPlan || {};
  for (const [key, expectedScript] of [
    ["unauthenticatedPublicSmoke", "cloud:smoke"],
    ["authenticatedPublicSmoke", "cloud:smoke"],
    ["seedReviewData", "review:seed"],
    ["templateCheck", "production:smoke-template"]
  ]) {
    requireValue(commandPlan[key], `Command plan ${key}`);
    const script = commandScriptName(commandPlan[key]);
    if (script === expectedScript) pass(`Command plan ${key} uses npm run ${expectedScript}.`);
    else fail(`Command plan ${key} should use npm run ${expectedScript}.`);
    if (packageScripts[expectedScript]) pass(`Command plan script exists: ${expectedScript}.`);
    else fail(`Command plan references missing script: ${expectedScript}.`);
  }

  const checks = Array.isArray(template.expectedAuthenticatedChecks) ? template.expectedAuthenticatedChecks : [];
  requireArray(checks, "Expected authenticated checks", 5);
  for (const id of ["login-session-cookie", "session-api", "runtime-config-api", "data-rights-api", "cors-origin-policy"]) {
    const check = checks.find((item) => item.id === id);
    if (check) {
      pass(`Expected authenticated check exists: ${id}.`);
      requireArray(check.evidenceRequired, `Authenticated check ${id} evidence`, 3);
    } else {
      fail(`Expected authenticated check is missing: ${id}.`);
    }
  }

  const sample = template.sampleEvidenceRecord || {};
  if (sample.schemaVersion === "authenticated-smoke-result-v1") pass("Sample authenticated smoke record schema is present.");
  else fail("Sample authenticated smoke record schemaVersion should be authenticated-smoke-result-v1.");
  requireIncludes(sample.publicOrigin, "https://www.zkraiflow.top", "Sample authenticated smoke record uses public origin.");
  requireArray(sample.authenticatedChecks, "Sample authenticated smoke checks", 5);
  requireArray(sample.evidenceFiles, "Sample authenticated smoke evidence files", 1);
  requireArray(sample.followUpBlockers, "Sample authenticated smoke follow-up blockers", 3);

  requireArray(template.evidenceRules?.allowedInRepository, "Authenticated smoke allowed repository evidence", 4);
  requireArray(template.evidenceRules?.doNotStore, "Authenticated smoke do-not-store list", 6);
  requireIncludes(template.evidenceRules?.fileNaming, "store/evidence/auth-smoke/", "Authenticated smoke file naming points to auth-smoke evidence folder.");
  requireArray(template.closeoutGates, "Authenticated smoke closeout gates", 6);

  for (const linkedFile of template.linkedFiles || []) {
    if (await fileExists(linkedFile)) pass(`Authenticated smoke linked file exists: ${linkedFile}.`);
    else fail(`Authenticated smoke linked file is missing: ${linkedFile}.`);
  }
}

const handoffTemplate = reviewHandoff?.authenticatedSmokeEvidence || {};
if (handoffTemplate.status === "template-ready-waiting-review-account-and-production-run") {
  pass("Review access handoff links authenticated smoke evidence template status.");
} else {
  fail("Review access handoff should link authenticatedSmokeEvidence.status as template-ready-waiting-review-account-and-production-run.");
}
for (const [key, expected] of [
  ["templateFile", "store/authenticated-smoke-evidence-template.json"],
  ["runbook", "00_docs/AUTHENTICATED_SMOKE_EVIDENCE_TEMPLATE_2026-06-10.md"],
  ["checkScript", "scripts/check-authenticated-smoke-evidence-template.mjs"],
  ["checkCommand", "npm run production:smoke-template"]
]) {
  if (handoffTemplate[key] === expected) pass(`Review access handoff authenticated smoke ${key} links ${expected}.`);
  else fail(`Review access handoff authenticated smoke ${key} should be ${expected}.`);
}

if (await fileExists(docPath)) pass("Authenticated smoke evidence runbook exists.");
else fail(`Authenticated smoke evidence runbook is missing: ${docPath}.`);

if (docText) {
  for (const marker of [
    "https://www.zkraiflow.top",
    "npm run production:smoke-template",
    "npm run cloud:smoke",
    "SMOKE_USERNAME",
    "不要放进仓库",
    "Set-Cookie",
    "CORS"
  ]) {
    requireIncludes(docText, marker, `Authenticated smoke runbook includes ${marker}`);
  }
}

console.log("Authenticated smoke evidence template check");
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
