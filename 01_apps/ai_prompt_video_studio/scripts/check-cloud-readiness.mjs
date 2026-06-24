import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const strict = process.argv.includes("--strict");
const root = process.cwd();
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");
const serverPath = path.join(root, "server.js");
const packageJsonPath = path.join(root, "package.json");

const blockers = [];
const warnings = [];
const passes = [];

function parseEnv(text) {
  const data = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 1) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data.set(key, value);
  }
  return data;
}

async function readEnvFile(filePath) {
  try {
    return parseEnv(await readFile(filePath, "utf8"));
  } catch {
    return new Map();
  }
}

async function readText(relativePath) {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch {
    return "";
  }
}

function valueOf(env, key) {
  return String(env.get(key) || "").trim();
}

function hasValue(env, key) {
  const value = valueOf(env, key);
  return Boolean(value) && !/^change-?me$/i.test(value) && !/^todo$/i.test(value);
}

function boolValue(env, key, fallback = false) {
  const value = valueOf(env, key).toLowerCase();
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  return fallback;
}

function numberValue(env, key, fallback = null) {
  const rawValue = valueOf(env, key);
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : fallback;
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw || raw === "*" || raw === "null") return raw;
  try {
    const url = new URL(raw);
    if (url.protocol && url.host) return `${url.protocol}//${url.host}`;
    if (url.origin && url.origin !== "null") return url.origin;
  } catch {
    return raw;
  }
  return raw;
}

function parseOriginList(value) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

function isLocalOrigin(value) {
  try {
    const url = new URL(normalizeOrigin(value));
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isSecurePublicOrigin(value) {
  const origin = normalizeOrigin(value);
  if (!origin || origin === "*") return false;
  if (isLocalOrigin(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" || url.protocol === "capacitor:" || url.protocol === "ionic:";
  } catch {
    return false;
  }
}

function isWindowsPath(value) {
  return /^[a-z]:\\/i.test(value);
}

function addPass(message) {
  passes.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

function addBlocker(message) {
  blockers.push(message);
}

function requireMarker(source, marker, label, { severity = "blocker" } = {}) {
  if (source.includes(marker)) {
    addPass(label);
    return;
  }
  if (severity === "warning") addWarning(`${label}: missing marker "${marker}".`);
  else addBlocker(`${label}: missing marker "${marker}".`);
}

async function fileExists(relativePath) {
  try {
    const info = await stat(path.join(root, relativePath));
    return info.isFile();
  } catch {
    return false;
  }
}

async function collectSourceFiles(dir) {
  const absolute = path.join(root, dir);
  const entries = await readdir(absolute, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectSourceFiles(relative));
    } else if (/\.(js|jsx|ts|tsx|html|css)$/.test(entry.name)) {
      files.push(relative);
    }
  }
  return files;
}

function extractServerEnvNames(source) {
  return [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)]
    .map((match) => match[1])
    .filter((name, index, names) => names.indexOf(name) === index)
    .sort();
}

const env = await readEnvFile(envPath);
const example = await readEnvFile(examplePath);
const serverSource = existsSync(serverPath) ? await readFile(serverPath, "utf8") : "";
const packageSource = existsSync(packageJsonPath) ? await readFile(packageJsonPath, "utf8") : "";
const serverEnvNames = extractServerEnvNames(serverSource);

if (!existsSync(envPath)) {
  addBlocker(".env is missing. Public deployments need server-side environment variables, not frontend secrets.");
} else {
  addPass(".env exists.");
}

if (!existsSync(examplePath)) {
  addWarning(".env.example is missing, so deployment handoff is harder.");
} else {
  const ignoredExampleNames = new Set(["NODE_ENV"]);
  const missingExampleNames = serverEnvNames.filter((name) => !ignoredExampleNames.has(name) && !example.has(name));
  if (missingExampleNames.length) {
    addWarning(`.env.example is missing server variables: ${missingExampleNames.join(", ")}.`);
  } else {
    addPass(".env.example covers server-side environment variables.");
  }
}

if (await fileExists("deploy/production.env.example")) {
  addPass("Production deployment environment template is present.");
  const productionTemplate = await readText("deploy/production.env.example");
  for (const marker of ["SMOKE_BASE_URL", "SMOKE_USERNAME", "SMOKE_EXPECT_AUTH_REQUIRED"]) {
    if (productionTemplate.includes(marker)) addPass(`Production deployment template documents ${marker}.`);
    else addWarning(`Production deployment template should document ${marker} for post-deploy smoke tests.`);
  }
} else {
  addWarning("Add deploy/production.env.example so production CORS, cookie, storage, and worker settings are explicit.");
}

if (await fileExists("scripts/production-smoke-test.mjs")) {
  addPass("Production smoke test script is present.");
} else {
  addWarning("Add scripts/production-smoke-test.mjs so public deployments can be verified after release.");
}

if (packageSource.includes('"cloud:smoke"')) {
  addPass("npm script cloud:smoke is defined.");
} else {
  addWarning("package.json should define npm run cloud:smoke for post-deployment verification.");
}

const deploymentPlanPath = "deploy/cloud-deployment-action-plan.json";
const deploymentPlanText = await readText(deploymentPlanPath);
let deploymentPlan = null;

if (!deploymentPlanText) {
  addWarning(`${deploymentPlanPath} is missing. Cloud warnings should be tracked in a deployment action plan.`);
} else {
  try {
    deploymentPlan = JSON.parse(deploymentPlanText);
    addPass("Cloud deployment action plan is valid JSON.");
  } catch (error) {
    addBlocker(`Cloud deployment action plan is invalid JSON: ${error.message}`);
  }
}

if (deploymentPlan) {
  if (deploymentPlan.schemaVersion !== "cloud-deployment-action-plan-v1") {
    addBlocker("Cloud deployment action plan schemaVersion is not cloud-deployment-action-plan-v1.");
  } else {
    addPass("Cloud deployment action plan schema version is current.");
  }

  const workstreams = Array.isArray(deploymentPlan.workstreams) ? deploymentPlan.workstreams : [];
  if (workstreams.length >= 7) {
    addPass("Cloud deployment action plan covers core deployment workstreams.");
  } else {
    addWarning("Cloud deployment action plan should cover CORS, cookies, storage, libTV, execution switches, secrets, and observability.");
  }

  const requiredWorkstreams = [
    "public-origin-cors",
    "auth-cookie-hardening",
    "persistent-storage",
    "libtv-worker-service",
    "text-image-canvas-storage",
    "production-execution-switches",
    "provider-secrets",
    "observability-and-rollback"
  ];
  const workstreamIds = new Set(workstreams.map((item) => item.id));
  for (const id of requiredWorkstreams) {
    if (workstreamIds.has(id)) addPass(`Cloud deployment action plan includes ${id}.`);
    else addWarning(`Cloud deployment action plan is missing ${id}.`);
  }

  for (const workstream of workstreams) {
    const label = workstream.id || workstream.title || "Unnamed cloud workstream";
    if (workstream.id && workstream.title && workstream.owner && workstream.status) {
      addPass(`Cloud workstream ${label} has owner and status.`);
    } else {
      addWarning(`Cloud workstream ${label} is missing id, title, owner, or status.`);
    }
    if (Array.isArray(workstream.warningMappings) && workstream.warningMappings.length) {
      addPass(`Cloud workstream ${label} maps to cloud check warnings.`);
    } else {
      addWarning(`Cloud workstream ${label} should map to cloud check warnings.`);
    }
    if (Array.isArray(workstream.evidence) && workstream.evidence.length) {
      addPass(`Cloud workstream ${label} declares verification evidence.`);
    } else {
      addWarning(`Cloud workstream ${label} should declare verification evidence.`);
    }
    if (workstream.id === "observability-and-rollback") {
      const evidenceText = [...(workstream.evidence || []), ...(workstream.nextActions || []), ...(workstream.productionValues || [])].join("\n");
      if (evidenceText.includes("cloud:smoke")) {
        addPass("Observability workstream includes production smoke test evidence.");
      } else {
        addWarning("Observability workstream should include npm run cloud:smoke as release evidence.");
      }
    }
  }
}

const runbookPath = deploymentPlan?.runbook || "deploy/production-release-runbook.md";
const runbookText = await readText(runbookPath);

if (!runbookText) {
  addWarning(`${runbookPath} is missing. Production handoff should include a deployment runbook.`);
} else {
  addPass("Production release runbook is present.");
  for (const [marker, label] of [
    ["# 生产发布运行手册", "Production runbook has title."],
    ["## 1. 目标架构", "Production runbook documents target architecture."],
    ["阶段 1：配置生产环境变量", "Production runbook documents environment variable setup."],
    ["CONSOLE_AUTH_COOKIE_SECURE=true", "Production runbook documents Secure cookies."],
    ["CORS_ALLOWED_ORIGINS", "Production runbook documents CORS allowlist."],
    ["RUN_STORAGE_DIR", "Production runbook documents persistent storage."],
    ["阶段 3：迁移 libTV worker", "Production runbook documents libTV worker migration."],
    ["npm run cloud:smoke", "Production runbook documents post-deploy smoke test."],
    ["npm run capacitor:sync", "Production runbook documents native sync before packaging."],
    ["## 3. 回滚预案", "Production runbook documents rollback plan."],
    ["## 4. 发布后监控", "Production runbook documents post-release monitoring."],
    ["https://capacitorjs.com/docs/config", "Production runbook links Capacitor configuration basis."],
    ["https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie", "Production runbook links cookie basis."],
    ["https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Origin", "Production runbook links CORS basis."],
    ["https://developer.apple.com/app-store/review/guidelines/", "Production runbook links Apple review basis."],
    ["https://support.google.com/googleplay/android-developer/answer/10144311", "Production runbook links Google user data basis."]
  ]) {
    requireMarker(runbookText, marker, label);
  }
}

if (!(await fileExists("server.js"))) {
  addBlocker("server.js is missing.");
} else {
  addPass("server.js exists.");
  if (serverSource.includes('"/api/healthz"')) {
    addPass("Public health check endpoint is present.");
  } else {
    addWarning("Add a public GET /api/healthz endpoint for load balancers and hosting health checks.");
  }
  if (serverSource.includes('"access-control-allow-origin": "*"')) {
    addWarning("server.js still contains a wildcard CORS origin. Use a configured origin allowlist before public release.");
  } else if (serverSource.includes("CORS_ALLOWED_ORIGINS") && serverSource.includes("corsHeadersFor")) {
    addPass("CORS origin handling is configurable.");
  }
  if (serverSource.includes("CONSOLE_AUTH_COOKIE_SECURE") && serverSource.includes("SameSite=${config.authCookieSameSite}")) {
    addPass("Auth cookie Secure and SameSite attributes are configurable.");
  }
  if (/function\s+authSchemaRequiredFor\s*\([\s\S]*?\/api\/auth\/session[\s\S]*?return\s+true/.test(serverSource)) {
    addBlocker("/api/auth/session should not require auth schema initialization.");
  } else if (serverSource.includes("function authSchemaRequiredFor") && serverSource.includes("authSchemaRequiredFor(url.pathname)")) {
    addPass("Public auth session endpoint is decoupled from auth schema initialization.");
  } else {
    addWarning("Add an authSchemaRequiredFor guard so /api/auth/session remains lightweight for probes and previews.");
  }
  if (serverSource.includes("IMAGE_OUTPUT_DIR") && serverSource.includes("text_image_canvas_nodes")) {
    addPass("Text-image canvas feature stores generated images and canvas nodes.");
    if (deploymentPlan) {
      const textImageWorkstream = (deploymentPlan.workstreams || []).find((item) => item.id === "text-image-canvas-storage");
      if (textImageWorkstream) {
        addPass("Cloud deployment action plan includes text-image-canvas-storage.");
        const workstreamText = JSON.stringify(textImageWorkstream);
        for (const marker of ["TEXT_IMAGE_STORAGE_MODE", "TEXT_IMAGE_BUCKET", "text_image_canvas_nodes", "video_task_source_links", "textImageCanvasNodeId"]) {
          if (workstreamText.includes(marker)) addPass(`Text-image cloud workstream documents ${marker}.`);
          else addWarning(`Text-image cloud workstream should document ${marker}.`);
        }
      } else {
        addWarning("Cloud deployment action plan should include text-image-canvas-storage for generated image outputs and canvas nodes.");
      }
    }
    if (runbookText) {
      for (const marker of ["text-image", "text_image_canvas_nodes", "video_task_source_links", "TEXT_IMAGE_STORAGE_MODE"]) {
        if (runbookText.includes(marker)) addPass(`Production runbook documents text-image marker ${marker}.`);
        else addWarning(`Production runbook should document text-image marker ${marker}.`);
      }
    }
  }
}

if (boolValue(env, "CONSOLE_AUTH_REQUIRED", true)) {
  addPass("Console auth is enabled.");
  if (!hasValue(env, "CONSOLE_AUTH_PASSWORD") && !hasValue(env, "CONSOLE_AUTH_PASSWORD_SHA256")) {
    addBlocker("CONSOLE_AUTH_PASSWORD or CONSOLE_AUTH_PASSWORD_SHA256 must be set before public access.");
  } else {
    addPass("Console auth password is configured.");
  }
} else {
  addBlocker("CONSOLE_AUTH_REQUIRED is disabled. Public access should keep login protection enabled.");
}

if (boolValue(env, "CONSOLE_AUTH_ALLOW_REGISTRATION", false)) {
  addWarning("CONSOLE_AUTH_ALLOW_REGISTRATION is enabled. Keep it disabled for the first public release unless invite flow is ready.");
} else {
  addPass("Open registration is disabled.");
}

const sessionHours = numberValue(env, "CONSOLE_AUTH_SESSION_HOURS", 24);
if (sessionHours > 24 * 7) {
  addWarning("CONSOLE_AUTH_SESSION_HOURS is longer than 7 days. Consider a shorter session for public access.");
}

const nodeEnv = valueOf(env, "NODE_ENV").toLowerCase();
const productionEnv = nodeEnv === "production";
const cookieSecure = boolValue(env, "CONSOLE_AUTH_COOKIE_SECURE", productionEnv);
const cookieSameSite = (valueOf(env, "CONSOLE_AUTH_COOKIE_SAMESITE") || valueOf(example, "CONSOLE_AUTH_COOKIE_SAMESITE") || "Lax").toLowerCase();
if (productionEnv && !cookieSecure) {
  addBlocker("CONSOLE_AUTH_COOKIE_SECURE must be true when NODE_ENV=production.");
} else if (!cookieSecure) {
  addWarning("CONSOLE_AUTH_COOKIE_SECURE is not enabled. Public HTTPS deployments should set Secure cookies.");
} else {
  addPass("Auth cookie Secure flag is enabled or production-defaulted.");
}
if (!["lax", "strict", "none"].includes(cookieSameSite)) {
  addWarning("CONSOLE_AUTH_COOKIE_SAMESITE should be Lax, Strict, or None.");
} else {
  addPass("Auth cookie SameSite value is valid.");
}
if (cookieSameSite === "none" && !cookieSecure) {
  addBlocker("CONSOLE_AUTH_COOKIE_SAMESITE=None requires CONSOLE_AUTH_COOKIE_SECURE=true.");
}

for (const key of ["QIANWEN_API_KEY", "QIANWEN_VL_API_KEY", "ARK_API_KEY"]) {
  if (!hasValue(env, key)) {
    addBlocker(`${key} is missing. AI analysis, vision, or video generation will not be production-ready.`);
  } else {
    addPass(`${key} is configured.`);
  }
}

for (const key of ["QIANWEN_BASE_URL", "DOUBAO_SEED_PRO_API_URL", "SEEDANCE_API_URL", "SEEDREAM_API_URL"]) {
  const value = valueOf(env, key) || valueOf(example, key);
  if (value && !isHttpsUrl(value)) {
    addWarning(`${key} should use HTTPS for public deployment.`);
  }
}

const port = numberValue(env, "PORT", numberValue(example, "PORT", 0));
if (!port || port < 1 || port > 65535) {
  addWarning("PORT is missing or invalid.");
} else {
  addPass("PORT is valid.");
}

const publicOrigin = valueOf(env, "PUBLIC_APP_ORIGIN");
const corsOrigins = parseOriginList(valueOf(env, "CORS_ALLOWED_ORIGINS") || publicOrigin);
const corsCredentials = boolValue(env, "CORS_ALLOW_CREDENTIALS", true);
if (!publicOrigin && !valueOf(env, "CORS_ALLOWED_ORIGINS")) {
  addWarning("PUBLIC_APP_ORIGIN or CORS_ALLOWED_ORIGINS is not set. Public deployments should pin allowed browser/App origins.");
} else if (!corsOrigins.length) {
  addWarning("CORS_ALLOWED_ORIGINS is set but no valid origins were parsed.");
} else {
  addPass("CORS allowed origins are configured.");
}
if (corsOrigins.includes("*")) {
  addWarning("CORS_ALLOWED_ORIGINS includes *. Do not use wildcard origins for authenticated public access.");
  if (corsCredentials) addWarning("CORS_ALLOW_CREDENTIALS is true while wildcard origins are allowed; browsers will reject credentialed wildcard CORS.");
}
for (const origin of corsOrigins.filter((item) => item !== "*")) {
  if (!isSecurePublicOrigin(origin)) {
    const message = `${origin} is not an HTTPS, Capacitor, Ionic, or localhost origin.`;
    if (productionEnv) addBlocker(message);
    else addWarning(message);
  }
}
if (boolValue(env, "CORS_ALLOW_LOCALHOST", !productionEnv) && productionEnv) {
  addWarning("CORS_ALLOW_LOCALHOST is enabled in production. Disable it after device testing.");
}

const bridgeUrl = valueOf(env, "LIBTV_BRIDGE_URL") || valueOf(example, "LIBTV_BRIDGE_URL");
if (bridgeUrl && isLocalUrl(bridgeUrl)) {
  addWarning("LIBTV_BRIDGE_URL points to localhost. Cloud deployment should move libTV to a worker service or private network endpoint.");
}

for (const key of ["LIBTV_REGISTER_SCRIPT", "LIBTV_DB_PATH"]) {
  const value = valueOf(env, key) || valueOf(example, key);
  if (isWindowsPath(value)) {
    addWarning(`${key} is a Windows local path. Replace it with a cloud worker path, managed DB, or mounted volume before public deployment.`);
  }
}

if (!hasValue(env, "RUN_STORAGE_DIR")) {
  addWarning("RUN_STORAGE_DIR is not set. The server will use local runs storage; public deployments need a mounted volume or object storage migration.");
}

if (boolValue(env, "LIBTV_DEFAULT_DRY_RUN", true)) {
  addWarning("LIBTV_DEFAULT_DRY_RUN is true. Real video task execution should be explicitly enabled in production.");
}

const workers = numberValue(env, "BATCH_MAX_WORKERS", numberValue(example, "BATCH_MAX_WORKERS", 20));
if (workers > 5) {
  addWarning("BATCH_MAX_WORKERS is above 5. Keep the first public release conservative until queue limits and billing are ready.");
}

const timeoutMs = numberValue(env, "MODEL_REQUEST_TIMEOUT_MS", numberValue(example, "MODEL_REQUEST_TIMEOUT_MS", 360000));
if (timeoutMs < 60000 || timeoutMs > 900000) {
  addWarning("MODEL_REQUEST_TIMEOUT_MS should stay between 60000 and 900000.");
}

const frontendFiles = [
  ...await collectSourceFiles("src"),
  ...await collectSourceFiles("public")
];
const secretNamePattern = /\b(QIANWEN_API_KEY|QIANWEN_VL_API_KEY|ARK_API_KEY|CONSOLE_AUTH_PASSWORD|CONSOLE_AUTH_PASSWORD_SHA256)\b/;
const frontendSecretNameHits = [];

for (const relative of frontendFiles) {
  const source = await readFile(path.join(root, relative), "utf8").catch(() => "");
  if (secretNamePattern.test(source)) frontendSecretNameHits.push(relative.replaceAll(path.sep, "/"));
}

if (frontendSecretNameHits.length) {
  addWarning(`Frontend files mention private environment names: ${frontendSecretNameHits.join(", ")}. Confirm no real secrets are bundled.`);
} else {
  addPass("Frontend source does not mention private server secret names.");
}

console.log("Cloud readiness audit");
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

if (!blockers.length && !warnings.length) {
  console.log("\nNo cloud readiness issues found.");
} else if (!strict) {
  console.log("\nAudit mode: exiting successfully. Use --strict to fail when blockers exist.");
}

if (strict && blockers.length) process.exit(1);
