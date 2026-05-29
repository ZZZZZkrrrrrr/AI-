import { createServer } from "node:http";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { inflateRawSync } from "node:zlib";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const WORKFLOW_DIR = path.resolve(ROOT, "..", "..");
const DIST_DIR = path.join(ROOT, "dist");
const PUBLIC_DIR = existsSync(DIST_DIR) ? DIST_DIR : path.join(ROOT, "public");
const OUTPUT_DIR = path.join(WORKFLOW_DIR, "outputs", "libtv");
const MAX_BODY_BYTES = 80 * 1024 * 1024;

loadDotEnv(path.join(ROOT, ".env"));

const config = {
  port: Number(process.env.PORT || 8899),
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
  libtvDbPath: process.env.LIBTV_DB_PATH || path.join(WORKFLOW_DIR, "ai_ugc_database", "ai_ugc_product.sqlite"),
  runStorageDir: process.env.RUN_STORAGE_DIR || path.join(ROOT, "runs"),
  pythonExe: process.env.PYTHON_EXE || "py",
  libtvDefaultDryRun: coerceBool(process.env.LIBTV_DEFAULT_DRY_RUN, true)
};

const runs = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

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

function jsonResponse(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    ...corsHeaders,
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function textResponse(res, statusCode, text) {
  res.writeHead(statusCode, { ...corsHeaders, "content-type": "text/plain; charset=utf-8" });
  res.end(text);
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

function createRun(kind, payload, job) {
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

function subscribeToRun(req, res, run) {
  res.writeHead(200, {
    ...corsHeaders,
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
    emit(run, { type: "status", phase: "图片识别", message: "开始整理产品图片信息。" });
    if (config.qianwenVlKey && normalized.images.length) {
      imageAnalysis = await analyzeImagesWithQianwen(normalized, run.abortController.signal);
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
      output: imageAnalysis
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
      promptPackage: packaged
    };
    emit(run, {
      type: "completed",
      phase: "完成",
      message: "最终完整提示词已生成。",
      result: run.result
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
    targetDuration: boundedNumber(payload.targetDuration, 15, 3, 60),
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
    duration: boundedNumber(payload.duration, 15, 3, 60),
    aspectRatio: String(payload.aspectRatio || "9:16"),
    dryRun: coerceBool(payload.dryRun, config.libtvDefaultDryRun),
    waitForVideo: coerceBool(payload.waitForVideo, false),
    download: coerceBool(payload.download, true),
    count: boundedNumber(payload.count, 1, 1, 4),
    model: String(payload.model || "").trim(),
    resolution: String(payload.resolution || "").trim(),
    taskCode: String(payload.taskCode || "").trim(),
    pollInterval: boundedNumber(payload.pollInterval, 30, 5, 120),
    maxWaitSeconds: boundedNumber(payload.maxWaitSeconds, 1800, 60, 7200)
  };
}

function normalizeImages(images) {
  return Array.isArray(images)
    ? images
        .filter((image) => image && image.dataUrl && String(image.dataUrl).startsWith("data:image/"))
        .slice(0, 6)
        .map((image) => ({
          name: String(image.name || "product-image"),
          type: String(image.type || "image/png"),
          size: Number(image.size || 0),
          dataUrl: String(image.dataUrl)
        }))
    : [];
}

function boundedNumber(value, fallback, min, max) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

async function analyzeImagesWithQianwen(payload, signal) {
  const imageContent = payload.images.slice(0, 3).map((image) => ({
    type: "image_url",
    image_url: { url: image.dataUrl }
  }));
  const response = await callChatCompletion({
    url: `${config.qianwenBaseUrl.replace(/\/$/, "")}/chat/completions`,
    apiKey: config.qianwenVlKey,
    model: getVisionModel(payload),
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
  return extractAssistantText(response);
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
  const timeout = setTimeout(() => controller.abort(new Error("模型调用超时。")), 180000);
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
    download: normalized.download,
    poll_interval: String(normalized.pollInterval),
    max_wait_seconds: String(normalized.maxWaitSeconds)
  };
  if (normalized.model) bridgePayload.model = normalized.model;
  if (normalized.resolution) bridgePayload.resolution = normalized.resolution;

  emitVideo({
    type: "status",
    phase: "提交 libTV",
    message: normalized.dryRun
      ? "正在做 libTV 提交前验证，不会真实提交。"
      : normalized.waitForVideo
        ? "正在真实提交 libTV，并等待生成结果。"
        : "正在真实提交 libTV 任务。"
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
    registered,
    bridge: bridgeResult
  };
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
con = sqlite3.connect(db_path)
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

async function querySqlite(sql, params = []) {
  const script = `
import json
import sqlite3
import sys

db_path = sys.argv[1]
sql = sys.argv[2]
params = json.loads(sys.argv[3])
con = sqlite3.connect(db_path)
con.row_factory = sqlite3.Row
rows = con.execute(sql, params).fetchall()
print(json.dumps([dict(row) for row in rows], ensure_ascii=False))
`;
  const result = await runProcess(config.pythonExe, pythonInlineArgs(script, config.libtvDbPath, sql, JSON.stringify(params)), {
    cwd: WORKFLOW_DIR,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8"
    }
  });
  return parseJsonFromText(result.stdout, "无法读取 SQLite 查询结果。");
}

async function listOutputFiles() {
  if (!existsSync(OUTPUT_DIR)) return [];
  const entries = await readdir(OUTPUT_DIR, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(OUTPUT_DIR, entry.name);
    const fileStat = await stat(filePath);
    files.push({
      name: entry.name,
      path: filePath,
      size: fileStat.size,
      updatedAt: fileStat.mtime.toISOString()
    });
  }
  return files.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
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
        promptPackage: payload.promptPackage
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
    savedImages.push({ name: image.name, type: parsed.mime, path: imagePath, size: parsed.buffer.length });
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
  return parseJsonFromText(result.stdout, "libTV 注册脚本没有返回 JSON。");
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
      const detail = data.error || data.stderr || data.result || text || "libTV bridge returned ok=false";
      throw new Error(`libTV bridge failed: ${String(detail).slice(0, 1200)}`);
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
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/[`"'“”‘’]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .replace(/^[-：:\s]+|[-：:\s]+$/g, "")
    .replace(/[（(].*$/, "")
    .slice(0, 40) || fallback;
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

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      return res.end();
    }

    if (req.method === "GET" && url.pathname === "/api/config") {
      const libtvHealth = await getLibTVHealth();
      return jsonResponse(res, 200, {
        qianwenTextConfigured: Boolean(config.qianwenKey),
        qianwenVisionConfigured: Boolean(config.qianwenVlKey),
        doubaoConfigured: Boolean(config.arkKey && config.doubaoUrl && config.doubaoModel),
        seedanceConfigured: Boolean(config.arkKey && config.seedanceUrl && config.seedanceModel),
        seedreamConfigured: Boolean(config.arkKey && config.imageGenerationUrl && config.imageGenerationModel),
        libtvBridgeConfigured: Boolean(config.libtvBridgeUrl),
        libtvBridgeReachable: Boolean(libtvHealth.ok),
        libtvDatabase: config.libtvDbPath,
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
        libtvHealth,
        modeHint: config.arkKey ? "real-api-ready" : "mock-without-env"
      });
    }

    if (req.method === "GET" && url.pathname === "/api/libtv/health") {
      return jsonResponse(res, 200, await getLibTVHealth());
    }

    if (req.method === "GET" && url.pathname === "/api/tasks") {
      const limit = boundedNumber(url.searchParams.get("limit"), 50, 1, 200);
      const rows = await querySqlite("SELECT * FROM v_video_task_dashboard LIMIT ?", [limit]);
      return jsonResponse(res, 200, { ok: true, rows });
    }

    if (req.method === "GET" && url.pathname === "/api/libtv-jobs") {
      const limit = boundedNumber(url.searchParams.get("limit"), 50, 1, 200);
      const rows = await querySqlite("SELECT * FROM v_libtv_job_detail LIMIT ?", [limit]);
      return jsonResponse(res, 200, { ok: true, rows });
    }

    if (req.method === "GET" && url.pathname === "/api/assets") {
      const taskCode = String(url.searchParams.get("taskCode") || "").trim();
      const rows = await querySqlite(
        `
        SELECT
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
        WHERE (? = '' OR vt.task_code = ?)
        ORDER BY pa.created_at DESC, pa.sort_order ASC
        LIMIT 200
        `,
        [taskCode, taskCode]
      );
      const outputFiles = await listOutputFiles();
      return jsonResponse(res, 200, { ok: true, rows, outputFiles });
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
      const run = createRun("prompt", payload, runFinalPromptJob);
      return jsonResponse(res, 202, { runId: run.id });
    }

    if (req.method === "POST" && url.pathname === "/api/video-runs") {
      const payload = await readJsonBody(req);
      const run = createRun("video", payload, runVideoJob);
      return jsonResponse(res, 202, { runId: run.id });
    }

    const runCancelMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && runCancelMatch) {
      const run = runs.get(runCancelMatch[1]);
      if (!run) return textResponse(res, 404, "Run not found");
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
      return subscribeToRun(req, res, run);
    }

    const runStatusMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
    if (req.method === "GET" && runStatusMatch) {
      const run = runs.get(runStatusMatch[1]);
      if (!run) return textResponse(res, 404, "Run not found");
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
      const data = await submitLibTVVideo(payload);
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
});

server.listen(config.port, () => {
  console.log(`AI Prompt Video Studio listening on http://localhost:${config.port}`);
});
