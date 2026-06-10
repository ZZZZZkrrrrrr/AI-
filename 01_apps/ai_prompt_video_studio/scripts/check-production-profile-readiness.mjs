import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const profilePath = path.join(root, "deploy", "production.env.example");
const expectedPublicOrigin = "https://www.zkraiflow.top";
const blockers = [];
const warnings = [];
const passes = [];

function parseEnv(text) {
  const data = new Map();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data.set(key, value);
  }
  return data;
}

function valueOf(env, key) {
  return String(env.get(key) || "").trim();
}

function boolValue(env, key, fallback = false) {
  const value = valueOf(env, key).toLowerCase();
  if (["true", "1", "yes", "on"].includes(value)) return true;
  if (["false", "0", "no", "off"].includes(value)) return false;
  return fallback;
}

function numberValue(env, key, fallback = null) {
  const value = Number(valueOf(env, key));
  return Number.isFinite(value) ? value : fallback;
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw || raw === "*" || raw === "null") return raw;
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return raw;
  }
}

function parseOriginList(value) {
  return String(value || "")
    .split(",")
    .map((item) => normalizeOrigin(item))
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

function isLocalUrl(value) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isWindowsPath(value) {
  return /^[a-z]:\\/i.test(String(value || ""));
}

function isAbsoluteUnixPath(value) {
  return /^\//.test(String(value || ""));
}

function isTemporaryPath(value) {
  return /^\/(?:tmp|var\/tmp)(?:\/|$)/.test(String(value || ""));
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

function requireEqual(env, key, expected, message) {
  const actual = valueOf(env, key);
  if (actual === expected) addPass(message);
  else addBlocker(`${key} must be ${expected}; current template value is ${actual || "<empty>"}.`);
}

function requireBool(env, key, expected, message) {
  const actual = boolValue(env, key, !expected);
  if (actual === expected) addPass(message);
  else addBlocker(`${key} must be ${expected}.`);
}

if (!existsSync(profilePath)) {
  addBlocker("deploy/production.env.example is missing.");
} else {
  addPass("Production environment profile exists.");
}

const profile = existsSync(profilePath)
  ? parseEnv(await readFile(profilePath, "utf8"))
  : new Map();

if (profile.size) {
  requireEqual(profile, "NODE_ENV", "production", "Production profile runs with NODE_ENV=production.");
  requireEqual(profile, "PUBLIC_APP_ORIGIN", expectedPublicOrigin, "Production profile uses the provided public domain.");

  const corsOrigins = parseOriginList(valueOf(profile, "CORS_ALLOWED_ORIGINS"));
  if (corsOrigins.includes(expectedPublicOrigin)) {
    addPass("CORS allowlist includes the public domain.");
  } else {
    addBlocker(`CORS_ALLOWED_ORIGINS must include ${expectedPublicOrigin}.`);
  }
  if (corsOrigins.includes("*")) {
    addBlocker("CORS_ALLOWED_ORIGINS must not include wildcard * for authenticated APIs.");
  } else {
    addPass("CORS allowlist does not use wildcard origins.");
  }
  requireBool(profile, "CORS_ALLOW_CREDENTIALS", true, "Credentialed API requests are enabled.");
  requireBool(profile, "CORS_ALLOW_LOCALHOST", false, "Localhost CORS is disabled in the production profile.");

  requireBool(profile, "CONSOLE_AUTH_REQUIRED", true, "Console auth stays enabled in production.");
  requireBool(profile, "CONSOLE_AUTH_ALLOW_REGISTRATION", false, "Open registration stays disabled.");
  requireBool(profile, "CONSOLE_AUTH_COOKIE_SECURE", true, "Production cookies use Secure=true.");
  const sameSite = valueOf(profile, "CONSOLE_AUTH_COOKIE_SAMESITE").toLowerCase();
  if (["lax", "strict", "none"].includes(sameSite)) {
    addPass("Production cookie SameSite value is valid.");
  } else {
    addBlocker("CONSOLE_AUTH_COOKIE_SAMESITE must be Lax, Strict, or None.");
  }
  if (sameSite === "none" && !boolValue(profile, "CONSOLE_AUTH_COOKIE_SECURE", false)) {
    addBlocker("SameSite=None requires CONSOLE_AUTH_COOKIE_SECURE=true.");
  }

  const runStorageDir = valueOf(profile, "RUN_STORAGE_DIR");
  if (!runStorageDir) {
    addBlocker("RUN_STORAGE_DIR must be set in the production profile.");
  } else if (isWindowsPath(runStorageDir) || !isAbsoluteUnixPath(runStorageDir) || isTemporaryPath(runStorageDir)) {
    addBlocker("RUN_STORAGE_DIR must be a persistent non-temporary Unix path or mounted volume path.");
  } else {
    addPass("Production run storage points to a persistent server path.");
  }

  const bridgeUrl = valueOf(profile, "LIBTV_BRIDGE_URL");
  if (!bridgeUrl) {
    addBlocker("LIBTV_BRIDGE_URL must be set to a worker/private service endpoint.");
  } else if (!isHttpsUrl(bridgeUrl) || isLocalUrl(bridgeUrl)) {
    addBlocker("LIBTV_BRIDGE_URL must be a non-local HTTPS endpoint in the production profile.");
  } else {
    addPass("libTV bridge profile value is non-local HTTPS.");
  }

  for (const key of ["LIBTV_REGISTER_SCRIPT", "LIBTV_DB_PATH"]) {
    const value = valueOf(profile, key);
    if (!value) addBlocker(`${key} must be set in the production profile.`);
    else if (isWindowsPath(value) || !isAbsoluteUnixPath(value)) addBlocker(`${key} must use a server/worker path, not a Windows local path.`);
    else addPass(`${key} uses a server/worker path.`);
  }

  requireBool(profile, "LIBTV_DEFAULT_DRY_RUN", false, "Production profile is ready to enable real generation after worker validation.");
  requireBool(profile, "LIBTV_AUTO_COMPLIANCE", true, "Automatic compliance checks stay enabled.");

  const workers = numberValue(profile, "BATCH_MAX_WORKERS", 0);
  if (workers >= 1 && workers <= 5) addPass("Production worker concurrency is conservative.");
  else addBlocker("BATCH_MAX_WORKERS should stay between 1 and 5 for the first public release.");

  const timeoutMs = numberValue(profile, "MODEL_REQUEST_TIMEOUT_MS", 0);
  if (timeoutMs >= 60000 && timeoutMs <= 900000) addPass("Model request timeout is within the supported production range.");
  else addBlocker("MODEL_REQUEST_TIMEOUT_MS should stay between 60000 and 900000.");

  requireEqual(profile, "SMOKE_BASE_URL", expectedPublicOrigin, "Smoke test base URL targets the public domain.");
  requireBool(profile, "SMOKE_EXPECT_AUTH_REQUIRED", true, "Smoke test expects public auth protection.");

  for (const key of ["QIANWEN_API_KEY", "QIANWEN_VL_API_KEY", "ARK_API_KEY", "CONSOLE_AUTH_PASSWORD", "SMOKE_PASSWORD"]) {
    const value = valueOf(profile, key);
    if (/^(sk-|ak-|eyJ|[A-Za-z0-9_-]{32,})/.test(value)) {
      addBlocker(`${key} appears to contain a real secret. Keep production.env.example as a template only.`);
    } else {
      addPass(`${key} does not contain an obvious committed secret.`);
    }
  }

  if (/change-me|example\.com/i.test([bridgeUrl, valueOf(profile, "CONSOLE_AUTH_PASSWORD_SHA256")].join("\n"))) {
    addWarning("Production profile still contains placeholder values that must be replaced in the hosting platform.");
  }
}

console.log("Production profile readiness audit");
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

if (blockers.length) process.exit(1);
