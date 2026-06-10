import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = findWorkspaceRoot(appRoot);
const passes = [];
const warnings = [];
const blockers = [];

function findWorkspaceRoot(startDir) {
  let current = path.resolve(startDir);
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "00_docs")) && existsSync(path.join(current, "01_apps"))) return current;
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
    blockers.push(`${relativePath} is missing.`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    blockers.push(`${relativePath} is invalid JSON: ${error.message}`);
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

function commandScript(command) {
  const match = /^npm run ([\w:-]+)$/.exec(String(command || ""));
  return match?.[1] || "";
}

function looksSecretLike(value) {
  const text = String(value || "");
  return /sk-[A-Za-z0-9_-]{20,}/.test(text)
    || /AIza[A-Za-z0-9_-]{20,}/.test(text)
    || /ghp_[A-Za-z0-9_]{20,}/.test(text)
    || /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(text)
    || /cookie\s*[:=]/i.test(text)
    || /password\s*[:=]\s*(?!<secret>|password-manager|redacted)/i.test(text);
}

const plan = await readJson("store/pwa-production-smoke-plan.json");
const releaseChannels = await readJson("store/release-channel-plan.json");
const packageJson = await readJson("package.json");
const manifest = await readJson("public/manifest.webmanifest");
const serviceWorker = await readText("public/sw.js");
const appSource = await readText("src/App.jsx");
const offlinePage = await readText("public/offline.html");

if (plan) {
  if (plan.schemaVersion === "pwa-production-smoke-plan-v1") pass("PWA production smoke plan schema is current.");
  else block("PWA production smoke plan schemaVersion must be pwa-production-smoke-plan-v1.");

  if (plan.publicOrigin === "https://www.zkraiflow.top") pass("PWA production smoke plan uses the public origin.");
  else block("PWA production smoke plan must use https://www.zkraiflow.top.");

  if (/pending-production-device|planned/.test(String(plan.status || ""))) {
    pass(`PWA production smoke plan status is ${plan.status}.`);
  } else {
    warn(`PWA production smoke plan status should describe the current pending production-device state, got ${plan.status || "missing"}.`);
  }

  const basisUrls = new Set((plan.officialBasis || []).map((item) => item.url));
  for (const url of [
    "https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable",
    "https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API",
    "https://web.dev/learn/pwa/web-app-manifest#icons"
  ]) {
    if (basisUrls.has(url)) pass(`PWA production smoke plan cites ${url}.`);
    else block(`PWA production smoke plan is missing official basis ${url}.`);
  }

  const commands = plan.preflightCommands || [];
  for (const command of ["npm run pwa:check", "npm run public:check", "npm run pwa:public-smoke", "npm run mobile:check", "npm run cloud:smoke"]) {
    if (commands.includes(command)) pass(`PWA production smoke plan includes ${command}.`);
    else block(`PWA production smoke plan must include ${command}.`);
  }
  for (const command of commands) {
    const script = commandScript(command);
    if (!script) continue;
    if (packageJson?.scripts?.[script]) pass(`PWA preflight script exists for ${command}.`);
    else block(`PWA preflight command references missing script: ${command}.`);
  }

  const publicAssetSmoke = plan.publicAssetSmokeEvidence || {};
  if (publicAssetSmoke.status === "passed") pass("PWA public asset smoke evidence is marked passed.");
  else block("PWA public asset smoke evidence must be marked passed after live verification.");
  if (publicAssetSmoke.publicOrigin === "https://www.zkraiflow.top") pass("PWA public asset smoke evidence uses the production origin.");
  else block("PWA public asset smoke evidence must use https://www.zkraiflow.top.");
  if (publicAssetSmoke.command === "npm run pwa:public-smoke") pass("PWA public asset smoke evidence records npm run pwa:public-smoke.");
  else block("PWA public asset smoke evidence should record npm run pwa:public-smoke.");
  if (Number(publicAssetSmoke.passes) >= 31 && Number(publicAssetSmoke.blockers) === 0 && Number(publicAssetSmoke.warnings) === 0) {
    pass("PWA public asset smoke evidence records a clean live smoke result.");
  } else {
    block("PWA public asset smoke evidence should record at least 31 passes, 0 blockers, and 0 warnings.");
  }
  if (publicAssetSmoke.evidenceFile && await fileExists(publicAssetSmoke.evidenceFile)) {
    pass(`PWA public asset smoke evidence file exists: ${publicAssetSmoke.evidenceFile}.`);
    const smokeEvidence = await readJson(publicAssetSmoke.evidenceFile);
    if (smokeEvidence) {
      if (smokeEvidence.schemaVersion === "sanitized-public-smoke-evidence-v1") pass("PWA public smoke evidence schema is current.");
      else block("PWA public smoke evidence schemaVersion must be sanitized-public-smoke-evidence-v1.");
      if (smokeEvidence.publicOrigin === "https://www.zkraiflow.top") pass("PWA public smoke evidence targets the production origin.");
      else block("PWA public smoke evidence must target https://www.zkraiflow.top.");
      if (smokeEvidence.command === "npm run pwa:public-smoke") pass("PWA public smoke evidence records the verification command.");
      else block("PWA public smoke evidence should record npm run pwa:public-smoke.");
      if (Number(smokeEvidence.result?.passes) >= 31 && Number(smokeEvidence.result?.blockers) === 0 && Number(smokeEvidence.result?.warnings) === 0) {
        pass("PWA public smoke evidence contains clean pass/blocker/warning counts.");
      } else {
        block("PWA public smoke evidence should contain at least 31 passes, 0 blockers, and 0 warnings.");
      }
      if (Array.isArray(smokeEvidence.verifiedPublicAssets) && smokeEvidence.verifiedPublicAssets.length >= 6) {
        pass("PWA public smoke evidence lists all required public assets.");
      } else {
        block("PWA public smoke evidence should list the manifest, service worker, offline page, and icons.");
      }
      if (Array.isArray(smokeEvidence.remainingGates) && smokeEvidence.remainingGates.length >= 4) {
        pass("PWA public smoke evidence keeps remaining production gates explicit.");
      } else {
        block("PWA public smoke evidence should keep remaining device/account gates explicit.");
      }
      if (looksSecretLike(JSON.stringify(smokeEvidence))) block("PWA public smoke evidence appears to contain secret-like material.");
      else pass("PWA public smoke evidence does not contain obvious secret-like material.");
    }
  } else {
    block("PWA public asset smoke evidenceFile is missing or empty.");
  }

  const deviceTemplate = plan.deviceInstallEvidenceTemplate || {};
  if (deviceTemplate.status === "template-ready-waiting-production-device-results") {
    pass("PWA production smoke plan links the device install evidence template.");
  } else {
    block("PWA production smoke plan should link deviceInstallEvidenceTemplate.status as template-ready-waiting-production-device-results.");
  }
  for (const [key, expected] of [
    ["templateFile", "store/pwa-device-install-evidence-template.json"],
    ["runbook", "00_docs/PWA_DEVICE_INSTALL_EVIDENCE_TEMPLATE_2026-06-10.md"],
    ["checkScript", "scripts/check-pwa-device-install-evidence-template.mjs"],
    ["checkCommand", "npm run pwa:device-template"]
  ]) {
    if (deviceTemplate[key] === expected) pass(`PWA production smoke plan device evidence ${key} links ${expected}.`);
    else block(`PWA production smoke plan device evidence ${key} should be ${expected}.`);
  }
  for (const linkedTemplateFile of [deviceTemplate.templateFile, deviceTemplate.runbook, deviceTemplate.checkScript]) {
    if (await fileExists(linkedTemplateFile)) pass(`PWA device evidence template file exists: ${linkedTemplateFile}.`);
    else block(`PWA device evidence template file is missing: ${linkedTemplateFile}.`);
  }

  const assetPaths = new Set((plan.requiredPublicAssets || []).map((asset) => asset.path));
  for (const pathName of ["/manifest.webmanifest", "/sw.js", "/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png"]) {
    if (assetPaths.has(pathName)) pass(`PWA required public asset is planned: ${pathName}.`);
    else block(`PWA required public asset is missing from plan: ${pathName}.`);
  }

  const deviceIds = new Set((plan.deviceMatrix || []).map((device) => device.id));
  for (const id of ["android-chrome", "ios-safari"]) {
    if (deviceIds.has(id)) pass(`PWA device smoke matrix includes ${id}.`);
    else block(`PWA device smoke matrix must include ${id}.`);
  }

  const caseIds = new Set((plan.manualTestCases || []).map((testCase) => testCase.id));
  for (const id of ["public-asset-preflight", "android-install", "ios-add-to-home-screen", "offline-navigation", "update-banner", "authenticated-pwa-session"]) {
    if (caseIds.has(id)) pass(`PWA manual test case exists: ${id}.`);
    else block(`PWA manual test case is missing: ${id}.`);
  }

  for (const testCase of plan.manualTestCases || []) {
    if (testCase.priority === "P0" && /pending|blocked/.test(String(testCase.status || ""))) {
      warn(`${testCase.id} remains ${testCase.status}; keep PWA external launch gated.`);
    } else {
      pass(`${testCase.id} status is ${testCase.status || "documented"}.`);
    }
    if (Array.isArray(testCase.steps) && testCase.steps.length >= 2 && testCase.expectedResult) {
      pass(`${testCase.id} has actionable steps and expected result.`);
    } else {
      block(`${testCase.id} must include actionable steps and expected result.`);
    }
  }

  for (const evidenceFile of plan.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`PWA evidence exists: ${evidenceFile}.`);
    else block(`PWA evidence file is missing: ${evidenceFile}.`);
  }
}

if (manifest) {
  if (manifest.display === "standalone") pass("Manifest display is standalone.");
  else block("Manifest display must be standalone.");
  if (manifest.start_url === "/" && manifest.scope === "/") pass("Manifest start_url and scope are root.");
  else block("Manifest start_url and scope should both be /.");
  if ((manifest.icons || []).some((icon) => String(icon.purpose || "").includes("maskable"))) {
    pass("Manifest includes a maskable icon.");
  } else {
    block("Manifest must include a maskable icon.");
  }
}

if (/addEventListener\(\s*["']message["']/.test(serviceWorker) && /SKIP_WAITING/.test(serviceWorker)) {
  pass("Service worker waits for an explicit SKIP_WAITING message before user-confirmed update activation.");
} else {
  block("Service worker must support SKIP_WAITING via a message event.");
}

if (/self\.skipWaiting\(\)/.test(serviceWorker.replace(/if\s*\([^)]*SKIP_WAITING[^)]*\)\s*\{[^}]*self\.skipWaiting\(\);?[^}]*\}/s, ""))) {
  block("Service worker should not unconditionally call skipWaiting during install.");
} else {
  pass("Service worker does not unconditionally skip waiting during install.");
}

if (/getRegistration\(\)/.test(appSource) && /registration\.waiting\.postMessage\(\{\s*type:\s*["']SKIP_WAITING["']/.test(appSource)) {
  pass("App update button activates the waiting service worker before reload.");
} else {
  block("App update button should message the waiting service worker before reload.");
}

if (/controllerchange/.test(appSource) && /reloadOnce/.test(appSource)) {
  pass("App update flow reloads once after service worker controller change.");
} else {
  block("App update flow should reload once after service worker controller change.");
}

if (/offline|绂荤嚎|离线/i.test(offlinePage)) pass("Offline page communicates offline state.");
else block("Offline page must communicate offline state.");

const pwaChannel = (releaseChannels?.channels || []).find((channel) => channel.id === "pwa");
if (pwaChannel?.mustHaveEvidence?.includes("store/pwa-production-smoke-plan.json")) {
  pass("Release channel plan links the PWA production smoke plan.");
} else {
  block("PWA release channel must link store/pwa-production-smoke-plan.json as evidence.");
}
if (pwaChannel?.verificationCommands?.includes("npm run pwa:prod-plan")) {
  pass("Release channel plan includes npm run pwa:prod-plan for PWA verification.");
} else {
  block("PWA release channel should include npm run pwa:prod-plan.");
}

if (pwaChannel?.verificationCommands?.includes("npm run pwa:public-smoke")) {
  pass("Release channel plan includes npm run pwa:public-smoke for live PWA verification.");
} else {
  block("PWA release channel should include npm run pwa:public-smoke.");
}

if (packageJson?.scripts?.["pwa:prod-plan"]) pass("package.json exposes npm run pwa:prod-plan.");
else block("package.json must expose npm run pwa:prod-plan.");
if (packageJson?.scripts?.["pwa:device-template"]) pass("package.json exposes npm run pwa:device-template.");
else block("package.json must expose npm run pwa:device-template.");
if (packageJson?.scripts?.["pwa:public-smoke"]) pass("package.json exposes npm run pwa:public-smoke.");
else block("package.json must expose npm run pwa:public-smoke.");

console.log("PWA production smoke plan check");
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
