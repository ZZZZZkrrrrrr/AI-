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

function collectStrings(value, results = []) {
  if (typeof value === "string") {
    results.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, results);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, results);
  }
  return results;
}

const handoff = await readJson("store/review-access-handoff.json");
const reviewNotes = await readJson("store/review-notes-template.json");
const packageJson = await readJson("package.json");
const packageScripts = packageJson?.scripts || {};
const docText = await readText("00_docs/REVIEW_ACCOUNT_ACCESS_RUNBOOK_2026-06-10.md");

if (handoff) {
  if (handoff.schemaVersion === "review-access-handoff-v1") pass("Review access handoff schema version is current.");
  else fail("Review access handoff schemaVersion must be review-access-handoff-v1.");

  requireValue(handoff.updatedAt, "Review access handoff updatedAt");
  requireValue(handoff.status, "Review access handoff status");
  requireIncludes(handoff.publicOrigin, "https://www.zkraiflow.top", "Review access handoff uses the public production domain.");
  requireArray(handoff.officialBasis, "Review access handoff official basis", 3);

  for (const basis of handoff.officialBasis || []) {
    if (basis.name && /^https:\/\//i.test(String(basis.url || ""))) pass(`Official basis is linkable: ${basis.name}.`);
    else fail("Official basis entries must include name and HTTPS URL.");
    requireValue(basis.requirement, `Official basis ${basis.name || "unnamed"} requirement`);
  }

  const credentialPolicy = handoff.credentialPolicy || {};
  requireIncludes(credentialPolicy.accountStatus, "pending-real-credentials", "Credential policy keeps real credentials out of the repo.");
  requireValue(credentialPolicy.usernamePlaceholder, "Review username placeholder");
  requireValue(credentialPolicy.passwordSecretRefPlaceholder, "Review password secret placeholder");
  requireIncludes(credentialPolicy.mfaPolicy, "disabled", "Credential policy disables MFA for review account.");
  requireArray(credentialPolicy.credentialRules, "Credential rules", 4);
  requireArray(credentialPolicy.notForRepository, "Not-for-repository secret list", 4);

  const allText = collectStrings(handoff).join("\n");
  if (/TODO_REVIEW_PASSWORD_SECRET_REF/.test(allText)) pass("Handoff uses a password secret reference placeholder.");
  else fail("Handoff should use TODO_REVIEW_PASSWORD_SECRET_REF rather than a real password.");
  if (/REVIEW_PASSWORD=<from password manager>|REVIEW_PASSWORD=<secret>|SMOKE_PASSWORD=<secret>/.test(allText)) {
    pass("Handoff documents password-manager based secret injection.");
  } else {
    fail("Handoff should document review password injection without storing the real value.");
  }

  const authenticatedSmokeEvidence = handoff.authenticatedSmokeEvidence || {};
  if (authenticatedSmokeEvidence.status === "template-ready-waiting-review-account-and-production-run") {
    pass("Review access handoff links authenticated smoke evidence template.");
  } else {
    fail("Review access handoff should link authenticatedSmokeEvidence.status as template-ready-waiting-review-account-and-production-run.");
  }
  for (const [key, expected] of [
    ["templateFile", "store/authenticated-smoke-evidence-template.json"],
    ["runbook", "00_docs/AUTHENTICATED_SMOKE_EVIDENCE_TEMPLATE_2026-06-10.md"],
    ["checkScript", "scripts/check-authenticated-smoke-evidence-template.mjs"],
    ["checkCommand", "npm run production:smoke-template"]
  ]) {
    if (authenticatedSmokeEvidence[key] === expected) pass(`Authenticated smoke evidence ${key} links ${expected}.`);
    else fail(`Authenticated smoke evidence ${key} should be ${expected}.`);
  }
  for (const linkedFile of [
    authenticatedSmokeEvidence.templateFile,
    authenticatedSmokeEvidence.runbook,
    authenticatedSmokeEvidence.checkScript
  ]) {
    if (await fileExists(linkedFile)) pass(`Authenticated smoke evidence file exists: ${linkedFile}.`);
    else fail(`Authenticated smoke evidence file is missing: ${linkedFile}.`);
  }

  const seedDataPlan = handoff.seedDataPlan || {};
  requireIncludes(seedDataPlan.script, "npm run review:seed", "Seed data plan calls the real review seed command.");
  requireIncludes(seedDataPlan.dryRunScript, "npm run review:seed:dry", "Seed data plan calls the dry-run seed command.");
  requireArray(seedDataPlan.requiredEnvironment, "Seed data required environment", 3);
  requireArray(seedDataPlan.seededArtifacts, "Seeded artifacts", 3);
  requireArray(seedDataPlan.successEvidence, "Seed success evidence", 4);

  const reviewerPath = Array.isArray(handoff.reviewerPath) ? handoff.reviewerPath : [];
  requireArray(reviewerPath, "Reviewer path", 6);
  for (const step of reviewerPath) {
    const label = step.step || step.screen || "unnamed-step";
    requireValue(step.screen, `Reviewer path ${label} screen`);
    requireValue(step.instruction, `Reviewer path ${label} instruction`);
    requireValue(step.expected, `Reviewer path ${label} expected result`);
  }

  const submissionFields = handoff.storeSubmissionFields || {};
  requireArray(submissionFields.apple?.reviewInformationFields, "Apple review information fields", 5);
  requireArray(submissionFields.googlePlay?.appAccessFields, "Google Play app access fields", 4);
  requireArray(submissionFields.domesticAndroidStores?.fields, "Domestic Android store review fields", 4);

  const gates = Array.isArray(handoff.verificationGates) ? handoff.verificationGates : [];
  requireArray(gates, "Review access verification gates", 4);
  for (const gate of gates) {
    const label = gate.id || "unnamed-gate";
    requireValue(gate.status, `Verification gate ${label} status`);
    requireArray(gate.commands, `Verification gate ${label} commands`, 1);
    requireArray(gate.evidence, `Verification gate ${label} evidence`, 1);

    for (const command of gate.commands || []) {
      const script = commandScriptName(command);
      if (!script) continue;
      if (packageScripts[script]) pass(`Verification gate ${label} command exists: npm run ${script}.`);
      else fail(`Verification gate ${label} references missing npm script: npm run ${script}.`);
    }
  }

  for (const evidenceFile of handoff.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`Review access evidence exists: ${evidenceFile}.`);
    else fail(`Review access evidence file is missing: ${evidenceFile}.`);
  }
}

if (reviewNotes) {
  requireIncludes(reviewNotes.schemaVersion, "store-review-notes-template-v1", "Review notes template schema is current.");
  requireIncludes(reviewNotes.demoAccount?.seedDataScript, "npm run review:seed", "Review notes template points to seed command.");
  requireIncludes(reviewNotes.demoAccount?.seedDataDryRunScript, "npm run review:seed:dry", "Review notes template points to dry-run seed command.");
  requireArray(reviewNotes.googlePlayAppAccess?.additionalInstructionsDraft, "Google Play review instructions draft", 4);
  requireArray(reviewNotes.appleReviewInformation?.notesForReviewDraft, "Apple review notes draft", 4);
} else {
  fail("Review notes template is missing.");
}

if (docText) {
  for (const marker of [
    "审核账号访问交接包",
    "https://www.zkraiflow.top",
    "npm run review:seed",
    "npm run review:access-plan",
    "Apple App Review",
    "Google Play"
  ]) {
    requireIncludes(docText, marker, `Review access runbook includes ${marker}`);
  }
} else {
  fail("Review access runbook is missing: 00_docs/REVIEW_ACCOUNT_ACCESS_RUNBOOK_2026-06-10.md.");
}

if (!packageScripts["review:access-plan"]) fail("package.json should define npm run review:access-plan.");

console.log("Review access handoff check");
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
