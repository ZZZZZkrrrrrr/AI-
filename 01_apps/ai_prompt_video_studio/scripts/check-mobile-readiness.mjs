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

function requireNotIncludes(source, marker, label) {
  if (!source.includes(marker)) {
    pass(label);
    return;
  }
  fail(`${label}: unexpected marker "${marker}"`);
}

function requirePattern(source, pattern, label) {
  if (pattern.test(source)) {
    pass(label);
    return;
  }
  fail(`${label}: pattern not found`);
}

function requireNotPattern(source, pattern, label) {
  if (!pattern.test(source)) {
    pass(label);
    return;
  }
  fail(`${label}: unexpected pattern`);
}

function warnUnlessPattern(source, pattern, label) {
  if (pattern.test(source)) return;
  warn(label);
}

const appSource = await readProjectFile("src/App.jsx");
const stylesSource = await readProjectFile("src/styles.css");
const settingsSource = await readProjectFile("src/features/settings/SettingsPage.jsx");
const stitchSource = await readProjectFile("src/features/stitch/VideoStitchPage.jsx");
const assetsSource = await readProjectFile("src/features/assets/AssetsPage.jsx");
const inspirationSource = await readProjectFile("src/features/inspiration/MobileInspirationPage.jsx");
const tasksSource = await readProjectFile("src/features/tasks/TaskPages.jsx");
const batchSource = await readProjectFile("src/features/batch/BatchPage.jsx");
const workflowSource = await readProjectFile("src/features/workflow/WorkflowModulePage.jsx");
const serverSource = await readProjectFile("server.js");
const manifestSource = await readProjectFile("public/manifest.webmanifest");
const installSource = await readProjectFile("public/install.html");
const offlineSource = await readProjectFile("public/offline.html");
const supportSource = await readProjectFile("public/support.html");
const swSource = await readProjectFile("public/sw.js");
const fashionPromptPackSource = await readProjectFile("src/templates/fashionPromptPackV3.js");

if (appSource) {
  requireIncludes(appSource, "const mobileTabItems", "Mobile bottom navigation model exists");
  for (const route of ['id: "overview"', 'id: "studio"', 'id: "assets"', 'id: "settings"']) {
    requireIncludes(appSource, route, `Mobile navigation includes ${route}`);
  }
  requireIncludes(appSource, 'className="mobile-bottom-nav"', "Mobile bottom navigation is rendered");
  requireIncludes(appSource, "beforeinstallprompt", "Android PWA install prompt is handled");
  requireIncludes(appSource, "appinstalled", "PWA installed event is handled");
  requireIncludes(appSource, "isIosInstallCandidate", "iOS manual install guide is handled");
  requireIncludes(appSource, "openPwaInstallGuide", "PWA install banner can open the full install guide.");
  requireIncludes(appSource, "pwa-install-hints", "PWA install banner shows short beginner steps.");
  requireIncludes(appSource, "查看步骤", "PWA install banner has a fallback guide action.");
  requireIncludes(appSource, "React.lazy(() => import(\"./features/settings/SettingsPage.jsx\"))", "Settings page is lazy loaded");
  requireIncludes(appSource, "React.lazy(() => import(\"./features/stitch/VideoStitchPage.jsx\"))", "Video stitch page is lazy loaded");
  requireIncludes(appSource, "React.lazy(() => import(\"./features/assets/AssetsPage.jsx\"))", "Assets page is lazy loaded");
  requireIncludes(appSource, "React.lazy(() => import(\"./features/batch/BatchPage.jsx\"))", "Batch page is lazy loaded");
  requireIncludes(appSource, "React.lazy(() => import(\"./features/inspiration/MobileInspirationPage.jsx\"))", "Mobile inspiration page is lazy loaded");
  requireIncludes(appSource, "LazyMobileInspirationPage", "Mobile inspiration page is split out of the main entry.");
  requireIncludes(appSource, "./features/tasks/TaskPages.jsx", "Task center pages are lazy loaded.");
  requireIncludes(appSource, "LazyTasksPage", "Task board page is split out of the main entry.");
  requireIncludes(appSource, "LazyLibtvPage", "Video task page is split out of the main entry.");
  requireIncludes(appSource, "runtimeStatusCopy", "Runtime status has beginner-friendly mobile copy.");
  requireIncludes(appSource, "mobile-runtime-label", "Runtime status renders a dedicated mobile label.");
  requireIncludes(appSource, "serviceCheck", "Mobile home has a beginner service check card.");
  requireIncludes(appSource, "mobile-service-check-card", "Mobile home renders the service check card.");
  requireIncludes(appSource, "生成前检查", "Mobile home service check uses a beginner-friendly heading.");
  requireIncludes(appSource, "生成服务和视频通道都可用", "Mobile home service check explains ready state.");
  requireIncludes(appSource, "生成服务可用，视频通道待检查", "Mobile home service check explains partial-ready state.");
  requireIncludes(appSource, "生成服务暂时未连接", "Mobile home service check explains disconnected state.");
  requireIncludes(appSource, "服务正常", "Mobile runtime status tells users when generation is available.");
  requireIncludes(appSource, "视频待连", "Mobile runtime status uses a beginner-friendly video connection message.");
  requireIncludes(appSource, "点按刷新状态", "Mobile runtime status explains that tapping refreshes the state.");
  requireIncludes(appSource, 'desktopLabel: "生成服务未连接"', "Runtime desktop status avoids backend jargon.");
  requireIncludes(appSource, 'desktopLabel: "生成服务检测中"', "Runtime checking status avoids backend/vendor jargon.");
  requireIncludes(appSource, 'desktopLabel: "生成服务已连接"', "Runtime ready status avoids backend/vendor jargon.");
  requireIncludes(appSource, 'desktopLabel: "视频通道待连接"', "Runtime warning status avoids vendor jargon.");
  requireIncludes(appSource, 'upsertPromptStep("提交任务"', "Prompt submit step avoids backend jargon.");
  requireIncludes(appSource, "正在把提示词包和素材图片发送到生成服务。", "Prompt submit copy avoids backend jargon.");
  requireIncludes(appSource, "提示词任务创建失败，请检查网络或生成服务。", "Prompt creation error avoids backend jargon.");
  requireIncludes(appSource, 'label: "生成服务"', "Overview desktop status avoids API jargon.");
  requireIncludes(appSource, 'label: "视频通道"', "Overview desktop status avoids vendor bridge jargon.");
  requireIncludes(appSource, 'label: "账号数据"', "Overview desktop status avoids database jargon.");
  requireIncludes(appSource, 'runtime?.libtvDatabase ? "已保存" : "待检查"', "Overview desktop storage status hides database engine details.");
  requireIncludes(appSource, '|| "系统默认"', "Model trace default labels avoid backend jargon.");
  requireIncludes(appSource, 'title: "商品资料库"', "Product library entry avoids database wording.");
  requireIncludes(appSource, "同步到商品资料", "Product scoring copy avoids database writeback wording.");
  requireIncludes(appSource, "保存数据记录", "Data recovery flow avoids central database wording.");
  requireIncludes(appSource, "已用示例资料显示值修复。", "Account data quality copy avoids seed-data jargon.");
  requireIncludes(appSource, 'code: "VIDEO_TASKS"', "Overview video task module avoids vendor code labels.");
  requireIncludes(appSource, 'code: "ASSETS"', "Overview assets module avoids technical output code labels.");
  requireIncludes(appSource, "按任务查看上传图片、生成文件、本地输出和下载入口。", "Overview assets copy avoids local path wording.");
  requireNotIncludes(appSource, 'desktopLabel: "后端未连接"', "Runtime desktop status should not say backend.");
  requireNotIncludes(appSource, 'desktopLabel: "后端 / libTV', "Runtime desktop status should not expose vendor/backend.");
  requireNotIncludes(appSource, 'label: "后端 API"', "Overview status should not expose API jargon.");
  requireNotIncludes(appSource, 'label: "libTV 桥接"', "Overview status should not expose bridge/vendor jargon.");
  requireNotIncludes(appSource, 'runtime?.libtvDatabase ? "SQLite" : "未返回"', "Overview status should not expose database engine.");
  requireNotIncludes(appSource, 'title: "商品数据库"', "App navigation should not expose database wording.");
  requireNotIncludes(appSource, "写入中央数据库", "Data recovery flow should not expose database wording.");
  requireNotIncludes(appSource, "素材路径", "Overview assets copy should not expose local path wording.");
  requireNotIncludes(appSource, "本地种子", "App-facing account copy should not expose seed-data jargon.");
  requireIncludes(appSource, "mobile-create-radial-head", "Mobile create popover has a beginner-friendly header.");
  requireIncludes(appSource, "你想做什么？", "Mobile create popover asks a clear beginner question.");
  requireIncludes(appSource, "featured: true", "Mobile create popover highlights the recommended first action.");
  requireIncludes(appSource, "aria-label={`${item.label}，${item.detail}`}", "Mobile create popover actions have descriptive labels.");
  requireIncludes(appSource, "mobile-create-tabs", "Mobile create step tabs are rendered");
  requireIncludes(appSource, "mobile-input-tabs", "Mobile input sub-tabs are rendered");
  requireIncludes(appSource, "final-prompt-actions", "Mobile final prompt action row has dedicated typography controls.");
  requireIncludes(appSource, "mobileCreateIntentKey", "Mobile create intent storage key exists.");
  requireIncludes(appSource, "setMobileCreateIntent", "Mobile create intent setter exists.");
  requireIncludes(appSource, "consumeMobileCreateIntent", "Mobile create intent consumer exists.");
  requireIncludes(appSource, 'startsWith("studio:")', "Navigation supports studio intent routes.");
  requireIncludes(appSource, "mobileCreateViewForIntent", "Studio page maps beginner intent to create view.");
  requireIncludes(appSource, "mobileInputStepForIntent", "Studio page maps beginner intent to input step.");
  requireIncludes(appSource, "mobileEntryIntent", "Studio page consumes mobile entry intent.");
  requireIncludes(appSource, "prompt-package-summary", "Mobile studio replaces raw prompt package JSON with a beginner-friendly summary.");
  requireIncludes(appSource, "prompt-package-debug", "Prompt package debug JSON is isolated behind a desktop-only class.");
  requireIncludes(appSource, "buildVideoLogSummary", "Mobile studio summarizes video logs for beginner users.");
requireIncludes(appSource, "video-log-summary", "Mobile studio shows a friendly video log status card.");
requireIncludes(appSource, "video-log-debug", "Raw video logs are isolated behind a desktop-only class.");
requireIncludes(appSource, "buildMobileVideoRecovery", "Mobile video result area builds beginner recovery guidance.");
requireIncludes(appSource, "MobileVideoRecoveryCard", "Mobile video result area renders a recovery card.");
requireIncludes(appSource, "mobile-video-recovery-card", "Mobile video recovery card is present.");
requireIncludes(appSource, "视频生成补救建议", "Mobile video recovery card has an accessible label.");
requireIncludes(appSource, "失败后处理", "Mobile video recovery explains what to do after failure.");
requireIncludes(appSource, "重试生成", "Mobile video recovery offers a retry action.");
requireIncludes(appSource, "检查提示词", "Mobile video recovery offers a prompt-check action.");
requireIncludes(appSource, "换/补图片", "Mobile video recovery offers an image-fix action.");
requireIncludes(appSource, "VideoWaitStatus", "Video generation has a dedicated wait status card.");
  requireIncludes(appSource, "video-wait-stats", "Video wait card shows readable remaining, elapsed, and duration stats.");
  requireIncludes(appSource, "video-wait-current-note", "Video wait card shows a plain-language current status note.");
  requireIncludes(appSource, "headlineLabel", "Video wait card uses a clear headline label instead of raw timing text.");
  requireIncludes(appSource, "currentNote", "Video wait estimate includes a beginner-friendly current note.");
  requireIncludes(appSource, "仍在排队", "Video wait overdue state tells users the task is still queued.");
  requireIncludes(appSource, "任务没有完成，请查看下方失败原因或到任务中心处理。", "Video wait failure copy avoids vendor jargon.");
  requireIncludes(appSource, "视频生成方式", "Mobile studio hides vendor wording behind a plain video mode label.");
  requireIncludes(appSource, "最终提示词生成后自动提交视频", "Mobile studio auto-submit copy uses plain video wording.");
  requireIncludes(appSource, "保存并生成视频", "Mobile studio final action avoids database/vendor jargon.");
  requireIncludes(appSource, "视频生成进度", "Mobile studio progress heading avoids vendor jargon.");
  requireIncludes(appSource, "等待提交视频", "Mobile studio empty video progress avoids vendor jargon.");
  requireIncludes(appSource, "生成视频需要产品参考图", "Mobile studio upload warning explains the requirement plainly.");
  requireIncludes(appSource, "buildMobileImageChecklist", "Mobile image upload step has a beginner checklist.");
  requireIncludes(appSource, "mobile-image-checklist", "Mobile image upload step renders a checklist.");
  requireIncludes(appSource, "图片准备清单", "Mobile image upload checklist has an accessible label.");
  requireIncludes(appSource, "buildMobilePromptChecklist", "Mobile prompt package step has a beginner checklist.");
  requireIncludes(appSource, "mobile-prompt-checklist", "Mobile prompt package step renders a checklist.");
  requireIncludes(appSource, "提示词包准备清单", "Mobile prompt package checklist has an accessible label.");
  requireIncludes(appSource, "上传文件", "Mobile prompt checklist explains file upload.");
requireIncludes(appSource, "粘贴文本", "Mobile prompt checklist explains paste-text option.");
requireIncludes(appSource, "二选一", "Mobile prompt checklist tells users file or text is enough.");
requireIncludes(appSource, "套用模板时会自动填好。", "Mobile prompt checklist explains built-in templates.");
requireIncludes(appSource, "buildMobileProductChecklist", "Mobile product info step has a beginner checklist.");
requireIncludes(appSource, "mobile-product-checklist", "Mobile product info step renders a checklist.");
requireIncludes(appSource, "商品信息准备清单", "Mobile product info checklist has an accessible label.");
requireIncludes(appSource, "卖点/人群", "Mobile product checklist asks for selling points and audience.");
requireIncludes(appSource, "buildMobileSubmitChecklist", "Mobile submit step has a beginner confirmation checklist.");
requireIncludes(appSource, "mobile-submit-check-card", "Mobile final prompt area renders a submit confirmation card.");
requireIncludes(appSource, "提交视频前确认", "Mobile submit confirmation has an accessible label.");
requireIncludes(appSource, "可以点击保存并生成视频", "Mobile submit confirmation explains the final action plainly.");
requireIncludes(appSource, "mobile-submit-wait-summary", "Mobile submit confirmation shows the current video wait state.");
requireIncludes(appSource, "提交后等待提示", "Mobile submit wait summary has an accessible label.");
requireIncludes(appSource, "预计还需", "Mobile submit wait summary shows remaining time.");
requireIncludes(appSource, "可以切到任务页或稍后回来。", "Mobile submit wait summary reassures users they can leave.");
requireIncludes(appSource, 'href="#/libtv"', "Mobile submit wait summary links to video task status.");
requireIncludes(appSource, "video-submit-button", "Final prompt video button has a visible waiting state.");
requireIncludes(appSource, "等待结果", "Video submit buttons use a clear waiting label while running.");
requireIncludes(appSource, "已提交生成，不用重复点击", "Mobile create guide prevents duplicate video submissions.");
requireIncludes(appSource, "mobile-create-wait-tip", "Mobile create guide renders a duplicate-submit prevention tip.");
requireIncludes(appSource, "aria-busy={videoRunning}", "Video submit buttons expose busy state to assistive tech.");
requireIncludes(appSource, "人物参考图", "Fashion image checklist asks for a person reference.");
  requireIncludes(appSource, "女装商品图", "Fashion image checklist asks for clothing product images.");
  requireIncludes(appSource, "封面/画报图", "Fashion image checklist marks cover/editorial references.");
  requireIncludes(appSource, "已准备", "Mobile image checklist shows done states.");
  requireIncludes(appSource, "待上传", "Mobile image checklist shows missing required images.");
  requireIncludes(appSource, "视频平台合规校验未通过", "Video error messages avoid raw vendor jargon.");
  requireIncludes(appSource, 'label: "视频任务"', "Mobile task center navigation avoids vendor jargon.");
  requireIncludes(appSource, "查看视频任务", "Overview/productized actions avoid vendor jargon.");
  requireIncludes(appSource, "taskDisplayName", "Task lists hide raw task codes behind readable names.");
  requireIncludes(appSource, "taskDisplayLabel", "Task lists show simple item labels instead of internal task numbers.");
  requireIncludes(appSource, "视频提交失败", "Video submit failure messages avoid vendor jargon.");
  requireIncludes(appSource, "视频任务完成", "Video completion notification avoids vendor jargon.");
  requireIncludes(appSource, "视频成功率", "Overview metrics avoid vendor jargon.");
  requireIncludes(appSource, "保存任务并生成视频", "Overview workflow avoids database/vendor jargon.");
  requireIncludes(appSource, "视频生成方式不合法", "Batch validation avoids vendor jargon.");
  requireIncludes(appSource, "estimate.overdue", "Video wait card exposes overdue state instead of looking frozen.");
  requireIncludes(appSource, "buildVideoWaitPhases", "Video wait card maps backend progress into beginner-friendly phases.");
  requireIncludes(appSource, "video-wait-phases", "Video wait card renders a clear phase tracker.");
  requireIncludes(appSource, "提交任务", "Video wait phases explain the submit stage.");
  requireIncludes(appSource, "等待排队", "Video wait phases explain the queue stage.");
  requireIncludes(appSource, "返回结果", "Video wait phases explain the result stage.");
  requirePattern(appSource, /!videoEstimate\.visible\s*\?\s*\([\s\S]*?<ProgressBar[\s\S]*?\)\s*:\s*null/, "Video progress bar is only used as a fallback when the wait card is hidden.");
  requireIncludes(appSource, "sidebar-toggle", "Mobile drawer keeps the top-left menu button tappable.");
  requireIncludes(appSource, "setMobileSidebarDrag((current) => (", "Mobile drawer clears any stale drag state.");
  requireIncludes(appSource, "const mobileSidebarVisible = mobileSidebarOpen;", "Mobile drawer is only visible after tapping the menu button.");
  requireIncludes(appSource, 'const shellStyle = {', "Mobile drawer keeps a stable fixed position without drag offsets.");
  requireNotIncludes(appSource, "sidebarSwipeStartZone", "Mobile drawer no longer has a right-swipe start zone.");
  requireNotIncludes(appSource, "markMobileSidebarTouchHandled", "Mobile drawer no longer registers layered touch handlers.");
  requireNotIncludes(appSource, "shouldAlwaysIgnoreSwipeTarget", "Mobile drawer no longer needs swipe target filtering.");
  requireNotIncludes(appSource, 'surface.addEventListener("touchstart"', "Mobile drawer no longer opens from touchstart gestures.");
  requireNotIncludes(appSource, 'surface.addEventListener("touchmove"', "Mobile drawer no longer tracks touchmove dragging.");
  requireNotIncludes(appSource, "mobile-sidebar-edge-guard", "Mobile shell no longer renders an edge swipe trigger.");
  requireNotIncludes(appSource, "mobile-sidebar-dragging", "Mobile drawer no longer enters a half-open dragging state.");
  requireIncludes(appSource, "mobile-sidebar-gesture-lock", "Mobile drawer still locks horizontal bounce while open.");
  requireIncludes(appSource, "mobileReturnPageRef", "Mobile app keeps an app-level return target instead of relying on browser history.");
  requireIncludes(appSource, "resolveMobileReturnTarget", "Mobile app resolves feature pages back to their entry page.");
  requireIncludes(appSource, "writeRouteHash(nextPage, { replace: mobile", "Mobile navigation replaces hash entries to avoid browser-history swipe back.");
  requireIncludes(appSource, "showMobileReturnButton", "Mobile app renders a visible return button when a page has an entry target.");
  requireIncludes(appSource, "handleMobileReturnClick", "Mobile app returns by tapping a button instead of swiping.");
  requireIncludes(appSource, "mobile-return-button", "Mobile return button has a dedicated visual state.");
  requireNotIncludes(appSource, "mobileReturnSwipeRef", "Mobile app must not keep right-swipe return state.");
  requireNotIncludes(appSource, "shouldIgnoreMobileReturnSwipeTarget", "Mobile app must not register swipe-return target filtering.");
  requireNotIncludes(appSource, "touch.clientX > 36", "Mobile app must not use a right-swipe return start zone.");
  requireNotIncludes(appSource, "document.addEventListener(\"touchstart\"", "Mobile app must not register document-level touchstart return handlers.");
  requireNotIncludes(appSource, "history.back()", "Mobile return must not call browser history back.");
  if (inspirationSource) {
    requirePattern(inspirationSource, /className="mobile-inspiration-tabs"[\s\S]*?data-horizontal-scroll="true"/, "Mobile inspiration tabs are marked as horizontal scrollers.");
    requireIncludes(inspirationSource, "mobile-template-steps", "Mobile inspiration template cards show a simple three-step flow.");
    requireIncludes(inspirationSource, "mobile-template-chips", "Mobile inspiration template cards show upload type chips.");
    requireIncludes(inspirationSource, "人物参考图", "Fashion template card tells users to upload a person reference image.");
    requireIncludes(inspirationSource, "封面/画报图", "Fashion template card accepts cover or editorial reference images.");
    requireIncludes(inspirationSource, "mobile-template-cover-badge", "Mobile inspiration template cards label cover references clearly.");
    requireIncludes(inspirationSource, "先准备这些图片", "Mobile inspiration template cards turn upload requirements into an action hint.");
    requireNotIncludes(inspirationSource, "featured: true", "Mobile inspiration templates use one consistent card layout.");
    requireNotIncludes(inspirationSource, 'item.featured ? "featured" : ""', "Mobile inspiration does not switch the fashion template into a special large card.");
  }
  requireIncludes(appSource, "templateId: template.id", "Built-in template metadata keeps the selected template id.");
  requireIncludes(appSource, "activeBuiltInTemplate", "Studio page detects the active built-in template.");
  requireIncludes(appSource, 'promptPackTextLoader: () => import("./templates/fashionPromptPackV3.js")', "Fashion built-in prompt pack is loaded on demand.");
  requireIncludes(appSource, "resolveTemplatePromptPackText", "Built-in templates can resolve lazy prompt pack content.");
  requireNotIncludes(appSource, "# 内置提示词包：女装轻奢室内空间 15 秒", "Fashion built-in prompt pack should not keep the old V1 prompt package.");
  if (fashionPromptPackSource) {
    requireIncludes(fashionPromptPackSource, "女装服装带货\\n15 秒生活使用状态视频提示词规范包 V3.0", "Fashion V3.0 prompt pack module contains the provided document content.");
    requireIncludes(fashionPromptPackSource, "商品 DNA 锁", "Fashion V3.0 prompt pack keeps the product-DNA guidance.");
    requireNotIncludes(fashionPromptPackSource, "# 内置提示词包：女装轻奢室内空间 15 秒", "Fashion V3.0 prompt pack module does not keep the old V1 prompt package.");
  }
  requireIncludes(appSource, "mobile-template-applied", "Mobile studio shows a clear template-applied status card.");
  requireIncludes(appSource, "mobileTemplateNextSteps", "Mobile studio shows template next-step progress.");
  requireIncludes(appSource, "mobile-template-next-steps", "Mobile template applied card renders next-step cells.");
  requireIncludes(appSource, "templateNextAction", "Mobile template applied card computes a clear current action.");
  requireIncludes(appSource, "mobile-template-next-action", "Mobile template applied card shows a prominent current action.");
  requireIncludes(appSource, "当前要做", "Mobile template applied card tells beginners what to do now.");
  requireIncludes(appSource, "建议先上传人物参考图和女装商品图", "Fashion template next action explains required images plainly.");
  requireIncludes(appSource, "正在等待视频结果", "Template next action covers video generation waiting state.");
  requireIncludes(appSource, "模板已套用", "Mobile studio tells users when a template has been applied.");
  requireNotIncludes(appSource, "openTemplateNextStep", "Mobile template applied card no longer renders a dead next-step action.");
  requireNotIncludes(appSource, "templateNextAction.button", "Mobile template applied card should not expose unused CTA text.");
  requireNotIncludes(appSource, "去上传图片", "Mobile template applied card removes the dead upload-image CTA.");
  requireIncludes(appSource, "useDesktopCollapsedSidebar", "Mobile sidebar ignores desktop collapsed state while the drawer is visible.");
  requireIncludes(appSource, "mobileSidebarVisible ? \"mobile-sidebar-visible\" : \"\"", "Mobile drawer has an explicit visible shell class.");
  requirePattern(appSource, /function\s+toggleShellSidebar\(\)[\s\S]*?setSidebarCollapsed\(false\);[\s\S]*?setMobileSidebarOpen\(\(current\)\s*=>\s*!current\)/, "Mobile menu button clears desktop collapsed state before opening the drawer.");
  requireIncludes(appSource, "mobile-beginner-launcher", "Mobile beginner launcher is rendered");
  requireIncludes(appSource, "mobileStatusCards", "Mobile overview uses beginner-friendly status cards.");
  requireIncludes(appSource, "生成服务", "Mobile overview status avoids backend jargon.");
  requireIncludes(appSource, "视频通道", "Mobile overview status avoids libTV jargon.");
  requireIncludes(appSource, "账号数据", "Mobile overview status explains account data plainly.");
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
  requireIncludes(appSource, "<span>视频</span>", "Mobile task cards use a plain video label.");
  requireNotIncludes(appSource, "未返回外部 ID", "Mobile task cards no longer show raw external task ID fallback.");
  requireNotIncludes(appSource, "<th>外部任务 ID</th>", "Video task desktop table should not show external task IDs.");
  requireNotIncludes(appSource, '<td>{row["外部任务ID"] || "-"}</td>', "Video task desktop rows should not render external task IDs.");
  requireNotIncludes(appSource, '<span>{taskCode} / {row["类别"] || "未分类"}</span>', "Mobile task cards should not show internal task codes in subtitles.");
  requireNotIncludes(appSource, 'row["最终视频名称"] || row["任务编号"] || "任务"', "Mobile recent task rows should not fall back to internal task codes.");
}

if (tasksSource) {
  requireIncludes(tasksSource, "视频生成任务", "Video task page title avoids vendor jargon.");
  requireIncludes(tasksSource, "TasksPage", "Task board page is split into a feature module.");
  requireIncludes(tasksSource, "LibtvPage", "Video task page is split into a feature module.");
  requireIncludes(tasksSource, "mobile-task-card-list", "Mobile task cards are rendered");
  requireIncludes(tasksSource, "mobileVideoTaskHint", "Mobile video task cards use beginner-friendly state hints.");
  requireIncludes(tasksSource, "任务记录 / {taskHint}", "Mobile video task cards hide external task IDs.");
  requireIncludes(tasksSource, "暂无视频生成任务", "Mobile video task empty state avoids libTV jargon.");
  requireIncludes(tasksSource, "taskMetaLabel", "Mobile task cards show category and time instead of raw task codes.");
  requireIncludes(tasksSource, "taskResultLabel", "Video task result column uses beginner-friendly result labels.");
  requireIncludes(tasksSource, "mobileTaskRecoveryHint", "Mobile video task cards build beginner recovery hints.");
  requireIncludes(tasksSource, "mobile-task-recovery-card", "Mobile video task cards render failure recovery guidance.");
  requireIncludes(tasksSource, "失败任务处理建议", "Mobile video task recovery has an accessible label.");
  requireIncludes(tasksSource, "查看素材", "Mobile failed video tasks can jump to related assets.");
  requireIncludes(tasksSource, "回创作页", "Mobile failed video tasks guide users back to creation.");
  requireIncludes(tasksSource, "mobileVideoTaskNextStep", "Mobile video task cards build next-step guidance.");
  requireIncludes(tasksSource, "mobile-task-next-step", "Mobile video task cards render next-step guidance.");
  requireIncludes(tasksSource, "视频任务下一步", "Mobile video task next-step card has an accessible label.");
  requireIncludes(tasksSource, "视频已经生成", "Mobile video task next-step explains completed jobs.");
  requireIncludes(tasksSource, "等它跑完，不用重复提交", "Mobile video task next-step discourages duplicate submissions.");
  requireIncludes(tasksSource, "离开页面也不会丢任务", "Mobile video task next-step reassures users during generation.");
  requireIncludes(tasksSource, "mobileVideoWaitEstimate", "Mobile running video tasks estimate wait progress.");
  requireIncludes(tasksSource, "mobile-video-wait-card", "Mobile running video tasks render a wait progress card.");
  requireIncludes(tasksSource, "视频生成等待进度", "Mobile running video wait card has an accessible label.");
  requireIncludes(tasksSource, "预计还需", "Mobile running video wait card shows remaining time.");
  requireIncludes(tasksSource, "可以先离开页面，任务完成后会回到这里。", "Mobile running video wait card reassures users they can leave.");
  requireIncludes(tasksSource, "MobileVideoOutputArchive", "Mobile video task page owns the completed video output archive.");
  requireIncludes(tasksSource, "成片输出", "Mobile video task page labels completed outputs as finished videos.");
  requireIncludes(tasksSource, "已经生成的视频放这里下载", "Mobile video task page explains where completed videos are downloaded.");
  requireIncludes(tasksSource, "safeOutputDisplayName(file.name || file.url", "Mobile video task page sanitizes output file names before display.");
  requireIncludes(tasksSource, "mobileVideoOutputLabel", "Mobile video task output cards use friendly numbered video names.");
  requireIncludes(tasksSource, "mobileVideoDownloadName", "Mobile video task downloads use friendly filenames.");
  requireIncludes(tasksSource, "copyVideoLinkToPhone", "Mobile video task page can copy the original mp4 link.");
  requireIncludes(tasksSource, "rawVideoLink", "Mobile video copy action uses the original video URL instead of the save proxy.");
  requireIncludes(tasksSource, "const saveUrl = rawVideoLink(file.url)", "Mobile video download action also uses the original video URL.");
  requireIncludes(tasksSource, "复制链接", "Mobile video task page exposes a copy-link action.");
  requireIncludes(tasksSource, "复制的是原始 mp4 链接", "Mobile video copy action explains the copied URL clearly.");
  requireNotIncludes(tasksSource, "videoSaveUrl", "Mobile video copy/download actions should not route through the save proxy helper.");
  requireNotIncludes(tasksSource, "MobilePhoneSaveSheet", "Mobile video copy action should not open the old save bottom sheet.");
  requireNotIncludes(tasksSource, "openPhoneSaveSheet", "Mobile video copy action should not route through the save page.");
  requireIncludes(tasksSource, "原文件名已隐藏，下载时会自动命名", "Mobile video task output cards hide raw filenames.");
  requireIncludes(tasksSource, "开始创作", "Mobile video task empty state guides users to create.");
  requireIncludes(tasksSource, "<th>视频</th>", "Task table heading avoids vendor jargon.");
  requireNotIncludes(tasksSource, "<th>外部任务 ID</th>", "Video task feature table should not show external task IDs.");
  requireNotIncludes(tasksSource, '<td>{row["外部任务ID"] || "-"}</td>', "Video task feature rows should not render external task IDs.");
}

if (serverSource) {
  requireIncludes(serverSource, "/api/video-save-proxy", "Server exposes a controlled video save proxy.");
  requireIncludes(serverSource, "isAllowedRemoteVideoUrl", "Video save proxy has an allow-list guard.");
  requireIncludes(serverSource, "MAX_REMOTE_VIDEO_BYTES", "Video save proxy has a file-size guard.");
}

if (assetsSource) {
  requireIncludes(assetsSource, "mobile-assets-view", "Mobile asset cards are rendered");
  requireIncludes(assetsSource, "mobile-assets-helper", "Mobile assets page has a beginner-friendly result summary.");
  requireIncludes(assetsSource, "生成后的图片和视频都在这里", "Mobile assets summary explains where results are.");
  requireIncludes(assetsSource, "buildMobileAssetNextStep", "Mobile assets page builds a next-step guide.");
  requireIncludes(assetsSource, "MobileAssetNextStepCard", "Mobile assets page renders a next-step guide.");
  requireIncludes(assetsSource, "mobile-asset-next-step", "Mobile assets next-step card is present.");
  requireIncludes(assetsSource, "素材下载后下一步", "Mobile assets next-step card has an accessible label.");
  requireIncludes(assetsSource, "下载后下一步", "Mobile assets page explains what to do after download.");
  requireIncludes(assetsSource, "buildMobileResultPackage", "Mobile assets page builds a result package summary.");
  requireIncludes(assetsSource, "MobileResultPackageCard", "Mobile assets page renders a result package summary.");
  requireIncludes(assetsSource, "mobile-result-package", "Mobile assets page renders a result package card.");
  requireIncludes(assetsSource, "可保存结果包", "Mobile result package card has an accessible label.");
  requireIncludes(assetsSource, "结果包已准备", "Mobile result package explains ready state.");
  requireIncludes(assetsSource, "结果包还在等待", "Mobile result package explains pending state.");
  requireIncludes(assetsSource, "保存视频", "Mobile result package gives a direct save-video action.");
  requireIncludes(assetsSource, "保存素材", "Mobile result package gives a direct save-asset action.");
  requireIncludes(assetsSource, "保存图片", "Mobile result package gives a direct save-image action.");
  requireIncludes(assetsSource, "去拼接", "Mobile assets page offers a stitch next step after video output.");
  requireIncludes(assetsSource, "再生成", "Mobile assets page offers a repeat generation next step.");
  requireIncludes(assetsSource, "做封面", "Mobile assets page offers a cover-image next step.");
  requireIncludes(assetsSource, "mobile-source-link-card", "Mobile source-link cards are rendered");
  requireIncludes(assetsSource, "TaskSourceLinksPanel", "Assets page renders AI image source traceability");
  requireIncludes(assetsSource, "downloadStateLabel", "Mobile asset cards show a readable download state.");
  requireIncludes(assetsSource, "assetKindLabel", "Mobile asset cards use friendly material type labels.");
  requireIncludes(assetsSource, "assetMetaLabel", "Mobile asset cards summarize metadata without task codes.");
  requireIncludes(assetsSource, "点下载保存到手机；点复制可以把链接发给同事。", "Mobile assets helper explains copy and download actions plainly.");
  requireIncludes(assetsSource, "MobileDownloadFeedback", "Mobile assets page confirms when a download starts.");
  requireIncludes(assetsSource, "MobileDownloadSheet", "Mobile assets page opens an in-app download confirmation sheet on phones.");
  requireIncludes(assetsSource, "返回素材页", "Mobile download sheet gives users a clear back button.");
  requireIncludes(assetsSource, "继续下载", "Mobile download sheet keeps the final file-open action explicit.");
  requireIncludes(assetsSource, "options.event?.preventDefault?.();", "Mobile download links stay inside the app until users confirm.");
  requireIncludes(assetsSource, "已停留在素材页，确认后再打开系统下载。", "Mobile download notification explains that the app did not navigate away.");
  requireIncludes(assetsSource, "已开始保存", "Mobile assets download feedback uses beginner-friendly copy.");
  requireIncludes(assetsSource, "已交给浏览器下载", "Mobile assets download feedback explains where the file goes.");
  requireIncludes(assetsSource, "downloadActionLabel", "Mobile asset buttons show a short saving state after tap.");
  requireIncludes(assetsSource, "保存中", "Mobile asset download buttons indicate that saving has started.");
  requireIncludes(assetsSource, "文生图结果", "Mobile text-image source cards use a friendly source type label.");
  requireIncludes(assetsSource, "mobile-assets-segmented", "Mobile assets page has segmented sections instead of one long list.");
  requireIncludes(assetsSource, "MobileVideoTaskBridge", "Mobile assets page routes video output work to the video task page.");
  requireIncludes(assetsSource, "视频生成任务", "Mobile assets page replaces raw video output with a video task entry.");
  requireIncludes(assetsSource, "打开、下载、看进度", "Mobile assets video section uses concise action copy.");
  requireIncludes(assetsSource, "成片在任务页处理。", "Mobile assets video section keeps the explanation short.");
  requireIncludes(assetsSource, "mobileVideoOutputLabel", "Mobile assets video bridge uses friendly numbered video names.");
  requireIncludes(assetsSource, "最近", "Mobile assets video bridge labels the latest output plainly.");
  requireIncludes(assetsSource, "去任务页", "Mobile assets video bridge uses a short CTA.");
  requireIncludes(assetsSource, 'href="#/libtv"', "Mobile assets video bridge links to video tasks.");
  requireIncludes(assetsSource, "来源位置已隐藏，可直接下载", "Mobile text-image source cards hide raw source locations.");
  requireIncludes(assetsSource, "本机位置已隐藏，可直接下载", "Mobile asset cards hide local locations in beginner wording.");
  requireNotIncludes(assetsSource, "本地路径已隐藏", "Mobile asset cards should not mention raw local paths.");
  requireNotPattern(assetsSource, /mobile-source-link-card[\s\S]{0,1200}link\.taskCode\s*\|\|\s*"未绑定任务"/, "Mobile text-image source cards should not show task codes.");
  requireNotPattern(assetsSource, /mobile-source-link-card[\s\S]{0,1200}link\.textImageModel\s*\|\|\s*"模型未记录"/, "Mobile text-image source cards should not show model IDs.");
  requireNotIncludes(assetsSource, 'row.task_code || "未绑定任务"', "Mobile asset cards should not show task codes.");
  requireNotIncludes(assetsSource, 'file.kind || "output"', "Mobile video output cards should not show raw output kind.");
  requireIncludes(assetsSource, 'const copyTarget = link.sourceUrl || "";', "Mobile text-image source copy action only exposes a download URL.");
  requireIncludes(assetsSource, "文生图来源下载链接", "Mobile text-image source copy action uses a beginner-friendly label.");
  requireIncludes(assetsSource, "MobileEmptyAssetCard", "Mobile asset empty states guide users to next steps.");
  requireIncludes(assetsSource, "mobile-empty-next-steps", "Mobile asset empty states include step-by-step guidance.");
  requireIncludes(assetsSource, "空状态下一步", "Mobile asset empty state steps have an accessible label.");
  requireIncludes(assetsSource, "还没有 AI 图片来源", "Mobile empty AI image state explains what is missing.");
  requireIncludes(assetsSource, "先去文生图生成主图或封面", "Mobile empty AI image state points users to text-image generation.");
  requireIncludes(assetsSource, "生成后回到这里保存图片", "Mobile empty AI image state explains where to return.");
  requireIncludes(assetsSource, "还没有素材记录", "Mobile empty material state explains what is missing.");
  requireIncludes(assetsSource, "生成后在这里保存素材", "Mobile empty material state explains where assets appear.");
  requireIncludes(assetsSource, "mobile-asset-unavailable", "Mobile assets show unavailable download state.");
  requireIncludes(assetsSource, "待下载", "Mobile assets label records that are not ready to download.");
  requireIncludes(assetsSource, "<span>复制</span>", "Mobile asset copy buttons show a readable label.");
  requireIncludes(assetsSource, "<span>下载</span>", "Mobile asset download buttons show a readable label.");
  requireIncludes(assetsSource, 'safeDisplayName(row.file_name || downloadUrl', "Mobile asset cards sanitize file names before display.");
  requirePattern(assetsSource, /download=\{sourceDisplayName \|\| true\}/, "Mobile text-image source cards provide direct download.");
}

if (stitchSource) {
  requireIncludes(stitchSource, "MobileStitchVideoCards", "Mobile stitch video cards are implemented");
  requireIncludes(stitchSource, "mobile-stitch-video-list", "Mobile stitch video list is rendered");
  requireIncludes(stitchSource, "aria-label=\"手机端视频拼接列表\"", "Mobile stitch list has an accessible label");
  requireIncludes(stitchSource, "先生成视频，完成后会出现在这里。", "Stitch empty state avoids vendor wording.");
  requireNotIncludes(stitchSource, "提交 libTV", "Stitch empty state should not expose vendor wording.");
}

if (batchSource) {
  requireIncludes(batchSource, "function BatchPage", "Batch page module exists");
  requireIncludes(batchSource, "MobileBatchDraftCards", "Batch page keeps mobile draft cards");
  requireIncludes(batchSource, "MobileBatchCards", "Batch page keeps mobile batch status cards");
  requireIncludes(batchSource, "requestJson(\"/api/batch-draft\")", "Batch page keeps draft recovery");
  requireIncludes(batchSource, '"视频生成方式"', "Batch template uses a beginner-friendly video mode field.");
  requireIncludes(batchSource, '"是否自动提交视频"', "Batch template uses a beginner-friendly auto-submit field.");
  requireIncludes(batchSource, "系统会按顺序自动执行", "Batch hero avoids backend worker wording.");
  requireIncludes(batchSource, "<span>视频生成方式</span>", "Batch form avoids vendor mode labels.");
  requireIncludes(batchSource, "生成最终提示词后自动提交视频", "Batch auto-submit copy avoids vendor wording.");
  requireIncludes(batchSource, "视频生成方式不合法", "Batch validation avoids vendor wording.");
  requireIncludes(batchSource, "当前视频生成方式为先验证", "Batch result tooltip avoids vendor wording.");
  requireIncludes(batchSource, "batchItemNumber", "Mobile batch item cards show simple item numbers.");
  requireIncludes(batchSource, "batchStepLabel", "Mobile batch item cards map raw steps to beginner wording.");
  requireIncludes(batchSource, "batchModeLabel", "Mobile batch item cards show plain video mode labels.");
  requireIncludes(batchSource, "batchProgressNote", "Mobile batch item cards show a readable progress note.");
  requireIncludes(batchSource, "batchFriendlyError", "Mobile batch item cards clean technical error messages.");
  requireIncludes(batchSource, "aiUsageLabel", "Batch result table summarizes AI usage without raw token counters.");
  requireIncludes(batchSource, "batchResultExportColumns", "Batch result export uses beginner-friendly Chinese columns.");
  requireIncludes(batchSource, 'label: "AI 消耗"', "Batch CSV export uses a plain AI usage label.");
  requireIncludes(batchSource, '<th>AI 消耗</th>', "Batch desktop result table avoids token jargon.");
  requireIncludes(batchSource, '<th>处理提示</th>', "Batch desktop result table labels errors as action hints.");
  requireIncludes(batchSource, "<span>当前步骤</span>", "Mobile batch item cards label the current step plainly.");
  requireIncludes(batchSource, "<span>生成方式</span>", "Mobile batch item cards label video mode plainly.");
  requireNotIncludes(batchSource, "<span>libTV 模式</span>", "Batch form should not expose vendor mode labels.");
  requireNotIncludes(batchSource, "自动提交 libTV", "Batch auto-submit copy should not expose vendor wording.");
  requireNotIncludes(batchSource, "后端 worker", "Batch runtime copy should not expose backend worker wording.");
  requireNotIncludes(batchSource, "const taskCode = item.libtv_task_code", "Mobile batch item cards should not expose vendor task codes.");
  requireNotIncludes(batchSource, "<span>Tokens</span>", "Mobile batch item cards should not expose token counters.");
  requireNotIncludes(batchSource, '<th>tokens</th>', "Batch desktop table should not expose raw token labels.");
  requireNotIncludes(batchSource, '<th>任务编号</th>', "Batch desktop table should not expose internal task code labels.");
  requireNotIncludes(batchSource, 'const headers = ["row_no"', "Batch CSV export should not use raw internal headers.");
}

if (workflowSource) {
  requireIncludes(workflowSource, "按实际业务流程逐步接入真实功能", "Workflow placeholder avoids database/API implementation wording.");
  requireNotIncludes(workflowSource, "数据库表和接口", "Workflow placeholder should not expose implementation wording.");
}

if (settingsSource) {
  requireIncludes(settingsSource, "/legal/privacy.html", "Settings page links to privacy policy");
  requireIncludes(settingsSource, "/install.html", "Settings App readiness center links to the public install guide.");
  requireIncludes(settingsSource, "/api/account/export", "Settings page includes data export action");
  requireIncludes(settingsSource, "AppReadinessCenter", "Settings page includes the App readiness center.");
  requireIncludes(settingsSource, "MobileFirstUseGuide", "Settings page includes a first-use mobile guide.");
  requireIncludes(settingsSource, "MobileServiceFixCard", "Settings page includes a mobile service troubleshooting card.");
  requireIncludes(settingsSource, "生成卡住时看这里", "Mobile settings service card has a clear beginner heading.");
  requireIncludes(settingsSource, "可以开始生成", "Mobile settings service card explains ready state.");
  requireIncludes(settingsSource, "视频通道还在检查", "Mobile settings service card explains partial-ready state.");
  requireIncludes(settingsSource, "生成服务暂时未连接", "Mobile settings service card explains disconnected state.");
  requireIncludes(settingsSource, "onFeedbackOpen={() => setFeedbackOpen(true)}", "Mobile settings service card can open feedback.");
  requireIncludes(settingsSource, "首次使用引导", "Mobile first-use guide has an accessible label.");
  requireIncludes(settingsSource, "按这 3 步检查就行", "Mobile first-use guide gives a simple headline.");
  requireIncludes(settingsSource, "先装到手机桌面", "Mobile first-use guide starts with installation.");
  requireIncludes(settingsSource, "确认生成状态", "Mobile first-use guide asks users to check generation readiness.");
  requireIncludes(settingsSource, "遇到问题直接反馈", "Mobile first-use guide points users to feedback.");
  requireIncludes(settingsSource, "mobile-settings-guide-steps", "Mobile first-use guide renders step cards.");
  requireIncludes(settingsSource, "mobile-settings-guide-actions", "Mobile first-use guide renders quick actions.");
  requireIncludes(settingsSource, "MobileSettingsActionHub", "Settings page includes a mobile quick-start action hub.");
  requireIncludes(settingsSource, "我的页快捷入口", "Mobile settings quick-start hub has an accessible label.");
  requireIncludes(settingsSource, "今天先做什么", "Mobile settings quick-start hub starts with a beginner question.");
  requireIncludes(settingsSource, "开始创作", "Mobile settings quick-start hub links to creation.");
  requireIncludes(settingsSource, "素材结果", "Mobile settings quick-start hub links to assets.");
  requireIncludes(settingsSource, "任务进度", "Mobile settings quick-start hub links to tasks.");
  requireIncludes(settingsSource, 'href: "#/inspiration"', "Mobile settings quick-start hub can open templates.");
  requireIncludes(settingsSource, 'href: "#/assets"', "Mobile settings quick-start hub can open assets.");
  requireIncludes(settingsSource, 'href: "#/tasks"', "Mobile settings quick-start hub can open tasks.");
  requireIncludes(settingsSource, "MobileAccountCenter", "Settings page includes a beginner-friendly mobile account center.");
  requireIncludes(settingsSource, "手机端账号中心", "Mobile account center has a clear accessible label.");
  requireIncludes(settingsSource, "任务和素材按账号隔离", "Mobile account center explains account separation plainly.");
  requireIncludes(settingsSource, "onFeedbackOpen={() => setFeedbackOpen(true)}", "Mobile account center can open the feedback section.");
  requireIncludes(settingsSource, "onDataOpen={() => setDataRightsOpen(true)}", "Mobile account center can open the data section.");
  requireIncludes(settingsSource, "MobileCollapsibleSection", "Settings page has mobile collapsible sections.");
  requireIncludes(settingsSource, "settings-mobile-collapsible", "Settings page marks long mobile sections as collapsible.");
  requireIncludes(settingsSource, "mobileModelText", "Settings mobile runtime rows hide raw model IDs behind simple labels.");
  requireIncludes(settingsSource, 'mobileName: "生成服务"', "Settings mobile runtime rows use beginner-friendly row names.");
  requireIncludes(settingsSource, 'title: "生成链路"', "Settings App readiness center avoids technical runtime wording.");
  requireIncludes(settingsSource, 'desc: libtvReady ? "生成服务可用"', "Settings App readiness center avoids vendor wording.");
  requireIncludes(settingsSource, 'name: "视频通道"', "Settings runtime rows avoid vendor bridge wording.");
  requireIncludes(settingsSource, 'provider: "视频生成服务"', "Settings model channel avoids vendor provider wording.");
  requireIncludes(settingsSource, "系统默认：", "Settings model selector uses plain default wording.");
  requireIncludes(settingsSource, "当前链路会使用系统默认的视频生成配置。", "Settings model hint avoids vendor jargon.");
  requireIncludes(settingsSource, "生成服务、AI 能力和本机拼接能力的当前状态。", "Settings runtime description avoids backend/vendor jargon.");
  requireNotIncludes(settingsSource, "API 与 libTV 可用", "Settings App readiness center must not expose vendor/API jargon.");
  requireNotIncludes(settingsSource, "libTV 默认配置", "Settings model hint must not expose vendor wording.");
  requireIncludes(settingsSource, 'mobileValue: mobileModelText(activeAnalysisModel)', "Settings mobile runtime rows summarize the active model.");
  requireIncludes(settingsSource, 'className="desktop-setting-value"', "Settings keeps desktop-only detailed runtime values.");
  requireIncludes(settingsSource, 'className="mobile-setting-value"', "Settings renders mobile-only friendly runtime values.");
  requireIncludes(settingsSource, 'className="desktop-model-id"', "Settings keeps model IDs in a desktop-only element.");
  requireIncludes(settingsSource, 'className="mobile-model-state"', "Settings shows a simple mobile model state.");
  requireIncludes(settingsSource, "mobile-channel-provider", "Settings mobile model channel cards use friendly provider labels.");
  requireIncludes(settingsSource, "mobile-channel-desc", "Settings mobile model channel cards use friendly descriptions.");
  requireIncludes(settingsSource, "mobile-model-settings-summary", "Settings mobile model switcher starts with a beginner-friendly summary.");
  requireIncludes(settingsSource, "普通使用无需调整", "Settings mobile model switcher explains that most users do not need model IDs.");
  requireIncludes(settingsSource, 'mobileProvider: "出图能力"', "Settings mobile channel hides image model vendor wording.");
  requireIncludes(settingsSource, 'mobileProvider: "本机合成"', "Settings mobile channel hides ffmpeg wording.");
  requireIncludes(settingsSource, "app-readiness-grid", "Settings page renders the App readiness grid.");
  requireIncludes(settingsSource, "PilotFeedbackPanel", "Settings page includes the pilot feedback panel.");
  requireIncludes(settingsSource, "/api/support/feedback", "Settings page submits pilot feedback.");
  requireIncludes(settingsSource, "pilot-feedback-grid", "Settings page renders the pilot feedback grid.");
  requireIncludes(settingsSource, "rows={3}", "Mobile pilot feedback textarea is kept short.");
  requireIncludes(settingsSource, "feedback.slice(0, 2)", "Mobile pilot feedback history stays compact.");
  requireIncludes(settingsSource, "pilotFeedbackMessage.trim().length < 6", "Settings page prevents empty pilot feedback.");
  requireIncludes(settingsSource, "MobileRecordEmptyCard", "Settings page uses guided empty states for records.");
  requireIncludes(settingsSource, "mobile-record-empty", "Settings guided empty states have a dedicated class.");
  requireIncludes(settingsSource, "下一步说明", "Settings guided empty states include accessible next steps.");
  requireIncludes(settingsSource, "还没有反馈记录", "Settings feedback empty state explains what is missing.");
  requireIncludes(settingsSource, "提交后这里会显示处理状态", "Settings feedback empty state explains where status appears.");
  requireIncludes(settingsSource, "还没有数据申请", "Settings data request empty state explains what is missing.");
  requireIncludes(settingsSource, "提交后等待人工复核", "Settings data request empty state explains review flow.");
  requireIncludes(settingsSource, "暂无待审核申请", "Settings admin data queue empty state is beginner-friendly.");
  requireIncludes(settingsSource, "桌面安装", "Settings App readiness center includes desktop install entry.");
  requireIncludes(settingsSource, "隐私与支持", "Settings App readiness center includes privacy and support entry.");
  requireIncludes(settingsSource, "账号数据", "Settings App readiness center includes account data entry.");
}

if (manifestSource) {
  requireIncludes(manifestSource, '"display": "standalone"', "PWA manifest launches in standalone mode.");
  requireIncludes(manifestSource, '"start_url": "/"', "PWA manifest has a stable start URL.");
  requireIncludes(manifestSource, '"shortcuts"', "PWA manifest exposes quick shortcuts.");
  requireIncludes(manifestSource, '"/#/studio"', "PWA manifest shortcut opens creation flow.");
  requireIncludes(manifestSource, '"/icons/icon-maskable-512.png"', "PWA manifest includes a maskable icon.");
}

if (installSource) {
  requireIncludes(installSource, "安装到手机桌面", "Install guide has a beginner-friendly title.");
  requireIncludes(installSource, "iPhone / iPad", "Install guide covers iOS.");
  requireIncludes(installSource, "Android 手机", "Install guide covers Android.");
  requireIncludes(installSource, "安装后怎么判断成功", "Install guide explains success checks.");
}

if (offlineSource) {
requireIncludes(offlineSource, "网络暂时断开", "Offline page explains the network problem plainly.");
requireIncludes(offlineSource, "先别退出", "Offline page reassures users before they close the app.");
requireIncludes(offlineSource, "offline-checklist", "Offline page shows a simple recovery checklist.");
requireIncludes(offlineSource, "任务中心", "Offline page tells users where to check running tasks.");
requireIncludes(offlineSource, "重新连接", "Offline page offers a reconnect action.");
}

if (supportSource) {
  requireIncludes(supportSource, "遇到问题先点这里", "Support page has a beginner-first title.");
  requireIncludes(supportSource, "不用理解技术原因", "Support page avoids technical troubleshooting framing.");
  requireIncludes(supportSource, "support-action-grid", "Support page has a quick action grid.");
  requireIncludes(supportSource, "生成卡住", "Support page has a stuck-generation entry.");
  requireIncludes(supportSource, "素材找不到", "Support page has an asset recovery entry.");
  requireIncludes(supportSource, "结果不满意", "Support page has a result improvement entry.");
  requireIncludes(supportSource, "账号 / 数据", "Support page has an account and data entry.");
}

if (swSource) {
  requireIncludes(swSource, "/offline.html", "Service worker precaches the offline page.");
  requireIncludes(swSource, "SKIP_WAITING", "Service worker supports update activation.");
  requireIncludes(swSource, "request.mode === \"navigate\"", "Service worker handles offline navigation.");
}

if (stylesSource) {
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)/, "Mobile breakpoint exists");
  requireIncludes(stylesSource, "env(safe-area-inset-bottom)", "Mobile safe area is respected");
  requireIncludes(stylesSource, ".mobile-bottom-nav", "Mobile bottom nav styles exist");
  requireIncludes(stylesSource, ".mobile-bottom-nav-item", "Mobile bottom nav item styles exist");
  requireIncludes(stylesSource, ".mobile-create-radial-head", "Mobile create popover header styles exist");
  requirePattern(stylesSource, /\.mobile-create-radial-head\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s, "Mobile create popover header spans the full action sheet width.");
  requirePattern(stylesSource, /\.mobile-create-radial-action\.featured\s*\{[^}]*border-color:/s, "Mobile create popover has a visible recommended action style.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-create-radial\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.94\)/s, "Mobile create popover has a light theme surface.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.mobile-create-radial\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "Mobile create popover switches to two columns on narrow phones.");
  requireIncludes(stylesSource, ".mobile-create-tabs button", "Mobile create tabs have button styles");
  requireIncludes(stylesSource, ".mobile-input-tabs button", "Mobile input tabs have button styles");
  requireIncludes(stylesSource, ".final-prompt-actions", "Mobile final prompt action typography styles exist");
  requireIncludes(stylesSource, ".mobile-beginner-launcher", "Mobile beginner launcher styles exist");
  requireIncludes(stylesSource, ".mobile-hot-play-list", "Mobile hot play carousel styles exist");
  requireIncludes(stylesSource, ".mobile-account-center", "Mobile account center styles exist");
  requireIncludes(stylesSource, ".pwa-install-hints", "PWA install banner has step hint styles.");
  requirePattern(stylesSource, /\.pwa-install-hints\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "PWA install hint steps fit in three compact cells.");
  requirePattern(stylesSource, /\.pwa-install-actions-three\s*\{[^}]*grid-template-columns:\s*1fr\s+1fr\s+0\.72fr/s, "PWA install banner keeps install, guide, and dismiss actions compact.");
  requireIncludes(stylesSource, ".mobile-runtime-label", "Mobile runtime status has readable label styles.");
  requireIncludes(stylesSource, ".mobile-service-check-card", "Mobile home service check card has styles.");
  requireIncludes(stylesSource, ".mobile-service-check-actions", "Mobile home service check has action button styles.");
  requirePattern(stylesSource, /\.mobile-service-check-card\.state-ready\s*\{[^}]*border-color/s, "Mobile service check ready state has a positive style.");
  requirePattern(stylesSource, /\.mobile-service-check-card\.state-warn\s*\{[^}]*border-color/s, "Mobile service check warning state has a visible style.");
  requirePattern(stylesSource, /\.mobile-service-check-card\.state-bad\s*\{[^}]*border-color/s, "Mobile service check disconnected state has a visible style.");
  requirePattern(stylesSource, /\.runtime\.warn\s*\{[^}]*var\(--warn\)/s, "Runtime status has a warning tone.");
  requirePattern(stylesSource, /\.runtime\.bad\s*\{[^}]*var\(--bad\)/s, "Runtime status has an error tone.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.top-actions\s+\.runtime\s*\{(?=[^}]*flex:\s*0\s+0\s+96px)(?=[^}]*max-width:\s*104px)[^}]*\}/s, "Mobile runtime status is a readable compact pill instead of a dot-only square.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.top-actions\s+\.runtime\s+\.mobile-runtime-label\s*\{[^}]*display:\s*grid/s, "Mobile runtime status shows the short user-facing label.");
  requireIncludes(stylesSource, ".app-readiness-grid", "Mobile settings App readiness grid styles exist");
  requireIncludes(stylesSource, ".app-readiness-tile", "Mobile settings App readiness tiles have styles");
  requireIncludes(stylesSource, ".settings-mobile-section-toggle", "Mobile settings sections have compact expand controls");
  requireIncludes(stylesSource, ".mobile-settings-action-hub", "Mobile settings quick-start action hub has styles.");
  requireIncludes(stylesSource, ".mobile-settings-action-hub-grid", "Mobile settings quick-start action hub has grid styles.");
  requireIncludes(stylesSource, ".mobile-settings-action-hub-item", "Mobile settings quick-start action items have styles.");
  requireIncludes(stylesSource, ".mobile-service-fix-card", "Mobile settings service troubleshooting card has styles.");
  requireIncludes(stylesSource, ".mobile-service-fix-actions", "Mobile settings service troubleshooting card has action styles.");
  requirePattern(stylesSource, /\.mobile-service-fix-card\.state-ready\s*\{[^}]*border-color/s, "Mobile settings service card ready state has a positive style.");
  requirePattern(stylesSource, /\.mobile-service-fix-card\.state-warn\s*\{[^}]*border-color/s, "Mobile settings service card warning state has a visible style.");
  requirePattern(stylesSource, /\.mobile-service-fix-card\.state-bad\s*\{[^}]*border-color/s, "Mobile settings service card disconnected state has a visible style.");
  requireIncludes(stylesSource, ".mobile-record-empty", "Settings guided empty record cards have styles.");
  requireIncludes(stylesSource, ".mobile-record-empty-steps", "Settings guided empty record cards include step styles.");
  requireIncludes(stylesSource, ".mobile-record-empty-action", "Settings guided empty record cards include action styles.");
  requireIncludes(stylesSource, ".mobile-submit-wait-summary", "Mobile submit wait summary has styles.");
  requireIncludes(stylesSource, ".mobile-submit-wait-track", "Mobile submit wait summary progress bar has styles.");
  requirePattern(stylesSource, /\.mobile-submit-wait-track\s+i\s*\{[^}]*transition:\s*width/s, "Mobile submit wait summary progress animates smoothly.");
  requireIncludes(stylesSource, ".video-submit-button.waiting", "Video submit button waiting state has styles.");
  requireIncludes(stylesSource, ".mobile-create-wait-tip", "Mobile create duplicate-submit tip has styles.");
  requireIncludes(stylesSource, "@keyframes soft-spin", "Video waiting buttons have a defined soft spin animation.");
  requireIncludes(stylesSource, ".mobile-video-wait-card", "Mobile video wait progress card has styles.");
  requireIncludes(stylesSource, ".mobile-video-wait-track", "Mobile video wait progress bar has styles.");
  requireIncludes(stylesSource, ".mobile-video-wait-meta", "Mobile video wait timing labels have styles.");
  requirePattern(stylesSource, /\.mobile-video-wait-track\s+i\s*\{[^}]*transition:\s*width/s, "Mobile video wait progress animates smoothly.");
  requireIncludes(stylesSource, ".settings-mobile-collapsible:not(.open) .settings-mobile-collapsible-body", "Mobile settings long sections collapse by default");
  requireIncludes(stylesSource, ".pilot-feedback-grid", "Mobile pilot feedback form styles exist");
  requireIncludes(stylesSource, ".pilot-feedback-card", "Mobile pilot feedback record card styles exist");
  requireIncludes(stylesSource, ".mobile-action-tile", "Mobile beginner action tile styles exist");
  requireIncludes(stylesSource, ".mobile-action-grid", "Mobile beginner action grid styles exist");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.topbar-left\s*\{(?=[^}]*grid-template-columns:\s*42px)(?=[^}]*flex:\s*0 0 auto)[^}]*\}/s, "Mobile topbar reserves space for actions instead of a truncated title.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.topbar-left\s*>\s*div\s*\{[^}]*display:\s*none/s, "Mobile topbar hides the clipped page title.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.top-actions\s*\{(?=[^}]*justify-content:\s*flex-end)(?=[^}]*min-width:\s*0)[^}]*\}/s, "Mobile topbar keeps status buttons aligned after hiding the title.");
  requirePattern(stylesSource, /\.console-shell\.guest-preview\s+\.topbar-left\s*>\s*div\s*\{[^}]*display:\s*none\s*!important/s, "Guest mobile web topbar hides the vertical preview title.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*768px\)[\s\S]*?\.console-shell\.guest-preview\s+\.topbar\s*\{(?=[^}]*grid-template-columns:\s*42px minmax\(0,\s*1fr\))(?=[^}]*min-height:\s*50px)[^}]*\}/s, "Guest mobile web topbar stays compact in browser mode.");
  requireIncludes(stylesSource, ".console-shell.mobile-sidebar-visible .sidebar", "Mobile visible sidebar has a locked drawer style.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible,\s*\.console-shell\.mobile-sidebar-visible\.sidebar-collapsed\s*\{(?=[^}]*position:\s*relative\s*!important)(?=[^}]*isolation:\s*isolate)[^}]*\}/s, "Mobile drawer isolates its overlay layer.");
  requireNotIncludes(stylesSource, ".mobile-sidebar-edge-guard", "Mobile drawer no longer ships a left-edge gesture marker.");
  requireNotIncludes(stylesSource, "mobile-sidebar-dragging", "Mobile drawer no longer has half-open dragging styles.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.sidebar\s*\{(?=[^}]*position:\s*fixed\s*!important)(?=[^}]*inset:\s*0 auto 0 0\s*!important)(?=[^}]*width:\s*min\(82vw,\s*304px\)\s*!important)(?=[^}]*transform:\s*translateX\(var\(--mobile-sidebar-x,\s*0\)\)\s*!important)[^}]*\}/s, "Mobile visible sidebar stays fixed on the left while dragging.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.sidebar\s*\{(?=[^}]*left:\s*0\s*!important)(?=[^}]*right:\s*auto\s*!important)(?=[^}]*contain:\s*layout\s+paint)[^}]*\}/s, "Mobile drawer pins the sidebar without layout bleed.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.mobile-sidebar-backdrop\s*\{(?=[^}]*position:\s*fixed\s*!important)(?=[^}]*z-index:\s*55\s*!important)(?=[^}]*width:\s*100vw\s*!important)(?=[^}]*height:\s*100dvh\s*!important)[^}]*\}/s, "Mobile drawer backdrop always covers the viewport.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.main\s*\{(?=[^}]*margin-left:\s*0\s*!important)(?=[^}]*transform:\s*none\s*!important)[^}]*\}/s, "Mobile drawer does not push or transform the main page.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.main\s*\{(?=[^}]*position:\s*relative\s*!important)(?=[^}]*z-index:\s*1)(?=[^}]*left:\s*0\s*!important)[^}]*\}/s, "Mobile drawer keeps the main page in a stable layer.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.main\s*\{(?=[^}]*overflow-x:\s*clip\s*!important)(?=[^}]*contain:\s*paint)[^}]*\}/s, "Mobile drawer clips the main page while the drawer is visible.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.main\s*\{(?=[^}]*pointer-events:\s*auto)(?=[^}]*touch-action:\s*pan-y)[^}]*\}/s, "Mobile drawer leaves the main page clickable after drawer state clears.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.mobile-inspiration-page,[\s\S]*?\.console-shell\.mobile-sidebar-visible\s+\.mobile-inspiration-page\s*>\s*\*\s*\{(?=[^}]*transform:\s*none\s*!important)(?=[^}]*translate:\s*none\s*!important)[^}]*\}/s, "Mobile drawer pins the inspiration page while the drawer is visible.");
  requirePattern(stylesSource, /html\.mobile-sidebar-gesture-lock,[\s\S]*?body\.mobile-sidebar-gesture-lock\s*\{(?=[^}]*overflow-x:\s*hidden)(?=[^}]*overscroll-behavior-x:\s*none)(?=[^}]*touch-action:\s*pan-y)[^}]*\}/s, "Mobile drawer locks horizontal page bounce while open or dragging.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?html,\s*body,\s*#root\s*\{(?=[^}]*overflow-x:\s*hidden\s*!important)(?=[^}]*overscroll-behavior-x:\s*none)[^}]*\}/s, "Mobile shell prevents native horizontal bounce before the drawer starts dragging.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?body\s*\{[^}]*touch-action:\s*pan-y/s, "Mobile shell tells the browser vertical scroll is the default page gesture.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.nav-list\s*\{[^}]*grid-template-columns:\s*1fr\s*!important/s, "Mobile drawer nav stays in one column when opened.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.sidebar\s*>\s*\.brand\s*\{[^}]*display:\s*none\s*!important/s, "Mobile drawer hides the duplicate brand header.");
  requirePattern(stylesSource, /\.console-shell\.mobile-sidebar-visible\s+\.mobile-drawer-account\s*\{[^}]*display:\s*grid\s*!important/s, "Mobile drawer keeps one combined account header.");
  requireIncludes(stylesSource, ".mobile-task-card-list", "Mobile task card styles exist");
  requireIncludes(stylesSource, ".mobile-assets-view", "Mobile asset view styles exist");
  requireIncludes(stylesSource, ".mobile-assets-helper", "Mobile assets helper styles exist");
  requireIncludes(stylesSource, ".mobile-download-feedback", "Mobile assets download feedback has styles.");
  requireIncludes(stylesSource, ".mobile-download-sheet-backdrop", "Mobile assets download confirmation sheet has a backdrop.");
  requireIncludes(stylesSource, ".mobile-download-sheet-actions", "Mobile assets download confirmation sheet has clear actions.");
  requirePattern(stylesSource, /\.mobile-download-sheet-backdrop\s*\{(?=[^}]*position:\s*fixed)(?=[^}]*z-index:\s*82)(?=[^}]*align-items:\s*end)[^}]*\}/s, "Mobile download confirmation opens as a bottom sheet.");
  requireIncludes(stylesSource, ".mobile-empty-next-steps", "Mobile asset empty-state step list has styles.");
  requireIncludes(stylesSource, ".mobile-asset-title-row", "Mobile asset cards keep titles and status badges on one row.");
  requireIncludes(stylesSource, ".mobile-asset-status.ready", "Mobile asset cards style ready-to-download badges.");
  requireIncludes(stylesSource, ".mobile-asset-status.pending", "Mobile asset cards style pending-download badges.");
  requirePattern(stylesSource, /\.mobile-assets-helper-stats\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "Mobile assets helper shows three compact count cells.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-assets-helper[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.92\)/s, "Light mobile assets helper stays bright and readable.");
  requireIncludes(stylesSource, ".mobile-asset-next-step", "Mobile assets next-step card has dedicated styles.");
  requireIncludes(stylesSource, ".mobile-asset-next-actions", "Mobile assets next-step actions have dedicated styles.");
  requireIncludes(stylesSource, ".mobile-result-package", "Mobile result package has dedicated styles.");
  requireIncludes(stylesSource, ".mobile-result-package-actions", "Mobile result package actions have dedicated styles.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-asset-next-step\s*\{[^}]*display:\s*grid/s, "Mobile assets next-step card is visible on phones.");
  requirePattern(stylesSource, /\.mobile-asset-next-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "Mobile assets next-step actions fit in compact columns.");
  requirePattern(stylesSource, /\.mobile-result-package-counts\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "Mobile result package counts fit in compact columns.");
  requirePattern(stylesSource, /\.mobile-result-package-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "Mobile result package actions fit in compact columns.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.mobile-asset-next-actions\s*\{[^}]*grid-template-columns:\s*1fr/s, "Narrow phones stack assets next-step actions.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.mobile-result-package-actions\s*\{[^}]*grid-template-columns:\s*1fr/s, "Narrow phones stack result package actions.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-asset-next-step[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.92\)/s, "Light mobile assets next-step card stays bright.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-result-package[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.92\)/s, "Light mobile result package card stays bright.");
  requirePattern(stylesSource, /\.mobile-asset-open,\s*\.mobile-asset-action\s*\{(?=[^}]*width:\s*48px)(?=[^}]*min-height:\s*42px)[^}]*\}/s, "Mobile asset actions show compact labeled buttons.");
  requirePattern(stylesSource, /\.mobile-asset-open\s+span,\s*\.mobile-asset-action\s+span\s*\{[^}]*text-overflow:\s*ellipsis/s, "Mobile asset action labels cannot overflow.");
  requireIncludes(stylesSource, ".mobile-empty-card-action", "Mobile empty asset states use guided cards.");
  requirePattern(stylesSource, /\.mobile-empty-card-action\s*\{(?=[^}]*min-height:\s*96px)(?=[^}]*text-align:\s*left)[^}]*\}/s, "Mobile empty asset cards are readable action cards.");
  requirePattern(stylesSource, /\.mobile-empty-card-action\s+a\s*\{(?=[^}]*min-height:\s*34px)(?=[^}]*border-radius:\s*999px)[^}]*\}/s, "Mobile empty asset cards have touchable next-step actions.");
  requirePattern(stylesSource, /\.mobile-asset-unavailable\s*\{(?=[^}]*width:\s*48px)(?=[^}]*min-height:\s*42px)[^}]*\}/s, "Mobile unavailable downloads keep action column stable.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-empty-card-action[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.9\)/s, "Light mobile empty asset cards stay bright.");
  requireIncludes(stylesSource, ".task-source-links-panel", "Desktop source-link panel styles exist");
  requireIncludes(stylesSource, ".mobile-source-link-card", "Mobile source-link card styles exist");
  requireIncludes(stylesSource, ".mobile-stitch-video-list", "Mobile stitch card styles exist");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.notification-panel\s*\{[^}]*position:\s*fixed;[^}]*right:\s*14px;[^}]*left:\s*14px;[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*width:\s*auto;[^}]*max-height:\s*min\(306px,\s*calc\(100dvh - 156px\)\)/s, "Mobile notification panel uses a readable full card with side margins.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.notification-list\s*\{[^}]*flex:\s*1\s+1\s+auto;[^}]*min-height:\s*0;[^}]*max-height:\s*min\(178px,\s*calc\(100dvh - 284px\)\)/s, "Mobile notification list scrolls inside the compact card.");
  requirePattern(stylesSource, /\.mobile-action-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "Mobile beginner actions use a two-column grid.");
  requirePattern(stylesSource, /\.mobile-hot-play-list\s*\{(?=[^}]*overflow-x:\s*auto)(?=[^}]*overscroll-behavior-x:\s*contain)(?=[^}]*touch-action:\s*pan-x)[^}]*\}/s, "Mobile hot play carousel scrolls horizontally without opening the sidebar.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.mobile-beginner-launcher[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.94\)/s, "Mobile light homepage uses a bright beginner launcher.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.topbar,\s*:root:not\(\[data-theme="dark"\]\)\s+\.topbar\s*\{(?=[^}]*position:\s*sticky)(?=[^}]*backdrop-filter:\s*blur\(12px\))[^}]*\}/s, "Mobile light topbar stays as a polished sticky App header.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.sidebar-toggle,[\s\S]*?:root:not\(\[data-theme="dark"\]\)\s+\.runtime\s*\{(?=[^}]*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.96\))(?=[^}]*box-shadow:\s*0\s+8px\s+22px)[^}]*\}/s, "Mobile light top action buttons use bright App-style surfaces.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.mobile-bottom-nav,\s*:root:not\(\[data-theme="dark"\]\)\s+\.mobile-bottom-nav\s*\{(?=[^}]*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.94\))(?=[^}]*box-shadow:\s*0\s+-12px\s+28px)[^}]*\}/s, "Mobile light bottom navigation uses a bright App bar.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.mobile-bottom-nav-item\.active,\s*:root:not\(\[data-theme="dark"\]\)\s+\.mobile-bottom-nav-item\.active\s*\{(?=[^}]*linear-gradient\(135deg,\s*rgba\(35,\s*199,\s*151,\s*0\.16\))(?=[^}]*box-shadow:)[^}]*\}/s, "Mobile light active bottom tab is clearly highlighted.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.mobile-app-hero[\s\S]*?rgba\(238,\s*250,\s*244,\s*0\.98\)/s, "Mobile light homepage hero uses a pale App-style surface.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.mobile-app-hero\s+button[\s\S]*?linear-gradient\(135deg,\s*#7dff61,\s*#dff44d\)/s, "Mobile light homepage keeps a clear green primary action.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root:not\(\[data-theme="dark"\]\)\s+\.mobile-action-tile[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.9\)/s, "Default light mobile action tiles stay bright.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.mobile-home-workbar-item[\s\S]*?linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.96\)/s, "Mobile light homepage workbar uses bright compact cards.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.mobile-next-step-card\s+b[\s\S]*?linear-gradient\(135deg,\s*#7dff61,\s*#dff44d\)/s, "Mobile light next-step action keeps a clear green pill.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.overview-status-card[\s\S]*?color:\s*#14221d/s, "Mobile light overview status cards keep dark readable text.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.mobile-hot-play-card[\s\S]*?linear-gradient\(145deg,\s*rgba\(237,\s*249,\s*246,\s*0\.96\)/s, "Mobile light hot play cards use pale surfaces instead of dark cards.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.settings-section[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.9\)/s, "Mobile light settings sections use pale surfaces.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-account-center\s*\{[^}]*display:\s*grid/s, "Mobile account center is shown only on mobile.");
  requirePattern(stylesSource, /\.mobile-account-status\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "Mobile account center keeps three plain status cells.");
  requirePattern(stylesSource, /\.mobile-account-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "Mobile account center keeps three clear action cells.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-account-center[\s\S]*?rgba\(247,\s*252,\s*249,\s*0\.96\)/s, "Light mobile account center stays bright and readable.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.app-readiness-tile[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.88\)/s, "Mobile light settings quick tiles stay bright.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?:root\[data-theme="light"\]\s+\.setting-item\s+strong[\s\S]*?color:\s*#14221d/s, "Mobile light setting rows keep readable dark values.");
  requireIncludes(stylesSource, ".mobile-settings-guide-steps", "Mobile first-use guide step styles exist.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-settings-guide-steps\s*\{[^}]*display:\s*grid/s, "Mobile first-use guide steps are visible on phones.");
  requirePattern(stylesSource, /\.mobile-settings-guide-steps\s+span\s*\{[^}]*grid-template-columns:\s*28px\s+minmax\(0,\s*1fr\)/s, "Mobile first-use guide steps use compact numbered rows.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.mobile-settings-guide-actions\s*\{[^}]*grid-template-columns:\s*1fr/s, "Narrow phones stack first-use guide actions.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-settings-guide-steps\s+span[\s\S]*?rgba\(255,\s*255,\s*255,\s*0\.88\)/s, "Light mobile first-use step cards stay bright.");
  requirePattern(stylesSource, /\.mobile-setting-label,\s*\.mobile-setting-value,\s*\.mobile-model-state\s*\{[^}]*display:\s*none/s, "Mobile-only settings values are hidden by default on desktop.");
  requirePattern(stylesSource, /\.mobile-channel-provider,\s*\.mobile-channel-desc,\s*\.mobile-model-settings-summary\s*\{[^}]*display:\s*none/s, "Mobile-only model channel labels are hidden by default on desktop.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.model-channel-card\s+\.desktop-model-id,\s*\.model-channel-card\s+\.desktop-channel-provider,\s*\.model-channel-card\s+\.desktop-channel-desc,[\s\S]*?\.model-settings-section\s+\.desktop-model-settings-grid,[\s\S]*?\.model-settings-section\s+\.desktop-model-settings-hint\s*\{[^}]*display:\s*none/s, "Mobile settings hides technical model IDs, provider names, and desktop model controls.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.model-channel-card\s+\.mobile-model-state,\s*\.model-channel-card\s+\.mobile-channel-provider,\s*\.model-channel-card\s+\.mobile-channel-desc,[\s\S]*?\.setting-item\s+\.mobile-setting-value\s*\{[^}]*display:\s*block/s, "Mobile settings shows friendly replacement values.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-model-settings-summary\s*\{[^}]*display:\s*grid/s, "Mobile model settings shows a friendly summary card.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-status-row\s+span\s*\{[^}]*display:\s*grid/s, "Mobile overview status rows support a short friendly explanation.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-status-row\s+small,\s*\.mobile-status-row\s+em\s*\{[^}]*text-overflow:\s*ellipsis/s, "Mobile overview status explanations stay compact.");
  requirePattern(stylesSource, /\.mobile-status-row\s+em\s*\{[^}]*font-style:\s*normal/s, "Mobile overview status explanations are styled as UI text, not italic prose.");
  requireIncludes(stylesSource, ".mobile-task-recovery-card", "Mobile failed task recovery card has dedicated styles.");
  requireIncludes(stylesSource, ".mobile-task-recovery-actions", "Mobile failed task recovery actions have dedicated styles.");
  requireIncludes(stylesSource, ".mobile-task-next-step", "Mobile video task next-step card has dedicated styles.");
  requireIncludes(stylesSource, ".mobile-task-next-actions", "Mobile video task next-step actions have dedicated styles.");
  requireIncludes(stylesSource, ".mobile-video-output-archive", "Mobile video task page has dedicated completed-output styles.");
  requireIncludes(stylesSource, ".mobile-video-output-card", "Mobile video outputs are rendered as phone-friendly cards.");
  requireIncludes(stylesSource, ".primary-save-phone", "Mobile video save-to-phone button has dedicated styling.");
  requireNotIncludes(stylesSource, ".mobile-phone-save-sheet-backdrop", "Mobile video copy-link action should not keep the old save sheet styles.");
  requireNotIncludes(stylesSource, ".mobile-phone-save-actions", "Mobile video copy-link action should not keep the old save sheet actions.");
  requireIncludes(stylesSource, ".mobile-assets-segmented", "Mobile assets page has dedicated segmented section styles.");
  requireIncludes(stylesSource, ".mobile-video-task-bridge-card", "Mobile assets page has a dedicated video task bridge style.");
  requirePattern(stylesSource, /\.mobile-task-recovery-card,\s*\.mobile-task-next-step,\s*\.mobile-asset-next-step\s*\{[^}]*display:\s*none/s, "Mobile recovery and next-step cards are hidden on desktop.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-task-recovery-card\s*\{[^}]*display:\s*grid/s, "Mobile failed task recovery card is visible on phones.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-task-next-step\s*\{[^}]*display:\s*grid/s, "Mobile video task next-step card is visible on phones.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-task-recovery-card[\s\S]*?rgba\(255,\s*252,\s*241,\s*0\.94\)/s, "Light mobile task recovery card stays bright.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-task-next-step[\s\S]*?rgba\(247,\s*252,\s*249,\s*0\.94\)/s, "Light mobile video task next-step card stays bright.");
  requirePattern(stylesSource, /\.mobile-inspiration-page\s*\{(?=[^}]*position:\s*relative)(?=[^}]*isolation:\s*isolate)[^}]*\}/s, "Mobile inspiration page has a stable paint layer.");
  requirePattern(stylesSource, /\.mobile-inspiration-page\s*\{(?=[^}]*overscroll-behavior-x:\s*none)[^}]*\}/s, "Mobile inspiration page prevents horizontal WebView back bleed.");
  requirePattern(stylesSource, /\.mobile-inspiration-page\s*\{(?=[^}]*overflow-x:\s*clip)(?=[^}]*overscroll-behavior-x:\s*none)[^}]*\}/s, "Mobile inspiration page clips horizontal overflow.");
  requirePattern(stylesSource, /\.mobile-template-card\s*\{(?=[^}]*max-width:\s*100%)(?=[^}]*overflow-x:\s*clip)[^}]*\}/s, "Mobile inspiration template cards cannot drag wider than the screen.");
  requirePattern(stylesSource, /\.mobile-inspiration-hero,[\s\S]*?\.mobile-simple-path\s*\{[^}]*touch-action:\s*pan-y/s, "Mobile inspiration vertical surfaces do not start native horizontal navigation.");
  requirePattern(stylesSource, /\.mobile-inspiration-tabs\s*\{(?=[^}]*overflow-x:\s*auto)(?=[^}]*overscroll-behavior-x:\s*contain)(?=[^}]*touch-action:\s*pan-x)[^}]*\}/s, "Mobile inspiration tabs scroll horizontally without opening the sidebar.");
  requirePattern(stylesSource, /\.mobile-template-steps\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "Mobile template cards show three compact next-step cells.");
  requirePattern(stylesSource, /\.mobile-template-chips\s*\{[^}]*flex-wrap:\s*wrap/s, "Mobile template upload chips wrap instead of overflowing.");
  requirePattern(stylesSource, /\.mobile-template-cover-badge\s*\{(?=[^}]*position:\s*absolute)(?=[^}]*border-radius:\s*999px)[^}]*\}/s, "Mobile template cover reference badge is anchored over the preview.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-template-preview\s*\{(?=[^}]*border:\s*1px\s+solid\s+rgba\(23,\s*153,\s*129,\s*0\.12\))(?=[^}]*box-shadow:\s*inset\s+0\s+-52px\s+70px)[^}]*\}/s, "Light mobile template preview keeps readable cover depth.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-template-cover-badge\s*\{[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.82\)/s, "Light mobile template cover badge stays bright.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-template-upload\s*\{(?=[^}]*border-color:\s*rgba\(23,\s*153,\s*129,\s*0\.14\))(?=[^}]*linear-gradient\(180deg,\s*rgba\(255,\s*255,\s*255,\s*0\.96\))[^}]*\}/s, "Light mobile template upload guidance reads as a clear next-step card.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-template-steps\s+span\s*\{[^}]*background:\s*rgba\(247,\s*252,\s*249,\s*0\.94\)/s, "Light mobile template step cells stay bright and readable.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-template-applied\s*\{[^}]*display:\s*grid/s, "Mobile template-applied card is visible on phones.");
  requireIncludes(stylesSource, ".mobile-template-next-action", "Mobile template applied card has current-action styles.");
  requireIncludes(stylesSource, ".mobile-template-next-action.state-running", "Mobile template current action has a running state.");
requireIncludes(stylesSource, ".mobile-image-checklist", "Mobile image upload checklist has dedicated styles.");
requireIncludes(stylesSource, ".mobile-image-checklist-grid", "Mobile image upload checklist lays out requirement rows.");
requireIncludes(stylesSource, ".mobile-prompt-checklist", "Mobile prompt package checklist has dedicated styles.");
requireIncludes(stylesSource, ".mobile-product-checklist", "Mobile product info checklist has dedicated styles.");
requireIncludes(stylesSource, ".mobile-submit-check-card", "Mobile submit confirmation card has dedicated styles.");
requirePattern(stylesSource, /\.mobile-submit-check-card\s*\{[^}]*display:\s*none/s, "Mobile submit confirmation card is hidden on desktop.");
requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-submit-check-card\s*\{[^}]*display:\s*grid/s, "Mobile submit confirmation card is visible on phones.");
requirePattern(stylesSource, /\.mobile-submit-check-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "Mobile submit confirmation keeps compact two-column status cells.");
requirePattern(stylesSource, /\.mobile-image-checklist-grid\s+span\.current\s*\{[^}]*box-shadow:/s, "Mobile image checklist highlights the current required image.");
requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-image-checklist\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.9\)/s, "Light mobile image checklist stays bright and readable.");
requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-prompt-checklist\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.9\)/s, "Light mobile prompt checklist stays bright and readable.");
requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-product-checklist\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.9\)/s, "Light mobile product checklist stays bright and readable.");
requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-submit-check-card\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.92\)/s, "Light mobile submit confirmation stays bright and readable.");
requireNotPattern(stylesSource, /\.mobile-template-applied\s*>\s*button\s*\{/s, "Mobile template-applied card no longer styles a removed next-step button.");
  requirePattern(stylesSource, /\.mobile-template-next-steps\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "Mobile template next-step status keeps three compact cells.");
  requirePattern(stylesSource, /\.mobile-template-next-steps\s+span\.current\s*\{[^}]*box-shadow:/s, "Mobile template next-step status highlights the current step.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-template-next-steps\s+span\.done\s*\{[^}]*rgba\(238,\s*250,\s*244,\s*0\.94\)/s, "Light mobile template next-step done cells stay bright.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-template-applied\s*\{[^}]*rgba\(238,\s*250,\s*244,\s*0\.96\)/s, "Light mobile template-applied card stays bright and readable.");
  requirePattern(stylesSource, /\.mobile-action-tile\s*\{[^}]*min-height:\s*(?:11[2-9]|1[2-9]\d|[2-9]\d\d)px/s, "Mobile beginner action tiles keep compact but finger-friendly targets.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.prompt-package-summary\s*\{[^}]*display:\s*grid/s, "Mobile prompt package summary is shown as a simple status card.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.prompt-package-debug\s*\{[^}]*display:\s*none/s, "Mobile prompt package raw JSON is hidden.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.video-log-summary\s*\{[^}]*display:\s*grid/s, "Mobile video logs are summarized as a simple status card.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.video-log-debug\s*\{[^}]*display:\s*none/s, "Mobile raw video logs are hidden.");
  requireIncludes(stylesSource, ".mobile-video-recovery-card", "Mobile video recovery card has dedicated styles.");
  requireIncludes(stylesSource, ".mobile-video-recovery-actions", "Mobile video recovery actions have dedicated styles.");
  requirePattern(stylesSource, /\.mobile-video-recovery-card\s*\{[^}]*display:\s*none/s, "Mobile video recovery card is hidden on desktop.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.mobile-video-recovery-card\s*\{[^}]*display:\s*grid/s, "Mobile video recovery card is visible on phones.");
  requirePattern(stylesSource, /\.mobile-video-recovery-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "Mobile video recovery actions fit in three compact columns.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.mobile-video-recovery-actions\s*\{[^}]*grid-template-columns:\s*1fr/s, "Narrow phones stack recovery actions for readable labels.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.mobile-video-recovery-card\.bad\s*\{[^}]*rgba\(255,\s*247,\s*247,\s*0\.94\)/s, "Light mobile video recovery failure card stays bright.");
  requirePattern(stylesSource, /\.video-wait-stats\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s, "Video wait card shows three compact status cells.");
  requirePattern(stylesSource, /\.video-wait-current-note\s*\{(?=[^}]*min-height:\s*34px)(?=[^}]*font-weight:\s*850)[^}]*\}/s, "Video wait current note is compact and prominent.");
  requirePattern(stylesSource, /:root\[data-theme="light"\]\s+\.video-wait-current-note[\s\S]*?rgba\(247,\s*252,\s*249,\s*0\.92\)/s, "Light video wait current note stays bright.");
  requirePattern(stylesSource, /\.video-wait-phases\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s, "Video wait card shows four desktop phase cells.");
  requirePattern(stylesSource, /\.video-wait-phase\.current\s*\{[^}]*var\(--brand/s, "Video wait current phase has a clear brand highlight.");
  requirePattern(stylesSource, /\.video-wait-card\.overdue\s*\{[^}]*var\(--warning,\s*#f6c756\)/s, "Video wait card has a visible overdue state.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.video-wait-phases[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "Video wait phases stay readable in two columns on narrow phones.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.video-wait-stats[\s\S]*?grid-template-columns:\s*1fr/s, "Video wait stats stack cleanly on narrow phones.");
  requirePattern(stylesSource, /\.app-readiness-tile\s*\{[^}]*min-height:\s*(?:5[6-9]|6\d|7\d|8\d|9\d|1\d\d|[2-9]\d\d)px/s, "Mobile settings App readiness tiles keep compact but usable tap targets.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.app-readiness-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s, "Mobile settings App readiness center uses four compact quick entries.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.app-readiness-tile\s*\{(?=[^}]*grid-template-columns:\s*1fr)(?=[^}]*min-height:\s*58px)(?=[^}]*padding:\s*7px\s+4px)[^}]*\}/s, "Mobile settings App readiness tiles use compact icon shortcuts.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.app-readiness-copy\s+strong\s*\{(?=[^}]*text-overflow:\s*ellipsis)(?=[^}]*white-space:\s*nowrap)(?=[^}]*word-break:\s*keep-all)[^}]*\}/s, "Mobile settings App readiness titles stay readable on one line.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.app-readiness-copy\s+small\s*\{[^}]*display:\s*none/s, "Mobile settings App readiness descriptions are hidden to reduce page height.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.settings-mobile-collapsible:not\(\.open\)\s+\.settings-mobile-collapsible-body\s*\{[^}]*display:\s*none/s, "Mobile settings long sections are hidden until expanded.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.pilot-feedback-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "Mobile pilot feedback keeps short selectors in two columns.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.pilot-feedback-message\s+textarea\s*\{[^}]*min-height:\s*86px/s, "Mobile pilot feedback textarea is compact.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.pilot-feedback-list\s*\{[^}]*max-height:\s*120px/s, "Mobile pilot feedback history is scroll-capped.");
  requirePattern(stylesSource, /\.mobile-action-icon\s*\{[^}]*width:\s*(?:5[2-9]|[6-9]\d)px;[^}]*height:\s*(?:5[2-9]|[6-9]\d)px;[^}]*border-radius:\s*999px/s, "Mobile beginner action icons use clear circular badges.");
  requirePattern(stylesSource, /\.mobile-mode-switch button\s*\{[^}]*min-height:\s*(?:4[4-9]|[5-9]\d)px/s, "Mobile content segment buttons keep at least 44px touch height.");
  requirePattern(stylesSource, /\.mobile-mode-switch button\.active\s*\{[^}]*background:\s*linear-gradient/s, "Mobile active segment uses a high-visibility gradient.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.final-prompt-actions\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(58px,\s*0\.72fr\)[^}]*minmax\(126px,\s*1\.36fr\)/s, "Mobile final prompt actions use weighted columns for short and long labels.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.final-prompt-actions\s+\.secondary-button\s+span\s*\{[^}]*white-space:\s*normal;[^}]*word-break:\s*keep-all/s, "Mobile final prompt action labels avoid one-character wrapping.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.mobile-input-tabs\s+em\s*\{(?=[^}]*max-width:\s*72px)(?=[^}]*text-overflow:\s*ellipsis)[^}]*\}/s, "Mobile input step status avoids right-edge clipping.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.mobile-input-section-prompt\s+\.file-picker-status\s*\{(?=[^}]*text-overflow:\s*ellipsis)(?=[^}]*white-space:\s*nowrap)[^}]*\}/s, "Mobile prompt package filename stays inside the upload row.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.mobile-input-section-prompt\s+textarea\s*\{(?=[^}]*overflow-x:\s*hidden)(?=[^}]*overflow-wrap:\s*anywhere)[^}]*\}/s, "Mobile prompt package textarea wraps long content inside the screen.");
  requirePattern(stylesSource, /\.pwa-install-banner\s*\{[^}]*order:\s*0;/s, "Mobile install prompt stays in the first viewport before the beginner entry.");
  requirePattern(stylesSource, /\.assets-panel\s+\.assets-table\s*\{\s*display:\s*none;/s, "Mobile hides desktop asset table");
  requirePattern(stylesSource, /\.assets-panel\s+\.task-source-links-panel\s*\{\s*display:\s*none;/s, "Mobile hides duplicate desktop source-link panel");
  requirePattern(stylesSource, /\.mobile-batch-item-progress-head\s*\{(?=[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto)(?=[^}]*min-height:\s*28px)[^}]*\}/s, "Mobile batch item progress note has a compact status row.");
  requirePattern(stylesSource, /\.mobile-batch-item-progress-head\s+strong\s*\{[^}]*font-weight:\s*900/s, "Mobile batch item progress percent is prominent.");
  requirePattern(stylesSource, /\.mobile-batch-item-meta\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "Mobile batch item meta stays in a compact two-column card grid.");
  requirePattern(stylesSource, /\.task-board-table,\s*\.libtv-table\s*\{\s*display:\s*none;/s, "Mobile hides task/libTV desktop tables");
  requirePattern(stylesSource, /\.stitch-table-wrap\s*\{\s*display:\s*none;/s, "Mobile hides desktop stitch table");
  requirePattern(stylesSource, /\.main\s*\{[^}]*padding-bottom:\s*calc\((?:7[6-9]|8\d|9\d|1\d\d)px \+ env\(safe-area-inset-bottom\)\)/s, "Main content leaves room for the compact mobile bottom nav");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.overview-status-grid,\s*\.batch-stats\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "Small phones keep overview status cards in a compact two-column grid.");
  requirePattern(stylesSource, /@media\s*\(max-width:\s*560px\)[\s\S]*?\.overview-status-card\s*\{[^}]*min-height:\s*(?:8\d|9\d|10\d|11\d)px/s, "Small phones use shorter overview status cards.");

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
