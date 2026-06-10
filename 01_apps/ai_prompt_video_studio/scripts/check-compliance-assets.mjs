import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const publicDir = path.resolve("public");
const rootDir = path.resolve(".");
const failures = [];
const warnings = [];

const requiredPages = [
  {
    path: "legal/index.html",
    label: "Legal hub",
    terms: ["隐私政策", "用户协议", "AI 生成内容说明"]
  },
  {
    path: "legal/privacy.html",
    label: "Privacy policy",
    terms: ["收集", "使用", "保存", "共享", "删除", "第三方", "AI", "联系方式"]
  },
  {
    path: "legal/terms.html",
    label: "Terms of service",
    terms: ["账号", "上传", "AI 生成", "禁止", "责任", "终止"]
  },
  {
    path: "legal/ai-disclosure.html",
    label: "AI disclosure",
    terms: ["AI", "生成", "标识", "不得删除", "模型", "任务"]
  },
  {
    path: "legal/delete-account.html",
    label: "Account deletion page",
    terms: ["删除账号", "数据", "申请", "二次确认", "无法登录", "删除范围", "可能保留", "处理时限"]
  },
  {
    path: "legal/legal.css",
    label: "Legal page stylesheet",
    terms: [".legal-shell", ".legal-section"]
  }
];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function readRequiredFile(relativePath, label) {
  const absolute = path.join(publicDir, relativePath);
  try {
    const info = await stat(absolute);
    if (!info.isFile()) {
      fail(`${label} is not a file: ${relativePath}`);
      return "";
    }
    if (info.size <= 0) {
      fail(`${label} is empty: ${relativePath}`);
      return "";
    }
    return await readFile(absolute, "utf8");
  } catch {
    fail(`${label} is missing: ${relativePath}`);
    return "";
  }
}

for (const page of requiredPages) {
  const content = await readRequiredFile(page.path, page.label);
  if (!content) continue;

  for (const term of page.terms) {
    if (!content.includes(term)) {
      fail(`${page.label} is missing required topic: ${term}`);
    }
  }

  if (/正式发布前|补齐|准备版本/.test(content)) {
    warn(`${page.label} still contains pre-release wording. Review before store submission.`);
  }
}

const legalPagePaths = [
  "/legal/index.html",
  "/legal/privacy.html",
  "/legal/terms.html",
  "/legal/ai-disclosure.html",
  "/legal/delete-account.html"
];

const serviceWorker = await readFile(path.join(publicDir, "sw.js"), "utf8").catch(() => "");
if (!serviceWorker) {
  fail("Service Worker is missing, so legal pages are not covered by PWA cache checks.");
} else {
  for (const pagePath of legalPagePaths) {
    if (!serviceWorker.includes(pagePath)) {
      fail(`Service Worker does not precache compliance page: ${pagePath}`);
    }
  }
}

const appSource = await readFile(path.join(rootDir, "src", "App.jsx"), "utf8").catch(() => "");
const settingsPageSource = await readFile(
  path.join(rootDir, "src", "features", "settings", "SettingsPage.jsx"),
  "utf8"
).catch(() => "");
const evidenceModuleSource = await readFile(
  path.join(rootDir, "src", "shared", "compliance", "aiEvidencePack.js"),
  "utf8"
).catch(() => "");
if (!appSource) {
  warn("src/App.jsx could not be read, so settings page legal links were not verified.");
} else {
  for (const pagePath of legalPagePaths.filter((pagePath) => pagePath !== "/legal/index.html")) {
    if (!settingsPageSource.includes(pagePath)) {
      fail(`Settings page is missing a visible legal link: ${pagePath}`);
    }
  }
  for (const marker of ["数据与账号", "当前登录密码", "二次确认", "申请状态", "数据权利审核队列", "/api/account/export", "/api/account/data-rights-request", "/api/account/data-rights-requests", "/api/admin/data-rights-requests"]) {
    if (!settingsPageSource.includes(marker)) {
      fail(`Settings page is missing data rights marker: ${marker}`);
    }
  }
  for (const marker of ["AI 证据包", "buildAiDisclosureEvidencePack"]) {
    if (!appSource.includes(marker)) {
      fail(`Studio page is missing AI disclosure evidence marker: ${marker}`);
    }
  }
}

if (!settingsPageSource) {
  fail("Settings page module is missing: src/features/settings/SettingsPage.jsx");
}

if (!evidenceModuleSource) {
  fail("AI disclosure evidence module is missing: src/shared/compliance/aiEvidencePack.js");
} else {
  for (const marker of ["ai-disclosure-evidence-v1", "userMustNotRemoveAiLabel", "reviewChecklist"]) {
    if (!evidenceModuleSource.includes(marker)) {
      fail(`AI disclosure evidence module is missing marker: ${marker}`);
    }
  }
}

const serverSource = await readFile(path.join(rootDir, "server.js"), "utf8").catch(() => "");
if (!serverSource) {
  warn("server.js could not be read, so account data rights APIs were not verified.");
} else {
  for (const marker of ["/api/account/export", "/api/account/data-rights-request", "/api/account/data-rights-requests", "/api/admin/data-rights-requests", "readDataRightsRequests", "updateDataRightsRequestStatus", "requireDataRightsAdmin", "DELETE_ACCOUNT", "verifyDataRightsIdentity", "currentPassword", "dataRightsStatusLabel"]) {
    if (!serverSource.includes(marker)) {
      fail(`Server is missing account data rights support: ${marker}`);
    }
  }
}

console.log("Compliance asset check");
console.log(`Pages checked: ${requiredPages.length}`);
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
