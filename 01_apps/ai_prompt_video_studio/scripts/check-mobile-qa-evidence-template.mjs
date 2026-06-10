import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = findWorkspaceRoot(appRoot);
const passes = [];
const warnings = [];
const blockers = [];

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
    block(`${relativePath} is missing or empty.`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    block(`${relativePath} is invalid JSON: ${error.message}`);
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

function block(message) {
  blockers.push(message);
}

function requireArray(value, label, minimum = 1) {
  if (Array.isArray(value) && value.length >= minimum) {
    pass(`${label} has ${value.length} item(s).`);
    return true;
  }
  block(`${label} should contain at least ${minimum} item(s).`);
  return false;
}

function requireText(value, label) {
  if (String(value || "").trim()) {
    pass(`${label} is present.`);
    return true;
  }
  block(`${label} is missing.`);
  return false;
}

function requireIncludes(source, marker, label) {
  if (String(source || "").includes(marker)) pass(label);
  else block(`${label}: missing marker "${marker}".`);
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
    || /password\s*[:=]\s*(?!TODO_|<secret>|password-manager|redacted)/i.test(text);
}

const templatePath = "store/mobile-device-qa-evidence-template.json";
const docPath = "00_docs/MOBILE_DEVICE_QA_EVIDENCE_TEMPLATE_2026-06-10.md";
const template = await readJson(templatePath);
const plan = await readJson("store/mobile-device-qa-plan.json");
const packageJson = await readJson("package.json");
const docText = await readText(docPath);

if (template) {
  if (template.schemaVersion === "mobile-device-qa-evidence-template-v1") pass("Mobile QA evidence template schema version is current.");
  else block("Mobile QA evidence template schemaVersion must be mobile-device-qa-evidence-template-v1.");

  requireText(template.updatedAt, "Mobile QA evidence template updatedAt");
  requireIncludes(template.status, "waiting-real-device-results", "Mobile QA evidence template keeps real-device evidence unresolved.");
  requireIncludes(template.publicOrigin, "https://www.zkraiflow.top", "Mobile QA evidence template uses the public production domain.");
  requireText(template.purpose, "Mobile QA evidence template purpose");

  const combinedTemplate = JSON.stringify(template);
  if (looksSecretLike(combinedTemplate)) block("Mobile QA evidence template appears to contain secret-like material.");
  else pass("Mobile QA evidence template does not contain obvious secret-like material.");

  const officialReferences = Array.isArray(template.officialReferences) ? template.officialReferences : [];
  requireArray(officialReferences, "Official reference list", 5);
  for (const reference of officialReferences) {
    if (reference.name && /^https:\/\//i.test(String(reference.url || ""))) {
      pass(`Official reference is HTTPS: ${reference.name}.`);
    } else {
      block("Official reference entries must include name and HTTPS url.");
    }
    requireArray(reference.appliesTo, `Official reference ${reference.name || "unknown"} appliesTo`, 1);
  }

  requireIncludes(template.evidenceRules?.repositoryPolicy, "sanitized", "Evidence repository policy requires sanitized material.");
  requireArray(template.evidenceRules?.doNotStore, "Evidence do-not-store rules", 5);
  requireArray(template.evidenceRules?.requiredRedactions, "Evidence redaction rules", 4);
  requireIncludes(template.evidenceRules?.fileNaming, "store/evidence/mobile-device-qa/", "Evidence file naming points to the mobile QA evidence folder.");

  const requiredEnvironments = Array.isArray(template.requiredEnvironments) ? template.requiredEnvironments : [];
  requireArray(requiredEnvironments, "Required environments", 4);
  for (const id of ["public-mobile-web", "review-account", "android-native-build", "ios-native-build"]) {
    if (requiredEnvironments.some((environment) => environment.id === id)) pass(`Required environment exists: ${id}.`);
    else block(`Required environment is missing: ${id}.`);
  }

  if ((template.testPacket?.targetTesterCount || 0) >= 5) pass("Test packet targets at least five testers.");
  else block("Test packet should target at least five testers.");
  if ((template.testPacket?.minimumNonTechnicalTesterCount || 0) >= 3) pass("Test packet includes at least three non-technical testers.");
  else block("Test packet should require at least three non-technical testers.");
  requireText(template.testPacket?.testerBrief, "Test packet tester brief");
  requireText(template.testPacket?.passDefinition, "Test packet pass definition");

  const deviceTargets = Array.isArray(template.deviceEvidenceTargets) ? template.deviceEvidenceTargets : [];
  requireArray(deviceTargets, "Device evidence targets", 5);
  const deviceTargetIds = new Set(deviceTargets.map((target) => target.id));
  for (const id of ["mobile-web-public", "android-chrome-pwa", "ios-safari-pwa", "android-native-app", "ios-native-app"]) {
    if (deviceTargetIds.has(id)) pass(`Device evidence target exists: ${id}.`);
    else block(`Device evidence target is missing: ${id}.`);
  }

  const planDeviceIds = new Set((plan?.deviceMatrix || []).map((device) => device.id));
  for (const target of deviceTargets) {
    requireText(target.id, "Device evidence target id");
    requireArray(target.linkedPlanDevices, `Device target ${target.id || "unknown"} linked plan devices`, 1);
    requireArray(target.minimumEvidence, `Device target ${target.id || "unknown"} minimum evidence`, 3);
    for (const linkedPlanDevice of target.linkedPlanDevices || []) {
      if (planDeviceIds.has(linkedPlanDevice)) pass(`Device target ${target.id} links plan device ${linkedPlanDevice}.`);
      else block(`Device target ${target.id} links unknown plan device ${linkedPlanDevice}.`);
    }
  }

  const suiteById = new Map((plan?.testSuites || []).map((suite) => [suite.id, suite]));
  const caseRows = Array.isArray(template.caseEvidenceRows) ? template.caseEvidenceRows : [];
  requireArray(caseRows, "Case evidence rows", 12);
  let p0Rows = 0;
  for (const row of caseRows) {
    const label = `${row.suiteId || "unknown-suite"}/${row.caseId || "unknown-case"}`;
    if (row.priority === "P0") p0Rows += 1;
    if (suiteById.has(row.suiteId)) {
      pass(`Case evidence row links suite ${row.suiteId}.`);
      const suiteCases = suiteById.get(row.suiteId)?.cases || [];
      if (suiteCases.some((testCase) => testCase.id === row.caseId)) pass(`Case evidence row links test case ${label}.`);
      else block(`Case evidence row links unknown test case ${label}.`);
    } else {
      block(`Case evidence row links unknown suite ${row.suiteId}.`);
    }
    requireArray(row.requiredTargets, `Case evidence row ${label} required targets`, 1);
    for (const target of row.requiredTargets || []) {
      if (deviceTargetIds.has(target)) pass(`Case evidence row ${label} targets ${target}.`);
      else block(`Case evidence row ${label} targets unknown device evidence target ${target}.`);
    }
    requireText(row.status, `Case evidence row ${label} status`);
  }
  if (p0Rows >= 8) pass("Case evidence template covers at least eight P0 rows.");
  else block("Case evidence template should cover at least eight P0 rows.");

  const sample = template.sampleEvidenceRecord || {};
  if (sample.schemaVersion === "mobile-device-qa-result-v1") pass("Sample evidence record schema is present.");
  else block("Sample evidence record schemaVersion should be mobile-device-qa-result-v1.");
  requireIncludes(sample.publicOrigin, "https://www.zkraiflow.top", "Sample evidence record uses public origin.");
  requireArray(sample.evidenceFiles, "Sample evidence record files", 1);
  requireArray(template.closeoutGates, "Mobile QA evidence closeout gates", 5);
  requireArray(template.closeoutCommands, "Mobile QA evidence closeout commands", 5);

  const scripts = packageJson?.scripts || {};
  for (const command of template.closeoutCommands || []) {
    const script = commandScriptName(command);
    if (!script) {
      warn(`Closeout command is manual or external: ${command}.`);
      continue;
    }
    if (scripts[script]) pass(`Closeout command exists: npm run ${script}.`);
    else block(`Closeout command references missing npm script: npm run ${script}.`);
  }
}

if (await fileExists(docPath)) pass("Mobile QA evidence template document exists.");
else block(`Mobile QA evidence template document is missing: ${docPath}.`);

if (docText) {
  for (const marker of [
    "https://www.zkraiflow.top",
    "store/mobile-device-qa-evidence-template.json",
    "npm run mobile:qa:evidence",
    "不要放进仓库",
    "5 位测试者",
    "3 位非技术用户"
  ]) {
    requireIncludes(docText, marker, `Mobile QA evidence template document includes ${marker}`);
  }
}

console.log("Mobile QA evidence template check");
console.log(`Passes: ${passes.length}`);
console.log(`Blockers: ${blockers.length}`);
console.log(`Warnings: ${warnings.length}`);

if (warnings.length) {
  console.log("\nWarnings");
  for (const message of warnings) console.log(`- ${message}`);
}

if (blockers.length) {
  console.error("\nBlockers");
  for (const message of blockers) console.error(`- ${message}`);
  process.exit(1);
}
