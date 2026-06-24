import React from "react";
import { Copy, Download, FolderOpen, Image, RefreshCw, Sparkles, Video } from "lucide-react";
import { formatBytes, formatDate } from "../../api.js";

function isRenderableSource(value) {
  return /^(https?:\/\/|\/|data:|blob:)/i.test(String(value || ""));
}

function isImageAsset(row = {}, source = "") {
  const text = `${row.asset_type || ""} ${row.format || ""} ${source || ""}`;
  return /image|图片|png|jpe?g|webp|gif|avif/i.test(text);
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

function displayCleanText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  if (!text || isLikelyBrokenText(text) || isLikelyGarbledText(text)) return fallback;
  return text;
}

function safeDisplayName(value = "", fallback = "未命名素材") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const normalized = text.replace(/\\/g, "/");
  return displayCleanText(normalized.split("/").filter(Boolean).pop(), fallback);
}

function assetDownloadUrl(row = {}) {
  return row.download_url || row.file_url || "";
}

function downloadStateLabel(value) {
  return value ? "可下载" : "等待生成";
}

function downloadActionLabel(downloadNotice, name) {
  return downloadNotice?.name === name ? "保存中" : "下载";
}

function assetKindLabel(value = "") {
  const text = String(value || "").toLowerCase();
  if (/prompt|提示词/.test(text)) return "提示词包";
  if (/product|商品/.test(text)) return "商品图";
  if (/source|generated|image|图片/.test(text)) return "图片素材";
  if (/video|视频/.test(text)) return "视频素材";
  if (/output|result|结果/.test(text)) return "生成结果";
  return "素材";
}

function assetMetaLabel(items = []) {
  return items.filter((item) => item && item !== "-").join(" / ") || "素材信息";
}

function mobileVideoOutputLabel(index = 0) {
  return `视频成片 ${String(index + 1).padStart(2, "0")}`;
}

function buildMobileAssetNextStep({ rows = [], outputFiles = [], sourceLinks = [] } = {}) {
  const hasVideo = outputFiles.some((file) => file.url);
  const hasAssets = rows.length > 0 || sourceLinks.length > 0;
  if (hasVideo) {
    return {
      label: "下载后下一步",
      title: "先保存成片，再继续处理",
      detail: "可以发给运营预览，也可以去视频拼接做合集，或回创作页继续生成变体。",
      actions: [
        { label: "去拼接", href: "#/stitch" },
        { label: "再生成", href: "#/studio" },
        { label: "做封面", href: "#/textImage" }
      ]
    };
  }
  if (hasAssets) {
    return {
      label: "素材已准备",
      title: "下一步去生成视频",
      detail: "素材和图片已经在这里，回到创作页生成最终提示词和视频。",
      actions: [
        { label: "去生成", href: "#/studio" },
        { label: "补封面", href: "#/textImage" }
      ]
    };
  }
  return {
    label: "还没有素材",
    title: "先从模板或文生图开始",
    detail: "上传商品图、套用模板或生成封面图后，这里会出现可下载素材。",
    actions: [
      { label: "去创作", href: "#/inspiration" },
      { label: "文生图", href: "#/textImage" }
    ]
  };
}

function buildMobileResultPackage({ rows = [], outputFiles = [], sourceLinks = [] } = {}) {
  const downloadableSources = sourceLinks.filter((link) => link.sourceUrl);
  const downloadableAssets = rows.filter((row) => assetDownloadUrl(row));
  const downloadableVideos = outputFiles.filter((file) => file.url);
  const firstVideo = downloadableVideos[0];
  const firstAsset = downloadableAssets[0];
  const firstSource = downloadableSources[0];
  const totalReady = downloadableSources.length + downloadableAssets.length + downloadableVideos.length;
  const actions = [];
  if (firstVideo) {
    actions.push({
      id: "video",
      label: "保存视频",
      href: firstVideo.url,
      download: safeDisplayName(firstVideo.name || firstVideo.url, "视频输出")
    });
  }
  if (firstAsset) {
    const href = assetDownloadUrl(firstAsset);
    actions.push({
      id: "asset",
      label: "保存素材",
      href,
      download: safeDisplayName(firstAsset.file_name || href, firstAsset.asset_type || "素材")
    });
  }
  if (firstSource) {
    actions.push({
      id: "source",
      label: "保存图片",
      href: firstSource.sourceUrl,
      download: safeDisplayName(firstSource.imageName || firstSource.sourceUrl, "文生图来源图片")
    });
  }
  return {
    ready: totalReady > 0,
    title: totalReady > 0 ? "结果包已准备" : "结果包还在等待",
    detail: totalReady > 0
      ? "优先保存视频和关键素材；其他记录可在下面分组继续下载。"
      : "生成完成后，这里会自动出现可保存的视频、图片和素材。",
    counts: [
      { label: "视频", value: downloadableVideos.length },
      { label: "素材", value: downloadableAssets.length },
      { label: "图片", value: downloadableSources.length }
    ],
    actions
  };
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!ok) throw new Error("当前浏览器不允许写入剪贴板。");
}

export default function AssetsPage({ tasks, taskCode, setTaskCode, onTaskCodeChange, data, onRefresh, addNotification }) {
  const assetRows = data.rows || [];
  const outputFiles = data.outputFiles || [];
  const sourceLinks = data.sourceLinks || [];
  const sourceLinkError = data.sourceLinkError || "";
  const [downloadNotice, setDownloadNotice] = React.useState(null);
  const [downloadSheet, setDownloadSheet] = React.useState(null);

  React.useEffect(() => {
    if (!downloadNotice) return undefined;
    const timer = window.setTimeout(() => setDownloadNotice(null), 5200);
    return () => window.clearTimeout(timer);
  }, [downloadNotice]);

  function handleTaskFilterChange(event) {
    const nextTaskCode = event.target.value;
    if (onTaskCodeChange) {
      onTaskCodeChange(nextTaskCode);
      return;
    }
    setTaskCode(nextTaskCode);
  }

  async function copyAssetText(value, label = "素材下载链接") {
    const text = String(value || "").trim();
    if (!text) {
      addNotification?.({ level: "warn", title: "没有可复制内容", message: `${label}为空。`, target: "assets" });
      return;
    }
    try {
      await copyTextToClipboard(text);
      addNotification?.({ level: "success", title: "已复制", message: label, target: "assets" });
    } catch (error) {
      addNotification?.({ level: "error", title: "复制失败", message: error.message, target: "assets" });
    }
  }

  function handleDownloadStart(name = "素材", options = {}) {
    const safeName = safeDisplayName(name, "素材");
    const isPhone = window.matchMedia?.("(max-width: 900px)").matches;
    if (isPhone && options.href) {
      options.event?.preventDefault?.();
      setDownloadSheet({
        name: safeName,
        href: options.href,
        download: options.download || safeName
      });
      setDownloadNotice({ name: safeName, at: Date.now() });
      addNotification?.({
        level: "info",
        title: "准备保存",
        message: "已停留在素材页，确认后再打开系统下载。",
        target: "assets"
      });
      return;
    }
    setDownloadNotice({ name: safeName, at: Date.now() });
    addNotification?.({
      level: "success",
      title: "已开始保存",
      message: `${safeName} 已交给浏览器下载。`,
      target: "assets"
    });
  }

  return (
    <section className="panel assets-panel">
      <div className="panel-head">
        <div>
          <h2>素材与输出</h2>
          <p className="panel-note">查看提示词、商品图、本地视频和拼接产出。</p>
        </div>
        <div className="button-row assets-actions">
          <select className="assets-select" value={taskCode} onChange={handleTaskFilterChange}>
            <option value="">全部任务</option>
            {tasks.map((task) => <option value={task["任务编号"]} key={task["任务编号"]}>{task["任务编号"]}</option>)}
          </select>
          <button className="secondary-button assets-refresh" onClick={onRefresh}><RefreshCw size={16} /><span>刷新</span></button>
        </div>
      </div>
      <MobileAssetCards
        rows={assetRows}
        outputFiles={outputFiles}
        sourceLinks={sourceLinks}
        sourceLinkError={sourceLinkError}
        onCopy={copyAssetText}
        onDownload={handleDownloadStart}
        downloadSheet={downloadSheet}
        onDownloadSheetClose={() => setDownloadSheet(null)}
        downloadNotice={downloadNotice}
      />
      <TaskSourceLinksPanel sourceLinks={sourceLinks} sourceLinkError={sourceLinkError} taskCode={taskCode} onCopy={copyAssetText} />
      <div className="table-wrap assets-table">
        <table>
          <thead>
            <tr>
              <th>任务编号</th>
              <th>类型</th>
              <th>格式</th>
              <th>大小</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {assetRows.map((row, index) => {
              const downloadUrl = assetDownloadUrl(row);
              return (
                <tr key={`${row.file_name || row.asset_type}-${index}`}>
                  <td>{row.task_code || "-"}</td>
                  <td>{displayCleanText(row.asset_type, "素材")}</td>
                  <td>{displayCleanText(row.format)}</td>
                  <td>{formatBytes(row.size_bytes)}</td>
                  <td>
                    {downloadUrl ? (
                      <a className="asset-download-link" href={downloadUrl} download={row.file_name || true} onClick={(event) => handleDownloadStart(row.file_name || downloadUrl, { event, href: downloadUrl, download: row.file_name || true })}>
                        <Download size={15} />
                        <span>下载</span>
                      </a>
                    ) : (
                      <span className="asset-muted">暂无下载</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3 className="subhead desktop-output-subhead">本地视频输出</h3>
      <div className="table-wrap assets-table output-files-table">
        <table>
          <thead>
            <tr>
              <th>文件名</th>
              <th>大小</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {outputFiles.map((file) => (
              <tr key={file.url || file.name}>
                <td>{displayCleanText(file.name, "视频输出")}</td>
                <td>{formatBytes(file.size)}</td>
                <td>{formatDate(file.updatedAt)}</td>
                <td>
                  {file.url ? (
                    <a className="asset-download-link" href={file.url} download={file.name || true} onClick={(event) => handleDownloadStart(file.name || file.url, { event, href: file.url, download: file.name || true })}>
                      <Download size={15} />
                      <span>下载</span>
                    </a>
                  ) : (
                    <span className="asset-muted">暂无下载</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TaskSourceLinksPanel({ sourceLinks = [], sourceLinkError = "", taskCode = "", onCopy }) {
  return (
    <section className="task-source-links-panel" aria-label="AI 图片来源记录">
      <div className="task-source-links-head">
        <div>
          <h3>AI 图片来源</h3>
          <p>{taskCode ? "当前任务使用过的文生图节点。" : "最近视频任务使用过的文生图节点。"}</p>
        </div>
        <span>{sourceLinks.length} 条</span>
      </div>
      {sourceLinkError ? (
        <div className="task-source-links-error">{sourceLinkError}</div>
      ) : null}
      {sourceLinks.length ? (
        <div className="task-source-links-grid">
          {sourceLinks.map((link, index) => {
            const nodeId = link.textImageCanvasNodeId || link.sourceId || "";
            const copyTarget = nodeId || link.sourceUrl || link.taskCode || "";
            return (
              <article className="task-source-link-card" key={link.id || `${link.taskCode}-${nodeId}-${index}`}>
                <div className="task-source-link-icon">
                  <Sparkles size={18} />
                </div>
                <div className="task-source-link-copy">
                  <strong>{link.imageName || nodeId || "文生图节点"}</strong>
                  <span>{displayCleanText(link.taskCode, "未绑定任务")} / {displayCleanText(link.textImageModel, "模型未记录")} / {displayCleanText(link.textImageSize, "尺寸未记录")}</span>
                  <p title={displayCleanText(link.textImagePromptPreview, "暂无提示词摘要")}>{displayCleanText(link.textImagePromptPreview, "暂无提示词摘要")}</p>
                  <small>{nodeId ? `节点：${nodeId}` : "节点 ID 未记录"}{link.textImageLinkedAt ? ` / 送入：${formatDate(link.textImageLinkedAt)}` : ""}</small>
                </div>
                <div className="task-source-link-actions">
                  {copyTarget ? (
                    <button type="button" className="icon-button" onClick={() => onCopy?.(copyTarget, "文生图来源")} title="复制来源">
                      <Copy size={15} />
                    </button>
                  ) : null}
                  {link.sourceUrl ? (
                    <a className="icon-button" href={link.sourceUrl} target="_blank" rel="noreferrer" title="打开图片">
                      <Download size={15} />
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="task-source-links-empty">暂无文生图来源记录。</div>
      )}
    </section>
  );
}

function MobileEmptyAssetCard({ icon: Icon = FolderOpen, title, detail, actionLabel, href = "", steps = [] }) {
  return (
    <div className="mobile-empty-card mobile-empty-card-action">
      <span className="mobile-empty-icon">
        <Icon size={18} />
      </span>
      <strong>{title}</strong>
      <small>{detail}</small>
      {steps.length ? (
        <div className="mobile-empty-next-steps" aria-label="空状态下一步">
          {steps.map((step, index) => (
            <span key={step}>
              <em>{index + 1}</em>
              <small>{step}</small>
            </span>
          ))}
        </div>
      ) : null}
      {href && actionLabel ? <a href={href}>{actionLabel}</a> : null}
    </div>
  );
}

function MobileAssetNextStepCard({ nextStep }) {
  if (!nextStep) return null;
  return (
    <section className="mobile-asset-next-step" aria-label="素材下载后下一步">
      <div>
        <span>{nextStep.label}</span>
        <strong>{nextStep.title}</strong>
        <p>{nextStep.detail}</p>
      </div>
      <div className="mobile-asset-next-actions">
        {nextStep.actions.map((action) => (
          <a href={action.href} key={action.href}>
            <Sparkles size={15} />
            <span>{action.label}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

function MobileDownloadFeedback({ notice }) {
  if (!notice) return null;
  return (
    <section className="mobile-download-feedback" aria-live="polite" aria-label="下载反馈">
      <Download size={16} />
      <div>
        <strong>已开始保存</strong>
        <span>{notice.name} 已交给浏览器下载；如果没有弹出，请查看手机浏览器下载记录。</span>
      </div>
    </section>
  );
}

function MobileDownloadSheet({ sheet, onClose, onCopy, onDownload }) {
  if (!sheet?.href) return null;
  return (
    <section className="mobile-download-sheet-backdrop" aria-label="下载确认">
      <div className="mobile-download-sheet">
        <div className="mobile-download-sheet-head">
          <Download size={18} />
          <div>
            <span>准备保存</span>
            <strong>{sheet.name}</strong>
          </div>
        </div>
        <p>为了避免跳到系统文件预览后找不到返回，这里先停在素材页。你可以复制链接，或确认后继续打开下载。</p>
        <div className="mobile-download-sheet-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            返回素材页
          </button>
          <button type="button" className="secondary-button" onClick={() => onCopy?.(sheet.href, `${sheet.name} 下载链接`)}>
            <Copy size={15} />
            <span>复制链接</span>
          </button>
          <a
            className="primary-button"
            href={sheet.href}
            download={sheet.download || true}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              onDownload?.(sheet.name);
              window.setTimeout(() => onClose?.(), 600);
            }}
          >
            <Download size={15} />
            <span>继续下载</span>
          </a>
        </div>
      </div>
    </section>
  );
}

function MobileResultPackageCard({ resultPackage, onDownload, downloadNotice }) {
  if (!resultPackage) return null;
  return (
    <section className={`mobile-result-package ${resultPackage.ready ? "ready" : "pending"}`} aria-label="可保存结果包">
      <div className="mobile-result-package-head">
        <span>{resultPackage.ready ? "可保存结果" : "等待结果"}</span>
        <strong>{resultPackage.title}</strong>
        <p>{resultPackage.detail}</p>
      </div>
      <div className="mobile-result-package-counts" aria-label="结果包数量">
        {resultPackage.counts.map((item) => (
          <span key={item.label}>
            <strong>{item.value}</strong>
            <small>{item.label}</small>
          </span>
        ))}
      </div>
      <div className="mobile-result-package-actions">
        {resultPackage.actions.length ? resultPackage.actions.map((action) => (
          <a href={action.href} download={action.download || true} key={action.id} onClick={(event) => onDownload?.(action.download || action.href, { event, href: action.href, download: action.download || true })}>
            <Download size={15} />
            <span>{downloadActionLabel(downloadNotice, action.download || action.href) === "保存中" ? "保存中" : action.label}</span>
          </a>
        )) : (
          <a href="#/studio">
            <Sparkles size={15} />
            <span>去生成</span>
          </a>
        )}
      </div>
    </section>
  );
}

function MobileVideoTaskBridge({ outputFiles = [] }) {
  const latestVideo = outputFiles.find((file) => file.url) || outputFiles[0];
  const latestIndex = Math.max(0, outputFiles.indexOf(latestVideo));
  const latestName = latestVideo ? mobileVideoOutputLabel(latestIndex) : "";
  const latestTime = latestVideo ? formatDate(latestVideo.updatedAt) : "";
  return (
    <section className="mobile-assets-section mobile-video-task-bridge" aria-label="视频生成任务入口">
      <div className="mobile-assets-section-head">
        <strong>视频生成任务</strong>
        <span>{outputFiles.length} 个成片</span>
      </div>
      <div className="mobile-video-task-bridge-card">
        <div className="mobile-video-task-bridge-main">
          <span className="mobile-video-task-bridge-icon">
            <Video size={18} />
          </span>
          <div>
            <span>视频任务</span>
            <strong>{outputFiles.length ? "打开、下载、看进度" : "生成后看进度"}</strong>
            <p>{outputFiles.length ? "成片在任务页处理。" : "任务完成后会出现成片。"}</p>
          </div>
        </div>
        {latestName ? (
          <div className="mobile-video-task-bridge-latest">
            <span>最近</span>
            <strong>{latestName}</strong>
            <small>{latestTime || "去任务页下载"}</small>
          </div>
        ) : null}
        <a className="mobile-video-task-bridge-action" href="#/libtv">
          <Video size={15} />
          <span>去任务页</span>
        </a>
      </div>
    </section>
  );
}

function MobileAssetCards({ rows = [], outputFiles = [], sourceLinks = [], sourceLinkError = "", onCopy, onDownload, downloadNotice, downloadSheet, onDownloadSheetClose }) {
  const nextStep = buildMobileAssetNextStep({ rows, outputFiles, sourceLinks });
  const resultPackage = buildMobileResultPackage({ rows, outputFiles, sourceLinks });
  const [activeSection, setActiveSection] = React.useState("assets");
  const sections = [
    { id: "assets", label: "素材记录", count: rows.length },
    { id: "images", label: "AI图片", count: sourceLinks.length },
    { id: "tasks", label: "视频任务", count: outputFiles.length }
  ];
  return (
    <div className="mobile-assets-view" aria-label="手机端素材卡片">
      <section className="mobile-assets-helper" aria-label="素材结果说明">
        <div>
          <span>素材结果</span>
          <strong>生成后的图片和视频都在这里</strong>
          <p>点下载保存到手机；点复制可以把链接发给同事。</p>
        </div>
        <div className="mobile-assets-helper-stats" aria-label="素材数量概览">
          <span>
            <strong>{sourceLinks.length}</strong>
            <small>AI 图片</small>
          </span>
          <span>
            <strong>{rows.length}</strong>
            <small>素材</small>
          </span>
          <span>
            <strong>{outputFiles.length}</strong>
            <small>视频</small>
          </span>
        </div>
      </section>
      <MobileDownloadFeedback notice={downloadNotice} />
      <MobileDownloadSheet sheet={downloadSheet} onClose={onDownloadSheetClose} onCopy={onCopy} onDownload={onDownload} />
      <MobileResultPackageCard resultPackage={resultPackage} onDownload={onDownload} downloadNotice={downloadNotice} />
      <MobileAssetNextStepCard nextStep={nextStep} />

      <div className="mobile-assets-segmented" role="tablist" aria-label="素材页分组切换">
        {sections.map((section) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === section.id}
            className={activeSection === section.id ? "active" : ""}
            key={section.id}
            onClick={() => setActiveSection(section.id)}
          >
            <span>{section.label}</span>
            <em>{section.count}</em>
          </button>
        ))}
      </div>

      {activeSection === "images" ? (
      <section className="mobile-assets-section mobile-source-links-section">
        <div className="mobile-assets-section-head">
          <strong>AI 图片来源</strong>
          <span>{sourceLinks.length} 条</span>
        </div>
        {sourceLinkError ? (
          <MobileEmptyAssetCard
            icon={Sparkles}
            title="来源读取失败"
            detail={sourceLinkError}
          />
        ) : null}
        <div className="mobile-asset-card-list">
          {sourceLinks.length ? sourceLinks.map((link, index) => {
            const nodeId = link.textImageCanvasNodeId || link.sourceId || "";
            const copyTarget = link.sourceUrl || "";
            const sourceDisplayName = safeDisplayName(link.imageName || link.sourceUrl || nodeId, "文生图来源图片");
            const readyLabel = downloadStateLabel(link.sourceUrl);
            return (
              <article className="mobile-asset-card mobile-source-link-card" key={link.id || `${link.taskCode}-${nodeId}-${index}`}>
                <div className="mobile-asset-icon">
                  <Sparkles size={18} />
                </div>
                <div className="mobile-asset-copy">
                  <div className="mobile-asset-title-row">
                    <strong title={sourceDisplayName}>{sourceDisplayName}</strong>
                    <span className={link.sourceUrl ? "mobile-asset-status ready" : "mobile-asset-status pending"}>{readyLabel}</span>
                  </div>
                  <span>{assetMetaLabel(["文生图结果", displayCleanText(link.textImageSize, "尺寸未记录")])}</span>
                  <p title={displayCleanText(link.textImagePromptPreview, "暂无提示词摘要")}>{displayCleanText(link.textImagePromptPreview, "暂无提示词摘要")}</p>
                  <small className="mobile-path-hidden">来源位置已隐藏，可直接下载</small>
                </div>
                <div className="mobile-asset-actions">
                  {copyTarget ? (
                    <button type="button" className="mobile-asset-action" onClick={() => onCopy?.(copyTarget, "文生图来源下载链接")} aria-label="复制文生图来源下载链接">
                      <Copy size={16} />
                      <span>复制</span>
                    </button>
                  ) : null}
                  {link.sourceUrl ? (
                    <a className="mobile-asset-open" href={link.sourceUrl} download={sourceDisplayName || true} aria-label={`下载 ${sourceDisplayName}`} onClick={(event) => onDownload?.(sourceDisplayName, { event, href: link.sourceUrl, download: sourceDisplayName || true })}>
                      <Download size={16} />
                      <span>{downloadActionLabel(downloadNotice, sourceDisplayName)}</span>
                    </a>
                  ) : null}
                  {!link.sourceUrl ? <span className="mobile-asset-unavailable">待下载</span> : null}
                </div>
              </article>
            );
          }) : sourceLinkError ? null : (
            <MobileEmptyAssetCard
              icon={Sparkles}
              title="还没有 AI 图片来源"
              detail="先去文生图生成主图或封面，再回来下载。"
              steps={["打开文生图", "输入商品图或封面需求", "生成后回到这里保存图片"]}
              actionLabel="去文生图"
              href="#/textImage"
            />
          )}
        </div>
      </section>
      ) : null}

      {activeSection === "assets" ? (
      <section className="mobile-assets-section">
        <div className="mobile-assets-section-head">
          <strong>素材记录</strong>
          <span>{rows.length} 条</span>
        </div>
        <div className="mobile-asset-card-list">
          {rows.length ? rows.map((row, index) => {
            const downloadUrl = assetDownloadUrl(row);
            const displayName = safeDisplayName(row.file_name || downloadUrl, row.asset_type || "素材");
            const kindLabel = assetKindLabel(displayCleanText(row.asset_type, displayName));
            const readyLabel = downloadStateLabel(downloadUrl);
            const previewSource = row.file_url || downloadUrl;
            const previewUrl = isRenderableSource(previewSource) && isImageAsset(row, displayName) ? previewSource : "";
            return (
              <article className={previewUrl ? "mobile-asset-card has-preview" : "mobile-asset-card"} key={`${displayName}-${index}`}>
                {previewUrl ? (
                  <div className="mobile-asset-preview">
                    <img src={previewUrl} alt={displayCleanText(row.asset_type, "素材预览")} loading="lazy" />
                  </div>
                ) : (
                  <div className="mobile-asset-icon">
                    {isImageAsset(row, displayName) ? <Image size={18} /> : <FolderOpen size={18} />}
                  </div>
                )}
                <div className="mobile-asset-copy">
                  <div className="mobile-asset-title-row">
                    <strong title={displayName}>{kindLabel}</strong>
                    <span className={downloadUrl ? "mobile-asset-status ready" : "mobile-asset-status pending"}>{readyLabel}</span>
                  </div>
                  <span>{assetMetaLabel([displayCleanText(row.format, "未知格式"), formatBytes(row.size_bytes)])}</span>
                  <p title={displayName}>{displayName}</p>
                  <small className="mobile-path-hidden">本机位置已隐藏，可直接下载</small>
                </div>
                <div className="mobile-asset-actions">
                  {downloadUrl ? (
                    <button type="button" className="mobile-asset-action" onClick={() => onCopy?.(downloadUrl, "素材下载链接")} aria-label="复制素材下载链接">
                      <Copy size={16} />
                      <span>复制</span>
                    </button>
                  ) : null}
                  {downloadUrl ? (
                    <a className="mobile-asset-open" href={downloadUrl} download={displayName || true} aria-label={`下载 ${displayName}`} onClick={(event) => onDownload?.(displayName, { event, href: downloadUrl, download: displayName || true })}>
                      <Download size={16} />
                      <span>{downloadActionLabel(downloadNotice, displayName)}</span>
                    </a>
                  ) : null}
                  {!downloadUrl ? <span className="mobile-asset-unavailable">待下载</span> : null}
                </div>
              </article>
            );
          }) : (
            <MobileEmptyAssetCard
              icon={Image}
              title="还没有素材记录"
              detail="先上传商品图或套用模板，生成后这里会出现素材。"
              steps={["去创意页选模板", "上传商品图或封面图", "生成后在这里保存素材"]}
              actionLabel="去创作"
              href="#/inspiration"
            />
          )}
        </div>
      </section>
      ) : null}

      {activeSection === "tasks" ? <MobileVideoTaskBridge outputFiles={outputFiles} /> : null}
    </div>
  );
}
