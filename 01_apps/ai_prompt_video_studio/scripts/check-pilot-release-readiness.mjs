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

function looksSecretLike(value) {
  const text = String(value || "");
  return /sk-[A-Za-z0-9_-]{20,}/.test(text)
    || /AIza[A-Za-z0-9_-]{20,}/.test(text)
    || /ghp_[A-Za-z0-9_]{20,}/.test(text)
    || /xox[baprs]-[A-Za-z0-9-]{20,}/.test(text)
    || /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(text)
    || /password\s*[:=]\s*(?!TODO_|<secret>|password-manager|secret ref)/i.test(text);
}

const plan = await readJson("store/pilot-release-readiness.json");
const packageJson = await readJson("package.json");
const blockerRegister = await readJson("store/release-blockers-register.json");
const releaseChannels = await readJson("store/release-channel-plan.json");
const mobileQaPlan = await readJson("store/mobile-device-qa-plan.json");
const invitePack = await readJson("store/pilot-invite-pack.json");
const pwaSmokePlan = await readJson("store/pwa-production-smoke-plan.json");
const submission = await readJson("store/submission-readiness.json");
const operatorInputs = await readJson("store/operator-inputs-register.json");
const releaseEvidence = await readJson("store/release-evidence-register.json");
const docText = await readText("00_docs/PILOT_RELEASE_READINESS_2026-06-10.md");
const packageScripts = packageJson?.scripts || {};

if (plan) {
  if (plan.schemaVersion === "pilot-release-readiness-v1") pass("Pilot release readiness schema version is current.");
  else fail("Pilot release readiness schemaVersion must be pilot-release-readiness-v1.");

  if (plan.status === "pilot-ready-with-manual-production-gates") pass("Pilot release readiness keeps the correct gated pilot status.");
  else fail("Pilot release readiness status must be pilot-ready-with-manual-production-gates.");

  if (plan.publicOrigin === "https://www.zkraiflow.top") pass("Pilot release readiness uses the public production domain.");
  else fail("Pilot release readiness must use https://www.zkraiflow.top.");

  requireValue(plan.objective, "Pilot release readiness objective");
  requireValue(plan.decision?.reason, "Pilot decision reason");
  if (plan.decision?.notAReleaseApproval === true) pass("Pilot decision clearly says it is not a release approval.");
  else fail("Pilot decision must set notAReleaseApproval to true.");

  const linkedInvitePack = plan.invitePack || {};
  if (linkedInvitePack.status === "template-ready-waiting-named-pilot-owners") {
    pass("Pilot release readiness links the invite pack and keeps named pilot owners unresolved.");
  } else {
    fail("Pilot release readiness should link invitePack.status as template-ready-waiting-named-pilot-owners.");
  }
  for (const [key, expected] of [
    ["file", "store/pilot-invite-pack.json"],
    ["runbook", "00_docs/PILOT_INVITE_PACK_2026-06-10.md"],
    ["checkScript", "scripts/check-pilot-invite-pack.mjs"],
    ["checkCommand", "npm run pilot:invite-pack"]
  ]) {
    if (linkedInvitePack[key] === expected) pass(`Pilot release readiness invite pack ${key} links ${expected}.`);
    else fail(`Pilot release readiness invite pack ${key} should be ${expected}.`);
  }
  for (const linkedInviteFile of [linkedInvitePack.file, linkedInvitePack.runbook, linkedInvitePack.checkScript]) {
    if (await fileExists(linkedInviteFile)) pass(`Pilot release readiness invite pack file exists: ${linkedInviteFile}.`);
    else fail(`Pilot release readiness invite pack file is missing: ${linkedInviteFile}.`);
  }

  requireArray(plan.pilotScope?.allowedAudience, "Pilot allowed audience", 3);
  requireArray(plan.pilotScope?.allowedChannels, "Pilot allowed channels", 2);
  requireArray(plan.pilotScope?.allowedCapabilities, "Pilot allowed capabilities", 4);
  requireArray(plan.pilotScope?.notAllowed, "Pilot not-allowed list", 5);

  const allowedChannelIds = new Set((plan.pilotScope?.allowedChannels || []).map((channel) => channel.id));
  for (const channelId of ["mobile-web", "pwa"]) {
    if (allowedChannelIds.has(channelId)) pass(`Pilot allowed channel includes ${channelId}.`);
    else fail(`Pilot allowed channel is missing ${channelId}.`);
  }

  const notAllowedText = JSON.stringify(plan.pilotScope?.notAllowed || []);
  for (const marker of ["public production launch", "App Store", "Google Play", "Do not store"]) {
    requireIncludes(notAllowedText, marker, `Pilot not-allowed list covers ${marker}.`);
  }

  const preflightCommands = plan.preflightCommands || [];
  for (const command of [
    "npm run pilot:invite-pack",
    "npm run pilot:readiness",
    "npm run pilot:feedback",
    "npm run mobile:check",
    "npm run mobile:qa",
    "npm run public:check",
    "npm run pwa:prod-plan",
    "npm run pwa:public-smoke",
    "npm run release:evidence",
    "npm run release:check"
  ]) {
    if (preflightCommands.includes(command)) pass(`Pilot preflight includes ${command}.`);
    else fail(`Pilot preflight must include ${command}.`);
  }

  const requiredGateIds = [
    "public-pages-smoke",
    "mobile-web-ui",
    "pwa-install-smoke",
    "pilot-feedback-loop",
    "auth-session",
    "storage-worker",
    "support-legal",
    "rollback-monitoring",
    "privacy-secrets-safety"
  ];
  const gates = Array.isArray(plan.gates) ? plan.gates : [];
  requireArray(gates, "Pilot gates", requiredGateIds.length);
  const gateIds = new Set(gates.map((gate) => gate.id));
  for (const gateId of requiredGateIds) {
    if (gateIds.has(gateId)) pass(`Pilot gate exists: ${gateId}.`);
    else fail(`Pilot gate is missing: ${gateId}.`);
  }

  for (const gate of gates) {
    const label = gate.id || "unnamed-gate";
    requireValue(gate.title, `Pilot gate ${label} title`);
    requireValue(gate.status, `Pilot gate ${label} status`);
    requireValue(gate.owner, `Pilot gate ${label} owner`);
    requireArray(gate.requiredBefore, `Pilot gate ${label} required-before list`, 1);
    requireArray(gate.commands, `Pilot gate ${label} commands`, 1);
    requireArray(gate.evidence, `Pilot gate ${label} evidence`, 1);
    requireValue(gate.pilotRule, `Pilot gate ${label} rule`);

    for (const command of gate.commands || []) {
      const script = commandScriptName(command);
      if (!script) continue;
      if (packageScripts[script]) pass(`Pilot gate ${label} command exists: npm run ${script}.`);
      else fail(`Pilot gate ${label} references missing npm script: npm run ${script}.`);
    }

    for (const evidenceFile of gate.evidence || []) {
      if (await fileExists(evidenceFile)) pass(`Pilot gate ${label} evidence exists: ${evidenceFile}.`);
      else fail(`Pilot gate ${label} evidence file is missing: ${evidenceFile}.`);
    }
  }

  requireArray(plan.pilotRunbook, "Pilot runbook", 6);
  const runbookText = JSON.stringify(plan.pilotRunbook || []);
  for (const marker of ["LIBTV_DEFAULT_DRY_RUN=true", "PUBLIC_APP_ORIGIN", "password manager", "do not close"]) {
    requireIncludes(runbookText, marker, `Pilot runbook includes ${marker}.`);
  }

  requireArray(plan.doNotStore, "Pilot do-not-store list", 5);
  if (looksSecretLike(JSON.stringify(plan))) fail("Pilot release readiness appears to contain secret-like material.");
  else pass("Pilot release readiness does not contain obvious secret-like material.");

  for (const evidenceFile of plan.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`Pilot evidence exists: ${evidenceFile}.`);
    else fail(`Pilot evidence file is missing: ${evidenceFile}.`);
  }
}

if (invitePack) {
  if (invitePack.schemaVersion === "pilot-invite-pack-v1") pass("Pilot invite pack schema version is current.");
  else fail("Pilot invite pack schemaVersion must be pilot-invite-pack-v1.");
  if (invitePack.status === "template-ready-waiting-named-pilot-owners") pass("Pilot invite pack waits for named pilot owners.");
  else fail("Pilot invite pack should wait for named pilot owners.");
  if (invitePack.publicOrigin === "https://www.zkraiflow.top") pass("Pilot invite pack uses the public production domain.");
  else fail("Pilot invite pack should use https://www.zkraiflow.top.");
  const inviteText = JSON.stringify(invitePack.testerInviteTemplate || {});
  requireIncludes(inviteText, "not a public launch", "Pilot invite text says it is not a public launch.");
  requireIncludes(inviteText, "https://www.zkraiflow.top", "Pilot invite text includes the public origin.");
  requireArray(invitePack.testerSafetyNotice, "Pilot invite tester safety notice", 5);
  requireArray(invitePack.stopRules, "Pilot invite stop rules", 5);
}

if (blockerRegister) {
  if (blockerRegister.summary?.internalPilotBlocked === false) pass("Release blockers allow a controlled internal pilot.");
  else fail("Release blockers must keep internalPilotBlocked false for this pilot plan.");
  if (blockerRegister.summary?.publicLaunchBlocked === true) pass("Release blockers still block public launch.");
  else fail("Release blockers must keep publicLaunchBlocked true until production gates close.");
  if (blockerRegister.summary?.storeSubmissionBlocked === true) pass("Release blockers still block store submission.");
  else fail("Release blockers must keep storeSubmissionBlocked true until store gates close.");
  if (blockerRegister.summary?.nativeStoreBuildBlocked === true) pass("Release blockers still block native store builds.");
  else fail("Release blockers must keep nativeStoreBuildBlocked true until native toolchains and signing are ready.");
}

const releaseChannelIds = new Set((releaseChannels?.channels || []).map((channel) => channel.id));
for (const channelId of ["mobile-web", "pwa"]) {
  if (releaseChannelIds.has(channelId)) pass(`Release channel plan includes ${channelId}.`);
  else fail(`Release channel plan is missing ${channelId}.`);
}

const mobileWebChannel = (releaseChannels?.channels || []).find((channel) => channel.id === "mobile-web");
const pwaChannel = (releaseChannels?.channels || []).find((channel) => channel.id === "pwa");
if ((mobileWebChannel?.verificationCommands || []).includes("npm run pilot:readiness")) pass("Mobile web release channel links pilot readiness.");
else fail("Mobile web release channel should include npm run pilot:readiness.");
if ((pwaChannel?.verificationCommands || []).includes("npm run pilot:readiness")) pass("PWA release channel links pilot readiness.");
else fail("PWA release channel should include npm run pilot:readiness.");

if (mobileQaPlan?.status === "internal-ready-with-manual-gates") pass("Mobile QA plan keeps the correct internal-ready gated status.");
else warn(`Mobile QA plan status is ${mobileQaPlan?.status || "missing"}; confirm it still reflects pilot reality.`);
if (pwaSmokePlan?.status === "planned-pending-production-device-smoke") pass("PWA production smoke plan keeps real-device install evidence pending.");
else warn(`PWA production smoke plan status is ${pwaSmokePlan?.status || "missing"}; confirm it still reflects production install evidence.`);

const pilotRelease = submission?.pilotRelease || {};
if (pilotRelease.status === "pilot-ready-with-manual-production-gates") pass("Submission readiness tracks pilot release status.");
else fail("Submission readiness should track pilotRelease.status as pilot-ready-with-manual-production-gates.");
requireIncludes(pilotRelease.readinessFile, "store/pilot-release-readiness.json", "Submission readiness links pilot readiness file.");
requireIncludes(pilotRelease.runbook, "00_docs/PILOT_RELEASE_READINESS_2026-06-10.md", "Submission readiness links pilot runbook.");
requireIncludes(pilotRelease.checkScript, "scripts/check-pilot-release-readiness.mjs", "Submission readiness links pilot check script.");

if ((operatorInputs?.closeoutCommands || []).includes("npm run pilot:readiness")) pass("Operator input closeout includes npm run pilot:readiness.");
else fail("Operator input closeout should include npm run pilot:readiness.");

if ((releaseEvidence?.verificationCommands || []).includes("npm run pilot:readiness")) pass("Release evidence top-level commands include npm run pilot:readiness.");
else fail("Release evidence should include npm run pilot:readiness.");
if ((releaseEvidence?.evidenceFiles || []).includes("store/pilot-release-readiness.json")) pass("Release evidence file list includes pilot readiness JSON.");
else fail("Release evidence should include store/pilot-release-readiness.json.");

if (docText) {
  for (const marker of [
    "小范围试点",
    "https://www.zkraiflow.top",
    "npm run pilot:readiness",
    "LIBTV_DEFAULT_DRY_RUN=true",
    "不要提交商店审核"
  ]) {
    requireIncludes(docText, marker, `Pilot runbook includes ${marker}`);
  }
} else {
  fail("Pilot runbook is missing: 00_docs/PILOT_RELEASE_READINESS_2026-06-10.md.");
}

if (!packageScripts["pilot:readiness"]) fail("package.json should define npm run pilot:readiness.");

console.log("Pilot release readiness check");
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
