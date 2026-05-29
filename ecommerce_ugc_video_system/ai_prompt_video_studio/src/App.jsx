import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Brain,
  Clipboard,
  Copy,
  Database,
  FileText,
  FolderOpen,
  Image,
  LayoutDashboard,
  Moon,
  Play,
  RefreshCw,
  Settings,
  Sun,
  Upload,
  Video,
  X
} from "lucide-react";
import {
  createEventSource,
  extractDocxFile,
  findDeepValue,
  formatBytes,
  formatDate,
  readImageFile,
  requestJson
} from "./api.js";

const navItems = [
  { id: "studio", label: "提示词工作台", icon: LayoutDashboard },
  { id: "tasks", label: "任务看板", icon: Clipboard },
  { id: "libtv", label: "libTV 任务", icon: Video },
  { id: "assets", label: "素材与输出", icon: FolderOpen },
  { id: "settings", label: "系统设置", icon: Settings }
];

const emptyStudio = {
  promptPackText: "",
  productName: "",
  productCategory: "",
  productBrief: "",
  targetDuration: 15,
  aspectRatio: "9:16",
  videoMode: "dry_run",
  autoSubmit: false,
  finalPrompt: "",
  promptPackage: null,
  imageAnalysis: "",
  suggestedCategory: "",
  images: []
};

const modelSettingsKey = "aiugc-model-settings";
const defaultModelSettings = {
  analysisModel: "",
  analysisCustomModel: "",
  visionModel: "",
  visionCustomModel: "",
  videoModel: "",
  videoCustomModel: "",
  imageGenerationModel: "",
  imageGenerationCustomModel: ""
};

function readModelSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(modelSettingsKey) || "{}");
    return { ...defaultModelSettings, ...saved };
  } catch {
    return defaultModelSettings;
  }
}

function resolveModelChoice(settings, type) {
  const customKey = `${type}CustomModel`;
  const selectKey = `${type}Model`;
  return String(settings?.[customKey] || settings?.[selectKey] || "").trim();
}

function buildModelSettingsPayload(settings) {
  return {
    analysisModel: resolveModelChoice(settings, "analysis"),
    visionModel: resolveModelChoice(settings, "vision"),
    videoModel: resolveModelChoice(settings, "video"),
    imageGenerationModel: resolveModelChoice(settings, "imageGeneration")
  };
}

export function App() {
  const [page, setPage] = useState(() => location.hash.replace("#/", "") || "studio");
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("aiugc-console-theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [runtime, setRuntime] = useState(null);
  const [studio, setStudio] = useState(emptyStudio);
  const [promptSteps, setPromptSteps] = useState([]);
  const [videoSteps, setVideoSteps] = useState([]);
  const [promptRunning, setPromptRunning] = useState(false);
  const [videoRunning, setVideoRunning] = useState(false);
  const [runId, setRunId] = useState("");
  const [videoLog, setVideoLog] = useState("");
  const [tasks, setTasks] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [assets, setAssets] = useState({ rows: [], outputFiles: [] });
  const [assetTaskCode, setAssetTaskCode] = useState("");
  const [modelSettings, setModelSettings] = useState(readModelSettings);
  const [modelTrace, setModelTrace] = useState([]);

  useEffect(() => {
    const onHash = () => setPage(location.hash.replace("#/", "") || "studio");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    refreshRuntime();
    loadTasks();
    loadJobs();
    loadAssets("");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("aiugc-console-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(modelSettingsKey, JSON.stringify(modelSettings));
  }, [modelSettings]);

  function navigate(nextPage) {
    location.hash = `/${nextPage}`;
    setPage(nextPage);
  }

  async function refreshRuntime() {
    try {
      setRuntime(await requestJson("/api/config"));
    } catch (error) {
      setRuntime({ error: error.message });
    }
  }

  async function loadTasks() {
    const data = await requestJson("/api/tasks?limit=80");
    setTasks(data.rows || []);
  }

  async function loadJobs() {
    const data = await requestJson("/api/libtv-jobs?limit=80");
    setJobs(data.rows || []);
  }

  async function loadAssets(taskCode = assetTaskCode) {
    const query = taskCode ? `?taskCode=${encodeURIComponent(taskCode)}` : "";
    const data = await requestJson(`/api/assets${query}`);
    setAssets({ rows: data.rows || [], outputFiles: data.outputFiles || [] });
  }

  function updateStudio(field, value) {
    setStudio((current) => ({ ...current, [field]: value }));
  }

  function updateModelSettings(field, value) {
    setModelSettings((current) => ({ ...current, [field]: value }));
  }

  function appendModelTrace(event) {
    const output =
      event.output ||
      event.category ||
      (event.result
        ? JSON.stringify(
            {
              suggestedCategory: event.result.suggestedCategory,
              steps: event.result.steps,
              promptPackage: event.result.promptPackage
            },
            null,
            2
          )
        : "");
    setModelTrace((current) =>
      [
        ...current,
        {
          at: event.at || new Date().toISOString(),
          type: event.type || "event",
          phase: event.phase || event.stepName || event.type || "模型事件",
          message: event.message || "",
          output
        }
      ].slice(-120)
    );
  }

  function upsertPromptStep(name, status, message, output = "", at = "") {
    const key = String(name || "处理中").trim() || "处理中";
    setPromptSteps((current) => {
      const index = current.findIndex((item) => item.key === key);
      const next = {
        key,
        name: key,
        status,
        message: message || "",
        output: output || "",
        at: at || new Date().toISOString()
      };
      if (index < 0) return [...current, next];
      const copy = [...current];
      copy[index] = {
        ...copy[index],
        status,
        message: message || copy[index].message,
        output: output || copy[index].output,
        at: at || new Date().toISOString()
      };
      return copy;
    });
  }

  function upsertVideoStep(name, status, message, output = "", at = "") {
    const key = String(name || "libTV").trim() || "libTV";
    setVideoSteps((current) => {
      const index = current.findIndex((item) => item.key === key);
      const next = { key, name: key, status, message: message || "", output: output || "", at: at || new Date().toISOString() };
      if (index < 0) return [...current, next];
      const copy = [...current];
      copy[index] = {
        ...copy[index],
        status,
        message: message || copy[index].message,
        output: output || copy[index].output,
        at: at || new Date().toISOString()
      };
      return copy;
    });
  }

  async function handlePromptFile(file) {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".doc")) {
      alert("当前支持 .docx，请把 .doc 另存为 .docx 后上传。");
      return;
    }
    const text = lower.endsWith(".docx") ? await extractDocxFile(file) : await file.text();
    updateStudio("promptPackText", text);
  }

  async function handleImages(files) {
    const selected = Array.from(files || []).slice(0, 6);
    const images = await Promise.all(selected.map(readImageFile));
    updateStudio("images", images);
  }

  function resetRunState() {
    setPromptSteps([]);
    setVideoSteps([]);
    setVideoLog("");
    setRunId("");
    setModelTrace([]);
    setStudio((current) => ({
      ...current,
      finalPrompt: "",
      promptPackage: null,
      imageAnalysis: "",
      suggestedCategory: ""
    }));
  }

  async function startPromptRun(event) {
    event.preventDefault();
    if (!studio.promptPackText.trim()) {
      alert("请先上传或粘贴提示词包。");
      return;
    }
    if (!studio.images.length && !studio.productBrief.trim()) {
      alert("请上传产品图，或填写商品补充信息。");
      return;
    }
    resetRunState();
    setPromptRunning(true);
    const payload = {
      promptPackText: studio.promptPackText.trim(),
      productName: studio.productName.trim(),
      productCategory: studio.productCategory.trim(),
      productBrief: studio.productBrief.trim(),
      targetDuration: Number(studio.targetDuration || 15),
      aspectRatio: studio.aspectRatio,
      modelSettings: buildModelSettingsPayload(modelSettings),
      images: studio.images
    };
    try {
      const { runId: nextRunId } = await requestJson("/api/runs", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setRunId(nextRunId);
      connectPromptEvents(nextRunId);
    } catch (error) {
      setPromptRunning(false);
      upsertPromptStep("任务创建", "failed", error.message, "", new Date().toISOString());
    }
  }

  function connectPromptEvents(nextRunId) {
    const source = createEventSource(`/api/runs/${nextRunId}/events`);
    source.onmessage = (event) => handlePromptEvent(JSON.parse(event.data));
    source.addEventListener("done", () => {
      source.close();
      setPromptRunning(false);
    });
    source.onerror = () => {
      source.close();
      setPromptRunning(false);
    };
  }

  function handlePromptEvent(event) {
    appendModelTrace(event);
    if (event.type === "status") {
      upsertPromptStep(event.phase, "running", event.message, "", event.at);
    }
    if (event.type === "model_meta") {
      upsertPromptStep("模型配置", "done", event.message, event.output, event.at);
    }
    if (event.type === "image_analysis") {
      setStudio((current) => ({ ...current, imageAnalysis: event.output || "" }));
      upsertPromptStep("图片识别", "done", event.message, event.output, event.at);
    }
    if (event.type === "category_detected") {
      setStudio((current) => ({
        ...current,
        suggestedCategory: event.category || "",
        productCategory: current.productCategory || event.category || ""
      }));
      upsertPromptStep("类别识别", "done", event.message || `已识别类别：${event.category || "-"}`, "", event.at);
    }
    if (event.type === "step_completed") {
      upsertPromptStep(event.stepName || `步骤 ${event.stepNo}`, "done", event.message, event.output, event.at);
    }
    if (event.type === "completed") {
      const result = event.result || {};
      upsertPromptStep("最终封装", "done", event.message, "", event.at);
      setStudio((current) => {
        const next = {
          ...current,
          finalPrompt: result.finalPrompt || "",
          promptPackage: result.promptPackage || null,
          imageAnalysis: result.imageAnalysis || current.imageAnalysis,
          suggestedCategory: result.suggestedCategory || current.suggestedCategory,
          productCategory: current.productCategory || result.suggestedCategory || ""
        };
        if (current.autoSubmit && next.finalPrompt) {
          setTimeout(() => submitVideo(next), 150);
        }
        return next;
      });
      loadTasks().catch(() => {});
    }
    if (event.type === "failed") {
      upsertPromptStep(event.phase || "失败", "failed", event.message, "", event.at);
      setPromptRunning(false);
    }
    if (event.type === "cancelled") {
      upsertPromptStep(event.phase || "已中断", "cancelled", event.message || "用户已中断生成。", "", event.at);
      setPromptRunning(false);
    }
  }

  async function copyFinalPrompt() {
    if (!studio.finalPrompt.trim()) return;
    await navigator.clipboard.writeText(studio.finalPrompt);
  }

  async function cancelPromptRun() {
    if (!promptRunning) return;
    if (!runId) {
      setPromptRunning(false);
      upsertPromptStep("已中断", "cancelled", "任务尚未完成创建，已停止等待。", "", new Date().toISOString());
      return;
    }
    try {
      await requestJson(`/api/runs/${runId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "用户在网页端中断生成。" })
      });
    } catch (error) {
      upsertPromptStep("中断失败", "failed", error.message, "", new Date().toISOString());
    }
  }

  async function submitVideo(override = null) {
    const source = override || studio;
    if (!source.finalPrompt.trim()) {
      alert("请先生成或粘贴最终完整提示词。");
      return;
    }
    if (!source.images.length) {
      alert("请先上传产品图片，libTV 需要产品参考图。");
      return;
    }
    setVideoRunning(true);
    setVideoSteps([]);
    setVideoLog("");
    const payload = {
      finalPrompt: source.finalPrompt.trim(),
      promptPackage: source.promptPackage,
      productName: source.productName.trim(),
      productCategory: source.productCategory.trim(),
      productBrief: source.productBrief.trim(),
      imageAnalysis: source.imageAnalysis,
      suggestedCategory: source.suggestedCategory,
      images: source.images,
      duration: Number(source.targetDuration || 15),
      aspectRatio: source.aspectRatio,
      dryRun: source.videoMode === "dry_run",
      waitForVideo: source.videoMode === "run",
      download: true
    };
    try {
      upsertVideoStep("提交准备", "running", "正在创建视频任务。", "", new Date().toISOString());
      const { runId: nextRunId } = await requestJson("/api/video-runs", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      connectVideoEvents(nextRunId);
    } catch (error) {
      setVideoRunning(false);
      upsertVideoStep("提交失败", "failed", error.message, "", new Date().toISOString());
      appendVideoLog(error.message);
    }
  }

  function connectVideoEvents(nextRunId) {
    const source = createEventSource(`/api/runs/${nextRunId}/events`);
    source.onmessage = (event) => handleVideoEvent(JSON.parse(event.data));
    source.addEventListener("done", () => {
      source.close();
      setVideoRunning(false);
      loadTasks().catch(() => {});
      loadJobs().catch(() => {});
      loadAssets(assetTaskCode).catch(() => {});
    });
    source.onerror = () => {
      source.close();
      setVideoRunning(false);
    };
  }

  function handleVideoEvent(event) {
    if (event.type === "status") {
      upsertVideoStep(event.phase, "running", event.message, "", event.at);
      appendVideoLog(`[${event.phase}] ${event.message}`);
    }
    if (event.type === "completed") {
      upsertVideoStep(event.phase || "libTV 完成", "done", event.message, JSON.stringify(event.result, null, 2), event.at);
      appendVideoLog(`[${event.phase}] ${event.message}`);
      appendVideoLog(JSON.stringify(event.result, null, 2));
    }
    if (event.type === "failed") {
      upsertVideoStep(event.phase || "libTV 失败", "failed", event.message, "", event.at);
      appendVideoLog(`[${event.phase || "失败"}] ${event.message}`);
    }
  }

  function appendVideoLog(line) {
    setVideoLog((current) => (current ? `${current}\n${line}` : line));
  }

  function clearStudio() {
    setStudio(emptyStudio);
    setPromptSteps([]);
    setVideoSteps([]);
    setRunId("");
    setVideoLog("");
    setModelTrace([]);
  }

  const currentPage = useMemo(() => {
    if (page === "tasks") {
      return <TasksPage rows={tasks} onRefresh={loadTasks} onOpenAssets={(taskCode) => {
        setAssetTaskCode(taskCode);
        loadAssets(taskCode);
        navigate("assets");
      }} />;
    }
    if (page === "libtv") return <LibtvPage rows={jobs} onRefresh={loadJobs} />;
    if (page === "assets") {
      return (
        <AssetsPage
          tasks={tasks}
          taskCode={assetTaskCode}
          setTaskCode={setAssetTaskCode}
          data={assets}
          onRefresh={() => loadAssets(assetTaskCode)}
        />
      );
    }
    if (page === "settings") {
      return (
        <SettingsPage
          runtime={runtime}
          onRefresh={refreshRuntime}
          modelSettings={modelSettings}
          updateModelSettings={updateModelSettings}
        />
      );
    }
    return (
      <StudioPage
        studio={studio}
        updateStudio={updateStudio}
        handlePromptFile={handlePromptFile}
        handleImages={handleImages}
        startPromptRun={startPromptRun}
        clearStudio={clearStudio}
        promptSteps={promptSteps}
        promptRunning={promptRunning}
        runId={runId}
        copyFinalPrompt={copyFinalPrompt}
        cancelPromptRun={cancelPromptRun}
        submitVideo={() => submitVideo()}
        videoRunning={videoRunning}
        videoSteps={videoSteps}
        videoLog={videoLog}
        runtime={runtime}
        modelSettings={modelSettings}
        modelTrace={modelTrace}
      />
    );
  }, [page, tasks, jobs, assets, assetTaskCode, runtime, studio, promptSteps, promptRunning, runId, videoRunning, videoSteps, videoLog, modelSettings, modelTrace]);

  return (
    <div className="console-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div>
            <div className="brand-title">带货视频-SZ</div>
            <div className="brand-subtitle">本地工作流控制台</div>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => navigate(item.id)}>
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div>
            <h1>{navItems.find((item) => item.id === page)?.label || "提示词工作台"}</h1>
            <p>提示词包 + 产品图片 → 最终提示词 → 数据库任务 → libTV 视频生成</p>
          </div>
          <div className="top-actions">
            <RuntimeStatus runtime={runtime} onRefresh={refreshRuntime} />
            <ThemeSwitch theme={theme} setTheme={setTheme} />
          </div>
        </header>
        {currentPage}
      </main>
    </div>
  );
}

function ThemeSwitch({ theme, setTheme }) {
  return (
    <div className="theme-switch" aria-label="界面亮度">
      <button
        type="button"
        className={theme === "light" ? "theme-button active" : "theme-button"}
        onClick={() => setTheme("light")}
        aria-label="切换为浅色主题"
        aria-pressed={theme === "light"}
      >
        <Sun size={16} />
      </button>
      <button
        type="button"
        className={theme === "dark" ? "theme-button active" : "theme-button"}
        onClick={() => setTheme("dark")}
        aria-label="切换为深色主题"
        aria-pressed={theme === "dark"}
      >
        <Moon size={16} />
      </button>
    </div>
  );
}

function RuntimeStatus({ runtime, onRefresh }) {
  const connected = Boolean(runtime?.libtvBridgeReachable);
  const label = runtime?.error
    ? "后端未连接"
    : connected
      ? "后端 / libTV 已连接"
      : "后端可用，libTV 未连接";
  return (
    <button className={connected ? "runtime ready" : "runtime"} onClick={onRefresh}>
      <span className="status-dot" />
      <span>{label}</span>
      <RefreshCw size={15} />
    </button>
  );
}

function StudioPage(props) {
  const {
    studio,
    updateStudio,
    handlePromptFile,
    handleImages,
    startPromptRun,
    clearStudio,
    promptSteps,
    promptRunning,
    runId,
    copyFinalPrompt,
    cancelPromptRun,
    submitVideo,
    videoRunning,
    videoSteps,
    videoLog,
    runtime,
    modelSettings,
    modelTrace
  } = props;
  const [traceOpen, setTraceOpen] = useState(false);
  const promptProgress = progressPercent(promptSteps);
  const videoProgress = progressPercent(videoSteps);
  const videoUrl =
    findDeepValue(videoLog ? safeJsonFromLog(videoLog) : {}, ["video_url", "视频链接"]) ||
    (videoLog.match(/https?:\/\/\S+?\.mp4/)?.[0] || "");

  return (
    <section className="studio-grid">
      <form className="panel input-panel" onSubmit={startPromptRun}>
        <div className="panel-head">
          <h2>输入</h2>
          <button type="button" className="ghost-button" onClick={clearStudio}>清空</button>
        </div>

        <label className="field">
          <span>提示词包</span>
          <input type="file" accept=".docx,.txt,.md,.json,.csv" onChange={(event) => handlePromptFile(event.target.files?.[0])} />
        </label>
        <label className="field">
          <span>提示词包正文</span>
          <textarea rows={10} value={studio.promptPackText} onChange={(event) => updateStudio("promptPackText", event.target.value)} placeholder="粘贴 SOP / 提示词包文本" />
        </label>
        <label className="field">
          <span>产品图片</span>
          <input type="file" accept="image/*" multiple onChange={(event) => handleImages(event.target.files)} />
        </label>
        <div className="image-grid">
          {studio.images.map((image) => (
            <div className="image-thumb" key={`${image.name}-${image.size}`}>
              <img src={image.dataUrl} alt="" />
              <span title={image.name}>{image.name}</span>
            </div>
          ))}
        </div>
        <div className="two-col">
          <label className="field">
            <span>商品名称 / 任务名称</span>
            <input value={studio.productName} onChange={(event) => updateStudio("productName", event.target.value)} placeholder="可选" />
          </label>
          <label className="field">
            <span>类别</span>
            <input value={studio.productCategory} onChange={(event) => updateStudio("productCategory", event.target.value)} placeholder="不填则根据图片识别" />
          </label>
        </div>
        <label className="field">
          <span>商品补充信息</span>
          <textarea rows={4} value={studio.productBrief} onChange={(event) => updateStudio("productBrief", event.target.value)} placeholder="品类、卖点、人群、禁忌项" />
        </label>
        <div className="three-col">
          <label className="field">
            <span>视频时长</span>
            <input type="number" min="3" max="60" value={studio.targetDuration} onChange={(event) => updateStudio("targetDuration", event.target.value)} />
          </label>
          <label className="field">
            <span>画幅</span>
            <select value={studio.aspectRatio} onChange={(event) => updateStudio("aspectRatio", event.target.value)}>
              <option value="9:16">9:16 竖屏</option>
              <option value="16:9">16:9 横屏</option>
              <option value="1:1">1:1 方形</option>
            </select>
          </label>
          <label className="field">
            <span>libTV 模式</span>
            <select value={studio.videoMode} onChange={(event) => updateStudio("videoMode", event.target.value)}>
              <option value="dry_run">先验证</option>
              <option value="submit">真实提交</option>
              <option value="run">提交并等待结果</option>
            </select>
          </label>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={studio.autoSubmit} onChange={(event) => updateStudio("autoSubmit", event.target.checked)} />
          <span>最终提示词生成后自动提交 libTV</span>
        </label>
        <button
          className={promptRunning ? "danger-button" : "primary-button"}
          type={promptRunning ? "button" : "submit"}
          onClick={promptRunning ? cancelPromptRun : undefined}
        >
          {promptRunning ? <X size={17} /> : <Play size={17} />}
          <span>{promptRunning ? "中断生成" : "生成最终完整提示词"}</span>
        </button>
      </form>

      <section className="panel output-panel">
        <div className="panel-head">
          <h2>过程进度</h2>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setTraceOpen(true)}>
              <Brain size={16} />
              <span>模型过程</span>
            </button>
            <span className="run-id">{runId ? runId.slice(0, 8) : ""}</span>
          </div>
        </div>
        <ProgressBar value={promptProgress} />
        <StepList steps={promptSteps} emptyText="等待开始任务" />

        <div className="result-block">
          <div className="panel-head">
            <h2>最终完整提示词</h2>
            <div className="button-row">
              <button type="button" className="secondary-button" onClick={copyFinalPrompt} disabled={!studio.finalPrompt}>
                <Copy size={16} />
                <span>复制</span>
              </button>
              <button type="button" className="secondary-button" onClick={submitVideo} disabled={!studio.finalPrompt || videoRunning}>
                <Database size={16} />
                <span>写库并提交 libTV</span>
              </button>
            </div>
          </div>
          <textarea className="final-prompt" rows={9} value={studio.finalPrompt} onChange={(event) => updateStudio("finalPrompt", event.target.value)} placeholder="可以手动粘贴最终提示词，也可以等待分析流程自动填入" />
          {studio.promptPackage ? <pre className="json-box">{JSON.stringify(studio.promptPackage, null, 2)}</pre> : null}
        </div>

        <div className="result-block">
          <div className="panel-head">
            <h2>libTV 进度</h2>
            <span className="run-id">{videoRunning ? "处理中" : ""}</span>
          </div>
          <ProgressBar value={videoProgress} />
          <StepList steps={videoSteps} emptyText="等待提交 libTV" />
          {videoUrl ? <a className="video-link" href={videoUrl} target="_blank" rel="noreferrer">打开生成视频</a> : null}
          {videoLog ? <pre className="log-box">{videoLog}</pre> : null}
        </div>
        <ModelTraceDrawer
          open={traceOpen}
          onClose={() => setTraceOpen(false)}
          runId={runId}
          steps={promptSteps}
          trace={modelTrace}
          studio={studio}
          runtime={runtime}
          modelSettings={modelSettings}
        />
      </section>
    </section>
  );
}

function ModelTraceDrawer({ open, onClose, runId, steps, trace, studio, runtime, modelSettings }) {
  if (!open) return null;
  const analysisModel = resolveModelChoice(modelSettings, "analysis") || runtime?.currentModels?.analysis || "后端默认";
  const visionModel = resolveModelChoice(modelSettings, "vision") || runtime?.currentModels?.vision || "后端默认";
  const records = trace.length
    ? trace
    : steps.map((step) => ({
        at: step.at,
        type: step.status,
        phase: step.name,
        message: step.message,
        output: step.output
      }));
  const inputSummary = [
    `提示词包字数：${studio.promptPackText?.length || 0}`,
    `产品图片：${studio.images?.length || 0} 张${studio.images?.length ? `（${studio.images.map((image) => image.name).join("，")}）` : ""}`,
    `商品名称：${studio.productName || "未填写"}`,
    `类别：${studio.productCategory || studio.suggestedCategory || "未识别"}`,
    `视频规格：${studio.targetDuration || 15} 秒，${studio.aspectRatio || "9:16"}`,
    `分析模型：${analysisModel}`,
    `视觉模型：${visionModel}`
  ].join("\n");
  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true" aria-label="模型分析过程">
      <aside className="trace-drawer">
        <div className="panel-head">
          <div>
            <h2>模型分析过程</h2>
            <p className="trace-subtitle">状态、输入摘要、模型输出和最终封装记录</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="trace-note">
          这里展示可审计的分析过程，不展示模型内部隐藏推理。
        </div>
        <div className="trace-summary">
          <div>
            <span>Run ID</span>
            <strong>{runId || "-"}</strong>
          </div>
          <div>
            <span>记录数</span>
            <strong>{records.length}</strong>
          </div>
          <div>
            <span>当前状态</span>
            <strong>{steps.at(-1)?.status || "-"}</strong>
          </div>
        </div>
        <h3 className="subhead">输入与模型</h3>
        <pre className="trace-box">{inputSummary}</pre>
        <h3 className="subhead">过程记录</h3>
        {records.length ? (
          <ol className="trace-list">
            {records.map((item, index) => (
              <li className="trace-item" key={`${item.phase}-${item.at}-${index}`}>
                <div className="trace-item-head">
                  <strong>{item.phase || item.type || `记录 ${index + 1}`}</strong>
                  <time>{formatStepTime(item.at)}</time>
                </div>
                <div className="trace-item-message">{item.message || item.type}</div>
                {item.output ? <pre>{truncate(item.output, 5000)}</pre> : null}
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">还没有模型过程记录</div>
        )}
      </aside>
    </div>
  );
}

function TasksPage({ rows, onRefresh, onOpenAssets }) {
  return (
    <section className="panel">
      <TableHead title="任务看板" onRefresh={onRefresh} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>任务编号</th>
              <th>最终视频名称</th>
              <th>类别</th>
              <th>商品名称</th>
              <th>任务状态</th>
              <th>libTV 状态</th>
              <th>更新时间</th>
              <th>素材</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row["任务编号"]}>
                <td>{row["任务编号"]}</td>
                <td>{row["最终视频名称"]}</td>
                <td>{row["类别"]}</td>
                <td>{row["商品名称"]}</td>
                <td><StatusBadge value={row["任务状态"]} /></td>
                <td><StatusBadge value={row["libTV状态"]} /></td>
                <td>{formatDate(row["更新时间"])}</td>
                <td><button className="icon-button" onClick={() => onOpenAssets(row["任务编号"])} title="查看素材"><FolderOpen size={16} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LibtvPage({ rows, onRefresh }) {
  return (
    <section className="panel">
      <TableHead title="libTV 任务" onRefresh={onRefresh} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>任务编号</th>
              <th>最终视频名称</th>
              <th>状态</th>
              <th>外部任务 ID</th>
              <th>视频链接</th>
              <th>完成时间</th>
              <th>错误信息</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row["任务编号"]}-${row["外部任务ID"]}`}>
                <td>{row["任务编号"]}</td>
                <td>{row["最终视频名称"]}</td>
                <td><StatusBadge value={row["libTV状态"]} /></td>
                <td>{row["外部任务ID"] || "-"}</td>
                <td>{row["视频链接"] ? <a href={row["视频链接"]} target="_blank" rel="noreferrer">打开</a> : "-"}</td>
                <td>{formatDate(row["完成时间"])}</td>
                <td>{row["错误信息"] || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AssetsPage({ tasks, taskCode, setTaskCode, data, onRefresh }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>素材与输出</h2>
        <div className="button-row">
          <select value={taskCode} onChange={(event) => setTaskCode(event.target.value)}>
            <option value="">全部任务</option>
            {tasks.map((task) => <option value={task["任务编号"]} key={task["任务编号"]}>{task["任务编号"]}</option>)}
          </select>
          <button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} /><span>刷新</span></button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>任务编号</th>
              <th>类型</th>
              <th>格式</th>
              <th>大小</th>
              <th>本地路径</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, index) => (
              <tr key={`${row.file_path}-${index}`}>
                <td>{row.task_code || "-"}</td>
                <td>{row.asset_type}</td>
                <td>{row.format || "-"}</td>
                <td>{formatBytes(row.size_bytes)}</td>
                <td className="path-cell">{row.file_path || row.file_url || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="subhead">本地视频输出</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>文件名</th>
              <th>大小</th>
              <th>更新时间</th>
              <th>路径</th>
            </tr>
          </thead>
          <tbody>
            {data.outputFiles.map((file) => (
              <tr key={file.path}>
                <td>{file.name}</td>
                <td>{formatBytes(file.size)}</td>
                <td>{formatDate(file.updatedAt)}</td>
                <td className="path-cell">{file.path}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SettingsPage({ runtime, onRefresh, modelSettings, updateModelSettings }) {
  const activeAnalysisModel = resolveModelChoice(modelSettings, "analysis") || runtime?.currentModels?.analysis || "-";
  const activeVisionModel = resolveModelChoice(modelSettings, "vision") || runtime?.currentModels?.vision || "-";
  const rows = [
    ["后端 API", runtime?.error ? "未连接" : "已连接"],
    ["千问文本", runtime?.qianwenTextConfigured ? "已配置" : "未配置"],
    ["千问视觉", runtime?.qianwenVisionConfigured ? "已配置" : "未配置"],
    ["豆包分析", runtime?.doubaoConfigured ? "已配置" : "未配置"],
    ["libTV 桥接", runtime?.libtvBridgeReachable ? "已连接" : "未连接"],
    ["当前分析模型", activeAnalysisModel],
    ["当前视觉模型", activeVisionModel],
    ["数据库", runtime?.libtvDatabase || "-"],
    ["运行模式", runtime?.modeHint || "-"]
  ];
  return (
    <section className="panel settings-panel">
      <TableHead title="系统设置" onRefresh={onRefresh} />
      <ModelSettingsPanel
        runtime={runtime}
        modelSettings={modelSettings}
        updateModelSettings={updateModelSettings}
      />
      <div className="settings-grid">
        {rows.map(([name, value]) => (
          <div className="setting-item" key={name}>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <pre className="json-box">{JSON.stringify(runtime || {}, null, 2)}</pre>
    </section>
  );
}

function ModelSettingsPanel({ runtime, modelSettings, updateModelSettings }) {
  const analysisOptions = runtime?.modelOptions?.analysis || [];
  const visionOptions = runtime?.modelOptions?.vision || [];
  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <div>
          <h3>模型切换</h3>
          <p>选择后会用于下一次提示词分析和图片识别。</p>
        </div>
        <Activity size={18} />
      </div>
      <div className="model-settings-grid">
        <label className="field">
          <span>提示词分析模型</span>
          <select value={modelSettings.analysisModel} onChange={(event) => updateModelSettings("analysisModel", event.target.value)}>
            <option value="">后端默认：{runtime?.currentModels?.analysis || "-"}</option>
            {analysisOptions.map((model) => (
              <option value={model} key={model}>{model}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>自定义分析模型 ID</span>
          <input value={modelSettings.analysisCustomModel} onChange={(event) => updateModelSettings("analysisCustomModel", event.target.value)} placeholder="填写后优先使用" />
        </label>
        <label className="field">
          <span>图片识别模型</span>
          <select value={modelSettings.visionModel} onChange={(event) => updateModelSettings("visionModel", event.target.value)}>
            <option value="">后端默认：{runtime?.currentModels?.vision || "-"}</option>
            {visionOptions.map((model) => (
              <option value={model} key={model}>{model}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>自定义视觉模型 ID</span>
          <input value={modelSettings.visionCustomModel} onChange={(event) => updateModelSettings("visionCustomModel", event.target.value)} placeholder="填写后优先使用" />
        </label>
      </div>
      <p className="settings-hint">模型选择保存在当前浏览器。视频生成和文生图模型暂时不开放选择，当前链路仍由 libTV 默认配置处理视频生成。</p>
    </div>
  );
}

function TableHead({ title, onRefresh }) {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      <button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} /><span>刷新</span></button>
    </div>
  );
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
              <div className="step-title">{step.name}</div>
              <time className="step-time">{formatStepTime(step.at)}</time>
            </div>
            <div className="step-message">{step.message}</div>
            {step.output ? <pre className="step-output">{truncate(step.output, 1600)}</pre> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ProgressBar({ value }) {
  return (
    <div className="progress-track">
      <div className="progress-bar" style={{ width: `${value}%` }} />
    </div>
  );
}

function StatusBadge({ value }) {
  const text = value || "-";
  const kind = /succeeded|ready|pass|完成|成功|video_ready/i.test(text)
    ? "good"
    : /failed|error|失败/i.test(text)
      ? "bad"
      : /running|generating|处理中|提交/i.test(text)
        ? "warn"
        : "muted";
  return <span className={`status-badge ${kind}`}>{text}</span>;
}

function progressPercent(steps) {
  if (!steps.length) return 0;
  const done = steps.filter((step) => step.status === "done").length;
  const running = steps.filter((step) => step.status === "running").length;
  const cancelled = steps.filter((step) => step.status === "cancelled").length;
  return Math.min(100, Math.round(((done + running * 0.45 + cancelled * 0.2) / steps.length) * 100));
}

function truncate(value, max) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function safeJsonFromLog(log) {
  const start = log.lastIndexOf("{");
  if (start < 0) return {};
  try {
    return JSON.parse(log.slice(start));
  } catch {
    return {};
  }
}

function formatStepTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":",
    pad(date.getSeconds())
  ].join("");
}
