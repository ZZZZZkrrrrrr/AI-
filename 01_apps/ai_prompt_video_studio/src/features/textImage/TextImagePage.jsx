import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Image as ImageIcon,
  Minus,
  Move,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Video,
  X
} from "lucide-react";
import { createEventSource, formatBytes, formatDate, requestJson } from "../../api.js";
import { downloadJsonFile, safeDownloadName } from "../../shared/compliance/aiEvidencePack.js";
import { saveTextImageStudioHandoff } from "../../shared/textImageStudioHandoff.js";

const textImageSizeOptions = [
  { value: "1920x1920", label: "1:1 方图" },
  { value: "1440x2560", label: "9:16 竖图" },
  { value: "2560x1440", label: "16:9 横图" },
  { value: "1728x2304", label: "3:4 商品图" },
  { value: "2304x1728", label: "4:3 场景图" }
];

const textImagePromptPresets = [
  {
    label: "商品主图",
    prompt: "电商商品主图，干净浅色背景，商品居中，真实材质，清晰细节，柔和棚拍光线，高级商业摄影，不要文字，不要水印"
  },
  {
    label: "短视频封面",
    prompt: "短视频封面图，9:16 竖图，主体突出，强对比光影，科技感构图，画面干净，有视觉冲击力，不要文字，不要水印"
  },
  {
    label: "场景氛围",
    prompt: "电商场景氛围图，真实生活空间，产品自然出现，柔和环境光，干净构图，适合短视频带货素材，不要文字，不要水印"
  },
  {
    label: "女装画报",
    prompt: "女装品牌画报封面，成年女性模特，轻奢室内空间，柔和自然光，服装版型清晰，细节拼图感但不要真实文字，杂志留白，高级灰白配色，不要水印，不要错字"
  },
  {
    label: "直播主图",
    prompt: "直播间商品主图，商品主体突出，背景干净有层次，适合电商活动封面，高亮卖点区域但不要生成文字，明亮商业摄影，清晰边缘，不要水印"
  },
  {
    label: "详情头图",
    prompt: "电商详情页头图风格，商品居中，左侧留白，右侧细节展示区域，品牌感配色，真实材质，适合做短视频封面参考，不要真实文字，不要水印"
  },
  {
    label: "食品氛围",
    prompt: "食品饮品氛围主图，包装和食物同时出现，暖色自然光，桌面干净，食欲感强，开箱试吃场景，真实质感，不要文字，不要水印"
  },
  {
    label: "家居场景",
    prompt: "家居小家电场景图，现代干净室内空间，产品放在真实使用位置，手部操作暗示，功能感明确，画面可信，高级生活方式摄影，不要文字，不要水印"
  }
];

const textImageModeOptions = [
  { value: "text-image", label: "文生图", helper: "只用文字生成新图。" },
  { value: "image-variation", label: "图片裂变", helper: "上传原图，生成同款变体。" }
];

const imageVariationPresets = [
  {
    value: "product-background",
    label: "商品换背景",
    helper: "保留商品，换干净场景",
    prompt: "保留参考图里的商品主体、外形、颜色和关键细节，换成干净高级的电商场景背景，适合商品主图和短视频首帧，不要文字，不要水印。"
  },
  {
    value: "fashion-scene",
    label: "女装换场景",
    helper: "保留服装，换穿搭氛围",
    prompt: "保留参考图里的女装款式、版型、颜色、面料纹理和穿搭关系，换成轻奢室内或杂志感生活场景，人物自然，服装清晰，不要文字，不要水印。"
  },
  {
    value: "cover-poster",
    label: "封面裂变",
    helper: "做短视频封面参考",
    prompt: "基于参考图做短视频封面视觉，主体突出，构图更有点击感，保留核心商品或人物特征，画面干净高级，不要生成真实文字，不要水印。"
  },
  {
    value: "detail-board",
    label: "详情素材",
    helper: "补细节和卖点图",
    prompt: "基于参考图生成电商详情页素材感图片，突出材质、局部细节、使用场景和高级质感，保留主体真实性，不要文字，不要水印。"
  },
  {
    value: "creative-style",
    label: "风格变化",
    helper: "同款不同视觉风格",
    prompt: "保留参考图里的主体身份和核心特征，做不同视觉风格的创意变化，画面高级、干净、适合营销素材，不要文字，不要水印。"
  }
];

const imageVariationStrengthOptions = [
  { value: "light", label: "轻微变化", helper: "更稳，适合商品", prompt: "变化幅度要小，优先保证主体一致，不能改错商品、衣服版型、颜色和关键细节。" },
  { value: "balanced", label: "推荐变化", helper: "稳定和创意均衡", prompt: "变化幅度中等，主体保持一致，可以调整背景、光线、构图和氛围。" },
  { value: "bold", label: "大幅变化", helper: "更有创意", prompt: "变化幅度可以更大，但必须保留主体身份、商品结构和核心卖点，不要变成无关物品。" }
];

const textImageCanvasWidth = 4200;
const textImageCanvasHeight = 3200;

function resolveModelChoice(settings, type) {
  const customKey = `${type}CustomModel`;
  const selectKey = `${type}Model`;
  return String(settings?.[customKey] || settings?.[selectKey] || "").trim();
}

function truncate(value, max = 1600) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatStepTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map(pad).join(":");
}

function StepList({ steps, emptyText }) {
  if (!steps.length) return <div className="empty-state">{emptyText}</div>;
  return (
    <ol className="step-list">
      {steps.map((step, index) => (
        <li className={`step-item ${step.status}`} key={step.key}>
          <div className="step-index">{String(index + 1).padStart(2, "0")}</div>
          <div className="step-body">
            <div className="step-topline">
              <div>
                <div className="step-title">{step.name}</div>
              </div>
              <time className="step-time">{formatStepTime(step.at)}</time>
            </div>
            <div className="step-message">{step.message}</div>
            {step.output ? <pre className="step-output">{truncate(step.output)}</pre> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ProgressBar({ value }) {
  const width = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div className="progress-track">
      <div className="progress-bar" style={{ width: `${width}%` }} />
    </div>
  );
}

function ImageWaitStatus({ estimate }) {
  if (!estimate?.visible) return null;
  return (
    <div className="video-wait-card compact" role="status" aria-live="polite">
      <div className="video-wait-head">
        <div>
          <span>{estimate.statusLabel}</span>
          <strong>{estimate.percent}%</strong>
        </div>
        <em>{estimate.running ? `约剩 ${estimate.remainingLabel}` : estimate.resultLabel}</em>
      </div>
      <div className="video-wait-meter" aria-hidden="true">
        <span style={{ width: `${estimate.percent}%` }} />
      </div>
      <div className="video-wait-meta">
        <span>已等待 {estimate.elapsedLabel}</span>
        <span>{estimate.sizeLabel}</span>
        <span>{estimate.countLabel}</span>
      </div>
      <p>{estimate.helpText}</p>
    </div>
  );
}

function buildImageWaitEstimate({ steps = [], running = false, result = null, size = "1920x1920", count = 1, progress = 0, now = Date.now() }) {
  const failed = steps.some((step) => step.status === "failed");
  const completed = Boolean(result) || steps.some((step) => step.status === "done" && /完成|成功|返回|生成/i.test(`${step.name} ${step.message}`));
  const firstTime = firstStepTime(steps);
  const elapsedSeconds = firstTime ? Math.max(0, Math.floor((now - firstTime) / 1000)) : 0;
  const estimatedSeconds = estimateImageWaitSeconds(size, count);
  const timePercent = firstTime ? Math.min(96, Math.round((elapsedSeconds / Math.max(estimatedSeconds, 1)) * 96)) : 0;
  const percent = completed
    ? 100
    : failed
      ? Math.max(0, Math.min(100, Math.round(progress)))
      : running
        ? Math.max(8, Math.min(96, Math.round(Math.max(progress, timePercent))))
        : Math.max(0, Math.min(100, Math.round(progress)));
  const remainingSeconds = completed || failed ? 0 : Math.max(0, estimatedSeconds - elapsedSeconds);
  const overdue = running && elapsedSeconds > estimatedSeconds;
  return {
    visible: running || completed || failed || steps.length > 0,
    running,
    completed,
    failed,
    percent,
    elapsedLabel: formatShortDuration(elapsedSeconds),
    remainingLabel: overdue ? "稍久" : formatShortDuration(remainingSeconds),
    sizeLabel: friendlyImageSize(size),
    countLabel: `${Math.max(1, Number(count) || 1)} 张`,
    statusLabel: completed ? "图片已完成" : failed ? "生成未完成" : "正在生成图片",
    resultLabel: completed ? "100%" : failed ? "需处理" : `${percent}%`,
    helpText: completed
      ? "图片已经追加到同一个画布，可以下载或送入单条视频。"
      : failed
        ? "任务没有完成，请查看下方失败原因后重试。"
        : overdue
          ? "图片生成时间受排队和模型负载影响，页面会继续等待结果。"
          : "这是根据图片尺寸、张数和当前阶段估算的进度，真实结果返回后会自动完成。"
  };
}

function firstStepTime(steps = []) {
  return steps
    .map((step) => new Date(step.at || "").getTime())
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right)[0] || 0;
}

function estimateImageWaitSeconds(size = "1920x1920", count = 1) {
  const match = String(size || "").match(/(\d+)\s*x\s*(\d+)/i);
  const width = match ? Number(match[1]) : 1920;
  const height = match ? Number(match[2]) : 1920;
  const megapixels = Math.max(1, (width * height) / 1000000);
  const images = Math.max(1, Number(count) || 1);
  return Math.round(Math.min(210, Math.max(35, 26 + images * 16 + megapixels * 9)));
}

function friendlyImageSize(size = "") {
  const text = String(size || "");
  const match = text.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return text || "默认尺寸";
  const width = Number(match[1]);
  const height = Number(match[2]);
  const ratio = width === height ? "方图" : height > width ? "竖图" : "横图";
  return `${ratio} ${width}x${height}`;
}

function formatShortDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (!minutes) return `${rest}秒`;
  return `${minutes}分${String(rest).padStart(2, "0")}秒`;
}

function buildVariationPrompt({ preset, strength, userPrompt }) {
  const extra = String(userPrompt || "").trim();
  return [
    "请基于上传的参考图做图片裂变。",
    preset?.prompt || "",
    strength?.prompt || "",
    extra ? `补充要求：${extra}` : "",
    "输出要像真实可用的电商/短视频素材，画面清晰、主体完整、不要水印、不要乱码文字。"
  ].filter(Boolean).join("\n");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败，请重新选择。"));
    reader.readAsDataURL(file);
  });
}

function canvasNodeKindLabel(node = {}) {
  if (node.type === "source-image") return "裂变原图";
  if (node.type === "image-variation") return "裂变图";
  return "文生图";
}

export default function TextToImagePage({ runtime, modelSettings, addNotification, onRefreshAssets }) {
  const defaultModel = resolveModelChoice(modelSettings, "imageGeneration") || runtime?.currentModels?.imageGeneration || "";
  const [workMode, setWorkMode] = useState("text-image");
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("低清晰度，畸形，错误文字，水印，logo，过度模糊，杂乱背景");
  const [size, setSize] = useState("1920x1920");
  const [count, setCount] = useState(1);
  const [model, setModel] = useState(defaultModel);
  const [variationPreset, setVariationPreset] = useState("product-background");
  const [variationStrength, setVariationStrength] = useState("balanced");
  const [referenceImage, setReferenceImage] = useState(null);
  const [runId, setRunId] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [canvasNodes, setCanvasNodes] = useState([]);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [canvasError, setCanvasError] = useState("");
  const [canvasZoom, setCanvasZoom] = useState(0.82);
  const [canvasQuery, setCanvasQuery] = useState("");
  const [selectedCanvasNodeId, setSelectedCanvasNodeId] = useState("");
  const [progressNow, setProgressNow] = useState(() => Date.now());
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!model && defaultModel) setModel(defaultModel);
  }, [defaultModel, model]);

  useEffect(() => () => sourceRef.current?.close(), []);

  useEffect(() => {
    loadCanvas({ silent: true });
  }, []);

  useEffect(() => {
    if (!running) {
      setProgressNow(Date.now());
      return undefined;
    }
    setProgressNow(Date.now());
    const timer = window.setInterval(() => setProgressNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running, steps.length]);

  const configured = Boolean(runtime?.seedreamConfigured);
  const runLabel = workMode === "image-variation" ? "图片裂变" : "文生图";
  const selectedVariationPreset = imageVariationPresets.find((item) => item.value === variationPreset) || imageVariationPresets[0];
  const selectedVariationStrength = imageVariationStrengthOptions.find((item) => item.value === variationStrength) || imageVariationStrengthOptions[1];
  const progress = result ? 100 : running ? Math.min(92, 22 + steps.length * 24) : 0;
  const waitEstimate = buildImageWaitEstimate({
    steps,
    running,
    result,
    size,
    count,
    progress,
    now: progressNow
  });
  const filteredCanvasNodes = useMemo(() => {
    const keyword = canvasQuery.trim().toLowerCase();
    if (!keyword) return canvasNodes;
    return canvasNodes.filter((node) => {
      const image = node.payload?.image || {};
      const searchable = [
        node.payload?.title,
        node.payload?.prompt,
        node.payload?.negativePrompt,
        node.payload?.model,
        node.payload?.size,
        node.payload?.mode,
        node.payload?.variationLabel,
        image.name,
        image.url,
        formatDate(node.createdAt)
      ].filter(Boolean).join("\n").toLowerCase();
      return searchable.includes(keyword);
    });
  }, [canvasNodes, canvasQuery]);

  function addStep(event = {}) {
    setSteps((current) => [
      ...current,
      {
        key: `${event.type || "status"}-${event.at || Date.now()}-${current.length}`,
        name: event.phase || "文生图",
        status: event.type === "failed" ? "failed" : event.type === "completed" ? "done" : "running",
        message: event.message || "",
        output: event.output || "",
        at: event.at
      }
    ].slice(-12));
  }

  function mergeCanvasNodes(incoming = []) {
    if (!incoming.length) return;
    setCanvasNodes((current) => {
      const byId = new Map(current.map((node) => [node.id, node]));
      for (const node of incoming) byId.set(node.id, node);
      return [...byId.values()].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    });
  }

  async function loadCanvas({ silent = false } = {}) {
    setCanvasLoading(true);
    try {
      const data = await requestJson("/api/text-image-canvas?limit=500");
      setCanvasNodes(Array.isArray(data.nodes) ? data.nodes : []);
      setCanvasError("");
      if (!silent) {
        addNotification?.({
          title: "画布已刷新",
          message: `当前画布共有 ${data.nodes?.length || 0} 个节点`,
          target: "textImage"
        });
      }
    } catch (err) {
      setCanvasError(err.message || "画布读取失败。");
    } finally {
      setCanvasLoading(false);
    }
  }

  function previewCanvasNodePosition(nodeId, x, y) {
    setCanvasNodes((current) => current.map((node) => (
      node.id === nodeId ? { ...node, x, y } : node
    )));
  }

  async function saveCanvasNodePosition(nodeId, x, y) {
    try {
      const data = await requestJson(`/api/text-image-canvas/nodes/${encodeURIComponent(nodeId)}`, {
        method: "POST",
        body: JSON.stringify({ x, y })
      });
      if (data.node) mergeCanvasNodes([data.node]);
    } catch (err) {
      setCanvasError(err.message || "节点位置保存失败。");
      await loadCanvas({ silent: true });
    }
  }

  function updateCanvasZoom(delta) {
    setCanvasZoom((current) => Math.max(0.45, Math.min(1.2, Number((current + delta).toFixed(2)))));
  }

  async function deleteCanvasNode(nodeId) {
    const node = canvasNodes.find((item) => item.id === nodeId);
    const title = node?.payload?.title || "这个节点";
    if (!window.confirm(`确定从画布移除「${title}」吗？图片文件仍会保留在素材输出里。`)) return;
    try {
      await requestJson(`/api/text-image-canvas/nodes/${encodeURIComponent(nodeId)}`, {
        method: "DELETE"
      });
      setCanvasNodes((current) => current.filter((item) => item.id !== nodeId));
      setSelectedCanvasNodeId((current) => current === nodeId ? "" : current);
      addNotification?.({
        title: "画布节点已移除",
        message: "图片文件仍保留在素材输出里。",
        target: "textImage"
      });
    } catch (err) {
      setCanvasError(err.message || "节点删除失败。");
    }
  }

  function sendCanvasNodeToStudio(node) {
    try {
      const handoff = saveTextImageStudioHandoff(node);
      addNotification?.({
        level: "success",
        title: "已送入单条视频",
        message: `${handoff.imageName} 已加入单条视频的商品图片。`,
        target: "studio"
      });
      window.location.hash = "/studio";
    } catch (err) {
      addNotification?.({
        level: "error",
        title: "送入单条视频失败",
        message: err.message || "请先确认这个节点已有生成图片。",
        target: "textImage"
      });
    }
  }

  async function startGeneration(event) {
    event.preventDefault();
    const isVariation = workMode === "image-variation";
    if (isVariation && !referenceImage?.dataUrl) {
      alert("请先上传一张原图，再开始图片裂变。");
      return;
    }
    if (!isVariation && !prompt.trim()) {
      alert("请先填写文生图提示词。");
      return;
    }
    const finalPrompt = isVariation
      ? buildVariationPrompt({
          preset: selectedVariationPreset,
          strength: selectedVariationStrength,
          userPrompt: prompt
        })
      : prompt;
    setError("");
    setResult(null);
    setSteps([]);
    setRunning(true);
    sourceRef.current?.close();
    try {
      const data = await requestJson("/api/image-runs", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          finalPrompt,
          mode: workMode,
          variationIntent: selectedVariationPreset.value,
          variationLabel: selectedVariationPreset.label,
          variationStrength: selectedVariationStrength.value,
          variationStrengthLabel: selectedVariationStrength.label,
          referenceImages: isVariation ? [referenceImage] : [],
          negativePrompt,
          size,
          count,
          model: model || defaultModel,
          responseFormat: "url"
        })
      });
      setRunId(data.runId);
      const source = createEventSource(`/api/runs/${encodeURIComponent(data.runId)}/events`);
      sourceRef.current = source;
      source.onmessage = (message) => {
        const eventData = JSON.parse(message.data);
        addStep(eventData);
        if (eventData.type === "completed") {
          setResult(eventData.result);
          setRunning(false);
          mergeCanvasNodes(eventData.result?.canvasNodes || []);
          onRefreshAssets?.();
          addNotification?.({
            title: `${runLabel}完成`,
            message: `已生成 ${eventData.result?.images?.length || 0} 张图片，并追加到当前画布`,
            target: "textImage"
          });
        }
        if (eventData.type === "failed") {
          setError(eventData.message || `${runLabel}失败。`);
          setRunning(false);
        }
      };
      source.addEventListener("done", () => {
        source.close();
        sourceRef.current = null;
      });
      source.onerror = () => {
        setError(`${runLabel}连接中断，请刷新任务状态或重新生成。`);
        setRunning(false);
        source.close();
        sourceRef.current = null;
      };
    } catch (err) {
      setError(err.message || `${runLabel}启动失败。`);
      setRunning(false);
    }
  }

  async function cancelGeneration() {
    if (!runId) return;
    await requestJson(`/api/runs/${encodeURIComponent(runId)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "用户取消文生图。" })
    });
    sourceRef.current?.close();
    sourceRef.current = null;
    setRunning(false);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(workMode === "image-variation"
      ? buildVariationPrompt({ preset: selectedVariationPreset, strength: selectedVariationStrength, userPrompt: prompt })
      : prompt);
  }

  function downloadResultJson() {
    if (!result) return;
    const name = safeDownloadName(prompt || "text-image");
    downloadJsonFile(result, `${name}-文生图结果.json`);
  }

  async function handleReferenceImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("请上传图片文件。");
      event.target.value = "";
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      alert("图片建议控制在 12MB 以内。");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setReferenceImage({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl
      });
    } catch (err) {
      alert(err.message || "图片读取失败。");
    }
  }

  return (
    <section className="text-image-page">
      <form className="panel text-image-form" onSubmit={startGeneration}>
        <div className="panel-head">
          <h2>{runLabel}</h2>
          <span className={configured ? "status-pill good" : "status-pill warn"}>{configured ? "模型可用" : "待配置"}</span>
        </div>
        <div className="text-image-mode-tabs" aria-label="图片生成模式">
          {textImageModeOptions.map((option) => (
            <button
              type="button"
              className={workMode === option.value ? "active" : ""}
              key={option.value}
              onClick={() => setWorkMode(option.value)}
            >
              <strong>{option.label}</strong>
              <span>{option.helper}</span>
            </button>
          ))}
        </div>
        {workMode === "text-image" ? (
          <div className="text-image-presets" aria-label="文生图快捷模板">
            {textImagePromptPresets.map((preset) => (
              <button type="button" className="secondary-button" key={preset.label} onClick={() => setPrompt(preset.prompt)}>
                <Sparkles size={15} />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <label className={referenceImage ? "image-variation-upload has-image" : "image-variation-upload"}>
              <input type="file" accept="image/*" onChange={handleReferenceImageChange} />
              {referenceImage?.dataUrl ? (
                <img src={referenceImage.dataUrl} alt="图片裂变原图" />
              ) : (
                <span>
                  <ImageIcon size={28} />
                  上传原图
                </span>
              )}
              <strong>{referenceImage?.name || "先上传商品图、女装图或封面图"}</strong>
              <em>{referenceImage ? `${formatBytes(referenceImage.size)} · 可开始裂变` : "生成结果会追加到同一个画布"}</em>
            </label>
            <div className="image-variation-presets" aria-label="裂变方向">
              {imageVariationPresets.map((preset) => (
                <button
                  type="button"
                  className={variationPreset === preset.value ? "active" : ""}
                  key={preset.value}
                  onClick={() => setVariationPreset(preset.value)}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.helper}</span>
                </button>
              ))}
            </div>
            <div className="image-variation-strength" aria-label="变化程度">
              {imageVariationStrengthOptions.map((option) => (
                <button
                  type="button"
                  className={variationStrength === option.value ? "active" : ""}
                  key={option.value}
                  onClick={() => setVariationStrength(option.value)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.helper}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <label className="field">
          <span>{workMode === "image-variation" ? "补充要求" : "图片提示词"}</span>
          <textarea
            rows={workMode === "image-variation" ? 5 : 10}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={workMode === "image-variation" ? "可选：补充你想保留或改变的地方，例如背景更干净、适合女装画报、不要改变衣服颜色" : "描述你想要的图片：主体、场景、构图、风格、光线、颜色、禁止文字水印等"}
          />
        </label>
        <label className="field">
          <span>反向提示词</span>
          <textarea rows={3} value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} placeholder="不希望出现的内容" />
        </label>
        <div className="three-col text-image-options">
          <label className="field">
            <span>尺寸</span>
            <select value={size} onChange={(event) => setSize(event.target.value)}>
              {textImageSizeOptions.map((item) => <option value={item.value} key={item.value}>{item.label} · {item.value}</option>)}
            </select>
          </label>
          <label className="field">
            <span>张数</span>
            <input type="number" min="1" max={workMode === "image-variation" ? "8" : "4"} value={count} onChange={(event) => setCount(Number(event.target.value || 1))} />
          </label>
          <label className="field">
            <span>模型</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} placeholder={runtime?.currentModels?.imageGeneration || "Seedream"} />
          </label>
        </div>
        <div className="text-image-actions">
          <button className="secondary-button" type="button" onClick={copyPrompt} disabled={workMode === "text-image" ? !prompt.trim() : !referenceImage?.dataUrl}>
            <Copy size={16} />
            <span>{workMode === "image-variation" ? "复制裂变要求" : "复制提示词"}</span>
          </button>
          <button
            className={running ? "danger-button" : "primary-button"}
            type={running ? "button" : "submit"}
            onClick={running ? cancelGeneration : undefined}
            disabled={!running && (!configured || (workMode === "text-image" && !prompt.trim()) || (workMode === "image-variation" && !referenceImage?.dataUrl))}
          >
            {running ? <X size={17} /> : <ImageIcon size={17} />}
            <span>{running ? "中断生成" : workMode === "image-variation" ? "开始裂变" : "生成图片"}</span>
          </button>
        </div>
        {!configured ? <p className="panel-note">需要先在服务端配置文生图模型密钥和默认模型。</p> : null}
      </form>

      <section className="panel text-image-result-panel">
        <div className="panel-head">
          <h2>同一画布</h2>
          <div className="button-row text-image-canvas-actions">
            <span className="run-id">{runId ? runId.slice(0, 8) : ""}</span>
            <button type="button" className="secondary-button" onClick={() => loadCanvas()} disabled={canvasLoading}>
              <RefreshCw size={16} />
              <span>{canvasLoading ? "刷新中" : "刷新"}</span>
            </button>
            <button type="button" className="secondary-button" onClick={() => updateCanvasZoom(-0.1)} aria-label="缩小画布">
              <Minus size={16} />
            </button>
            <button type="button" className="secondary-button" onClick={() => updateCanvasZoom(0.1)} aria-label="放大画布">
              <Plus size={16} />
            </button>
            <button type="button" className="secondary-button" onClick={downloadResultJson} disabled={!result}>
              <Download size={16} />
              <span>结果包</span>
            </button>
          </div>
        </div>
        <ImageWaitStatus estimate={waitEstimate} />
        <ProgressBar value={progress} />
        <StepList steps={steps} emptyText="等待填写提示词并开始生成" />
        {error ? <div className="mobile-input-step-issues blocker"><strong>生成失败</strong><span>{error}</span></div> : null}
        {canvasError ? <div className="mobile-input-step-issues blocker"><strong>画布异常</strong><span>{canvasError}</span></div> : null}
        <div className="text-image-canvas-filter">
          <Search size={16} />
          <input
            value={canvasQuery}
            onChange={(event) => setCanvasQuery(event.target.value)}
            placeholder="搜索提示词、模型、尺寸或文件名"
            aria-label="搜索文生图画布节点"
          />
          {canvasQuery ? (
            <button type="button" onClick={() => setCanvasQuery("")} aria-label="清空画布搜索">
              <X size={15} />
            </button>
          ) : null}
          <span>{filteredCanvasNodes.length}/{canvasNodes.length} 节点</span>
        </div>
        <TextImageCanvas
          nodes={filteredCanvasNodes}
          totalNodes={canvasNodes.length}
          query={canvasQuery}
          loading={canvasLoading}
          zoom={canvasZoom}
          selectedNodeId={selectedCanvasNodeId}
          onSelectNode={setSelectedCanvasNodeId}
          onPreviewMove={previewCanvasNodePosition}
          onCommitMove={saveCanvasNodePosition}
          onDeleteNode={deleteCanvasNode}
          onSendToStudio={sendCanvasNodeToStudio}
        />
        <TextImageNodeDetail
          node={canvasNodes.find((item) => item.id === selectedCanvasNodeId)}
          onClose={() => setSelectedCanvasNodeId("")}
          onDelete={deleteCanvasNode}
          onSendToStudio={sendCanvasNodeToStudio}
        />
      </section>
    </section>
  );
}

function TextImageCanvas({ nodes, totalNodes, query, loading, zoom, selectedNodeId, onSelectNode, onPreviewMove, onCommitMove, onDeleteNode, onSendToStudio }) {
  const dragRef = useRef(null);
  const canvasWidth = Math.max(
    textImageCanvasWidth,
    ...nodes.map((node) => Number(node.x || 0) + Number(node.width || 260) + 220)
  );
  const canvasHeight = Math.max(
    textImageCanvasHeight,
    ...nodes.map((node) => Number(node.y || 0) + Number(node.height || 340) + 220)
  );

  function startDrag(event, node) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      id: node.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      nodeX: Number(node.x || 0),
      nodeY: Number(node.y || 0)
    };
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextX = Math.round(drag.nodeX + (event.clientX - drag.startX) / zoom);
    const nextY = Math.round(drag.nodeY + (event.clientY - drag.startY) / zoom);
    onPreviewMove?.(drag.id, nextX, nextY);
  }

  function endDrag(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const nextX = Math.round(drag.nodeX + (event.clientX - drag.startX) / zoom);
    const nextY = Math.round(drag.nodeY + (event.clientY - drag.startY) / zoom);
    onPreviewMove?.(drag.id, nextX, nextY);
    onCommitMove?.(drag.id, nextX, nextY);
  }

  return (
    <div className="text-image-canvas-viewport" aria-label="文生图同一画布">
      <div
        className="text-image-canvas-space"
        style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}
      >
        <div
          className="text-image-canvas-plane"
          style={{
            width: canvasWidth,
            height: canvasHeight,
            transform: `scale(${zoom})`
          }}
        >
          {nodes.map((node) => {
            const image = node.payload?.image || {};
            const kindLabel = canvasNodeKindLabel(node);
            return (
              <article
                className={[
                  "text-image-canvas-node",
                  node.type === "source-image" ? "source" : "",
                  node.type === "image-variation" ? "variation" : "",
                  node.id === selectedNodeId ? "selected" : ""
                ].filter(Boolean).join(" ")}
                key={node.id}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  minHeight: node.height
                }}
              >
                <button
                  className="text-image-node-handle"
                  type="button"
                  onClick={() => onSelectNode?.(node.id)}
                  onPointerDown={(event) => startDrag(event, node)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  <Move size={14} />
                  <span>{node.payload?.title || `${kindLabel}节点`}</span>
                </button>
                <div className="text-image-node-tools">
                  <button type="button" onClick={() => onSelectNode?.(node.id)}>详情</button>
                  <button type="button" onClick={() => onSendToStudio?.(node)}>做视频</button>
                  <button type="button" className="danger" onClick={() => onDeleteNode?.(node.id)}>移除</button>
                </div>
                <a className="text-image-node-preview" href={image.url} target="_blank" rel="noreferrer">
                  {image.url ? <img src={image.url} alt={node.payload?.prompt || "文生图结果"} /> : <ImageIcon size={32} />}
                </a>
                <div className="text-image-node-copy">
                  <em>{kindLabel}{node.payload?.variationLabel ? ` · ${node.payload.variationLabel}` : ""}</em>
                  <strong title={image.name}>{image.name || "生成图片"}</strong>
                  <span>{node.payload?.size || "-"} · {formatBytes(image.size || 0)}</span>
                  <p>{node.payload?.userPrompt || node.payload?.variationLabel || node.payload?.prompt || ""}</p>
                  <small>{formatDate(node.createdAt)}</small>
                </div>
              </article>
            );
          })}
          {!nodes.length ? (
            <div className="text-image-canvas-empty">
              {loading ? "正在读取画布..." : query && totalNodes ? "没有找到匹配的画布节点" : "当前账号还没有文生图节点"}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TextImageNodeDetail({ node, onClose, onDelete, onSendToStudio }) {
  if (!node) return null;
  const image = node.payload?.image || {};
  const kindLabel = canvasNodeKindLabel(node);
  return (
    <aside className="text-image-node-detail" aria-label={`${kindLabel}节点详情`}>
      <div className="text-image-node-detail-head">
        <div>
          <strong>{node.payload?.title || `${kindLabel}节点`}</strong>
          <span>{kindLabel} · {node.payload?.size || "-"} · {node.payload?.model || "-"}</span>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="关闭节点详情">
          <X size={16} />
        </button>
      </div>
      {image.url ? (
        <a className="text-image-node-detail-preview" href={image.url} target="_blank" rel="noreferrer">
          <img src={image.url} alt={node.payload?.prompt || "文生图结果"} />
        </a>
      ) : null}
      <dl className="text-image-node-detail-list">
        <div>
          <dt>类型</dt>
          <dd>{kindLabel}{node.payload?.variationLabel ? ` · ${node.payload.variationLabel}` : ""}</dd>
        </div>
        <div>
          <dt>生成时间</dt>
          <dd>{formatDate(node.createdAt)}</dd>
        </div>
        <div>
          <dt>文件</dt>
          <dd title={image.name}>{image.name || "-"}</dd>
        </div>
        <div>
          <dt>大小</dt>
          <dd>{formatBytes(image.size || 0)}</dd>
        </div>
        <div>
          <dt>提示词</dt>
          <dd>{node.payload?.prompt || "-"}</dd>
        </div>
        <div>
          <dt>反向提示词</dt>
          <dd>{node.payload?.negativePrompt || "-"}</dd>
        </div>
      </dl>
      <div className="text-image-node-detail-actions">
        {image.url ? (
          <a className="secondary-button" href={image.url} target="_blank" rel="noreferrer">
            <Download size={16} />
            <span>打开图片</span>
          </a>
        ) : null}
        <button type="button" className="primary-button" onClick={() => onSendToStudio?.(node)} disabled={!image.url}>
          <Video size={16} />
          <span>送入单条视频</span>
        </button>
        <button type="button" className="danger-button" onClick={() => onDelete?.(node.id)}>
          <X size={16} />
          <span>移除节点</span>
        </button>
      </div>
    </aside>
  );
}
