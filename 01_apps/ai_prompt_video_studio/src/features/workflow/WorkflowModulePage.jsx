import React from "react";
import { ChevronRight, Sparkles, Workflow } from "lucide-react";

export default function WorkflowModulePage({ module, navigate }) {
  return (
    <section className="panel workflow-module-page">
      <div className="workflow-module-hero">
        <div>
          <span className="workflow-stage">{module.stage}</span>
          <h2>{module.title}</h2>
          <p>{module.subtitle}</p>
        </div>
      </div>
      <div className="workflow-module-grid">
        <div className="workflow-module-card">
          <div className="mini-panel-head">
            <Workflow size={17} />
            <strong>闭环位置</strong>
          </div>
          <ol className="workflow-step-list">
            {module.steps.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </div>
        <div className="workflow-module-card">
          <div className="mini-panel-head">
            <Sparkles size={17} />
            <strong>当前可先使用</strong>
          </div>
          <p className="workflow-module-note">这个入口先用于产品结构占位，后续会按实际业务流程逐步接入真实功能。</p>
          <div className="workflow-action-list">
            {module.actions.map((action) => (
              <button className="secondary-button" type="button" key={action.page} onClick={() => navigate(action.page)}>
                <span>{action.label}</span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
