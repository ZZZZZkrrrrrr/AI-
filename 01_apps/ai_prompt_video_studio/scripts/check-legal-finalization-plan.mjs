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

const handoff = await readJson("store/legal-finalization-handoff.json");
const submission = await readJson("store/submission-readiness.json");
const blockerRegister = await readJson("store/release-blockers-register.json");
const operatorInputs = await readJson("store/operator-inputs-register.json");
const privacyDraft = await readJson("store/privacy-data-safety-draft.json");
const packageJson = await readJson("package.json");
const packageScripts = packageJson?.scripts || {};
const docText = await readText("00_docs/LEGAL_FINALIZATION_HANDOFF_2026-06-10.md");

if (handoff) {
  if (handoff.schemaVersion === "legal-finalization-handoff-v1") pass("Legal finalization handoff schema version is current.");
  else fail("Legal finalization handoff schemaVersion must be legal-finalization-handoff-v1.");

  requireValue(handoff.updatedAt, "Legal finalization handoff updatedAt");
  requireIncludes(handoff.status, "waiting-owner-legal-final", "Legal finalization handoff keeps legal final inputs unresolved.");
  requireIncludes(handoff.publicOrigin, "https://www.zkraiflow.top", "Legal finalization handoff uses the public production domain.");
  requireArray(handoff.officialBasis, "Legal official basis", 5);

  for (const basis of handoff.officialBasis || []) {
    if (basis.name && /^https:\/\//i.test(String(basis.url || ""))) pass(`Official basis is linkable: ${basis.name}.`);
    else fail("Official basis entries must include name and HTTPS URL.");
    requireValue(basis.requirement, `Official basis ${basis.name || "unnamed"} requirement`);
  }

  const ownerInputs = Array.isArray(handoff.ownerInputs) ? handoff.ownerInputs : [];
  requireArray(ownerInputs, "Legal owner inputs", 8);
  const inputIds = new Set(ownerInputs.map((item) => item.id));
  for (const id of [
    "contactEmail",
    "contactPhone",
    "supportSla",
    "operatorLegalName",
    "finalProviderList",
    "retentionPolicy",
    "dataTrainingPolicy",
    "aiGeneratedContentLabeling",
    "accountDeletionHandling"
  ]) {
    if (inputIds.has(id)) pass(`Legal owner input exists: ${id}.`);
    else fail(`Legal owner input is missing: ${id}.`);
  }

  for (const input of ownerInputs) {
    const label = input.id || "unnamed-input";
    requireValue(input.currentValue, `Owner input ${label} current value`);
    requireArray(input.requiredBefore, `Owner input ${label} required-before list`, 1);
    requireArray(input.targetDestinations, `Owner input ${label} target destinations`, 1);
  }

  const legalPages = Array.isArray(handoff.legalPages) ? handoff.legalPages : [];
  requireArray(legalPages, "Legal pages", 6);
  const pageIds = new Set(legalPages.map((page) => page.id));
  for (const id of ["legal-hub", "privacy-policy", "terms-of-service", "ai-disclosure", "account-deletion", "support"]) {
    if (pageIds.has(id)) pass(`Legal page exists in handoff: ${id}.`);
    else fail(`Legal page is missing from handoff: ${id}.`);
  }
  for (const page of legalPages) {
    const label = page.id || page.file || "unnamed-page";
    requireValue(page.file, `Legal page ${label} file`);
    requireValue(page.currentState, `Legal page ${label} current state`);
    requireValue(page.finalizationGate, `Legal page ${label} finalization gate`);
    if (page.file && await fileExists(page.file)) pass(`Legal page file exists: ${page.file}.`);
    else fail(`Legal page file is missing: ${page.file}.`);
  }

  const storeForms = Array.isArray(handoff.storeForms) ? handoff.storeForms : [];
  requireArray(storeForms, "Store privacy/legal forms", 4);
  const formIds = new Set(storeForms.map((form) => form.id));
  for (const id of ["apple-privacy-details", "google-data-safety", "google-account-deletion", "review-notes"]) {
    if (formIds.has(id)) pass(`Store form exists in handoff: ${id}.`);
    else fail(`Store form is missing from handoff: ${id}.`);
  }

  const releaseGates = Array.isArray(handoff.releaseGates) ? handoff.releaseGates : [];
  requireArray(releaseGates, "Legal release gates", 4);
  for (const gate of releaseGates) {
    const label = gate.id || "unnamed-gate";
    requireIncludes(gate.status, "blocked", `Legal release gate ${label} stays blocked until real finalization.`);
    requireArray(gate.requiredEvidence, `Legal release gate ${label} required evidence`, 3);
  }

  requireArray(handoff.verificationCommands, "Legal verification commands", 5);
  for (const command of handoff.verificationCommands || []) {
    const script = commandScriptName(command);
    if (!script) continue;
    if (packageScripts[script]) pass(`Legal verification command exists: npm run ${script}.`);
    else fail(`Legal verification command references missing npm script: npm run ${script}.`);
  }

  for (const evidenceFile of handoff.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`Legal evidence exists: ${evidenceFile}.`);
    else fail(`Legal evidence file is missing: ${evidenceFile}.`);
  }

  requireArray(handoff.doNotCommit, "Legal do-not-commit list", 5);
}

const privacy = submission?.privacy || {};
if (privacy.legalFinalizationStatus === "handoff-ready-waiting-owner-legal-final") {
  pass("Submission readiness tracks legal finalization handoff status.");
} else {
  fail("Submission readiness should track legalFinalizationStatus as handoff-ready-waiting-owner-legal-final.");
}
requireIncludes(privacy.legalFinalizationFile, "store/legal-finalization-handoff.json", "Submission readiness links the legal finalization handoff file.");
requireIncludes(privacy.legalFinalizationRunbook, "00_docs/LEGAL_FINALIZATION_HANDOFF_2026-06-10.md", "Submission readiness links the legal finalization runbook.");

if (privacyDraft?.status === "draft") pass("Privacy data safety draft remains draft until legal finalization.");
else warn(`Privacy data safety draft status is ${privacyDraft?.status || "missing"}; confirm this reflects real legal review.`);

const legalInputGroup = (operatorInputs?.inputGroups || []).find((group) => group.id === "legal-and-operator");
if (legalInputGroup) {
  pass("Operator inputs include legal-and-operator group.");
  const fieldIds = new Set((legalInputGroup.fields || []).map((field) => field.id));
  for (const id of ["operatorLegalName", "finalProviderList", "retentionPolicy"]) {
    if (fieldIds.has(id)) pass(`Operator legal input exists: ${id}.`);
    else fail(`Operator legal input is missing: ${id}.`);
  }
} else {
  fail("Operator inputs are missing legal-and-operator group.");
}

const legalBlocker = (blockerRegister?.blockers || []).find((item) => item.id === "legal-finalization");
if (legalBlocker) {
  pass("Release blocker register includes legal-finalization.");
  if ((legalBlocker.verificationCommands || []).includes("npm run legal:finalization-plan")) {
    pass("Legal blocker references legal:finalization-plan.");
  } else {
    fail("Legal blocker should reference npm run legal:finalization-plan.");
  }
  for (const evidence of [
    "store/legal-finalization-handoff.json",
    "00_docs/LEGAL_FINALIZATION_HANDOFF_2026-06-10.md",
    "scripts/check-legal-finalization-plan.mjs"
  ]) {
    if ((legalBlocker.evidenceFiles || []).includes(evidence)) pass(`Legal blocker references evidence: ${evidence}.`);
    else fail(`Legal blocker is missing evidence reference: ${evidence}.`);
  }
} else {
  fail("Release blocker register is missing legal-finalization.");
}

if (docText) {
  for (const marker of [
    "法务终稿",
    "https://www.zkraiflow.top",
    "TODO_CONTACT_EMAIL",
    "TODO_RETENTION_POLICY",
    "npm run legal:finalization-plan",
    "Apple App Privacy Details",
    "Google Play Data safety",
    "Google Play account deletion requirements"
  ]) {
    requireIncludes(docText, marker, `Legal finalization runbook includes ${marker}`);
  }
} else {
  fail("Legal finalization runbook is missing: 00_docs/LEGAL_FINALIZATION_HANDOFF_2026-06-10.md.");
}

if (!packageScripts["legal:finalization-plan"]) fail("package.json should define npm run legal:finalization-plan.");

console.log("Legal finalization handoff check");
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
