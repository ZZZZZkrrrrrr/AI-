import React, { useMemo, useState } from "react";
import { RefreshCw, Scissors } from "lucide-react";
import {
  createEventSource,
  formatBytes,
  formatDate,
  requestJson
} from "../../api.js";

function buildVideoRows(jobs = [], assets = {}) {
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
  return [...libtvVideos, ...localVideos];
}

function isOpenableUrl(value) {
  const text = String(value || "");
  return /^https?:\/\//i.test(text) || text.startsWith("/api/");
}

function statusBadgeText(value) {
  const text = String(value || "");
  if (text.toLowerCase() === "compliance_required") return "需合规校验";
  return value || "-";
}

function StatusBadge({ value }) {
  const text = statusBadgeText(value);
  const kind = /succeeded|ready|pass|完成|成功|video_ready/i.test(text)
    ? "good"
    : /failed|error|失败|合规校验/i.test(text)
      ? "bad"
      : /running|generating|处理中|提交/i.test(text)
        ? "warn"
        : "muted";
  return <span className={`status-badge ${kind}`}>{text}</span>;
}

function ProgressBar({ value }) {
  return (
    <div className="progress-track">
      <div className="progress-bar" style={{ width: `${value}%` }} />
    </div>
  );
}

function progressPercent(steps) {
  if (!steps.length) return 0;
  const done = steps.filter((step) => step.status === "done").length;
  const running = steps.filter((step) => step.status === "running").length;
  const cancelled = steps.filter((step) => step.status === "cancelled").length;
  return Math.min(100, Math.round(((done + running * 0.45 + cancelled * 0.2) / steps.length) * 100));
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
              <time className="step-time">{formatDate(step.at)}</time>
            </div>
            <div className="step-message">{step.message}</div>
            {step.output ? <pre className="step-output">{String(step.output).slice(0, 1600)}</pre> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function MobileStitchVideoCards({ videos, selected, onToggle }) {
  return (
    <div className="mobile-stitch-video-list" aria-label="手机端视频拼接列表">
      {videos.length ? videos.map((video) => {
        const checked = selected.includes(video.id);
        return (
          <article className={checked ? "mobile-stitch-video-card selected" : "mobile-stitch-video-card"} key={video.id}>
            <label className="mobile-stitch-video-pick">
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onToggle(video.id, event.target.checked)}
              />
              <span>{checked ? "已选择" : "选择"}</span>
            </label>
            <div className="mobile-stitch-video-main">
              <strong>{video.name}</strong>
              <span>{video.taskCode} / {video.source}</span>
            </div>
            <div className="mobile-stitch-video-meta">
              <StatusBadge value={video.status} />
              <span>{formatDate(video.updatedAt)}</span>
            </div>
            {isOpenableUrl(video.openUrl) ? (
              <a className="secondary-button" href={video.openUrl} target="_blank" rel="noreferrer">
                打开视频
              </a>
            ) : (
              <span className="path-cell">{video.openUrl}</span>
            )}
          </article>
        );
      }) : (
        <div className="empty-state">暂时没有可拼接的视频。先生成视频，完成后会出现在这里。</div>
      )}
    </div>
  );
}

export default function VideoStitchPage({ jobs, assets, addNotification, onRefresh }) {
  const [selected, setSelected] = useState([]);
  const [groupSize, setGroupSize] = useState(2);
  const [stitchNotice, setStitchNotice] = useState("");
  const [stitchRunning, setStitchRunning] = useState(false);
  const [stitchSteps, setStitchSteps] = useState([]);
  const [stitchResult, setStitchResult] = useState(null);
  const videos = useMemo(() => buildVideoRows(jobs, assets), [jobs, assets]);
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
          <p className="panel-note">从已完成的视频里勾选素材，按组调用 ffmpeg 合成完整素材。</p>
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

      <MobileStitchVideoCards videos={videos} selected={selected} onToggle={toggleVideo} />

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
                <td>{isOpenableUrl(video.openUrl) ? <a href={video.openUrl} target="_blank" rel="noreferrer">打开</a> : <span className="path-cell">{video.openUrl}</span>}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7">暂时没有可拼接的视频。先在提示词工作台生成视频，完成后会出现在这里。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
