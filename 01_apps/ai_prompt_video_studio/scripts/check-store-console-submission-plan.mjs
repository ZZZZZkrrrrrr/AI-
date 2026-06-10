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

function isBlockedOrWaiting(status) {
  return /blocked|waiting|pending|draft|handoff-ready/i.test(String(status || ""));
}

const handoff = await readJson("store/store-console-submission-handoff.json");
const submission = await readJson("store/submission-readiness.json");
const packageJson = await readJson("package.json");
const blockerRegister = await readJson("store/release-blockers-register.json");
const launchPlan = await readJson("store/launch-action-plan.json");
const operatorInputs = await readJson("store/operator-inputs-register.json");
const docText = await readText("00_docs/STORE_CONSOLE_SUBMISSION_HANDOFF_2026-06-10.md");
const packageScripts = packageJson?.scripts || {};

if (handoff) {
  if (handoff.schemaVersion === "store-console-submission-handoff-v1") pass("Store console handoff schema version is current.");
  else fail("Store console handoff schemaVersion must be store-console-submission-handoff-v1.");

  requireValue(handoff.updatedAt, "Store console handoff updatedAt");
  requireIncludes(handoff.status, "waiting-owner-console-finalization", "Store console handoff keeps console finalization unresolved.");
  requireIncludes(handoff.publicOrigin, "https://www.zkraiflow.top", "Store console handoff uses the public production domain.");
  requireValue(handoff.objective, "Store console handoff objective");
  requireArray(handoff.officialBasis, "Store console official basis", 8);

  for (const basis of handoff.officialBasis || []) {
    if (basis.name && /^https:\/\//i.test(String(basis.url || ""))) pass(`Official basis is linkable: ${basis.name}.`);
    else fail("Official basis entries must include name and HTTPS URL.");
    requireValue(basis.requirement, `Official basis ${basis.name || "unnamed"} requirement`);
  }

  const targets = Array.isArray(handoff.consoleTargets) ? handoff.consoleTargets : [];
  requireArray(targets, "Store console targets", 3);
  const targetIds = new Set(targets.map((target) => target.id));
  for (const id of ["app-store-connect", "google-play-console", "domestic-android-stores"]) {
    if (targetIds.has(id)) pass(`Store console target exists: ${id}.`);
    else fail(`Store console target is missing: ${id}.`);
  }
  for (const target of targets) {
    const label = target.id || "unnamed-target";
    requireValue(target.platform, `Console target ${label} platform`);
    requireValue(target.status, `Console target ${label} status`);
    if (isBlockedOrWaiting(target.status)) pass(`Console target ${label} remains gated until real owner/build evidence exists.`);
    else warn(`Console target ${label} status is ${target.status}; confirm it reflects real console state.`);
    requireArray(target.requiredBeforeSubmission, `Console target ${label} required-before-submission list`, 4);
  }

  const sections = Array.isArray(handoff.consoleSections) ? handoff.consoleSections : [];
  requireArray(sections, "Store console sections", 7);
  const sectionIds = new Set(sections.map((section) => section.id));
  for (const id of [
    "app-identity-and-records",
    "listing-copy-and-media",
    "privacy-data-safety-and-legal",
    "review-access-and-demo-data",
    "native-builds-and-signing",
    "production-runtime-and-operations",
    "ratings-declarations-and-availability"
  ]) {
    if (sectionIds.has(id)) pass(`Store console section exists: ${id}.`);
    else fail(`Store console section is missing: ${id}.`);
  }

  for (const section of sections) {
    const label = section.id || "unnamed-section";
    requireValue(section.status, `Console section ${label} status`);
    requireArray(section.destinations, `Console section ${label} destinations`, 1);
    requireArray(section.sourceFiles, `Console section ${label} source files`, 2);
    requireArray(section.currentEvidence, `Console section ${label} current evidence`, 2);
    requireArray(section.openInputs, `Console section ${label} open inputs`, 2);
    for (const sourceFile of section.sourceFiles || []) {
      if (await fileExists(sourceFile)) pass(`Console section ${label} source exists: ${sourceFile}.`);
      else fail(`Console section ${label} source file is missing: ${sourceFile}.`);
    }
  }

  requireArray(handoff.releaseGates, "Store console release gates", 4);
  for (const gate of handoff.releaseGates || []) {
    const label = gate.id || "unnamed-gate";
    requireIncludes(gate.status, "blocked", `Store console gate ${label} remains blocked until real evidence exists.`);
    requireArray(gate.requiredEvidence, `Store console gate ${label} required evidence`, 3);
  }

  requireArray(handoff.verificationCommands, "Store console verification commands", 8);
  for (const command of handoff.verificationCommands || []) {
    const script = commandScriptName(command);
    if (!script) continue;
    if (packageScripts[script]) pass(`Store console verification command exists: npm run ${script}.`);
    else fail(`Store console verification command references missing npm script: npm run ${script}.`);
  }

  for (const evidenceFile of handoff.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`Store console evidence exists: ${evidenceFile}.`);
    else fail(`Store console evidence file is missing: ${evidenceFile}.`);
  }

  requireArray(handoff.doNotCommit, "Store console do-not-commit list", 6);
}

if (submission) {
  const consoleSubmission = submission.consoleSubmission || {};
  if (consoleSubmission.status === "handoff-ready-waiting-owner-console-finalization") {
    pass("Submission readiness tracks store console handoff status.");
  } else {
    fail("Submission readiness should track consoleSubmission.status as handoff-ready-waiting-owner-console-finalization.");
  }
  requireIncludes(consoleSubmission.handoffFile, "store/store-console-submission-handoff.json", "Submission readiness links store console handoff file.");
  requireIncludes(consoleSubmission.runbook, "00_docs/STORE_CONSOLE_SUBMISSION_HANDOFF_2026-06-10.md", "Submission readiness links store console runbook.");
  requireIncludes(consoleSubmission.checkScript, "scripts/check-store-console-submission-plan.mjs", "Submission readiness links store console check script.");
  requireArray(consoleSubmission.openConsoleGates, "Submission readiness tracks open console gates", 5);
}

const blockerIds = new Set((blockerRegister?.blockers || []).map((item) => item.id));
for (const id of [
  "support-contact",
  "legal-finalization",
  "review-demo-account",
  "native-build-toolchains",
  "native-store-screenshots",
  "china-filing-and-operator"
]) {
  if (blockerIds.has(id)) pass(`Release blocker register includes ${id}.`);
  else fail(`Release blocker register is missing ${id}.`);
}

for (const id of ["support-contact", "legal-finalization", "review-demo-account"]) {
  const blocker = (blockerRegister?.blockers || []).find((item) => item.id === id);
  if (!blocker) continue;
  if ((blocker.verificationCommands || []).includes("npm run store:console-plan")) pass(`Release blocker ${id} references store:console-plan.`);
  else fail(`Release blocker ${id} should reference npm run store:console-plan.`);
  if ((blocker.evidenceFiles || []).includes("store/store-console-submission-handoff.json")) pass(`Release blocker ${id} references store console handoff evidence.`);
  else fail(`Release blocker ${id} should reference store/store-console-submission-handoff.json.`);
}

const launchMilestone = (launchPlan?.milestones || []).find((item) => item.id === "store-console-submission");
if (launchMilestone) {
  pass("Launch action plan includes store-console-submission milestone.");
  requireIncludes(launchMilestone.status, "waiting-owner-console-finalization", "Store console milestone keeps owner finalization unresolved.");
  requireArray(launchMilestone.evidence, "Store console milestone evidence", 5);
  requireArray(launchMilestone.nextActions, "Store console milestone next actions", 4);
} else {
  fail("Launch action plan should include store-console-submission milestone.");
}

const ownerGroupIds = new Set((operatorInputs?.inputGroups || []).map((group) => group.id));
for (const id of ["contact-and-support", "review-demo-account", "legal-and-operator", "native-store-packaging", "china-distribution"]) {
  if (ownerGroupIds.has(id)) pass(`Operator inputs include ${id}.`);
  else fail(`Operator inputs are missing ${id}.`);
}

if (docText) {
  for (const marker of [
    "商店后台提交交接清单",
    "App Store Connect",
    "Google Play Console",
    "国内安卓",
    "npm run store:console-plan",
    "https://www.zkraiflow.top",
    "Apple App Privacy Details",
    "Google Play Data safety",
    "不要放进仓库"
  ]) {
    requireIncludes(docText, marker, `Store console runbook includes ${marker}`);
  }
} else {
  fail("Store console runbook is missing: 00_docs/STORE_CONSOLE_SUBMISSION_HANDOFF_2026-06-10.md.");
}

if (!packageScripts["store:console-plan"]) fail("package.json should define npm run store:console-plan.");

console.log("Store console submission handoff check");
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
