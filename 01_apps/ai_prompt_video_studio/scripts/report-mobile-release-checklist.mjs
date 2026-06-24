import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const passes = [];
const failures = [];

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

async function readProjectFile(relativePath, { workspace = false } = {}) {
  const fullPath = workspace ? path.join(workspaceRoot, relativePath) : path.join(appRoot, relativePath);
  try {
    return await readFile(fullPath, "utf8");
  } catch (error) {
    fail(`缺少文件：${workspace ? relativePath : relativePath} (${error.message})`);
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
    fail(`${label}：文件为空。`);
  } catch {
    fail(`${label}：缺少 ${relativePath}。`);
  }
}

function requireContains(source, marker, label) {
  if (source.includes(marker)) {
    pass(label);
    return;
  }
  fail(`${label}：缺少 "${marker}"。`);
}

function requireNotContains(source, marker, label) {
  if (!source.includes(marker)) {
    pass(label);
    return;
  }
  fail(`${label}：仍包含不应展示的 "${marker}"。`);
}

await requireFile("00_docs/MOBILE_APP_RELEASE_CHECKLIST_2026-06-13.md", "手机端发布清单已存在", {
  workspace: true
});

const checklistSource = await readProjectFile("00_docs/MOBILE_APP_RELEASE_CHECKLIST_2026-06-13.md", {
  workspace: true
});
const packageSource = await readProjectFile("package.json");
const appSource = await readProjectFile("src/App.jsx");
const stylesSource = await readProjectFile("src/styles.css");
const taskSource = await readProjectFile("src/features/tasks/TaskPages.jsx");
const assetsSource = await readProjectFile("src/features/assets/AssetsPage.jsx");
const settingsSource = await readProjectFile("src/features/settings/SettingsPage.jsx");
const serverSource = await readProjectFile("server.js");

if (checklistSource) {
  [
    "右滑侧栏",
    "视频生成等待标准",
    "资产页标准",
    "我的页标准",
    "PWA/App",
    "不显示本机路径",
    "一键生成女装轻奢室内空间 15 秒杂志感穿搭氛围视频"
  ].forEach((marker) => {
    requireContains(checklistSource, marker, `清单覆盖：${marker}`);
  });
}

if (packageSource) {
  [
    "\"mobile:release-checklist\"",
    "\"mobile:check\"",
    "\"mobile:density\"",
    "\"text-image:check\"",
    "\"pwa:check\"",
    "\"build\""
  ].forEach((marker) => {
    requireContains(packageSource, marker, `命令已接入：${marker.replaceAll("\"", "")}`);
  });
}

if (appSource) {
  [
    "mobile-sidebar-gesture-lock",
    "const mobileSidebarVisible = mobileSidebarOpen;",
    "className=\"sidebar-toggle\"",
    "mobile-submit-wait-summary",
    "mobile-create-wait-tip",
    "等待结果",
    "排队中"
  ].forEach((marker) => {
    requireContains(appSource, marker, `App 主流程保留：${marker}`);
  });
  [
    "sidebarSwipeStartZone",
    "markMobileSidebarTouchHandled",
    "shouldAlwaysIgnoreSwipeTarget",
    "surface.addEventListener(\"touchstart\"",
    "surface.addEventListener(\"touchmove\"",
    "mobile-sidebar-edge-guard",
    "mobile-sidebar-dragging"
  ].forEach((marker) => {
    requireNotContains(appSource, marker, `App 取消右滑手势：${marker}`);
  });
}

if (taskSource) {
  [
    "mobileVideoWaitEstimate",
    "mobile-video-wait-card",
    "预计还需",
    "可以先离开页面",
    "MobileVideoOutputArchive",
    "成片输出",
    "已经生成的视频放这里下载",
    "mobileVideoOutputLabel",
    "copyVideoLinkToPhone",
    "rawVideoLink",
    "const saveUrl = rawVideoLink(file.url)",
    "复制链接",
    "复制的是原始 mp4 链接",
    "原文件名已隐藏，下载时会自动命名"
  ].forEach((marker) => {
    requireContains(taskSource, marker, `任务页等待体验保留：${marker}`);
  });
}

if (serverSource) {
  [
    "/api/video-save-proxy",
    "isAllowedRemoteVideoUrl",
    "MAX_REMOTE_VIDEO_BYTES"
  ].forEach((marker) => {
    requireContains(serverSource, marker, `视频保存服务保留：${marker}`);
  });
}

if (assetsSource) {
  [
    "MobileDownloadFeedback",
    "MobileDownloadSheet",
    "返回素材页",
    "继续下载",
    "downloadActionLabel",
    "mobile-empty-next-steps",
    "去创意页选模板",
    "生成后回到这里保存",
    "mobile-assets-segmented",
    "MobileVideoTaskBridge",
    "打开、下载、看进度",
    "成片在任务页处理。",
    "去任务页",
    "href=\"#/libtv\""
  ].forEach((marker) => {
    requireContains(assetsSource, marker, `资产页小白体验保留：${marker}`);
  });
  ["D:\\\\Organized", "ai_product.sqlite"].forEach((marker) => {
    requireNotContains(assetsSource, marker, `资产页不硬编码路径：${marker}`);
  });
}

if (settingsSource) {
  [
    "MobileSettingsActionHub",
    "MobileRecordEmptyCard",
    "今天先做什么",
    "开始创作",
    "素材结果",
    "任务进度"
  ].forEach((marker) => {
    requireContains(settingsSource, marker, `我的页小白体验保留：${marker}`);
  });
}

if (stylesSource) {
  [
    ".console-shell.mobile-sidebar-visible .mobile-inspiration-page",
    ".mobile-submit-wait-summary",
    ".mobile-video-wait-card",
    ".mobile-download-feedback",
    ".mobile-download-sheet-backdrop",
    ".mobile-empty-next-steps",
    ".mobile-assets-segmented",
    ".mobile-video-task-bridge-card",
    ".mobile-video-output-archive",
    ".mobile-video-output-card",
    ".primary-save-phone",
    ".assets-panel .desktop-output-subhead",
    ".mobile-record-empty",
    ".console-shell.guest-preview .topbar-left > div",
    "grid-template-columns: 42px minmax(0, 1fr);",
    ":root[data-theme=\"light\"] .mobile-bottom-nav",
    ":root[data-theme=\"light\"] .mobile-download-feedback"
  ].forEach((marker) => {
    requireContains(stylesSource, marker, `样式保留：${marker}`);
  });
}

console.log("Mobile app release checklist");
console.log(`Passes: ${passes.length}`);

if (failures.length > 0) {
  console.log(`Failures: ${failures.length}`);
  failures.forEach((message) => console.log(`- ${message}`));
  process.exit(1);
}

console.log("Failures: 0");
