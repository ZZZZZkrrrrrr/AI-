import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(".");
const passes = [];
const warnings = [];
const blockers = [];

function pass(message) {
  passes.push(message);
}

function warn(message) {
  warnings.push(message);
}

function block(message) {
  blockers.push(message);
}

async function readJson(relativePath) {
  try {
    const text = await readFile(path.join(rootDir, relativePath), "utf8");
    return JSON.parse(text);
  } catch (error) {
    block(`${relativePath} is missing or invalid JSON: ${error.message}`);
    return null;
  }
}

async function exists(relativePath) {
  try {
    const info = await stat(path.join(rootDir, relativePath));
    return info.size > 0;
  } catch {
    return false;
  }
}

async function readText(relativePath) {
  try {
    return await readFile(path.join(rootDir, relativePath), "utf8");
  } catch {
    return "";
  }
}

function hasDependency(packageJson, name) {
  return Boolean(packageJson?.dependencies?.[name] || packageJson?.devDependencies?.[name]);
}

function gradleNumber(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

function javaMajorVersion() {
  const result = spawnSync("java", ["-version"], { encoding: "utf8" });
  if (result.error) return null;
  const output = `${result.stderr || ""}\n${result.stdout || ""}`;
  const match = output.match(/version "(\d+)(?:\.(\d+))?/i);
  if (!match) return null;
  return match[1] === "1" ? Number(match[2]) : Number(match[1]);
}

const config = await readJson("capacitor.config.json");
const packageJson = await readJson("package.json");
const manifest = await readJson("public/manifest.webmanifest");
const androidManifest = await readText("android/app/src/main/AndroidManifest.xml");
const androidVariables = await readText("android/variables.gradle");
const iosInfoPlist = await readText("ios/App/App/Info.plist");

if (config) {
  if (/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/i.test(config.appId || "")) {
    pass("Capacitor appId uses reverse-DNS format.");
  } else {
    block("Capacitor appId should use reverse-DNS format, for example top.example.app.");
  }

  if (config.appName) pass("Capacitor appName is set.");
  else block("Capacitor appName is missing.");

  if (config.webDir === "dist") pass("Capacitor webDir points to Vite dist.");
  else block(`Capacitor webDir should be "dist", got "${config.webDir || ""}".`);

  if (await exists(config.webDir ? path.join(config.webDir, "index.html") : "dist/index.html")) {
    pass("Capacitor webDir contains built index.html.");
  } else {
    block("Capacitor webDir does not contain index.html. Run npm run build before syncing native projects.");
  }

  if (config.server?.url) {
    block("Capacitor production config must not set server.url; use bundled web assets for store builds.");
  } else {
    pass("Capacitor config does not use a live server URL.");
  }

  if (config.server?.cleartext === true) {
    block("Capacitor server.cleartext must not be true for production packages.");
  } else {
    pass("Capacitor cleartext traffic is not enabled.");
  }

  if (config.server?.androidScheme === "https") pass("Capacitor Android scheme is https.");
  else warn("Capacitor androidScheme should be https for production packages.");

  if (config.android?.allowMixedContent === true) {
    block("Android allowMixedContent must not be true for production packages.");
  } else {
    pass("Android mixed content is not enabled.");
  }

  if (config.android?.webContentsDebuggingEnabled === true) {
    block("Android WebView debugging must not be enabled for production packages.");
  } else {
    pass("Android WebView debugging is not enabled.");
  }

  if (config.loggingBehavior === "production" || config.loggingBehavior === "none") {
    pass("Capacitor logging behavior is suitable for release builds.");
  } else {
    warn("Capacitor loggingBehavior should be production or none for release builds.");
  }
}

if (manifest) {
  if (manifest.display === "standalone") pass("PWA manifest display remains standalone.");
  else block("PWA manifest display should remain standalone before packaging.");

  if (manifest.name && manifest.short_name) pass("PWA manifest keeps app name and short name.");
  else block("PWA manifest is missing name or short_name.");
}

if (packageJson) {
  if (packageJson.scripts?.build?.includes("vite build")) pass("Package build script creates Vite assets.");
  else block("Package build script should create Vite assets before Capacitor sync.");

  if (packageJson.scripts?.["capacitor:sync"]?.includes("cap sync")) {
    pass("Package includes Capacitor sync script.");
  } else {
    warn("Package should include a capacitor:sync script for repeatable native asset updates.");
  }

  for (const dependency of ["@capacitor/core", "@capacitor/cli", "@capacitor/android", "@capacitor/ios"]) {
    if (hasDependency(packageJson, dependency)) pass(`${dependency} is installed.`);
    else warn(`${dependency} is not installed yet. Install it when starting native packaging.`);
  }
}

if (await exists("android/app/build.gradle")) {
  pass("Android native project exists.");
} else {
  warn("Android native project is not generated yet. Run Capacitor add/sync during native packaging.");
}

if (androidManifest) {
  if (androidManifest.includes('android:allowBackup="false"')) {
    pass("Android app backup is disabled for release privacy posture.");
  } else {
    warn("Android android:allowBackup should be false or explicitly scoped before release.");
  }

  if (androidManifest.includes('android:usesCleartextTraffic="true"')) {
    block("Android manifest must not enable cleartext traffic for release builds.");
  } else {
    pass("Android manifest does not enable cleartext traffic.");
  }

  if (androidManifest.includes('android.permission.INTERNET')) {
    pass("Android INTERNET permission is declared.");
  } else {
    block("Android INTERNET permission is missing; remote API calls will fail.");
  }
}

if (androidVariables) {
  const minSdk = gradleNumber(androidVariables, "minSdkVersion");
  const targetSdk = gradleNumber(androidVariables, "targetSdkVersion");
  const compileSdk = gradleNumber(androidVariables, "compileSdkVersion");
  if (minSdk && minSdk >= 24) pass(`Android minSdkVersion is ${minSdk}.`);
  else warn("Android minSdkVersion should be 24 or higher for the current Capacitor template.");
  if (targetSdk && targetSdk >= 35) pass(`Android targetSdkVersion is ${targetSdk}.`);
  else warn("Android targetSdkVersion should be kept current before Play submission.");
  if (compileSdk && targetSdk && compileSdk >= targetSdk) pass(`Android compileSdkVersion ${compileSdk} covers targetSdkVersion ${targetSdk}.`);
  else warn("Android compileSdkVersion should be greater than or equal to targetSdkVersion.");
}

const androidSdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (androidSdk && existsSync(androidSdk)) {
  pass("Android SDK path is available in the environment.");
} else {
  warn("ANDROID_HOME or ANDROID_SDK_ROOT is not set. Android Gradle builds need an installed Android SDK.");
}

const javaMajor = javaMajorVersion();
if (javaMajor && javaMajor >= 17) {
  pass(`JDK ${javaMajor} is available for Android Gradle builds.`);
} else if (javaMajor) {
  warn(`JDK ${javaMajor} is available, but Android Gradle plugin 8.x builds should use JDK 17 or newer.`);
} else {
  warn("Java was not found. Android Gradle builds need JDK 17 or newer.");
}

if (await exists("ios/App/App/Info.plist")) {
  pass("iOS native project exists.");
} else {
  warn("iOS native project is not generated yet. Run Capacitor add/sync during native packaging.");
}

if (iosInfoPlist) {
  if (iosInfoPlist.includes("<key>CFBundleDisplayName</key>")) pass("iOS display name is declared.");
  else warn("iOS CFBundleDisplayName should be declared before submission.");
  if (iosInfoPlist.includes("<key>UILaunchStoryboardName</key>")) pass("iOS launch storyboard is declared.");
  else warn("iOS launch storyboard should be declared before submission.");
  if (iosInfoPlist.includes("NSAllowsArbitraryLoads")) {
    warn("iOS Info.plist mentions NSAllowsArbitraryLoads. Confirm ATS exceptions are not enabled for release.");
  } else {
    pass("iOS Info.plist does not declare broad ATS exceptions.");
  }
}

if (process.platform === "darwin") {
  const xcode = spawnSync("xcodebuild", ["-version"], { encoding: "utf8" });
  if (xcode.status === 0) pass("Xcode command line tools are available.");
  else warn("xcodebuild is not available. Install Xcode command line tools before iOS build validation.");
} else {
  warn("iOS build and signing validation must still run on macOS with Xcode.");
}

console.log("Capacitor readiness check");
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

if (blockers.length) process.exit(1);
