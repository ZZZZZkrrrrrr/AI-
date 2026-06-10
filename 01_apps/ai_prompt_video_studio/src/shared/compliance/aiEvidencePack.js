export function downloadJsonFile(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function safeDownloadName(value) {
  return String(value || "download")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function compactEvidenceText(value, maxLength = 600) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function normalizeEvidenceTokenUsage(usage) {
  if (!usage) return null;
  const source = usage.current || usage;
  const promptTokens = Number(source.promptTokens || source.prompt_tokens || source.input_tokens || 0);
  const completionTokens = Number(source.completionTokens || source.completion_tokens || source.output_tokens || 0);
  const totalTokens = Number(source.totalTokens || source.total_tokens || 0) || promptTokens + completionTokens;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    calls: Number(source.calls || 0)
  };
}

function summarizeEvidenceTokenUsage(steps = [], trace = []) {
  const latestTotal = [...trace, ...steps]
    .map((item) => item?.tokenUsage?.total)
    .filter(Boolean)
    .at(-1);
  if (latestTotal) {
    return {
      promptTokens: Number(latestTotal.promptTokens || 0),
      completionTokens: Number(latestTotal.completionTokens || 0),
      totalTokens: Number(latestTotal.totalTokens || 0),
      calls: Number(latestTotal.calls || 0)
    };
  }

  const seen = new Set();
  return [...steps, ...trace].reduce(
    (total, item, index) => {
      const current = normalizeEvidenceTokenUsage(item?.tokenUsage);
      if (!current?.totalTokens) return total;
      const key = `${item.phase || item.name || item.key || index}-${item.at || ""}-${current.totalTokens}`;
      if (seen.has(key)) return total;
      seen.add(key);
      total.promptTokens += current.promptTokens;
      total.completionTokens += current.completionTokens;
      total.totalTokens += current.totalTokens;
      total.calls += 1;
      return total;
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0 }
  );
}

function resolveModelChoice(settings, type) {
  const customKey = `${type}CustomModel`;
  const selectKey = `${type}Model`;
  return String(settings?.[customKey] || settings?.[selectKey] || "").trim();
}

function stepEvidenceSummary(step = {}) {
  return {
    name: step.name || step.phase || "",
    status: step.status || "",
    message: compactEvidenceText(step.message, 240),
    at: step.at || "",
    tokenUsage: normalizeEvidenceTokenUsage(step.tokenUsage)
  };
}

function traceEvidenceSummary(event = {}) {
  return {
    type: event.type || "",
    phase: event.phase || "",
    model: event.model || event.modelName || "",
    provider: event.provider || "",
    message: compactEvidenceText(event.message, 240),
    at: event.at || "",
    tokenUsage: normalizeEvidenceTokenUsage(event.tokenUsage)
  };
}

export function buildAiDisclosureEvidencePack({
  studio = {},
  runId = "",
  promptSteps = [],
  videoSteps = [],
  modelTrace = [],
  runtime = {},
  modelSettings = {},
  videoUrl = ""
} = {}) {
  const images = Array.isArray(studio.images) ? studio.images : [];
  const currentModels = runtime?.currentModels || {};
  return {
    version: "ai-disclosure-evidence-v1",
    generatedAt: new Date().toISOString(),
    legal: {
      privacyPolicyUrl: "/legal/privacy.html",
      termsUrl: "/legal/terms.html",
      aiDisclosureUrl: "/legal/ai-disclosure.html",
      explicitLabelRecommended: "AI 生成/AI 辅助生成",
      userReviewRequired: true,
      userMustNotRemoveAiLabel: true
    },
    task: {
      runId,
      productName: studio.productName || "",
      productCategory: studio.productCategory || studio.suggestedCategory || "",
      targetDuration: Number(studio.targetDuration || 0),
      aspectRatio: studio.aspectRatio || "",
      videoMode: studio.videoMode || "",
      videoUrl: videoUrl || ""
    },
    inputSummary: {
      promptPackageName: studio.promptPackage?.name || "",
      promptTextLength: String(studio.promptPackText || "").length,
      productBrief: compactEvidenceText(studio.productBrief, 500),
      imageCount: images.length,
      images: images.map((image) => ({
        name: image.name || "",
        type: image.type || "",
        size: Number(image.size || 0)
      }))
    },
    outputSummary: {
      finalPromptLength: String(studio.finalPrompt || "").length,
      finalPromptPreview: compactEvidenceText(studio.finalPrompt, 800),
      imageAnalysisPreview: compactEvidenceText(studio.imageAnalysis, 500),
      suggestedCategory: studio.suggestedCategory || "",
      promptStepCount: promptSteps.length,
      videoStepCount: videoSteps.length
    },
    modelChannels: {
      analysis: resolveModelChoice(modelSettings, "analysis") || currentModels.analysis || currentModels.qianwenText || "",
      vision: resolveModelChoice(modelSettings, "vision") || currentModels.vision || "",
      video: currentModels.video || "",
      imageGeneration: currentModels.imageGeneration || ""
    },
    trace: {
      promptSteps: promptSteps.map(stepEvidenceSummary),
      videoSteps: videoSteps.map(stepEvidenceSummary),
      modelEvents: modelTrace.slice(-30).map(traceEvidenceSummary),
      tokenUsage: summarizeEvidenceTokenUsage(promptSteps, modelTrace)
    },
    reviewChecklist: [
      "确认商品事实、价格、资质、授权和功效表达均有证据支撑。",
      "发布前保留平台要求的 AI 生成内容标识。",
      "不得删除、篡改、伪造或隐匿 AI 标识。",
      "涉及医疗、保健、金融、未成年人、食品、化妆品等高风险领域时必须人工复核。"
    ]
  };
}
