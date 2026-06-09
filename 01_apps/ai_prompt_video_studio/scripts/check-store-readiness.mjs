import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(".");
const strict = process.argv.includes("--strict");
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

async function fileExists(relativePath) {
  try {
    const info = await stat(path.join(rootDir, relativePath));
    return info.isFile() && info.size > 0;
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

function isPlaceholder(value) {
  const text = String(value || "").trim();
  return !text || /^TODO_/i.test(text) || /pending|draft|not-started|planned/i.test(text);
}

function checkRequiredValue(value, label, { publicHttps = false } = {}) {
  const text = String(value || "").trim();
  if (!text) {
    block(`${label} is empty.`);
    return;
  }
  if (/^TODO_/i.test(text)) {
    warn(`${label} still uses a TODO placeholder.`);
    return;
  }
  if (publicHttps && !/^https:\/\//i.test(text)) {
    warn(`${label} should be a public HTTPS URL for store review.`);
    return;
  }
  pass(`${label} is filled.`);
}

function checkStatus(value, label, readyValues = ["ready", "done", "approved", "ok", "internal-ready"]) {
  const text = String(value || "").trim();
  if (!text) {
    warn(`${label} is empty.`);
    return;
  }
  if (readyValues.includes(text)) {
    pass(`${label} is ${text}.`);
    return;
  }
  warn(`${label} is ${text}; review before store submission.`);
}

function requireMarker(source, marker, label) {
  if (source.includes(marker)) {
    pass(label);
    return;
  }
  block(`${label}: missing marker "${marker}".`);
}

const metadataPath = "store/submission-readiness.json";
const metadataText = await readText(metadataPath);
let metadata = null;
const launchPlanPath = "store/launch-action-plan.json";
const launchPlanText = await readText(launchPlanPath);
let launchPlan = null;

if (!metadataText) {
  block(`${metadataPath} is missing.`);
} else {
  try {
    metadata = JSON.parse(metadataText);
    pass("Store submission metadata is valid JSON.");
  } catch (error) {
    block(`Store submission metadata is invalid JSON: ${error.message}`);
  }
}

if (!launchPlanText) {
  warn(`${launchPlanPath} is missing. Store warnings should be tracked in a launch action plan.`);
} else {
  try {
    launchPlan = JSON.parse(launchPlanText);
    pass("Store launch action plan is valid JSON.");
  } catch (error) {
    block(`Store launch action plan is invalid JSON: ${error.message}`);
  }
}

for (const requiredFile of [
  "public/manifest.webmanifest",
  "public/support.html",
  "public/legal/privacy.html",
  "public/legal/terms.html",
  "public/legal/ai-disclosure.html",
  "public/legal/delete-account.html",
  "store/screenshot-plan.json",
  "store/launch-action-plan.json",
  "store/screenshots/README.md"
]) {
  if (await fileExists(requiredFile)) pass(`${requiredFile} exists.`);
  else block(`${requiredFile} is missing or empty.`);
}

if (metadata) {
  if (metadata.schemaVersion !== "store-submission-readiness-v1") {
    block("Store metadata schemaVersion is not store-submission-readiness-v1.");
  } else {
    pass("Store metadata schema version is current.");
  }

  const app = metadata.app || {};
  checkRequiredValue(app.name, "App name");
  checkRequiredValue(app.subtitle, "App subtitle");
  checkRequiredValue(app.category, "App category");
  checkStatus(app.descriptionStatus, "Store description status");
  checkRequiredValue(app.supportUrl, "Support URL", { publicHttps: true });
  checkRequiredValue(app.marketingUrl, "Marketing URL", { publicHttps: true });
  checkRequiredValue(app.privacyPolicyUrl, "Privacy policy URL", { publicHttps: true });
  checkRequiredValue(app.accountDeletionUrl, "Account deletion URL", { publicHttps: true });
  checkRequiredValue(app.contactEmail, "Contact email");
  if (app.contactEmail && !/^TODO_/i.test(app.contactEmail) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app.contactEmail)) {
    warn("Contact email does not look like an email address.");
  }
  checkRequiredValue(app.contactPhone, "Contact phone");

  const review = metadata.review || {};
  checkStatus(review.demoAccountStatus, "Review demo account status");
  checkStatus(review.reviewNotesStatus, "Review notes status");
  checkRequiredValue(review.minimumFunctionalityNotes, "Minimum functionality notes");

  const privacy = metadata.privacy || {};
  const applePrivacy = privacy.applePrivacyNutritionLabel || {};
  checkStatus(applePrivacy.status, "Apple privacy nutrition label status");
  if (Array.isArray(applePrivacy.dataTypes) && applePrivacy.dataTypes.length) {
    pass("Apple privacy data type draft exists.");
  } else {
    block("Apple privacy data type draft is missing.");
  }

  const googleSafety = privacy.googleDataSafety || {};
  checkStatus(googleSafety.status, "Google Play Data safety status");
  if (googleSafety.accountCreation && googleSafety.inAppDeletionRequest) {
    pass("Google Play account deletion support is declared.");
  } else {
    warn("Google Play account deletion support should be declared for apps with account creation.");
  }
  checkRequiredValue(googleSafety.webDeletionUrl, "Google Play web deletion URL", { publicHttps: true });
  if (Array.isArray(googleSafety.dataTypes) && googleSafety.dataTypes.length) {
    pass("Google Play data type draft exists.");
  } else {
    block("Google Play data type draft is missing.");
  }

  if (Array.isArray(privacy.thirdPartySdks) && privacy.thirdPartySdks.length) {
    pass("Third-party SDK/library list exists.");
    for (const sdk of privacy.thirdPartySdks) {
      if (isPlaceholder(sdk.reviewStatus)) warn(`${sdk.name || "SDK"} review status is ${sdk.reviewStatus || "empty"}.`);
    }
  } else {
    block("Third-party SDK/library list is missing.");
  }

  const distribution = metadata.distribution || {};
  checkStatus(distribution.pwaStatus, "PWA distribution status");
  checkStatus(distribution.capacitorStatus, "Capacitor package status", ["ready", "done", "approved", "ok", "internal-ready", "config-ready", "native-projects-generated"]);
  checkStatus(distribution.iosNativeStatus, "iOS native package status");
  checkStatus(distribution.androidNativeStatus, "Android native package status");

  const china = metadata.china || {};
  checkRequiredValue(china.operatorName, "China app operator legal entity");
  checkRequiredValue(china.domain, "Public domain");
  checkRequiredValue(china.icpFilingNumber, "ICP filing number");
  checkRequiredValue(china.appFilingNumber, "APP filing number");
  checkStatus(china.filingStatus, "China APP filing status");
  checkRequiredValue(china.filingDisplayLocation, "APP filing number display location");

  const screenshots = metadata.screenshots || {};
  checkStatus(screenshots.status, "Store screenshot status");
  checkStatus(screenshots.planStatus, "Store screenshot plan status", ["structured", "ready", "done", "approved", "ok"]);
  checkStatus(screenshots.webCaptureStatus, "Web/PWA screenshot capture status", ["captured-first-pass", "captured", "ready", "done", "approved", "ok"]);
  if (screenshots.planFile) {
    if (await fileExists(screenshots.planFile)) pass("Store screenshot plan file exists.");
    else block(`Store screenshot plan file is missing: ${screenshots.planFile}.`);
  } else {
    warn("Store screenshot plan file is not declared.");
  }
  if (Array.isArray(screenshots.requiredSets) && screenshots.requiredSets.length >= 3) {
    pass("Store screenshot set plan exists.");
  } else {
    warn("Store screenshot set plan should cover mobile, tablet, iOS, Android, and domestic channels.");
  }
}

if (launchPlan) {
  if (launchPlan.schemaVersion !== "store-launch-action-plan-v1") {
    block("Store launch action plan schemaVersion is not store-launch-action-plan-v1.");
  } else {
    pass("Store launch action plan schema version is current.");
  }

  const milestones = Array.isArray(launchPlan.milestones) ? launchPlan.milestones : [];
  if (milestones.length >= 6) {
    pass("Store launch action plan covers core launch workstreams.");
  } else {
    warn("Store launch action plan should cover public web, privacy, review, native packaging, screenshots, and China distribution.");
  }

  const requiredMilestones = [
    "public-web-base",
    "contact-and-support",
    "privacy-and-data-safety",
    "review-demo-account",
    "native-capacitor-packaging",
    "store-screenshots",
    "china-distribution-compliance"
  ];
  const milestoneIds = new Set(milestones.map((item) => item.id));
  for (const id of requiredMilestones) {
    if (milestoneIds.has(id)) pass(`Launch action plan includes ${id}.`);
    else warn(`Launch action plan is missing ${id}.`);
  }

  for (const milestone of milestones) {
    const label = milestone.id || milestone.title || "Unnamed launch milestone";
    if (milestone.id && milestone.title && milestone.owner && milestone.status) {
      pass(`Launch milestone ${label} has owner and status.`);
    } else {
      warn(`Launch milestone ${label} is missing id, title, owner, or status.`);
    }
    if (Array.isArray(milestone.evidence) && milestone.evidence.length) {
      pass(`Launch milestone ${label} declares verification evidence.`);
    } else {
      warn(`Launch milestone ${label} should declare verification evidence.`);
    }
    if (Array.isArray(milestone.blocks) && milestone.blocks.length) {
      pass(`Launch milestone ${label} maps to store check warnings.`);
    } else {
      warn(`Launch milestone ${label} should map to store check warnings.`);
    }
  }
}

const manifestText = await readText("public/manifest.webmanifest");
if (manifestText) {
  try {
    const manifest = JSON.parse(manifestText);
    if (manifest.name && manifest.short_name && manifest.display === "standalone") {
      pass("PWA manifest has app-like identity.");
    } else {
      block("PWA manifest is missing name, short_name, or standalone display.");
    }
    if (Array.isArray(manifest.icons) && manifest.icons.some((icon) => String(icon.purpose || "").includes("maskable"))) {
      pass("PWA manifest includes a maskable icon.");
    } else {
      block("PWA manifest is missing a maskable icon.");
    }
  } catch {
    block("PWA manifest is invalid JSON.");
  }
}

const settingsSource = await readText("src/features/settings/SettingsPage.jsx");
requireMarker(settingsSource, "/support.html", "Settings page exposes help and support page.");
requireMarker(settingsSource, "/legal/privacy.html", "Settings page exposes privacy policy.");
requireMarker(settingsSource, "/legal/delete-account.html", "Settings page exposes public account deletion page.");
requireMarker(settingsSource, "/api/account/export", "Settings page exposes data export.");
requireMarker(settingsSource, "/api/account/data-rights-request", "Settings page exposes account deletion request.");

const serverSource = await readText("server.js");
requireMarker(serverSource, "/api/account/export", "Server exposes account data export API.");
requireMarker(serverSource, "/api/account/data-rights-request", "Server exposes account deletion request API.");
requireMarker(serverSource, "/api/healthz", "Server exposes public health check.");

const packageSource = await readText("package.json");
requireMarker(packageSource, "\"mobile:check\"", "Package includes mobile readiness check.");
requireMarker(packageSource, "\"pwa:check\"", "Package includes PWA check.");
requireMarker(packageSource, "\"compliance:check\"", "Package includes compliance check.");
requireMarker(packageSource, "\"cloud:check:strict\"", "Package includes strict cloud check.");

if (!(await fileExists("capacitor.config.ts")) && !(await fileExists("capacitor.config.json"))) {
  warn("Capacitor config is not present yet. This is expected before native packaging starts.");
}

if (!(await fileExists("ios/App/App/Info.plist"))) {
  warn("iOS native project is not present yet. Create it during Capacitor validation.");
}

if (!(await fileExists("android/app/build.gradle"))) {
  warn("Android native project is not present yet. Create it during Capacitor validation.");
}

console.log("Store submission readiness check");
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
