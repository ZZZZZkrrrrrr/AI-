import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Globe2,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone
} from "lucide-react";
import { requestJson } from "../../api.js";
import { downloadJsonFile } from "../../shared/compliance/aiEvidencePack.js";

const DELETE_ACCOUNT_CONFIRM_TEXT = "删除账号";
const DATA_RIGHTS_REVIEW_STATUSES = [
  { value: "verifying", label: "核验中" },
  { value: "approved", label: "已通过" },
  { value: "processing", label: "处理中" },
  { value: "completed", label: "已完成" },
  { value: "rejected", label: "未通过" }
];

const PILOT_FEEDBACK_CATEGORIES = [
  { value: "bug", label: "功能异常" },
  { value: "confusing", label: "看不懂/不好用" },
  { value: "feature", label: "想要的新能力" },
  { value: "pwa-install", label: "安装到桌面" },
  { value: "performance", label: "速度或卡顿" },
  { value: "other", label: "其他反馈" }
];
const PILOT_FEEDBACK_SEVERITIES = [
  { value: "normal", label: "一般" },
  { value: "high", label: "影响使用" },
  { value: "blocking", label: "无法继续" },
  { value: "low", label: "小问题" }
];
const PILOT_FEEDBACK_REVIEW_STATUSES = [
  { value: "triaging", label: "排查中" },
  { value: "planned", label: "已排期" },
  { value: "fixed", label: "已修复" },
  { value: "closed", label: "已关闭" }
];

function resolveModelChoice(settings, type) {
  const customKey = `${type}CustomModel`;
  const selectKey = `${type}Model`;
  return String(settings?.[customKey] || settings?.[selectKey] || "").trim();
}

function isLibtvConnected(runtime) {
  return Boolean(runtime?.libtvBridgeReachable || runtime?.libtvHealth?.ok);
}

function statusBadgeText(value) {
  const text = String(value || "");
  if (text.toLowerCase() === "compliance_required") return "需合规校验";
  return value || "-";
}

function StatusBadge({ value }) {
  const text = statusBadgeText(value);
  const kind = /succeeded|ready|pass|完成|成功|video_ready|可用/i.test(text)
    ? "good"
    : /failed|error|失败|合规校验|未通过/i.test(text)
      ? "bad"
      : /running|generating|处理中|提交|待配置|已收到|核验中/i.test(text)
        ? "warn"
        : "muted";
  return <span className={`status-badge ${kind}`}>{text}</span>;
}

function SettingsHead({ title, onRefresh }) {
  return (
    <div className="panel-head">
      <h2>{title}</h2>
      <button className="secondary-button" onClick={onRefresh}>
        <RefreshCw size={16} />
        <span>刷新</span>
      </button>
    </div>
  );
}

function AppReadinessCenter({ runtime, libtvReady, onExport, dataExporting }) {
  const appOnline = !runtime?.error;
  const items = [
    {
      id: "install",
      title: "桌面安装",
      desc: "PWA / 手机桌面",
      status: "可用",
      tone: "good",
      icon: Smartphone,
      href: "/install.html"
    },
    {
      id: "trust",
      title: "隐私与支持",
      desc: "协议 / 帮助 / AI 说明",
      status: "可查看",
      tone: "good",
      icon: Globe2,
      href: "/legal/index.html"
    },
    {
      id: "data",
      title: "账号数据",
      desc: "导出 / 删除申请",
      status: dataExporting ? "导出中" : "可导出",
      tone: "warn",
      icon: Download,
      onClick: onExport
    },
    {
      id: "runtime",
      title: "运行链路",
      desc: libtvReady ? "API 与 libTV 可用" : "等待生产联调",
      status: appOnline && libtvReady ? "就绪" : appOnline ? "待联调" : "离线",
      tone: appOnline && libtvReady ? "good" : appOnline ? "warn" : "bad",
      icon: ClipboardCheck
    }
  ];

  return (
    <div className="settings-section app-readiness-center">
      <div className="settings-section-head">
        <div>
          <h3>App 准备中心</h3>
          <p>安装、信任、数据和运行状态集中在这里。</p>
        </div>
        <ShieldCheck size={18} />
      </div>
      <div className="app-readiness-grid">
        {items.map((item) => {
          const Icon = item.icon;
          const content = (
            <>
              <span className={`app-readiness-icon ${item.tone}`}><Icon size={19} /></span>
              <span className="app-readiness-copy">
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
              </span>
              <StatusBadge value={item.status} />
            </>
          );
          if (item.href) {
            return (
              <a className="app-readiness-tile" href={item.href} target={item.href === "/" ? undefined : "_blank"} rel={item.href === "/" ? undefined : "noreferrer"} key={item.id}>
                {content}
              </a>
            );
          }
          if (item.onClick) {
            return (
              <button className="app-readiness-tile" type="button" onClick={item.onClick} disabled={dataExporting} key={item.id}>
                {content}
              </button>
            );
          }
          return (
            <div className="app-readiness-tile app-readiness-static" key={item.id}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PilotFeedbackPanel({
  category,
  severity,
  message,
  contact,
  submitting,
  loading,
  feedback,
  onCategoryChange,
  onSeverityChange,
  onMessageChange,
  onContactChange,
  onSubmit,
  onRefresh,
  formatTime
}) {
  return (
    <div className="settings-section pilot-feedback-section">
      <div className="settings-section-head">
        <div>
          <h3>试用反馈</h3>
          <p>遇到看不懂、点不动、安装不了或流程不顺时，直接在这里告诉我们。</p>
        </div>
        <MessageSquare size={18} />
      </div>
      <div className="pilot-feedback-panel">
        <div className="pilot-feedback-grid">
          <label className="field">
            <span>问题类型</span>
            <select value={category} onChange={(event) => onCategoryChange(event.target.value)}>
              {PILOT_FEEDBACK_CATEGORIES.map((item) => (
                <option value={item.value} key={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>影响程度</span>
            <select value={severity} onChange={(event) => onSeverityChange(event.target.value)}>
              {PILOT_FEEDBACK_SEVERITIES.map((item) => (
                <option value={item.value} key={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="field pilot-feedback-message">
            <span>发生了什么</span>
            <textarea
              value={message}
              onChange={(event) => onMessageChange(event.target.value)}
              rows={4}
              placeholder="例如：点一键做视频后不知道下一步，或者通知面板挡住了按钮。"
            />
          </label>
          <label className="field pilot-feedback-contact">
            <span>联系方式</span>
            <input
              value={contact}
              onChange={(event) => onContactChange(event.target.value)}
              placeholder="可选，微信/手机号/邮箱"
              autoComplete="off"
            />
          </label>
          <div className="pilot-feedback-actions">
            <button className="secondary-button" type="button" onClick={onRefresh} disabled={loading}>
              <RefreshCw size={16} />
              <span>{loading ? "刷新中" : "刷新记录"}</span>
            </button>
            <button className="primary-action" type="button" onClick={onSubmit} disabled={submitting || message.trim().length < 6}>
              <Send size={16} />
              <span>{submitting ? "提交中" : "提交反馈"}</span>
            </button>
          </div>
        </div>
        {feedback.length ? (
          <div className="pilot-feedback-list" aria-label="试用反馈记录">
            {feedback.slice(0, 4).map((item) => (
              <article className="pilot-feedback-card" key={item.id}>
                <div>
                  <strong>{item.categoryLabel || "反馈"}</strong>
                  <StatusBadge value={item.statusLabel || item.status} />
                </div>
                <small>{item.severityLabel || item.severity} / {formatTime(item.createdAt)}</small>
                <p>{item.message}</p>
                <small>{item.nextStep || "等待处理。"}</small>
              </article>
            ))}
          </div>
        ) : (
          <div className="data-rights-empty">暂无试用反馈记录。</div>
        )}
      </div>
    </div>
  );
}

function AdminPilotFeedbackQueue({
  feedback,
  loading,
  updatingId,
  onRefresh,
  onUpdate,
  formatTime
}) {
  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <div>
          <h3>试用反馈处理</h3>
          <p>管理员用来查看试点用户反馈，并标记排查、排期、修复或关闭。</p>
        </div>
        <ClipboardCheck size={18} />
      </div>
      <div className="data-rights-status-head pilot-feedback-admin-head">
        <div>
          <strong>反馈队列</strong>
          <span>这里只保存问题描述和处理状态，不保存密码、密钥、截图原图或未脱敏日志。</span>
        </div>
        <button className="secondary-button" type="button" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} />
          <span>{loading ? "刷新中" : "刷新队列"}</span>
        </button>
      </div>
      {feedback.length ? (
        <div className="pilot-feedback-admin-list" aria-label="管理员试用反馈队列">
          {feedback.slice(0, 12).map((item) => (
            <article className="pilot-feedback-admin-card" key={`${item.ownerUserId || item.ownerHint}:${item.id}`}>
              <div className="data-rights-admin-card-head">
                <div>
                  <strong>{item.categoryLabel || "反馈"}</strong>
                  <span>{item.displayName || item.username || item.ownerHint || "未知用户"}</span>
                </div>
                <StatusBadge value={item.statusLabel || item.status} />
              </div>
              <small>{item.severityLabel || item.severity} / {formatTime(item.createdAt)} / {item.page || "settings"}</small>
              <p>{item.message}</p>
              <div className="data-rights-admin-actions" aria-label="更新反馈状态">
                {PILOT_FEEDBACK_REVIEW_STATUSES.map((option) => {
                  const actionId = `${item.id}:${option.value}`;
                  return (
                    <button
                      className={item.status === option.value ? "secondary-button active" : "secondary-button"}
                      type="button"
                      key={option.value}
                      onClick={() => onUpdate(item.id, option.value)}
                      disabled={updatingId === actionId || item.status === option.value}
                    >
                      <span>{updatingId === actionId ? "更新中" : option.label}</span>
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="data-rights-empty">暂无试用反馈。</div>
      )}
    </div>
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

export default function SettingsPage({ runtime, onRefresh, modelSettings, updateModelSettings, addNotification }) {
  const [dataRightsReason, setDataRightsReason] = useState("");
  const [dataRightsPassword, setDataRightsPassword] = useState("");
  const [dataRightsConfirmText, setDataRightsConfirmText] = useState("");
  const [dataRightsSubmitting, setDataRightsSubmitting] = useState(false);
  const [dataExporting, setDataExporting] = useState(false);
  const [dataRightsRequests, setDataRightsRequests] = useState([]);
  const [dataRightsLoading, setDataRightsLoading] = useState(false);
  const [adminDataRightsRequests, setAdminDataRightsRequests] = useState([]);
  const [adminDataRightsLoading, setAdminDataRightsLoading] = useState(false);
  const [adminDataRightsUpdatingId, setAdminDataRightsUpdatingId] = useState("");
  const [pilotFeedbackCategory, setPilotFeedbackCategory] = useState("bug");
  const [pilotFeedbackSeverity, setPilotFeedbackSeverity] = useState("normal");
  const [pilotFeedbackMessage, setPilotFeedbackMessage] = useState("");
  const [pilotFeedbackContact, setPilotFeedbackContact] = useState("");
  const [pilotFeedbackSubmitting, setPilotFeedbackSubmitting] = useState(false);
  const [pilotFeedbackItems, setPilotFeedbackItems] = useState([]);
  const [pilotFeedbackLoading, setPilotFeedbackLoading] = useState(false);
  const [adminPilotFeedbackItems, setAdminPilotFeedbackItems] = useState([]);
  const [adminPilotFeedbackLoading, setAdminPilotFeedbackLoading] = useState(false);
  const [adminPilotFeedbackUpdatingId, setAdminPilotFeedbackUpdatingId] = useState("");
  const activeAnalysisModel = resolveModelChoice(modelSettings, "analysis") || runtime?.currentModels?.analysis || "-";
  const activeVisionModel = resolveModelChoice(modelSettings, "vision") || runtime?.currentModels?.vision || "-";
  const activeVideoModel = resolveModelChoice(modelSettings, "video") || runtime?.currentModels?.video || "-";
  const activeImageModel = resolveModelChoice(modelSettings, "imageGeneration") || runtime?.currentModels?.imageGeneration || "-";
  const libtvReady = isLibtvConnected(runtime);
  const passwordVerificationRequired = runtime?.authRequired !== false;
  const accountDeletionConfirmed = dataRightsConfirmText.trim() === DELETE_ACCOUNT_CONFIRM_TEXT;
  const accountDeletionReady = accountDeletionConfirmed && (!passwordVerificationRequired || dataRightsPassword.trim());
  const isAdmin = runtime?.currentUser?.role === "admin";
  const legalLinks = [
    { title: "隐私政策", desc: "说明数据收集、使用、共享、保存和删除。", href: "/legal/privacy.html", icon: LockKeyhole },
    { title: "用户协议", desc: "说明账号、上传内容、AI 生成结果和禁止行为。", href: "/legal/terms.html", icon: FileText },
    { title: "AI 生成说明", desc: "说明 AI 参与环节、标识方式和用户复核责任。", href: "/legal/ai-disclosure.html", icon: ShieldCheck },
    { title: "删除账号与数据", desc: "说明 App 内申请、无法登录时的公开申请方式和保留边界。", href: "/legal/delete-account.html", icon: AlertTriangle },
    { title: "帮助与支持", desc: "提供任务异常、素材上传、账号数据和商店审核支持入口。", href: "/support.html", icon: LifeBuoy }
  ];
  const rows = [
    ["后端 API", runtime?.error ? "未连接" : "已连接"],
    ["千问文本", runtime?.qianwenTextConfigured ? "已配置" : "未配置"],
    ["千问视觉", runtime?.qianwenVisionConfigured ? "已配置" : "未配置"],
    ["豆包分析", runtime?.doubaoConfigured ? "已配置" : "未配置"],
    ["libTV 桥接", libtvReady ? "已连接" : "未连接"],
    ["ffmpeg 拼接", runtime?.ffmpegConfigured ? "已配置" : "未配置"],
    ["当前分析模型", activeAnalysisModel],
    ["当前视觉模型", activeVisionModel],
    ["数据库", runtime?.libtvDatabase || "-"],
    ["运行模式", runtime?.modeHint || "-"]
  ];

  useEffect(() => {
    loadDataRightsRequests({ silent: true });
    loadPilotFeedback({ silent: true });
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadAdminDataRightsRequests({ silent: true });
      loadAdminPilotFeedback({ silent: true });
    }
  }, [isAdmin]);

  function formatRequestTime(value) {
    if (!value) return "-";
    try {
      return new Date(value).toLocaleString("zh-CN", { hour12: false });
    } catch {
      return value;
    }
  }

  async function loadPilotFeedback({ silent = false } = {}) {
    setPilotFeedbackLoading(true);
    try {
      const data = await requestJson("/api/support/feedback");
      setPilotFeedbackItems(Array.isArray(data.feedback) ? data.feedback : []);
      if (!silent) {
        addNotification?.({
          level: "success",
          title: "试用反馈已刷新",
          message: "已读取当前账号的反馈处理状态。",
          target: "settings"
        });
      }
    } catch (error) {
      addNotification?.({
        level: "error",
        title: "试用反馈读取失败",
        message: error.message || "请稍后重试。",
        target: "settings"
      });
    } finally {
      setPilotFeedbackLoading(false);
    }
  }

  async function loadAdminPilotFeedback({ silent = false } = {}) {
    if (!isAdmin) return;
    setAdminPilotFeedbackLoading(true);
    try {
      const data = await requestJson("/api/admin/support-feedback");
      setAdminPilotFeedbackItems(Array.isArray(data.feedback) ? data.feedback : []);
      if (!silent) {
        addNotification?.({
          level: "success",
          title: "反馈队列已刷新",
          message: "已读取全部试点反馈。",
          target: "settings"
        });
      }
    } catch (error) {
      addNotification?.({
        level: "error",
        title: "反馈队列读取失败",
        message: error.message || "请稍后重试。",
        target: "settings"
      });
    } finally {
      setAdminPilotFeedbackLoading(false);
    }
  }

  async function submitPilotFeedback() {
    if (pilotFeedbackMessage.trim().length < 6) {
      addNotification?.({
        level: "warning",
        title: "请补充反馈内容",
        message: "至少写 6 个字，方便我们复现问题。",
        target: "settings"
      });
      return;
    }
    setPilotFeedbackSubmitting(true);
    try {
      const data = await requestJson("/api/support/feedback", {
        method: "POST",
        body: JSON.stringify({
          category: pilotFeedbackCategory,
          severity: pilotFeedbackSeverity,
          message: pilotFeedbackMessage,
          contact: pilotFeedbackContact,
          page: window.location.hash || window.location.pathname || "settings",
          device: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
          userAgent: navigator.userAgent || ""
        })
      });
      setPilotFeedbackMessage("");
      setPilotFeedbackContact("");
      setPilotFeedbackCategory("bug");
      setPilotFeedbackSeverity("normal");
      addNotification?.({
        level: "success",
        title: "试用反馈已提交",
        message: `反馈编号：${data.feedback?.id || "已记录"}`,
        target: "settings"
      });
      await loadPilotFeedback({ silent: true });
      await loadAdminPilotFeedback({ silent: true });
    } catch (error) {
      addNotification?.({
        level: "error",
        title: "试用反馈提交失败",
        message: error.message || "请稍后重试。",
        target: "settings"
      });
    } finally {
      setPilotFeedbackSubmitting(false);
    }
  }

  async function updateAdminPilotFeedbackStatus(feedbackId, status) {
    setAdminPilotFeedbackUpdatingId(`${feedbackId}:${status}`);
    try {
      await requestJson(`/api/admin/support-feedback/${encodeURIComponent(feedbackId)}/status`, {
        method: "POST",
        body: JSON.stringify({
          status,
          reviewNote: "管理员在移动端试点反馈队列更新状态。"
        })
      });
      addNotification?.({
        level: "success",
        title: "反馈状态已更新",
        message: "用户侧会看到最新处理状态。",
        target: "settings"
      });
      await loadPilotFeedback({ silent: true });
      await loadAdminPilotFeedback({ silent: true });
    } catch (error) {
      addNotification?.({
        level: "error",
        title: "反馈状态更新失败",
        message: error.message || "请稍后重试。",
        target: "settings"
      });
    } finally {
      setAdminPilotFeedbackUpdatingId("");
    }
  }

  async function loadDataRightsRequests({ silent = false } = {}) {
    setDataRightsLoading(true);
    try {
      const data = await requestJson("/api/account/data-rights-requests");
      setDataRightsRequests(Array.isArray(data.requests) ? data.requests : []);
      if (!silent) {
        addNotification?.({
          level: "success",
          title: "删除申请状态已刷新",
          message: "已读取当前账号的数据权利请求记录。",
          target: "settings"
        });
      }
    } catch (error) {
      addNotification?.({
        level: "error",
        title: "删除申请状态读取失败",
        message: error.message || "请稍后重试。",
        target: "settings"
      });
    } finally {
      setDataRightsLoading(false);
    }
  }

  async function loadAdminDataRightsRequests({ silent = false } = {}) {
    if (!isAdmin) return;
    setAdminDataRightsLoading(true);
    try {
      const data = await requestJson("/api/admin/data-rights-requests");
      setAdminDataRightsRequests(Array.isArray(data.requests) ? data.requests : []);
      if (!silent) {
        addNotification?.({
          level: "success",
          title: "审核队列已刷新",
          message: "已读取全部数据权利申请记录。",
          target: "settings"
        });
      }
    } catch (error) {
      addNotification?.({
        level: "error",
        title: "审核队列读取失败",
        message: error.message || "请稍后重试。",
        target: "settings"
      });
    } finally {
      setAdminDataRightsLoading(false);
    }
  }

  async function downloadAccountDataExport() {
    setDataExporting(true);
    try {
      const data = await requestJson("/api/account/export");
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJsonFile(data, `AI视频工作台-账号数据摘要-${stamp}.json`);
      addNotification?.({
        level: "success",
        title: "账号数据摘要已导出",
        message: "导出文件已下载到当前浏览器。",
        target: "settings"
      });
    } catch (error) {
      addNotification?.({
        level: "error",
        title: "账号数据导出失败",
        message: error.message || "请稍后重试。",
        target: "settings"
      });
    } finally {
      setDataExporting(false);
    }
  }

  async function submitAccountDeletionRequest() {
    if (passwordVerificationRequired && !dataRightsPassword.trim()) {
      addNotification?.({
        level: "warning",
        title: "请先完成身份校验",
        message: "请输入当前登录密码后再提交删除账号申请。",
        target: "settings"
      });
      return;
    }
    if (!accountDeletionConfirmed) {
      addNotification?.({
        level: "warning",
        title: "请先完成二次确认",
        message: `在确认框输入“${DELETE_ACCOUNT_CONFIRM_TEXT}”后才能提交。`,
        target: "settings"
      });
      return;
    }
    setDataRightsSubmitting(true);
    try {
      const data = await requestJson("/api/account/data-rights-request", {
        method: "POST",
        body: JSON.stringify({
          type: "delete_account",
          scope: "account-and-generated-content",
          reason: dataRightsReason,
          currentPassword: dataRightsPassword,
          confirmation: "DELETE_ACCOUNT"
        })
      });
      setDataRightsReason("");
      setDataRightsPassword("");
      setDataRightsConfirmText("");
      addNotification?.({
        level: "success",
        title: "删除账号申请已提交",
        message: `申请编号：${data.request?.id || "已记录"}`,
        target: "settings"
      });
      await loadDataRightsRequests({ silent: true });
      await loadAdminDataRightsRequests({ silent: true });
    } catch (error) {
      addNotification?.({
        level: "error",
        title: "删除账号申请提交失败",
        message: error.message || "请稍后重试。",
        target: "settings"
      });
    } finally {
      setDataRightsSubmitting(false);
    }
  }

  async function updateAdminDataRightsStatus(requestId, status) {
    setAdminDataRightsUpdatingId(`${requestId}:${status}`);
    try {
      await requestJson(`/api/admin/data-rights-requests/${encodeURIComponent(requestId)}/status`, {
        method: "POST",
        body: JSON.stringify({
          status,
          reviewNote: "管理员在移动端审核队列更新状态。"
        })
      });
      addNotification?.({
        level: "success",
        title: "申请状态已更新",
        message: "用户侧申请状态会同步显示。",
        target: "settings"
      });
      await loadDataRightsRequests({ silent: true });
      await loadAdminDataRightsRequests({ silent: true });
    } catch (error) {
      addNotification?.({
        level: "error",
        title: "申请状态更新失败",
        message: error.message || "请稍后重试。",
        target: "settings"
      });
    } finally {
      setAdminDataRightsUpdatingId("");
    }
  }

  return (
    <section className="panel settings-panel">
      <SettingsHead title="我的与设置" onRefresh={onRefresh} />
      <AppReadinessCenter
        runtime={runtime}
        libtvReady={libtvReady}
        onExport={downloadAccountDataExport}
        dataExporting={dataExporting}
      />
      <PilotFeedbackPanel
        category={pilotFeedbackCategory}
        severity={pilotFeedbackSeverity}
        message={pilotFeedbackMessage}
        contact={pilotFeedbackContact}
        submitting={pilotFeedbackSubmitting}
        loading={pilotFeedbackLoading}
        feedback={pilotFeedbackItems}
        onCategoryChange={setPilotFeedbackCategory}
        onSeverityChange={setPilotFeedbackSeverity}
        onMessageChange={setPilotFeedbackMessage}
        onContactChange={setPilotFeedbackContact}
        onSubmit={submitPilotFeedback}
        onRefresh={() => loadPilotFeedback()}
        formatTime={formatRequestTime}
      />
      <div className="settings-section">
        <div className="settings-section-head">
          <div>
            <h3>数据与账号</h3>
            <p>用于处理账号数据导出、删除申请和申请状态查询。</p>
          </div>
          <LockKeyhole size={18} />
        </div>
        <div className="data-rights-panel">
          <div className="data-rights-warning" role="note">
            <AlertTriangle size={16} />
            <div>
              <strong>提交前建议先导出数据。</strong>
              <span>删除账号申请会进入人工复核；正式执行前还需要删除范围确认和保留期判断。</span>
            </div>
          </div>
          <button className="secondary-button" type="button" onClick={downloadAccountDataExport} disabled={dataExporting}>
            <Download size={16} />
            <span>{dataExporting ? "正在导出" : "导出账号数据摘要"}</span>
          </button>
          <label className="field data-rights-field data-rights-reason">
            <span>删除申请备注</span>
            <textarea
              value={dataRightsReason}
              onChange={(event) => setDataRightsReason(event.target.value)}
              rows={3}
              placeholder="可填写需要删除的范围或联系方式"
            />
          </label>
          {passwordVerificationRequired ? (
            <label className="field data-rights-field data-rights-password">
              <span>当前登录密码</span>
              <input
                type="password"
                value={dataRightsPassword}
                onChange={(event) => setDataRightsPassword(event.target.value)}
                placeholder="重新输入当前登录密码"
                autoComplete="current-password"
              />
              <small>用于确认是本人操作，不会写入删除申请记录。</small>
            </label>
          ) : null}
          <label className="field data-rights-field data-rights-confirm">
            <span>二次确认</span>
            <input
              value={dataRightsConfirmText}
              onChange={(event) => setDataRightsConfirmText(event.target.value)}
              placeholder={`输入“${DELETE_ACCOUNT_CONFIRM_TEXT}”确认`}
              autoComplete="off"
            />
              <small>为避免误触，必须完整输入“删除账号”。</small>
          </label>
          <button
            className="ghost-button data-rights-delete-button"
            type="button"
            onClick={submitAccountDeletionRequest}
            disabled={dataRightsSubmitting || !accountDeletionReady}
          >
            <AlertTriangle size={16} />
            <span>{dataRightsSubmitting ? "正在提交" : "提交删除账号申请"}</span>
          </button>
        </div>
        <div className="data-rights-status-head">
          <div>
            <strong>申请状态</strong>
            <span>当前仅记录申请并进入人工复核，不会自动删除账号或业务数据。</span>
          </div>
          <button className="secondary-button" type="button" onClick={() => loadDataRightsRequests()} disabled={dataRightsLoading}>
            <RefreshCw size={16} />
            <span>{dataRightsLoading ? "刷新中" : "刷新状态"}</span>
          </button>
        </div>
        {dataRightsRequests.length ? (
          <div className="data-rights-request-list" aria-label="数据权利申请状态">
            {dataRightsRequests.slice(0, 5).map((request) => (
              <article className="data-rights-request-card" key={request.id}>
                <div>
                  <strong>{request.typeLabel || "数据权利请求"}</strong>
                  <span>{request.id}</span>
                </div>
                <StatusBadge value={request.statusLabel || (request.status === "received" ? "已收到" : request.status)} />
                <small>提交：{formatRequestTime(request.createdAt)}</small>
                <small>{request.identityVerified ? "已完成当前密码校验" : "等待身份确认"}</small>
                <small>{request.nextStep || "等待人工处理。"}</small>
                <p>{request.reason || "未填写备注"}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="data-rights-empty">暂无删除账号或数据权利申请记录。</div>
        )}
      </div>
      {isAdmin ? (
        <div className="settings-section">
          <div className="settings-section-head">
            <div>
              <h3>数据权利审核队列</h3>
              <p>管理员用于复核删除账号、删除数据、导出和更正请求。</p>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="data-rights-status-head data-rights-admin-head">
            <div>
              <strong>管理员处理</strong>
              <span>当前只更新申请状态和审核历史，不会自动删除业务数据。</span>
            </div>
            <button className="secondary-button" type="button" onClick={() => loadAdminDataRightsRequests()} disabled={adminDataRightsLoading}>
              <RefreshCw size={16} />
              <span>{adminDataRightsLoading ? "刷新中" : "刷新队列"}</span>
            </button>
          </div>
          {adminDataRightsRequests.length ? (
            <div className="data-rights-admin-list" aria-label="管理员数据权利审核队列">
              {adminDataRightsRequests.slice(0, 10).map((request) => (
                <article className="data-rights-admin-card" key={`${request.ownerUserId || request.ownerHint}:${request.id}`}>
                  <div className="data-rights-admin-card-head">
                    <div>
                      <strong>{request.typeLabel || "数据权利请求"}</strong>
                      <span>{request.displayName || request.username || request.ownerHint || "未知用户"}</span>
                    </div>
                    <StatusBadge value={request.statusLabel || request.status} />
                  </div>
                  <small>申请编号：{request.id}</small>
                  <small>提交：{formatRequestTime(request.createdAt)} / 更新：{formatRequestTime(request.updatedAt)}</small>
                  <small>{request.identityVerified ? "已完成当前密码校验" : "等待身份确认"}</small>
                  <p>{request.reason || "未填写备注"}</p>
                  <div className="data-rights-admin-actions" aria-label="更新申请状态">
                    {DATA_RIGHTS_REVIEW_STATUSES.map((option) => {
                      const actionId = `${request.id}:${option.value}`;
                      return (
                        <button
                          className={request.status === option.value ? "secondary-button active" : "secondary-button"}
                          type="button"
                          key={option.value}
                          onClick={() => updateAdminDataRightsStatus(request.id, option.value)}
                          disabled={adminDataRightsUpdatingId === actionId || request.status === option.value}
                        >
                          <span>{adminDataRightsUpdatingId === actionId ? "更新中" : option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="data-rights-empty">暂无待审核数据权利申请。</div>
          )}
        </div>
      ) : null}
      {isAdmin ? (
        <AdminPilotFeedbackQueue
          feedback={adminPilotFeedbackItems}
          loading={adminPilotFeedbackLoading}
          updatingId={adminPilotFeedbackUpdatingId}
          onRefresh={() => loadAdminPilotFeedback()}
          onUpdate={updateAdminPilotFeedbackStatus}
          formatTime={formatRequestTime}
        />
      ) : null}
      <div className="settings-section">
        <div className="settings-section-head">
          <div>
            <h3>合规与协议</h3>
            <p>公开给用户和审核人员查看的基础说明页面。</p>
          </div>
          <ShieldCheck size={18} />
        </div>
        <div className="legal-link-grid">
          {legalLinks.map((item) => {
            const Icon = item.icon;
            return (
              <a className="legal-link-card" href={item.href} target="_blank" rel="noreferrer" key={item.href}>
                <span className="legal-link-icon"><Icon size={18} /></span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.desc}</small>
                </span>
                <ChevronRight size={16} />
              </a>
            );
          })}
        </div>
      </div>
      <ModelSettingsPanel
        runtime={runtime}
        modelSettings={modelSettings}
        updateModelSettings={updateModelSettings}
      />
      <ModelChannelPanel
        channels={[
          { name: "提示词分析", provider: "豆包 / 千问", model: activeAnalysisModel, ready: Boolean(runtime?.doubaoConfigured || runtime?.qianwenTextConfigured), desc: "负责拆解提示词包、生成最终完整提示词。" },
          { name: "图片识别", provider: "千问视觉", model: activeVisionModel, ready: Boolean(runtime?.qianwenVisionConfigured), desc: "负责识别商品图、自动判断类别和卖点。" },
          { name: "视频生成", provider: "libTV / Seedance", model: activeVideoModel, ready: Boolean(libtvReady || runtime?.seedanceConfigured), desc: "负责提交视频生成任务并回写结果。" },
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
