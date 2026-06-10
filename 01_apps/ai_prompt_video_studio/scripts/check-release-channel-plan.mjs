import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const planPath = path.join(appRoot, "store", "release-channel-plan.json");
const packagePath = path.join(appRoot, "package.json");
const passes = [];
const warnings = [];
const blockers = [];

function appPath(relativePath) {
  return path.join(appRoot, relativePath);
}

function workspacePath(relativePath) {
  return path.join(workspaceRoot, relativePath);
}

function resolvePath(relativePath) {
  if (relativePath.startsWith("00_docs/")) return workspacePath(relativePath);
  return appPath(relativePath);
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    blockers.push(`${label} is missing or invalid JSON: ${error.message}`);
    return null;
  }
}

async function fileExists(relativePath) {
  try {
    const info = await stat(resolvePath(relativePath));
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

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function isNativeReadyStatus(status) {
  const value = String(status || "");
  if (/waiting|pending|blocked|gate|draft|internal-ready/i.test(value)) return false;
  return /approved|released|submitted|external-ready/i.test(value);
}

function isWaitingStatus(status) {
  return /waiting|pending|blocked|gate|draft|internal-ready/i.test(String(status || ""));
}

const plan = await readJson(planPath, "Release channel plan");
const packageJson = await readJson(packagePath, "package.json");

if (plan) {
  if (plan.schemaVersion === "app-release-channel-plan-v1") {
    pass("Release channel plan schema is current.");
  } else {
    block("Release channel plan schemaVersion must be app-release-channel-plan-v1.");
  }

  if (plan.updatedAt === "2026-06-10") {
    pass("Release channel plan has the current review date.");
  } else {
    warn("Release channel plan review date should be refreshed before final release.");
  }

  if (plan.publicOrigin === "https://www.zkraiflow.top" && isHttpsUrl(plan.publicOrigin)) {
    pass("Release channel plan uses the public HTTPS origin.");
  } else {
    block("Release channel plan must use https://www.zkraiflow.top as the public origin.");
  }

  const order = Array.isArray(plan.recommendedOrder) ? plan.recommendedOrder : [];
  if (order[0] === "mobile-web" && order[1] === "pwa") {
    pass("Recommended release order starts with mobile web and PWA.");
  } else {
    block("Recommended release order must start with mobile-web then pwa.");
  }

  const basis = Array.isArray(plan.officialBasis) ? plan.officialBasis : [];
  const basisUrls = new Set(basis.map((item) => item.url));
  for (const requiredUrl of [
    "https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable",
    "https://capacitorjs.com/docs/basics/workflow",
    "https://developer.apple.com/app-store/review/guidelines/#minimum-functionality",
    "https://support.google.com/googleplay/android-developer/answer/10787469"
  ]) {
    if (basisUrls.has(requiredUrl)) pass(`Official basis is tracked: ${requiredUrl}`);
    else block(`Official basis is missing: ${requiredUrl}`);
  }

  const channels = Array.isArray(plan.channels) ? plan.channels : [];
  const channelIds = new Set(channels.map((channel) => channel.id));
  for (const requiredId of ["mobile-web", "pwa", "capacitor-android", "capacitor-ios", "domestic-android"]) {
    if (channelIds.has(requiredId)) pass(`Release channel exists: ${requiredId}`);
    else block(`Release channel is missing: ${requiredId}`);
  }

  for (const channel of channels) {
    if (!channel.id || !channel.title) {
      block("Each release channel must have id and title.");
      continue;
    }
    if (Number.isInteger(channel.stage) && channel.stage >= 1) {
      pass(`${channel.id}: stage is numbered.`);
    } else {
      block(`${channel.id}: stage must be a positive integer.`);
    }
    if (channel.status) {
      pass(`${channel.id}: status is ${channel.status}.`);
    } else {
      block(`${channel.id}: status is missing.`);
    }
    if (channel.owner) {
      pass(`${channel.id}: owner is assigned.`);
    } else {
      block(`${channel.id}: owner is missing.`);
    }
    if (channel.entryUrl) {
      pass(`${channel.id}: entry target is documented.`);
    } else {
      warn(`${channel.id}: entry target is missing.`);
    }

    const evidence = Array.isArray(channel.mustHaveEvidence) ? channel.mustHaveEvidence : [];
    if (evidence.length >= 3) {
      pass(`${channel.id}: has at least three evidence files.`);
    } else {
      block(`${channel.id}: should list at least three evidence files.`);
    }
    for (const evidenceFile of evidence) {
      if (await fileExists(evidenceFile)) pass(`${channel.id}: evidence exists ${evidenceFile}.`);
      else block(`${channel.id}: evidence file is missing ${evidenceFile}.`);
    }

    const commands = Array.isArray(channel.verificationCommands) ? channel.verificationCommands : [];
    if (commands.length >= 3) {
      pass(`${channel.id}: has verification commands.`);
    } else {
      block(`${channel.id}: should list at least three verification commands.`);
    }
    for (const command of commands) {
      const match = /^npm run ([\w:-]+)$/.exec(String(command));
      if (!match) continue;
      if (packageJson?.scripts?.[match[1]]) pass(`${channel.id}: npm script exists for ${command}.`);
      else block(`${channel.id}: npm script is missing for ${command}.`);
    }

    const gates = Array.isArray(channel.openGates) ? channel.openGates : [];
    if (isNativeReadyStatus(channel.status) && gates.length) {
      block(`${channel.id}: cannot be ready while open gates remain.`);
    } else if (gates.length) {
      warn(`${channel.id}: ${gates.length} open gate(s) remain before full external release.`);
    } else if (isWaitingStatus(channel.status)) {
      warn(`${channel.id}: status indicates follow-up but no open gates are documented.`);
    } else {
      pass(`${channel.id}: no open gates listed.`);
    }
  }

  const gates = Array.isArray(plan.crossChannelGates) ? plan.crossChannelGates : [];
  if (gates.length >= 3) {
    pass("Cross-channel launch gates are documented.");
  } else {
    block("At least three cross-channel launch gates should be documented.");
  }
  for (const gate of gates) {
    if (!gate.id || !gate.status) {
      block("Each cross-channel gate must have id and status.");
      continue;
    }
    const requiredBefore = Array.isArray(gate.requiredBefore) ? gate.requiredBefore : [];
    if (requiredBefore.length) pass(`${gate.id}: required channels are listed.`);
    else block(`${gate.id}: required channels are missing.`);
    for (const channelId of requiredBefore) {
      if (channelIds.has(channelId)) pass(`${gate.id}: references known channel ${channelId}.`);
      else block(`${gate.id}: references unknown channel ${channelId}.`);
    }
    for (const evidenceFile of gate.evidence || []) {
      if (await fileExists(evidenceFile)) pass(`${gate.id}: evidence exists ${evidenceFile}.`);
      else block(`${gate.id}: evidence file is missing ${evidenceFile}.`);
    }
  }
}

if (!packageJson?.scripts?.["release:channels"]) {
  block("package.json should expose npm run release:channels.");
} else {
  pass("package.json exposes npm run release:channels.");
}

console.log("Release channel plan check");
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
