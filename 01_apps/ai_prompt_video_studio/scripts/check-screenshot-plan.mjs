import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const planPath = path.join(root, "store", "screenshot-plan.json");
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
    const info = await stat(path.join(root, relativePath));
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function pngSize(relativePath) {
  try {
    const buffer = await readFile(path.join(root, relativePath));
    if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") return null;
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  } catch {
    return null;
  }
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function shotIds(set) {
  return new Set((set.shots || []).map((shot) => String(shot.id || "").trim()).filter(Boolean));
}

function shotFileName(index, shot) {
  return `${String(index + 1).padStart(2, "0")}-${String(shot.id || "shot").replace(/[^a-z0-9_-]+/gi, "-")}.png`;
}

let plan = null;
try {
  plan = JSON.parse(await readFile(planPath, "utf8"));
  pass("Screenshot plan is valid JSON.");
} catch (error) {
  block(`store/screenshot-plan.json is missing or invalid: ${error.message}`);
}

if (plan) {
  if (plan.schemaVersion === "store-screenshot-plan-v1") {
    pass("Screenshot plan schema version is current.");
  } else {
    block("Screenshot plan schemaVersion must be store-screenshot-plan-v1.");
  }

  if (Array.isArray(plan.officialReferences) && plan.officialReferences.length >= 2) {
    pass("Official screenshot references are listed.");
  } else {
    warn("Add Apple and Google official screenshot requirement references.");
  }

  if (Array.isArray(plan.capturePrinciples) && plan.capturePrinciples.length >= 4) {
    pass("Screenshot capture principles are documented.");
  } else {
    warn("Screenshot capture principles should cover real UI, privacy, localization, and legibility.");
  }

  const sets = Array.isArray(plan.sets) ? plan.sets : [];
  if (!sets.length) {
    block("Screenshot plan has no screenshot sets.");
  }

  const setIds = new Set();
  for (const set of sets) {
    if (!isObject(set)) {
      block("Screenshot set must be an object.");
      continue;
    }
    const id = String(set.id || "").trim();
    if (!id) {
      block("Screenshot set is missing id.");
      continue;
    }
    if (setIds.has(id)) block(`Duplicate screenshot set id: ${id}.`);
    setIds.add(id);

    const shots = Array.isArray(set.shots) ? set.shots : [];
    const minimumShots = Number(set.minimumShots || 0);
    if (shots.length >= minimumShots && shots.length > 0) {
      pass(`${id} has ${shots.length} planned shots.`);
    } else {
      block(`${id} needs at least ${minimumShots || 1} planned shots.`);
    }

    for (const shot of shots) {
      if (!shot.id) block(`${id} has a shot without id.`);
      if (!shot.title) warn(`${id}/${shot.id || "unknown"} should have a store-facing title.`);
      if (set.channel?.includes("web") && !shot.route) {
        warn(`${id}/${shot.id || "unknown"} should include a capture route for browser screenshots.`);
      }
      if (shot.interactions !== undefined) {
        if (!Array.isArray(shot.interactions)) {
          block(`${id}/${shot.id || "unknown"} interactions must be an array.`);
        } else {
          pass(`${id}/${shot.id || "unknown"} declares capture interactions.`);
          for (const interaction of shot.interactions) {
            if (!isObject(interaction)) {
              block(`${id}/${shot.id || "unknown"} interaction must be an object.`);
              continue;
            }
            if (interaction.type !== "clickText") {
              block(`${id}/${shot.id || "unknown"} interaction type must be clickText.`);
            } else if (!String(interaction.text || "").trim()) {
              block(`${id}/${shot.id || "unknown"} clickText interaction is missing text.`);
            } else {
              pass(`${id}/${shot.id || "unknown"} has a valid clickText interaction.`);
            }
          }
        }
      }
      if (shot.id === "home-image") {
        const hasImageModeClick = Array.isArray(shot.interactions)
          && shot.interactions.some((interaction) => interaction.type === "clickText" && interaction.text === "图文");
        if (hasImageModeClick) {
          pass(`${id}/home-image captures the image/text mode segment.`);
        } else {
          block(`${id}/home-image must click the 图文 segment before capture.`);
        }
      }
      if (shot.id === "create-prompt-intent") {
        const interactions = Array.isArray(shot.interactions) ? shot.interactions : [];
        const clicks = interactions
          .filter((interaction) => interaction.type === "clickText")
          .map((interaction) => interaction.text);
        if (clicks[0] === "图文" && clicks[1] === "提示词包") {
          pass(`${id}/create-prompt-intent captures the prompt package guided entry.`);
        } else {
          block(`${id}/create-prompt-intent must click 图文 and then 提示词包 before capture.`);
        }
      }
    }

    if (set.channel?.includes("web")) {
      const viewport = set.viewport || {};
      if (Number(viewport.width) >= 320 && Number(viewport.height) >= 640) {
        pass(`${id} has a mobile/tablet viewport.`);
      } else {
        block(`${id} needs a realistic viewport width and height.`);
      }
      if (!["planned", "ready", "captured"].includes(String(set.status || ""))) {
        warn(`${id} status is ${set.status || "empty"}; use planned, ready, or captured for web sets.`);
      }
      if (String(set.status || "") === "captured") {
        const expectedWidth = Number(set.viewport?.width || 0) * Number(set.viewport?.deviceScaleFactor || 1);
        const expectedHeight = Number(set.viewport?.height || 0) * Number(set.viewport?.deviceScaleFactor || 1);
        for (const [index, shot] of shots.entries()) {
          const screenshotPath = `store/screenshots/${id}/${shotFileName(index, shot)}`;
          if (await fileExists(screenshotPath)) {
            pass(`${screenshotPath} exists.`);
            const size = await pngSize(screenshotPath);
            if (!size) {
              block(`${screenshotPath} is not a readable PNG image.`);
            } else if (expectedWidth && expectedHeight && (size.width !== expectedWidth || size.height !== expectedHeight)) {
              block(`${screenshotPath} size is ${size.width}x${size.height}; expected ${expectedWidth}x${expectedHeight}.`);
            } else {
              pass(`${screenshotPath} size matches the planned viewport scale.`);
            }
          } else {
            block(`${screenshotPath} is missing for captured screenshot set ${id}.`);
          }
        }
      }
    }

    if (set.channel === "app-store") {
      if (Array.isArray(set.targetFamilies) && set.targetFamilies.length) {
        pass(`${id} lists App Store target device families.`);
      } else {
        warn(`${id} should list App Store target device families before submission.`);
      }
      if (String(set.status || "").includes("blocked") && !(await fileExists("ios/App/App/Info.plist"))) {
        pass(`${id} is correctly blocked until the iOS native project exists.`);
      }
    }

    if (set.channel === "google-play") {
      if (Array.isArray(set.targetSizes) && set.targetSizes.length) {
        pass(`${id} lists Google Play target screenshot sizes.`);
      } else {
        warn(`${id} should list Google Play target screenshot sizes before submission.`);
      }
      if (String(set.status || "").includes("blocked") && !(await fileExists("android/app/build.gradle"))) {
        pass(`${id} is correctly blocked until the Android native project exists.`);
      }
    }
  }

  const requiredScenes = Array.isArray(plan.requiredScenes) ? plan.requiredScenes : [];
  const mergedShotIds = new Set(sets.flatMap((set) => [...shotIds(set)]));
  for (const scene of requiredScenes) {
    if (mergedShotIds.has(scene)) {
      pass(`Required scene is planned: ${scene}.`);
    } else {
      block(`Required scene is missing from screenshot plan: ${scene}.`);
    }
  }

  for (const requiredSet of ["mobile-web-390", "mobile-web-430", "tablet-web-768", "ios-app-store-iphone", "google-play-phone"]) {
    if (setIds.has(requiredSet)) pass(`Required screenshot set exists: ${requiredSet}.`);
    else block(`Required screenshot set is missing: ${requiredSet}.`);
  }
}

console.log("Screenshot plan check");
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
