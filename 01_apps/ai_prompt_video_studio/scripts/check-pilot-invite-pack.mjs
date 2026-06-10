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
    || /password\s*[:=]\s*(?!TODO_|<secret>|password-manager|review account passwords|passwords)/i.test(text);
}

const packPath = "store/pilot-invite-pack.json";
const docPath = "00_docs/PILOT_INVITE_PACK_2026-06-10.md";
const pack = await readJson(packPath);
const pilotReadiness = await readJson("store/pilot-release-readiness.json");
const packageJson = await readJson("package.json");
const docText = await readText(docPath);
const packageScripts = packageJson?.scripts || {};

if (pack) {
  if (pack.schemaVersion === "pilot-invite-pack-v1") pass("Pilot invite pack schema version is current.");
  else fail("Pilot invite pack schemaVersion must be pilot-invite-pack-v1.");

  requireValue(pack.updatedAt, "Pilot invite pack updatedAt");
  requireIncludes(pack.status, "waiting-named-pilot-owners", "Pilot invite pack keeps named owners unresolved.");
  requireIncludes(pack.publicOrigin, "https://www.zkraiflow.top", "Pilot invite pack uses the public production domain.");
  requireValue(pack.purpose, "Pilot invite pack purpose");

  if (looksSecretLike(JSON.stringify(pack))) fail("Pilot invite pack appears to contain secret-like material.");
  else pass("Pilot invite pack does not contain obvious secret-like material.");

  const officialReferences = Array.isArray(pack.officialReferences) ? pack.officialReferences : [];
  requireArray(officialReferences, "Pilot invite official references", 5);
  for (const reference of officialReferences) {
    if (reference.name && /^https:\/\//i.test(String(reference.url || ""))) pass(`Official reference is HTTPS: ${reference.name}.`);
    else fail("Official references must include name and HTTPS URL.");
    requireArray(reference.appliesTo, `Official reference ${reference.name || "unknown"} appliesTo`, 1);
  }

  const channelIds = new Set((pack.pilotChannels || []).map((channel) => channel.id));
  requireArray(pack.pilotChannels, "Pilot channels", 4);
  for (const channelId of ["mobile-web", "pwa", "testflight-ios", "google-play-testing"]) {
    if (channelIds.has(channelId)) pass(`Pilot channel exists: ${channelId}.`);
    else fail(`Pilot channel is missing: ${channelId}.`);
  }
  const nativeStatuses = JSON.stringify(pack.pilotChannels || []);
  for (const marker of ["blocked-until-ios-build-and-signing", "blocked-until-android-build-and-signing"]) {
    requireIncludes(nativeStatuses, marker, `Pilot invite pack keeps native beta gated by ${marker}.`);
  }

  requireArray(pack.pilotRoles, "Pilot roles", 3);
  for (const roleId of ["pilot-owner", "support-reviewer", "rollback-owner"]) {
    const role = (pack.pilotRoles || []).find((item) => item.id === roleId);
    if (role) {
      pass(`Pilot role exists: ${roleId}.`);
      requireIncludes(role.status, "waiting-owner-input", `Pilot role ${roleId} waits for owner input.`);
      requireArray(role.responsibilities, `Pilot role ${roleId} responsibilities`, 3);
    } else {
      fail(`Pilot role is missing: ${roleId}.`);
    }
  }

  for (const command of [
    "npm run pilot:invite-pack",
    "npm run pilot:readiness",
    "npm run pilot:feedback",
    "npm run mobile:qa:evidence",
    "npm run public:check",
    "npm run pwa:public-smoke",
    "npm run release:evidence",
    "npm run product:report"
  ]) {
    if ((pack.preInviteChecklist || []).includes(command)) pass(`Pre-invite checklist includes ${command}.`);
    else fail(`Pre-invite checklist must include ${command}.`);
    const script = commandScriptName(command);
    if (script && packageScripts[script]) pass(`Pre-invite command exists: npm run ${script}.`);
    else if (script) fail(`Pre-invite command references missing npm script: npm run ${script}.`);
  }

  requireValue(pack.testerInviteTemplate?.subject, "Tester invite subject");
  requireArray(pack.testerInviteTemplate?.messageBlocks, "Tester invite message blocks", 5);
  const inviteText = JSON.stringify(pack.testerInviteTemplate || {});
  for (const marker of ["not a public launch", "https://www.zkraiflow.top", "do not upload private"]) {
    requireIncludes(inviteText, marker, `Tester invite text includes ${marker}.`);
  }

  requireArray(pack.testerSafetyNotice, "Tester safety notice", 5);
  requireArray(pack.sessionScript, "Pilot session script", 7);
  for (const step of pack.sessionScript || []) {
    requireValue(step.title, `Session step ${step.step || "unknown"} title`);
    requireValue(step.expectedSignal, `Session step ${step.step || "unknown"} expected signal`);
  }

  requireArray(pack.successMetrics, "Pilot success metrics", 5);
  requireArray(pack.stopRules, "Pilot stop rules", 5);
  const stopRulesText = JSON.stringify(pack.stopRules || []);
  for (const marker of ["Stop inviting testers", "PWA", "signing credentials", "real generation disabled"]) {
    requireIncludes(stopRulesText, marker, `Pilot stop rules include ${marker}.`);
  }

  requireValue(pack.feedbackTriage?.intakePath, "Feedback triage intake path");
  requireValue(pack.feedbackTriage?.p0Definition, "Feedback triage P0 definition");
  requireValue(pack.feedbackTriage?.closeoutRule, "Feedback triage closeout rule");
  requireArray(pack.evidenceOutputs, "Pilot evidence outputs", 4);
  requireArray(pack.closeoutGates, "Pilot closeout gates", 7);
  requireArray(pack.doNotStore, "Pilot invite do-not-store list", 6);

  for (const linkedFile of pack.linkedFiles || []) {
    if (await fileExists(linkedFile)) pass(`Pilot invite linked file exists: ${linkedFile}.`);
    else fail(`Pilot invite linked file is missing: ${linkedFile}.`);
  }
}

const invitePack = pilotReadiness?.invitePack || {};
if (invitePack.status === "template-ready-waiting-named-pilot-owners") pass("Pilot readiness links the invite pack status.");
else fail("Pilot readiness should link the invite pack with template-ready-waiting-named-pilot-owners status.");
for (const [key, expected] of [
  ["file", "store/pilot-invite-pack.json"],
  ["runbook", "00_docs/PILOT_INVITE_PACK_2026-06-10.md"],
  ["checkScript", "scripts/check-pilot-invite-pack.mjs"],
  ["checkCommand", "npm run pilot:invite-pack"]
]) {
  if (invitePack[key] === expected) pass(`Pilot readiness invite pack ${key} links ${expected}.`);
  else fail(`Pilot readiness invite pack ${key} should be ${expected}.`);
}

if (await fileExists(docPath)) pass("Pilot invite runbook exists.");
else fail(`Pilot invite runbook is missing: ${docPath}.`);

if (docText) {
  for (const marker of [
    "https://www.zkraiflow.top",
    "npm run pilot:invite-pack",
    "不是公开发布",
    "不要上传",
    "5 位测试者",
    "P0"
  ]) {
    requireIncludes(docText, marker, `Pilot invite runbook includes ${marker}`);
  }
}

console.log("Pilot invite pack check");
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
