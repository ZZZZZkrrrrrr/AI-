const state = {
  images: [],
  finalPrompt: "",
  promptPackage: null,
  imageAnalysis: "",
  suggestedCategory: "",
  runSteps: new Map(),
  videoRunActive: false
};

const stepList = document.querySelector("#stepList");
const progressBar = document.querySelector("#progressBar");
const runtimeStatus = document.querySelector("#runtimeStatus");
const runIdLabel = document.querySelector("#runId");
const finalPromptField = document.querySelector("#finalPrompt");
const packageJson = document.querySelector("#packageJson");
const startButton = document.querySelector("#startButton");
const copyPromptButton = document.querySelector("#copyPromptButton");
const videoButton = document.querySelector("#videoButton");
const videoStatus = document.querySelector("#videoStatus");
const videoProgress = document.querySelector("#videoProgress");
const videoProgressLabel = document.querySelector("#videoProgressLabel");
const videoProgressBar = document.querySelector("#videoProgressBar");
const videoStepList = document.querySelector("#videoStepList");

const VIDEO_STEPS = [
  { key: "保存输入", title: "保存输入", message: "保存最终提示词、提示词包 JSON 和产品图片。" },
  { key: "写入数据库", title: "写入数据库", message: "注册 video_tasks、final_product_prompts 和 product_assets。" },
  { key: "提交 libTV", title: "提交 libTV", message: "调用本机 libTV 桥接服务。" },
  { key: "libTV 完成", title: "完成", message: "等待 libTV 返回任务结果。" }
];

init();

async function init() {
  renderBaseSteps();
  bindEvents();
  await loadRuntimeStatus();
}

function bindEvents() {
  document.querySelector("#promptFile").addEventListener("change", handlePromptFile);
  document.querySelector("#imageFiles").addEventListener("change", handleImageFiles);
  document.querySelector("#runForm").addEventListener("submit", startRun);
  document.querySelector("#clearButton").addEventListener("click", clearForm);
  finalPromptField.addEventListener("input", syncFinalPromptFromField);
  copyPromptButton.addEventListener("click", copyFinalPrompt);
  videoButton.addEventListener("click", submitVideo);
}

async function loadRuntimeStatus() {
  if (location.protocol === "file:") {
    runtimeStatus.classList.remove("ready");
    runtimeStatus.querySelector("span:last-child").textContent = "请用 http://localhost:8899 打开";
    return;
  }
  try {
    const response = await fetch("/api/config");
    const data = await response.json();
    const parts = [
      data.doubaoConfigured ? "豆包已配置" : "豆包模拟",
      data.qianwenVisionConfigured ? "视觉已配置" : "视觉模拟",
      data.libtvBridgeReachable ? "libTV 已连接" : "libTV 未连接"
    ];
    runtimeStatus.classList.toggle("ready", Boolean(data.libtvBridgeReachable));
    runtimeStatus.querySelector("span:last-child").textContent = parts.join(" / ");
  } catch {
    runtimeStatus.querySelector("span:last-child").textContent = "后端未连接";
  }
}

async function handlePromptFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".doc")) {
      alert("当前支持新版 Word 文档 .docx。请把 .doc 另存为 .docx 后再上传。");
      event.target.value = "";
      return;
    }
    if (lowerName.endsWith(".docx")) {
      document.querySelector("#promptPackText").placeholder = "正在读取 Word 文档...";
      const text = await extractDocxFile(file);
      document.querySelector("#promptPackText").value = text;
      document.querySelector("#promptPackText").placeholder = "粘贴你的 SOP / 提示词包文本";
      return;
    }
    const text = await file.text();
    document.querySelector("#promptPackText").value = text;
  } catch (error) {
    alert(error.message || "提示词包读取失败");
  }
}

async function handleImageFiles(event) {
  const files = Array.from(event.target.files || []).slice(0, 6);
  state.images = await Promise.all(files.map(readImageFile));
  renderImages();
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: String(reader.result)
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function extractDocxFile(file) {
  if (location.protocol === "file:") {
    throw new Error("请用 http://localhost:8899 打开页面后再上传 Word 文档。当前 file:// 页面无法调用本地后端读取 .docx。");
  }
  const dataUrl = await readFileAsDataUrl(file);
  const response = await fetch("/api/extract-docx", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: file.name, dataUrl })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Word 文档读取失败");
  if (!data.text) throw new Error("Word 文档里没有读取到正文文字。");
  return data.text;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderImages() {
  const container = document.querySelector("#imagePreview");
  container.innerHTML = "";
  for (const image of state.images) {
    const item = document.createElement("div");
    item.className = "image-thumb";
    item.innerHTML = `<img alt="" src="${image.dataUrl}"><span title="${escapeHtml(image.name)}">${escapeHtml(image.name)}</span>`;
    container.appendChild(item);
  }
}

async function startRun(event) {
  event.preventDefault();
  const payload = {
    promptPackText: document.querySelector("#promptPackText").value.trim(),
    productName: document.querySelector("#productName").value.trim(),
    productCategory: document.querySelector("#productCategory").value.trim(),
    productBrief: document.querySelector("#productBrief").value.trim(),
    targetDuration: Number(document.querySelector("#targetDuration").value || 15),
    aspectRatio: document.querySelector("#aspectRatio").value,
    images: state.images
  };

  if (!payload.promptPackText) {
    alert("请先上传或粘贴提示词包。");
    return;
  }
  if (!payload.images.length && !payload.productBrief) {
    alert("请上传产品图，或填写商品补充信息。");
    return;
  }

  setRunning(true);
  resetResult();
  renderBaseSteps();

  const response = await fetch("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    setRunning(false);
    alert(error.error || "任务创建失败");
    return;
  }

  const { runId } = await response.json();
  runIdLabel.textContent = runId.slice(0, 8);
  connectPromptEvents(runId);
}

function connectPromptEvents(runId) {
  const events = new EventSource(`/api/runs/${runId}/events`);
  events.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handlePromptEvent(data);
  };
  events.addEventListener("done", () => {
    events.close();
    setRunning(false);
  });
  events.onerror = () => {
    events.close();
    setRunning(false);
  };
}

function handlePromptEvent(event) {
  if (event.type === "status") {
    updateNamedStep(event.phase, "running", event.message);
  }
  if (event.type === "image_analysis") {
    state.imageAnalysis = event.output || "";
    updateNamedStep("图片识别", "done", event.message, event.output);
  }
  if (event.type === "category_detected") {
    state.suggestedCategory = event.category || "";
    const categoryInput = document.querySelector("#productCategory");
    if (!categoryInput.value.trim() && state.suggestedCategory) {
      categoryInput.value = state.suggestedCategory;
    }
    updateNamedStep("类别识别", "done", event.message || `已识别类别：${state.suggestedCategory}`);
  }
  if (event.type === "step_started") {
    updateNamedStep(event.stepName || `步骤 ${event.stepNo}`, "running", event.message);
  }
  if (event.type === "step_completed") {
    if (state.runSteps.has("步骤生成")) {
      updateNamedStep("步骤生成", "done", "步骤结果已生成，已按步骤展示。");
    }
    updateNamedStep(event.stepName || `步骤 ${event.stepNo}`, "done", event.message, event.output);
  }
  if (event.type === "completed") {
    updateNamedStep("最终封装", "done", event.message);
    state.suggestedCategory = event.result.suggestedCategory || state.suggestedCategory;
    const categoryInput = document.querySelector("#productCategory");
    if (!categoryInput.value.trim() && state.suggestedCategory) {
      categoryInput.value = state.suggestedCategory;
    }
    state.finalPrompt = event.result.finalPrompt;
    state.promptPackage = event.result.promptPackage;
    finalPromptField.value = state.finalPrompt;
    syncFinalPromptFromField();
    packageJson.style.display = "block";
    packageJson.textContent = JSON.stringify(state.promptPackage, null, 2);
    copyPromptButton.disabled = false;
    videoButton.disabled = false;
    if (document.querySelector("#autoSubmit").checked) {
      setTimeout(() => submitVideo(), 200);
    }
  }
  if (event.type === "failed") {
    updateNamedStep(event.phase || "失败", "failed", event.message);
    setRunning(false);
  }
  updateProgress();
}

function renderBaseSteps() {
  state.runSteps.clear();
  stepList.innerHTML = "";
  updateProgress();
}

function createStepElement(step) {
  const li = document.createElement("li");
  li.className = `step-item ${step.status}`;
  li.dataset.key = step.key;
  li.innerHTML = `
    <div class="step-index">${String(step.index + 1).padStart(2, "0")}</div>
    <div>
      <div class="step-title">${escapeHtml(step.name)}</div>
      <div class="step-message">${escapeHtml(step.message)}</div>
      <div class="step-output">${escapeHtml(truncate(step.output || "", 900))}</div>
    </div>
  `;
  return li;
}

function updateNamedStep(name, status, message, output = "") {
  const key = String(name || "处理中").trim() || "处理中";
  let step = state.runSteps.get(key);
  if (!step) {
    step = { key, index: state.runSteps.size, name: key, status: "pending", message: "", output: "" };
    state.runSteps.set(key, step);
    stepList.appendChild(createStepElement(step));
  }
  step.status = status;
  step.message = message || step.message;
  if (output) step.output = output;
  refreshStepElement(step);
}

function refreshStepElement(step) {
  const element = stepList.querySelector(`[data-key="${cssEscape(step.key)}"]`);
  if (!element) return;
  element.className = `step-item ${step.status}`;
  element.querySelector(".step-message").textContent = step.message;
  element.querySelector(".step-output").textContent = truncate(step.output || "", 900);
}

function updateProgress() {
  const steps = Array.from(state.runSteps.values());
  if (!steps.length) {
    progressBar.style.width = "0%";
    return;
  }
  const done = steps.filter((step) => step.status === "done").length;
  const running = steps.filter((step) => step.status === "running").length;
  const percent = Math.min(100, Math.round(((done + running * 0.45) / steps.length) * 100));
  progressBar.style.width = `${percent}%`;
}

function renderVideoProgress(mode) {
  videoProgress.hidden = false;
  videoProgressLabel.textContent = mode === "dry_run" ? "验证中" : "提交中";
  videoProgressBar.style.width = "4%";
  videoStepList.innerHTML = "";
  for (const [index, step] of VIDEO_STEPS.entries()) {
    const item = document.createElement("li");
    item.className = "video-step-item pending";
    item.dataset.key = step.key;
    item.innerHTML = `
      <div class="video-step-dot">${index + 1}</div>
      <div>
        <div class="video-step-title">${escapeHtml(step.title)}</div>
        <div class="video-step-message">${escapeHtml(step.message)}</div>
      </div>
    `;
    videoStepList.appendChild(item);
  }
}

function updateVideoProgress(phase, status, message = "") {
  const key = normalizeVideoPhase(phase);
  const activeIndex = VIDEO_STEPS.findIndex((step) => step.key === key);
  if (activeIndex >= 0) {
    VIDEO_STEPS.forEach((step, index) => {
      const element = videoStepList.querySelector(`[data-key="${cssEscape(step.key)}"]`);
      if (!element) return;
      if (status === "failed" && index === activeIndex) {
        element.className = "video-step-item failed";
      } else if (index < activeIndex) {
        element.className = "video-step-item done";
      } else if (index === activeIndex) {
        element.className = `video-step-item ${status}`;
      }
    });
    const element = videoStepList.querySelector(`[data-key="${cssEscape(key)}"]`);
    if (element && message) element.querySelector(".video-step-message").textContent = message;
  }
  const doneCount = Array.from(videoStepList.querySelectorAll(".video-step-item.done")).length;
  const runningCount = Array.from(videoStepList.querySelectorAll(".video-step-item.running")).length;
  const failed = Boolean(videoStepList.querySelector(".video-step-item.failed"));
  const percent = failed ? Math.max(8, Math.round(((doneCount + runningCount * 0.45) / VIDEO_STEPS.length) * 100)) : Math.round(((doneCount + runningCount * 0.45) / VIDEO_STEPS.length) * 100);
  videoProgressBar.style.width = `${Math.max(4, Math.min(100, percent))}%`;
  if (failed) videoProgressLabel.textContent = "失败";
}

function completeVideoProgress(message) {
  for (const step of VIDEO_STEPS) {
    const element = videoStepList.querySelector(`[data-key="${cssEscape(step.key)}"]`);
    if (element) element.className = "video-step-item done";
  }
  const finalElement = videoStepList.querySelector(`[data-key="${cssEscape("libTV 完成")}"]`);
  if (finalElement && message) finalElement.querySelector(".video-step-message").textContent = message;
  videoProgressBar.style.width = "100%";
  videoProgressLabel.textContent = "已完成";
}

function resetVideoProgress() {
  videoProgress.hidden = true;
  videoProgressLabel.textContent = "等待提交";
  videoProgressBar.style.width = "0%";
  videoStepList.innerHTML = "";
}

function normalizeVideoPhase(phase) {
  const value = String(phase || "");
  if (value.includes("保存")) return "保存输入";
  if (value.includes("数据库")) return "写入数据库";
  if (value.includes("提交")) return "提交 libTV";
  if (value.includes("完成")) return "libTV 完成";
  if (value.includes("失败")) return "提交 libTV";
  return value;
}

function setRunning(isRunning) {
  startButton.disabled = isRunning;
  startButton.textContent = isRunning ? "生成中" : "生成最终完整提示词";
}

function resetResult() {
  state.finalPrompt = "";
  state.promptPackage = null;
  state.imageAnalysis = "";
  state.suggestedCategory = "";
  finalPromptField.value = "";
  packageJson.textContent = "";
  packageJson.style.display = "none";
  copyPromptButton.disabled = true;
  videoButton.disabled = true;
  videoStatus.textContent = "";
  resetVideoProgress();
}

function syncFinalPromptFromField() {
  state.finalPrompt = finalPromptField.value.trim();
  const hasPrompt = Boolean(state.finalPrompt);
  copyPromptButton.disabled = !hasPrompt;
  videoButton.disabled = !hasPrompt || state.videoRunActive;
}

async function copyFinalPrompt() {
  syncFinalPromptFromField();
  if (!state.finalPrompt) return;
  await navigator.clipboard.writeText(state.finalPrompt);
  copyPromptButton.textContent = "已复制";
  setTimeout(() => {
    copyPromptButton.textContent = "复制";
  }, 1200);
}

async function submitVideo() {
  syncFinalPromptFromField();
  if (state.videoRunActive) return;
  if (!state.finalPrompt) {
    alert("请先粘贴或生成最终完整提示词。");
    return;
  }
  if (!state.images.length) {
    alert("请先上传产品图片，libTV 需要产品参考图。");
    return;
  }
  const mode = document.querySelector("#videoMode").value;
  const payload = {
    finalPrompt: state.finalPrompt,
    promptPackage: state.promptPackage,
    productName: document.querySelector("#productName").value.trim(),
    productCategory: document.querySelector("#productCategory").value.trim(),
    productBrief: document.querySelector("#productBrief").value.trim(),
    imageAnalysis: state.imageAnalysis,
    suggestedCategory: state.suggestedCategory,
    images: state.images,
    duration: Number(document.querySelector("#targetDuration").value || 15),
    aspectRatio: document.querySelector("#aspectRatio").value,
    dryRun: mode === "dry_run",
    waitForVideo: mode === "run",
    download: true
  };

  state.videoRunActive = true;
  videoButton.disabled = true;
  videoStatus.textContent = "";
  renderVideoProgress(mode);
  updateVideoProgress("保存输入", "running", "正在准备保存最终提示词和产品图片。");
  appendVideoLog(mode === "dry_run" ? "开始 libTV 提交前验证。" : "开始提交 libTV 视频任务。");

  try {
    const response = await fetch("/api/video-runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "视频任务创建失败");
    connectVideoEvents(data.runId);
  } catch (error) {
    updateVideoProgress("提交 libTV", "failed", error.message);
    appendVideoLog(error.message);
    state.videoRunActive = false;
    videoButton.disabled = false;
  }
}

function connectVideoEvents(runId) {
  const events = new EventSource(`/api/runs/${runId}/events`);
  events.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleVideoEvent(data);
  };
  events.addEventListener("done", () => {
    events.close();
    state.videoRunActive = false;
    videoButton.disabled = false;
  });
  events.onerror = () => {
    events.close();
    state.videoRunActive = false;
    videoButton.disabled = false;
  };
}

function handleVideoEvent(event) {
  if (event.type === "status") {
    updateVideoProgress(event.phase, "running", event.message);
    appendVideoLog(`[${event.phase}] ${event.message}`);
  }
  if (event.type === "completed") {
    completeVideoProgress(event.message);
    appendVideoLog(`[${event.phase}] ${event.message}`);
    appendVideoLog(JSON.stringify(event.result, null, 2));
  }
  if (event.type === "failed") {
    updateVideoProgress(event.phase || "libTV 失败", "failed", event.message);
    appendVideoLog(`[${event.phase}] ${event.message}`);
  }
}

function appendVideoLog(text) {
  const current = videoStatus.textContent.trim();
  videoStatus.textContent = current ? `${current}\n${text}` : text;
  videoStatus.scrollTop = videoStatus.scrollHeight;
}

function clearForm() {
  document.querySelector("#promptFile").value = "";
  document.querySelector("#imageFiles").value = "";
  document.querySelector("#promptPackText").value = "";
  document.querySelector("#productName").value = "";
  document.querySelector("#productCategory").value = "";
  document.querySelector("#productBrief").value = "";
  state.images = [];
  renderImages();
  resetResult();
  renderBaseSteps();
  runIdLabel.textContent = "";
}

function truncate(text, max) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
