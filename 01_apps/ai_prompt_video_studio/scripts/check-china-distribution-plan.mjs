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

const handoff = await readJson("store/china-distribution-compliance-handoff.json");
const submission = await readJson("store/submission-readiness.json");
const blockerRegister = await readJson("store/release-blockers-register.json");
const packageJson = await readJson("package.json");
const packageScripts = packageJson?.scripts || {};
const docText = await readText("00_docs/CHINA_DISTRIBUTION_COMPLIANCE_HANDOFF_2026-06-10.md");

if (handoff) {
  if (handoff.schemaVersion === "china-distribution-compliance-handoff-v1") pass("China distribution handoff schema version is current.");
  else fail("China distribution handoff schemaVersion must be china-distribution-compliance-handoff-v1.");

  requireValue(handoff.updatedAt, "China distribution handoff updatedAt");
  requireIncludes(handoff.status, "waiting-owner-filing-inputs", "China distribution handoff keeps owner filing inputs unresolved.");
  requireIncludes(handoff.publicOrigin, "https://www.zkraiflow.top", "China distribution handoff uses the public production domain.");
  requireArray(handoff.officialBasis, "China distribution official basis", 3);

  for (const basis of handoff.officialBasis || []) {
    if (basis.name && /^https:\/\//i.test(String(basis.url || ""))) pass(`Official basis is linkable: ${basis.name}.`);
    else fail("Official basis entries must include name and HTTPS URL.");
    requireValue(basis.whyItMatters, `Official basis ${basis.name || "unnamed"} explanation`);
  }

  const ownerInputs = Array.isArray(handoff.ownerInputs) ? handoff.ownerInputs : [];
  requireArray(ownerInputs, "China owner inputs", 6);
  const inputIds = new Set(ownerInputs.map((item) => item.id));
  for (const id of [
    "operatorLegalName",
    "domainOwnershipAndAccessProvider",
    "icpFilingNumber",
    "appFilingNumber",
    "filingDisplayLocation",
    "aiGeneratedContentLabeling",
    "chinaPrivacyAndPermissionMaterials"
  ]) {
    if (inputIds.has(id)) pass(`China owner input exists: ${id}.`);
    else fail(`China owner input is missing: ${id}.`);
  }

  for (const input of ownerInputs) {
    const label = input.id || "unnamed-input";
    requireValue(input.currentValue, `Owner input ${label} current value`);
    requireArray(input.requiredBefore, `Owner input ${label} required-before list`, 1);
    requireArray(input.targetDestinations, `Owner input ${label} target destinations`, 1);
  }

  requireArray(handoff.requiredSurfaces, "China required display/legal surfaces", 4);
  for (const surface of handoff.requiredSurfaces || []) {
    const label = surface.id || surface.file || "unnamed-surface";
    requireValue(surface.file, `Required surface ${label} file`);
    requireArray(surface.mustEventuallyShow, `Required surface ${label} display requirements`, 2);
    requireValue(surface.currentState, `Required surface ${label} current state`);
    if (surface.file && await fileExists(surface.file)) pass(`Required surface exists: ${surface.file}.`);
    else fail(`Required surface file is missing: ${surface.file}.`);
  }

  requireArray(handoff.filingWorkflow, "China filing workflow", 5);
  for (const step of handoff.filingWorkflow || []) {
    const label = step.title || `step-${step.step}`;
    requireValue(step.owner, `Filing workflow ${label} owner`);
    requireArray(step.exitCriteria, `Filing workflow ${label} exit criteria`, 2);
  }

  requireArray(handoff.releaseGates, "China release gates", 3);
  for (const gate of handoff.releaseGates || []) {
    const label = gate.id || "unnamed-gate";
    requireValue(gate.status, `Release gate ${label} status`);
    requireArray(gate.requiredEvidence, `Release gate ${label} required evidence`, 3);
  }

  requireArray(handoff.verificationCommands, "China verification commands", 4);
  for (const command of handoff.verificationCommands || []) {
    const script = commandScriptName(command);
    if (!script) continue;
    if (packageScripts[script]) pass(`China verification command exists: npm run ${script}.`);
    else fail(`China verification command references missing npm script: npm run ${script}.`);
  }

  for (const evidenceFile of handoff.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`China evidence exists: ${evidenceFile}.`);
    else fail(`China evidence file is missing: ${evidenceFile}.`);
  }

  requireArray(handoff.doNotCommit, "China do-not-commit list", 4);
}

const china = submission?.china || {};
for (const [key, marker] of [
  ["operatorName", "TODO_OPERATOR_LEGAL_ENTITY"],
  ["icpFilingNumber", "TODO_ICP_FILING_NUMBER"],
  ["appFilingNumber", "TODO_APP_FILING_NUMBER"],
  ["filingDisplayLocation", "TODO_DISPLAY_APP_FILING_NUMBER_IN_APP"]
]) {
  if (china[key] === marker) pass(`Submission readiness tracks unresolved China field: ${key}.`);
  else if (String(china[key] || "").trim()) warn(`Submission readiness China field ${key} appears changed; rerun store/compliance review.`);
  else fail(`Submission readiness China field ${key} is missing.`);
}

const chinaBlocker = (blockerRegister?.blockers || []).find((item) => item.id === "china-filing-and-operator");
if (chinaBlocker) {
  pass("Release blocker register includes china-filing-and-operator.");
  if ((chinaBlocker.verificationCommands || []).includes("npm run china:distribution-plan")) {
    pass("China blocker references china:distribution-plan.");
  } else {
    fail("China blocker should reference npm run china:distribution-plan.");
  }
  for (const evidence of [
    "store/china-distribution-compliance-handoff.json",
    "00_docs/CHINA_DISTRIBUTION_COMPLIANCE_HANDOFF_2026-06-10.md",
    "scripts/check-china-distribution-plan.mjs"
  ]) {
    if ((chinaBlocker.evidenceFiles || []).includes(evidence)) pass(`China blocker references evidence: ${evidence}.`);
    else fail(`China blocker is missing evidence reference: ${evidence}.`);
  }
} else {
  fail("Release blocker register is missing china-filing-and-operator.");
}

if (docText) {
  for (const marker of [
    "中国区发布与备案合规交接包",
    "www.zkraiflow.top",
    "TODO_ICP_FILING_NUMBER",
    "TODO_APP_FILING_NUMBER",
    "npm run china:distribution-plan",
    "miit.gov.cn",
    "beian.miit.gov.cn",
    "cac.gov.cn"
  ]) {
    requireIncludes(docText, marker, `China distribution runbook includes ${marker}`);
  }
} else {
  fail("China distribution runbook is missing: 00_docs/CHINA_DISTRIBUTION_COMPLIANCE_HANDOFF_2026-06-10.md.");
}

if (!packageScripts["china:distribution-plan"]) fail("package.json should define npm run china:distribution-plan.");

console.log("China distribution compliance handoff check");
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
