import { createServer } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { appendFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { inflateRawSync } from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const WORKFLOW_DIR = path.resolve(ROOT, "..", "..");
const DIST_DIR = path.join(ROOT, "dist");
const PUBLIC_DIR = existsSync(DIST_DIR) ? DIST_DIR : path.join(ROOT, "public");
const OUTPUT_DIR = path.join(WORKFLOW_DIR, "outputs", "libtv");
const STITCH_OUTPUT_DIR = path.join(WORKFLOW_DIR, "outputs", "stitched");
const IMAGE_OUTPUT_DIR = path.join(WORKFLOW_DIR, "outputs", "text-to-image");
const DEFAULT_IMAGE_GENERATION_SIZE = "1920x1920";
const IMAGE_GENERATION_MIN_PIXELS = 1920 * 1920;
const MAX_BODY_BYTES = 80 * 1024 * 1024;
const MAX_REMOTE_VIDEO_BYTES = 250 * 1024 * 1024;

loadDotEnv(path.join(ROOT, ".env"));

const config = {
  port: Number(process.env.PORT || 8899),
  nodeEnv: process.env.NODE_ENV || "development",
  qianwenBaseUrl: process.env.QIANWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
  qianwenKey: process.env.QIANWEN_API_KEY || "",
  qianwenModel: process.env.QIANWEN_MODEL || "qwen3.6-plus",
  qianwenVlKey: process.env.QIANWEN_VL_API_KEY || "",
  qianwenVlModel: process.env.QIANWEN_VL_MODEL || "qwen3-vl-flash",
  arkKey: process.env.ARK_API_KEY || "",
  seedanceUrl: process.env.SEEDANCE_API_URL || "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks",
  seedanceModel: process.env.SEEDANCE_MODEL || "doubao-seedance-2-0-fast-260128",
  doubaoUrl: process.env.DOUBAO_SEED_PRO_API_URL || "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  doubaoModel: process.env.DOUBAO_SEED_PRO_MODEL || "doubao-seed-2-0-pro-260215",
  analysisModelOptions: parseModelOptions(process.env.ANALYSIS_MODEL_OPTIONS, [
    process.env.QIANWEN_MODEL || "qwen3.6-plus",
    process.env.DOUBAO_SEED_PRO_MODEL || "doubao-seed-2-0-pro-260215"
  ]),
  visionModelOptions: parseModelOptions(process.env.VISION_MODEL_OPTIONS, [
    process.env.QIANWEN_VL_MODEL || "qwen3-vl-flash",
    "qwen3-vl-plus",
    "qwen3-vl-flash-2025-10-15",
    "qwen3-vl-plus-2025-09-23",
    "qwen3-vl-235b-a22b-instruct",
    "qwen3-vl-235b-a22b-thinking"
  ]),
  videoModelOptions: parseModelOptions(process.env.VIDEO_MODEL_OPTIONS, [
    process.env.SEEDANCE_MODEL || "doubao-seedance-2-0-fast-260128"
  ]),
  imageGenerationUrl: process.env.SEEDREAM_API_URL || "https://ark.cn-beijing.volces.com/api/v3/images/generations",
  imageGenerationModel: process.env.SEEDREAM_MODEL || "doubao-seedream-4-5-251128",
  imageGenerationModelOptions: parseModelOptions(process.env.IMAGE_GENERATION_MODEL_OPTIONS, [
    process.env.SEEDREAM_MODEL || "doubao-seedream-4-5-251128"
  ]),
  libtvBridgeUrl: process.env.LIBTV_BRIDGE_URL || "http://127.0.0.1:8799",
  libtvRegisterScript:
    process.env.LIBTV_REGISTER_SCRIPT || path.join(WORKFLOW_DIR, "libtv_runner", "register_task_input.py"),
  libtvDbPath:
    process.env.LIBTV_DB_PATH ||
    path.join(WORKFLOW_DIR, "03_database", "ai_database", "ai_product.sqlite"),
  runStorageDir: process.env.RUN_STORAGE_DIR || path.join(ROOT, "runs"),
  pythonExe: process.env.PYTHON_EXE || "py",
  ffmpegExe: process.env.FFMPEG_EXE || "ffmpeg",
  libtvDefaultDryRun: coerceBool(process.env.LIBTV_DEFAULT_DRY_RUN, true),
  libtvEnableSound: coerceBool(process.env.LIBTV_ENABLE_SOUND, true),
  libtvAutoCompliance: coerceBool(process.env.LIBTV_AUTO_COMPLIANCE, true),
  libtvSearchEnabled: coerceBool(process.env.LIBTV_SEARCH_ENABLED, true),
  libtvSharedProjectUuid: process.env.LIBTV_SHARED_PROJECT_UUID || "",
  libtvSharedProjectName: process.env.LIBTV_SHARED_PROJECT_NAME || "AI视频工作台",
  batchMaxWorkers: boundedNumber(process.env.BATCH_MAX_WORKERS, 20, 1, 30),
  modelRequestTimeoutMs: boundedNumber(process.env.MODEL_REQUEST_TIMEOUT_MS, 360000, 60000, 900000),
  authRequired: coerceBool(process.env.CONSOLE_AUTH_REQUIRED, true),
  authUser: process.env.CONSOLE_AUTH_USER || "",
  authPassword: process.env.CONSOLE_AUTH_PASSWORD || "",
  authPasswordSha256: process.env.CONSOLE_AUTH_PASSWORD_SHA256 || "",
  authSessionHours: boundedNumber(process.env.CONSOLE_AUTH_SESSION_HOURS, 24, 1, 24 * 30),
  authAllowRegistration: coerceBool(process.env.CONSOLE_AUTH_ALLOW_REGISTRATION, false),
  publicAppOrigin: process.env.PUBLIC_APP_ORIGIN || "",
  corsAllowedOrigins: parseOriginList(process.env.CORS_ALLOWED_ORIGINS || process.env.PUBLIC_APP_ORIGIN || ""),
  corsAllowCredentials: coerceBool(process.env.CORS_ALLOW_CREDENTIALS, true),
  corsAllowLocalhost: coerceBool(process.env.CORS_ALLOW_LOCALHOST, process.env.NODE_ENV !== "production"),
  authCookieSecure: coerceBool(process.env.CONSOLE_AUTH_COOKIE_SECURE, process.env.NODE_ENV === "production"),
  authCookieSameSite: normalizeSameSite(process.env.CONSOLE_AUTH_COOKIE_SAMESITE || "Lax")
};

const runs = new Map();
const sessions = new Map();
const activeBatchItemRuns = new Map();
const requestContext = new AsyncLocalStorage();
let batchProcessorScheduled = false;
let batchSchemaReadyPromise = null;
let selectionAssetSchemaReadyPromise = null;
let authSchemaReadyPromise = null;
let textImageCanvasSchemaReadyPromise = null;
let videoTaskSourceLinkSchemaReadyPromise = null;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4"
};

const baseCorsHeaders = {
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "600"
};

function normalizeSameSite(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "none") return "None";
  if (normalized === "strict") return "Strict";
  return "Lax";
}

function normalizeAllowedOrigin(value) {
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
    .map((origin) => normalizeAllowedOrigin(origin))
    .filter(Boolean)
    .filter((origin, index, origins) => origins.indexOf(origin) === index);
}

function isLocalAllowedOrigin(origin) {
  const normalized = normalizeAllowedOrigin(origin);
  try {
    const url = new URL(normalized);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function corsHeadersFor(req = requestContext.getStore()?.req) {
  const headers = { ...baseCorsHeaders };
  const origin = normalizeAllowedOrigin(req?.headers?.origin || "");
  if (!origin || origin === "null") return headers;

  const allowedOrigins = config.corsAllowedOrigins;
  const isAllowed = allowedOrigins.includes("*")
    || allowedOrigins.includes(origin)
    || (config.corsAllowLocalhost && isLocalAllowedOrigin(origin));

  if (!isAllowed) return headers;

  headers["access-control-allow-origin"] = allowedOrigins.includes("*") ? "*" : origin;
  headers.vary = "Origin";
  if (headers["access-control-allow-origin"] !== "*" && config.corsAllowCredentials) {
    headers["access-control-allow-credentials"] = "true";
  }
  return headers;
}

class RunCancelledError extends Error {
  constructor(message = "任务已中断。") {
    super(message);
    this.name = "RunCancelledError";
  }
}

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function coerceBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "y", "on"].includes(String(value).trim().toLowerCase());
}

function parseModelOptions(value, fallbacks = []) {
  const source = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([...fallbacks, ...source].filter(Boolean))];
}

function jsonResponse(res, statusCode, data, extraHeaders = {}) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    ...corsHeadersFor(),
    ...extraHeaders,
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function textResponse(res, statusCode, text) {
  res.writeHead(statusCode, { ...corsHeadersFor(), "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

const authCookieName = "aiugc_session";

function hashText(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function safeEqualText(left, right) {
  const a = Buffer.from(String(left || ""), "utf8");
  const b = Buffer.from(String(right || ""), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function authConfigured() {
  return Boolean(config.authUser && (config.authPassword || config.authPasswordSha256));
}

function passwordMatches(password) {
  if (config.authPasswordSha256) {
    return safeEqualText(hashText(password), config.authPasswordSha256);
  }
  return safeEqualText(String(password || ""), config.authPassword);
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const index = entry.indexOf("=");
      if (index > 0) {
        cookies[decodeURIComponent(entry.slice(0, index))] = decodeURIComponent(entry.slice(index + 1));
      }
      return cookies;
    }, {});
}

function getSession(req) {
  const token = parseCookies(req)[authCookieName];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function makeSessionCookie(token, maxAgeSeconds) {
  const attributes = [
    "HttpOnly",
    `SameSite=${config.authCookieSameSite}`,
    "Path=/",
    `Max-Age=${maxAgeSeconds}`
  ];
  if (config.authCookieSecure) attributes.push("Secure");
  return `${authCookieName}=${encodeURIComponent(token)}; ${attributes.join("; ")}`;
}

function clearSessionCookie() {
  const attributes = [
    "HttpOnly",
    `SameSite=${config.authCookieSameSite}`,
    "Path=/",
    "Max-Age=0"
  ];
  if (config.authCookieSecure) attributes.push("Secure");
  return `${authCookieName}=; ${attributes.join("; ")}`;
}

function publicApiPath(pathname) {
  return pathname === "/api/healthz"
    || pathname === "/api/auth/session"
    || pathname === "/api/auth/login"
    || pathname === "/api/auth/register"
    || pathname === "/api/auth/logout";
}

function authRequiredFor(pathname) {
  return config.authRequired && pathname.startsWith("/api/") && !publicApiPath(pathname);
}

function authSchemaRequiredFor(pathname) {
  if (pathname === "/api/auth/login" || pathname === "/api/auth/register") return true;
  if (pathname === "/api/account/export") return true;
  return authRequiredFor(pathname);
}

function defaultOwnerUserId() {
  const username = String(config.authUser || "zkr").trim().toLowerCase() || "zkr";
  return `user-${hashText(username).slice(0, 16)}`;
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validateUsername(username) {
  const value = normalizeUsername(username);
  if (value.length < 2 || value.length > 40) throw new Error("账号长度需要在 2-40 个字符之间。");
  if (!/^[a-z0-9_.@-]+$/i.test(value)) throw new Error("账号只能使用英文、数字、下划线、横线、点或 @。");
  return value;
}

function validatePassword(password) {
  const value = String(password || "");
  if (value.length < 6) throw new Error("密码至少需要 6 位。");
  if (value.length > 120) throw new Error("密码太长，请控制在 120 位以内。");
  return value;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password || ""), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
  const stored = String(storedHash || "");
  const parts = stored.split("$");
  if (parts[0] === "scrypt" && parts[1] && parts[2]) {
    return safeEqualText(scryptSync(String(password || ""), parts[1], 64).toString("hex"), parts[2]);
  }
  if (/^[a-f0-9]{64}$/i.test(stored)) return safeEqualText(hashText(password), stored);
  return safeEqualText(String(password || ""), stored);
}

async function ensureAuthSchema() {
  if (authSchemaReadyPromise) return authSchemaReadyPromise;
  authSchemaReadyPromise = (async () => {
    const defaultUsername = normalizeUsername(config.authUser || "zkr");
    const defaultHash = config.authPasswordSha256
      ? config.authPasswordSha256
      : config.authPassword
        ? hashPassword(config.authPassword)
        : "";
    const script = `
import json
import sqlite3
import sys
from datetime import datetime

db_path = sys.argv[1]
default_user_id = sys.argv[2]
default_username = sys.argv[3]
default_password_hash = sys.argv[4]
con = sqlite3.connect(db_path, timeout=180)
con.execute("PRAGMA busy_timeout=180000")
con.execute("PRAGMA foreign_keys=ON")
con.executescript("""
CREATE TABLE IF NOT EXISTS console_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_console_users_username ON console_users(username);
""")
tables = ["products", "video_tasks", "product_assets", "batch_jobs", "selection_products", "account_assets"]
existing_tables = {row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
for table in tables:
    if table not in existing_tables:
        continue
    columns = {row[1] for row in con.execute(f"PRAGMA table_info({table})")}
    if "owner_user_id" not in columns:
        con.execute(f"ALTER TABLE {table} ADD COLUMN owner_user_id TEXT")
    con.execute(f"CREATE INDEX IF NOT EXISTS idx_{table}_owner_user_id ON {table}(owner_user_id)")
now = datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
if default_username and default_password_hash:
    row = con.execute("SELECT id FROM console_users WHERE username = ?", (default_username,)).fetchone()
    if row:
        default_user_id = row[0]
        con.execute("UPDATE console_users SET password_hash = ?, role = 'admin', updated_at = ? WHERE username = ?", (default_password_hash, now, default_username))
    else:
        con.execute(
            "INSERT INTO console_users (id, username, password_hash, display_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, 'admin', ?, ?)",
            (default_user_id, default_username, default_password_hash, default_username, now, now)
        )
for table in tables:
    if table in existing_tables:
        con.execute(f"UPDATE {table} SET owner_user_id = ? WHERE owner_user_id IS NULL OR owner_user_id = ''", (default_user_id,))
con.commit()
print(json.dumps({"ok": True}, ensure_ascii=False))
`;
    const result = await runProcess(config.pythonExe, pythonInlineArgs(
      script,
      config.libtvDbPath,
      defaultOwnerUserId(),
      defaultUsername,
      defaultHash
    ), {
      cwd: WORKFLOW_DIR,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8"
      }
    });
    return parseJsonFromText(result.stdout, "无法初始化账号和任务隔离表。");
  })();
  return authSchemaReadyPromise;
}

async function findUserByUsername(username) {
  await ensureAuthSchema();
  const value = normalizeUsername(username);
  if (!value) return null;
  const rows = await querySqlite(
    "SELECT id, username, password_hash, display_name, role, created_at, updated_at FROM console_users WHERE username = ? LIMIT 1",
    [value]
  );
  return rows[0] || null;
}

async function findUserById(userId) {
  await ensureAuthSchema();
  const value = String(userId || "").trim();
  if (!value) return null;
  const rows = await querySqlite(
    "SELECT id, username, password_hash, display_name, role, created_at, updated_at FROM console_users WHERE id = ? LIMIT 1",
    [value]
  );
  return rows[0] || null;
}

async function createConsoleUser(payload = {}) {
  await ensureAuthSchema();
  const username = validateUsername(payload.username);
  const password = validatePassword(payload.password);
  if (await findUserByUsername(username)) {
    const error = new Error("这个账号已经被注册，请换一个账号。");
    error.statusCode = 409;
    throw error;
  }
  const now = new Date().toISOString();
  const user = {
    id: `user-${randomUUID()}`,
    username,
    displayName: String(payload.displayName || username).trim().slice(0, 60),
    role: "user"
  };
  await executeSqlite(
    `
    INSERT INTO console_users (id, username, password_hash, display_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [user.id, user.username, hashPassword(password), user.displayName, user.role, now, now]
  );
  return user;
}

function publicUser(user = {}) {
  return {
    id: user.id,
    name: user.username || user.name || "",
    displayName: user.display_name || user.displayName || user.username || user.name || "",
    role: user.role || "user"
  };
}

function makeAuthSession(res, user) {
  const token = randomBytes(32).toString("hex");
  const maxAgeSeconds = Math.round(config.authSessionHours * 60 * 60);
  sessions.set(token, {
    userId: user.id,
    user: user.username,
    displayName: user.display_name || user.displayName || user.username,
    role: user.role || "user",
    createdAt: Date.now(),
    expiresAt: Date.now() + maxAgeSeconds * 1000
  });
  return jsonResponse(
    res,
    200,
    { ok: true, authenticated: true, user: publicUser(user) },
    { "set-cookie": makeSessionCookie(token, maxAgeSeconds) }
  );
}

function ownerUserIdFromSession(session) {
  return session?.userId || defaultOwnerUserId();
}

function dataRightsRequestPath(ownerUserId = defaultOwnerUserId()) {
  return path.join(config.runStorageDir, "privacy-requests", `${safeFilePart(ownerUserId)}.jsonl`);
}

function dataRightsRequestDir() {
  return path.join(config.runStorageDir, "privacy-requests");
}

function supportFeedbackPath(ownerUserId = defaultOwnerUserId()) {
  return path.join(config.runStorageDir, "support-feedback", `${safeFilePart(ownerUserId)}.jsonl`);
}

function supportFeedbackDir() {
  return path.join(config.runStorageDir, "support-feedback");
}

async function safeQuerySqlite(sql, params = [], fallback = []) {
  try {
    return await querySqlite(sql, params);
  } catch {
    return fallback;
  }
}

function normalizeDataRightsType(value) {
  const type = String(value || "").trim();
  const allowed = new Set(["export_data", "delete_account", "delete_data", "correct_data"]);
  return allowed.has(type) ? type : "delete_account";
}

function dataRightsTypeLabel(type) {
  return {
    export_data: "导出数据",
    delete_account: "删除账号",
    delete_data: "删除数据",
    correct_data: "更正数据"
  }[type] || "数据权利请求";
}

const DELETE_ACCOUNT_CONFIRMATION = "DELETE_ACCOUNT";

function dataRightsStatusLabel(status) {
  return {
    received: "已收到",
    verifying: "核验中",
    approved: "已通过",
    processing: "处理中",
    completed: "已完成",
    rejected: "未通过"
  }[status] || status || "已收到";
}

function normalizeDataRightsStatus(value) {
  const status = String(value || "").trim();
  const allowed = new Set(["received", "verifying", "approved", "processing", "completed", "rejected"]);
  return allowed.has(status) ? status : "";
}

function dataRightsNextStep(status) {
  return {
    received: "等待人工复核、删除范围确认和保留期判断。",
    verifying: "正在核验删除范围和合规保留要求。",
    approved: "已通过复核，等待执行删除或匿名化。",
    processing: "正在处理账号、素材、任务和输出数据。",
    completed: "删除或匿名化流程已完成。",
    rejected: "请求未通过，请查看备注或联系支持。"
  }[status] || "等待人工处理。";
}

function hasDeleteAccountConfirmation(payload = {}) {
  const value = String(payload.confirmation || payload.confirmText || "").trim();
  return value === DELETE_ACCOUNT_CONFIRMATION || value === "删除账号";
}

function dataRightsBadRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function dataRightsUnauthorized(message) {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

function dataRightsForbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function dataRightsNotFound(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function requireDataRightsAdmin(session = null) {
  if (!config.authRequired && !session) {
    return {
      userId: defaultOwnerUserId(),
      user: config.authUser || "local-preview",
      displayName: "本地预览",
      role: "admin"
    };
  }
  if (session?.role === "admin") return session;
  throw dataRightsForbidden("需要管理员权限才能处理数据权利申请。");
}

function normalizeDataRightsPayload(payload = {}) {
  const type = normalizeDataRightsType(payload.type);
  if (type === "delete_account" && !hasDeleteAccountConfirmation(payload)) {
    throw dataRightsBadRequest("请先输入“删除账号”完成二次确认。");
  }
  return {
    type,
    typeLabel: dataRightsTypeLabel(type),
    reason: String(payload.reason || "").trim().slice(0, 1000),
    contact: String(payload.contact || "").trim().slice(0, 160),
    scope: String(payload.scope || "").trim().slice(0, 240) || "account",
    userConfirmed: type === "delete_account",
    confirmationMethod: type === "delete_account" ? "typed-delete-account" : ""
  };
}

async function verifyDataRightsIdentity(payload = {}, normalized = {}, session = null) {
  if (normalized.type !== "delete_account") {
    return {
      identityVerified: false,
      identityVerificationMethod: ""
    };
  }
  if (!config.authRequired && !session?.userId) {
    return {
      identityVerified: false,
      identityVerificationMethod: "auth-disabled"
    };
  }
  if (!session?.userId) {
    throw dataRightsUnauthorized("请先登录后再提交删除账号申请。");
  }
  const currentPassword = String(payload.currentPassword || payload.password || "");
  if (!currentPassword) {
    throw dataRightsBadRequest("请输入当前登录密码完成身份校验。");
  }
  const user = await findUserById(session.userId);
  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    throw dataRightsUnauthorized("当前登录密码不正确，请重新输入。");
  }
  return {
    identityVerified: true,
    identityVerificationMethod: "current-password"
  };
}

function decorateDataRightsRequest(request = {}) {
  const status = String(request.status || "received");
  return {
    ...request,
    status,
    statusLabel: dataRightsStatusLabel(status),
    nextStep: dataRightsNextStep(status)
  };
}

function parseDataRightsRequestLines(text = "") {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function readDataRightsRequests(ownerUserId = defaultOwnerUserId()) {
  const filePath = dataRightsRequestPath(ownerUserId);
  if (!existsSync(filePath)) return [];
  const text = await readFile(filePath, "utf8").catch(() => "");
  return parseDataRightsRequestLines(text)
    .map(decorateDataRightsRequest)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function readAllDataRightsRequests() {
  const dir = dataRightsRequestDir();
  if (!existsSync(dir)) return [];
  const files = await readdir(dir).catch(() => []);
  const allRequests = [];
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const ownerHint = path.basename(file, ".jsonl");
    const text = await readFile(path.join(dir, file), "utf8").catch(() => "");
    for (const request of parseDataRightsRequestLines(text)) {
      allRequests.push(decorateDataRightsRequest({
        ...request,
        ownerHint,
        sourceFile: file
      }));
    }
  }
  return allRequests.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

async function updateDataRightsRequestStatus(requestId, payload = {}, session = null) {
  const admin = requireDataRightsAdmin(session);
  const id = String(requestId || "").trim();
  if (!id) throw dataRightsBadRequest("缺少申请编号。");
  const status = normalizeDataRightsStatus(payload.status);
  if (!status) throw dataRightsBadRequest("状态不支持。");
  const dir = dataRightsRequestDir();
  if (!existsSync(dir)) throw dataRightsNotFound("没有数据权利申请记录。");
  const files = await readdir(dir).catch(() => []);
  const now = new Date().toISOString();
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const filePath = path.join(dir, file);
    const requests = parseDataRightsRequestLines(await readFile(filePath, "utf8").catch(() => ""));
    const index = requests.findIndex((request) => request.id === id);
    if (index < 0) continue;
    const note = String(payload.reviewNote || payload.note || "").trim().slice(0, 500);
    const review = {
      at: now,
      status,
      statusLabel: dataRightsStatusLabel(status),
      note,
      reviewerUserId: admin.userId || "",
      reviewerName: admin.displayName || admin.user || "admin"
    };
    const updated = {
      ...requests[index],
      status,
      updatedAt: now,
      reviewedAt: now,
      reviewedByUserId: review.reviewerUserId,
      reviewedByName: review.reviewerName,
      reviewNote: note,
      reviewHistory: [...(Array.isArray(requests[index].reviewHistory) ? requests[index].reviewHistory : []), review]
    };
    requests[index] = updated;
    await writeFile(filePath, `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`, "utf8");
    return decorateDataRightsRequest(updated);
  }
  throw dataRightsNotFound("没有找到对应的数据权利申请。");
}

function normalizeSupportFeedbackCategory(value) {
  const category = String(value || "").trim();
  const allowed = new Set(["bug", "confusing", "feature", "pwa-install", "performance", "other"]);
  return allowed.has(category) ? category : "other";
}

function supportFeedbackCategoryLabel(category) {
  return {
    bug: "功能异常",
    confusing: "看不懂/不好用",
    feature: "想要的新能力",
    "pwa-install": "安装到桌面",
    performance: "速度或卡顿",
    other: "其他反馈"
  }[category] || "其他反馈";
}

function normalizeSupportFeedbackSeverity(value) {
  const severity = String(value || "").trim();
  const allowed = new Set(["low", "normal", "high", "blocking"]);
  return allowed.has(severity) ? severity : "normal";
}

function supportFeedbackSeverityLabel(severity) {
  return {
    low: "小问题",
    normal: "一般",
    high: "影响使用",
    blocking: "无法继续"
  }[severity] || "一般";
}

function normalizeSupportFeedbackStatus(value) {
  const status = String(value || "").trim();
  const allowed = new Set(["received", "triaging", "planned", "fixed", "closed"]);
  return allowed.has(status) ? status : "";
}

function supportFeedbackStatusLabel(status) {
  return {
    received: "已收到",
    triaging: "排查中",
    planned: "已排期",
    fixed: "已修复",
    closed: "已关闭"
  }[status] || status || "已收到";
}

function supportFeedbackNextStep(status) {
  return {
    received: "运营或产品会先判断是否影响试点。",
    triaging: "正在复现或确认影响范围。",
    planned: "已经进入后续迭代安排。",
    fixed: "已在新版本中处理，请刷新后再试。",
    closed: "该反馈已经归档。"
  }[status] || "等待处理。";
}

function normalizeSupportFeedbackPayload(payload = {}) {
  const message = String(payload.message || payload.detail || "").trim().slice(0, 1600);
  if (message.length < 6) {
    const error = new Error("请至少写 6 个字描述问题或建议。");
    error.statusCode = 400;
    throw error;
  }
  return {
    category: normalizeSupportFeedbackCategory(payload.category),
    severity: normalizeSupportFeedbackSeverity(payload.severity),
    message,
    contact: String(payload.contact || "").trim().slice(0, 180),
    page: String(payload.page || payload.route || "").trim().slice(0, 180) || "settings",
    device: String(payload.device || "").trim().slice(0, 180),
    screenshotNote: String(payload.screenshotNote || "").trim().slice(0, 300),
    userAgent: String(payload.userAgent || "").trim().slice(0, 260)
  };
}

function decorateSupportFeedback(feedback = {}) {
  const status = String(feedback.status || "received");
  const category = normalizeSupportFeedbackCategory(feedback.category);
  const severity = normalizeSupportFeedbackSeverity(feedback.severity);
  return {
    ...feedback,
    status,
    category,
    severity,
    statusLabel: supportFeedbackStatusLabel(status),
    categoryLabel: supportFeedbackCategoryLabel(category),
    severityLabel: supportFeedbackSeverityLabel(severity),
    nextStep: supportFeedbackNextStep(status)
  };
}

function parseSupportFeedbackLines(text = "") {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function readSupportFeedback(ownerUserId = defaultOwnerUserId()) {
  const filePath = supportFeedbackPath(ownerUserId);
  if (!existsSync(filePath)) return [];
  const text = await readFile(filePath, "utf8").catch(() => "");
  return parseSupportFeedbackLines(text)
    .map(decorateSupportFeedback)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

async function readAllSupportFeedback() {
  const dir = supportFeedbackDir();
  if (!existsSync(dir)) return [];
  const files = await readdir(dir).catch(() => []);
  const allFeedback = [];
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const ownerHint = path.basename(file, ".jsonl");
    const text = await readFile(path.join(dir, file), "utf8").catch(() => "");
    for (const feedback of parseSupportFeedbackLines(text)) {
      allFeedback.push(decorateSupportFeedback({
        ...feedback,
        ownerHint,
        sourceFile: file
      }));
    }
  }
  return allFeedback.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
}

async function createSupportFeedback(payload, session, ownerUserId = defaultOwnerUserId()) {
  const normalized = normalizeSupportFeedbackPayload(payload);
  const now = new Date().toISOString();
  const feedback = {
    id: `feedback-${randomUUID()}`,
    ownerUserId,
    username: session?.user || "",
    displayName: session?.displayName || session?.user || "",
    ...normalized,
    status: "received",
    createdAt: now,
    updatedAt: now,
    note: "Pilot feedback captures issue context only. Do not store passwords, API keys, screenshots with private data, or raw logs here."
  };
  const filePath = supportFeedbackPath(ownerUserId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(feedback)}\n`, "utf8");
  return decorateSupportFeedback(feedback);
}

async function updateSupportFeedbackStatus(feedbackId, payload = {}, session = null) {
  const admin = requireDataRightsAdmin(session);
  const id = String(feedbackId || "").trim();
  if (!id) {
    const error = new Error("缺少反馈编号。");
    error.statusCode = 400;
    throw error;
  }
  const status = normalizeSupportFeedbackStatus(payload.status);
  if (!status) {
    const error = new Error("反馈状态不支持。");
    error.statusCode = 400;
    throw error;
  }
  const dir = supportFeedbackDir();
  if (!existsSync(dir)) {
    const error = new Error("没有试点反馈记录。");
    error.statusCode = 404;
    throw error;
  }
  const files = await readdir(dir).catch(() => []);
  const now = new Date().toISOString();
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const filePath = path.join(dir, file);
    const feedbackRows = parseSupportFeedbackLines(await readFile(filePath, "utf8").catch(() => ""));
    const index = feedbackRows.findIndex((feedback) => feedback.id === id);
    if (index < 0) continue;
    const note = String(payload.reviewNote || payload.note || "").trim().slice(0, 500);
    const review = {
      at: now,
      status,
      statusLabel: supportFeedbackStatusLabel(status),
      note,
      reviewerUserId: admin.userId || "",
      reviewerName: admin.displayName || admin.user || "admin"
    };
    const updated = {
      ...feedbackRows[index],
      status,
      updatedAt: now,
      reviewedAt: now,
      reviewedByUserId: review.reviewerUserId,
      reviewedByName: review.reviewerName,
      reviewNote: note,
      reviewHistory: [...(Array.isArray(feedbackRows[index].reviewHistory) ? feedbackRows[index].reviewHistory : []), review]
    };
    feedbackRows[index] = updated;
    await writeFile(filePath, `${feedbackRows.map((feedback) => JSON.stringify(feedback)).join("\n")}\n`, "utf8");
    return decorateSupportFeedback(updated);
  }
  const error = new Error("没有找到对应的试点反馈。");
  error.statusCode = 404;
  throw error;
}

async function createDataRightsRequest(payload, session, ownerUserId = defaultOwnerUserId()) {
  const normalized = normalizeDataRightsPayload(payload);
  const identity = await verifyDataRightsIdentity(payload, normalized, session);
  const now = new Date().toISOString();
  const request = {
    id: `privacy-${randomUUID()}`,
    ownerUserId,
    username: session?.user || "",
    displayName: session?.displayName || session?.user || "",
    ...normalized,
    ...identity,
    status: "received",
    createdAt: now,
    updatedAt: now,
    note: "此接口只记录请求，不会自动删除账号或业务数据。正式发布前应接入人工复核、保留期判断和删除执行流程。"
  };
  const filePath = dataRightsRequestPath(ownerUserId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(request)}\n`, "utf8");
  return decorateDataRightsRequest(request);
}

function hydrateVideoTaskSourceLink(row = {}) {
  const payload = parseStoredJson(row.payload_json, {});
  const sourceType = String(row.source_type || payload.sourceType || "").trim();
  const sourceId = String(row.source_id || payload.sourceId || payload.textImageCanvasNodeId || "").trim();
  const textImageCanvasNodeId = String(
    payload.textImageCanvasNodeId || (sourceType === "text-image-canvas" ? sourceId : "")
  ).trim();
  return {
    id: String(row.id || "").trim(),
    ownerUserId: String(row.owner_user_id || payload.ownerUserId || "").trim(),
    taskCode: String(row.task_code || payload.taskCode || "").trim(),
    sourceType,
    sourceId,
    createdAt: String(row.created_at || payload.createdAt || "").trim(),
    imageIndex: Number(payload.imageIndex || 0),
    imageName: String(payload.imageName || "").trim(),
    imageType: String(payload.imageType || "").trim(),
    imageSize: Number(payload.imageSize || 0),
    sourceUrl: String(payload.sourceUrl || "").trim(),
    textImageCanvasNodeId,
    textImageRunId: String(payload.textImageRunId || "").trim(),
    textImageModel: String(payload.textImageModel || "").trim(),
    textImageSize: String(payload.textImageSize || "").trim(),
    textImageCreatedAt: String(payload.textImageCreatedAt || "").trim(),
    textImageLinkedAt: String(payload.textImageLinkedAt || "").trim(),
    textImagePromptPreview: String(payload.textImagePromptPreview || payload.textImagePrompt || "").trim(),
    textImageNegativePromptPreview: String(
      payload.textImageNegativePromptPreview || payload.textImageNegativePrompt || ""
    ).trim(),
    sourcePayload: payload
  };
}

async function listVideoTaskSourceLinks({ ownerUserId = defaultOwnerUserId(), taskCode = "", limit = 100 } = {}) {
  await ensureVideoTaskSourceLinkSchema();
  const normalizedTaskCode = String(taskCode || "").trim().slice(0, 160);
  const rows = await safeQuerySqlite(
    `
    SELECT id, owner_user_id, task_code, source_type, source_id, payload_json, created_at
    FROM video_task_source_links
    WHERE COALESCE(owner_user_id, ?) = ?
      AND (? = '' OR task_code = ?)
    ORDER BY created_at DESC
    LIMIT ?
    `,
    [
      defaultOwnerUserId(),
      ownerUserId || defaultOwnerUserId(),
      normalizedTaskCode,
      normalizedTaskCode,
      boundedNumber(limit, 100, 1, 500)
    ],
    []
  );
  return rows.map(hydrateVideoTaskSourceLink);
}

async function buildAccountDataExport(session, ownerUserId = defaultOwnerUserId()) {
  await ensureAuthSchema();
  const [user] = await safeQuerySqlite(
    "SELECT id, username, display_name, role, created_at, updated_at FROM console_users WHERE id = ? LIMIT 1",
    [ownerUserId],
    []
  );
  const taskRows = await safeQuerySqlite(
    `
    SELECT *
    FROM video_tasks
    WHERE COALESCE(owner_user_id, ?) = ?
    ORDER BY COALESCE(updated_at, created_at) DESC
    LIMIT 100
    `,
    [defaultOwnerUserId(), ownerUserId],
    []
  );
  const productRows = await safeQuerySqlite(
    `
    SELECT *
    FROM products
    WHERE COALESCE(owner_user_id, ?) = ?
    ORDER BY COALESCE(updated_at, created_at) DESC
    LIMIT 100
    `,
    [defaultOwnerUserId(), ownerUserId],
    []
  );
  const assetRows = await safeQuerySqlite(
    `
    SELECT *
    FROM product_assets
    WHERE COALESCE(owner_user_id, ?) = ?
    ORDER BY created_at DESC
    LIMIT 100
    `,
    [defaultOwnerUserId(), ownerUserId],
    []
  );
  const batchJobs = await listBatchJobs(100, ownerUserId).catch(() => []);
  const selectionAssets = await listSelectionAssets(ownerUserId).catch(() => ({ products: [], accounts: [], materialLinks: [] }));
  const outputFiles = await listOutputFiles(ownerUserId).catch(() => []);
  const textImageSourceLinks = await listVideoTaskSourceLinks({ ownerUserId, limit: 100 }).catch(() => []);
  const requests = await readDataRightsRequests(ownerUserId);

  return {
    ok: true,
    exportVersion: "account-data-summary-v1",
    generatedAt: new Date().toISOString(),
    user: publicUser(user || {
      id: ownerUserId,
      username: session?.user || "",
      displayName: session?.displayName || session?.user || ""
    }),
    limits: {
      maxRowsPerTable: 100,
      note: "此导出是账号数据摘要。正式发布前可扩展为完整数据包、文件打包和对象存储下载。"
    },
    summary: {
      tasks: taskRows.length,
      products: productRows.length,
      productAssets: assetRows.length,
      batchJobs: batchJobs.length,
      selectionProducts: selectionAssets.products?.length || 0,
      accountAssets: selectionAssets.accounts?.length || 0,
      outputFiles: outputFiles.length,
      textImageSourceLinks: textImageSourceLinks.length,
      dataRightsRequests: requests.length
    },
    data: {
      tasks: taskRows,
      products: productRows,
      productAssets: assetRows,
      batchJobs,
      selectionProducts: selectionAssets.products || [],
      accountAssets: selectionAssets.accounts || [],
      textImageSourceLinks,
      outputFiles: outputFiles.map((file) => ({
        name: file.name,
        kind: file.kind,
        url: file.url,
        size: file.size,
        updatedAt: file.updatedAt
      })),
      dataRightsRequests: requests
    },
    compliance: {
      privacyPolicyUrl: "/legal/privacy.html",
      termsUrl: "/legal/terms.html",
      aiDisclosureUrl: "/legal/ai-disclosure.html",
      accountDeletionRequestSupported: true,
      automaticDeletionEnabled: false
    }
  };
}

function batchDraftPath(ownerUserId = defaultOwnerUserId()) {
  return path.join(config.runStorageDir, "drafts", `batch-upload-draft-${safeFilePart(ownerUserId)}.json`);
}

async function readBatchDraft(ownerUserId = defaultOwnerUserId()) {
  let filePath = batchDraftPath(ownerUserId);
  const legacyPath = path.join(config.runStorageDir, "drafts", "batch-upload-draft.json");
  if (!existsSync(filePath) && ownerUserId === defaultOwnerUserId() && existsSync(legacyPath)) {
    filePath = legacyPath;
  }
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function writeBatchDraft(payload = {}, ownerUserId = defaultOwnerUserId()) {
  const filePath = batchDraftPath(ownerUserId);
  const draft = {
    version: 1,
    ownerUserId,
    updatedAt: new Date().toISOString(),
    ...payload
  };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(draft, null, 2), "utf8");
  return draft;
}

async function deleteBatchDraft(ownerUserId = defaultOwnerUserId()) {
  await rm(batchDraftPath(ownerUserId), { force: true });
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("上传内容太大，请压缩图片或减少图片数量。");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function createRun(kind, payload, job, options = {}) {
  const runId = randomUUID();
  const run = {
    id: runId,
    kind,
    ownerUserId: options.ownerUserId || payload?.ownerUserId || "",
    createdAt: new Date().toISOString(),
    status: "running",
    events: [],
    subscribers: new Set(),
    abortController: new AbortController(),
    cancelled: false,
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      calls: 0,
      items: []
    },
    result: null,
    error: null
  };
  runs.set(runId, run);
  queueMicrotask(() => job(run, payload));
  return run;
}

function emit(run, event) {
  const payload = {
    at: new Date().toISOString(),
    ...event
  };
  run.events.push(payload);
  if (typeof run.onEvent === "function") {
    Promise.resolve(run.onEvent(payload)).catch(() => {});
  }
  for (const res of run.subscribers) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
  if (["completed", "failed", "cancelled"].includes(payload.type)) {
    for (const res of run.subscribers) {
      res.write(`event: done\ndata: ${JSON.stringify(payload)}\n\n`);
      res.end();
    }
    run.subscribers.clear();
    setTimeout(() => runs.delete(run.id), 10 * 60 * 1000).unref?.();
  }
}

function createInternalRun(kind, onEvent) {
  const runId = randomUUID();
  const run = {
    id: runId,
    kind,
    createdAt: new Date().toISOString(),
    status: "running",
    events: [],
    subscribers: new Set(),
    abortController: new AbortController(),
    cancelled: false,
    tokenUsage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      calls: 0,
      items: []
    },
    result: null,
    error: null,
    onEvent
  };
  runs.set(runId, run);
  return run;
}

function cancelRun(run, reason = "用户已中断生成。") {
  if (!run) return false;
  if (["completed", "failed", "cancelled"].includes(run.status)) return false;
  run.cancelled = true;
  run.status = "cancelled";
  run.error = reason;
  run.abortController?.abort(new RunCancelledError(reason));
  emit(run, {
    type: "cancelled",
    phase: "已中断",
    message: reason
  });
  return true;
}

function ensureRunActive(run) {
  if (run?.cancelled || run?.abortController?.signal?.aborted) {
    throw new RunCancelledError(run?.error || "用户已中断生成。");
  }
}

function isRunCancelled(error, run) {
  return error?.name === "RunCancelledError" || Boolean(run?.cancelled || run?.abortController?.signal?.aborted);
}

function tokenNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function extractTokenUsage(response) {
  const usage = response?.usage || response?.meta?.usage || response?.output?.usage || {};
  const promptTokens = tokenNumber(usage.prompt_tokens ?? usage.input_tokens ?? usage.inputTokens);
  const completionTokens = tokenNumber(usage.completion_tokens ?? usage.output_tokens ?? usage.outputTokens);
  const totalTokens = tokenNumber(usage.total_tokens ?? usage.totalTokens) || promptTokens + completionTokens;
  if (!promptTokens && !completionTokens && !totalTokens) return null;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    raw: usage
  };
}

function addRunTokenUsage(run, usage, meta = {}) {
  if (!run || !usage) return null;
  const current = {
    phase: meta.phase || "",
    model: meta.model || "",
    provider: meta.provider || "",
    promptTokens: tokenNumber(usage.promptTokens),
    completionTokens: tokenNumber(usage.completionTokens),
    totalTokens: tokenNumber(usage.totalTokens),
    raw: usage.raw || undefined
  };
  run.tokenUsage.promptTokens += current.promptTokens;
  run.tokenUsage.completionTokens += current.completionTokens;
  run.tokenUsage.totalTokens += current.totalTokens;
  run.tokenUsage.calls += 1;
  run.tokenUsage.items.push(current);
  return {
    current,
    total: {
      promptTokens: run.tokenUsage.promptTokens,
      completionTokens: run.tokenUsage.completionTokens,
      totalTokens: run.tokenUsage.totalTokens,
      calls: run.tokenUsage.calls
    }
  };
}

function subscribeToRun(req, res, run) {
  res.writeHead(200, {
    ...corsHeadersFor(req),
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no"
  });
  for (const event of run.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
  if (["completed", "failed"].includes(run.status)) {
    res.write(`event: done\ndata: ${JSON.stringify(run.events.at(-1) || {})}\n\n`);
    res.end();
    return;
  }
  run.subscribers.add(res);
  req.on("close", () => run.subscribers.delete(res));
}

async function runFinalPromptJob(run, payload) {
  try {
    const normalized = normalizePromptPayload(payload);
    ensureRunActive(run);
    const analysisModel = getAnalysisModel(normalized);
    const visionModel = getVisionModel(normalized);
    emit(run, {
      type: "model_meta",
      phase: "模型配置",
      message: `分析模型：${analysisModel || "本地模拟"}；视觉模型：${visionModel || "未配置"}`,
      output: JSON.stringify(
        {
          analysisModel: analysisModel || "",
          visionModel: visionModel || "",
          analysisSource: normalized.analysisModel ? "页面选择" : "后端默认",
          visionSource: normalized.visionModel ? "页面选择" : "后端默认"
        },
        null,
        2
      )
    });
    emit(run, {
      type: "status",
      phase: "准备任务",
      message: `已接收提示词包和 ${normalized.images.length} 张产品图。`
    });

    let imageAnalysis = "";
    let imageTokenUsage = null;
    emit(run, { type: "status", phase: "图片识别", message: "开始整理产品图片信息。" });
    if (config.qianwenVlKey && normalized.images.length) {
      const analyzed = await analyzeImagesWithQianwen(normalized, run.abortController.signal);
      imageAnalysis = analyzed.text;
      imageTokenUsage = addRunTokenUsage(run, analyzed.usage, {
        phase: "图片识别",
        model: analyzed.model,
        provider: "qianwen-vl"
      });
    } else {
      imageAnalysis = buildLocalImageSummary(normalized.images);
      emit(run, {
        type: "status",
        phase: "图片识别",
        message: config.qianwenVlKey ? "没有上传图片，使用商品补充信息继续。" : "未配置视觉 API，使用本地图片摘要继续。"
      });
    }
    ensureRunActive(run);
    emit(run, {
      type: "image_analysis",
      phase: "图片识别",
      message: "产品图片信息已整理。",
      output: imageAnalysis,
      tokenUsage: imageTokenUsage
    });

    const categoryWasManual = Boolean(normalized.productCategory);
    const suggestedCategory = categoryWasManual
      ? normalized.productCategory
      : inferCategoryFromSources({
          imageAnalysis,
          productBrief: normalized.productBrief,
          productName: normalized.productName,
          promptText: normalized.promptPackText
        });
    normalized.productCategory = suggestedCategory;
    emit(run, {
      type: "category_detected",
      phase: "类别识别",
      category: suggestedCategory,
      source: categoryWasManual ? "manual" : "image_analysis",
      message: categoryWasManual ? `使用手填类别：${suggestedCategory}` : `已根据图片识别类别：${suggestedCategory}`
    });

    const sopSteps = deriveSopSteps(normalized.promptPackText);
    ensureRunActive(run);
    emit(run, {
      type: "status",
      phase: "解析提示词包",
      message: `已从提示词包中识别到 ${sopSteps.length} 个执行步骤。`
    });

    const analysisConfig = getAnalysisCompletionConfig(normalized);
    const realAnalysis = Boolean(analysisConfig.apiKey && analysisConfig.url && analysisConfig.model);
    const steps = realAnalysis
      ? await runDoubaoDynamicSteps(normalized, imageAnalysis, run, sopSteps)
      : await runMockDynamicSteps(normalized, imageAnalysis, run, sopSteps);

    ensureRunActive(run);
    emit(run, { type: "status", phase: "最终封装", message: "开始把执行结果封装成一个完整视频提示词。" });
    const packaged = realAnalysis
      ? await packageFinalPromptWithDoubao(normalized, imageAnalysis, steps, run)
      : packageFinalPromptLocally(normalized, imageAnalysis, steps);

    ensureRunActive(run);
    run.status = "completed";
    run.result = {
      imageAnalysis,
      suggestedCategory,
      categorySource: categoryWasManual ? "manual" : "image_analysis",
      steps,
      finalPrompt: packaged.finalPrompt,
      promptPackage: packaged,
      tokenUsage: run.tokenUsage
    };
    emit(run, {
      type: "completed",
      phase: "完成",
      message: "最终完整提示词已生成。",
      result: run.result,
      tokenUsage: {
        total: run.tokenUsage
      }
    });
  } catch (error) {
    if (isRunCancelled(error, run)) {
      if (run.status !== "cancelled") cancelRun(run, "用户已中断生成。");
      return;
    }
    run.status = "failed";
    run.error = error.message;
    emit(run, {
      type: "failed",
      phase: "失败",
      message: error.message
    });
  }
}

async function runVideoJob(run, payload) {
  try {
    const result = await submitLibTVVideo(payload, run);
    run.status = "completed";
    run.result = result;
    emit(run, {
      type: "completed",
      phase: "libTV 完成",
      message: result.mode === "dry_run" ? "已完成 libTV 提交前验证，未真实消耗生成任务。" : "libTV 任务已处理完成。",
      result
    });
  } catch (error) {
    run.status = "failed";
    run.error = error.message;
    emit(run, {
      type: "failed",
      phase: "libTV 失败",
      message: error.message
    });
  }
}

async function runTextToImageJob(run, payload) {
  try {
    const normalized = normalizeImageGenerationPayload(payload);
    const runLabel = normalized.mode === "image-variation" ? "图片裂变" : "文生图";
    emit(run, {
      type: "status",
      phase: `准备${runLabel}`,
      message: `使用 ${normalized.model} 生成 ${normalized.count} 张图片。`
    });
    ensureRunActive(run);
    const generated = await callImageGeneration(normalized, run.abortController.signal);
    ensureRunActive(run);
    emit(run, {
      type: "status",
      phase: "保存图片",
      message: "图片已返回，正在写入本地输出目录。"
    });
    const referenceFiles = normalized.mode === "image-variation"
      ? await saveVariationReferenceImages(normalized.referenceImages, normalized, run.id)
      : [];
    const files = await saveGeneratedImages(generated.images, normalized, run.id);
    const canvasNodes = await appendTextImageCanvasNodes(files, normalized, run.id, {
      referenceImages: referenceFiles
    });
    run.status = "completed";
    run.result = {
      mode: normalized.mode,
      prompt: normalized.prompt,
      userPrompt: normalized.userPrompt,
      negativePrompt: normalized.negativePrompt,
      variationIntent: normalized.variationIntent,
      variationLabel: normalized.variationLabel,
      variationStrength: normalized.variationStrength,
      variationStrengthLabel: normalized.variationStrengthLabel,
      model: normalized.model,
      size: normalized.size,
      count: files.length,
      referenceImages: referenceFiles,
      images: files,
      canvasNodes,
      raw: generated.raw
    };
    emit(run, {
      type: "completed",
      phase: `${runLabel}完成`,
      message: `已生成 ${files.length} 张图片。`,
      result: run.result
    });
  } catch (error) {
    if (isRunCancelled(error, run)) {
      if (run.status !== "cancelled") cancelRun(run, "用户已中断文生图。");
      return;
    }
    run.status = "failed";
    run.error = error.message;
    emit(run, {
      type: "failed",
      phase: "图片生成失败",
      message: error.message
    });
  }
}

function normalizePromptPayload(payload) {
  const promptPackText = String(payload.promptPackText || "").trim();
  const productBrief = String(payload.productBrief || "").trim();
  const productName = String(payload.productName || "").trim();
  const productCategory = cleanCategory(payload.productCategory || "", "");
  const images = normalizeImages(payload.images);
  const modelSettings = normalizeModelSettings(payload.modelSettings);
  if (!promptPackText) throw new Error("请先上传或粘贴提示词包内容。");
  if (!images.length && !productBrief) throw new Error("请至少上传一张产品图，或填写商品补充信息。");
  return {
    promptPackText,
    productBrief,
    productName,
    productCategory,
    analysisModel: modelSettings.analysisModel,
    visionModel: modelSettings.visionModel,
    targetDuration: boundedNumber(payload.targetDuration, 15, 4, 15),
    aspectRatio: String(payload.aspectRatio || "9:16"),
    images
  };
}

function normalizeModelSettings(value = {}) {
  return {
    analysisModel: cleanModelId(value.analysisModel),
    visionModel: cleanModelId(value.visionModel)
  };
}

function cleanModelId(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w.\-:/]/g, "")
    .slice(0, 160);
}

function getAnalysisModel(payload = {}) {
  return payload.analysisModel || config.doubaoModel || config.qianwenModel;
}

function getVisionModel(payload = {}) {
  return payload.visionModel || config.qianwenVlModel;
}

function getAnalysisCompletionConfig(payload = {}) {
  const model = getAnalysisModel(payload);
  const isQianwen =
    model === config.qianwenModel ||
    model.toLowerCase().startsWith("qwen") ||
    config.analysisModelOptions.includes(model) && model.toLowerCase().includes("qwen");
  if (isQianwen) {
    return {
      url: `${config.qianwenBaseUrl.replace(/\/$/, "")}/chat/completions`,
      apiKey: config.qianwenKey,
      model,
      provider: "qianwen"
    };
  }
  return {
    url: config.doubaoUrl,
    apiKey: config.arkKey,
    model,
    provider: "doubao"
  };
}

function normalizeVideoPayload(payload) {
  const finalPrompt = String(payload.finalPrompt || "").trim();
  const productBrief = String(payload.productBrief || "").trim();
  const productName = String(payload.productName || "").trim() || extractProductName(productBrief) || "HTML上传商品";
  const productCategory = cleanCategory(
    payload.productCategory ||
      payload.suggestedCategory ||
      inferCategoryFromSources({
        imageAnalysis: payload.imageAnalysis,
        productBrief,
        productName,
        promptText: payload.finalPrompt
      })
  );
  const images = normalizeImages(payload.images);
  if (!finalPrompt) throw new Error("请先生成最终完整提示词。");
  if (!images.length) throw new Error("请至少上传一张产品图，用作 libTV 商品参考图。");
  return {
    finalPrompt,
    promptPackage: payload.promptPackage || null,
    imageAnalysis: String(payload.imageAnalysis || ""),
    productBrief,
    productName,
    productCategory,
    images,
    duration: boundedNumber(payload.duration, 15, 4, 15),
    aspectRatio: String(payload.aspectRatio || "9:16"),
    dryRun: coerceBool(payload.dryRun, config.libtvDefaultDryRun),
    waitForVideo: coerceBool(payload.waitForVideo, false),
    download: coerceBool(payload.download, true),
    count: boundedNumber(payload.count, 1, 1, 4),
    model: String(payload.model || "").trim(),
    resolution: String(payload.resolution || "").trim(),
    enableSound: coerceBool(payload.enableSound, config.libtvEnableSound),
    autoCompliance: coerceBool(payload.autoCompliance, config.libtvAutoCompliance),
    searchEnabled: coerceBool(payload.searchEnabled, config.libtvSearchEnabled),
    ownerUserId: String(payload.ownerUserId || "").trim(),
    taskCode: String(payload.taskCode || "").trim(),
    pollInterval: boundedNumber(payload.pollInterval, 30, 5, 120),
    maxWaitSeconds: boundedNumber(payload.maxWaitSeconds, 1800, 60, 7200)
  };
}

function normalizeImageGenerationPayload(payload = {}) {
  const mode = String(payload.mode || payload.generationMode || "").trim() === "image-variation"
    ? "image-variation"
    : "text-image";
  const userPrompt = String(payload.prompt || "").trim();
  const prompt = String(payload.finalPrompt || payload.prompt || "").trim();
  if (!prompt) throw new Error(mode === "image-variation" ? "请先选择裂变方向或填写补充要求。" : "请先填写文生图提示词。");
  const size = normalizeImageGenerationSize(payload.size);
  const model = String(payload.model || config.imageGenerationModel || "").trim();
  if (!model) throw new Error("缺少图片生成模型配置。");
  const referenceImages = mode === "image-variation"
    ? normalizeImages(payload.referenceImages || payload.images)
    : [];
  if (mode === "image-variation" && !referenceImages.length) throw new Error("请先上传一张原图，再开始图片裂变。");
  return {
    mode,
    prompt,
    userPrompt,
    negativePrompt: String(payload.negativePrompt || "").trim(),
    variationIntent: String(payload.variationIntent || "").trim().slice(0, 80),
    variationLabel: String(payload.variationLabel || "图片裂变").trim().slice(0, 80),
    variationStrength: String(payload.variationStrength || "").trim().slice(0, 80),
    variationStrengthLabel: String(payload.variationStrengthLabel || "").trim().slice(0, 80),
    referenceImages,
    size,
    model,
    count: boundedNumber(payload.count, 1, 1, mode === "image-variation" ? 8 : 4),
    responseFormat: ["url", "b64_json"].includes(String(payload.responseFormat || "").trim())
      ? String(payload.responseFormat).trim()
      : "url",
    ownerUserId: String(payload.ownerUserId || "").trim() || defaultOwnerUserId()
  };
}

function normalizeImageGenerationSize(value = DEFAULT_IMAGE_GENERATION_SIZE) {
  const raw = String(value || DEFAULT_IMAGE_GENERATION_SIZE).trim().toLowerCase();
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(raw);
  if (!match) return DEFAULT_IMAGE_GENERATION_SIZE;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return DEFAULT_IMAGE_GENERATION_SIZE;
  }
  if (width * height >= IMAGE_GENERATION_MIN_PIXELS) return `${width}x${height}`;
  const scale = Math.sqrt(IMAGE_GENERATION_MIN_PIXELS / (width * height));
  const nextWidth = Math.ceil((width * scale) / 64) * 64;
  const nextHeight = Math.ceil((height * scale) / 64) * 64;
  return `${nextWidth}x${nextHeight}`;
}

function normalizeImages(images) {
  return Array.isArray(images)
    ? images
        .filter((image) => image && image.dataUrl && String(image.dataUrl).startsWith("data:image/"))
        .slice(0, 6)
        .map((image) => {
          const source = normalizeTextImageSourceMetadata(image);
          return {
            name: String(image.name || "product-image"),
            type: String(image.type || "image/png"),
            size: Number(image.size || 0),
            dataUrl: String(image.dataUrl),
            ...(source || {})
          };
        })
    : [];
}

function compactMetadataText(value, maxLength = 600) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function normalizeTextImageSourceMetadata(image = {}) {
  const sourceType = String(image.sourceType || "").trim();
  const nodeId = String(image.textImageCanvasNodeId || image.sourceNodeId || "").trim();
  if (sourceType !== "text-image-canvas" && !nodeId) return null;
  return {
    sourceType: "text-image-canvas",
    sourceUrl: String(image.sourceUrl || "").trim(),
    textImageCanvasNodeId: nodeId,
    textImageRunId: String(image.textImageRunId || "").trim(),
    textImagePrompt: compactMetadataText(image.textImagePrompt, 1200),
    textImageNegativePrompt: compactMetadataText(image.textImageNegativePrompt, 600),
    textImageModel: String(image.textImageModel || "").trim().slice(0, 180),
    textImageSize: String(image.textImageSize || "").trim().slice(0, 40),
    textImageCreatedAt: String(image.textImageCreatedAt || "").trim().slice(0, 80),
    textImageLinkedAt: String(image.textImageLinkedAt || "").trim().slice(0, 80)
  };
}

function videoImageSourceSummary(image = {}, index = 0) {
  const source = normalizeTextImageSourceMetadata(image);
  if (!source) return null;
  return {
    imageIndex: index + 1,
    imageName: String(image.name || "").slice(0, 240),
    imageType: String(image.type || "").slice(0, 120),
    imageSize: Number(image.size || 0),
    ...source,
    textImagePromptPreview: compactMetadataText(source.textImagePrompt, 500),
    textImageNegativePromptPreview: compactMetadataText(source.textImageNegativePrompt, 300)
  };
}

function buildVideoImageSourceSummaries(images = []) {
  return (Array.isArray(images) ? images : [])
    .map(videoImageSourceSummary)
    .filter(Boolean);
}

function boundedNumber(value, fallback, min, max) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

async function analyzeImagesWithQianwen(payload, signal) {
  const model = getVisionModel(payload);
  const imageContent = payload.images.slice(0, 3).map((image) => ({
    type: "image_url",
    image_url: { url: image.dataUrl }
  }));
  const response = await callChatCompletion({
    url: `${config.qianwenBaseUrl.replace(/\/$/, "")}/chat/completions`,
    apiKey: config.qianwenVlKey,
    model,
    messages: [
      {
        role: "system",
        content: "你是电商商品图识别助手。只基于图片和用户补充信息提取事实，不编造品牌、价格、材质成分。"
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "请识别这些产品图，输出中文结构化信息：品类/类别、主推商品、颜色、版型、材质观感、细节、搭配、适合人群、适合场景、风险点。品类要尽量用简短电商类目，例如男装、女装、美妆、家居、数码、食品、饰品、鞋包、运动、母婴、宠物、玩具。若图片里是男性模特穿着男款/男士服饰，优先输出男装；不要因为服饰是基础款、中性风或平台常规搜索习惯而改成女装。\n\n商品补充信息：\n" +
              (payload.productBrief || "无")
          },
          ...imageContent
        ]
      }
    ],
    temperature: 0.2,
    signal
  });
  return {
    text: extractAssistantText(response),
    usage: extractTokenUsage(response),
    model
  };
}

function buildLocalImageSummary(images) {
  if (!images.length) return "未上传产品图片，仅使用用户补充信息。";
  const lines = images.map((image, index) => {
    const sizeKb = image.size ? `${Math.round(image.size / 1024)}KB` : "未知大小";
    return `${index + 1}. ${image.name}，${image.type}，${sizeKb}`;
  });
  return [
    "已上传产品图片，但当前未配置视觉 API，因此只记录图片清单。",
    lines.join("\n"),
    "后续提示词生成需要结合用户填写的商品补充信息，不要编造图片中无法确认的细节。"
  ].join("\n");
}

function deriveSopSteps(promptText) {
  const text = String(promptText || "").replace(/\r/g, "").trim();
  if (!text) return [{ stepNo: 1, name: "按提示词包执行", instruction: "按用户上传的提示词包要求完成视频提示词生成。" }];

  const lines = text.split("\n");
  const headingPattern =
    /^\s*(第\s*[一二三四五六七八九十百千万零〇两\d]+\s*[步阶段环节]|步骤\s*[一二三四五六七八九十百千万零〇两\d]+|Step\s*\d+)\s*[：:、.\-\s]*(.{0,80})\s*$/i;
  const headings = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    const match = line.match(headingPattern);
    if (match) {
      const suffix = (match[2] || "").trim();
      headings.push({ index, title: suffix ? `${match[1].replace(/\s+/g, "")}：${suffix}` : match[1].replace(/\s+/g, "") });
    }
  }

  if (headings.length < 2) {
    const numeric = [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      const match = line.match(/^(\d{1,2})[\.、)]\s*(.{2,90})$/);
      if (match) numeric.push({ index, number: Number(match[1]), title: match[2].trim() });
    }
    const startsAtOne = numeric.findIndex((item) => item.number === 1);
    if (startsAtOne >= 0) {
      const sequence = [];
      let expected = 1;
      for (const item of numeric.slice(startsAtOne)) {
        if (item.number !== expected) break;
        sequence.push(item);
        expected += 1;
      }
      if (sequence.length >= 2) {
        headings.splice(0, headings.length, ...sequence.map((item) => ({ index: item.index, title: item.title })));
      }
    }
  }

  if (!headings.length) {
    return [{ stepNo: 1, name: "按提示词包执行", instruction: text }];
  }

  return headings.slice(0, 30).map((heading, index) => {
    const next = headings[index + 1]?.index ?? lines.length;
    const block = lines.slice(heading.index, next).join("\n").trim();
    const name = cleanStepTitle(heading.title, index + 1);
    return {
      stepNo: index + 1,
      name,
      instruction: block || name
    };
  });
}

function cleanStepTitle(title, index) {
  const cleaned = String(title || "")
    .replace(/\s+/g, " ")
    .replace(/^[:：、.\-\s]+/, "")
    .trim();
  return (cleaned || `步骤 ${index}`).slice(0, 80);
}

async function runDoubaoDynamicSteps(payload, imageAnalysis, run, sopSteps) {
  ensureRunActive(run);
  emit(run, {
    type: "status",
    phase: "步骤生成",
    message: `正在一次性生成 ${sopSteps.length} 个步骤的结果，完成后会按步骤直接显示输出。`
  });
  const analysisConfig = getAnalysisCompletionConfig(payload);
  const response = await callChatCompletion({
    url: analysisConfig.url,
    apiKey: analysisConfig.apiKey,
    model: analysisConfig.model,
    messages: buildBatchDoubaoMessages(payload, imageAnalysis, sopSteps),
    temperature: 0.25,
    signal: run.abortController.signal
  });
  ensureRunActive(run);
  const tokenUsage = addRunTokenUsage(run, extractTokenUsage(response), {
    phase: "步骤生成",
    model: analysisConfig.model,
    provider: analysisConfig.provider
  });
  if (tokenUsage) {
    emit(run, {
      type: "token_usage",
      phase: "步骤生成",
      message: "步骤生成模型调用已完成。",
      tokenUsage
    });
  }
  const text = extractAssistantText(response);
  const stepOutputs = parseBatchStepOutputs(text, sopSteps);
  for (const item of stepOutputs) {
    ensureRunActive(run);
    emit(run, {
      type: "step_completed",
      stepNo: item.stepNo,
      stepName: item.stepName,
      message: `${item.stepName}：已生成输出。`,
      output: item.output
    });
  }
  return stepOutputs;
}

async function runMockDynamicSteps(payload, imageAnalysis, run, sopSteps) {
  const outputs = [];
  for (const step of sopSteps) {
    ensureRunActive(run);
    await delay(120);
    ensureRunActive(run);
    const output = mockStepOutput(step, payload, imageAnalysis);
    outputs.push({ stepNo: step.stepNo, stepName: step.name, instruction: step.instruction, output });
    emit(run, {
      type: "step_completed",
      stepNo: step.stepNo,
      stepName: step.name,
      message: `${step.name}：已生成输出。`,
      output
    });
  }
  return outputs;
}

function buildBatchDoubaoMessages(payload, imageAnalysis, sopSteps) {
  const stepPlan = sopSteps
    .map((step, index) =>
      [
        `步骤序号：${index + 1}`,
        `步骤标题：${step.name}`,
        "步骤原文：",
        step.instruction
      ].join("\n")
    )
    .join("\n\n---\n\n");
  return [
    {
      role: "system",
      content:
        "你是电商 AI 视频提示词生产专家。你必须严格按用户文档里识别出的实际步骤执行，并为每一个步骤分别输出结果。不要只写“已完成”，每个步骤都要给出该步骤的实际产物。不要编造图片中没有的信息。所有输出使用简体中文。"
    },
    {
      role: "user",
      content: [
        "请一次性完成下面所有步骤，并返回 JSON。不要输出 Markdown，不要输出解释。",
        "",
        "JSON 格式：",
        "{\"steps\":[{\"stepNo\":1,\"stepName\":\"步骤标题\",\"output\":\"该步骤的实际输出结果\"}]}",
        "",
        "要求：",
        "1. steps 数量必须和下面步骤数量一致。",
        "2. stepNo 按 1、2、3 递增。",
        "3. stepName 使用下面给出的步骤标题。",
        "4. output 必须是该步骤真实产物，不要写空泛状态。",
        "5. 每个 output 可以直接显示在网页进度卡片里。",
        "",
        "商品名称：",
        payload.productName || "未填写",
        "",
        "类别：",
        payload.productCategory || "未分类",
        "",
        "商品补充信息：",
        payload.productBrief || "无",
        "",
        "产品图片识别结果：",
        imageAnalysis || "无",
        "",
        `目标视频规格：${payload.targetDuration} 秒，${payload.aspectRatio}。`,
        "",
        "完整提示词包/SOP 文档：",
        "```text",
        payload.promptPackText,
        "```",
        "",
        "需要执行的步骤：",
        stepPlan
      ].join("\n")
    }
  ];
}

function parseBatchStepOutputs(text, sopSteps) {
  const parsed = parseJsonLike(text);
  const rawSteps = Array.isArray(parsed?.steps) ? parsed.steps : Array.isArray(parsed) ? parsed : [];
  if (rawSteps.length) {
    return sopSteps.map((step, index) => {
      const raw = rawSteps[index] || rawSteps.find((item) => Number(item?.stepNo) === index + 1) || {};
      const output = String(raw.output || raw.result || raw.content || "").trim();
      return {
        stepNo: index + 1,
        stepName: String(raw.stepName || raw.name || step.name),
        instruction: step.instruction,
        output: output || fallbackStepOutputFromText(text, step, index)
      };
    });
  }
  return sopSteps.map((step, index) => ({
    stepNo: index + 1,
    stepName: step.name,
    instruction: step.instruction,
    output: fallbackStepOutputFromText(text, step, index)
  }));
}

function parseJsonLike(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function fallbackStepOutputFromText(text, step, index) {
  const source = String(text || "").trim();
  if (!source) return `${step.name} 未返回可解析输出。`;
  const escapedName = escapeRegExp(step.name);
  const byName = new RegExp(`${escapedName}[\\s\\S]*?(?=\\n\\s*(?:步骤\\s*\\d+|第\\s*[一二三四五六七八九十百千万零〇两\\d]+\\s*步)|$)`, "i").exec(source);
  if (byName?.[0]) return byName[0].trim();
  return index === 0 ? source.slice(0, 4000) : `${step.name} 的输出未能从模型返回中单独拆分。`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBaseDoubaoMessages(payload, imageAnalysis) {
  return [
    {
      role: "system",
      content:
        "你是电商 AI 视频提示词生产专家，任务是严格还原用户上传的人工 SOP。必须先完整阅读提示词包，再按系统识别出的实际步骤逐步执行。不能跳步，不能合并步骤，不能编造图片中没有的信息。所有输出使用简体中文。"
    },
    {
      role: "user",
      content: [
        "以下是用户上传的提示词包/SOP 文档：",
        "```text",
        payload.promptPackText,
        "```",
        "",
        "商品名称：",
        payload.productName || "未填写",
        "",
        "类别：",
        payload.productCategory || "未分类",
        "",
        "商品补充信息：",
        payload.productBrief || "无",
        "",
        "产品图片识别结果：",
        imageAnalysis || "无",
        "",
        `目标视频规格：${payload.targetDuration} 秒，${payload.aspectRatio}。`
      ].join("\n")
    }
  ];
}

async function packageFinalPromptWithDoubao(payload, imageAnalysis, steps, run) {
  ensureRunActive(run);
  const combinedStepOutputs = buildCombinedStepOutput(steps);
  const fallbackPrompt = steps.at(-1)?.output || "";
  const analysisConfig = getAnalysisCompletionConfig(payload);
  const response = await callChatCompletion({
    url: analysisConfig.url,
    apiKey: analysisConfig.apiKey,
    model: analysisConfig.model,
    messages: [
      {
        role: "system",
        content:
          "你是文生视频最终提示词封装器。请把所有步骤的演算结果整理成一个可以直接提交给视频生成模型的完整提示词，并给出结构化字段。"
      },
      {
        role: "user",
        content: [
          "请基于以下信息，输出 JSON，不要输出多余解释。",
          "JSON 字段：finalPrompt, videoParams, requiredAssets, negativeRules, qualityChecklist。",
          "",
          `目标视频规格：${payload.targetDuration} 秒，${payload.aspectRatio}`,
          "",
          "产品图片识别结果：",
          imageAnalysis,
          "",
          "全部步骤输出：",
          combinedStepOutputs
        ].join("\n")
      }
    ],
    temperature: 0.2,
    signal: run?.abortController?.signal
  });
  ensureRunActive(run);
  const tokenUsage = addRunTokenUsage(run, extractTokenUsage(response), {
    phase: "最终封装",
    model: analysisConfig.model,
    provider: analysisConfig.provider
  });
  if (tokenUsage) {
    emit(run, {
      type: "token_usage",
      phase: "最终封装",
      message: "最终封装模型调用已完成。",
      tokenUsage
    });
  }
  const text = extractAssistantText(response);
  return parsePackagedPrompt(text, payload, imageAnalysis, fallbackPrompt);
}

function packageFinalPromptLocally(payload, imageAnalysis, steps) {
  const combinedStepOutputs = buildCombinedStepOutput(steps);
  const finalPrompt = [
    `生成一条 ${payload.targetDuration} 秒 ${payload.aspectRatio} 电商带货视频。`,
    "必须严格遵循用户上传的提示词包规则，并基于产品图片识别结果完成画面设计。",
    "",
    "产品图片识别结果：",
    imageAnalysis,
    "",
    "步骤演算结果：",
    combinedStepOutputs,
    "",
    "统一要求：画面真实自然，商品主体清晰，镜头节奏明确，不出现水印、乱码、错误肢体、错误商品结构或无关品牌标识。"
  ].join("\n");
  return {
    finalPrompt,
    videoParams: { durationSeconds: payload.targetDuration, aspectRatio: payload.aspectRatio },
    requiredAssets: payload.images.map((image) => image.name),
    negativeRules: ["不要水印", "不要文字乱码", "不要商品变形", "不要错误肢体", "不要无关品牌标识"],
    qualityChecklist: ["商品主体清晰", "符合提示词包", "包含镜头时间线", "包含负面约束"],
    raw: "mock"
  };
}

function buildCombinedStepOutput(steps) {
  return steps
    .map((step, index) => {
      const output = String(step.output || "").slice(0, 3500);
      return [`步骤 ${index + 1}：${step.stepName || step.name || "未命名步骤"}`, output].join("\n");
    })
    .join("\n\n");
}

function parsePackagedPrompt(text, payload, imageAnalysis, fallbackPrompt) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      finalPrompt: String(parsed.finalPrompt || parsed.prompt || fallbackPrompt || text),
      videoParams: parsed.videoParams || { durationSeconds: payload.targetDuration, aspectRatio: payload.aspectRatio },
      requiredAssets: parsed.requiredAssets || payload.images.map((image) => image.name),
      negativeRules: parsed.negativeRules || [],
      qualityChecklist: parsed.qualityChecklist || [],
      raw: parsed
    };
  } catch {
    return {
      finalPrompt: fallbackPrompt || text,
      videoParams: { durationSeconds: payload.targetDuration, aspectRatio: payload.aspectRatio },
      requiredAssets: payload.images.map((image) => image.name),
      negativeRules: [],
      qualityChecklist: ["模型未返回 JSON，已保留原始最终提示词。"],
      raw: text,
      imageAnalysis
    };
  }
}

async function callChatCompletion({ url, apiKey, model, messages, temperature, signal }) {
  if (!apiKey) throw new Error("缺少后端 API Key，请检查 .env 配置。");
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(signal.reason || new RunCancelledError("用户已中断生成。"));
  if (signal?.aborted) abortFromParent();
  signal?.addEventListener?.("abort", abortFromParent, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("模型调用超时。")), config.modelRequestTimeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature
      }),
      signal: controller.signal
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || text || `HTTP ${response.status}`;
      throw new Error(`模型调用失败：${message}`);
    }
    return data;
  } catch (error) {
    if (signal?.aborted) throw new RunCancelledError("用户已中断生成。");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.("abort", abortFromParent);
  }
}

async function callImageGeneration(payload, signal) {
  if (!config.arkKey) throw new Error("缺少 ARK_API_KEY，不能调用图片生成模型。");
  if (!config.imageGenerationUrl) throw new Error("缺少 SEEDREAM_API_URL，不能调用图片生成模型。");
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(signal.reason || new RunCancelledError("用户已中断图片生成。"));
  if (signal?.aborted) abortFromParent();
  signal?.addEventListener?.("abort", abortFromParent, { once: true });
  const timeout = setTimeout(() => controller.abort(new Error("图片生成调用超时。")), config.modelRequestTimeoutMs);
  try {
    const requestBody = {
      model: payload.model,
      prompt: imageGenerationPrompt(payload),
      size: payload.size,
      n: payload.count,
      response_format: payload.responseFormat
    };
    if (payload.mode === "image-variation" && payload.referenceImages?.length) {
      requestBody.image = payload.referenceImages.map((image) => image.dataUrl).filter(Boolean);
      if (payload.count > 1) {
        requestBody.sequential_image_generation = "auto";
        requestBody.sequential_image_generation_options = { max_images: payload.count };
      }
    }
    const response = await fetch(config.imageGenerationUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.arkKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const message = data?.error?.message || data?.message || text || `HTTP ${response.status}`;
      throw new Error(`图片生成模型调用失败：${message}`);
    }
    const images = extractGeneratedImageItems(data);
    if (!images.length) throw new Error("图片生成模型没有返回图片。");
    return { images, raw: data };
  } catch (error) {
    if (signal?.aborted) throw new RunCancelledError("用户已中断图片生成。");
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.("abort", abortFromParent);
  }
}

function imageGenerationPrompt(payload = {}) {
  const prompt = String(payload.prompt || "").trim();
  const negativePrompt = String(payload.negativePrompt || "").trim();
  if (!negativePrompt) return prompt;
  return `${prompt}\n\n请避免出现：${negativePrompt}`;
}

function extractGeneratedImageItems(data = {}) {
  const source = data.data || data.images || data.output?.images || data.result?.images || (data.image ? [data.image] : []);
  const items = Array.isArray(source) ? source : source && typeof source === "object" ? [source] : [];
  return items
    .map((item) => ({
      url: item?.url || item?.image_url || item?.imageUrl || item?.content?.url || "",
      b64: item?.b64_json || item?.b64 || item?.base64 || item?.image_base64 || "",
      revisedPrompt: item?.revised_prompt || item?.revisedPrompt || "",
      raw: item
    }))
    .filter((item) => item.url || item.b64);
}

async function readGeneratedImageBuffer(item) {
  if (item.b64) {
    const dataUrlMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(String(item.b64));
    if (dataUrlMatch) {
      return { buffer: Buffer.from(dataUrlMatch[2], "base64"), mime: dataUrlMatch[1] };
    }
    return { buffer: Buffer.from(String(item.b64), "base64"), mime: "image/png" };
  }
  if (!item.url) throw new Error("文生图返回缺少图片地址。");
  if (String(item.url).startsWith("data:image/")) {
    const parsed = parseDataUrlImage({ dataUrl: item.url, name: "generated.png" });
    return { buffer: parsed.buffer, mime: parsed.mime };
  }
  const response = await fetch(item.url);
  if (!response.ok) throw new Error(`下载生成图片失败：HTTP ${response.status}`);
  const mime = response.headers.get("content-type")?.split(";")[0] || "image/png";
  return { buffer: Buffer.from(await response.arrayBuffer()), mime };
}

async function saveGeneratedImages(items, payload, runId) {
  await mkdir(IMAGE_OUTPUT_DIR, { recursive: true });
  const now = new Date();
  const datePart = formatDatePart(now);
  const timePart = formatTimePart(now);
  const ownerPrefix = imageOutputOwnerPrefix(payload.ownerUserId);
  const promptPart = safeFilePart(payload.prompt).slice(0, 32) || "prompt";
  const modePart = payload.mode === "image-variation" ? "img2img" : "txt2img";
  const images = [];
  for (const [index, item] of items.entries()) {
    const parsed = await readGeneratedImageBuffer(item);
    const ext = imageExtension(parsed.mime, item.url || "generated.png");
    const fileName = `${ownerPrefix}-${modePart}-${datePart}-${timePart}-${runId.slice(0, 8)}-${String(index + 1).padStart(2, "0")}-${promptPart}${ext}`;
    const filePath = path.join(IMAGE_OUTPUT_DIR, fileName);
    await writeFile(filePath, parsed.buffer);
    const metaName = `${path.parse(fileName).name}.json`;
    await writeFile(
      path.join(IMAGE_OUTPUT_DIR, metaName),
      JSON.stringify({
        mode: payload.mode,
        prompt: payload.prompt,
        userPrompt: payload.userPrompt,
        negativePrompt: payload.negativePrompt,
        variationIntent: payload.variationIntent,
        variationLabel: payload.variationLabel,
        variationStrength: payload.variationStrength,
        variationStrengthLabel: payload.variationStrengthLabel,
        model: payload.model,
        size: payload.size,
        revisedPrompt: item.revisedPrompt,
        sourceUrl: item.url,
        createdAt: now.toISOString()
      }, null, 2),
      "utf8"
    );
    images.push({
      name: fileName,
      kind: "text-image",
      role: payload.mode === "image-variation" ? "variation" : "generated",
      mime: parsed.mime,
      size: parsed.buffer.length,
      revisedPrompt: item.revisedPrompt,
      url: `/api/output-file?kind=text-image&name=${encodeURIComponent(fileName)}`
    });
  }
  return images;
}

async function saveVariationReferenceImages(items = [], payload = {}, runId = "") {
  if (!items.length) return [];
  await mkdir(IMAGE_OUTPUT_DIR, { recursive: true });
  const now = new Date();
  const datePart = formatDatePart(now);
  const timePart = formatTimePart(now);
  const ownerPrefix = imageOutputOwnerPrefix(payload.ownerUserId);
  const images = [];
  for (const [index, image] of items.entries()) {
    const parsed = parseDataUrlImage(image);
    const ext = imageExtension(parsed.mime, image.name || "reference.png");
    const sourcePart = safeFilePart(path.parse(image.name || "reference").name || "reference").slice(0, 32);
    const fileName = `${ownerPrefix}-img2img-source-${datePart}-${timePart}-${runId.slice(0, 8)}-${String(index + 1).padStart(2, "0")}-${sourcePart}${ext}`;
    const filePath = path.join(IMAGE_OUTPUT_DIR, fileName);
    await writeFile(filePath, parsed.buffer);
    images.push({
      name: fileName,
      originalName: image.name || "reference",
      kind: "text-image",
      role: "source",
      mime: parsed.mime,
      size: parsed.buffer.length,
      url: `/api/output-file?kind=text-image&name=${encodeURIComponent(fileName)}`
    });
  }
  return images;
}

async function ensureTextImageCanvasSchema() {
  if (textImageCanvasSchemaReadyPromise) return textImageCanvasSchemaReadyPromise;
  textImageCanvasSchemaReadyPromise = executeSqliteMany([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS text_image_canvas_nodes (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT NOT NULL,
          run_id TEXT,
          node_type TEXT NOT NULL DEFAULT 'image',
          x REAL NOT NULL DEFAULT 0,
          y REAL NOT NULL DEFAULT 0,
          width REAL NOT NULL DEFAULT 260,
          height REAL NOT NULL DEFAULT 340,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
      params: []
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_text_image_canvas_nodes_owner ON text_image_canvas_nodes(owner_user_id, created_at)",
      params: []
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_text_image_canvas_nodes_run ON text_image_canvas_nodes(run_id)",
      params: []
    }
  ]);
  return textImageCanvasSchemaReadyPromise;
}

function hydrateTextImageCanvasNode(row = {}) {
  let payload = {};
  try {
    payload = JSON.parse(row.payload_json || "{}");
  } catch {
    payload = {};
  }
  return {
    id: row.id,
    runId: row.run_id || "",
    type: row.node_type || "image",
    x: Number(row.x || 0),
    y: Number(row.y || 0),
    width: Number(row.width || 260),
    height: Number(row.height || 340),
    payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listTextImageCanvasNodes(ownerUserId = defaultOwnerUserId(), limit = 300) {
  await ensureTextImageCanvasSchema();
  const rows = await querySqlite(
    `
    SELECT *
    FROM text_image_canvas_nodes
    WHERE owner_user_id = ?
    ORDER BY created_at ASC
    LIMIT ?
    `,
    [ownerUserId || defaultOwnerUserId(), boundedNumber(limit, 300, 1, 1000)]
  );
  return rows.map(hydrateTextImageCanvasNode);
}

async function appendTextImageCanvasNodes(images = [], payload = {}, runId = "", options = {}) {
  await ensureTextImageCanvasSchema();
  const ownerUserId = String(payload.ownerUserId || "").trim() || defaultOwnerUserId();
  const countRows = await querySqlite(
    "SELECT COUNT(*) AS total FROM text_image_canvas_nodes WHERE owner_user_id = ?",
    [ownerUserId]
  );
  const startIndex = Number(countRows[0]?.total || 0);
  const now = new Date().toISOString();
  const nodeWidth = 260;
  const nodeHeight = 350;
  const columns = 4;
  const gapX = 310;
  const gapY = 420;
  const isVariation = payload.mode === "image-variation";
  const referenceImages = Array.isArray(options.referenceImages) ? options.referenceImages : [];
  const baseCol = startIndex % columns;
  const baseRow = Math.floor(startIndex / columns);
  const baseX = 80 + baseCol * gapX;
  const baseY = 80 + baseRow * gapY;
  const sourceItems = isVariation
    ? referenceImages.map((image, index) => ({
        image,
        type: "source-image",
        title: `裂变原图 ${String(index + 1).padStart(2, "0")}`,
        role: "source",
        index
      }))
    : [];
  const sourceNodeIds = sourceItems.map(() => randomUUID());
  const generatedItems = images.map((image, index) => ({
    image,
    type: isVariation ? "image-variation" : "image",
    title: isVariation ? `裂变图 ${String(index + 1).padStart(2, "0")}` : `文生图 ${String(startIndex + sourceItems.length + index + 1).padStart(2, "0")}`,
    role: isVariation ? "variation" : "generated",
    sourceNodeId: sourceNodeIds[0] || "",
    index
  }));
  const canvasItems = [...sourceItems.map((item, index) => ({ ...item, id: sourceNodeIds[index] })), ...generatedItems];
  const operations = canvasItems.map((item, index) => {
    const absoluteIndex = startIndex + index;
    const col = absoluteIndex % columns;
    const row = Math.floor(absoluteIndex / columns);
    const variantIndex = Math.max(0, index - sourceItems.length);
    const variationX = item.role === "source" ? baseX : baseX + gapX + (variantIndex % 3) * gapX;
    const variationY = item.role === "source" ? baseY : baseY + Math.floor(variantIndex / 3) * gapY;
    const node = {
      id: item.id || randomUUID(),
      runId,
      type: item.type,
      x: isVariation ? variationX : 80 + col * gapX,
      y: isVariation ? variationY : 80 + row * gapY,
      width: nodeWidth,
      height: nodeHeight,
      payload: {
        mode: payload.mode || "text-image",
        title: item.title,
        prompt: payload.prompt,
        userPrompt: payload.userPrompt,
        negativePrompt: payload.negativePrompt,
        model: payload.model,
        size: payload.size,
        variationIntent: payload.variationIntent,
        variationLabel: payload.variationLabel,
        variationStrength: payload.variationStrength,
        variationStrengthLabel: payload.variationStrengthLabel,
        sourceNodeId: item.sourceNodeId || "",
        image: item.image
      },
      createdAt: now,
      updatedAt: now
    };
    return {
      node,
      sql: `
        INSERT INTO text_image_canvas_nodes (
          id, owner_user_id, run_id, node_type, x, y, width, height, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        node.id,
        ownerUserId,
        node.runId,
        node.type,
        node.x,
        node.y,
        node.width,
        node.height,
        JSON.stringify(node.payload),
        now,
        now
      ]
    };
  });
  await executeSqliteMany(operations.map(({ sql, params }) => ({ sql, params })));
  return operations.map(({ node }) => node);
}

async function updateTextImageCanvasNode(nodeId, patch = {}, ownerUserId = defaultOwnerUserId()) {
  await ensureTextImageCanvasSchema();
  const id = String(nodeId || "").trim();
  if (!id) throw new Error("缺少节点编号。");
  const x = boundedNumber(patch.x, 0, -20000, 20000);
  const y = boundedNumber(patch.y, 0, -20000, 20000);
  const now = new Date().toISOString();
  await executeSqlite(
    `
    UPDATE text_image_canvas_nodes
    SET x = ?, y = ?, updated_at = ?
    WHERE id = ? AND owner_user_id = ?
    `,
    [x, y, now, id, ownerUserId || defaultOwnerUserId()]
  );
  const rows = await querySqlite(
    "SELECT * FROM text_image_canvas_nodes WHERE id = ? AND owner_user_id = ? LIMIT 1",
    [id, ownerUserId || defaultOwnerUserId()]
  );
  if (!rows.length) return null;
  return hydrateTextImageCanvasNode(rows[0]);
}

async function deleteTextImageCanvasNode(nodeId, ownerUserId = defaultOwnerUserId()) {
  await ensureTextImageCanvasSchema();
  const id = String(nodeId || "").trim();
  if (!id) throw new Error("缺少节点编号。");
  const rows = await querySqlite(
    "SELECT id FROM text_image_canvas_nodes WHERE id = ? AND owner_user_id = ? LIMIT 1",
    [id, ownerUserId || defaultOwnerUserId()]
  );
  if (!rows.length) return null;
  await executeSqlite(
    "DELETE FROM text_image_canvas_nodes WHERE id = ? AND owner_user_id = ?",
    [id, ownerUserId || defaultOwnerUserId()]
  );
  return { id };
}

async function ensureVideoTaskSourceLinkSchema() {
  if (videoTaskSourceLinkSchemaReadyPromise) return videoTaskSourceLinkSchemaReadyPromise;
  videoTaskSourceLinkSchemaReadyPromise = executeSqliteMany([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS video_task_source_links (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT,
          task_code TEXT NOT NULL,
          source_type TEXT NOT NULL,
          source_id TEXT NOT NULL,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL
        )
      `,
      params: []
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_video_task_source_links_task ON video_task_source_links(task_code, source_type)",
      params: []
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_video_task_source_links_owner ON video_task_source_links(owner_user_id, created_at)",
      params: []
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_video_task_source_links_source ON video_task_source_links(source_type, source_id)",
      params: []
    }
  ]);
  return videoTaskSourceLinkSchemaReadyPromise;
}

async function recordVideoTaskSourceLinks(taskCode, images = [], ownerUserId = defaultOwnerUserId()) {
  const sourceLinks = buildVideoImageSourceSummaries(images);
  if (!taskCode || !sourceLinks.length) return [];
  await ensureVideoTaskSourceLinkSchema();
  const now = new Date().toISOString();
  const operations = [
    {
      sql: "DELETE FROM video_task_source_links WHERE task_code = ? AND source_type = 'text-image-canvas'",
      params: [taskCode]
    },
    ...sourceLinks.map((source, index) => {
      const sourceId = source.textImageCanvasNodeId || source.sourceUrl || `${taskCode}-${index + 1}`;
      return {
        sql: `
          INSERT INTO video_task_source_links (
            id, owner_user_id, task_code, source_type, source_id, payload_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          `${taskCode}-text-image-${hashText(sourceId).slice(0, 12)}-${index + 1}`,
          ownerUserId || defaultOwnerUserId(),
          taskCode,
          "text-image-canvas",
          sourceId,
          JSON.stringify(source),
          now
        ]
      };
    })
  ];
  await executeSqliteMany(operations);
  return sourceLinks.map((source) => ({
    sourceType: "text-image-canvas",
    sourceId: source.textImageCanvasNodeId || source.sourceUrl || "",
    textImageCanvasNodeId: source.textImageCanvasNodeId,
    imageIndex: source.imageIndex
  }));
}

function extractAssistantText(response) {
  const message = response?.choices?.[0]?.message;
  const content = message?.content;
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || "").join("\n").trim();
  }
  if (typeof content === "string") return content.trim();
  if (typeof response?.output_text === "string") return response.output_text.trim();
  return JSON.stringify(response, null, 2);
}

function mockStepOutput(step, payload, imageAnalysis) {
  const lowerName = String(step.name || "").toLowerCase();
  if (lowerName.includes("图") || lowerName.includes("image") || lowerName.includes("产品")) {
    return [
      `${step.name} 已按提示词包规则执行。`,
      "产品识别信息：",
      imageAnalysis || "无",
      "商品补充信息：",
      payload.productBrief || "无"
    ].join("\n");
  }
  return [
    `${step.name} 已按提示词包规则执行。`,
    "本地模拟模式下保留该步骤输出占位。",
    "步骤原文：",
    step.instruction
  ].join("\n");
}

async function submitLibTVVideo(payload, run = null) {
  const normalized = normalizeVideoPayload(payload);
  const emitVideo = (event) => {
    if (run) emit(run, event);
  };

  emitVideo({ type: "status", phase: "保存输入", message: "正在保存最终提示词和产品图片。" });
  const saved = await saveVideoInputFiles(normalized);

  emitVideo({ type: "status", phase: "写入数据库", message: `正在注册数据库任务 ${saved.taskCode}。` });
  const registered = await registerLibTVTask(normalized, saved);
  const sourceLinks = await recordVideoTaskSourceLinks(
    saved.taskCode,
    normalized.images,
    normalized.ownerUserId || defaultOwnerUserId()
  );

  const action = normalized.dryRun ? "submit" : normalized.waitForVideo ? "run" : "submit";
  const bridgePayload = {
    action,
    task_code: saved.taskCode,
    db: config.libtvDbPath,
    node_name: saved.libtvNodeName,
    dry_run: normalized.dryRun,
    ratio: normalized.aspectRatio,
    duration: String(normalized.duration),
    count: String(normalized.count),
    enable_sound: normalized.enableSound ? "on" : "off",
    auto_compliance: normalized.autoCompliance ? "1" : "0",
    search_enabled: normalized.searchEnabled ? "1" : "0",
    project_id: config.libtvSharedProjectUuid,
    project_name: config.libtvSharedProjectName,
    download: normalized.download,
    poll_interval: String(normalized.pollInterval),
    max_wait_seconds: String(normalized.maxWaitSeconds)
  };
  if (normalized.model) bridgePayload.model = normalized.model;
  if (normalized.resolution) bridgePayload.resolution = normalized.resolution;

  emitVideo({
    type: "status",
    phase: "提交 libTV",
    message: [
      normalized.dryRun
        ? "正在做 libTV 提交前验证，不会真实提交。"
        : normalized.waitForVideo
          ? "正在真实提交 libTV，并等待生成结果。"
          : "正在真实提交 libTV 任务。",
      normalized.autoCompliance ? "已开启真人素材自动合规校验。" : "未开启自动合规校验。"
    ].join(" ")
  });
  const bridgeTimeout = normalized.waitForVideo ? (normalized.maxWaitSeconds + 900) * 1000 : 180000;
  let bridgeResult;
  try {
    bridgeResult = await callLibTVBridge(bridgePayload, bridgeTimeout);
  } catch (error) {
    if (!normalized.dryRun && normalized.waitForVideo) {
      emitVideo({
        type: "status",
        phase: "确认 libTV 结果",
        message: "桥接连接中断，正在从数据库确认 libTV 是否已经生成完成。"
      });
      bridgeResult = await recoverLibTVResultFromDatabase(saved, error);
    } else {
      throw error;
    }
  }

  return {
    mode: normalized.dryRun ? "dry_run" : normalized.waitForVideo ? "run" : "submit",
    taskCode: saved.taskCode,
    libtvNodeName: saved.libtvNodeName,
    taskDate: saved.taskDate,
    taskCategory: normalized.productCategory,
    taskCategoryCode: saved.categoryCode,
    taskSerial: saved.serial,
    productName: normalized.productName,
    database: config.libtvDbPath,
    files: {
      runDir: saved.runDir,
      promptDoc: saved.promptDocPath,
      packageJson: saved.packageJsonPath,
      primaryImage: saved.primaryImagePath,
      images: saved.images.map((image) => image.path)
    },
    sourceLinks,
    registered,
    bridge: bridgeResult
  };
}

async function runStitchJob(run, payload) {
  try {
    emit(run, { type: "status", phase: "准备拼接", message: "正在校验视频列表和拼接参数。" });
    const result = await stitchVideos(payload, run);
    run.status = "completed";
    run.result = result;
    emit(run, {
      type: "completed",
      phase: "拼接完成",
      message: `已生成 ${result.outputs.length} 个拼接视频。`,
      result
    });
  } catch (error) {
    run.status = "failed";
    run.error = error.message;
    emit(run, {
      type: "failed",
      phase: "拼接失败",
      message: error.message
    });
  }
}

async function stitchVideos(payload, run = null) {
  const normalized = normalizeStitchPayload(payload);
  const runCode = `STITCH-${formatDatePart(new Date())}-${formatTimePart(new Date())}-${randomUUID().slice(0, 8)}`;
  const runDir = path.join(config.runStorageDir, "stitch", safeFilePart(runCode));
  await mkdir(runDir, { recursive: true });
  await mkdir(STITCH_OUTPUT_DIR, { recursive: true });

  const groups = chunkArray(normalized.videos, normalized.groupSize).filter((group) => group.length >= 2);
  if (!groups.length) throw new Error("至少需要 2 个视频才能拼接。");

  const outputs = [];
  for (let index = 0; index < groups.length; index += 1) {
    const groupNo = index + 1;
    const group = groups[index];
    emit(run, {
      type: "status",
      phase: `准备第 ${groupNo} 组`,
      message: `正在准备第 ${groupNo} 组 ${group.length} 个视频素材。`
    });
    const inputFiles = [];
    for (let videoIndex = 0; videoIndex < group.length; videoIndex += 1) {
      inputFiles.push(await materializeStitchInput(group[videoIndex], runDir, groupNo, videoIndex + 1));
    }

    const listPath = path.join(runDir, `concat-${String(groupNo).padStart(2, "0")}.txt`);
    await writeFile(listPath, inputFiles.map((filePath) => `file '${escapeFfmpegConcatPath(filePath)}'`).join("\n"), "utf8");

    const outputName = `${runCode}-${String(groupNo).padStart(2, "0")}.mp4`;
    const outputPath = path.join(STITCH_OUTPUT_DIR, outputName);
    emit(run, {
      type: "status",
      phase: `合成第 ${groupNo} 组`,
      message: "正在调用 ffmpeg 合成视频。"
    });
    const ffmpegResult = await runFfmpegConcat(listPath, outputPath);
    const fileStat = await stat(outputPath);
    const output = {
      groupNo,
      name: outputName,
      path: outputPath,
      url: `/api/output-file?kind=stitched&name=${encodeURIComponent(outputName)}`,
      size: fileStat.size,
      updatedAt: fileStat.mtime.toISOString(),
      inputs: group.map((video) => ({
        name: video.name,
        taskCode: video.taskCode,
        source: video.source,
        url: video.url
      })),
      ffmpegMode: ffmpegResult.mode
    };
    outputs.push(output);
    emit(run, {
      type: "group_completed",
      phase: `第 ${groupNo} 组完成`,
      message: `第 ${groupNo} 组已生成：${outputName}`,
      result: output
    });
  }

  return {
    ok: true,
    runCode,
    runDir,
    groupSize: normalized.groupSize,
    inputCount: normalized.videos.length,
    outputs
  };
}

function normalizeStitchPayload(payload = {}) {
  const videos = Array.isArray(payload.videos)
    ? payload.videos.map((video, index) => ({
        id: String(video.id || `video-${index + 1}`),
        name: String(video.name || `视频 ${index + 1}`),
        source: String(video.source || ""),
        taskCode: String(video.taskCode || ""),
        url: String(video.url || "").trim()
      })).filter((video) => video.url)
    : [];
  if (videos.length < 2) throw new Error("请至少选择 2 个视频进行拼接。");
  return {
    videos: videos.slice(0, 50),
    groupSize: boundedNumber(payload.groupSize, 2, 2, 20)
  };
}

async function materializeStitchInput(video, runDir, groupNo, videoNo) {
  const source = video.url;
  if (/^https?:\/\//i.test(source)) {
    const ext = path.extname(new URL(source).pathname).toLowerCase() || ".mp4";
    const filePath = path.join(runDir, `g${groupNo}-input-${String(videoNo).padStart(2, "0")}${ext === ".mp4" ? ext : ".mp4"}`);
    await downloadVideoFile(source, filePath);
    return filePath;
  }

  const filePath = path.resolve(source);
  const allowed = [OUTPUT_DIR, STITCH_OUTPUT_DIR, config.runStorageDir].some((dir) => isPathInside(filePath, dir));
  if (!allowed) throw new Error(`视频路径不在允许目录内：${source}`);
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) throw new Error(`视频文件不存在：${source}`);
  return filePath;
}

async function downloadVideoFile(url, filePath) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`下载视频失败：HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(filePath, buffer);
  } finally {
    clearTimeout(timeout);
  }
}

async function runFfmpegConcat(listPath, outputPath) {
  const commonArgs = ["-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", listPath];
  try {
    await runProcess(config.ffmpegExe, [...commonArgs, "-c", "copy", "-movflags", "+faststart", outputPath], {
      cwd: WORKFLOW_DIR
    });
    return { mode: "copy" };
  } catch (copyError) {
    await runProcess(
      config.ffmpegExe,
      [...commonArgs, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-movflags", "+faststart", outputPath],
      { cwd: WORKFLOW_DIR }
    );
    return { mode: "transcode", copyError: copyError.message };
  }
}

function chunkArray(items, size) {
  const output = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

function escapeFfmpegConcatPath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

function isPathInside(filePath, dir) {
  const relative = path.relative(path.resolve(dir), path.resolve(filePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function formatDatePart(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("");
}

function formatTimePart(date) {
  return [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0")
  ].join("");
}

function formatCompactDateTime(date = new Date()) {
  return `${formatDatePart(date)}-${formatTimePart(date)}`;
}

async function recoverLibTVResultFromDatabase(saved, originalError) {
  const deadline = Date.now() + 180000;
  let lastSnapshot = null;
  while (Date.now() <= deadline) {
    lastSnapshot = await readLibTVTaskSnapshot(saved.taskCode);
    if (lastSnapshot?.video_url && lastSnapshot?.libtv_status === "succeeded") {
      return {
        ok: true,
        action: "run",
        recovered: true,
        original_error: originalError.message,
        returncode: 0,
        result: {
          submit: {
            task_code: lastSnapshot.task_code,
            projectUuid: lastSnapshot.libtv_project_id,
            nodeName: lastSnapshot.libtv_node_name,
            nodeKey: lastSnapshot.external_job_id,
            status: "submitted"
          },
          poll: {
            task_code: lastSnapshot.task_code,
            projectUuid: lastSnapshot.libtv_project_id,
            nodeRef: lastSnapshot.external_job_id || lastSnapshot.libtv_node_name,
            status: "succeeded",
            video_url: lastSnapshot.video_url,
            cover_url: lastSnapshot.cover_url
          }
        }
      };
    }
    if (lastSnapshot?.libtv_status === "failed" || lastSnapshot?.error_message) {
      throw new Error(lastSnapshot.error_message || originalError.message);
    }
    await delay(5000);
  }
  throw originalError;
}

async function readLibTVTaskSnapshot(taskCode) {
  const script = `
import json
import sqlite3
import sys

db_path = sys.argv[1]
task_code = sys.argv[2]
con = sqlite3.connect(db_path, timeout=180)
con.execute("PRAGMA busy_timeout=180000")
con.row_factory = sqlite3.Row
row = con.execute("""
SELECT
  vt.task_code,
  vt.status AS task_status,
  vt.libtv_node_name,
  vt.libtv_project_id,
  lj.status AS libtv_status,
  lj.external_job_id,
  lj.video_url,
  lj.cover_url,
  lj.error_message
FROM video_tasks vt
LEFT JOIN libtv_jobs lj ON lj.task_id = vt.id
WHERE vt.task_code = ?
ORDER BY lj.created_at DESC
LIMIT 1
""", (task_code,)).fetchone()
print(json.dumps(dict(row) if row else None, ensure_ascii=False))
`;
  const result = await runProcess(config.pythonExe, pythonInlineArgs(script, config.libtvDbPath, taskCode), {
    cwd: WORKFLOW_DIR,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8"
    }
  });
  return parseJsonFromText(result.stdout, "无法读取 libTV 数据库结果。");
}

function cleanLibtvErrorMessage(message) {
  const text = String(message || "").trim();
  if (!text) return "";
  const questionCount = (text.match(/\?/g) || []).length;
  if (/libtv command failed|autoCompliance=1|Seedance2\.0|合规检测|真人|角色库/i.test(text)) {
    return "libTV 合规校验未通过：参考图可能包含真人形象，请先在 libTV 角色库完成人物资产录入或合规校验后再重试。";
  }
  if (questionCount >= 8 && questionCount / Math.max(text.length, 1) > 0.2) {
    return "libTV 返回的错误信息编码异常，请打开 libTV 任务详情查看真实失败原因。";
  }
  return text;
}

function cleanLibtvRows(rows) {
  return rows.map((row) => {
    const next = { ...row };
    for (const key of Object.keys(next)) {
      if (key.includes("\u9519\u8bef") || key === "error_message") {
        next[key] = cleanLibtvErrorMessage(next[key]);
      }
    }
    return next;
  });
}

async function querySqlite(sql, params = []) {
  const script = `
import json
import sqlite3
import sys

db_path = sys.argv[1]
sql = sys.argv[2]
params_arg = sys.argv[3]
if params_arg.startswith("@"):
    with open(params_arg[1:], "r", encoding="utf-8") as fh:
        params_arg = fh.read()
params = json.loads(params_arg)
con = sqlite3.connect(db_path, timeout=180)
con.execute("PRAGMA busy_timeout=180000")
con.row_factory = sqlite3.Row
rows = con.execute(sql, params).fetchall()
print(json.dumps([dict(row) for row in rows], ensure_ascii=False))
`;
  const paramsArg = await processJsonArg(params);
  let result;
  try {
    result = await runProcess(config.pythonExe, pythonInlineArgs(script, config.libtvDbPath, sql, paramsArg.arg), {
      cwd: WORKFLOW_DIR,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8"
      }
    });
  } finally {
    await paramsArg.cleanup();
  }
  return parseJsonFromText(result.stdout, "无法读取 SQLite 查询结果。");
}

async function executeSqlite(sql, params = []) {
  const script = `
import json
import sqlite3
import sys

db_path = sys.argv[1]
sql = sys.argv[2]
params_arg = sys.argv[3]
if params_arg.startswith("@"):
    with open(params_arg[1:], "r", encoding="utf-8") as fh:
        params_arg = fh.read()
params = json.loads(params_arg)
con = sqlite3.connect(db_path, timeout=180)
con.execute("PRAGMA busy_timeout=180000")
con.execute("PRAGMA foreign_keys=ON")
con.execute(sql, params)
con.commit()
print(json.dumps({"ok": True}, ensure_ascii=False))
`;
  const paramsArg = await processJsonArg(params);
  let result;
  try {
    result = await runProcess(config.pythonExe, pythonInlineArgs(script, config.libtvDbPath, sql, paramsArg.arg), {
      cwd: WORKFLOW_DIR,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8"
      }
    });
  } finally {
    await paramsArg.cleanup();
  }
  return parseJsonFromText(result.stdout, "无法写入 SQLite。");
}

async function executeSqliteMany(operations = []) {
  if (!operations.length) return { ok: true, changes: 0 };
  const script = `
import json
import sqlite3
import sys

db_path = sys.argv[1]
operations_arg = sys.argv[2]
if operations_arg.startswith("@"):
    with open(operations_arg[1:], "r", encoding="utf-8") as fh:
        operations_arg = fh.read()
operations = json.loads(operations_arg)
con = sqlite3.connect(db_path, timeout=180)
con.execute("PRAGMA busy_timeout=180000")
con.execute("PRAGMA foreign_keys=ON")
cur = con.cursor()
for item in operations:
    cur.execute(item["sql"], item.get("params", []))
con.commit()
print(json.dumps({"ok": True, "changes": len(operations)}, ensure_ascii=False))
`;
  const operationsArg = await processJsonArg(operations);
  let result;
  try {
    result = await runProcess(config.pythonExe, pythonInlineArgs(script, config.libtvDbPath, operationsArg.arg), {
      cwd: WORKFLOW_DIR,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8"
      }
    });
  } finally {
    await operationsArg.cleanup();
  }
  return parseJsonFromText(result.stdout, "无法批量写入 SQLite。");
}

async function ensureSelectionAssetSchema() {
  if (selectionAssetSchemaReadyPromise) return selectionAssetSchemaReadyPromise;
  selectionAssetSchemaReadyPromise = executeSqliteMany([
    {
      sql: `
        CREATE TABLE IF NOT EXISTS selection_products (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT,
          rank_no INTEGER NOT NULL DEFAULT 999,
          sku TEXT NOT NULL,
          category TEXT NOT NULL,
          node TEXT,
          lifecycle TEXT NOT NULL DEFAULT '候选',
          asset_status TEXT NOT NULL DEFAULT '待补资产',
          asset_percent INTEGER NOT NULL DEFAULT 0,
          risk_level TEXT NOT NULL DEFAULT '中',
          total_score INTEGER NOT NULL DEFAULT 0,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
      params: []
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_selection_products_score ON selection_products(total_score DESC, rank_no ASC)",
      params: []
    },
    {
      sql: "CREATE INDEX IF NOT EXISTS idx_selection_products_lifecycle ON selection_products(lifecycle, asset_percent DESC)",
      params: []
    },
    {
      sql: `
        CREATE TABLE IF NOT EXISTS account_assets (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT,
          name TEXT NOT NULL,
          position TEXT,
          payload_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `,
      params: []
    }
  ]);
  return selectionAssetSchemaReadyPromise;
}

function parseStoredJson(value, fallback = {}) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function hydrateSelectionProduct(row = {}) {
  const payload = parseStoredJson(row.payload_json, {});
  return {
    ...payload,
    id: row.id,
    rank: Number(row.rank_no ?? payload.rank ?? 999),
    sku: row.sku || payload.sku || "",
    category: row.category || payload.category || "",
    node: row.node || payload.node || "",
    lifecycle: row.lifecycle || payload.lifecycle || "候选",
    assetStatus: row.asset_status || payload.assetStatus || "待补资产",
    assetPercent: Number(row.asset_percent ?? payload.assetPercent ?? 0),
    riskLevel: row.risk_level || payload.riskLevel || "中",
    totalScore: Number(row.total_score ?? payload.totalScore ?? 0),
    createdAt: row.created_at || payload.createdAt || "",
    updatedAt: row.updated_at || payload.updatedAt || ""
  };
}

function hydrateAccountAsset(row = {}) {
  const payload = parseStoredJson(row.payload_json, {});
  return {
    ...payload,
    id: row.id,
    name: row.name || payload.name || "",
    position: row.position || payload.position || "",
    createdAt: row.created_at || payload.createdAt || "",
    updatedAt: row.updated_at || payload.updatedAt || ""
  };
}

function batchRecordTime(record = {}) {
  return new Date(record.updatedAt || record.batchUpdatedAt || record.createdAt || record.batchCreatedAt || 0).getTime() || 0;
}

function mapSelectionGenerationRecord(row = {}) {
  const payload = parseStoredJson(row.payload_json, {});
  const finalPrompt = String(row.final_prompt || "");
  return {
    selectionProductId: String(payload.selectionProductId || payload.selection_product_id || "").trim(),
    batchId: row.batch_id || "",
    batchName: row.batch_name || "选品测品批次",
    batchStatus: row.batch_status || "",
    batchCreatedAt: row.batch_created_at || "",
    batchUpdatedAt: row.batch_updated_at || "",
    itemId: row.id || "",
    rowNo: Number(row.row_no || 0),
    productName: row.product_name || payload.productName || "",
    productCategory: row.product_category || payload.productCategory || "",
    accountAssetId: payload.accountAssetId || payload.account_asset_id || "",
    accountName: payload.accountName || payload.account_name || "",
    accountPosition: payload.accountPosition || payload.account_position || "",
    accountTone: payload.accountTone || payload.account_tone || "",
    accountDocPack: payload.accountDocPack || payload.account_doc_pack || {},
    platformBinding: payload.platformBinding || payload.platform_binding || {},
    platformName: payload.platformName || payload.platform_name || payload.platformBinding?.platform || "",
    aigcLabel: payload.aigcLabel || payload.aigc_label || payload.platformBinding?.aigcLabel || "",
    materialPrecheck: payload.materialPrecheck || {},
    materialAttachments: Array.isArray(payload.materialAttachments) ? payload.materialAttachments : [],
    materialImageCount: Array.isArray(payload.images) ? payload.images.length : 0,
    itemStatus: row.status || "",
    currentStep: row.current_step || "",
    progress: Number(row.progress || 0),
    finalPromptReady: Boolean(finalPrompt),
    finalPromptPreview: finalPrompt ? finalPrompt.slice(0, 220) : "",
    libtvTaskCode: row.libtv_task_code || "",
    libtvNodeName: row.libtv_node_name || "",
    videoUrl: row.video_url || "",
    errorMessage: row.error_message || "",
    autoSubmit: Boolean(Number(row.auto_submit ?? payload.autoSubmit ?? 0)),
    targetDuration: Number(row.target_duration || payload.targetDuration || 0),
    aspectRatio: row.aspect_ratio || payload.aspectRatio || "",
    videoMode: row.video_mode || payload.videoMode || "",
    createdAt: row.created_at || "",
    startedAt: row.started_at || "",
    finishedAt: row.finished_at || "",
    updatedAt: row.updated_at || ""
  };
}

async function listSelectionGenerationRecords(limit = 800, ownerUserId = defaultOwnerUserId()) {
  await ensureBatchSchema();
  const rows = await querySqlite(
    `
    SELECT
      bi.*,
      bj.name AS batch_name,
      bj.status AS batch_status,
      bj.created_at AS batch_created_at,
      bj.updated_at AS batch_updated_at
    FROM batch_items bi
    JOIN batch_jobs bj ON bj.id = bi.batch_id
    WHERE COALESCE(bj.owner_user_id, ?) = ?
    ORDER BY bj.created_at DESC, bi.row_no ASC
    LIMIT ?
    `,
    [defaultOwnerUserId(), ownerUserId, boundedNumber(limit, 800, 1, 3000)]
  );
  return rows.map(mapSelectionGenerationRecord);
}

function buildSelectionGenerationSummary(records = []) {
  const latest = records[0] || null;
  return {
    total: records.length,
    promptReadyCount: records.filter((record) => record.finalPromptReady || record.itemStatus === "prompt_ready").length,
    videoCount: records.filter((record) => record.videoUrl || record.itemStatus === "succeeded").length,
    failedCount: records.filter((record) => record.itemStatus === "failed" || record.errorMessage).length,
    latestStatus: latest?.itemStatus || latest?.batchStatus || "",
    latestStep: latest?.currentStep || "",
    latestUpdatedAt: latest?.updatedAt || latest?.batchUpdatedAt || ""
  };
}

function mergeBatchLinksFromRecords(existingLinks = [], records = []) {
  const seen = new Set((existingLinks || []).map((link) => String(link.batchId || "")));
  const generatedLinks = [];
  for (const record of records) {
    if (!record.batchId || seen.has(record.batchId)) continue;
    seen.add(record.batchId);
    generatedLinks.push({
      batchId: record.batchId,
      batchName: record.batchName,
      status: record.batchStatus || record.itemStatus || "draft",
      itemCount: 1,
      createdAt: record.batchCreatedAt || record.createdAt
    });
  }
  return [...(existingLinks || []), ...generatedLinks].slice(0, 12);
}

async function listSelectionAssets(ownerUserId = defaultOwnerUserId()) {
  await ensureSelectionAssetSchema();
  await ensureBatchSchema();
  const productRows = await querySqlite(
    `
    SELECT *
    FROM selection_products
    WHERE COALESCE(owner_user_id, ?) = ?
    ORDER BY total_score DESC, rank_no ASC
    `,
    [defaultOwnerUserId(), ownerUserId]
  );
  const accountRows = await querySqlite(
    `
    SELECT *
    FROM account_assets
    WHERE COALESCE(owner_user_id, ?) = ?
    ORDER BY created_at ASC
    `,
    [defaultOwnerUserId(), ownerUserId]
  );
  const products = productRows.map(hydrateSelectionProduct);
  const productIds = new Set(products.map((product) => product.id));
  const batchIdProductMap = new Map();
  for (const product of products) {
    for (const link of product.batchLinks || []) {
      if (!link?.batchId) continue;
      const batchId = String(link.batchId);
      if (!batchIdProductMap.has(batchId)) batchIdProductMap.set(batchId, new Set());
      batchIdProductMap.get(batchId).add(product.id);
    }
  }
  const recordsByProduct = new Map();
  for (const record of await listSelectionGenerationRecords(800, ownerUserId)) {
    const linkedProductIds = batchIdProductMap.get(String(record.batchId || ""));
    const inferredProductId = linkedProductIds?.size === 1 ? [...linkedProductIds][0] : "";
    const productId = record.selectionProductId || inferredProductId;
    if (!productId || !productIds.has(productId)) continue;
    const normalizedRecord = { ...record, selectionProductId: productId };
    if (!recordsByProduct.has(productId)) recordsByProduct.set(productId, []);
    recordsByProduct.get(productId).push(normalizedRecord);
  }
  const productsWithGeneration = products.map((product) => {
    const generationRecords = (recordsByProduct.get(product.id) || []).sort((a, b) => batchRecordTime(b) - batchRecordTime(a));
    return {
      ...product,
      batchLinks: mergeBatchLinksFromRecords(product.batchLinks || [], generationRecords),
      generationRecords,
      generationSummary: buildSelectionGenerationSummary(generationRecords)
    };
  });
  return {
    products: productsWithGeneration,
    accounts: accountRows.map(hydrateAccountAsset)
  };
}

async function updateSelectionProduct(productId, payload = {}, ownerUserId = defaultOwnerUserId()) {
  await ensureSelectionAssetSchema();
  const rows = await querySqlite(
    "SELECT * FROM selection_products WHERE id = ? AND COALESCE(owner_user_id, ?) = ?",
    [productId, defaultOwnerUserId(), ownerUserId]
  );
  if (!rows.length) return null;
  const current = hydrateSelectionProduct(rows[0]);
  const merged = {
    ...current,
    ...payload,
    id: productId
  };
  const now = new Date().toISOString();
  await executeSqlite(
    `
    UPDATE selection_products
    SET rank_no = ?,
        sku = ?,
        category = ?,
        node = ?,
        lifecycle = ?,
        asset_status = ?,
        asset_percent = ?,
        risk_level = ?,
        total_score = ?,
        payload_json = ?,
        updated_at = ?
    WHERE id = ?
    `,
    [
      boundedNumber(merged.rank, current.rank || 999, 1, 9999),
      String(merged.sku || current.sku || "").trim(),
      String(merged.category || current.category || "").trim(),
      String(merged.node || current.node || "").trim(),
      String(merged.lifecycle || current.lifecycle || "候选").trim(),
      String(merged.assetStatus || current.assetStatus || "待补资产").trim(),
      boundedNumber(merged.assetPercent, current.assetPercent || 0, 0, 100),
      String(merged.riskLevel || current.riskLevel || "中").trim(),
      boundedNumber(merged.totalScore, current.totalScore || 0, 0, 100),
      JSON.stringify({ ...merged, updatedAt: now }),
      now,
      productId
    ]
  );
  const updatedRows = await querySqlite(
    "SELECT * FROM selection_products WHERE id = ? AND COALESCE(owner_user_id, ?) = ?",
    [productId, defaultOwnerUserId(), ownerUserId]
  );
  return updatedRows[0] ? hydrateSelectionProduct(updatedRows[0]) : null;
}

async function bulkUpdateSelectionProducts(updates = [], ownerUserId = defaultOwnerUserId()) {
  await ensureSelectionAssetSchema();
  const results = [];
  for (const item of Array.isArray(updates) ? updates.slice(0, 80) : []) {
    const productId = String(item?.id || item?.productId || "").trim();
    const patch = item?.patch && typeof item.patch === "object" ? item.patch : {};
    if (!productId) {
      results.push({ ok: false, id: "", error: "缺少商品 ID。" });
      continue;
    }
    try {
      const product = await updateSelectionProduct(productId, patch, ownerUserId);
      if (!product) {
        results.push({ ok: false, id: productId, error: "商品不存在。" });
        continue;
      }
      results.push({ ok: true, id: productId, product });
    } catch (error) {
      results.push({ ok: false, id: productId, error: error.message || "商品更新失败。" });
    }
  }
  return {
    ok: true,
    results,
    successCount: results.filter((item) => item.ok).length,
    failedCount: results.filter((item) => !item.ok).length
  };
}

async function createSelectionProduct(payload = {}, ownerUserId = defaultOwnerUserId()) {
  await ensureSelectionAssetSchema();
  const sku = String(payload.sku || "").trim();
  if (!sku) {
    const error = new Error("请填写商品名称。");
    error.statusCode = 400;
    throw error;
  }
  const duplicateSku = await querySqlite(
    "SELECT id FROM selection_products WHERE sku = ? AND COALESCE(owner_user_id, ?) = ? LIMIT 1",
    [sku, defaultOwnerUserId(), ownerUserId]
  );
  if (duplicateSku.length) {
    const error = new Error("这个商品已经在商品数据库里。");
    error.statusCode = 409;
    throw error;
  }
  const maxRankRows = await querySqlite(
    "SELECT COALESCE(MAX(rank_no), 0) AS max_rank FROM selection_products WHERE COALESCE(owner_user_id, ?) = ?",
    [defaultOwnerUserId(), ownerUserId]
  );
  const nextRank = Number(maxRankRows[0]?.max_rank || 0) + 1;
  let productId = String(payload.id || "").trim();
  if (!productId) {
    const categoryPart = safeAsciiPart(payload.category || "").toLowerCase();
    const skuPart = safeAsciiPart(sku).toLowerCase();
    const readableParts = [categoryPart, skuPart].filter((part) => part && part !== "cat");
    productId = `sku-${readableParts.join("-") || "item"}-${randomUUID().slice(0, 8)}`;
  }
  const existingId = await querySqlite("SELECT id FROM selection_products WHERE id = ? LIMIT 1", [productId]);
  if (existingId.length) productId = `${productId}-${randomUUID().slice(0, 6)}`;
  const now = new Date().toISOString();
  const merged = {
    ...payload,
    id: productId,
    sku,
    rank: boundedNumber(payload.rank, nextRank, 1, 9999),
    category: String(payload.category || "待分类").trim(),
    node: String(payload.node || "常规测试").trim(),
    lifecycle: String(payload.lifecycle || "待补资产").trim(),
    assetStatus: String(payload.assetStatus || "自动初评：待补素材").trim(),
    assetPercent: boundedNumber(payload.assetPercent, 0, 0, 100),
    riskLevel: String(payload.riskLevel || "中").trim(),
    totalScore: boundedNumber(payload.totalScore, 0, 0, 100),
    createdAt: now,
    updatedAt: now
  };
  await executeSqlite(
    `
    INSERT INTO selection_products (
      id, owner_user_id, rank_no, sku, category, node, lifecycle, asset_status,
      asset_percent, risk_level, total_score, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      merged.id,
      ownerUserId,
      merged.rank,
      merged.sku,
      merged.category,
      merged.node,
      merged.lifecycle,
      merged.assetStatus,
      merged.assetPercent,
      merged.riskLevel,
      merged.totalScore,
      JSON.stringify(merged),
      now,
      now
    ]
  );
  const rows = await querySqlite(
    "SELECT * FROM selection_products WHERE id = ? AND COALESCE(owner_user_id, ?) = ?",
    [merged.id, defaultOwnerUserId(), ownerUserId]
  );
  return rows[0] ? hydrateSelectionProduct(rows[0]) : null;
}

async function saveAccountAsset(accountId, payload = {}, ownerUserId = defaultOwnerUserId()) {
  await ensureSelectionAssetSchema();
  const isUpdate = Boolean(accountId);
  const targetId = String(accountId || payload.id || "").trim();
  const currentRows = targetId
    ? await querySqlite(
        "SELECT * FROM account_assets WHERE id = ? AND COALESCE(owner_user_id, ?) = ? LIMIT 1",
        [targetId, defaultOwnerUserId(), ownerUserId]
      )
    : [];
  const current = currentRows[0] ? hydrateAccountAsset(currentRows[0]) : null;
  if (isUpdate && targetId && !current) return null;

  const name = String(payload.name || current?.name || "").trim();
  if (!name) {
    const error = new Error("请填写账号名称。");
    error.statusCode = 400;
    throw error;
  }
  let id = targetId || String(payload.id || "").trim() || `account-${safeAsciiPart(name).toLowerCase()}-${randomUUID().slice(0, 8)}`;
  if (!isUpdate) {
    const existingId = await querySqlite("SELECT id FROM account_assets WHERE id = ? LIMIT 1", [id]);
    if (existingId.length) id = `${id}-${randomUUID().slice(0, 6)}`;
    const duplicateName = await querySqlite(
      "SELECT id FROM account_assets WHERE name = ? AND COALESCE(owner_user_id, ?) = ? LIMIT 1",
      [name, defaultOwnerUserId(), ownerUserId]
    );
    if (duplicateName.length) {
      const error = new Error("这个账号名称已经存在。");
      error.statusCode = 409;
      throw error;
    }
  }
  const now = new Date().toISOString();
  const merged = {
    ...(current || {}),
    ...payload,
    id,
    name,
    position: String(payload.position ?? current?.position ?? "").trim(),
    updatedAt: now,
    createdAt: current?.createdAt || now
  };
  if (isUpdate) {
    await executeSqlite(
      `
      UPDATE account_assets
      SET name = ?,
          position = ?,
          payload_json = ?,
          updated_at = ?
      WHERE id = ?
      `,
      [merged.name, merged.position, JSON.stringify(merged), now, id]
    );
  } else {
    await executeSqlite(
      `
      INSERT INTO account_assets (id, owner_user_id, name, position, payload_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [id, ownerUserId, merged.name, merged.position, JSON.stringify(merged), now, now]
    );
  }
  const rows = await querySqlite(
    "SELECT * FROM account_assets WHERE id = ? AND COALESCE(owner_user_id, ?) = ?",
    [id, defaultOwnerUserId(), ownerUserId]
  );
  return rows[0] ? hydrateAccountAsset(rows[0]) : null;
}

function selectionMaterialRoot(productId) {
  return path.join(config.runStorageDir, "selection-assets", safeFilePart(productId || "product"));
}

function selectionMaterialUrl(productId, attachmentId) {
  return `/api/selection-products/${encodeURIComponent(productId)}/materials/${encodeURIComponent(attachmentId)}`;
}

async function attachSelectionProductMaterial(productId, slotId, payload = {}, ownerUserId = defaultOwnerUserId()) {
  await ensureSelectionAssetSchema();
  const rows = await querySqlite(
    "SELECT * FROM selection_products WHERE id = ? AND COALESCE(owner_user_id, ?) = ?",
    [productId, defaultOwnerUserId(), ownerUserId]
  );
  if (!rows.length) return null;
  const current = hydrateSelectionProduct(rows[0]);
  const image = payload.image || {};
  const parsed = parseDataUrlImage(image);
  const attachmentId = randomUUID();
  const ext = imageExtension(parsed.mime, image.name || "material.png");
  const dir = selectionMaterialRoot(productId);
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${attachmentId}${ext}`);
  await writeFile(filePath, parsed.buffer);
  const uploadedAt = new Date().toISOString();
  const attachment = {
    id: attachmentId,
    name: String(image.name || payload.slot?.label || slotId || "material").slice(0, 180),
    type: parsed.mime,
    size: parsed.buffer.length,
    path: filePath,
    url: selectionMaterialUrl(productId, attachmentId),
    uploadedAt
  };
  const sourceChecklist = Array.isArray(payload.checklist) && payload.checklist.length
    ? payload.checklist
    : Array.isArray(current.assetChecklist)
      ? current.assetChecklist
      : [];
  let found = false;
  const nextChecklist = sourceChecklist.map((slot) => {
    if (slot.id !== slotId) return slot;
    found = true;
    return {
      ...slot,
      status: "已就绪",
      note: "",
      updatedAt: uploadedAt,
      attachments: [attachment, ...(Array.isArray(slot.attachments) ? slot.attachments.filter((item) => item.id !== attachmentId) : [])].slice(0, 8)
    };
  });
  if (!found) {
    nextChecklist.push({
      ...(payload.slot || {}),
      id: slotId,
      label: payload.slot?.label || slotId,
      status: "已就绪",
      note: "",
      updatedAt: uploadedAt,
      attachments: [attachment]
    });
  }
  return updateSelectionProduct(productId, {
    assetChecklist: nextChecklist,
    materialUpdatedAt: uploadedAt
  }, ownerUserId);
}

async function serveSelectionProductMaterial(productId, attachmentId, res) {
  const dir = selectionMaterialRoot(productId);
  try {
    const files = await readdir(dir);
    const fileName = files.find((name) => path.parse(name).name === attachmentId);
    if (!fileName) return textResponse(res, 404, "Material not found");
    const filePath = path.join(dir, fileName);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return textResponse(res, 404, "Material not found");
    const ext = path.extname(fileName).toLowerCase();
    const content = await readFile(filePath);
    res.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    textResponse(res, 404, "Material not found");
  }
}

async function ensureBatchSchema() {
  if (batchSchemaReadyPromise) return batchSchemaReadyPromise;
  batchSchemaReadyPromise = (async () => {
    const script = `
import json
import sqlite3
import sys

db_path = sys.argv[1]
con = sqlite3.connect(db_path, timeout=180)
con.execute("PRAGMA busy_timeout=180000")
con.execute("PRAGMA foreign_keys=ON")
con.executescript("""
CREATE TABLE IF NOT EXISTS batch_jobs (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  running_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  cancelled_count INTEGER NOT NULL DEFAULT 0,
  concurrency INTEGER NOT NULL DEFAULT 2,
  input_payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS batch_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
  row_no INTEGER NOT NULL,
  task_no TEXT,
  prompt_file_name TEXT,
  image_file_name TEXT,
  product_name TEXT,
  product_category TEXT,
  product_brief TEXT,
  target_duration INTEGER NOT NULL DEFAULT 15,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  video_mode TEXT NOT NULL DEFAULT 'dry_run',
  auto_submit INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  current_step TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL DEFAULT '{}',
  image_analysis TEXT,
  suggested_category TEXT,
  final_prompt TEXT,
  prompt_package_json TEXT,
  token_usage_json TEXT,
  libtv_task_code TEXT,
  libtv_node_name TEXT,
  video_url TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(batch_id, row_no)
);

CREATE INDEX IF NOT EXISTS idx_batch_items_batch_status ON batch_items(batch_id, status, row_no);
CREATE INDEX IF NOT EXISTS idx_batch_items_status ON batch_items(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_owner_user_id ON batch_jobs(owner_user_id);

CREATE TABLE IF NOT EXISTS batch_events (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batch_jobs(id) ON DELETE CASCADE,
  item_id TEXT REFERENCES batch_items(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  phase TEXT,
  message TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_batch_events_batch_time ON batch_events(batch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_batch_events_item_time ON batch_events(item_id, created_at);
""")
columns = {row[1] for row in con.execute("PRAGMA table_info(batch_jobs)")}
if "owner_user_id" not in columns:
    con.execute("ALTER TABLE batch_jobs ADD COLUMN owner_user_id TEXT")
con.commit()
print(json.dumps({"ok": True}, ensure_ascii=False))
`;
    const result = await runProcess(config.pythonExe, pythonInlineArgs(script, config.libtvDbPath), {
      cwd: WORKFLOW_DIR,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8"
      }
    });
    return parseJsonFromText(result.stdout, "无法初始化批量任务表。");
  })();
  return batchSchemaReadyPromise;
}

async function listBatchJobs(limit = 50, ownerUserId = defaultOwnerUserId()) {
  await ensureBatchSchema();
  return querySqlite(
    `
    SELECT *
    FROM batch_jobs
    WHERE COALESCE(owner_user_id, ?) = ?
    ORDER BY created_at DESC
    LIMIT ?
    `,
    [defaultOwnerUserId(), ownerUserId, boundedNumber(limit, 50, 1, 300)]
  );
}

async function getBatchDetail(batchId, ownerUserId = defaultOwnerUserId()) {
  await ensureBatchSchema();
  const jobs = await querySqlite(
    "SELECT * FROM batch_jobs WHERE id = ? AND COALESCE(owner_user_id, ?) = ?",
    [batchId, defaultOwnerUserId(), ownerUserId]
  );
  if (!jobs.length) return null;
  const items = await querySqlite(
    `
    SELECT *
    FROM batch_items
    WHERE batch_id = ?
    ORDER BY row_no ASC
    `,
    [batchId]
  );
  const events = await querySqlite(
    `
    SELECT *
    FROM batch_events
    WHERE batch_id = ?
    ORDER BY created_at DESC
    LIMIT 120
    `,
    [batchId]
  );
  return { job: jobs[0], items, events };
}

async function batchBelongsToUser(batchId, ownerUserId = defaultOwnerUserId()) {
  await ensureBatchSchema();
  const rows = await querySqlite(
    "SELECT id FROM batch_jobs WHERE id = ? AND COALESCE(owner_user_id, ?) = ? LIMIT 1",
    [batchId, defaultOwnerUserId(), ownerUserId]
  );
  return Boolean(rows.length);
}

async function createBatchJob(payload, ownerUserId = defaultOwnerUserId()) {
  await ensureBatchSchema();
  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  if (!rawItems.length) throw new Error("请至少添加一条批量任务。");
  if (rawItems.length > 2000) throw new Error("单个批次最多 2000 条任务，请拆分批次。");

  const now = new Date().toISOString();
  const batchId = randomUUID();
  const batchName = String(payload.name || `批量任务 ${formatCompactDateTime(new Date())}`).trim().slice(0, 120);
  const concurrency = boundedNumber(payload.concurrency, 2, 1, config.batchMaxWorkers);
  const autoStart = coerceBool(payload.autoStart, true);
  const batchDir = path.join(config.runStorageDir, "batches", batchId);
  await mkdir(batchDir, { recursive: true });

  const operations = [
    {
      sql: `
        INSERT INTO batch_jobs (
          id, owner_user_id, name, status, total_count, pending_count, running_count, success_count, failed_count, cancelled_count,
          concurrency, input_payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, ?)
      `,
      params: [
        batchId,
        ownerUserId,
        batchName,
        autoStart ? "queued" : "draft",
        rawItems.length,
        autoStart ? rawItems.length : 0,
        concurrency,
        JSON.stringify({ source: payload.source || "console", createdBy: payload.createdBy || "local", ownerUserId }),
        now,
        now
      ]
    }
  ];

  for (const [index, raw] of rawItems.entries()) {
    const item = normalizeBatchItem(raw, index + 1);
    const itemId = randomUUID();
    const rowDir = path.join(batchDir, String(index + 1).padStart(5, "0"));
    await mkdir(rowDir, { recursive: true });
    const promptPath = path.join(rowDir, "prompt.txt");
    await writeFile(promptPath, item.promptPackText, "utf8");
    const savedImages = [];
    for (const [imageIndex, image] of item.images.entries()) {
      const parsed = parseDataUrlImage(image);
      const ext = imageExtension(parsed.mime, image.name);
      const filename = `${String(imageIndex + 1).padStart(2, "0")}-${safeFilePart(path.parse(image.name).name || "product")}${ext}`;
      const imagePath = path.join(rowDir, filename);
      await writeFile(imagePath, parsed.buffer);
      savedImages.push({
        name: image.name,
        type: parsed.mime,
        size: parsed.buffer.length,
        path: imagePath,
        ...(normalizeTextImageSourceMetadata(image) || {})
      });
    }
    const itemPayload = {
      promptPath,
      promptFileName: item.promptFileName,
      images: savedImages,
      productName: item.productName,
      productCategory: item.productCategory,
      productBrief: item.productBrief,
      targetDuration: item.targetDuration,
      aspectRatio: item.aspectRatio,
      videoMode: item.videoMode,
      autoSubmit: item.autoSubmit,
      modelSettings: item.modelSettings,
      ownerUserId
    };
    operations.push({
      sql: `
        INSERT INTO batch_items (
          id, batch_id, row_no, task_no, prompt_file_name, image_file_name, product_name, product_category,
          product_brief, target_duration, aspect_ratio, video_mode, auto_submit, status, current_step, progress,
          payload_json, attempts, max_retries, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?)
      `,
      params: [
        itemId,
        batchId,
        index + 1,
        item.taskNo,
        item.promptFileName,
        item.images[0]?.name || "",
        item.productName,
        item.productCategory,
        item.productBrief,
        item.targetDuration,
        item.aspectRatio,
        item.videoMode,
        item.autoSubmit ? 1 : 0,
        autoStart ? "queued" : "draft",
        autoStart ? "排队中" : "待开始",
        JSON.stringify(itemPayload),
        item.maxRetries,
        now,
        now
      ]
    });
  }

  await executeSqliteMany(operations);
  await logBatchEvent(batchId, null, "batch_created", "创建批次", `已创建 ${rawItems.length} 条批量任务。`, {
    concurrency,
    autoStart
  });
  if (autoStart) scheduleBatchProcessor();
  return getBatchDetail(batchId, ownerUserId);
}

function normalizeBatchItem(raw, rowNo) {
  const promptPackText = String(raw.promptPackText || "").trim();
  const images = normalizeImages(raw.images);
  if (!promptPackText) throw new Error(`第 ${rowNo} 行缺少提示词包正文。`);
  if (!images.length && !String(raw.productBrief || "").trim()) throw new Error(`第 ${rowNo} 行缺少商品图或商品补充信息。`);
  return {
    taskNo: String(raw.taskNo || raw.task_no || rowNo).trim().slice(0, 80),
    promptFileName: String(raw.promptFileName || raw.prompt_file_name || "").trim().slice(0, 260),
    promptPackText,
    images,
    productName: String(raw.productName || raw.product_name || "").trim().slice(0, 160),
    productCategory: cleanCategory(raw.productCategory || raw.category || "", ""),
    productBrief: String(raw.productBrief || raw.product_brief || "").trim().slice(0, 5000),
    targetDuration: boundedNumber(raw.targetDuration || raw.duration || raw.durationSec, 15, 4, 15),
    aspectRatio: String(raw.aspectRatio || raw.ratio || "9:16"),
    videoMode: ["dry_run", "submit", "run"].includes(String(raw.videoMode || "")) ? String(raw.videoMode) : "dry_run",
    autoSubmit: coerceBool(raw.autoSubmit, true),
    modelSettings: normalizeModelSettings(raw.modelSettings || {}),
    maxRetries: boundedNumber(raw.maxRetries, 1, 0, 5)
  };
}

async function updateBatchSummary(batchId) {
  await ensureBatchSchema();
  const rows = await querySqlite(
    `
    SELECT
      COUNT(*) AS total_count,
      SUM(CASE WHEN status IN ('draft','queued','retrying') THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN status IN ('running','image_analysis','prompt_generating','submitting_libtv','video_generating') THEN 1 ELSE 0 END) AS running_count,
      SUM(CASE WHEN status IN ('succeeded','prompt_ready') THEN 1 ELSE 0 END) AS success_count,
      SUM(CASE WHEN status IN ('failed','compliance_required') THEN 1 ELSE 0 END) AS failed_count,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count
    FROM batch_items
    WHERE batch_id = ?
    `,
    [batchId]
  );
  const summary = rows[0] || {};
  const total = Number(summary.total_count || 0);
  const running = Number(summary.running_count || 0);
  const pending = Number(summary.pending_count || 0);
  const failed = Number(summary.failed_count || 0);
  const cancelled = Number(summary.cancelled_count || 0);
  const success = Number(summary.success_count || 0);
  let status = "running";
  let finishedAt = null;
  if (total && success + failed + cancelled >= total && running === 0 && pending === 0) {
    status = failed ? "completed_with_errors" : cancelled && !success ? "cancelled" : "completed";
    finishedAt = new Date().toISOString();
  } else {
    const jobRows = await querySqlite("SELECT status FROM batch_jobs WHERE id = ?", [batchId]);
    if (jobRows[0]?.status === "paused") status = "paused";
    if (jobRows[0]?.status === "cancelled") status = "cancelled";
  }
  const now = new Date().toISOString();
  await executeSqlite(
    `
    UPDATE batch_jobs
    SET status = ?,
        total_count = ?,
        pending_count = ?,
        running_count = ?,
        success_count = ?,
        failed_count = ?,
        cancelled_count = ?,
        finished_at = COALESCE(finished_at, ?),
        updated_at = ?
    WHERE id = ?
    `,
    [status, total, pending, running, success, failed, cancelled, finishedAt, now, batchId]
  );
}

async function updateBatchItem(itemId, fields) {
  const allowed = new Set([
    "status",
    "current_step",
    "progress",
    "image_analysis",
    "suggested_category",
    "final_prompt",
    "prompt_package_json",
    "token_usage_json",
    "libtv_task_code",
    "libtv_node_name",
    "video_url",
    "error_message",
    "attempts",
    "started_at",
    "finished_at",
    "updated_at"
  ]);
  const entries = Object.entries(fields).filter(([key]) => allowed.has(key));
  if (!entries.length) return;
  const sets = entries.map(([key]) => `${key} = ?`);
  const params = entries.map(([, value]) => value);
  if (!entries.some(([key]) => key === "updated_at")) {
    sets.push("updated_at = ?");
    params.push(new Date().toISOString());
  }
  params.push(itemId);
  await executeSqlite(`UPDATE batch_items SET ${sets.join(", ")} WHERE id = ?`, params);
}

async function logBatchEvent(batchId, itemId, eventType, phase, message, payload = {}) {
  await executeSqlite(
    `
    INSERT INTO batch_events (id, batch_id, item_id, event_type, phase, message, payload_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [randomUUID(), batchId, itemId, eventType, phase || "", message || "", JSON.stringify(payload || {}), new Date().toISOString()]
  );
}

function scheduleBatchProcessor() {
  if (batchProcessorScheduled) return;
  batchProcessorScheduled = true;
  setTimeout(() => {
    batchProcessorScheduled = false;
    processBatchQueue().catch((error) => console.error("Batch processor failed:", error));
  }, 50).unref?.();
}

async function processBatchQueue() {
  await ensureBatchSchema();
  while (activeBatchItemRuns.size < config.batchMaxWorkers) {
    const candidates = await querySqlite(
      `
      SELECT
        bi.*,
        bj.status AS batch_status,
        bj.concurrency AS batch_concurrency
      FROM batch_items bi
      JOIN batch_jobs bj ON bj.id = bi.batch_id
      WHERE bj.status IN ('queued','running')
        AND bi.status IN ('queued','retrying')
      ORDER BY bj.created_at ASC, bi.row_no ASC
      LIMIT 50
      `
    );
    const next = await pickNextBatchItem(candidates);
    if (!next) break;
    activeBatchItemRuns.set(next.id, { batchId: next.batch_id, run: null });
    runBatchItem(next)
      .catch((error) => {
        console.error("Batch item worker failed outside handler:", error);
      })
      .finally(() => {
        activeBatchItemRuns.delete(next.id);
        scheduleBatchProcessor();
      });
  }
}

async function pickNextBatchItem(candidates) {
  for (const item of candidates) {
    if (activeBatchItemRuns.has(item.id)) continue;
    const activeForBatch = [...activeBatchItemRuns.values()].filter((entry) => entry.batchId === item.batch_id).length;
    const perBatchLimit = boundedNumber(item.batch_concurrency, 2, 1, config.batchMaxWorkers);
    if (activeForBatch >= perBatchLimit) continue;
    return item;
  }
  return null;
}

async function runBatchItem(item) {
  const batchId = item.batch_id;
  const itemId = item.id;
  const startedAt = new Date().toISOString();
  await executeSqlite("UPDATE batch_jobs SET status = 'running', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?", [
    startedAt,
    startedAt,
    batchId
  ]);
  await updateBatchItem(itemId, {
    status: "running",
    current_step: "准备任务",
    progress: 3,
    started_at: item.started_at || startedAt,
    error_message: "",
    attempts: Number(item.attempts || 0) + 1
  });
  await updateBatchSummary(batchId);
  await logBatchEvent(batchId, itemId, "item_started", "准备任务", `第 ${item.row_no} 行开始执行。`);

  try {
    const payload = await loadBatchItemPayload(item);
    if (payload.autoSubmit && payload.videoMode !== "dry_run") {
      await ensureLibTVReadyForSubmit();
    }
    const promptRun = createInternalRun("batch_prompt", (event) => handleBatchPromptEvent(batchId, itemId, event));
    activeBatchItemRuns.set(itemId, { batchId, run: promptRun });
    await runFinalPromptJob(promptRun, payload);
    if (promptRun.status === "cancelled") throw new RunCancelledError(promptRun.error || "任务已取消。");
    if (promptRun.status !== "completed") throw new Error(promptRun.error || "提示词生成失败。");

    const promptResult = promptRun.result || {};
    const finalPrompt = promptResult.finalPrompt || "";
    const suggestedCategory = promptResult.suggestedCategory || payload.productCategory || "";
    await updateBatchItem(itemId, {
      status: payload.autoSubmit ? "submitting_libtv" : "prompt_ready",
      current_step: payload.autoSubmit ? "提交 libTV" : "提示词已生成",
      progress: payload.autoSubmit ? 82 : 100,
      image_analysis: promptResult.imageAnalysis || "",
      suggested_category: suggestedCategory,
      final_prompt: finalPrompt,
      prompt_package_json: JSON.stringify(promptResult.promptPackage || {}),
      token_usage_json: JSON.stringify(promptResult.tokenUsage || promptRun.tokenUsage || {})
    });

    if (!payload.autoSubmit) {
      await logBatchEvent(batchId, itemId, "item_prompt_ready", "提示词已生成", "已生成最终提示词，未自动提交 libTV。");
      await updateBatchSummary(batchId);
      return;
    }

    const videoPayload = {
      finalPrompt,
      promptPackage: promptResult.promptPackage || null,
      productName: payload.productName,
      productCategory: payload.productCategory || suggestedCategory,
      productBrief: payload.productBrief,
      imageAnalysis: promptResult.imageAnalysis || "",
      suggestedCategory,
      images: payload.images,
      duration: payload.targetDuration,
      aspectRatio: payload.aspectRatio,
      dryRun: payload.videoMode === "dry_run",
      waitForVideo: payload.videoMode === "run",
      download: true,
      ownerUserId: payload.ownerUserId || ""
    };
    const videoRun = createInternalRun("batch_video", (event) => handleBatchVideoEvent(batchId, itemId, event));
    activeBatchItemRuns.set(itemId, { batchId, run: videoRun });
    await runVideoJob(videoRun, videoPayload);
    if (videoRun.status === "cancelled") throw new RunCancelledError(videoRun.error || "任务已取消。");
    if (videoRun.status !== "completed") throw new Error(videoRun.error || "libTV 提交失败。");

    const videoResult = videoRun.result || {};
    await updateBatchItem(itemId, {
      status: "succeeded",
      current_step: "完成",
      progress: 100,
      libtv_task_code: videoResult.taskCode || "",
      libtv_node_name: videoResult.libtvNodeName || "",
      video_url: extractVideoUrl(videoResult),
      finished_at: new Date().toISOString()
    });
    await logBatchEvent(batchId, itemId, "item_completed", "完成", "视频任务已完成。", {
      taskCode: videoResult.taskCode,
      videoUrl: extractVideoUrl(videoResult)
    });
  } catch (error) {
    const cancelled = error?.name === "RunCancelledError";
    const attemptNumber = Number(item.attempts || 0) + 1;
    const maxRetries = Number(item.max_retries || 0);
    const canRetry = !cancelled && attemptNumber <= maxRetries && isRetryableBatchError(error);
    await updateBatchItem(itemId, {
      status: canRetry ? "retrying" : cancelled ? "cancelled" : "failed",
      current_step: canRetry ? "等待重试" : cancelled ? "已取消" : "失败",
      progress: canRetry ? 0 : cancelled ? Number(item.progress || 0) : 100,
      error_message: error.message,
      finished_at: canRetry ? null : new Date().toISOString()
    });
    await logBatchEvent(
      batchId,
      itemId,
      canRetry ? "item_retrying" : cancelled ? "item_cancelled" : "item_failed",
      canRetry ? "等待重试" : cancelled ? "已取消" : "失败",
      canRetry ? `${error.message}，准备自动重试 ${attemptNumber}/${maxRetries}。` : error.message
    );
  } finally {
    try {
      await updateBatchSummary(batchId);
    } catch (error) {
      console.error("Batch summary update failed:", error);
    }
  }
}

function isRetryableBatchError(error) {
  const message = String(error?.message || error || "");
  return /database is locked|SQLITE_BUSY|超时|timeout|timed out|429|too many|rate limit|temporar|ECONNRESET|ETIMEDOUT|fetch failed|HTTP 5\d\d/i.test(message);
}

async function loadBatchItemPayload(item) {
  const saved = JSON.parse(item.payload_json || "{}");
  const promptPackText = await readFile(saved.promptPath, "utf8");
  const images = [];
  for (const image of saved.images || []) {
    const buffer = await readFile(image.path);
    images.push({
      name: image.name,
      type: image.type || "image/png",
      size: image.size || buffer.length,
      dataUrl: `data:${image.type || "image/png"};base64,${buffer.toString("base64")}`,
      ...(normalizeTextImageSourceMetadata(image) || {})
    });
  }
  return {
    promptPackText,
    productName: saved.productName || item.product_name || "",
    productCategory: saved.productCategory || item.product_category || "",
    productBrief: saved.productBrief || item.product_brief || "",
    targetDuration: boundedNumber(saved.targetDuration || item.target_duration, 15, 4, 15),
    aspectRatio: saved.aspectRatio || item.aspect_ratio || "9:16",
    images,
    videoMode: saved.videoMode || item.video_mode || "dry_run",
    autoSubmit: coerceBool(saved.autoSubmit, true),
    modelSettings: normalizeModelSettings(saved.modelSettings || {}),
    ownerUserId: saved.ownerUserId || ""
  };
}

async function handleBatchPromptEvent(batchId, itemId, event) {
  const phase = event.phase || event.stepName || event.type || "提示词生成";
  const status = batchStatusFromPromptEvent(event);
  const progress = progressFromPromptEvent(event);
  const fields = { current_step: phase, progress };
  if (status) fields.status = status;
  if (event.type === "image_analysis") fields.image_analysis = event.output || "";
  if (event.type === "category_detected") fields.suggested_category = event.category || "";
  if (event.type === "completed") {
    fields.final_prompt = event.result?.finalPrompt || "";
    fields.prompt_package_json = JSON.stringify(event.result?.promptPackage || {});
    fields.token_usage_json = JSON.stringify(event.result?.tokenUsage || {});
  }
  await updateBatchItem(itemId, fields);
  await logBatchEvent(batchId, itemId, event.type || "prompt_event", phase, event.message || "", compactEventPayload(event));
}

function batchStatusFromPromptEvent(event) {
  if (event.type === "image_analysis") return "image_analysis";
  if (event.type === "step_completed" || event.type === "token_usage") return "prompt_generating";
  if (event.type === "completed") return "prompt_ready";
  if (event.type === "failed") return "failed";
  if (event.type === "cancelled") return "cancelled";
  return event.type === "status" ? "running" : "";
}

function progressFromPromptEvent(event) {
  if (event.type === "model_meta") return 6;
  if (event.type === "image_analysis") return 24;
  if (event.type === "category_detected") return 28;
  if (event.type === "step_completed") {
    const stepNo = Number(event.stepNo || 1);
    return Math.max(30, Math.min(74, 30 + stepNo * 3));
  }
  if (event.type === "completed") return 80;
  if (event.type === "failed" || event.type === "cancelled") return 100;
  return 12;
}

function isComplianceRequiredMessage(message) {
  return /合规校验|真人形象|参考图可能包含真人|Seedance/i.test(String(message || ""));
}

function complianceRequiredMessage(message) {
  const detail = String(message || "").replace(/^libTV bridge failed:\s*/i, "").trim();
  return detail || "真人参考图需要先在 libTV 执行 Seedance2.0 合规校验，校验通过后再重试。";
}

async function handleBatchVideoEvent(batchId, itemId, event) {
  const phase = event.phase || event.type || "libTV";
  const complianceRequired = event.type === "failed" && isComplianceRequiredMessage(event.message);
  const fields = {
    current_step: complianceRequired ? "需合规校验" : phase,
    status: event.type === "completed" ? "succeeded" : complianceRequired ? "compliance_required" : event.type === "failed" ? "failed" : "video_generating",
    progress: event.type === "completed" || event.type === "failed" ? 100 : 88
  };
  if (event.type === "completed") {
    fields.libtv_task_code = event.result?.taskCode || "";
    fields.libtv_node_name = event.result?.libtvNodeName || "";
    fields.video_url = extractVideoUrl(event.result || {});
  }
  if (event.type === "failed") fields.error_message = complianceRequired ? complianceRequiredMessage(event.message) : event.message || "";
  await updateBatchItem(itemId, fields);
  await logBatchEvent(batchId, itemId, event.type || "video_event", phase, event.message || "", compactEventPayload(event));
}

function compactEventPayload(event) {
  return {
    type: event.type,
    phase: event.phase,
    stepNo: event.stepNo,
    stepName: event.stepName,
    category: event.category,
    tokenUsage: event.tokenUsage || undefined,
    result: event.result
      ? {
          taskCode: event.result.taskCode,
          libtvNodeName: event.result.libtvNodeName,
          videoUrl: extractVideoUrl(event.result)
        }
      : undefined
  };
}

function extractVideoUrl(value) {
  const found = deepFindValue(value, ["video_url", "videoUrl", "url", "output_url", "download_url"]);
  return typeof found === "string" && /^https?:\/\//i.test(found) ? found : "";
}

let libTVReadyCache = { ok: false, checkedAt: 0, message: "" };

async function ensureLibTVReadyForSubmit() {
  const now = Date.now();
  if (libTVReadyCache.ok && now - libTVReadyCache.checkedAt < 60_000) return;
  try {
    await callLibTVBridge({ action: "account", timeout: 120, bridge_timeout_seconds: 180 }, 180_000);
    libTVReadyCache = { ok: true, checkedAt: now, message: "" };
  } catch (error) {
    libTVReadyCache = { ok: false, checkedAt: now, message: error.message };
    if (/未登录|401|unauthorized/i.test(error.message)) {
      throw new Error("libTV 未登录：请先完成本机 libTV 登录，然后再点击失败重试。");
    }
    throw new Error(`libTV 登录状态检查失败：${error.message}`);
  }
}

function deepFindValue(value, keys) {
  const wanted = new Set(keys);
  const queue = [value];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }
    for (const [key, item] of Object.entries(current)) {
      if (wanted.has(key) && item) return item;
      if (item && typeof item === "object") queue.push(item);
    }
  }
  return "";
}

async function startBatch(batchId, ownerUserId = defaultOwnerUserId()) {
  await ensureBatchSchema();
  const now = new Date().toISOString();
  await executeSqlite(
    `
    UPDATE batch_items
    SET status = 'queued', current_step = '排队中', progress = 0, error_message = '', updated_at = ?
    WHERE batch_id = ? AND status IN ('draft','failed','compliance_required','cancelled')
    `,
    [now, batchId]
  );
  await executeSqlite(
    `
    UPDATE batch_jobs
    SET status = 'queued', started_at = COALESCE(started_at, ?), finished_at = NULL, updated_at = ?
    WHERE id = ?
    `,
    [now, now, batchId]
  );
  await updateBatchSummary(batchId);
  await logBatchEvent(batchId, null, "batch_started", "启动批次", "批量任务已进入队列。");
  scheduleBatchProcessor();
  return getBatchDetail(batchId, ownerUserId);
}

async function pauseBatch(batchId, ownerUserId = defaultOwnerUserId()) {
  await ensureBatchSchema();
  const now = new Date().toISOString();
  await executeSqlite("UPDATE batch_jobs SET status = 'paused', updated_at = ? WHERE id = ?", [now, batchId]);
  await logBatchEvent(batchId, null, "batch_paused", "暂停批次", "批量任务已暂停，新任务不会继续领取。");
  await updateBatchSummary(batchId);
  return getBatchDetail(batchId, ownerUserId);
}

async function cancelBatch(batchId, ownerUserId = defaultOwnerUserId()) {
  await ensureBatchSchema();
  const now = new Date().toISOString();
  for (const [itemId, entry] of activeBatchItemRuns.entries()) {
    if (entry.batchId === batchId && entry.run) cancelRun(entry.run, "批量任务已取消。");
  }
  await executeSqlite(
    `
    UPDATE batch_items
    SET status = 'cancelled', current_step = '已取消', error_message = '批量任务已取消。', finished_at = ?, updated_at = ?
    WHERE batch_id = ? AND status IN ('draft','queued','retrying','running','image_analysis','prompt_generating','submitting_libtv','video_generating')
    `,
    [now, now, batchId]
  );
  await executeSqlite("UPDATE batch_jobs SET status = 'cancelled', finished_at = ?, updated_at = ? WHERE id = ?", [now, now, batchId]);
  await logBatchEvent(batchId, null, "batch_cancelled", "取消批次", "批量任务已取消。");
  await updateBatchSummary(batchId);
  return getBatchDetail(batchId, ownerUserId);
}

async function retryBatchFailures(batchId, ownerUserId = defaultOwnerUserId()) {
  await ensureBatchSchema();
  const now = new Date().toISOString();
  await executeSqlite(
    `
    UPDATE batch_items
    SET status = 'queued', current_step = '等待重试', progress = 0, error_message = '', finished_at = NULL, updated_at = ?
    WHERE batch_id = ? AND status IN ('failed','compliance_required')
    `,
    [now, batchId]
  );
  await executeSqlite("UPDATE batch_jobs SET status = 'queued', finished_at = NULL, updated_at = ? WHERE id = ?", [now, batchId]);
  await logBatchEvent(batchId, null, "batch_retry", "重试失败任务", "失败任务已重新进入队列。");
  await updateBatchSummary(batchId);
  scheduleBatchProcessor();
  return getBatchDetail(batchId, ownerUserId);
}

async function listOutputFiles(ownerUserId = "") {
  const files = [];
  let ownerTaskCodes = null;
  if (ownerUserId) {
    const rows = await querySqlite(
      "SELECT task_code FROM video_tasks WHERE COALESCE(owner_user_id, ?) = ?",
      [defaultOwnerUserId(), ownerUserId]
    );
    ownerTaskCodes = new Set(rows.map((row) => row.task_code).filter(Boolean));
  }
  for (const [kind, dir] of [
    ["libtv", OUTPUT_DIR],
    ["stitched", STITCH_OUTPUT_DIR],
    ["text-image", IMAGE_OUTPUT_DIR]
  ]) {
    if (!existsSync(dir)) continue;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (kind === "text-image" && !isGeneratedImageFile(entry.name)) continue;
      if (ownerTaskCodes && kind === "libtv" && ![...ownerTaskCodes].some((taskCode) => entry.name.startsWith(taskCode))) {
        continue;
      }
      if (ownerTaskCodes && kind === "stitched" && ownerUserId !== defaultOwnerUserId()) continue;
      if (ownerUserId && kind === "text-image" && ownerUserId !== defaultOwnerUserId() && !entry.name.startsWith(imageOutputOwnerPrefix(ownerUserId))) {
        continue;
      }
      const filePath = path.join(dir, entry.name);
      const fileStat = await stat(filePath);
      files.push({
        name: entry.name,
        kind,
        path: filePath,
        url: `/api/output-file?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(entry.name)}`,
        size: fileStat.size,
        updatedAt: fileStat.mtime.toISOString()
      });
    }
  }
  return files.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function outputDirByKind(kind) {
  if (kind === "libtv") return OUTPUT_DIR;
  if (kind === "stitched") return STITCH_OUTPUT_DIR;
  if (kind === "text-image") return IMAGE_OUTPUT_DIR;
  return null;
}

function isAllowedRemoteVideoUrl(value) {
  let parsed;
  try {
    parsed = value instanceof URL ? value : new URL(String(value || ""));
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return host === "libtv-res.liblib.art" || host.endsWith(".liblib.art");
}

function remoteVideoDownloadName(rawUrl = "", name = "") {
  let ext = ".mp4";
  try {
    const parsed = new URL(String(rawUrl || ""));
    const match = parsed.pathname.match(/\.(mp4|mov|m4v|webm)$/i);
    if (match) ext = `.${match[1].toLowerCase()}`;
  } catch {
    // Keep the default mp4 extension.
  }
  const base = safeFilePart(name || "video-result");
  return /\.(mp4|mov|m4v|webm)$/i.test(base) ? base : `${base}${ext}`;
}

async function serveRemoteVideoSaveProxy(res, rawUrl, name = "") {
  let remoteUrl;
  try {
    remoteUrl = new URL(String(rawUrl || ""));
  } catch {
    return textResponse(res, 400, "视频链接不正确。");
  }
  if (!isAllowedRemoteVideoUrl(remoteUrl)) {
    return textResponse(res, 400, "当前视频域名不在允许保存范围内。");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(remoteUrl.href, {
      signal: controller.signal,
      headers: {
        "user-agent": "AI-Prompt-Video-Studio/1.0"
      }
    });
    if (!response.ok) return textResponse(res, 502, "视频读取失败，请稍后重试。");

    const contentType = response.headers.get("content-type") || "";
    const looksLikeVideo = /^video\//i.test(contentType)
      || /octet-stream/i.test(contentType)
      || /\.(mp4|mov|m4v|webm)$/i.test(remoteUrl.pathname);
    if (!looksLikeVideo) return textResponse(res, 400, "这个链接不是可保存的视频文件。");

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_REMOTE_VIDEO_BYTES) return textResponse(res, 413, "视频文件太大，暂时无法直接保存。");

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_REMOTE_VIDEO_BYTES) return textResponse(res, 413, "视频文件太大，暂时无法直接保存。");

    const fileName = remoteVideoDownloadName(remoteUrl.href, name);
    const asciiName = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "_");
    res.writeHead(200, {
      ...corsHeadersFor(),
      "content-type": contentType || mimeTypes[path.extname(fileName).toLowerCase()] || "video/mp4",
      "content-length": buffer.length,
      "content-disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    });
    res.end(buffer);
  } catch (error) {
    return textResponse(res, error.name === "AbortError" ? 504 : 502, "视频保存准备失败，请稍后重试。");
  } finally {
    clearTimeout(timer);
  }
}

function imageOutputOwnerPrefix(ownerUserId = defaultOwnerUserId()) {
  return `u${hashText(ownerUserId || defaultOwnerUserId()).slice(0, 12)}`;
}

function isGeneratedImageFile(name = "") {
  return /\.(png|jpe?g|webp)$/i.test(String(name));
}

async function serveOutputFile(res, kind, name, ownerUserId = "") {
  const dir = outputDirByKind(kind);
  if (!dir || !name) return textResponse(res, 404, "Not found");
  if (ownerUserId && kind === "libtv") {
    const rows = await querySqlite(
      "SELECT task_code FROM video_tasks WHERE COALESCE(owner_user_id, ?) = ? AND ? LIKE task_code || '%'",
      [defaultOwnerUserId(), ownerUserId, path.basename(name)]
    );
    if (!rows.length) return textResponse(res, 404, "Not found");
  }
  if (ownerUserId && kind === "stitched" && ownerUserId !== defaultOwnerUserId()) return textResponse(res, 404, "Not found");
  if (ownerUserId && kind === "text-image" && ownerUserId !== defaultOwnerUserId() && !path.basename(name).startsWith(imageOutputOwnerPrefix(ownerUserId))) {
    return textResponse(res, 404, "Not found");
  }
  const filePath = path.normalize(path.join(dir, path.basename(name)));
  const relative = path.relative(dir, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return textResponse(res, 403, "Forbidden");
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return textResponse(res, 404, "Not found");
    const ext = path.extname(filePath).toLowerCase();
    const content = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "content-length": content.length,
      "cache-control": "no-store"
    });
    res.end(content);
  } catch {
    textResponse(res, 404, "Not found");
  }
}

function publicAssetFileName(row = {}) {
  const fromPath = String(row.file_path || "").trim();
  if (fromPath) return path.basename(fromPath);
  const fromUrl = String(row.file_url || "").trim();
  if (fromUrl) {
    try {
      return path.basename(new URL(fromUrl, "http://local.invalid").pathname) || "asset";
    } catch {
      return path.basename(fromUrl) || "asset";
    }
  }
  const type = safeFilePart(row.asset_type || "asset");
  const ext = safeFilePart(row.format || "bin").replace(/^\.+/, "") || "bin";
  return `${type}.${ext}`;
}

function publicAssetRow(row = {}) {
  const fileName = publicAssetFileName(row);
  const hasLocalFile = Boolean(String(row.file_path || "").trim());
  const fileUrl = String(row.file_url || "").trim();
  const isPublicUrl = /^(https?:\/\/|\/|data:|blob:)/i.test(fileUrl);
  return {
    task_code: row.task_code || "",
    category: row.category || "",
    product_name: row.product_name || "",
    asset_type: row.asset_type || "",
    sort_order: row.sort_order ?? null,
    file_name: fileName,
    file_url: isPublicUrl ? fileUrl : "",
    download_url: hasLocalFile
      ? `/api/asset-file?id=${encodeURIComponent(row.asset_id)}`
      : (isPublicUrl ? fileUrl : ""),
    format: row.format || path.extname(fileName).replace(/^\./, "") || "",
    size_bytes: row.size_bytes || 0,
    created_at: row.created_at || ""
  };
}

async function serveAssetFile(res, assetId, ownerUserId = "") {
  const id = Number.parseInt(String(assetId || ""), 10);
  if (!Number.isFinite(id) || id <= 0) return textResponse(res, 404, "Asset not found");
  const rows = await querySqlite(
    `
    SELECT
      pa.rowid AS asset_id,
      pa.file_path,
      pa.file_url,
      pa.asset_type,
      pa.format
    FROM product_assets pa
    LEFT JOIN video_tasks vt ON vt.id = pa.task_id
    WHERE pa.rowid = ?
      AND COALESCE(vt.owner_user_id, pa.owner_user_id, ?) = ?
    LIMIT 1
    `,
    [id, defaultOwnerUserId(), ownerUserId]
  );
  const row = rows[0];
  if (!row) return textResponse(res, 404, "Asset not found");
  const sourcePath = String(row.file_path || "").trim();
  if (!sourcePath) {
    const publicUrl = String(row.file_url || "").trim();
    if (/^https?:\/\//i.test(publicUrl)) {
      res.writeHead(302, { location: publicUrl, "cache-control": "no-store" });
      return res.end();
    }
    return textResponse(res, 404, "Asset file not found");
  }
  const filePath = path.normalize(sourcePath);
  const relative = path.relative(WORKFLOW_DIR, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return textResponse(res, 403, "Forbidden");
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return textResponse(res, 404, "Asset file not found");
    const ext = path.extname(filePath).toLowerCase();
    const content = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "content-length": content.length,
      "cache-control": "no-store"
    });
    res.end(content);
  } catch {
    textResponse(res, 404, "Asset file not found");
  }
}

async function saveVideoInputFiles(payload) {
  const identity = payload.taskCode
    ? taskIdentityFromExisting(payload.taskCode, payload.productCategory)
    : await createTaskIdentity(payload.productCategory);
  const taskCode = identity.taskCode;
  const runDir = path.join(config.runStorageDir, safeFilePart(taskCode));
  await mkdir(runDir, { recursive: true });

  const promptDocPath = path.join(runDir, "final_prompt.txt");
  const packageJsonPath = path.join(runDir, "prompt_package.json");
  const imageSources = buildVideoImageSourceSummaries(payload.images);
  const inputImages = payload.images.map((image, index) => ({
    index: index + 1,
    name: image.name,
    type: image.type,
    size: image.size,
    sourceType: image.sourceType || "",
    sourceUrl: image.sourceUrl || "",
    textImageCanvasNodeId: image.textImageCanvasNodeId || "",
    textImageRunId: image.textImageRunId || "",
    textImageModel: image.textImageModel || "",
    textImageSize: image.textImageSize || "",
    textImageCreatedAt: image.textImageCreatedAt || "",
    textImageLinkedAt: image.textImageLinkedAt || ""
  }));
  await writeFile(promptDocPath, payload.finalPrompt, "utf8");
  await writeFile(
    packageJsonPath,
    JSON.stringify(
      {
        taskCode,
        taskDate: identity.taskDate,
        category: payload.productCategory,
        categoryCode: identity.categoryCode,
        serial: identity.serial,
        libtvNodeName: identity.libtvNodeName,
        productName: payload.productName,
        productBrief: payload.productBrief,
        duration: payload.duration,
        aspectRatio: payload.aspectRatio,
        promptPackage: payload.promptPackage,
        inputImages,
        imageSources,
        textImageCanvasNodeIds: imageSources.map((source) => source.textImageCanvasNodeId).filter(Boolean)
      },
      null,
      2
    ),
    "utf8"
  );

  const imagesDir = path.join(runDir, "images");
  await mkdir(imagesDir, { recursive: true });
  const savedImages = [];
  for (const [index, image] of payload.images.entries()) {
    const parsed = parseDataUrlImage(image);
    const ext = imageExtension(parsed.mime, image.name);
    const filename = `${String(index + 1).padStart(2, "0")}-${safeFilePart(path.parse(image.name).name || "product")}${ext}`;
    const imagePath = path.join(imagesDir, filename);
    await writeFile(imagePath, parsed.buffer);
    savedImages.push({
      name: image.name,
      type: parsed.mime,
      path: imagePath,
      size: parsed.buffer.length,
      ...(normalizeTextImageSourceMetadata(image) || {})
    });
  }

  return {
    taskCode,
    taskDate: identity.taskDate,
    categoryCode: identity.categoryCode,
    serial: identity.serial,
    libtvNodeName: identity.libtvNodeName,
    runDir,
    promptDocPath,
    packageJsonPath,
    images: savedImages,
    primaryImagePath: savedImages[0]?.path || ""
  };
}

function parseDataUrlImage(image) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(String(image.dataUrl || ""));
  if (!match) throw new Error(`图片格式无法识别：${image.name}`);
  return {
    mime: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

function imageExtension(mime, filename) {
  const fromName = path.extname(filename || "").toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp"].includes(fromName)) return fromName;
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  return ".png";
}

async function registerLibTVTask(payload, saved) {
  if (!existsSync(config.libtvRegisterScript)) {
    throw new Error(`找不到 libTV 注册脚本：${config.libtvRegisterScript}`);
  }
  if (!existsSync(config.libtvDbPath)) {
    throw new Error(`找不到 libTV 数据库：${config.libtvDbPath}`);
  }
  const args = [
    ...pythonScriptArgs(config.libtvRegisterScript),
    "--db",
    config.libtvDbPath,
    "--task-code",
    saved.taskCode,
    "--product-name",
    payload.productName,
    "--category",
    payload.productCategory || "未分类",
    "--product-description",
    payload.productBrief,
    "--market",
    "CN",
    "--image-path",
    saved.primaryImagePath,
    "--prompt-doc",
    saved.promptDocPath,
    "--priority",
    "20",
    "--output-mode",
    `${payload.duration}s_${payload.aspectRatio.replace(":", "x")}_libtv`,
    "--task-date",
    saved.taskDate,
    "--category-code",
    saved.categoryCode,
    "--daily-serial",
    String(saved.serial || 0),
    "--libtv-node-name",
    saved.libtvNodeName,
    "--source-channel",
    "html"
  ];
  const result = await runProcess(config.pythonExe, args, {
    cwd: WORKFLOW_DIR,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8"
    }
  });
  const registered = parseJsonFromText(result.stdout, "libTV 注册脚本没有返回 JSON。");
  await assignRegisteredTaskOwner(saved.taskCode, payload.ownerUserId || defaultOwnerUserId());
  return registered;
}

async function assignRegisteredTaskOwner(taskCode, ownerUserId = defaultOwnerUserId()) {
  if (!taskCode) return;
  await ensureAuthSchema();
  await executeSqliteMany([
    {
      sql: "UPDATE video_tasks SET owner_user_id = ? WHERE task_code = ?",
      params: [ownerUserId, taskCode]
    },
    {
      sql: `
        UPDATE products
        SET owner_user_id = ?
        WHERE id IN (SELECT product_id FROM video_tasks WHERE task_code = ?)
      `,
      params: [ownerUserId, taskCode]
    },
    {
      sql: `
        UPDATE product_assets
        SET owner_user_id = ?
        WHERE task_id IN (SELECT id FROM video_tasks WHERE task_code = ?)
           OR product_id IN (SELECT product_id FROM video_tasks WHERE task_code = ?)
      `,
      params: [ownerUserId, taskCode, taskCode]
    }
  ]);
}

function pythonScriptArgs(scriptPath) {
  const exe = path.basename(config.pythonExe).toLowerCase();
  return exe === "py" || exe === "py.exe" ? ["-3", scriptPath] : [scriptPath];
}

function pythonInlineArgs(script, ...args) {
  const exe = path.basename(config.pythonExe).toLowerCase();
  const prefix = exe === "py" || exe === "py.exe" ? ["-3", "-X", "utf8", "-c", script] : ["-X", "utf8", "-c", script];
  return [...prefix, ...args];
}

async function processJsonArg(value, safeLength = 12000) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  if (text.length <= safeLength) {
    return { arg: text, cleanup: async () => {} };
  }
  const tmpDir = path.join(config.runStorageDir, "tmp", "sqlite-args");
  await mkdir(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `${Date.now()}-${randomUUID()}.json`);
  await writeFile(filePath, text, "utf8");
  return {
    arg: `@${filePath}`,
    cleanup: async () => {
      await rm(filePath, { force: true });
    }
  };
}

function runProcess(file, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { ...options, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${file} 执行失败，退出码 ${code}：${stderr || stdout}`));
      }
    });
  });
}

function formatBridgeFailure(data, rawText) {
  const detail =
    extractBridgeFailureText(data?.result) ||
    extractBridgeFailureText(data?.stdout) ||
    extractBridgeFailureText(data?.error) ||
    extractBridgeFailureText(data?.stderr) ||
    extractBridgeFailureText(rawText) ||
    "libTV bridge returned ok=false";
  if (/未登录|401|unauthorized/i.test(String(detail))) {
    return "libTV 未登录：请先完成本机 libTV 登录，然后再点击失败重试。";
  }
  return String(detail).slice(0, 1200);
}

function extractBridgeFailureText(value) {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return "";
    const failedReason = extractJsonStringField(text, "failedReason");
    const taskMatch = text.match(/\[run\]\s+task=([^\s]+)\s+status=([^\s]+)\s+progress=([^\s]+)/i);
    if (failedReason && taskMatch) return `task=${taskMatch[1]} status=${taskMatch[2]} progress=${taskMatch[3]}: ${failedReason}`;
    if (failedReason) return failedReason;
    if (taskMatch) return `task=${taskMatch[1]} status=${taskMatch[2]} progress=${taskMatch[3]}`;
    return text;
  }
  if (typeof value === "object") {
    const candidates = [
      value.failedReason,
      value.error_message,
      value.errorMessage,
      value.message,
      value.data?.taskInfo?.failedReason,
      value.taskInfo?.failedReason,
      value.result,
      value.stdout,
      value.error,
      value.stderr
    ];
    for (const candidate of candidates) {
      const extracted = extractBridgeFailureText(candidate);
      if (extracted) return extracted;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function extractJsonStringField(text, fieldName) {
  const pattern = new RegExp(`"${fieldName}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`);
  const match = String(text || "").match(pattern);
  if (!match) return "";
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

async function callLibTVBridge(payload, timeoutMs) {
  if (!config.libtvBridgeUrl) throw new Error("缺少 LIBTV_BRIDGE_URL 配置。");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.libtvBridgeUrl.replace(/\/$/, "")}/invoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      throw new Error(data?.error || text || `libTV bridge HTTP ${response.status}`);
    }
    if (data?.ok === false) {
      throw new Error(`libTV bridge failed: ${formatBridgeFailure(data, text)}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function getLibTVHealth() {
  if (!config.libtvBridgeUrl) return { ok: false, error: "未配置 LIBTV_BRIDGE_URL" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(`${config.libtvBridgeUrl.replace(/\/$/, "")}/health`, { signal: controller.signal });
    const data = await response.json();
    return { ok: response.ok && Boolean(data.ok), ...data };
  } catch (error) {
    return { ok: false, error: error.message };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonFromText(text, fallbackError) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error(fallbackError);
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error(fallbackError);
  }
}

async function createTaskIdentity(category) {
  const taskDate = formatLocalDate();
  const categoryCode = categoryCodeFor(category);
  const serial = await nextDailyCategorySerial(taskDate, categoryCode);
  const taskCode = `${taskDate}-${categoryCode}-${String(serial).padStart(3, "0")}`;
  return {
    taskDate,
    categoryCode,
    serial,
    taskCode,
    libtvNodeName: `AIUGC-${taskCode}-video`
  };
}

function taskIdentityFromExisting(taskCode, category) {
  const taskDate = formatLocalDate();
  const categoryCode = categoryCodeFor(category);
  return {
    taskDate,
    categoryCode,
    serial: 0,
    taskCode,
    libtvNodeName: `AIUGC-${safeAsciiPart(taskCode)}-video`
  };
}

async function nextDailyCategorySerial(taskDate, categoryCode) {
  await mkdir(config.runStorageDir, { recursive: true });
  const serialPath = path.join(config.runStorageDir, ".serials.json");
  let data = {};
  try {
    data = JSON.parse(await readFile(serialPath, "utf8"));
  } catch {
    data = {};
  }
  const key = `${taskDate}-${categoryCode}`;
  const next = Number(data[key] || 0) + 1;
  data[key] = next;
  await writeFile(serialPath, JSON.stringify(data, null, 2), "utf8");
  return next;
}

function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function cleanCategory(value, fallback = "未分类") {
  const cleaned = String(value || "")
    .replace(/\*\*/g, "")
    .replace(/[`"'“”‘’]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .replace(/^[-：:\s]+|[-：:\s]+$/g, "")
    .replace(/[（(].*$/, "")
    .slice(0, 40);
  if (isLikelyBrokenText(cleaned)) return fallback;
  return cleaned || fallback;
}

function isLikelyBrokenText(value) {
  const compact = String(value || "").replace(/\s/g, "");
  if (!compact) return true;
  const brokenMarks = (compact.match(/[?？�]/g) || []).length;
  if (/^[?？�]+$/.test(compact)) return true;
  return brokenMarks >= 2 && brokenMarks / compact.length > 0.35;
}

function inferCategoryFromSources({ imageAnalysis = "", productBrief = "", productName = "", promptText = "" } = {}) {
  const text = [imageAnalysis, productBrief, productName, promptText].filter(Boolean).join("\n");
  const correction = inferCorrectedCategory(text);
  if (correction) return correction;

  const explicit = text.match(/(?:品类|类别|类目|category)\*{0,2}\s*[：:]\s*([^\n，,；;]+)/i);
  if (explicit) {
    const value = cleanCategory(explicit[1], "");
    if (value && !/N\/A|不适用|未知|无法确认|未识别|无实际商品/i.test(value)) return value;
  }
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return "未分类";
}

function inferCorrectedCategory(text) {
  const source = String(text || "");
  const patterns = [
    /(?:修正后|更正后|最终类别|最终类目|应属|应为|建议标注为|建议标注|精准标注为|精准标注)\s*[：:为]?\s*[*"'“”‘’\s]*([^\n，,；;。]+)/i,
    /(?:实际穿着性别|实际商品|图中商品|图片商品)[^\n，,；;。]{0,30}?(男装|女装)/i
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const candidate = cleanCategory(match[1], "");
    if (candidate && isKnownCategory(candidate)) return normalizeCategory(candidate);
  }
  return "";
}

function isKnownCategory(value) {
  return CATEGORY_RULES.some((rule) => rule.category === value || rule.pattern.test(value));
}

function normalizeCategory(value) {
  for (const rule of CATEGORY_RULES) {
    if (rule.category === value || rule.pattern.test(value)) return rule.category;
  }
  return cleanCategory(value);
}

const CATEGORY_RULES = [
  { category: "男装", code: "NANZHUANG", pattern: /男装|男士|男性|男款|男模|男士服饰|男士穿搭|男士上衣|男士裤|男士衬衫|男士T恤|西装|夹克|卫衣|polo/i },
  { category: "女装", code: "FUZHUANG", pattern: /女装|女士|女性|女款|女模|连衣裙|半身裙|女式上衣|女式针织衫|女式衬衫|女式T恤|女裤|裙子|吊带|背心/i },
  { category: "美妆", code: "MEIZHUANG", pattern: /美妆|护肤|彩妆|口红|唇釉|粉底|眼影|面膜|精华|乳液|面霜|香水/i },
  { category: "家居", code: "JIAJU", pattern: /家居|家具|家装|收纳|床品|沙发|桌椅|灯具|厨具|餐具/i },
  { category: "数码", code: "SHUMA", pattern: /数码|电子|手机|电脑|平板|耳机|相机|充电器|键盘|鼠标|智能/i },
  { category: "食品", code: "SHIPIN", pattern: /食品|零食|饮料|茶|咖啡|饼干|糖果|坚果|调味|食材/i },
  { category: "饰品", code: "SHOUSHI", pattern: /饰品|首饰|珠宝|项链|耳环|耳钉|戒指|手链|发夹|配饰/i },
  { category: "鞋包", code: "XIEBAO", pattern: /鞋|靴|凉鞋|运动鞋|包|箱包|手袋|背包|钱包/i },
  { category: "运动", code: "YUNDONG", pattern: /运动|健身|户外|瑜伽|跑步|骑行|训练|球拍/i },
  { category: "母婴", code: "MUYING", pattern: /母婴|儿童|宝宝|婴儿|童装|奶瓶|纸尿裤/i },
  { category: "宠物", code: "CHONGWU", pattern: /宠物|猫|狗|猫粮|狗粮|牵引绳|猫砂/i },
  { category: "玩具", code: "WANJU", pattern: /玩具|礼品|积木|手办|模型|公仔/i }
];

function categoryCodeFor(category) {
  const value = cleanCategory(category);
  const normalized = value.toLowerCase();
  const direct = safeAsciiPart(normalized);
  if (direct && direct !== "CAT") return direct.toUpperCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(value)) return rule.code;
  }
  return "WEIFENLEI";
}

function safeAsciiPart(value) {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9A-Za-z]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return cleaned || "CAT";
}

function extractProductName(productBrief) {
  const line = String(productBrief || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean);
  return line ? line.slice(0, 80) : "";
}

function safeFilePart(value) {
  return String(value || "item")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

function extractDocxTextFromBase64(value) {
  const raw = String(value || "").trim();
  const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
  if (!base64) throw new Error("Word 文档内容为空。");
  return extractDocxText(Buffer.from(base64, "base64"));
}

function extractDocxText(buffer) {
  const entries = readZipEntries(buffer);
  const targetNames = [
    "word/document.xml",
    "word/footnotes.xml",
    "word/endnotes.xml",
    "word/comments.xml"
  ];
  const parts = [];
  for (const name of targetNames) {
    const entry = entries.get(name);
    if (!entry) continue;
    const xml = readZipEntry(buffer, entry).toString("utf8");
    const text = extractWordXmlText(xml);
    if (text) parts.push(text);
  }
  const result = parts.join("\n\n").trim();
  if (!result) throw new Error("没有从 Word 文档中读取到正文文字。请确认文件是 .docx 格式。");
  return result;
}

function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) throw new Error("无法识别 Word 文档，请确认文件是 .docx。");
  const centralDirSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirEnd = centralDirOffset + centralDirSize;
  const entries = new Map();
  let offset = centralDirOffset;
  while (offset < centralDirEnd) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.slice(offset + 46, offset + 46 + fileNameLength).toString("utf8").replace(/\\/g, "/");
    entries.set(name, { name, method, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function readZipEntry(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error(`Word 文档内部文件损坏：${entry.name}`);
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.slice(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRawSync(compressed, { finishFlush: 2 });
  throw new Error(`不支持的 Word 文档压缩方式：${entry.method}`);
}

function extractWordXmlText(xml) {
  const output = [];
  const pattern =
    /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>|<w:cr\b[^>]*\/>|<\/w:tc>|<\/w:p>/g;
  let match;
  while ((match = pattern.exec(xml))) {
    if (match[1] !== undefined) {
      output.push(unescapeXml(match[1]));
    } else if (match[0].startsWith("<w:tab")) {
      output.push("\t");
    } else if (match[0] === "</w:tc>") {
      output.push("\t");
    } else {
      output.push("\n");
    }
  }
  return output
    .join("")
    .replace(/\t+\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unescapeXml(value) {
  return String(value || "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return textResponse(res, 403, "Forbidden");
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) return textResponse(res, 404, "Not found");
    const ext = path.extname(filePath).toLowerCase();
    const content = await readFile(filePath);
    res.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    textResponse(res, 404, "Not found");
  }
}

const server = createServer((req, res) => requestContext.run({ req }, async () => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeadersFor(req));
      return res.end();
    }

    if (authSchemaRequiredFor(url.pathname)) {
      await ensureAuthSchema();
    }

    if (req.method === "GET" && url.pathname === "/api/healthz") {
      return jsonResponse(res, 200, {
        ok: true,
        service: "ai-prompt-video-studio",
        status: "ready",
        time: new Date().toISOString(),
        authRequired: config.authRequired
      });
    }

    if (req.method === "GET" && url.pathname === "/api/auth/session") {
      const session = getSession(req);
      return jsonResponse(res, 200, {
        ok: true,
        authenticated: Boolean(session),
        user: session ? publicUser({ id: session.userId, username: session.user, displayName: session.displayName, role: session.role }) : null,
        authRequired: config.authRequired
      });
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const payload = await readJsonBody(req);
      const username = normalizeUsername(payload.username);
      const password = String(payload.password || "");
      const user = await findUserByUsername(username);
      if (!user || !verifyPassword(password, user.password_hash)) {
        return jsonResponse(res, 401, { error: "账号或密码不正确。" });
      }
      return makeAuthSession(res, user);
    }

    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      if (!config.authAllowRegistration) {
        return jsonResponse(res, 403, { error: "当前没有开放注册，请联系管理员创建账号。" });
      }
      try {
        const payload = await readJsonBody(req);
        const user = await createConsoleUser(payload);
        return makeAuthSession(res, user);
      } catch (error) {
        return jsonResponse(res, error.statusCode || 400, { error: error.message || "注册失败。" });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const session = getSession(req);
      if (session?.token) sessions.delete(session.token);
      return jsonResponse(
        res,
        200,
        { ok: true, authenticated: false },
        { "set-cookie": clearSessionCookie() }
      );
    }

    const session = getSession(req);
    if (authRequiredFor(url.pathname) && !session) {
      return jsonResponse(res, 401, { error: "请先登录。", authRequired: true });
    }
    const ownerUserId = ownerUserIdFromSession(session);

    if (req.method === "GET" && url.pathname === "/api/config") {
      const libtvHealth = await getLibTVHealth();
      const canViewRuntimeInternals = String(session?.user || config.authUser || "").toLowerCase() === "zkr";
      return jsonResponse(res, 200, {
        currentUser: session
          ? publicUser({ id: session.userId, username: session.user, displayName: session.displayName, role: session.role })
          : config.authRequired
            ? null
            : publicUser({ id: defaultOwnerUserId(), username: config.authUser || "local-preview", displayName: "本地预览", role: "admin" }),
        qianwenTextConfigured: Boolean(config.qianwenKey),
        qianwenVisionConfigured: Boolean(config.qianwenVlKey),
        doubaoConfigured: Boolean(config.arkKey && config.doubaoUrl && config.doubaoModel),
        seedanceConfigured: Boolean(config.arkKey && config.seedanceUrl && config.seedanceModel),
        seedreamConfigured: Boolean(config.arkKey && config.imageGenerationUrl && config.imageGenerationModel),
        ffmpegConfigured: Boolean(config.ffmpegExe),
        authRequired: config.authRequired,
        libtvBridgeConfigured: Boolean(config.libtvBridgeUrl),
        libtvBridgeReachable: Boolean(libtvHealth.ok),
        libtvBridgeUrl: canViewRuntimeInternals ? config.libtvBridgeUrl : config.libtvBridgeUrl ? "configured" : "",
        libtvDatabase: canViewRuntimeInternals ? config.libtvDbPath : config.libtvDbPath ? "configured" : "",
        batchMaxWorkers: config.batchMaxWorkers,
        modelRequestTimeoutMs: config.modelRequestTimeoutMs,
        activeBatchWorkers: activeBatchItemRuns.size,
        currentModels: {
          qianwenText: config.qianwenModel,
          analysis: config.doubaoModel,
          vision: config.qianwenVlModel,
          video: config.seedanceModel,
          imageGeneration: config.imageGenerationModel
        },
        modelOptions: {
          analysis: config.analysisModelOptions,
          vision: config.visionModelOptions,
          video: config.videoModelOptions,
          imageGeneration: config.imageGenerationModelOptions
        },
        ffmpeg: config.ffmpegExe,
        libtvHealth,
        modeHint: config.arkKey ? "real-api-ready" : "mock-without-env"
      });
    }

    if (req.method === "GET" && url.pathname === "/api/account/export") {
      return jsonResponse(res, 200, await buildAccountDataExport(session, ownerUserId));
    }

    if (req.method === "GET" && url.pathname === "/api/task-source-links") {
      const taskCode = String(url.searchParams.get("taskCode") || "").trim();
      const limit = Number(url.searchParams.get("limit") || 100);
      const sourceLinks = await listVideoTaskSourceLinks({ ownerUserId, taskCode, limit });
      return jsonResponse(res, 200, {
        ok: true,
        taskCode,
        sourceLinks
      });
    }

    if (req.method === "GET" && url.pathname === "/api/account/data-rights-requests") {
      const requests = await readDataRightsRequests(ownerUserId);
      return jsonResponse(res, 200, { ok: true, requests });
    }

    if (req.method === "GET" && url.pathname === "/api/admin/data-rights-requests") {
      try {
        requireDataRightsAdmin(session);
        const requests = await readAllDataRightsRequests();
        return jsonResponse(res, 200, { ok: true, requests });
      } catch (error) {
        return jsonResponse(res, error.statusCode || 403, {
          error: error.message || "没有权限查看数据权利申请。"
        });
      }
    }

    const adminDataRightsStatusMatch = url.pathname.match(/^\/api\/admin\/data-rights-requests\/([^/]+)\/status$/);
    if (req.method === "POST" && adminDataRightsStatusMatch) {
      try {
        const payload = await readJsonBody(req);
        const request = await updateDataRightsRequestStatus(decodeURIComponent(adminDataRightsStatusMatch[1]), payload, session);
        return jsonResponse(res, 200, { ok: true, request });
      } catch (error) {
        return jsonResponse(res, error.statusCode || 400, {
          error: error.message || "数据权利申请状态更新失败。"
        });
      }
    }

    if (req.method === "POST" && url.pathname === "/api/account/data-rights-request") {
      try {
        const payload = await readJsonBody(req);
        const request = await createDataRightsRequest(payload, session, ownerUserId);
        return jsonResponse(res, 202, { ok: true, request });
      } catch (error) {
        return jsonResponse(res, error.statusCode || 400, {
          error: error.message || "数据权利请求提交失败。"
        });
      }
    }

    if (req.method === "GET" && url.pathname === "/api/support/feedback") {
      const feedback = await readSupportFeedback(ownerUserId);
      return jsonResponse(res, 200, { ok: true, feedback });
    }

    if (req.method === "POST" && url.pathname === "/api/support/feedback") {
      try {
        const payload = await readJsonBody(req);
        const feedback = await createSupportFeedback(payload, session, ownerUserId);
        return jsonResponse(res, 202, { ok: true, feedback });
      } catch (error) {
        return jsonResponse(res, error.statusCode || 400, {
          error: error.message || "试点反馈提交失败。"
        });
      }
    }

    if (req.method === "GET" && url.pathname === "/api/admin/support-feedback") {
      try {
        requireDataRightsAdmin(session);
        const feedback = await readAllSupportFeedback();
        return jsonResponse(res, 200, { ok: true, feedback });
      } catch (error) {
        return jsonResponse(res, error.statusCode || 403, {
          error: error.message || "没有权限查看试点反馈。"
        });
      }
    }

    const adminSupportFeedbackStatusMatch = url.pathname.match(/^\/api\/admin\/support-feedback\/([^/]+)\/status$/);
    if (req.method === "POST" && adminSupportFeedbackStatusMatch) {
      try {
        const payload = await readJsonBody(req);
        const feedback = await updateSupportFeedbackStatus(decodeURIComponent(adminSupportFeedbackStatusMatch[1]), payload, session);
        return jsonResponse(res, 200, { ok: true, feedback });
      } catch (error) {
        return jsonResponse(res, error.statusCode || 400, {
          error: error.message || "试点反馈状态更新失败。"
        });
      }
    }

    if (req.method === "GET" && url.pathname === "/api/output-file") {
      return serveOutputFile(res, url.searchParams.get("kind"), url.searchParams.get("name"), ownerUserId);
    }

    if (req.method === "GET" && url.pathname === "/api/video-save-proxy") {
      return serveRemoteVideoSaveProxy(res, url.searchParams.get("url"), url.searchParams.get("name"));
    }

    if (req.method === "GET" && url.pathname === "/api/asset-file") {
      return serveAssetFile(res, url.searchParams.get("id"), ownerUserId);
    }

    if (req.method === "GET" && url.pathname === "/api/libtv/health") {
      return jsonResponse(res, 200, await getLibTVHealth());
    }

    if (req.method === "GET" && url.pathname === "/api/tasks") {
      const limit = boundedNumber(url.searchParams.get("limit"), 50, 1, 200);
      const rows = await querySqlite(
        `
        SELECT d.*
        FROM v_video_task_dashboard d
        JOIN video_tasks vt ON vt.task_code = d."任务编号"
        WHERE COALESCE(vt.owner_user_id, ?) = ?
        ORDER BY d."更新时间" DESC
        LIMIT ?
        `,
        [defaultOwnerUserId(), ownerUserId, limit]
      );
      return jsonResponse(res, 200, { ok: true, rows });
    }

    if (req.method === "GET" && url.pathname === "/api/libtv-jobs") {
      const limit = boundedNumber(url.searchParams.get("limit"), 50, 1, 200);
      const rawRows = await querySqlite(
        `
        SELECT d.*
        FROM v_libtv_job_detail d
        JOIN video_tasks vt ON vt.task_code = d."任务编号"
        WHERE COALESCE(vt.owner_user_id, ?) = ?
        ORDER BY d."完成时间" DESC, d."创建时间" DESC
        LIMIT ?
        `,
        [defaultOwnerUserId(), ownerUserId, limit]
      );
      const rows = cleanLibtvRows(rawRows);
      return jsonResponse(res, 200, { ok: true, rows });
    }

    if (req.method === "GET" && url.pathname === "/api/selection-assets") {
      const data = await listSelectionAssets(ownerUserId);
      return jsonResponse(res, 200, { ok: true, ...data });
    }

    if (req.method === "POST" && url.pathname === "/api/selection-products") {
      const payload = await readJsonBody(req);
      try {
        const product = await createSelectionProduct(payload, ownerUserId);
        return jsonResponse(res, 201, { ok: true, product });
      } catch (error) {
        return textResponse(res, error.statusCode || 500, error.message || "Selection product create failed");
      }
    }

    if (req.method === "POST" && url.pathname === "/api/selection-products/bulk") {
      const payload = await readJsonBody(req);
      const result = await bulkUpdateSelectionProducts(payload.updates || [], ownerUserId);
      return jsonResponse(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/api/account-assets") {
      const payload = await readJsonBody(req);
      try {
        const account = await saveAccountAsset("", payload, ownerUserId);
        return jsonResponse(res, 201, { ok: true, account });
      } catch (error) {
        return textResponse(res, error.statusCode || 500, error.message || "Account asset create failed");
      }
    }

    const accountAssetMatch = url.pathname.match(/^\/api\/account-assets\/([^/]+)$/);
    if (req.method === "POST" && accountAssetMatch) {
      const payload = await readJsonBody(req);
      try {
        const account = await saveAccountAsset(decodeURIComponent(accountAssetMatch[1]), payload, ownerUserId);
        if (!account) return textResponse(res, 404, "Account asset not found");
        return jsonResponse(res, 200, { ok: true, account });
      } catch (error) {
        return textResponse(res, error.statusCode || 500, error.message || "Account asset update failed");
      }
    }

    const selectionMaterialMatch = url.pathname.match(/^\/api\/selection-products\/([^/]+)\/materials\/([^/]+)$/);
    if (selectionMaterialMatch) {
      const productId = decodeURIComponent(selectionMaterialMatch[1]);
      const materialId = decodeURIComponent(selectionMaterialMatch[2]);
      if (req.method === "POST") {
        const payload = await readJsonBody(req);
        const product = await attachSelectionProductMaterial(productId, materialId, payload, ownerUserId);
        if (!product) return textResponse(res, 404, "Selection product not found");
        return jsonResponse(res, 200, { ok: true, product });
      }
      if (req.method === "GET") {
        const ownedRows = await querySqlite(
          "SELECT id FROM selection_products WHERE id = ? AND COALESCE(owner_user_id, ?) = ? LIMIT 1",
          [productId, defaultOwnerUserId(), ownerUserId]
        );
        if (!ownedRows.length) return textResponse(res, 404, "Selection product not found");
        return serveSelectionProductMaterial(productId, materialId, res);
      }
    }

    const selectionProductMatch = url.pathname.match(/^\/api\/selection-products\/([^/]+)$/);
    if (req.method === "POST" && selectionProductMatch) {
      const payload = await readJsonBody(req);
      const product = await updateSelectionProduct(decodeURIComponent(selectionProductMatch[1]), payload, ownerUserId);
      if (!product) return textResponse(res, 404, "Selection product not found");
      return jsonResponse(res, 200, { ok: true, product });
    }

    if (req.method === "GET" && url.pathname === "/api/batch-draft") {
      const draft = await readBatchDraft(ownerUserId);
      return jsonResponse(res, 200, { ok: true, draft });
    }

    if (req.method === "POST" && url.pathname === "/api/batch-draft") {
      const payload = await readJsonBody(req);
      const draft = await writeBatchDraft(payload, ownerUserId);
      return jsonResponse(res, 200, { ok: true, draft });
    }

    if (req.method === "DELETE" && url.pathname === "/api/batch-draft") {
      await deleteBatchDraft(ownerUserId);
      return jsonResponse(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/api/batches") {
      const limit = boundedNumber(url.searchParams.get("limit"), 50, 1, 200);
      const rows = await listBatchJobs(limit, ownerUserId);
      return jsonResponse(res, 200, { ok: true, rows, activeWorkers: activeBatchItemRuns.size });
    }

    if (req.method === "POST" && url.pathname === "/api/batches") {
      const payload = await readJsonBody(req);
      const data = await createBatchJob(payload, ownerUserId);
      return jsonResponse(res, 202, { ok: true, ...data });
    }

    const batchActionMatch = url.pathname.match(/^\/api\/batches\/([^/]+)\/(start|pause|cancel|retry)$/);
    if (req.method === "POST" && batchActionMatch) {
      const [, batchId, action] = batchActionMatch;
      if (!(await batchBelongsToUser(batchId, ownerUserId))) return textResponse(res, 404, "Batch not found");
      const data =
        action === "start"
          ? await startBatch(batchId, ownerUserId)
          : action === "pause"
            ? await pauseBatch(batchId, ownerUserId)
            : action === "cancel"
              ? await cancelBatch(batchId, ownerUserId)
              : await retryBatchFailures(batchId, ownerUserId);
      if (!data) return textResponse(res, 404, "Batch not found");
      return jsonResponse(res, 200, { ok: true, ...data });
    }

    const batchDetailMatch = url.pathname.match(/^\/api\/batches\/([^/]+)$/);
    if (req.method === "GET" && batchDetailMatch) {
      const data = await getBatchDetail(batchDetailMatch[1], ownerUserId);
      if (!data) return textResponse(res, 404, "Batch not found");
      return jsonResponse(res, 200, { ok: true, ...data });
    }

    if (req.method === "GET" && url.pathname === "/api/assets") {
      const taskCode = String(url.searchParams.get("taskCode") || "").trim();
      const rows = await querySqlite(
        `
        SELECT
          pa.rowid AS asset_id,
          vt.task_code,
          vt.category,
          p.product_name,
          pa.asset_type,
          pa.sort_order,
          pa.file_path,
          pa.file_url,
          pa.format,
          pa.size_bytes,
          pa.created_at
        FROM product_assets pa
        LEFT JOIN video_tasks vt ON vt.id = pa.task_id
        LEFT JOIN products p ON p.id = pa.product_id
        WHERE COALESCE(vt.owner_user_id, pa.owner_user_id, ?) = ?
          AND (? = '' OR vt.task_code = ?)
        ORDER BY pa.created_at DESC, pa.sort_order ASC
        LIMIT 200
        `,
        [defaultOwnerUserId(), ownerUserId, taskCode, taskCode]
      );
      const outputFiles = await listOutputFiles(ownerUserId);
      return jsonResponse(res, 200, {
        ok: true,
        rows: rows.map(publicAssetRow),
        outputFiles: outputFiles.map(({ path: _path, ...file }) => file)
      });
    }

    if (req.method === "POST" && url.pathname === "/api/extract-docx") {
      const payload = await readJsonBody(req);
      const text = extractDocxTextFromBase64(payload.dataUrl || payload.base64);
      return jsonResponse(res, 200, {
        ok: true,
        name: String(payload.name || ""),
        text,
        length: text.length
      });
    }

    if (req.method === "POST" && url.pathname === "/api/runs") {
      const payload = await readJsonBody(req);
      const run = createRun("prompt", { ...payload, ownerUserId }, runFinalPromptJob, { ownerUserId });
      return jsonResponse(res, 202, { runId: run.id });
    }

    if (req.method === "POST" && url.pathname === "/api/video-runs") {
      const payload = await readJsonBody(req);
      const run = createRun("video", { ...payload, ownerUserId }, runVideoJob, { ownerUserId });
      return jsonResponse(res, 202, { runId: run.id });
    }

    if (req.method === "POST" && url.pathname === "/api/image-runs") {
      const payload = await readJsonBody(req);
      const run = createRun("text-image", { ...payload, ownerUserId }, runTextToImageJob, { ownerUserId });
      return jsonResponse(res, 202, { runId: run.id });
    }

    if (req.method === "GET" && url.pathname === "/api/text-image-canvas") {
      const limit = boundedNumber(url.searchParams.get("limit"), 300, 1, 1000);
      const nodes = await listTextImageCanvasNodes(ownerUserId, limit);
      return jsonResponse(res, 200, { canvasId: `text-image:${ownerUserId}`, nodes });
    }

    const textImageNodeMatch = /^\/api\/text-image-canvas\/nodes\/([^/]+)$/.exec(url.pathname);
    if (textImageNodeMatch && req.method === "POST") {
      const payload = await readJsonBody(req);
      const node = await updateTextImageCanvasNode(decodeURIComponent(textImageNodeMatch[1]), payload, ownerUserId);
      if (!node) return textResponse(res, 404, "Canvas node not found");
      return jsonResponse(res, 200, { node });
    }
    if (textImageNodeMatch && req.method === "DELETE") {
      const deleted = await deleteTextImageCanvasNode(decodeURIComponent(textImageNodeMatch[1]), ownerUserId);
      if (!deleted) return textResponse(res, 404, "Canvas node not found");
      return jsonResponse(res, 200, { deleted });
    }

    if (req.method === "POST" && url.pathname === "/api/stitch-runs") {
      const payload = await readJsonBody(req);
      const run = createRun("stitch", { ...payload, ownerUserId }, runStitchJob, { ownerUserId });
      return jsonResponse(res, 202, { runId: run.id });
    }

    const runCancelMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && runCancelMatch) {
      const run = runs.get(runCancelMatch[1]);
      if (!run) return textResponse(res, 404, "Run not found");
      if (run.ownerUserId && run.ownerUserId !== ownerUserId) return textResponse(res, 404, "Run not found");
      const payload = await readJsonBody(req);
      const cancelled = cancelRun(run, String(payload.reason || "用户已中断生成。"));
      return jsonResponse(res, 200, {
        ok: true,
        cancelled,
        status: run.status,
        runId: run.id
      });
    }

    const runEventsMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/events$/);
    if (req.method === "GET" && runEventsMatch) {
      const run = runs.get(runEventsMatch[1]);
      if (!run) return textResponse(res, 404, "Run not found");
      if (run.ownerUserId && run.ownerUserId !== ownerUserId) return textResponse(res, 404, "Run not found");
      return subscribeToRun(req, res, run);
    }

    const runStatusMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (req.method === "GET" && runStatusMatch) {
      const run = runs.get(runStatusMatch[1]);
      if (!run) return textResponse(res, 404, "Run not found");
      if (run.ownerUserId && run.ownerUserId !== ownerUserId) return textResponse(res, 404, "Run not found");
      return jsonResponse(res, 200, {
        id: run.id,
        kind: run.kind,
        createdAt: run.createdAt,
        status: run.status,
        events: run.events,
        result: run.result,
        error: run.error
      });
    }

    if (req.method === "POST" && url.pathname === "/api/video") {
      const payload = await readJsonBody(req);
      const data = await submitLibTVVideo({ ...payload, ownerUserId });
      return jsonResponse(res, 200, data);
    }

    if (req.method === "GET") {
      return serveStatic(req, res, url.pathname);
    }

    textResponse(res, 405, "Method not allowed");
  } catch (error) {
    jsonResponse(res, 500, {
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
}));

server.listen(config.port, () => {
  console.log(`AI Prompt Video Studio listening on http://localhost:${config.port}`);
  ensureAuthSchema()
    .then(() => ensureBatchSchema())
    .then(() => ensureTextImageCanvasSchema())
    .then(() => ensureVideoTaskSourceLinkSchema())
    .then(() => scheduleBatchProcessor())
    .catch((error) => console.error("Batch schema init failed:", error));
});
