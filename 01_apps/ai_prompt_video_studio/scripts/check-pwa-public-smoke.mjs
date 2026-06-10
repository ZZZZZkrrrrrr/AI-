import { readFile } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const timeoutMs = Number(process.env.PUBLIC_PWA_SMOKE_TIMEOUT_MS || 15000);
const baseUrlOverride = process.env.PUBLIC_PWA_SMOKE_BASE_URL || "";
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

async function readJson(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(appRoot, relativePath), "utf8"));
  } catch (error) {
    block(`${relativePath} is missing or invalid JSON: ${error.message}`);
    return null;
  }
}

function publicOriginFromPlan(plan) {
  const value = String(baseUrlOverride || plan?.publicOrigin || "").trim();
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      block(`PWA public smoke base URL must use HTTPS, got ${value}.`);
      return null;
    }
    return url.origin;
  } catch {
    block(`PWA public smoke base URL is invalid: ${value || "missing"}.`);
    return null;
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "cache-control": "no-cache"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, label) {
  try {
    const response = await fetchWithTimeout(url);
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (!response.ok) {
      block(`${label} returned HTTP ${response.status}: ${url}`);
      return null;
    }
    if (!text.trim()) {
      block(`${label} returned an empty body: ${url}`);
      return null;
    }
    pass(`${label} is reachable with HTTP ${response.status}.`);
    return { text, contentType, response };
  } catch (error) {
    block(`${label} request failed: ${error.message}`);
    return null;
  }
}

async function fetchBinary(url, label) {
  try {
    const response = await fetchWithTimeout(url);
    const contentType = response.headers.get("content-type") || "";
    const data = await response.arrayBuffer();
    if (!response.ok) {
      block(`${label} returned HTTP ${response.status}: ${url}`);
      return null;
    }
    if (!data.byteLength) {
      block(`${label} returned an empty file: ${url}`);
      return null;
    }
    pass(`${label} is reachable with ${data.byteLength} bytes.`);
    return { contentType, size: data.byteLength, response };
  } catch (error) {
    block(`${label} request failed: ${error.message}`);
    return null;
  }
}

function hasIconSize(icon, size) {
  return String(icon.sizes || "")
    .split(/\s+/)
    .filter(Boolean)
    .includes(size);
}

function hasIconPurpose(icon, purpose) {
  return String(icon.purpose || "any")
    .split(/\s+/)
    .filter(Boolean)
    .includes(purpose);
}

function requireContentType(contentType, pattern, label) {
  if (pattern.test(contentType)) pass(`${label} content type is ${contentType}.`);
  else warn(`${label} content type is ${contentType || "missing"}, expected ${pattern}.`);
}

const plan = await readJson("store/pwa-production-smoke-plan.json");
const origin = publicOriginFromPlan(plan);

if (origin) {
  pass(`PWA public smoke target is ${origin}.`);
  if (origin === "https://www.zkraiflow.top") pass("PWA public smoke uses the project production domain.");
  else warn(`PWA public smoke is using override origin ${origin}.`);

  const manifestResult = await fetchText(`${origin}/manifest.webmanifest`, "Public manifest");
  if (manifestResult) {
    requireContentType(manifestResult.contentType, /json|manifest/i, "Public manifest");
    try {
      const manifest = JSON.parse(manifestResult.text);
      if (manifest.display === "standalone") pass("Public manifest display is standalone.");
      else block("Public manifest display must be standalone.");
      if (manifest.start_url === "/" && manifest.scope === "/") pass("Public manifest start_url and scope are root.");
      else block("Public manifest start_url and scope should both be /.");
      if (manifest.name && manifest.short_name && manifest.description) pass("Public manifest has app name, short name, and description.");
      else block("Public manifest must include name, short_name, and description.");
      if (Array.isArray(manifest.icons) && manifest.icons.length >= 3) pass("Public manifest declares at least three icons.");
      else block("Public manifest should declare at least three icons.");
      if ((manifest.icons || []).some((icon) => hasIconSize(icon, "192x192"))) pass("Public manifest declares a 192x192 icon.");
      else block("Public manifest is missing a 192x192 icon.");
      if ((manifest.icons || []).some((icon) => hasIconSize(icon, "512x512"))) pass("Public manifest declares a 512x512 icon.");
      else block("Public manifest is missing a 512x512 icon.");
      if ((manifest.icons || []).some((icon) => hasIconPurpose(icon, "maskable"))) pass("Public manifest declares a maskable icon.");
      else block("Public manifest is missing a maskable icon.");
      const shortcutUrls = new Set((manifest.shortcuts || []).map((shortcut) => shortcut.url));
      for (const url of ["/#/studio", "/#/assets", "/#/settings"]) {
        if (shortcutUrls.has(url)) pass(`Public manifest shortcut exists: ${url}.`);
        else warn(`Public manifest shortcut is missing: ${url}.`);
      }
    } catch (error) {
      block(`Public manifest is not valid JSON: ${error.message}`);
    }
  }

  const serviceWorkerResult = await fetchText(`${origin}/sw.js`, "Public service worker");
  if (serviceWorkerResult) {
    requireContentType(serviceWorkerResult.contentType, /javascript|text\/plain|application\/octet-stream/i, "Public service worker");
    for (const eventName of ["install", "activate", "fetch"]) {
      const pattern = new RegExp(`addEventListener\\(\\s*["']${eventName}["']`);
      if (pattern.test(serviceWorkerResult.text)) pass(`Public service worker has ${eventName} handler.`);
      else block(`Public service worker is missing ${eventName} handler.`);
    }
    if (/addEventListener\(\s*["']message["']/.test(serviceWorkerResult.text) && /SKIP_WAITING/.test(serviceWorkerResult.text)) {
      pass("Public service worker supports user-confirmed update activation.");
    } else {
      warn("Public service worker has not yet deployed the SKIP_WAITING message update flow.");
    }
    if (/\/api\//.test(serviceWorkerResult.text) && /startsWith\(["']\/api\//.test(serviceWorkerResult.text)) {
      pass("Public service worker excludes API requests from cache handling.");
    } else {
      warn("Public service worker should explicitly avoid caching API requests.");
    }
  }

  const offlineResult = await fetchText(`${origin}/offline.html`, "Public offline page");
  if (offlineResult) {
    requireContentType(offlineResult.contentType, /text\/html/i, "Public offline page");
    if (/<html[\s>]/i.test(offlineResult.text) && /<body[\s>]/i.test(offlineResult.text)) {
      pass("Public offline page is a complete HTML document.");
    } else {
      block("Public offline page should be a complete HTML document.");
    }
    if (/offline|离线|绂荤嚎/i.test(offlineResult.text)) pass("Public offline page communicates offline state.");
    else block("Public offline page must communicate offline state.");
  }

  for (const [pathName, label] of [
    ["/icons/icon-192.png", "Public 192px icon"],
    ["/icons/icon-512.png", "Public 512px icon"],
    ["/icons/icon-maskable-512.png", "Public maskable icon"]
  ]) {
    const icon = await fetchBinary(`${origin}${pathName}`, label);
    if (icon) requireContentType(icon.contentType, /image\/png/i, label);
  }
}

console.log("PWA public smoke check");
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

if (strict && warnings.length) process.exit(1);
