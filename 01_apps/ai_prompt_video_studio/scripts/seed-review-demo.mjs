const dryRun = process.argv.includes("--dry-run");
const baseUrl = normalizeBaseUrl(process.env.REVIEW_BASE_URL || process.env.SMOKE_BASE_URL || process.env.PUBLIC_APP_ORIGIN || "http://127.0.0.1:3001");
const username = String(process.env.REVIEW_USERNAME || process.env.SMOKE_USERNAME || "").trim();
const password = String(process.env.REVIEW_PASSWORD || process.env.SMOKE_PASSWORD || "");
const timeoutMs = Number(process.env.REVIEW_SEED_TIMEOUT_MS || process.env.SMOKE_TIMEOUT_MS || 15000);

let cookie = "";
const passes = [];
const warnings = [];
const failures = [];

const demoProduct = {
  id: "review-demo-product-001",
  sku: "REVIEW-DEMO-SKU-001",
  category: "demo-product",
  node: "review-demo",
  lifecycle: "ready-for-review",
  assetStatus: "review demo assets prepared",
  assetPercent: 80,
  riskLevel: "low",
  totalScore: 86,
  productName: "Review demo insulated tumbler",
  productCategory: "Home goods",
  productBrief: "A neutral demo product for app review. It contains no private customer data.",
  sellingPoints: [
    "portable everyday use",
    "clean visual style",
    "suitable for dry-run video workflow"
  ],
  promptPackageSummary: "Use product image, neutral selling points, and a 15-second ecommerce video structure.",
  complianceNotes: [
    "No medical, financial, or guaranteed-result claims.",
    "No private customer asset.",
    "Human review is required before publishing AI-generated output."
  ]
};

const demoAccountAsset = {
  id: "review-demo-account-001",
  name: "Review Demo Account",
  position: "App Store / Google Play reviewer demo",
  recommended: [demoProduct.sku],
  notes: "Seeded sample account asset for reviewer path. Do not use real customer data.",
  channels: ["app-store-review", "google-play-review"],
  contentBoundaries: [
    "dry-run generation only until production worker is validated",
    "reviewer can inspect privacy, support, export, and deletion request entry points"
  ]
};

const demoBatch = {
  name: "Review demo dry-run batch",
  concurrency: 1,
  autoStart: false,
  source: "review-demo-seed",
  createdBy: "review-demo-seed-script",
  items: [
    {
      taskNo: "REVIEW-DEMO-001",
      promptFileName: "review-demo-prompt.txt",
      promptPackText: [
        "Create a 15-second ecommerce short video prompt for a neutral insulated tumbler.",
        "Keep claims factual and avoid guaranteed results.",
        "Use simple scene directions suitable for app review dry-run."
      ].join("\n"),
      images: [],
      productName: demoProduct.productName,
      productCategory: demoProduct.productCategory,
      productBrief: demoProduct.productBrief,
      targetDuration: 15,
      aspectRatio: "9:16",
      videoMode: "dry-run",
      autoSubmit: false,
      modelSettings: {},
      maxRetries: 1
    }
  ]
};

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function seedUrl(pathname) {
  return new URL(pathname, `${baseUrl}/`).toString();
}

function pass(message) {
  passes.push(message);
}

function warn(message) {
  warnings.push(message);
}

function fail(message) {
  failures.push(message);
}

async function fetchWithTimeout(pathname, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(seedUrl(pathname), {
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

async function requestJson(pathname, options = {}, label = pathname) {
  const response = await fetchWithTimeout(pathname, options);
  const data = await readResponse(response);
  if (!response.ok) {
    const error = new Error(`${label} failed with HTTP ${response.status}: ${data.error || data.raw || "unknown error"}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function validatePayloads() {
  if (!demoProduct.id || !demoProduct.sku || !demoProduct.productName) fail("Demo product payload is incomplete.");
  else pass("Demo product payload is complete.");

  if (!demoAccountAsset.id || !demoAccountAsset.name) fail("Demo account asset payload is incomplete.");
  else pass("Demo account asset payload is complete.");

  if (!demoBatch.items.length || !demoBatch.items[0].promptPackText) fail("Demo batch payload is incomplete.");
  else pass("Demo dry-run batch payload is complete.");
}

async function login() {
  if (!username || !password) {
    throw new Error("Set REVIEW_USERNAME and REVIEW_PASSWORD, or SMOKE_USERNAME and SMOKE_PASSWORD, before seeding review data.");
  }
  const response = await fetchWithTimeout("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  const data = await readResponse(response);
  if (!response.ok) throw new Error(`Review account login failed with HTTP ${response.status}: ${data.error || "unknown error"}`);
  cookie = response.headers.get("set-cookie")?.split(";")[0] || "";
  if (!cookie) throw new Error("Review account login succeeded but no session cookie was returned.");
  pass("Review account login succeeded.");
}

async function upsertReviewProduct() {
  try {
    const data = await requestJson("/api/selection-products", {
      method: "POST",
      body: JSON.stringify(demoProduct)
    }, "Create review demo product");
    pass(`Review demo product created: ${data.product?.sku || demoProduct.sku}.`);
    return data.product;
  } catch (error) {
    if (error.status !== 409) throw error;
    const assets = await requestJson("/api/selection-assets", {}, "List selection assets");
    const existing = (assets.products || []).find((product) => product.sku === demoProduct.sku || product.id === demoProduct.id);
    if (!existing?.id) throw error;
    const data = await requestJson(`/api/selection-products/${encodeURIComponent(existing.id)}`, {
      method: "POST",
      body: JSON.stringify({ ...existing, ...demoProduct, id: existing.id })
    }, "Update review demo product");
    pass(`Review demo product updated: ${data.product?.sku || demoProduct.sku}.`);
    return data.product;
  }
}

async function upsertReviewAccountAsset() {
  try {
    const data = await requestJson("/api/account-assets", {
      method: "POST",
      body: JSON.stringify(demoAccountAsset)
    }, "Create review demo account asset");
    pass(`Review demo account asset created: ${data.account?.name || demoAccountAsset.name}.`);
    return data.account;
  } catch (error) {
    if (error.status !== 409) throw error;
    const assets = await requestJson("/api/selection-assets", {}, "List selection assets");
    const existing = (assets.accounts || []).find((account) => account.name === demoAccountAsset.name || account.id === demoAccountAsset.id);
    if (!existing?.id) throw error;
    const data = await requestJson(`/api/account-assets/${encodeURIComponent(existing.id)}`, {
      method: "POST",
      body: JSON.stringify({ ...existing, ...demoAccountAsset, id: existing.id })
    }, "Update review demo account asset");
    pass(`Review demo account asset updated: ${data.account?.name || demoAccountAsset.name}.`);
    return data.account;
  }
}

async function createReviewBatchDraft() {
  const data = await requestJson("/api/batches", {
    method: "POST",
    body: JSON.stringify(demoBatch)
  }, "Create review demo dry-run batch");
  pass(`Review demo dry-run batch created: ${data.job?.name || demoBatch.name}.`);
  return data.job;
}

async function verifyReviewData() {
  const assets = await requestJson("/api/selection-assets", {}, "Verify selection assets");
  if ((assets.products || []).some((product) => product.sku === demoProduct.sku)) {
    pass("Review demo product is visible through selection assets API.");
  } else {
    fail("Review demo product is not visible through selection assets API.");
  }
  if ((assets.accounts || []).some((account) => account.name === demoAccountAsset.name)) {
    pass("Review demo account asset is visible through selection assets API.");
  } else {
    fail("Review demo account asset is not visible through selection assets API.");
  }

  const batches = await requestJson("/api/batches?limit=20", {}, "Verify batches");
  if ((batches.rows || []).some((job) => job.name === demoBatch.name)) {
    pass("Review demo dry-run batch is visible through batches API.");
  } else {
    warn("Review demo dry-run batch was created but was not found in the latest batch list.");
  }

  await requestJson("/api/account/data-rights-requests", {}, "Verify data rights request API");
  pass("Review account can access data rights request list.");
}

console.log(`Review demo seed target: ${baseUrl}`);
validatePayloads();

if (dryRun) {
  pass("Dry run completed without network changes.");
} else {
  try {
    await login();
    await upsertReviewProduct();
    await upsertReviewAccountAsset();
    await createReviewBatchDraft();
    await verifyReviewData();
  } catch (error) {
    fail(error.message);
  }
}

console.log(`Passes: ${passes.length}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Failures: ${failures.length}`);

if (passes.length) {
  console.log("\nPasses");
  for (const message of passes) console.log(`- ${message}`);
}

if (warnings.length) {
  console.log("\nWarnings");
  for (const message of warnings) console.log(`- ${message}`);
}

if (failures.length) {
  console.error("\nFailures");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}
