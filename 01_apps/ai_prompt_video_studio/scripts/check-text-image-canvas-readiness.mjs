import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const rootDir = path.resolve(".");
const workspaceRoot = findWorkspaceRoot(rootDir);
const workspaceCandidates = [
  workspaceRoot,
  path.resolve(rootDir, "..", ".."),
  path.resolve(rootDir, "..", "..", "..")
].filter((candidate, index, list) => list.indexOf(candidate) === index);
const failures = [];
const passes = [];

function findWorkspaceRoot(startDir) {
  let current = path.resolve(startDir);
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "00_docs")) && existsSync(path.join(current, "01_apps"))) {
      return current;
    }
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return path.resolve(startDir, "..", "..");
}

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

async function readProjectFile(relativePath) {
  try {
    return await readFile(path.join(rootDir, relativePath), "utf8");
  } catch {
    fail(`Missing required file: ${relativePath}`);
    return "";
  }
}

async function readWorkspaceFile(relativePath) {
  for (const root of workspaceCandidates) {
    const filePath = path.join(root, relativePath);
    if (!existsSync(filePath)) continue;
    try {
      return await readFile(filePath, "utf8");
    } catch {
      // Try the next candidate before reporting a failure.
    }
  }
  fail(`Missing required file: ${relativePath}`);
  return "";
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

const appSource = await readProjectFile("src/App.jsx");
const textImageSource = await readProjectFile("src/features/textImage/TextImagePage.jsx");
const assetsSource = await readProjectFile("src/features/assets/AssetsPage.jsx");
const handoffSource = await readProjectFile("src/shared/textImageStudioHandoff.js");
const evidenceSource = await readProjectFile("src/shared/compliance/aiEvidencePack.js");
const serverSource = await readProjectFile("server.js");
const stylesSource = await readProjectFile("src/styles.css");
const canvasDoc = await readWorkspaceFile("00_docs/TEXT_IMAGE_CANVAS_PRODUCTIZATION_2026-06-11.md");
const moduleSplitDoc = await readWorkspaceFile("00_docs/APP_MODULE_SPLIT_PLAN_2026-06-09.md");

if (appSource) {
  requireIncludes(appSource, 'id: "textImage"', "Navigation exposes the text-image page");
  requirePattern(appSource, /mobileTabItems[\s\S]*activePages:\s*\[[^\]]*"textImage"/, "Mobile navigation includes text-image");
  requireIncludes(appSource, 'React.lazy(() => import("./features/textImage/TextImagePage.jsx"))', "Text-image page is lazy loaded");
  requireIncludes(appSource, "<LazyTextImagePage", "App shell renders the lazy text-image page");
  requireIncludes(appSource, "正在加载文生图画布", "Text-image lazy route has a loading state");
  requireIncludes(appSource, "consumeTextImageStudioHandoff", "Studio page consumes text-image node handoff");
  requireIncludes(appSource, 'await import("./shared/textImageStudioHandoff.js")', "Text-image node handoff consumer is lazy loaded");
  requireIncludes(appSource, 'sourceType: "text-image-canvas"', "Studio image list preserves text-image source metadata");
  requireIncludes(appSource, "/api/task-source-links", "App shell loads text-image source links for assets");
  requireIncludes(appSource, 'React.lazy(() => import("./features/assets/AssetsPage.jsx"))', "Asset page is lazy loaded");
}

if (assetsSource) {
  requireIncludes(assetsSource, "TaskSourceLinksPanel", "Asset page renders text-image source links");
  requireIncludes(assetsSource, "mobile-source-link-card", "Mobile asset page renders source-link cards");
  requireIncludes(assetsSource, "textImageCanvasNodeId", "Asset page displays text-image source node ids");
}

if (textImageSource) {
  requireIncludes(textImageSource, 'requestJson("/api/text-image-canvas?limit=500")', "Text-image page loads the current account canvas");
  requireIncludes(textImageSource, 'requestJson("/api/image-runs"', "Text-image page starts image generation runs");
  requireIncludes(textImageSource, "mergeCanvasNodes(eventData.result?.canvasNodes || [])", "Completed image runs append returned nodes");
  requireIncludes(textImageSource, "图片裂变", "Text-image page exposes image variation mode");
  requireIncludes(textImageSource, "image-variation-upload", "Image variation mode has a source image uploader");
  requireIncludes(textImageSource, "referenceImages: isVariation ? [referenceImage] : []", "Image variation run sends a reference image");
  requireIncludes(textImageSource, "buildVariationPrompt", "Image variation converts beginner choices into model instructions");
  requireIncludes(textImageSource, "setCanvasNodes((current) => current.filter", "Canvas node removal updates local state");
  requireIncludes(textImageSource, 'method: "DELETE"', "Canvas node removal calls the delete endpoint");
  requireIncludes(textImageSource, "canvasQuery", "Canvas supports account-level node search state");
  requireIncludes(textImageSource, "filteredCanvasNodes", "Canvas search filters the visible node list");
  requireIncludes(textImageSource, "搜索提示词、模型、尺寸或文件名", "Canvas search copy is beginner-friendly");
  requireIncludes(textImageSource, "textImageCanvasWidth", "Canvas has a base width");
  requireIncludes(textImageSource, "const canvasWidth = Math.max(", "Canvas width expands with nodes");
  requireIncludes(textImageSource, "const canvasHeight = Math.max(", "Canvas height expands with nodes");
  requireIncludes(textImageSource, "onPointerDown", "Canvas nodes support pointer drag");
  requireIncludes(textImageSource, "onCommitMove", "Canvas node drag commits position");
  requireIncludes(textImageSource, "TextImageNodeDetail", "Canvas has a node detail panel");
  requireIncludes(textImageSource, "saveTextImageStudioHandoff", "Canvas can send a node into the single-video flow");
  requireIncludes(textImageSource, "送入单条视频", "Node detail exposes a beginner-friendly video handoff action");
  requireIncludes(textImageSource, "同一画布", "UI copy communicates one shared canvas");
  requirePattern(
    textImageSource,
    /function\s+TextImageCanvas\([^)]*nodes[^)]*\)[\s\S]*canvasWidth[\s\S]*canvasHeight[\s\S]*nodes\.map/s,
    "Canvas sizing is derived from the node list"
  );
}

if (handoffSource) {
  requireIncludes(handoffSource, "textImageStudioHandoffKey", "Shared handoff key is centralized");
  requireIncludes(handoffSource, "buildTextImageStudioHandoff", "Shared handoff captures node metadata");
  requireIncludes(handoffSource, "saveTextImageStudioHandoff", "Shared handoff stores selected node");
  requireIncludes(handoffSource, "consumeTextImageStudioHandoff", "Shared handoff is one-time consumable");
}

if (evidenceSource) {
  requireIncludes(evidenceSource, "textImageCanvasNodeId", "AI evidence pack records text-image canvas node id");
  requireIncludes(evidenceSource, "textImagePromptPreview", "AI evidence pack records text-image prompt preview");
  requireIncludes(evidenceSource, "textImageLinkedAt", "AI evidence pack records when the image entered video flow");
}

if (serverSource) {
  requireIncludes(serverSource, "CREATE TABLE IF NOT EXISTS text_image_canvas_nodes", "Backend creates the text-image canvas table");
  requireIncludes(serverSource, "owner_user_id TEXT NOT NULL", "Canvas nodes are owned by user");
  requireIncludes(serverSource, "ownerUserIdFromSession(session)", "Requests derive owner from the login session");
  requireIncludes(serverSource, 'createRun("text-image", { ...payload, ownerUserId }', "Image runs are created with the current owner");
  requireIncludes(serverSource, "appendTextImageCanvasNodes(files, normalized, run.id,", "Completed image runs append canvas nodes");
  requireIncludes(serverSource, 'mode === "image-variation"', "Backend supports image variation mode");
  requireIncludes(serverSource, "saveVariationReferenceImages", "Backend saves image variation source images");
  requireIncludes(serverSource, "requestBody.image", "Backend sends reference images to the image model");
  requireIncludes(serverSource, "source-image", "Backend writes source image nodes to the shared canvas");
  requireIncludes(serverSource, "image-variation", "Backend writes variation nodes to the shared canvas");
  requireIncludes(serverSource, "SELECT COUNT(*) AS total FROM text_image_canvas_nodes WHERE owner_user_id = ?", "New node placement is scoped to owner");
  requireIncludes(serverSource, 'url.pathname === "/api/text-image-canvas"', "Backend exposes canvas read endpoint");
  requireIncludes(serverSource, "canvasId: `text-image:${ownerUserId}`", "Canvas API identifies the current account canvas");
  requireIncludes(serverSource, 'WHERE id = ? AND owner_user_id = ?', "Canvas node writes are owner-scoped");
  requireIncludes(serverSource, "deleteTextImageCanvasNode", "Backend supports safe canvas node removal");
  requireIncludes(serverSource, "outputs\", \"text-to-image", "Generated images are stored as text-image outputs");
  requireIncludes(serverSource, "IMAGE_GENERATION_MIN_PIXELS", "Backend protects image generation against undersized requests");
  requireIncludes(serverSource, "CREATE TABLE IF NOT EXISTS video_task_source_links", "Backend creates video task source link table");
  requireIncludes(serverSource, "ensureVideoTaskSourceLinkSchema", "Backend initializes task source link schema");
  requireIncludes(serverSource, "recordVideoTaskSourceLinks", "Backend persists text-image source links for video tasks");
  requireIncludes(serverSource, "listVideoTaskSourceLinks", "Backend can list text-image source links");
  requireIncludes(serverSource, 'url.pathname === "/api/task-source-links"', "Backend exposes source-link lookup endpoint");
  requireIncludes(serverSource, "buildVideoImageSourceSummaries", "Backend builds reusable image source summaries");
  requireIncludes(serverSource, "imageSources", "Saved prompt packages include image source summaries");
  requireIncludes(serverSource, "textImageCanvasNodeIds", "Saved prompt packages include text-image canvas node ids");
  requireIncludes(serverSource, "textImageSourceLinks", "Account export includes text-image source links");
  requireIncludes(serverSource, "normalizeTextImageSourceMetadata", "Backend keeps text-image source metadata through normalization");
}

if (stylesSource) {
  for (const marker of [
    ".text-image-page",
    ".text-image-mode-tabs",
    ".image-variation-upload",
    ".image-variation-presets",
    ".text-image-canvas-viewport",
    ".text-image-canvas-node",
    ".text-image-canvas-node.variation",
    ".text-image-canvas-node.selected",
    ".text-image-canvas-filter",
    ".text-image-node-tools",
    ".text-image-node-detail"
  ]) {
    requireIncludes(stylesSource, marker, `Text-image canvas style exists: ${marker}`);
  }
  requirePattern(
    stylesSource,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.text-image-page\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
    "Text-image page collapses to one column on mobile"
  );
  requirePattern(
    stylesSource,
    /@media\s*\(max-width:\s*900px\)[\s\S]*?\.text-image-canvas-viewport\s*\{[\s\S]*?height:\s*440px/s,
    "Text-image canvas keeps a usable mobile viewport height"
  );
}

if (canvasDoc) {
  requireIncludes(canvasDoc, "一个账号一张固定画布", "Canvas product doc states the one-account-one-canvas rule");
  requireIncludes(canvasDoc, "每次生成成功后追加图片节点", "Canvas product doc states append-only generation flow");
  requireIncludes(canvasDoc, "自动扩展尺寸", "Canvas product doc records dynamic canvas growth");
  requireIncludes(canvasDoc, "AI 证据包", "Canvas product doc keeps compliance evidence in scope");
}

if (moduleSplitDoc) {
  requireIncludes(moduleSplitDoc, "src/features/textImage/TextImagePage.jsx", "Module split doc records the text-image feature module");
  requireIncludes(moduleSplitDoc, "React.lazy", "Module split doc records lazy loading");
}

console.log("Text-image canvas readiness check");
console.log(`Passes: ${passes.length}`);
console.log(`Failures: ${failures.length}`);

if (failures.length) {
  console.error("\nFailures");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}
