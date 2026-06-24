import React, { useMemo, useState } from "react";
import { ChevronRight, Copy, Info } from "lucide-react";

const FASHION_TEMPLATE_ID = "fashion-luxury-indoor-15s";

const inspirationCategories = [
  { id: "recommended", label: "推荐", description: "适合第一次使用，先从常用模板和核心工具开始。" },
  { id: "image", label: "商品图", description: "用于生成主图、封面、活动图和场景图。" },
  { id: "video", label: "短视频", description: "用于商品图变视频、模板视频和多段拼接。" },
  { id: "batch", label: "批量", description: "用于多商品一起跑，适合测款和批量生产。" }
];

const templateCardConfigs = [
  {
    title: "女装轻奢室内空间",
    tag: "15秒女装模板",
    detail: "一键生成女装轻奢室内空间 15 秒杂志感穿搭氛围视频。",
    page: "studio:images",
    tone: "green",
    templateId: FASHION_TEMPLATE_ID,
    ctaLabel: "使用女装模板"
  },
  {
    title: "电商爆品快剪",
    tag: "通用商品",
    detail: "适合先做一条商品卖点视频，测款、上新都能用。",
    page: "studio:images",
    tone: "cyan",
    templateId: "ecommerce-product-quick-cut-15s",
    ctaLabel: "使用爆品模板"
  },
  {
    title: "美妆护肤质感",
    tag: "美妆护肤",
    detail: "适合瓶身、质地、香氛和彩妆的清透种草视频。",
    page: "studio:images",
    tone: "purple",
    templateId: "beauty-skincare-clean-15s",
    ctaLabel: "使用美妆模板"
  },
  {
    title: "零食饮品试吃",
    tag: "食品饮品",
    detail: "适合开箱、倒出、试吃和下午茶氛围展示。",
    page: "studio:images",
    tone: "amber",
    templateId: "snack-drink-opening-15s",
    ctaLabel: "使用食品模板"
  },
  {
    title: "家居小家电演示",
    tag: "家居百货",
    detail: "适合清洁、收纳、小家电和工具类功能演示。",
    page: "studio:images",
    tone: "blue",
    templateId: "home-appliance-demo-15s",
    ctaLabel: "使用家居模板"
  },
  {
    title: "直播间主图",
    tag: "文生图",
    detail: "生成直播封面、活动主视觉和商品场景图。",
    page: "textImage",
    tone: "cyan"
  },
  {
    title: "多款批量测试",
    tag: "批量生成",
    detail: "一次放多组商品图和提示词，适合测爆款方向。",
    page: "batch",
    tone: "amber"
  },
  {
    title: "多段混剪成片",
    tag: "视频拼接",
    detail: "把多个生成片段合成一条完整投放素材。",
    page: "stitch",
    tone: "purple"
  }
];

function buildMobileInspirationItems(templates) {
  return templateCardConfigs.map((item) => {
    if (!item.templateId) return item;
    const template = templates.find((entry) => entry.id === item.templateId);
    return {
      ...item,
      template
    };
  });
}

export default function MobileInspirationPage({
  navigate,
  guest = false,
  onLogin,
  onApplyTemplate,
  templates = []
}) {
  const [activeCategory, setActiveCategory] = useState("recommended");
  const mobileInspirationItems = useMemo(() => buildMobileInspirationItems(templates), [templates]);
  const filteredInspirationItems = mobileInspirationItems.filter((item) => {
    if (activeCategory === "recommended") return true;
    if (activeCategory === "image") {
      return item.page === "textImage";
    }
    if (activeCategory === "video") {
      return Boolean(item.template) || ["studio", "studio:images", "stitch"].includes(item.page);
    }
    if (activeCategory === "batch") {
      return item.page === "batch";
    }
    return true;
  });
  const activeCategoryMeta = inspirationCategories.find((category) => category.id === activeCategory) || inspirationCategories[0];
  const templateItems = filteredInspirationItems.filter((item) => item.template);
  const toolItems = filteredInspirationItems.filter((item) => !item.template);
  const renderTemplateCard = (item) => {
    const cardIndex = filteredInspirationItems.findIndex((entry) => entry.title === item.title) + 1;
    const stepHints = item.template ? ["准备图片", "套用模板", "生成视频"] : ["打开工具", "上传素材", "查看结果"];
    const uploadChips = item.template?.id === FASHION_TEMPLATE_ID
      ? ["人物参考图", "女装商品图", "封面/画报图"]
      : item.template
        ? ["商品图", "场景参考", "卖点信息"]
        : [];
    return (
      <article className={[
        `mobile-template-card tone-${item.tone}`,
        item.template ? "has-template" : ""
      ].filter(Boolean).join(" ")} key={item.title}>
        <div className="mobile-template-preview">
          {(item.coverImage || item.template?.coverImage) ? (
            <img
              src={item.coverImage || item.template.coverImage}
              alt={`${item.title}封面参考`}
              loading="lazy"
            />
          ) : null}
          {item.template?.coverImage ? (
            <em className="mobile-template-cover-badge">封面参考</em>
          ) : null}
          <span>{String(cardIndex).padStart(2, "0")}</span>
          <strong>{item.tag}</strong>
        </div>
        <div className="mobile-template-copy">
          <span>{item.tag}</span>
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
          <div className="mobile-template-steps" aria-label={`${item.title}使用步骤`}>
            {stepHints.map((step, index) => (
              <span key={step}>
                <em>{index + 1}</em>
                <strong>{step}</strong>
              </span>
            ))}
          </div>
          {uploadChips.length ? (
            <div className="mobile-template-chips" aria-label={`${item.title}建议上传类型`}>
              {uploadChips.map((chip) => (
                <span key={chip}>{chip}</span>
              ))}
            </div>
          ) : null}
          {item.template?.shortNotice ? (
            <div className="mobile-template-notice">
              <Info size={14} />
              <span>{item.template.shortNotice}</span>
            </div>
          ) : null}
          {item.template?.uploadRequirements?.length ? (
            <div className="mobile-template-upload">
              <strong>先准备这些图片</strong>
              <ul>
                {item.template.uploadRequirements.slice(0, 2).map((requirement) => (
                  <li key={requirement}>{requirement}</li>
                ))}
              </ul>
              {item.template.uploadRequirements.length > 2 ? (
                <details className="mobile-template-more">
                  <summary>查看完整要求</summary>
                  <ul>
                    {item.template.uploadRequirements.slice(2).map((requirement) => (
                      <li key={requirement}>{requirement}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
        <button className="mobile-template-primary" type="button" onClick={() => item.template ? onApplyTemplate?.(item.template) : navigate(item.page)}>
          <Copy size={16} />
          <span>{item.template ? item.ctaLabel || "使用模板" : "打开工具"}</span>
        </button>
      </article>
    );
  };
  return (
    <section className="mobile-inspiration-page" aria-label="创意玩法">
      <div className="mobile-inspiration-hero panel">
        <div>
          <span>创意玩法</span>
          <h2>选方向，一键套用</h2>
          <p>选模板，上传图，直接生成。</p>
        </div>
        <button type="button" onClick={guest ? onLogin : () => navigate("studio:images")}>
          {guest ? "登录使用" : "开始创作"}
        </button>
      </div>
      <div className="mobile-inspiration-tabs" role="tablist" aria-label="创意分类" data-horizontal-scroll="true">
        {inspirationCategories.map((category) => (
          <button
            type="button"
            className={activeCategory === category.id ? "active" : ""}
            role="tab"
            aria-selected={activeCategory === category.id}
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <div className="mobile-category-summary">
        <div>
          <span>{activeCategoryMeta.label}</span>
          <strong>{filteredInspirationItems.length} 个入口</strong>
        </div>
        <p>{activeCategoryMeta.description}</p>
      </div>
      {templateItems.length ? (
        <div className="mobile-template-section">
          <div className="mobile-template-section-head">
            <span>一键模板</span>
            <small>上传图片后自动填提示词</small>
          </div>
          <div className={["mobile-template-feed", templateItems.length === 1 ? "single" : ""].filter(Boolean).join(" ")}>
            {templateItems.map((item) => renderTemplateCard(item))}
          </div>
        </div>
      ) : null}
      {toolItems.length ? (
        <div className="mobile-template-section">
          <div className="mobile-template-section-head">
            <span>{templateItems.length ? "工具入口" : "可用入口"}</span>
            <small>按场景打开对应工作台</small>
          </div>
          <div className={["mobile-template-feed", toolItems.length === 1 ? "single" : ""].filter(Boolean).join(" ")}>
            {toolItems.map((item) => renderTemplateCard(item))}
          </div>
        </div>
      ) : null}
      <div className="mobile-simple-path panel">
        <div>
          <span>01</span>
          <strong>选玩法</strong>
        </div>
        <ChevronRight size={16} />
        <div>
          <span>02</span>
          <strong>上传素材</strong>
        </div>
        <ChevronRight size={16} />
        <div>
          <span>03</span>
          <strong>生成结果</strong>
        </div>
      </div>
    </section>
  );
}
