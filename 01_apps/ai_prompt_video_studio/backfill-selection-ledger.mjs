import { readFile } from "node:fs/promises";

const baseUrl = process.env.SELECTION_API_URL || "http://127.0.0.1:5173";
const appFile = new URL("./src/App.jsx", import.meta.url);

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`接口返回不是 JSON：${pathname}`);
  }
  if (!response.ok) throw new Error(data.error || text || `HTTP ${response.status}`);
  return data;
}

async function loadSelectionHelpers() {
  const source = await readFile(appFile, "utf8");
  const start = source.indexOf("const selectionMarketSignals =");
  const end = source.indexOf("function accountCoverageTone");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("无法从 App.jsx 提取选品与资产规则。");
  }
  const helperCode = source.slice(start, end);
  return new Function(`
${helperCode}
return {
  accountFitSummaryForProduct,
  assetVerificationGateForProduct,
  buildAssetCompletionPlan,
  buildAssetVerificationSnapshotForProduct,
  hasActiveSelectionBatch,
  hasBrokenDisplayText,
  normalizeMaterialChecklist,
  productCardDraftForProduct,
  productCardPrecheck,
  productCardUpdatePayload,
  recommendedResearchSourcesForProduct,
  researchSourcePatchForProduct,
  researchTaskSummaryForProduct,
  summarizeMaterialChecklist,
  withAssetActionLogs
};
`)();
}

function planAlreadySaved(product = {}) {
  return Boolean(product.assetCompletionPlan?.version && Array.isArray(product.assetCompletionPlan?.rows));
}

function comparablePlan(plan = {}) {
  return JSON.stringify({
    status: plan.status || "",
    rows: (plan.rows || []).map((row) => ({
      id: row.id || "",
      status: row.status || "",
      action: row.action || "",
      evidence: row.evidence || "",
      owner: row.owner || ""
    }))
  });
}

function refreshGeneratedChecklist(product = {}, helpers) {
  if (!Array.isArray(product.assetChecklist) || !product.assetChecklist.length) return null;
  const current = helpers.normalizeMaterialChecklist(product);
  const defaulted = helpers.normalizeMaterialChecklist({ ...product, assetChecklist: [] });
  let changed = false;
  const next = current.map((slot) => {
    const fallback = defaulted.find((item) => item.id === slot.id);
    const hasManualEvidence = Boolean(slot.note || (slot.attachments || []).length || slot.updatedBy || slot.owner);
    const staleCriticalGap = ["compliance-proof", "real-test"].includes(slot.id)
      && slot.status === "待补"
      && fallback?.status === "已就绪"
      && !hasManualEvidence;
    if (!staleCriticalGap) return slot;
    changed = true;
    return { ...slot, status: "已就绪", note: "", updatedAt: new Date().toISOString() };
  });
  if (!changed) return null;
  return {
    assetChecklist: next,
    assetPercent: helpers.summarizeMaterialChecklist(next).percent
  };
}

function summarizeBulkResult(result = {}) {
  return {
    ok: Boolean(result.ok),
    successCount: Number(result.successCount || 0),
    failedCount: Number(result.failedCount || 0),
    failed: (result.results || []).filter((row) => !row.ok).slice(0, 8)
  };
}

function buildClosureAudit(products = [], accounts = [], helpers) {
  const testingLifecycles = new Set(["可测", "复测", "放大"]);
  const scoped = products.filter((item) => item?.id && item.lifecycle !== "淘汰");
  const testing = scoped.filter((item) => testingLifecycles.has(item.lifecycle));
  const activeTesting = testing.filter((item) => helpers.hasActiveSelectionBatch(item));
  const verificationTargets = testing.filter((item) => !helpers.hasActiveSelectionBatch(item));
  const cardGaps = testing.filter((item) => helpers.productCardPrecheck(item).status !== "pass");
  const sourceGaps = testing.filter((item) => helpers.researchTaskSummaryForProduct(item).status !== "pass");
  const accountGaps = testing.filter((item) => helpers.accountFitSummaryForProduct(item, accounts).status !== "pass");
  const planGaps = scoped.filter((item) => (helpers.buildAssetCompletionPlan(item).rows || []).length && !planAlreadySaved(item));
  const verificationRows = verificationTargets.map((product) => ({
    product,
    gate: helpers.assetVerificationGateForProduct(product, helpers.accountFitSummaryForProduct(product, accounts))
  }));
  const verificationBlocked = verificationRows.filter((row) => row.gate.computedStatus === "blocked");
  const verificationNeedsSave = verificationRows.filter((row) => row.gate.computedStatus !== "blocked" && row.gate.requiresSave);
  const verificationStale = verificationRows.filter((row) => row.gate.computedStatus !== "blocked" && row.gate.isStale);
  const savedSnapshots = verificationTargets.filter((product) => product.assetValidationSnapshot?.status);
  const rows = [
    { id: "card", gap: cardGaps, total: testing.length },
    { id: "source", gap: sourceGaps, total: testing.length },
    { id: "account", gap: accountGaps, total: testing.length },
    { id: "plan", gap: planGaps, total: scoped.length },
    { id: "verificationBlocked", gap: verificationBlocked.map((row) => row.product), total: verificationTargets.length },
    { id: "verificationNeedsSave", gap: verificationNeedsSave.map((row) => row.product), total: verificationTargets.length },
    { id: "verificationStale", gap: verificationStale.map((row) => row.product), total: verificationTargets.length }
  ];
  return {
    scoped: scoped.length,
    testing: testing.length,
    activeTesting: activeTesting.length,
    verificationTargets: verificationTargets.length,
    savedSnapshots: savedSnapshots.length,
    savedWithSignature: savedSnapshots.filter((product) => product.assetValidationSnapshot?.signature).length,
    rows: rows.map((row) => ({
      id: row.id,
      done: Math.max(0, row.total - row.gap.length),
      total: row.total,
      gapCount: row.gap.length,
      gapSkus: row.gap.map((product) => product.sku || product.id)
    }))
  };
}

async function main() {
  const helpers = await loadSelectionHelpers();
  const data = await requestJson("/api/selection-assets");
  const products = Array.isArray(data.products) ? data.products : [];
  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  if (process.argv.includes("--audit")) {
    console.log(JSON.stringify(buildClosureAudit(products, accounts, helpers), null, 2));
    return;
  }
  const testingLifecycles = new Set(["可测", "复测", "放大"]);
  const updates = [];
  const counts = {
    source: 0,
    card: 0,
    plan: 0,
    verification: 0,
    blockedVerification: 0,
    repairedStatus: 0
  };

  for (const product of products.filter((item) => item?.id && item.lifecycle !== "淘汰")) {
    let baseProduct = { ...product };
    let patch = {};
    const events = [];
    const isTesting = testingLifecycles.has(baseProduct.lifecycle);

    if (helpers.hasBrokenDisplayText(baseProduct.assetStatus)) {
      patch.assetStatus = "资产状态待系统重算";
      baseProduct = { ...baseProduct, assetStatus: patch.assetStatus };
      counts.repairedStatus += 1;
      events.push({
        type: "数据修复",
        label: "修复异常资产状态文本",
        detail: "原状态为乱码或占位符，已交由补齐计划和验证摘要覆盖。",
        target: "商品底账",
        status: "已修复"
      });
    }

    const lacksSavedSources = !Array.isArray(baseProduct.researchSources) || baseProduct.researchSources.length === 0;
    if (isTesting && (lacksSavedSources || helpers.researchTaskSummaryForProduct(baseProduct).status !== "pass")) {
      const additions = helpers.recommendedResearchSourcesForProduct(baseProduct);
      if (additions.length) {
        const sourcePatch = helpers.researchSourcePatchForProduct(baseProduct, additions);
        patch = { ...patch, ...sourcePatch };
        baseProduct = { ...baseProduct, ...sourcePatch };
        counts.source += 1;
        events.push({
          type: "调研来源",
          label: "闭环体检补入基础规则来源",
          detail: additions.map((source) => source.label).join("、"),
          target: "闭环覆盖率体检",
          status: "已补"
        });
      }
    }

    if (isTesting && helpers.productCardPrecheck(baseProduct).status !== "pass") {
      const cardDraft = helpers.productCardDraftForProduct(baseProduct);
      const cardPatch = helpers.productCardUpdatePayload(baseProduct, cardDraft);
      patch = { ...patch, ...cardPatch };
      baseProduct = { ...baseProduct, ...cardPatch };
      counts.card += 1;
      events.push({
        type: "商品卡",
        label: "闭环体检套用保守商品卡草稿",
        detail: cardPatch.cardPrecheck?.status === "pass" ? "商品卡可用" : cardPatch.cardPrecheck?.nextGap || "商品卡待核",
        target: "闭环覆盖率体检",
        status: cardPatch.cardPrecheck?.status === "pass" ? "已通过" : "已保存"
      });
    }

    const checklistPatch = refreshGeneratedChecklist(baseProduct, helpers);
    if (checklistPatch) {
      patch = { ...patch, ...checklistPatch };
      baseProduct = { ...baseProduct, ...checklistPatch };
      events.push({
        type: "素材清单",
        label: "重算过期关键素材槽位",
        detail: "当前商品卡未触发资质或真实测试硬要求，已把无人工备注的旧阻断槽位恢复为就绪。",
        target: "闭环覆盖率体检",
        status: "已修复"
      });
    }

    const plan = helpers.buildAssetCompletionPlan(baseProduct);
    const planChanged = comparablePlan(baseProduct.assetCompletionPlan || {}) !== comparablePlan(plan);
    if (!planAlreadySaved(baseProduct) || planChanged) {
      const planPatch = {
        assetCompletionPlan: plan,
        assetStatus: plan.status === "可用" ? "资产补齐计划可用" : plan.summary
      };
      patch = { ...patch, ...planPatch };
      baseProduct = { ...baseProduct, ...planPatch };
      counts.plan += 1;
      events.push({
        type: "补齐计划",
        label: "闭环体检生成资产补齐计划",
        detail: plan.summary,
        target: "闭环覆盖率体检",
        status: plan.status
      });
    }

    if (isTesting && !helpers.hasActiveSelectionBatch(baseProduct)) {
      const fit = helpers.accountFitSummaryForProduct(baseProduct, accounts);
      const snapshot = helpers.buildAssetVerificationSnapshotForProduct(baseProduct, fit);
      if (!baseProduct.assetValidationSnapshot?.status || baseProduct.assetValidationSnapshot?.signature !== snapshot.signature) {
        const verificationPatch = {
          assetValidationSnapshot: snapshot,
          assetVerificationUpdatedAt: snapshot.generatedAt,
          assetStatus: snapshot.summary
        };
        if (snapshot.status === "pass") {
          verificationPatch.assetPercent = Math.max(Number(baseProduct.assetPercent || 0), 82);
        }
        patch = { ...patch, ...verificationPatch };
        baseProduct = { ...baseProduct, ...verificationPatch };
        counts.verification += 1;
        if (snapshot.status === "blocked") counts.blockedVerification += 1;
        events.push({
          type: "资产验证",
          label: snapshot.status === "blocked" ? "闭环体检记录验证阻断" : "闭环体检保存生成前验证",
          detail: snapshot.summary,
          target: "闭环覆盖率体检",
          status: snapshot.label
        });
      }
    }

    if (events.length) {
      updates.push({
        id: product.id,
        patch: helpers.withAssetActionLogs(product, patch, events)
      });
    }
  }

  const result = updates.length
    ? await requestJson("/api/selection-products/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ updates })
    })
    : { ok: true, results: [], successCount: 0, failedCount: 0 };

  console.log(JSON.stringify({
    plannedUpdates: updates.length,
    counts,
    result: summarizeBulkResult(result)
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
