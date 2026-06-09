const baseUrl = normalizeBaseUrl(process.env.SMOKE_BASE_URL || process.env.PUBLIC_APP_ORIGIN || "http://127.0.0.1:3001");
const username = String(process.env.SMOKE_USERNAME || "").trim();
const password = String(process.env.SMOKE_PASSWORD || "");
const expectedAuthRequired = normalizeOptionalBool(process.env.SMOKE_EXPECT_AUTH_REQUIRED);
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

const passes = [];
const failures = [];
let cookie = "";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function normalizeOptionalBool(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return null;
  if (["true", "1", "yes", "on"].includes(text)) return true;
  if (["false", "0", "no", "off"].includes(text)) return false;
  return null;
}

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

function smokeUrl(pathname) {
  return new URL(pathname, `${baseUrl}/`).toString();
}

async function fetchWithTimeout(pathname, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(smokeUrl(pathname), {
      ...options,
      signal: controller.signal,
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function checkJson(pathname, label, predicate) {
  try {
    const response = await fetchWithTimeout(pathname);
    const data = await readResponse(response);
    if (!response.ok) {
      fail(`${label} returned HTTP ${response.status}.`);
      return null;
    }
    if (predicate && !predicate(data)) {
      fail(`${label} returned an unexpected payload.`);
      return data;
    }
    pass(`${label} is reachable.`);
    return data;
  } catch (error) {
    fail(`${label} request failed: ${error.message}`);
    return null;
  }
}

async function checkPage(pathname, label, markers = []) {
  try {
    const response = await fetchWithTimeout(pathname);
    const text = await response.text();
    if (!response.ok) {
      fail(`${label} returned HTTP ${response.status}.`);
      return;
    }
    for (const marker of markers) {
      if (!text.includes(marker)) {
        fail(`${label} is missing expected text: ${marker}`);
        return;
      }
    }
    pass(`${label} is reachable.`);
  } catch (error) {
    fail(`${label} request failed: ${error.message}`);
  }
}

async function loginIfConfigured() {
  if (!username || !password) {
    pass("Authenticated API smoke skipped because SMOKE_USERNAME/SMOKE_PASSWORD are not set.");
    return false;
  }
  try {
    const response = await fetchWithTimeout("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    const data = await readResponse(response);
    if (!response.ok) {
      fail(`Login failed with HTTP ${response.status}: ${data.error || "unknown error"}`);
      return false;
    }
    cookie = response.headers.get("set-cookie")?.split(";")[0] || "";
    if (!cookie) {
      fail("Login succeeded but no session cookie was returned.");
      return false;
    }
    pass("Login smoke succeeded.");
    return true;
  } catch (error) {
    fail(`Login request failed: ${error.message}`);
    return false;
  }
}

async function checkAuthenticatedApis() {
  const session = await checkJson("/api/auth/session", "Auth session API", (data) => data.ok === true && data.authenticated === true);
  if (session?.user?.role) pass(`Authenticated user role is ${session.user.role}.`);

  await checkJson("/api/config", "Runtime config API", (data) => data && typeof data === "object" && !("qianwenKey" in data) && !("arkKey" in data));
  await checkJson("/api/account/data-rights-requests", "User data rights API", (data) => data.ok === true && Array.isArray(data.requests));

  if (session?.user?.role === "admin") {
    await checkJson("/api/admin/data-rights-requests", "Admin data rights queue API", (data) => data.ok === true && Array.isArray(data.requests));
  }
}

console.log(`Production smoke test target: ${baseUrl}`);

const health = await checkJson("/api/healthz", "Health check", (data) => data.ok === true && data.status === "ready");
if (expectedAuthRequired !== null && health && health.authRequired !== expectedAuthRequired) {
  fail(`Health check authRequired expected ${expectedAuthRequired}, got ${health.authRequired}.`);
}

await checkJson("/manifest.webmanifest", "PWA manifest", (data) => data.name && Array.isArray(data.icons));
await checkPage("/legal/privacy.html", "Privacy policy", ["隐私政策", "删除"]);
await checkPage("/legal/terms.html", "Terms page", ["用户协议", "AI"]);
await checkPage("/legal/ai-disclosure.html", "AI disclosure page", ["AI", "标识"]);
await checkPage("/legal/delete-account.html", "Account deletion page", ["删除账号", "二次确认"]);
await checkPage("/support.html", "Support page", ["帮助", "支持"]);

if (await loginIfConfigured()) {
  await checkAuthenticatedApis();
}

console.log(`Passes: ${passes.length}`);
console.log(`Failures: ${failures.length}`);

if (passes.length) {
  console.log("\nPasses");
  for (const message of passes) console.log(`- ${message}`);
}

if (failures.length) {
  console.error("\nFailures");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}
