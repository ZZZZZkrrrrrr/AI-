import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  ChevronRight,
  Clipboard,
  Copy,
  Database,
  Download,
  FileText,
  FolderOpen,
  Gauge,
  HardDrive,
  Image,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Menu,
  Moon,
  Play,
  RefreshCw,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  Server,
  Sun,
  Timer,
  Upload,
  Video,
  Workflow,
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
  { id: "overview", label: "生产总览", icon: LayoutDashboard },
  { id: "studio", label: "提示词工作台", icon: FileText, children: [
    { id: "stitch", label: "视频拼接", icon: Scissors }
  ] },
  { id: "tasks", label: "任务看板", icon: Clipboard },
  { id: "libtv", label: "libTV 任务", icon: Video },
  { id: "assets", label: "素材与输出", icon: FolderOpen },
  { id: "settings", label: "系统设置", icon: Settings }
];

navItems[1].id = "promptWorkbench";
navItems[1].children = [
  { id: "studio", label: "单条视频", icon: Play },
  { id: "batch", label: "批量生成", icon: ListChecks },
  ...(navItems[1].children || [])
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
const notificationStorageKey = "aiugc-console-notifications";
const batchTemplateHeaders = [
  "任务编号",
  "提示词包文件名",
  "商品图片文件名",
  "商品名称",
  "类别",
  "商品补充信息",
  "视频时长",
  "画幅",
  "libTV模式",
  "是否自动提交libTV"
];
const batchTemplateRows = [
  ["男装-001", "男装-001.docx", "男装-001.png", "通勤男装短袖", "男装", "主推通勤穿搭，突出面料、版型、上身效果", 15, "9:16", "先验证", "是"],
  ["女装-001", "女装-001.docx", "女装-001.jpg", "夏季连衣裙", "女装", "突出清爽、显瘦、日常出街场景", 15, "9:16", "先验证", "是"]
];
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

function findNavItem(pageId) {
  for (const item of navItems) {
    if (item.id === pageId) return item;
    const child = item.children?.find((entry) => entry.id === pageId);
    if (child) return child;
  }
  return null;
}

function navItemIsActive(item, pageId) {
  return item.id === pageId || Boolean(item.children?.some((child) => child.id === pageId));
}

function parentNavIdForPage(pageId) {
  return navItems.find((item) => item.children?.some((child) => child.id === pageId))?.id || "";
}

function isToday(value) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function taskStatusText(row) {
  return String(row?.["任务状态"] || row?.status || "").toLowerCase();
}

function jobStatusText(row) {
  return String(row?.["libTV状态"] || row?.status || "").toLowerCase();
}

function isGoodStatus(value) {
  return /succeed|ready|pass|完成|成功|video_ready/i.test(String(value || ""));
}

function isBadStatus(value) {
  return /fail|error|失败|异常|超时/i.test(String(value || ""));
}

function formatPercent(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function sumFileSize(files = []) {
  return files.reduce((total, file) => total + Number(file.size || file.size_bytes || 0), 0);
}

function readNotifications() {
  try {
    const saved = JSON.parse(localStorage.getItem(notificationStorageKey) || "[]");
    return Array.isArray(saved) ? saved.slice(0, 80) : [];
  } catch {
    return [];
  }
}

export function App() {
  const [page, setPage] = useState(() => location.hash.replace("#/", "") || "overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const current = location.hash.replace("#/", "") || "overview";
    const parentId = parentNavIdForPage(current);
    return parentId ? { [parentId]: true } : {};
  });
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
  const [batchJobs, setBatchJobs] = useState([]);
  const [batchDetail, setBatchDetail] = useState(null);
  const [assets, setAssets] = useState({ rows: [], outputFiles: [] });
  const [assetTaskCode, setAssetTaskCode] = useState("");
  const [modelSettings, setModelSettings] = useState(readModelSettings);
  const [modelTrace, setModelTrace] = useState([]);
  const [notifications, setNotifications] = useState(readNotifications);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    const onHash = () => {
      const nextPage = location.hash.replace("#/", "") || "overview";
      setPage(nextPage);
      const parentId = parentNavIdForPage(nextPage);
      if (parentId) setExpandedGroups((current) => ({ ...current, [parentId]: true }));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    refreshRuntime();
    loadTasks();
    loadJobs();
    loadBatchJobs();
    loadAssets("");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("aiugc-console-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(modelSettingsKey, JSON.stringify(modelSettings));
  }, [modelSettings]);

  useEffect(() => {
    localStorage.setItem(notificationStorageKey, JSON.stringify(notifications));
  }, [notifications]);

  function navigate(nextPage) {
    location.hash = `/${nextPage}`;
    setPage(nextPage);
    const parentId = parentNavIdForPage(nextPage);
    if (parentId) setExpandedGroups((current) => ({ ...current, [parentId]: true }));
  }

  function toggleNavGroup(itemId) {
    setExpandedGroups((current) => ({ ...current, [itemId]: !current[itemId] }));
  }

  function addNotification({ level = "info", title, message = "", target = "" }) {
    const at = new Date().toISOString();
    setNotifications((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        level,
        title,
        message,
        target,
        at,
        read: false
      },
      ...current
    ].slice(0, 80));
  }

  function markNotificationsRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }

  function clearNotifications() {
    setNotifications([]);
  }

  function openNotificationTarget(target) {
    if (target) navigate(target);
    setNotificationOpen(false);
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

  async function loadBatchJobs() {
    const data = await requestJson("/api/batches?limit=80");
    setBatchJobs(data.rows || []);
    return data.rows || [];
  }

  async function loadBatchDetail(batchId) {
    if (!batchId) return null;
    const data = await requestJson(`/api/batches/${encodeURIComponent(batchId)}`);
    const detail = { job: data.job, items: data.items || [], events: data.events || [] };
    setBatchDetail(detail);
    return detail;
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
          output,
          tokenUsage: event.tokenUsage || null
        }
      ].slice(-120)
    );
  }

  function upsertPromptStep(name, status, message, output = "", at = "", tokenUsage = null) {
    const key = String(name || "处理中").trim() || "处理中";
    setPromptSteps((current) => {
      const index = current.findIndex((item) => item.key === key);
      const next = {
        key,
        name: key,
        status,
        message: message || "",
        output: output || "",
        at: at || new Date().toISOString(),
        tokenUsage: tokenUsage || null
      };
      if (index < 0) return [...current, next];
      const copy = [...current];
      copy[index] = {
        ...copy[index],
        status,
        message: message || copy[index].message,
        output: output || copy[index].output,
        at: at || new Date().toISOString(),
        tokenUsage: tokenUsage || copy[index].tokenUsage || null
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
    updateStudio("promptPackage", { name: file.name, size: file.size, type: file.type || "text/plain" });
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
    addNotification({
      level: "info",
      title: "提示词生成已开始",
      message: "正在分析提示词包和产品图片。",
      target: "studio"
    });
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
      addNotification({
        level: "error",
        title: "提示词任务创建失败",
        message: error.message,
        target: "studio"
      });
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
      upsertPromptStep(event.phase, "running", event.message, "", event.at, event.tokenUsage);
    }
    if (event.type === "model_meta") {
      upsertPromptStep("模型配置", "done", event.message, event.output, event.at);
    }
    if (event.type === "token_usage") {
      upsertPromptStep(event.phase || "模型调用", "done", event.message, "", event.at, event.tokenUsage);
    }
    if (event.type === "image_analysis") {
      setStudio((current) => ({ ...current, imageAnalysis: event.output || "" }));
      upsertPromptStep("图片识别", "done", event.message, event.output, event.at, event.tokenUsage);
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
      upsertPromptStep(event.stepName || `步骤 ${event.stepNo}`, "done", event.message, event.output, event.at, event.tokenUsage);
    }
    if (event.type === "completed") {
      const result = event.result || {};
      upsertPromptStep("最终封装", "done", event.message, "", event.at);
      addNotification({
        level: "success",
        title: "最终提示词已生成",
        message: result.suggestedCategory ? `识别类别：${result.suggestedCategory}` : "可以复制或提交到 libTV。",
        target: "studio"
      });
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
      addNotification({
        level: "error",
        title: "提示词生成失败",
        message: event.message || "模型调用或流程执行失败。",
        target: "studio"
      });
    }
    if (event.type === "cancelled") {
      upsertPromptStep(event.phase || "已中断", "cancelled", event.message || "用户已中断生成。", "", event.at);
      setPromptRunning(false);
      addNotification({
        level: "warn",
        title: "提示词生成已中断",
        message: event.message || "用户在网页端中断了生成流程。",
        target: "studio"
      });
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
      addNotification({
        level: "info",
        title: source.videoMode === "dry_run" ? "libTV 验证已开始" : "libTV 视频任务已提交",
        message: source.videoMode === "dry_run" ? "当前为先验证模式，不会真实生成视频。" : "正在提交并等待 libTV 返回结果。",
        target: "libtv"
      });
      const { runId: nextRunId } = await requestJson("/api/video-runs", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      connectVideoEvents(nextRunId);
    } catch (error) {
      setVideoRunning(false);
      upsertVideoStep("提交失败", "failed", error.message, "", new Date().toISOString());
      appendVideoLog(error.message);
      addNotification({
        level: "error",
        title: "libTV 提交失败",
        message: error.message,
        target: "studio"
      });
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
      addNotification({
        level: "success",
        title: "libTV 视频任务完成",
        message: event.message || "视频结果已返回，可到 libTV 任务或视频拼接查看。",
        target: "libtv"
      });
    }
    if (event.type === "failed") {
      upsertVideoStep(event.phase || "libTV 失败", "failed", event.message, "", event.at);
      appendVideoLog(`[${event.phase || "失败"}] ${event.message}`);
      addNotification({
        level: "error",
        title: "libTV 视频任务失败",
        message: event.message || "请查看 libTV 任务详情。",
        target: "libtv"
      });
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
    if (page === "overview") {
      return (
        <OverviewPage
          runtime={runtime}
          tasks={tasks}
          jobs={jobs}
          assets={assets}
          navigate={navigate}
          onRefresh={() => {
            refreshRuntime();
            loadTasks();
            loadJobs();
            loadAssets(assetTaskCode);
          }}
        />
      );
    }
    if (page === "batch") {
      return (
        <BatchPage
          runtime={runtime}
          modelSettings={modelSettings}
          batchJobs={batchJobs}
          batchDetail={batchDetail}
          loadBatchJobs={loadBatchJobs}
          loadBatchDetail={loadBatchDetail}
          addNotification={addNotification}
          onRefreshAll={() => {
            loadBatchJobs();
            loadTasks();
            loadJobs();
            loadAssets(assetTaskCode);
          }}
        />
      );
    }
    if (page === "stitch") {
      return <VideoStitchPage jobs={jobs} assets={assets} addNotification={addNotification} onRefresh={() => {
        loadJobs();
        loadAssets(assetTaskCode);
      }} />;
    }
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
  }, [page, tasks, jobs, batchJobs, batchDetail, assets, assetTaskCode, runtime, studio, promptSteps, promptRunning, runId, videoRunning, videoSteps, videoLog, modelSettings, modelTrace]);

  return (
    <div className={sidebarCollapsed ? "console-shell sidebar-collapsed" : "console-shell"}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div className="brand-copy">
            <div className="brand-title">AI短视频</div>
              <div className="brand-subtitle">工作流控制台</div>
          </div>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = navItemIsActive(item, page);
            const expanded = Boolean(item.children?.length && expandedGroups[item.id]);
            return (
              <div className={item.children ? "nav-group" : ""} key={item.id}>
                <button
                  className={active ? "nav-item active" : "nav-item"}
                  onClick={() => item.children?.length ? toggleNavGroup(item.id) : navigate(item.id)}
                  aria-expanded={item.children?.length ? expanded : undefined}
                >
                  <Icon size={18} />
                  <span className="nav-label">{item.label}</span>
                  {item.children?.length ? <ChevronRight className={expanded ? "nav-chevron expanded" : "nav-chevron"} size={15} /> : null}
                </button>
                {item.children?.length && expanded ? (
                  <div className="subnav-list">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <button
                          key={child.id}
                          className={page === child.id ? "subnav-item active" : "subnav-item"}
                          onClick={() => navigate(child.id)}
                        >
                          <ChildIcon size={14} />
                          <span className="nav-label">{child.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label="收起或展开侧边栏"
            >
              <Menu size={18} />
            </button>
            <div>
              <h1>{findNavItem(page)?.label || "提示词工作台"}</h1>
              <p>提示词包 + 产品图片 → 最终提示词 → 数据库任务 → libTV 视频生成</p>
            </div>
          </div>
          <div className="top-actions">
            <RuntimeStatus runtime={runtime} onRefresh={refreshRuntime} />
            <NotificationCenter
              open={notificationOpen}
              notifications={notifications}
              unreadCount={unreadCount}
              onToggle={() => setNotificationOpen((current) => !current)}
              onClose={() => setNotificationOpen(false)}
              onMarkAllRead={markNotificationsRead}
              onClear={clearNotifications}
              onOpenTarget={openNotificationTarget}
            />
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

function NotificationCenter({ open, notifications, unreadCount, onToggle, onClose, onMarkAllRead, onClear, onOpenTarget }) {
  return (
    <div className="notification-wrap">
      <button
        className={unreadCount ? "icon-button top-icon notification-button has-unread" : "icon-button top-icon notification-button"}
        type="button"
        title="任务提醒"
        onClick={onToggle}
        aria-expanded={open}
      >
        <Bell size={16} />
        {unreadCount ? <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="notification-panel" role="dialog" aria-label="任务提醒">
          <div className="notification-head">
            <div>
              <strong>任务提醒</strong>
              <span>{unreadCount ? `${unreadCount} 条未读` : "暂无未读"}</span>
            </div>
            <button className="icon-button notification-close" type="button" onClick={onClose} title="关闭">
              <X size={15} />
            </button>
          </div>
          <div className="notification-actions">
            <button type="button" className="ghost-button" onClick={onMarkAllRead} disabled={!notifications.length}>全部已读</button>
            <button type="button" className="ghost-button" onClick={onClear} disabled={!notifications.length}>清空</button>
          </div>
          <div className="notification-list">
            {notifications.length ? notifications.map((item) => (
              <button
                type="button"
                className={item.read ? `notification-item ${item.level}` : `notification-item ${item.level} unread`}
                key={item.id}
                onClick={() => onOpenTarget(item.target)}
              >
                <span className="notification-level" />
                <span className="notification-copy">
                  <strong>{item.title}</strong>
                  {item.message ? <span>{item.message}</span> : null}
                  <time>{formatDate(item.at)}</time>
                </span>
              </button>
            )) : (
              <div className="notification-empty">暂无任务提醒</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BatchPage({ runtime, modelSettings, batchJobs, batchDetail, loadBatchJobs, loadBatchDetail, addNotification, onRefreshAll }) {
  const [batchName, setBatchName] = useState(() => `批量生成 ${new Date().toLocaleString("zh-CN", { hour12: false })}`);
  const [promptFiles, setPromptFiles] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [matchMode, setMatchMode] = useState("filename");
  const [concurrency, setConcurrency] = useState(2);
  const [defaultVideoMode, setDefaultVideoMode] = useState("dry_run");
  const [defaultDuration, setDefaultDuration] = useState(15);
  const [defaultAspectRatio, setDefaultAspectRatio] = useState("9:16");
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [creating, setCreating] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const activeDetail = batchDetail?.job?.id === selectedBatchId ? batchDetail : null;
  const validatedRows = useMemo(() => validateBatchDraftRows(rows), [rows]);
  const precheck = useMemo(() => summarizeBatchPrecheck(validatedRows), [validatedRows]);
  const [onlyInvalidRows, setOnlyInvalidRows] = useState(false);
  const visibleRows = onlyInvalidRows ? validatedRows.filter((row) => !row.validation.ok) : validatedRows;
  const selectedRows = validatedRows.filter((row) => row.enabled !== false && row.validation.ok);
  const totals = summarizeBatchItems(activeDetail?.items || []);

  useEffect(() => {
    if (!selectedBatchId && batchJobs.length) setSelectedBatchId(batchJobs[0].id);
  }, [batchJobs, selectedBatchId]);

  useEffect(() => {
    if (!selectedBatchId) return undefined;
    loadBatchDetail(selectedBatchId).catch(() => {});
    const timer = setInterval(() => {
      loadBatchDetail(selectedBatchId).catch(() => {});
      loadBatchJobs().catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  }, [selectedBatchId]);

  async function handlePromptFiles(files) {
    const selected = Array.from(files || []);
    const parsed = [];
    for (const file of selected) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".doc")) {
        alert("当前批量入口支持 .docx、.txt、.md，请先把 .doc 另存为 .docx。");
        continue;
      }
      const text = lower.endsWith(".docx") ? await extractDocxFile(file) : await file.text();
      parsed.push({ id: `${file.name}-${file.size}-${file.lastModified}`, name: file.name, text });
    }
    setPromptFiles(parsed);
  }

  async function handleImageFiles(files) {
    const selected = Array.from(files || []);
    const parsed = await Promise.all(selected.map(readImageFile));
    setImageFiles(parsed.map((image, index) => ({ ...image, id: `${image.name}-${image.size}-${index}` })));
  }

  async function handleCsv(file) {
    if (!file) return;
    const lower = file.name.toLowerCase();
    const parsed = lower.endsWith(".xlsx") || lower.endsWith(".xls")
      ? await parseWorkbookRows(await file.arrayBuffer())
      : parseCsvRows(await file.text());
    setCsvRows(parsed);
    addNotification?.({
      level: "info",
      title: "批量表格已导入",
      message: `读取到 ${parsed.length} 行任务配置。`,
      target: "batch"
    });
  }

  async function downloadBatchTemplate() {
    const XLSX = await import("xlsx");
    const workbook = XLSX.utils.book_new();
    const taskSheet = XLSX.utils.aoa_to_sheet([batchTemplateHeaders, ...batchTemplateRows]);
    taskSheet["!cols"] = [
      { wch: 14 },
      { wch: 24 },
      { wch: 24 },
      { wch: 18 },
      { wch: 12 },
      { wch: 42 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(workbook, taskSheet, "批量任务模板");
    const ruleSheet = XLSX.utils.aoa_to_sheet([
      ["字段", "是否必填", "填写规则"],
      ["任务编号", "建议填写", "同一批次内不要重复，例如 男装-001"],
      ["提示词包文件名", "必填", "必须和上传的提示词包文件名一致，建议带后缀 .docx"],
      ["商品图片文件名", "必填", "必须和上传的商品图片文件名一致，建议带后缀 .png/.jpg"],
      ["商品名称", "可选", "不填时会按图片或文件名推断"],
      ["类别", "可选", "不填时会按图片识别"],
      ["商品补充信息", "可选", "填写卖点、人群、禁忌项、风格限制等"],
      ["视频时长", "可选", "建议 3-60 秒，默认 15"],
      ["画幅", "可选", "只支持 9:16、16:9、1:1"],
      ["libTV模式", "可选", "可填：先验证、真实提交、提交并等待"],
      ["是否自动提交libTV", "可选", "可填：是/否，默认跟页面开关一致"]
    ]);
    ruleSheet["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 56 }];
    XLSX.utils.book_append_sheet(workbook, ruleSheet, "字段说明");
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "AI视频批量生成模板.xlsx";
    link.click();
    URL.revokeObjectURL(url);
  }

  function buildRows() {
    const built = buildBatchRows({
      promptFiles,
      imageFiles,
      csvRows,
      matchMode,
      defaultDuration,
      defaultAspectRatio,
      defaultVideoMode,
      autoSubmit
    });
    const checked = validateBatchDraftRows(built);
    const summary = summarizeBatchPrecheck(checked);
    setRows(built);
    setOnlyInvalidRows(false);
    addNotification?.({
      level: summary.error ? "warn" : "success",
      title: "批量预检完成",
      message: `共 ${summary.total} 条，通过 ${summary.ok} 条，异常 ${summary.error} 条，提醒 ${summary.warn} 条。`,
      target: "batch"
    });
  }

  function updateRow(id, field, value) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));
  }

  function toggleAllRows(checked) {
    setRows((current) => validateBatchDraftRows(current).map((row) => stripBatchValidation({ ...row, enabled: checked ? row.validation.ok : false })));
  }

  async function createBatch(autoStart = true) {
    const enabledRows = validatedRows.filter((row) => row.enabled !== false);
    const invalidEnabled = enabledRows.filter((row) => !row.validation.ok);
    if (!selectedRows.length) {
      alert(invalidEnabled.length ? "已勾选的任务没有通过预检，请先处理异常行。" : "请先生成并勾选通过预检的批量任务行。");
      return;
    }
    setCreating(true);
    try {
      const data = await requestJson("/api/batches", {
        method: "POST",
        body: JSON.stringify({
          name: batchName,
          concurrency,
          autoStart,
          source: "console-batch",
          items: selectedRows.map((row) => ({
            taskNo: row.taskNo,
            promptFileName: row.prompt?.name || row.promptFileName,
            promptPackText: row.prompt?.text || "",
            images: row.image ? [row.image] : [],
            productName: row.productName,
            productCategory: row.productCategory,
            productBrief: row.productBrief,
            targetDuration: Number(row.targetDuration || defaultDuration),
            aspectRatio: row.aspectRatio || defaultAspectRatio,
            videoMode: row.videoMode || defaultVideoMode,
            autoSubmit: row.autoSubmit,
            modelSettings: buildModelSettingsPayload(modelSettings),
            maxRetries: 1
          }))
        })
      });
      setSelectedBatchId(data.job?.id || "");
      await loadBatchJobs();
      if (data.job?.id) await loadBatchDetail(data.job.id);
      addNotification?.({
        level: "success",
        title: autoStart ? "批量任务已启动" : "批量任务已创建",
        message: `已创建 ${selectedRows.length} 条通过预检的视频任务${invalidEnabled.length ? `，已跳过 ${invalidEnabled.length} 条异常任务` : ""}，并发数 ${concurrency}。`,
        target: "batch"
      });
      onRefreshAll?.();
    } catch (error) {
      addNotification?.({ level: "error", title: "批量任务创建失败", message: error.message, target: "batch" });
      alert(error.message);
    } finally {
      setCreating(false);
    }
  }

  async function batchAction(action) {
    if (!selectedBatchId) return;
    const data = await requestJson(`/api/batches/${encodeURIComponent(selectedBatchId)}/${action}`, { method: "POST", body: "{}" });
    await loadBatchJobs();
    await loadBatchDetail(data.job?.id || selectedBatchId);
    addNotification?.({
      level: action === "cancel" ? "warn" : "info",
      title: batchActionTitle(action),
      message: data.job?.name || "",
      target: "batch"
    });
  }

  function exportResultCsv() {
    if (!activeDetail?.items?.length) return;
    const headers = ["row_no", "status", "task_no", "prompt_file_name", "image_file_name", "product_name", "category", "current_step", "tokens", "libtv_task_code", "video_url", "error_message", "started_at", "finished_at"];
    const lines = [
      headers.join(","),
      ...activeDetail.items.map((item) =>
        headers.map((key) => csvEscape(resultValueForExport(item, key))).join(",")
      )
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeDetail.job.name || "batch-result"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="batch-page">
      <div className="panel batch-hero">
        <div>
          <h2>批量生成中心</h2>
          <p>多个提示词包和多张商品图在这里拆成任务队列，后端按并发数自动执行，适合每天 300-1000 条的视频批量生产。</p>
        </div>
        <div className="batch-hero-side">
          <button className="batch-guide-button" type="button" onClick={() => setGuideOpen(true)}>
            <BookOpen size={18} />
            <span>使用说明</span>
            <small>上传前先看规则</small>
          </button>
          <div className="batch-hero-actions">
            <button className="secondary-button" type="button" onClick={() => loadBatchJobs()}>
              <RefreshCw size={16} />
              <span>刷新批次</span>
            </button>
            <button className="primary-button" type="button" onClick={() => createBatch(true)} disabled={creating || !selectedRows.length}>
              <Play size={16} />
              <span>{creating ? "创建中" : "创建并启动"}</span>
            </button>
          </div>
        </div>
      </div>

      {guideOpen ? (
        <div className="guide-backdrop" role="dialog" aria-modal="true" aria-label="批量生成使用说明" onClick={() => setGuideOpen(false)}>
          <div className="guide-modal" onClick={(event) => event.stopPropagation()}>
            <div className="guide-head">
              <div>
                <span>上传规则</span>
                <h2>文件上传说明</h2>
                <p>这里只说明三个上传口应该放什么文件、怎么命名、表格字段怎么写。</p>
              </div>
              <button className="icon-button" type="button" onClick={() => setGuideOpen(false)} title="关闭">
                <X size={18} />
              </button>
            </div>

            <div className="guide-steps">
              <article>
                <strong>01</strong>
                <h3>提示词包</h3>
                <p>支持 .docx、.txt、.md，可一次选择多个。一个文件就是一个提示词包；中文内容可以直接上传。.doc 需要先另存为 .docx。</p>
              </article>
              <article>
                <strong>02</strong>
                <h3>商品图片</h3>
                <p>支持常见图片格式，如 .png、.jpg、.jpeg、.webp，可一次选择多张。图片要清晰、主体完整，尽量不要有水印、拼图或过多背景干扰。</p>
              </article>
              <article>
                <strong>03</strong>
                <h3>CSV / Excel</h3>
                <p>这是可选上传项，用来批量补充商品名、类别、补充信息、时长、画幅等。一行代表一条任务配置。</p>
              </article>
              <article>
                <strong>04</strong>
                <h3>文件名一对一</h3>
                <p>如果选择“按文件名一对一”，建议提示词包和图片使用同一个主文件名，例如 A001.docx 对 A001.png，男装01.docx 对 男装01.jpg。</p>
              </article>
              <article>
                <strong>05</strong>
                <h3>表格字段</h3>
                <p>表头可写：提示词包文件名、商品图片文件名、任务编号、商品名称、类别、商品补充信息、视频时长、画幅、libTV模式、自动提交。</p>
              </article>
              <article>
                <strong>06</strong>
                <h3>上传限制</h3>
                <p>不要上传压缩包、模糊图片、空白文档、重复命名文件。文件名不要只写 1、2、3，建议带品类或编号，方便后续查找。</p>
              </article>
            </div>

            <div className="guide-notes">
              <div>
                <h3>推荐命名</h3>
                <p>推荐格式：类别-编号，例如 男装-001.docx、男装-001.png；女装-002.docx、女装-002.jpg。</p>
              </div>
              <div>
                <h3>表格文件名</h3>
                <p>表格里填写的文件名要和上传文件一致，包含后缀最好，例如 男装-001.docx、男装-001.png。</p>
              </div>
              <div>
                <h3>不填表格也可以</h3>
                <p>不上传 CSV / Excel 时，系统会根据上传的提示词包和商品图自动生成任务，商品名称会优先从文件名推断。</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="batch-layout">
        <div className="panel batch-builder">
          <div className="panel-head">
            <div>
              <h2>任务构建</h2>
              <p className="panel-note">第一版支持多提示词包、多商品图、CSV 导入和文件名自动匹配。</p>
            </div>
          </div>
          <div className="two-col">
            <label className="field">
              <span>批次名称</span>
              <input value={batchName} onChange={(event) => setBatchName(event.target.value)} />
            </label>
            <label className="field">
              <span>并发数</span>
              <input type="number" min="1" max={runtime?.batchMaxWorkers || 30} value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value || 1))} />
            </label>
          </div>
          <div className="batch-upload-grid">
            <label className="field upload-box">
              <span>提示词包，可多选 Word</span>
              <input className="file-input-native" type="file" accept=".docx,.txt,.md" multiple onChange={(event) => handlePromptFiles(event.target.files)} />
              <span className="file-picker-shell">
                <span className="file-picker-button">
                  <Upload size={16} />
                  <span>上传文件</span>
                </span>
                <span className="file-picker-status">{promptFiles.length ? `已选择 ${promptFiles.length} 个文件` : "未选择文件"}</span>
              </span>
              <em>{promptFiles.length} 个提示词包</em>
            </label>
            <label className="field upload-box">
              <span>商品图片，可多选</span>
              <input className="file-input-native" type="file" accept="image/*" multiple onChange={(event) => handleImageFiles(event.target.files)} />
              <span className="file-picker-shell">
                <span className="file-picker-button">
                  <Upload size={16} />
                  <span>上传图片</span>
                </span>
                <span className="file-picker-status">{imageFiles.length ? `已选择 ${imageFiles.length} 张图片` : "未选择图片"}</span>
              </span>
              <em>{imageFiles.length} 张商品图</em>
            </label>
            <label className="field upload-box">
              <span>CSV / Excel 导入</span>
              <input className="file-input-native" type="file" accept=".xlsx,.xls,.csv,.txt" onChange={(event) => handleCsv(event.target.files?.[0])} />
              <span className="file-picker-shell">
                <span className="file-picker-button">
                  <Upload size={16} />
                  <span>导入表格</span>
                </span>
                <span className="file-picker-status">{csvRows.length ? `已导入 ${csvRows.length} 行配置` : "未导入表格"}</span>
              </span>
              <em>{csvRows.length} 行表格配置</em>
            </label>
          </div>
          <div className="batch-config-grid">
            <label className="field">
              <span>匹配规则</span>
              <select value={matchMode} onChange={(event) => setMatchMode(event.target.value)}>
                <option value="filename">按文件名一对一</option>
                <option value="one_prompt_all_images">第一个提示词包跑全部图片</option>
                <option value="cross_join">多提示词包 × 多图片</option>
              </select>
            </label>
            <label className="field">
              <span>默认时长</span>
              <input type="number" min="3" max="60" value={defaultDuration} onChange={(event) => setDefaultDuration(Number(event.target.value || 15))} />
            </label>
            <label className="field">
              <span>默认画幅</span>
              <select value={defaultAspectRatio} onChange={(event) => setDefaultAspectRatio(event.target.value)}>
                <option value="9:16">9:16 竖屏</option>
                <option value="16:9">16:9 横屏</option>
                <option value="1:1">1:1 方形</option>
              </select>
            </label>
            <label className="field">
              <span>libTV 模式</span>
              <select value={defaultVideoMode} onChange={(event) => setDefaultVideoMode(event.target.value)}>
                <option value="dry_run">先验证</option>
                <option value="submit">真实提交</option>
                <option value="run">提交并等待</option>
              </select>
            </label>
          </div>
          <div className="batch-builder-actions">
            <label className="checkbox-line batch-submit-check">
              <input type="checkbox" checked={autoSubmit} onChange={(event) => setAutoSubmit(event.target.checked)} />
              <span>生成最终提示词后自动提交 libTV</span>
            </label>
            <div className="batch-builder-buttons">
              <button className="secondary-button" type="button" onClick={downloadBatchTemplate}>
                <Download size={16} />
                <span>下载模板</span>
              </button>
              <button className="secondary-button" type="button" onClick={buildRows}>
                <ListChecks size={16} />
                <span>生成任务表</span>
              </button>
              <button className="secondary-button" type="button" onClick={() => createBatch(false)} disabled={creating || !selectedRows.length}>只创建不启动</button>
            </div>
          </div>
        </div>

        <div className="panel batch-list-panel">
          <div className="panel-head">
            <div>
              <h2>批次列表</h2>
              <p className="panel-note">选择一个批次查看实时状态。</p>
            </div>
          </div>
          <div className="batch-job-list">
            {batchJobs.length ? batchJobs.map((job) => (
              <button
                type="button"
                key={job.id}
                className={selectedBatchId === job.id ? "batch-job-item active" : "batch-job-item"}
                onClick={() => setSelectedBatchId(job.id)}
              >
                <strong>{job.name}</strong>
                <span>{job.success_count || 0}/{job.total_count || 0} 完成 · 失败 {job.failed_count || 0}</span>
                <StatusBadge value={job.status} />
              </button>
            )) : <div className="empty-inline">暂无批次</div>}
          </div>
        </div>
      </div>

      <div className="panel batch-table-panel">
        <div className="panel-head">
          <div>
            <h2>待创建任务表</h2>
            <p className="panel-note">一行就是一条视频任务，勾选后可批量创建。</p>
          </div>
          <div className="panel-actions">
            {rows.length ? (
              <label className="checkbox-line compact-check">
                <input type="checkbox" checked={onlyInvalidRows} onChange={(event) => setOnlyInvalidRows(event.target.checked)} />
                <span>只看异常</span>
              </label>
            ) : null}
            <button className="ghost-button" type="button" onClick={() => toggleAllRows(true)}>全选</button>
            <button className="ghost-button" type="button" onClick={() => toggleAllRows(false)}>全不选</button>
          </div>
        </div>
        {rows.length ? (
          <div className="batch-precheck">
            <div>
              <strong>预检结果</strong>
              <span>共 {precheck.total} 条，通过 {precheck.ok} 条，异常 {precheck.error} 条，提醒 {precheck.warn} 条。</span>
            </div>
            <em>{precheck.error ? "异常行不会被创建，请先修正缺文件、重复编号、非法参数等问题。" : "当前已通过基础校验，可以创建批量任务。"}</em>
          </div>
        ) : null}
        <div className="table-wrap batch-draft-table">
          <table>
            <thead>
              <tr>
                <th>选择</th>
                <th>预检</th>
                <th>任务</th>
                <th>提示词包</th>
                <th>商品图</th>
                <th>商品名</th>
                <th>类别</th>
                <th>补充信息</th>
                <th>参数</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length ? visibleRows.map((row) => {
                const invalid = !row.validation.ok;
                const validationLabel = invalid ? "异常" : row.validation.warnings.length ? "提醒" : "通过";
                return (
                <tr key={row.id}>
                  <td><input type="checkbox" disabled={invalid} checked={row.enabled !== false && !invalid} onChange={(event) => updateRow(row.id, "enabled", event.target.checked)} /></td>
                  <td className="precheck-cell">
                    <span className={`precheck-badge ${invalid ? "error" : row.validation.warnings.length ? "warn" : "ok"}`}>{validationLabel}</span>
                    {[...row.validation.errors, ...row.validation.warnings].slice(0, 3).map((message) => <small key={message}>{message}</small>)}
                  </td>
                  <td>{row.taskNo}</td>
                  <td title={row.prompt?.name}>{row.prompt?.name || "-"}</td>
                  <td title={row.image?.name}>{row.image?.name || "-"}</td>
                  <td><input value={row.productName} onChange={(event) => updateRow(row.id, "productName", event.target.value)} /></td>
                  <td><input value={row.productCategory} onChange={(event) => updateRow(row.id, "productCategory", event.target.value)} placeholder="可空" /></td>
                  <td><textarea rows={2} value={row.productBrief} onChange={(event) => updateRow(row.id, "productBrief", event.target.value)} /></td>
                  <td>
                    <span>{row.targetDuration}s</span>
                    <span>{row.aspectRatio}</span>
                    <span>{row.videoMode}</span>
                  </td>
                </tr>
              );
              }) : (
                <tr><td colSpan="9">{rows.length ? "当前没有异常行。" : "上传提示词包和商品图后，点击“生成任务表”。"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel batch-runtime-panel">
        <div className="panel-head">
          <div>
            <h2>执行状态</h2>
            <p className="panel-note">后端 worker 按并发数领取任务，页面自动刷新。</p>
          </div>
          <div className="panel-actions">
            <button className="secondary-button" type="button" onClick={() => batchAction("start")} disabled={!selectedBatchId}>启动</button>
            <button className="secondary-button" type="button" onClick={() => batchAction("pause")} disabled={!selectedBatchId}>暂停</button>
            <button className="secondary-button danger-light" type="button" onClick={() => batchAction("cancel")} disabled={!selectedBatchId}>取消</button>
            <button className="secondary-button" type="button" onClick={() => batchAction("retry")} disabled={!selectedBatchId}>失败重试</button>
            <button className="secondary-button" type="button" onClick={exportResultCsv} disabled={!activeDetail?.items?.length}>导出结果</button>
          </div>
        </div>
        <div className="batch-stats">
          <div><span>总任务</span><strong>{totals.total}</strong></div>
          <div><span>排队</span><strong>{totals.pending}</strong></div>
          <div><span>运行中</span><strong>{totals.running}</strong></div>
          <div><span>成功</span><strong>{totals.success}</strong></div>
          <div><span>失败</span><strong>{totals.failed}</strong></div>
          <div><span>取消</span><strong>{totals.cancelled}</strong></div>
        </div>
        <div className="table-wrap batch-result-table">
          <table>
            <thead>
              <tr>
                <th>序号</th>
                <th>状态</th>
                <th>当前步骤</th>
                <th>任务编号</th>
                <th>商品 / 类别</th>
                <th>进度</th>
                <th>tokens</th>
                <th>视频结果</th>
                <th>错误</th>
              </tr>
            </thead>
            <tbody>
              {activeDetail?.items?.length ? activeDetail.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.row_no}</td>
                  <td><StatusBadge value={item.status} /></td>
                  <td>{item.current_step || "-"}</td>
                  <td>{item.libtv_task_code || item.task_no || "-"}</td>
                  <td>
                    <strong>{item.product_name || "-"}</strong>
                    <span>{item.suggested_category || item.product_category || "-"}</span>
                  </td>
                  <td>
                    <div className="mini-progress"><span style={{ width: `${Number(item.progress || 0)}%` }} /></div>
                    <em>{Number(item.progress || 0)}%</em>
                  </td>
                  <td>{tokenTotal(item.token_usage_json)}</td>
                  <td>{item.video_url ? <a href={item.video_url} target="_blank" rel="noreferrer">查看视频</a> : item.final_prompt ? "有提示词" : "-"}</td>
                  <td title={item.error_message || ""}>{item.error_message || "-"}</td>
                </tr>
              )) : (
                <tr><td colSpan="9">选择或创建一个批次后查看执行状态。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function buildBatchRows({ promptFiles, imageFiles, csvRows, matchMode, defaultDuration, defaultAspectRatio, defaultVideoMode, autoSubmit }) {
  const rows = [];
  const promptByName = indexFiles(promptFiles);
  const imageByName = indexFiles(imageFiles);
  if (csvRows.length) {
    csvRows.forEach((item, index) => {
      const promptName = pickCsvValue(item, ["提示词包文件名", "提示词包", "prompt", "prompt_file", "prompt_file_name"]);
      const imageName = pickCsvValue(item, ["商品图片文件名", "商品图片", "图片", "image", "image_file", "image_file_name"]);
      const prompt = promptName ? findIndexedFile(promptByName, promptName) : promptFiles[index] || promptFiles[0];
      const image = imageName ? findIndexedFile(imageByName, imageName) : imageFiles[index] || imageFiles[0];
      rows.push(makeBatchDraftRow({
        index,
        prompt,
        image,
        requestedPromptFileName: promptName,
        requestedImageFileName: imageName,
        taskNo: pickCsvValue(item, ["任务编号", "task_no", "taskNo"]) || String(index + 1).padStart(3, "0"),
        productName: pickCsvValue(item, ["商品名称", "商品名", "product_name", "productName"]),
        productCategory: pickCsvValue(item, ["类别", "category", "productCategory"]),
        productBrief: pickCsvValue(item, ["商品补充信息", "补充信息", "product_brief", "productBrief"]),
        targetDuration: pickCsvValue(item, ["视频时长", "duration", "targetDuration"]) || defaultDuration,
        aspectRatio: pickCsvValue(item, ["画幅", "aspect_ratio", "aspectRatio"]) || defaultAspectRatio,
        videoMode: normalizeBatchVideoMode(pickCsvValue(item, ["libTV模式", "libTV 模式", "videoMode"])) || defaultVideoMode,
        autoSubmit: csvBool(pickCsvValue(item, ["是否自动提交libTV", "自动提交", "autoSubmit"]), autoSubmit)
      }));
    });
    return rows;
  }

  if (matchMode === "cross_join") {
    promptFiles.forEach((prompt) => {
      imageFiles.forEach((image) => {
        rows.push(makeBatchDraftRow({ index: rows.length, prompt, image, targetDuration: defaultDuration, aspectRatio: defaultAspectRatio, videoMode: defaultVideoMode, autoSubmit }));
      });
    });
    return rows;
  }

  if (matchMode === "one_prompt_all_images") {
    const prompt = promptFiles[0];
    imageFiles.forEach((image, index) => {
      rows.push(makeBatchDraftRow({ index, prompt, image, targetDuration: defaultDuration, aspectRatio: defaultAspectRatio, videoMode: defaultVideoMode, autoSubmit }));
    });
    return rows;
  }

  const max = Math.max(promptFiles.length, imageFiles.length);
  for (let index = 0; index < max; index += 1) {
    const image = imageFiles[index];
    const prompt = findIndexedFile(promptByName, image?.name) || promptFiles[index] || promptFiles[0];
    rows.push(makeBatchDraftRow({ index, prompt, image, targetDuration: defaultDuration, aspectRatio: defaultAspectRatio, videoMode: defaultVideoMode, autoSubmit }));
  }
  return rows;
}

function makeBatchDraftRow({ index, prompt, image, requestedPromptFileName = "", requestedImageFileName = "", taskNo, productName = "", productCategory = "", productBrief = "", targetDuration = 15, aspectRatio = "9:16", videoMode = "dry_run", autoSubmit = true }) {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    enabled: true,
    taskNo: taskNo || String(index + 1).padStart(3, "0"),
    prompt,
    image,
    requestedPromptFileName,
    requestedImageFileName,
    promptFileName: prompt?.name || "",
    imageFileName: image?.name || "",
    productName: productName || cleanNameFromFile(image?.name || prompt?.name || ""),
    productCategory,
    productBrief,
    targetDuration: Number(targetDuration || 15),
    aspectRatio,
    videoMode,
    autoSubmit
  };
}

function validateBatchDraftRows(rows = []) {
  const taskCounts = new Map();
  rows.forEach((row) => {
    const taskNo = String(row.taskNo || "").trim();
    if (taskNo) taskCounts.set(taskNo, (taskCounts.get(taskNo) || 0) + 1);
  });
  return rows.map((row) => {
    const errors = [];
    const warnings = [];
    const taskNo = String(row.taskNo || "").trim();
    const duration = Number(row.targetDuration);
    const aspectRatio = String(row.aspectRatio || "").trim();
    const videoMode = String(row.videoMode || "").trim();
    const promptName = row.prompt?.name || row.promptFileName || "";
    const imageName = row.image?.name || row.imageFileName || "";

    if (!taskNo) errors.push("缺任务编号");
    if (taskNo && taskCounts.get(taskNo) > 1) errors.push("任务编号重复");
    if (row.requestedPromptFileName && !row.prompt) errors.push(`未找到提示词包：${row.requestedPromptFileName}`);
    if (row.requestedImageFileName && !row.image) errors.push(`未找到商品图：${row.requestedImageFileName}`);
    if (!row.prompt) errors.push("缺提示词包");
    if (row.prompt && !String(row.prompt.text || "").trim()) errors.push("提示词包内容为空");
    if (!row.image) errors.push("缺商品图片");
    if (!Number.isFinite(duration) || duration < 3 || duration > 60) errors.push("视频时长需为 3-60 秒");
    if (!["9:16", "16:9", "1:1"].includes(aspectRatio)) errors.push("画幅只支持 9:16、16:9、1:1");
    if (!["dry_run", "submit", "run"].includes(videoMode)) errors.push("libTV 模式不合法");

    if (!String(row.productName || "").trim()) warnings.push("商品名称为空，将按文件名推断");
    if (!String(row.productCategory || "").trim()) warnings.push("类别为空，将按图片识别");
    if (!String(row.productBrief || "").trim()) warnings.push("商品补充信息为空");
    if (promptName && imageName && fileBase(promptName) !== fileBase(imageName)) warnings.push("提示词包和图片主文件名不一致");

    return {
      ...row,
      validation: {
        ok: errors.length === 0,
        errors,
        warnings
      }
    };
  });
}

function stripBatchValidation(row) {
  const { validation, ...rest } = row;
  return rest;
}

function summarizeBatchPrecheck(rows = []) {
  return rows.reduce((summary, row) => {
    summary.total += 1;
    if (!row.validation?.ok) summary.error += 1;
    else {
      summary.ok += 1;
      if (row.validation.warnings?.length) summary.warn += 1;
    }
    return summary;
  }, { total: 0, ok: 0, error: 0, warn: 0 });
}

function indexFiles(files = []) {
  const map = new Map();
  files.forEach((file) => {
    const name = String(file.name || "");
    map.set(name.toLowerCase(), file);
    map.set(fileBase(name), file);
  });
  return map;
}

function findIndexedFile(index, name) {
  if (!name) return null;
  const exact = String(name).toLowerCase().trim();
  return index.get(exact) || index.get(fileBase(exact)) || null;
}

function fileBase(name = "") {
  return String(name).toLowerCase().replace(/\.[^.]+$/, "").trim();
}

function cleanNameFromFile(name = "") {
  return String(name).replace(/\.[^.]+$/, "").replace(/^(\d+[-_])/, "").slice(0, 80);
}

async function parseWorkbookRows(buffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function parseCsvRows(text) {
  const rows = parseCsvMatrix(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((item) => String(item || "").trim());
  return rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim())).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      if (header) item[header] = row[index] || "";
    });
    return item;
  });
}

function parseCsvMatrix(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function pickCsvValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  return "";
}

function csvBool(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  return /^(1|true|yes|y|是|自动|提交)$/i.test(String(value).trim());
}

function normalizeBatchVideoMode(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.includes("run") || text.includes("等待")) return "run";
  if (text.includes("submit") || text.includes("真实")) return "submit";
  if (text.includes("dry") || text.includes("验证")) return "dry_run";
  return "";
}

function summarizeBatchItems(items = []) {
  const result = { total: items.length, pending: 0, running: 0, success: 0, failed: 0, cancelled: 0 };
  items.forEach((item) => {
    const status = String(item.status || "");
    if (["draft", "queued", "retrying"].includes(status)) result.pending += 1;
    else if (["running", "image_analysis", "prompt_generating", "submitting_libtv", "video_generating"].includes(status)) result.running += 1;
    else if (["succeeded", "prompt_ready"].includes(status)) result.success += 1;
    else if (status === "failed") result.failed += 1;
    else if (status === "cancelled") result.cancelled += 1;
  });
  return result;
}

function tokenTotal(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed.totalTokens || parsed.total?.totalTokens || parsed.total?.total?.totalTokens || 0;
  } catch {
    return 0;
  }
}

function batchActionTitle(action) {
  if (action === "start") return "批量任务已启动";
  if (action === "pause") return "批量任务已暂停";
  if (action === "cancel") return "批量任务已取消";
  return "失败任务已重试";
}

function resultValueForExport(item, key) {
  if (key === "tokens") return tokenTotal(item.token_usage_json);
  if (key === "category") return item.suggested_category || item.product_category || "";
  return item[key] || "";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function VideoStitchPage({ jobs, assets, addNotification, onRefresh }) {
  const [selected, setSelected] = useState([]);
  const [groupSize, setGroupSize] = useState(2);
  const [stitchNotice, setStitchNotice] = useState("");
  const [stitchRunning, setStitchRunning] = useState(false);
  const [stitchSteps, setStitchSteps] = useState([]);
  const [stitchResult, setStitchResult] = useState(null);
  const libtvVideos = jobs
    .filter((row) => row["视频链接"])
    .map((row) => ({
      id: `job-${row["任务编号"]}-${row["外部任务ID"] || row["视频链接"]}`,
      source: "libTV",
      taskCode: row["任务编号"],
      name: row["最终视频名称"] || row["任务编号"] || "未命名视频",
      url: row["视频链接"],
      openUrl: row["视频链接"],
      status: row["libTV状态"],
      updatedAt: row["完成时间"]
    }));
  const localVideos = (assets?.outputFiles || [])
    .filter((file) => /\.mp4$/i.test(file.name || file.path || ""))
    .map((file) => ({
      id: `file-${file.path}`,
      source: "本地输出",
      taskCode: "-",
      name: file.name,
      url: file.path,
      openUrl: file.url || file.path,
      status: "本地文件",
      updatedAt: file.updatedAt
    }));
  const videos = [...libtvVideos, ...localVideos];
  const selectedVideos = videos.filter((video) => selected.includes(video.id));
  const groupCount = groupSize > 0 ? Math.ceil(selectedVideos.length / groupSize) : 0;

  function toggleVideo(videoId, checked) {
    setSelected((current) => checked ? [...current, videoId] : current.filter((id) => id !== videoId));
  }

  function toggleAll(checked) {
    setSelected(checked ? videos.map((video) => video.id) : []);
  }

  function upsertStitchStep(name, status, message, output = "", at = "") {
    const key = String(name || "视频拼接").trim() || "视频拼接";
    setStitchSteps((current) => {
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
      copy[index] = { ...copy[index], ...next };
      return copy;
    });
  }

  async function startStitch() {
    if (selectedVideos.length < 2) return;
    setStitchRunning(true);
    setStitchNotice("");
    setStitchResult(null);
    setStitchSteps([]);
    addNotification?.({
      level: "info",
      title: "视频拼接已开始",
      message: `已选择 ${selectedVideos.length} 个视频，按每组 ${groupSize} 个合成。`,
      target: "stitch"
    });
    try {
      upsertStitchStep("创建拼接任务", "running", "正在提交视频拼接任务。");
      const data = await requestJson("/api/stitch-runs", {
        method: "POST",
        body: JSON.stringify({
          groupSize,
          videos: selectedVideos
        })
      });
      connectStitchEvents(data.runId);
    } catch (error) {
      setStitchRunning(false);
      upsertStitchStep("创建拼接任务", "failed", error.message);
      addNotification?.({
        level: "error",
        title: "视频拼接启动失败",
        message: error.message,
        target: "stitch"
      });
    }
  }

  function connectStitchEvents(nextRunId) {
    const source = createEventSource(`/api/runs/${nextRunId}/events`);
    source.onmessage = (event) => handleStitchEvent(JSON.parse(event.data));
    source.addEventListener("done", () => {
      source.close();
      setStitchRunning(false);
      onRefresh?.();
    });
    source.onerror = () => {
      source.close();
      setStitchRunning(false);
    };
  }

  function handleStitchEvent(event) {
    if (event.type === "status") {
      upsertStitchStep(event.phase, "running", event.message, "", event.at);
    }
    if (event.type === "group_completed") {
      upsertStitchStep(event.phase, "done", event.message, JSON.stringify(event.result, null, 2), event.at);
    }
    if (event.type === "completed") {
      setStitchResult(event.result || null);
      upsertStitchStep(event.phase || "拼接完成", "done", event.message, JSON.stringify(event.result, null, 2), event.at);
      setStitchNotice(event.message || "视频拼接已完成。");
      addNotification?.({
        level: "success",
        title: "视频拼接完成",
        message: event.message || "拼接视频已生成，可在本页打开查看。",
        target: "stitch"
      });
    }
    if (event.type === "failed") {
      upsertStitchStep(event.phase || "拼接失败", "failed", event.message, "", event.at);
      setStitchNotice(event.message || "视频拼接失败。");
      addNotification?.({
        level: "error",
        title: "视频拼接失败",
        message: event.message || "请检查视频文件或 ffmpeg 配置。",
        target: "stitch"
      });
    }
  }

  return (
    <section className="panel stitch-panel">
      <div className="panel-head">
        <div>
          <h2>视频拼接</h2>
          <p className="panel-note">从提示词工作台生成完成的视频里勾选素材，后续接入拼接接口后可直接合成。</p>
        </div>
        <div className="button-row">
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            <span>刷新视频</span>
          </button>
          <button
            className="primary-button stitch-submit"
            type="button"
            disabled={selectedVideos.length < 2 || stitchRunning}
            onClick={startStitch}
          >
            <Scissors size={16} />
            <span>{stitchRunning ? "拼接中" : "合成所选视频"}</span>
          </button>
        </div>
      </div>

      <div className="stitch-toolbar">
        <label className="field">
          <span>每组合成数量</span>
          <input
            type="number"
            min="2"
            max="20"
            value={groupSize}
            onChange={(event) => setGroupSize(Number(event.target.value) || 2)}
          />
        </label>
        <div className="stitch-summary">
          <div><span>可选视频</span><strong>{videos.length}</strong></div>
          <div><span>已勾选</span><strong>{selectedVideos.length}</strong></div>
          <div><span>预计组合</span><strong>{groupCount}</strong></div>
        </div>
      </div>

      <label className="check-row stitch-check-all">
        <input
          type="checkbox"
          checked={videos.length > 0 && selected.length === videos.length}
          onChange={(event) => toggleAll(event.target.checked)}
        />
        <span>全选当前列表</span>
      </label>

      {stitchNotice ? <div className="stitch-notice">{stitchNotice}</div> : null}
      {stitchSteps.length ? (
        <div className="stitch-progress">
          <ProgressBar value={progressPercent(stitchSteps)} />
          <StepList steps={stitchSteps} emptyText="等待拼接任务" />
        </div>
      ) : null}
      {stitchResult?.outputs?.length ? (
        <div className="stitch-output-grid">
          {stitchResult.outputs.map((output) => (
            <a className="stitch-output-card" key={output.path} href={output.url} target="_blank" rel="noreferrer">
              <strong>{output.name}</strong>
              <span>第 {output.groupNo} 组 / {formatBytes(output.size)} / {output.ffmpegMode}</span>
            </a>
          ))}
        </div>
      ) : null}

      <div className="table-wrap stitch-table-wrap">
        <table className="stitch-table">
          <thead>
            <tr>
              <th>选择</th>
              <th>视频名称</th>
              <th>任务编号</th>
              <th>来源</th>
              <th>状态</th>
              <th>完成时间</th>
              <th>视频</th>
            </tr>
          </thead>
          <tbody>
            {videos.length ? videos.map((video) => (
              <tr key={video.id}>
                <td>
                  <input
                    className="table-check"
                    type="checkbox"
                    checked={selected.includes(video.id)}
                    onChange={(event) => toggleVideo(video.id, event.target.checked)}
                  />
                </td>
                <td>{video.name}</td>
                <td>{video.taskCode}</td>
                <td>{video.source}</td>
                <td><StatusBadge value={video.status} /></td>
                <td>{formatDate(video.updatedAt)}</td>
                <td>{/^https?:\/\//i.test(video.openUrl) || String(video.openUrl).startsWith("/api/") ? <a href={video.openUrl} target="_blank" rel="noreferrer">打开</a> : <span className="path-cell">{video.openUrl}</span>}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7">暂时没有可拼接的视频。先在提示词工作台生成并提交 libTV，视频完成后会出现在这里。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OverviewPage({ runtime, tasks, jobs, assets, navigate, onRefresh }) {
  const jobStats = useMemo(() => {
    const values = jobs.map(jobStatusText);
    return {
      total: jobs.length,
      succeeded: values.filter((value) => value.includes("succeed") || value.includes("完成")).length,
      pending: values.filter((value) => value.includes("pending") || value.includes("running") || value.includes("处理中")).length,
      failed: values.filter((value) => value.includes("fail") || value.includes("失败")).length
    };
  }, [jobs]);
  const latestTasks = tasks.slice(0, 6);
  const outputFiles = assets?.outputFiles || [];
  const outputCount = outputFiles.length;
  const todayTaskCount = tasks.filter((row) => isToday(row["更新时间"] || row.updated_at || row.created_at)).length;
  const failedTaskCount = tasks.filter((row) => isBadStatus(taskStatusText(row))).length;
  const stitchedOutputs = outputFiles.filter((file) => file.kind === "stitched" || /[\\/]stitched[\\/]/i.test(file.path || ""));
  const libtvOutputs = outputFiles.filter((file) => file.kind === "libtv" || /[\\/]libtv[\\/]/i.test(file.path || ""));
  const latestOutputs = outputFiles.filter((file) => /\.mp4$/i.test(file.name || file.path || "")).slice(0, 6);
  const storageSize = sumFileSize(outputFiles);
  const connected = !runtime?.error;
  const libtvReady = Boolean(runtime?.libtvBridgeReachable);
  const modelChannels = [
    { name: "提示词分析", model: runtime?.currentModels?.analysis || "-", ready: Boolean(runtime?.doubaoConfigured || runtime?.qianwenTextConfigured) },
    { name: "图片识别", model: runtime?.currentModels?.vision || "-", ready: Boolean(runtime?.qianwenVisionConfigured) },
    { name: "视频生成", model: runtime?.currentModels?.video || "-", ready: Boolean(runtime?.seedanceConfigured || runtime?.libtvBridgeReachable) },
    { name: "视频拼接", model: runtime?.ffmpeg || "ffmpeg", ready: Boolean(runtime?.ffmpegConfigured) }
  ];
  const statusCards = [
    {
      label: "后端 API",
      value: connected ? "已连接" : "未连接",
      detail: connected ? "端口 :3001" : runtime?.error || "等待检测",
      good: connected,
      icon: Server
    },
    {
      label: "libTV 桥接",
      value: libtvReady ? "已连接" : "未连接",
      detail: runtime?.libtvBridgeUrl || "127.0.0.1:8799",
      good: libtvReady,
      icon: Video
    },
    {
      label: "数据库",
      value: runtime?.libtvDatabase ? "SQLite" : "未返回",
      detail: runtime?.libtvDatabase || "等待后端配置",
      good: Boolean(runtime?.libtvDatabase),
      icon: Database
    },
    {
      label: "模型配置",
      value: runtime?.doubaoConfigured || runtime?.qianwenVisionConfigured ? "可用" : "待配置",
      detail: runtime?.currentModels?.analysis || runtime?.currentModels?.vision || "查看系统设置",
      good: Boolean(runtime?.doubaoConfigured || runtime?.qianwenVisionConfigured),
      icon: Brain
    }
  ];
  const productionCards = [
    { label: "今日任务", value: todayTaskCount, detail: "按任务更新时间统计", icon: Timer, tone: "good" },
    { label: "libTV 成功率", value: formatPercent(jobStats.succeeded, jobStats.total), detail: `${jobStats.succeeded}/${jobStats.total || 0} 个任务成功`, icon: Gauge, tone: "good" },
    { label: "拼接成片", value: stitchedOutputs.length, detail: "outputs/stitched", icon: Scissors, tone: "info" },
    { label: "libTV 视频", value: libtvOutputs.length, detail: "outputs/libtv", icon: Video, tone: "info" },
    { label: "异常任务", value: failedTaskCount + jobStats.failed, detail: "任务与 libTV 失败合计", icon: ShieldCheck, tone: failedTaskCount + jobStats.failed ? "bad" : "good" },
    { label: "本地存储", value: formatBytes(storageSize), detail: `${outputCount} 个输出文件`, icon: HardDrive, tone: "info" }
  ];
  const modules = [
    {
      page: "studio",
      title: "提示词工作台",
      code: "PROMPT_STUDIO",
      desc: "上传 Word 提示词包和商品图，生成最终完整视频提示词。",
      icon: Sparkles
    },
    {
      page: "batch",
      title: "批量生成",
      code: "BATCH_CENTER",
      desc: "批量导入提示词包和商品图，按并发队列自动生成多条视频。",
      icon: ListChecks
    },
    {
      page: "stitch",
      title: "视频拼接",
      code: "VIDEO_STITCH",
      desc: "勾选已生成视频，按组调用 ffmpeg 合成完整素材。",
      icon: Scissors
    },
    {
      page: "tasks",
      title: "任务看板",
      code: "TASK_BOARD",
      desc: "查看提示词入库、任务状态、类别、视频命名和更新时间。",
      icon: Clipboard
    },
    {
      page: "libtv",
      title: "libTV 任务",
      code: "LIBTV_JOBS",
      desc: "追踪真实提交、轮询结果、视频链接和失败原因。",
      icon: Video
    },
    {
      page: "assets",
      title: "素材与输出",
      code: "ASSETS_OUTPUT",
      desc: "按任务查看上传图片、生成文件、本地输出和素材路径。",
      icon: FolderOpen
    },
    {
      page: "settings",
      title: "模型中心",
      code: "MODEL_CENTER",
      desc: "切换分析/视觉/视频模型，查看后端和通道配置。",
      icon: Settings
    }
  ];

  return (
    <section className="overview-page">
      <div className="overview-hero panel">
        <div>
          <div className="eyebrow">AI VIDEO OPERATIONS</div>
          <h2>AI 视频生成工作流平台</h2>
          <p>围绕商品图、提示词包、模型分析、libTV 生成和视频拼接组织生产流程，首页直接看到产能、状态、输出和模型通道。</p>
        </div>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => navigate("studio")}>
            <Play size={16} />
            <span>开始生成</span>
          </button>
          <button className="secondary-button" onClick={onRefresh}>
            <RefreshCw size={16} />
            <span>刷新状态</span>
          </button>
        </div>
      </div>

      <div className="production-grid">
        {productionCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className={`production-card ${card.tone}`} key={card.label}>
              <div className="production-icon"><Icon size={18} /></div>
              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small>{card.detail}</small>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overview-status-grid">
        {statusCards.map((card) => {
          const Icon = card.icon;
          return (
            <div className={card.good ? "overview-status-card ready" : "overview-status-card"} key={card.label}>
              <div className="overview-card-icon"><Icon size={18} /></div>
              <div>
                <span>{card.label}</span>
                <strong>{card.value}</strong>
                <small title={card.detail}>{card.detail}</small>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overview-layout">
        <div className="module-panel panel">
          <div className="panel-head">
            <div>
              <h2>功能入口</h2>
              <p className="panel-note">按业务模块进入，底层接口沿用当前项目。</p>
            </div>
          </div>
          <div className="module-grid">
            {modules.map((item) => {
              const Icon = item.icon;
              return (
                <button className="module-card" key={item.page} onClick={() => navigate(item.page)}>
                  <span className="module-icon"><Icon size={22} /></span>
                  <span className="module-code">{item.code}</span>
                  <strong>{item.title}</strong>
                  <span>{item.desc}</span>
                  <em>进入 <ChevronRight size={14} /></em>
                </button>
              );
            })}
          </div>

          <div className="overview-main-strip">
            <div className="main-strip-head">
              <BarChart3 size={17} />
              <strong>任务概况</strong>
            </div>
            <div className="stats-grid stats-grid-wide">
              <div><span>总任务</span><strong>{tasks.length}</strong></div>
              <div><span>libTV</span><strong>{jobStats.total}</strong></div>
              <div><span>待处理</span><strong>{jobStats.pending}</strong></div>
              <div><span>成功</span><strong>{jobStats.succeeded}</strong></div>
              <div><span>失败</span><strong>{jobStats.failed}</strong></div>
              <div><span>输出</span><strong>{outputCount}</strong></div>
            </div>
          </div>

          <div className="overview-main-strip">
            <div className="main-strip-head">
              <ShieldCheck size={17} />
              <strong>当前链路</strong>
            </div>
            <ol className="pipeline-list pipeline-list-wide">
              <li><Workflow size={15} />提示词包 + 商品图</li>
              <li><Workflow size={15} />视觉识别 + 类别判断</li>
              <li><Workflow size={15} />生成最终完整提示词</li>
              <li><Workflow size={15} />写入 SQLite 并提交 libTV</li>
              <li><Workflow size={15} />按需拼接成片</li>
            </ol>
          </div>
        </div>

        <aside className="overview-side">
          <div className="mini-panel panel">
            <div className="mini-panel-head">
              <KeyRound size={17} />
              <strong>模型通道</strong>
            </div>
            <div className="channel-list">
              {modelChannels.map((channel) => (
                <div className={channel.ready ? "channel-item ready" : "channel-item"} key={channel.name}>
                  <span>{channel.name}</span>
                  <strong title={channel.model}>{channel.model}</strong>
                  <em>{channel.ready ? "可用" : "待配置"}</em>
                </div>
              ))}
            </div>
          </div>

          <div className="mini-panel panel">
            <div className="mini-panel-head">
              <FolderOpen size={17} />
              <strong>最近产出</strong>
            </div>
            <div className="output-list">
              {latestOutputs.length ? latestOutputs.map((file) => (
                <a
                  href={file.url || (/^https?:\/\//i.test(file.path || "") ? file.path : "#")}
                  target="_blank"
                  rel="noreferrer"
                  className="output-item"
                  key={`${file.kind || ""}-${file.path || file.name}`}
                >
                  <strong title={file.name}>{file.name}</strong>
                  <span>{file.kind || "output"} / {formatBytes(file.size)} / {formatDate(file.updatedAt)}</span>
                </a>
              )) : <div className="empty-inline">暂无输出视频</div>}
            </div>
          </div>
        </aside>
      </div>

      <div className="panel recent-panel">
        <div className="panel-head">
          <div>
            <h2>最近任务</h2>
            <p className="panel-note">这里只做预览，完整信息在任务看板。</p>
          </div>
          <button className="secondary-button" onClick={() => navigate("tasks")}>
            <Clipboard size={16} />
            <span>查看全部</span>
          </button>
        </div>
        <div className="table-wrap compact-table">
          <table>
            <thead>
              <tr>
                <th>任务编号</th>
                <th>最终视频名称</th>
                <th>类别</th>
                <th>状态</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {latestTasks.length ? latestTasks.map((row) => (
                <tr key={row["任务编号"]}>
                  <td>{row["任务编号"]}</td>
                  <td>{row["最终视频名称"] || "-"}</td>
                  <td>{row["类别"] || "-"}</td>
                  <td><StatusBadge value={row["任务状态"]} /></td>
                  <td>{formatDate(row["更新时间"])}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5">暂无任务记录</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
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
  const promptTokenUsage = summarizeTokenUsage(promptSteps, modelTrace);
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

        <label className="field file-field">
          <span>提示词包</span>
          <input className="file-input-native" type="file" accept=".docx,.txt,.md,.json,.csv" onChange={(event) => handlePromptFile(event.target.files?.[0])} />
          <span className="file-picker-shell">
            <span className="file-picker-button">
              <Upload size={16} />
              <span>上传文件</span>
            </span>
            <span className="file-picker-status">{studio.promptPackage?.name || (studio.promptPackText ? "已读取提示词文本" : "未选择文件")}</span>
          </span>
        </label>
        <label className="field">
          <span>提示词包正文</span>
          <textarea rows={10} value={studio.promptPackText} onChange={(event) => updateStudio("promptPackText", event.target.value)} placeholder="粘贴 SOP / 提示词包文本" />
        </label>
        <label className="field file-field">
          <span>产品图片</span>
          <input className="file-input-native" type="file" accept="image/*" multiple onChange={(event) => handleImages(event.target.files)} />
          <span className="file-picker-shell">
            <span className="file-picker-button">
              <Upload size={16} />
              <span>上传图片</span>
            </span>
            <span className="file-picker-status">{studio.images.length ? `已选择 ${studio.images.length} 张图片` : "未选择图片"}</span>
          </span>
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
        <TokenUsageSummary usage={promptTokenUsage} />
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
        output: step.output,
        tokenUsage: step.tokenUsage
      }));
  const traceTokenUsage = summarizeTokenUsage(steps, records);
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
          <div>
            <span>Tokens</span>
            <strong>{traceTokenUsage.totalTokens ? formatTokenNumber(traceTokenUsage.totalTokens) : "-"}</strong>
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
                  <div>
                    <strong>{item.phase || item.type || `记录 ${index + 1}`}</strong>
                    <TokenUsageBadge usage={item.tokenUsage} />
                  </div>
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
    <section className="panel assets-panel">
      <div className="panel-head">
        <div>
          <h2>素材与输出</h2>
          <p className="panel-note">查看提示词、商品图、本地视频和拼接产出。</p>
        </div>
        <div className="button-row assets-actions">
          <select className="assets-select" value={taskCode} onChange={(event) => setTaskCode(event.target.value)}>
            <option value="">全部任务</option>
            {tasks.map((task) => <option value={task["任务编号"]} key={task["任务编号"]}>{task["任务编号"]}</option>)}
          </select>
          <button className="secondary-button assets-refresh" onClick={onRefresh}><RefreshCw size={16} /><span>刷新</span></button>
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
  const activeVideoModel = resolveModelChoice(modelSettings, "video") || runtime?.currentModels?.video || "-";
  const activeImageModel = resolveModelChoice(modelSettings, "imageGeneration") || runtime?.currentModels?.imageGeneration || "-";
  const rows = [
    ["后端 API", runtime?.error ? "未连接" : "已连接"],
    ["千问文本", runtime?.qianwenTextConfigured ? "已配置" : "未配置"],
    ["千问视觉", runtime?.qianwenVisionConfigured ? "已配置" : "未配置"],
    ["豆包分析", runtime?.doubaoConfigured ? "已配置" : "未配置"],
    ["libTV 桥接", runtime?.libtvBridgeReachable ? "已连接" : "未连接"],
    ["ffmpeg 拼接", runtime?.ffmpegConfigured ? "已配置" : "未配置"],
    ["当前分析模型", activeAnalysisModel],
    ["当前视觉模型", activeVisionModel],
    ["数据库", runtime?.libtvDatabase || "-"],
    ["运行模式", runtime?.modeHint || "-"]
  ];
  return (
    <section className="panel settings-panel">
      <TableHead title="模型中心" onRefresh={onRefresh} />
      <ModelSettingsPanel
        runtime={runtime}
        modelSettings={modelSettings}
        updateModelSettings={updateModelSettings}
      />
      <ModelChannelPanel
        channels={[
          { name: "提示词分析", provider: "豆包 / 千问", model: activeAnalysisModel, ready: Boolean(runtime?.doubaoConfigured || runtime?.qianwenTextConfigured), desc: "负责拆解提示词包、生成最终完整提示词。" },
          { name: "图片识别", provider: "千问视觉", model: activeVisionModel, ready: Boolean(runtime?.qianwenVisionConfigured), desc: "负责识别商品图、自动判断类别和卖点。" },
          { name: "视频生成", provider: "libTV / Seedance", model: activeVideoModel, ready: Boolean(runtime?.libtvBridgeReachable || runtime?.seedanceConfigured), desc: "负责提交视频生成任务并回写结果。" },
          { name: "文生图", provider: "Seedream", model: activeImageModel, ready: Boolean(runtime?.seedreamConfigured), desc: "预留给后续商品素材生成。" },
          { name: "视频拼接", provider: "ffmpeg", model: runtime?.ffmpeg || "ffmpeg", ready: Boolean(runtime?.ffmpegConfigured), desc: "负责把已生成视频按组拼接成片。" }
        ]}
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

function ModelChannelPanel({ channels }) {
  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <div>
          <h3>模型与执行通道</h3>
          <p>用于确认整条 AI 视频生产链路里每一层是否可用。</p>
        </div>
        <KeyRound size={18} />
      </div>
      <div className="model-channel-grid">
        {channels.map((channel) => (
          <div className={channel.ready ? "model-channel-card ready" : "model-channel-card"} key={channel.name}>
            <div className="model-channel-head">
              <strong>{channel.name}</strong>
              <StatusBadge value={channel.ready ? "可用" : "待配置"} />
            </div>
            <span>{channel.provider}</span>
            <em title={channel.model}>{channel.model}</em>
            <p>{channel.desc}</p>
          </div>
        ))}
      </div>
    </div>
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
              <div>
                <div className="step-title">{step.name}</div>
                <TokenUsageBadge usage={step.tokenUsage} />
              </div>
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

function TokenUsageSummary({ usage }) {
  if (!usage?.totalTokens) return null;
  return (
    <div className="token-summary" aria-label="token 用量汇总">
      <span>Tokens</span>
      <strong>{formatTokenNumber(usage.totalTokens)}</strong>
      <span>输入 {formatTokenNumber(usage.promptTokens)}</span>
      <span>输出 {formatTokenNumber(usage.completionTokens)}</span>
      <span>{usage.calls} 次调用</span>
    </div>
  );
}

function TokenUsageBadge({ usage }) {
  const current = normalizeTokenUsage(usage);
  if (!current?.totalTokens) return null;
  return (
    <span className="token-badge" title={`输入 ${formatTokenNumber(current.promptTokens)} / 输出 ${formatTokenNumber(current.completionTokens)}`}>
      tokens {formatTokenNumber(current.totalTokens)}
    </span>
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

function normalizeTokenUsage(usage) {
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

function summarizeTokenUsage(steps = [], trace = []) {
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
      const current = normalizeTokenUsage(item?.tokenUsage);
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

function formatTokenNumber(value) {
  return Number(value || 0).toLocaleString("zh-CN");
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
