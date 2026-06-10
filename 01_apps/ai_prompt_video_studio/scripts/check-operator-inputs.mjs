import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const strict = process.argv.includes("--strict");
const passes = [];
const warnings = [];
const blockers = [];

const requiredGroupIds = [
  "contact-and-support",
  "review-demo-account",
  "legal-and-operator",
  "production-runtime",
  "native-store-packaging",
  "china-distribution"
];

const allowedStatuses = new Set([
  "collecting-owner-inputs",
  "waiting-for-owner-input",
  "pending-real-credentials",
  "drafting",
  "pending-runtime-verification",
  "waiting-for-toolchain",
  "domain-provided-filing-pending",
  "ready",
  "verified"
]);

function pass(message) {
  passes.push(message);
}

function warn(message) {
  warnings.push(message);
}

function block(message) {
  blockers.push(message);
}

function resolveProjectPath(relativePath) {
  if (String(relativePath).startsWith("00_docs/")) return path.join(workspaceRoot, relativePath);
  return path.join(appRoot, relativePath);
}

async function fileExists(relativePath) {
  try {
    const info = await stat(resolveProjectPath(relativePath));
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(resolveProjectPath(relativePath), "utf8"));
  } catch (error) {
    block(`${relativePath} is missing or invalid JSON: ${error.message}`);
    return null;
  }
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function compact(value) {
  return String(value || "").trim();
}

function isPlaceholder(value) {
  const text = compact(value);
  return !text || /^TODO_/i.test(text) || /TODO_|<secret>|<account>|pending|not-started/i.test(text);
}

function checkStatus(status, label) {
  const text = compact(status);
  if (!text) {
    block(`${label} is missing status.`);
    return;
  }
  if (!allowedStatuses.has(text)) {
    warn(`${label} has non-standard status: ${text}.`);
    return;
  }
  if (["ready", "verified"].includes(text)) pass(`${label} is ${text}.`);
  else warn(`${label} is ${text}.`);
}

function npmScriptFromCommand(command) {
  const match = String(command || "").match(/(?:^|\s)npm run ([^\s]+)/);
  return match?.[1] || null;
}

function checkVerificationCommands(commands, packageJson, label) {
  if (!Array.isArray(commands) || !commands.length) {
    block(`${label} must declare verification commands.`);
    return;
  }
  for (const command of commands) {
    const script = npmScriptFromCommand(command);
    if (!script) {
      pass(`${label} includes a manual verification step: ${command}.`);
      continue;
    }
    if (packageJson?.scripts?.[script]) pass(`${label} references npm script ${script}.`);
    else block(`${label} references missing npm script ${script}: ${command}.`);
  }
}

function checkNoSecretLikeValue(value, label) {
  const text = compact(value);
  if (!text) return;
  if (/^(sk-|ak-|pk_live_|ghp_|xoxb-|AIza|eyJ)/.test(text) || text.length > 80 && /[A-Za-z0-9_-]{40,}/.test(text)) {
    block(`${label} looks like a real secret. Store only a secret reference, not the secret itself.`);
  }
}

function getSubmissionValue(submission, pointer) {
  const map = {
    "store/submission-readiness.json#/app/contactEmail": submission?.app?.contactEmail,
    "store/submission-readiness.json#/app/contactPhone": submission?.app?.contactPhone,
    "store/submission-readiness.json#/china/operatorName": submission?.china?.operatorName,
    "store/submission-readiness.json#/china/icpFilingNumber": submission?.china?.icpFilingNumber,
    "store/submission-readiness.json#/china/appFilingNumber": submission?.china?.appFilingNumber,
    "store/submission-readiness.json#/china/filingDisplayLocation": submission?.china?.filingDisplayLocation
  };
  return map[pointer];
}

function checkField(field, group, submission, packageJson) {
  const label = `${group.id}/${field?.id || "unknown-field"}`;
  if (!isObject(field)) {
    block(`${group.id} has a non-object field.`);
    return;
  }
  if (field.id && field.label && typeof field.required === "boolean") pass(`${label} has identity fields.`);
  else block(`${label} needs id, label, and required.`);

  if (field.currentValue !== undefined) {
    checkNoSecretLikeValue(field.currentValue, label);
    if (field.required && isPlaceholder(field.currentValue)) {
      warn(`${label} still needs owner input: ${field.currentValue || "empty"}.`);
    } else if (field.currentValue) {
      pass(`${label} has a current value.`);
    }
  } else if (field.required) {
    warn(`${label} is required but has no currentValue recorded.`);
  }

  if (field.currentValueSource) {
    const submissionValue = getSubmissionValue(submission, field.currentValueSource);
    if (submissionValue === undefined) {
      warn(`${label} currentValueSource is not mapped by the operator input checker: ${field.currentValueSource}.`);
    } else if (submissionValue === field.currentValue) {
      pass(`${label} matches ${field.currentValueSource}.`);
    } else {
      warn(`${label} currentValue (${field.currentValue}) does not match ${field.currentValueSource} (${submissionValue}).`);
    }
  }

  if (field.targetFormat) pass(`${label} explains the target format.`);
  else warn(`${label} should explain the target format.`);

  if (Array.isArray(field.writeTo) && field.writeTo.length) pass(`${label} lists destinations to update.`);
  else block(`${label} must list destinations to update.`);

  checkVerificationCommands(field.verification, packageJson, label);

  if (Array.isArray(field.doNotStore)) pass(`${label} declares secret/data handling guidance.`);
  else warn(`${label} should declare doNotStore guidance.`);
}

const register = await readJson("store/operator-inputs-register.json");
const submission = await readJson("store/submission-readiness.json");
const packageJson = await readJson("package.json");

if (packageJson?.scripts?.["owner:brief"]) {
  pass("Owner quick input and production env shortlist generator is exposed as owner:brief.");
} else {
  block("package.json must expose owner:brief for regenerating owner and production env shortlists.");
}

if (packageJson?.scripts?.["owner:form"]) {
  pass("Owner input collection form generator is exposed as owner:form.");
} else {
  block("package.json must expose owner:form for regenerating the owner input collection form.");
}

if (await fileExists("00_docs/OWNER_QUICK_INPUTS_2026-06-10.md")) {
  pass("Owner quick input shortlist exists.");
} else {
  block("00_docs/OWNER_QUICK_INPUTS_2026-06-10.md is missing.");
}

if (await fileExists("00_docs/PRODUCTION_ENV_PRESET_CHECKLIST_2026-06-10.md")) {
  pass("Production environment preset checklist exists.");
} else {
  block("00_docs/PRODUCTION_ENV_PRESET_CHECKLIST_2026-06-10.md is missing.");
}

if (await fileExists("00_docs/OWNER_INPUT_COLLECTION_FORM_2026-06-10.md")) {
  pass("Owner input collection form exists.");
} else {
  block("00_docs/OWNER_INPUT_COLLECTION_FORM_2026-06-10.md is missing.");
}

if (await fileExists("00_docs/OPERATOR_INPUTS_HANDOFF_2026-06-10.md")) {
  pass("Operator inputs handoff document exists.");
} else {
  block("00_docs/OPERATOR_INPUTS_HANDOFF_2026-06-10.md is missing.");
}

if (register) {
  if (register.schemaVersion === "operator-inputs-register-v1") pass("Operator inputs register schema version is current.");
  else block("Operator inputs register schemaVersion must be operator-inputs-register-v1.");

  if (register.updatedAt) pass("Operator inputs register has updatedAt.");
  else block("Operator inputs register is missing updatedAt.");

  checkStatus(register.status, "Operator inputs register");

  if (/^https:\/\//.test(compact(register.publicOrigin))) pass("Operator inputs register has a public HTTPS origin.");
  else block("Operator inputs register needs publicOrigin as HTTPS.");

  if (Array.isArray(register.rules) && register.rules.some((rule) => /Do not store real passwords/i.test(rule))) {
    pass("Operator inputs register includes no-secrets rule.");
  } else {
    block("Operator inputs register must explicitly forbid storing real secrets.");
  }

  const groups = Array.isArray(register.inputGroups) ? register.inputGroups : [];
  const groupIds = new Set(groups.map((group) => group.id));
  for (const id of requiredGroupIds) {
    if (groupIds.has(id)) pass(`Operator inputs register includes ${id}.`);
    else block(`Operator inputs register is missing ${id}.`);
  }

  for (const group of groups) {
    if (!isObject(group)) {
      block("Operator input group must be an object.");
      continue;
    }
    const label = `Group ${group.id || "unknown"}`;
    if (group.id && group.title && group.owner) pass(`${label} has identity fields.`);
    else block(`${label} needs id, title, and owner.`);
    checkStatus(group.status, label);
    if (group.releaseImpact) pass(`${label} documents release impact.`);
    else warn(`${label} should document release impact.`);
    const fields = Array.isArray(group.fields) ? group.fields : [];
    if (fields.length) pass(`${label} has ${fields.length} fields.`);
    else block(`${label} must include fields.`);
    for (const field of fields) checkField(field, group, submission, packageJson);
  }

  checkVerificationCommands(register.closeoutCommands, packageJson, "Operator closeout");
}

console.log("Operator inputs check");
console.log(`Passes: ${passes.length}`);
console.log(`Blockers: ${blockers.length}`);
console.log(`Warnings: ${warnings.length}`);

if (blockers.length) {
  console.log("\nBlockers");
  for (const message of blockers) console.log(`- ${message}`);
}

if (warnings.length) {
  console.log("\nWarnings");
  for (const message of warnings) console.log(`- ${message}`);
}

if (blockers.length || (strict && warnings.length)) process.exit(1);
