import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const publicDir = path.resolve("public");
const failures = [];
const checkedFiles = new Set();

function toPublicPath(src) {
  return src.split(/[?#]/, 1)[0].replace(/^\/+/, "");
}

function resolvePublic(src) {
  return path.join(publicDir, toPublicPath(src));
}

function fail(message) {
  failures.push(message);
}

function requireIncludes(source, marker, label) {
  if (source.includes(marker)) return;
  fail(`${label}: missing marker "${marker}"`);
}

async function requireFile(relativePath, label = relativePath) {
  const publicPath = toPublicPath(relativePath);
  const absolutePath = path.join(publicDir, publicPath);
  try {
    const info = await stat(absolutePath);
    if (!info.isFile()) {
      fail(`${label} is not a file: ${relativePath}`);
      return null;
    }
    if (info.size <= 0) {
      fail(`${label} is empty: ${relativePath}`);
      return null;
    }
    checkedFiles.add(publicPath);
    return info;
  } catch {
    fail(`${label} is missing: ${relativePath}`);
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

async function readRequiredText(relativePath, label) {
  await requireFile(relativePath, label);
  try {
    return await readFile(resolvePublic(relativePath), "utf8");
  } catch {
    return "";
  }
}

await Promise.all([
  requireFile("manifest.webmanifest", "Web app manifest"),
  requireFile("sw.js", "Service Worker"),
  requireFile("offline.html", "Offline page"),
  requireFile("install.html", "Mobile install guide page"),
  requireFile("support.html", "Support page"),
  requireFile("icons/icon-192.png", "192px app icon"),
  requireFile("icons/icon-512.png", "512px app icon"),
  requireFile("icons/icon-maskable-512.png", "Maskable app icon")
]);

const manifestText = await readRequiredText("manifest.webmanifest", "Web app manifest");
let manifest = null;

try {
  manifest = JSON.parse(manifestText);
} catch (error) {
  fail(`Web app manifest is invalid JSON: ${error.message}`);
}

if (manifest) {
  const requiredFields = [
    "name",
    "short_name",
    "description",
    "id",
    "start_url",
    "scope",
    "display",
    "background_color",
    "theme_color",
    "lang"
  ];

  for (const field of requiredFields) {
    if (!manifest[field]) fail(`Web app manifest is missing "${field}".`);
  }

  if (manifest.display !== "standalone") {
    fail('Web app manifest "display" should be "standalone" for app-like launch.');
  }

  if (!Array.isArray(manifest.display_override) || !manifest.display_override.includes("standalone")) {
    fail('Web app manifest "display_override" should include "standalone".');
  }

  if (!Array.isArray(manifest.shortcuts) || manifest.shortcuts.length < 3) {
    fail("Web app manifest should define at least three app shortcuts: create, assets, and settings.");
  } else {
    const shortcutUrls = new Set(manifest.shortcuts.map((shortcut) => shortcut.url));
    for (const url of ["/#/studio", "/#/assets", "/#/settings"]) {
      if (!shortcutUrls.has(url)) fail(`Web app manifest is missing shortcut url: ${url}.`);
    }
    for (const shortcut of manifest.shortcuts) {
      if (!shortcut.name || !shortcut.short_name || !shortcut.url) {
        fail("Each manifest shortcut should include name, short_name, and url.");
      }
      if (Array.isArray(shortcut.icons)) {
        for (const icon of shortcut.icons) {
          if (icon.src) await requireFile(toPublicPath(icon.src), `Shortcut icon ${icon.src}`);
        }
      }
    }
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length < 3) {
    fail("Web app manifest should define at least 192px, 512px, and maskable icons.");
  } else {
    if (!manifest.icons.some((icon) => hasIconSize(icon, "192x192"))) {
      fail("Web app manifest is missing a 192x192 icon.");
    }

    if (!manifest.icons.some((icon) => hasIconSize(icon, "512x512"))) {
      fail("Web app manifest is missing a 512x512 icon.");
    }

    if (!manifest.icons.some((icon) => hasIconPurpose(icon, "maskable"))) {
      fail('Web app manifest is missing an icon with purpose "maskable".');
    }

    for (const icon of manifest.icons) {
      if (!icon.src) {
        fail("Web app manifest has an icon without src.");
        continue;
      }
      await requireFile(toPublicPath(icon.src), `Manifest icon ${icon.src}`);
      if (icon.type && icon.type !== "image/png") {
        fail(`Manifest icon ${icon.src} should use image/png, got ${icon.type}.`);
      }
    }
  }
}

const serviceWorkerText = await readRequiredText("sw.js", "Service Worker");
for (const eventName of ["install", "activate", "fetch"]) {
  const pattern = new RegExp(`addEventListener\\(\\s*["']${eventName}["']`);
  if (!pattern.test(serviceWorkerText)) {
    fail(`Service Worker is missing the "${eventName}" event handler.`);
  }
}
requireIncludes(serviceWorkerText, "/install.html", "Service Worker precaches the mobile install guide");

const offlineText = await readRequiredText("offline.html", "Offline page");
if (!/<html[\s>]/i.test(offlineText) || !/<body[\s>]/i.test(offlineText)) {
  fail("Offline page should be a complete HTML document.");
}

if (!/离线|offline/i.test(offlineText)) {
  fail('Offline page should clearly communicate the "offline" state.');
}

for (const marker of [
  "网络暂时断开",
  "先别退出",
  "offline-checklist",
  "任务中心",
  "重新连接",
  "/support.html"
]) {
  requireIncludes(offlineText, marker, `Offline page includes ${marker}`);
}

const installText = await readRequiredText("install.html", "Mobile install guide page");
for (const marker of [
  "https://www.zkraiflow.top/",
  "Safari",
  "Chrome",
  "添加到主屏幕",
  "/support.html",
  "/legal/privacy.html",
  "/legal/delete-account.html",
  "support.apple.com",
  "support.google.com"
]) {
  requireIncludes(installText, marker, `Mobile install guide includes ${marker}`);
}

for (const marker of [
  "像 App 一样打开",
  "只需要做一次",
  "install-hero-actions",
  "打开工作台",
  "安装失败怎么办",
  "install-quick-card",
  "一分钟判断",
  "install-check-grid",
  "install-step-list"
]) {
  requireIncludes(installText, marker, `Mobile install guide keeps beginner-friendly ${marker}`);
}

const legalCssText = await readRequiredText("legal/legal.css", "Legal page stylesheet");
for (const marker of [
  ".install-hero-actions",
  ".install-primary-link",
  ".install-quick-card",
  ".install-check-grid",
  ".install-step-list"
]) {
  requireIncludes(legalCssText, marker, `Legal stylesheet includes ${marker}`);
}

const supportText = await readRequiredText("support.html", "Support page");
for (const marker of [
  "/install.html",
  "https://www.zkraiflow.top/",
  "/legal/privacy.html",
  "/legal/delete-account.html",
  "/legal/ai-disclosure.html"
]) {
  requireIncludes(supportText, marker, `Support page includes ${marker}`);
}

for (const marker of [
  "遇到问题先点这里",
  "不用理解技术原因",
  "support-quick-panel",
  "常见问题快捷排查",
  "support-action-grid",
  "support-action-card",
  "生成卡住",
  "素材找不到",
  "结果不满意",
  "账号 / 数据",
  "联系与处理说明",
  "任务中心"
]) {
  requireIncludes(supportText, marker, `Support page keeps beginner-friendly ${marker}`);
}

for (const marker of [
  ".support-quick-panel",
  ".support-action-grid",
  ".support-action-card",
  ".support-status-card"
]) {
  requireIncludes(legalCssText, marker, `Legal stylesheet includes ${marker}`);
}

if (failures.length) {
  console.error("PWA asset check failed:");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`PWA asset check ok: ${checkedFiles.size} public files verified.`);
