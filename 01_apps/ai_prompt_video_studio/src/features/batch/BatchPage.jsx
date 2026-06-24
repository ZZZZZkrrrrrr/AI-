import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Download,
  Info,
  ListChecks,
  Play,
  RefreshCw,
  Upload,
  X
} from "lucide-react";
import { extractDocxFile, formatDate, readImageFile, requestJson } from "../../api.js";

const batchTemplateHeaders = [
  "任务编号",
  "提示词包文件名",
  "商品图片文件名",
  "商品名称",
  "类别",
  "商品补充信息",
  "视频时长",
  "画幅",
  "视频生成方式",
  "是否自动提交视频"
];
const batchTemplateRows = [
  ["男装-001", "男装-001.docx", "男装-001.png", "通勤男装短袖", "男装", "主推通勤穿搭，突出面料、版型、上身效果", 15, "9:16", "先验证", "是"],
  ["女装-001", "女装-001.docx", "女装-001.jpg", "夏季连衣裙", "女装", "突出清爽、显瘦、日常出街场景", 15, "9:16", "先验证", "是"]
];

function defaultBatchName() {
  return `批量生成 ${new Date().toLocaleString("zh-CN", { hour12: false })}`;
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

function statusBadgeText(value) {
  const text = displayCleanText(value, "");
  const lower = text.toLowerCase();
  if (!text) return "-";
  if (["succeeded", "completed", "success", "prompt_ready", "video_ready"].includes(lower)) return "已完成";
  if (["failed", "error"].includes(lower)) return "失败";
  if (["cancelled", "canceled"].includes(lower)) return "已取消";
  if (["queued", "draft", "retrying"].includes(lower)) return "等待中";
  if (["running", "image_analysis", "prompt_generating", "submitting_libtv", "video_generating", "processing"].includes(lower)) return "生成中";
  if (lower === "paused") return "已暂停";
  if (lower === "compliance_required") return "需要处理";
  return text;
}

function StatusBadge({ value, tone }) {
  const text = statusBadgeText(value);
  const kind = tone || (/succeeded|ready|pass|completed|success|video_ready/i.test(text)
    ? "good"
    : /failed|error|blocked|rejected|compliance/i.test(text)
      ? "bad"
      : /running|generating|processing|queued|submitting/i.test(text)
        ? "warn"
        : "muted");
  return <span className={`status-badge ${kind}`}>{text}</span>;
}

function BatchPage({ runtime, modelSettings, batchJobs, batchDetail, focusBatchId = "", loadBatchJobs, loadBatchDetail, addNotification, onBatchFocusHandled, onRefreshAll }) {
  const [batchName, setBatchName] = useState(() => defaultBatchName());
  const [promptFiles, setPromptFiles] = useState([]);
  const [imageFiles, setImageFiles] = useState([]);
  const [csvRows, setCsvRows] = useState([]);
  const [rows, setRows] = useState([]);
  const [matchMode, setMatchMode] = useState("filename");
  const [concurrency, setConcurrency] = useState(2);
  const [generationCount, setGenerationCount] = useState(1);
  const [defaultVideoMode, setDefaultVideoMode] = useState("dry_run");
  const [defaultDuration, setDefaultDuration] = useState(15);
  const [defaultAspectRatio, setDefaultAspectRatio] = useState("9:16");
  const [autoSubmit, setAutoSubmit] = useState(true);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [creating, setCreating] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const activeDetail = batchDetail?.job?.id === selectedBatchId ? batchDetail : null;
  const validatedRows = useMemo(() => validateBatchDraftRows(rows), [rows]);
  const precheck = useMemo(() => summarizeBatchPrecheck(validatedRows), [validatedRows]);
  const precheckIssues = useMemo(() => summarizeBatchIssueGroups(validatedRows), [validatedRows]);
  const [onlyInvalidRows, setOnlyInvalidRows] = useState(false);
  const visibleRows = onlyInvalidRows ? validatedRows.filter((row) => !row.validation.ok) : validatedRows;
  const selectedRows = validatedRows.filter((row) => row.enabled !== false && row.validation.ok);
  const totals = summarizeBatchItems(activeDetail?.items || []);
  useEffect(() => {
    if (!selectedBatchId && batchJobs.length) setSelectedBatchId(batchJobs[0].id);
  }, [batchJobs, selectedBatchId]);

  useEffect(() => {
    if (!focusBatchId) return;
    setSelectedBatchId(focusBatchId);
    onBatchFocusHandled?.();
  }, [focusBatchId]);

  useEffect(() => {
    if (!selectedBatchId) return undefined;
    loadBatchDetail(selectedBatchId).catch(() => {});
    const timer = setInterval(() => {
      loadBatchDetail(selectedBatchId).catch(() => {});
      loadBatchJobs().catch(() => {});
    }, 2500);
    return () => clearInterval(timer);
  }, [selectedBatchId]);

  useEffect(() => {
    let cancelled = false;
    requestJson("/api/batch-draft")
      .then((data) => {
        if (cancelled) return;
        if (data.draft) {
          restoreBatchDraft(data.draft);
          setDraftSavedAt(data.draft.updatedAt || "");
        }
      })
      .catch((error) => {
        addNotification?.({ level: "warn", title: "批量草稿恢复失败", message: error.message, target: "batch" });
      })
      .finally(() => {
        if (!cancelled) setDraftLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draftLoaded) return undefined;
    const hasDraftContent = promptFiles.length || imageFiles.length || csvRows.length || rows.length;
    if (!hasDraftContent) return undefined;
    const timer = setTimeout(() => {
      saveBatchDraft({ silent: true }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [
    draftLoaded,
    batchName,
    promptFiles,
    imageFiles,
    csvRows,
    rows,
    matchMode,
    concurrency,
    generationCount,
    defaultVideoMode,
    defaultDuration,
    defaultAspectRatio,
    autoSubmit,
  ]);

  function restoreBatchDraft(draft) {
    const savedPromptFiles = Array.isArray(draft.promptFiles) ? draft.promptFiles : [];
    const savedImageFiles = Array.isArray(draft.imageFiles) ? draft.imageFiles : [];
    setBatchName(draft.batchName || defaultBatchName());
    setPromptFiles(savedPromptFiles);
    setImageFiles(savedImageFiles);
    setCsvRows(Array.isArray(draft.csvRows) ? draft.csvRows : []);
    setRows(hydrateBatchDraftRows(Array.isArray(draft.rows) ? draft.rows : [], savedPromptFiles, savedImageFiles));
    setMatchMode(draft.matchMode || "filename");
    setConcurrency(Number(draft.concurrency || 2));
    setGenerationCount(Number(draft.generationCount || 1));
    setDefaultVideoMode(draft.defaultVideoMode || "dry_run");
    setDefaultDuration(Number(draft.defaultDuration || 15));
    setDefaultAspectRatio(draft.defaultAspectRatio || "9:16");
    setAutoSubmit(draft.autoSubmit !== false);
    setOnlyInvalidRows(false);
  }

  async function saveBatchDraft({ silent = false } = {}) {
    setDraftSaving(true);
    try {
      const data = await requestJson("/api/batch-draft", {
        method: "POST",
        body: JSON.stringify(buildBatchDraftPayload({
          batchName,
          promptFiles,
          imageFiles,
          csvRows,
          rows,
          matchMode,
          concurrency,
          generationCount,
          defaultVideoMode,
          defaultDuration,
          defaultAspectRatio,
          autoSubmit,
        }))
      });
      setDraftSavedAt(data.draft?.updatedAt || new Date().toISOString());
      if (!silent) {
        addNotification?.({ level: "success", title: "批量草稿已保存", message: "刷新页面后可以继续使用当前上传内容。", target: "batch" });
      }
    } catch (error) {
      if (!silent) {
        addNotification?.({ level: "error", title: "批量草稿保存失败", message: error.message, target: "batch" });
        alert(error.message);
      }
      throw error;
    } finally {
      setDraftSaving(false);
    }
  }

  async function clearBatchDraft() {
    const confirmed = window.confirm("确定清空当前批量上传草稿吗？已上传的提示词包、商品图、表格和待创建任务表都会清空。");
    if (!confirmed) return;
    setBatchName(defaultBatchName());
    setPromptFiles([]);
    setImageFiles([]);
    setCsvRows([]);
    setRows([]);
    setMatchMode("filename");
    setConcurrency(2);
    setGenerationCount(1);
    setDefaultVideoMode("dry_run");
    setDefaultDuration(15);
    setDefaultAspectRatio("9:16");
    setAutoSubmit(true);
    setOnlyInvalidRows(false);
    setDraftSavedAt("");
    await requestJson("/api/batch-draft", { method: "DELETE" });
    addNotification?.({ level: "info", title: "批量草稿已清空", message: "页面刷新后不会再恢复这次上传内容。", target: "batch" });
  }

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
      ["提示词包文件名", "必填", "必须和上传的提示词包文件名一致，支持 .docx/.txt/.md"],
      ["商品图片文件名", "必填", "必须和上传的商品图片文件名一致，建议带后缀 .png/.jpg"],
      ["商品名称", "可选", "不填时会按图片或文件名推断"],
      ["类别", "可选", "不填时会按图片识别"],
      ["商品补充信息", "可选", "填写卖点、人群、禁忌项、风格限制等"],
      ["视频时长", "可选", "建议 3-60 秒，默认 15"],
      ["画幅", "可选", "只支持 9:16、16:9、1:1"],
      ["视频生成方式", "可选", "可填：先验证、真实提交、提交并等待"],
      ["是否自动提交视频", "可选", "可填：是/否，默认跟页面开关一致"]
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
      generationCount,
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

  function rebuildRowsForGenerationCount(nextGenerationCount) {
    const built = buildBatchRows({
      promptFiles,
      imageFiles,
      csvRows,
      matchMode,
      generationCount: nextGenerationCount,
      defaultDuration,
      defaultAspectRatio,
      defaultVideoMode,
      autoSubmit
    });
    setRows(built);
    setOnlyInvalidRows(false);
  }

  function handleGenerationCountChange(event) {
    const next = clampInteger(event.target.value, 1, 50);
    setGenerationCount(next);
    if (promptFiles.length || imageFiles.length || csvRows.length || rows.length) {
      rebuildRowsForGenerationCount(next);
    }
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
    const columns = batchResultExportColumns();
    const lines = [
      columns.map((column) => column.label).join(","),
      ...activeDetail.items.map((item) =>
        columns.map((column) => csvEscape(column.value(item))).join(",")
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
          <p>多个提示词包和多张商品图在这里拆成任务队列，系统会按顺序自动执行，适合每天 300-1000 条的视频批量生产。</p>
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
                <p>如果选择“按文件名一对一”，建议提示词包和图片使用同一个主文件名，例如 A001.docx 对 A001.png，男装01.txt 对 男装01.jpg，也支持 .md。</p>
              </article>
              <article>
                <strong>05</strong>
                <h3>表格字段</h3>
                <p>表头可写：提示词包文件名、商品图片文件名、任务编号、商品名称、类别、商品补充信息、视频时长、画幅、视频生成方式、自动提交。</p>
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
                <p>推荐格式：类别-编号，例如 男装-001.docx、男装-001.png；女装-002.txt、女装-002.jpg；也支持 .md。</p>
              </div>
              <div>
                <h3>表格文件名</h3>
                <p>表格里填写的文件名要和上传文件一致，包含后缀最好，例如 男装-001.docx、男装-001.txt、男装-001.md、男装-001.png。</p>
              </div>
              <div>
                <h3>不填表格也可以</h3>
                <p>不上传 CSV / Excel 时，系统会根据上传的提示词包和商品图自动生成任务，商品名称会优先从文件名推断。</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <MobileBatchCards jobs={batchJobs} selectedBatchId={selectedBatchId} onSelect={setSelectedBatchId} />

      <div className="batch-layout">
        <div className="panel batch-builder">
          <div className="panel-head">
            <div>
              <h2>任务构建</h2>
              <p className="panel-note">第一版支持多提示词包、多商品图、CSV 导入和文件名自动匹配。</p>
            </div>
            <div className="batch-draft-status">
              <span>{draftSaving ? "草稿保存中" : draftSavedAt ? `草稿已保存 ${formatDate(draftSavedAt)}` : draftLoaded ? "暂无草稿" : "正在恢复草稿"}</span>
            </div>
          </div>
          <div className="three-col">
            <label className="field">
              <span>批次名称</span>
              <input value={batchName} onChange={(event) => setBatchName(event.target.value)} />
            </label>
            <label className="field">
              <span>每组生成条数</span>
              <input type="number" min="1" max="50" value={generationCount} onChange={handleGenerationCountChange} />
            </label>
            <label className="field">
              <span>并发数</span>
              <input type="number" min="1" max={runtime?.batchMaxWorkers || 30} value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value || 1))} />
            </label>
          </div>
          <div className="batch-upload-grid">
            <label className="field upload-box">
              <span>提示词包，可多选文档</span>
              <input className="file-input-native" type="file" multiple onChange={(event) => handlePromptFiles(event.target.files)} />
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
              <input type="number" min="4" max="15" value={defaultDuration} onChange={(event) => setDefaultDuration(Number(event.target.value || 15))} />
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
              <span>视频生成方式</span>
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
              <span>生成最终提示词后自动提交视频</span>
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
              <button className="secondary-button" type="button" onClick={() => saveBatchDraft({ silent: false })} disabled={draftSaving}>
                <span>{draftSaving ? "保存中" : "保存草稿"}</span>
              </button>
              <button className="secondary-button danger-light" type="button" onClick={clearBatchDraft}>清空草稿</button>
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
                <strong>{displayBatchName(job)}</strong>
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
            <button className="ghost-button" type="button" onClick={() => toggleAllRows(true)}>全选</button>
            <button className="ghost-button" type="button" onClick={() => toggleAllRows(false)}>全不选</button>
          </div>
        </div>
        {rows.length ? (
          <div className={`batch-precheck-panel ${precheck.error ? "has-error" : precheck.warn ? "has-warn" : "is-ok"}`}>
            <div className="batch-precheck-top">
              <div>
                <strong>导入预检</strong>
                <p>{precheck.error ? "发现阻断问题，异常行不会进入批量创建。" : precheck.warn ? "基础校验已通过，但仍有需要人工确认的提醒项。" : "文件匹配和基础参数正常，可以创建批量任务。"}</p>
              </div>
              <span className={`precheck-ready-badge ${precheck.error ? "error" : precheck.warn ? "warn" : "ok"}`}>
                {precheck.error ? "需要处理" : precheck.warn ? "可创建，需确认" : "可创建"}
              </span>
            </div>

            <div className="precheck-metrics">
              <div>
                <span>总任务</span>
                <strong>{precheck.total}</strong>
              </div>
              <div>
                <span>已勾选可创建</span>
                <strong>{selectedRows.length}</strong>
              </div>
              <div>
                <span>阻断问题</span>
                <strong>{precheck.error}</strong>
              </div>
              <div>
                <span>提醒确认</span>
                <strong>{precheck.warn}</strong>
              </div>
            </div>

            <div className="precheck-issue-grid">
              <div className="precheck-issue-card">
                <div className="precheck-issue-title">
                  <AlertTriangle size={15} />
                  <span>阻断问题</span>
                </div>
                {precheckIssues.errors.length ? (
                  <ul>
                    {precheckIssues.errors.slice(0, 4).map((item) => <li key={item.message}><span>{item.message}</span><em>{item.count} 行</em></li>)}
                  </ul>
                ) : <p>没有阻断问题。</p>}
              </div>
              <div className="precheck-issue-card">
                <div className="precheck-issue-title">
                  <Info size={15} />
                  <span>提醒项</span>
                </div>
                {precheckIssues.warnings.length ? (
                  <ul>
                    {precheckIssues.warnings.slice(0, 4).map((item) => <li key={item.message}><span>{item.message}</span><em>{item.count} 行</em></li>)}
                  </ul>
                ) : <p>没有提醒项。</p>}
              </div>
            </div>

            <div className="precheck-next-line">
              <span>下一步：先处理阻断问题，再勾选要执行的任务；系统只会创建通过预检且已勾选的行。</span>
              <button className="ghost-button" type="button" onClick={() => setOnlyInvalidRows((value) => !value)}>
                {onlyInvalidRows ? "查看全部任务" : "只看异常行"}
              </button>
            </div>
          </div>
        ) : null}
        <MobileBatchDraftCards rows={visibleRows} hasRows={rows.length > 0} onUpdateRow={updateRow} />
        <div className={`table-wrap batch-draft-table ${visibleRows.length ? "" : "is-empty"}`}>
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
                <tr key={row.id} className={invalid ? "draft-row-error" : row.validation.warnings.length ? "draft-row-warn" : ""}>
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
                  <td className="batch-param-cell">
                    <span>{row.targetDuration}s</span>
                    <span>{row.aspectRatio}</span>
                    <span>{row.videoMode}</span>
                  </td>
                </tr>
              );
              }) : (
                <tr><td className="batch-empty-row-cell" colSpan={9}>{rows.length ? "当前没有异常行。" : "上传提示词包和商品图后，点击“生成任务表”。"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel batch-runtime-panel">
        <div className="panel-head">
          <div>
            <h2>执行状态</h2>
            <p className="panel-note">系统会按当前批次顺序执行任务，页面自动刷新。</p>
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
        <MobileBatchItemCards items={activeDetail?.items || []} />
        <div className="table-wrap batch-result-table">
          <table>
            <thead>
              <tr>
                <th>序号</th>
                <th>状态</th>
                <th>当前步骤</th>
                <th>条目</th>
                <th>商品 / 类别</th>
                <th>进度</th>
                <th>AI 消耗</th>
                <th>视频结果</th>
                <th>处理提示</th>
              </tr>
            </thead>
            <tbody>
              {activeDetail?.items?.length ? activeDetail.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.row_no}</td>
                  <td><StatusBadge value={item.status} /></td>
                  <td>{batchStepLabel(item)}</td>
                  <td>{batchItemNumber(item)}</td>
                  <td>
                    <strong>{displayItemProductName(item)}</strong>
                    <span>{displayItemCategory(item)}</span>
                  </td>
                  <td>
                    <div className="mini-progress"><span style={{ width: `${Number(item.progress || 0)}%` }} /></div>
                    <em>{Number(item.progress || 0)}%</em>
                  </td>
                  <td>{aiUsageLabel(item.token_usage_json)}</td>
                  <td>{batchVideoResultLabel(item)}</td>
                  <td title={batchFriendlyError(item.error_message) || ""}>{batchFriendlyError(item.error_message) || "-"}</td>
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

function MobileBatchDraftCards({ rows = [], hasRows = false, onUpdateRow }) {
  return (
    <div className="mobile-batch-draft-cards" aria-label="手机端待创建任务卡片">
      {rows.length ? rows.map((row) => {
        const invalid = !row.validation.ok;
        const validationLabel = invalid ? "异常" : row.validation.warnings.length ? "提醒" : "通过";
        const issues = [...row.validation.errors, ...row.validation.warnings].slice(0, 3);
        return (
          <article className={invalid ? "mobile-batch-draft-card error" : row.validation.warnings.length ? "mobile-batch-draft-card warn" : "mobile-batch-draft-card"} key={row.id}>
            <div className="mobile-batch-draft-head">
              <label className="mobile-batch-draft-check">
                <input type="checkbox" disabled={invalid} checked={row.enabled !== false && !invalid} onChange={(event) => onUpdateRow(row.id, "enabled", event.target.checked)} />
                <span>{row.taskNo || "未编号"}</span>
              </label>
              <span className={`precheck-badge ${invalid ? "error" : row.validation.warnings.length ? "warn" : "ok"}`}>{validationLabel}</span>
            </div>
            {issues.length ? (
              <ul className="mobile-batch-draft-issues">
                {issues.map((message) => <li key={message}>{message}</li>)}
              </ul>
            ) : null}
            <div className="mobile-batch-draft-files">
              <div>
                <span>提示词包</span>
                <strong title={row.prompt?.name}>{row.prompt?.name || "-"}</strong>
              </div>
              <div>
                <span>商品图</span>
                <strong title={row.image?.name}>{row.image?.name || "-"}</strong>
              </div>
            </div>
            <div className="mobile-batch-draft-fields">
              <label>
                <span>商品名</span>
                <input value={row.productName || ""} onChange={(event) => onUpdateRow(row.id, "productName", event.target.value)} />
              </label>
              <label>
                <span>类别</span>
                <input value={row.productCategory || ""} onChange={(event) => onUpdateRow(row.id, "productCategory", event.target.value)} placeholder="可空" />
              </label>
              <label className="wide">
                <span>补充信息</span>
                <textarea rows={3} value={row.productBrief || ""} onChange={(event) => onUpdateRow(row.id, "productBrief", event.target.value)} />
              </label>
            </div>
            <div className="mobile-batch-draft-params">
              <span>{row.targetDuration}s</span>
              <span>{row.aspectRatio}</span>
              <span>{row.videoMode}</span>
            </div>
          </article>
        );
      }) : <div className="mobile-empty-card">{hasRows ? "当前没有异常行" : "上传提示词包和商品图后，点击“生成任务表”"}</div>}
    </div>
  );
}

function MobileBatchItemCards({ items = [] }) {
  return (
    <div className="mobile-batch-item-cards" aria-label="手机端批量任务明细">
      {items.length ? items.map((item) => {
        const progress = Math.max(0, Math.min(100, Number(item.progress || 0)));
        const friendlyError = batchFriendlyError(item.error_message);
        return (
          <article className="mobile-batch-item-card" key={item.id}>
            <div className="mobile-batch-item-head">
              <div>
                <span>{batchItemNumber(item)}</span>
                <strong>{displayItemProductName(item)}</strong>
                <em>{displayItemCategory(item)}</em>
              </div>
              <StatusBadge value={item.status} />
            </div>
            <div className="mobile-batch-item-progress-head">
              <span>{batchProgressNote(item, progress)}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="mobile-batch-item-progress">
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="mobile-batch-item-meta">
              <div><span>条目</span><strong>{batchItemNumber(item)}</strong></div>
              <div><span>当前步骤</span><strong>{batchStepLabel(item)}</strong></div>
              <div><span>进度</span><strong>{progress}%</strong></div>
              <div><span>生成方式</span><strong>{batchModeLabel(item.video_mode || item.videoMode)}</strong></div>
            </div>
            <div className="mobile-batch-item-foot">
              <div>
                <span>视频结果</span>
                <strong>{batchVideoResultLabel(item)}</strong>
              </div>
              {friendlyError ? (
                <p title={friendlyError}>{friendlyError}</p>
              ) : null}
            </div>
          </article>
        );
      }) : <div className="mobile-empty-card">选择或创建一个批次后查看执行状态</div>}
    </div>
  );
}

function MobileBatchCards({ jobs = [], selectedBatchId, onSelect }) {
  return (
    <section className="mobile-batch-cards" aria-label="手机端批次卡片">
      <div className="mobile-batch-cards-head">
        <div>
          <span>批次状态</span>
          <strong>{jobs.length ? `${jobs.length} 个批次` : "暂无批次"}</strong>
        </div>
        <em>点选查看执行明细</em>
      </div>
      <div className="mobile-batch-card-list">
        {jobs.length ? jobs.map((job) => {
          const metrics = summarizeBatchJob(job);
          const isActive = selectedBatchId === job.id;
          return (
            <button
              type="button"
              className={isActive ? "mobile-batch-card active" : "mobile-batch-card"}
              key={job.id}
              onClick={() => onSelect(job.id)}
              aria-current={isActive ? "true" : undefined}
            >
              <div className="mobile-batch-card-top">
                <div>
                  <strong>{displayBatchName(job)}</strong>
                  <span>{formatDate(job.updated_at || job.created_at) || "暂无更新时间"}</span>
                </div>
                <StatusBadge value={job.status} />
              </div>
              <div className="mobile-batch-progress" aria-label={`批次进度 ${metrics.percent}%`}>
                <span style={{ width: `${metrics.percent}%` }} />
              </div>
              <div className="mobile-batch-card-metrics">
                <div><span>总数</span><strong>{metrics.total}</strong></div>
                <div><span>成功</span><strong>{metrics.success}</strong></div>
                <div><span>运行</span><strong>{metrics.running}</strong></div>
                <div><span>失败</span><strong>{metrics.failed}</strong></div>
                <div><span>排队</span><strong>{metrics.pending}</strong></div>
                <div><span>完成率</span><strong>{metrics.percent}%</strong></div>
              </div>
            </button>
          );
        }) : <div className="mobile-empty-card">创建批量任务后会在这里显示状态</div>}
      </div>
    </section>
  );
}

function buildBatchRows({ promptFiles, imageFiles, csvRows, matchMode, generationCount = 1, defaultDuration, defaultAspectRatio, defaultVideoMode, autoSubmit }) {
  const rows = [];
  const repeatCount = clampInteger(generationCount, 1, 50);
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
        videoMode: normalizeBatchVideoMode(pickCsvValue(item, ["视频生成方式", "libTV模式", "libTV 模式", "videoMode"])) || defaultVideoMode,
        autoSubmit: csvBool(pickCsvValue(item, ["是否自动提交视频", "是否自动提交libTV", "自动提交", "autoSubmit"]), autoSubmit)
      }));
    });
    return expandBatchRowsForGenerationCount(rows, repeatCount);
  }

  if (matchMode === "cross_join") {
    promptFiles.forEach((prompt) => {
      imageFiles.forEach((image) => {
        rows.push(makeBatchDraftRow({ index: rows.length, prompt, image, targetDuration: defaultDuration, aspectRatio: defaultAspectRatio, videoMode: defaultVideoMode, autoSubmit }));
      });
    });
    return expandBatchRowsForGenerationCount(rows, repeatCount);
  }

  if (matchMode === "one_prompt_all_images") {
    const prompt = promptFiles[0];
    imageFiles.forEach((image, index) => {
      rows.push(makeBatchDraftRow({ index, prompt, image, targetDuration: defaultDuration, aspectRatio: defaultAspectRatio, videoMode: defaultVideoMode, autoSubmit }));
    });
    return expandBatchRowsForGenerationCount(rows, repeatCount);
  }

  const max = Math.max(promptFiles.length, imageFiles.length);
  for (let index = 0; index < max; index += 1) {
    const image = imageFiles[index];
    const prompt = findIndexedFile(promptByName, image?.name) || promptFiles[index] || promptFiles[0];
    rows.push(makeBatchDraftRow({ index, prompt, image, targetDuration: defaultDuration, aspectRatio: defaultAspectRatio, videoMode: defaultVideoMode, autoSubmit }));
  }
  return expandBatchRowsForGenerationCount(rows, repeatCount);
}

function clampInteger(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function expandBatchRowsForGenerationCount(baseRows = [], generationCount = 1) {
  const repeatCount = clampInteger(generationCount, 1, 50);
  if (repeatCount <= 1) return baseRows;
  const expanded = [];
  baseRows.forEach((row) => {
    for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
      expanded.push(makeBatchDraftRow({
        index: expanded.length,
        prompt: row.prompt,
        image: row.image,
        requestedPromptFileName: row.requestedPromptFileName,
        requestedImageFileName: row.requestedImageFileName,
        taskNo: buildRepeatedTaskNo(row.taskNo, repeatIndex, repeatCount, expanded.length),
        productName: row.productName,
        productCategory: row.productCategory,
        productBrief: row.productBrief,
        targetDuration: row.targetDuration,
        aspectRatio: row.aspectRatio,
        videoMode: row.videoMode,
        autoSubmit: row.autoSubmit
      }));
    }
  });
  return expanded;
}

function buildRepeatedTaskNo(taskNo, repeatIndex, repeatCount, fallbackIndex) {
  const base = String(taskNo || String(fallbackIndex + 1).padStart(3, "0")).trim();
  if (repeatCount <= 1) return base;
  return `${base}-${String(repeatIndex + 1).padStart(2, "0")}`;
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
    if (!Number.isFinite(duration) || duration < 4 || duration > 15) errors.push("视频时长需为 4-15 秒");
    if (!["9:16", "16:9", "1:1"].includes(aspectRatio)) errors.push("画幅只支持 9:16、16:9、1:1");
    if (!["dry_run", "submit", "run"].includes(videoMode)) errors.push("视频生成方式不合法");

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

function buildBatchDraftPayload({
  batchName,
  promptFiles,
  imageFiles,
  csvRows,
  rows,
  matchMode,
  concurrency,
  generationCount,
  defaultVideoMode,
  defaultDuration,
  defaultAspectRatio,
  autoSubmit
}) {
  return {
    batchName,
    promptFiles: (promptFiles || []).map((file) => ({
      id: file.id,
      name: file.name,
      text: file.text || ""
    })),
    imageFiles: (imageFiles || []).map((file) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: file.dataUrl
    })),
    csvRows: Array.isArray(csvRows) ? csvRows : [],
    rows: serializeBatchDraftRows(rows),
    matchMode,
    concurrency,
    generationCount,
    defaultVideoMode,
    defaultDuration,
    defaultAspectRatio,
    autoSubmit
  };
}

function serializeBatchDraftRows(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    enabled: row.enabled,
    taskNo: row.taskNo,
    promptFileName: row.prompt?.name || row.promptFileName || "",
    imageFileName: row.image?.name || row.imageFileName || "",
    requestedPromptFileName: row.requestedPromptFileName || "",
    requestedImageFileName: row.requestedImageFileName || "",
    productName: row.productName || "",
    productCategory: row.productCategory || "",
    productBrief: row.productBrief || "",
    targetDuration: row.targetDuration,
    aspectRatio: row.aspectRatio,
    videoMode: row.videoMode,
    autoSubmit: row.autoSubmit
  }));
}

function hydrateBatchDraftRows(rows = [], promptFiles = [], imageFiles = []) {
  const promptByName = indexFiles(promptFiles);
  const imageByName = indexFiles(imageFiles);
  return rows.map((row, index) => makeBatchDraftRow({
    index,
    prompt: findIndexedFile(promptByName, row.promptFileName),
    image: findIndexedFile(imageByName, row.imageFileName),
    requestedPromptFileName: row.requestedPromptFileName || row.promptFileName || "",
    requestedImageFileName: row.requestedImageFileName || row.imageFileName || "",
    taskNo: row.taskNo,
    productName: row.productName,
    productCategory: row.productCategory,
    productBrief: row.productBrief,
    targetDuration: row.targetDuration,
    aspectRatio: row.aspectRatio,
    videoMode: row.videoMode,
    autoSubmit: row.autoSubmit
  })).map((row, index) => ({
    ...row,
    id: rows[index]?.id || row.id,
    enabled: rows[index]?.enabled !== false
  }));
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

function summarizeBatchIssueGroups(rows = []) {
  const errors = new Map();
  const warnings = new Map();
  rows.forEach((row) => {
    (row.validation?.errors || []).forEach((message) => {
      errors.set(message, (errors.get(message) || 0) + 1);
    });
    (row.validation?.warnings || []).forEach((message) => {
      warnings.set(message, (warnings.get(message) || 0) + 1);
    });
  });
  return {
    errors: issueMapToList(errors),
    warnings: issueMapToList(warnings)
  };
}

function issueMapToList(map) {
  return Array.from(map.entries())
    .map(([message, count]) => ({ message, count }))
    .sort((a, b) => b.count - a.count || a.message.localeCompare(b.message, "zh-CN"));
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

function summarizeBatchJob(job = {}) {
  const total = Number(job.total_count || 0);
  const pending = Number(job.pending_count || 0);
  const running = Number(job.running_count || 0);
  const success = Number(job.success_count || 0);
  const failed = Number(job.failed_count || 0);
  const cancelled = Number(job.cancelled_count || 0);
  const done = success + failed + cancelled;
  return {
    total,
    pending,
    running,
    success,
    failed,
    cancelled,
    percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0
  };
}

function tokenTotal(value) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed.totalTokens || parsed.total?.totalTokens || parsed.total?.total?.totalTokens || 0;
  } catch {
    return 0;
  }
}

function aiUsageLabel(value) {
  const total = tokenTotal(value);
  if (!total) return "-";
  if (total < 2000) return "少量";
  if (total < 8000) return "中等";
  return "较多";
}

function displayBatchName(job) {
  const fallback = `批量生成 ${formatDate(job?.created_at) || ""}`.trim();
  return displayCleanText(job?.name, fallback || "未命名批次");
}

function displayItemProductName(item) {
  return displayCleanText(item?.product_name, item?.task_no || "-");
}

function displayItemCategory(item) {
  return displayCleanText(item?.suggested_category, displayCleanText(item?.product_category, "-"));
}

function batchModeLabel(value) {
  const mode = String(value || "").toLowerCase();
  if (mode === "dry_run") return "先验证";
  if (mode === "submit") return "提交视频";
  if (mode === "run") return "提交并等待";
  return "按批次设置";
}

function batchStepLabel(item = {}) {
  const text = String(item.current_step || item.status || "").toLowerCase();
  if (/image|识别/.test(text)) return "识别商品图";
  if (/prompt|提示词/.test(text)) return "生成提示词";
  if (/submitting|提交/.test(text)) return "提交视频";
  if (/video|生成/.test(text)) return "生成视频";
  if (/queued|draft|retrying|等待|排队/.test(text)) return "等待开始";
  if (/succeeded|ready|completed|完成|成功/.test(text)) return "已完成";
  if (/failed|error|失败/.test(text)) return "需要处理";
  if (/cancel/.test(text)) return "已取消";
  return "等待开始";
}

function batchItemNumber(item = {}) {
  if (item.row_no) return `第 ${item.row_no} 条`;
  if (item.task_no) return `任务 ${item.task_no}`;
  return "任务记录";
}

function batchProgressNote(item = {}, progress = 0) {
  const status = String(item.status || "").toLowerCase();
  if (item.video_url) return "视频已生成";
  if (status === "failed") return "需要处理失败原因";
  if (status === "cancelled") return "任务已取消";
  if (["queued", "draft", "retrying"].includes(status)) return "等待系统处理";
  if (progress > 0 && progress < 100) return "正在生成，请稍等";
  if (progress >= 100) return "等待结果入库";
  return "准备中";
}

function batchFriendlyError(message) {
  const text = String(message || "").trim();
  if (!text) return "";
  if (/libtv|bridge|seedance|autoCompliance|真人|角色库|合规/i.test(text)) {
    return "视频平台校验未通过：请检查参考图是否合规，再重新生成。";
  }
  if (isLikelyBrokenText(text) || isLikelyGarbledText(text)) return "失败原因显示异常，请在电脑端查看详情。";
  return text;
}

function batchVideoResultText(item = {}) {
  if (item.video_url) return item.video_url;
  const mode = String(item.video_mode || item.videoMode || "").toLowerCase();
  const status = String(item.status || "").toLowerCase();
  if (mode === "dry_run" && ["succeeded", "prompt_ready"].includes(status)) return "先验证完成";
  if (item.final_prompt) return "已生成提示词";
  return "-";
}

function batchVideoResultLabel(item = {}) {
  if (item.video_url) {
    return <a href={item.video_url} target="_blank" rel="noreferrer">查看视频</a>;
  }
  const mode = String(item.video_mode || item.videoMode || "").toLowerCase();
  const status = String(item.status || "").toLowerCase();
  if (mode === "dry_run" && ["succeeded", "prompt_ready"].includes(status)) {
    return <span title="当前视频生成方式为先验证，不会生成真实视频链接。">先验证完成</span>;
  }
  if (item.final_prompt) return "有提示词";
  return "-";
}

function displayCleanText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  if (!text || isLikelyBrokenText(text) || isLikelyGarbledText(text)) return fallback;
  return text;
}

function isLikelyGarbledText(value) {
  const text = String(value || "");
  if (!text) return false;
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCount >= 2) return true;
  return /(鐢熸垚|妗ユ帴|涓€|绂佹|鏃犵|鎴愬姛|澶辫触|鍙傝€)/.test(text);
}

function isLikelyBrokenText(value) {
  const compact = String(value || "").replace(/\s/g, "");
  if (!compact) return true;
  const brokenMarks = (compact.match(/[?？�]/g) || []).length;
  if (/^[?？�]+$/.test(compact)) return true;
  return brokenMarks >= 2 && brokenMarks / compact.length > 0.35;
}

function batchActionTitle(action) {
  if (action === "start") return "批量任务已启动";
  if (action === "pause") return "批量任务已暂停";
  if (action === "cancel") return "批量任务已取消";
  return "失败任务已重试";
}

function batchResultExportColumns() {
  return [
    { label: "条目", value: (item) => batchItemNumber(item) },
    { label: "状态", value: (item) => statusBadgeText(item.status) },
    { label: "当前步骤", value: (item) => batchStepLabel(item) },
    { label: "商品名称", value: (item) => displayItemProductName(item) },
    { label: "类别", value: (item) => displayItemCategory(item) },
    { label: "进度", value: (item) => `${Math.max(0, Math.min(100, Number(item.progress || 0)))}%` },
    { label: "AI 消耗", value: (item) => aiUsageLabel(item.token_usage_json) },
    { label: "视频结果", value: (item) => batchVideoResultText(item) },
    { label: "处理提示", value: (item) => batchFriendlyError(item.error_message) },
    { label: "开始时间", value: (item) => formatDate(item.started_at) || "" },
    { label: "完成时间", value: (item) => formatDate(item.finished_at) || "" }
  ];
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default BatchPage;
