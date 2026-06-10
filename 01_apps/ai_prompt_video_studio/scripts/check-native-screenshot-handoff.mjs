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

const handoff = await readJson("store/native-store-screenshot-handoff.json");
const screenshotPlan = await readJson("store/screenshot-plan.json");
const mobileQaPlan = await readJson("store/mobile-device-qa-plan.json");
const packageJson = await readJson("package.json");
const packageScripts = packageJson?.scripts || {};
const docText = await readText("00_docs/NATIVE_STORE_SCREENSHOT_HANDOFF_2026-06-10.md");

if (handoff) {
  if (handoff.schemaVersion === "native-store-screenshot-handoff-v1") pass("Native screenshot handoff schema version is current.");
  else fail("Native screenshot handoff schemaVersion must be native-store-screenshot-handoff-v1.");

  requireValue(handoff.updatedAt, "Native screenshot handoff updatedAt");
  requireIncludes(handoff.status, "blocked-until-native-build", "Native screenshot handoff keeps native screenshots blocked until native builds exist.");
  requireValue(handoff.objective, "Native screenshot handoff objective");
  requireArray(handoff.officialBasis, "Native screenshot official basis", 2);

  for (const basis of handoff.officialBasis || []) {
    if (basis.name && /^https:\/\//i.test(String(basis.url || ""))) pass(`Official basis is linkable: ${basis.name}.`);
    else fail("Official basis entries must include name and HTTPS URL.");
    requireArray(basis.requirements, `Official basis ${basis.name || "unnamed"} requirements`, 2);
  }

  const sourceBaseline = handoff.sourceBaseline || {};
  requireIncludes(sourceBaseline.webScreenshotPlan, "store/screenshot-plan.json", "Native screenshot handoff links the web screenshot plan.");
  requireArray(sourceBaseline.baselineFolders, "Native screenshot baseline folders", 3);
  requireArray(sourceBaseline.baselineRules, "Native screenshot baseline rules", 3);

  const captureSets = Array.isArray(handoff.captureSets) ? handoff.captureSets : [];
  requireArray(captureSets, "Native screenshot capture sets", 4);
  const setIds = new Set(captureSets.map((item) => item.id));
  for (const id of ["ios-iphone-6-9", "google-play-phone", "domestic-android-phone"]) {
    if (setIds.has(id)) pass(`Native screenshot capture set exists: ${id}.`);
    else fail(`Native screenshot capture set is missing: ${id}.`);
  }

  for (const set of captureSets) {
    const label = set.id || "unnamed-set";
    requireValue(set.platform, `Capture set ${label} platform`);
    requireValue(set.store, `Capture set ${label} store`);
    requireValue(set.status, `Capture set ${label} status`);
    requireValue(set.outputFolder, `Capture set ${label} output folder`);
    requireArray(set.requiredScenes, `Capture set ${label} required scenes`, 4);
    requireArray(set.preCaptureGates, `Capture set ${label} pre-capture gates`, 2);

    if (set.platform === "ios") {
      requireArray(set.acceptedPortraitSizes, `Capture set ${label} accepted portrait sizes`, 2);
    }
    if (set.store === "google-play") {
      requireArray(set.acceptedFormats, `Capture set ${label} accepted formats`, 2);
      requireArray(set.dimensionRules, `Capture set ${label} dimension rules`, 3);
    }
  }

  const sceneMap = Array.isArray(handoff.sceneMap) ? handoff.sceneMap : [];
  requireArray(sceneMap, "Native screenshot scene map", 4);
  const sceneIds = new Set(sceneMap.map((scene) => scene.id));
  for (const id of ["home", "create", "assets", "settings"]) {
    if (sceneIds.has(id)) pass(`Native screenshot scene exists: ${id}.`);
    else fail(`Native screenshot scene is missing: ${id}.`);
  }

  for (const scene of sceneMap) {
    const label = scene.id || "unnamed-scene";
    requireValue(scene.title, `Scene ${label} title`);
    requireValue(scene.baseline, `Scene ${label} baseline`);
    if (scene.baseline && await fileExists(scene.baseline)) pass(`Scene ${label} baseline exists: ${scene.baseline}.`);
    else fail(`Scene ${label} baseline is missing: ${scene.baseline}.`);
    requireArray(scene.mustShow, `Scene ${label} must-show checklist`, 2);
    requireArray(scene.mustHide, `Scene ${label} must-hide checklist`, 2);
  }

  requireArray(handoff.manualCaptureSteps, "Native screenshot manual capture steps", 6);
  requireArray(handoff.qualityGates, "Native screenshot quality gates", 3);

  for (const gate of handoff.qualityGates || []) {
    const label = gate.id || "unnamed-gate";
    requireValue(gate.status, `Quality gate ${label} status`);
    requireArray(gate.commands, `Quality gate ${label} commands`, 1);
    for (const command of gate.commands || []) {
      const script = commandScriptName(command);
      if (!script) continue;
      if (packageScripts[script]) pass(`Quality gate ${label} command exists: npm run ${script}.`);
      else fail(`Quality gate ${label} references missing npm script: npm run ${script}.`);
    }
  }

  for (const evidenceFile of handoff.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`Native screenshot evidence exists: ${evidenceFile}.`);
    else fail(`Native screenshot evidence file is missing: ${evidenceFile}.`);
  }
}

if (screenshotPlan) {
  const sets = Array.isArray(screenshotPlan.sets) ? screenshotPlan.sets : [];
  const ids = new Set(sets.map((set) => set.id));
  for (const requiredSet of ["ios-app-store-iphone", "google-play-phone", "domestic-android-store"]) {
    if (ids.has(requiredSet)) pass(`Screenshot plan includes native/store set: ${requiredSet}.`);
    else fail(`Screenshot plan is missing native/store set: ${requiredSet}.`);
  }
}

if (mobileQaPlan) {
  const suiteIds = new Set((mobileQaPlan.testSuites || []).map((suite) => suite.id));
  for (const requiredSuite of ["android-native", "ios-native", "store-screenshots"]) {
    if (suiteIds.has(requiredSuite)) pass(`Mobile QA plan includes ${requiredSuite}.`);
    else fail(`Mobile QA plan is missing ${requiredSuite}.`);
  }
}

if (docText) {
  for (const marker of [
    "原生商店截图交接方案",
    "1260x2736",
    "1320x2868",
    "1080x1920",
    "npm run screenshots:native-plan",
    "store/screenshots/google-play-phone"
  ]) {
    requireIncludes(docText, marker, `Native screenshot runbook includes ${marker}`);
  }
} else {
  fail("Native screenshot runbook is missing: 00_docs/NATIVE_STORE_SCREENSHOT_HANDOFF_2026-06-10.md.");
}

if (!packageScripts["screenshots:native-plan"]) fail("package.json should define npm run screenshots:native-plan.");

console.log("Native store screenshot handoff check");
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
