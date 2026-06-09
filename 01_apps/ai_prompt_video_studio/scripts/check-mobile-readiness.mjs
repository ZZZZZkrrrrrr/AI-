import { readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(".");
const failures = [];
const warnings = [];
const passes = [];

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function readProjectFile(relativePath) {
  try {
    return await readFile(path.join(rootDir, relativePath), "utf8");
  } catch {
    fail(`Missing required file: ${relativePath}`);
    return "";
  }
}

function requireIncludes(source, marker, label) {
  if (source.includes(marker)) {
    pass(label);
    return;
  }
  fail(`${label}: missing marker "${marker}"`);
}

function requirePattern(source, pattern, label) {
  if (pattern.test(source)) {
    pass(label);
    return;
  }
  fail(`${label}: pattern not found`);
}

function warnUnlessPattern(source, pattern, label) {
  if (pattern.test(source)) return;
  warn(label);
}

const appSource = await readProjectFile("src/App.jsx");
const stylesSource = await readProjectFile("src/styles.css");
const settingsSource = await readProjectFile("src/features/settings/SettingsPage.jsx");
const stitchSource = await readProjectFile("src/features/stitch/VideoStitchPage.jsx");

if (appSource) {
  requireIncludes(appSource, "const mobileTabItems", "Mobile bottom navigation model exists");
  for (const route of ['id: "overview"', 'id: "studio"', 'id: "assets"', 'id: "settings"']) {
    requireIncludes(appSource, route, `Mobile navigation includes ${route}`);
  }
  requireIncludes(appSource, 'className="mobile-bottom-nav"', "Mobile bottom navigation is rendered");
  requireIncludes(appSource, "beforeinstallprompt", "Android PWA install prompt is handled");
  requireIncludes(appSource, "appinstalled", "PWA installed event is handled");
  requireIncludes(appSource, "isIosInstallCandidate", "iOS manual install guide is handled");
  requireIncludes(appSource, "React.lazy(() => import(\"./features/settings/SettingsPage.jsx\"))", "Settings page is lazy loaded");
  requireIncludes(appSource, "React.lazy(() => import(\"./features/stitch/VideoStitchPage.jsx\"))", "Video stitch page is lazy loaded");
  requireIncludes(appSource, "mobile-create-tabs", "Mobile create step tabs are rendered");
  requireIncludes(appSource, "mobile-input-tabs", "Mobile input sub-tabs are rendered");
  requireIncludes(appSource, "mobileCreateIntentKey", "Mobile create intent storage key exists.");
  requireIncludes(appSource, "setMobileCreateIntent", "Mobile create intent setter exists.");
  requireIncludes(appSource, "consumeMobileCreateIntent", "Mobile create intent consumer exists.");
  requireIncludes(appSource, 'startsWith("studio:")', "Navigation supports studio intent routes.");
  requireIncludes(appSource, "mobileCreateViewForIntent", "Studio page maps beginner intent to create view.");
  requireIncludes(appSource, "mobileInputStepForIntent", "Studio page maps beginner intent to input step.");
  requireIncludes(appSource, "mobileEntryIntent", "Studio page consumes mobile entry intent.");
  requireIncludes(appSource, "mobile-beginner-launcher", "Mobile beginner launcher is rendered");
  requireIncludes(appSource, "const [beginnerMode, setBeginnerMode]", "Mobile beginner launcher has a local mode switch.");
  requireIncludes(appSource, "beginnerActionGroups", "Mobile beginner launcher has grouped actions.");
  requireIncludes(appSource, "新手模式", "Mobile beginner launcher identifies the beginner mode.");
  requireIncludes(appSource, "你想先做什么？", "Mobile beginner launcher starts with a task question.");
  requireIncludes(appSource, "图文", "Mobile beginner launcher includes the image/text segment.");
  requireIncludes(appSource, "视频", "Mobile beginner launcher includes the video segment.");
  requireIncludes(appSource, 'role="tablist"', "Mobile beginner segment uses tablist semantics.");
  requireIncludes(appSource, "aria-selected", "Mobile beginner segment exposes selected state.");
  requireIncludes(appSource, 'onClick={() => setBeginnerMode("image")}', "Image/text segment switches in place.");
  requireIncludes(appSource, 'onClick={() => setBeginnerMode("video")}', "Video segment switches in place.");
  for (const label of ["上传商品图", "整理素材", "提示词包"]) {
    requireIncludes(appSource, label, `Mobile image/text beginner action exists: ${label}`);
  }
  requireIncludes(appSource, 'page: "studio:images"', "Beginner image/video actions can open the product image step.");
  requireIncludes(appSource, 'page: "studio:prompt"', "Beginner prompt action can open the prompt package step.");
  for (const label of ["一键做视频", "批量生成", "图生视频", "视频拼接", "素材结果", "我的数据"]) {
    requireIncludes(appSource, label, `Mobile beginner action exists: ${label}`);
  }
  requirePattern(appSource, /beginnerActions\.map\(\(item\)\s*=>[\s\S]*navigate\(item\.page\)/, "Mobile beginner tiles route to real app pages.");
  requireIncludes(appSource, "mobile-task-card-list", "Mobile task cards are rendered");
  requireIncludes(appSource, "mobile-assets-view", "Mobile asset cards are rendered");
}

if (stitchSource) {
  requireIncludes(stitchSource, "MobileStitchVideoCards", "Mobile stitch video cards are implemented");
  requireIncludes(stitchSource, "mobile-stitch-video-list", "Mobile stitch video list is rendered");
  requireIncludes(stitchSource, "aria-label=\"手机端视频拼接列表\"", "Mobile stitch list has an accessible label");
}

if (settingsSource) {
  requireIncludes(settingsSource, "/legal/privacy.html", "Settings page links to privacy policy");
  requireIncludes(settingsSource, "/api/account/export", "Settings page includes data export action");
}

if (stylesSource) {
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)/, "Mobile breakpoint exists");
  requireIncludes(stylesSource, "env(safe-area-inset-bottom)", "Mobile safe area is respected");
  requireIncludes(stylesSource, ".mobile-bottom-nav", "Mobile bottom nav styles exist");
  requireIncludes(stylesSource, ".mobile-bottom-nav-item", "Mobile bottom nav item styles exist");
  requireIncludes(stylesSource, ".mobile-create-tabs button", "Mobile create tabs have button styles");
  requireIncludes(stylesSource, ".mobile-input-tabs button", "Mobile input tabs have button styles");
  requireIncludes(stylesSource, ".mobile-beginner-launcher", "Mobile beginner launcher styles exist");
  requireIncludes(stylesSource, ".mobile-action-tile", "Mobile beginner action tile styles exist");
  requireIncludes(stylesSource, ".mobile-action-grid", "Mobile beginner action grid styles exist");
  requireIncludes(stylesSource, ".mobile-task-card-list", "Mobile task card styles exist");
  requireIncludes(stylesSource, ".mobile-assets-view", "Mobile asset view styles exist");
  requireIncludes(stylesSource, ".mobile-stitch-video-list", "Mobile stitch card styles exist");
  requirePattern(stylesSource, /\.mobile-action-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "Mobile beginner actions use a two-column grid.");
  requirePattern(stylesSource, /\.mobile-action-tile\s*\{[^}]*min-height:\s*(?:1[4-9]\d|[2-9]\d\d)px/s, "Mobile beginner action tiles keep large tap targets.");
  requirePattern(stylesSource, /\.mobile-action-icon\s*\{[^}]*width:\s*(?:5[6-9]|[6-9]\d)px;[^}]*height:\s*(?:5[6-9]|[6-9]\d)px;[^}]*border-radius:\s*999px/s, "Mobile beginner action icons use large circular badges.");
  requirePattern(stylesSource, /\.mobile-mode-switch button\s*\{[^}]*min-height:\s*(?:4[4-9]|[5-9]\d)px/s, "Mobile content segment buttons keep at least 44px touch height.");
  requirePattern(stylesSource, /\.mobile-mode-switch button\.active\s*\{[^}]*background:\s*linear-gradient/s, "Mobile active segment uses a high-visibility gradient.");
  requirePattern(stylesSource, /\.pwa-install-banner\s*\{[^}]*order:\s*2;/s, "Mobile install prompt is placed after the beginner entry.");
  requirePattern(stylesSource, /\.assets-panel\s+\.assets-table\s*\{\s*display:\s*none;/s, "Mobile hides desktop asset table");
  requirePattern(stylesSource, /\.task-board-table,\s*\.libtv-table\s*\{\s*display:\s*none;/s, "Mobile hides task/libTV desktop tables");
  requirePattern(stylesSource, /\.stitch-table-wrap\s*\{\s*display:\s*none;/s, "Mobile hides desktop stitch table");
  requirePattern(stylesSource, /\.main\s*\{[^}]*padding-bottom:\s*calc\(88px \+ env\(safe-area-inset-bottom\)\)/s, "Main content leaves room for mobile bottom nav");

  warnUnlessPattern(stylesSource, /\.mobile-bottom-nav-item\s*\{[^}]*min-height:\s*(?:4[4-9]|[5-9]\d)px/s, "Mobile bottom nav items should keep at least 44px touch height.");
  warnUnlessPattern(stylesSource, /\.primary-button,\s*\.danger-button,\s*\.secondary-button,\s*\.ghost-button,\s*\.icon-button,\s*\.sidebar-toggle\s*\{[^}]*min-height:\s*(?:4[0-9]|[5-9]\d)px/s, "Mobile command buttons should keep at least 40px touch height.");
}

console.log("Mobile readiness check");
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
