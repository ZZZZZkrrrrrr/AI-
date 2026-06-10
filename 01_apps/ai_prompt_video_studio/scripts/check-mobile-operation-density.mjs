import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const passes = [];
const failures = [];
const warnings = [];

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function readProjectFile(relativePath, { workspace = false } = {}) {
  const fullPath = workspace ? path.join(workspaceRoot, relativePath) : path.join(appRoot, relativePath);
  try {
    return await readFile(fullPath, "utf8");
  } catch (error) {
    fail(`Missing required file: ${workspace ? relativePath : relativePath}: ${error.message}`);
    return "";
  }
}

async function requireFile(relativePath, label, { workspace = false } = {}) {
  const fullPath = workspace ? path.join(workspaceRoot, relativePath) : path.join(appRoot, relativePath);
  try {
    const info = await stat(fullPath);
    if (info.isFile() && info.size > 0) {
      pass(label);
      return;
    }
    fail(`${label}: file is empty or not a file.`);
  } catch {
    fail(`${label}: missing ${relativePath}.`);
  }
}

function extractBlock(source, selector, { after = 0 } = {}) {
  const start = source.indexOf(selector, after);
  if (start === -1) return "";
  const open = source.indexOf("{", start);
  if (open === -1) return "";

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return "";
}

function extractLastBlock(source, selector) {
  const start = source.lastIndexOf(selector);
  if (start === -1) return "";
  return extractBlock(source, selector, { after: start });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractLastExactBlock(source, selector) {
  const pattern = new RegExp(`(^|\\n)\\s*${escapeRegExp(selector)}\\s*\\{`, "g");
  let match;
  let lastStart = -1;
  while ((match = pattern.exec(source))) {
    lastStart = match.index;
  }
  if (lastStart === -1) return "";
  const selectorStart = source.indexOf(selector, lastStart);
  return extractBlock(source, selector, { after: selectorStart });
}

function extractMediaBlock(source, query) {
  const marker = `@media (${query})`;
  const start = source.indexOf(marker);
  if (start === -1) return "";
  return extractBlock(source, marker);
}

function cssNumber(block, property) {
  const match = block.match(new RegExp(`${property}\\s*:\\s*([\\d.]+)px`, "i"));
  return match ? Number(match[1]) : null;
}

function cssCalcNumber(block, property) {
  const match = block.match(new RegExp(`${property}\\s*:\\s*calc\\(([\\d.]+)px\\s*\\+\\s*env\\(safe-area-inset-bottom\\)\\)`, "i"));
  return match ? Number(match[1]) : null;
}

function requireRange(value, min, max, label) {
  if (value === null || Number.isNaN(value)) {
    fail(`${label}: size is missing.`);
    return;
  }
  if (value < min) {
    fail(`${label}: ${value}px is too small; expected at least ${min}px.`);
    return;
  }
  if (value > max) {
    fail(`${label}: ${value}px is too large; expected no more than ${max}px.`);
    return;
  }
  pass(`${label}: ${value}px.`);
}

function requireContains(block, marker, label) {
  if (block.includes(marker)) pass(label);
  else fail(`${label}: missing "${marker}".`);
}

const stylesSource = await readProjectFile("src/styles.css");
const packageSource = await readProjectFile("package.json");
const qaPlanSource = await readProjectFile("store/mobile-device-qa-plan.json");
const densityDocSource = await readProjectFile("00_docs/MOBILE_OPERATION_DENSITY_ACCEPTANCE_2026-06-10.md", {
  workspace: true
});

if (stylesSource) {
  const smallPhoneBlock = extractMediaBlock(stylesSource, "max-width: 560px");
  const mobileBlock = extractMediaBlock(stylesSource, "max-width: 900px");
  const actionTile = extractBlock(stylesSource, ".mobile-action-tile");
  const actionIcon = extractBlock(stylesSource, ".mobile-action-icon");
  const actionLabel = extractBlock(stylesSource, ".mobile-action-tile strong");
  const statusCard = extractLastExactBlock(smallPhoneBlock, ".overview-status-card");
  const createTabsButton = extractLastExactBlock(smallPhoneBlock, ".mobile-create-tabs button");
  const inputTabsButton = extractLastExactBlock(smallPhoneBlock, ".mobile-input-tabs button");
  const modelChannelCard = extractLastExactBlock(smallPhoneBlock, ".model-channel-card");
  const bottomNav = extractLastExactBlock(stylesSource, ".mobile-bottom-nav");
  const bottomNavItem = extractLastExactBlock(stylesSource, ".mobile-bottom-nav-item");
  const mainMobile = extractLastBlock(stylesSource, ".main");

  if (smallPhoneBlock) pass("Small-phone density breakpoint exists.");
  else fail("Small-phone density breakpoint is missing.");
  if (mobileBlock) pass("Mobile layout breakpoint exists.");
  else fail("Mobile layout breakpoint is missing.");

  requireRange(cssNumber(actionTile, "min-height"), 112, 136, "Beginner operation card height");
  requireRange(cssNumber(actionIcon, "width"), 52, 58, "Beginner circular icon width");
  requireRange(cssNumber(actionIcon, "height"), 52, 58, "Beginner circular icon height");
  requireRange(cssNumber(statusCard, "min-height"), 84, 100, "Overview status card height on small phones");
  requireRange(cssNumber(createTabsButton, "min-height"), 40, 46, "Create step tab height");
  requireRange(cssNumber(inputTabsButton, "min-height"), 44, 50, "Input step card height");
  requireRange(cssNumber(modelChannelCard, "min-height"), 104, 120, "Model channel card height on small phones");
  requireRange(cssNumber(bottomNavItem, "min-height"), 44, 48, "Bottom navigation item height");
  requireRange(cssCalcNumber(mainMobile, "padding-bottom"), 74, 82, "Main bottom safe-area reserve");

  const overviewGridBlock = extractLastBlock(smallPhoneBlock, ".overview-status-grid");
  requireContains(overviewGridBlock, "repeat(2, minmax(0, 1fr))", "Small-phone overview cards stay in two columns.");
  requireContains(bottomNav, "env(safe-area-inset-bottom)", "Bottom navigation respects the phone safe area.");
  requireContains(actionLabel, "overflow-wrap: anywhere", "Beginner card labels can wrap without overflow.");
}

if (packageSource) {
  if (packageSource.includes('"mobile:density"')) pass("mobile:density npm script exists.");
  else fail("package.json must expose npm run mobile:density.");
}

if (qaPlanSource) {
  if (qaPlanSource.includes('"mobile:density"')) pass("Mobile QA plan references mobile:density.");
  else fail("Mobile QA plan should include mobile:density in required scripts or automation commands.");
  if (qaPlanSource.includes('"operation-density"')) pass("Mobile QA plan includes an operation-density suite.");
  else fail("Mobile QA plan should include an operation-density suite.");
}

if (densityDocSource) {
  for (const marker of [
    "128px",
    "54px",
    "92px",
    "46px",
    "78px",
    "390px",
    "430px",
    "mobile:density"
  ]) {
    if (densityDocSource.includes(marker)) pass(`Density acceptance doc records ${marker}.`);
    else warn(`Density acceptance doc should mention ${marker}.`);
  }
}

await requireFile("store/screenshots/mobile-web-390/01-home.png", "Small phone home screenshot evidence exists.");
await requireFile("store/screenshots/mobile-web-390/05-create.png", "Small phone create screenshot evidence exists.");
await requireFile("store/screenshots/mobile-web-430/02-create.png", "Large phone create screenshot evidence exists.");
await requireFile("00_docs/MOBILE_OPERATION_DENSITY_ACCEPTANCE_2026-06-10.md", "Density acceptance document exists.", {
  workspace: true
});

console.log("Mobile operation density check");
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
