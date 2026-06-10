import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const timeoutMs = Number(process.env.PUBLIC_CHECK_TIMEOUT_MS || 15000);
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

function resolveProjectPath(relativePath) {
  if (String(relativePath).startsWith("00_docs/")) return path.join(workspaceRoot, relativePath);
  return path.join(appRoot, relativePath);
}

async function fileExists(relativePath) {
  try {
    const info = await stat(resolveProjectPath(relativePath));
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

async function readText(relativePath) {
  try {
    return await readFile(resolveProjectPath(relativePath), "utf8");
  } catch {
    return "";
  }
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readText(relativePath));
  } catch (error) {
    block(`${relativePath} is missing or invalid JSON: ${error.message}`);
    return null;
  }
}

function isPlaceholder(value) {
  return /^TODO_/i.test(String(value || "").trim()) || /TODO_PUBLIC/i.test(String(value || ""));
}

function looksSecretLike(value) {
  const text = String(value || "");
  return /sk-[A-Za-z0-9_-]{20,}/.test(text)
    || /AIza[A-Za-z0-9_-]{20,}/.test(text)
    || /ghp_[A-Za-z0-9_]{20,}/.test(text)
    || /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(text)
    || /cookie\s*[:=]/i.test(text)
    || /password\s*[:=]\s*(?!<secret>|password-manager|redacted)/i.test(text);
}

function parseUrl(value, label) {
  const text = String(value || "").trim();
  if (!text) {
    block(`${label} is empty.`);
    return null;
  }
  if (isPlaceholder(text)) {
    block(`${label} still uses a TODO placeholder.`);
    return null;
  }
  let url = null;
  try {
    url = new URL(text);
  } catch {
    block(`${label} is not a valid URL: ${text}`);
    return null;
  }
  if (url.protocol !== "https:") {
    block(`${label} must use HTTPS: ${text}`);
    return null;
  }
  pass(`${label} is a public HTTPS URL.`);
  return url;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "follow"
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkReachable(url, label, expectedType) {
  try {
    const response = await fetchWithTimeout(url);
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    if (!response.ok) {
      block(`${label} returned HTTP ${response.status}: ${url}`);
      return null;
    }
    if (expectedType === "html" && !/text\/html/i.test(contentType)) {
      warn(`${label} should return text/html, got ${contentType || "unknown content-type"}.`);
    }
    if (expectedType === "json" && !/json/i.test(contentType)) {
      warn(`${label} should return JSON, got ${contentType || "unknown content-type"}.`);
    }
    if (!text.trim()) {
      block(`${label} returned an empty response: ${url}`);
      return null;
    }
    pass(`${label} is reachable with HTTP ${response.status}.`);
    return { response, text, contentType };
  } catch (error) {
    block(`${label} request failed: ${error.message}`);
    return null;
  }
}

function expectSameOrigin(url, origin, label) {
  if (!url) return;
  if (url.origin === origin) {
    pass(`${label} uses the selected public origin.`);
  } else {
    warn(`${label} is on ${url.origin}, expected ${origin}.`);
  }
}

function requireEnvValue(source, key, expectedValue) {
  const pattern = new RegExp(`^${key}=([^\\r\\n]+)`, "m");
  const match = source.match(pattern);
  if (!match) {
    block(`deploy/production.env.example is missing ${key}.`);
    return;
  }
  const actual = match[1].trim();
  if (actual.includes(expectedValue)) {
    pass(`deploy/production.env.example sets ${key} for ${expectedValue}.`);
  } else {
    block(`deploy/production.env.example ${key} should include ${expectedValue}, got ${actual}.`);
  }
}

const submission = await readJson("store/submission-readiness.json");
const privacyDraft = await readJson("store/privacy-data-safety-draft.json");
const publicSmokeEvidence = await readJson("store/evidence/public-domain-smoke-2026-06-10.json");
const envExample = await readText("deploy/production.env.example");
const publicDomainDoc = await readText("00_docs/PUBLIC_DOMAIN_READINESS_2026-06-09.md");
const publicSmokeDoc = await readText("00_docs/PUBLIC_DOMAIN_SMOKE_EVIDENCE_2026-06-10.md");

if (await fileExists("00_docs/PUBLIC_DOMAIN_READINESS_2026-06-09.md")) {
  pass("Public domain readiness evidence document exists.");
} else {
  block("00_docs/PUBLIC_DOMAIN_READINESS_2026-06-09.md is missing.");
}

if (await fileExists("00_docs/PUBLIC_DOMAIN_SMOKE_EVIDENCE_2026-06-10.md")) {
  pass("Public domain smoke evidence document exists.");
} else {
  block("00_docs/PUBLIC_DOMAIN_SMOKE_EVIDENCE_2026-06-10.md is missing.");
}

if (publicSmokeEvidence) {
  if (publicSmokeEvidence.schemaVersion === "sanitized-public-domain-smoke-evidence-v1") pass("Public domain smoke evidence schema is current.");
  else block("Public domain smoke evidence schemaVersion must be sanitized-public-domain-smoke-evidence-v1.");
  if (publicSmokeEvidence.publicOrigin === "https://www.zkraiflow.top") pass("Public domain smoke evidence targets the production origin.");
  else block("Public domain smoke evidence must target https://www.zkraiflow.top.");
  if (publicSmokeEvidence.command === "npm run public:check") pass("Public domain smoke evidence records npm run public:check.");
  else block("Public domain smoke evidence should record npm run public:check.");
  if (Number(publicSmokeEvidence.result?.passes) >= 30 && Number(publicSmokeEvidence.result?.blockers) === 0 && Number(publicSmokeEvidence.result?.warnings) === 2) {
    pass("Public domain smoke evidence records the expected clean public check result.");
  } else {
    block("Public domain smoke evidence should record at least 30 passes, 0 blockers, and 2 owner-input warnings.");
  }
  if (Array.isArray(publicSmokeEvidence.verifiedPublicUrls) && publicSmokeEvidence.verifiedPublicUrls.length >= 6) {
    pass("Public domain smoke evidence lists the required public URLs.");
  } else {
    block("Public domain smoke evidence should list public root, support, privacy, deletion, health, and manifest URLs.");
  }
  if (Array.isArray(publicSmokeEvidence.remainingGates) && publicSmokeEvidence.remainingGates.length >= 4) {
    pass("Public domain smoke evidence keeps remaining owner/auth gates explicit.");
  } else {
    block("Public domain smoke evidence should keep remaining owner/auth gates explicit.");
  }
  if (looksSecretLike(JSON.stringify(publicSmokeEvidence))) block("Public domain smoke evidence appears to contain secret-like material.");
  else pass("Public domain smoke evidence does not contain obvious secret-like material.");
}

const app = submission?.app || {};
const googleSafety = submission?.privacy?.googleDataSafety || {};
const publicUrls = [
  ["Marketing URL", app.marketingUrl, "html"],
  ["Support URL", app.supportUrl, "html"],
  ["Privacy policy URL", app.privacyPolicyUrl, "html"],
  ["Account deletion URL", app.accountDeletionUrl, "html"],
  ["Google Play web deletion URL", googleSafety.webDeletionUrl, "html"],
  ["Privacy draft web deletion URL", privacyDraft?.googlePlayDataSafetyDraft?.webDeletionUrl, "html"]
];

const parsedUrls = publicUrls.map(([label, value, type]) => [label, parseUrl(value, label), type]);
const marketingUrl = parsedUrls.find(([label]) => label === "Marketing URL")?.[1];
const publicOrigin = marketingUrl?.origin;

if (publicOrigin) {
  pass(`Selected public origin is ${publicOrigin}.`);
  requireEnvValue(envExample, "PUBLIC_APP_ORIGIN", publicOrigin);
  requireEnvValue(envExample, "CORS_ALLOWED_ORIGINS", publicOrigin);
  requireEnvValue(envExample, "SMOKE_BASE_URL", publicOrigin);
  if (submission?.china?.domain === marketingUrl.hostname) {
    pass("China/domain metadata uses the selected public hostname.");
  } else {
    warn(`China/domain metadata is ${submission?.china?.domain || "missing"}, expected ${marketingUrl.hostname}.`);
  }
}

for (const [label, url, expectedType] of parsedUrls) {
  expectSameOrigin(url, publicOrigin, label);
  if (url) await checkReachable(url.toString(), label, expectedType);
}

if (publicOrigin) {
  const health = await checkReachable(`${publicOrigin}/api/healthz`, "Public health check", "json");
  if (health?.text) {
    try {
      const data = JSON.parse(health.text);
      if (data.ok === true && data.status === "ready") pass("Public health check reports ready.");
      else block("Public health check JSON must include ok=true and status=ready.");
      if (data.authRequired === true) pass("Public health check confirms authentication is required.");
      else warn("Public health check does not report authRequired=true.");
    } catch (error) {
      block(`Public health check is not valid JSON: ${error.message}`);
    }
  }

  const manifest = await checkReachable(`${publicOrigin}/manifest.webmanifest`, "Public PWA manifest", "json");
  if (manifest?.text) {
    try {
      const data = JSON.parse(manifest.text);
      if (data.name && data.short_name && Array.isArray(data.icons) && data.icons.length >= 3) {
        pass("Public PWA manifest exposes app identity and icons.");
      } else {
        block("Public PWA manifest should include name, short_name, and at least three icons.");
      }
    } catch (error) {
      block(`Public PWA manifest is not valid JSON: ${error.message}`);
    }
  }
}

if (publicDomainDoc.includes("https://www.zkraiflow.top") && publicDomainDoc.includes("Passes: 8") && publicDomainDoc.includes("Failures: 0")) {
  pass("Public domain readiness document records the latest unauthenticated smoke result.");
} else {
  warn("Public domain readiness document should record the public origin and latest smoke result.");
}

if (publicSmokeDoc.includes("https://www.zkraiflow.top") && publicSmokeDoc.includes("30 passes") && publicSmokeDoc.includes("0 blockers")) {
  pass("Public domain smoke evidence document records the latest public check result.");
} else {
  block("Public domain smoke evidence document should record the public origin and latest public check result.");
}

if (isPlaceholder(app.contactEmail)) warn("Store contact email is still pending owner input.");
if (isPlaceholder(app.contactPhone)) warn("Store contact phone is still pending owner input.");

console.log("Public domain readiness check");
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
