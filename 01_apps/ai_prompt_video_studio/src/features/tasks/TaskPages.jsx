import React from "react";
import { Clipboard, Download, FolderOpen, RefreshCw, Sparkles, Video } from "lucide-react";
import { formatBytes, formatDate } from "../../api.js";

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

function cleanDisplayMessage(message) {
  const text = String(message || "");
  if (/libtv command failed|autoCompliance=1|Seedance2\.0|合规检测|真人|角色库/i.test(text)) {
    return "视频平台合规校验未通过：参考图可能包含真人形象，请先完成可用人物素材或合规校验后再重试。";
  }
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount >= 8 && questionCount / Math.max(text.length, 1) > 0.2) {
    return "视频生成平台返回的错误信息编码异常，请打开任务详情查看真实失败原因。";
  }
  if (!isLikelyGarbledText(text)) return text;
  if (/libTV|bridge/i.test(text)) {
    return "视频生成平台返回的错误信息编码异常，请打开任务详情查看真实失败原因。";
  }
  return "错误信息编码异常，请刷新后重试或查看任务详情。";
}

function taskDisplayName(row = {}) {
  return displayCleanText(row["最终视频名称"], displayCleanText(row["商品名称"], "未命名任务"));
}

function taskDisplayLabel(_row = {}, index = 0) {
  return `任务 ${index + 1}`;
}

function taskMetaLabel(row = {}) {
  const category = displayCleanText(row["类别"], "未分类");
  const time = formatDate(row["更新时间"] || row["完成时间"]) || "暂无时间";
  return `${category} / ${time}`;
}

function safeOutputDisplayName(value = "", fallback = "视频成片") {
  const text = String(value || "").trim();
  if (!text) return fallback;
  const normalized = text.replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() || fallback;
}

function outputFileExtension(value = "") {
  const match = String(value || "").match(/\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i);
  return match ? `.${match[1].toLowerCase()}` : ".mp4";
}

function mobileVideoOutputLabel(index = 0) {
  return `视频成片 ${String(index + 1).padStart(2, "0")}`;
}

function mobileVideoDownloadName(file = {}, index = 0) {
  return `${mobileVideoOutputLabel(index).replace(/\s+/g, "-")}${outputFileExtension(file.name || file.url)}`;
}

function absoluteUrl(value = "") {
  try {
    return new URL(value, window.location.href).href;
  } catch {
    return String(value || "");
  }
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
  if (!ok) throw new Error("当前浏览器不允许复制链接。");
}

function rawVideoLink(videoUrl = "") {
  const url = String(videoUrl || "").trim();
  return url ? absoluteUrl(url) : "";
}

async function copyVideoLinkToPhone({ videoUrl, addNotification }) {
  const shareUrl = rawVideoLink(videoUrl);
  if (!shareUrl) {
    addNotification?.({
      level: "warn",
      title: "还没有视频链接",
      message: "等视频生成完成后，再复制链接。",
      target: "libtv"
    });
    return false;
  }

  try {
    await copyTextToClipboard(shareUrl);
    addNotification?.({
      level: "success",
      title: "视频链接已复制",
      message: "复制的是原始 mp4 链接，可以发微信，也可以到 Safari 打开保存。",
      target: "libtv"
    });
    return true;
  } catch {
    addNotification?.({
      level: "warn",
      title: "复制失败",
      message: "当前浏览器不允许复制，请先点打开视频，再复制地址。",
      target: "libtv"
    });
    return false;
  }
}

function taskResultLabel(row = {}, errorMessage = "") {
  if (errorMessage) return "需要处理";
  if (row["视频链接"]) return "可打开视频";
  if (row["外部任务ID"]) return "已提交生成";
  return "等待提交";
}

function statusBadgeText(value) {
  const text = displayCleanText(value, "-");
  if (text.toLowerCase() === "compliance_required") return "需合规校验";
  return text;
}

function StatusBadge({ value, tone }) {
  const text = statusBadgeText(value);
  const kind = tone || (/succeeded|ready|pass|完成|成功|video_ready/i.test(text)
    ? "good"
    : /failed|error|失败|合规校验/i.test(text)
      ? "bad"
      : /running|generating|处理中|提交/i.test(text)
        ? "warn"
        : "muted");
  return <span className={`status-badge ${kind}`}>{text}</span>;
}

function TableHead({ title, onRefresh }) {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      <button className="secondary-button" onClick={onRefresh}><RefreshCw size={16} /><span>刷新</span></button>
    </div>
  );
}

function MobileTaskCards({ rows = [], onOpenAssets }) {
  return (
    <div className="mobile-task-card-list" aria-label="手机端任务卡片">
      {rows.length ? rows.map((row) => {
        const taskCode = row["任务编号"] || "-";
        return (
          <article className="mobile-task-card" key={taskCode}>
            <div className="mobile-task-card-head">
              <div>
                <strong>{taskDisplayName(row)}</strong>
                <span>{taskMetaLabel(row)}</span>
              </div>
              <StatusBadge value={row["任务状态"]} />
            </div>
            <div className="mobile-task-card-body">
              <div>
                <span>商品</span>
                <strong>{displayCleanText(row["商品名称"])}</strong>
              </div>
              <div>
                <span>视频</span>
                <StatusBadge value={row["libTV状态"]} />
              </div>
              <div>
                <span>更新</span>
                <strong>{formatDate(row["更新时间"])}</strong>
              </div>
            </div>
            <div className="mobile-task-card-actions">
              <button type="button" className="secondary-button" onClick={() => onOpenAssets(taskCode)}>
                <FolderOpen size={16} />
                <span>素材</span>
              </button>
            </div>
          </article>
        );
      }) : <div className="mobile-empty-card">暂无任务记录</div>}
    </div>
  );
}

function mobileVideoTaskHint(row = {}, errorMessage = "") {
  if (errorMessage) return "需要处理";
  if (row["视频链接"]) return "视频已生成";
  if (row["外部任务ID"]) return "已提交生成";
  return "等待提交";
}

function mobileTaskRecoveryHint(row = {}, errorMessage = "") {
  const text = `${errorMessage || ""} ${row["libTV状态"] || ""}`;
  if (!errorMessage && !/failed|失败|异常|合规|error/i.test(text)) return null;
  const imageIssue = /图片|素材|参考图|尺寸|像素|image|size/i.test(text);
  const promptIssue = /提示词|prompt|参数|时长|比例|invalid/i.test(text);
  const serviceIssue = /连接|超时|排队|服务|timeout|busy|429|503/i.test(text);
  const complianceIssue = /合规|审核|真人|版权|肖像|copyright/i.test(text);
  return {
    title: complianceIssue
      ? "先处理素材合规"
      : imageIssue
        ? "先检查图片素材"
        : promptIssue
          ? "先检查提示词参数"
          : serviceIssue
            ? "先确认生成通道"
            : "按失败原因处理",
    detail: errorMessage || "这条视频任务没有完成，先按建议处理后再重新生成。",
    tips: complianceIssue
      ? ["更换授权清晰的参考图", "避免真人敏感、品牌侵权或平台禁用内容"]
      : imageIssue
        ? ["补一张清晰商品图", "避免模糊、遮挡、尺寸过小"]
        : promptIssue
          ? ["删掉冲突要求", "确认时长、画幅和生成方式"]
          : serviceIssue
            ? ["稍后刷新任务", "连续失败时检查顶部生成通道"]
            : ["先看素材是否齐全", "再回创作页重新生成"]
  };
}

function mobileVideoTaskNextStep(row = {}, errorMessage = "") {
  if (errorMessage) return null;
  const statusText = `${row["libTV状态"] || ""} ${row["任务状态"] || ""} ${row["外部任务ID"] || ""}`;
  if (row["视频链接"]) {
    return {
      tone: "done",
      badge: "已完成",
      title: "视频已经生成",
      detail: "先打开预览，确认没问题后再去资产页下载或归档。",
      primary: "open"
    };
  }
  if (row["外部任务ID"] || /running|generating|queued|submitted|处理中|生成中|排队|已提交|提交/i.test(statusText)) {
    return {
      tone: "running",
      badge: "生成中",
      title: "等它跑完，不用重复提交",
      detail: "可以每隔一会刷新一次；离开页面也不会丢任务。",
      primary: "refresh"
    };
  }
  return {
    tone: "pending",
    badge: "待开始",
    title: "还没开始生成视频",
    detail: "回创意页确认图片和提示词，再点保存并生成视频。",
    primary: "studio"
  };
}

function parseTaskTime(row = {}) {
  const source = row["提交时间"] || row["开始时间"] || row["创建时间"] || row["更新时间"] || row.created_at || row.updated_at;
  const time = source ? Date.parse(source) : NaN;
  return Number.isFinite(time) ? time : 0;
}

function parseTaskDuration(row = {}) {
  const raw = row["视频时长"] || row["时长"] || row.duration || row.targetDuration || "";
  const match = String(raw).match(/\d+/);
  const seconds = match ? Number(match[0]) : 15;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 15;
}

function formatRemainingTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "等待结果回传";
  if (seconds < 60) return `约 ${Math.ceil(seconds / 10) * 10} 秒`;
  return `约 ${Math.ceil(seconds / 60)} 分钟`;
}

function mobileVideoWaitEstimate(row = {}, nowTs = Date.now()) {
  const startedAt = parseTaskTime(row);
  const duration = parseTaskDuration(row);
  const expectedSeconds = Math.max(150, Math.min(540, 90 + duration * 10));
  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((nowTs - startedAt) / 1000)) : 35;
  const percent = Math.max(12, Math.min(92, Math.round((elapsedSeconds / expectedSeconds) * 100)));
  const remainingSeconds = Math.max(0, expectedSeconds - elapsedSeconds);
  return {
    percent,
    remaining: formatRemainingTime(remainingSeconds),
    elapsed: elapsedSeconds < 60 ? "刚刚开始" : `已等待 ${Math.floor(elapsedSeconds / 60)} 分钟`,
    title: percent >= 88 ? "快完成了，等结果回传" : "正在生成，请稍等"
  };
}

export function TasksPage({ rows, onRefresh, onOpenAssets }) {
  const taskRows = rows || [];
  return (
    <section className="panel">
      <TableHead title="任务看板" onRefresh={onRefresh} />
      <MobileTaskCards rows={taskRows} onOpenAssets={onOpenAssets} />
      <div className="table-wrap task-board-table">
        <table>
          <thead>
            <tr>
              <th>任务</th>
              <th>视频名称</th>
              <th>类别</th>
              <th>商品名称</th>
              <th>提示词</th>
              <th>视频</th>
              <th>更新时间</th>
              <th>素材</th>
            </tr>
          </thead>
          <tbody>
            {taskRows.map((row, index) => (
              <tr key={row["任务编号"]}>
                <td>{taskDisplayLabel(row, index)}</td>
                <td>{taskDisplayName(row)}</td>
                <td>{displayCleanText(row["类别"])}</td>
                <td>{displayCleanText(row["商品名称"])}</td>
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

export function LibtvPage({ rows, onRefresh, onOpenAssets, outputFiles = [], addNotification }) {
  const jobRows = rows || [];
  const copyGeneratedVideoLink = React.useCallback(
    ({ videoUrl }) => copyVideoLinkToPhone({ videoUrl, addNotification }),
    [addNotification]
  );

  return (
    <section className="panel">
      <TableHead title="视频生成任务" onRefresh={onRefresh} />
      <MobileLibtvCards rows={jobRows} onRefresh={onRefresh} onOpenAssets={onOpenAssets} onCopyVideoLink={copyGeneratedVideoLink} />
      <MobileVideoOutputArchive outputFiles={outputFiles} onCopyVideoLink={copyGeneratedVideoLink} />
      <div className="table-wrap libtv-table">
        <table>
          <thead>
            <tr>
              <th>任务</th>
              <th>视频名称</th>
              <th>状态</th>
              <th>结果</th>
              <th>完成时间</th>
              <th>处理提示</th>
            </tr>
          </thead>
          <tbody>
            {jobRows.map((row, index) => {
              const errorMessage = cleanDisplayMessage(row["错误信息"]);
              return (
                <tr key={`${row["任务编号"]}-${row["外部任务ID"]}`}>
                  <td>{taskDisplayLabel(row, index)}</td>
                  <td>{taskDisplayName(row)}</td>
                  <td><StatusBadge value={row["libTV状态"]} /></td>
                  <td>{row["视频链接"] ? <a href={row["视频链接"]} target="_blank" rel="noreferrer">打开视频</a> : taskResultLabel(row, errorMessage)}</td>
                  <td>{formatDate(row["完成时间"])}</td>
                  <td>{errorMessage || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MobileVideoOutputArchive({ outputFiles = [], onCopyVideoLink }) {
  return (
    <section className="mobile-video-output-archive" aria-label="成片输出">
      <div className="mobile-video-output-head">
        <div>
          <span>成片输出</span>
          <strong>已经生成的视频放这里下载</strong>
          <p>先看上面的任务状态，确认完成后在这里保存成片。</p>
        </div>
        <em>{outputFiles.length} 个</em>
      </div>
      <div className="mobile-video-output-list">
        {outputFiles.length ? outputFiles.map((file, index) => {
          const displayName = mobileVideoOutputLabel(index);
          const rawName = safeOutputDisplayName(file.name || file.url, displayName);
          const downloadName = mobileVideoDownloadName(file, index);
          const saveUrl = rawVideoLink(file.url);
          return (
            <article className="mobile-video-output-card" key={file.url || displayName}>
              <span className="mobile-video-output-icon">
                <Video size={17} />
              </span>
              <div className="mobile-video-output-copy">
                <div>
                  <strong title={rawName}>{displayName}</strong>
                  <em>{file.url ? "可下载" : "待生成"}</em>
                </div>
                <span>{["视频结果", formatBytes(file.size), formatDate(file.updatedAt)].filter(Boolean).join(" / ")}</span>
                <small>原文件名已隐藏，下载时会自动命名</small>
              </div>
              <div className="mobile-video-output-actions">
                {file.url ? (
                  <a href={file.url} target="_blank" rel="noreferrer" aria-label={`打开 ${displayName}`}>
                    <Video size={15} />
                    <span>打开</span>
                  </a>
                ) : null}
                {file.url ? (
                  <button
                    type="button"
                    onClick={() => onCopyVideoLink?.({ videoUrl: file.url })}
                    aria-label={`复制视频链接 ${displayName}`}
                  >
                    <Clipboard size={15} />
                    <span>复制链接</span>
                  </button>
                ) : null}
                {file.url ? (
                  <a href={saveUrl} download={downloadName || true} aria-label={`下载 ${displayName}`}>
                    <Download size={15} />
                    <span>下载</span>
                  </a>
                ) : null}
              </div>
            </article>
          );
        }) : (
          <div className="mobile-empty-card mobile-video-output-empty">
            <strong>还没有可下载成片</strong>
            <span>视频任务完成后，成片会出现在这里。</span>
          </div>
        )}
      </div>
    </section>
  );
}

function MobileLibtvCards({ rows = [], onRefresh, onOpenAssets, onCopyVideoLink }) {
  const hasRunningTask = rows.some((row) => {
    const statusText = `${row["libTV状态"] || ""} ${row["任务状态"] || ""} ${row["外部任务ID"] || ""}`;
    return !row["视频链接"] && /running|generating|queued|submitted|处理中|生成中|排队|已提交|提交/i.test(statusText);
  });
  const [nowTs, setNowTs] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!hasRunningTask) return undefined;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasRunningTask]);

  return (
    <div className="mobile-task-card-list mobile-libtv-card-list" aria-label="手机端视频生成任务卡片">
      {rows.length ? rows.map((row) => {
        const taskCode = row["任务编号"] || "-";
        const videoUrl = row["视频链接"] || "";
        const errorMessage = cleanDisplayMessage(row["错误信息"]);
        const taskHint = mobileVideoTaskHint(row, errorMessage);
        const recovery = mobileTaskRecoveryHint(row, errorMessage);
        const nextStep = mobileVideoTaskNextStep(row, errorMessage);
        const waitEstimate = nextStep?.tone === "running" ? mobileVideoWaitEstimate(row, nowTs) : null;
        return (
          <article className="mobile-task-card mobile-libtv-card" key={`${taskCode}-${row["外部任务ID"] || ""}`}>
            <div className="mobile-task-card-head">
              <div>
                <strong>{taskDisplayName(row)}</strong>
                <span>任务记录 / {taskHint}</span>
              </div>
              <StatusBadge value={row["libTV状态"]} />
            </div>
            <div className="mobile-task-card-body">
              <div>
                <span>结果</span>
                <strong>{videoUrl ? "可打开视频" : taskHint}</strong>
              </div>
              <div>
                <span>{errorMessage ? "提醒" : "时间"}</span>
                <strong>{errorMessage || formatDate(row["完成时间"] || row["更新时间"])}</strong>
              </div>
            </div>
            {recovery ? (
              <div className="mobile-task-recovery-card" aria-label="失败任务处理建议">
                <span>失败处理</span>
                <strong>{recovery.title}</strong>
                <p>{recovery.detail}</p>
                <div className="mobile-task-recovery-tips">
                  {recovery.tips.map((tip) => <em key={tip}>{tip}</em>)}
                </div>
                <div className="mobile-task-card-actions mobile-task-recovery-actions">
                  <button type="button" className="secondary-button" onClick={() => onOpenAssets?.(taskCode)}>
                    <FolderOpen size={16} />
                    <span>查看素材</span>
                  </button>
                  <a className="secondary-button" href="#/studio">
                    <Sparkles size={16} />
                    <span>回创作页</span>
                  </a>
                </div>
              </div>
            ) : null}
            {!recovery && nextStep ? (
              <div className={`mobile-task-next-step ${nextStep.tone}`} aria-label="视频任务下一步">
                <span>{nextStep.badge}</span>
                <strong>{nextStep.title}</strong>
                <p>{nextStep.detail}</p>
                {waitEstimate ? (
                  <div className="mobile-video-wait-card" aria-label="视频生成等待进度">
                    <div className="mobile-video-wait-head">
                      <strong>{waitEstimate.title}</strong>
                      <span>{waitEstimate.percent}%</span>
                    </div>
                    <div className="mobile-video-wait-track" aria-hidden="true">
                      <i style={{ width: `${waitEstimate.percent}%` }} />
                    </div>
                    <div className="mobile-video-wait-meta">
                      <span>{waitEstimate.elapsed}</span>
                      <span>预计还需 {waitEstimate.remaining}</span>
                    </div>
                    <p>可以先离开页面，任务完成后会回到这里。</p>
                  </div>
                ) : null}
                <div className="mobile-task-next-actions">
                  {nextStep.primary === "open" ? (
                    <a className="secondary-button" href={videoUrl} target="_blank" rel="noreferrer">
                      <Video size={16} />
                      <span>打开视频</span>
                    </a>
                  ) : null}
                  {nextStep.primary === "open" ? (
                  <button
                    type="button"
                    className="secondary-button primary-save-phone"
                    onClick={() => onCopyVideoLink?.({ videoUrl })}
                  >
                      <Clipboard size={16} />
                      <span>复制链接</span>
                    </button>
                  ) : null}
                  {nextStep.primary === "refresh" ? (
                    <button type="button" className="secondary-button" onClick={onRefresh}>
                      <RefreshCw size={16} />
                      <span>刷新状态</span>
                    </button>
                  ) : null}
                  {nextStep.primary === "studio" ? (
                    <a className="secondary-button" href="#/studio">
                      <Sparkles size={16} />
                      <span>回创意页</span>
                    </a>
                  ) : null}
                  <button type="button" className="secondary-button" onClick={() => onOpenAssets?.(taskCode)}>
                    <FolderOpen size={16} />
                    <span>查看资产</span>
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        );
      }) : (
        <div className="mobile-empty-card mobile-task-empty-guide">
          <strong>暂无视频生成任务</strong>
          <span>去创意页上传图片和提示词，点“保存并生成视频”后会出现在这里。</span>
          <a className="secondary-button" href="#/studio">
            <Sparkles size={16} />
            <span>开始创作</span>
          </a>
        </div>
      )}
    </div>
  );
}
