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
  if (relativePath.startsWith("00_docs/") || relativePath === ".gitignore") return path.join(workspaceRoot, relativePath);
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

function requirePattern(source, pattern, label) {
  if (pattern.test(String(source || ""))) {
    pass(label);
    return;
  }
  fail(`${label}: pattern not found.`);
}

function commandScriptName(command) {
  const match = /npm run ([\w:-]+)/.exec(String(command || ""));
  return match?.[1] || "";
}

function hasSecretLikeValue(text) {
  const value = String(text || "");
  return /storePassword\s*=\s*(?!REPLACE_WITH_).{8,}/.test(value)
    || /keyPassword\s*=\s*(?!REPLACE_WITH_).{8,}/.test(value)
    || /-----BEGIN PRIVATE KEY-----/.test(value)
    || /BEGIN CERTIFICATE/.test(value);
}

const handoff = await readJson("store/native-release-signing-handoff.json");
const packageJson = await readJson("package.json");
const capacitorConfig = await readJson("capacitor.config.json");
const blockerRegister = await readJson("store/release-blockers-register.json");
const operatorInputs = await readJson("store/operator-inputs-register.json");
const androidGradle = await readText("android/app/build.gradle");
const androidManifest = await readText("android/app/src/main/AndroidManifest.xml");
const androidGitignore = await readText("android/.gitignore");
const rootGitignore = await readText(".gitignore");
const signingTemplate = await readText("android/release-signing.example.properties");
const iosInfoPlist = await readText("ios/App/App/Info.plist");
const iosProject = await readText("ios/App/App.xcodeproj/project.pbxproj");
const docText = await readText("00_docs/NATIVE_RELEASE_SIGNING_HANDOFF_2026-06-10.md");
const packageScripts = packageJson?.scripts || {};

if (handoff) {
  if (handoff.schemaVersion === "native-release-signing-handoff-v1") pass("Native release signing handoff schema version is current.");
  else fail("Native release signing handoff schemaVersion must be native-release-signing-handoff-v1.");

  requireValue(handoff.updatedAt, "Native release signing handoff updatedAt");
  requireIncludes(handoff.status, "waiting-toolchain-signing-credentials", "Native release signing handoff keeps signing credentials unresolved.");
  requireIncludes(handoff.publicOrigin, "https://www.zkraiflow.top", "Native release signing handoff uses the public production domain.");
  requireValue(handoff.objective, "Native release signing handoff objective");
  requireArray(handoff.officialBasis, "Native release signing official basis", 5);

  for (const basis of handoff.officialBasis || []) {
    if (basis.name && /^https:\/\//i.test(String(basis.url || ""))) pass(`Official basis is linkable: ${basis.name}.`);
    else fail("Official basis entries must include name and HTTPS URL.");
    requireValue(basis.requirement, `Official basis ${basis.name || "unnamed"} requirement`);
  }

  const identity = handoff.appIdentity || {};
  if (identity.capacitorAppId === "top.zkraiflow.aivideostudio") pass("Handoff Capacitor appId is correct.");
  else fail("Handoff Capacitor appId should be top.zkraiflow.aivideostudio.");
  if (identity.androidApplicationId === "top.zkraiflow.aivideostudio") pass("Handoff Android applicationId is correct.");
  else fail("Handoff Android applicationId should be top.zkraiflow.aivideostudio.");
  if (identity.iosBundleId === "top.zkraiflow.aivideostudio") pass("Handoff iOS bundle id is correct.");
  else fail("Handoff iOS bundle id should be top.zkraiflow.aivideostudio.");
  if (identity.appName === "AI Video Studio") pass("Handoff app name matches current project.");
  else fail("Handoff app name should be AI Video Studio.");

  const version = handoff.releaseVersion || {};
  if (version.androidVersionCode === 1) pass("Handoff records Android versionCode 1.");
  else fail("Handoff should record Android versionCode 1.");
  if (version.androidVersionName === "1.0") pass("Handoff records Android versionName 1.0.");
  else fail("Handoff should record Android versionName 1.0.");
  if (String(version.iosCurrentProjectVersion) === "1") pass("Handoff records iOS CURRENT_PROJECT_VERSION 1.");
  else fail("Handoff should record iOS CURRENT_PROJECT_VERSION 1.");
  if (String(version.iosMarketingVersion) === "1.0") pass("Handoff records iOS MARKETING_VERSION 1.0.");
  else fail("Handoff should record iOS MARKETING_VERSION 1.0.");

  requireArray(handoff.signingAssets, "Native signing assets", 5);
  const assetIds = new Set((handoff.signingAssets || []).map((item) => item.id));
  for (const id of [
    "android-upload-keystore",
    "google-play-app-signing",
    "ios-distribution-certificate",
    "ios-app-store-provisioning-profile",
    "app-store-connect-app-record"
  ]) {
    if (assetIds.has(id)) pass(`Native signing asset exists: ${id}.`);
    else fail(`Native signing asset is missing: ${id}.`);
  }

  for (const asset of handoff.signingAssets || []) {
    const label = asset.id || "unnamed-signing-asset";
    requireValue(asset.currentState, `Signing asset ${label} state`);
    requireIncludes(asset.repoPolicy, "DO_NOT_COMMIT", `Signing asset ${label} forbids committing secrets.`);
    requireValue(asset.ownerInput, `Signing asset ${label} owner input`);
    requireValue(asset.secureDestination, `Signing asset ${label} secure destination`);
  }

  requireArray(handoff.toolchainGates, "Native toolchain gates", 3);
  requireArray(handoff.buildCommands, "Native build commands", 5);
  for (const item of handoff.buildCommands || []) {
    const script = commandScriptName(item.command);
    if (!script) continue;
    if (packageScripts[script]) pass(`Native build command exists: npm run ${script}.`);
    else fail(`Native build command references missing npm script: npm run ${script}.`);
  }

  requireArray(handoff.releaseGates, "Native release gates", 4);
  requireArray(handoff.verificationCommands, "Native verification commands", 5);
  for (const command of handoff.verificationCommands || []) {
    const script = commandScriptName(command);
    if (!script) continue;
    if (packageScripts[script]) pass(`Native verification command exists: npm run ${script}.`);
    else fail(`Native verification command references missing npm script: npm run ${script}.`);
  }

  for (const evidenceFile of handoff.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`Native release evidence exists: ${evidenceFile}.`);
    else fail(`Native release evidence file is missing: ${evidenceFile}.`);
  }

  requireArray(handoff.doNotCommit, "Native release do-not-commit list", 8);
}

if (capacitorConfig?.appId === "top.zkraiflow.aivideostudio") pass("Capacitor appId matches native identity.");
else fail("Capacitor appId should be top.zkraiflow.aivideostudio.");
if (capacitorConfig?.appName === "AI Video Studio") pass("Capacitor appName matches native identity.");
else fail("Capacitor appName should be AI Video Studio.");
if (capacitorConfig?.webDir === "dist") pass("Capacitor webDir points to dist.");
else fail("Capacitor webDir should be dist.");
if (!capacitorConfig?.server?.url) pass("Capacitor production config has no server.url.");
else fail("Capacitor production config must not set server.url for store builds.");
if (capacitorConfig?.server?.cleartext !== true) pass("Capacitor cleartext is not enabled.");
else fail("Capacitor cleartext must not be enabled for release builds.");

requireIncludes(androidGradle, 'applicationId "top.zkraiflow.aivideostudio"', "Android applicationId matches native identity.");
requirePattern(androidGradle, /versionCode\s+1\b/, "Android versionCode is 1.");
requirePattern(androidGradle, /versionName\s+"1\.0"/, "Android versionName is 1.0.");
if (/signingConfigs\s*\{[\s\S]*storePassword|keyPassword|storeFile\s+file\(/.test(androidGradle)) {
  fail("android/app/build.gradle appears to contain release signing secrets or local signing files.");
} else {
  pass("Android build.gradle does not commit release signing secrets.");
}

requireIncludes(androidManifest, 'android:allowBackup="false"', "Android manifest disables backup.");
if (!androidManifest.includes('android:usesCleartextTraffic="true"')) pass("Android manifest does not enable cleartext traffic.");
else fail("Android manifest must not enable cleartext traffic.");
requireIncludes(androidManifest, "android.permission.INTERNET", "Android INTERNET permission is declared.");

requireIncludes(iosInfoPlist, "<key>CFBundleDisplayName</key>", "iOS display name is declared.");
if (!iosInfoPlist.includes("NSAllowsArbitraryLoads")) pass("iOS Info.plist does not declare broad ATS exceptions.");
else warn("iOS Info.plist mentions NSAllowsArbitraryLoads; confirm no broad ATS release exception remains.");
requireIncludes(iosProject, "PRODUCT_BUNDLE_IDENTIFIER = top.zkraiflow.aivideostudio;", "iOS bundle id matches native identity.");
requirePattern(iosProject, /CURRENT_PROJECT_VERSION = 1;/, "iOS CURRENT_PROJECT_VERSION is 1.");
requirePattern(iosProject, /MARKETING_VERSION = 1\.0;/, "iOS MARKETING_VERSION is 1.0.");
requireIncludes(iosProject, "CODE_SIGN_STYLE = Automatic;", "iOS project keeps automatic signing until owner team is configured.");

for (const marker of [
  "*.jks",
  "*.keystore",
  "*.p12",
  "*.mobileprovision",
  "*.provisionprofile",
  "*.xcarchive",
  "*.ipa",
  "android/release-signing.properties",
  "**/release-signing.properties",
  "**/ExportOptions.plist"
]) {
  requireIncludes(rootGitignore, marker, `Root .gitignore protects ${marker}.`);
}

for (const marker of ["*.jks", "*.keystore", "release-signing.properties"]) {
  requireIncludes(androidGitignore, marker, `Android .gitignore protects ${marker}.`);
}

for (const marker of [
  "storeFile=REPLACE_WITH_ABSOLUTE_OR_SECURE_CI_KEYSTORE_PATH",
  "storePassword=REPLACE_WITH_PASSWORD_MANAGER_OR_CI_SECRET",
  "keyAlias=REPLACE_WITH_UPLOAD_KEY_ALIAS",
  "keyPassword=REPLACE_WITH_PASSWORD_MANAGER_OR_CI_SECRET"
]) {
  requireIncludes(signingTemplate, marker, `Android signing template includes ${marker}.`);
}
if (hasSecretLikeValue(signingTemplate)) fail("android/release-signing.example.properties appears to contain real signing material.");
else pass("Android signing template contains placeholders only.");

const nativeBlocker = (blockerRegister?.blockers || []).find((item) => item.id === "native-build-toolchains");
if (nativeBlocker) {
  pass("Release blocker register includes native-build-toolchains.");
  if ((nativeBlocker.verificationCommands || []).includes("npm run native:release-plan")) pass("Native blocker references native:release-plan.");
  else fail("Native blocker should reference npm run native:release-plan.");
  for (const evidence of [
    "store/native-release-signing-handoff.json",
    "00_docs/NATIVE_RELEASE_SIGNING_HANDOFF_2026-06-10.md",
    "scripts/check-native-release-signing-plan.mjs",
    "android/release-signing.example.properties"
  ]) {
    if ((nativeBlocker.evidenceFiles || []).includes(evidence)) pass(`Native blocker references evidence: ${evidence}.`);
    else fail(`Native blocker is missing evidence reference: ${evidence}.`);
  }
} else {
  fail("Release blocker register is missing native-build-toolchains.");
}

const nativeInputGroup = (operatorInputs?.inputGroups || []).find((group) => group.id === "native-store-packaging");
if (nativeInputGroup) {
  pass("Operator inputs include native-store-packaging group.");
  const fieldIds = new Set((nativeInputGroup.fields || []).map((field) => field.id));
  for (const id of ["androidToolchain", "iosToolchain", "nativeStoreScreenshots", "androidSigning", "googlePlayAppSigning", "iosSigning"]) {
    if (fieldIds.has(id)) pass(`Operator native input exists: ${id}.`);
    else fail(`Operator native input is missing: ${id}.`);
  }
} else {
  fail("Operator inputs are missing native-store-packaging group.");
}

if (docText) {
  for (const marker of [
    "原生 App 签名",
    "top.zkraiflow.aivideostudio",
    "android/release-signing.example.properties",
    "npm run native:release-plan",
    "Android App signing",
    "Google Play App Signing",
    "Apple"
  ]) {
    requireIncludes(docText, marker, `Native release signing runbook includes ${marker}`);
  }
} else {
  fail("Native release signing runbook is missing: 00_docs/NATIVE_RELEASE_SIGNING_HANDOFF_2026-06-10.md.");
}

if (!packageScripts["native:release-plan"]) fail("package.json should define npm run native:release-plan.");

console.log("Native release signing handoff check");
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
