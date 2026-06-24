import React, { useState } from "react";
import { LockKeyhole, X } from "lucide-react";

export default function LoginPromptSheet({ onClose, onSubmit, error = "", submitting = false }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function submit(event) {
    event.preventDefault();
    if (submitting) return;
    onSubmit?.({ username, password });
  }

  return (
    <div className="login-sheet-wrap" role="dialog" aria-modal="true" aria-label="登录后继续使用">
      <button type="button" className="login-sheet-backdrop" aria-label="关闭登录面板" onClick={onClose} />
      <section className="login-sheet">
        <button type="button" className="login-sheet-close" aria-label="关闭登录面板" onClick={onClose}>
          <X size={18} />
        </button>
        <div className="login-sheet-brand">
          <div className="brand-mark">AI</div>
          <div>
            <strong>登录后继续</strong>
            <span>创作、资产和任务需要账号权限</span>
          </div>
        </div>
        <form className="login-form login-sheet-form" onSubmit={submit}>
          <label>
            <span>账号</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="输入账号"
            />
          </label>
          <label>
            <span>密码</span>
            <input
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入密码"
            />
          </label>
          {error ? <div className="login-error">{error}</div> : null}
          <button className="primary-button login-submit" type="submit" disabled={submitting}>
            <LockKeyhole size={17} />
            <span>{submitting ? "登录中" : "登录使用"}</span>
          </button>
        </form>
      </section>
    </div>
  );
}
