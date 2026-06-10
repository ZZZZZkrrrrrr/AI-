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

function checkArray(value, label, minLength = 1) {
  if (Array.isArray(value) && value.length >= minLength) {
    pass(label);
    return true;
  }
  block(`${label} is missing or too short.`);
  return false;
}

function validatePrivacyDataSafetyDraft(draft) {
  if (!draft || typeof draft !== "object") {
    block("Privacy data safety draft is missing.");
    return;
  }

  if (draft.schemaVersion === "store-privacy-data-safety-draft-v1") {
    pass("Privacy data safety draft schema version is current.");
  } else {
    block("Privacy data safety draft schemaVersion must be store-privacy-data-safety-draft-v1.");
  }

  checkRequiredValue(draft.updatedAt, "Privacy data safety draft updatedAt");
  checkStatus(draft.status, "Privacy data safety draft status", ["draft", "draft-structured", "ready", "done", "approved", "ok"]);

  if (checkArray(draft.officialBasis, "Privacy data safety draft includes official basis.", 3)) {
    for (const basis of draft.officialBasis) {
      if (basis.name && /^https:\/\//i.test(String(basis.url || ""))) {
        pass(`Privacy official basis is linkable: ${basis.name}.`);
      } else {
        block("Privacy official basis entries must include name and HTTPS URL.");
      }
    }
  }

  const dataFlows = Array.isArray(draft.dataFlows) ? draft.dataFlows : [];
  checkArray(dataFlows, "Privacy data safety draft maps core data flows.", 5);
  const flowIds = new Set(dataFlows.map((flow) => flow.id));
  for (const requiredFlowId of [
    "account-auth",
    "user-uploaded-content",
    "ai-generated-content",
    "workflow-activity",
    "diagnostics"
  ]) {
    if (flowIds.has(requiredFlowId)) pass(`Privacy data flow is mapped: ${requiredFlowId}.`);
    else block(`Privacy data flow is missing: ${requiredFlowId}.`);
  }

  for (const flow of dataFlows) {
    const label = flow.id || flow.name || "unnamed-flow";
    if (flow.id && flow.name) pass(`Privacy data flow ${label} has identity fields.`);
    else block(`Privacy data flow ${label} needs id and name.`);
    checkArray(flow.dataTypes, `Privacy data flow ${label} declares data types.`);
    checkArray(flow.purpose, `Privacy data flow ${label} declares purposes.`);
    if (typeof flow.collected === "boolean") pass(`Privacy data flow ${label} declares collected flag.`);
    else block(`Privacy data flow ${label} must declare collected as a boolean.`);
    if (typeof flow.shared === "boolean") pass(`Privacy data flow ${label} declares shared flag.`);
    else block(`Privacy data flow ${label} must declare shared as a boolean.`);
    if (typeof flow.linkedToUser === "boolean" || flow.linkedToUser === "sometimes") pass(`Privacy data flow ${label} declares linked-to-user state.`);
    else block(`Privacy data flow ${label} must declare linkedToUser.`);
    checkRequiredValue(flow.retention, `Privacy data flow ${label} retention`);
    checkRequiredValue(flow.exportAndDeletion, `Privacy data flow ${label} export and deletion handling`);
    if (flow.appleDraft && Array.isArray(flow.appleDraft.categories) && flow.appleDraft.categories.length) {
      pass(`Privacy data flow ${label} includes Apple draft mapping.`);
    } else {
      block(`Privacy data flow ${label} needs Apple draft mapping.`);
    }
    if (flow.googleDraft && Array.isArray(flow.googleDraft.categories) && flow.googleDraft.categories.length) {
      pass(`Privacy data flow ${label} includes Google draft mapping.`);
    } else {
      block(`Privacy data flow ${label} needs Google draft mapping.`);
    }
  }

  const appleDraft = draft.applePrivacyNutritionLabelDraft || {};
  if (typeof appleDraft.tracking === "boolean") pass("Apple privacy label draft declares tracking flag.");
  else block("Apple privacy label draft must declare a boolean tracking flag.");
  checkArray(appleDraft.dataLinkedToUser, "Apple privacy label draft declares linked data categories.", 3);
  checkArray(appleDraft.purposes, "Apple privacy label draft declares purposes.");
  checkArray(appleDraft.reviewBeforeSubmission, "Apple privacy label draft includes pre-submission review notes.", 3);

  const googleDraft = draft.googlePlayDataSafetyDraft || {};
  if (googleDraft.accountCreation && googleDraft.inAppDeletionRequest) {
    pass("Google data safety draft declares account creation and deletion request support.");
  } else {
    block("Google data safety draft must declare account creation and deletion request support.");
  }
  checkRequiredValue(googleDraft.webDeletionUrl, "Google data safety draft web deletion URL", { publicHttps: true });
  checkRequiredValue(googleDraft.encryptionInTransit, "Google data safety draft encryption in transit");
  if (typeof googleDraft.dataShared === "boolean") pass("Google data safety draft declares data sharing flag.");
  else block("Google data safety draft must declare dataShared as a boolean.");
  checkArray(googleDraft.dataTypes, "Google data safety draft declares data type answers.", 4);
  checkArray(googleDraft.reviewBeforeSubmission, "Google data safety draft includes pre-submission review notes.", 3);

  checkArray(draft.thirdPartyReview, "Privacy data safety draft includes third-party review inventory.", 5);
  if ((draft.thirdPartyReview || []).some((item) => /AI model|video providers/i.test(String(item.name || "")))) {
    pass("Privacy third-party review calls out production AI/video providers.");
  } else {
    block("Privacy third-party review must call out production AI/video providers.");
  }

  const permissions = Array.isArray(draft.permissions) ? draft.permissions : [];
  checkArray(permissions, "Privacy data safety draft includes native permission review.", 3);
  if (permissions.some((item) => item.permission === "INTERNET" && item.declared === true)) {
    pass("Privacy permission review includes Android INTERNET permission.");
  } else {
    block("Privacy permission review must include Android INTERNET permission.");
  }

  checkArray(draft.releaseBlockers, "Privacy data safety draft records release blockers.", 5);
}

function validatePrivacyFormFillChecklist(source) {
  if (!source) {
    block("Privacy form fill checklist is missing.");
    return;
  }

  const requiredMarkers = [
    ["# App 隐私与数据安全表单填写清单", "Privacy form fill checklist has title."],
    ["Apple App Store Connect", "Privacy form fill checklist covers Apple App Store Connect."],
    ["Google Play Console", "Privacy form fill checklist covers Google Play Console."],
    ["国内安卓商店", "Privacy form fill checklist covers domestic Android stores."],
    ["账号删除", "Privacy form fill checklist covers account deletion."],
    ["权限说明", "Privacy form fill checklist covers native permission wording."],
    ["AI 生成内容说明", "Privacy form fill checklist covers AI generated content disclosure."],
    ["上架前阻断项", "Privacy form fill checklist records pre-submission blockers."],
    ["变更触发重新审查", "Privacy form fill checklist records re-review triggers."],
    ["store/privacy-data-safety-draft.json", "Privacy form fill checklist links to the data safety draft."],
    ["https://developer.apple.com/app-store/app-privacy-details/", "Privacy form fill checklist links Apple official basis."],
    ["https://support.google.com/googleplay/android-developer/answer/10787469", "Privacy form fill checklist links Google data safety official basis."],
    ["https://support.google.com/googleplay/android-developer/answer/13327111", "Privacy form fill checklist links Google account deletion official basis."]
  ];

  for (const [marker, label] of requiredMarkers) requireMarker(source, marker, label);

  const topLevelSections = source.match(/^##\s+/gm) || [];
  if (topLevelSections.length >= 6) pass("Privacy form fill checklist has enough top-level sections.");
  else block("Privacy form fill checklist should include at least six top-level sections.");
}

function collectStrings(value, results = []) {
  if (typeof value === "string") {
    results.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, results);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, results);
  }
  return results;
}

function validateStoreListingCopyDraft(draft) {
  if (!draft || typeof draft !== "object") {
    block("Store listing copy draft is missing.");
    return;
  }

  if (draft.schemaVersion === "store-listing-copy-draft-v1") {
    pass("Store listing copy draft schema version is current.");
  } else {
    block("Store listing copy draft schemaVersion must be store-listing-copy-draft-v1.");
  }

  checkRequiredValue(draft.updatedAt, "Store listing copy draft updatedAt");
  checkStatus(draft.status, "Store listing copy draft status", ["draft-structured", "ready", "done", "approved", "ok"]);
  checkArray(draft.sourceDataFiles, "Store listing copy draft links source data files.", 3);

  if (checkArray(draft.officialBasis, "Store listing copy draft includes official basis.", 3)) {
    for (const basis of draft.officialBasis) {
      if (basis.name && /^https:\/\//i.test(String(basis.url || ""))) {
        pass(`Store listing official basis is linkable: ${basis.name}.`);
      } else {
        block("Store listing official basis entries must include name and HTTPS URL.");
      }
    }
  }

  const positioning = draft.positioning || {};
  checkRequiredValue(positioning.primaryUser, "Store listing positioning primary user");
  checkRequiredValue(positioning.jobToBeDone, "Store listing positioning job to be done");
  checkRequiredValue(positioning.valueProposition, "Store listing positioning value proposition");
  checkArray(positioning.notPositionedAs, "Store listing positioning declares non-goals.", 2);
  checkArray(positioning.tone, "Store listing positioning declares tone guardrails.", 3);

  const locales = draft.locales || {};
  for (const localeId of ["zh-CN", "en-US"]) {
    const locale = locales[localeId] || {};
    if (!locale.selectedName) {
      block(`Store listing ${localeId} selectedName is missing.`);
    } else if (locale.selectedName.length <= 30) {
      pass(`Store listing ${localeId} selectedName fits 30 characters.`);
    } else {
      block(`Store listing ${localeId} selectedName exceeds 30 characters.`);
    }
    checkArray(locale.nameAlternatives, `Store listing ${localeId} name alternatives exist.`, 2);

    const apple = locale.apple || {};
    if (apple.subtitle && apple.subtitle.length <= 30) pass(`Store listing ${localeId} Apple subtitle fits 30 characters.`);
    else block(`Store listing ${localeId} Apple subtitle is missing or exceeds 30 characters.`);
    if (apple.promotionalText && apple.promotionalText.length <= 170) pass(`Store listing ${localeId} Apple promotional text fits 170 characters.`);
    else block(`Store listing ${localeId} Apple promotional text is missing or exceeds 170 characters.`);
    if (apple.keywords && apple.keywords.length <= 100) pass(`Store listing ${localeId} Apple keywords fit 100 characters.`);
    else block(`Store listing ${localeId} Apple keywords are missing or exceed 100 characters.`);
    if (apple.description && apple.description.length >= 300 && apple.description.length <= 4000) pass(`Store listing ${localeId} Apple description has workable length.`);
    else block(`Store listing ${localeId} Apple description should be 300-4000 characters for the draft.`);

    const google = locale.googlePlay || {};
    if (google.shortDescription && google.shortDescription.length <= 80) pass(`Store listing ${localeId} Google short description fits 80 characters.`);
    else block(`Store listing ${localeId} Google short description is missing or exceeds 80 characters.`);
    if (google.fullDescription && google.fullDescription.length >= 300 && google.fullDescription.length <= 4000) pass(`Store listing ${localeId} Google full description has workable length.`);
    else block(`Store listing ${localeId} Google full description should be 300-4000 characters.`);

    if (localeId === "zh-CN") {
      const domestic = locale.domesticAndroid || {};
      if (domestic.shortDescription && domestic.fullDescription) pass("Store listing zh-CN includes domestic Android copy.");
      else block("Store listing zh-CN should include domestic Android copy.");
    }

    const captions = Array.isArray(locale.screenshotCaptions) ? locale.screenshotCaptions : [];
    checkArray(captions, `Store listing ${localeId} screenshot captions exist.`, 5);
    const captionIds = new Set(captions.map((caption) => caption.shotId));
    for (const shotId of ["home", "home-image", "create", "assets", "settings"]) {
      if (captionIds.has(shotId)) pass(`Store listing ${localeId} caption maps to ${shotId}.`);
      else block(`Store listing ${localeId} caption is missing for ${shotId}.`);
    }
    for (const caption of captions) {
      const label = `${localeId}/${caption.shotId || "unknown-shot"}`;
      if (caption.title && caption.overlay && caption.altText) pass(`Store listing screenshot caption ${label} has title, overlay, and alt text.`);
      else block(`Store listing screenshot caption ${label} needs title, overlay, and altText.`);
      if (!caption.overlay || caption.overlay.length <= 40) pass(`Store listing screenshot overlay ${label} is concise.`);
      else warn(`Store listing screenshot overlay ${label} may be too long for mobile screenshots.`);
    }

    const featureGraphic = locale.featureGraphic || {};
    if (featureGraphic.requiredSize === "1024x500") pass(`Store listing ${localeId} feature graphic uses 1024x500.`);
    else block(`Store listing ${localeId} feature graphic must declare 1024x500.`);
    checkRequiredValue(featureGraphic.concept, `Store listing ${localeId} feature graphic concept`);
    checkRequiredValue(featureGraphic.headline, `Store listing ${localeId} feature graphic headline`);
    checkRequiredValue(featureGraphic.safeAreaNotes, `Store listing ${localeId} feature graphic safe area notes`);
  }

  checkArray(draft.globalScreenshotRules, "Store listing copy draft records screenshot rules.", 5);
  checkArray(draft.reviewWarnings, "Store listing copy draft records review warnings.", 5);
  checkArray(draft.forbiddenClaims, "Store listing copy draft records forbidden claims.", 5);

  const forbiddenRegexes = [
    /\b#1\b/i,
    /\bbest\b/i,
    /\btop\b/i,
    /\bfree\b/i,
    /\bdiscount\b/i,
    /\bsale\b/i,
    /\bdownload now\b/i,
    /\binstall now\b/i,
    /\btry now\b/i,
    /\bguaranteed\b/i,
    /保证转化/,
    /保证合规/,
    /全自动发布/
  ];
  const userFacingCopy = [];
  for (const locale of Object.values(locales)) {
    if (!locale || typeof locale !== "object") continue;
    userFacingCopy.push(
      locale.selectedName,
      ...(locale.nameAlternatives || []),
      ...(collectStrings(locale.apple || [])),
      ...(collectStrings(locale.googlePlay || [])),
      ...(collectStrings(locale.domesticAndroid || [])),
      ...(collectStrings(locale.screenshotCaptions || [])),
      ...(collectStrings(locale.featureGraphic || []))
    );
  }
  const offending = userFacingCopy.filter((text) => forbiddenRegexes.some((regex) => regex.test(String(text || ""))));
  if (offending.length) {
    block("Store listing user-facing copy contains forbidden ranking, price, CTA, or guarantee claims.");
  } else {
    pass("Store listing user-facing copy avoids forbidden ranking, price, CTA, and guarantee claims.");
  }
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
  "store/review-notes-template.json",
  "store/store-console-submission-handoff.json",
  "scripts/check-store-console-submission-plan.mjs",
  "scripts/seed-review-demo.mjs",
  "store/store-listing-copy-draft.json",
  "store/privacy-data-safety-draft.json",
  "store/privacy-form-fill-checklist.md",
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
  checkStatus(app.storeListingCopyStatus, "Store listing copy status", ["draft-structured", "ready", "done", "approved", "ok"]);
  if (app.storeListingCopyFile) {
    if (await fileExists(app.storeListingCopyFile)) {
      pass("Store listing copy draft file exists.");
      const storeListingText = await readText(app.storeListingCopyFile);
      try {
        validateStoreListingCopyDraft(JSON.parse(storeListingText));
      } catch (error) {
        block(`Store listing copy draft is invalid JSON: ${error.message}`);
      }
    } else {
      block(`Store listing copy draft file is missing: ${app.storeListingCopyFile}.`);
    }
  } else {
    block("Store listing copy draft file is not declared.");
  }
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
  checkStatus(review.demoAccountPlanStatus, "Review demo account plan status", ["template-ready", "ready", "done", "approved", "ok"]);
  checkStatus(review.demoSeedDataStatus, "Review demo seed data status", ["script-ready", "ready", "done", "approved", "ok"]);
  if (review.demoSeedDataScript) {
    if (await fileExists(review.demoSeedDataScript)) pass("Review demo seed data script exists.");
    else block(`Review demo seed data script is missing: ${review.demoSeedDataScript}.`);
  } else {
    warn("Review demo seed data script is not declared.");
  }
  if (review.reviewNotesFile) {
    if (await fileExists(review.reviewNotesFile)) pass("Review notes template file exists.");
    else block(`Review notes template file is missing: ${review.reviewNotesFile}.`);
  } else {
    warn("Review notes template file is not declared.");
  }
  checkRequiredValue(review.minimumFunctionalityNotes, "Minimum functionality notes");

  const privacy = metadata.privacy || {};
  checkStatus(privacy.dataSafetyDraftStatus, "Privacy data safety draft status", ["draft-structured", "ready", "done", "approved", "ok"]);
  if (privacy.dataSafetyDraftFile) {
    if (await fileExists(privacy.dataSafetyDraftFile)) {
      pass("Privacy data safety draft file exists.");
      const privacyDraftText = await readText(privacy.dataSafetyDraftFile);
      try {
        validatePrivacyDataSafetyDraft(JSON.parse(privacyDraftText));
      } catch (error) {
        block(`Privacy data safety draft is invalid JSON: ${error.message}`);
      }
    } else {
      block(`Privacy data safety draft file is missing: ${privacy.dataSafetyDraftFile}.`);
    }
  } else {
    block("Privacy data safety draft file is not declared.");
  }

  checkStatus(privacy.formFillChecklistStatus, "Privacy form fill checklist status", ["draft-structured", "ready", "done", "approved", "ok"]);
  if (privacy.formFillChecklistFile) {
    if (await fileExists(privacy.formFillChecklistFile)) {
      pass("Privacy form fill checklist file exists.");
      validatePrivacyFormFillChecklist(await readText(privacy.formFillChecklistFile));
    } else {
      block(`Privacy form fill checklist file is missing: ${privacy.formFillChecklistFile}.`);
    }
  } else {
    block("Privacy form fill checklist file is not declared.");
  }

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

  const consoleSubmission = metadata.consoleSubmission || {};
  checkStatus(consoleSubmission.status, "Store console submission status", ["handoff-ready-waiting-owner-console-finalization", "ready", "done", "approved", "ok"]);
  if (consoleSubmission.handoffFile) {
    if (await fileExists(consoleSubmission.handoffFile)) pass("Store console submission handoff file exists.");
    else block(`Store console submission handoff file is missing: ${consoleSubmission.handoffFile}.`);
  } else {
    block("Store console submission handoff file is not declared.");
  }
  if (consoleSubmission.checkScript) {
    if (await fileExists(consoleSubmission.checkScript)) pass("Store console submission check script exists.");
    else block(`Store console submission check script is missing: ${consoleSubmission.checkScript}.`);
  } else {
    block("Store console submission check script is not declared.");
  }
  if (Array.isArray(consoleSubmission.openConsoleGates) && consoleSubmission.openConsoleGates.length >= 5) {
    pass("Store console submission tracks open console gates.");
  } else {
    warn("Store console submission should track the remaining console gates.");
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
    "store-listing-copy",
    "store-console-submission",
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

const reviewNotesText = await readText("store/review-notes-template.json");
if (reviewNotesText) {
  try {
    const reviewNotes = JSON.parse(reviewNotesText);
    if (reviewNotes.schemaVersion === "store-review-notes-template-v1") {
      pass("Review notes template schema version is current.");
    } else {
      block("Review notes template schemaVersion must be store-review-notes-template-v1.");
    }

    if (Array.isArray(reviewNotes.officialBasis) && reviewNotes.officialBasis.length >= 2) {
      pass("Review notes template includes official basis.");
    } else {
      warn("Review notes template should include Apple and Google official basis.");
    }

    const demoAccount = reviewNotes.demoAccount || {};
    if (demoAccount.username && demoAccount.passwordSecretRef && demoAccount.mfa && demoAccount.role) {
      pass("Review notes template defines demo account placeholders.");
    } else {
      block("Review notes template must define username, passwordSecretRef, mfa, and role placeholders.");
    }
    if (demoAccount.seedDataStatus === "script-ready" && demoAccount.seedDataScript && demoAccount.seedDataDryRunScript) {
      pass("Review notes template declares review demo seed scripts.");
    } else {
      warn("Review notes template should declare review demo seed scripts.");
    }
    if (Array.isArray(demoAccount.seedDataEnvironment) && demoAccount.seedDataEnvironment.includes("REVIEW_USERNAME") && demoAccount.seedDataEnvironment.includes("REVIEW_PASSWORD")) {
      pass("Review notes template declares review seed environment variables.");
    } else {
      warn("Review notes template should declare REVIEW_USERNAME and REVIEW_PASSWORD seed inputs.");
    }
    if (Array.isArray(demoAccount.seedDataIncludes) && demoAccount.seedDataIncludes.length >= 3) {
      pass("Review notes template describes seeded review data.");
    } else {
      warn("Review notes template should describe seeded review data.");
    }

    const appleReview = reviewNotes.appleReviewInformation || {};
    if (Array.isArray(appleReview.notesForReviewDraft) && appleReview.notesForReviewDraft.length >= 4) {
      pass("Apple review notes draft covers the reviewer path.");
    } else {
      block("Apple review notes draft should include at least four reviewer instructions.");
    }
    for (const attachment of appleReview.attachments || []) {
      if (await fileExists(attachment)) pass(`Review attachment exists: ${attachment}.`);
      else block(`Review attachment is missing: ${attachment}.`);
    }

    const googleAccess = reviewNotes.googlePlayAppAccess || {};
    if (googleAccess.accessType && Array.isArray(googleAccess.additionalInstructionsDraft) && googleAccess.additionalInstructionsDraft.length >= 4) {
      pass("Google Play app access instructions draft exists.");
    } else {
      block("Google Play app access instructions draft should include accessType and at least four instructions.");
    }
    if (Array.isArray(googleAccess.seedDataInstructions) && googleAccess.seedDataInstructions.length >= 3) {
      pass("Google Play app access instructions include seed data steps.");
    } else {
      warn("Google Play app access instructions should include seed data steps.");
    }

    const smokePath = Array.isArray(reviewNotes.reviewSmokePath) ? reviewNotes.reviewSmokePath : [];
    if (smokePath.length >= 5 && smokePath.every((step) => step.screen && step.action && step.expectedResult)) {
      pass("Review smoke path covers core reviewer screens.");
    } else {
      block("Review smoke path should cover at least five steps with screen, action, and expectedResult.");
    }

    if (Array.isArray(reviewNotes.notForRepository) && reviewNotes.notForRepository.some((item) => /password/i.test(item))) {
      pass("Review notes template warns against committing real secrets.");
    } else {
      warn("Review notes template should state that real passwords and secrets stay out of the repository.");
    }
  } catch (error) {
    block(`Review notes template is invalid JSON: ${error.message}`);
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
requireMarker(packageSource, "\"store:console-plan\"", "Package includes store console submission handoff check.");
requireMarker(packageSource, "\"cloud:check:strict\"", "Package includes strict cloud check.");
requireMarker(packageSource, "\"review:seed\"", "Package includes review demo seed script.");
requireMarker(packageSource, "\"review:seed:dry\"", "Package includes review demo seed dry-run script.");

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
