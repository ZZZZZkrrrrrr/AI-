import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const plan = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(path.join(root, "store", "screenshot-plan.json"), "utf8")));
const port = Number(process.env.SCREENSHOT_PORT || 3997);
const baseUrl = `http://127.0.0.1:${port}`;
const outputRoot = path.join(root, "store", "screenshots");
const chromeProfileDir = path.join(os.tmpdir(), `ai-video-studio-chrome-${Date.now()}`);
const mobileUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function chromeCandidates() {
  const candidates = [];
  if (process.env.CHROME_BIN) candidates.push(process.env.CHROME_BIN);
  if (process.platform === "win32") {
    candidates.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    );
  } else if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    );
  } else {
    candidates.push("/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser");
  }
  return candidates;
}

function findChrome() {
  const found = chromeCandidates().find((candidate) => candidate && existsSync(candidate));
  if (!found) {
    throw new Error("Chrome or Edge was not found. Set CHROME_BIN to enable screenshot capture.");
  }
  return found;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/healthz`);
      if (response.ok) return;
    } catch {
      await wait(500);
    }
  }
  throw new Error(`Screenshot server did not become ready at ${baseUrl}.`);
}

function launchChrome(chromePath, debugPort) {
  return spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-extensions",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${chromeProfileDir}`,
    `--remote-debugging-port=${debugPort}`,
    "about:blank"
  ], { stdio: "ignore" });
}

async function browserWebSocketUrl(debugPort) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (response.ok) {
        const data = await response.json();
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
      }
    } catch {
      await wait(250);
    }
  }
  throw new Error("Chrome DevTools endpoint did not become ready.");
}

function createCdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const eventWaiters = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message || "Chrome DevTools command failed."));
      else resolve(message.result || {});
      return;
    }

    const eventKey = `${message.sessionId || ""}:${message.method || ""}`;
    const waiters = eventWaiters.get(eventKey) || [];
    eventWaiters.delete(eventKey);
    for (const resolve of waiters) resolve(message.params || {});
  });

  function send(method, params = {}, sessionId = undefined) {
    const id = nextId++;
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
  }

  function waitFor(method, sessionId = undefined, timeoutMs = 15000) {
    const eventKey = `${sessionId || ""}:${method}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = eventWaiters.get(eventKey) || [];
        eventWaiters.set(eventKey, waiters.filter((item) => item !== wrappedResolve));
        reject(new Error(`Timed out waiting for ${method}.`));
      }, timeoutMs);
      timer.unref?.();
      const wrappedResolve = (params) => {
        clearTimeout(timer);
        resolve(params);
      };
      const waiters = eventWaiters.get(eventKey) || [];
      waiters.push(wrappedResolve);
      eventWaiters.set(eventKey, waiters);
    });
  }

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve({
      send,
      waitFor,
      close: () => socket.close()
    }));
    socket.addEventListener("error", reject);
  });
}

async function captureWithCdp(client, filePath, url, viewport, shot = {}) {
  const { targetId } = await client.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const width = Number(viewport?.width || 390);
  const height = Number(viewport?.height || 844);
  const deviceScaleFactor = Number(viewport?.deviceScaleFactor || 1);
  const mobile = width <= 480;

  await client.send("Page.enable", {}, sessionId);
  await client.send("Runtime.enable", {}, sessionId);
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `try {
      localStorage.setItem("aiugc-pwa-install-dismissed", "true");
    } catch (error) {}`
  }, sessionId);
  await client.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor,
    mobile,
    screenWidth: width,
    screenHeight: height
  }, sessionId);
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: mobile }, sessionId);
  await client.send("Emulation.setUserAgentOverride", {
    userAgent: mobile ? mobileUserAgent : "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    platform: mobile ? "iPhone" : "macOS"
  }, sessionId);

  const loadEvent = client.waitFor("Page.loadEventFired", sessionId, 20000).catch(() => null);
  await client.send("Page.navigate", { url }, sessionId);
  await loadEvent;
  await wait(2200);
  await client.send("Runtime.evaluate", {
    expression: "document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true",
    awaitPromise: true
  }, sessionId).catch(() => {});
  await runShotInteractions(client, sessionId, shot.interactions || []);
  await wait(500);

  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  }, sessionId);
  await writeFile(filePath, Buffer.from(result.data, "base64"));
  await client.send("Target.closeTarget", { targetId }).catch(() => {});
}

async function runShotInteractions(client, sessionId, interactions = []) {
  for (const interaction of interactions) {
    if (!interaction || interaction.type !== "clickText") continue;
    const text = String(interaction.text || "").trim();
    if (!text) continue;
    const expression = `(() => {
      const targetText = ${JSON.stringify(text)};
      const elements = [...document.querySelectorAll("button, a, [role='button'], [role='tab']")];
      const target = elements.find((element) => {
        const text = element.textContent?.trim() || "";
        return text === targetText || text.includes(targetText);
      });
      if (!target) return { ok: false, text: targetText };
      target.click();
      return { ok: true, text: targetText };
    })()`;
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true
    }, sessionId);
    if (result?.result?.value?.ok === false) {
      throw new Error(`Screenshot interaction failed: could not click text "${text}".`);
    }
    await wait(Number(interaction.waitMs || 500));
  }
}

function shotFileName(index, shot) {
  return `${String(index + 1).padStart(2, "0")}-${String(shot.id || "shot").replace(/[^a-z0-9_-]+/gi, "-")}.png`;
}

function captureSets() {
  return (plan.sets || []).filter((set) => ["mobile-web", "tablet-web"].includes(set.channel));
}

const chromePath = findChrome();
if (!existsSync(path.join(root, "dist", "index.html"))) {
  throw new Error("dist/index.html is missing. Run npm run build before capturing screenshots.");
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    CONSOLE_AUTH_REQUIRED: "false",
    CORS_ALLOWED_ORIGINS: `${baseUrl},http://localhost:${port}`,
    CORS_ALLOW_LOCALHOST: "true",
    LIBTV_DEFAULT_DRY_RUN: "true"
  },
  stdio: "ignore"
});

let chrome = null;
let client = null;
try {
  await waitForServer();
  await mkdir(chromeProfileDir, { recursive: true });
  const debugPort = await getFreePort();
  chrome = launchChrome(chromePath, debugPort);
  client = await createCdpClient(await browserWebSocketUrl(debugPort));

  const captured = [];
  for (const set of captureSets()) {
    const setDir = path.join(outputRoot, set.id);
    await rm(setDir, { recursive: true, force: true });
    await mkdir(setDir, { recursive: true });

    for (const [index, shot] of (set.shots || []).entries()) {
      const filePath = path.join(setDir, shotFileName(index, shot));
      const url = new URL(shot.route || "/", baseUrl).toString();
      await captureWithCdp(client, filePath, url, set.viewport, shot);

      const info = await stat(filePath);
      if (!info.isFile() || info.size <= 0) throw new Error(`Screenshot is empty: ${filePath}`);
      captured.push(path.relative(root, filePath).replaceAll(path.sep, "/"));
    }
  }

  console.log("Web screenshot capture complete");
  for (const file of captured) console.log(`- ${file}`);
} finally {
  client?.close?.();
  chrome?.kill();
  server.kill();
  await rm(chromeProfileDir, { recursive: true, force: true }).catch(() => {});
}
