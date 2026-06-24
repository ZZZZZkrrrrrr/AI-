import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  ChevronRight,
  CheckCircle2,
  Clipboard,
  Copy,
  Database,
  Download,
  FileText,
  FolderOpen,
  Gauge,
  HardDrive,
  Image,
  Info,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Play,
  Plus,
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
  readRemoteImageFile,
  requestJson
} from "./api.js";

const navItems = [
  { id: "overview", label: "生产总览", icon: LayoutDashboard },
  {
    id: "selectionAssets",
    label: "选品与资产",
    icon: Database,
    children: [
      { id: "selectionFlow", label: "选品流程", icon: Gauge },
      { id: "productAssetFlow", label: "商品资产", icon: Database },
      { id: "accountAssetFlow", label: "账号资产", icon: KeyRound }
    ]
  },
  {
    id: "promptWorkbench",
    label: "提示词工作台",
    icon: FileText,
    children: [
      { id: "studio", label: "单条视频", icon: Play },
      { id: "batch", label: "批量生成", icon: ListChecks },
      { id: "textImage", label: "文生图", icon: Image },
      { id: "stitch", label: "视频拼接", icon: Scissors }
    ]
  },
  {
    id: "operationsLoop",
    label: "发布与回收",
    icon: Workflow,
    children: [
      { id: "distribution", label: "发布分发", icon: Upload },
      { id: "dataRecovery", label: "数据回收", icon: Activity },
      { id: "aiReview", label: "AI 复盘迭代", icon: Brain }
    ]
  },
  {
    id: "taskCenter",
    label: "任务中心",
    icon: Clipboard,
    children: [
      { id: "tasks", label: "任务看板", icon: Clipboard },
      { id: "libtv", label: "视频任务", icon: Video },
      { id: "assets", label: "素材与输出", icon: FolderOpen }
    ]
  },
  {
    id: "systemManage",
    label: "系统管理",
    icon: Settings,
    children: [
      { id: "settings", label: "我的", icon: Settings }
    ]
  }
];

const mobileTabItems = [
  { id: "overview", label: "首页", icon: LayoutDashboard, activePages: ["overview"] },
  { id: "inspiration", label: "创意", icon: Sparkles, activePages: ["inspiration", "textImage"] },
  { id: "assets", label: "资产", icon: FolderOpen, activePages: ["assets", "tasks", "libtv"] },
  { id: "settings", label: "我的", icon: Settings, activePages: ["settings"] }
];

const mobileRootPageIds = new Set(mobileTabItems.map((item) => item.id));
const mobileDefaultReturnTargets = {
  studio: "overview",
  batch: "overview",
  stitch: "overview",
  textImage: "inspiration",
  tasks: "assets",
  libtv: "assets",
  selectionAssets: "overview",
  selectionFlow: "overview",
  productAssetFlow: "overview",
  accountAssetFlow: "overview",
  distribution: "overview",
  dataRecovery: "overview",
  aiReview: "overview",
  promptWorkbench: "overview",
  operationsLoop: "overview",
  taskCenter: "assets",
  systemManage: "settings"
};

const guestPreviewPages = new Set(["overview", "inspiration"]);

const mobileCreateActions = [
  { id: "studio:images", label: "图生视频", detail: "商品图变短片", icon: Video, featured: true },
  { id: "studio:prompt", label: "文生视频", detail: "提示词做短片", icon: Play },
  { id: "textImage", label: "文生图", detail: "生成商品主图", icon: Image },
  { id: "batch", label: "批量生成", detail: "多商品一起跑", icon: ListChecks },
  { id: "stitch", label: "视频拼接", detail: "多段合成", icon: Scissors }
];

const fashionLuxuryIndoorTemplate = {
  id: "fashion-luxury-indoor-15s",
  packageName: "内置模板_女装轻奢室内空间_15秒杂志感穿搭氛围视频_V1.0",
  coverImage: "/template-covers/fashion-luxury-indoor-camellia-cover.jpg",
  productName: "女装轻奢室内空间 15 秒杂志感穿搭氛围视频",
  productCategory: "女装 / 轻奢室内空间 / 15 秒竖屏杂志感短视频",
  shortNotice: "这不是通用模板，只用于一键生成女装轻奢室内空间 15 秒杂志感穿搭氛围视频。",
  uploadRequirements: [
    "建议上传 2-3 类图片：成年女性人物参考图 + 女装服装/商品图；如果有封面图、详情页头图或品牌画报图，也可以一起上传做风格参考。",
    "服装图要清楚看到颜色、版型、领口、腰线、裙摆/裤型、面料纹理，避免模糊、遮挡、强滤镜和拼图。",
    "封面图只用于参考版式、色系、系列感、卖点表达和细节展示方式，不会强制照搬原图文字。",
    "适合连衣裙、挂脖裙、缎面裙、针织套装、轻奢套装、长裙；不适合买手店对镜自拍、街拍外景、办公室通勤风。"
  ],
  productBrief: [
    "内置模板用途：一键生成女装轻奢室内空间 15 秒杂志感穿搭氛围视频。",
    "上传图片要求：人物参考图用于锁定成年女性外貌、发型、身材比例和气质；服装图用于锁定女装颜色、版型、面料、领口、腰线、裙摆、印花、纽扣或拉链等细节；封面图/详情页头图可选上传，用于参考画报版式、色系、系列命名、细节卖点和高级感表达。",
    "适用品类：连衣裙、挂脖裙、缎面裙、针织套装、轻奢套装、长裙、衬衫套装等偏轻熟、温柔、清冷或高级感女装。",
    "默认场景：落地窗、绿植外景、浅色沙发、楼梯/玻璃栏杆、设计师酒店、会所休息区或精品展厅。",
    "默认视频：9:16 竖屏，15 秒，无口播，无价格贴纸，无购物车，无直播感；前 3 秒必须看到完整上身效果。"
  ].join("\n"),
  promptPackVersion: "V3.0",
  promptPackTextLoader: () => import("./templates/fashionPromptPackV3.js").then((module) => module.default)
};

function makeBuiltInVideoTemplate({
  id,
  packageName,
  productName,
  productCategory,
  shortNotice,
  uploadRequirements,
  useCase,
  scene,
  visualStyle,
  timeline,
  mustKeep,
  avoid
}) {
  return {
    id,
    packageName,
    productName,
    productCategory,
    shortNotice,
    uploadRequirements,
    productBrief: [
      `内置模板用途：${useCase}`,
      `适用品类：${productCategory}`,
      `上传素材要求：${uploadRequirements.join("；")}`,
      `默认场景：${scene}`,
      `默认画面：9:16 竖屏，15 秒，适合短视频投放、种草或商品展示。`
    ].join("\n"),
    promptPackText: [
      `# 内置提示词包：${productName} V1.0`,
      "",
      `模板用途：${useCase}`,
      "",
      "素材要求：",
      ...uploadRequirements.map((item, index) => `${index + 1}. ${item}`),
      "",
      "画面目标：",
      `- 场景：${scene}`,
      `- 风格：${visualStyle}`,
      `- 必须保留：${mustKeep}`,
      "",
      "15 秒时间轴：",
      ...timeline.map((item) => `- ${item}`),
      "",
      "输出要求：",
      "- 生成一段 9:16 竖屏短视频最终提示词。",
      "- 前 3 秒必须看清主体和卖点，不要只拍空镜。",
      "- 镜头要自然连贯，有轻微运镜、细节特写和完整展示。",
      "- 可出现少量氛围文字，但不要遮挡商品主体。",
      "",
      `负面提示词：${avoid}`
    ].join("\n")
  };
}

const ecommerceQuickCutTemplate = makeBuiltInVideoTemplate({
  id: "ecommerce-product-quick-cut-15s",
  packageName: "内置模板_电商爆品卖点快剪_15秒商品短视频_V1.0",
  productName: "电商爆品卖点快剪 15 秒商品短视频",
  productCategory: "通用电商 / 商品卖点 / 15 秒快剪",
  shortNotice: "适合大多数实物商品，用来快速做一条可投放的商品卖点短视频。",
  uploadRequirements: [
    "上传 1-3 张清晰商品图，最好包含正面、细节和使用场景。",
    "如果有卖点图、包装图、详情页头图，可以一起上传做信息参考。",
    "商品文字只用于识别卖点，不要照搬大段详情页文字。"
  ],
  useCase: "快速把商品图片整理成 15 秒卖点快剪视频，适合测款、上新和投放素材初稿。",
  scene: "干净电商棚拍背景、生活化使用场景、手部拿取、细节台面展示。",
  visualStyle: "明亮、干净、节奏明确，镜头从整体到细节再到使用结果。",
  mustKeep: "商品外观、颜色、材质、包装形态、核心卖点和使用方式。",
  timeline: [
    "0-2 秒：商品正面出现，画面快速建立这是哪个商品。",
    "2-5 秒：切到核心卖点特写，比如材质、结构、容量、细节。",
    "5-9 秒：展示使用动作或使用场景，让用户理解怎么用。",
    "9-12 秒：对比前后或多角度补充，突出购买理由。",
    "12-15 秒：商品回到主画面，形成干净收尾。"
  ],
  avoid: "低清晰度，水印，logo 被篡改，夸大功效，价格贴纸，购物车按钮，直播间 UI，手机状态栏，播放器按钮，错误文字，杂乱背景。"
});

const beautySkincareTemplate = makeBuiltInVideoTemplate({
  id: "beauty-skincare-clean-15s",
  packageName: "内置模板_美妆护肤清透质感_15秒种草视频_V1.0",
  productName: "美妆护肤清透质感 15 秒种草视频",
  productCategory: "美妆护肤 / 彩妆护肤 / 清透质感短视频",
  shortNotice: "适合护肤品、彩妆和香氛，强调质感展示，不写医疗功效承诺。",
  uploadRequirements: [
    "上传产品瓶身、外包装、质地或上脸/上手参考图。",
    "最好补充目标人群、香型/色号/肤感/质地等信息。",
    "不要要求生成祛病、治疗、永久改善等夸大功效。"
  ],
  useCase: "生成美妆护肤类清透质感种草视频，适合新品介绍、质地展示和短视频封面前置素材。",
  scene: "浴室台面、梳妆台、晨间自然光、干净镜面、柔和水光和浅色背景。",
  visualStyle: "清透、细腻、高级、柔光棚拍，突出质地、瓶身反光和使用氛围。",
  mustKeep: "品牌包装形态、瓶身颜色、色号/质地、产品类别和使用场景。",
  timeline: [
    "0-2 秒：产品瓶身和包装干净入画，建立高级感。",
    "2-5 秒：质地特写，比如乳液、精华、粉体或口红膏体。",
    "5-8 秒：手部取用或轻抹动作，展示肤感和延展性。",
    "8-12 秒：产品与梳妆台、镜面、花材或水光道具组合。",
    "12-15 秒：产品居中收尾，画面干净可做发布封面。"
  ],
  avoid: "医疗功效，治疗承诺，夸张前后对比，错误色号，水印，错字，大面积文字，直播促销贴纸，脏乱台面，过度磨皮。"
});

const snackDrinkTemplate = makeBuiltInVideoTemplate({
  id: "snack-drink-opening-15s",
  packageName: "内置模板_零食饮品开箱试吃_15秒氛围视频_V1.0",
  productName: "零食饮品开箱试吃 15 秒氛围视频",
  productCategory: "食品饮品 / 零食饮料 / 开箱试吃短视频",
  shortNotice: "适合零食、饮品、糕点和速食，重点做食欲感和开箱动作。",
  uploadRequirements: [
    "上传包装正面、食品实物、口味/规格图，最好有打开后的内容物。",
    "可以补充口味、适合场景、卖点和食用方式。",
    "不要生成医疗保健、减肥治疗或绝对化功效表达。"
  ],
  useCase: "把食品饮品商品图生成开箱、倒出、试吃和氛围展示短视频。",
  scene: "厨房台面、下午茶桌、便利店风格桌面、户外野餐布或办公桌零食场景。",
  visualStyle: "明亮有食欲，暖光，近景细节丰富，动作真实自然。",
  mustKeep: "包装外观、口味识别、食品形态、颜色和食用方式。",
  timeline: [
    "0-2 秒：包装正面入画，快速看到口味和品类。",
    "2-5 秒：打开包装或倒出食品，形成开箱感。",
    "5-8 秒：食品近景特写，展示质地、颗粒、气泡或拉丝。",
    "8-12 秒：手部拿取、倒入杯中或试吃动作。",
    "12-15 秒：包装和食品组合收尾，适合做种草封面。"
  ],
  avoid: "虚假功效，治疗减肥承诺，食品变形，包装文字错误，水印，脏乱厨房，过度油腻，夸张吞咽画面。"
});

const homeApplianceTemplate = makeBuiltInVideoTemplate({
  id: "home-appliance-demo-15s",
  packageName: "内置模板_家居小家电场景演示_15秒功能视频_V1.0",
  productName: "家居小家电场景演示 15 秒功能视频",
  productCategory: "家居百货 / 小家电 / 功能演示短视频",
  shortNotice: "适合小家电、收纳、清洁和家居工具，强调真实使用动作。",
  uploadRequirements: [
    "上传产品正面、侧面、配件和使用场景图。",
    "补充核心功能、适用空间、操作步骤和安全禁忌。",
    "避免只上传包装盒，最好能看清产品结构和使用方式。"
  ],
  useCase: "生成家居小家电或工具类功能演示视频，让用户一眼看懂怎么用、解决什么问题。",
  scene: "现代厨房、客厅、浴室、收纳柜、清洁台面或小户型生活空间。",
  visualStyle: "真实生活感、干净实用、镜头稳定，突出操作步骤和前后效果。",
  mustKeep: "产品结构、按钮/配件、使用姿态、功能动作和适用空间。",
  timeline: [
    "0-2 秒：产品在真实家居场景中出现，看到主体和大小比例。",
    "2-5 秒：手部操作按钮、打开盖子、安装配件或启动功能。",
    "5-9 秒：展示核心功能运行过程，比如清洁、收纳、加热、搅拌或整理。",
    "9-12 秒：展示结果或使用前后变化。",
    "12-15 秒：产品和整洁空间一起收尾，画面可信不夸张。"
  ],
  avoid: "危险操作，虚假功能，产品结构乱变，水印，错误按钮文字，夸大前后对比，脏乱场景，直播间促销 UI。"
});

const builtInPromptTemplates = [
  fashionLuxuryIndoorTemplate,
  ecommerceQuickCutTemplate,
  beautySkincareTemplate,
  snackDrinkTemplate,
  homeApplianceTemplate
];

const SettingsPage = React.lazy(() => import("./features/settings/SettingsPage.jsx"));
const LazyVideoStitchPage = React.lazy(() => import("./features/stitch/VideoStitchPage.jsx"));
const LazyTextImagePage = React.lazy(() => import("./features/textImage/TextImagePage.jsx"));
const LazyAssetsPage = React.lazy(() => import("./features/assets/AssetsPage.jsx"));
const LazyBatchPage = React.lazy(() => import("./features/batch/BatchPage.jsx"));
const LazyMobileInspirationPage = React.lazy(() => import("./features/inspiration/MobileInspirationPage.jsx"));
const LazyWorkflowModulePage = React.lazy(() => import("./features/workflow/WorkflowModulePage.jsx"));
const LazyLoginPromptSheet = React.lazy(() => import("./features/auth/LoginPromptSheet.jsx"));
const LazyTasksPage = React.lazy(() => import("./features/tasks/TaskPages.jsx").then((module) => ({ default: module.TasksPage })));
const LazyLibtvPage = React.lazy(() => import("./features/tasks/TaskPages.jsx").then((module) => ({ default: module.LibtvPage })));

const workflowModulePages = {
  selectionFlow: {
    title: "选品流程",
    subtitle: "按闭环流程展示选品、数据采集、比较评分和动态评分库，形成可以进入视频生成的候选商品池。",
    stage: "流程导航",
    steps: ["选品", "数据采集", "比较评分", "动态评分库"],
    actions: [
      { label: "去批量生成", page: "batch" },
      { label: "查看生产总览", page: "overview" }
    ]
  },
  productAssetFlow: {
    title: "商品资产",
    subtitle: "整理商品资料、商品图片和入库出库流程，作为提示词和视频生成的上游资料。",
    stage: "流程导航",
    steps: ["商品资料库", "商品信息", "商品图片", "入库及出库流程"],
    actions: [
      { label: "去批量生成", page: "batch" },
      { label: "去单条视频", page: "studio" }
    ]
  },
  accountAssetFlow: {
    title: "账号资产",
    subtitle: "展示账号资产库、账号人物信息、账号场景信息和账号初始 DOC 包，用于绑定发布身份和内容风格。",
    stage: "流程导航",
    steps: ["账号资产库", "账号人物信息", "账号场景信息", "账号初始 DOC 包"],
    actions: [
      { label: "去提示词工作台", page: "studio" },
      { label: "去发布分发", page: "distribution" }
    ]
  },
  productScoring: {
    title: "选品评分",
    subtitle: "从选品数据、佣金、趋势、竞争价和时效里形成可排序的商品评分。",
    stage: "规划接入",
    steps: ["接入选品数据", "配置评分维度", "输出动态评分表", "同步到商品资料"],
    actions: [
      { label: "去批量生成", page: "batch" },
      { label: "查看任务看板", page: "tasks" }
    ]
  },
  productLibrary: {
    title: "商品资料库",
    subtitle: "集中管理商品信息、商品图片、类别、卖点、库存流转和生成记录。",
    stage: "规划接入",
    steps: ["商品入库", "商品图片归档", "关联生成任务", "同步数据回收结果"],
    actions: [
      { label: "去单条视频", page: "studio" },
      { label: "查看素材输出", page: "assets" }
    ]
  },
  accountAssets: {
    title: "账号资产库",
    subtitle: "管理账号人物信息、账号场景信息、账号初始 DOC 包和人设素材。",
    stage: "规划接入",
    steps: ["账号资料入库", "人设与场景配置", "DOC 包版本管理", "绑定发布平台"],
    actions: [
      { label: "去提示词工作台", page: "studio" },
      { label: "去我的设置", page: "settings" }
    ]
  },
  distribution: {
    title: "发布分发",
    subtitle: "管理发布平台、关键词、音乐、发布时间、账号和自动化分发状态。",
    stage: "规划接入",
    steps: ["选择成片", "配置平台与账号", "设置关键词和音乐", "记录发布状态"],
    actions: [
      { label: "去视频拼接", page: "stitch" },
        { label: "查看视频任务", page: "libtv" }
    ]
  },
  dataRecovery: {
    title: "数据回收",
    subtitle: "回收播放、点赞、评论、转化和账号面板数据，形成可复盘的数据记录。",
    stage: "规划接入",
    steps: ["拉取平台数据", "整理账号面板", "保存数据记录", "触发 AI 分析"],
    actions: [
      { label: "查看任务看板", page: "tasks" },
      { label: "查看素材输出", page: "assets" }
    ]
  },
  aiReview: {
    title: "AI 复盘迭代",
    subtitle: "让 AI 读取数据结果，生成 DOC 包优化建议和下一轮测试方向。",
    stage: "规划接入",
    steps: ["读取回收数据", "分析人群与内容表现", "生成测试方向", "迭代 DOC 包"],
    actions: [
      { label: "去批量生成", page: "batch" },
      { label: "去我的设置", page: "settings" }
    ]
  }
};

const selectionScoreDimensions = [
  { key: "ai", label: "AI 出片", weight: 15 },
  { key: "demand", label: "节点需求", weight: 15 },
  { key: "card", label: "承接", weight: 15 },
  { key: "profit", label: "价格利润", weight: 15 },
  { key: "presale", label: "售前", weight: 10 },
  { key: "aftersale", label: "售后", weight: 10 },
  { key: "supply", label: "履约", weight: 10 },
  { key: "compliance", label: "合规", weight: 10 }
];

const selectionMarketSignals = [
  {
    id: "search-card",
    label: "搜索承接",
    title: "短视频、搜索、商品卡要一起看",
    evidence: "2026 抖音商城 618 第一阶段里，短视频成交额破千万元商家数同比增长 100%，搜索成交额破千万元商家数同比增长 161%。",
    implication: "能拍好但搜不到、主图不清、详情页承接弱的 SKU，不进入第一批放量。",
    sourceLabel: "抖音商城 618 第一阶段数据",
    sourceUrl: "https://www.ithome.com/0/953/959.htm",
    tone: "good"
  },
  {
    id: "aigc-label",
    label: "AI 标识",
    title: "AI 生成内容必须可识别",
    evidence: "《人工智能生成合成内容标识办法》已于 2025-09-01 施行，生成合成图片、视频、音频、文本等内容需要按规则标识。",
    implication: "AI 图和 AI 视频不能冒充真实测评、真实试用、名人推荐或品牌官方素材。",
    sourceLabel: "国家网信办",
    sourceUrl: "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm",
    tone: "warn"
  },
  {
    id: "platform-rules",
    label: "平台规则",
    title: "虚假宣传、价格不一致、授权不清先拦截",
    evidence: "抖音电商学习中心持续把商品发布、违规宣传、价格表达、资质授权作为商家规则入口。",
    implication: "凡是功效、授权、价格、适配和资质说不清的 SKU，先补证据，不直接生成批次。",
    sourceLabel: "抖音电商学习中心",
    sourceUrl: "https://school.jinritemai.com/doudian/web/home?from=buying_rules%2F1000",
    tone: "bad"
  },
  {
    id: "live-commerce-verification",
    label: "选品核验",
    title: "直播电商选品需要留下核验依据",
    evidence: "市场监管总局、国家网信办发布《直播电商监督管理办法》，明确直播营销人员服务机构在商业合作和直播选品中履行必要核验义务，2026-02-01 起施行。",
    implication: "资质、价格、性能、用户评价、授权和履约说不清的 SKU，先补证据包，不直接进批次。",
    sourceLabel: "市场监管总局 / 国家网信办",
    sourceUrl: "https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2026/art_ce66ea61fcec4583b5dbd677f470088b.html",
    tone: "warn"
  },
  {
    id: "season-node",
    label: "节点窗口",
    title: "节点品只做低风险边缘品",
    evidence: "调研文档把雨季、暑期、端午、毕业季、父亲节、世界杯观赛拆成节点池，但要求优先低价、低解释、低售后 SKU。",
    implication: "节点热不等于可测，食品、IP、功效、复杂尺码和高客单要降权。",
    sourceLabel: "本地选品调研",
    sourceUrl: "/00_docs/AI短视频带货选品调研整合.md",
    tone: "info"
  }
];

const selectionResearchSourceTemplates = [
  {
    id: "rule-aigc-label-2025",
    type: "AIGC合规",
    label: "人工智能生成合成内容标识办法",
    url: "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm",
    note: "AI 生成图片、视频、音频、文本等内容需要按规则显式或隐式标识，不能冒充真实测评、真人试用或品牌官方素材。",
    always: true,
    priority: 30
  },
  {
    id: "rule-live-commerce-2026",
    type: "监管规则",
    label: "直播电商监督管理办法",
    url: "https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2026/art_ce66ea61fcec4583b5dbd677f470088b.html",
    note: "直播电商选品需要保留必要核验依据，资质、价格、性能、用户评价、授权和履约说不清时先补证据包。",
    always: true,
    priority: 28
  },
  {
    id: "rule-network-platform-2026",
    type: "监管规则",
    label: "网络交易平台规则监督管理办法",
    url: "https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2026/art_85b474fc5a08494bb60ca6a280b98d7d.html",
    note: "平台规则调整、经营者权益和争议处理需要可追溯，选品口径要跟随平台最新规则复核。",
    always: true,
    priority: 27
  },
  {
    id: "rule-douyin-learning",
    type: "平台规则",
    label: "抖音电商学习中心",
    url: "https://school.jinritemai.com/doudian/web/home?from=buying_rules%2F1000",
    note: "商品发布、价格表达、虚假宣传、资质授权和违规治理的规则入口，作为抖音带货 SKU 的基础平台依据。",
    always: true,
    priority: 26
  },
  {
    id: "source-local-selection-logic",
    type: "本地调研",
    label: "AI短视频带货选品调研整合",
    url: "/00_docs/AI短视频带货选品调研整合.md",
    note: "本地选品逻辑、节点池、低风险边缘品和资产预检规则。",
    always: true,
    priority: 12
  }
];

const selectionHardRules = [
  {
    id: "aigc-real-effect",
    label: "AI 伪造试用/效果",
    matchTerms: ["真实", "效果", "测试", "防水", "防滑", "适口性", "前后"],
    action: "必须使用真实素材表达效果，AI 只能做场景衔接和非关键画面。"
  },
  {
    id: "medical-function",
    label: "医疗/保健/功效",
    matchTerms: ["医疗", "保健", "理疗", "药", "治", "杀菌", "消毒", "降压", "修复", "驱邪"],
    action: "不得写治疗、保健、杀菌、改善慢病等功效承诺。"
  },
  {
    id: "brand-ip",
    label: "品牌/IP/非遗授权",
    matchTerms: ["授权", "品牌", "FIFA", "世界杯", "球队", "球员", "非遗", "老字号", "同款"],
    action: "没有授权、来源和背书证明，不进批次，不写官方同款。"
  },
  {
    id: "food-pet-child",
    label: "食品/宠物/儿童资质",
    matchTerms: ["食品", "零食", "猫条", "冻干", "宠物食品", "儿童", "常温"],
    action: "先看资质、保质期、履约和售后评价，再决定是否小样本测试。"
  },
  {
    id: "card-price",
    label: "商品卡与价格一致",
    matchTerms: ["价格", "券", "满减", "会员", "到手价", "规格", "适配"],
    action: "视频承诺必须和商品卡标题、主图、价格、规格、发货时效一致。"
  }
];

const selectionProducts = [
  {
    id: "dehumidifier-bag",
    rank: 1,
    sku: "衣柜除湿袋",
    category: "雨季防潮",
    node: "梅雨季 6/1-7/15",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 88,
    priceBand: "29-59",
    commission: "中",
    coreReason: "雨季刚需，痛点强，低价低解释成本，适合衣柜/宿舍/鞋柜场景。",
    videoAngles: ["衣柜潮湿", "宿舍防潮", "鞋柜除味"],
    primaryTemplate: "痛点演示型",
    riskLevel: "低",
    riskTags: ["不夸大杀菌", "防霉话术谨慎"],
    vetoFlags: [],
    assetGaps: ["真实使用前后图待补"],
    whiteList: ["衣柜防潮", "宿舍收纳", "梅雨季备用", "吸湿袋更换提醒"],
    bannedWords: ["杀菌除螨", "根治霉菌", "消毒级"],
    cardCheck: { title: "有场景词", image: "需补场景主图", detail: "规格清楚", price: "一致", reviews: "气味差评需看", fulfillment: "节点可赶" },
    scores: { ai: 14, demand: 15, card: 13, profit: 14, presale: 10, aftersale: 9, supply: 8, compliance: 9 }
  },
  {
    id: "waterproof-phone-pouch",
    rank: 2,
    sku: "防水手机袋",
    category: "玩水出行",
    node: "暑期/毕业旅行",
    lifecycle: "待补资产",
    assetStatus: "缺真实测试",
    assetPercent: 72,
    priceBand: "19-49",
    commission: "中",
    coreReason: "水乐园、海边、漂流都能切入，搜索问题明确，适合清单型内容。",
    videoAngles: ["水乐园清单", "毕业旅行防漏带", "海边拍照"],
    primaryTemplate: "场景清单型",
    riskLevel: "中",
    riskTags: ["防水效果需真实", "适配尺寸讲清"],
    vetoFlags: [],
    assetGaps: ["真实防水测试素材", "适配机型表"],
    whiteList: ["触屏拍照", "挂脖便携", "玩水收纳", "旅行备用"],
    bannedWords: ["绝对不进水", "潜水级", "全机型通用"],
    cardCheck: { title: "核心词完整", image: "场景清楚", detail: "适配表待补", price: "一致", reviews: "漏水差评需看", fulfillment: "节点可赶" },
    scores: { ai: 14, demand: 14, card: 13, profit: 14, presale: 9, aftersale: 8, supply: 8, compliance: 8 }
  },
  {
    id: "ice-sleeves",
    rank: 3,
    sku: "冰袖",
    category: "夏季清凉",
    node: "高温通勤",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 84,
    priceBand: "19-39",
    commission: "中",
    coreReason: "夏季高频低价，通勤、骑行、户外运动都有明确画面。",
    videoAngles: ["通勤防晒", "户外运动", "开车防晒"],
    primaryTemplate: "痛点演示型",
    riskLevel: "低",
    riskTags: ["不说绝对防晒", "材质真实"],
    vetoFlags: [],
    assetGaps: ["UPF 参数截图待补"],
    whiteList: ["轻薄", "弹力", "通勤", "户外备用"],
    bannedWords: ["100% 防晒", "医学级防护", "降温多少度"],
    cardCheck: { title: "有夏季词", image: "商品清楚", detail: "参数待补", price: "一致", reviews: "尺码差评需看", fulfillment: "稳定" },
    scores: { ai: 13, demand: 15, card: 12, profit: 14, presale: 9, aftersale: 8, supply: 8, compliance: 8 }
  },
  {
    id: "sun-hat",
    rank: 4,
    sku: "防晒帽",
    category: "夏季清凉",
    node: "高温出游",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 82,
    priceBand: "39-99",
    commission: "中",
    coreReason: "人群和场景宽，通勤、出游、父亲节礼物都能复用。",
    videoAngles: ["出游防晒", "父亲节实用礼物", "通勤遮阳"],
    primaryTemplate: "搜索答案型",
    riskLevel: "低",
    riskTags: ["防晒参数谨慎", "避免显瘦夸大"],
    vetoFlags: [],
    assetGaps: ["真实佩戴图待补"],
    whiteList: ["大帽檐", "通勤遮阳", "可折叠", "出游备用"],
    bannedWords: ["100% 防晒", "医用防护", "晒不黑"],
    cardCheck: { title: "场景词可加强", image: "佩戴图待补", detail: "帽围清楚", price: "一致", reviews: "版型差评需看", fulfillment: "稳定" },
    scores: { ai: 13, demand: 14, card: 13, profit: 14, presale: 9, aftersale: 8, supply: 8, compliance: 8 }
  },
  {
    id: "quick-dry-towel",
    rank: 5,
    sku: "速干毛巾",
    category: "玩水出行",
    node: "暑期/宿舍",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 86,
    priceBand: "29-69",
    commission: "中",
    coreReason: "玩水、健身、露营、宿舍通用，售后风险较低。",
    videoAngles: ["玩水清单", "健身包", "宿舍备用"],
    primaryTemplate: "场景清单型",
    riskLevel: "低",
    riskTags: ["材质描述真实", "吸水效果不过度"],
    vetoFlags: [],
    assetGaps: ["包装规格图待补"],
    whiteList: ["轻便", "收纳袋", "旅行备用", "运动后擦汗"],
    bannedWords: ["瞬间干", "永不发臭", "杀菌"],
    cardCheck: { title: "核心词完整", image: "商品清楚", detail: "尺寸清楚", price: "一致", reviews: "掉毛差评需看", fulfillment: "稳定" },
    scores: { ai: 13, demand: 14, card: 13, profit: 13, presale: 9, aftersale: 9, supply: 8, compliance: 9 }
  },
  {
    id: "phone-cooler",
    rank: 6,
    sku: "手机散热器",
    category: "夏季清凉",
    node: "高温/观赛/游戏",
    lifecycle: "待补资产",
    assetStatus: "缺适配信息",
    assetPercent: 68,
    priceBand: "59-129",
    commission: "中",
    coreReason: "高温和游戏场景明显，但电器售后和机型适配要先讲清。",
    videoAngles: ["游戏发热", "看球熬夜", "通勤刷视频"],
    primaryTemplate: "痛点演示型",
    riskLevel: "中",
    riskTags: ["适配型号", "电器质检"],
    vetoFlags: [],
    assetGaps: ["适配型号表", "质检/参数截图", "真实工作素材"],
    whiteList: ["背夹散热", "游戏辅助", "夏季备用", "机型适配表"],
    bannedWords: ["降温多少度", "所有手机通用", "永久保护电池"],
    cardCheck: { title: "核心词完整", image: "主图可用", detail: "适配待补", price: "一致", reviews: "噪音差评需看", fulfillment: "稳定" },
    scores: { ai: 14, demand: 13, card: 12, profit: 12, presale: 8, aftersale: 7, supply: 7, compliance: 8 }
  },
  {
    id: "desk-fan",
    rank: 7,
    sku: "桌面小风扇",
    category: "夏季清凉",
    node: "宿舍/办公室",
    lifecycle: "待补资产",
    assetStatus: "缺质检信息",
    assetPercent: 70,
    priceBand: "39-99",
    commission: "中",
    coreReason: "夏季刚需，场景好做，但电器类要检查质检和售后。",
    videoAngles: ["宿舍降温", "办公桌面", "客厅观赛"],
    primaryTemplate: "搜索答案型",
    riskLevel: "中",
    riskTags: ["电器安全", "续航噪音"],
    vetoFlags: [],
    assetGaps: ["质检信息", "续航参数", "噪音描述"],
    whiteList: ["桌面使用", "小空间送风", "可充电", "宿舍办公室"],
    bannedWords: ["空调级降温", "静音无声", "整屋降温"],
    cardCheck: { title: "场景词完整", image: "商品清楚", detail: "参数待补", price: "一致", reviews: "续航差评需看", fulfillment: "稳定" },
    scores: { ai: 13, demand: 15, card: 12, profit: 12, presale: 8, aftersale: 7, supply: 7, compliance: 8 }
  },
  {
    id: "mugwort-sachet",
    rank: 8,
    sku: "艾草香囊",
    category: "端午香氛",
    node: "端午 6/19-6/21",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 80,
    priceBand: "19-59",
    commission: "中",
    coreReason: "端午、国风、礼物三类内容可复用，情绪价值强。",
    videoAngles: ["端午氛围", "车内香包", "国风小礼物"],
    primaryTemplate: "故事种草型",
    riskLevel: "中",
    riskTags: ["不讲医疗功效", "非遗背书需真实"],
    vetoFlags: [],
    assetGaps: ["香型说明", "授权/非遗背书待确认"],
    whiteList: ["端午氛围", "衣柜车内", "国风挂件", "小礼物"],
    bannedWords: ["治病", "驱邪保健康", "杀菌消毒", "非遗大师同款"],
    cardCheck: { title: "节点词完整", image: "包装清楚", detail: "香型待补", price: "一致", reviews: "气味差评需看", fulfillment: "节点可赶" },
    scores: { ai: 14, demand: 14, card: 12, profit: 13, presale: 8, aftersale: 8, supply: 8, compliance: 7 }
  },
  {
    id: "car-fragrance",
    rank: 9,
    sku: "车载香氛",
    category: "父亲节礼赠",
    node: "父亲节 6/21",
    lifecycle: "待补资产",
    assetStatus: "缺授权/香型",
    assetPercent: 66,
    priceBand: "39-129",
    commission: "中",
    coreReason: "父亲节和通勤车内场景好做，但品牌和香味描述要谨慎。",
    videoAngles: ["爸爸车里", "通勤礼物", "车内小物"],
    primaryTemplate: "搜索答案型",
    riskLevel: "中",
    riskTags: ["品牌授权", "香味主观"],
    vetoFlags: [],
    assetGaps: ["品牌授权", "香型说明", "真实车内图"],
    whiteList: ["车内淡香", "实用礼物", "通勤场景", "摆件质感"],
    bannedWords: ["大牌同款", "治晕车", "净化甲醛"],
    cardCheck: { title: "父亲节词待补", image: "场景待补", detail: "香型待补", price: "一致", reviews: "味道差评需看", fulfillment: "节点可赶" },
    scores: { ai: 12, demand: 13, card: 11, profit: 12, presale: 7, aftersale: 7, supply: 7, compliance: 7 }
  },
  {
    id: "cat-scratcher",
    rank: 10,
    sku: "猫抓板",
    category: "宠物用品",
    node: "常青消耗品",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 78,
    priceBand: "29-99",
    commission: "中",
    coreReason: "猫用品低风险入口，能做家具保护和日常消耗场景。",
    videoAngles: ["猫咪日常", "家具保护", "租房养猫"],
    primaryTemplate: "痛点演示型",
    riskLevel: "低",
    riskTags: ["不伪造试用", "材质真实"],
    vetoFlags: [],
    assetGaps: ["真实宠物素材待补"],
    whiteList: ["磨爪", "消耗替换", "猫咪日常", "家具保护"],
    bannedWords: ["保证爱用", "治疗焦虑", "所有猫都喜欢"],
    cardCheck: { title: "核心词完整", image: "商品清楚", detail: "尺寸清楚", price: "一致", reviews: "掉屑差评需看", fulfillment: "稳定" },
    scores: { ai: 12, demand: 12, card: 12, profit: 13, presale: 9, aftersale: 8, supply: 8, compliance: 9 }
  },
  {
    id: "lint-roller",
    rank: 11,
    sku: "粘毛器",
    category: "宠物/家清",
    node: "常青家清",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 82,
    priceBand: "19-49",
    commission: "中",
    coreReason: "宠物和家清都能用，效果展示直观，低价低售后。",
    videoAngles: ["衣服粘毛", "沙发清洁", "养宠出门前"],
    primaryTemplate: "痛点演示型",
    riskLevel: "低",
    riskTags: ["效果真实", "耗材规格"],
    vetoFlags: [],
    assetGaps: ["耗材规格图待补"],
    whiteList: ["衣服粘毛", "沙发清洁", "可替换纸芯", "养宠家庭"],
    bannedWords: ["一次清干净所有毛", "永久免清洁", "杀菌"],
    cardCheck: { title: "核心词完整", image: "效果图需真实", detail: "替换装清楚", price: "一致", reviews: "粘性差评需看", fulfillment: "稳定" },
    scores: { ai: 14, demand: 12, card: 13, profit: 13, presale: 9, aftersale: 9, supply: 8, compliance: 9 }
  },
  {
    id: "luggage-organizer",
    rank: 12,
    sku: "行李收纳袋",
    category: "毕业旅行",
    node: "高考后/暑期",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 84,
    priceBand: "29-79",
    commission: "中",
    coreReason: "毕业旅行、准大学生宿舍、短途出差都能复用。",
    videoAngles: ["准大学生清单", "毕业旅行", "行李箱整理"],
    primaryTemplate: "场景清单型",
    riskLevel: "低",
    riskTags: ["尺寸讲清", "容量不过度"],
    vetoFlags: [],
    assetGaps: ["尺寸对比图待补"],
    whiteList: ["分类收纳", "行李箱整理", "宿舍搬家", "旅行备用"],
    bannedWords: ["容量翻倍", "所有行李箱通用", "压缩真空"],
    cardCheck: { title: "人群词完整", image: "收纳场景清楚", detail: "尺寸待补", price: "一致", reviews: "拉链差评需看", fulfillment: "稳定" },
    scores: { ai: 13, demand: 14, card: 13, profit: 13, presale: 9, aftersale: 8, supply: 8, compliance: 9 }
  },
  {
    id: "dorm-desk-lamp",
    rank: 13,
    sku: "宿舍台灯",
    category: "毕业/开学",
    node: "高考后预热",
    lifecycle: "待补资产",
    assetStatus: "缺质检信息",
    assetPercent: 67,
    priceBand: "59-159",
    commission: "中",
    coreReason: "准大学生清单强，但用电安全和护眼话术要先控制。",
    videoAngles: ["宿舍桌面改造", "准大学生清单", "夜间小灯"],
    primaryTemplate: "搜索答案型",
    riskLevel: "中",
    riskTags: ["用电安全", "护眼话术谨慎"],
    vetoFlags: [],
    assetGaps: ["质检信息", "功率参数", "光照参数"],
    whiteList: ["可调光", "桌面小夜灯", "宿舍桌面", "USB 供电"],
    bannedWords: ["治疗近视", "医学护眼", "零蓝光"],
    cardCheck: { title: "人群词完整", image: "桌面场景待补", detail: "参数待补", price: "一致", reviews: "闪烁差评需看", fulfillment: "稳定" },
    scores: { ai: 12, demand: 13, card: 12, profit: 11, presale: 8, aftersale: 7, supply: 7, compliance: 7 }
  },
  {
    id: "guofeng-pendant",
    rank: 14,
    sku: "国风挂饰",
    category: "国风礼赠",
    node: "端午/毕业礼物",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 78,
    priceBand: "19-69",
    commission: "中",
    coreReason: "国风礼物低价低决策，适合故事种草和礼物清单。",
    videoAngles: ["国风小礼物", "端午氛围", "毕业纪念"],
    primaryTemplate: "故事种草型",
    riskLevel: "中",
    riskTags: ["不伪造非遗", "材质真实"],
    vetoFlags: [],
    assetGaps: ["材质/工艺说明待补"],
    whiteList: ["国风挂件", "小礼物", "包包挂饰", "节日氛围"],
    bannedWords: ["非遗传承人亲制", "大师同款", "开运保平安"],
    cardCheck: { title: "节点词完整", image: "商品清楚", detail: "材质待补", price: "一致", reviews: "做工差评需看", fulfillment: "节点可赶" },
    scores: { ai: 13, demand: 13, card: 12, profit: 13, presale: 9, aftersale: 8, supply: 8, compliance: 7 }
  },
  {
    id: "bathroom-nonslip-mat",
    rank: 15,
    sku: "浴室防滑垫",
    category: "雨季/银发",
    node: "雨季家居",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 80,
    priceBand: "29-89",
    commission: "中",
    coreReason: "雨季、银发、家居安全都能切入，画面直观。",
    videoAngles: ["浴室湿滑", "爸妈家小物", "雨季家居"],
    primaryTemplate: "痛点演示型",
    riskLevel: "中",
    riskTags: ["防滑效果真实", "不制造恐吓"],
    vetoFlags: [],
    assetGaps: ["防滑底部细节图待补"],
    whiteList: ["浴室防滑", "吸水", "可裁剪", "家居备用"],
    bannedWords: ["绝对不滑", "防摔神器", "老人必买"],
    cardCheck: { title: "核心词完整", image: "使用场景清楚", detail: "尺寸清楚", price: "一致", reviews: "异味差评需看", fulfillment: "稳定" },
    scores: { ai: 13, demand: 13, card: 13, profit: 12, presale: 9, aftersale: 8, supply: 8, compliance: 8 }
  },
  {
    id: "watch-snack-box",
    rank: 16,
    sku: "观赛零食礼盒",
    category: "观赛场景",
    node: "世界杯 6/11-7/19",
    lifecycle: "待补资产",
    assetStatus: "缺食品资质",
    assetPercent: 58,
    priceBand: "49-129",
    commission: "中",
    coreReason: "世界杯观赛场景强，但食品资质、保质期和 IP 表达要先卡住。",
    videoAngles: ["宿舍看球", "客厅观赛", "熬夜零食"],
    primaryTemplate: "场景清单型",
    riskLevel: "高",
    riskTags: ["食品资质", "世界杯 IP 避让"],
    vetoFlags: [],
    assetGaps: ["食品资质", "保质期", "配料表", "IP 避让标题"],
    whiteList: ["观赛零食", "宿舍分享", "常温礼盒", "熬夜小食"],
    bannedWords: ["世界杯官方", "FIFA 同款", "球星推荐", "保健提神"],
    cardCheck: { title: "需去 IP 化", image: "礼盒清楚", detail: "资质待补", price: "一致", reviews: "临期差评需看", fulfillment: "节点可赶" },
    scores: { ai: 12, demand: 14, card: 9, profit: 11, presale: 7, aftersale: 6, supply: 6, compliance: 5 }
  },
  {
    id: "thermos-cup",
    rank: 17,
    sku: "保温杯",
    category: "父亲节/银发",
    node: "父亲节 6/21",
    lifecycle: "待补资产",
    assetStatus: "缺品牌授权",
    assetPercent: 62,
    priceBand: "59-199",
    commission: "中",
    coreReason: "父亲节和通勤礼物都能做，但品牌授权和材质参数要确认。",
    videoAngles: ["父亲节实用礼物", "通勤水杯", "爸妈家小物"],
    primaryTemplate: "搜索答案型",
    riskLevel: "中",
    riskTags: ["品牌授权", "材质参数"],
    vetoFlags: [],
    assetGaps: ["品牌授权", "材质参数", "容量规格"],
    whiteList: ["保温", "通勤", "礼物", "容量选择"],
    bannedWords: ["大牌平替", "保温 48 小时", "养生治病"],
    cardCheck: { title: "礼物词待补", image: "商品清楚", detail: "参数待补", price: "一致", reviews: "掉漆差评需看", fulfillment: "稳定" },
    scores: { ai: 11, demand: 12, card: 10, profit: 10, presale: 8, aftersale: 7, supply: 7, compliance: 6 }
  },
  {
    id: "pill-organizer",
    rank: 18,
    sku: "药盒收纳",
    category: "银发便利",
    node: "常青适老",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 76,
    priceBand: "19-59",
    commission: "中",
    coreReason: "生活便利型银发商品，低价低解释，不触碰药效即可测试。",
    videoAngles: ["爸妈生活小物", "一周收纳", "出门备用"],
    primaryTemplate: "搜索答案型",
    riskLevel: "中",
    riskTags: ["不导向药效", "不制造健康焦虑"],
    vetoFlags: [],
    assetGaps: ["容量分格图待补"],
    whiteList: ["分格收纳", "出门备用", "提醒分类", "爸妈生活小物"],
    bannedWords: ["按时吃药病就好", "专家推荐", "慢病改善"],
    cardCheck: { title: "人群词完整", image: "分格清楚", detail: "容量待补", price: "一致", reviews: "盖子松差评需看", fulfillment: "稳定" },
    scores: { ai: 11, demand: 11, card: 12, profit: 12, presale: 9, aftersale: 8, supply: 8, compliance: 7 }
  },
  {
    id: "makeup-organizer",
    rank: 19,
    sku: "化妆收纳",
    category: "美妆边缘品",
    node: "常青整理",
    lifecycle: "可测",
    assetStatus: "可生成",
    assetPercent: 82,
    priceBand: "29-99",
    commission: "中",
    coreReason: "美妆低风险边缘品，适合桌面整理前后对比。",
    videoAngles: ["桌面整理", "宿舍梳妆台", "旅行归纳"],
    primaryTemplate: "痛点演示型",
    riskLevel: "低",
    riskTags: ["容量真实", "材质真实"],
    vetoFlags: [],
    assetGaps: ["容量对比图待补"],
    whiteList: ["桌面整理", "分区收纳", "防尘", "宿舍梳妆台"],
    bannedWords: ["容量翻倍", "高级亚克力同款", "永不发黄"],
    cardCheck: { title: "核心词完整", image: "整理场景清楚", detail: "尺寸清楚", price: "一致", reviews: "开裂差评需看", fulfillment: "稳定" },
    scores: { ai: 13, demand: 11, card: 13, profit: 13, presale: 9, aftersale: 8, supply: 8, compliance: 9 }
  },
  {
    id: "camping-light",
    rank: 20,
    sku: "露营小灯",
    category: "运动户外",
    node: "露营/夜间观赛",
    lifecycle: "待补资产",
    assetStatus: "缺电器参数",
    assetPercent: 64,
    priceBand: "39-129",
    commission: "中",
    coreReason: "露营、阳台、看球氛围都能做，但电器安全和续航要确认。",
    videoAngles: ["露营夜灯", "阳台氛围", "客厅观赛"],
    primaryTemplate: "场景清单型",
    riskLevel: "中",
    riskTags: ["电器安全", "续航参数"],
    vetoFlags: [],
    assetGaps: ["质检信息", "续航参数", "防水等级"],
    whiteList: ["露营氛围", "阳台小灯", "USB 充电", "夜间照明"],
    bannedWords: ["超长续航无上限", "防水潜水", "官方赛事氛围灯"],
    cardCheck: { title: "场景词完整", image: "场景待补", detail: "参数待补", price: "一致", reviews: "续航差评需看", fulfillment: "稳定" },
    scores: { ai: 13, demand: 12, card: 11, profit: 11, presale: 8, aftersale: 7, supply: 7, compliance: 7 }
  }
];

const accountAssetSeeds = [
  {
    id: "life-goods",
    name: "生活好物号",
    position: "低价实用、场景清单、搜索答案",
    fit: ["夏季清凉", "玩水出行", "毕业旅行", "父亲节礼赠"],
    avoid: ["强医疗功效", "无授权 IP", "高客单复杂电器"],
    tone: "直接、轻解释、强调适用和不适用",
    scenes: ["宿舍", "办公室", "通勤", "旅行箱"],
    docPacks: ["低价实用清单 DOC v1", "搜索答案型 DOC v1"],
    recommended: ["防水手机袋", "冰袖", "速干毛巾", "行李收纳袋"],
    lastSignal: "适合承接低决策、节点强、3 秒能懂的 SKU。"
  },
  {
    id: "home-storage",
    name: "家居收纳号",
    position: "防潮、清洁、整理、家居安全",
    fit: ["雨季防潮", "宠物/家清", "银发便利", "美妆边缘品"],
    avoid: ["食品功效", "宠物药品", "夸大实验"],
    tone: "问题先行，展示前后变化，避免夸张承诺",
    scenes: ["衣柜", "浴室", "鞋柜", "梳妆台", "客厅"],
    docPacks: ["痛点演示 DOC v1", "收纳整理 DOC v1"],
    recommended: ["衣柜除湿袋", "粘毛器", "浴室防滑垫", "化妆收纳"],
    lastSignal: "适合把资产缺口转成补拍清单，再进入批量生成。"
  },
  {
    id: "festival-gift",
    name: "礼物/国风/节日号",
    position: "节日礼物、国风氛围、送礼不尴尬",
    fit: ["端午香氛", "国风礼赠", "父亲节礼赠"],
    avoid: ["伪造非遗背书", "品牌无授权", "强功效香氛"],
    tone: "克制种草，强调礼物场景和日常可用",
    scenes: ["车内", "礼盒包装", "桌面", "包包挂饰"],
    docPacks: ["故事种草 DOC v1", "节日礼物清单 DOC v1"],
    recommended: ["艾草香囊", "国风挂饰", "车载香氛", "保温杯"],
    lastSignal: "适合节点窗口明确的 SKU，过期后要自动降权。"
  },
  {
    id: "pet-daily",
    name: "宠物日常号",
    position: "猫用品、家清消耗、低风险宠物周边",
    fit: ["宠物用品", "宠物/家清"],
    avoid: ["宠物主粮", "驱虫药", "宠物保健"],
    tone: "不伪造试吃试用，不承诺所有宠物都适合",
    scenes: ["客厅", "沙发", "猫砂盆周边", "出门前"],
    docPacks: ["宠物低风险用品 DOC v1", "痛点演示 DOC v1"],
    recommended: ["猫抓板", "粘毛器"],
    lastSignal: "先测低风险消耗品，不碰治疗和适口性承诺。"
  }
];

const accountPlatformRulePresets = {
  抖音: {
    platform: "抖音",
    publishTarget: "短视频带货 + 商品卡",
    aigcLabel: "发布时按平台入口标识 AI 辅助创作",
    commerceRule: "商品标题、主图、价格、规格和视频承诺保持一致",
    avoid: ["AI 仿冒名人推荐", "伪造试用效果", "价格与商品卡不一致", "无授权品牌/IP"]
  },
  视频号: {
    platform: "视频号",
    publishTarget: "视频号橱窗 + 私域转化",
    aigcLabel: "AI 生成或深度合成内容要保留标识和人工复核",
    commerceRule: "弱化夸张口播，重点讲清商品事实、适用边界和售后承接",
    avoid: ["夸大功效", "诱导式价格承诺", "无资质食品/保健表达", "虚构真人体验"]
  },
  小红书: {
    platform: "小红书",
    publishTarget: "种草笔记 + 搜索承接",
    aigcLabel: "AI 辅助画面和文案需避免伪装真实测评",
    commerceRule: "更重视真实体验、使用边界、图文一致和搜索关键词",
    avoid: ["伪装亲测", "过度滤镜改造商品效果", "绝对化功效", "未授权品牌同款"]
  }
};

const accountDocPackStructureHints = [
  { pattern: /清单|旅行|宿舍|玩水|礼物|节日/i, structure: "场景清单型" },
  { pattern: /搜索|答案|怎么|适合/i, structure: "搜索答案型" },
  { pattern: /痛点|演示|前后|收纳|整理/i, structure: "痛点演示型" },
  { pattern: /故事|种草|国风|非遗|老字号/i, structure: "故事种草型" },
  { pattern: /宠物/i, structure: "低风险用品型" }
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
const pwaInstallDismissedKey = "aiugc-pwa-install-dismissed";
const pwaInstallGuideForceKey = "aiugc-pwa-install-guide-force";
const screenshotAuthBypassKey = "aiugc-screenshot-auth-bypass";
const themeStorageKey = "aiugc-console-theme";
const themeDefaultVersionKey = "aiugc-console-theme-default-version";
const mobileCreateIntentKey = "aiugc-mobile-create-intent";
const themeDarkDefaultVersion = "dark-default-20260608";
const selectionProductFocusKey = "aiugc-selection-product-focus";
const accountAssetFocusKey = "aiugc-account-asset-focus";
const reviewImportPrefillKey = "aiugc-review-import-prefill";
const dailyExecutionDoneStorageKey = "aiugc-daily-execution-done";
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

function isPwaStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator.standalone === true;
}

function isIosInstallCandidate() {
  const userAgent = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const isIos = /iphone|ipad|ipod/i.test(userAgent)
    || (platform === "MacIntel" && Number(window.navigator.maxTouchPoints || 0) > 1);
  const isSafari = /safari/i.test(userAgent)
    && !/crios|fxios|edgios|chrome|android/i.test(userAgent);
  return isIos && isSafari && !isPwaStandalone();
}

function findNavItem(pageId) {
  for (const item of navItems) {
    const child = item.children?.find((entry) => entry.id === pageId);
    if (child) return child;
    if (item.id === pageId) return item;
  }
  return null;
}

function navItemIsActive(item, pageId) {
  return item.id === pageId || Boolean(item.children?.some((child) => child.id === pageId));
}

function mobileTabIsActive(item, pageId) {
  return (item.activePages || [item.id]).includes(pageId);
}

function isMobileViewport() {
  return Boolean(window.matchMedia?.("(max-width: 900px)").matches);
}

function writeRouteHash(nextPage, { replace = false } = {}) {
  const nextHash = `#/${nextPage}`;
  if (location.hash === nextHash) return;
  if (replace && window.history?.replaceState) {
    window.history.replaceState(window.history.state, "", `${location.pathname}${location.search}${nextHash}`);
    return;
  }
  location.hash = `/${nextPage}`;
}

function resolveMobileReturnTarget(fromPage, nextPage) {
  if (!nextPage || nextPage === "overview") return "";
  if (fromPage && fromPage !== nextPage && mobileRootPageIds.has(fromPage)) {
    return fromPage;
  }
  return mobileDefaultReturnTargets[nextPage] || "overview";
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

function productSelectionScore(product) {
  return selectionScoreDimensions.reduce((total, item) => total + Number(product.scores?.[item.key] || 0), 0);
}

const scoringProfileStorageKey = "selection-scoring-profile-v1";

const selectionScoringPresets = [
  {
    id: "balanced",
    label: "均衡测品",
    note: "沿用调研文档的 100 分模型。",
    weights: { ai: 15, demand: 15, card: 15, profit: 15, presale: 10, aftersale: 10, supply: 10, compliance: 10 }
  },
  {
    id: "search-card",
    label: "搜索承接优先",
    note: "适合短视频带搜索、商品卡和货架承接。",
    weights: { ai: 12, demand: 14, card: 20, profit: 14, presale: 10, aftersale: 10, supply: 10, compliance: 10 }
  },
  {
    id: "low-risk",
    label: "低风险优先",
    note: "适合新号、素材不足或合规压力较高时使用。",
    weights: { ai: 12, demand: 12, card: 13, profit: 13, presale: 10, aftersale: 13, supply: 12, compliance: 15 }
  },
  {
    id: "node-fast",
    label: "节点快测",
    note: "适合端午、毕业季、暑期等短窗口测品。",
    weights: { ai: 16, demand: 18, card: 14, profit: 14, presale: 10, aftersale: 8, supply: 10, compliance: 10 }
  }
];

function normalizeScoringProfile(profile = {}) {
  const preset = selectionScoringPresets.find((item) => item.id === profile.id) || selectionScoringPresets[0];
  const weights = profile.weights || preset.weights || {};
  return {
    id: profile.id || preset.id,
    label: profile.label || preset.label,
    note: profile.note || preset.note,
    weights: Object.fromEntries(selectionScoreDimensions.map((item) => [
      item.key,
      Math.max(0, Math.min(30, Math.round(Number(weights[item.key] ?? item.weight))))
    ]))
  };
}

function readScoringProfile() {
  try {
    return normalizeScoringProfile(JSON.parse(localStorage.getItem(scoringProfileStorageKey) || "{}"));
  } catch {
    return normalizeScoringProfile(selectionScoringPresets[0]);
  }
}

function scoringProfileTotal(profile) {
  return selectionScoreDimensions.reduce((total, item) => total + Number(profile.weights?.[item.key] || 0), 0);
}

function applyScoringProfileToProduct(product, profile) {
  const normalized = normalizeScoringProfile(profile);
  const scores = {};
  let total = 0;
  let weakHardScore = false;
  for (const dimension of selectionScoreDimensions) {
    const originalMax = Number(dimension.weight || 1);
    const targetMax = Number(normalized.weights[dimension.key] || 0);
    const rawScore = Number(product.scores?.[dimension.key] ?? 0);
    const ratio = originalMax ? Math.max(0, Math.min(1, rawScore / originalMax)) : 0;
    const weightedScore = Math.round(ratio * targetMax);
    scores[dimension.key] = weightedScore;
    total += weightedScore;
    if ((dimension.key === "compliance" || dimension.key === "aftersale") && ratio < 0.62) {
      weakHardScore = true;
    }
  }
  const complianceFindings = complianceFindingsForProduct(product);
  const complianceBlockCount = complianceFindings.filter((finding) => finding.severity === "block").length;
  const complianceWarnCount = complianceFindings.filter((finding) => finding.severity === "warn").length;
  const hardRuleCount = matchedHardRulesForProduct(product).length + Number((product.vetoFlags || []).length);
  const penalty = Math.min(18, (hardRuleCount >= 2 ? 8 : hardRuleCount === 1 ? 4 : 0) + complianceBlockCount * 6 + complianceWarnCount * 2);
  const totalScore = Math.max(0, Math.min(100, total - penalty));
  const riskLevel = complianceBlockCount || hardRuleCount >= 2 || weakHardScore || totalScore < 68
    ? "高"
    : complianceWarnCount || hardRuleCount === 1 || totalScore < 78
      ? "中"
      : product.riskLevel === "高"
        ? "中"
        : product.riskLevel || "低";
  const reasons = [];
  if (penalty) reasons.push(`硬规则扣 ${penalty} 分`);
  if (complianceBlockCount) reasons.push(`合规拦截 ${complianceBlockCount} 项`);
  if (complianceWarnCount) reasons.push(`合规待核 ${complianceWarnCount} 项`);
  if (weakHardScore) reasons.push("售后/合规单项偏弱");
  if (!reasons.length) reasons.push("按当前权重正常重算");
  return {
    scores,
    totalScore,
    riskLevel,
    delta: totalScore - Number(product.totalScore || 0),
    reasons
  };
}

function scoreTone(score) {
  if (score >= 85) return "good";
  if (score >= 75) return "warn";
  return "bad";
}

function selectionStatusTone(status) {
  if (/可测|可生成|放大/i.test(status)) return "good";
  if (/待补|测试|复测/i.test(status)) return "warn";
  if (/禁止|淘汰|否决/i.test(status)) return "bad";
  return "muted";
}

const materialSlotTemplates = [
  {
    id: "main-image",
    label: "商品主图",
    weight: 18,
    requirement: "商品主体清楚，和商品卡主图一致，不用 AI 替代真实商品。"
  },
  {
    id: "scene-material",
    label: "真实场景图",
    weight: 18,
    requirement: "能证明使用场景，优先宿舍、通勤、车内、宠物或家居实拍。"
  },
  {
    id: "spec-params",
    label: "参数/规格截图",
    weight: 18,
    requirement: "尺寸、容量、材质、适配型号、功率、续航、香型等关键信息可追溯。"
  },
  {
    id: "compliance-proof",
    label: "资质/授权凭证",
    weight: 18,
    requirement: "品牌授权、食品资质、质检/检测、IP 避让等高风险证据先补齐。"
  },
  {
    id: "real-test",
    label: "真实测试素材",
    weight: 16,
    requirement: "防水、防滑、吸湿、佩戴、工作状态等效果只用真实素材表达。"
  },
  {
    id: "product-card",
    label: "商品卡承接截图",
    weight: 12,
    requirement: "标题、价格、规格、履约和评价风险要和视频承诺一致。"
  }
];

const productCardFields = [
  {
    key: "title",
    label: "标题核心词",
    shortLabel: "标题",
    placeholder: "核心词 + 场景词 + 人群词"
  },
  {
    key: "image",
    label: "主图承接",
    shortLabel: "主图",
    placeholder: "主体、场景、真实度"
  },
  {
    key: "detail",
    label: "规格/详情",
    shortLabel: "详情",
    placeholder: "尺寸、容量、材质、适配、参数"
  },
  {
    key: "price",
    label: "价格一致",
    shortLabel: "价格",
    placeholder: "到手价、券后价、规格价"
  },
  {
    key: "reviews",
    label: "评价风险",
    shortLabel: "评价",
    placeholder: "差评关键词、退货点、售后点"
  },
  {
    key: "fulfillment",
    label: "履约时效",
    shortLabel: "履约",
    placeholder: "库存、发货、配送、节点时效"
  }
];

function normalizeProductCardCheck(productOrCard = {}) {
  const source = productOrCard?.cardCheck && typeof productOrCard.cardCheck === "object"
    ? productOrCard.cardCheck
    : productOrCard || {};
  return Object.fromEntries(productCardFields.map((field) => [field.key, String(source[field.key] ?? "").trim()]));
}

function productCardFieldStatus(field, value) {
  const text = String(value || "").trim();
  const pendingPattern = /待补|待看|缺|不清|未补|需补|待核|待确认|暂缺|待拍|待更新|不完整/i;
  if (!text) return "blocked";
  if (/禁用|下架|停售|不能发|不发货|不一致|无授权|侵权|伪造|虚假|医疗|药品|三无/i.test(text)) {
    return "blocked";
  }
  if (["title", "image", "detail"].includes(field.key) && pendingPattern.test(text)) {
    return "blocked";
  }
  if (pendingPattern.test(text)) {
    return "warn";
  }
  if (field.key === "reviews" && /投诉集中|退货严重|高风险|质量问题集中/i.test(text)) return "warn";
  if (field.key !== "reviews" && /风险|差评|投诉|漏水|异味|噪音|尺码|掉毛|授权|资质|质检|检测|临期|IP|品牌|夸大/i.test(text)) return "warn";
  return "pass";
}

function productCardPrecheck(product = {}) {
  const cardCheck = normalizeProductCardCheck(product);
  const hardIssues = [];
  const warnings = [];
  const fieldResults = productCardFields.map((field) => {
    const value = cardCheck[field.key];
    const status = productCardFieldStatus(field, value);
    if (status === "blocked") hardIssues.push(`${field.shortLabel}未通过：${value || "未填写"}`);
    if (status === "warn") warnings.push(`${field.shortLabel}待核：${value}`);
    return { ...field, value, status };
  });
  const cardComplianceFindings = complianceFindingsForProduct(product).filter((finding) => finding.surface === "card");
  cardComplianceFindings.forEach((finding) => {
    if (finding.severity === "block") hardIssues.push(finding.issue);
    if (finding.severity === "warn") warnings.push(finding.issue);
  });
  const weightedReady = fieldResults.reduce((total, item) => {
    if (item.status === "pass") return total + 1;
    if (item.status === "warn") return total + 0.55;
    return total;
  }, 0);
  const uniqueHardIssues = [...new Set(hardIssues)];
  const uniqueWarnings = [...new Set(warnings)];
  return {
    status: uniqueHardIssues.length ? "blocked" : uniqueWarnings.length ? "warn" : "pass",
    hardIssues: uniqueHardIssues,
    warnings: uniqueWarnings,
    percent: Math.round((weightedReady / productCardFields.length) * 100),
    ready: fieldResults.filter((item) => item.status === "pass").length,
    total: productCardFields.length,
    nextGap: uniqueHardIssues[0] || uniqueWarnings[0] || "商品卡承接可用",
    cardCheck,
    fieldResults
  };
}

function productCardPrecheckLabel(precheck = {}) {
  if (precheck.status === "blocked") return "商品卡拦截";
  if (precheck.status === "warn") return "商品卡待核";
  return "商品卡可用";
}

function productCardPrecheckTone(precheck = {}) {
  if (precheck.status === "blocked") return "bad";
  if (precheck.status === "warn") return "warn";
  return "good";
}

function productCardIssueList(precheck = {}) {
  return [...(precheck.hardIssues || []), ...(precheck.warnings || [])];
}

function productCardDraftTitle(product = {}) {
  const parts = [
    product.category,
    product.sku,
    product.node,
    product.primaryTemplate
  ]
    .map((item) => String(item || "").replace(/[，。；:：|/\\]+/g, " ").trim())
    .filter(Boolean);
  return [...new Set(parts)].join(" · ").slice(0, 80) || "商品核心词 · 场景词 · 人群词";
}

function productCardSpecFocus(product = {}) {
  const text = productIntelligenceText(product);
  if (/食品|零食|猫条|冻干|宠物/.test(text)) return "配料、规格、保质期、适用对象和储存方式";
  if (/电器|风扇|灯|电池|续航|功率|充电/.test(text)) return "功率、续航、材质、使用边界和合格证明";
  if (/防晒|服饰|穿搭|鞋|包|帽|尺码/.test(text)) return "尺寸、材质、颜色、适用场景和洗护说明";
  if (/收纳|置物|容量|尺寸|旅行|行李/.test(text)) return "尺寸、容量、材质、适配边界和使用场景";
  if (/香|车载|非遗|老字号|品牌/.test(text)) return "香型、规格、材质、来源边界和适用场景";
  return "尺寸、材质、规格、适用边界和参数";
}

function productCardDraftForProduct(product = {}) {
  const current = normalizeProductCardCheck(product);
  const precheck = productCardPrecheck(product);
  const statusByKey = new Map((precheck.fieldResults || []).map((field) => [field.key, field.status]));
  const replaceIfNeeded = (key, value) => (statusByKey.get(key) === "pass" && current[key] ? current[key] : value);
  const title = productCardDraftTitle(product);
  return normalizeProductCardCheck({
    title: replaceIfNeeded("title", title),
    image: replaceIfNeeded("image", "主图展示商品主体、规格件数和使用场景，画面与商品卡一致。"),
    detail: replaceIfNeeded("detail", `详情页核验${productCardSpecFocus(product)}；脚本只引用商品卡可见事实。`),
    price: replaceIfNeeded("price", "价格以商品卡页面当前展示为准，视频不承诺固定到手价。"),
    reviews: replaceIfNeeded("reviews", "评价关注材质、尺寸、物流、售后和退货点，脚本只写可复核事实。"),
    fulfillment: replaceIfNeeded("fulfillment", "按商品卡展示库存、发货地、配送时效和售后规则表达，不承诺页面未展示履约。")
  });
}

function productCardUpdatePayload(product = {}, nextCardDraft = {}) {
  const cardCheck = normalizeProductCardCheck(nextCardDraft);
  const checked = productCardPrecheck({ ...product, cardCheck });
  const disableCardSlot = checked.hardIssues.some((issue) => /禁用|下架|停售|不一致|无授权|侵权|伪造|虚假|三无/i.test(issue));
  const nextChecklist = normalizeMaterialChecklist({ ...product, cardCheck }).map((slot) => {
    if (slot.id !== "product-card") return slot;
    return {
      ...slot,
      status: checked.status === "pass" ? "已就绪" : disableCardSlot ? "禁用" : "待补",
      note: checked.status === "pass" ? "" : checked.nextGap,
      updatedAt: new Date().toISOString()
    };
  });
  const summary = summarizeMaterialChecklist(nextChecklist);
  const cardGaps = productCardIssueList(checked).slice(0, 4).map((issue) => `商品卡：${issue}`);
  const keptGaps = (product.assetGaps || []).filter((gap) => !String(gap).startsWith("商品卡：") && !String(gap).includes("商品卡承接"));
  const nextLifecycle = checked.status === "blocked"
    ? "待补资产"
    : summary.percent >= 78 && Number(product.totalScore || 0) >= 75 && product.lifecycle === "待补资产"
      ? "可测"
      : product.lifecycle;
  return {
    cardCheck,
    cardPrecheck: checked,
    assetChecklist: nextChecklist,
    assetPercent: summary.percent,
    assetGaps: [...cardGaps, ...keptGaps].slice(0, 8),
    assetStatus: checked.status === "blocked"
      ? `商品卡预检未通过：${checked.nextGap}`
      : checked.status === "warn"
        ? `商品卡待核：${checked.nextGap}`
        : summary.pending
          ? `商品卡可用，仍待补：${summary.nextGap}`
          : "商品卡承接可用",
    lifecycle: nextLifecycle
  };
}

function normalizeAssetActionLog(productOrLog = {}) {
  const source = Array.isArray(productOrLog) ? productOrLog : productOrLog.assetActionLog;
  return (Array.isArray(source) ? source : [])
    .map((item, index) => ({
      id: String(item.id || `asset-log-${index + 1}`),
      type: String(item.type || "资产处理"),
      label: String(item.label || item.title || "资产处理"),
      detail: String(item.detail || item.message || ""),
      target: String(item.target || ""),
      status: String(item.status || ""),
      actor: String(item.actor || "系统"),
      createdAt: item.createdAt || item.updatedAt || ""
    }))
    .filter((item) => item.label || item.detail)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 30);
}

function appendAssetActionLog(product = {}, event = {}) {
  const createdAt = event.createdAt || new Date().toISOString();
  const entry = {
    id: event.id || `asset-log-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    type: event.type || "资产处理",
    label: event.label || "资产处理",
    detail: event.detail || "",
    target: event.target || product.sku || "",
    status: event.status || "",
    actor: event.actor || "系统",
    createdAt
  };
  return [entry, ...normalizeAssetActionLog(product)].slice(0, 30);
}

function withAssetActionLog(product = {}, patch = {}, event = {}) {
  return {
    ...patch,
    assetActionLog: appendAssetActionLog(product, event)
  };
}

function withAssetActionLogs(product = {}, patch = {}, events = []) {
  const assetActionLog = (events || []).reduce(
    (logs, event) => appendAssetActionLog({ ...product, assetActionLog: logs }, event),
    normalizeAssetActionLog(product)
  );
  return {
    ...patch,
    assetActionLog
  };
}

function recentAssetActionRows(products = [], limit = 10) {
  return (products || [])
    .flatMap((product) => normalizeAssetActionLog(product).map((log) => ({
      product,
      log,
      priority: new Date(log.createdAt || 0).getTime()
    })))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);
}

function productEvidenceText(product) {
  return [
    product.assetStatus,
    product.riskLevel,
    ...(product.assetGaps || []),
    ...(product.riskTags || []),
    ...Object.values(normalizeProductCardCheck(product))
  ].join(" ");
}

function materialSlotDefaultStatus(product, slot) {
  const text = productEvidenceText(product);
  const cardCheck = normalizeProductCardCheck(product);
  const cardImage = String(cardCheck.image || "");
  const cardDetail = String(cardCheck.detail || "");
  const cardFulfillment = String(cardCheck.fulfillment || "");
  if (slot.id === "main-image") return /缺|待补|需补/i.test(cardImage) ? "待补" : "已就绪";
  if (slot.id === "scene-material") return /真实|场景|佩戴|车内|宠物|工作|前后|主图待补/.test(text) ? "待补" : "已就绪";
  if (slot.id === "spec-params") return /参数|规格|尺寸|容量|功率|续航|UPF|适配|材质|防水等级|质检|香型|保质期|配料/.test(text) || /待补|缺/.test(cardDetail) ? "待补" : "已就绪";
  if (slot.id === "compliance-proof") return product.riskLevel === "高" || /资质|授权|品牌|食品|质检|检测|非遗|IP/.test(text) ? "待补" : "已就绪";
  if (slot.id === "real-test") return /真实测试|实测|亲测|测试|效果|前后|防水|防滑|工作|佩戴|吸湿/.test(text) ? "待补" : "已就绪";
  if (slot.id === "product-card") return /待补|缺/.test(`${cardDetail} ${cardImage} ${cardFulfillment}`) ? "待补" : "已就绪";
  return "待补";
}

function normalizeMaterialChecklist(product) {
  const existing = new Map((Array.isArray(product.assetChecklist) ? product.assetChecklist : []).map((slot) => [slot.id, slot]));
  return materialSlotTemplates.map((template) => {
    const current = existing.get(template.id) || {};
    return {
      ...template,
      ...current,
      weight: Number(current.weight || template.weight),
      status: current.status || materialSlotDefaultStatus(product, template),
      note: current.note || ""
    };
  });
}

function summarizeMaterialChecklist(checklist = []) {
  const active = checklist.filter((slot) => slot.status !== "不适用");
  const totalWeight = active.reduce((total, slot) => total + Number(slot.weight || 0), 0) || 1;
  const readyWeight = active.filter((slot) => slot.status === "已就绪").reduce((total, slot) => total + Number(slot.weight || 0), 0);
  const pending = active.filter((slot) => slot.status === "待补");
  const blocked = active.filter((slot) => slot.status === "禁用");
  return {
    ready: active.filter((slot) => slot.status === "已就绪").length,
    pending: pending.length,
    blocked: blocked.length,
    total: active.length,
    percent: Math.round((readyWeight / totalWeight) * 100),
    nextGap: (blocked[0] || pending[0])?.label || "素材可生成"
  };
}

function materialStatusTone(status) {
  if (status === "已就绪") return "good";
  if (status === "禁用") return "bad";
  if (status === "待补") return "warn";
  return "muted";
}

function materialSlotById(product, slotId) {
  return (product.assetChecklist || normalizeMaterialChecklist(product)).find((slot) => slot.id === slotId);
}

function assetCollectionActionForSlot(slot = {}, product = {}) {
  const sku = product.sku || "当前 SKU";
  if (slot.id === "main-image") return `补 ${sku} 商品主图或白底图，主体清晰，不能用 AI 替代商品实物。`;
  if (slot.id === "scene-material") return "补真实使用场景图/短视频，优先居家、车内、宠物、雨季、暑期等当前节点场景。";
  if (slot.id === "spec-params") return "补商品卡详情页参数截图，覆盖尺寸、材质、容量、功率、适配、保质期等关键信息。";
  if (slot.id === "compliance-proof") return "补资质、授权、质检、检测、食品标签或 IP 避让证据截图。";
  if (slot.id === "real-test") return "补真实测试素材，效果类卖点只用实拍过程或可复核截图表达。";
  if (slot.id === "product-card") return "补商品卡标题、价格、规格、评价和履约截图，确认视频承诺与商品卡一致。";
  return slot.requirement || "补齐可复核素材。";
}

function assetPlanRowsForProduct(product = {}) {
  const checklist = normalizeMaterialChecklist(product);
  const cardPrecheck = productCardPrecheck(product);
  const researchTask = researchTaskSummaryForProduct(product);
  const rows = [];
  for (const slot of checklist) {
    if (!["待补", "禁用"].includes(slot.status)) continue;
    const blocked = slot.status === "禁用" || slot.id === "compliance-proof" || slot.id === "real-test";
    rows.push({
      id: `${slot.id}-collect`,
      slotId: slot.id,
      type: slot.id === "compliance-proof" ? "凭证" : slot.id === "product-card" ? "商品卡" : "素材",
      label: slot.label,
      status: blocked ? "阻断" : "待补",
      tone: blocked ? "bad" : "warn",
      priority: Number(slot.weight || 0) + (blocked ? 80 : 40),
      action: assetCollectionActionForSlot(slot, product),
      evidence: slot.note || slot.requirement,
      owner: slot.id === "compliance-proof" ? "选品/商家资质" : slot.id === "product-card" ? "商品卡核验" : "素材采集",
      doneWhen: slot.id === "real-test" ? "真实测试文件已绑定，脚本不再依赖 AI 伪造效果。" : "状态标记为已就绪，并绑定截图/素材或完成人工复核。"
    });
  }
  for (const field of cardPrecheck.fieldResults || []) {
    if (field.status === "pass") continue;
    rows.push({
      id: `card-${field.key}`,
      slotId: "product-card",
      type: "商品卡",
      label: `${field.shortLabel}待补`,
      status: field.status === "blocked" ? "阻断" : "待核",
      tone: field.status === "blocked" ? "bad" : "warn",
      priority: field.status === "blocked" ? 76 : 42,
      action: `补商品卡${field.shortLabel}：${field.placeholder || field.label}。`,
      evidence: field.value || "未填写",
      owner: "商品卡核验",
      doneWhen: "商品卡字段已保存，商品卡预检不再阻断。"
    });
  }
  if (researchTask.status !== "pass") {
    rows.push({
      id: "research-source",
      slotId: "research-source",
      type: "来源",
      label: researchTask.label,
      status: researchTask.status === "blocked" ? "阻断" : "待核",
      tone: researchTask.tone,
      priority: researchTask.status === "blocked" ? 72 : 38,
      action: researchTask.action,
      evidence: researchTask.evidence,
      owner: "选品调研",
      doneWhen: "来源列表包含规则/商品/资质可复核链接或截图。"
    });
  }
  return rows
    .sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label, "zh-CN"))
    .slice(0, 18);
}

function buildAssetCompletionPlan(product = {}) {
  const rows = assetPlanRowsForProduct(product);
  const blocked = rows.filter((row) => row.status === "阻断").length;
  const warn = rows.filter((row) => row.status !== "阻断").length;
  return {
    version: "asset-plan-v1",
    generatedAt: new Date().toISOString(),
    sku: product.sku || "",
    status: blocked ? "阻断" : warn ? "待补" : "可用",
    label: blocked ? "补齐计划阻断" : warn ? "补齐计划待执行" : "补齐计划可用",
    summary: blocked
      ? `${blocked} 个阻断项，先补凭证、真实测试或商品卡关键字段。`
      : warn
        ? `${warn} 个待核项，可建保守草稿但需补证据。`
        : "素材、商品卡和来源当前可进入生成前复核。",
    rows
  };
}

function assetVerificationStatusText(status) {
  if (status === "blocked") return "阻断";
  if (status === "warn") return "待核";
  return "通过";
}

function assetVerificationTone(status) {
  if (status === "blocked") return "bad";
  if (status === "warn") return "warn";
  return "good";
}

function assetVerificationRow({ id, label, status, detail, action, evidence, owner, weight = 0 }) {
  return {
    id,
    label,
    status,
    detail,
    action,
    evidence,
    owner,
    weight,
    tone: assetVerificationTone(status),
    statusLabel: assetVerificationStatusText(status)
  };
}

function stableAssetVerificationValue(value) {
  if (Array.isArray(value)) return value.map(stableAssetVerificationValue);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableAssetVerificationValue(value[key]);
        return result;
      }, {});
  }
  if (typeof value === "string") return value.trim().replace(/\s+/g, " ");
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value;
  return value == null ? "" : String(value);
}

function stableAssetVerificationHash(value) {
  const text = JSON.stringify(stableAssetVerificationValue(value));
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `av-${(hash >>> 0).toString(36)}-${text.length.toString(36)}`;
}

function buildAssetVerificationSignature({ product = {}, account = {}, card = {}, precheck = {}, compliance = {}, researchTask = {}, plan = {}, rows = [], status = "" } = {}) {
  return stableAssetVerificationHash({
    version: "asset-verification-v2",
    product: {
      id: product.id || "",
      sku: product.sku || "",
      category: product.category || "",
      lifecycle: product.lifecycle || "",
      totalScore: Number(product.totalScore || 0),
      assetPercent: Number(product.assetPercent || 0),
      riskLevel: product.riskLevel || ""
    },
    account: {
      id: account.account?.id || account.id || "",
      name: account.account?.name || account.name || "",
      position: account.account?.position || account.position || "",
      docPack: account.docPack?.name || "",
      platform: account.platform?.platform || account.platform || "",
      aigcLabel: account.platform?.aigcLabel || ""
    },
    gate: {
      status,
      materialStatus: precheck.status || "",
      materialPercent: Number(precheck.percent || 0),
      cardStatus: card.status || "",
      cardPercent: Number(card.percent || 0),
      complianceStatus: compliance.status || "",
      researchStatus: researchTask.status || "",
      planStatus: plan.status || ""
    },
    rows: rows.map((row) => ({
      id: row.id,
      status: row.status,
      detail: row.detail,
      action: row.action,
      evidence: row.evidence,
      owner: row.owner,
      weight: row.weight
    }))
  });
}

function buildAssetVerificationSnapshot({
  product = {},
  accountFit,
  materialPrecheck,
  cardPrecheck,
  assetPlan
} = {}) {
  const checklist = normalizeMaterialChecklist(product);
  const plan = assetPlan || buildAssetCompletionPlan(product);
  const precheck = materialPrecheck || materialPrecheckForProduct({ ...product, assetChecklist: checklist });
  const card = cardPrecheck || productCardPrecheck(product);
  const compliance = complianceSummaryForProduct({ ...product, assetChecklist: checklist, cardCheck: card.cardCheck || normalizeProductCardCheck(product) });
  const researchTask = researchTaskSummaryForProduct(product);
  const account = accountFit || accountFitSummaryForProduct(product, accountAssetSeeds);
  const criticalSlotIds = new Set(["main-image", "product-card", "compliance-proof", "real-test"]);
  const missingSlots = checklist.filter((slot) => slot.status === "待补" || slot.status === "禁用");
  const criticalMissing = missingSlots.filter((slot) => criticalSlotIds.has(slot.id) || slot.status === "禁用");
  const readyWithoutFiles = checklist.filter((slot) =>
    slot.status === "已就绪"
    && criticalSlotIds.has(slot.id)
    && !(slot.attachments || []).some((attachment) => attachment.url)
  );
  const attachmentCount = checklist.reduce((total, slot) => total + (slot.attachments || []).filter((attachment) => attachment.url).length, 0);
  const rows = [
    assetVerificationRow({
      id: "material-evidence",
      label: "素材证据",
      status: criticalMissing.length ? "blocked" : missingSlots.length || readyWithoutFiles.length ? "warn" : "pass",
      detail: `${attachmentCount} 个文件 / ${checklist.filter((slot) => slot.status === "已就绪").length}/${checklist.length} 项就绪`,
      action: criticalMissing[0]
        ? `先补关键素材：${criticalMissing[0].label}`
        : missingSlots[0]
          ? `补齐或人工确认：${missingSlots[0].label}`
          : readyWithoutFiles[0]
            ? `${readyWithoutFiles[0].label}已就绪但缺文件，建议绑定截图或素材。`
            : "素材证据可进入生成前复核。",
      evidence: checklist.map((slot) => `${slot.label}:${slot.status}${(slot.attachments || []).length ? `/${slot.attachments.length} 文件` : ""}`).join("；"),
      owner: "素材采集",
      weight: 34
    }),
    assetVerificationRow({
      id: "card-consistency",
      label: "商品卡一致性",
      status: card.status,
      detail: `${card.percent || 0}% · ${card.ready || 0}/${card.total || productCardFields.length} 字段`,
      action: card.status === "pass" ? "商品卡字段可承接视频结尾。" : card.nextGap || "补商品卡关键字段。",
      evidence: productCardFields.map((field) => `${field.shortLabel}:${card.cardCheck?.[field.key] || "待补"}`).join("；"),
      owner: "商品卡核验",
      weight: 32
    }),
    assetVerificationRow({
      id: "research-source",
      label: "来源证据",
      status: researchTask.status,
      detail: researchTask.evidence || researchTask.research?.label || "来源待补",
      action: researchTask.status === "pass" ? "来源可用于规则和商品事实复核。" : researchTask.action,
      evidence: (researchTask.research?.sources || []).map((source) => source.label).join("、") || "无来源记录",
      owner: "选品调研",
      weight: 28
    }),
    assetVerificationRow({
      id: "compliance-proof",
      label: "合规凭证",
      status: compliance.status,
      detail: `${compliance.blockCount || 0} 阻断 / ${compliance.warnCount || 0} 待核`,
      action: compliance.status === "pass" ? "未发现额外合规阻断，继续保持商品事实表达。" : compliance.action,
      evidence: (compliance.findings || []).map((finding) => finding.issue || finding.label).join("；") || "无额外阻断",
      owner: "合规复核",
      weight: 28
    }),
    assetVerificationRow({
      id: "account-platform",
      label: "账号与平台约束",
      status: account.status,
      detail: `${account.strength || "未匹配"} · ${account.account?.name || "未匹配账号"}`,
      action: account.status === "pass" ? account.action : account.action || "补账号资产、DOC 包和平台规则。",
      evidence: account.account ? `${account.docPack?.name || "DOC待补"} / ${account.platform?.platform || "平台待补"} / ${account.platform?.aigcLabel || "AI标识待补"}` : "无账号承接",
      owner: "账号运营",
      weight: 24
    }),
    assetVerificationRow({
      id: "plan-closure",
      label: "补齐计划闭环",
      status: plan.status === "阻断" ? "blocked" : plan.status === "待补" ? "warn" : "pass",
      detail: `${plan.rows?.length || 0} 个待处理项`,
      action: plan.status === "可用" ? "补齐计划已闭环，可保存验证记录。" : plan.summary,
      evidence: (plan.rows || []).slice(0, 5).map((row) => `${row.label}:${row.status}`).join("；") || "无待处理项",
      owner: "项目统筹",
      weight: 20
    })
  ];
  const blockedRows = rows.filter((row) => row.status === "blocked");
  const warnRows = rows.filter((row) => row.status === "warn");
  const status = blockedRows.length ? "blocked" : warnRows.length ? "warn" : "pass";
  const primaryRow = blockedRows[0] || warnRows[0] || rows[rows.length - 1];
  const signature = buildAssetVerificationSignature({
    product,
    account,
    card,
    precheck,
    compliance,
    researchTask,
    plan,
    rows,
    status
  });
  return {
    version: "asset-verification-v1",
    generatedAt: new Date().toISOString(),
    signature,
    signatureVersion: "asset-verification-v2",
    sku: product.sku || "",
    status,
    tone: assetVerificationTone(status),
    label: status === "blocked" ? "资产验证阻断" : status === "warn" ? "资产验证待核" : "资产验证通过",
    summary: status === "blocked"
      ? `${blockedRows.length} 项阻断，先处理 ${primaryRow.label}。`
      : status === "warn"
        ? `${warnRows.length} 项待核，可保守推进但要记录降级口径。`
        : "素材、商品卡、来源、账号和合规验证通过。",
    primaryAction: primaryRow.action,
    blockedCount: blockedRows.length,
    warnCount: warnRows.length,
    passCount: rows.filter((row) => row.status === "pass").length,
    rows
  };
}

function assetVerificationText(snapshot = {}) {
  return [
    `资产验证：${snapshot.sku || "未命名 SKU"}`,
    `结论：${snapshot.label || "待核"}`,
    `摘要：${snapshot.summary || ""}`,
    `下一步：${snapshot.primaryAction || "按验证项处理"}`,
    `记录指纹：${snapshot.signature || "待生成"}`,
    "",
    ...(snapshot.rows || []).map((row) => `- [${row.statusLabel}] ${row.label}：${row.detail}；证据：${row.evidence || "无"}；动作：${row.action}；负责人：${row.owner}`)
  ].join("\n");
}

function assetVerificationGateFromSnapshot(product = {}, snapshot = {}) {
  const saved = product.assetValidationSnapshot || null;
  const hasSaved = Boolean(saved?.status);
  const savedSignature = saved?.signature || "";
  const currentSignature = snapshot.signature || "";
  const lifecycleNeedsVerification = ["可测", "复测", "放大"].includes(product.lifecycle);
  const statusChanged = Boolean(hasSaved && saved.status !== snapshot.status);
  const signatureMissing = Boolean(hasSaved && !savedSignature);
  const signatureChanged = Boolean(hasSaved && savedSignature && currentSignature && savedSignature !== currentSignature);
  const isStale = Boolean(statusChanged || signatureMissing || signatureChanged);
  const staleReason = statusChanged
    ? "验证结论已变化"
    : signatureMissing
      ? "旧验证记录缺少内容指纹"
      : signatureChanged
        ? "资产、商品卡、来源、账号或补齐计划已变化"
        : "";
  const requiresSave = lifecycleNeedsVerification
    && !hasActiveSelectionBatch(product)
    && snapshot.status !== "blocked"
    && (!hasSaved || isStale);
  const status = snapshot.status === "blocked"
    ? "blocked"
    : requiresSave || snapshot.status === "warn"
      ? "warn"
      : "pass";
  const saveLabel = !hasSaved
    ? "资产验证待保存"
    : signatureMissing
      ? "资产验证待重存"
      : isStale
        ? "资产验证已过期"
        : "资产验证待保存";
  const saveSummary = !hasSaved
    ? `当前可进入生成前验证，请先保存 ${product.sku || "SKU"} 的资产验证记录。`
    : signatureMissing
      ? "旧验证记录没有内容指纹，请重存一次，让后续批次可追溯。"
      : isStale
        ? `${staleReason}，请重存生成前验证。`
        : snapshot.summary;
  return {
    ...snapshot,
    computedStatus: snapshot.status,
    status,
    tone: assetVerificationTone(status),
    savedSnapshot: saved,
    hasSaved,
    lifecycleNeedsVerification,
    savedSignature,
    currentSignature,
    statusChanged,
    signatureMissing,
    signatureChanged,
    isStale,
    staleReason,
    requiresSave,
    label: snapshot.status === "blocked"
      ? "资产验证阻断"
      : requiresSave
        ? saveLabel
        : snapshot.status === "warn"
          ? "资产验证待核"
          : "资产验证通过",
    summary: snapshot.status === "blocked"
      ? snapshot.summary
      : requiresSave
        ? saveSummary
        : snapshot.summary,
    primaryAction: snapshot.status === "blocked"
      ? snapshot.primaryAction
      : requiresSave
        ? (isStale ? "重存生成前资产验证，更新当前资产验收记录。" : "保存生成前资产验证，让批次草稿有可追溯验收记录。")
        : snapshot.primaryAction
  };
}

function buildAssetVerificationSnapshotForProduct(product = {}, accountFit) {
  const fit = accountFit || accountFitSummaryForProduct(product, accountAssetSeeds);
  return buildAssetVerificationSnapshot({
    product,
    accountFit: fit,
    materialPrecheck: materialPrecheckForProduct(product),
    cardPrecheck: productCardPrecheck(product),
    assetPlan: product.assetCompletionPlan || buildAssetCompletionPlan(product)
  });
}

function assetVerificationGateForProduct(product = {}, accountFit) {
  const fit = accountFit || accountFitSummaryForProduct(product, accountAssetSeeds);
  const snapshot = buildAssetVerificationSnapshotForProduct(product, fit);
  return assetVerificationGateFromSnapshot(product, snapshot);
}

function buildAssetVerificationRefreshPatch(product = {}, accounts = accountAssetSeeds) {
  const accountFit = accountFitSummaryForProduct(product, accounts);
  const snapshot = buildAssetVerificationSnapshotForProduct(product, accountFit);
  const patch = {
    assetValidationSnapshot: snapshot,
    assetVerificationUpdatedAt: snapshot.generatedAt
  };
  if (snapshot.status === "pass") {
    patch.assetPercent = Math.max(Number(product.assetPercent || 0), 82);
  }
  if (snapshot.status === "pass" && Number(product.totalScore || 0) >= 75 && ["观察", "待补资产"].includes(product.lifecycle)) {
    patch.lifecycle = "可测";
  }
  return patch;
}

function buildAssetVerificationQueue(products = [], accounts = accountAssetSeeds) {
  const allowed = new Set(["可测", "复测", "放大"]);
  return (products || [])
    .filter((product) => product?.id && product.lifecycle !== "淘汰")
    .map((product) => {
      const accountFit = accountFitSummaryForProduct(product, accounts);
      const snapshot = assetVerificationGateForProduct(product, accountFit);
      const active = hasActiveSelectionBatch(product);
      const inScope = allowed.has(product.lifecycle) || snapshot.status === "blocked" || snapshot.requiresSave;
      return {
        product,
        accountFit,
        snapshot,
        active,
      inScope,
      tone: snapshot.tone,
      priority: (snapshot.status === "blocked" ? 120 : snapshot.isStale ? 96 : snapshot.requiresSave ? 84 : snapshot.status === "warn" ? 64 : 20)
        + Number(product.totalScore || 0) / 10
        + (allowed.has(product.lifecycle) ? 12 : 0)
    };
    })
    .filter((row) => row.inScope && !row.active)
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore);
}

function assetVerificationQueueText(rows = []) {
  if (!rows.length) return "生成前资产验证队列：暂无待处理 SKU。";
  return [
    "生成前资产验证队列",
    ...rows.map((row, index) => `${index + 1}. ${row.product.sku}｜${row.snapshot.label}｜${row.snapshot.summary}｜下一步：${row.snapshot.primaryAction}`)
  ].join("\n");
}

function buildAssetPlanOwnerBoard(products = []) {
  const ownerOrder = ["素材采集", "商品卡核验", "选品调研", "选品/商家资质"];
  const groups = new Map();
  for (const product of products || []) {
    if (!product?.id || product.lifecycle === "淘汰") continue;
    const plan = buildAssetCompletionPlan(product);
    for (const row of plan.rows || []) {
      const owner = row.owner || "待分配";
      if (!groups.has(owner)) {
        groups.set(owner, {
          owner,
          items: [],
          blocked: 0,
          warn: 0,
          skuIds: new Set(),
          priority: 0
        });
      }
      const group = groups.get(owner);
      const priority = Number(row.priority || 0) + Number(product.totalScore || 0) / 10;
      const item = {
        product,
        plan,
        row,
        priority,
        route: productLibraryTarget(product.id)
      };
      group.items.push(item);
      group.skuIds.add(product.id);
      if (row.status === "阻断") group.blocked += 1;
      else group.warn += 1;
      group.priority += priority;
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      skuCount: group.skuIds.size,
      items: group.items.sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore)
    }))
    .filter((group) => group.items.length)
    .sort((a, b) => {
      const ownerRank = ownerOrder.indexOf(a.owner) - ownerOrder.indexOf(b.owner);
      if (ownerOrder.includes(a.owner) && ownerOrder.includes(b.owner) && ownerRank) return ownerRank;
      if (ownerOrder.includes(a.owner) !== ownerOrder.includes(b.owner)) return ownerOrder.includes(a.owner) ? -1 : 1;
      return b.blocked - a.blocked || b.priority - a.priority;
    });
}

function complianceSlotReady(product, slotId) {
  const slot = materialSlotById(product, slotId);
  return !slot || slot.status === "已就绪" || slot.status === "不适用";
}

function productClaimText(product = {}) {
  const cardCheck = normalizeProductCardCheck(product);
  return [
    product.sku,
    product.category,
    product.node,
    product.coreReason,
    product.assetStatus,
    product.primaryTemplate,
    product.priceBand,
    ...splitAssetList(product.videoAngles || [], 8),
    ...splitAssetList(product.riskTags || [], 8),
    ...splitAssetList(product.vetoFlags || [], 8),
    ...splitAssetList(product.assetGaps || [], 8),
    ...Object.values(cardCheck)
  ].join(" ");
}

function complianceFindingsForProduct(product = {}) {
  const text = productClaimText(product);
  const cardCheck = normalizeProductCardCheck(product);
  const cardText = Object.values(cardCheck).join(" ");
  const priceText = `${cardCheck.price || ""} ${product.priceBand || ""}`;
  const hasGeneratedRecord = Number(product.generationSummary?.total || 0) > 0
    || (Array.isArray(product.generationRecords) && product.generationRecords.length > 0)
    || ["小批量测试", "复测", "放大"].includes(product.lifecycle);
  const findings = [];
  const push = (finding) => {
    if (!findings.some((item) => item.id === finding.id)) findings.push(finding);
  };

  if (/(食品|零食|宠物|猫条|冻干|儿童|电器|质检|检测|认证|授权|品牌|IP|非遗|老字号|FIFA|世界杯|官方|同款|医用|医疗|保健|药|化妆品)/i.test(text)
    && !complianceSlotReady(product, "compliance-proof")) {
    push({
      id: "qualification-proof-missing",
      label: "经营/资质凭证未就绪",
      severity: "block",
      surface: "material",
      issue: "经营主体、授权、质检或产品合格证明未就绪",
      action: "先补资质/授权/检测截图，再进入测品批次。"
    });
  }
  if (/(真实测试|实测|亲测|前后|效果|防水|防滑|吸湿|散热|降温|承重|续航|工作|对比|试用)/i.test(text)
    && !complianceSlotReady(product, "real-test")) {
    push({
      id: "real-effect-proof-missing",
      label: "效果素材未实证",
      severity: "block",
      surface: "material",
      issue: "效果演示缺真实测试素材",
      action: "补真实测试图/视频；AI 只能做非关键转场，不替代效果证明。"
    });
  }
  if (/(根治|治愈|治疗|药效|降压|修复慢病|永久|100%|绝对|全网最低|最低价|官方同款|无副作用|保证有效|杀菌除螨|消毒级)/i.test(cardText)) {
    push({
      id: "absolute-or-function-claim",
      label: "绝对化/功效承诺",
      severity: "block",
      surface: "card",
      issue: "商品卡疑似含绝对化、医疗功效或无法证明承诺",
      action: "改成可证明的商品事实、适用边界和保守场景表达。"
    });
  }
  if (/(到手价|券|满减|会员|原价|划线价|限时|秒杀|买一送|第二件|立减|全网|最低)/i.test(priceText)
    && !/(一致|已核|同步|规则|条件|规格|页面|商品卡|固定价|价格清楚|无活动)/i.test(priceText)) {
    push({
      id: "price-condition-missing",
      label: "价格条件未讲清",
      severity: "warn",
      surface: "card",
      issue: "价格/优惠承诺缺活动条件或商品卡同步说明",
      action: "补到手价条件、规格单位、活动时段和商品卡一致性。"
    });
  }
  if (hasGeneratedRecord && !/(AI\s*标识|AIGC\s*标识|AI辅助|AI 辅助|平台入口标识|生成合成标识)/i.test(text)) {
    push({
      id: "aigc-label-confirmation",
      label: "AI 标识口径待确认",
      severity: "warn",
      surface: "publish",
      issue: "生成/发布记录缺 AI 生成内容标识口径",
      action: "发布前按平台入口标识 AI 辅助创作，并避免伪装真实测评。"
    });
  }
  return findings;
}

function complianceSummaryForProduct(product = {}) {
  const findings = product.complianceFindings || complianceFindingsForProduct(product);
  const blockCount = findings.filter((finding) => finding.severity === "block").length;
  const warnCount = findings.filter((finding) => finding.severity === "warn").length;
  return {
    findings,
    blockCount,
    warnCount,
    status: blockCount ? "blocked" : warnCount ? "warn" : "pass",
    label: blockCount ? "合规拦截" : warnCount ? "合规待核" : "合规可用",
    tone: blockCount ? "bad" : warnCount ? "warn" : "good",
    primary: findings[0]?.label || "未发现额外阻断",
    action: findings[0]?.action || "保持商品事实表达和平台 AI 标识。"
  };
}

function materialIssueText(slot) {
  return slot ? `${slot.label}${slot.note ? `：${slot.note}` : ""}` : "";
}

function materialPrecheckForProduct(product) {
  const checklist = product.assetChecklist || normalizeMaterialChecklist(product);
  const summary = summarizeMaterialChecklist(checklist);
  const cardPrecheck = productCardPrecheck(product);
  const complianceSlot = materialSlotById(product, "compliance-proof");
  const realTestSlot = materialSlotById(product, "real-test");
  const productCardSlot = materialSlotById(product, "product-card");
  const specSlot = materialSlotById(product, "spec-params");
  const sceneSlot = materialSlotById(product, "scene-material");
  const text = productEvidenceText(product);
  const complianceFindings = complianceFindingsForProduct(product);
  const hardIssues = [];
  const warnings = [];

  for (const slot of checklist) {
    if (slot.status === "禁用") hardIssues.push(`禁用素材：${materialIssueText(slot)}`);
  }
  if (summary.percent < 65) hardIssues.push(`素材完整度 ${summary.percent}%，低于 65%`);
  if (complianceSlot?.status !== "已就绪" && (product.riskLevel === "高" || /资质|授权|品牌|食品|IP|质检|检测/.test(text))) {
    hardIssues.push(`关键凭证未就绪：${materialIssueText(complianceSlot)}`);
  }
  if (realTestSlot?.status !== "已就绪" && /真实测试|防水|防滑|吸湿|散热|工作|效果|前后/.test(text)) {
    hardIssues.push(`真实测试未就绪：${materialIssueText(realTestSlot)}`);
  }
  if (productCardSlot?.status !== "已就绪") warnings.push(`商品卡承接待补：${materialIssueText(productCardSlot)}`);
  if (specSlot?.status !== "已就绪") warnings.push(`参数规格待补：${materialIssueText(specSlot)}`);
  if (sceneSlot?.status !== "已就绪") warnings.push(`场景素材待补：${materialIssueText(sceneSlot)}`);
  if (cardPrecheck.status === "blocked") {
    hardIssues.push(`商品卡承接未通过：${cardPrecheck.nextGap}`);
  } else if (cardPrecheck.status === "warn") {
    warnings.push(`商品卡承接待核：${cardPrecheck.nextGap}`);
  }
  complianceFindings.filter((finding) => finding.surface !== "card").forEach((finding) => {
    if (finding.severity === "block") hardIssues.push(finding.issue);
    if (finding.severity === "warn") warnings.push(finding.issue);
  });
  const uniqueHardIssues = [...new Set(hardIssues)];
  const uniqueWarnings = [...new Set(warnings)];

  return {
    status: uniqueHardIssues.length ? "blocked" : uniqueWarnings.length ? "warn" : "pass",
    hardIssues: uniqueHardIssues,
    warnings: uniqueWarnings,
    complianceFindings,
    percent: summary.percent,
    ready: summary.ready,
    total: summary.total
  };
}

function materialPrecheckLabel(precheck) {
  if (precheck.status === "blocked") return "阻止生成";
  if (precheck.status === "warn") return "可建草稿";
  return "可生成";
}

function materialPrecheckTone(precheck) {
  if (precheck?.status === "blocked") return "bad";
  if (precheck?.status === "warn") return "warn";
  return "good";
}

function activeSelectionBatchRecords(product = {}) {
  const records = Array.isArray(product.generationRecords) ? product.generationRecords : [];
  return records.filter((record) => /draft|queued|running|retrying|prompt_ready/i.test(String(record.itemStatus || record.batchStatus || "")));
}

function hasActiveSelectionBatch(product = {}) {
  return activeSelectionBatchRecords(product).length > 0;
}

function activeSelectionBatchReason(product = {}) {
  const activeRecords = activeSelectionBatchRecords(product);
  if (!activeRecords.length) return "";
  const first = activeRecords[0];
  return `${first.batchName || "已有批次"} · ${generationStatusLabel(first)}`;
}

function activeSelectionBatchNextAction(record = {}) {
  const status = String(record.itemStatus || record.batchStatus || "").toLowerCase();
  if (status === "draft") return "启动或检查草稿";
  if (/queued|running|retrying/.test(status)) return "等待生成完成";
  if (status === "prompt_ready") return "检查提示词并提交视频";
  return "查看批次进度";
}

function canStartSelectionBatchRecord(record = {}) {
  const status = String(record.itemStatus || record.batchStatus || "").toLowerCase();
  return Boolean(record.batchId) && status === "draft";
}

function canCreateSelectionBatchFromProduct(product = {}) {
  return ["可测", "复测", "放大"].includes(product.lifecycle) && !hasActiveSelectionBatch(product);
}

function selectionBatchGateForProduct(product = {}) {
  const precheck = materialPrecheckForProduct(product);
  const cardPrecheck = productCardPrecheck(product);
  const compliance = complianceSummaryForProduct(product);
  const researchTask = researchTaskSummaryForProduct(product);
  const baseCanCreate = canCreateSelectionBatchFromProduct(product);
  const materialBlocked = precheck.status === "blocked";
  const cardBlocked = cardPrecheck.status === "blocked";
  const complianceBlocked = compliance.status === "blocked";
  const researchBlocked = researchTask.status === "blocked";
  const materialWarn = precheck.status === "warn";
  const cardWarn = cardPrecheck.status === "warn";
  const complianceWarn = compliance.status === "warn";
  const researchWarn = researchTask.status === "warn";
  let issue = "素材与合规可生成";
  let action = "保持商品事实表达，按平台要求标识 AI 辅助创作。";
  let tone = "good";

  if (!baseCanCreate) {
    issue = hasActiveSelectionBatch(product)
      ? activeSelectionBatchReason(product) || "已有草稿或生成任务"
      : "当前生命周期不可建批次";
    action = "先处理已有批次或把 SKU 调整到可测、复测、放大状态。";
    tone = "muted";
  } else if (complianceBlocked) {
    issue = compliance.primary;
    action = compliance.action;
    tone = "bad";
  } else if (materialBlocked) {
    issue = precheck.hardIssues[0] || "关键素材未就绪";
    action = "先补商品卡、真实场景图、实测素材或资质截图。";
    tone = "bad";
  } else if (cardBlocked) {
    issue = cardPrecheck.nextGap || "商品卡承接字段未就绪";
    action = "先补商品卡标题、主图、详情、价格、差评或履约字段。";
    tone = "bad";
  } else if (researchBlocked) {
    issue = researchTask.label;
    action = researchTask.action;
    tone = "bad";
  } else if (complianceWarn) {
    issue = compliance.primary;
    action = compliance.action;
    tone = "warn";
  } else if (materialWarn) {
    issue = precheck.warnings[0] || "素材可建草稿但需要保守表达";
    action = "建保守脚本，避免效果承诺和过度卖点。";
    tone = "warn";
  } else if (cardWarn) {
    issue = cardPrecheck.nextGap || "商品卡字段待核";
    action = "可建保守草稿，但必须按商品卡事实表达，缺失字段不写入脚本。";
    tone = "warn";
  } else if (researchWarn) {
    issue = researchTask.label;
    action = researchTask.action;
    tone = "warn";
  }

  return {
    precheck,
    cardPrecheck,
    compliance,
    researchTask,
    baseCanCreate,
    materialBlocked,
    cardBlocked,
    complianceBlocked,
    researchBlocked,
    materialWarn,
    cardWarn,
    complianceWarn,
    researchWarn,
    canQueue: baseCanCreate && !materialBlocked && !cardBlocked && !complianceBlocked && !researchBlocked,
    issue,
    action,
    tone
  };
}

function selectionBatchStageName(product = {}) {
  if (product.lifecycle === "放大") return "放大";
  if (product.lifecycle === "复测") return "复测";
  return "测品";
}

function selectionBatchLifecycleAfterCreate(product = {}) {
  if (product.lifecycle === "放大") return "放大";
  if (product.lifecycle === "复测") return "复测";
  return "小批量测试";
}

function selectionBatchActionLabel(product, accounts = accountAssetSeeds) {
  if (hasActiveSelectionBatch(product)) return "看批次";
  if (["可测", "复测", "放大"].includes(product.lifecycle)) {
    const gate = selectionBatchGateForProduct(product);
    const accountFit = accountFitSummaryForProduct(product, accounts);
    const assetVerification = assetVerificationGateForProduct(product, accountFit);
    if (gate.complianceBlocked) return "合规拦截";
    if (gate.materialBlocked) return "预检拦截";
    if (gate.cardBlocked) return "商品卡拦截";
    if (gate.researchBlocked) return "来源拦截";
    if (assetVerification.computedStatus === "blocked") return "验证拦截";
    if (assetVerification.requiresSave) return assetVerification.isStale ? "重存验证" : "保存验证";
    if (accountFit.status === "blocked") return "账号拦截";
    if (gate.complianceWarn || gate.materialWarn || gate.cardWarn || gate.researchWarn || accountFit.status === "warn" || assetVerification.status === "warn") return "保守建批次";
    if (product.lifecycle === "复测") return "建复测批次";
    if (product.lifecycle === "放大") return "建放大批次";
    return "建批次";
  }
  if (product.lifecycle === "小批量测试") return "看批次";
  return "补资产";
}

function acceptanceStatusText(status) {
  if (status === "blocked") return "阻断";
  if (status === "warn") return "待核";
  return "通过";
}

function acceptanceToneForStatus(status) {
  if (status === "blocked") return "bad";
  if (status === "warn") return "warn";
  return "good";
}

function productAcceptanceGateRows({
  product = {},
  accounts = accountAssetSeeds,
  accountFit,
  materialPrecheck,
  cardPrecheck,
  batchGate,
  assetVerification
} = {}) {
  const score = Number(product.totalScore || 0);
  const lifecycle = product.lifecycle || "未定";
  const compliance = batchGate?.compliance || complianceSummaryForProduct(product);
  const researchTask = batchGate?.researchTask || researchTaskSummaryForProduct(product);
  const material = materialPrecheck || batchGate?.precheck || materialPrecheckForProduct(product);
  const card = cardPrecheck || productCardPrecheck(product);
  const account = accountFit || accountFitSummaryForProduct(product, accounts);
  const gate = batchGate || selectionBatchGateForProduct(product);
  const verification = assetVerification || assetVerificationGateForProduct(product, account);
  const activeRecords = activeSelectionBatchRecords(product);
  const firstActiveRecord = activeRecords[0] || {};
  const canCreate = gate.canQueue && account.status !== "blocked" && verification.computedStatus !== "blocked";
  const hasBatchWarning = gate.complianceWarn || gate.materialWarn || gate.cardWarn || gate.researchWarn || account.status === "warn" || verification.status === "warn";
  const scoreBlocked = lifecycle === "淘汰" || score < 75;
  const scoreWarn = !scoreBlocked && !["可测", "小批量测试", "复测", "放大"].includes(lifecycle);
  const materialIssue = material.hardIssues?.[0] || material.warnings?.[0] || "素材清单可用";
  const cardIssue = productCardIssueList(card)[0] || card.nextGap || "商品卡承接可用";
  let batchStatus = "blocked";
  let batchDetail = gate.issue || "当前不可建批次";
  let batchAction = gate.action || "先补齐阻断项，再进入测品批次。";
  let batchActionKind = "product";
  let batchActionLabel = "处理";

  if (activeRecords.length) {
    batchStatus = "warn";
    batchDetail = activeSelectionBatchReason(product);
    batchAction = activeSelectionBatchNextAction(firstActiveRecord);
    batchActionKind = "activeBatch";
    batchActionLabel = "看批次";
  } else if (canCreate) {
    batchStatus = hasBatchWarning ? "warn" : "pass";
    batchDetail = hasBatchWarning ? "可建保守草稿" : "可进入测品草稿";
    batchAction = hasBatchWarning
      ? "建批次时收窄到商品事实，避开待核卖点和效果承诺。"
      : "按当前 SKU 资产包创建测品草稿。";
    batchActionKind = "createBatch";
    batchActionLabel = hasBatchWarning ? "保守建草稿" : "建草稿";
  } else if (account.status === "blocked") {
    batchDetail = account.label;
    batchAction = account.action;
    batchActionKind = "account";
    batchActionLabel = "补账号";
  } else if (gate.researchBlocked) {
    batchActionKind = "source";
    batchActionLabel = "补来源";
  } else if (verification.computedStatus === "blocked") {
    batchDetail = verification.label;
    batchAction = verification.primaryAction;
    batchActionKind = "verification";
    batchActionLabel = "补验证";
  } else if (gate.cardBlocked) {
    batchActionKind = "card";
    batchActionLabel = "补商品卡";
  } else if (gate.materialBlocked) {
    batchActionKind = card.status === "blocked" ? "card" : "assetPlan";
    batchActionLabel = card.status === "blocked" ? "补商品卡" : "保存计划";
  } else if (gate.complianceBlocked) {
    batchActionKind = "product";
    batchActionLabel = "核规则";
  } else if (!gate.baseCanCreate) {
    batchActionKind = "score";
    batchActionLabel = "看评分";
  }

  const rows = [
    {
      id: "score",
      label: "评分与生命周期",
      status: scoreBlocked ? "blocked" : scoreWarn ? "warn" : "pass",
      detail: `${score || 0} 分 · ${lifecycle}`,
      action: scoreBlocked
        ? "低于 75 分或已淘汰的 SKU 不进入测品，先复核评分、风险与复盘数据。"
        : scoreWarn
          ? "复核评分维度或补齐资产后再放行。"
          : "评分达到测品线，继续核验资产与账号。",
      actionKind: scoreBlocked || scoreWarn ? "score" : "",
      actionLabel: scoreBlocked || scoreWarn ? "看评分" : ""
    },
    {
      id: "compliance",
      label: "合规与禁用表达",
      status: compliance.status,
      detail: `${compliance.blockCount || 0} 阻断 / ${compliance.warnCount || 0} 待核`,
      action: compliance.action,
      actionKind: compliance.status === "pass" ? "" : "product",
      actionLabel: compliance.status === "pass" ? "" : "核规则"
    },
    {
      id: "research",
      label: "调研来源",
      status: researchTask.status,
      detail: researchTask.evidence || researchTask.research?.label || "来源待补",
      action: researchTask.action,
      actionKind: researchTask.status === "pass" ? "" : "source",
      actionLabel: researchTask.status === "pass" ? "" : "补来源"
    },
    {
      id: "account",
      label: "账号承接",
      status: account.status,
      detail: `${account.strength || "未匹配"} · ${account.account?.name || "未匹配账号"}`,
      action: account.action,
      actionKind: account.status === "pass" ? "" : "account",
      actionLabel: account.status === "pass" ? "" : "补账号"
    },
    {
      id: "material",
      label: "素材预检",
      status: material.status,
      detail: `${material.percent || 0}% · ${material.ready || 0}/${material.total || 0} 项`,
      action: materialIssue,
      actionKind: material.status === "pass" ? "" : "assetPlan",
      actionLabel: material.status === "pass" ? "" : "保存计划"
    },
    {
      id: "card",
      label: "商品卡承接",
      status: card.status,
      detail: `${card.percent || 0}% · ${card.ready || 0}/${card.total || productCardFields.length} 字段`,
      action: cardIssue,
      actionKind: card.status === "pass" ? "" : "card",
      actionLabel: card.status === "pass" ? "" : "补商品卡"
    },
    {
      id: "verification",
      label: "生成前验证",
      status: verification.computedStatus === "blocked" ? "blocked" : verification.status === "warn" ? "warn" : "pass",
      detail: verification.label || verification.summary || "验证待保存",
      action: verification.primaryAction || verification.summary || "保存生成前资产验证记录。",
      actionKind: verification.computedStatus === "blocked" ? "verification" : verification.requiresSave ? "saveVerification" : "",
      actionLabel: verification.computedStatus === "blocked" ? "补验证" : verification.requiresSave ? verification.isStale ? "重存验证" : "保存验证" : ""
    },
    {
      id: "batch",
      label: "批次准入",
      status: batchStatus,
      detail: batchDetail,
      action: batchAction,
      actionKind: batchActionKind,
      actionLabel: batchActionLabel
    }
  ];

  return rows.map((row) => ({
    ...row,
    tone: acceptanceToneForStatus(row.status),
    statusLabel: acceptanceStatusText(row.status)
  }));
}

function productAcceptanceSummary(rows = [], product = {}) {
  const blockedRows = rows.filter((row) => row.status === "blocked");
  const warnRows = rows.filter((row) => row.status === "warn");
  const batchRow = rows.find((row) => row.id === "batch");
  const active = hasActiveSelectionBatch(product);
  const canQueue = !blockedRows.length && batchRow?.actionKind === "createBatch";
  const primaryRow = blockedRows[0] || warnRows[0] || batchRow || rows[0];
  const label = active
    ? "已进入批次，跟进回流"
    : blockedRows.length
      ? `未放行：${blockedRows.length} 项阻断`
      : warnRows.length
        ? `可保守推进：${warnRows.length} 项待核`
        : "可建测品草稿";
  return {
    blockedCount: blockedRows.length,
    warnCount: warnRows.length,
    passCount: rows.filter((row) => row.status === "pass").length,
    active,
    canQueue,
    label,
    tone: blockedRows.length ? "bad" : warnRows.length ? "warn" : "good",
    action: primaryRow?.action || "按当前资产包进入下一步。",
    primaryRow,
    batchRow
  };
}

function productAcceptanceText(product = {}, rows = [], summary = {}) {
  return [
    `SKU 准入验收：${product.sku || product.id || "未命名 SKU"}`,
    `结论：${summary.label || "待核"}`,
    `下一步：${summary.action || "按验收项处理"}`,
    `评分：${product.totalScore || 0} 分 / 状态：${product.lifecycle || "未定"}`,
    "",
    ...rows.map((row) => `- [${row.statusLabel}] ${row.label}：${row.detail}；动作：${row.action}`)
  ].join("\n");
}

function productIntelligenceText(product = {}) {
  return [
    product.sku,
    product.category,
    product.node,
    product.coreReason,
    product.riskLevel,
    ...(product.riskTags || []),
    ...(product.vetoFlags || []),
    ...(product.assetGaps || []),
    ...(product.bannedWords || []),
    ...normalizeResearchSources(product).flatMap((source) => [source.type, source.label, source.note]),
    ...Object.values(normalizeProductCardCheck(product))
  ].join(" ");
}

function matchedHardRulesForProduct(product = {}) {
  const sourceText = productIntelligenceText(product);
  return selectionHardRules.filter((rule) => rule.matchTerms.some((term) => sourceText.includes(term)));
}

function selectedSignalsForProduct(product = {}) {
  const sourceText = productIntelligenceText(product);
  const signalIds = new Set(["search-card", "aigc-label", "platform-rules", "live-commerce-verification"]);
  if (/(雨季|暑期|端午|毕业|父亲节|世界杯|观赛|高温|梅雨|旅行)/.test(sourceText)) {
    signalIds.add("season-node");
  }
  return selectionMarketSignals.filter((signal) => signalIds.has(signal.id));
}

function selectionDecisionForProduct(product = {}, accounts = accountAssetSeeds) {
  const materialPrecheck = materialPrecheckForProduct(product);
  const cardPrecheck = productCardPrecheck(product);
  const compliance = complianceSummaryForProduct(product);
  const accountFit = accountFitSummaryForProduct(product, accounts);
  const assetVerification = assetVerificationGateForProduct(product, accountFit);
  const research = researchSummaryForProduct(product);
  const researchTask = researchTaskSummaryForProduct(product);
  const hardRules = matchedHardRulesForProduct(product);
  const review = productReviewSummary(product);
  const reviewLifecycle = review.lifecycle || review.verdict;
  const score = product.scores || {};
  const totalScore = Number(product.totalScore || productSelectionScore(product));
  const blockers = [];
  const warnings = [];
  const evidence = [];
  let label = "可建测品草稿";
  let stage = "测品";
  let action = "建批次草稿";
  let tone = "good";
  let route = productLibraryTarget(product.id);
  let canCreateBatch = canCreateSelectionBatchFromProduct(product);

  evidence.push(`总分 ${totalScore}：${totalScore >= 85 ? "优先测" : totalScore >= 75 ? "可小样本测" : "低于 75 分门槛"}`);
  evidence.push(`商品卡：${productCardPrecheckLabel(cardPrecheck)}；${cardPrecheck.nextGap || "承接可用"}`);
  evidence.push(`素材：${materialPrecheckLabel(materialPrecheck)}`);
  evidence.push(`账号：${accountFit.label}${accountFit.account ? ` / ${accountFit.account.name}` : ""}`);
  evidence.push(`来源：${researchTask.label} / ${researchTask.evidence || research.primary}`);
  evidence.push(`验证：${assetVerification.label}`);

  if (product.lifecycle === "淘汰" || reviewLifecycle === "淘汰") {
    label = "不进本轮";
    stage = "淘汰";
    action = "保留记录";
    tone = "bad";
    canCreateBatch = false;
    blockers.push(review.commentIssues || "已被人工或复盘判定为淘汰。");
  } else if (product.lifecycle === "小批量测试" || hasActiveSelectionBatch(product)) {
    label = "待回流";
    stage = "回收数据";
    action = "看批次";
    tone = "warn";
    route = activeSelectionBatchTarget(product);
    canCreateBatch = false;
    warnings.push(activeSelectionBatchReason(product) || "已有测品批次，先等提示词、视频或数据回流。");
  } else if (compliance.status === "blocked") {
    label = "合规拦截";
    stage = "合规";
    action = "补证据";
    tone = "bad";
    canCreateBatch = false;
    blockers.push(compliance.action);
  } else if (materialPrecheck.status === "blocked") {
    label = "素材拦截";
    stage = "补素材";
    action = "补关键素材";
    tone = "bad";
    canCreateBatch = false;
    blockers.push(materialPrecheck.hardIssues[0] || "关键素材未就绪。");
  } else if (cardPrecheck.status === "blocked") {
    label = "商品卡拦截";
    stage = "商品卡";
    action = "修商品卡";
    tone = "bad";
    canCreateBatch = false;
    blockers.push(cardPrecheck.nextGap);
  } else if (accountFit.status === "blocked") {
    label = "账号拦截";
    stage = "账号";
    action = "补账号资产";
    tone = "bad";
    route = "accountAssets";
    canCreateBatch = false;
    blockers.push(accountFit.action);
  } else if (researchTask.status === "blocked") {
    label = "来源拦截";
    stage = "来源证据";
    action = "补调研来源";
    tone = "bad";
    canCreateBatch = false;
    blockers.push(researchTask.action);
  } else if (assetVerification.computedStatus === "blocked") {
    label = "验证拦截";
    stage = "生成前验证";
    action = "补验证";
    tone = "bad";
    canCreateBatch = false;
    blockers.push(assetVerification.primaryAction || assetVerification.summary);
  } else if (totalScore < 75) {
    label = "低分不测";
    stage = "观察";
    action = "降权观察";
    tone = "bad";
    canCreateBatch = false;
    blockers.push("总分低于 75，不进入第一批测品。");
  } else if (product.lifecycle === "放大" || reviewLifecycle === "放大") {
    label = "可二轮放大";
    stage = "放大";
    action = "建放大批次";
    tone = "good";
    warnings.push("保留成交脚本结构，只扩相邻场景和搜索词。");
  } else if (product.lifecycle === "复测" || reviewLifecycle === "复测") {
    label = "复测";
    stage = "复测";
    action = "建复测批次";
    tone = "warn";
    warnings.push("围绕点击、商品卡承接或评论问题重写下一轮脚本。");
  } else if (product.lifecycle === "待补资产" || Number(product.assetPercent || 0) < 78) {
    label = "补资产后测";
    stage = "补资产";
    action = "补资产";
    tone = "warn";
    canCreateBatch = false;
    warnings.push((product.assetGaps || [])[0] || "补商品主图、真实场景图、参数或商品卡截图。");
  }

  if (hardRules.length >= 3 || product.riskLevel === "高") {
    warnings.push("命中多个硬规则或高风险标签，批次前必须人工复核。");
    if (tone === "good") tone = "warn";
  }
  if (compliance.status === "warn") {
    warnings.push(compliance.action);
    if (tone === "good") tone = "warn";
  }
  if (cardPrecheck.status === "warn") {
    warnings.push(`商品卡待核：${cardPrecheck.nextGap}`);
    if (tone === "good") tone = "warn";
  }
  if (materialPrecheck.status === "warn") {
    warnings.push(materialPrecheck.warnings[0] || "素材可建草稿但需要保守表达。");
    if (tone === "good") tone = "warn";
  }
  if (accountFit.status === "warn") {
    warnings.push(accountFit.action);
    if (tone === "good") tone = "warn";
  }
  if (Number(score.compliance || 0) <= 7 || Number(score.aftersale || 0) <= 7) {
    warnings.push("合规或售后单项偏低，先核资质、差评和退货风险。");
    if (tone === "good") tone = "warn";
  }
  if (research.tone === "warn" && (tone === "good" || product.source === "manual-intake")) {
    warnings.push(research.action);
    if (tone === "good") tone = "warn";
  }
  if (researchTask.status === "warn") {
    warnings.push(researchTask.action);
    if (tone === "good") tone = "warn";
  }
  if (assetVerification.requiresSave) {
    warnings.push("建批次前将自动保存生成前验证记录，确保批次草稿可追溯。");
    if (tone === "good") tone = "warn";
  } else if (assetVerification.status === "warn") {
    warnings.push(assetVerification.primaryAction || assetVerification.summary);
    if (tone === "good") tone = "warn";
  }

  const primaryReason = blockers[0] || warnings[0] || "趋势、商品卡、素材、账号和合规均可进入小批量测试。";
  const priority = (tone === "bad" ? 120 : tone === "warn" ? 80 : 40)
    + (canCreateBatch ? 20 : 0)
    + Math.max(0, 100 - totalScore)
    + hardRules.length * 4;

  return {
    product,
    label,
    stage,
    action,
    tone,
    route,
    canCreateBatch,
    primaryReason,
    blockers: [...new Set(blockers)].slice(0, 5),
    warnings: [...new Set(warnings)].slice(0, 6),
    evidence: [...new Set(evidence)].slice(0, 6),
    accountFit,
    research,
    researchTask,
    assetVerification,
    compliance,
    cardPrecheck,
    materialPrecheck,
    hardRules,
    signals: selectedSignalsForProduct(product),
    priority
  };
}

function buildSelectionDecisionQueue(products = [], accounts = accountAssetSeeds) {
  return (products || [])
    .map((product) => selectionDecisionForProduct(product, accounts))
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore);
}

function buildProductIntelligence(product = {}, accounts = accountAssetSeeds) {
  const decisionSummary = selectionDecisionForProduct(product, accounts);
  const materialPrecheck = materialPrecheckForProduct(product);
  const cardPrecheck = productCardPrecheck(product);
  const hardRules = matchedHardRulesForProduct(product);
  const complianceFindings = complianceFindingsForProduct(product);
  const blockingCompliance = complianceFindings.filter((finding) => finding.severity === "block");
  const warningCompliance = complianceFindings.filter((finding) => finding.severity === "warn");
  const score = product.scores || {};
  const actions = [decisionSummary.primaryReason];
  let decision = decisionSummary.label;
  let tone = decisionSummary.tone;

  if (materialPrecheck.status === "blocked") {
    decision = "先补素材再测";
    tone = "bad";
    actions.push(materialPrecheck.hardIssues[0] || "补齐关键素材后再建批次。");
  } else if (cardPrecheck.status === "blocked") {
    decision = "先修商品卡再测";
    tone = "bad";
    actions.push(cardPrecheck.nextGap);
  } else if (product.lifecycle === "待补资产" || Number(product.assetPercent || 0) < 78) {
    decision = "补资产后测试";
    tone = "warn";
    actions.push(`优先补齐：${(product.assetGaps || [])[0] || "商品主图、真实场景图、参数和资质截图"}`);
  }
  if (blockingCompliance.length) {
    decision = "合规拦截，先补证据";
    tone = "bad";
    actions.push(blockingCompliance[0].action || blockingCompliance[0].issue);
  } else if (warningCompliance.length) {
    decision = decision === "可小批量测试" ? "合规核验后测试" : decision;
    tone = tone === "good" ? "warn" : tone;
    actions.push(warningCompliance[0].action || warningCompliance[0].issue);
  }

  if (cardPrecheck.status === "warn") {
    actions.push(`商品卡待核：${cardPrecheck.nextGap}`);
  } else if (Number(score.card || 0) < 13) {
    actions.push("先优化商品卡标题、主图、规格和详情页承接，再看播放点击。");
  }
  if (Number(score.compliance || 0) < 8 || product.riskLevel === "高" || hardRules.length >= 3 || complianceFindings.length >= 2) {
    decision = decision === "可小批量测试" ? "合规核验后测试" : decision;
    tone = tone === "good" ? "warn" : tone;
    actions.push("先查资质、授权、禁用话术和价格一致性，再进入批量生成。");
  }
  if (product.lifecycle === "放大" && !blockingCompliance.length && !warningCompliance.length) {
    decision = "可做二轮放大";
    tone = "good";
    actions.push("保留当前账号和成交脚本，只扩相邻场景和搜索词。");
  } else if (product.lifecycle === "复测") {
    decision = "按复盘做复测";
    tone = "warn";
    actions.push("围绕低点击、低商品卡承接或评论问题重写下一轮脚本。");
  }
  if (!actions.length) {
    actions.push("按痛点演示、场景清单、搜索答案各做 1 条，先跑小样本。");
  }

  return {
    decision,
    tone,
    decisionSummary,
    hardRules: hardRules.slice(0, 4),
    complianceFindings: complianceFindings.slice(0, 5),
    signals: selectedSignalsForProduct(product),
    actions: [...new Set(actions)].slice(0, 4)
  };
}

function splitAssetList(value, limit = 12) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || "").split(/[、,，/;\n]+/);
  return rawItems
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index)
    .slice(0, limit);
}

function splitCandidateList(value) {
  return splitAssetList(value, 8);
}

function listInputValue(value) {
  return splitAssetList(value, 16).join("、");
}

function inferDocPackStructure(name) {
  const hit = accountDocPackStructureHints.find((item) => item.pattern.test(String(name || "")));
  return hit?.structure || "搜索答案型";
}

function cleanDocPackName(name) {
  return String(name || "").replace(/\s+v\d+$/i, "").trim();
}

function normalizeDocPackVersions(account = {}) {
  const existing = Array.isArray(account.docPackVersions) ? account.docPackVersions : [];
  const source = existing.length
    ? existing
    : splitAssetList(account.docPacks || [], 16).map((name, index) => ({
      name: cleanDocPackName(name) || name,
      version: /v\d+/i.test(name) ? name.match(/v\d+/i)?.[0] : "v1",
      structure: inferDocPackStructure(name),
      status: index === 0 ? "主用" : "备用",
      note: ""
    }));
  return source
    .map((item, index) => {
      const rawName = String(item?.name || item || "").trim();
      const name = cleanDocPackName(rawName) || rawName;
      if (!name) return null;
      return {
        id: String(item?.id || `doc-${index + 1}`).trim(),
        name,
        version: String(item?.version || (/v\d+/i.test(rawName) ? rawName.match(/v\d+/i)?.[0] : "v1")).trim(),
        structure: String(item?.structure || inferDocPackStructure(rawName || name)).trim(),
        status: String(item?.status || (index === 0 ? "主用" : "备用")).trim(),
        note: String(item?.note || item?.notes || "").trim()
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function docPackVersionsToInput(account = {}) {
  return normalizeDocPackVersions(account)
    .map((item) => [item.name, item.version, item.structure, item.status, item.note].filter(Boolean).join(" | "))
    .join("\n");
}

function parseDocPackVersionsInput(value, fallbackNames = []) {
  const lines = String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const source = lines.length ? lines : splitAssetList(fallbackNames, 16);
  return source.map((line, index) => {
    const parts = String(line).split("|").map((part) => part.trim());
    const name = parts[0] || `DOC 包 ${index + 1}`;
    return {
      id: `doc-${index + 1}`,
      name,
      version: parts[1] || (/v\d+/i.test(name) ? name.match(/v\d+/i)?.[0] : "v1"),
      structure: parts[2] || inferDocPackStructure(name),
      status: parts[3] || (index === 0 ? "主用" : "备用"),
      note: parts.slice(4).join(" | ")
    };
  }).slice(0, 12);
}

function normalizePlatformBindings(account = {}) {
  const existing = Array.isArray(account.platformBindings) ? account.platformBindings : [];
  const platformNames = existing.length
    ? existing.map((item) => item.platform || item.name || item).filter(Boolean)
    : splitAssetList(account.platform === "多平台" ? "抖音、小红书、视频号" : account.platform || "抖音", 4);
  return platformNames
    .map((name, index) => {
      const source = existing.find((item) => item.platform === name || item.name === name) || {};
      const preset = accountPlatformRulePresets[name] || accountPlatformRulePresets.抖音;
      return {
        ...preset,
        ...source,
        platform: name,
        status: source.status || (index === 0 ? "主平台" : "备用"),
        avoid: splitAssetList(source.avoid || preset.avoid || [], 12)
      };
    })
    .slice(0, 4);
}

function platformBindingsToInput(account = {}) {
  return normalizePlatformBindings(account).map((item) => item.platform).join("、");
}

function parsePlatformBindingsInput(value, primaryPlatform = "抖音") {
  const names = splitAssetList(value || primaryPlatform || "抖音", 4);
  return normalizePlatformBindings({
    platformBindings: names.map((name, index) => ({
      platform: name,
      status: index === 0 ? "主平台" : "备用"
    }))
  });
}

function selectDocPackForProduct(account, product) {
  const versions = normalizeDocPackVersions(account);
  if (!versions.length) return null;
  const template = String(product?.primaryTemplate || "");
  const category = String(product?.category || "");
  return versions.find((item) => item.status === "主用" && (template.includes(item.structure) || item.name.includes(category)))
    || versions.find((item) => template.includes(item.structure) || item.name.includes(category))
    || versions.find((item) => item.status === "主用")
    || versions[0];
}

function selectPlatformBindingForAccount(account) {
  const bindings = normalizePlatformBindings(account);
  return bindings.find((item) => item.status === "主平台") || bindings[0] || accountPlatformRulePresets.抖音;
}

function accountAssetToDraft(account = {}) {
  const docPackVersions = normalizeDocPackVersions(account);
  const platformBindings = normalizePlatformBindings(account);
  return {
    id: account.id || "",
    name: account.name || "",
    platform: account.platform || "抖音",
    position: account.position || "",
    tone: account.tone || "",
    fit: listInputValue(account.fit || []),
    avoid: listInputValue(account.avoid || []),
    scenes: listInputValue(account.scenes || []),
    docPacks: listInputValue(account.docPacks || []),
    docPackVersions: docPackVersionsToInput({ docPackVersions, docPacks: account.docPacks || [] }),
    platformBindings: platformBindingsToInput({ platformBindings }),
    recommended: listInputValue(account.recommended || []),
    lastSignal: account.lastSignal || ""
  };
}

function emptyAccountAssetDraft() {
  return accountAssetToDraft({
    platform: "抖音",
    tone: "清单式、真实、强调适用边界",
    fit: [],
    avoid: ["无授权IP", "强功效承诺", "伪造真人体验"],
    scenes: [],
    docPacks: ["搜索答案型 DOC v1"],
    docPackVersions: [{ name: "搜索答案型 DOC", version: "v1", structure: "搜索答案型", status: "主用", note: "默认搜索承接脚本" }],
    platformBindings: [{ platform: "抖音", status: "主平台" }],
    recommended: []
  });
}

function uniqueList(items = []) {
  const seen = new Set();
  return (items || [])
    .map((item) => String(item || "").trim())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
}

function accountDraftFromCoverageGap(product = {}, row = {}) {
  const category = String(product.category || "待定类目").trim();
  const sku = String(product.sku || "候选 SKU").trim();
  const structure = String(product.primaryTemplate || "搜索答案型").trim();
  const nodeScenes = String(product.node || "")
    .split(/[、,，/|｜\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const scenes = uniqueList([
    ...nodeScenes,
    ...(product.videoAngles || []),
    ...(product.whiteList || [])
  ]).slice(0, 8);
  const avoid = uniqueList([
    ...(product.bannedWords || []),
    ...(product.riskTags || []),
    "无授权 IP",
    "强功效承诺",
    "伪造真人体验",
    "未核实参数"
  ]).slice(0, 12);
  const docBaseName = `${category}${structure.replace(/型$/, "")} DOC`;
  const fit = uniqueList([category, ...nodeScenes]).slice(0, 8);
  return accountAssetToDraft({
    name: `${category}承接号`,
    platform: "抖音",
    position: `围绕 ${category} / ${product.node || "当前节点"} 承接 ${sku}，以${structure}做低风险测品和商品卡转化。`,
    tone: "清单式、真实、先说适用边界，不做夸张测评",
    fit,
    avoid,
    scenes: scenes.length ? scenes : ["商品场景", "痛点演示", "商品卡承接"],
    docPacks: [`${docBaseName} v1`],
    docPackVersions: [{
      name: docBaseName,
      version: "v1",
      structure,
      status: "主用",
      note: `由 ${sku} 账号适配缺口生成，保存前补充真人设、素材边界和平台规则。`
    }],
    platformBindings: [{ platform: "抖音", status: "主平台" }],
    recommended: [sku],
    lastSignal: `来自账号适配准入：${row.fit?.label || row.strength || "账号缺口"}。保存后回到准入队列复核账号匹配。`
  });
}

function accountDraftToPayload(draft = {}) {
  const docPackNames = splitAssetList(draft.docPacks, 16);
  const docPackVersions = parseDocPackVersionsInput(draft.docPackVersions, docPackNames);
  const platformBindings = parsePlatformBindingsInput(draft.platformBindings || draft.platform, draft.platform);
  return {
    ...(draft.id ? { id: draft.id } : {}),
    name: String(draft.name || "").trim(),
    platform: String(draft.platform || "抖音").trim(),
    position: String(draft.position || "").trim(),
    tone: String(draft.tone || "").trim(),
    fit: splitAssetList(draft.fit, 16),
    avoid: splitAssetList(draft.avoid, 16),
    scenes: splitAssetList(draft.scenes, 16),
    docPacks: docPackVersions.length ? docPackVersions.map((item) => `${item.name} ${item.version}`.trim()) : docPackNames,
    docPackVersions,
    platformBindings,
    recommended: splitAssetList(draft.recommended, 16),
    lastSignal: String(draft.lastSignal || "").trim()
  };
}

function emptyCandidateDraft() {
  return {
    sku: "",
    category: "",
    node: "",
    priceBand: "",
    commission: "中",
    coreReason: "",
    videoAngles: "",
    notes: ""
  };
}

function inferCandidateTemplate(text) {
  if (/端午|国风|非遗|老字号|礼物|父亲节|香囊|香氛/.test(text)) return "故事种草型";
  if (/清单|旅行|宿舍|玩水|观赛|毕业|父亲节|开学/.test(text)) return "场景清单型";
  if (/搜索|怎么|买什么|送什么|适合/.test(text)) return "搜索答案型";
  return "痛点演示型";
}

function inferCandidateAngles(text) {
  if (/雨季|防潮|除湿|防霉/.test(text)) return ["潮湿痛点", "收纳前后", "梅雨季备用"];
  if (/夏季|清凉|防晒|风扇|散热|冰袖/.test(text)) return ["通勤清凉", "宿舍办公室", "户外备用"];
  if (/玩水|防水|海边|漂流|旅行/.test(text)) return ["玩水清单", "旅行防漏带", "真实测试"];
  if (/宠物|猫|狗|粘毛/.test(text)) return ["宠物日常", "清洁前后", "低风险消耗"];
  if (/父亲节|礼物|国风|端午|香/.test(text)) return ["送礼不尴尬", "节日场景", "日常可用"];
  if (/观赛|世界杯|看球/.test(text)) return ["宿舍观赛", "客厅清单", "熬夜舒服一点"];
  return ["痛点演示", "场景清单", "搜索答案"];
}

function inferCandidateBannedWords(text) {
  const banned = new Set(["全网最低", "官方同款", "绝对有效"]);
  if (/防水/.test(text)) ["绝对不进水", "潜水级", "全机型通用"].forEach((item) => banned.add(item));
  if (/香|艾草|香囊|香氛/.test(text)) ["治病", "驱邪保健康", "净化甲醛"].forEach((item) => banned.add(item));
  if (/食品|零食|茶|饮|保健/.test(text)) ["治疗功效", "减肥降糖", "包治"].forEach((item) => banned.add(item));
  if (/风扇|台灯|散热|电器|灯/.test(text)) ["静音无声", "降温多少度", "永久保护"].forEach((item) => banned.add(item));
  if (/宠物/.test(text)) ["治病", "替代药物", "保证适口"].forEach((item) => banned.add(item));
  return [...banned].slice(0, 8);
}

function inferCandidateAssetGaps(text) {
  const gaps = new Set(["商品主图", "真实场景图", "参数/规格截图", "商品卡截图"]);
  if (/防水|防滑|除湿|散热|效果|测试/.test(text)) gaps.add("真实测试素材");
  if (/品牌|授权|FIFA|世界杯|非遗|老字号|食品|电器|儿童|宠物食品/.test(text)) gaps.add("资质/授权凭证");
  if (/适配|尺寸|型号|规格|容量/.test(text)) gaps.add("适配/尺寸说明");
  return [...gaps].slice(0, 8);
}

function candidatePriceSignal(priceBand) {
  const numbers = String(priceBand || "").match(/\d+/g)?.map(Number) || [];
  const maxPrice = numbers.length ? Math.max(...numbers) : 0;
  if (!maxPrice) return "unknown";
  if (maxPrice <= 99) return "low";
  if (maxPrice <= 199) return "mid";
  return "high";
}

function estimateCandidateScores(product) {
  const text = productIntelligenceText(product);
  const priceSignal = candidatePriceSignal(product.priceBand);
  const hardRuleCount = matchedHardRulesForProduct(product).length;
  const scores = {
    ai: 12,
    demand: 12,
    card: 10,
    profit: 11,
    presale: 8,
    aftersale: 8,
    supply: 7,
    compliance: 8
  };
  if (/痛点|场景|清单|前后|收纳|防潮|清凉|宠物|礼物/.test(text)) scores.ai += 2;
  if (/雨季|梅雨|暑期|夏季|端午|毕业|父亲节|世界杯|观赛|高温/.test(text)) scores.demand += 2;
  if (priceSignal === "low") {
    scores.profit += 2;
    scores.presale += 1;
  } else if (priceSignal === "high") {
    scores.profit -= 2;
    scores.presale -= 1;
  }
  if (/待补|缺|资质|授权|适配|尺寸/.test(text)) scores.card -= 1;
  if (/冷链|尺码|安装|食品|电器|儿童|宠物食品/.test(text)) scores.aftersale -= 1;
  if (hardRuleCount >= 2) scores.compliance -= 2;
  if (/医疗|保健|药品|理疗|FIFA|球队|球员|奢侈|无授权/.test(text)) scores.compliance -= 3;
  return Object.fromEntries(selectionScoreDimensions.map((item) => [item.key, Math.max(0, Math.min(item.weight, scores[item.key] || 0))]));
}

function researchSourceTypeForText(text = "") {
  if (/罗盘|电商罗盘|数据罗盘|compass/i.test(text)) return "抖音电商罗盘";
  if (/精选联盟|联盟|佣金|达人带货/i.test(text)) return "精选联盟";
  if (/热搜|搜索词|搜索|指数|巨量算数|趋势/i.test(text)) return "搜索趋势";
  if (/规则|合规|资质|授权|处罚|治理|监管|市场监管|网信办/i.test(text)) return "规则合规";
  if (/618|端午|父亲节|毕业|暑期|世界杯|节点|节日/i.test(text)) return "节点日历";
  return "人工调研";
}

function sourceLabelFromUrl(url = "") {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (/douyin|jinritemai|bytedance/i.test(host)) return "抖音电商";
    if (/samr\.gov\.cn/i.test(host)) return "市场监管总局";
    if (/cac\.gov\.cn/i.test(host)) return "国家网信办";
    if (/gov\.cn/i.test(host)) return "政府网站";
    return host;
  } catch {
    return "外部链接";
  }
}

function extractResearchSources(text = "", fallbackType = "人工调研") {
  const sourceText = String(text || "");
  const urls = [...new Set((sourceText.match(/https?:\/\/[^\s，,；;）)】\]]+/g) || []).map((url) => url.replace(/[。.!?]+$/, "")))];
  const sources = urls.map((url, index) => ({
    id: `url-${index + 1}`,
    type: researchSourceTypeForText(sourceText),
    label: sourceLabelFromUrl(url),
    url,
    note: sourceText.replace(url, "").trim().slice(0, 120),
    checkedAt: new Date().toISOString()
  }));
  const inferredTypes = [
    "罗盘|电商罗盘|数据罗盘|compass",
    "精选联盟|联盟|佣金|达人带货",
    "热搜|搜索词|搜索|指数|巨量算数|趋势",
    "规则|合规|资质|授权|处罚|治理|监管|市场监管|网信办",
    "618|端午|父亲节|毕业|暑期|世界杯|节点|节日"
  ]
    .map((pattern) => {
      const regex = new RegExp(pattern, "i");
      return regex.test(sourceText) ? researchSourceTypeForText(pattern.replace(/\|.*/, "")) : "";
    })
    .filter(Boolean);
  for (const type of [...new Set(inferredTypes)]) {
    if (sources.some((source) => source.type === type && !source.url)) continue;
    sources.push({
      id: `signal-${sources.length + 1}`,
      type,
      label: type,
      url: "",
      note: sourceText.slice(0, 120),
      checkedAt: new Date().toISOString()
    });
  }
  if (!sources.length && sourceText.trim()) {
    sources.push({
      id: "manual-1",
      type: fallbackType,
      label: fallbackType,
      url: "",
      note: sourceText.trim().slice(0, 120),
      checkedAt: new Date().toISOString()
    });
  }
  return sources.slice(0, 8);
}

function normalizeResearchSources(product = {}) {
  const existing = Array.isArray(product.researchSources) ? product.researchSources : [];
  if (existing.length) {
    return existing
      .map((source, index) => ({
        id: String(source.id || `source-${index + 1}`),
        type: String(source.type || "人工调研"),
        label: String(source.label || source.sourceLabel || source.type || "调研来源"),
        url: String(source.url || source.sourceUrl || ""),
        note: String(source.note || source.evidence || ""),
        checkedAt: source.checkedAt || source.createdAt || ""
      }))
      .slice(0, 8);
  }
  if (product.source === "manual-intake") return extractResearchSources(product.coreReason || product.sku || "", "手动入库");
  return [{
    id: "local-research",
    type: "本地调研",
    label: "AI短视频带货选品调研整合",
    url: "/00_docs/AI短视频带货选品调研整合.md",
    note: "来自本地选品逻辑和种子 SKU。",
    checkedAt: ""
  }];
}

function researchSummaryForProduct(product = {}) {
  const sources = normalizeResearchSources(product);
  const types = [...new Set(sources.map((source) => source.type).filter(Boolean))];
  const linkCount = sources.filter((source) => source.url).length;
  const hasRuleSource = sources.some((source) => /规则|合规|监管|网信办|市场监管|资质|授权|质检|食品|电器|品牌|IP/.test(`${source.type}${source.label}${source.note}`));
  return {
    sources,
    types,
    linkCount,
    hasRuleSource,
    label: sources.length ? `${sources.length} 条来源` : "来源待补",
    tone: sources.length >= 2 || linkCount ? "good" : "warn",
    primary: sources[0]?.label || "补调研来源",
    action: sources.length ? "发布前复核来源、商品卡和素材是否一致。" : "补罗盘、精选联盟、热搜或平台规则截图/链接。"
  };
}

function researchTaskSummaryForProduct(product = {}) {
  const research = researchSummaryForProduct(product);
  const sourceText = [
    product.category,
    product.riskLevel,
    ...(product.riskTags || []),
    ...(product.vetoFlags || []),
    ...(product.assetGaps || []),
    ...(product.bannedWords || [])
  ].join(" ");
  const hardRuleCount = matchedHardRulesForProduct(product).length + Number((product.vetoFlags || []).length);
  const needsRuleSource = product.riskLevel === "高" || hardRuleCount >= 2 || /食品|资质|授权|品牌|IP|电器|儿童|医疗|功效|非遗|老字号|质检|电池|防水|适配/.test(sourceText);
  const externalLinkCount = research.sources.filter((source) => /^https?:\/\//i.test(source.url || "")).length;
  const externalRuleCount = research.sources.filter((source) =>
    /^https?:\/\//i.test(source.url || "") && /规则|合规|监管|网信办|市场监管|资质|授权|douyin|jinritemai|gov\.cn/i.test(`${source.type}${source.label}${source.note}${source.url}`)
  ).length;
  const sourceTypes = research.types.join(" / ") || research.primary;

  if (!research.sources.length) {
    return {
      research,
      status: "warn",
      tone: "warn",
      label: "调研来源待补",
      action: "补罗盘、精选联盟、热搜、平台规则或商品页截图/链接，至少留一条可复核来源。",
      evidence: "无来源记录",
      needsRuleSource,
      externalLinkCount,
      externalRuleCount
    };
  }

  if (needsRuleSource && !research.hasRuleSource) {
    return {
      research,
      status: "blocked",
      tone: "bad",
      label: "规则/资质来源待补",
      action: "补平台规则、资质、授权、质检或处罚案例来源，再进入批量生成。",
      evidence: sourceTypes,
      needsRuleSource,
      externalLinkCount,
      externalRuleCount
    };
  }

  if (needsRuleSource && !externalRuleCount) {
    return {
      research,
      status: "warn",
      tone: "warn",
      label: "规则来源待复核",
      action: "为高风险或资质类 SKU 补一条外部规则/授权/资质链接或截图，避免只依赖本地判断。",
      evidence: sourceTypes,
      needsRuleSource,
      externalLinkCount,
      externalRuleCount
    };
  }

  if (product.source === "manual-intake" && !externalLinkCount) {
    return {
      research,
      status: "warn",
      tone: "warn",
      label: "候选来源待复核",
      action: "手动导入候选品建议补一条外部来源，确认佣金、价格、商品卡和规则口径。",
      evidence: sourceTypes,
      needsRuleSource,
      externalLinkCount,
      externalRuleCount
    };
  }

  if (research.tone === "warn") {
    return {
      research,
      status: "warn",
      tone: "warn",
      label: "来源证据待核",
      action: research.action,
      evidence: sourceTypes,
      needsRuleSource,
      externalLinkCount,
      externalRuleCount
    };
  }

  return {
    research,
    status: "pass",
    tone: "good",
    label: "来源可用",
    action: "发布前复核来源、商品卡和素材是否一致。",
    evidence: sourceTypes,
    needsRuleSource,
    externalLinkCount,
    externalRuleCount
  };
}

function researchSourceKey(source = {}) {
  return String(source.url || `${source.type || ""}-${source.label || ""}`).trim().toLowerCase();
}

function researchTemplateMatchesProduct(template = {}, product = {}) {
  if (template.always) return true;
  const sourceText = [
    product.sku,
    product.category,
    product.node,
    product.coreReason,
    product.riskLevel,
    ...(product.riskTags || []),
    ...(product.vetoFlags || []),
    ...(product.assetGaps || []),
    ...(product.bannedWords || [])
  ].join(" ");
  return (template.matchTerms || []).some((term) => sourceText.includes(term));
}

function researchTemplateToSource(template = {}, checkedAt = "") {
  return {
    id: template.id || `source-${Date.now()}`,
    type: template.type || "规则来源",
    label: template.label || "规则来源",
    url: template.url || "",
    note: template.note || "",
    checkedAt
  };
}

function recommendedResearchSourcesForProduct(product = {}) {
  const existingKeys = new Set(normalizeResearchSources(product).map(researchSourceKey));
  return selectionResearchSourceTemplates
    .filter((template) => researchTemplateMatchesProduct(template, product))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .map((template) => researchTemplateToSource(template))
    .filter((source) => !existingKeys.has(researchSourceKey(source)));
}

function mergeResearchSourcesForProduct(product = {}, additions = []) {
  const merged = [];
  const seen = new Set();
  for (const source of [...normalizeResearchSources(product), ...(additions || [])]) {
    const normalized = {
      id: String(source.id || `source-${merged.length + 1}`),
      type: String(source.type || "调研来源"),
      label: String(source.label || source.sourceLabel || source.type || "调研来源"),
      url: String(source.url || source.sourceUrl || ""),
      note: String(source.note || source.evidence || ""),
      checkedAt: source.checkedAt || ""
    };
    const key = researchSourceKey(normalized);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }
  return merged.slice(0, 8);
}

function researchSourcePatchForProduct(product = {}, additions = recommendedResearchSourcesForProduct(product)) {
  const checkedAt = new Date().toISOString();
  const stampedAdditions = (additions || []).map((source) => ({ ...source, checkedAt }));
  const nextSources = mergeResearchSourcesForProduct(product, stampedAdditions);
  return {
    researchSources: nextSources,
    researchNote: `已补入基础规则来源：${stampedAdditions.map((source) => source.label).join("、") || "无新增来源"}`
  };
}

function candidateValueFromRow(row = {}, keys = []) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function inferCandidateCategory(text = "") {
  if (/除湿|防潮|防霉|衣柜|干燥/.test(text)) return "雨季防潮";
  if (/风扇|冰袖|防晒|清凉|散热|降温|高温/.test(text)) return "夏季清凉";
  if (/玩水|防水|旅行|分装|漂流|海边|行李/.test(text)) return "旅行出行";
  if (/宠物|猫|狗|粘毛|猫抓|冻干|猫条/.test(text)) return "宠物家清";
  if (/香囊|香氛|端午|国风|父亲节|礼物|礼赠/.test(text)) return "节点礼赠";
  if (/收纳|宿舍|桌面|开学|毕业|租房/.test(text)) return "收纳整理";
  if (/观赛|世界杯|看球|夜宵/.test(text)) return "观赛场景";
  return "待分类";
}

function inferCandidateNode(text = "") {
  if (/梅雨|雨季|防潮|除湿/.test(text)) return "梅雨季 6-7 月";
  if (/暑期|夏季|高温|防晒|清凉|风扇|冰袖/.test(text)) return "暑期高温 6-8 月";
  if (/端午|香囊|艾草/.test(text)) return "端午节点";
  if (/父亲节/.test(text)) return "父亲节节点";
  if (/毕业|宿舍|开学|租房/.test(text)) return "毕业/开学季";
  if (/世界杯|观赛|看球/.test(text)) return "世界杯观赛节点";
  if (/旅行|玩水|漂流|海边/.test(text)) return "暑期出行";
  return "常规测试";
}

function inferCandidatePriceBand(text = "") {
  const priceMatch = String(text).match(/(?:¥|￥|价格|售价|到手价|客单|price)?\s*(\d{1,4})(?:\s*[-~—至]\s*(\d{1,4}))?\s*(?:元|块|rmb)?/i);
  if (!priceMatch) return "";
  const start = Number(priceMatch[1]);
  const end = Number(priceMatch[2] || priceMatch[1]);
  if (!Number.isFinite(start) || start <= 0) return "";
  return start === end ? `${start}` : `${Math.min(start, end)}-${Math.max(start, end)}`;
}

function inferCandidateCommission(text = "") {
  const rate = String(text).match(/(?:佣金|利润|毛利|返佣|commission)\D{0,4}(\d{1,2})(?:\.\d+)?\s*%/i);
  if (rate) return `${rate[1]}%`;
  if (/高佣|高利润|利润高/.test(text)) return "高";
  if (/低佣|低利润|薄利/.test(text)) return "低";
  return "中";
}

function candidateSkuFromText(text = "") {
  const cleaned = String(text || "")
    .replace(/^\s*(?:\d+|#\d+|[一二三四五六七八九十]+)[\.、\)\s-]*/, "")
    .replace(/(?:价格|售价|到手价|客单|佣金|利润|类目|节点|理由|卖点)[:：].*$/i, "")
    .trim();
  const separators = cleaned.split(/[，,|｜\t；;]/).map((item) => item.trim()).filter(Boolean);
  const first = separators[0] || cleaned;
  return first.slice(0, 36);
}

function candidateDraftFromText(text = "", index = 0) {
  const source = String(text || "").trim();
  const sku = candidateSkuFromText(source) || `候选 SKU ${index + 1}`;
  return {
    sku,
    category: inferCandidateCategory(source),
    node: inferCandidateNode(source),
    priceBand: inferCandidatePriceBand(source),
    commission: inferCandidateCommission(source),
    coreReason: source.length > 18 ? source.slice(0, 140) : `${sku} 可作为候选品，先补价格、商品卡和真实素材后进入评分。`,
    videoAngles: inferCandidateAngles(source).join("、"),
    notes: source
  };
}

function candidateDraftFromRow(row = {}, index = 0) {
  const sku = candidateValueFromRow(row, ["SKU", "sku", "商品", "商品名称", "商品名", "品名", "product", "product_name", "名称"]);
  const rowText = Object.values(row).join(" ");
  return {
    sku: sku || candidateSkuFromText(rowText) || `候选 SKU ${index + 1}`,
    category: candidateValueFromRow(row, ["类目", "分类", "category"]) || inferCandidateCategory(rowText),
    node: candidateValueFromRow(row, ["节点", "趋势", "窗口", "node", "season"]) || inferCandidateNode(rowText),
    priceBand: candidateValueFromRow(row, ["价格", "价格带", "到手价", "售价", "客单", "price"]) || inferCandidatePriceBand(rowText),
    commission: candidateValueFromRow(row, ["佣金", "利润", "毛利", "commission"]) || inferCandidateCommission(rowText),
    coreReason: candidateValueFromRow(row, ["理由", "推荐理由", "卖点", "需求", "reason", "note", "备注"]) || rowText.slice(0, 140),
    videoAngles: candidateValueFromRow(row, ["视频角度", "角度", "结构", "脚本", "angles"]) || inferCandidateAngles(rowText).join("、"),
    notes: rowText
  };
}

function parseCandidateImportRows(text = "") {
  const source = String(text || "").trim();
  if (!source) return [];
  const parsed = parseReviewImportRows(source);
  const firstParsed = parsed[0] || {};
  const hasStructuredHeader = parsed.length && Object.keys(firstParsed).some((key) =>
    /sku|商品|品名|类目|分类|价格|佣金|利润|节点|理由|卖点|备注|category|price|commission/i.test(key)
  );
  const drafts = hasStructuredHeader
    ? parsed.map(candidateDraftFromRow)
    : source.split(/\r?\n/).map((line, index) => candidateDraftFromText(line, index));
  const seen = new Set();
  return drafts
    .map((draft) => ({
      ...emptyCandidateDraft(),
      ...draft,
      sku: String(draft.sku || "").trim()
    }))
    .filter((draft) => draft.sku && draft.sku.length >= 2)
    .filter((draft) => {
      const key = normalizeSkuText(draft.sku);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
}

function createCandidateProductPayload(draft, existingProducts = []) {
  const text = [draft.sku, draft.category, draft.node, draft.coreReason, draft.notes].join(" ");
  const videoAngles = splitCandidateList(draft.videoAngles);
  const base = {
    rank: Math.max(0, ...existingProducts.map((product) => Number(product.rank || 0))) + 1,
    sku: String(draft.sku || "").trim(),
    category: String(draft.category || "待分类").trim(),
    node: String(draft.node || "常规测试").trim(),
    lifecycle: "待补资产",
    assetStatus: "自动初评：待补素材",
    assetPercent: 0,
    priceBand: String(draft.priceBand || "待补").trim(),
    commission: String(draft.commission || "中").trim(),
    coreReason: String(draft.coreReason || "新入库候选 SKU，先补商品事实、真实素材和商品卡截图后再测。").trim(),
    videoAngles: videoAngles.length ? videoAngles : inferCandidateAngles(text),
    primaryTemplate: inferCandidateTemplate(text),
    riskLevel: "中",
    riskTags: splitCandidateList(draft.notes).slice(0, 4),
    vetoFlags: [],
    assetGaps: inferCandidateAssetGaps(text),
    whiteList: splitCandidateList(draft.coreReason).length ? splitCandidateList(draft.coreReason) : inferCandidateAngles(text),
    bannedWords: inferCandidateBannedWords(text),
    cardCheck: {
      title: "待补核心词",
      image: "主图待补",
      detail: "规格待补",
      price: draft.priceBand ? "待核对到手价" : "价格待补",
      reviews: "差评关键词待看",
      fulfillment: "发货时效待看"
    },
    researchSources: extractResearchSources(text, draft.sourceType || "候选品导入"),
    researchNote: String(draft.notes || draft.coreReason || "").trim().slice(0, 300),
    source: "manual-intake"
  };
  const hardRuleCount = matchedHardRulesForProduct(base).length;
  const scores = estimateCandidateScores(base);
  const totalScore = productSelectionScore({ scores });
  const riskLevel = hardRuleCount >= 3 || scores.compliance <= 5 ? "高" : hardRuleCount >= 1 || scores.compliance <= 7 ? "中" : "低";
  const assetChecklist = materialSlotTemplates.map((slot) => ({
    ...slot,
    status: slot.id === "compliance-proof" && riskLevel !== "高" && !/资质|授权|品牌|食品|电器|儿童|IP|非遗|老字号/.test(productIntelligenceText({ ...base, riskLevel }))
      ? "不适用"
      : "待补",
    note: ""
  }));
  return {
    ...base,
    scores,
    totalScore,
    riskLevel,
    assetChecklist
  };
}

function batchPreviewForProducts(products = [], accounts = accountAssetSeeds) {
  const rows = products.map((product) => {
    const gate = selectionBatchGateForProduct(product);
    const precheck = gate.precheck;
    const cardPrecheck = gate.cardPrecheck;
    const compliance = gate.compliance;
    const accountFit = accountFitSummaryForProduct(product, accounts);
    const assetVerification = assetVerificationGateForProduct(product, accountFit);
    const attachments = materialAttachmentsForBatch(product);
    const accountBlocked = gate.baseCanCreate && accountFit.status === "blocked";
    const accountWarn = gate.baseCanCreate && gate.canQueue && accountFit.status === "warn";
    const verificationBlocked = gate.baseCanCreate && assetVerification.computedStatus === "blocked";
    const verificationWarn = gate.baseCanCreate && !verificationBlocked && assetVerification.status === "warn";
    const canQueue = gate.canQueue && !accountBlocked && !verificationBlocked;
    let issue = gate.issue;
    let action = gate.action;
    let tone = gate.tone;
    if (accountBlocked && gate.canQueue) {
      issue = accountFit.primary;
      action = accountFit.action;
      tone = "bad";
    } else if (verificationBlocked && gate.canQueue) {
      issue = assetVerification.label;
      action = assetVerification.primaryAction;
      tone = "bad";
    } else if (accountWarn && gate.tone === "good") {
      issue = accountFit.primary;
      action = accountFit.action;
      tone = "warn";
    } else if (verificationWarn && gate.tone === "good") {
      issue = assetVerification.label;
      action = assetVerification.primaryAction;
      tone = "warn";
    }
    return {
      product,
      precheck,
      cardPrecheck,
      compliance,
      accountFit,
      assetVerification,
      gate,
      attachments,
      imageCount: attachments.length,
      canQueue,
      issue,
      action,
      tone
    };
  });
  return {
    rows,
    queueCount: rows.filter((row) => row.canQueue).length,
    blockedCount: rows.filter((row) => row.gate.baseCanCreate && (row.gate.materialBlocked || row.gate.cardBlocked || row.gate.complianceBlocked || row.gate.researchBlocked || row.accountFit.status === "blocked")).length,
    materialBlockedCount: rows.filter((row) => row.gate.baseCanCreate && row.gate.materialBlocked).length,
    cardBlockedCount: rows.filter((row) => row.gate.baseCanCreate && row.gate.cardBlocked).length,
    complianceBlockedCount: rows.filter((row) => row.gate.baseCanCreate && row.gate.complianceBlocked).length,
    sourceBlockedCount: rows.filter((row) => row.gate.baseCanCreate && row.gate.researchBlocked).length,
    accountBlockedCount: rows.filter((row) => row.gate.baseCanCreate && row.accountFit.status === "blocked").length,
    verificationBlockedCount: rows.filter((row) => row.gate.baseCanCreate && row.assetVerification.computedStatus === "blocked").length,
    cardWarnCount: rows.filter((row) => row.canQueue && row.gate.cardWarn).length,
    complianceWarnCount: rows.filter((row) => row.canQueue && row.gate.complianceWarn).length,
    sourceWarnCount: rows.filter((row) => row.canQueue && row.gate.researchWarn).length,
    accountWarnCount: rows.filter((row) => row.canQueue && row.accountFit.status === "warn").length,
    verificationWarnCount: rows.filter((row) => row.canQueue && row.assetVerification.status === "warn").length,
    verificationStaleCount: rows.filter((row) => row.canQueue && row.assetVerification.isStale).length,
    verificationSaveCount: rows.filter((row) => row.canQueue && row.assetVerification.requiresSave).length,
    warnCount: rows.filter((row) => row.canQueue && (row.gate.materialWarn || row.gate.cardWarn || row.gate.complianceWarn || row.gate.researchWarn || row.accountFit.status === "warn" || row.assetVerification.status === "warn")).length,
    imageCount: rows.reduce((total, row) => total + row.imageCount, 0)
  };
}

function normalizeSelectionProduct(product) {
  const generationRecords = Array.isArray(product.generationRecords) ? product.generationRecords : [];
  const cardCheck = normalizeProductCardCheck(product);
  const cardPrecheck = productCardPrecheck({ ...product, cardCheck });
  const assetChecklist = normalizeMaterialChecklist({ ...product, cardCheck });
  const normalizedProduct = {
    ...product,
    cardCheck,
    cardPrecheck,
    assetChecklist
  };
  const materialSummary = summarizeMaterialChecklist(assetChecklist);
  const materialPrecheck = materialPrecheckForProduct(normalizedProduct);
  const complianceFindings = materialPrecheck.complianceFindings || complianceFindingsForProduct(normalizedProduct);
  return {
    ...normalizedProduct,
    totalScore: Number(product.totalScore ?? productSelectionScore(product)) || productSelectionScore(product),
    materialSummary,
    materialPrecheck,
    complianceFindings,
    generationRecords,
    generationSummary: product.generationSummary || {
      total: generationRecords.length,
      promptReadyCount: generationRecords.filter((record) => record.finalPromptReady || record.itemStatus === "prompt_ready").length,
      videoCount: generationRecords.filter((record) => record.videoUrl || record.itemStatus === "succeeded").length,
      failedCount: generationRecords.filter((record) => record.itemStatus === "failed" || record.errorMessage).length,
      latestStatus: generationRecords[0]?.itemStatus || "",
      latestStep: generationRecords[0]?.currentStep || "",
      latestUpdatedAt: generationRecords[0]?.updatedAt || ""
    }
  };
}

function mergeSelectionProducts(apiProducts = []) {
  if (!Array.isArray(apiProducts) || !apiProducts.length) return selectionProducts;
  const localById = new Map(selectionProducts.map((item) => [item.id, item]));
  return apiProducts.map((item) => {
    const local = localById.get(item.id) || {};
    return {
      ...local,
      ...item,
      scores: item.scores || local.scores || {},
      videoAngles: item.videoAngles || local.videoAngles || [],
      riskTags: item.riskTags || local.riskTags || [],
      vetoFlags: item.vetoFlags || local.vetoFlags || [],
      assetGaps: item.assetGaps || local.assetGaps || [],
      assetChecklist: item.assetChecklist || local.assetChecklist || [],
      whiteList: item.whiteList || local.whiteList || [],
      bannedWords: item.bannedWords || local.bannedWords || [],
      cardCheck: normalizeProductCardCheck(item.cardCheck || local.cardCheck || {})
    };
  });
}

function hasBrokenDisplayText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/^\?{2,}$/.test(text)) return true;
  if (/^[?\s，。；、:：-]{4,}$/.test(text)) return true;
  if (/�/.test(text)) return true;
  return false;
}

function repairTextFromSeed(value, fallback = "") {
  return hasBrokenDisplayText(value) && fallback ? fallback : value;
}

function mergeAccountAssets(apiAccounts = []) {
  if (!Array.isArray(apiAccounts) || !apiAccounts.length) return accountAssetSeeds;
  const localById = new Map(accountAssetSeeds.map((item) => [item.id, item]));
  return apiAccounts.map((item) => {
    const local = localById.get(item.id) || {};
    return {
      ...local,
      ...item,
      name: repairTextFromSeed(item.name, local.name),
      position: repairTextFromSeed(item.position, local.position),
      fit: item.fit || local.fit || [],
      avoid: item.avoid || local.avoid || [],
      scenes: item.scenes || local.scenes || [],
      docPacks: item.docPacks || local.docPacks || [],
      docPackVersions: item.docPackVersions || local.docPackVersions || normalizeDocPackVersions(item),
      platformBindings: item.platformBindings || local.platformBindings || normalizePlatformBindings(item),
      recommended: item.recommended || local.recommended || [],
      dataQualityWarnings: [
        ...(item.dataQualityWarnings || []),
        hasBrokenDisplayText(item.name) ? "账号名称为异常占位文本，已用示例资料显示值修复。" : "",
        hasBrokenDisplayText(item.position) ? "账号定位为异常占位文本，已用示例资料显示值修复。" : ""
      ].filter(Boolean)
    };
  });
}

function normalizeSelectionAssetResponse(data) {
  return {
    products: mergeSelectionProducts(data?.products),
    accounts: mergeAccountAssets(data?.accounts),
    source: data?.ok ? "database" : "local"
  };
}

function buildMaterialChecklistBrief(product) {
  const checklist = product.assetChecklist || normalizeMaterialChecklist(product);
  return checklist
    .map((slot) => {
      const attachmentCount = Array.isArray(slot.attachments) ? slot.attachments.length : 0;
      return `${slot.label}:${slot.status}${attachmentCount ? `(${attachmentCount} 个附件)` : slot.note ? `(${slot.note})` : ""}`;
    })
    .join("；");
}

function buildSelectionProductBrief(product) {
  const precheck = materialPrecheckForProduct(product);
  const cardCheck = normalizeProductCardCheck(product);
  const cardPrecheck = productCardPrecheck({ ...product, cardCheck });
  return [
    `商品：${product.sku}`,
    `类目：${product.category}`,
    `节点：${product.node}`,
    `价格带：${product.priceBand || "待补"}`,
    `推荐理由：${product.coreReason || "待补"}`,
    `主推视频结构：${product.primaryTemplate || "搜索答案型"}`,
    `视频角度：${(product.videoAngles || []).join(" / ") || "待补"}`,
    `卖点白名单：${(product.whiteList || []).join(" / ") || "待补"}`,
    `禁用话术：${(product.bannedWords || []).join(" / ") || "待补"}`,
    `资产缺口：${(product.assetGaps || []).join(" / ") || "暂无"}`,
    `素材清单：${buildMaterialChecklistBrief(product)}`,
    `生成预检：${materialPrecheckLabel(precheck)}；硬性问题：${precheck.hardIssues.join(" / ") || "无"}；降级提示：${precheck.warnings.join(" / ") || "无"}`,
    `风险标签：${(product.riskTags || []).join(" / ") || "低风险"}`,
    `商品卡预检：${productCardPrecheckLabel(cardPrecheck)}；问题：${productCardIssueList(cardPrecheck).join(" / ") || "无"}`,
    `商品卡承接：${productCardFields.map((field) => `${field.shortLabel}:${cardCheck[field.key] || "待补"}`).join("；")}`
  ].join("\n");
}

function accountMatchesProduct(account, product) {
  return accountMatchScore(account, product) > 0;
}

const accountMatchKeywords = [
  "雨季", "防潮", "除湿", "衣柜", "浴室", "防滑", "银发", "适老",
  "宠物", "猫", "家清", "粘毛", "猫抓", "清洁",
  "夏季", "清凉", "高温", "防晒", "冰袖", "风扇", "散热",
  "端午", "国风", "礼赠", "礼物", "父亲节", "香氛", "香囊",
  "旅行", "出行", "玩水", "毕业", "宿舍", "收纳", "分装", "行李",
  "美妆", "化妆", "桌面", "开学", "露营", "户外", "观赛"
];

function accountMatchText(account = {}) {
  return [
    account.name,
    account.position,
    account.tone,
    ...(account.fit || []),
    ...(account.scenes || []),
    ...(account.docPacks || []),
    ...(account.recommended || [])
  ].join(" ");
}

function productMatchText(product = {}) {
  return [
    product.sku,
    product.category,
    product.node,
    product.primaryTemplate,
    product.coreReason,
    ...(product.videoAngles || []),
    ...(product.whiteList || [])
  ].join(" ");
}

function accountMatchScore(account, product) {
  if (!account || !product) return 0;
  const sku = String(product.sku || "");
  const category = String(product.category || "");
  const productText = productMatchText(product);
  const accountText = accountMatchText(account);
  let score = 0;
  if ((account.recommended || []).includes(sku)) score += 8;
  for (const item of account.fit || []) {
    const fit = String(item || "");
    if (!fit || !category) continue;
    if (fit === category) score += 5;
    else if (fit.includes(category) || category.includes(fit)) score += 2;
  }
  for (const scene of account.scenes || []) {
    if (scene && productText.includes(scene)) score += 1;
  }
  for (const keyword of accountMatchKeywords) {
    if (productText.includes(keyword) && accountText.includes(keyword)) score += 2;
  }
  if (/清单|搜索答案|低价实用/.test(accountText) && /低价|清单|宿舍|通勤|常青|收纳/.test(productText)) score += 1;
  return score;
}

function rankedAccountsForProduct(product, accounts = accountAssetSeeds) {
  return (accounts || [])
    .map((account, index) => ({ account, score: accountMatchScore(account, product), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
}

function selectAccountForProduct(product, accounts = accountAssetSeeds) {
  const ranked = rankedAccountsForProduct(product, accounts).filter((item) => item.score > 0);
  return ranked[0]?.account || accounts?.[0] || accountAssetSeeds[0];
}

function accountFitSummaryForProduct(product = {}, accounts = accountAssetSeeds) {
  const accountList = Array.isArray(accounts)
    ? accounts
    : accounts?.id
      ? [accounts]
      : accountAssetSeeds;
  const ranked = rankedAccountsForProduct(product, accountList);
  const best = ranked[0] || {};
  const score = Number(best.score || 0);
  const account = score > 0 ? best.account : null;
  const docPacks = account ? normalizeDocPackVersions(account) : [];
  const platforms = account ? normalizePlatformBindings(account) : [];
  const docPack = account ? selectDocPackForProduct(account, product) : null;
  const platform = account ? selectPlatformBindingForAccount(account) : null;
  const issues = [];
  const warnings = [];

  if (!account) {
    issues.push("没有账号覆盖该 SKU 的类目、场景或推荐 SKU。");
  } else {
    if (!docPacks.length) issues.push("账号缺少可复用 DOC 包。");
    if (score < 5) warnings.push("账号只弱匹配，脚本需要收窄到商品事实和通用场景。");
    if (!account.position) warnings.push("账号定位待补。");
    if (!(account.fit || []).length) warnings.push("适合类目待补。");
    if (!(account.scenes || []).length) warnings.push("常用场景待补。");
    if (!(account.avoid || []).length) warnings.push("账号禁做边界待补。");
    if (!platforms.length || (!account.platform && !Array.isArray(account.platformBindings))) warnings.push("平台绑定未显式配置，先按默认平台规则保守处理。");
    if (!platform?.aigcLabel || !platform?.commerceRule) warnings.push("平台 AIGC 标识或带货承接规则待补。");
  }

  const status = issues.length ? "blocked" : warnings.length ? "warn" : "pass";
  const strength = score >= 8 ? "推荐绑定" : score >= 5 ? "强匹配" : score > 0 ? "弱匹配" : "未匹配";
  const label = status === "blocked" ? "账号适配拦截" : status === "warn" ? "账号适配待核" : "账号适配可用";
  const action = issues[0]
    || warnings[0]
    || `${account?.name || "账号资产"} 可承接，按 ${docPack ? `${docPack.name} ${docPack.version}` : "主用 DOC"} 和 ${platform?.platform || "目标平台"} 规则生成。`;

  return {
    product,
    account,
    ranked,
    score,
    strength,
    status,
    label,
    tone: status === "blocked" ? "bad" : status === "warn" ? "warn" : "good",
    docPack,
    platform,
    issues,
    warnings,
    primary: issues[0] || warnings[0] || `${account?.name || "账号资产"} · ${strength}`,
    action
  };
}

function accountCoverageTone(strength) {
  if (strength === "强匹配" || strength === "推荐绑定") return "good";
  if (strength === "弱匹配") return "warn";
  return "bad";
}

function buildAccountCoverageAudit(products = [], accounts = []) {
  const activeProducts = (products || []).filter((product) => product.lifecycle !== "淘汰");
  const rows = activeProducts.map((product) => {
    const fit = accountFitSummaryForProduct(product, accounts);
    const reason = fit.status === "pass"
      ? fit.action
      : fit.action || fit.primary;
    return {
      product,
      account: fit.account,
      score: fit.score,
      strength: fit.strength,
      reason,
      fit,
      tone: fit.tone || accountCoverageTone(fit.strength)
    };
  });
  const accountRows = (accounts || []).map((account) => {
    const matched = rows.filter((row) => row.account?.id === account.id);
    const docPacks = normalizeDocPackVersions(account);
    const platforms = normalizePlatformBindings(account);
    const issues = [];
    if ((account.dataQualityWarnings || []).length) issues.push("资料已自动修复，建议保存回库");
    if (!account.name || hasBrokenDisplayText(account.name)) issues.push("账号名称异常");
    if (!account.position || hasBrokenDisplayText(account.position)) issues.push("定位待补");
    if (!(account.fit || []).length) issues.push("适合类目待补");
    if (!docPacks.length) issues.push("DOC 包待补");
    if (!platforms.length) issues.push("平台绑定待补");
    if (!(account.avoid || []).length) issues.push("禁做边界待补");
    if (matched.length >= 8) issues.push("承接 SKU 偏多，注意人设稀释");
    return {
      account,
      matched,
      docPacks,
      platforms,
      issues,
      tone: issues.length ? "warn" : "good"
    };
  });
  return {
    rows,
    strongRows: rows.filter((row) => row.score >= 5),
    weakRows: rows.filter((row) => row.score > 0 && row.score < 5),
    noMatchRows: rows.filter((row) => row.score <= 0),
    accountRows,
    issueAccounts: accountRows.filter((row) => row.issues.length)
  };
}

function accountReadinessStatusText(status) {
  if (status === "blocked") return "阻断";
  if (status === "warn") return "待核";
  return "通过";
}

function accountReadinessTask({ id, label, status, detail, action, owner, weight = 0 }) {
  return {
    id,
    label,
    status,
    detail,
    action,
    owner,
    weight,
    tone: status === "blocked" ? "bad" : status === "warn" ? "warn" : "good",
    statusLabel: accountReadinessStatusText(status)
  };
}

function buildAccountReadinessRows(accounts = [], products = [], audit = buildAccountCoverageAudit(products, accounts)) {
  const accountAuditById = new Map((audit.accountRows || []).map((row) => [row.account.id, row]));
  return (accounts || []).map((account) => {
    const auditRow = accountAuditById.get(account.id) || { matched: [], issues: [], docPacks: [], platforms: [] };
    const matched = auditRow.matched || [];
    const docPacks = auditRow.docPacks || normalizeDocPackVersions(account);
    const platforms = auditRow.platforms || normalizePlatformBindings(account);
    const mainDoc = docPacks.find((item) => item.status === "主用") || docPacks[0];
    const mainPlatform = platforms.find((item) => item.status === "主平台") || platforms[0];
    const nameBroken = !account.name || hasBrokenDisplayText(account.name);
    const positionBroken = !account.position || hasBrokenDisplayText(account.position);
    const qualityWarnings = account.dataQualityWarnings || [];
    const fit = account.fit || [];
    const scenes = account.scenes || [];
    const avoid = account.avoid || [];
    const recommended = account.recommended || [];
    const tasks = [
      accountReadinessTask({
        id: "position",
        label: "账号定位",
        status: positionBroken || nameBroken ? "blocked" : "pass",
        detail: [
          nameBroken ? `名称异常：${account.name || "未填写"}` : `名称：${account.name}`,
          positionBroken ? `定位异常：${account.position || "未填写"}` : `定位：${account.position}`
        ].join("；"),
        action: positionBroken || nameBroken ? "修复账号名称、定位、人群和内容边界，否则不能稳定承接 SKU。" : "定位可用于脚本人设约束。",
        owner: "账号运营",
        weight: 34
      }),
      accountReadinessTask({
        id: "data-quality",
        label: "资料质量",
        status: qualityWarnings.length ? "warn" : "pass",
        detail: qualityWarnings.length ? qualityWarnings.join("；") : "账号资料未发现异常占位文本",
        action: qualityWarnings.length ? "打开账号资产库保存一次，把自动修复后的名称和定位同步到账号资料。" : "资料质量可用。",
        owner: "账号运营",
        weight: qualityWarnings.length ? 33 : 8
      }),
      accountReadinessTask({
        id: "fit",
        label: "适合类目",
        status: fit.length ? "pass" : "blocked",
        detail: fit.length ? fit.slice(0, 4).join(" / ") : "适合类目待补",
        action: fit.length ? "类目可用于自动匹配。" : "补 3-5 个可承接类目或场景词。",
        owner: "选品负责人",
        weight: 32
      }),
      accountReadinessTask({
        id: "doc",
        label: "DOC 包",
        status: docPacks.length ? (mainDoc?.structure ? "pass" : "warn") : "blocked",
        detail: mainDoc ? `${mainDoc.name} ${mainDoc.version} · ${mainDoc.structure || "结构待补"}` : "DOC 包待补",
        action: docPacks.length ? "复核 DOC 结构是否覆盖主推脚本类型。" : "补主用 DOC 包名称、版本和脚本结构。",
        owner: "编导",
        weight: 30
      }),
      accountReadinessTask({
        id: "platform",
        label: "平台规则",
        status: mainPlatform?.aigcLabel && mainPlatform?.commerceRule ? "pass" : "blocked",
        detail: mainPlatform ? `${mainPlatform.platform} · ${mainPlatform.publishTarget || "发布目标待补"}` : "平台绑定待补",
        action: mainPlatform?.aigcLabel && mainPlatform?.commerceRule
          ? "平台 AIGC 标识和带货承接口径可用。"
          : "补平台绑定、AIGC 标识和商品卡/橱窗承接规则。",
        owner: "合规复核",
        weight: 30
      }),
      accountReadinessTask({
        id: "avoid",
        label: "禁做边界",
        status: avoid.length ? "pass" : "blocked",
        detail: avoid.length ? avoid.slice(0, 4).join(" / ") : "禁做边界待补",
        action: avoid.length ? "禁做边界可写入提示词约束。" : "补无授权、伪造体验、功效承诺、价格不一致等禁区。",
        owner: "合规复核",
        weight: 28
      }),
      accountReadinessTask({
        id: "scene",
        label: "场景与语气",
        status: scenes.length && account.tone ? "pass" : "warn",
        detail: `${account.tone || "语气待补"} · ${scenes.slice(0, 3).join(" / ") || "场景待补"}`,
        action: scenes.length && account.tone ? "场景和语气可用于生成差异化脚本。" : "补账号常用场景和语气，避免不同 SKU 生成同质化。",
        owner: "账号运营",
        weight: 18
      }),
      accountReadinessTask({
        id: "coverage",
        label: "SKU 覆盖",
        status: matched.length ? (matched.length >= 8 ? "warn" : "pass") : "warn",
        detail: `${matched.length} 个 SKU · 推荐 ${recommended.length} 个`,
        action: matched.length
          ? matched.length >= 8
            ? "承接 SKU 偏多，优先拆分人设或收窄推荐 SKU。"
            : "覆盖数量可控，继续按强匹配 SKU 使用。"
          : "暂无 SKU 稳定匹配，补推荐 SKU 或类目关键词。",
        owner: "选品负责人",
        weight: matched.length ? 14 : 22
      })
    ];
    const blockerTasks = tasks.filter((task) => task.status === "blocked");
    const warnTasks = tasks.filter((task) => task.status === "warn");
    const status = blockerTasks.length ? "blocked" : warnTasks.length ? "warn" : "pass";
    const primaryTask = blockerTasks[0] || warnTasks[0] || tasks[tasks.length - 1];
    return {
      account,
      matched,
      docPacks,
      platforms,
      mainDoc,
      mainPlatform,
      tasks,
      blockerTasks,
      warnTasks,
      status,
      tone: status === "blocked" ? "bad" : status === "warn" ? "warn" : "good",
      statusLabel: status === "blocked" ? "账号阻断" : status === "warn" ? "账号待核" : "账号可用",
      primaryTask,
      score: Math.max(0, 100 - blockerTasks.length * 18 - warnTasks.length * 8)
    };
  }).sort((a, b) =>
    a.score - b.score
    || b.matched.length - a.matched.length
    || a.account.name.localeCompare(b.account.name, "zh-CN")
  );
}

function buildAccountReadinessHandoffGroups(rows = []) {
  const groups = new Map();
  for (const row of rows || []) {
    for (const task of row.tasks || []) {
      if (task.status === "pass") continue;
      if (!groups.has(task.owner)) {
        groups.set(task.owner, { owner: task.owner, items: [], blocked: 0, warn: 0 });
      }
      const group = groups.get(task.owner);
      group.items.push({
        id: `${row.account.id}-${task.id}`,
        row,
        account: row.account,
        task,
        priority: task.weight + (task.status === "blocked" ? 40 : 10) + row.matched.length
      });
      if (task.status === "blocked") group.blocked += 1;
      else group.warn += 1;
    }
  }
  return [...groups.values()]
    .map((group) => ({ ...group, items: group.items.sort((a, b) => b.priority - a.priority) }))
    .sort((a, b) => b.blocked - a.blocked || b.items.length - a.items.length || a.owner.localeCompare(b.owner, "zh-CN"));
}

function accountReadinessText(row = {}) {
  const account = row.account || {};
  return [
    `账号资产验收：${account.name || account.id || "未命名账号"}`,
    `结论：${row.statusLabel || "待核"} / ${row.score || 0} 分`,
    `主阻断：${row.primaryTask?.label || "无"} - ${row.primaryTask?.action || "按当前账号资产承接"}`,
    `覆盖 SKU：${(row.matched || []).map((item) => item.product?.sku).filter(Boolean).join("、") || "暂无"}`,
    "",
    ...(row.tasks || []).map((task) => `- [${task.statusLabel}] ${task.label}：${task.detail}；动作：${task.action}；负责人：${task.owner}`)
  ].join("\n");
}

function accountReadinessHandoffText(groups = []) {
  if (!groups.length) return "账号资产补齐分派：暂无待处理项。";
  return [
    "账号资产补齐分派",
    ...groups.flatMap((group) => [
      "",
      `${group.owner}：${group.blocked} 阻断 / ${group.warn} 待核`,
      ...group.items.map((item) => `- ${item.account.name} / ${item.task.label}：${item.task.action}`)
    ])
  ].join("\n");
}

function buildAccountAssetBrief(account) {
  if (!account) return "暂未匹配账号资产。";
  const docPack = selectDocPackForProduct(account);
  const platform = selectPlatformBindingForAccount(account);
  return [
    `账号：${account.name}`,
    `定位：${account.position}`,
    `语气：${account.tone || "克制、真实、低决策"}`,
    `常用场景：${(account.scenes || []).join(" / ") || "待补"}`,
    `当前 DOC 包：${docPack ? `${docPack.name} ${docPack.version} / ${docPack.structure}` : (account.docPacks || []).join(" / ") || "待补"}`,
    `发布平台：${platform.platform}；${platform.publishTarget}`,
    `平台规则：${platform.commerceRule}`,
    `AI 标识：${platform.aigcLabel}`,
    `账号禁区：${(account.avoid || []).join(" / ") || "强功效、无授权、伪造体验"}`
  ].join("\n");
}

function materialEvidencePolicy(slot = {}) {
  if (slot.status === "禁用") return "不得引用该证据槽，脚本和发布素材都要避开。";
  if (slot.status === "待补") {
    if (slot.id === "compliance-proof") return "不得写品牌授权、官方同款、认证、检测通过等结论。";
    if (slot.id === "real-test") return "不得写实测、亲测、效果前后对比或强功效承诺。";
    if (slot.id === "product-card") return "结尾只做保守引导，不承诺价格、规格、履约和评价。";
    if (slot.id === "spec-params") return "不得写具体尺寸、容量、功率、续航、适配型号等参数。";
    if (slot.id === "scene-material") return "只写通用使用场景，不伪装真实使用记录。";
    return "只允许写商品事实，不允许把缺失素材补成 AI 画面。";
  }
  if (slot.status === "不适用") return "该 SKU 暂不需要此类证据。";
  if (slot.id === "compliance-proof") return "可引用已绑定资质/授权/检测事实，但仍避免扩大解释。";
  if (slot.id === "real-test") return "可写真实测试观察结果，不扩大为普遍功效。";
  if (slot.id === "product-card") return "可正常做商品卡承接，引导查看规格、价格和评价。";
  if (slot.id === "spec-params") return "可引用参数，但必须与商品卡/详情页一致。";
  if (slot.id === "scene-material") return "可写真实使用场景，不伪装真人测评。";
  return "可作为脚本和画面参考。";
}

function materialEvidenceAction(slot = {}) {
  if (slot.status === "禁用") return `移除或替换：${slot.note || slot.requirement || slot.label}`;
  if (slot.status === "待补") return slot.note || slot.requirement || `补齐${slot.label}`;
  if (slot.status === "已就绪" && !(slot.attachments || []).length) return "建议绑定截图/实拍文件，方便发布前复核。";
  return "可用于脚本和发布前复核。";
}

function buildProductEvidencePack(product = {}, account = {}) {
  const checklist = normalizeMaterialChecklist(product);
  const materialSummary = summarizeMaterialChecklist(checklist);
  const materialPrecheck = materialPrecheckForProduct({ ...product, assetChecklist: checklist });
  const cardCheck = normalizeProductCardCheck(product);
  const cardPrecheck = productCardPrecheck({ ...product, cardCheck });
  const compliance = complianceSummaryForProduct({ ...product, assetChecklist: checklist, cardCheck });
  const accountFit = account?.id ? accountFitSummaryForProduct(product, [account]) : accountFitSummaryForProduct(product, []);
  const docPack = accountFit.docPack;
  const platform = accountFit.platform || accountPlatformRulePresets.抖音;
  const research = researchSummaryForProduct(product);
  const researchTask = researchTaskSummaryForProduct(product);
  const assetPlan = buildAssetCompletionPlan(product);
  const attachmentRows = materialAttachmentsForBatch({ ...product, assetChecklist: checklist });
  const rows = checklist.map((slot) => {
    const attachments = (slot.attachments || []).filter((attachment) => attachment.url);
    return {
      id: slot.id,
      label: slot.label,
      status: slot.status,
      tone: materialStatusTone(slot.status),
      requirement: slot.requirement,
      note: slot.note || "",
      attachmentCount: attachments.length,
      attachmentNames: attachments.map((attachment) => attachment.name || attachment.fileName || slot.label).join("、"),
      source: attachments.length ? "已绑定文件" : slot.status === "已就绪" ? "人工确认" : "待补证据",
      policy: materialEvidencePolicy(slot),
      action: materialEvidenceAction(slot)
    };
  });
  const missingRows = rows.filter((row) => row.status === "待补" || row.status === "禁用");
  const unfiledReadyRows = rows.filter((row) => row.status === "已就绪" && !row.attachmentCount);
  const blockers = [
    ...(materialPrecheck.hardIssues || []),
    ...(cardPrecheck.status === "blocked" ? productCardIssueList(cardPrecheck) : []),
    ...(compliance.status === "blocked" ? compliance.findings.map((finding) => finding.action || finding.issue) : []),
    ...(accountFit.status === "blocked" ? accountFit.issues : []),
    ...(researchTask.status === "blocked" ? [researchTask.action] : [])
  ];
  const warnings = [
    ...(materialPrecheck.warnings || []),
    ...(cardPrecheck.status === "warn" ? productCardIssueList(cardPrecheck) : []),
    ...(compliance.status === "warn" ? compliance.findings.map((finding) => finding.action || finding.issue) : []),
    ...(accountFit.status === "warn" ? accountFit.warnings : []),
    ...(researchTask.status === "warn" ? [researchTask.action] : []),
    ...unfiledReadyRows.slice(0, 3).map((row) => `${row.label}已确认但未绑定文件`)
  ];
  const status = blockers.length || missingRows.some((row) => row.status === "禁用")
    ? "blocked"
    : warnings.length || missingRows.length
      ? "warn"
      : "pass";
  return {
    product,
    account: accountFit.account,
    accountFit,
    rows,
    attachmentRows,
    materialSummary,
    materialPrecheck,
    cardCheck,
    cardPrecheck,
    compliance,
    research,
    researchTask,
    assetPlan,
    docPack,
    platform,
    blockers: [...new Set(blockers)].slice(0, 8),
    warnings: [...new Set(warnings)].slice(0, 8),
    missingRows,
    unfiledReadyRows,
    status,
    label: status === "blocked" ? "证据包拦截" : status === "warn" ? "证据包待补" : "证据包可用",
    tone: status === "blocked" ? "bad" : status === "warn" ? "warn" : "good",
    primaryAction: blockers[0] || warnings[0] || "证据包可进入脚本和发布前复核。"
  };
}

function productEvidencePackText(pack = {}) {
  const product = pack.product || {};
  const cardCheck = pack.cardCheck || normalizeProductCardCheck(product);
  const rows = pack.rows || [];
  return [
    `SKU 证据包：${product.sku || "-"}`,
    `结论：${pack.label || "证据包待核"}；动作：${pack.primaryAction || "保持商品事实表达"}`,
    `商品事实：类目 ${product.category || "-"}；价格带 ${product.priceBand || "-"}；节点 ${product.node || "-"}；主推结构 ${product.primaryTemplate || "-"}`,
    `账号资产：${pack.account?.name || "未匹配账号"}；${pack.accountFit?.label || "账号适配待核"}；${pack.accountFit?.action || "先确认账号定位、DOC 包和平台规则"}；DOC ${pack.docPack ? `${pack.docPack.name} ${pack.docPack.version}` : "待补 DOC"}；平台 ${pack.platform?.platform || product.platform || "抖音"}`,
    `调研来源：${pack.researchTask?.label || pack.research?.label || "来源待补"}；${pack.research?.types?.join("、") || pack.research?.primary || "补罗盘、联盟、热搜或规则链接/截图"}；${pack.researchTask?.status === "pass" ? "来源可用于复核" : pack.researchTask?.action || "补来源证据"}`,
    `补齐计划：${pack.assetPlan?.label || "补齐计划待生成"}；${pack.assetPlan?.summary || "先生成补齐计划，再按优先级补素材、商品卡和来源。"}`,
    `商品卡：${productCardPrecheckLabel(pack.cardPrecheck || {})}；${productCardFields.map((field) => `${field.shortLabel}:${cardCheck[field.key] || "待补"}`).join("；")}`,
    `合规：${pack.compliance?.label || "合规待核"}；${pack.compliance?.action || "保持商品事实表达和平台 AI 标识"}`,
    "",
    "证据槽：",
    ...rows.map((row) => `- ${row.label}｜${row.status}｜${row.source}｜${row.policy}${row.attachmentNames ? `｜文件：${row.attachmentNames}` : ""}`),
    "",
    `可写卖点：${(product.whiteList || []).join("、") || "只写商品事实、适用场景和商品卡可验证信息"}`,
    `禁用话术：${(product.bannedWords || []).join("、") || "医疗功效、绝对化承诺、无授权 IP、AI 伪造试用"}`,
    "生成约束：素材不足时明确写需要补真实素材；AI 画面只能做非关键转场，不替代商品事实、资质、实测或商品卡证据。"
  ].join("\n");
}

function downloadProductEvidencePack(pack = {}) {
  const product = pack.product || {};
  const headers = ["SKU", "证据槽", "状态", "来源", "文件数", "文件名", "脚本可用性", "处理动作", "要求", "补齐计划", "补齐计划摘要", "调研状态", "调研动作", "调研来源", "调研类型", "账号适配", "账号动作"];
  const rows = (pack.rows || []).map((row) => [
    product.sku || "",
    row.label,
    row.status,
    row.source,
    row.attachmentCount,
    row.attachmentNames,
    row.policy,
    row.action,
    row.requirement,
    pack.assetPlan?.label || "",
    pack.assetPlan?.summary || "",
    pack.researchTask?.label || "",
    pack.researchTask?.status === "pass" ? "" : pack.researchTask?.action || "",
    pack.research?.primary || "",
    pack.research?.types?.join(" / ") || "",
    pack.accountFit?.label || "",
    pack.accountFit?.status === "pass" ? "" : pack.accountFit?.action || ""
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${product.sku || "SKU"}-证据包.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function buildSelectionPromptPack(product, account) {
  const angles = product.videoAngles || [];
  const precheck = materialPrecheckForProduct(product);
  const cardCheck = normalizeProductCardCheck(product);
  const cardPrecheck = productCardPrecheck({ ...product, cardCheck });
  const complianceFindings = complianceFindingsForProduct(product);
  const accountFit = account?.id ? accountFitSummaryForProduct(product, [account]) : accountFitSummaryForProduct(product, []);
  const docPack = accountFit.docPack;
  const platform = accountFit.platform || accountPlatformRulePresets.抖音;
  const evidencePack = buildProductEvidencePack(product, account);
  return [
    "AI短视频带货测品提示词包",
    "",
    "1. 商品事实确认",
    "只基于商品补充信息和真实素材写内容，不编造品牌、授权、检测报告、试用效果和参数。输出商品事实、适用场景、不适用边界。",
    "",
    "2. 账号资产约束",
    buildAccountAssetBrief(accountFit.account),
    `账号适配：${accountFit.label}；${accountFit.action}`,
    "脚本必须贴合该账号定位，不要突然切换成不相关人设、夸张测评口吻或虚构真人体验。",
    "",
    "3. DOC 包与平台约束",
    `使用 DOC：${docPack ? `${docPack.name} ${docPack.version}，结构 ${docPack.structure}${docPack.note ? `，备注：${docPack.note}` : ""}` : "默认搜索答案型 DOC v1"}`,
    `目标平台：${platform.platform}；发布目标：${platform.publishTarget}。`,
    `平台承接：${platform.commerceRule}。`,
    `AIGC 标识：${platform.aigcLabel}。`,
    `平台禁区：${(platform.avoid || []).join("、") || "虚假宣传、伪造体验、无授权素材"}。`,
    "",
    "4. 选题结构选择",
    `主推结构：${product.primaryTemplate || "搜索答案型"}。备选角度：${angles.join("、") || "痛点演示、场景清单、搜索答案"}。选择 1 个最适合 15 秒竖屏视频的结构。`,
    "",
    "5. 15 秒视频脚本",
    "生成无口播依赖也能成立的画面脚本，包含 0-3 秒开头、3-10 秒商品/场景、10-15 秒商品卡承接。不要使用夸大实验或无法证明的话术。",
    "",
    "6. 商品卡承接与搜索词",
    "输出标题核心词、场景词、人群词、节点词，并说明商品卡主图/规格/价格需要补齐的地方。",
    `当前商品卡：${productCardFields.map((field) => `${field.shortLabel}:${cardCheck[field.key] || "待补"}`).join("；")}。`,
    `商品卡预检：${productCardPrecheckLabel(cardPrecheck)}。${productCardIssueList(cardPrecheck).length ? `问题：${productCardIssueList(cardPrecheck).join("；")}。` : ""}`,
    cardPrecheck.status === "pass" ? "视频结尾可以正常承接商品卡。" : "商品卡未完全通过时，结尾只做保守引导，不承诺未补齐的规格、价格、履约和效果。",
    "",
    "7. 资产证据包",
    productEvidencePackText(evidencePack),
    "",
    "8. 合规和负面约束",
    `必须避开：${(product.bannedWords || []).join("、") || "医疗功效、绝对化承诺、无授权 IP、AI 伪造试用"}。`,
    `自动合规检查：${complianceFindings.length ? complianceFindings.map((finding) => `${finding.label}-${finding.action}`).join("；") : "无额外阻断，仍需保持商品事实表达"}。`,
    `生成预检：${materialPrecheckLabel(precheck)}；商品卡：${productCardPrecheckLabel(cardPrecheck)}。${precheck.hardIssues.length ? `阻断项：${precheck.hardIssues.join("；")}。` : ""}${precheck.warnings.length ? `素材待补项：${precheck.warnings.join("；")}。脚本必须降级为保守表达，不展示未证实效果。` : ""}`,
    "如素材不足，明确写“需要补真实素材”，不要用 AI 画面替代商品事实。",
    "",
    "商品补充信息：",
    buildSelectionProductBrief(product)
  ].join("\n");
}

function materialAttachmentsForBatch(product) {
  return (product.assetChecklist || [])
    .flatMap((slot) => (slot.attachments || []).slice(0, 1).map((attachment) => ({
      id: attachment.id,
      slotId: slot.id,
      slotLabel: slot.label,
      name: attachment.name || attachment.fileName || slot.label,
      type: attachment.type || "image/png",
      size: Number(attachment.size || 0),
      url: attachment.url,
      createdAt: attachment.createdAt || "",
      status: slot.status
    })))
    .filter((attachment) => attachment.url)
    .slice(0, 6);
}

async function buildBatchMaterialImages(product) {
  const attachments = materialAttachmentsForBatch(product);
  const images = [];
  for (const attachment of attachments) {
    const image = await readRemoteImageFile(attachment);
    images.push({
      ...image,
      name: `${attachment.slotLabel || "素材"}-${image.name}`,
      sourceAttachmentId: attachment.id,
      sourceSlotId: attachment.slotId,
      sourceSlotLabel: attachment.slotLabel,
      sourceUrl: attachment.url
    });
  }
  return { images, materialAttachments: attachments };
}

function selectionProductToBatchItem(product, index, account, materialPack = {}) {
  const precheck = materialPrecheckForProduct(product);
  const cardCheck = normalizeProductCardCheck(product);
  const cardPrecheck = productCardPrecheck({ ...product, cardCheck });
  const accountDocPack = selectDocPackForProduct(account, product);
  const platformBinding = selectPlatformBindingForAccount(account);
  const evidencePack = buildProductEvidencePack(product, account);
  return {
    taskNo: `SEL-${String(index + 1).padStart(3, "0")}`,
    selectionProductId: product.id,
    accountAssetId: account?.id || "",
    accountName: account?.name || "",
    accountPosition: account?.position || "",
    accountTone: account?.tone || "",
    accountDocPack,
    platformBinding,
    platformName: platformBinding?.platform || "",
    aigcLabel: platformBinding?.aigcLabel || "",
    materialPrecheck: precheck,
    productCardCheck: cardCheck,
    productCardPrecheck: cardPrecheck,
    materialAttachments: materialPack.materialAttachments || [],
    evidencePack,
    evidencePackText: productEvidencePackText(evidencePack),
    promptFileName: `${product.sku}-测品提示词包.txt`,
    promptPackText: buildSelectionPromptPack(product, account),
    images: materialPack.images || [],
    productName: product.sku,
    productCategory: product.category,
    productBrief: buildSelectionProductBrief(product),
    targetDuration: 15,
    aspectRatio: "9:16",
    videoMode: "dry_run",
    autoSubmit: false,
    maxRetries: 1
  };
}

function sortedSelectionProducts(products = selectionProducts) {
  return products.map(normalizeSelectionProduct).sort((a, b) => b.totalScore - a.totalScore || a.rank - b.rank);
}

function isLikelyGarbledText(value) {
  const text = String(value || "");
  if (!text) return false;
  const replacementCount = (text.match(/\uFFFD/g) || []).length;
  if (replacementCount >= 2) return true;
  return /(鐢熸垚|妗ユ帴|涓€|绂佹|鏃犵|鎴愬姛|澶辫触|鍙傝€)/.test(text);
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

function setSelectionProductFocus(productId) {
  const value = String(productId || "").trim();
  if (!value) return;
  localStorage.setItem(selectionProductFocusKey, value);
}

function readSelectionProductFocus() {
  return localStorage.getItem(selectionProductFocusKey) || "";
}

function clearSelectionProductFocus() {
  localStorage.removeItem(selectionProductFocusKey);
}

function productLibraryTarget(productId) {
  return productId ? `productLibrary:${productId}` : "productLibrary";
}

function batchTarget(batchId) {
  return batchId ? `batch:${batchId}` : "batch";
}

function setReviewImportPrefill(text) {
  const value = String(text || "").trim();
  if (!value) return;
  localStorage.setItem(reviewImportPrefillKey, value);
}

function readReviewImportPrefill() {
  return localStorage.getItem(reviewImportPrefillKey) || "";
}

function clearReviewImportPrefill() {
  localStorage.removeItem(reviewImportPrefillKey);
}

function setAccountAssetFocus(accountId) {
  const value = String(accountId || "").trim();
  if (!value) return;
  localStorage.setItem(accountAssetFocusKey, value);
}

function readAccountAssetFocus() {
  return localStorage.getItem(accountAssetFocusKey) || "";
}

function clearAccountAssetFocus() {
  localStorage.removeItem(accountAssetFocusKey);
}

function accountAssetsTarget(accountId) {
  return accountId ? `accountAssets:${accountId}` : "accountAssets";
}

function setMobileCreateIntent(intent) {
  const value = String(intent || "").trim();
  if (!["images", "prompt", "info", "output", "video"].includes(value)) return;
  localStorage.setItem(mobileCreateIntentKey, value);
}

function consumeMobileCreateIntent() {
  try {
    const value = localStorage.getItem(mobileCreateIntentKey) || "";
    localStorage.removeItem(mobileCreateIntentKey);
    return ["images", "prompt", "info", "output", "video"].includes(value) ? value : "";
  } catch {
    return "";
  }
}

function mobileCreateViewForIntent(intent) {
  if (intent === "output") return "prompt";
  if (intent === "video") return "video";
  return "input";
}

function mobileInputStepForIntent(intent) {
  return ["images", "prompt", "info"].includes(intent) ? intent : "images";
}

function readNotifications() {
  try {
    const saved = JSON.parse(localStorage.getItem(notificationStorageKey) || "[]");
    return Array.isArray(saved)
      ? saved.slice(0, 80).map((item) => ({
          ...item,
          title: cleanDisplayMessage(item.title),
          message: cleanDisplayMessage(item.message)
        }))
      : [];
  } catch {
    return [];
  }
}

function readInitialTheme() {
  try {
    if (localStorage.getItem(themeDefaultVersionKey) !== themeDarkDefaultVersion) {
      localStorage.setItem(themeDefaultVersionKey, themeDarkDefaultVersion);
      localStorage.setItem(themeStorageKey, "dark");
      return "dark";
    }
    const saved = localStorage.getItem(themeStorageKey);
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function screenshotAuthBypassEnabled() {
  try {
    const localHost = ["127.0.0.1", "localhost"].includes(location.hostname);
    return localHost && localStorage.getItem(screenshotAuthBypassKey) === "true";
  } catch {
    return false;
  }
}

function pwaInstallGuideForceEnabled() {
  try {
    const localHost = ["127.0.0.1", "localhost"].includes(location.hostname);
    return localHost && localStorage.getItem(pwaInstallGuideForceKey) === "true";
  } catch {
    return false;
  }
}

export function App() {
  const [page, setPage] = useState(() => location.hash.replace("#/", "") || "overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileCreateMenuOpen, setMobileCreateMenuOpen] = useState(false);
  const [mobileSidebarDrag, setMobileSidebarDrag] = useState({ active: false, offset: 0, progress: 0 });
  const pageRef = useRef(page);
  const mobileReturnPageRef = useRef("");
  const [mobileViewport, setMobileViewport] = useState(() => isMobileViewport());
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const current = location.hash.replace("#/", "") || "overview";
    const parentId = parentNavIdForPage(current);
    return parentId ? { [parentId]: true } : {};
  });
  const [theme, setTheme] = useState(readInitialTheme);
  const [runtime, setRuntime] = useState(null);
  const [studio, setStudio] = useState(emptyStudio);
  const [promptSteps, setPromptSteps] = useState([]);
  const [videoSteps, setVideoSteps] = useState([]);
  const [promptRunning, setPromptRunning] = useState(false);
  const [videoRunning, setVideoRunning] = useState(false);
  const videoRunningRef = useRef(false);
  const [runId, setRunId] = useState("");
  const [videoLog, setVideoLog] = useState("");
  const [tasks, setTasks] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [batchJobs, setBatchJobs] = useState([]);
  const [batchDetail, setBatchDetail] = useState(null);
  const [assets, setAssets] = useState({ rows: [], outputFiles: [], sourceLinks: [] });
  const [selectionAssets, setSelectionAssets] = useState(() => ({
    products: selectionProducts,
    accounts: accountAssetSeeds,
    source: "local"
  }));
  const [assetTaskCode, setAssetTaskCode] = useState("");
  const [batchFocusId, setBatchFocusId] = useState("");
  const [modelSettings, setModelSettings] = useState(readModelSettings);
  const [modelTrace, setModelTrace] = useState([]);
  const [notifications, setNotifications] = useState(readNotifications);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [auth, setAuth] = useState({ loading: true, user: null });
  const [loginError, setLoginError] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [guestLoginVisible, setGuestLoginVisible] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState("");
  const [pwaUpdateReady, setPwaUpdateReady] = useState(false);
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState(null);
  const [pwaInstallDismissed, setPwaInstallDismissed] = useState(() => {
    try {
      return localStorage.getItem(pwaInstallDismissedKey) === "true" || isPwaStandalone();
    } catch {
      return isPwaStandalone();
    }
  });
  const unreadCount = notifications.filter((item) => !item.read).length;
  const [iosInstallGuideVisible, setIosInstallGuideVisible] = useState(() => {
    try {
      return pwaInstallGuideForceEnabled() || (localStorage.getItem(pwaInstallDismissedKey) !== "true" && isIosInstallCandidate());
    } catch {
      return false;
    }
  });
  const pwaInstallGuideForced = pwaInstallGuideForceEnabled();
  const showNativeInstallPrompt = Boolean(pwaInstallPrompt && !pwaInstallDismissed && !pwaInstallGuideForced);
  const showIosInstallGuide = Boolean((iosInstallGuideVisible || pwaInstallGuideForced) && !showNativeInstallPrompt && (!pwaInstallDismissed || pwaInstallGuideForced));
  const isGuest = !auth.user;

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 900px)");
    if (!media) return undefined;
    const handleChange = () => setMobileViewport(media.matches);
    handleChange();
    media.addEventListener?.("change", handleChange);
    return () => media.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    pageRef.current = page;
    if (mobileRootPageIds.has(page)) {
      mobileReturnPageRef.current = "";
    }
  }, [page]);

  useEffect(() => {
    const onHash = () => {
      const nextPage = location.hash.replace("#/", "") || "overview";
      pageRef.current = nextPage;
      setPage(nextPage);
      const parentId = parentNavIdForPage(nextPage);
      if (parentId) setExpandedGroups((current) => ({ ...current, [parentId]: true }));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    checkAuthSession();
  }, []);

  useEffect(() => {
    if (auth.loading || auth.user || guestPreviewPages.has(page)) return;
    writeRouteHash("overview", { replace: true });
    pageRef.current = "overview";
    mobileReturnPageRef.current = "";
    setPage("overview");
  }, [auth.loading, auth.user, page]);

  useEffect(() => {
    if (!auth.user || !pendingTemplateId) return;
    const template = builtInPromptTemplates.find((item) => item.id === pendingTemplateId);
    setPendingTemplateId("");
    if (template) {
      window.setTimeout(() => applyBuiltInTemplate(template), 0);
    }
  }, [auth.user, pendingTemplateId]);

  useEffect(() => {
    if (!auth.user) return undefined;
    refreshRuntime();
    loadTasks();
    loadJobs();
    loadBatchJobs();
    loadAssets("");
    loadSelectionAssets();
    const runtimeTimer = window.setInterval(() => {
      refreshRuntime();
    }, 10000);
    return () => window.clearInterval(runtimeTimer);
  }, [auth.user]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(modelSettingsKey, JSON.stringify(modelSettings));
  }, [modelSettings]);

  useEffect(() => {
    localStorage.setItem(notificationStorageKey, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    if (auth.loading || !auth.user || page !== "studio") return undefined;
    let cancelled = false;
    async function appendTextImageNodeToStudio() {
      try {
        const { consumeTextImageStudioHandoff } = await import("./shared/textImageStudioHandoff.js");
        if (cancelled) return;
        const handoff = consumeTextImageStudioHandoff();
        if (!handoff) return;
        const remoteImage = await readRemoteImageFile({
          url: handoff.imageUrl,
          name: handoff.imageName,
          type: handoff.imageType,
          size: handoff.imageSize
        });
        if (cancelled) return;
        const linkedImage = {
          ...remoteImage,
          name: remoteImage.name || handoff.imageName,
          sourceType: "text-image-canvas",
          sourceUrl: handoff.imageUrl,
          textImageCanvasNodeId: handoff.nodeId,
          textImageRunId: handoff.runId,
          textImagePrompt: handoff.prompt,
          textImageNegativePrompt: handoff.negativePrompt,
          textImageModel: handoff.model,
          textImageSize: handoff.size,
          textImageCreatedAt: handoff.createdAt,
          textImageLinkedAt: handoff.linkedAt
        };
        setStudio((current) => {
          const exists = current.images.some((image) =>
            image.textImageCanvasNodeId === handoff.nodeId ||
            (handoff.imageUrl && image.sourceUrl === handoff.imageUrl)
          );
          if (exists) return current;
          return {
            ...current,
            images: [linkedImage, ...current.images].slice(0, 6)
          };
        });
        addNotification({
          level: "success",
          title: "文生图图片已加入",
          message: `${handoff.imageName} 已放入单条视频的商品图片列表。`,
          target: "studio"
        });
      } catch (error) {
        if (cancelled) return;
        addNotification({
          level: "error",
          title: "文生图图片读取失败",
          message: error.message || "请重新打开文生图节点后再送入单条视频。",
          target: "textImage"
        });
      }
    }
    appendTextImageNodeToStudio();
    return () => {
      cancelled = true;
    };
  }, [auth.loading, auth.user, page]);

  useEffect(() => {
    const handlePwaUpdate = () => setPwaUpdateReady(true);
    window.addEventListener("pwa:update-available", handlePwaUpdate);
    return () => window.removeEventListener("pwa:update-available", handlePwaUpdate);
  }, []);

  useEffect(() => {
    setMobileSidebarDrag((current) => (
      current.active || current.offset || current.progress
        ? { active: false, offset: 0, progress: 0 }
        : current
    ));
  }, [mobileSidebarOpen, page]);

  useEffect(() => {
    const locked = mobileSidebarOpen;
    document.documentElement.classList.toggle("mobile-sidebar-gesture-lock", locked);
    document.body?.classList.toggle("mobile-sidebar-gesture-lock", locked);
    return () => {
      document.documentElement.classList.remove("mobile-sidebar-gesture-lock");
      document.body?.classList.remove("mobile-sidebar-gesture-lock");
    };
  }, [mobileSidebarOpen]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      if (!pwaInstallDismissed && !isPwaStandalone()) {
        setPwaInstallPrompt(event);
        setIosInstallGuideVisible(false);
      }
    };
    const handleAppInstalled = () => {
      setPwaInstallPrompt(null);
      setIosInstallGuideVisible(false);
      setPwaInstallDismissed(true);
      localStorage.setItem(pwaInstallDismissedKey, "true");
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [pwaInstallDismissed]);

  useEffect(() => {
    if (pwaInstallDismissed || pwaInstallPrompt) {
      setIosInstallGuideVisible(false);
      return;
    }
    setIosInstallGuideVisible(pwaInstallGuideForceEnabled() || isIosInstallCandidate());
  }, [pwaInstallDismissed, pwaInstallPrompt]);

  async function checkAuthSession() {
    if (screenshotAuthBypassEnabled()) {
      setAuth({
        loading: false,
        user: {
          id: "local-preview",
          name: "local-preview",
          displayName: "本地预览"
        }
      });
      return;
    }
    try {
      const data = await requestJson("/api/auth/session");
      if (data.authenticated) {
        setAuth({ loading: false, user: data.user });
        return;
      }
      if (data.authRequired === false) {
        setAuth({
          loading: false,
          user: {
            id: "local-preview",
            name: "local-preview",
            displayName: "本地预览"
          }
        });
        return;
      }
      setAuth({ loading: false, user: null });
    } catch {
      setAuth({ loading: false, user: null });
    }
  }

  async function handleLogin(credentials) {
    setLoginSubmitting(true);
    setLoginError("");
    try {
      const data = await requestJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials)
      });
      setAuth({ loading: false, user: data.user });
      setLoginError("");
      setGuestLoginVisible(false);
    } catch (error) {
      setLoginError(error.message || "登录失败");
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleRegister(credentials) {
    setLoginSubmitting(true);
    setLoginError("");
    try {
      const data = await requestJson("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(credentials)
      });
      setAuth({ loading: false, user: data.user });
      setLoginError("");
      setGuestLoginVisible(false);
    } catch (error) {
      setLoginError(error.message || "注册失败");
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await requestJson("/api/auth/logout", { method: "POST", body: "{}" });
    } catch {
      // 本地会话清空即可。
    }
    setRuntime(null);
    setTasks([]);
    setJobs([]);
    setBatchJobs([]);
    setBatchDetail(null);
    setAssets({ rows: [], outputFiles: [], sourceLinks: [] });
    setAuth({ loading: false, user: null });
    setGuestLoginVisible(false);
    setPendingTemplateId("");
    writeRouteHash("overview", { replace: true });
    pageRef.current = "overview";
    mobileReturnPageRef.current = "";
    setPage("overview");
  }

  function toggleShellSidebar() {
    if (window.matchMedia?.("(max-width: 900px)").matches) {
      setMobileSidebarDrag({ active: false, offset: 0, progress: 0 });
      setSidebarCollapsed(false);
      setMobileSidebarOpen((current) => !current);
      return;
    }
    setSidebarCollapsed((current) => !current);
  }

  function navigate(nextPage, options = {}) {
    if (String(nextPage || "").startsWith("productLibrary:")) {
      const productId = String(nextPage).slice("productLibrary:".length);
      setSelectionProductFocus(productId);
      nextPage = "productLibrary";
    } else if (String(nextPage || "").startsWith("batch:")) {
      const batchId = String(nextPage).slice("batch:".length);
      setBatchFocusId(batchId);
      nextPage = "batch";
    } else if (String(nextPage || "").startsWith("accountAssets:")) {
      const accountId = String(nextPage).slice("accountAssets:".length);
      setAccountAssetFocus(accountId);
      nextPage = "accountAssets";
    } else if (String(nextPage || "").startsWith("studio:")) {
      const intent = String(nextPage).slice("studio:".length);
      setMobileCreateIntent(intent);
      nextPage = "studio";
    }
    if (!auth.user && !guestPreviewPages.has(nextPage)) {
      setLoginError("");
      setGuestLoginVisible(true);
      setMobileCreateMenuOpen(false);
      setMobileSidebarDrag({ active: false, offset: 0, progress: 0 });
      setMobileSidebarOpen(false);
      return;
    }
    const mobile = isMobileViewport();
    const fromPage = pageRef.current;
    if (mobile) {
      if (options.resetMobileReturn || mobileRootPageIds.has(nextPage)) {
        mobileReturnPageRef.current = "";
      } else if (fromPage !== nextPage) {
        mobileReturnPageRef.current = resolveMobileReturnTarget(fromPage, nextPage);
      }
    }
    writeRouteHash(nextPage, { replace: mobile || options.replace === true });
    pageRef.current = nextPage;
    setPage(nextPage);
    const parentId = parentNavIdForPage(nextPage);
    if (parentId) setExpandedGroups((current) => ({ ...current, [parentId]: true }));
    setMobileSidebarDrag({ active: false, offset: 0, progress: 0 });
    setMobileSidebarOpen(false);
    setMobileCreateMenuOpen(false);
  }

  function openMobileCreateAction(nextPage) {
    setMobileCreateMenuOpen(false);
    navigate(nextPage);
  }

  function handleMobileReturnClick() {
    const target = mobileReturnPageRef.current || mobileDefaultReturnTargets[pageRef.current] || "";
    if (!target || target === pageRef.current) return;
    navigate(target, { resetMobileReturn: true, replace: true });
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
        title: cleanDisplayMessage(title),
        message: cleanDisplayMessage(message),
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

  async function reloadForPwaUpdate() {
    const serviceWorker = window.navigator.serviceWorker;
    if (!serviceWorker?.getRegistration) {
      window.location.reload();
      return;
    }
    try {
      const registration = await serviceWorker.getRegistration();
      if (!registration?.waiting) {
        window.location.reload();
        return;
      }
      let reloaded = false;
      const reloadOnce = () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      };
      serviceWorker.addEventListener("controllerchange", reloadOnce, { once: true });
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(reloadOnce, 1200);
    } catch {
      window.location.reload();
    }
  }

  async function installPwaApp() {
    if (!pwaInstallPrompt) return;
    const promptEvent = pwaInstallPrompt;
    setPwaInstallPrompt(null);
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch {
      setPwaInstallPrompt(promptEvent);
    }
  }

  function dismissPwaInstallPrompt() {
    setPwaInstallPrompt(null);
    setIosInstallGuideVisible(false);
    setPwaInstallDismissed(true);
    localStorage.setItem(pwaInstallDismissedKey, "true");
  }

  function openPwaInstallGuide() {
    window.open("/install.html", "_blank", "noopener,noreferrer");
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
    const [data, sourceData] = await Promise.all([
      requestJson(`/api/assets${query}`),
      requestJson(`/api/task-source-links${query}`).catch((error) => ({
        sourceLinks: [],
        sourceLinkError: error.message || "来源记录读取失败"
      }))
    ]);
    setAssets({
      rows: data.rows || [],
      outputFiles: data.outputFiles || [],
      sourceLinks: sourceData.sourceLinks || [],
      sourceLinkError: sourceData.sourceLinkError || ""
    });
  }

  async function loadSelectionAssets() {
    try {
      const data = await requestJson("/api/selection-assets");
      setSelectionAssets(normalizeSelectionAssetResponse(data));
    } catch (error) {
      setSelectionAssets({
        products: selectionProducts,
        accounts: accountAssetSeeds,
        source: "local",
        error: error.message
      });
    }
  }

  async function updateSelectionProduct(productId, patch, { silent = false } = {}) {
    const data = await requestJson(`/api/selection-products/${encodeURIComponent(productId)}`, {
      method: "POST",
      body: JSON.stringify(patch)
    });
    setSelectionAssets((current) =>
      normalizeSelectionAssetResponse({
        ok: true,
        products: (current.products || selectionProducts).map((product) => product.id === productId ? { ...product, ...data.product } : product),
        accounts: current.accounts || accountAssetSeeds
      })
    );
    if (!silent) {
      addNotification({
        level: "success",
        title: "选品状态已更新",
        message: `${data.product?.sku || productId} 已写入选品资产库。`,
        target: productLibraryTarget(productId)
      });
    }
    return data.product;
  }

  async function bulkUpdateSelectionProducts(updates = [], { silent = false } = {}) {
    const data = await requestJson("/api/selection-products/bulk", {
      method: "POST",
      body: JSON.stringify({ updates })
    });
    const returnedProducts = (data.results || []).filter((item) => item.ok && item.product).map((item) => item.product);
    if (returnedProducts.length) {
      const productMap = new Map(returnedProducts.map((product) => [product.id, product]));
      setSelectionAssets((current) =>
        normalizeSelectionAssetResponse({
          ok: true,
          products: (current.products || selectionProducts).map((product) => productMap.has(product.id) ? { ...product, ...productMap.get(product.id) } : product),
          accounts: current.accounts || accountAssetSeeds
        })
      );
    }
    if (!silent && returnedProducts.length) {
      addNotification({
        level: data.failedCount ? "warning" : "success",
        title: "选品资产批量更新",
        message: `已写入 ${data.successCount || returnedProducts.length} 个 SKU${data.failedCount ? `，${data.failedCount} 个失败` : ""}。`,
        target: "selectionAssets"
      });
    }
    return data;
  }

  async function createSelectionProduct(candidate, { silent = false } = {}) {
    const data = await requestJson("/api/selection-products", {
      method: "POST",
      body: JSON.stringify(candidate)
    });
    setSelectionAssets((current) =>
      normalizeSelectionAssetResponse({
        ok: true,
        products: [data.product, ...(current.products || selectionProducts).filter((product) => product.id !== data.product.id)],
        accounts: current.accounts || accountAssetSeeds
      })
    );
    if (!silent) {
      addNotification({
        level: "success",
        title: "候选商品已入库",
        message: `${data.product.sku} 已完成自动初评，下一步补素材和商品卡截图。`,
        target: productLibraryTarget(data.product.id)
      });
    }
    return data.product;
  }

  async function saveAccountAsset(accountPayload) {
    const hasId = Boolean(accountPayload?.id);
    const path = hasId ? `/api/account-assets/${encodeURIComponent(accountPayload.id)}` : "/api/account-assets";
    const data = await requestJson(path, {
      method: "POST",
      body: JSON.stringify(accountPayload)
    });
    const currentProducts = selectionAssets.products || selectionProducts;
    const currentAccounts = selectionAssets.accounts || accountAssetSeeds;
    const exists = currentAccounts.some((account) => account.id === data.account.id);
    const nextAccounts = exists
      ? currentAccounts.map((account) => account.id === data.account.id ? { ...account, ...data.account } : account)
      : [data.account, ...currentAccounts];
    const affectedProducts = currentProducts.filter((product) => {
      const previousFit = accountFitSummaryForProduct(product, currentAccounts);
      const nextFit = accountFitSummaryForProduct(product, nextAccounts);
      return previousFit.account?.id === data.account.id
        || nextFit.account?.id === data.account.id
        || (data.account.recommended || []).includes(product.sku);
    }).slice(0, 30);
    const refreshedProducts = [];
    for (const product of affectedProducts) {
      const verificationPatch = buildAssetVerificationRefreshPatch(product, nextAccounts);
      const snapshot = verificationPatch.assetValidationSnapshot || {};
      const loggedPatch = withAssetActionLogs(product, verificationPatch, [{
        type: "账号资产",
        label: "账号保存后刷新商品验证",
        detail: `${data.account.name} 更新后刷新账号适配与生成前验证`,
        target: data.account.name,
        status: snapshot.label || "已刷新"
      }]);
      const refreshed = await requestJson(`/api/selection-products/${encodeURIComponent(product.id)}`, {
        method: "POST",
        body: JSON.stringify(loggedPatch)
      });
      if (refreshed.product) refreshedProducts.push(refreshed.product);
    }
    setSelectionAssets((current) =>
      normalizeSelectionAssetResponse({
        ok: true,
        products: (current.products || currentProducts).map((product) => refreshedProducts.find((item) => item.id === product.id) || product),
        accounts: nextAccounts
      })
    );
    addNotification({
      level: "success",
      title: "账号资产已保存",
      message: `${data.account.name} 已可用于选品匹配和批次生成${refreshedProducts.length ? `，并刷新 ${refreshedProducts.length} 个相关 SKU 验证。` : "。"}`,
      target: accountAssetsTarget(data.account.id)
    });
    return data.account;
  }

  async function uploadSelectionMaterial(product, slot, file) {
    const image = await readImageFile(file);
    const data = await requestJson(`/api/selection-products/${encodeURIComponent(product.id)}/materials/${encodeURIComponent(slot.id)}`, {
      method: "POST",
      body: JSON.stringify({
        image,
        slot,
        checklist: product.assetChecklist || []
      })
    });
    const baseProduct = { ...product, ...data.product };
    const accounts = selectionAssets.accounts?.length ? selectionAssets.accounts : accountAssetSeeds;
    const verificationPatch = buildAssetVerificationRefreshPatch(baseProduct, accounts);
    const snapshot = verificationPatch.assetValidationSnapshot || {};
    const loggedPatch = withAssetActionLogs(baseProduct, verificationPatch, [
      {
        type: "素材文件",
        label: `绑定${slot.label}`,
        detail: file?.name || "真实素材文件",
        target: slot.label,
        status: "已绑定"
      },
      {
        type: "资产验证",
        label: "自动刷新生成前资产验证",
        detail: snapshot.summary || "资产验证已刷新",
        target: "生成前验证",
        status: snapshot.label || "已刷新"
      }
    ]);
    const loggedData = await requestJson(`/api/selection-products/${encodeURIComponent(product.id)}`, {
      method: "POST",
      body: JSON.stringify(loggedPatch)
    });
    const nextProduct = loggedData.product || { ...data.product, ...loggedPatch };
    setSelectionAssets((current) =>
      normalizeSelectionAssetResponse({
        ok: true,
        products: (current.products || selectionProducts).map((item) => item.id === product.id ? { ...item, ...nextProduct } : item),
        accounts: current.accounts || accountAssetSeeds
      })
    );
    addNotification({
      level: "success",
      title: "素材已绑定",
      message: `${product.sku} / ${slot.label} 已保存真实素材。`,
      target: productLibraryTarget(product.id)
    });
    return nextProduct;
  }

  async function createSelectionBatch(productsToQueue, { autoStart = false } = {}) {
    const accounts = selectionAssets.accounts?.length ? selectionAssets.accounts : accountAssetSeeds;
    const candidates = (productsToQueue || [])
      .filter((product) => product && canCreateSelectionBatchFromProduct(product))
      .slice(0, 10);
    if (!candidates.length) {
      addNotification({
        level: "warn",
        title: "没有可建批次的 SKU",
        message: "请先补齐资产，或把 SKU 保持在可测、复测、放大状态。",
        target: "productScoring"
      });
      return null;
    }
    const candidatesWithPrecheck = candidates.map((product) => {
      const gate = selectionBatchGateForProduct(product);
      const accountFit = accountFitSummaryForProduct(product, accounts);
      const assetVerification = assetVerificationGateForProduct(product, accountFit);
      return {
        ...product,
        materialPrecheck: gate.precheck,
        complianceSummary: gate.compliance,
        accountFit,
        batchGate: gate,
        assetVerification
      };
    });
    const blockedProducts = candidatesWithPrecheck.filter((product) =>
      product.batchGate.baseCanCreate
      && (!product.batchGate.canQueue || product.accountFit.status === "blocked" || product.assetVerification.computedStatus === "blocked")
    );
    const selected = candidatesWithPrecheck.filter((product) =>
      product.batchGate.canQueue
      && product.accountFit.status !== "blocked"
      && product.assetVerification.computedStatus !== "blocked"
    );
    const warnedProducts = selected.filter((product) =>
      product.batchGate.materialWarn
      || product.batchGate.cardWarn
      || product.batchGate.complianceWarn
      || product.batchGate.researchWarn
      || product.accountFit.status === "warn"
      || product.assetVerification.status === "warn"
    );
    if (blockedProducts.length) {
      addNotification({
        level: selected.length ? "warn" : "error",
        title: selected.length ? "部分 SKU 已跳过" : "批次预检未通过",
        message: blockedProducts.map((product) => {
          const issue = product.batchGate.canQueue && product.accountFit.status === "blocked"
            ? product.accountFit.primary
            : product.batchGate.canQueue && product.assetVerification.computedStatus === "blocked"
              ? product.assetVerification.label
              : product.batchGate.issue;
          const action = product.batchGate.canQueue && product.accountFit.status === "blocked"
            ? product.accountFit.action
            : product.batchGate.canQueue && product.assetVerification.computedStatus === "blocked"
              ? product.assetVerification.primaryAction
              : product.batchGate.action;
          return `${product.sku}：${issue}｜${action}`;
        }).join("；"),
        target: productLibraryTarget(blockedProducts[0]?.id)
      });
    }
    if (!selected.length) return null;
    const selectedForBatch = [];
    const autoSavedVerification = [];
    try {
      for (const product of selected) {
        const verification = product.assetVerification || assetVerificationGateForProduct(product, product.accountFit);
        if (verification.computedStatus !== "blocked" && (verification.requiresSave || !verification.hasSaved)) {
          const cleanSnapshot = buildAssetVerificationSnapshotForProduct(product, product.accountFit);
          const savedProduct = await updateSelectionProduct(product.id, withAssetActionLog(product, {
            assetValidationSnapshot: cleanSnapshot,
            assetVerificationUpdatedAt: cleanSnapshot.generatedAt || new Date().toISOString(),
            assetStatus: cleanSnapshot.summary,
            assetPercent: cleanSnapshot.status === "pass" ? Math.max(Number(product.assetPercent || 0), 82) : product.assetPercent
          }, {
            type: "资产验证",
            label: verification.isStale ? "建批次前自动重存生成前验证" : "建批次前自动保存生成前验证",
            detail: cleanSnapshot.summary,
            target: "批次准入",
            status: cleanSnapshot.label
          }), { silent: true });
          autoSavedVerification.push(savedProduct?.sku || product.sku);
          const accountFit = accountFitSummaryForProduct(savedProduct || product, accounts);
          selectedForBatch.push({
            ...product,
            ...(savedProduct || {}),
            accountFit,
            batchGate: selectionBatchGateForProduct(savedProduct || product),
            assetVerification: assetVerificationGateForProduct(savedProduct || product, accountFit)
          });
        } else {
          selectedForBatch.push(product);
        }
      }
    } catch (error) {
      addNotification({
        level: "error",
        title: "生成前验证保存失败",
        message: error.message || "请先到商品资料库保存验证记录后再建批次。",
        target: productLibraryTarget(selected[0]?.id)
      });
      return null;
    }
    let batchItems = [];
    try {
      batchItems = await Promise.all(selectedForBatch.map(async (product, index) => {
        const account = product.accountFit?.account || selectAccountForProduct(product, accounts);
        const materialPack = await buildBatchMaterialImages(product);
        return {
          ...selectionProductToBatchItem(product, index, account, materialPack),
          modelSettings: buildModelSettingsPayload(modelSettings)
        };
      }));
    } catch (error) {
      addNotification({
        level: "error",
        title: "素材读取失败",
        message: error.message || "请检查已绑定素材文件是否还能打开。",
        target: productLibraryTarget(selectedForBatch[0]?.id || candidates[0]?.id)
      });
      return null;
    }
    const materialImageCount = batchItems.reduce((total, item) => total + (item.images?.length || 0), 0);
    const data = await requestJson("/api/batches", {
      method: "POST",
      body: JSON.stringify({
        name: `选品测品批次 ${new Date().toLocaleString("zh-CN", { hour12: false })}`,
        concurrency: 2,
        autoStart,
        source: "selection-assets",
        items: batchItems
      })
    });
    await loadBatchJobs();
    if (data.job?.id) await loadBatchDetail(data.job.id);
    const link = {
      batchId: data.job?.id || "",
      batchName: data.job?.name || "",
      status: data.job?.status || (autoStart ? "queued" : "draft"),
      itemCount: selectedForBatch.length,
      createdAt: data.job?.created_at || new Date().toISOString()
    };
    const updatedProducts = await Promise.all(selectedForBatch.map((product) => updateSelectionProduct(
      product.id,
      {
        lifecycle: selectionBatchLifecycleAfterCreate(product),
        assetStatus: `${selectionBatchStageName(product)}批次已${autoStart ? "启动" : "创建"}`,
        batchLinks: [
          link,
          ...(Array.isArray(product.batchLinks) ? product.batchLinks.filter((item) => item.batchId !== link.batchId) : [])
        ].slice(0, 8)
      },
      { silent: true }
    )));
    setSelectionAssets((current) =>
      normalizeSelectionAssetResponse({
        ok: true,
        products: (current.products || selectionProducts).map((product) => updatedProducts.find((item) => item?.id === product.id) || product),
        accounts: current.accounts || accountAssetSeeds
      })
    );
    addNotification({
      level: warnedProducts.length ? "warn" : "success",
      title: autoStart ? "选品批次已启动" : "选品批次已创建",
      message: `已把 ${selectedForBatch.length} 个 SKU 写入批量生成，并带入 ${materialImageCount} 张真实素材${autoSavedVerification.length ? `，自动保存 ${autoSavedVerification.length} 条生成前验证` : ""}${warnedProducts.length ? `，其中 ${warnedProducts.length} 个按素材/商品卡/合规/来源/账号/验证预检降级为保守脚本` : ""}。`,
      target: batchTarget(data.job?.id)
    });
    navigate(batchTarget(data.job?.id));
    return data;
  }

  async function startSelectionBatchDraft(batchId, product = {}) {
    if (!batchId) {
      addNotification({
        level: "warn",
        title: "批次草稿缺少编号",
        message: `${product.sku || "当前 SKU"} 暂时无法直接启动，请到批次页检查。`,
        target: "batch"
      });
      return null;
    }
    const data = await requestJson(`/api/batches/${encodeURIComponent(batchId)}/start`, {
      method: "POST",
      body: "{}"
    });
    await loadBatchJobs();
    await loadBatchDetail(data.job?.id || batchId);
    await loadSelectionAssets();
    addNotification({
      level: "success",
      title: "批次草稿已启动",
      message: `${product.sku || data.job?.name || "选品测品批次"} 已进入队列，同批 SKU 会一起开始生成。`,
      target: batchTarget(batchId)
    });
    return data;
  }

  function updateStudio(field, value) {
    setStudio((current) => ({ ...current, [field]: value }));
  }

  async function resolveTemplatePromptPackText(template) {
    if (template?.promptPackText) return template.promptPackText;
    if (!template?.promptPackTextLoader) return "";
    const promptPackText = await template.promptPackTextLoader();
    return typeof promptPackText === "string" ? promptPackText : "";
  }

  async function applyBuiltInTemplate(template) {
    if (!auth.user) {
      setLoginError("");
      setPendingTemplateId(template?.id || "");
      setGuestLoginVisible(true);
      return;
    }
    let promptPackText = "";
    try {
      promptPackText = await resolveTemplatePromptPackText(template);
    } catch (error) {
      addNotification({
        level: "error",
        title: "模板读取失败",
        message: "请刷新页面后再套用模板。",
        target: "studio"
      });
      return;
    }
    if (!promptPackText) return;
    setPendingTemplateId("");
    setStudio((current) => ({
      ...current,
      promptPackText,
      promptPackage: {
        name: template.packageName,
        templateId: template.id,
        size: promptPackText.length,
        type: "builtin/template",
        source: "内置模板"
      },
      productName: current.productName || template.productName || "",
      productCategory: template.productCategory || current.productCategory || "",
      productBrief: template.productBrief || current.productBrief || "",
      targetDuration: 15,
      aspectRatio: "9:16",
      videoMode: current.videoMode || "dry_run",
      autoSubmit: false
    }));
    addNotification({
      level: "success",
      title: "已套用女装轻奢模板",
      message: "请继续上传人物参考图、女装服装图；有封面图或详情头图也可以一起上传。",
      target: "studio"
    });
    setMobileCreateIntent("images");
    navigate("studio");
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
    const key = String(name || "视频生成").trim() || "视频生成";
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
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".doc")) {
        alert("当前支持 .docx、.txt、.md，请把 .doc 另存为 .docx 后上传。");
        return;
      }
      const text = lower.endsWith(".docx") ? await extractDocxFile(file) : await file.text();
      updateStudio("promptPackText", text);
      updateStudio("promptPackage", { name: file.name, size: file.size, type: file.type || "text/plain" });
      addNotification({
        level: "success",
        title: "提示词包已读取",
        message: file.name,
        target: "studio"
      });
    } catch (error) {
      const message = error.message || "提示词包读取失败，请重新上传 .docx、.txt 或 .md 文件。";
      alert(message);
      addNotification({
        level: "error",
        title: "提示词包读取失败",
        message,
        target: "studio"
      });
    }
  }

  async function handleImages(files) {
    try {
      const selected = Array.from(files || []).slice(0, 6);
      const images = await Promise.all(selected.map(readImageFile));
      updateStudio("images", images);
      if (images.length) {
        addNotification({
          level: "success",
          title: "产品图片已读取",
          message: `已选择 ${images.length} 张图片。`,
          target: "studio"
        });
      }
    } catch (error) {
      const message = error.message || "图片读取失败，请重新上传常见格式图片。";
      alert(message);
      addNotification({
        level: "error",
        title: "图片读取失败",
        message,
        target: "studio"
      });
    }
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
      alert("请上传素材图片，或填写商品补充信息。");
      return;
    }
    resetRunState();
    setPromptRunning(true);
    upsertPromptStep("提交任务", "running", "正在把提示词包和素材图片发送到生成服务。", "", new Date().toISOString());
    addNotification({
      level: "info",
      title: "提示词生成已开始",
      message: "正在分析提示词包和素材图片。",
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
      alert(error.message || "提示词任务创建失败，请检查网络或生成服务。");
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
    let settled = false;
    source.onmessage = (event) => handlePromptEvent(JSON.parse(event.data));
    source.addEventListener("done", () => {
      settled = true;
      source.close();
      setPromptRunning(false);
    });
    source.onerror = () => {
      source.close();
      if (!settled) {
        pollPromptRunStatus(nextRunId, 0);
      }
    };
  }

  async function pollPromptRunStatus(nextRunId, attempt = 0) {
    if (!nextRunId) {
      setPromptRunning(false);
      return;
    }
    try {
      const data = await requestJson(`/api/runs/${nextRunId}`);
      const events = Array.isArray(data.events) ? data.events : [];
      events.forEach((item) => handlePromptEvent(item));
      if (["completed", "failed", "cancelled"].includes(data.status)) {
        if (data.status === "completed" && data.result) {
          handlePromptEvent({
            type: "completed",
            message: "最终提示词已生成。",
            result: data.result,
            at: new Date().toISOString()
          });
        }
        if (data.status === "failed") {
          handlePromptEvent({
            type: "failed",
            phase: "失败",
            message: data.error || "模型调用或流程执行失败。",
            at: new Date().toISOString()
          });
        }
        setPromptRunning(false);
        return;
      }
      if (attempt >= 120) {
        upsertPromptStep("状态同步", "failed", "任务长时间没有返回结果，请重新发起或检查模型服务。", "", new Date().toISOString());
        setPromptRunning(false);
        return;
      }
      window.setTimeout(() => pollPromptRunStatus(nextRunId, attempt + 1), 3000);
    } catch (error) {
      if (attempt < 3) {
        window.setTimeout(() => pollPromptRunStatus(nextRunId, attempt + 1), 3000);
        return;
      }
      upsertPromptStep("状态同步", "failed", error.message || "无法读取任务状态。", "", new Date().toISOString());
      setPromptRunning(false);
    }
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
      setPromptRunning(false);
      upsertPromptStep("最终封装", "done", event.message, "", event.at);
      addNotification({
        level: "success",
        title: "最终提示词已生成",
        message: result.suggestedCategory ? `识别类别：${result.suggestedCategory}` : "可以复制或提交生成视频。",
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
    if (videoRunningRef.current) {
      upsertVideoStep("提交保护", "running", "已有一个单条视频任务正在提交，请等待当前任务返回结果。", "", new Date().toISOString());
      return;
    }
    const source = override || studio;
    if (!source.finalPrompt.trim()) {
      alert("请先生成或粘贴最终完整提示词。");
      return;
    }
    if (!source.images.length) {
      alert("请先上传产品图片，生成视频需要产品参考图。");
      return;
    }
    videoRunningRef.current = true;
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
        title: source.videoMode === "dry_run" ? "视频验证已开始" : "视频任务已提交",
        message: source.videoMode === "dry_run" ? "当前为先验证模式，不会真实生成视频。" : "正在提交并等待视频结果。",
        target: "libtv"
      });
      const { runId: nextRunId } = await requestJson("/api/video-runs", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      connectVideoEvents(nextRunId);
    } catch (error) {
      videoRunningRef.current = false;
      setVideoRunning(false);
      alert(error.message || "视频提交失败，请检查生成服务和任务参数。");
      upsertVideoStep("提交失败", "failed", error.message, "", new Date().toISOString());
      appendVideoLog(error.message);
      addNotification({
        level: "error",
        title: "视频提交失败",
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
      videoRunningRef.current = false;
      setVideoRunning(false);
      loadTasks().catch(() => {});
      loadJobs().catch(() => {});
      loadAssets(assetTaskCode).catch(() => {});
    });
    source.onerror = () => {
      source.close();
      videoRunningRef.current = false;
      setVideoRunning(false);
    };
  }

  function handleVideoEvent(event) {
    if (event.type === "status") {
      upsertVideoStep(event.phase, "running", event.message, "", event.at);
      appendVideoLog(`[${event.phase}] ${event.message}`);
    }
    if (event.type === "completed") {
      upsertVideoStep(event.phase || "视频完成", "done", event.message, JSON.stringify(event.result, null, 2), event.at);
      appendVideoLog(`[${event.phase}] ${event.message}`);
      appendVideoLog(JSON.stringify(event.result, null, 2));
      addNotification({
        level: "success",
        title: "视频任务完成",
        message: event.message || "视频结果已返回，可到视频任务或视频拼接查看。",
        target: "libtv"
      });
    }
    if (event.type === "failed") {
      const failedMessage = cleanDisplayMessage(event.message || "请查看视频任务详情。");
      const needsCompliance = /合规|真人|角色库|compliance/i.test(failedMessage);
      const failedPhase = needsCompliance ? "需合规校验" : event.phase || "视频生成失败";
      upsertVideoStep(failedPhase, "failed", failedMessage, "", event.at);
      appendVideoLog(`[${failedPhase}] ${failedMessage}`);
      addNotification({
        level: "error",
        title: needsCompliance ? "视频需合规校验" : "视频任务失败",
        message: failedMessage,
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
    const overviewPage = (
      <OverviewPage
        runtime={runtime}
        tasks={tasks}
        jobs={jobs}
        assets={assets}
        navigate={navigate}
        guest={!auth.user}
        onLogin={() => setGuestLoginVisible(true)}
        onRefresh={() => {
          if (!auth.user) {
            setGuestLoginVisible(true);
            return;
          }
          refreshRuntime();
          loadTasks();
          loadJobs();
          loadAssets(assetTaskCode);
        }}
      />
    );
    if (page === "overview") return overviewPage;
    if (page === "inspiration") {
      return (
        <Suspense fallback={<div className="panel mobile-inspiration-page"><div className="empty-state">正在加载创意玩法</div></div>}>
          <LazyMobileInspirationPage
            navigate={navigate}
            guest={!auth.user}
            onLogin={() => setGuestLoginVisible(true)}
            onApplyTemplate={applyBuiltInTemplate}
            templates={builtInPromptTemplates}
          />
        </Suspense>
      );
    }
    if (!auth.user) return overviewPage;
    if (page === "selectionAssets") {
      return <SelectionAssetsOverviewPage selectionAssets={selectionAssets} navigate={navigate} onRefresh={loadSelectionAssets} onCreateBatch={createSelectionBatch} onStartBatch={startSelectionBatchDraft} onUpdateProduct={updateSelectionProduct} onBulkUpdateProducts={bulkUpdateSelectionProducts} onSaveAccount={saveAccountAsset} />;
    }
    if (page === "productScoring") {
      return <ProductScoringPage selectionAssets={selectionAssets} navigate={navigate} onRefresh={loadSelectionAssets} onCreateBatch={createSelectionBatch} onUpdateProduct={updateSelectionProduct} onCreateProduct={createSelectionProduct} />;
    }
    if (page === "productLibrary") {
      return <ProductLibraryPage selectionAssets={selectionAssets} navigate={navigate} onRefresh={loadSelectionAssets} onUpdateProduct={updateSelectionProduct} onCreateProduct={createSelectionProduct} onUploadMaterial={uploadSelectionMaterial} onCreateBatch={createSelectionBatch} />;
    }
    if (page === "accountAssets") {
      return <AccountAssetsPage selectionAssets={selectionAssets} navigate={navigate} onRefresh={loadSelectionAssets} onSaveAccount={saveAccountAsset} />;
    }
    if (workflowModulePages[page]) {
      return (
        <Suspense fallback={<div className="panel workflow-module-page"><div className="empty-state">正在加载流程说明</div></div>}>
          <LazyWorkflowModulePage
            module={workflowModulePages[page]}
            navigate={navigate}
          />
        </Suspense>
      );
    }
    if (page === "batch") {
      return (
        <Suspense fallback={<div className="panel batch-hero"><div className="empty-state">正在加载批量生成</div></div>}>
          <LazyBatchPage
            runtime={runtime}
            modelSettings={modelSettings}
            batchJobs={batchJobs}
            batchDetail={batchDetail}
            focusBatchId={batchFocusId}
            loadBatchJobs={loadBatchJobs}
            loadBatchDetail={loadBatchDetail}
            addNotification={addNotification}
            onBatchFocusHandled={() => setBatchFocusId("")}
            onRefreshAll={() => {
              loadBatchJobs();
              loadTasks();
              loadJobs();
              loadAssets(assetTaskCode);
            }}
          />
        </Suspense>
      );
    }
    if (page === "textImage") {
      return (
        <Suspense fallback={<div className="panel text-image-result-panel"><div className="empty-state">正在加载文生图画布</div></div>}>
          <LazyTextImagePage
            runtime={runtime}
            modelSettings={modelSettings}
            addNotification={addNotification}
            onRefreshAssets={() => loadAssets(assetTaskCode)}
          />
        </Suspense>
      );
    }
    if (page === "stitch") {
      return (
        <Suspense fallback={<div className="panel stitch-panel"><div className="empty-state">正在加载视频拼接</div></div>}>
          <LazyVideoStitchPage jobs={jobs} assets={assets} addNotification={addNotification} onRefresh={() => {
            loadJobs();
            loadAssets(assetTaskCode);
          }} />
        </Suspense>
      );
    }
    if (page === "tasks") {
      return (
        <Suspense fallback={<div className="panel"><div className="empty-state">正在加载任务看板</div></div>}>
          <LazyTasksPage rows={tasks} onRefresh={loadTasks} onOpenAssets={(taskCode) => {
            setAssetTaskCode(taskCode);
            loadAssets(taskCode);
            navigate("assets");
          }} />
        </Suspense>
      );
    }
    if (page === "libtv") {
      return (
        <Suspense fallback={<div className="panel"><div className="empty-state">正在加载视频任务</div></div>}>
          <LazyLibtvPage rows={jobs} outputFiles={assets.outputFiles || []} addNotification={addNotification} onRefresh={loadJobs} onOpenAssets={(taskCode) => {
            setAssetTaskCode(taskCode);
            loadAssets(taskCode);
            navigate("assets");
          }} />
        </Suspense>
      );
    }
    if (page === "assets") {
      return (
        <Suspense fallback={<div className="panel"><div className="empty-state">正在加载素材与输出</div></div>}>
          <LazyAssetsPage
            tasks={tasks}
            taskCode={assetTaskCode}
            setTaskCode={setAssetTaskCode}
            onTaskCodeChange={(nextTaskCode) => {
              setAssetTaskCode(nextTaskCode);
              loadAssets(nextTaskCode).catch((error) => {
                addNotification({ level: "error", title: "素材读取失败", message: error.message, target: "assets" });
              });
            }}
            data={assets}
            addNotification={addNotification}
            onRefresh={() => loadAssets(assetTaskCode)}
          />
        </Suspense>
      );
    }
    if (page === "settings") {
      return (
        <Suspense fallback={<div className="panel settings-panel"><div className="empty-state">正在加载我的页面</div></div>}>
          <SettingsPage
            runtime={runtime}
            onRefresh={refreshRuntime}
            modelSettings={modelSettings}
            updateModelSettings={updateModelSettings}
            addNotification={addNotification}
          />
        </Suspense>
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
  }, [page, auth.user, tasks, jobs, batchJobs, batchDetail, batchFocusId, assets, assetTaskCode, runtime, selectionAssets, studio, promptSteps, promptRunning, runId, videoRunning, videoSteps, videoLog, modelSettings, modelTrace]);

  if (auth.loading) {
    return <LoginScreen loading />;
  }

  const mobileSidebarVisible = mobileSidebarOpen;
  const useDesktopCollapsedSidebar = sidebarCollapsed && !mobileSidebarVisible;
  const mobileSidebarProgress = mobileSidebarOpen ? 1 : 0;
  const mobileReturnTarget = mobileReturnPageRef.current || mobileDefaultReturnTargets[page] || "";
  const showMobileReturnButton = mobileViewport && mobileReturnTarget && mobileReturnTarget !== page && !mobileRootPageIds.has(page);
  const shellStyle = {
    "--mobile-sidebar-x": "0px",
    "--mobile-sidebar-backdrop-opacity": String(mobileSidebarProgress)
  };

  return (
    <div className={[
      useDesktopCollapsedSidebar ? "console-shell sidebar-collapsed" : "console-shell",
      mobileSidebarVisible ? "mobile-sidebar-visible" : "",
      isGuest ? "guest-preview" : "",
      mobileSidebarOpen ? "mobile-sidebar-open" : "",
      mobileCreateMenuOpen ? "mobile-create-menu-open" : ""
    ].filter(Boolean).join(" ")} style={shellStyle}>
      {mobileSidebarVisible ? (
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          aria-label="关闭菜单"
          onClick={() => {
            setMobileSidebarDrag({ active: false, offset: 0, progress: 0 });
            setMobileSidebarOpen(false);
          }}
        />
      ) : null}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AI</div>
          <div className="brand-copy">
            <div className="brand-title">AI短视频</div>
              <div className="brand-subtitle">工作流控制台</div>
          </div>
        </div>
        <div className="mobile-drawer-account">
          <div className="mobile-drawer-avatar">AI</div>
          <div className="mobile-drawer-account-copy">
            <strong>AI短视频</strong>
            <span>
              {isGuest
                ? "游客预览 · 可先体验首页"
                : `${auth.user?.displayName || auth.user?.name || auth.user?.username || "已登录账号"} · 记录已同步`}
            </span>
          </div>
          <button type="button" onClick={isGuest ? () => setGuestLoginVisible(true) : () => navigate("settings")}>
            {isGuest ? "登录" : "我的"}
          </button>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = navItemIsActive(item, page);
            const expanded = Boolean(item.children?.length && expandedGroups[item.id]);
            return (
              <div className={item.children ? "nav-group" : ""} key={item.id}>
                <button
                  type="button"
                  className={active ? "nav-item active" : "nav-item"}
                  onClick={() => item.children?.length ? toggleNavGroup(item.id) : navigate(item.id, { resetMobileReturn: true })}
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
                          type="button"
                          key={child.id}
                          className={page === child.id ? "subnav-item active" : "subnav-item"}
                          aria-current={page === child.id ? "page" : undefined}
                          onClick={(event) => {
                            event.stopPropagation();
                    navigate(child.id, { resetMobileReturn: true });
                          }}
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
              className={showMobileReturnButton ? "sidebar-toggle mobile-return-button" : "sidebar-toggle"}
              onClick={showMobileReturnButton ? handleMobileReturnClick : toggleShellSidebar}
              aria-label={showMobileReturnButton ? "返回上一层" : "打开菜单"}
            >
              {showMobileReturnButton ? <ArrowLeft size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <h1>{isGuest ? "AI 视频创作" : (findNavItem(page)?.label || "提示词工作台")}</h1>
              <p>{isGuest ? "先浏览功能，使用时登录账号" : "选择功能 → 上传素材 → 生成结果"}</p>
            </div>
          </div>
          <div className="top-actions">
            {isGuest ? (
              <>
                <MobileThemeToggle theme={theme} setTheme={setTheme} />
                <button type="button" className="guest-login-cta" onClick={() => setGuestLoginVisible(true)}>
                  登录
                </button>
              </>
            ) : (
              <>
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
                <MobileThemeToggle theme={theme} setTheme={setTheme} />
                <button type="button" className="icon-button top-icon" title="退出登录" onClick={handleLogout}>
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </header>
        {pwaUpdateReady ? (
          <section className="pwa-update-banner" role="status" aria-live="polite">
            <div>
              <strong>发现新版本</strong>
              <span>刷新后可使用最新的移动端和 PWA 能力。</span>
            </div>
            <button type="button" className="secondary-button" onClick={reloadForPwaUpdate}>刷新更新</button>
          </section>
        ) : null}
        {showNativeInstallPrompt ? (
          <section className="pwa-install-banner" role="status" aria-live="polite">
            <div className="pwa-install-icon">
              <Download size={18} />
            </div>
            <div className="pwa-install-copy">
              <strong>安装到桌面</strong>
              <span>下次可以像 App 一样打开工作台。</span>
            </div>
            <div className="pwa-install-hints" aria-label="安装步骤">
              <span>浏览器打开</span>
              <span>添加到桌面</span>
              <span>桌面进入</span>
            </div>
            <div className="pwa-install-actions pwa-install-actions-three">
              <button type="button" className="primary-button" onClick={installPwaApp}>安装</button>
              <button type="button" className="ghost-button" onClick={openPwaInstallGuide}>查看步骤</button>
              <button type="button" className="ghost-button" onClick={dismissPwaInstallPrompt}>稍后</button>
            </div>
          </section>
        ) : null}
        {showIosInstallGuide ? (
          <section className="pwa-install-banner" role="status" aria-live="polite">
            <div className="pwa-install-icon">
              <Download size={18} />
            </div>
            <div className="pwa-install-copy">
              <strong>添加到主屏幕</strong>
              <span>在 Safari 点分享按钮，再选择“添加到主屏幕”。不会操作时点查看步骤。</span>
            </div>
            <div className="pwa-install-hints" aria-label="iPhone 安装步骤">
              <span>Safari 打开</span>
              <span>点分享</span>
              <span>添加到主屏幕</span>
            </div>
            <div className="pwa-install-actions">
              <button type="button" className="primary-button" onClick={openPwaInstallGuide}>查看步骤</button>
              <button type="button" className="ghost-button" onClick={dismissPwaInstallPrompt}>知道了</button>
            </div>
          </section>
        ) : null}
        {currentPage}
      </main>
      {mobileCreateMenuOpen ? (
        <div className="mobile-create-popover" role="dialog" aria-label="选择创作功能">
          <button type="button" className="mobile-create-popover-backdrop" aria-label="关闭创作菜单" onClick={() => setMobileCreateMenuOpen(false)} />
          <div className="mobile-create-radial" aria-label="快捷创作">
            <div className="mobile-create-radial-head">
              <span>快速开始</span>
              <strong>你想做什么？</strong>
              <small>选一个入口，系统会带你到对应步骤。</small>
            </div>
            {mobileCreateActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  className={item.featured ? "mobile-create-radial-action featured" : "mobile-create-radial-action"}
                  key={item.id}
                  aria-label={`${item.label}，${item.detail}`}
                  onClick={() => openMobileCreateAction(item.id)}
                >
                  <span><Icon size={20} /></span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <nav className="mobile-bottom-nav" aria-label="手机端主导航">
        {mobileTabItems.map((item) => {
          const Icon = item.icon;
          const active = mobileTabIsActive(item, page);
          return (
            <button
              type="button"
              key={item.id}
              className={active ? "mobile-bottom-nav-item active" : "mobile-bottom-nav-item"}
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(item.id, { resetMobileReturn: true })}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        className={mobileCreateMenuOpen ? "mobile-create-fab active" : "mobile-create-fab"}
        aria-label={mobileCreateMenuOpen ? "关闭创作菜单" : "打开创作菜单"}
        aria-expanded={mobileCreateMenuOpen}
        onClick={() => setMobileCreateMenuOpen((current) => !current)}
      >
        {mobileCreateMenuOpen ? <X size={26} /> : <Plus size={28} />}
      </button>
      {guestLoginVisible ? (
        <Suspense fallback={null}>
          <LazyLoginPromptSheet
            onClose={() => setGuestLoginVisible(false)}
            onSubmit={handleLogin}
            error={loginError}
            submitting={loginSubmitting}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function LoginScreen({ onSubmit, error = "", submitting = false, loading = false }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const submitLabel = submitting ? "登录中" : "登录工作台";

  function submit(event) {
    event.preventDefault();
    if (submitting || loading) return;
    onSubmit?.({ username, password });
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-label="AI 视频工作流登录">
        <div className="login-brand">
          <div className="brand-mark">AI</div>
          <div>
            <strong>AI控制台</strong>
            <span>工作流控制台</span>
          </div>
        </div>
        <div className="login-icon">
          <LockKeyhole size={23} />
        </div>
        <h1>{loading ? "正在检查登录状态" : "登录工作台"}</h1>
        <p>输入管理员账号密码后进入 AI 视频生成工作流。</p>

        {loading ? (
          <div className="login-loading">正在连接后台...</div>
        ) : (
          <>
            <form className="login-form" onSubmit={submit}>
              <label>
                <span>账号</span>
                <input
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="英文、数字、下划线"
                />
              </label>
              <label>
                <span>密码</span>
                <input
                  autoComplete="current-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 6 位"
                />
              </label>
              {error ? <div className="login-error">{error}</div> : null}
              <button className="primary-button login-submit" type="submit" disabled={submitting}>
                <LockKeyhole size={17} />
                <span>{submitLabel}</span>
              </button>
            </form>
          </>
        )}
      </section>
    </main>
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

function MobileThemeToggle({ theme, setTheme }) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      className="icon-button top-icon mobile-theme-toggle"
      title={nextTheme === "light" ? "切换浅色模式" : "切换深色模式"}
      aria-label={nextTheme === "light" ? "切换浅色模式" : "切换深色模式"}
      onClick={() => setTheme(nextTheme)}
    >
      <Icon size={16} />
    </button>
  );
}

function isLibtvConnected(runtime) {
  const health = runtime?.libtvHealth || {};
  return Boolean(
    runtime?.libtvBridgeReachable
      || health.ok
      || (health.service && health.runner_exists && health.database_exists && health.libtv_exists)
  );
}

function runtimeStatusCopy(runtime) {
  const hasRuntime = Boolean(runtime && Object.keys(runtime).length);
  const connected = isLibtvConnected(runtime);
  if (runtime?.error) {
    return {
      tone: "bad",
      desktopLabel: "生成服务未连接",
      mobileLabel: "服务异常",
      mobileDetail: "点我重试"
    };
  }
  if (!hasRuntime) {
    return {
      tone: "checking",
      desktopLabel: "生成服务检测中",
      mobileLabel: "连接中",
      mobileDetail: "稍等一下"
    };
  }
  if (connected) {
    return {
      tone: "ready",
      desktopLabel: "生成服务已连接",
      mobileLabel: "服务正常",
      mobileDetail: "可以生成"
    };
  }
  return {
    tone: "warn",
    desktopLabel: "视频通道待连接",
    mobileLabel: "视频待连",
    mobileDetail: "先别提交"
  };
}

function RuntimeStatus({ runtime, onRefresh }) {
  const copy = runtimeStatusCopy(runtime);
  const mobileAriaLabel = `${copy.mobileLabel}，${copy.mobileDetail}，点按刷新状态`;
  return (
    <button className={["runtime", copy.tone].filter(Boolean).join(" ")} onClick={onRefresh} title={copy.desktopLabel} aria-label={mobileAriaLabel}>
      <span className="status-dot" />
      <span className="runtime-label desktop-runtime-label">{copy.desktopLabel}</span>
      <span className="runtime-label mobile-runtime-label">
        <strong>{copy.mobileLabel}</strong>
        <small>{copy.mobileDetail}</small>
      </span>
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

function batchVideoResultLabel(item = {}) {
  if (item.video_url) {
    return <a href={item.video_url} target="_blank" rel="noreferrer">查看视频</a>;
  }
  const mode = String(item.video_mode || item.videoMode || "").toLowerCase();
  const status = String(item.status || "").toLowerCase();
  if (mode === "dry_run" && ["succeeded", "prompt_ready"].includes(status)) {
    return <span title="当前为先验证，不会生成真实视频链接。">先验证完成</span>;
  }
  if (item.final_prompt) return "有提示词";
  return "-";
}

function displayCleanText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  if (!text || isLikelyBrokenText(text)) return fallback;
  return text;
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

function resultValueForExport(item, key) {
  if (key === "tokens") return tokenTotal(item.token_usage_json);
  if (key === "category") return displayCleanText(item.suggested_category, displayCleanText(item.product_category, ""));
  if (key === "product_name") return displayCleanText(item.product_name, "");
  return item[key] || "";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function SelectionStatusBadge({ value }) {
  return <span className={`selection-status ${selectionStatusTone(value)}`}>{value || "-"}</span>;
}

function ReviewBadge({ product }) {
  const review = productReviewSummary(product);
  const tone = reviewRiskTone(product);
  return <span className={`review-badge ${tone}`}>{review.displayVerdict || review.verdict}</span>;
}

function ReviewAdvicePanel({ advice }) {
  const guard = advice.readinessGuard || {};
  const guardItems = guard.status === "blocked"
    ? guard.blockers || []
    : guard.status === "warn"
      ? guard.warnings || []
      : [];
  const details = [
    ...(advice.materialActions || []).map((item) => ({ type: "素材", text: item })),
    ...(advice.scriptActions || []).map((item) => ({ type: "脚本", text: item })),
    ...(advice.nextActions || []).map((item) => ({ type: "下一步", text: item }))
  ].slice(0, 6);
  return (
    <div className="review-advice-panel">
      <div className="review-advice-head">
        <div>
          <span>自动复盘建议</span>
          <strong>{advice.action}</strong>
        </div>
        <em>置信度：{advice.confidence}</em>
      </div>
      {advice.reasons?.length ? (
        <div className="review-advice-reasons">
          {advice.reasons.map((reason) => <span key={reason}>{reason}</span>)}
        </div>
      ) : null}
      {guard.status ? (
        <div className={`review-guard ${guard.status}`}>
          <div>
            <span>准入护栏</span>
            <strong>{guard.status === "blocked" ? "阻断" : guard.status === "warn" ? "待核" : "通过"}</strong>
          </div>
          <p>{guardItems[0] || guard.verification || "商品卡、账号、来源、合规和生成前验证已纳入复盘判断。"}</p>
        </div>
      ) : null}
      {details.length ? (
        <div className="review-advice-list">
          {details.map((item) => (
            <div key={`${item.type}-${item.text}`}>
              <span>{item.type}</span>
              <strong>{item.text}</strong>
            </div>
          ))}
        </div>
      ) : <p className="selection-muted">暂无额外建议，先继续回收数据。</p>}
    </div>
  );
}

function ScorePill({ value }) {
  return <span className={`score-pill ${scoreTone(value)}`}>{value}</span>;
}

function TagList({ items = [], tone = "muted" }) {
  if (!items.length) return <span className="selection-muted">-</span>;
  return (
    <div className="selection-tags">
      {items.map((item) => <span className={`selection-tag ${tone}`} key={item}>{item}</span>)}
    </div>
  );
}

function BatchLinksList({ links = [] }) {
  if (!links.length) return <p className="selection-muted">暂未创建测品批次。</p>;
  return (
    <div className="batch-link-list">
      {links.map((link) => (
        <div key={link.batchId || link.batchName}>
          <strong>{link.batchName || "选品测品批次"}</strong>
          <span>{link.status || "draft"} · {link.itemCount || 1} 个 SKU · {formatDate(link.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

function MaterialChecklist({ checklist = [], onUpdateStatus, onUploadFile, uploadingSlotId = "" }) {
  if (!checklist.length) return <p className="selection-muted">暂未生成素材清单。</p>;
  return (
    <div className="material-checklist">
      {checklist.map((slot) => (
        <div className={`material-slot ${materialStatusTone(slot.status)}`} key={slot.id}>
          <div className="material-slot-copy">
            <strong>{slot.label}</strong>
            <span>{slot.requirement}</span>
            {slot.note ? <small>{slot.note}</small> : null}
            {slot.attachments?.length ? (
              <div className="material-attachment-list">
                {slot.attachments.slice(0, 3).map((attachment) => (
                  <a key={attachment.id || attachment.url} href={attachment.url} target="_blank" rel="noreferrer">
                    <Image size={13} />
                    <span>{attachment.name || attachment.fileName}</span>
                    <small>{formatBytes(attachment.size)} · {formatDate(attachment.createdAt)}</small>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="material-slot-actions">
            <span className={`material-status ${materialStatusTone(slot.status)}`}>{slot.status}</span>
            <label className="material-upload-button">
              <Upload size={14} />
              <span>{uploadingSlotId === slot.id ? "上传中" : "绑定文件"}</span>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingSlotId === slot.id}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) onUploadFile?.(slot, file);
                }}
              />
            </label>
            <button type="button" onClick={() => onUpdateStatus(slot.id, "已就绪")}>
              <ShieldCheck size={14} />
              <span>已补</span>
            </button>
            <button type="button" onClick={() => onUpdateStatus(slot.id, "待补")}>
              <AlertTriangle size={14} />
              <span>待补</span>
            </button>
            <button type="button" onClick={() => onUpdateStatus(slot.id, "禁用")}>
              <X size={14} />
              <span>禁用</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MaterialPrecheckBadge({ product }) {
  const precheck = materialPrecheckForProduct(product);
  const detail = precheck.hardIssues[0] || precheck.warnings[0] || `${precheck.ready}/${precheck.total} 项素材就绪`;
  return (
    <span className={`material-precheck-badge ${materialPrecheckTone(precheck)}`}>
      {materialPrecheckLabel(precheck)} · {detail}
    </span>
  );
}

function AssetCompletionPlanPanel({ plan, onSavePlan, onExport, saving = false }) {
  const rows = plan?.rows || [];
  return (
    <div className={`asset-section asset-plan-panel ${plan?.status === "阻断" ? "bad" : plan?.status === "待补" ? "warn" : "good"}`}>
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <ListChecks size={17} />
            <strong>资产补齐计划</strong>
          </div>
          <p>{plan?.summary || "根据素材槽、商品卡、来源和合规风险自动拆解补齐动作。"}</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onExport}>
            <Download size={15} />
            <span>导出</span>
          </button>
          <button className="secondary-button" type="button" onClick={onSavePlan} disabled={saving}>
            <ShieldCheck size={15} />
            <span>{saving ? "保存中" : "保存计划"}</span>
          </button>
        </div>
      </div>
      <div className="asset-plan-summary">
        <div><span>状态</span><strong>{plan?.label || "待生成"}</strong></div>
        <div><span>阻断</span><strong>{rows.filter((row) => row.status === "阻断").length}</strong></div>
        <div><span>待核</span><strong>{rows.filter((row) => row.status !== "阻断").length}</strong></div>
      </div>
      <div className="asset-plan-list">
        {rows.slice(0, 8).map((row) => (
          <div className={`asset-plan-row ${row.tone}`} key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.type} · {row.owner} · {row.status}</span>
              <small>{row.action}</small>
              <em>{row.doneWhen}</em>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="selection-muted">当前 SKU 暂无需要自动拆解的补齐项。</p> : null}
      </div>
    </div>
  );
}

function AssetVerificationPanel({ snapshot, onCopy, onSave, saving = false, copyMessage = "" }) {
  const rows = snapshot?.rows || [];
  if (!snapshot) return null;
  const recordState = snapshot.computedStatus === "blocked"
    ? "不可存"
    : snapshot.requiresSave
      ? snapshot.isStale ? "待更新" : "待保存"
      : snapshot.hasSaved
        ? "有效"
        : "待保存";
  const signatureShort = snapshot.signature ? snapshot.signature.slice(-10) : "待生成";
  return (
    <div className={`asset-section asset-verification-panel ${snapshot.tone}`}>
      <div className="asset-verification-head">
        <div>
          <div className="mini-panel-head">
            <ShieldCheck size={17} />
            <strong>生成前资产验证</strong>
          </div>
          <p>{snapshot.primaryAction}</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制验证</span>
          </button>
          <button className={snapshot.status === "pass" ? "primary-button" : "secondary-button"} type="button" onClick={onSave} disabled={saving}>
            <ShieldCheck size={16} />
            <span>{saving ? "保存中" : "保存验证"}</span>
          </button>
        </div>
      </div>
      {copyMessage ? <p className="selection-task-message">{copyMessage}</p> : null}
      {snapshot.isStale ? <p className="selection-task-message warn">验证记录已过期：{snapshot.staleReason || "当前资产事实已变化"}。</p> : null}
      <div className="asset-verification-summary">
        <div><span>结论</span><strong>{snapshot.label}</strong></div>
        <div><span>记录</span><strong>{recordState}</strong></div>
        <div><span>指纹</span><strong>{signatureShort}</strong></div>
        <div><span>通过</span><strong>{snapshot.passCount}</strong></div>
        <div><span>待核</span><strong>{snapshot.warnCount}</strong></div>
        <div><span>阻断</span><strong>{snapshot.blockedCount}</strong></div>
      </div>
      <div className="asset-verification-list">
        {rows.map((row) => (
          <div className={`asset-verification-row ${row.tone}`} key={row.id}>
            <span className="asset-verification-state">{row.statusLabel}</span>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
              <small>{row.action}</small>
            </div>
            <em>{row.owner}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidencePackPanel({ pack, onCopy, onExport, copyMessage = "" }) {
  if (!pack) return null;
  const summary = pack.materialSummary || {};
  const visibleRows = (pack.rows || []).slice(0, 6);
  return (
    <div className={`asset-section evidence-pack-panel ${pack.tone}`}>
      <div className="evidence-pack-head">
        <div>
          <div className="mini-panel-head">
            <FileText size={17} />
            <strong>SKU 证据包</strong>
          </div>
          <p>{pack.primaryAction}</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制</span>
          </button>
          <button className="secondary-button" type="button" onClick={onExport}>
            <Download size={16} />
            <span>导出</span>
          </button>
        </div>
      </div>
      {copyMessage ? <p className="selection-task-message">{copyMessage}</p> : null}
      <div className="evidence-pack-summary">
        <div><span>状态</span><strong>{pack.label}</strong></div>
        <div><span>素材完整度</span><strong>{summary.percent || 0}%</strong></div>
        <div><span>绑定文件</span><strong>{pack.attachmentRows?.length || 0}</strong></div>
        <div><span>待处理</span><strong>{(pack.blockers?.length || 0) + (pack.warnings?.length || 0)}</strong></div>
      </div>
      <div className="evidence-pack-meta">
        <span>{pack.accountFit?.label || "账号适配待核"}</span>
        <span>{pack.account?.name || "未匹配账号"}</span>
        <span>{pack.docPack ? `${pack.docPack.name} ${pack.docPack.version}` : "待补 DOC"}</span>
        <span>{pack.platform?.platform || "抖音"} · {pack.platform?.publishTarget || "短视频带货"}</span>
        <span>{pack.research?.label || "来源待补"}</span>
        <span>{pack.compliance?.label || "合规待核"}</span>
      </div>
      <div className="evidence-pack-list">
        {visibleRows.map((row) => (
          <div className={`evidence-pack-row ${row.tone}`} key={row.id}>
            <div>
              <strong>{row.label}</strong>
              <span>{row.source} · {row.attachmentCount} 个文件</span>
            </div>
            <small>{row.policy}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function BatchPrecheckPanel({ products = [], accounts = accountAssetSeeds, onCreateBatch, title = "批次预检" }) {
  const preview = batchPreviewForProducts(products, accounts);
  const queueProducts = preview.rows.filter((row) => row.canQueue).map((row) => row.product);
  if (!products.length) return <p className="selection-muted">暂无可预检 SKU。</p>;
  return (
    <div className="selection-batch-precheck-panel">
      <div className="selection-batch-precheck-summary">
        <div><span>可入队</span><strong>{preview.queueCount}</strong></div>
        <div><span>商品卡拦截</span><strong>{preview.cardBlockedCount}</strong></div>
        <div><span>合规拦截</span><strong>{preview.complianceBlockedCount}</strong></div>
        <div><span>来源拦截</span><strong>{preview.sourceBlockedCount}</strong></div>
        <div><span>账号拦截</span><strong>{preview.accountBlockedCount}</strong></div>
        <div><span>商品卡待核</span><strong>{preview.cardWarnCount}</strong></div>
        <div><span>合规待核</span><strong>{preview.complianceWarnCount}</strong></div>
        <div><span>来源待核</span><strong>{preview.sourceWarnCount}</strong></div>
        <div><span>账号待核</span><strong>{preview.accountWarnCount}</strong></div>
        <div><span>验证阻断</span><strong>{preview.verificationBlockedCount}</strong></div>
        <div><span>验证待核</span><strong>{preview.verificationWarnCount}</strong></div>
        <div><span>验证过期</span><strong>{preview.verificationStaleCount}</strong></div>
        <div><span>待存验证</span><strong>{preview.verificationSaveCount}</strong></div>
        <div><span>素材图</span><strong>{preview.imageCount}</strong></div>
      </div>
      <div className="selection-batch-precheck-title">
        <strong>{title}</strong>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onCreateBatch(queueProducts, { autoStart: false })}
          disabled={!preview.queueCount}
        >
          <ListChecks size={15} />
          <span>{preview.queueCount ? "按预检建草稿" : "暂无可建"}</span>
        </button>
      </div>
      <div className="selection-batch-precheck-list">
        {preview.rows.map((row) => (
          <div className={`selection-batch-precheck-row ${row.tone}`} key={row.product.id}>
            <div>
              <strong>{row.product.sku}</strong>
              <span>{materialPrecheckLabel(row.precheck)} · {productCardPrecheckLabel(row.cardPrecheck)} · {row.compliance.label} · {row.accountFit.label} · {row.assetVerification.label} · {row.accountFit.account?.name || "未匹配账号"} · {row.imageCount} 张素材图</span>
            </div>
            <small>{row.issue}｜{row.action}</small>
            {row.attachments.length ? (
              <div className="selection-batch-precheck-assets">
                {row.attachments.map((attachment) => (
                  <a key={attachment.id || attachment.url} href={attachment.url} target="_blank" rel="noreferrer">{attachment.slotLabel}</a>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function BalancedBatchPlanPanel({ plan, accounts = accountAssetSeeds, onCreateBatch }) {
  const products = plan?.products || [];
  const preview = batchPreviewForProducts(products, accounts);
  const queueProducts = preview.rows.filter((row) => row.canQueue).map((row) => row.product);
  if (!products.length) return <p className="selection-muted">暂无可编排 SKU。</p>;
  return (
    <div className="balanced-batch-plan">
      <div className="balanced-batch-summary">
        <div><span>可建 SKU</span><strong>{preview.queueCount}/{products.length}</strong></div>
        <div><span>账号数</span><strong>{plan.accountCount}</strong></div>
        <div><span>保守脚本</span><strong>{preview.warnCount}</strong></div>
        <div><span>商品卡待核</span><strong>{preview.cardWarnCount}</strong></div>
        <div><span>来源待核</span><strong>{preview.sourceWarnCount}</strong></div>
        <div><span>账号待核</span><strong>{preview.accountWarnCount}</strong></div>
        <div><span>验证待核</span><strong>{preview.verificationWarnCount}</strong></div>
        <div><span>验证过期</span><strong>{preview.verificationStaleCount}</strong></div>
        <div><span>待存验证</span><strong>{preview.verificationSaveCount}</strong></div>
      </div>
      <div className="selection-batch-precheck-title">
        <strong>账号均衡编排</strong>
        <button className="secondary-button" type="button" onClick={() => onCreateBatch(queueProducts, { autoStart: false })} disabled={!preview.queueCount}>
          <ListChecks size={15} />
          <span>{preview.queueCount ? "按预检建草稿" : "暂无可建"}</span>
        </button>
      </div>
      <div className="balanced-batch-list">
        {(plan.rows || []).map((row, index) => {
          const gate = selectionBatchGateForProduct(row.product);
          const accountFit = row.accountFit || accountFitSummaryForProduct(row.product, accounts);
          const assetVerification = assetVerificationGateForProduct(row.product, accountFit);
          const rowTone = accountFit.status === "blocked" || assetVerification.computedStatus === "blocked" ? "bad" : gate.tone === "good" && (accountFit.status === "warn" || assetVerification.status === "warn") ? "warn" : gate.tone;
          return (
            <div className={`balanced-batch-row ${rowTone}`} key={row.product.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{row.product.sku}</strong>
                <small>{accountFit.account?.name || row.account?.name || "未匹配账号"} · {accountFit.label} · {row.stage} · {materialPrecheckLabel(gate.precheck)} · {gate.compliance.label} · {assetVerification.label}</small>
              </div>
            </div>
          );
        })}
      </div>
      {preview.blockedCount ? <p className="balanced-batch-note">已拦截 {preview.blockedCount} 个素材、商品卡、合规、来源、账号或验证未通过 SKU，不进入本批草稿。</p> : null}
      {plan.skipped?.length ? <p className="balanced-batch-note">已按每个账号最多 {plan.perAccountLimit} 个 SKU 控制，本轮暂缓 {plan.skipped.length} 个。</p> : null}
    </div>
  );
}

function ActiveBatchCooldownPanel({ rows = [], navigate, onStartBatch, startingBatchId = "" }) {
  if (!rows.length) return null;
  const draftCount = rows.filter((row) => String(row.currentRecord?.itemStatus || row.currentRecord?.batchStatus || "").toLowerCase() === "draft").length;
  const runningCount = rows.filter((row) => /queued|running|retrying/i.test(String(row.currentRecord?.itemStatus || row.currentRecord?.batchStatus || ""))).length;
  const promptReadyCount = rows.filter((row) => String(row.currentRecord?.itemStatus || "").toLowerCase() === "prompt_ready").length;
  return (
    <div className="panel active-batch-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <Activity size={17} />
            <strong>待回流批次池</strong>
          </div>
          <p>这些 SKU 已有草稿或生成任务，暂时不再进入新批次，先执行、检查或回收数据。</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => navigate("batch")}>
          <ListChecks size={16} />
          <span>去批次</span>
        </button>
      </div>
      <div className="active-batch-summary">
        <div><span>冷却 SKU</span><strong>{rows.length}</strong></div>
        <div><span>草稿</span><strong>{draftCount}</strong></div>
        <div><span>生成中</span><strong>{runningCount}</strong></div>
        <div><span>提示词就绪</span><strong>{promptReadyCount}</strong></div>
      </div>
      <div className="active-batch-list">
        {rows.slice(0, 8).map((row) => {
          const batchId = row.currentRecord?.batchId || "";
          const canStart = canStartSelectionBatchRecord(row.currentRecord);
          const isStarting = startingBatchId && startingBatchId === batchId;
          return (
            <div className="active-batch-row" key={`${row.product.id}-${batchId || row.currentRecord?.itemId || "record"}`}>
              <div>
                <strong>{row.product.sku}</strong>
                <span>{row.currentRecord?.batchName || "选品测品批次"} · {row.currentLabel}</span>
                <small>{row.nextAction} · {formatDate(row.updatedAt)}</small>
              </div>
              <div className="active-batch-actions">
                {canStart ? (
                  <button className="primary-button" type="button" disabled={Boolean(isStarting)} onClick={() => onStartBatch?.(row)}>
                    <Play size={15} />
                    <span>{isStarting ? "启动中" : "启动草稿"}</span>
                  </button>
                ) : null}
                <button className="secondary-button" type="button" onClick={() => navigate(batchTarget(batchId))}>
                  <ListChecks size={15} />
                  <span>批次</span>
                </button>
                <button className="secondary-button" type="button" onClick={() => navigate(productLibraryTarget(row.product.id))}>
                  <ChevronRight size={15} />
                  <span>商品</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewBacklogPanel({ rows = [], navigate }) {
  if (!rows.length) return null;
  const videoCount = rows.filter((row) => row.hasVideo).length;
  const promptCount = rows.filter((row) => row.hasPrompt && !row.hasVideo).length;
  const activeCount = rows.filter((row) => row.hasActive && !row.hasPrompt && !row.hasVideo).length;
  function openReviewImport(targetRows = rows) {
    setReviewImportPrefill(reviewImportTemplateFromRows(targetRows));
    navigate("productLibrary");
  }
  return (
    <div className="panel review-backlog-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <Activity size={17} />
            <strong>待复盘回流队列</strong>
          </div>
          <p>已有批次或生成记录但还没写回复盘指标的 SKU，先完成批次，再导入播放、点击和成交数据。</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => openReviewImport(rows)}>
          <Upload size={16} />
          <span>带入模板</span>
        </button>
      </div>
      <div className="review-backlog-summary">
        <div><span>待回流</span><strong>{rows.length}</strong></div>
        <div><span>有视频</span><strong>{videoCount}</strong></div>
        <div><span>提示词</span><strong>{promptCount}</strong></div>
        <div><span>跑批次</span><strong>{activeCount}</strong></div>
      </div>
      <div className="review-backlog-list">
        {rows.slice(0, 8).map((row) => (
          <div className={`review-backlog-row ${row.hasVideo ? "good" : row.hasPrompt ? "info" : row.hasActive ? "warn" : "muted"}`} key={row.product.id}>
            <div>
              <strong>{row.product.sku}</strong>
              <span>{row.stage} · {row.generationSummary.total || 0} 条记录 · {formatDate(row.updatedAt)}</span>
              <small>{row.reason}</small>
            </div>
            <div className="review-backlog-actions">
              <button className={row.hasActive ? "secondary-button" : "primary-button"} type="button" onClick={() => row.hasActive ? navigate(row.route) : openReviewImport([row])}>
                {row.hasActive ? <ListChecks size={15} /> : <Activity size={15} />}
                <span>{row.action}</span>
              </button>
              <button className="secondary-button" type="button" onClick={() => navigate(productLibraryTarget(row.product.id))}>
                <ChevronRight size={15} />
                <span>商品</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const selectionComplianceRules = [
  {
    title: "AI 生成内容必须可识别",
    source: "网信办等四部门 AI 生成合成内容标识办法",
    sourceUrl: "https://www.cac.gov.cn/2025-03/14/c_1743654684782215.htm",
    detail: "AI 生成的视频、图片、虚拟场景需要显式或隐式标识，不能把 AI 效果包装成真实使用结果。",
    action: "商品素材入库时记录实拍/AI 来源；AI 演示类视频默认进入风险审计。"
  },
  {
    title: "直播选品要核验经营与资质",
    source: "直播电商监督管理办法",
    sourceUrl: "https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2026/art_ce66ea61fcec4583b5dbd677f470088b.html",
    detail: "直播选品服务需要核验实际销售主体、行政许可、强制认证、产品合格证明等信息并留档。",
    action: "账号资产库保留主体资料、授权证据、DOC 版本和发布平台绑定。"
  },
  {
    title: "虚假营销与刷量是高危项",
    source: "市场监管总局直播电商典型案例",
    sourceUrl: "https://www.samr.gov.cn/xw/mtjj/art/2025/art_00200d79bf4a4caea71e1d408688c66a.html",
    detail: "性能、资质、交易信息、经营数据、荣誉、用户评价等夸大或误导宣传是监管重点。",
    action: "商品卡预检拦截无法证明的话术；选品评分降低证据缺失 SKU。"
  },
  {
    title: "价格与健康类话术先证据后放量",
    source: "价格欺诈与直播电商处罚案例",
    sourceUrl: "https://www.chinanews.com/cj/2025/11-28/10523077.shtml",
    detail: "价格比较、限时低价、健康功效、普通食品疾病预防治疗等话术需要更高证据门槛。",
    action: "商品卡明确到手价、活动条件、单位规格；健康/食品类先补资质和禁用词库。"
  }
];

function ComplianceReferencePanel({ riskRows = [] }) {
  const hardStops = riskRows.filter((row) => row.tone === "bad").length;
  const highRisk = riskRows.filter((row) => row.riskLevel === "高").length;
  return (
    <div className="panel compliance-reference-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <BookOpen size={17} />
            <strong>选品风险依据</strong>
          </div>
          <p>把近期监管与平台治理重点翻译成可执行的入库、商品卡、素材和账号资产要求。</p>
        </div>
        <div className="compliance-reference-count">
          <span>当前待审</span>
          <strong>{riskRows.length}</strong>
          <small>{hardStops} 个拦截 / {highRisk} 个高风险</small>
        </div>
      </div>
      <div className="compliance-reference-grid">
        {selectionComplianceRules.map((rule) => (
          <article className="compliance-reference-card" key={rule.title}>
            <div>
              <strong>{rule.title}</strong>
              <span>{rule.detail}</span>
            </div>
            <small>{rule.action}</small>
            <a href={rule.sourceUrl} target="_blank" rel="noreferrer">{rule.source}</a>
          </article>
        ))}
      </div>
    </div>
  );
}

function RiskAuditPanel({ rows = [], navigate }) {
  if (!rows.length) return null;
  const badCount = rows.filter((row) => row.tone === "bad").length;
  const highRiskCount = rows.filter((row) => row.riskLevel === "高").length;
  const cardCount = rows.filter((row) => /商品卡/.test(row.stage) || row.issues.some((issue) => /商品卡|标题|主图|详情|价格|履约|评价/.test(issue))).length;
  return (
    <div className="panel risk-audit-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <ShieldCheck size={17} />
            <strong>风险审计队列</strong>
          </div>
          <p>集中处理高风险品、商品卡承接、资质授权、禁用话术和 AI 伪造效果风险。</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => navigate("productLibrary")}>
          <ShieldCheck size={16} />
          <span>进商品库</span>
        </button>
      </div>
      <div className="risk-audit-summary">
        <div><span>待审</span><strong>{rows.length}</strong></div>
        <div><span>拦截</span><strong>{badCount}</strong></div>
        <div><span>高风险</span><strong>{highRiskCount}</strong></div>
        <div><span>商品卡</span><strong>{cardCount}</strong></div>
      </div>
      <div className="risk-audit-list">
        {rows.slice(0, 8).map((row) => (
          <div className={`risk-audit-row ${row.tone}`} key={row.product.id}>
            <div>
              <strong>{row.product.sku}</strong>
              <span>{row.stage} · {row.riskLevel}风险 · {row.intelligence.decision}</span>
              <small>{row.issues.join(" / ")}</small>
            </div>
            <div className="risk-audit-actions">
              <button className={row.tone === "bad" ? "primary-button" : "secondary-button"} type="button" onClick={() => navigate(row.route)}>
                <ChevronRight size={15} />
                <span>{row.action}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function selectionActionTone(row) {
  if (row?.tone === "bad") return "bad";
  if (row?.tone === "warn") return "warn";
  if (row?.tone === "good") return "good";
  return "muted";
}

function selectionAssetActionForProduct(product, accounts = []) {
  const materialPrecheck = materialPrecheckForProduct(product);
  const cardPrecheck = productCardPrecheck(product);
  const compliance = complianceSummaryForProduct(product);
  const accountFit = accountFitSummaryForProduct(product, accounts);
  const assetVerification = assetVerificationGateForProduct(product, accountFit);
  const researchTask = researchTaskSummaryForProduct(product);
  const account = accountFit.account;
  const generationSummary = product.generationSummary || {};
  const canBatch = canCreateSelectionBatchFromProduct(product);
  let stage = "补资产";
  let action = "打开商品库";
  let reason = product.assetStatus || "先补商品事实、素材和商品卡。";
  let tone = "warn";
  let route = "productLibrary";
  let canCreateBatch = false;
  let priority = Number(product.totalScore || 0) + Math.round(Number(product.assetPercent || 0) / 4);

  if (product.lifecycle === "淘汰") {
    stage = "观察";
    action = "保留记录";
    reason = "已淘汰，不进入本轮生产。";
    tone = "muted";
    priority -= 80;
  } else if (product.lifecycle === "小批量测试") {
    stage = "回收数据";
    action = "看批次";
    reason = generationSummary.latestStep || generationSummary.latestStatus || "已进入小批量测试，先等提示词/视频和数据回流。";
    tone = "warn";
    route = "batch";
    priority += 12;
  } else if (hasActiveSelectionBatch(product)) {
    stage = "待执行";
    action = "看批次";
    reason = activeSelectionBatchReason(product) || "已有草稿或生成任务，先执行/回收后再建下一轮。";
    tone = "warn";
    route = "batch";
    priority += 12;
  } else if (compliance.status === "blocked") {
    stage = "补合规证据";
    action = "合规拦截";
    reason = compliance.action;
    tone = "bad";
    priority += 12;
  } else if (canBatch && accountFit.status === "blocked") {
    stage = "补账号资产";
    action = "账号拦截";
    reason = accountFit.action;
    tone = "bad";
    route = "accountAssets";
    priority += 11;
  } else if (researchTask.status === "blocked") {
    stage = "补调研来源";
    action = "来源拦截";
    reason = researchTask.action;
    tone = "bad";
    priority += 10;
  } else if (cardPrecheck.status === "blocked") {
    stage = "修商品卡";
    action = "补商品卡";
    reason = cardPrecheck.nextGap;
    tone = "bad";
    priority += 8;
  } else if (materialPrecheck.status === "blocked") {
    stage = "补关键素材";
    action = "补素材";
    reason = materialPrecheck.hardIssues[0] || "关键素材未就绪。";
    tone = "bad";
    priority += 6;
  } else if (assetVerification.computedStatus === "blocked") {
    stage = "生成前验证";
    action = "验证拦截";
    reason = assetVerification.primaryAction || assetVerification.summary;
    tone = "bad";
    priority += 9;
  } else if (assetVerification.requiresSave && canBatch) {
    stage = "生成前验证";
    action = "保存验证";
    reason = assetVerification.primaryAction || assetVerification.summary;
    tone = "warn";
    canCreateBatch = true;
    priority += 19;
  } else if (assetVerification.requiresSave) {
    stage = "生成前验证";
    action = "保存验证";
    reason = assetVerification.primaryAction || assetVerification.summary;
    tone = "warn";
    priority += 9;
  } else if (canBatch) {
    stage = product.lifecycle === "放大" ? "放大" : product.lifecycle === "复测" ? "复测" : "测品";
    action = materialPrecheck.status === "warn" || cardPrecheck.status === "warn" || compliance.status === "warn" || accountFit.status === "warn" || researchTask.status === "warn" || assetVerification.status === "warn" ? "建保守草稿" : "建批次草稿";
    reason = compliance.status === "warn"
      ? compliance.action
      : accountFit.status === "warn"
        ? accountFit.action
        : researchTask.status === "warn"
          ? researchTask.action
          : assetVerification.status === "warn"
            ? assetVerification.primaryAction || assetVerification.summary
            : materialPrecheck.warnings[0] || cardPrecheck.warnings?.[0] || `${account?.name || "账号资产"} 可承接，先出 1 条测品草稿。`;
    tone = materialPrecheck.status === "warn" || cardPrecheck.status === "warn" || compliance.status === "warn" || accountFit.status === "warn" || researchTask.status === "warn" || assetVerification.status === "warn" ? "warn" : "good";
    canCreateBatch = true;
    priority += product.lifecycle === "放大" ? 28 : product.lifecycle === "复测" ? 22 : 18;
  } else if (Number(product.assetPercent || 0) >= 78) {
    stage = "待确认";
    action = "标记可测";
    reason = "资产基本就绪，人工确认后进入测品。";
    tone = "warn";
    priority += 10;
  }

  return {
    product,
    account,
    accountFit,
    assetVerification,
    materialPrecheck,
    cardPrecheck,
    compliance,
    researchTask,
    generationSummary,
    stage,
    action,
    reason,
    tone,
    route,
    canCreateBatch,
    priority
  };
}

function buildSelectionAssetCommandCenter(products = [], accounts = []) {
  const rows = products.map((product) => selectionAssetActionForProduct(product, accounts))
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore);
  const readyRows = rows.filter((row) => row.canCreateBatch);
  const blockedRows = rows.filter((row) => row.materialPrecheck.status === "blocked" || row.cardPrecheck.status === "blocked" || row.compliance.status === "blocked" || row.accountFit?.status === "blocked" || row.researchTask?.status === "blocked");
  const warnRows = rows.filter((row) => row.canCreateBatch && (row.materialPrecheck.status === "warn" || row.cardPrecheck.status === "warn" || row.compliance.status === "warn" || row.accountFit?.status === "warn" || row.researchTask?.status === "warn"));
  const testedRows = rows.filter((row) => Number(row.generationSummary.total || 0) > 0 || row.product.lifecycle === "小批量测试");
  const cooldownRows = buildActiveBatchCooldownRows(rows);
  const reviewBacklogRows = buildReviewBacklogRows(rows);
  const riskAuditRows = buildRiskAuditRows(rows);
  const sourceAuditRows = buildResearchSourceAuditRows(rows);
  const blockerQueue = buildSelectionBlockerQueue(rows, accounts);
  const batchPlan = buildBalancedSelectionBatchPlan(readyRows, { limit: 6, perAccountLimit: 2 });
  return {
    rows,
    readyRows,
    blockedRows,
    warnRows,
    testedRows,
    cooldownRows,
    reviewBacklogRows,
    riskAuditRows,
    sourceAuditRows,
    blockerQueue,
    topRows: rows.filter((row) => row.product.lifecycle !== "淘汰").slice(0, 8),
    batchPlan,
    firstBatch: batchPlan.rows.map((row) => row.product)
  };
}

function batchRecordUpdatedAt(record = {}) {
  return new Date(record.updatedAt || record.batchUpdatedAt || record.createdAt || record.batchCreatedAt || 0).getTime() || 0;
}

function latestActiveSelectionBatchRecord(product = {}) {
  const records = activeSelectionBatchRecords(product);
  if (!records.length) return null;
  return [...records].sort((a, b) => batchRecordUpdatedAt(b) - batchRecordUpdatedAt(a))[0] || null;
}

function activeSelectionBatchTarget(product = {}) {
  return batchTarget(latestActiveSelectionBatchRecord(product)?.batchId);
}

function buildActiveBatchCooldownRows(rows = []) {
  return (rows || [])
    .map((row) => {
      const activeRecords = activeSelectionBatchRecords(row.product);
      if (!activeRecords.length) return null;
      const sortedRecords = [...activeRecords].sort((a, b) => batchRecordUpdatedAt(b) - batchRecordUpdatedAt(a));
      const current = sortedRecords[0] || {};
      return {
        ...row,
        activeRecords: sortedRecords,
        currentRecord: current,
        currentLabel: generationStatusLabel(current),
        nextAction: activeSelectionBatchNextAction(current),
        updatedAt: current.updatedAt || current.batchUpdatedAt || current.createdAt || current.batchCreatedAt || "",
        priority: batchRecordUpdatedAt(current)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore);
}

function buildReviewBacklogRows(rows = []) {
  return (rows || [])
    .filter((row) => Number(row.generationSummary?.total || 0) > 0 && !row.product.reviewMetrics)
    .map((row) => {
      const activeRecord = latestActiveSelectionBatchRecord(row.product);
      const summary = row.generationSummary || {};
      const records = Array.isArray(row.product.generationRecords) ? row.product.generationRecords : [];
      const latestRecord = [...records].sort((a, b) => batchRecordUpdatedAt(b) - batchRecordUpdatedAt(a))[0] || {};
      const hasVideo = Number(summary.videoCount || 0) > 0 || records.some((record) => record.videoUrl || record.itemStatus === "succeeded");
      const hasPrompt = Number(summary.promptReadyCount || 0) > 0 || records.some((record) => record.finalPromptReady || record.itemStatus === "prompt_ready");
      const hasActive = Boolean(activeRecord);
      const stage = hasVideo
        ? "可复盘"
        : hasPrompt
          ? "查提示词"
          : hasActive
            ? "先完成批次"
            : "查结果";
      const action = hasActive ? "看批次" : "填复盘";
      const route = hasActive ? batchTarget(activeRecord.batchId) : productLibraryTarget(row.product.id);
      const reason = hasVideo
        ? "已有视频结果，补播放、点击、成交和退货数据。"
        : hasPrompt
          ? "提示词已出，先确认是否提交视频或导入平台数据。"
          : hasActive
            ? activeSelectionBatchNextAction(activeRecord)
            : "已有批次记录但未形成复盘指标。";
      const priority = (hasVideo ? 40 : hasPrompt ? 30 : hasActive ? 20 : 10) + batchRecordUpdatedAt(latestRecord) / 100000000000;
      return {
        ...row,
        activeRecord,
        latestRecord,
        hasVideo,
        hasPrompt,
        hasActive,
        stage,
        action,
        route,
        reason,
        updatedAt: latestRecord.updatedAt || latestRecord.batchUpdatedAt || latestRecord.createdAt || latestRecord.batchCreatedAt || "",
        priority
      };
    })
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore);
}

function buildRiskAuditRows(rows = []) {
  return (rows || [])
    .map((row) => {
      const product = row.product || {};
      const intelligence = buildProductIntelligence(product);
      const materialPrecheck = row.materialPrecheck || materialPrecheckForProduct(product);
      const cardPrecheck = row.cardPrecheck || productCardPrecheck(product);
      const hardRules = intelligence.hardRules || [];
      const complianceFindings = intelligence.complianceFindings || complianceFindingsForProduct(product);
      const riskLevel = String(product.riskLevel || "中");
      const bannedWords = Array.isArray(product.bannedWords) ? product.bannedWords : [];
      const score = product.scores || {};
      const issues = [];
      let priority = 0;
      let stage = "风险待核";
      let action = "查看风险";
      let tone = "warn";

      if (riskLevel === "高") {
        issues.push("高风险 SKU");
        priority += 42;
      } else if (riskLevel === "中") {
        priority += 10;
      }
      if (hardRules.length) {
        issues.push(...hardRules.map((rule) => rule.label));
        priority += hardRules.length * 12;
      }
      const blockingCompliance = complianceFindings.filter((finding) => finding.severity === "block");
      const warningCompliance = complianceFindings.filter((finding) => finding.severity === "warn");
      if (blockingCompliance.length) {
        issues.push(...blockingCompliance.map((finding) => finding.label));
        priority += blockingCompliance.length * 18;
        stage = "合规拦截";
        action = "补证据";
        tone = "bad";
      }
      if (warningCompliance.length) {
        issues.push(...warningCompliance.map((finding) => finding.label));
        priority += warningCompliance.length * 8;
        if (tone !== "bad") {
          stage = "合规待核";
          action = "核口径";
        }
      }
      if (materialPrecheck.status === "blocked") {
        issues.push(materialPrecheck.hardIssues[0] || "素材预检拦截");
        priority += 34;
        stage = "素材/凭证拦截";
        action = "补凭证";
        tone = "bad";
      } else if (materialPrecheck.status === "warn") {
        issues.push(materialPrecheck.warnings[0] || "素材待补");
        priority += 12;
      }
      if (cardPrecheck.status === "blocked") {
        issues.push(cardPrecheck.nextGap);
        priority += 30;
        stage = "商品卡拦截";
        action = "修商品卡";
        tone = "bad";
      } else if (cardPrecheck.status === "warn") {
        issues.push(cardPrecheck.nextGap);
        priority += 14;
        if (tone !== "bad") {
          stage = "商品卡待核";
          action = "核商品卡";
        }
      }
      if ((riskLevel === "高" || hardRules.length >= 2) && !bannedWords.length) {
        issues.push("禁用话术待补");
        priority += 12;
      }
      if (Number(score.compliance || 0) > 0 && Number(score.compliance || 0) < 8) {
        issues.push("合规评分偏低");
        priority += 10;
      }
      if (product.lifecycle === "放大" && (riskLevel !== "低" || materialPrecheck.status !== "pass" || cardPrecheck.status !== "pass")) {
        issues.push("放大前需复核");
        priority += 24;
      }
      const uniqueIssues = [...new Set(issues.filter(Boolean))].slice(0, 5);
      if (!uniqueIssues.length) return null;
      if (tone !== "bad" && intelligence.tone === "good" && riskLevel === "低") tone = "muted";
      return {
        ...row,
        intelligence,
        hardRules,
        complianceFindings,
        riskLevel,
        issues: uniqueIssues,
        stage,
        action,
        tone,
        priority,
        route: productLibraryTarget(product.id)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore);
}

function buildResearchSourceAuditRows(rows = []) {
  return (rows || [])
    .map((row) => {
      const product = row.product || {};
      const researchTask = row.researchTask || researchTaskSummaryForProduct(product);
      if (!product.id || product.lifecycle === "淘汰" || researchTask.status === "pass") return null;
      const priority = (researchTask.status === "blocked" ? 72 : 34)
        + Number(product.totalScore || 0) / 5
        + (researchTask.needsRuleSource ? 16 : 0);
      return {
        ...row,
        researchTask,
        stage: researchTask.status === "blocked" ? "来源拦截" : "来源待核",
        action: researchTask.status === "blocked" ? "补规则/资质来源" : "补外部来源",
        issues: [researchTask.label, researchTask.evidence, researchTask.action].filter(Boolean).slice(0, 4),
        tone: researchTask.tone,
        priority,
        route: productLibraryTarget(product.id)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore);
}

function selectionBlockerItem({ kind, label, tone, issue, action, owner, route, weight }) {
  return {
    kind,
    label,
    tone,
    issue,
    action,
    owner,
    route,
    weight
  };
}

function buildSelectionBlockerQueue(rows = [], accounts = []) {
  const lifecycleAllowed = new Set(["可测", "复测", "放大"]);
  return (rows || [])
    .map((row) => {
      const product = row.product || {};
      if (!product.id || product.lifecycle === "淘汰") return null;
      const gate = selectionBatchGateForProduct(product);
      const materialPrecheck = row.materialPrecheck || gate.precheck || materialPrecheckForProduct(product);
      const cardPrecheck = row.cardPrecheck?.fieldResults?.length ? row.cardPrecheck : productCardPrecheck(product);
      const compliance = row.compliance || gate.compliance || complianceSummaryForProduct(product);
      const researchTask = row.researchTask || gate.researchTask || researchTaskSummaryForProduct(product);
      const accountFit = row.accountFit || accountFitSummaryForProduct(product, accounts);
      const assetVerification = row.assetVerification || assetVerificationGateForProduct(product, accountFit);
      const hasActiveBatch = hasActiveSelectionBatch(product);
      const items = [];

      if (hasActiveBatch) {
        items.push(selectionBlockerItem({
          kind: "批次",
          label: "待回流",
          tone: "warn",
          issue: activeSelectionBatchReason(product) || "已有测品批次未回流",
          action: activeSelectionBatchNextAction(latestActiveSelectionBatchRecord(product) || {}),
          owner: "发布与回收",
          route: activeSelectionBatchTarget(product),
          weight: 52
        }));
      } else if (!lifecycleAllowed.has(product.lifecycle)) {
        items.push(selectionBlockerItem({
          kind: "生命周期",
          label: "不可建批次",
          tone: "warn",
          issue: "当前生命周期不在可测、复测或放大状态",
          action: "先补齐资产或人工调整 SKU 状态，再进入测品批次。",
          owner: "选品负责人",
          route: productLibraryTarget(product.id),
          weight: 58
        }));
      }

      if (compliance.status === "blocked" || compliance.status === "warn") {
        items.push(selectionBlockerItem({
          kind: "合规",
          label: compliance.label || (compliance.status === "blocked" ? "合规拦截" : "合规待核"),
          tone: compliance.status === "blocked" ? "bad" : "warn",
          issue: compliance.primary || "合规风险待复核",
          action: compliance.action || "补资质、授权、禁用话术或平台规则来源。",
          owner: "选品/商家资质",
          route: productLibraryTarget(product.id),
          weight: compliance.status === "blocked" ? 112 : 72
        }));
      }

      if (materialPrecheck.status === "blocked" || materialPrecheck.status === "warn") {
        items.push(selectionBlockerItem({
          kind: "素材",
          label: materialPrecheckLabel(materialPrecheck),
          tone: materialPrecheck.status === "blocked" ? "bad" : "warn",
          issue: materialPrecheck.hardIssues?.[0] || materialPrecheck.warnings?.[0] || "素材证据待补",
          action: materialPrecheck.status === "blocked" ? "先补真实素材、资质截图或商品卡截图，再生成。" : "可保守建草稿，但脚本必须避开未核实信息。",
          owner: "素材采集",
          route: productLibraryTarget(product.id),
          weight: materialPrecheck.status === "blocked" ? 104 : 66
        }));
      }

      if (cardPrecheck.status === "blocked" || cardPrecheck.status === "warn") {
        items.push(selectionBlockerItem({
          kind: "商品卡",
          label: productCardPrecheckLabel(cardPrecheck),
          tone: cardPrecheck.status === "blocked" ? "bad" : "warn",
          issue: cardPrecheck.nextGap || "商品卡承接字段待补",
          action: cardPrecheck.status === "blocked" ? "先补商品卡标题、主图、详情或履约字段。" : "先套保守草稿并人工核商品卡事实。",
          owner: "商品卡核验",
          route: productLibraryTarget(product.id),
          weight: cardPrecheck.status === "blocked" ? 108 : 68
        }));
      }

      if (researchTask.status === "blocked" || researchTask.status === "warn") {
        items.push(selectionBlockerItem({
          kind: "来源",
          label: researchTask.label || (researchTask.status === "blocked" ? "来源拦截" : "来源待核"),
          tone: researchTask.status === "blocked" ? "bad" : "warn",
          issue: researchTask.evidence || researchTask.label || "调研来源待补",
          action: researchTask.action || "补平台规则、商品资质或外部验证来源。",
          owner: "选品调研",
          route: productLibraryTarget(product.id),
          weight: researchTask.status === "blocked" ? 100 : 64
        }));
      }

      if (accountFit.status === "blocked" || accountFit.status === "warn") {
        items.push(selectionBlockerItem({
          kind: "账号",
          label: accountFit.label || (accountFit.status === "blocked" ? "账号拦截" : "账号待核"),
          tone: accountFit.status === "blocked" ? "bad" : "warn",
          issue: accountFit.primary || "账号承接边界待核",
          action: accountFit.action || "补账号 DOC 包、推荐 SKU、禁做边界或平台绑定。",
          owner: "账号资产",
          route: accountAssetsTarget(accountFit.account?.id),
          weight: accountFit.status === "blocked" ? 96 : 60
        }));
      }

      if (assetVerification.status === "blocked" || assetVerification.requiresSave) {
        items.push(selectionBlockerItem({
          kind: "验证",
          label: assetVerification.label,
          tone: assetVerification.status === "blocked" ? "bad" : "warn",
          issue: assetVerification.summary,
          action: assetVerification.primaryAction,
          owner: "项目统筹",
          route: productLibraryTarget(product.id),
          weight: assetVerification.status === "blocked" ? 118 : 62
        }));
      }

      if (!items.length) return null;
      const sortedItems = [...items].sort((a, b) => b.weight - a.weight);
      const primary = sortedItems[0];
      const blockedCount = items.filter((item) => item.tone === "bad").length;
      const warnCount = items.filter((item) => item.tone === "warn").length;
      const canQueue = gate.canQueue && cardPrecheck.status !== "blocked" && accountFit.status !== "blocked" && assetVerification.computedStatus !== "blocked" && !hasActiveBatch;
      const tone = blockedCount ? "bad" : canQueue ? "warn" : primary.tone;
      return {
        ...row,
        product,
        materialPrecheck,
        cardPrecheck,
        compliance,
        researchTask,
        accountFit,
        assetVerification,
        items: sortedItems,
        primary,
        blockedCount,
        warnCount,
        canQueue,
        statusLabel: blockedCount ? "准入拦截" : canQueue ? "可保守建批次" : "待处理",
        route: primary.route,
        tone,
        priority: primary.weight + blockedCount * 24 + warnCount * 8 + Number(product.totalScore || 0) / 5
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore);
}

function buildBalancedSelectionBatchPlan(rows = [], { limit = 6, perAccountLimit = 2 } = {}) {
  const sorted = (rows || [])
    .filter((row) => row?.canCreateBatch && row.materialPrecheck?.status !== "blocked" && row.cardPrecheck?.status !== "blocked" && row.accountFit?.status !== "blocked")
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore);
  const selected = [];
  const selectedIds = new Set();
  const accountCounts = new Map();

  function addRow(row, cap) {
    if (!row?.product?.id || selectedIds.has(row.product.id)) return false;
    const accountId = row.account?.id || "unmatched";
    const currentCount = accountCounts.get(accountId) || 0;
    if (currentCount >= cap) return false;
    selected.push(row);
    selectedIds.add(row.product.id);
    accountCounts.set(accountId, currentCount + 1);
    return true;
  }

  for (const cap of [1, perAccountLimit]) {
    for (const row of sorted) {
      if (selected.length >= limit) break;
      addRow(row, cap);
    }
    if (selected.length >= limit) break;
  }

  const skipped = sorted.filter((row) => !selectedIds.has(row.product.id));
  const accountSummary = selected.map((row) => ({
    accountId: row.account?.id || "unmatched",
    accountName: row.account?.name || "未匹配账号",
    sku: row.product.sku,
    stage: row.stage,
    tone: row.tone,
    precheck: row.materialPrecheck.status
  }));
  return {
    rows: selected,
    products: selected.map((row) => row.product),
    skipped,
    accountSummary,
    warnCount: selected.filter((row) => row.materialPrecheck.status === "warn" || row.cardPrecheck.status === "warn" || row.accountFit?.status === "warn" || row.researchTask?.status === "warn").length,
    accountCount: new Set(accountSummary.map((item) => item.accountId)).size,
    limit,
    perAccountLimit
  };
}

function launchReadinessWarningLabels(row = {}, verification = {}) {
  const warnings = [];
  if (row.materialPrecheck?.status === "warn") warnings.push("素材待核");
  if (row.cardPrecheck?.status === "warn") warnings.push("商品卡待核");
  if (row.compliance?.status === "warn") warnings.push("合规待核");
  if (row.accountFit?.status === "warn") warnings.push("账号待核");
  if (row.researchTask?.status === "warn") warnings.push("来源待核");
  if (verification.status === "warn" && !verification.requiresSave) warnings.push("验证待核");
  if (verification.requiresSave) warnings.push("验证待保存");
  return [...new Set(warnings)];
}

function buildLaunchReadinessAudit(command = {}, accounts = accountAssetSeeds) {
  const plan = command.batchPlan || buildBalancedSelectionBatchPlan(command.readyRows || [], { limit: 6, perAccountLimit: 2 });
  const rows = (plan.rows || []).map((row, index) => {
    const accountFit = row.accountFit || accountFitSummaryForProduct(row.product, accounts);
    const verification = row.assetVerification || assetVerificationGateForProduct(row.product, accountFit);
    const warnings = launchReadinessWarningLabels(row, verification);
    const status = verification.computedStatus === "blocked"
      ? "blocked"
      : verification.requiresSave
        ? "save"
        : warnings.length
          ? "warn"
          : "ready";
    return {
      ...row,
      index,
      accountFit,
      assetVerification: verification,
      launchWarnings: warnings,
      launchStatus: status,
      launchLabel: status === "blocked" ? "验证阻断" : status === "save" ? "待保存验证" : status === "warn" ? "保守启动" : "可启动",
      tone: status === "blocked" ? "bad" : status === "ready" ? "good" : "warn"
    };
  });
  const blockedRows = rows.filter((row) => row.launchStatus === "blocked");
  const saveRows = rows.filter((row) => row.launchStatus === "save");
  const warnRows = rows.filter((row) => row.launchStatus === "warn");
  const accountCount = new Set(rows.map((row) => row.account?.id || row.accountFit?.account?.id || "未匹配")).size;
  const averageScore = rows.length
    ? Math.round(rows.reduce((total, row) => total + Number(row.product?.totalScore || 0), 0) / rows.length)
    : 0;
  const blockerFallback = (command.blockerQueue || []).find((row) => row.blockedCount > 0) || (command.blockerQueue || [])[0] || null;
  let status = "可启动首批";
  let tone = "good";
  let action = "建立首批测品草稿，按 1 个 SKU 至少 3 条脚本进入回流。";
  let summary = `${rows.length} 个 SKU 已纳入首批计划，账号覆盖 ${accountCount} 个，均分 ${averageScore}。`;

  if (!rows.length) {
    status = "未形成首批";
    tone = "bad";
    action = blockerFallback?.primary?.action || "先处理准入拦截队列，形成至少 3 个可测 SKU。";
    summary = blockerFallback
      ? `当前没有可启动 SKU，优先处理 ${blockerFallback.product?.sku || "SKU"}：${blockerFallback.primary?.issue || blockerFallback.primaryReason || "准入缺口"}。`
      : "当前商品池还没有形成可启动 SKU。";
  } else if (blockedRows.length) {
    status = "验证阻断";
    tone = "bad";
    action = blockedRows[0].assetVerification.primaryAction || "先补生成前验证阻断项。";
    summary = `${blockedRows.length} 个首批 SKU 仍被生成前验证阻断。`;
  } else if (rows.length < 3) {
    status = "样本不足";
    tone = "warn";
    action = "建议至少凑齐 3 个 SKU 或 9 条脚本后再启动首批测品。";
    summary = `当前只有 ${rows.length} 个 SKU 可入首批，样本偏少。`;
  } else if (saveRows.length) {
    status = "待保存验证";
    tone = "warn";
    action = "建批次会自动保存生成前验证，也可先在验证队列批量保存。";
    summary = `${saveRows.length} 个 SKU 需要保存生成前验证后再留下可追溯批次记录。`;
  } else if (warnRows.length) {
    status = "可保守启动";
    tone = "warn";
    action = "可以建保守草稿，但脚本只写商品卡和素材已核实的信息。";
    summary = `${warnRows.length} 个 SKU 有待核项，适合小样本保守测试。`;
  }

  return {
    status,
    tone,
    action,
    summary,
    rows,
    blockedRows,
    saveRows,
    warnRows,
    accountCount,
    averageScore,
    targetSize: 3,
    limit: plan.limit || 6,
    perAccountLimit: plan.perAccountLimit || 2,
    canCreateBatch: rows.length > 0 && !blockedRows.length,
    blockerFallback
  };
}

function launchReadinessAuditText(audit = {}) {
  const lines = [
    `首批测品就绪审计（${new Date().toLocaleString("zh-CN", { hour12: false })}）`,
    `结论：${audit.status || "待审"}`,
    `摘要：${audit.summary || ""}`,
    `下一步：${audit.action || ""}`,
    `首批 SKU：${audit.rows?.length || 0} / 账号覆盖：${audit.accountCount || 0} / 均分：${audit.averageScore || 0}`,
    ""
  ];
  if (!audit.rows?.length && audit.blockerFallback) {
    lines.push(`优先阻断：${audit.blockerFallback.product?.sku || "SKU"}｜${audit.blockerFallback.primary?.kind || "准入"}｜${audit.blockerFallback.primary?.issue || ""}｜${audit.blockerFallback.primary?.action || ""}`);
  }
  (audit.rows || []).forEach((row, index) => {
    lines.push(`${index + 1}. ${row.product?.sku || "未命名 SKU"}｜${row.launchLabel}｜${row.product?.totalScore || 0} 分｜账号：${row.account?.name || row.accountFit?.account?.name || "未匹配"}｜${row.launchWarnings?.join("、") || "无待核项"}｜下一步：${row.assetVerification?.requiresSave ? row.assetVerification.primaryAction : row.reason}`);
  });
  return lines.join("\n");
}

function downloadLaunchReadinessAudit(audit = {}) {
  const headers = ["序号", "SKU", "类目", "生命周期", "总分", "首批状态", "账号", "待核项", "生成前验证", "下一步"];
  const rows = (audit.rows || []).map((row, index) => [
    index + 1,
    row.product?.sku || "",
    row.product?.category || "",
    row.product?.lifecycle || "",
    row.product?.totalScore || "",
    row.launchLabel || "",
    row.account?.name || row.accountFit?.account?.name || "",
    row.launchWarnings?.join("；") || "",
    row.assetVerification?.label || "",
    row.assetVerification?.requiresSave ? row.assetVerification.primaryAction : row.reason || ""
  ]);
  if (!rows.length && audit.blockerFallback) {
    rows.push([
      1,
      audit.blockerFallback.product?.sku || "",
      audit.blockerFallback.product?.category || "",
      audit.blockerFallback.product?.lifecycle || "",
      audit.blockerFallback.product?.totalScore || "",
      "未形成首批",
      audit.blockerFallback.accountFit?.account?.name || "",
      audit.blockerFallback.primary?.kind || "",
      audit.status || "",
      audit.blockerFallback.primary?.action || audit.action || ""
    ]);
  }
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "首批测品就绪审计.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function assetTaskPriority(product, weight = 0, isBlocked = false) {
  return Math.round(Number(product.totalScore || 0) + Number(weight || 0) + (isBlocked ? 90 : 45) + Math.max(0, 90 - Number(product.assetPercent || 0)) / 2);
}

function buildSelectionAssetTasks(command) {
  const tasks = [];
  const rows = command?.rows || [];
  for (const row of rows) {
    const product = row.product || {};
    if (!product.id || product.lifecycle === "淘汰") continue;
    const checklist = product.assetChecklist || normalizeMaterialChecklist(product);
    const cardPrecheck = row.cardPrecheck?.fieldResults?.length ? row.cardPrecheck : productCardPrecheck(product);
    for (const field of cardPrecheck.fieldResults || []) {
      if (field.status === "pass") continue;
      tasks.push({
        id: `${product.id}-card-${field.key}`,
        kind: "cardField",
        cardKey: field.key,
        product,
        account: row.account,
        type: "商品卡",
        title: `${field.shortLabel}：${field.value || "未填写"}`,
        detail: field.status === "blocked" ? "会阻断生成，先补齐再测。" : "可建保守草稿，但脚本必须避开未核信息。",
        evidence: field.placeholder || field.label,
        status: field.status === "blocked" ? "阻断" : "待核",
        tone: field.status === "blocked" ? "bad" : "warn",
        priority: assetTaskPriority(product, 22, field.status === "blocked")
      });
    }
    for (const slot of checklist) {
      if (!["待补", "禁用"].includes(slot.status)) continue;
      tasks.push({
        id: `${product.id}-slot-${slot.id}`,
        kind: "materialSlot",
        slotId: slot.id,
        product,
        account: row.account,
        type: slot.id === "compliance-proof" ? "合规凭证" : slot.id === "product-card" ? "商品卡截图" : "素材",
        title: slot.label,
        detail: slot.note || slot.requirement,
        evidence: slot.requirement,
        status: slot.status,
        tone: slot.status === "禁用" ? "bad" : "warn",
        priority: assetTaskPriority(product, Number(slot.weight || 0), slot.status === "禁用" || slot.id === "compliance-proof")
      });
    }
    if (row.accountFit?.status && row.accountFit.status !== "pass") {
      tasks.push({
        id: `${product.id}-account-fit`,
        kind: "accountFit",
        product,
        account: row.accountFit.account,
        type: "账号资产",
        title: row.accountFit.label,
        detail: row.accountFit.action,
        evidence: row.accountFit.account
          ? `${row.accountFit.account.name} / ${row.accountFit.strength}`
          : "补账号定位、适合类目、场景或推荐 SKU",
        status: row.accountFit.status === "blocked" ? "阻断" : "待核",
        tone: row.accountFit.tone,
        priority: assetTaskPriority(product, 24, row.accountFit.status === "blocked")
      });
    }
    const researchTask = row.researchTask || researchTaskSummaryForProduct(product);
    if (researchTask.status && researchTask.status !== "pass") {
      tasks.push({
        id: `${product.id}-research-source`,
        kind: "researchSource",
        product,
        account: row.account,
        type: "调研来源",
        title: researchTask.label,
        detail: researchTask.action,
        evidence: researchTask.evidence,
        status: researchTask.status === "blocked" ? "阻断" : "待核",
        tone: researchTask.tone,
        priority: assetTaskPriority(product, 18, researchTask.status === "blocked")
      });
    }
    if (!checklist.some((slot) => ["待补", "禁用"].includes(slot.status)) && row.materialPrecheck?.warnings?.length) {
      tasks.push({
        id: `${product.id}-precheck-warning`,
        kind: "precheckWarning",
        product,
        account: row.account,
        type: "预检提示",
        title: row.materialPrecheck.warnings[0],
        detail: "可先建保守草稿，脚本不要展示未证实效果。",
        evidence: "生成预检",
        status: "待核",
        tone: "warn",
        priority: assetTaskPriority(product, 10, false)
      });
    }
  }
  return tasks
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore)
    .slice(0, 40);
}

function selectionAssetTaskText(tasks = []) {
  return tasks.map((task, index) => {
    const evidence = buildProductEvidencePack(task.product, task.account);
    return [
      `${index + 1}. ${task.product.sku}`,
      `任务：${task.type} / ${task.title}`,
      `原因：${task.detail || task.evidence}`,
      `调研来源：${evidence.researchTask?.label || evidence.research?.label || "来源待核"}${evidence.researchTask?.status === "pass" ? "" : ` / ${evidence.researchTask?.action || "待补"}`}`,
      `账号适配：${evidence.accountFit?.label || "账号适配待核"}${evidence.accountFit?.status === "pass" ? "" : ` / ${evidence.accountFit?.action || "待补"}`}`,
      `证据包：${evidence.label}${evidence.status === "pass" ? "" : ` / ${evidence.primaryAction}`}`,
      `账号：${task.account?.name || "未匹配"}`,
      `状态：${task.status}`
    ].join("\n");
  }).join("\n\n");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dailyExecutionStorageKey() {
  return `${dailyExecutionDoneStorageKey}:${localDayKey()}`;
}

function dailyExecutionRowKey(row = {}) {
  return [row.lane, row.sku, row.action, row.target || row.detail || ""].map((item) => String(item || "").trim()).join("|");
}

function readDailyExecutionDoneMap() {
  try {
    const saved = JSON.parse(localStorage.getItem(dailyExecutionStorageKey()) || "{}");
    return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
}

function writeDailyExecutionDoneMap(doneMap = {}) {
  localStorage.setItem(dailyExecutionStorageKey(), JSON.stringify(doneMap));
}

function dailyEvidenceFields(product = {}, account = {}) {
  const evidencePack = buildProductEvidencePack(product, account);
  const accountFit = evidencePack.accountFit || accountFitSummaryForProduct(product, account?.id ? [account] : []);
  const researchTask = evidencePack.researchTask || researchTaskSummaryForProduct(product);
  const assetPlan = buildAssetCompletionPlan(product);
  return {
    accountLabel: accountFit.label,
    accountAction: accountFit.status === "pass" ? "" : accountFit.action,
    researchLabel: researchTask.label,
    researchAction: researchTask.status === "pass" ? "" : researchTask.action,
    assetPlanLabel: assetPlan.label,
    assetPlanAction: assetPlan.status === "可用" ? "" : assetPlan.summary,
    evidenceLabel: evidencePack.label,
    evidenceAction: evidencePack.status === "pass" ? "" : evidencePack.primaryAction
  };
}

function dailyExecutionRows(command = {}, assetTasks = []) {
  const rows = [];
  for (const row of (command.blockerQueue || []).slice(0, 6)) {
    const compliance = row.compliance || complianceSummaryForProduct(row.product);
    const complianceAction = compliance.status === "pass" ? "" : compliance.action;
    const evidence = dailyEvidenceFields(row.product, row.account);
    rows.push({
      lane: "准入拦截",
      sku: row.product.sku,
      action: row.canQueue ? "可保守建批次" : row.primary.action,
      detail: `${row.primary.kind}：${row.primary.issue}`,
      target: row.primary.owner,
      complianceLabel: compliance.label,
      complianceAction,
      ...evidence,
      priority: row.blockedCount ? "高" : "中",
      tone: row.tone,
      route: row.route || productLibraryTarget(row.product.id)
    });
  }
  const manualHandoffRows = buildManualBlockerHandoffGroups(command.blockerQueue)
    .flatMap((group) => group.items.slice(0, 3).map((entry) => ({ ...entry, owner: group.owner })))
    .sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore)
    .slice(0, 8);
  for (const entry of manualHandoffRows) {
    const compliance = entry.row.compliance || complianceSummaryForProduct(entry.product);
    const complianceAction = compliance.status === "pass" ? "" : compliance.action;
    const evidence = dailyEvidenceFields(entry.product, entry.row.account);
    rows.push({
      lane: "人工分派",
      sku: entry.product.sku,
      action: `${entry.owner}：${entry.item.action}`,
      detail: `${entry.item.kind}：${entry.item.issue}`,
      target: entry.item.label,
      complianceLabel: compliance.label,
      complianceAction,
      ...evidence,
      priority: entry.item.tone === "bad" ? "高" : "中",
      tone: entry.item.tone || "warn",
      route: entry.route
    });
  }
  for (const row of (command.riskAuditRows || []).slice(0, 6)) {
    const compliance = row.compliance || complianceSummaryForProduct(row.product);
    const complianceAction = compliance.status === "pass" ? "" : compliance.action;
    const evidence = dailyEvidenceFields(row.product, row.account);
    rows.push({
      lane: "风险审计",
      sku: row.product.sku,
      action: row.action,
      detail: row.issues.join(" / "),
      target: row.stage,
      complianceLabel: compliance.label,
      complianceAction,
      ...evidence,
      priority: row.tone === "bad" ? "高" : "中",
      tone: row.tone === "bad" ? "bad" : "warn",
      route: row.route || productLibraryTarget(row.product.id)
    });
  }
  for (const row of (command.sourceAuditRows || []).slice(0, 4)) {
    const compliance = row.compliance || complianceSummaryForProduct(row.product);
    const complianceAction = compliance.status === "pass" ? "" : compliance.action;
    const evidence = dailyEvidenceFields(row.product, row.account);
    rows.push({
      lane: "来源审计",
      sku: row.product.sku,
      action: row.action,
      detail: row.researchTask?.action || row.issues.join(" / "),
      target: row.researchTask?.evidence || row.stage,
      complianceLabel: compliance.label,
      complianceAction,
      ...evidence,
      priority: row.researchTask?.status === "blocked" ? "高" : "中",
      tone: row.tone || "warn",
      route: row.route || productLibraryTarget(row.product.id)
    });
  }
  for (const task of (assetTasks || []).filter((item) => item.kind !== "researchSource").slice(0, 8)) {
    const compliance = complianceSummaryForProduct(task.product);
    const complianceAction = compliance.status === "pass" ? "" : compliance.action;
    const evidence = dailyEvidenceFields(task.product, task.account);
    rows.push({
      lane: "补资产",
      sku: task.product.sku,
      action: task.title,
      detail: task.detail,
      target: task.evidence,
      complianceLabel: compliance.label,
      complianceAction,
      ...evidence,
      priority: task.tone === "bad" ? "高" : task.tone === "warn" ? "中" : "低",
      tone: task.tone || "warn",
      route: productLibraryTarget(task.product.id)
    });
  }
  for (const row of (command.cooldownRows || []).slice(0, 6)) {
    const batchId = row.currentRecord?.batchId || "";
    const compliance = row.compliance || complianceSummaryForProduct(row.product);
    const complianceAction = compliance.status === "pass" ? "" : compliance.action;
    const evidence = dailyEvidenceFields(row.product, row.account);
    rows.push({
      lane: "待回流批次",
      sku: row.product.sku,
      action: row.nextAction,
      detail: `${row.currentRecord?.batchName || "选品测品批次"} · ${row.currentLabel}`,
      target: batchId,
      complianceLabel: compliance.label,
      complianceAction,
      ...evidence,
      priority: String(row.currentRecord?.itemStatus || row.currentRecord?.batchStatus || "").toLowerCase() === "draft" ? "高" : "中",
      tone: "warn",
      route: batchTarget(batchId)
    });
  }
  for (const row of (command.reviewBacklogRows || []).slice(0, 6)) {
    const compliance = row.compliance || complianceSummaryForProduct(row.product);
    const complianceAction = compliance.status === "pass" ? "" : compliance.action;
    const evidence = dailyEvidenceFields(row.product, row.account);
    rows.push({
      lane: "待复盘",
      sku: row.product.sku,
      action: row.action,
      detail: row.reason,
      target: row.stage,
      complianceLabel: compliance.label,
      complianceAction,
      ...evidence,
      priority: row.hasVideo ? "高" : row.hasPrompt ? "中" : "低",
      tone: row.hasVideo ? "bad" : "warn",
      route: row.route || productLibraryTarget(row.product.id)
    });
  }
  for (const row of (command.batchPlan?.rows || []).slice(0, 6)) {
    const gate = selectionBatchGateForProduct(row.product);
    const complianceAction = gate.compliance.status === "pass" ? "" : gate.compliance.action;
    const evidence = dailyEvidenceFields(row.product, row.account);
    rows.push({
      lane: "第一批草稿",
      sku: row.product.sku,
      action: gate.complianceBlocked ? "补合规证据" : "建批次草稿",
      detail: `${row.account?.name || "未匹配账号"} · ${row.stage} · ${materialPrecheckLabel(gate.precheck)} · ${gate.compliance.label}`,
      target: gate.compliance.status !== "pass" ? gate.compliance.action : row.cardPrecheck?.status === "warn" ? row.cardPrecheck.nextGap : gate.precheck?.warnings?.[0] || "可进入测品",
      complianceLabel: gate.compliance.label,
      complianceAction,
      ...evidence,
      priority: gate.tone === "good" ? "中" : "高",
      tone: gate.tone === "good" ? "good" : gate.tone === "bad" ? "bad" : "warn",
      route: productLibraryTarget(row.product.id)
    });
  }
  return rows;
}

const dailyExecutionLaneRank = {
  准入拦截: 0,
  人工分派: 1,
  风险审计: 2,
  来源审计: 3,
  补资产: 4,
  待回流批次: 5,
  待复盘: 6,
  第一批草稿: 7
};

const dailyExecutionPriorityRank = {
  高: 0,
  中: 1,
  低: 2
};

function sortDailyExecutionRows(rows = [], doneMap = {}) {
  return [...rows].sort((a, b) => {
    const doneA = Boolean(doneMap[dailyExecutionRowKey(a)]);
    const doneB = Boolean(doneMap[dailyExecutionRowKey(b)]);
    if (doneA !== doneB) return doneA ? 1 : -1;
    const priorityDiff = (dailyExecutionPriorityRank[a.priority] ?? 9) - (dailyExecutionPriorityRank[b.priority] ?? 9);
    if (priorityDiff) return priorityDiff;
    const laneDiff = (dailyExecutionLaneRank[a.lane] ?? 9) - (dailyExecutionLaneRank[b.lane] ?? 9);
    if (laneDiff) return laneDiff;
    return `${a.sku || ""}${a.action || ""}`.localeCompare(`${b.sku || ""}${b.action || ""}`, "zh-CN");
  });
}

function dailyExecutionText(rows = [], doneMap = {}) {
  const groups = ["准入拦截", "人工分派", "风险审计", "来源审计", "补资产", "待回流批次", "待复盘", "第一批草稿"];
  const sortedRows = sortDailyExecutionRows(rows, doneMap);
  const lines = [`今日选品与资产执行清单（${new Date().toLocaleString("zh-CN", { hour12: false })}）`];
  for (const group of groups) {
    const items = sortedRows.filter((row) => row.lane === group);
    if (!items.length) continue;
    lines.push("", `【${group}】`);
    items.forEach((row, index) => {
      const doneAt = doneMap[dailyExecutionRowKey(row)];
      const status = doneAt ? `已完成 ${formatDate(doneAt)}` : "待处理";
      const complianceText = row.complianceLabel && row.complianceLabel !== "合规可用"
        ? `｜${row.complianceLabel}：${row.complianceAction || "待核"}`
        : "";
      const evidenceText = row.evidenceLabel && row.evidenceLabel !== "证据包可用"
        ? `｜${row.evidenceLabel}：${row.evidenceAction || "待补"}`
        : "";
      const planText = row.assetPlanLabel && row.assetPlanLabel !== "补齐计划可用"
        ? `｜${row.assetPlanLabel}：${row.assetPlanAction || "待补"}`
        : "";
      const researchText = row.researchLabel && row.researchLabel !== "来源可用"
        ? `｜${row.researchLabel}：${row.researchAction || "待核"}`
        : "";
      const accountText = row.accountLabel && row.accountLabel !== "账号适配可用"
        ? `｜${row.accountLabel}：${row.accountAction || "待核"}`
        : "";
      lines.push(`${index + 1}. [${status}] ${row.sku}｜${row.action}｜${row.detail}${row.target ? `｜${row.target}` : ""}${complianceText}${researchText}${planText}${accountText}${evidenceText}`);
    });
  }
  return lines.join("\n");
}

function downloadDailyExecutionRows(rows = [], doneMap = {}) {
  const headers = ["模块", "SKU", "动作", "说明", "目标/证据", "合规状态", "合规动作", "来源状态", "来源动作", "补齐计划", "补齐动作", "账号状态", "账号动作", "证据状态", "证据动作", "优先级", "状态", "完成时间"];
  const csv = [
    headers,
    ...sortDailyExecutionRows(rows, doneMap).map((row) => {
      const doneAt = doneMap[dailyExecutionRowKey(row)];
      return [row.lane, row.sku, row.action, row.detail, row.target, row.complianceLabel || "", row.complianceAction || "", row.researchLabel || "", row.researchAction || "", row.assetPlanLabel || "", row.assetPlanAction || "", row.accountLabel || "", row.accountAction || "", row.evidenceLabel || "", row.evidenceAction || "", row.priority, doneAt ? "已完成" : "待处理", doneAt ? formatDate(doneAt) : ""];
    })
  ].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "今日选品与资产执行清单.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadSelectionAssetTasks(tasks = []) {
  const headers = ["优先级", "SKU", "类目", "任务类型", "任务", "原因", "证据要求", "合规状态", "合规动作", "来源状态", "来源动作", "补齐计划", "补齐动作", "账号状态", "账号动作", "证据状态", "证据动作", "推荐账号", "状态"];
  const rows = tasks.map((task, index) => {
    const compliance = complianceSummaryForProduct(task.product);
    const evidence = buildProductEvidencePack(task.product, task.account);
    return [
      index + 1,
      task.product.sku,
      task.product.category,
      task.type,
      task.title,
      task.detail,
      task.evidence,
      compliance.label,
      compliance.status === "pass" ? "" : compliance.action,
      evidence.researchTask?.label || "",
      evidence.researchTask?.status === "pass" ? "" : evidence.researchTask?.action || "",
      evidence.assetPlan?.label || "",
      evidence.assetPlan?.status === "可用" ? "" : evidence.assetPlan?.summary || "",
      evidence.accountFit?.label || "",
      evidence.accountFit?.status === "pass" ? "" : evidence.accountFit?.action || "",
      evidence.label,
      evidence.status === "pass" ? "" : evidence.primaryAction,
      task.account?.name || "",
      task.status
    ];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "选品资产补齐任务.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadSelectionBlockerQueue(rows = []) {
  const headers = ["优先级", "SKU", "类目", "生命周期", "总分", "状态", "处理分类", "主拦截", "主问题", "下一步", "负责人", "自动处理项", "人工待办项", "人工负责人", "全部问题", "账号适配", "推荐账号", "可否建批次"];
  const csvRows = (rows || []).map((row, index) => {
    const autoItems = autoResolvableBlockerItems(row);
    const manualItems = manualBlockerItems(row);
    return [
      index + 1,
      row.product?.sku || "",
      row.product?.category || "",
      row.product?.lifecycle || "",
      row.product?.totalScore || "",
      row.statusLabel || "",
      manualItems.length ? autoItems.length ? "自动+人工" : "人工处理" : autoItems.length ? "可自动处理" : "复核",
      row.primary?.kind || "",
      row.primary?.issue || "",
      row.primary?.action || "",
      row.primary?.owner || "",
      autoItems.map((item) => `${item.kind}:${item.label}`).join("；"),
      manualItems.map((item) => `${item.kind}:${item.issue}`).join("；"),
      [...new Set(manualItems.map((item) => item.owner).filter(Boolean))].join("；"),
      (row.items || []).map((item) => `${item.kind}:${item.issue}`).join("；"),
      row.accountFit?.label || "",
      row.accountFit?.account?.name || "",
      row.canQueue ? "可保守建批次" : "需先处理"
    ];
  });
  const csv = [headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "SKU准入拦截队列.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function downloadManualBlockerHandoff(rows = []) {
  const groups = buildManualBlockerHandoffGroups(rows);
  const headers = ["负责人", "优先级", "SKU", "类目", "生命周期", "问题类型", "问题", "处理动作", "状态", "签收状态", "签收时间", "处理状态", "处理时间", "账号适配", "推荐账号"];
  const csvRows = groups.flatMap((group) =>
    group.items.map((entry, index) => {
      const resolved = isManualAssignmentResolved(entry.assignment);
      return [
        group.owner,
        index + 1,
        entry.product.sku || "",
        entry.product.category || "",
        entry.product.lifecycle || "",
        entry.item.kind || "",
        entry.item.issue || "",
        entry.item.action || "",
        entry.item.tone === "bad" ? "拦截" : "待核",
        entry.assignment ? "已签收" : "待签收",
        entry.assignment?.assignedAt || "",
        resolved ? "已处理待复核" : entry.assignment ? "处理中" : "待签收",
        entry.assignment?.resolvedAt || "",
        entry.row.accountFit?.label || "",
        entry.row.accountFit?.account?.name || ""
      ];
    })
  );
  const csv = [headers, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "SKU人工待办分派.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function manualHandoffGroupText(group = {}) {
  const items = group.items || [];
  const lines = [`【${group.owner || "人工复核"}】${items.length} 项，${group.blocked || 0} 拦截 / ${group.warn || 0} 待核 / ${group.signed || 0} 已签收 / ${group.resolved || 0} 已处理`];
  items.slice(0, 12).forEach((entry, index) => {
    const status = entry.item?.tone === "bad" ? "拦截" : "待核";
    const resolved = isManualAssignmentResolved(entry.assignment);
    const assignmentText = entry.assignment ? `｜签收：${entry.assignment.owner} ${formatDate(entry.assignment.assignedAt)}` : "｜签收：待签收";
    const resolvedText = resolved ? `｜处理：待复核 ${formatDate(entry.assignment.resolvedAt)}` : entry.assignment ? "｜处理：进行中" : "";
    const accountName = entry.row?.accountFit?.account?.name || entry.row?.account?.name || "";
    const accountText = accountName ? `｜推荐账号：${accountName}` : "";
    const scoreText = entry.product?.totalScore ? `｜评分：${entry.product.totalScore}` : "";
    lines.push(`${index + 1}. [${status}] ${entry.product?.sku || "未命名 SKU"}｜${entry.item?.kind || "待核"}｜${entry.item?.issue || "待人工确认"}｜下一步：${entry.item?.action || "人工复核"}${assignmentText}${resolvedText}${accountText}${scoreText}`);
  });
  if (items.length > 12) {
    lines.push(`另有 ${items.length - 12} 项，请导出 CSV 查看全部。`);
  }
  return lines.join("\n");
}

function manualHandoffText(groups = []) {
  const lines = [`SKU 人工待办分派（${new Date().toLocaleString("zh-CN", { hour12: false })}）`];
  for (const group of groups || []) {
    if (!group.items?.length) continue;
    lines.push("", manualHandoffGroupText(group));
  }
  return lines.join("\n");
}

function assetCompletionPlanCsvRows(products = []) {
  return (products || []).flatMap((product) => {
    const plan = buildAssetCompletionPlan(product);
    const rows = plan.rows?.length ? plan.rows : [];
    if (!rows.length) {
      return [[
        product.sku || "",
        product.category || "",
        product.lifecycle || "",
        product.totalScore || "",
        plan.label || "补齐计划可用",
        plan.summary || "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        formatDate(plan.generatedAt)
      ]];
    }
    return rows.map((row, index) => [
      product.sku || "",
      product.category || "",
      product.lifecycle || "",
      product.totalScore || "",
      plan.label || "",
      plan.summary || "",
      index + 1,
      row.type,
      row.label,
      row.status,
      row.owner,
      row.action,
      row.doneWhen,
      formatDate(plan.generatedAt)
    ]);
  });
}

function downloadAssetCompletionPlans(products = [], fileName = "资产补齐计划.csv") {
  const headers = ["SKU", "类目", "生命周期", "总分", "计划状态", "计划摘要", "序号", "类型", "补齐项", "状态", "负责人", "采集/处理动作", "完成标准", "生成时间"];
  const csv = [headers, ...assetCompletionPlanCsvRows(products)].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function assetActionLogCsvRows(products = []) {
  return (products || []).flatMap((product) =>
    normalizeAssetActionLog(product).map((log) => [
      product.sku || "",
      product.category || "",
      product.lifecycle || "",
      log.type,
      log.label,
      log.detail,
      log.target,
      log.status,
      log.actor,
      formatDate(log.createdAt)
    ])
  );
}

function downloadAssetActionLogs(products = [], fileName = "资产处理记录.csv") {
  const headers = ["SKU", "类目", "生命周期", "类型", "动作", "说明", "对象", "状态", "处理人", "时间"];
  const csv = [headers, ...assetActionLogCsvRows(products)].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadSelectionDecisionCsv(products = [], accounts = accountAssetSeeds) {
  const headers = ["优先级", "SKU", "类目", "节点", "总分", "生命周期", "决策", "阶段", "动作", "主要依据", "阻断项", "待核项", "来源状态", "来源动作", "调研来源", "来源类型", "账号适配", "推荐账号", "合规状态", "商品卡状态", "素材状态", "情报来源"];
  const rows = buildSelectionDecisionQueue(products, accounts).map((decision, index) => [
    index + 1,
    decision.product.sku,
    decision.product.category,
    decision.product.node,
    decision.product.totalScore,
    decision.product.lifecycle,
    decision.label,
    decision.stage,
    decision.action,
    decision.primaryReason,
    decision.blockers.join(" / "),
    decision.warnings.join(" / "),
    decision.researchTask?.label || "",
    decision.researchTask?.status === "pass" ? "" : decision.researchTask?.action || "",
    decision.research?.primary || "",
    decision.research?.types?.join(" / ") || "",
    decision.accountFit?.label || "",
    decision.accountFit?.account?.name || "",
    decision.compliance?.label || "",
    productCardPrecheckLabel(decision.cardPrecheck || {}),
    materialPrecheckLabel(decision.materialPrecheck || {}),
    (decision.signals || []).map((signal) => signal.label).join(" / ")
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "选品决策队列.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function scoreExecutionPlanRows(decisions = []) {
  return (decisions || []).map((decision) => {
    const product = decision.product || {};
    const complianceStatus = decision.compliance?.status || "";
    const researchStatus = decision.researchTask?.status || "";
    const accountStatus = decision.accountFit?.status || "";
    const materialStatus = decision.materialPrecheck?.status || "";
    const cardStatus = decision.cardPrecheck?.status || "";
    let lane = "人工复核";
    let owner = "选品负责人";
    let action = decision.action || "查看商品";
    let route = decision.route || productLibraryTarget(product.id);
    let tone = decision.tone || "warn";
    let priority = Number(decision.priority || product.totalScore || 0);

    if (decision.canCreateBatch) {
      lane = "可建草稿";
      owner = "生成负责人";
      action = "建测品草稿";
      tone = "good";
      priority += 30;
    } else if (product.lifecycle === "小批量测试" || hasActiveSelectionBatch(product)) {
      lane = "待回流";
      owner = "数据回收";
      action = "查看批次并等数据";
      route = activeSelectionBatchTarget(product);
      tone = "warn";
      priority += 20;
    } else if (complianceStatus === "blocked" || complianceStatus === "warn") {
      lane = complianceStatus === "blocked" ? "合规拦截" : "合规待核";
      owner = "合规复核";
      action = decision.compliance?.action || "核资质、授权和禁用话术";
      priority += complianceStatus === "blocked" ? 50 : 28;
    } else if (researchStatus === "blocked" || researchStatus === "warn") {
      lane = researchStatus === "blocked" ? "来源拦截" : "来源待核";
      owner = "调研负责人";
      action = decision.researchTask?.action || "补罗盘、联盟、热搜或规则来源";
      priority += researchStatus === "blocked" ? 42 : 24;
    } else if (accountStatus === "blocked" || accountStatus === "warn") {
      lane = accountStatus === "blocked" ? "账号拦截" : "账号待核";
      owner = "账号负责人";
      action = decision.accountFit?.action || "补账号定位、DOC 包和平台规则";
      route = "accountAssets";
      priority += accountStatus === "blocked" ? 40 : 22;
    } else if (materialStatus === "blocked" || cardStatus === "blocked") {
      lane = "资产拦截";
      owner = "素材/商品卡";
      action = decision.materialPrecheck?.hardIssues?.[0] || decision.cardPrecheck?.nextGap || "补关键素材和商品卡";
      priority += 36;
    } else if (materialStatus === "warn" || cardStatus === "warn" || product.lifecycle === "待补资产") {
      lane = "补资产";
      owner = "素材/商品卡";
      action = decision.materialPrecheck?.warnings?.[0] || decision.cardPrecheck?.nextGap || (product.assetGaps || [])[0] || "补资产后再测";
      priority += 18;
    } else if (Number(product.totalScore || 0) < 75 || product.lifecycle === "淘汰") {
      lane = "降权观察";
      owner = "选品负责人";
      action = product.lifecycle === "淘汰" ? "保留记录，不进本轮" : "低于 75 分，暂不测";
      tone = "bad";
      priority += 12;
    }

    return {
      id: `${product.id || product.sku}-${lane}`,
      product,
      decision,
      lane,
      owner,
      action,
      route,
      tone,
      priority,
      canCreateBatch: Boolean(decision.canCreateBatch)
    };
  }).sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore);
}

function scoreExecutionPlanText(rows = []) {
  const laneOrder = ["可建草稿", "合规拦截", "来源拦截", "账号拦截", "资产拦截", "补资产", "合规待核", "来源待核", "账号待核", "待回流", "降权观察", "人工复核"];
  const lines = [`选品评分执行计划（${new Date().toLocaleString("zh-CN", { hour12: false })}）`];
  for (const lane of laneOrder) {
    const items = rows.filter((row) => row.lane === lane);
    if (!items.length) continue;
    lines.push("", `【${lane}】${items.length} 项`);
    items.slice(0, 8).forEach((row, index) => {
      lines.push(`${index + 1}. ${row.product.sku}｜${row.product.totalScore}分｜${row.owner}｜${row.action}｜${row.decision.primaryReason || row.decision.label}`);
    });
    if (items.length > 8) lines.push(`另有 ${items.length - 8} 项，导出决策队列查看全部。`);
  }
  return lines.join("\n");
}

function ScoreExecutionPlanPanel({ rows = [], navigate, onCreateBatch, onCopy, copyMessage }) {
  if (!rows.length) return null;
  const readyRows = rows.filter((row) => row.canCreateBatch).slice(0, 6);
  const blockedCount = rows.filter((row) => row.tone === "bad" || row.lane.includes("拦截")).length;
  const warnCount = rows.filter((row) => row.tone === "warn" && !row.lane.includes("拦截")).length;
  const laneCount = new Set(rows.map((row) => row.lane)).size;
  return (
    <div className="panel score-execution-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <ListChecks size={17} />
            <strong>评分执行计划</strong>
          </div>
          <p>把评分结果拆成今天可处理的队列：可建草稿、合规/来源/账号拦截、补资产和待回流。</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制计划</span>
          </button>
          <button className="primary-button" type="button" onClick={() => onCreateBatch?.(readyRows.map((row) => row.product), { autoStart: false })} disabled={!readyRows.length}>
            <ListChecks size={16} />
            <span>{readyRows.length ? `建 ${readyRows.length} 个草稿` : "暂无可建"}</span>
          </button>
        </div>
      </div>
      {copyMessage ? <p className="selection-task-message">{copyMessage}</p> : null}
      <div className="score-execution-summary">
        <div><span>执行项</span><strong>{rows.length}</strong></div>
        <div><span>可建草稿</span><strong>{readyRows.length}</strong></div>
        <div><span>拦截</span><strong>{blockedCount}</strong></div>
        <div><span>待核/待补</span><strong>{warnCount}</strong></div>
        <div><span>队列</span><strong>{laneCount}</strong></div>
      </div>
      <div className="score-execution-list">
        {rows.slice(0, 10).map((row, index) => (
          <div className={`score-execution-row ${row.tone}`} key={row.id}>
            <span className="selection-task-rank">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{row.product.sku}</strong>
              <span>{row.lane} · {row.owner}</span>
              <small>{row.action}</small>
              <small>{row.decision.primaryReason || row.decision.label}</small>
            </div>
            <button className={row.canCreateBatch ? "primary-button" : "secondary-button"} type="button" onClick={() => row.canCreateBatch ? onCreateBatch?.([row.product], { autoStart: false }) : navigate(row.route || productLibraryTarget(row.product.id))}>
              <ChevronRight size={15} />
              <span>{row.canCreateBatch ? "建草稿" : "处理"}</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreCalibrationPanel({ rows = [], onCopy, onApplyRow, onApplyBatch, onImportTemplate, applyingId = "", batchApplying = false, copyMessage = "" }) {
  if (!rows.length) return null;
  const overratedCount = rows.filter((row) => ["overrated", "reduce"].includes(row.category)).length;
  const underratedCount = rows.filter((row) => ["underrated", "boost"].includes(row.category)).length;
  const missingCount = rows.filter((row) => ["missing", "untested"].includes(row.category)).length;
  const riskCount = rows.filter((row) => row.category === "risk").length;
  const applyRows = rows.filter((row) => row.hasMetrics && row.category !== "stable").slice(0, 8);
  const importRows = rows.filter((row) => !row.hasMetrics).slice(0, 12);
  return (
    <div className="panel score-calibration-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <Gauge size={17} />
            <strong>评分校准队列</strong>
          </div>
          <p>对照复盘数据检查评分是否高估或低估，优先处理会影响下一轮测品排序的 SKU。</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制校准</span>
          </button>
          <button className="secondary-button" type="button" disabled={!importRows.length} onClick={() => onImportTemplate?.(importRows)}>
            <Clipboard size={16} />
            <span>{importRows.length ? `导入模板 ${importRows.length}` : "无需导入"}</span>
          </button>
          <button className="secondary-button" type="button" disabled={!applyRows.length || batchApplying} onClick={() => onApplyBatch?.(applyRows)}>
            <ShieldCheck size={16} />
            <span>{batchApplying ? "写回中" : `写回 ${applyRows.length}`}</span>
          </button>
        </div>
      </div>
      {copyMessage ? <p className="selection-task-message">{copyMessage}</p> : null}
      <div className="score-calibration-summary">
        <div><span>高估待降</span><strong>{overratedCount}</strong></div>
        <div><span>低估待升</span><strong>{underratedCount}</strong></div>
        <div><span>待回流</span><strong>{missingCount}</strong></div>
        <div><span>风险复核</span><strong>{riskCount}</strong></div>
      </div>
      <div className="score-calibration-list">
        {rows.slice(0, 8).map((row) => (
          <div className={`score-calibration-row ${row.tone}`} key={row.product.id}>
            <span className="score-calibration-state">{row.label}</span>
            <div>
              <strong>{row.product.sku}</strong>
              <span>原分 {row.product.totalScore} 到建议 {row.summary.adjustedScore} · {row.advice?.action || row.summary.verdict} · {row.hasMetrics ? `${row.metrics.views} 播放 / ${row.metrics.orders} 单` : "待回流"}</span>
              <small>{row.action}</small>
            </div>
            <div className="score-calibration-actions">
              {row.hasMetrics ? (
                <button className="secondary-button" type="button" disabled={applyingId === row.product.id || batchApplying} onClick={() => onApplyRow?.(row)}>
                  <ShieldCheck size={15} />
                  <span>{applyingId === row.product.id ? "写回中" : "写回"}</span>
                </button>
              ) : (
                <button className="secondary-button" type="button" onClick={() => onImportTemplate?.([row])}>
                  <Clipboard size={15} />
                  <span>补数据</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function generationStatusLabel(record) {
  const status = String(record?.itemStatus || record?.batchStatus || "").toLowerCase();
  const currentStep = record?.currentStep ? ` · ${record.currentStep}` : "";
  if (status === "compliance_required") return "需合规校验";
  if (status === "draft") return "草稿";
  if (status === "queued") return "待执行";
  if (status === "running") return `生成中${currentStep}`;
  if (status === "prompt_ready") return "已出提示词";
  if (status === "succeeded") return "已出视频";
  if (status === "failed") return "失败";
  if (status === "cancelled") return "已取消";
  return record?.currentStep || record?.batchStatus || "未开始";
}

function generationStatusTone(record) {
  const status = String(record?.itemStatus || record?.batchStatus || "").toLowerCase();
  if (record?.videoUrl || status === "succeeded") return "good";
  if (status === "compliance_required") return "bad";
  if (record?.errorMessage || isBadStatus(status)) return "bad";
  if (record?.finalPromptReady || status === "prompt_ready") return "info";
  if (/running|queued|retrying/i.test(status)) return "warn";
  return "muted";
}

function GenerationRecordsList({ records = [] }) {
  if (!records.length) return <p className="selection-muted">暂未回流生成记录。创建测品批次后，这里会自动显示提示词、视频任务和视频结果。</p>;
  return (
    <div className="generation-record-list">
      {records.slice(0, 6).map((record) => (
        <div className="generation-record" key={record.itemId || `${record.batchId}-${record.rowNo}`}>
          <div className="generation-record-top">
            <div>
              <strong>{record.batchName || "选品测品批次"}</strong>
              <span>第 {record.rowNo || 1} 条 · {formatDate(record.updatedAt || record.batchUpdatedAt || record.createdAt)}</span>
            </div>
            <span className={`generation-status ${generationStatusTone(record)}`}>{generationStatusLabel(record)}</span>
          </div>
          <div className="generation-record-meta">
            {record.accountName ? <span>账号：{record.accountName}</span> : null}
            <span>素材：{record.materialImageCount || record.materialAttachments?.length || 0} 张</span>
            <span>模式：{record.videoMode || "dry_run"}</span>
            <span>时长：{record.targetDuration || 15}s</span>
            <span>{record.autoSubmit ? "已提交视频" : "未自动提交"}</span>
            {record.libtvTaskCode ? <span>视频单号：{record.libtvTaskCode}</span> : null}
          </div>
          {record.finalPromptPreview ? <p className="prompt-preview">{record.finalPromptPreview}</p> : null}
          {record.errorMessage ? <p className="generation-error">{record.errorMessage}</p> : null}
          {record.videoUrl ? <a className="generation-video-link" href={record.videoUrl} target="_blank" rel="noreferrer">查看视频</a> : null}
        </div>
      ))}
    </div>
  );
}

function emptyReviewMetrics() {
  return {
    views: 0,
    clicks: 0,
    cardClicks: 0,
    orders: 0,
    refunds: 0,
    commentIssues: "",
    note: ""
  };
}

function reviewFormFromMetrics(metrics = {}) {
  const base = emptyReviewMetrics();
  return {
    views: String(metrics.views ?? base.views),
    clicks: String(metrics.clicks ?? base.clicks),
    cardClicks: String(metrics.cardClicks ?? base.cardClicks),
    orders: String(metrics.orders ?? base.orders),
    refunds: String(metrics.refunds ?? base.refunds),
    commentIssues: String(metrics.commentIssues ?? base.commentIssues),
    note: String(metrics.note ?? base.note)
  };
}

function numericReviewValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number);
}

function normalizeReviewMetrics(form = {}) {
  return {
    views: numericReviewValue(form.views),
    clicks: numericReviewValue(form.clicks),
    cardClicks: numericReviewValue(form.cardClicks),
    orders: numericReviewValue(form.orders),
    refunds: numericReviewValue(form.refunds),
    commentIssues: String(form.commentIssues || "").trim().slice(0, 240),
    note: String(form.note || "").trim().slice(0, 400)
  };
}

function ratio(value, total) {
  return total ? value / total : 0;
}

function formatRate(value) {
  return `${Math.round(Number(value || 0) * 1000) / 10}%`;
}

function summarizeReviewMetrics(metrics = {}, baseScore = 75) {
  const views = Number(metrics.views || 0);
  const clicks = Number(metrics.clicks || 0);
  const cardClicks = Number(metrics.cardClicks || 0);
  const orders = Number(metrics.orders || 0);
  const refunds = Number(metrics.refunds || 0);
  const ctr = ratio(clicks, views);
  const cardRate = ratio(cardClicks, clicks);
  const orderRate = ratio(orders, clicks);
  const refundRate = ratio(refunds, orders);
  let lifecycle = "小批量测试";
  let verdict = "继续观察";
  let delta = 0;

  if (!views && !clicks && !orders) {
    lifecycle = "小批量测试";
    verdict = "待回收数据";
  } else if ((orders >= 3 && refundRate > 0.2) || (clicks >= 20 && orders === 0)) {
    lifecycle = "淘汰";
    verdict = "淘汰";
    delta = -8;
  } else if (orders >= 3 && orderRate >= 0.04 && refundRate <= 0.1) {
    lifecycle = "放大";
    verdict = "放大";
    delta = 8;
  } else if ((ctr >= 0.02 && orders >= 1) || cardClicks >= 5) {
    lifecycle = "复测";
    verdict = "复测";
    delta = 3;
  } else if (views >= 500 && ctr < 0.01) {
    lifecycle = "淘汰";
    verdict = "淘汰";
    delta = -5;
  }

  const adjustedScore = Math.max(0, Math.min(100, Math.round(Number(baseScore || 75) + delta)));
  return {
    ctr,
    cardRate,
    orderRate,
    refundRate,
    lifecycle,
    verdict,
    adjustedScore
  };
}

function reviewReadinessGuardForProduct(product = {}, accounts = accountAssetSeeds) {
  const materialPrecheck = materialPrecheckForProduct(product);
  const cardPrecheck = productCardPrecheck(product);
  const compliance = complianceSummaryForProduct(product);
  const researchTask = researchTaskSummaryForProduct(product);
  const accountFit = accountFitSummaryForProduct(product, accounts);
  const assetVerification = assetVerificationGateForProduct(product, accountFit);
  const blockers = [];
  const warnings = [];

  if (materialPrecheck.status === "blocked") blockers.push(materialPrecheck.hardIssues[0] || "素材预检阻断");
  if (cardPrecheck.status === "blocked") blockers.push(cardPrecheck.nextGap || "商品卡承接阻断");
  if (compliance.status === "blocked") blockers.push(compliance.action || compliance.primary || "合规阻断");
  if (researchTask.status === "blocked") blockers.push(researchTask.action || "调研来源阻断");
  if (accountFit.status === "blocked") blockers.push(accountFit.action || "账号承接阻断");
  if (assetVerification.computedStatus === "blocked") blockers.push(assetVerification.primaryAction || assetVerification.summary || "生成前验证阻断");

  if (materialPrecheck.status === "warn") warnings.push(materialPrecheck.warnings[0] || "素材待核");
  if (cardPrecheck.status === "warn") warnings.push(cardPrecheck.nextGap || "商品卡待核");
  if (compliance.status === "warn") warnings.push(compliance.action || compliance.primary || "合规待核");
  if (researchTask.status === "warn") warnings.push(researchTask.action || "调研来源待核");
  if (accountFit.status === "warn") warnings.push(accountFit.action || "账号承接待核");
  if (assetVerification.status === "warn") warnings.push(assetVerification.primaryAction || assetVerification.summary || "生成前验证待核");

  return {
    status: blockers.length ? "blocked" : warnings.length ? "warn" : "pass",
    blockers: [...new Set(blockers)].slice(0, 5),
    warnings: [...new Set(warnings)].slice(0, 5),
    materialPrecheck,
    cardPrecheck,
    compliance,
    researchTask,
    accountFit,
    assetVerification
  };
}

function buildReviewAdvice(product = {}, metrics = {}, summary = summarizeReviewMetrics(metrics, product.totalScore), accounts = accountAssetSeeds) {
  const materialSummary = summarizeMaterialChecklist(product.assetChecklist || []);
  const materialPrecheck = materialPrecheckForProduct(product);
  const readinessGuard = reviewReadinessGuardForProduct(product, accounts);
  const generationSummary = product.generationSummary || {};
  const generationRecords = Array.isArray(product.generationRecords) ? product.generationRecords : [];
  const materialImageCount = generationRecords.reduce((total, record) => total + Number(record.materialImageCount || record.materialAttachments?.length || 0), 0);
  const reasons = [];
  const nextActions = [];
  const materialActions = [];
  const scriptActions = [];
  let action = summary.verdict || "待回收数据";
  let lifecycle = summary.lifecycle || "小批量测试";
  let confidence = "中";

  if (!generationSummary.total && !generationRecords.length) {
    reasons.push("还没有测品批次记录");
    nextActions.push("先用当前 SKU 创建 1 个草稿批次，确认提示词和素材是否能进入生产链路。");
    confidence = "低";
  } else if (!generationSummary.videoCount && !generationRecords.some((record) => record.videoUrl)) {
    reasons.push("已有批次但还没有视频结果");
    nextActions.push("先完成提示词或视频生成，再回收播放、点击和商品卡数据。");
    confidence = "低";
  }

  if (materialPrecheck.status === "blocked") {
    action = "补关键素材后复测";
    lifecycle = "待补资产";
    reasons.push(materialPrecheck.hardIssues[0] || "关键素材未通过预检");
    materialActions.push(...materialPrecheck.hardIssues.slice(0, 3));
  } else if (materialSummary.percent < 78) {
    reasons.push(`素材完整度 ${materialSummary.percent}%`);
    materialActions.push(`优先补齐：${materialSummary.nextGap || "关键素材"}`);
  }

  if (materialImageCount === 0 && generationSummary.total) {
    reasons.push("已有批次但未带入真实素材图");
    materialActions.push("为下一轮至少绑定商品主图、真实场景图和商品卡截图各 1 张。");
  }

  if (!metrics.views && !metrics.clicks && !metrics.orders) {
    action = materialPrecheck.status === "blocked" ? action : "先回收数据";
    lifecycle = materialPrecheck.status === "blocked" ? lifecycle : "小批量测试";
    nextActions.push("补充播放、点击、商品卡点击、成交和退货数据后再判断放大或淘汰。");
  } else if (summary.verdict === "放大") {
    if (materialSummary.percent >= 78 && materialPrecheck.status === "pass") {
      action = "放大";
      lifecycle = "放大";
      confidence = metrics.orders >= 5 ? "高" : "中";
      nextActions.push("保留当前素材和账号，扩 3 个相邻角度做第二轮批次。");
      scriptActions.push("保留成交脚本结构，只换开头场景和搜索词。");
    } else {
      action = "补素材后放大";
      lifecycle = "复测";
      nextActions.push("不要直接放量，先补齐素材缺口后用同一账号复测。");
    }
  } else if (summary.verdict === "复测") {
    action = "复测";
    lifecycle = "复测";
    if (summary.ctr < 0.02 && metrics.views >= 500) scriptActions.push("重写前 3 秒开头，改成更具体的场景痛点。");
    if (summary.cardRate < 0.35 && metrics.clicks >= 10) scriptActions.push("强化商品卡承接：标题、主图、规格和视频承诺保持一致。");
    if (summary.orderRate < 0.03 && metrics.cardClicks >= 5) scriptActions.push("补价格/规格/适用边界，降低用户点击后的犹豫。");
    if (!scriptActions.length) scriptActions.push("保留主角度，新增 2 个开头和 1 个商品卡 CTA 做 A/B 测试。");
  } else if (summary.verdict === "淘汰") {
    if (materialImageCount === 0 || materialSummary.percent < 70) {
      action = "补素材复测";
      lifecycle = "复测";
      reasons.push("淘汰判断可能受素材不足影响");
      nextActions.push("先补真实素材后小样本复测一次，再决定是否彻底淘汰。");
    } else {
      action = "淘汰";
      lifecycle = "淘汰";
      confidence = metrics.clicks >= 20 || metrics.views >= 1000 ? "高" : "中";
      nextActions.push("停止新建批次，把账号和素材资源转给同类更高分 SKU。");
    }
  }

  if (metrics.refunds > 0 || summary.refundRate > 0.1) {
    reasons.push(`退货率 ${formatRate(summary.refundRate)}`);
    nextActions.push("复核商品卡详情、履约时效和售后差评，避免继续放大。");
  }
  if (metrics.commentIssues) {
    reasons.push(`评论问题：${metrics.commentIssues}`);
    nextActions.push("把评论高频问题写入下一轮脚本的适用边界和商品卡检查。");
  }

  if (["放大", "复测"].includes(lifecycle)) {
    if (readinessGuard.status === "blocked") {
      const blocker = readinessGuard.blockers[0] || "准入阻断";
      reasons.push(`准入阻断：${blocker}`);
      nextActions.push("先补齐阻断项并保存生成前验证，再写回复测或放大。");
      materialActions.push(...readinessGuard.blockers.slice(0, 3));
      action = lifecycle === "放大" ? "准入补齐后放大" : "准入补齐后复测";
      lifecycle = "待补资产";
      confidence = "低";
    } else if (readinessGuard.status === "warn") {
      const warning = readinessGuard.warnings[0] || "准入待核";
      reasons.push(`准入待核：${warning}`);
      nextActions.push("先按待核项保守复测，确认商品卡、账号、来源和验证记录后再放大。");
      if (lifecycle === "放大") {
        action = "待核复测后放大";
        lifecycle = "复测";
        confidence = confidence === "高" ? "中" : confidence;
      }
    }
  }

  return {
    action,
    lifecycle,
    confidence,
    reasons: [...new Set(reasons)].slice(0, 5),
    nextActions: [...new Set(nextActions)].slice(0, 5),
    materialActions: [...new Set(materialActions)].slice(0, 4),
    scriptActions: [...new Set(scriptActions)].slice(0, 4),
    readinessGuard: {
      status: readinessGuard.status,
      blockers: readinessGuard.blockers,
      warnings: readinessGuard.warnings,
      account: readinessGuard.accountFit.account?.name || "",
      verification: readinessGuard.assetVerification.label || ""
    },
    updatedAt: new Date().toISOString()
  };
}

function productReviewSummary(product = {}) {
  const metrics = product.reviewMetrics || {};
  const summary = metrics.summary || summarizeReviewMetrics(metrics, product.totalScore);
  const advice = product.reviewAdvice || metrics.advice || {};
  const lifecycle = advice.lifecycle || summary.lifecycle || "";
  const displayVerdict = lifecycle || advice.action || summary.verdict || "待回收数据";
  return {
    metrics,
    summary,
    verdict: summary.verdict || "待回收数据",
    lifecycle,
    displayVerdict,
    action: advice.action || summary.verdict || "待回收数据",
    orders: Number(metrics.orders || 0),
    refunds: Number(metrics.refunds || 0),
    commentIssues: String(metrics.commentIssues || "").trim()
  };
}

const reviewImportTemplate = "SKU,播放,点击,商品卡点击,成交,退货,评论高频问题,备注";
const reviewImportMetricKeys = ["播放", "播放量", "曝光", "曝光量", "views", "view", "impressions", "点击", "视频点击", "点击量", "clicks", "click", "商品卡点击", "商品点击", "卡点击", "商品卡", "cardClicks", "card_clicks", "productClicks", "成交", "成交数", "订单", "订单数", "下单", "orders", "order", "退货", "退款", "退货数", "refunds", "refund"];

function reviewImportTemplateFromRows(rows = []) {
  const headers = ["SKU", "播放", "点击", "商品卡点击", "成交", "退货", "评论高频问题", "备注"];
  const items = (rows || []).map((row) => [
    row.product?.sku || "",
    "",
    "",
    "",
    "",
    "",
    "",
    row.reason || row.stage || ""
  ]);
  return [headers, ...items].map((line) => line.map(csvCell).join(",")).join("\n");
}

function parseReviewImportRows(text = "") {
  const source = String(text || "").trim();
  if (!source) return [];
  const firstLine = source.split(/\r?\n/)[0] || "";
  if (firstLine.includes("\t")) {
    const rows = source.split(/\r?\n/).map((line) => line.split("\t"));
    const headers = (rows[0] || []).map((item) => String(item || "").trim());
    return rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim())).map((row) => {
      const item = {};
      headers.forEach((header, index) => {
        if (header) item[header] = row[index] || "";
      });
      return item;
    });
  }
  return parseCsvRows(source);
}

function pickReviewValue(row, keys) {
  return pickCsvValue(row, keys);
}

function normalizeSkuText(value = "") {
  return String(value || "").toLowerCase().replace(/[\s#_|\-—/\\（）()【】[\]{}"'“”‘’]+/g, "");
}

function findReviewImportProduct(row = {}, products = []) {
  const rawSku = pickReviewValue(row, ["SKU", "sku", "商品", "商品名称", "商品名", "product", "product_name", "productName", "名称"]);
  const key = normalizeSkuText(rawSku);
  if (!key) return null;
  return products.find((product) => normalizeSkuText(product.sku) === key)
    || products.find((product) => {
      const sku = normalizeSkuText(product.sku);
      return sku && (sku.includes(key) || key.includes(sku));
    })
    || null;
}

function reviewImportMetricsFromRow(row = {}) {
  return normalizeReviewMetrics({
    views: pickReviewValue(row, ["播放", "播放量", "曝光", "曝光量", "views", "view", "impressions"]),
    clicks: pickReviewValue(row, ["点击", "视频点击", "点击量", "clicks", "click"]),
    cardClicks: pickReviewValue(row, ["商品卡点击", "商品点击", "卡点击", "商品卡", "cardClicks", "card_clicks", "productClicks"]),
    orders: pickReviewValue(row, ["成交", "成交数", "订单", "订单数", "下单", "orders", "order"]),
    refunds: pickReviewValue(row, ["退货", "退款", "退货数", "refunds", "refund"]),
    commentIssues: pickReviewValue(row, ["评论高频问题", "评论问题", "差评", "问题", "commentIssues", "comments"]),
    note: pickReviewValue(row, ["备注", "复盘备注", "结论", "note", "notes"])
  });
}

function hasReviewMetricInput(row = {}) {
  return reviewImportMetricKeys.some((key) => {
    const value = row[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
}

function buildReviewImportPreview(text = "", products = [], accounts = accountAssetSeeds) {
  const rows = parseReviewImportRows(text);
  const seen = new Set();
  return rows.map((row, index) => {
    const product = findReviewImportProduct(row, products);
    const rawSku = pickReviewValue(row, ["SKU", "sku", "商品", "商品名称", "商品名", "product", "product_name", "productName", "名称"]);
    if (!product) {
      return {
        id: `unmatched-${index}`,
        status: "unmatched",
        rawSku: rawSku || `第 ${index + 1} 行`,
        row,
        reason: "未匹配 SKU"
      };
    }
    const duplicate = seen.has(product.id);
    seen.add(product.id);
    const metrics = reviewImportMetricsFromRow(row);
    if (!hasReviewMetricInput(row)) {
      return {
        id: `${product.id}-${index}`,
        status: "empty",
        rawSku,
        product,
        metrics,
        row,
        reason: "待补指标"
      };
    }
    const summary = summarizeReviewMetrics(metrics, product.totalScore);
    const advice = buildReviewAdvice(product, metrics, summary, accounts);
    return {
      id: `${product.id}-${index}`,
      status: duplicate ? "duplicate" : "matched",
      rawSku,
      product,
      metrics,
      summary,
      advice,
      row,
      reason: duplicate ? "重复行，写回时跳过" : advice.action
    };
  });
}

function reviewMetricsPayloadForProduct(product, metrics, accounts = accountAssetSeeds) {
  const summary = summarizeReviewMetrics(metrics, product.totalScore);
  const advice = buildReviewAdvice(product, metrics, summary, accounts);
  const updatedAt = new Date().toISOString();
  return {
    reviewMetrics: {
      ...metrics,
      summary,
      advice,
      updatedAt
    },
    reviewAdvice: advice,
    lifecycle: advice.lifecycle || summary.lifecycle,
    assetStatus: `复盘建议：${advice.action}`,
    totalScore: summary.adjustedScore,
    scoreCalibration: scoreCalibrationRecordForProduct(product, metrics, summary, advice, updatedAt)
  };
}

function hasReviewMetricData(metrics = {}) {
  return ["views", "clicks", "cardClicks", "orders", "refunds"].some((key) => Number(metrics[key] || 0) > 0);
}

function scoreCalibrationRecordForProduct(product = {}, metrics = {}, summary = summarizeReviewMetrics(metrics, product.totalScore), advice = buildReviewAdvice(product, metrics, summary), updatedAt = new Date().toISOString()) {
  return {
    source: "review-metrics",
    appliedAt: updatedAt,
    fromScore: Number(product.totalScore || 0),
    toScore: Number(summary.adjustedScore || 0),
    verdict: advice.action || summary.verdict || "待回收数据",
    lifecycle: advice.lifecycle || summary.lifecycle || product.lifecycle || "",
    reason: advice.reasons?.[0] || advice.nextActions?.[0] || "复盘数据回流自动校准",
    metrics: {
      views: Number(metrics.views || 0),
      clicks: Number(metrics.clicks || 0),
      cardClicks: Number(metrics.cardClicks || 0),
      orders: Number(metrics.orders || 0),
      refunds: Number(metrics.refunds || 0)
    }
  };
}

function scoreCalibrationRows(products = [], accounts = accountAssetSeeds) {
  return (products || [])
    .filter((product) => product?.id && product.lifecycle !== "淘汰")
    .map((product) => {
      const metrics = normalizeReviewMetrics(product.reviewMetrics || {});
      const hasMetrics = hasReviewMetricData(metrics);
      const summary = product.reviewMetrics?.summary || summarizeReviewMetrics(metrics, product.totalScore);
      const advice = product.reviewAdvice || buildReviewAdvice(product, metrics, summary, accounts);
      const guardedLifecycle = advice.lifecycle || summary.lifecycle;
      const guardBlocked = advice.readinessGuard?.status === "blocked";
      const guardWarn = advice.readinessGuard?.status === "warn";
      const generationSummary = product.generationSummary || {};
      const hasGeneration = Number(generationSummary.total || 0) > 0 || (product.generationRecords || []).length > 0 || hasActiveSelectionBatch(product);
      const score = Number(product.totalScore || 0);
      let category = "stable";
      let label = "评分已校准";
      let tone = "good";
      let action = "保持当前评分，继续观察下一轮回流。";
      let priority = 10;

      if (!hasMetrics) {
        category = hasGeneration || ["小批量测试", "复测", "放大"].includes(product.lifecycle) ? "missing" : "untested";
        label = category === "missing" ? "待回流数据" : "待建首测";
        tone = "warn";
        action = category === "missing" ? "补播放、点击、商品卡点击、成交和退货数据。" : "先进入测品批次，再回收表现数据。";
        priority = category === "missing" ? 78 : 38;
      } else if (score >= 80 && summary.verdict === "淘汰") {
        category = "overrated";
        label = "高分低效";
        tone = "bad";
        action = "下调评分并复核评分维度，避免同类 SKU 继续占用批次。";
        priority = 112;
      } else if (score < 75 && ["放大", "复测"].includes(summary.verdict) && !guardBlocked) {
        category = "underrated";
        label = "低分高效";
        tone = "good";
        action = guardWarn ? "先按准入待核项复测，再判断是否上调评分。" : "上调评分，检查是否低估了节点、账号或商品卡承接。";
        priority = 96;
      } else if (guardBlocked && ["放大", "复测"].includes(summary.verdict)) {
        category = "risk";
        label = "高效但阻断";
        tone = "bad";
        action = advice.readinessGuard?.blockers?.[0] || "先补准入阻断项，再写回复盘结论。";
        priority = 104;
      } else if (summary.verdict === "放大" && guardedLifecycle === "放大" && score < 85) {
        category = "boost";
        label = "可上调";
        tone = "good";
        action = "写回放大结论，并保留当前素材与账号组合。";
        priority = 82;
      } else if (summary.verdict === "淘汰" && score >= 75) {
        category = "reduce";
        label = "需下调";
        tone = "bad";
        action = advice.action || "写回淘汰结论，降低同类 SKU 优先级。";
        priority = 88;
      } else if (metrics.refunds > 0 || summary.refundRate > 0.1 || metrics.commentIssues) {
        category = "risk";
        label = "风险复核";
        tone = "warn";
        action = "复核退货、评论和商品卡承接，必要时降级到复测。";
        priority = 74;
      }

      return {
        product,
        metrics,
        summary,
        advice,
        hasMetrics,
        hasGeneration,
        category,
        label,
        tone,
        action,
        priority,
        scoreDelta: Math.round(Number(summary.adjustedScore || score) - score)
      };
    })
    .sort((a, b) => b.priority - a.priority || Math.abs(b.scoreDelta) - Math.abs(a.scoreDelta) || b.product.totalScore - a.product.totalScore);
}

function scoreCalibrationText(rows = []) {
  if (!rows.length) return "评分校准队列：暂无 SKU。";
  return [
    `评分校准队列（${new Date().toLocaleString("zh-CN", { hour12: false })}）`,
    ...rows.map((row, index) => `${index + 1}. ${row.product.sku}｜${row.label}｜原分 ${row.product.totalScore} -> 建议 ${row.summary.adjustedScore}｜${row.advice?.action || row.summary.verdict}｜下一步：${row.action}`)
  ].join("\n");
}

function reviewRiskTone(product = {}) {
  const { metrics, summary, lifecycle, commentIssues } = productReviewSummary(product);
  if (lifecycle === "淘汰" || summary.verdict === "淘汰") return "bad";
  if (Number(metrics.refunds || 0) > 0 || commentIssues) return "warn";
  if (lifecycle === "放大") return "good";
  if (lifecycle === "复测" || lifecycle === "待补资产") return "warn";
  return "muted";
}

function ScoreBar({ label, value, max }) {
  const percent = max ? Math.min(100, Math.round((Number(value || 0) / max) * 100)) : 0;
  return (
    <div className="score-bar-row">
      <div className="score-bar-label">
        <span>{label}</span>
        <strong>{value}/{max}</strong>
      </div>
      <div className="score-bar-track">
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SelectionMetricCard({ label, value, detail, icon: Icon, tone = "info" }) {
  return (
    <div className={`selection-metric ${tone}`}>
      <span className="selection-metric-icon"><Icon size={18} /></span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{detail}</em>
      </div>
    </div>
  );
}

function SelectionDecisionRadar({ decisions = [], navigate, onCreateBatch, limit = 6 }) {
  const visible = decisions.slice(0, limit);
  if (!visible.length) return <p className="selection-muted">暂无 SKU 决策。</p>;
  return (
    <div className="decision-radar-list">
      {visible.map((decision) => (
        <div className={`decision-radar-row ${decision.tone}`} key={decision.product.id}>
          <div>
            <strong>{decision.product.sku}</strong>
            <span>{decision.label} · {decision.stage} · {decision.product.totalScore} 分</span>
            <small>{decision.primaryReason}</small>
          </div>
          <button
            className="secondary-button selection-row-button"
            type="button"
            onClick={() => decision.canCreateBatch
              ? onCreateBatch?.([decision.product], { autoStart: false })
              : navigate(decision.route || productLibraryTarget(decision.product.id))}
          >
            <span>{decision.action}</span>
            <ChevronRight size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function blockerQueueActionLabel(row = {}) {
  const autoItems = autoResolvableBlockerItems(row);
  if (autoItems.length > 1) return `处理 ${autoItems.length} 项`;
  const kind = autoItems[0]?.kind || row.primary?.kind;
  if (kind === "来源") return "补来源";
  if (kind === "商品卡") return "套草稿";
  if (kind === "素材" || kind === "合规") return "生成计划";
  if (kind === "账号") return row.accountFit?.account?.id ? "设推荐" : "补账号";
  if (kind === "验证") return "存验证";
  if (kind === "批次") return "看批次";
  return "处理";
}

function autoResolvableBlockerItems(row = {}) {
  const product = row.product || {};
  const seenKinds = new Set();
  return (row.items || []).filter((item) => {
    if (!item?.kind || seenKinds.has(item.kind)) return false;
    let canResolve = false;
    if (item.kind === "来源") canResolve = recommendedResearchSourcesForProduct(product).length > 0;
    if (item.kind === "商品卡") canResolve = Boolean(product.id);
    if (item.kind === "素材" || item.kind === "合规") canResolve = buildAssetCompletionPlan(product).rows.length > 0;
    if (item.kind === "账号") canResolve = Boolean(row.accountFit?.account?.id);
    if (item.kind === "验证") canResolve = assetVerificationGateForProduct(product, row.accountFit).computedStatus !== "blocked";
    if (canResolve) seenKinds.add(item.kind);
    return canResolve;
  });
}

function canAutoResolveBlockerQueueRow(row = {}) {
  return autoResolvableBlockerItems(row).length > 0;
}

function manualBlockerItems(row = {}) {
  const autoKinds = new Set(autoResolvableBlockerItems(row).map((item) => item.kind));
  return (row.items || []).filter((item) => !autoKinds.has(item.kind));
}

function manualAssignmentKey(product = {}, item = {}) {
  return [
    product.id || product.sku || "sku",
    item.kind || "待办",
    item.label || "",
    item.issue || ""
  ].map((part) => String(part || "").trim()).join("|");
}

function normalizeManualAssignmentLog(productOrLog = {}) {
  const source = Array.isArray(productOrLog) ? productOrLog : productOrLog.manualAssignmentLog;
  return (Array.isArray(source) ? source : [])
    .map((item, index) => {
      const key = String(item?.key || item?.id || "").trim();
      return {
        id: String(item?.id || key || `manual-assignment-${index}`),
        key,
        productId: String(item?.productId || ""),
        sku: String(item?.sku || ""),
        owner: String(item?.owner || "人工复核"),
        kind: String(item?.kind || "待办"),
        label: String(item?.label || "人工待办"),
        issue: String(item?.issue || ""),
        action: String(item?.action || ""),
        status: String(item?.status || "已签收"),
        assignedAt: item?.assignedAt || item?.createdAt || "",
        resolvedAt: item?.resolvedAt || item?.completedAt || "",
        updatedAt: item?.updatedAt || item?.assignedAt || ""
      };
    })
    .filter((item) => item.key)
    .slice(0, 80);
}

function findManualAssignment(product = {}, item = {}) {
  const key = manualAssignmentKey(product, item);
  return normalizeManualAssignmentLog(product).find((entry) => entry.key === key) || null;
}

function isManualAssignmentResolved(assignment = {}) {
  return /已处理|已完成|待复核/.test(String(assignment?.status || ""));
}

function manualAssignmentPatch(product = {}, entry = {}, nextStatus = "已签收") {
  const item = entry.item || {};
  const key = entry.assignmentKey || manualAssignmentKey(product, item);
  const existing = findManualAssignment(product, item);
  const now = new Date().toISOString();
  const resolved = /已处理|已完成|待复核/.test(String(nextStatus || ""));
  const record = {
    id: existing?.id || `manual-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    key,
    productId: product.id || "",
    sku: product.sku || "",
    owner: item.owner || entry.owner || "人工复核",
    kind: item.kind || "待办",
    label: item.label || "人工待办",
    issue: item.issue || "",
    action: item.action || "",
    status: nextStatus,
    assignedAt: existing?.assignedAt || now,
    resolvedAt: resolved ? existing?.resolvedAt || now : existing?.resolvedAt || "",
    updatedAt: now
  };
  return {
    manualAssignmentLog: [
      record,
      ...normalizeManualAssignmentLog(product).filter((log) => log.key !== key)
    ].slice(0, 80),
    manualAssignmentUpdatedAt: now
  };
}

function buildManualBlockerHandoffGroups(rows = []) {
  const groups = new Map();
  for (const row of rows || []) {
    const product = row.product || {};
    for (const item of manualBlockerItems(row)) {
      const owner = item.owner || "人工复核";
      if (!groups.has(owner)) {
        groups.set(owner, {
          owner,
          items: [],
          blocked: 0,
          warn: 0,
          signed: 0,
          resolved: 0
        });
      }
      const group = groups.get(owner);
      const assignment = findManualAssignment(product, item);
      const resolved = isManualAssignmentResolved(assignment);
      const entry = {
        id: `${product.id || product.sku}-${item.kind}-${group.items.length}`,
        assignmentKey: manualAssignmentKey(product, item),
        assignment,
        row,
        product,
        item,
        route: item.route || row.route || productLibraryTarget(product.id),
        priority: Number(item.weight || 0) + Number(product.totalScore || 0) / 10 + (item.tone === "bad" ? 40 : 12)
      };
      group.items.push(entry);
      if (assignment) group.signed += 1;
      if (resolved) group.resolved += 1;
      if (item.tone === "bad") group.blocked += 1;
      else group.warn += 1;
    }
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => b.priority - a.priority || b.product.totalScore - a.product.totalScore)
    }))
    .sort((a, b) => b.blocked - a.blocked || b.items.length - a.items.length || a.owner.localeCompare(b.owner, "zh-CN"));
}

function buildSelectionAssetQualityGates(command = {}, products = [], accounts = [], assetTasks = []) {
  const blockerQueue = command.blockerQueue || [];
  const sourceRows = command.sourceAuditRows || [];
  const riskRows = command.riskAuditRows || [];
  const readyRows = command.readyRows || [];
  const reviewRows = command.reviewBacklogRows || [];
  const testedRows = command.testedRows || [];
  const decisionRows = buildSelectionDecisionQueue(products, accounts);
  const decisionBlocked = decisionRows.filter((row) => row.tone === "bad").length;
  const decisionWarn = decisionRows.filter((row) => row.tone === "warn").length;
  const decisionReady = decisionRows.filter((row) => row.canCreateBatch || row.tone === "good").length;
  const manualGroups = buildManualBlockerHandoffGroups(blockerQueue);
  const manualItemCount = manualGroups.reduce((total, group) => total + group.items.length, 0);
  const sourceBlocked = sourceRows.filter((row) => row.researchTask?.status === "blocked").length;
  const sourceWarn = Math.max(0, sourceRows.length - sourceBlocked);
  const riskBlocked = riskRows.filter((row) => row.tone === "bad").length;
  const accountBlocked = blockerQueue.filter((row) => row.accountFit?.status && row.accountFit.status !== "pass").length;
  const assetBlocked = assetTasks.filter((task) => task.tone === "bad" || task.status === "拦截").length;
  const assetWarn = Math.max(0, assetTasks.length - assetBlocked);
  const verificationQueue = buildAssetVerificationQueue(products, accounts);
  const verificationBlocked = verificationQueue.filter((row) => row.snapshot.computedStatus === "blocked").length;
  const verificationNeedsSave = verificationQueue.filter((row) => row.snapshot.requiresSave).length;
  const verificationStale = verificationQueue.filter((row) => row.snapshot.isStale && row.snapshot.computedStatus !== "blocked").length;
  const manualSignedCount = manualGroups.reduce((total, group) => total + Number(group.signed || 0), 0);
  const manualResolvedCount = manualGroups.reduce((total, group) => total + Number(group.resolved || 0), 0);
  const manualUnsignedCount = Math.max(0, manualItemCount - manualSignedCount);
  const manualUnresolvedCount = Math.max(0, manualItemCount - manualResolvedCount);
  return [
    {
      id: "product",
      label: "商品池",
      status: products.length ? "已入库" : "待入库",
      detail: `${products.length} 个 SKU / ${accounts.length} 个账号资产`,
      action: products.length ? "可继续评分和分派" : "先导入候选商品",
      tone: products.length ? "good" : "bad",
      route: "productLibrary"
    },
    {
      id: "scoring",
      label: "选品评分",
      status: !products.length ? "待评分" : decisionBlocked ? "有拦截" : decisionWarn ? "待核" : "可测",
      detail: `${decisionReady} 个可测 / ${decisionBlocked} 个拦截 / ${decisionWarn} 个待核`,
      action: decisionBlocked ? "处理低于 75 分、合规或售后单项过低 SKU" : decisionWarn ? "复核待核 SKU 的评分维度和资产缺口" : "评分可支撑测品排序",
      tone: !products.length || decisionBlocked ? "bad" : decisionWarn ? "warn" : "good",
      route: "productScoring"
    },
    {
      id: "source",
      label: "来源证据",
      status: sourceBlocked ? "有拦截" : sourceWarn ? "待核" : "可用",
      detail: `${sourceBlocked} 个缺规则源 / ${sourceWarn} 个待核`,
      action: sourceBlocked || sourceWarn ? "补平台规则、榜单或商详来源" : "来源可进入生成",
      tone: sourceBlocked ? "bad" : sourceWarn ? "warn" : "good",
      route: "productLibrary"
    },
    {
      id: "asset",
      label: "资产补齐",
      status: assetBlocked ? "有拦截" : assetWarn ? "待补" : "可用",
      detail: `${assetBlocked} 个阻断 / ${assetWarn} 个待补`,
      action: assetTasks.length ? "先补主图、卖点、演示和商品卡字段" : "素材和商品卡可用",
      tone: assetBlocked ? "bad" : assetWarn ? "warn" : "good",
      route: "productLibrary"
    },
    {
      id: "account",
      label: "账号适配",
      status: accountBlocked ? "待分派" : accounts.length ? "可用" : "待建档",
      detail: `${accountBlocked} 个 SKU 缺账号适配 / ${accounts.length} 个账号`,
      action: accountBlocked ? "补人设、场景或推荐账号" : "账号可承接测试",
      tone: accountBlocked ? "warn" : accounts.length ? "good" : "bad",
      route: "accountAssets"
    },
    {
      id: "queue",
      label: "准入分派",
      status: blockerQueue.length ? "排队中" : "可测",
      detail: `${readyRows.length} 个可测 / ${manualItemCount} 个人工项 / ${manualSignedCount} 签收 / ${manualResolvedCount} 处理`,
      action: manualUnsignedCount ? "先签收人工分派，再处理自动项" : manualUnresolvedCount ? "签收负责人处理后标记待复核" : blockerQueue.length ? "复核仍在队列里的阻断项" : "可进入批量生成",
      tone: manualUnsignedCount || manualUnresolvedCount ? "warn" : blockerQueue.length ? "warn" : "good",
      route: "selectionAssets"
    },
    {
      id: "verification",
      label: "生成前验证",
      status: verificationBlocked ? "有拦截" : verificationStale ? "有过期" : verificationNeedsSave ? "待保存" : "可用",
      detail: `${verificationBlocked} 个验证阻断 / ${verificationStale} 个过期 / ${verificationNeedsSave} 个待保存`,
      action: verificationBlocked ? "先补资产和商品卡，再保存验证" : verificationStale ? "先重存已过期验证" : verificationNeedsSave ? "批量保存生成前资产验证" : "验证记录可追溯",
      tone: verificationBlocked ? "bad" : verificationNeedsSave ? "warn" : "good",
      route: "selectionAssets"
    },
    {
      id: "review",
      label: "回流复盘",
      status: reviewRows.length ? "待复盘" : testedRows.length ? "有回流" : "待测试",
      detail: `${testedRows.length} 个已回流 / ${reviewRows.length} 个待复盘`,
      action: reviewRows.length ? "把点击、转化和素材表现回写评分" : testedRows.length ? "继续观察批次表现" : "先建首批测试",
      tone: reviewRows.length ? "warn" : testedRows.length ? "good" : "info",
      route: "dataRecovery"
    },
    {
      id: "risk",
      label: "合规风险",
      status: riskBlocked ? "有拦截" : riskRows.length ? "待审" : "可用",
      detail: `${riskBlocked} 个拦截 / ${riskRows.length} 个风险待审`,
      action: riskBlocked || riskRows.length ? "核对功效、虚假承诺和 AIGC 标识" : "可进入脚本生成",
      tone: riskBlocked ? "bad" : riskRows.length ? "warn" : "good",
      route: "productLibrary"
    }
  ];
}

function buildSelectionClosureAudit({
  products = [],
  accounts = [],
  command = {},
  assetTasks = [],
  verificationQueue = [],
  manualGroups = []
} = {}) {
  const scopedProducts = (products || []).filter((product) => product?.id && product.lifecycle !== "淘汰");
  const testingProducts = scopedProducts.filter((product) => ["可测", "复测", "放大"].includes(product.lifecycle));
  const activeTestingProducts = testingProducts.filter((product) => hasActiveSelectionBatch(product));
  const verificationTargets = testingProducts.filter((product) => !hasActiveSelectionBatch(product));
  const scoreReady = scopedProducts.filter((product) => product.totalScore && product.scores && Object.keys(product.scores || {}).length).length;
  const cardRows = testingProducts.map((product) => ({ product, check: productCardPrecheck(product) }));
  const sourceRows = testingProducts.map((product) => ({ product, task: researchTaskSummaryForProduct(product) }));
  const accountRows = testingProducts.map((product) => ({ product, fit: accountFitSummaryForProduct(product, accounts) }));
  const planRows = scopedProducts.map((product) => ({
    product,
    computed: buildAssetCompletionPlan(product),
    saved: product.assetCompletionPlan
  }));
  const manualItemCount = manualGroups.reduce((total, group) => total + (group.items?.length || 0), 0);
  const manualUnsignedCount = manualGroups.reduce((total, group) => total + Math.max(0, (group.items?.length || 0) - Number(group.signed || 0)), 0);
  const manualUnresolvedCount = manualGroups.reduce((total, group) => total + Math.max(0, (group.items?.length || 0) - Number(group.resolved || 0)), 0);
  const cardGap = cardRows.filter((row) => row.check.status !== "pass").length;
  const sourceGap = sourceRows.filter((row) => row.task.status !== "pass").length;
  const accountGap = accountRows.filter((row) => row.fit.status !== "pass").length;
  const planGap = planRows.filter((row) => (row.computed.rows || []).length && !(row.saved?.rows || []).length).length;
  const verificationBlocked = verificationQueue.filter((row) => row.snapshot.computedStatus === "blocked").length;
  const verificationNeedsSave = verificationQueue.filter((row) => row.snapshot.computedStatus !== "blocked" && row.snapshot.requiresSave).length;
  const verificationStale = verificationQueue.filter((row) => row.snapshot.isStale && row.snapshot.computedStatus !== "blocked").length;
  const signedManual = Math.max(0, manualItemCount - manualUnsignedCount);
  const resolvedManual = Math.max(0, manualItemCount - manualUnresolvedCount);
  const rows = [
    {
      id: "score",
      label: "评分底账",
      status: scoreReady === scopedProducts.length ? "完整" : "待补",
      done: scoreReady,
      total: scopedProducts.length,
      gapCount: Math.max(0, scopedProducts.length - scoreReady),
      action: "补齐评分维度和生命周期，低于 75 分不进测品。",
      actionKind: "score",
      route: "productScoring"
    },
    {
      id: "source",
      label: "来源底账",
      status: sourceGap ? "待补来源" : "完整",
      done: Math.max(0, testingProducts.length - sourceGap),
      total: testingProducts.length,
      gapCount: sourceGap,
      action: sourceGap ? "批量补入基础规则源，剩余资质截图交人工。" : "可测 SKU 均有来源记录。",
      actionKind: sourceGap ? "source" : "",
      route: "productLibrary"
    },
    {
      id: "card",
      label: "商品卡草稿",
      status: cardGap ? "待套草稿" : "完整",
      done: Math.max(0, testingProducts.length - cardGap),
      total: testingProducts.length,
      gapCount: cardGap,
      action: cardGap ? "先套保守商品卡草稿，再补价格、规格、差评点。" : "商品卡承接已覆盖可测 SKU。",
      actionKind: cardGap ? "card" : "",
      route: "productLibrary"
    },
    {
      id: "plan",
      label: "补齐计划",
      status: planGap ? "待落库" : "完整",
      done: Math.max(0, scopedProducts.length - planGap),
      total: scopedProducts.length,
      gapCount: planGap,
      action: planGap ? "把自动拆出的素材、商品卡、凭证任务保存为计划。" : "补齐计划已可追踪。",
      actionKind: planGap ? "plan" : "",
      route: "productLibrary"
    },
    {
      id: "account",
      label: "账号承接",
      status: accountGap ? "待分派" : "完整",
      done: Math.max(0, testingProducts.length - accountGap),
      total: testingProducts.length,
      gapCount: accountGap,
      action: accountGap ? "补账号人设、DOC 包、平台绑定或推荐 SKU。" : "可测 SKU 已匹配账号承接。",
      actionKind: "account",
      route: "accountAssets"
    },
    {
      id: "verification",
      label: "生成前验证",
      status: verificationBlocked ? "有阻断" : verificationStale ? "有过期" : verificationNeedsSave ? "待保存" : "完整",
      done: Math.max(0, verificationTargets.length - verificationBlocked - verificationNeedsSave),
      total: verificationTargets.length,
      gapCount: verificationBlocked + verificationNeedsSave,
      action: verificationBlocked ? "先处理验证阻断项。" : verificationStale ? "重存已过期验证记录。" : verificationNeedsSave ? "保存带指纹的生成前验证。" : "验证记录可追溯。",
      actionKind: verificationBlocked ? "verification" : verificationNeedsSave ? "saveVerification" : "",
      route: "selectionAssets"
    },
    {
      id: "manual",
      label: "人工分派",
      status: manualItemCount ? manualUnresolvedCount ? "处理中" : "已闭环" : "无人工项",
      done: resolvedManual,
      total: manualItemCount,
      gapCount: manualUnresolvedCount,
      action: manualItemCount ? `${manualUnsignedCount} 项待签收，${manualUnresolvedCount} 项待复核闭环。` : "当前阻断项可自动处理或暂无人工项。",
      actionKind: "manual",
      route: "selectionAssets"
    }
  ].map((row) => ({
    ...row,
    percent: row.total ? Math.round((row.done / row.total) * 100) : 100,
    tone: row.gapCount ? row.id === "verification" && verificationBlocked ? "bad" : "warn" : "good"
  }));
  const gapCount = rows.reduce((total, row) => total + row.gapCount, 0);
  const blockedCount = rows.filter((row) => row.tone === "bad").length;
  const warnCount = rows.filter((row) => row.tone === "warn").length;
  const readyCount = rows.filter((row) => row.tone === "good").length;
  const autoBackfillCount = sourceGap + cardGap + planGap + verificationNeedsSave;
  const focus = rows.find((row) => row.tone === "bad") || rows.find((row) => row.tone === "warn") || rows[0];
  const coverage = rows.length ? Math.round(rows.reduce((total, row) => total + row.percent, 0) / rows.length) : 100;
  return {
    status: blockedCount ? "有阻断" : warnCount ? "待补底账" : "闭环完整",
    tone: blockedCount ? "bad" : warnCount ? "warn" : "good",
    coverage,
    scopedCount: scopedProducts.length,
    testingCount: testingProducts.length,
    activeTestingCount: activeTestingProducts.length,
    gapCount,
    autoBackfillCount,
    blockedCount,
    warnCount,
    readyCount,
    focus,
    rows
  };
}

function closureAuditText(audit = {}) {
  const lines = [
    `选品与资产闭环覆盖率：${audit.coverage || 0}%｜${audit.status || "待审"}`,
    `范围：${audit.scopedCount || 0} 个有效 SKU / ${audit.testingCount || 0} 个可测 SKU / ${audit.activeTestingCount || 0} 个测试中 SKU`,
    `缺口：${audit.gapCount || 0} 项；可自动补：${audit.autoBackfillCount || 0} 项；阻断关卡：${audit.blockedCount || 0}；待补关卡：${audit.warnCount || 0}`,
    ""
  ];
  (audit.rows || []).forEach((row, index) => {
    lines.push(`${index + 1}. ${row.label}｜${row.status}｜${row.done}/${row.total}｜${row.percent}%｜下一步：${row.action}`);
  });
  return lines.join("\n");
}

function qualityGateText(gates = []) {
  const lines = [`选品与资产落地验收（${new Date().toLocaleString("zh-CN", { hour12: false })}）`];
  gates.forEach((gate, index) => {
    lines.push(`${index + 1}. ${gate.label}｜${gate.status}｜${gate.detail}｜下一步：${gate.action}`);
  });
  return lines.join("\n");
}

function SelectionAssetQualityGatePanel({ gates = [], navigate, onCopy }) {
  if (!gates.length) return null;
  const blockedCount = gates.filter((gate) => gate.tone === "bad").length;
  const warnCount = gates.filter((gate) => gate.tone === "warn").length;
  const readyCount = gates.filter((gate) => gate.tone === "good").length;
  const focusGate = gates.find((gate) => gate.tone === "bad") || gates.find((gate) => gate.tone === "warn") || gates[0];
  return (
    <div className="panel quality-gate-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <ShieldCheck size={17} />
            <strong>落地验收状态</strong>
          </div>
          <p>把选品与资产模块拆成可验收关卡，先处理会阻断生成和发布回流的缺口。</p>
        </div>
        <div className="quality-gate-side">
          <div className="quality-gate-focus">
            <span>当前焦点</span>
            <strong>{focusGate.label} · {focusGate.status}</strong>
          </div>
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制验收</span>
          </button>
        </div>
      </div>
      <div className="quality-gate-summary">
        <div><span>通过</span><strong>{readyCount}</strong></div>
        <div><span>待处理</span><strong>{warnCount}</strong></div>
        <div><span>阻断</span><strong>{blockedCount}</strong></div>
        <div><span>关卡</span><strong>{gates.length}</strong></div>
      </div>
      <div className="quality-gate-list">
        {gates.map((gate) => (
          <button className={`quality-gate-row ${gate.tone}`} type="button" key={gate.id} onClick={() => navigate(gate.route || "selectionAssets")}>
            <div>
              <strong>{gate.label}</strong>
              <span>{gate.detail}</span>
              <small>{gate.action}</small>
            </div>
            <em>{gate.status}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectionClosureAuditPanel({
  audit,
  navigate,
  onCopy,
  onSource,
  onPlan,
  onCard,
  onVerification,
  onBackfill,
  busy = {},
  disabled = {}
}) {
  if (!audit) return null;
  const actionConfig = {
    source: { label: busy.source ? "补入中" : "补来源", icon: BookOpen, onClick: onSource, disabled: disabled.source || busy.source },
    plan: { label: busy.plan ? "生成中" : "存计划", icon: ListChecks, onClick: onPlan, disabled: disabled.plan || busy.plan },
    card: { label: busy.card ? "套用中" : "套商品卡", icon: Sparkles, onClick: onCard, disabled: disabled.card || busy.card },
    saveVerification: { label: busy.verification ? "保存中" : "存验证", icon: ShieldCheck, onClick: onVerification, disabled: disabled.verification || busy.verification }
  };
  return (
    <div className={`panel closure-audit-panel ${audit.tone || "warn"}`}>
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <Gauge size={17} />
            <strong>闭环覆盖率体检</strong>
          </div>
          <p>把评分、来源、商品卡、补齐计划、账号、验证和人工分派压成一张底账表，优先补会阻断测品的缺口。</p>
        </div>
        <div className="closure-audit-side">
          <div className="closure-audit-score">
            <span>覆盖率</span>
            <strong>{audit.coverage}%</strong>
          </div>
          <button className="primary-button" type="button" onClick={onBackfill} disabled={disabled.backfill || busy.backfill}>
            <Workflow size={16} />
            <span>{busy.backfill ? "补齐中" : "一键补底账"}</span>
          </button>
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制体检</span>
          </button>
        </div>
      </div>
      <div className="closure-audit-summary">
        <div><span>状态</span><strong>{audit.status}</strong></div>
        <div><span>有效 SKU</span><strong>{audit.scopedCount}</strong></div>
        <div><span>可测 SKU</span><strong>{audit.testingCount}</strong></div>
        <div><span>缺口</span><strong>{audit.gapCount}</strong></div>
        <div><span>可自动补</span><strong>{audit.autoBackfillCount}</strong></div>
        <div><span>通过关卡</span><strong>{audit.readyCount}</strong></div>
      </div>
      <div className="closure-audit-list">
        {(audit.rows || []).map((row) => {
          const config = actionConfig[row.actionKind];
          const Icon = config?.icon || ChevronRight;
          return (
            <div className={`closure-audit-row ${row.tone}`} key={row.id}>
              <div>
                <strong>{row.label}</strong>
                <span>{row.status} · {row.done}/{row.total} · {row.percent}%</span>
                <small>{row.action}</small>
              </div>
              {config ? (
                <button className="secondary-button" type="button" onClick={config.onClick} disabled={config.disabled}>
                  <Icon size={15} />
                  <span>{config.label}</span>
                </button>
              ) : (
                <button className="secondary-button" type="button" onClick={() => navigate(row.route || "selectionAssets")}>
                  <Icon size={15} />
                  <span>查看</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LaunchReadinessAuditPanel({ audit, onCopy, onExport, onCreateBatch }) {
  if (!audit) return null;
  const rows = audit.rows || [];
  const saveCount = audit.saveRows?.length || 0;
  const warnCount = audit.warnRows?.length || 0;
  return (
    <div className={`panel launch-audit-panel ${audit.tone || "warn"}`}>
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <Play size={17} />
            <strong>首批测品就绪审计</strong>
          </div>
          <p>{audit.summary}</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制审计</span>
          </button>
          <button className="secondary-button" type="button" onClick={onExport}>
            <Download size={16} />
            <span>导出审计</span>
          </button>
          <button className="primary-button" type="button" disabled={!audit.canCreateBatch} onClick={() => onCreateBatch?.(rows.map((row) => row.product), { autoStart: false })}>
            <ListChecks size={16} />
            <span>{rows.length ? `建 ${rows.length} 条草稿` : "暂无可建"}</span>
          </button>
        </div>
      </div>
      <div className="launch-audit-summary">
        <div><span>结论</span><strong>{audit.status}</strong></div>
        <div><span>首批 SKU</span><strong>{rows.length}</strong></div>
        <div><span>均分</span><strong>{audit.averageScore || 0}</strong></div>
        <div><span>账号覆盖</span><strong>{audit.accountCount || 0}</strong></div>
        <div><span>待保存/待核</span><strong>{saveCount}/{warnCount}</strong></div>
      </div>
      <div className="launch-audit-list">
        {rows.length ? rows.map((row, index) => (
          <div className={`launch-audit-row ${row.tone || "warn"}`} key={row.product?.id || row.product?.sku || index}>
            <span className="selection-task-rank">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <div className="selection-task-title">
                <strong>{row.product?.sku || "未命名 SKU"}</strong>
                <span>{row.launchLabel}</span>
                <em>{row.product?.totalScore || 0} 分</em>
              </div>
              <p>{row.assetVerification?.requiresSave ? row.assetVerification.primaryAction : row.reason}</p>
              <small>账号：{row.account?.name || row.accountFit?.account?.name || "未匹配"} · {row.launchWarnings?.length ? row.launchWarnings.join("、") : "无待核项"}</small>
            </div>
            <em>{row.stage}</em>
          </div>
        )) : (
          <div className="launch-audit-empty">
            <strong>{audit.status}</strong>
            <span>{audit.action}</span>
            {audit.blockerFallback ? <small>{audit.blockerFallback.product?.sku} · {audit.blockerFallback.primary?.issue}</small> : null}
          </div>
        )}
      </div>
    </div>
  );
}

function SelectionBlockerQueuePanel({ rows = [], navigate, onExport, onCreateBatch, onResolveRow, onResolveBatch, resolvingId = "", batchResolving = false }) {
  const [queueFilter, setQueueFilter] = useState("all");
  const [showAllQueueRows, setShowAllQueueRows] = useState(false);
  useEffect(() => {
    setShowAllQueueRows(false);
  }, [queueFilter]);
  if (!rows.length) return null;
  const blockedCount = rows.filter((row) => row.blockedCount > 0).length;
  const allCanQueueRows = rows.filter((row) => row.canQueue);
  const canQueueRows = allCanQueueRows.slice(0, 6);
  const allAutoResolveRows = rows.filter(canAutoResolveBlockerQueueRow);
  const autoResolveRows = allAutoResolveRows.slice(0, 6);
  const autoItemCount = rows.reduce((total, row) => total + autoResolvableBlockerItems(row).length, 0);
  const manualRows = rows.filter((row) => manualBlockerItems(row).length);
  const manualItemCount = rows.reduce((total, row) => total + manualBlockerItems(row).length, 0);
  const sourceCount = rows.filter((row) => row.items.some((item) => item.kind === "来源")).length;
  const cardCount = rows.filter((row) => row.items.some((item) => item.kind === "商品卡")).length;
  const filterOptions = [
    { id: "all", label: "全部", count: rows.length },
    { id: "auto", label: "自动", count: allAutoResolveRows.length },
    { id: "manual", label: "人工", count: manualRows.length },
    { id: "ready", label: "可建", count: allCanQueueRows.length }
  ];
  const filteredRows = rows.filter((row) => {
    if (queueFilter === "auto") return canAutoResolveBlockerQueueRow(row);
    if (queueFilter === "manual") return manualBlockerItems(row).length > 0;
    if (queueFilter === "ready") return row.canQueue;
    return true;
  });
  const visibleRows = showAllQueueRows ? filteredRows : filteredRows.slice(0, 8);
  const hiddenCount = Math.max(0, filteredRows.length - visibleRows.length);
  return (
    <div className="panel selection-blocker-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <ShieldCheck size={17} />
            <strong>SKU 准入拦截队列</strong>
          </div>
          <p>集中查看不能直接进批次的 SKU：素材、商品卡、来源、合规、账号和生命周期按优先级排队。</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onExport} disabled={!rows.length}>
            <Download size={16} />
            <span>导出队列</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => onResolveBatch?.(autoResolveRows)} disabled={!autoResolveRows.length || batchResolving}>
            <ShieldCheck size={16} />
            <span>{batchResolving ? "处理中" : `批量处理 ${autoResolveRows.length}`}</span>
          </button>
          <button className="primary-button" type="button" onClick={() => onCreateBatch?.(canQueueRows.map((row) => row.product), { autoStart: false })} disabled={!canQueueRows.length || batchResolving}>
            <ListChecks size={16} />
            <span>{canQueueRows.length ? `建 ${canQueueRows.length} 条保守草稿` : "暂无可建"}</span>
          </button>
        </div>
      </div>
      <div className="selection-blocker-summary">
        <div><span>队列 SKU</span><strong>{rows.length}</strong></div>
        <div><span>准入拦截</span><strong>{blockedCount}</strong></div>
        <div><span>自动可处理</span><strong>{allAutoResolveRows.length}/{autoItemCount}</strong></div>
        <div><span>人工待办</span><strong>{manualRows.length}/{manualItemCount}</strong></div>
        <div><span>可保守建</span><strong>{allCanQueueRows.length}</strong></div>
        <div><span>来源/商品卡</span><strong>{sourceCount}/{cardCount}</strong></div>
      </div>
      <div className="selection-blocker-filter" role="tablist" aria-label="准入队列筛选">
        {filterOptions.map((option) => (
          <button
            className={queueFilter === option.id ? "active" : ""}
            type="button"
            key={option.id}
            onClick={() => setQueueFilter(option.id)}
          >
            <span>{option.label}</span>
            <strong>{option.count}</strong>
          </button>
        ))}
      </div>
      <div className="selection-blocker-visible">
        <span>当前显示 {visibleRows.length}/{filteredRows.length} 个 SKU</span>
        {filteredRows.length > 8 ? (
          <button className="secondary-button" type="button" onClick={() => setShowAllQueueRows((value) => !value)}>
            <ChevronRight size={15} />
            <span>{showAllQueueRows ? "收起" : `展开 ${hiddenCount} 个`}</span>
          </button>
        ) : null}
      </div>
      <div className="selection-blocker-list">
        {visibleRows.map((row, index) => {
          const autoItems = autoResolvableBlockerItems(row);
          const manualItems = manualBlockerItems(row);
          return (
            <div className={`selection-blocker-row ${row.tone}`} key={row.product.id}>
              <div className="selection-task-rank">{String(index + 1).padStart(2, "0")}</div>
              <div className="selection-blocker-main">
                <div className="selection-task-title">
                  <strong>{row.product.sku}</strong>
                  <span>{row.statusLabel}</span>
                  <em>{row.primary.kind}</em>
                </div>
                <p>{row.primary.issue}</p>
                <small>{row.primary.action}</small>
                <div className="selection-blocker-tags">
                  {row.items.slice(0, 5).map((item) => (
                    <span className={item.tone} key={`${row.product.id}-${item.kind}`}>
                      {item.kind}：{item.label}
                    </span>
                  ))}
                </div>
                <div className="selection-blocker-split">
                  <span>自动 {autoItems.length ? autoItems.map((item) => item.kind).join("、") : "无"}</span>
                  <span>人工 {manualItems.length ? manualItems.map((item) => item.kind).join("、") : "无"}</span>
                </div>
              </div>
              <div className="selection-task-row-actions">
                {row.canQueue ? (
                  <button className="primary-button" type="button" onClick={() => onCreateBatch?.([row.product], { autoStart: false })}>
                    <Play size={15} />
                    <span>建草稿</span>
                  </button>
                ) : null}
                <button className="secondary-button" type="button" disabled={batchResolving || resolvingId === row.product.id} onClick={() => onResolveRow?.(row)}>
                  <ShieldCheck size={15} />
                  <span>{batchResolving || resolvingId === row.product.id ? "处理中" : blockerQueueActionLabel(row)}</span>
                </button>
                <button className="secondary-button" type="button" onClick={() => navigate(row.route || productLibraryTarget(row.product.id))}>
                  <ChevronRight size={15} />
                  <span>{row.primary.owner}</span>
                </button>
              </div>
            </div>
          );
        })}
        {!filteredRows.length ? <p className="selection-muted">当前筛选下暂无 SKU。</p> : null}
      </div>
    </div>
  );
}

function ManualBlockerHandoffPanel({ groups = [], navigate, onCopy, onCopyGroup, onExport, onClaim, onResolve, claimingKey = "" }) {
  const totalItems = groups.reduce((total, group) => total + group.items.length, 0);
  if (!totalItems) return null;
  const blockedCount = groups.reduce((total, group) => total + group.blocked, 0);
  const warnCount = groups.reduce((total, group) => total + group.warn, 0);
  const signedCount = groups.reduce((total, group) => total + group.signed, 0);
  const resolvedCount = groups.reduce((total, group) => total + group.resolved, 0);
  return (
    <div className="panel manual-handoff-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <Clipboard size={17} />
            <strong>人工待办分派</strong>
          </div>
          <p>把准入队列里无法自动处理的事项按负责人拆开，优先处理拦截项，再处理待核项。</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制分派</span>
          </button>
          <button className="secondary-button" type="button" onClick={onExport}>
            <Download size={16} />
            <span>导出分派</span>
          </button>
        </div>
      </div>
      <div className="manual-handoff-summary">
        <div><span>负责人</span><strong>{groups.length}</strong></div>
        <div><span>人工事项</span><strong>{totalItems}</strong></div>
        <div><span>签收</span><strong>{signedCount}/{warnCount + blockedCount}</strong></div>
        <div><span>处理</span><strong>{resolvedCount}/{warnCount + blockedCount}</strong></div>
      </div>
      <div className="manual-handoff-grid">
        {groups.map((group) => (
          <div className="manual-handoff-column" key={group.owner}>
            <div className="manual-handoff-head">
              <div className="manual-handoff-title">
                <strong>{group.owner}</strong>
                <span>{group.items.length} 项 · {group.blocked} 拦截 / {group.warn} 待核 · {group.signed} 签收 · {group.resolved} 处理</span>
              </div>
              <button className="manual-handoff-copy" type="button" onClick={() => onCopyGroup?.(group)}>
                <Copy size={14} />
                <span>复制</span>
              </button>
            </div>
            <div className="manual-handoff-list">
              {group.items.slice(0, 4).map((entry) => {
                const signed = Boolean(entry.assignment);
                const resolved = isManualAssignmentResolved(entry.assignment);
                const busy = claimingKey === entry.assignmentKey;
                return (
                  <div className={`manual-handoff-item ${entry.item.tone} ${signed ? "signed" : ""} ${resolved ? "resolved" : ""}`} key={entry.id}>
                    <strong>{entry.product.sku}</strong>
                    <span>{entry.item.kind} · {entry.item.label}</span>
                    <small>{entry.item.issue}</small>
                    <em>{entry.item.action}</em>
                    {signed ? <small>签收：{entry.assignment.owner} · {formatDate(entry.assignment.assignedAt)}</small> : null}
                    {resolved ? <small>处理：已处理待复核 · {formatDate(entry.assignment.resolvedAt)}</small> : null}
                    <div className="manual-handoff-item-actions">
                      <button type="button" onClick={() => navigate(entry.route)}>
                        <ChevronRight size={14} />
                        <span>打开</span>
                      </button>
                      <button type="button" onClick={() => onClaim?.(entry)} disabled={signed || busy}>
                        {signed ? <CheckCircle2 size={14} /> : <Clipboard size={14} />}
                        <span>{busy ? "写入中" : signed ? "已签收" : "签收"}</span>
                      </button>
                      <button type="button" onClick={() => onResolve?.(entry)} disabled={!signed || resolved || busy}>
                        <CheckCircle2 size={14} />
                        <span>{busy ? "写入中" : resolved ? "已处理" : "处理完成"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              {group.items.length > 4 ? (
                <div className="manual-handoff-more">
                  <span>还有 {group.items.length - 4} 项未展开</span>
                  <button type="button" onClick={() => onCopyGroup?.(group)}>
                    复制全部
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyExecutionPanel({ rows = [], navigate, onCopy, onExport, doneMap = {}, onToggleDone, onClearDone }) {
  const [laneFilter, setLaneFilter] = useState("all");
  const [showAllExecutionRows, setShowAllExecutionRows] = useState(false);
  useEffect(() => {
    setShowAllExecutionRows(false);
  }, [laneFilter, rows.length]);
  if (!rows.length) return null;
  const pendingRows = rows.filter((row) => !doneMap[dailyExecutionRowKey(row)]);
  const urgentCount = pendingRows.filter((row) => row.priority === "高").length;
  const lanes = [...new Set(rows.map((row) => row.lane))]
    .sort((a, b) => (dailyExecutionLaneRank[a] ?? 9) - (dailyExecutionLaneRank[b] ?? 9));
  const laneOptions = [
    { id: "all", label: "全部", count: rows.length },
    ...lanes.map((lane) => ({
      id: lane,
      label: lane,
      count: rows.filter((row) => row.lane === lane).length
    }))
  ];
  const doneCount = rows.filter((row) => doneMap[dailyExecutionRowKey(row)]).length;
  const sortedRows = sortDailyExecutionRows(rows, doneMap);
  const filteredRows = laneFilter === "all" ? sortedRows : sortedRows.filter((row) => row.lane === laneFilter);
  const visibleRows = showAllExecutionRows ? filteredRows : filteredRows.slice(0, 12);
  const hiddenCount = Math.max(0, filteredRows.length - visibleRows.length);
  return (
    <div className="panel daily-execution-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <ListChecks size={17} />
            <strong>今日执行清单</strong>
          </div>
          <p>把风险审计、补资产、待回流、待复盘和首批草稿合并成当天可执行队列。</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制</span>
          </button>
          <button className="secondary-button" type="button" onClick={onExport}>
            <Download size={16} />
            <span>导出</span>
          </button>
          <button className="secondary-button" type="button" onClick={onClearDone} disabled={!doneCount}>
            <RefreshCw size={16} />
            <span>重置</span>
          </button>
        </div>
      </div>
      <div className="daily-execution-summary">
        <div><span>待处理</span><strong>{pendingRows.length}</strong></div>
        <div><span>高优先待办</span><strong>{urgentCount}</strong></div>
        <div><span>模块</span><strong>{lanes.length}</strong></div>
        <div><span>已完成</span><strong>{doneCount}</strong></div>
      </div>
      <div className="daily-execution-filter" role="tablist" aria-label="今日执行清单筛选">
        {laneOptions.map((option) => (
          <button
            className={laneFilter === option.id ? "active" : ""}
            type="button"
            key={option.id}
            onClick={() => setLaneFilter(option.id)}
          >
            <span>{option.label}</span>
            <strong>{option.count}</strong>
          </button>
        ))}
      </div>
      <div className="daily-execution-visible">
        <span>当前显示 {visibleRows.length}/{filteredRows.length} 条待办</span>
        {filteredRows.length > 12 ? (
          <button className="secondary-button" type="button" onClick={() => setShowAllExecutionRows((value) => !value)}>
            <ChevronRight size={15} />
            <span>{showAllExecutionRows ? "收起" : `展开 ${hiddenCount} 条`}</span>
          </button>
        ) : null}
      </div>
      <div className="daily-execution-list">
        {visibleRows.map((row, index) => {
          const rowKey = dailyExecutionRowKey(row);
          const done = Boolean(doneMap[rowKey]);
          return (
            <div className={`daily-execution-row ${row.tone || "warn"} ${done ? "done" : ""}`} key={`${rowKey}-${index}`}>
              <button className="daily-execution-open" type="button" onClick={() => navigate(row.route || "productLibrary")}>
                <span className="daily-execution-rank">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{row.sku}</strong>
                  <span>{row.lane} · {row.action}</span>
                  <small>{row.detail}</small>
                  {row.complianceLabel && row.complianceLabel !== "合规可用" ? (
                    <small>{row.complianceLabel} · {row.complianceAction || "待核"}</small>
                  ) : null}
                  {row.researchLabel && row.researchLabel !== "来源可用" ? (
                    <small>{row.researchLabel} · {row.researchAction || "待核"}</small>
                  ) : null}
                  {row.assetPlanLabel && row.assetPlanLabel !== "补齐计划可用" ? (
                    <small>{row.assetPlanLabel} · {row.assetPlanAction || "待补"}</small>
                  ) : null}
                  {row.accountLabel && row.accountLabel !== "账号适配可用" ? (
                    <small>{row.accountLabel} · {row.accountAction || "待核"}</small>
                  ) : null}
                  {row.evidenceLabel && row.evidenceLabel !== "证据包可用" ? (
                    <small>{row.evidenceLabel} · {row.evidenceAction || "待补"}</small>
                  ) : null}
                </div>
                <em>{row.priority}</em>
              </button>
              <button className="daily-execution-done" type="button" onClick={() => onToggleDone?.(row)}>
                <ShieldCheck size={15} />
                <span>{done ? "已完成" : "完成"}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssetPlanOwnerBoard({ groups = [], navigate, onExport, onResolveItem, updatingKey = "" }) {
  const totalItems = groups.reduce((total, group) => total + group.items.length, 0);
  const blockedItems = groups.reduce((total, group) => total + group.blocked, 0);
  const skuCount = new Set(groups.flatMap((group) => group.items.map((item) => item.product.id))).size;
  const canQuickResolve = (item) => item.row.slotId === "research-source" || String(item.row.id || "").startsWith("card-") || String(item.row.id || "").endsWith("-collect");
  const quickResolveLabel = (item) => {
    if (item.row.slotId === "research-source") return "补来源";
    if (String(item.row.id || "").startsWith("card-")) return "套草稿";
    return "标已补";
  };
  if (!groups.length) return null;
  return (
    <div className="panel asset-owner-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <ListChecks size={17} />
            <strong>资产补齐执行看板</strong>
          </div>
          <p>把补齐计划按负责人拆成执行队列，素材、商品卡、调研和商家资质可以分别推进。</p>
        </div>
        <button className="secondary-button" type="button" onClick={onExport}>
          <Download size={16} />
          <span>导出看板</span>
        </button>
      </div>
      <div className="asset-owner-summary">
        <div><span>待办</span><strong>{totalItems}</strong></div>
        <div><span>阻断</span><strong>{blockedItems}</strong></div>
        <div><span>SKU</span><strong>{skuCount}</strong></div>
        <div><span>负责人</span><strong>{groups.length}</strong></div>
      </div>
      <div className="asset-owner-grid">
        {groups.map((group) => (
          <div className="asset-owner-column" key={group.owner}>
            <div className="asset-owner-column-head">
              <strong>{group.owner}</strong>
              <span>{group.items.length} 项 · {group.skuCount} 个 SKU</span>
              <small>{group.blocked} 阻断 / {group.warn} 待核</small>
            </div>
            <div className="asset-owner-list">
              {group.items.slice(0, 5).map((item) => {
                const itemKey = `${item.product.id}-${item.row.id}`;
                const resolving = updatingKey === itemKey;
                return (
                  <div className={`asset-owner-item ${item.row.tone}`} key={itemKey}>
                    <button className="asset-owner-open" type="button" onClick={() => navigate(item.route)}>
                      <strong>{item.product.sku}</strong>
                      <span>{item.row.label} · {item.row.status}</span>
                      <small>{item.row.action}</small>
                      <em>{item.row.doneWhen}</em>
                    </button>
                    <div className="asset-owner-actions">
                      {canQuickResolve(item) ? (
                        <button className="secondary-button" type="button" disabled={resolving} onClick={() => onResolveItem?.(item)}>
                          <ShieldCheck size={14} />
                          <span>{resolving ? "处理中" : quickResolveLabel(item)}</span>
                        </button>
                      ) : null}
                      <button className="secondary-button" type="button" onClick={() => navigate(item.route)}>
                        <ChevronRight size={14} />
                        <span>详情</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetVerificationQueuePanel({ rows = [], navigate, onCopy, onSaveRows, saving = false }) {
  if (!rows.length) return null;
  const blockedCount = rows.filter((row) => row.snapshot.computedStatus === "blocked").length;
  const saveReadyRows = rows.filter((row) => row.snapshot.computedStatus !== "blocked" && row.snapshot.requiresSave);
  const staleCount = rows.filter((row) => row.snapshot.isStale && row.snapshot.computedStatus !== "blocked").length;
  const warnCount = rows.filter((row) => row.snapshot.status === "warn" && row.snapshot.computedStatus !== "blocked").length;
  return (
    <div className="panel asset-verification-queue-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <ShieldCheck size={17} />
            <strong>生成前验证队列</strong>
          </div>
          <p>把已经进入可测、复测、放大的 SKU 拉出来做最后验证；阻断先回商品库补资产，通过或待核可保存验证记录。</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制队列</span>
          </button>
          <button className="secondary-button" type="button" disabled={!saveReadyRows.length || saving} onClick={() => onSaveRows?.(saveReadyRows.slice(0, 8))}>
            <ShieldCheck size={16} />
            <span>{saving ? "保存中" : `保存 ${saveReadyRows.length}`}</span>
          </button>
        </div>
      </div>
      <div className="asset-verification-queue-summary">
        <div><span>队列 SKU</span><strong>{rows.length}</strong></div>
        <div><span>验证阻断</span><strong>{blockedCount}</strong></div>
        <div><span>验证待核</span><strong>{warnCount}</strong></div>
        <div><span>验证过期</span><strong>{staleCount}</strong></div>
        <div><span>待保存</span><strong>{saveReadyRows.length}</strong></div>
      </div>
      <div className="asset-verification-queue-list">
        {rows.slice(0, 8).map((row) => (
          <div className={`asset-verification-queue-row ${row.tone}`} key={row.product.id}>
            <span className="asset-verification-state">{row.snapshot.status === "blocked" ? "阻断" : row.snapshot.isStale ? "过期" : row.snapshot.requiresSave ? "待存" : row.snapshot.status === "warn" ? "待核" : "通过"}</span>
            <div>
              <strong>{row.product.sku}</strong>
              <span>{row.snapshot.label} · {row.accountFit.account?.name || "未匹配账号"}</span>
              <small>{row.snapshot.summary}</small>
            </div>
            <div className="asset-verification-queue-actions">
              <button className="secondary-button" type="button" onClick={() => navigate(productLibraryTarget(row.product.id))}>
                <ChevronRight size={15} />
                <span>{row.snapshot.computedStatus === "blocked" ? "补资产" : "详情"}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetRecentActivityPanel({ rows = [], navigate, onExport }) {
  if (!rows.length) return null;
  return (
    <div className="panel asset-activity-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <Activity size={17} />
            <strong>资产处理记录</strong>
          </div>
          <p>记录系统自动补来源、套商品卡草稿、素材标记和补齐计划生成，方便复盘资产变化。</p>
        </div>
        <button className="secondary-button" type="button" onClick={onExport}>
          <Download size={16} />
          <span>导出记录</span>
        </button>
      </div>
      <div className="asset-activity-list">
        {rows.map(({ product, log }) => (
          <button className="asset-activity-row" type="button" key={`${product.id}-${log.id}`} onClick={() => navigate(productLibraryTarget(product.id))}>
            <div>
              <strong>{product.sku}</strong>
              <span>{log.type} · {log.label}</span>
              <small>{log.detail || log.target || "资产处理"}</small>
            </div>
            <em>{formatDate(log.createdAt)}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function AssetActionLogPanel({ logs = [] }) {
  return (
    <div className="asset-section asset-log-panel">
      <div className="mini-panel-head">
        <Activity size={17} />
        <strong>资产处理记录</strong>
      </div>
      <div className="asset-log-list">
        {logs.slice(0, 8).map((log) => (
          <div className="asset-log-row" key={log.id}>
            <div>
              <strong>{log.type} · {log.label}</strong>
              <span>{log.detail || log.target || "资产处理"}</span>
            </div>
            <em>{formatDate(log.createdAt)}</em>
          </div>
        ))}
        {!logs.length ? <p className="selection-muted">暂无资产处理记录。</p> : null}
      </div>
    </div>
  );
}

function SelectionAssetsOverviewPage({ selectionAssets, navigate, onRefresh, onCreateBatch, onStartBatch, onUpdateProduct, onBulkUpdateProducts, onSaveAccount }) {
  const products = useMemo(() => sortedSelectionProducts(selectionAssets?.products), [selectionAssets]);
  const accounts = selectionAssets?.accounts?.length ? selectionAssets.accounts : accountAssetSeeds;
  const command = useMemo(() => buildSelectionAssetCommandCenter(products, accounts), [products, accounts]);
  const assetTasks = useMemo(() => buildSelectionAssetTasks(command), [command]);
  const executionRows = useMemo(() => dailyExecutionRows(command, assetTasks), [command, assetTasks]);
  const manualHandoffGroups = useMemo(() => buildManualBlockerHandoffGroups(command.blockerQueue), [command]);
  const qualityGates = useMemo(() => buildSelectionAssetQualityGates(command, products, accounts, assetTasks), [command, products, accounts, assetTasks]);
  const launchAudit = useMemo(() => buildLaunchReadinessAudit(command, accounts), [command, accounts]);
  const accountAudit = useMemo(() => buildAccountCoverageAudit(products, accounts), [products, accounts]);
  const assetOwnerGroups = useMemo(() => buildAssetPlanOwnerBoard(products), [products]);
  const assetVerificationQueue = useMemo(() => buildAssetVerificationQueue(products, accounts), [products, accounts]);
  const closureAudit = useMemo(() => buildSelectionClosureAudit({
    products,
    accounts,
    command,
    assetTasks,
    verificationQueue: assetVerificationQueue,
    manualGroups: manualHandoffGroups
  }), [products, accounts, command, assetTasks, assetVerificationQueue, manualHandoffGroups]);
  const assetActionRows = useMemo(() => recentAssetActionRows(products, 10), [products]);
  const cardDraftTaskCount = useMemo(() => assetTasks.filter((task) => task.kind === "cardField").length, [assetTasks]);
  const [taskCopyMessage, setTaskCopyMessage] = useState("");
  const [taskUpdatingId, setTaskUpdatingId] = useState("");
  const [accountUpdatingKey, setAccountUpdatingKey] = useState("");
  const [batchStartingId, setBatchStartingId] = useState("");
  const [sourceUpdating, setSourceUpdating] = useState(false);
  const [assetPlanUpdating, setAssetPlanUpdating] = useState(false);
  const [cardDraftUpdating, setCardDraftUpdating] = useState(false);
  const [assetVerificationUpdating, setAssetVerificationUpdating] = useState(false);
  const [closureBackfilling, setClosureBackfilling] = useState(false);
  const [blockerResolvingId, setBlockerResolvingId] = useState("");
  const [blockerBatchResolving, setBlockerBatchResolving] = useState(false);
  const [assetBoardUpdatingKey, setAssetBoardUpdatingKey] = useState("");
  const [manualClaimingKey, setManualClaimingKey] = useState("");
  const [dailyDoneMap, setDailyDoneMap] = useState(readDailyExecutionDoneMap);
  const topAccounts = accounts.slice(0, 5).map((account) => ({
    account,
    rows: command.rows.filter((row) => row.account?.id === account.id)
  }));

  async function copyAssetTasks() {
    try {
      await navigator.clipboard.writeText(selectionAssetTaskText(assetTasks.slice(0, 12)));
      setTaskCopyMessage(`已复制 ${Math.min(assetTasks.length, 12)} 条任务`);
    } catch {
      setTaskCopyMessage("复制失败，可直接导出 CSV");
    }
  }

  async function copyDailyExecution() {
    try {
      await navigator.clipboard.writeText(dailyExecutionText(executionRows, dailyDoneMap));
      setTaskCopyMessage(`已复制今日执行清单 ${executionRows.length} 条`);
    } catch {
      setTaskCopyMessage("复制失败，可导出 CSV");
    }
  }

  async function copyQualityGateSummary() {
    try {
      await navigator.clipboard.writeText(qualityGateText(qualityGates));
      setTaskCopyMessage(`已复制落地验收状态 ${qualityGates.length} 个关卡`);
    } catch {
      setTaskCopyMessage("复制失败，可手动查看落地验收状态");
    }
  }

  async function copyClosureAudit() {
    try {
      await navigator.clipboard.writeText(closureAuditText(closureAudit));
      setTaskCopyMessage(`已复制闭环覆盖率体检：${closureAudit.coverage}%`);
    } catch {
      setTaskCopyMessage("复制失败，可手动查看闭环覆盖率体检。");
    }
  }

  async function copyLaunchReadinessAudit() {
    try {
      await navigator.clipboard.writeText(launchReadinessAuditText(launchAudit));
      setTaskCopyMessage(`已复制首批测品就绪审计：${launchAudit.status}`);
    } catch {
      setTaskCopyMessage("复制失败，可导出首批测品就绪审计。");
    }
  }

  async function copyManualHandoff() {
    try {
      await navigator.clipboard.writeText(manualHandoffText(manualHandoffGroups));
      const totalItems = manualHandoffGroups.reduce((total, group) => total + group.items.length, 0);
      setTaskCopyMessage(`已复制人工待办分派 ${totalItems} 项`);
    } catch {
      setTaskCopyMessage("复制失败，可导出人工待办 CSV");
    }
  }

  async function copyManualHandoffGroup(group) {
    if (!group?.items?.length) return;
    try {
      await navigator.clipboard.writeText(manualHandoffGroupText(group));
      setTaskCopyMessage(`已复制 ${group.owner} 待办 ${group.items.length} 项`);
    } catch {
      setTaskCopyMessage("复制失败，可导出人工待办 CSV");
    }
  }

  async function claimManualHandoffEntry(entry) {
    const product = entry?.product || {};
    const item = entry?.item || {};
    if (!product.id) return;
    const assignmentKey = entry.assignmentKey || manualAssignmentKey(product, item);
    try {
      setManualClaimingKey(assignmentKey);
      await onUpdateProduct(product.id, withAutoAssetVerificationLog(product, manualAssignmentPatch(product, entry), {
        type: "人工分派",
        label: `${item.owner || "人工复核"}签收 ${item.kind || "待办"}`,
        detail: item.issue || item.action || item.label || "人工待办已签收",
        target: item.label || "人工待办",
        status: "已签收"
      }), { silent: true });
      setTaskCopyMessage(`${product.sku} / ${item.label || item.kind || "人工待办"} 已登记给 ${item.owner || "人工复核"}。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "人工分派签收失败");
    } finally {
      setManualClaimingKey("");
    }
  }

  async function resolveManualHandoffEntry(entry) {
    const product = entry?.product || {};
    const item = entry?.item || {};
    if (!product.id || !entry?.assignment) return;
    const assignmentKey = entry.assignmentKey || manualAssignmentKey(product, item);
    try {
      setManualClaimingKey(assignmentKey);
      await onUpdateProduct(product.id, withAutoAssetVerificationLog(product, manualAssignmentPatch(product, entry, "已处理待复核"), {
        type: "人工分派",
        label: `${item.owner || "人工复核"}处理完成 ${item.kind || "待办"}`,
        detail: item.issue || item.action || item.label || "人工待办已处理，等待准入复核",
        target: item.label || "人工待办",
        status: "已处理待复核"
      }), { silent: true });
      setTaskCopyMessage(`${product.sku} / ${item.label || item.kind || "人工待办"} 已标记为已处理待复核。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "人工待办处理状态保存失败");
    } finally {
      setManualClaimingKey("");
    }
  }

  function withAutoAssetVerificationLogs(product = {}, patch = {}, events = []) {
    if (patch.assetValidationSnapshot) {
      return withAssetActionLogs(product, patch, events);
    }
    const nextProduct = { ...product, ...patch };
    const verificationPatch = buildAssetVerificationRefreshPatch(nextProduct, accounts);
    const snapshot = verificationPatch.assetValidationSnapshot || {};
    return withAssetActionLogs(product, {
      ...patch,
      ...verificationPatch
    }, [
      ...events,
      {
        type: "资产验证",
        label: "自动刷新生成前资产验证",
        detail: snapshot.summary || "资产验证已刷新",
        target: "生成前验证",
        status: snapshot.label || "已刷新"
      }
    ]);
  }

  function withAutoAssetVerificationLog(product = {}, patch = {}, event = {}) {
    return withAutoAssetVerificationLogs(product, patch, [event]);
  }

  function toggleDailyExecutionDone(row) {
    const rowKey = dailyExecutionRowKey(row);
    setDailyDoneMap((current) => {
      const next = { ...current };
      if (next[rowKey]) delete next[rowKey];
      else next[rowKey] = new Date().toISOString();
      writeDailyExecutionDoneMap(next);
      return next;
    });
  }

  function clearDailyExecutionDone() {
    setDailyDoneMap({});
    writeDailyExecutionDoneMap({});
    setTaskCopyMessage("今日执行清单完成状态已重置");
  }

  async function updateAssetTaskSlot(task, status) {
    if (!task?.product?.id || task.kind !== "materialSlot" || !task.slotId) {
      navigate(productLibraryTarget(task?.product?.id));
      return;
    }
    try {
      setTaskUpdatingId(task.id);
      const currentProduct = task.product;
      const nextChecklist = (currentProduct.assetChecklist || normalizeMaterialChecklist(currentProduct)).map((slot) =>
        slot.id === task.slotId ? { ...slot, status, updatedAt: new Date().toISOString() } : slot
      );
      const summary = summarizeMaterialChecklist(nextChecklist);
      const nextProduct = { ...currentProduct, assetChecklist: nextChecklist };
      const precheck = materialPrecheckForProduct(nextProduct);
      const nextLifecycle = summary.blocked
        ? "待补资产"
        : summary.percent >= 78 && Number(currentProduct.totalScore || 0) >= 75 && currentProduct.lifecycle === "待补资产"
          ? "可测"
          : currentProduct.lifecycle;
      await onUpdateProduct(currentProduct.id, withAutoAssetVerificationLog(currentProduct, {
        assetChecklist: nextChecklist,
        assetPercent: summary.percent,
        assetStatus: precheck.status === "blocked"
          ? `素材预检未通过：${precheck.hardIssues[0] || summary.nextGap}`
          : precheck.status === "warn"
            ? `素材可建草稿：${precheck.warnings[0] || summary.nextGap}`
            : "素材可生成",
        lifecycle: nextLifecycle
      }, {
        type: "素材状态",
        label: `${task.title} 标记为 ${status}`,
        detail: precheck.status === "pass" ? "素材预检可生成" : precheck.hardIssues[0] || precheck.warnings[0] || summary.nextGap,
        target: task.type,
        status
      }), { silent: true });
      setTaskCopyMessage(`${currentProduct.sku} / ${task.title} 已标记为 ${status}`);
    } catch (error) {
      setTaskCopyMessage(error.message || "任务状态更新失败");
    } finally {
      setTaskUpdatingId("");
    }
  }

  async function attachResearchSourcesForTask(task) {
    if (!task?.product?.id) {
      navigate("productLibrary");
      return;
    }
    const additions = recommendedResearchSourcesForProduct(task.product);
    if (!additions.length) {
      setTaskCopyMessage(`${task.product.sku} 暂无可自动补入的新来源，去商品库人工核。`);
      navigate(productLibraryTarget(task.product.id));
      return;
    }
    try {
      setTaskUpdatingId(task.id);
      await onUpdateProduct(task.product.id, withAutoAssetVerificationLog(task.product, researchSourcePatchForProduct(task.product, additions), {
        type: "调研来源",
        label: "补入基础规则来源",
        detail: additions.map((source) => source.label).join("、"),
        target: "来源证据",
        status: "已补"
      }), { silent: true });
      setTaskCopyMessage(`${task.product.sku} 已补入 ${additions.length} 条基础规则来源。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "来源补入失败");
    } finally {
      setTaskUpdatingId("");
    }
  }

  async function applyProductCardDraftForTask(task) {
    if (!task?.product?.id) {
      navigate("productLibrary");
      return;
    }
    try {
      setTaskUpdatingId(task.id);
      const product = task.product;
      const draft = productCardDraftForProduct(product);
      const checked = productCardPrecheck({ ...product, cardCheck: draft });
      await onUpdateProduct(product.id, withAutoAssetVerificationLog(product, productCardUpdatePayload(product, draft), {
        type: "商品卡",
        label: "任务清单套用保守商品卡草稿",
        detail: task.title || checked.nextGap,
        target: "商品卡承接",
        status: checked.status === "pass" ? "已通过" : "已保存"
      }), { silent: true });
      setTaskCopyMessage(`${product.sku} 已套用保守商品卡草稿；${productCardPrecheckLabel(checked)}。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "商品卡草稿保存失败");
    } finally {
      setTaskUpdatingId("");
    }
  }

  async function resolveAssetOwnerItem(item) {
    const product = item?.product || {};
    const row = item?.row || {};
    const itemKey = `${product.id || "sku"}-${row.id || "row"}`;
    if (!product.id) return;

    if (row.slotId === "research-source") {
      const additions = recommendedResearchSourcesForProduct(product);
      if (!additions.length) {
        setTaskCopyMessage(`${product.sku} 暂无可自动补入的新来源，去商品库人工核。`);
        navigate(productLibraryTarget(product.id));
        return;
      }
      try {
        setAssetBoardUpdatingKey(itemKey);
        await onUpdateProduct(product.id, withAutoAssetVerificationLog(product, researchSourcePatchForProduct(product, additions), {
          type: "调研来源",
          label: "看板补入基础规则来源",
          detail: additions.map((source) => source.label).join("、"),
          target: row.label,
          status: "已补"
        }), { silent: true });
        setTaskCopyMessage(`${product.sku} 已补入 ${additions.length} 条基础规则来源。`);
      } catch (error) {
        setTaskCopyMessage(error.message || "来源补入失败");
      } finally {
        setAssetBoardUpdatingKey("");
      }
      return;
    }

    if (String(row.id || "").startsWith("card-")) {
      try {
        setAssetBoardUpdatingKey(itemKey);
        const draft = productCardDraftForProduct(product);
        await onUpdateProduct(product.id, withAutoAssetVerificationLog(product, productCardUpdatePayload(product, draft), {
          type: "商品卡",
          label: "套用保守商品卡草稿",
          detail: row.label,
          target: "商品卡承接",
          status: "已保存"
        }), { silent: true });
        setTaskCopyMessage(`${product.sku} 已套用保守商品卡草稿。`);
      } catch (error) {
        setTaskCopyMessage(error.message || "商品卡草稿保存失败");
      } finally {
        setAssetBoardUpdatingKey("");
      }
      return;
    }

    if (String(row.id || "").endsWith("-collect") && row.slotId) {
      try {
        setAssetBoardUpdatingKey(itemKey);
        const nextChecklist = (product.assetChecklist || normalizeMaterialChecklist(product)).map((slot) =>
          slot.id === row.slotId ? { ...slot, status: "已就绪", updatedAt: new Date().toISOString() } : slot
        );
        const summary = summarizeMaterialChecklist(nextChecklist);
        const nextProduct = { ...product, assetChecklist: nextChecklist };
        const precheck = materialPrecheckForProduct(nextProduct);
        const nextLifecycle = summary.blocked
          ? "待补资产"
          : summary.percent >= 78 && Number(product.totalScore || 0) >= 75 && product.lifecycle === "待补资产"
            ? "可测"
            : product.lifecycle;
        await onUpdateProduct(product.id, withAutoAssetVerificationLog(product, {
          assetChecklist: nextChecklist,
          assetPercent: summary.percent,
          assetStatus: precheck.status === "blocked"
            ? `素材预检未通过：${precheck.hardIssues[0] || summary.nextGap}`
            : precheck.status === "warn"
              ? `素材可建草稿：${precheck.warnings[0] || summary.nextGap}`
              : "素材可生成",
          lifecycle: nextLifecycle
        }, {
          type: "素材状态",
          label: `${row.label} 标记为已补`,
          detail: row.action,
          target: row.owner,
          status: "已补"
        }), { silent: true });
        setTaskCopyMessage(`${product.sku} / ${row.label} 已标记为已补。`);
      } catch (error) {
        setTaskCopyMessage(error.message || "资产补齐状态更新失败");
      } finally {
        setAssetBoardUpdatingKey("");
      }
      return;
    }

    setTaskCopyMessage(`${product.sku} / ${row.label} 需要在商品库详情里编辑。`);
    navigate(productLibraryTarget(product.id));
  }

  async function attachSourceAuditRows() {
    const rows = (command.sourceAuditRows || [])
      .map((row) => ({ row, additions: recommendedResearchSourcesForProduct(row.product) }))
      .filter((item) => item.row?.product?.id && item.additions.length)
      .slice(0, 20);
    if (!rows.length) {
      setTaskCopyMessage("暂无可自动补入的新来源，剩余项需要人工上传商品资质或截图。");
      return;
    }
    try {
      setSourceUpdating(true);
      await Promise.all(rows.map(({ row, additions }) =>
        onUpdateProduct(row.product.id, withAutoAssetVerificationLog(row.product, researchSourcePatchForProduct(row.product, additions), {
          type: "调研来源",
          label: "批量补入基础规则来源",
          detail: additions.map((source) => source.label).join("、"),
          target: "来源审计",
          status: "已补"
        }), { silent: true })
      ));
      setTaskCopyMessage(`已为 ${rows.length} 个 SKU 补入基础规则来源。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "批量补来源失败");
    } finally {
      setSourceUpdating(false);
    }
  }

  async function saveAssetCompletionPlans() {
    const planRows = (command.rows || [])
      .map((row) => ({ product: row.product, plan: buildAssetCompletionPlan(row.product) }))
      .filter((item) => item.product?.id && item.plan.rows.length)
      .slice(0, 30);
    if (!planRows.length) {
      setTaskCopyMessage("当前商品池暂无需要生成的资产补齐计划。");
      return;
    }
    try {
      setAssetPlanUpdating(true);
      await Promise.all(planRows.map(({ product, plan }) =>
        onUpdateProduct(product.id, withAutoAssetVerificationLog(product, {
          assetCompletionPlan: plan,
          assetStatus: plan.status === "可用" ? "资产补齐计划可用" : plan.summary
        }, {
          type: "补齐计划",
          label: "生成资产补齐计划",
          detail: plan.summary,
          target: "资产补齐计划",
          status: plan.status
        }), { silent: true })
      ));
      setTaskCopyMessage(`已为 ${planRows.length} 个 SKU 生成资产补齐计划。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "批量生成补齐计划失败");
    } finally {
      setAssetPlanUpdating(false);
    }
  }

  async function copyAssetVerificationQueue() {
    try {
      await navigator.clipboard.writeText(assetVerificationQueueText(assetVerificationQueue.slice(0, 12)));
      setTaskCopyMessage(`已复制生成前验证队列 ${Math.min(assetVerificationQueue.length, 12)} 条`);
    } catch {
      setTaskCopyMessage("复制失败，可直接按生成前验证队列处理。");
    }
  }

  async function saveAssetVerificationRows(rows = []) {
    const targets = (rows || []).filter((row) => row.product?.id && row.snapshot.computedStatus !== "blocked").slice(0, 8);
    if (!targets.length) {
      setTaskCopyMessage("当前没有可批量保存的生成前验证；阻断项需先补资产。");
      return;
    }
    try {
      setAssetVerificationUpdating(true);
      await Promise.all(targets.map(({ product, snapshot, accountFit }) => {
        const cleanSnapshot = buildAssetVerificationSnapshotForProduct(product, accountFit);
        const nextLifecycle = product.lifecycle === "淘汰"
          ? product.lifecycle
          : cleanSnapshot.status === "pass" && Number(product.totalScore || 0) >= 75 && ["观察", "待补资产"].includes(product.lifecycle)
            ? "可测"
            : product.lifecycle;
        return onUpdateProduct(product.id, withAssetActionLog(product, {
          assetValidationSnapshot: cleanSnapshot,
          assetStatus: cleanSnapshot.summary,
          assetPercent: cleanSnapshot.status === "pass" ? Math.max(product.assetPercent || 0, 82) : product.assetPercent,
          lifecycle: nextLifecycle
        }, {
          type: "资产验证",
          label: snapshot.isStale ? "总览批量重存生成前资产验证" : "总览批量保存生成前资产验证",
          detail: cleanSnapshot.summary,
          target: "生成前验证队列",
          status: cleanSnapshot.label
        }), { silent: true });
      }));
      setTaskCopyMessage(`已保存 ${targets.length} 个 SKU 的生成前资产验证。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "批量保存生成前验证失败");
    } finally {
      setAssetVerificationUpdating(false);
    }
  }

  async function backfillClosureLedger() {
    const scopedProducts = products.filter((product) => product?.id && product.lifecycle !== "淘汰").slice(0, 30);
    const testingLifecycles = new Set(["可测", "复测", "放大"]);
    if (!scopedProducts.length) {
      setTaskCopyMessage("当前没有可补底账的 SKU。");
      return;
    }
    try {
      setClosureBackfilling(true);
      let updatedCount = 0;
      let sourceCount = 0;
      let cardCount = 0;
      let planCount = 0;
      let verificationCount = 0;
      let blockedVerificationCount = 0;
      const failedRows = [];
      const plannedUpdates = [];
      for (const product of scopedProducts) {
        try {
          let baseProduct = { ...product };
          let patch = {};
          const events = [];
          const isTestingProduct = testingLifecycles.has(baseProduct.lifecycle);
          let productSourceCount = 0;
          let productCardCount = 0;
          let productPlanCount = 0;
          let productVerificationCount = 0;
          let productBlockedVerificationCount = 0;

          if (isTestingProduct && researchTaskSummaryForProduct(baseProduct).status !== "pass") {
            const additions = recommendedResearchSourcesForProduct(baseProduct);
            if (additions.length) {
              const sourcePatch = researchSourcePatchForProduct(baseProduct, additions);
              patch = { ...patch, ...sourcePatch };
              baseProduct = { ...baseProduct, ...sourcePatch };
              productSourceCount = 1;
              events.push({
                type: "调研来源",
                label: "闭环体检补入基础规则来源",
                detail: additions.map((source) => source.label).join("、"),
                target: "闭环覆盖率体检",
                status: "已补"
              });
            }
          }

          if (isTestingProduct && productCardPrecheck(baseProduct).status !== "pass") {
            const draft = productCardDraftForProduct(baseProduct);
            const cardPatch = productCardUpdatePayload(baseProduct, draft);
            patch = { ...patch, ...cardPatch };
            baseProduct = { ...baseProduct, ...cardPatch };
            productCardCount = 1;
            events.push({
              type: "商品卡",
              label: "闭环体检套用保守商品卡草稿",
              detail: productCardPrecheckLabel(cardPatch.cardPrecheck),
              target: "闭环覆盖率体检",
              status: cardPatch.cardPrecheck?.status === "pass" ? "已通过" : "已保存"
            });
          }

          const plan = buildAssetCompletionPlan(baseProduct);
          if ((plan.rows || []).length && !(baseProduct.assetCompletionPlan?.rows || []).length) {
            const planPatch = {
              assetCompletionPlan: plan,
              assetStatus: plan.status === "可用" ? "资产补齐计划可用" : plan.summary
            };
            patch = { ...patch, ...planPatch };
            baseProduct = { ...baseProduct, ...planPatch };
            productPlanCount = 1;
            events.push({
              type: "补齐计划",
              label: "闭环体检生成资产补齐计划",
              detail: plan.summary,
              target: "闭环覆盖率体检",
              status: plan.status
            });
          }

          if (isTestingProduct && !hasActiveSelectionBatch(baseProduct)) {
            const fit = accountFitSummaryForProduct(baseProduct, accounts);
            const gate = assetVerificationGateForProduct(baseProduct, fit);
            const cleanSnapshot = buildAssetVerificationSnapshotForProduct(baseProduct, fit);
            if (cleanSnapshot.status === "blocked") {
              productBlockedVerificationCount = 1;
            } else if (!baseProduct.assetValidationSnapshot?.status || gate.requiresSave || baseProduct.assetValidationSnapshot?.signature !== cleanSnapshot.signature) {
              const verificationPatch = {
                assetValidationSnapshot: cleanSnapshot,
                assetVerificationUpdatedAt: cleanSnapshot.generatedAt,
                assetStatus: cleanSnapshot.summary,
                assetPercent: cleanSnapshot.status === "pass" ? Math.max(Number(baseProduct.assetPercent || 0), 82) : baseProduct.assetPercent
              };
              patch = { ...patch, ...verificationPatch };
              baseProduct = { ...baseProduct, ...verificationPatch };
              productVerificationCount = 1;
              events.push({
                type: "资产验证",
                label: gate.isStale ? "闭环体检重存生成前验证" : "闭环体检保存生成前验证",
                detail: cleanSnapshot.summary,
                target: "闭环覆盖率体检",
                status: cleanSnapshot.label
              });
            }
          }

          if (events.length) {
            plannedUpdates.push({
              id: product.id,
              sku: product.sku,
              patch: withAssetActionLogs(product, patch, events),
              counts: {
                source: productSourceCount,
                card: productCardCount,
                plan: productPlanCount,
                verification: productVerificationCount
              }
            });
          }
          blockedVerificationCount += productBlockedVerificationCount;
        } catch (error) {
          failedRows.push(`${product.sku || product.id}：${error.message || "保存失败"}`);
        }
      }
      if (plannedUpdates.length && onBulkUpdateProducts) {
        const result = await onBulkUpdateProducts(plannedUpdates.map((item) => ({ id: item.id, patch: item.patch })), { silent: true });
        const resultById = new Map((result.results || []).map((item) => [item.id, item]));
        for (const planned of plannedUpdates) {
          const row = resultById.get(planned.id);
          if (row?.ok) {
            updatedCount += 1;
            sourceCount += planned.counts.source;
            cardCount += planned.counts.card;
            planCount += planned.counts.plan;
            verificationCount += planned.counts.verification;
          } else {
            failedRows.push(`${planned.sku || planned.id}：${row?.error || "批量保存失败"}`);
          }
        }
      } else {
        for (const planned of plannedUpdates) {
          try {
            await onUpdateProduct(planned.id, planned.patch, { silent: true });
            updatedCount += 1;
            sourceCount += planned.counts.source;
            cardCount += planned.counts.card;
            planCount += planned.counts.plan;
            verificationCount += planned.counts.verification;
          } catch (error) {
            failedRows.push(`${planned.sku || planned.id}：${error.message || "保存失败"}`);
          }
        }
      }
      if (onRefresh) await onRefresh();
      const blockedText = blockedVerificationCount ? `，${blockedVerificationCount} 个验证仍需先补阻断项` : "";
      const failedText = failedRows.length ? `；${failedRows.length} 个失败：${failedRows.slice(0, 3).join("；")}` : "";
      setTaskCopyMessage(`闭环底账已补齐 ${updatedCount} 个 SKU：来源 ${sourceCount}、商品卡 ${cardCount}、计划 ${planCount}、验证 ${verificationCount}${blockedText}${failedText}。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "闭环底账补齐失败");
    } finally {
      setClosureBackfilling(false);
    }
  }

  async function applyProductCardDrafts() {
    const seenProductIds = new Set();
    const rows = (command.rows || [])
      .map((row) => {
        const product = row.product || {};
        const precheck = row.cardPrecheck?.fieldResults?.length ? row.cardPrecheck : productCardPrecheck(product);
        return { product, precheck };
      })
      .filter(({ product, precheck }) => {
        if (!product?.id || seenProductIds.has(product.id) || product.lifecycle === "淘汰" || precheck.status === "pass") return false;
        seenProductIds.add(product.id);
        return true;
      })
      .slice(0, 30);
    if (!rows.length) {
      setTaskCopyMessage("当前商品池暂无需要套草稿的商品卡。");
      return;
    }
    try {
      setCardDraftUpdating(true);
      const updates = rows.map(({ product, precheck }) => {
        const draft = productCardDraftForProduct(product);
        const checked = productCardPrecheck({ ...product, cardCheck: draft });
        return { product, precheck, draft, checked };
      });
      await Promise.all(updates.map(({ product, precheck, draft, checked }) =>
        onUpdateProduct(product.id, withAutoAssetVerificationLog(product, productCardUpdatePayload(product, draft), {
          type: "商品卡",
          label: "批量套用保守商品卡草稿",
          detail: checked.nextGap || precheck.nextGap || "商品卡字段待补",
          target: "商品卡承接",
          status: checked.status === "pass" ? "已通过" : "已保存"
        }), { silent: true })
      ));
      const passCount = updates.filter(({ checked }) => checked.status === "pass").length;
      const warnCount = updates.filter(({ checked }) => checked.status === "warn").length;
      const blockedCount = updates.filter(({ checked }) => checked.status === "blocked").length;
      setTaskCopyMessage(`已为 ${rows.length} 个 SKU 套用保守商品卡草稿；通过 ${passCount} 个，待核 ${warnCount} 个，仍拦截 ${blockedCount} 个。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "批量套商品卡草稿失败");
    } finally {
      setCardDraftUpdating(false);
    }
  }

  async function resolveBlockerQueueRow(row) {
    const product = row?.product || {};
    if (!product.id) {
      navigate("productLibrary");
      return;
    }
    const autoItems = autoResolvableBlockerItems(row);
    if (!autoItems.length) {
      setTaskCopyMessage(`${product.sku} 暂无可自动处理项，已打开对应处理页。`);
      navigate(row.route || productLibraryTarget(product.id));
      return;
    }
    try {
      setBlockerResolvingId(product.id);
      const autoKinds = new Set(autoItems.map((item) => item.kind));
      let productPatch = {};
      const events = [];
      const summaries = [];

      if (autoKinds.has("来源")) {
        const additions = recommendedResearchSourcesForProduct(product);
        if (additions.length) {
          productPatch = { ...productPatch, ...researchSourcePatchForProduct({ ...product, ...productPatch }, additions) };
          events.push({
            type: "调研来源",
            label: "准入队列补入基础规则来源",
            detail: additions.map((source) => source.label).join("、"),
            target: "SKU 准入拦截",
            status: "已补"
          });
          summaries.push(`来源 ${additions.length} 条`);
        }
      }

      if (autoKinds.has("商品卡")) {
        const baseProduct = { ...product, ...productPatch };
        const draft = productCardDraftForProduct(baseProduct);
        const checked = productCardPrecheck({ ...baseProduct, cardCheck: draft });
        productPatch = { ...productPatch, ...productCardUpdatePayload(baseProduct, draft) };
        events.push({
          type: "商品卡",
          label: "准入队列套用保守商品卡草稿",
          detail: checked.nextGap || row.primary.issue,
          target: "商品卡承接",
          status: checked.status === "pass" ? "已通过" : "已保存"
        });
        summaries.push(productCardPrecheckLabel(checked));
      }

      if (autoKinds.has("素材") || autoKinds.has("合规")) {
        const baseProduct = { ...product, ...productPatch };
        const plan = buildAssetCompletionPlan(baseProduct);
        if (plan.rows.length) {
          productPatch = {
            ...productPatch,
            assetCompletionPlan: plan,
            assetStatus: plan.status === "可用" ? "资产补齐计划可用" : plan.summary
          };
          events.push({
            type: "补齐计划",
            label: "准入队列生成资产补齐计划",
            detail: autoItems.filter((item) => item.kind === "素材" || item.kind === "合规").map((item) => item.issue).join("；") || plan.summary,
            target: "SKU 准入拦截",
            status: plan.status
          });
          summaries.push("补齐计划");
        }
      }

      if (autoKinds.has("账号")) {
        const account = row.accountFit?.account;
        if (account?.id) {
          const recommended = [...new Set([...(account.recommended || []), product.sku])];
          await onSaveAccount({ ...account, recommended });
          events.push({
            type: "账号资产",
            label: "准入队列设为账号推荐 SKU",
            detail: `${account.name} 已加入 ${product.sku}`,
            target: account.name,
            status: "已绑定"
          });
          summaries.push(`账号 ${account.name}`);
        }
      }

      if (autoKinds.has("验证")) {
        const baseProduct = { ...product, ...productPatch };
        const fit = row.accountFit || accountFitSummaryForProduct(baseProduct, accounts);
        const verification = assetVerificationGateForProduct(baseProduct, fit);
        if (verification.computedStatus !== "blocked") {
          const cleanSnapshot = buildAssetVerificationSnapshotForProduct(baseProduct, fit);
          productPatch = {
            ...productPatch,
            assetValidationSnapshot: cleanSnapshot,
            assetStatus: cleanSnapshot.summary,
            assetPercent: cleanSnapshot.status === "pass" ? Math.max(baseProduct.assetPercent || 0, 82) : baseProduct.assetPercent
          };
          events.push({
            type: "资产验证",
            label: verification.isStale ? "准入队列重存生成前资产验证" : "准入队列保存生成前资产验证",
            detail: cleanSnapshot.summary,
            target: "SKU 准入拦截",
            status: cleanSnapshot.label
          });
          summaries.push("资产验证");
        }
      }

      if (!events.length) {
        setTaskCopyMessage(`${product.sku} 暂无可自动处理项，已打开对应处理页。`);
        navigate(row.route || productLibraryTarget(product.id));
        return;
      }

      await onUpdateProduct(product.id, withAutoAssetVerificationLogs(product, productPatch, events), { silent: true });
      setTaskCopyMessage(`${product.sku} 已自动处理 ${events.length} 项：${summaries.join("、")}。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "准入队列处理失败");
    } finally {
      setBlockerResolvingId("");
    }
  }

  async function resolveBlockerQueueRows(rows = []) {
    const targets = (rows || []).filter(canAutoResolveBlockerQueueRow).slice(0, 6);
    if (!targets.length) {
      setTaskCopyMessage("当前准入队列暂无可自动批量处理的 SKU。");
      return;
    }
    try {
      setBlockerBatchResolving(true);
      for (const row of targets) {
        await resolveBlockerQueueRow(row);
      }
      setTaskCopyMessage(`已批量处理 ${targets.length} 个准入队列项，处理记录已写入商品资产日志。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "批量处理准入队列失败");
    } finally {
      setBlockerBatchResolving(false);
      setBlockerResolvingId("");
    }
  }

  async function pinProductToAccount(row) {
    if (!row?.account?.id || !row?.product?.sku) {
      navigate("accountAssets");
      return;
    }
    const key = `${row.account.id}-${row.product.id}`;
    try {
      setAccountUpdatingKey(key);
      const recommended = [...new Set([...(row.account.recommended || []), row.product.sku])];
      await onSaveAccount({ ...row.account, recommended });
      setTaskCopyMessage(`${row.product.sku} 已加入 ${row.account.name} 推荐 SKU`);
    } catch (error) {
      setTaskCopyMessage(error.message || "账号推荐绑定失败");
    } finally {
      setAccountUpdatingKey("");
    }
  }

  async function startCooldownBatch(row) {
    const batchId = row?.currentRecord?.batchId || "";
    if (!batchId || !onStartBatch) {
      navigate("batch");
      return;
    }
    try {
      setBatchStartingId(batchId);
      await onStartBatch(batchId, row.product);
      setTaskCopyMessage(`${row.product.sku} 所在草稿已启动，等待生成回流。`);
    } catch (error) {
      setTaskCopyMessage(error.message || "批次草稿启动失败");
    } finally {
      setBatchStartingId("");
    }
  }

  return (
    <section className="selection-page">
      <div className="panel selection-hero">
        <div>
          <span className="workflow-stage">今日工作台</span>
          <h2>选品与资产总览</h2>
          <p>把选品评分、商品卡、素材清单、账号资产和批次回流合成一个执行队列：先测能测的，先补会阻断生成的。</p>
        </div>
        <div className="hero-actions">
          <DataSourceBadge selectionAssets={selectionAssets} />
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            <span>刷新资产</span>
          </button>
          <button className="secondary-button" type="button" onClick={copyDailyExecution} disabled={!executionRows.length}>
            <Clipboard size={16} />
            <span>复制清单</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => downloadDailyExecutionRows(executionRows, dailyDoneMap)} disabled={!executionRows.length}>
            <Download size={16} />
            <span>导出清单</span>
          </button>
          <button className="secondary-button" type="button" onClick={attachSourceAuditRows} disabled={sourceUpdating || !command.sourceAuditRows.length}>
            <BookOpen size={16} />
            <span>{sourceUpdating ? "补入中" : "批量补来源"}</span>
          </button>
          <button className="secondary-button" type="button" onClick={saveAssetCompletionPlans} disabled={assetPlanUpdating || !assetTasks.length}>
            <ListChecks size={16} />
            <span>{assetPlanUpdating ? "生成中" : "生成补齐计划"}</span>
          </button>
          <button className="secondary-button" type="button" onClick={applyProductCardDrafts} disabled={cardDraftUpdating || !cardDraftTaskCount}>
            <Sparkles size={16} />
            <span>{cardDraftUpdating ? "套用中" : "批量套商品卡"}</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => downloadAssetCompletionPlans(products, "商品池资产补齐计划.csv")} disabled={!products.length}>
            <Download size={16} />
            <span>导出补齐计划</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => navigate("productScoring")}>
            <Gauge size={16} />
            <span>看评分</span>
          </button>
          <button className="primary-button" type="button" onClick={() => navigate("productLibrary")}>
            <Database size={16} />
            <span>进商品库</span>
          </button>
        </div>
      </div>

      {taskCopyMessage ? <p className="selection-task-message">{taskCopyMessage}</p> : null}

      <div className="selection-metric-grid six">
        <SelectionMetricCard label="商品池" value={products.length} detail="已建档 SKU" icon={Database} tone="info" />
        <SelectionMetricCard label="今日可测" value={command.readyRows.length} detail="可直接建批次草稿" icon={Play} tone={command.readyRows.length ? "good" : "warn"} />
        <SelectionMetricCard label="资产任务" value={assetTasks.length} detail="自动拆出的补齐任务" icon={Clipboard} tone={assetTasks.length ? "warn" : "good"} />
        <SelectionMetricCard label="来源待补" value={command.sourceAuditRows.length} detail={`${command.sourceAuditRows.filter((row) => row.researchTask?.status === "blocked").length} 个拦截 / ${command.sourceAuditRows.filter((row) => row.researchTask?.status === "warn").length} 个待核`} icon={BookOpen} tone={command.sourceAuditRows.some((row) => row.researchTask?.status === "blocked") ? "bad" : command.sourceAuditRows.length ? "warn" : "good"} />
        <SelectionMetricCard label="风险待审" value={command.riskAuditRows.length} detail={`${command.riskAuditRows.filter((row) => row.tone === "bad").length} 个拦截 / ${command.riskAuditRows.filter((row) => row.riskLevel === "高").length} 个高风险`} icon={ShieldCheck} tone={command.riskAuditRows.some((row) => row.tone === "bad") ? "bad" : command.riskAuditRows.length ? "warn" : "good"} />
        <SelectionMetricCard label="已有回流" value={command.testedRows.length} detail={`${command.reviewBacklogRows.length} 个待复盘`} icon={Activity} tone={command.reviewBacklogRows.length ? "warn" : command.testedRows.length ? "good" : "info"} />
      </div>

      <SelectionClosureAuditPanel
        audit={closureAudit}
        navigate={navigate}
        onCopy={copyClosureAudit}
        onSource={attachSourceAuditRows}
        onPlan={saveAssetCompletionPlans}
        onCard={applyProductCardDrafts}
        onVerification={() => saveAssetVerificationRows(assetVerificationQueue)}
        onBackfill={backfillClosureLedger}
        busy={{
          source: sourceUpdating,
          plan: assetPlanUpdating,
          card: cardDraftUpdating,
          verification: assetVerificationUpdating,
          backfill: closureBackfilling
        }}
        disabled={{
          source: !command.sourceAuditRows.length,
          plan: !assetTasks.length,
          card: !cardDraftTaskCount,
          verification: !assetVerificationQueue.some((row) => row.snapshot.computedStatus !== "blocked" && row.snapshot.requiresSave),
          backfill: !closureAudit.autoBackfillCount
        }}
      />

      <SelectionAssetQualityGatePanel gates={qualityGates} navigate={navigate} onCopy={copyQualityGateSummary} />

      <LaunchReadinessAuditPanel
        audit={launchAudit}
        onCopy={copyLaunchReadinessAudit}
        onExport={() => downloadLaunchReadinessAudit(launchAudit)}
        onCreateBatch={onCreateBatch}
      />

      <SelectionBlockerQueuePanel
        rows={command.blockerQueue}
        navigate={navigate}
        onExport={() => downloadSelectionBlockerQueue(command.blockerQueue)}
        onCreateBatch={onCreateBatch}
        onResolveRow={resolveBlockerQueueRow}
        onResolveBatch={resolveBlockerQueueRows}
        resolvingId={blockerResolvingId}
        batchResolving={blockerBatchResolving}
      />

      <ManualBlockerHandoffPanel
        groups={manualHandoffGroups}
        navigate={navigate}
        onCopy={copyManualHandoff}
        onCopyGroup={copyManualHandoffGroup}
        onExport={() => downloadManualBlockerHandoff(command.blockerQueue)}
        onClaim={claimManualHandoffEntry}
        onResolve={resolveManualHandoffEntry}
        claimingKey={manualClaimingKey}
      />

      <DailyExecutionPanel
        rows={executionRows}
        navigate={navigate}
        onCopy={copyDailyExecution}
        onExport={() => downloadDailyExecutionRows(executionRows, dailyDoneMap)}
        doneMap={dailyDoneMap}
        onToggleDone={toggleDailyExecutionDone}
        onClearDone={clearDailyExecutionDone}
      />

      <AssetPlanOwnerBoard
        groups={assetOwnerGroups}
        navigate={navigate}
        onExport={() => downloadAssetCompletionPlans(products, "资产补齐执行看板.csv")}
        onResolveItem={resolveAssetOwnerItem}
        updatingKey={assetBoardUpdatingKey}
      />

      <AssetVerificationQueuePanel
        rows={assetVerificationQueue}
        navigate={navigate}
        onCopy={copyAssetVerificationQueue}
        onSaveRows={saveAssetVerificationRows}
        saving={assetVerificationUpdating}
      />

      <AssetRecentActivityPanel
        rows={assetActionRows}
        navigate={navigate}
        onExport={() => downloadAssetActionLogs(products, "商品池资产处理记录.csv")}
      />

      <div className="panel selection-task-panel">
        <div className="selection-task-head">
          <div>
            <div className="mini-panel-head">
              <Clipboard size={17} />
              <strong>补资产任务清单</strong>
            </div>
            <p>自动拆解商品卡、素材槽和预检提示，按阻断程度和 SKU 分数排序。</p>
          </div>
          <div className="selection-task-actions">
            <button className="secondary-button" type="button" onClick={copyAssetTasks} disabled={!assetTasks.length}>
              <Copy size={16} />
              <span>复制前 12 条</span>
            </button>
            <button className="secondary-button" type="button" onClick={() => downloadSelectionAssetTasks(assetTasks)} disabled={!assetTasks.length}>
              <Download size={16} />
              <span>导出 CSV</span>
            </button>
          </div>
        </div>
        <div className="selection-task-list">
          {assetTasks.slice(0, 10).map((task, index) => (
            <div className={`selection-task-row ${task.tone}`} key={task.id}>
              <div className="selection-task-rank">{String(index + 1).padStart(2, "0")}</div>
              <div>
                <div className="selection-task-title">
                  <strong>{task.product.sku}</strong>
                  <span>{task.type}</span>
                  <em>{task.status}</em>
                </div>
                <p>{task.title}</p>
                <small>{task.detail}</small>
                <div className="selection-command-meta">
                  <span>{task.product.category}</span>
                  <span>{task.account?.name || "未匹配账号"}</span>
                  <span>{task.evidence}</span>
                </div>
              </div>
              <div className="selection-task-row-actions">
                {task.kind === "materialSlot" ? (
                  <>
                    <button className="secondary-button" type="button" disabled={taskUpdatingId === task.id} onClick={() => updateAssetTaskSlot(task, "已就绪")}>
                      <ShieldCheck size={15} />
                      <span>{taskUpdatingId === task.id ? "更新中" : "已补"}</span>
                    </button>
                    <button className="secondary-button" type="button" disabled={taskUpdatingId === task.id} onClick={() => updateAssetTaskSlot(task, "待补")}>
                      <AlertTriangle size={15} />
                      <span>待补</span>
                    </button>
                  </>
                ) : null}
                {task.kind === "researchSource" ? (
                  <button className="secondary-button" type="button" disabled={taskUpdatingId === task.id} onClick={() => attachResearchSourcesForTask(task)}>
                    <BookOpen size={15} />
                    <span>{taskUpdatingId === task.id ? "补入中" : "补规则源"}</span>
                  </button>
                ) : null}
                {task.kind === "cardField" ? (
                  <button className="secondary-button" type="button" disabled={taskUpdatingId === task.id} onClick={() => applyProductCardDraftForTask(task)}>
                    <Sparkles size={15} />
                    <span>{taskUpdatingId === task.id ? "套用中" : "套草稿"}</span>
                  </button>
                ) : null}
                <button className="secondary-button" type="button" onClick={() => navigate(task.kind === "accountFit" ? "accountAssets" : productLibraryTarget(task.product.id))}>
                  <ChevronRight size={15} />
                  <span>{task.kind === "accountFit" ? "去账号库" : "详情"}</span>
                </button>
              </div>
            </div>
          ))}
          {!assetTasks.length ? <p className="selection-muted">暂无需要补齐的资产任务。</p> : null}
        </div>
      </div>

      <div className="panel account-coverage-panel">
        <div className="selection-task-head">
          <div>
            <div className="mini-panel-head">
              <KeyRound size={17} />
              <strong>账号覆盖审计</strong>
            </div>
            <p>检查 SKU 是否有稳定账号承接，以及账号是否补齐 DOC 包、平台绑定和禁做边界。</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => navigate("accountAssets")}>
            <KeyRound size={16} />
            <span>进账号库</span>
          </button>
        </div>
        <div className="account-coverage-summary">
          <div><span>强匹配</span><strong>{accountAudit.strongRows.length}</strong></div>
          <div><span>弱匹配</span><strong>{accountAudit.weakRows.length}</strong></div>
          <div><span>未匹配</span><strong>{accountAudit.noMatchRows.length}</strong></div>
          <div><span>账号待补</span><strong>{accountAudit.issueAccounts.length}</strong></div>
        </div>
        <div className="account-coverage-grid">
          <div>
            <strong className="account-coverage-subtitle">SKU 承接</strong>
            <div className="account-coverage-list">
              {[...accountAudit.noMatchRows, ...accountAudit.weakRows].slice(0, 6).map((row) => {
                const actionKey = `${row.account?.id || "none"}-${row.product.id}`;
                return (
                  <div className={`account-coverage-row ${row.tone}`} key={row.product.id}>
                    <div>
                      <strong>{row.product.sku}</strong>
                      <span>{row.strength} · {row.reason}</span>
                      <small>{row.account?.name || "需要补账号定位"}</small>
                    </div>
                    <div className="account-coverage-actions">
                      {row.account ? (
                        <button className="secondary-button" type="button" disabled={accountUpdatingKey === actionKey} onClick={() => pinProductToAccount(row)}>
                          <ShieldCheck size={15} />
                          <span>{accountUpdatingKey === actionKey ? "绑定中" : "设推荐"}</span>
                        </button>
                      ) : null}
                      <button className="secondary-button" type="button" onClick={() => navigate(row.account ? accountAssetsTarget(row.account.id) : "accountAssets")}>
                        <ChevronRight size={15} />
                        <span>账号</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              {!accountAudit.noMatchRows.length && !accountAudit.weakRows.length ? <p className="selection-muted">SKU 都有明确账号承接。</p> : null}
            </div>
          </div>
          <div>
            <strong className="account-coverage-subtitle">账号资产</strong>
            <div className="account-coverage-list">
              {accountAudit.accountRows.slice(0, 6).map((row) => (
                <button className={`account-coverage-row ${row.tone}`} type="button" key={row.account.id} onClick={() => navigate(accountAssetsTarget(row.account.id))}>
                  <div>
                    <strong>{row.account.name}</strong>
                    <span>{row.matched.length} 个 SKU · {row.docPacks[0]?.name || "DOC 待补"} · {row.platforms[0]?.platform || "平台待补"}</span>
                    <small>{row.issues.join(" / ") || "账号资产可用"}</small>
                  </div>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ComplianceReferencePanel riskRows={command.riskAuditRows} />

      <RiskAuditPanel rows={command.riskAuditRows} navigate={navigate} />

      <div className="selection-command-layout">
        <div className="panel selection-command-panel">
          <div className="selection-command-head">
            <div>
              <div className="mini-panel-head">
                <Timer size={17} />
                <strong>今日优先队列</strong>
              </div>
              <p>按评分、资产完整度、商品卡、素材预检和生命周期自动排序。</p>
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={() => onCreateBatch(command.firstBatch, { autoStart: false })}
              disabled={!command.firstBatch.length}
            >
              <ListChecks size={16} />
              <span>{command.firstBatch.length ? `建 ${command.firstBatch.length} 条草稿` : "暂无可建"}</span>
            </button>
          </div>

          <div className="selection-command-list">
            {command.topRows.map((row, index) => (
              <div className={`selection-command-row ${selectionActionTone(row)}`} key={row.product.id}>
                <div className="selection-command-rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="selection-command-main">
                  <div className="selection-command-title">
                    <strong>{row.product.sku}</strong>
                    <SelectionStatusBadge value={row.product.lifecycle} />
                    <ScorePill value={row.product.totalScore} />
                  </div>
                  <p>{row.reason}</p>
                  <div className="selection-command-meta">
                    <span>{row.stage}</span>
                    <span>资产 {row.product.assetPercent}%</span>
                    <span>商品卡 {productCardPrecheckLabel(row.cardPrecheck)}</span>
                    <span>{row.account?.name || "未匹配账号"}</span>
                  </div>
                </div>
                <div className="selection-command-actions">
                  {row.canCreateBatch ? (
                    <button className="primary-button" type="button" onClick={() => onCreateBatch([row.product], { autoStart: false })}>
                      <Play size={15} />
                      <span>{row.action}</span>
                    </button>
                  ) : (
                    <button className="secondary-button" type="button" onClick={() => navigate(row.route === "productLibrary" ? productLibraryTarget(row.product.id) : row.route)}>
                      <ChevronRight size={15} />
                      <span>{row.action}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="panel selection-command-side">
          <div className="mini-panel-head">
            <ShieldCheck size={17} />
            <strong>第一批编排</strong>
          </div>
          <BalancedBatchPlanPanel plan={command.batchPlan} accounts={accounts} onCreateBatch={onCreateBatch} />
          <BatchPrecheckPanel products={command.firstBatch} accounts={accounts} onCreateBatch={onCreateBatch} title="编排预检" />
        </aside>
      </div>

      <ActiveBatchCooldownPanel rows={command.cooldownRows} navigate={navigate} onStartBatch={startCooldownBatch} startingBatchId={batchStartingId} />

      <ReviewBacklogPanel rows={command.reviewBacklogRows} navigate={navigate} />

      <div className="selection-overview-grid">
        <div className="panel selection-lane-panel">
          <div className="mini-panel-head">
            <AlertTriangle size={17} />
            <strong>阻断项</strong>
          </div>
          <div className="selection-lane-list">
            {command.blockedRows.slice(0, 6).map((row) => (
              <button type="button" key={row.product.id} onClick={() => navigate(productLibraryTarget(row.product.id))}>
                <strong>{row.product.sku}</strong>
                <span>{row.cardPrecheck.status === "blocked" ? row.cardPrecheck.nextGap : row.materialPrecheck.hardIssues[0]}</span>
              </button>
            ))}
            {!command.blockedRows.length ? <p className="selection-muted">暂无阻断项。</p> : null}
          </div>
        </div>

        <div className="panel selection-lane-panel">
          <div className="mini-panel-head">
            <KeyRound size={17} />
            <strong>账号承接</strong>
          </div>
          <div className="account-fit-strip">
            {topAccounts.map(({ account, rows }) => (
              <button type="button" key={account.id} onClick={() => navigate("accountAssets")}>
                <strong>{account.name}</strong>
                <span>{rows.length} 个 SKU · {account.platform || "多平台"}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel selection-lane-panel">
          <div className="mini-panel-head">
            <Activity size={17} />
            <strong>回流复盘</strong>
          </div>
          <div className="selection-lane-list">
            {command.testedRows.slice(0, 6).map((row) => (
              <button type="button" key={row.product.id} onClick={() => navigate(productLibraryTarget(row.product.id))}>
                <strong>{row.product.sku}</strong>
                <span>{row.generationSummary.total || 0} 条记录 · {row.generationSummary.latestStep || row.product.assetStatus}</span>
              </button>
            ))}
            {!command.testedRows.length ? <p className="selection-muted">暂无生成回流。</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function DataSourceBadge({ selectionAssets }) {
  return (
    <span className={`data-source-badge ${selectionAssets?.source === "database" ? "good" : "warn"}`}>
      {selectionAssets?.source === "database" ? "已保存资料" : "示例资料"}
    </span>
  );
}

function MarketSignalList({ signals = selectionMarketSignals, limit = signals.length }) {
  return (
    <div className="market-signal-list">
      {signals.slice(0, limit).map((signal) => (
        <div className={`market-signal ${signal.tone || "info"}`} key={signal.id}>
          <span>{signal.label}</span>
          <strong>{signal.title}</strong>
          <p>{signal.implication}</p>
          {/https?:\/\//i.test(signal.sourceUrl || "") ? (
            <a href={signal.sourceUrl} target="_blank" rel="noreferrer">{signal.sourceLabel}</a>
          ) : (
            <em>{signal.sourceLabel}</em>
          )}
        </div>
      ))}
    </div>
  );
}

function HardRuleList({ rules = selectionHardRules, limit = rules.length }) {
  return (
    <div className="hard-rule-list">
      {rules.slice(0, limit).map((rule) => (
        <div key={rule.id}>
          <strong>{rule.label}</strong>
          <span>{rule.action}</span>
        </div>
      ))}
    </div>
  );
}

function ProductIntelligencePanel({ product, accounts = accountAssetSeeds }) {
  const intelligence = buildProductIntelligence(product, accounts);
  const complianceFindings = intelligence.complianceFindings || [];
  const decision = intelligence.decisionSummary || selectionDecisionForProduct(product, accounts);
  const research = decision.research || researchSummaryForProduct(product);
  const recommendedSources = recommendedResearchSourcesForProduct(product);
  return (
    <div className={`asset-section product-intelligence-card ${intelligence.tone}`}>
      <div className="mini-panel-head">
        <BookOpen size={17} />
        <strong>情报与合规判断</strong>
      </div>
      <div className="product-intelligence-head">
        <span>当前判断</span>
        <strong>{intelligence.decision}</strong>
        <small>{decision.primaryReason}</small>
      </div>
      <div className="product-intelligence-grid">
        <div>
          <span>下一步</span>
          {intelligence.actions.map((action) => <strong key={action}>{action}</strong>)}
        </div>
        <div>
          <span>命中硬规则</span>
          {intelligence.hardRules.length ? intelligence.hardRules.map((rule) => (
            <strong key={rule.id}>{rule.label}：{rule.action}</strong>
          )) : <strong>未命中高风险硬规则，按素材预检执行。</strong>}
        </div>
        <div>
          <span>账号与承接</span>
          <strong>{decision.accountFit?.label || "账号适配待核"}：{decision.accountFit?.account?.name || "未匹配账号"}</strong>
          <strong>{decision.cardPrecheck ? `${productCardPrecheckLabel(decision.cardPrecheck)}：${decision.cardPrecheck.nextGap}` : "商品卡待核"}</strong>
        </div>
        <div>
          <span>调研来源</span>
          <strong>{research.label}：{research.types.join("、") || research.primary}</strong>
          <strong>{research.action}</strong>
          {recommendedSources.length ? <strong>可补来源：{recommendedSources.map((source) => source.label).join("、")}</strong> : null}
        </div>
        <div>
          <span>自动合规检查</span>
          {complianceFindings.length ? complianceFindings.map((finding) => (
            <strong key={finding.id}>{finding.label}：{finding.action}</strong>
          )) : <strong>未发现额外合规阻断。</strong>}
        </div>
      </div>
      <div className="research-source-list">
        {research.sources.slice(0, 6).map((source) => (
          source.url ? (
            <a href={source.url} target="_blank" rel="noreferrer" key={source.id}>{source.label}<span>{source.type}</span></a>
          ) : (
            <span key={source.id}><strong>{source.label}</strong><em>{source.type}</em></span>
          )
        ))}
      </div>
      <MarketSignalList signals={intelligence.signals} limit={4} />
    </div>
  );
}

function ProductAcceptanceGatePanel({
  product,
  rows = [],
  summary,
  onCopy,
  copyMessage = "",
  onCreateBatch,
  onAttachSources,
  onSavePlan,
  onApplyCardDraft,
  navigate
}) {
  if (!product || !summary) return null;
  const actionRow = summary.canQueue ? summary.batchRow : summary.primaryRow;

  function runAction(row = actionRow) {
    if (!row) return;
    if (row.actionKind === "createBatch") {
      onCreateBatch?.([product], { autoStart: false });
      return;
    }
    if (row.actionKind === "activeBatch") {
      navigate?.(activeSelectionBatchTarget(product));
      return;
    }
    if (row.actionKind === "account") {
      navigate?.("accountAssets");
      return;
    }
    if (row.actionKind === "source") {
      onAttachSources?.();
      return;
    }
    if (row.actionKind === "assetPlan") {
      onSavePlan?.();
      return;
    }
    if (row.actionKind === "card") {
      onApplyCardDraft?.();
      return;
    }
    if (row.actionKind === "score") {
      navigate?.("productScoring");
      return;
    }
    navigate?.(productLibraryTarget(product.id));
  }

  return (
    <div className={`asset-section product-acceptance-panel ${summary.tone}`}>
      <div className="product-acceptance-head">
        <div>
          <div className="mini-panel-head">
            <ShieldCheck size={17} />
            <strong>SKU 准入验收</strong>
          </div>
          <p>{summary.action}</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onCopy}>
            <Copy size={16} />
            <span>复制验收</span>
          </button>
          <button
            className={summary.canQueue ? "primary-button" : "secondary-button"}
            type="button"
            onClick={() => runAction(actionRow)}
            disabled={!actionRow?.actionKind}
          >
            {summary.canQueue ? <ListChecks size={16} /> : <ChevronRight size={16} />}
            <span>{summary.canQueue ? "建测品草稿" : actionRow?.actionLabel || "处理"}</span>
          </button>
        </div>
      </div>
      {copyMessage ? <p className="selection-task-message">{copyMessage}</p> : null}
      <div className="product-acceptance-summary">
        <div><span>验收结论</span><strong>{summary.label}</strong></div>
        <div><span>已通过</span><strong>{summary.passCount}</strong></div>
        <div><span>待核</span><strong>{summary.warnCount}</strong></div>
        <div><span>阻断</span><strong>{summary.blockedCount}</strong></div>
      </div>
      <div className="product-acceptance-list">
        {rows.map((row) => (
          <div className={`product-acceptance-row ${row.tone}`} key={row.id}>
            <span className="product-acceptance-state">{row.statusLabel}</span>
            <div>
              <strong>{row.label}</strong>
              <span>{row.detail}</span>
              <small>{row.action}</small>
            </div>
            {row.actionKind ? (
              <button className="secondary-button" type="button" onClick={() => runAction(row)}>
                <ChevronRight size={15} />
                <span>{row.actionLabel || "处理"}</span>
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CandidateQuickAddPanel({ products = [], onCreateProduct, onCreated }) {
  const [draft, setDraft] = useState(() => emptyCandidateDraft());
  const [saving, setSaving] = useState(false);
  const preview = draft.sku.trim() ? createCandidateProductPayload(draft, products) : null;

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submitCandidate(event) {
    event.preventDefault();
    if (!draft.sku.trim()) {
      alert("请先填写商品名称。");
      return;
    }
    try {
      setSaving(true);
      const product = await onCreateProduct(createCandidateProductPayload(draft, products));
      setDraft(emptyCandidateDraft());
      onCreated?.(product);
    } catch (error) {
      alert(error.message || "商品入库失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="candidate-intake-panel panel" onSubmit={submitCandidate}>
      <div className="candidate-intake-head">
        <div>
          <span className="workflow-stage">商品入库</span>
          <h2>新增候选 SKU</h2>
          <p>填最少信息，系统按选品逻辑自动生成初始评分、素材缺口和合规提示。</p>
        </div>
        <button className="primary-button" type="submit" disabled={saving || !draft.sku.trim()}>
          <Database size={16} />
          <span>{saving ? "入库中" : "保存入库"}</span>
        </button>
      </div>
      <div className="candidate-intake-grid">
        <label>
          <span>商品名称</span>
          <input value={draft.sku} onChange={(event) => updateDraft("sku", event.target.value)} placeholder="例如：旅行分装瓶" />
        </label>
        <label>
          <span>类目</span>
          <input value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} placeholder="例如：美妆边缘品" />
        </label>
        <label>
          <span>节点窗口</span>
          <input value={draft.node} onChange={(event) => updateDraft("node", event.target.value)} placeholder="例如：暑期/开学" />
        </label>
        <label>
          <span>价格带</span>
          <input value={draft.priceBand} onChange={(event) => updateDraft("priceBand", event.target.value)} placeholder="例如：19-49" />
        </label>
        <label>
          <span>佣金/利润</span>
          <select value={draft.commission} onChange={(event) => updateDraft("commission", event.target.value)}>
            <option value="中">中</option>
            <option value="高">高</option>
            <option value="低">低</option>
            <option value="待看">待看</option>
          </select>
        </label>
        <label>
          <span>视频角度</span>
          <input value={draft.videoAngles} onChange={(event) => updateDraft("videoAngles", event.target.value)} placeholder="用顿号分隔，可留空自动生成" />
        </label>
        <label className="candidate-wide">
          <span>推荐理由</span>
          <textarea value={draft.coreReason} onChange={(event) => updateDraft("coreReason", event.target.value)} placeholder="一句话说明为什么值得入池，例如：低价低解释，适合宿舍清单和旅行清单。" />
        </label>
        <label className="candidate-wide">
          <span>风险/备注</span>
          <textarea value={draft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="例如：需要授权、食品资质、真实效果素材、尺寸适配表。" />
        </label>
      </div>
      {preview ? (
        <div className="candidate-preview">
          <div>
            <span>初评分</span>
            <strong>{preview.totalScore}</strong>
          </div>
          <div>
            <span>状态</span>
            <strong>{preview.lifecycle}</strong>
          </div>
          <div>
            <span>风险</span>
            <strong>{preview.riskLevel}</strong>
          </div>
          <div>
            <span>主模板</span>
            <strong>{preview.primaryTemplate}</strong>
          </div>
          <div className="candidate-preview-wide">
            <span>素材缺口</span>
            <TagList items={preview.assetGaps.slice(0, 5)} tone="warn" />
          </div>
          <div className="candidate-preview-wide">
            <span>禁用话术</span>
            <TagList items={preview.bannedWords.slice(0, 5)} tone="bad" />
          </div>
        </div>
      ) : null}
    </form>
  );
}

function CandidateBulkImportPanel({ products = [], accounts = accountAssetSeeds, onCreateProduct, onImported }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const drafts = useMemo(() => parseCandidateImportRows(text), [text]);
  const previewRows = useMemo(() => {
    const existingKeys = new Set(products.map((product) => normalizeSkuText(product.sku)));
    return drafts.map((draft, index) => {
      const key = normalizeSkuText(draft.sku);
      const duplicate = existingKeys.has(key);
      const payload = createCandidateProductPayload(draft, products);
      const research = researchSummaryForProduct(payload);
      return {
        id: `${key || index}-${index}`,
        draft,
        payload,
        research,
        duplicate,
        decision: selectionDecisionForProduct(normalizeSelectionProduct(payload), accounts),
        status: duplicate ? "duplicate" : "ready"
      };
    });
  }, [drafts, products, accounts]);
  const importableRows = previewRows.filter((row) => row.status === "ready");
  const sample = [
    "旅行分装瓶 29-49 元 暑期出行 防漏便携 宿舍/旅行都能用",
    "衣柜除湿盒 19-39 元 梅雨季 防潮收纳 需要真实场景图",
    "观赛小风扇 39-99 元 世界杯观赛 宿舍桌面 清凉低决策"
  ].join("\n");

  async function importCandidates() {
    if (!importableRows.length) return;
    try {
      setSaving(true);
      setNotice("");
      const created = [];
      let existing = [...products];
      for (const row of importableRows) {
        const payload = createCandidateProductPayload(row.draft, existing);
        const product = await onCreateProduct(payload, { silent: true });
        created.push(product);
        existing = [product, ...existing];
      }
      setNotice(`已入库 ${created.length} 个候选 SKU，跳过 ${previewRows.length - importableRows.length} 个重复项。`);
      setText("");
      onImported?.(created[0]);
    } catch (error) {
      setNotice(error.message || "批量入库失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel candidate-bulk-panel">
      <div className="candidate-intake-head">
        <div>
          <span className="workflow-stage">批量接入</span>
          <h2>候选品批量入库</h2>
          <p>粘贴罗盘、精选联盟、热搜或人工调研文本，系统会自动拆 SKU、补类目节点、生成初评分和资产缺口。</p>
        </div>
        <div className="review-import-actions">
          <button className="secondary-button" type="button" onClick={() => setText(sample)}>
            <Clipboard size={16} />
            <span>示例</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => setText("")} disabled={!text.trim()}>
            <X size={16} />
            <span>清空</span>
          </button>
          <button className="primary-button" type="button" onClick={importCandidates} disabled={saving || !importableRows.length}>
            <Database size={16} />
            <span>{saving ? "入库中" : `入库 ${importableRows.length}`}</span>
          </button>
        </div>
      </div>
      <textarea
        className="review-import-input candidate-bulk-input"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setNotice("");
        }}
        placeholder="每行一个商品，或粘贴带表头的 CSV/表格：SKU、类目、价格、佣金、节点、理由"
      />
      {notice ? <p className="review-import-notice">{notice}</p> : null}
      {previewRows.length ? (
        <>
          <div className="review-import-summary">
            <div><span>识别 SKU</span><strong>{previewRows.length}</strong></div>
            <div><span>可入库</span><strong>{importableRows.length}</strong></div>
            <div><span>重复跳过</span><strong>{previewRows.filter((row) => row.duplicate).length}</strong></div>
            <div><span>平均分</span><strong>{Math.round(previewRows.reduce((total, row) => total + row.payload.totalScore, 0) / previewRows.length)}</strong></div>
            <div><span>来源记录</span><strong>{previewRows.reduce((total, row) => total + normalizeResearchSources(row.payload).length, 0)}</strong></div>
          </div>
          <div className="candidate-bulk-list">
            {previewRows.slice(0, 10).map((row) => (
              <div className={`candidate-bulk-row ${row.duplicate ? "duplicate" : row.decision.tone}`} key={row.id}>
                <div>
                  <strong>{row.payload.sku}</strong>
                  <span>{row.payload.category} · {row.payload.node} · {row.payload.priceBand || "价格待补"}</span>
                  <span>{row.research.label} · {row.research.types.join(" / ") || row.research.primary}</span>
                  <small>{row.duplicate ? "已存在，导入时跳过" : row.decision.primaryReason}</small>
                </div>
                <ScorePill value={row.payload.totalScore} />
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ProductScoringPage({ selectionAssets, navigate, onRefresh, onCreateBatch, onUpdateProduct, onCreateProduct }) {
  const products = useMemo(() => sortedSelectionProducts(selectionAssets?.products), [selectionAssets]);
  const accounts = selectionAssets?.accounts?.length ? selectionAssets.accounts : accountAssetSeeds;
  const [filter, setFilter] = useState("all");
  const [scoringProfile, setScoringProfile] = useState(readScoringProfile);
  const [savingScores, setSavingScores] = useState(false);
  const [scoreSaveMessage, setScoreSaveMessage] = useState("");
  const [scorePlanMessage, setScorePlanMessage] = useState("");
  const [scoreCalibrationMessage, setScoreCalibrationMessage] = useState("");
  const [scoreCalibrationApplyingId, setScoreCalibrationApplyingId] = useState("");
  const [scoreCalibrationBatchApplying, setScoreCalibrationBatchApplying] = useState(false);
  const normalizedScoringProfile = useMemo(() => normalizeScoringProfile(scoringProfile), [scoringProfile]);
  const scoringTotal = scoringProfileTotal(normalizedScoringProfile);
  const scorePreviewById = useMemo(() => new Map(products.map((product) => [
    product.id,
    applyScoringProfileToProduct(product, normalizedScoringProfile)
  ])), [products, normalizedScoringProfile]);
  const scorePreviewRows = useMemo(() =>
    products
      .map((product) => ({ product, preview: scorePreviewById.get(product.id) }))
      .filter((row) => row.preview)
      .sort((a, b) => Math.abs(b.preview.delta) - Math.abs(a.preview.delta))
      .slice(0, 6),
    [products, scorePreviewById]
  );
  const compliancePreviewRows = useMemo(() =>
    products
      .map((product) => ({
        product,
        preview: scorePreviewById.get(product.id),
        compliance: complianceSummaryForProduct(product)
      }))
      .filter((row) => row.compliance.findings.length)
      .sort((a, b) => b.compliance.blockCount - a.compliance.blockCount || b.compliance.warnCount - a.compliance.warnCount || Math.abs(b.preview?.delta || 0) - Math.abs(a.preview?.delta || 0))
      .slice(0, 5),
    [products, scorePreviewById]
  );
  const decisionQueue = useMemo(() => buildSelectionDecisionQueue(products, accounts), [products, accounts]);
  const decisionById = useMemo(() => new Map(decisionQueue.map((decision) => [decision.product.id, decision])), [decisionQueue]);
  const scoreExecutionPlan = useMemo(() => scoreExecutionPlanRows(decisionQueue), [decisionQueue]);
  const scoreCalibrationQueue = useMemo(() => scoreCalibrationRows(products, accounts), [products, accounts]);
  const filteredProducts = useMemo(() => {
    if (filter === "all") return products;
    if (filter === "reviewed") return products.filter((item) => item.reviewMetrics);
    if (filter === "complianceBlocked") return products.filter((item) => complianceSummaryForProduct(item).status === "blocked");
    if (filter === "complianceWarn") return products.filter((item) => complianceSummaryForProduct(item).status === "warn");
    if (filter === "compliancePass") return products.filter((item) => complianceSummaryForProduct(item).status === "pass");
    if (filter === "decisionBlocked") return products.filter((item) => decisionById.get(item.id)?.tone === "bad");
    if (filter === "decisionWarn") return products.filter((item) => decisionById.get(item.id)?.tone === "warn");
    if (filter === "decisionReady") return products.filter((item) => decisionById.get(item.id)?.canCreateBatch);
    return products.filter((item) => {
      const review = productReviewSummary(item);
      return item.lifecycle === filter || review.lifecycle === filter || review.displayVerdict === filter || review.verdict === filter;
    });
  }, [products, filter, decisionById]);
  const readyCount = products.filter((item) => item.lifecycle === "可测").length;
  const gapCount = products.filter((item) => item.lifecycle === "待补资产").length;
  const blockedCount = products.filter((item) => item.lifecycle === "禁止生成").length;
  const testingCount = products.filter((item) => item.lifecycle === "小批量测试").length;
  const scaleCount = products.filter((item) => item.lifecycle === "放大" || productReviewSummary(item).lifecycle === "放大").length;
  const retestCount = products.filter((item) => item.lifecycle === "复测" || productReviewSummary(item).lifecycle === "复测").length;
  const eliminatedCount = products.filter((item) => item.lifecycle === "淘汰" || productReviewSummary(item).lifecycle === "淘汰" || productReviewSummary(item).verdict === "淘汰").length;
  const complianceBlockedCount = products.filter((item) => complianceSummaryForProduct(item).status === "blocked").length;
  const complianceWarnCount = products.filter((item) => complianceSummaryForProduct(item).status === "warn").length;
  const compliancePassCount = products.filter((item) => complianceSummaryForProduct(item).status === "pass").length;
  const sourceBlockedCount = products.filter((item) => researchTaskSummaryForProduct(item).status === "blocked").length;
  const sourceWarnCount = products.filter((item) => researchTaskSummaryForProduct(item).status === "warn").length;
  const decisionBlockedCount = decisionQueue.filter((item) => item.tone === "bad").length;
  const decisionWarnCount = decisionQueue.filter((item) => item.tone === "warn").length;
  const decisionReadyCount = decisionQueue.filter((item) => item.canCreateBatch).length;
  const averageScore = products.length ? Math.round(products.reduce((total, item) => total + item.totalScore, 0) / products.length) : 0;
  const firstBatch = decisionQueue.filter((decision) => decision.canCreateBatch).slice(0, 6).map((decision) => decision.product);
  const weakestAssets = [...products].sort((a, b) => a.assetPercent - b.assetPercent).slice(0, 5);
  const reviewFilters = [
    { id: "all", label: "全部", count: products.length },
    { id: "可测", label: "可测", count: readyCount },
    { id: "待补资产", label: "待补资产", count: gapCount },
    { id: "decisionReady", label: "可建草稿", count: decisionReadyCount },
    { id: "decisionBlocked", label: "决策拦截", count: decisionBlockedCount },
    { id: "decisionWarn", label: "决策待核", count: decisionWarnCount },
    { id: "complianceBlocked", label: "合规拦截", count: complianceBlockedCount },
    { id: "complianceWarn", label: "合规待核", count: complianceWarnCount },
    { id: "compliancePass", label: "合规可用", count: compliancePassCount },
    { id: "小批量测试", label: "测试中", count: testingCount },
    { id: "放大", label: "放大", count: scaleCount },
    { id: "复测", label: "复测", count: retestCount },
    { id: "淘汰", label: "淘汰", count: eliminatedCount },
    { id: "reviewed", label: "已复盘", count: products.filter((item) => item.reviewMetrics).length }
  ];

  useEffect(() => {
    localStorage.setItem(scoringProfileStorageKey, JSON.stringify(normalizedScoringProfile));
  }, [normalizedScoringProfile]);

  function updateScoringWeight(key, value) {
    setScoringProfile((current) => {
      const profile = normalizeScoringProfile(current);
      return {
        ...profile,
        id: "custom",
        label: "自定义策略",
        note: "按当前调权结果重算评分。",
        weights: {
          ...profile.weights,
          [key]: Math.max(0, Math.min(30, Math.round(Number(value || 0))))
        }
      };
    });
    setScoreSaveMessage("");
  }

  function lifecycleAfterScoreWriteback(product = {}, nextScore = product.totalScore) {
    if (product.lifecycle === "淘汰" || hasActiveSelectionBatch(product)) return product.lifecycle;
    if (Number(nextScore || 0) < 75 && product.lifecycle === "可测") return "观察";
    return product.lifecycle;
  }

  function scoreWritebackStatus(preview = {}) {
    const score = Number(preview.totalScore || 0);
    if (score < 75) return `评分策略回写：${score} 分，低于 75 暂不测`;
    const delta = Number(preview.delta || 0);
    if (!delta) return `评分策略回写：${score} 分，准入评分不变`;
    return `评分策略回写：${score} 分，${delta > 0 ? "上调" : "下调"} ${Math.abs(delta)} 分`;
  }

  function withScoreWritebackLog(product = {}, patch = {}, event = {}) {
    const nextProduct = { ...product, ...patch };
    const verificationPatch = buildAssetVerificationRefreshPatch(nextProduct, accounts);
    const snapshot = verificationPatch.assetValidationSnapshot || {};
    return withAssetActionLogs(product, {
      ...verificationPatch,
      ...patch
    }, [
      event,
      {
        type: "资产验证",
        label: "评分写回后刷新生成前验证",
        detail: snapshot.summary || "评分变化后已刷新生成前资产验证",
        target: "生成前验证",
        status: snapshot.label || "已刷新"
      }
    ]);
  }

  async function applyScoringToDatabase() {
    if (scoringTotal !== 100) {
      alert("权重合计需要等于 100，才能回写商品库。");
      return;
    }
    try {
      setSavingScores(true);
      const appliedAt = new Date().toISOString();
      for (const product of products) {
        const preview = scorePreviewById.get(product.id);
        if (!preview) continue;
        await onUpdateProduct(product.id, withScoreWritebackLog(product, {
          scores: preview.scores,
          totalScore: preview.totalScore,
          riskLevel: preview.riskLevel,
          scoringProfile: {
            ...normalizedScoringProfile,
            appliedAt
          },
          scoringUpdatedAt: appliedAt,
          lifecycle: lifecycleAfterScoreWriteback(product, preview.totalScore),
          assetStatus: scoreWritebackStatus(preview)
        }, {
          type: "选品评分",
          label: "评分策略回写",
          detail: `${normalizedScoringProfile.label}：${product.totalScore} -> ${preview.totalScore}`,
          target: "选品评分",
          status: preview.totalScore >= 75 ? "达标" : "低于75"
        }), { silent: true });
      }
      setScoreSaveMessage(`已回写 ${products.length} 个 SKU，当前策略：${normalizedScoringProfile.label}；决策拦截 ${decisionBlockedCount} 个，待核 ${decisionWarnCount} 个。`);
    } catch (error) {
      alert(error.message || "评分回写失败");
    } finally {
      setSavingScores(false);
    }
  }

  async function copyScoreExecutionPlan() {
    try {
      await navigator.clipboard.writeText(scoreExecutionPlanText(scoreExecutionPlan));
      setScorePlanMessage(`已复制评分执行计划 ${scoreExecutionPlan.length} 项`);
    } catch {
      setScorePlanMessage("复制失败，可导出决策队列 CSV");
    }
  }

  async function copyScoreCalibration() {
    try {
      await navigator.clipboard.writeText(scoreCalibrationText(scoreCalibrationQueue.slice(0, 12)));
      setScoreCalibrationMessage(`已复制评分校准队列 ${Math.min(scoreCalibrationQueue.length, 12)} 项`);
    } catch {
      setScoreCalibrationMessage("复制失败，可直接按校准队列处理。");
    }
  }

  async function applyScoreCalibrationRow(row) {
    if (!row?.product?.id || !row.hasMetrics) return;
    try {
      setScoreCalibrationApplyingId(row.product.id);
      const payload = reviewMetricsPayloadForProduct(row.product, row.metrics, accounts);
      const calibrationPayload = {
        ...payload,
        scoreCalibration: {
          ...payload.scoreCalibration,
          category: row.category,
          label: row.label,
          action: row.action
        }
      };
      await onUpdateProduct(row.product.id, withScoreWritebackLog(row.product, calibrationPayload, {
        type: "评分校准",
        label: "单条复盘校准写回",
        detail: `${row.product.totalScore} -> ${payload.totalScore}；${row.action || row.label}`,
        target: "评分校准",
        status: row.summary?.verdict || payload.scoreCalibration?.verdict || "已校准"
      }), { silent: true });
      setScoreCalibrationMessage(`${row.product.sku} 已写回校准：${row.product.totalScore} -> ${payload.totalScore}，${row.summary.verdict}`);
    } catch (error) {
      setScoreCalibrationMessage(error.message || "评分校准写回失败");
    } finally {
      setScoreCalibrationApplyingId("");
    }
  }

  async function applyScoreCalibrationRows(rows = []) {
    const targets = (rows || []).filter((row) => row.hasMetrics && row.category !== "stable").slice(0, 8);
    if (!targets.length) {
      setScoreCalibrationMessage("当前没有可批量写回的评分校准项。");
      return;
    }
    try {
      setScoreCalibrationBatchApplying(true);
      for (const row of targets) {
        const payload = reviewMetricsPayloadForProduct(row.product, row.metrics, accounts);
        const calibrationPayload = {
          ...payload,
          scoreCalibration: {
            ...payload.scoreCalibration,
            category: row.category,
            label: row.label,
            action: row.action
          }
        };
        await onUpdateProduct(row.product.id, withScoreWritebackLog(row.product, calibrationPayload, {
          type: "评分校准",
          label: "批量复盘校准写回",
          detail: `${row.product.totalScore} -> ${payload.totalScore}；${row.action || row.label}`,
          target: "评分校准",
          status: row.summary?.verdict || payload.scoreCalibration?.verdict || "已校准"
        }), { silent: true });
      }
      setScoreCalibrationMessage(`已批量写回 ${targets.length} 个 SKU 的评分校准。`);
    } catch (error) {
      setScoreCalibrationMessage(error.message || "批量评分校准失败");
    } finally {
      setScoreCalibrationBatchApplying(false);
      setScoreCalibrationApplyingId("");
    }
  }

  function createScoreCalibrationReviewTemplate(rows = []) {
    const targets = (rows || []).filter((row) => row.product?.id);
    if (!targets.length) {
      setScoreCalibrationMessage("当前没有需要补复盘数据的 SKU。");
      return;
    }
    setReviewImportPrefill(reviewImportTemplateFromRows(targets.map((row) => ({
      product: row.product,
      reason: row.action || row.label
    }))));
    setScoreCalibrationMessage(`已生成 ${targets.length} 个 SKU 的复盘导入模板，跳转到商品库填写。`);
    navigate("productLibrary");
  }

  return (
    <section className="selection-page">
      <div className="panel selection-hero">
        <div>
          <span className="workflow-stage">MVP 已接入</span>
          <h2>选品评分</h2>
          <p>Top 20 候选 SKU 已按节点、AI 出片、商品卡承接、资产完整度和合规风险形成可测排序。</p>
        </div>
        <div className="hero-actions">
          <DataSourceBadge selectionAssets={selectionAssets} />
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            <span>刷新资产</span>
          </button>
          <button className="primary-button" type="button" onClick={() => onCreateBatch(firstBatch, { autoStart: false })} disabled={!firstBatch.length}>
            <ListChecks size={16} />
            <span>创建测品批次</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => downloadSelectionDecisionCsv(products, accounts)} disabled={!products.length}>
            <Download size={16} />
            <span>导出决策</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => navigate("productLibrary")}>
            <Database size={16} />
            <span>查看商品资产</span>
          </button>
        </div>
      </div>

      <div className="selection-metric-grid">
        <SelectionMetricCard label="候选 SKU" value={products.length} detail="来自调研 Top 20" icon={Database} tone="info" />
        <SelectionMetricCard label="可建草稿" value={decisionReadyCount} detail={`${readyCount} 个生命周期可测`} icon={ShieldCheck} tone={decisionReadyCount ? "good" : "warn"} />
        <SelectionMetricCard label="决策待处理" value={decisionBlockedCount + decisionWarnCount} detail={`${decisionBlockedCount} 个拦截 / ${decisionWarnCount} 个待核`} icon={Image} tone={decisionBlockedCount ? "bad" : decisionWarnCount ? "warn" : "good"} />
        <SelectionMetricCard label="来源待补" value={sourceBlockedCount + sourceWarnCount} detail={`${sourceBlockedCount} 个拦截 / ${sourceWarnCount} 个待核`} icon={BookOpen} tone={sourceBlockedCount ? "bad" : sourceWarnCount ? "warn" : "good"} />
        <SelectionMetricCard label="放大 / 复测" value={`${scaleCount}/${retestCount}`} detail="来自复盘结论" icon={Activity} tone={scaleCount ? "good" : "info"} />
        <SelectionMetricCard label="平均分" value={averageScore} detail="低于 75 不建议测试" icon={Gauge} tone={scoreTone(averageScore)} />
      </div>

      <ScoreExecutionPlanPanel
        rows={scoreExecutionPlan}
        navigate={navigate}
        onCreateBatch={onCreateBatch}
        onCopy={copyScoreExecutionPlan}
        copyMessage={scorePlanMessage}
      />

      <ScoreCalibrationPanel
        rows={scoreCalibrationQueue}
        onCopy={copyScoreCalibration}
        onApplyRow={applyScoreCalibrationRow}
        onApplyBatch={applyScoreCalibrationRows}
        onImportTemplate={createScoreCalibrationReviewTemplate}
        applyingId={scoreCalibrationApplyingId}
        batchApplying={scoreCalibrationBatchApplying}
        copyMessage={scoreCalibrationMessage}
      />

      {onCreateProduct ? (
        <CandidateBulkImportPanel
          products={products}
          accounts={accounts}
          onCreateProduct={onCreateProduct}
          onImported={() => setFilter("all")}
        />
      ) : null}

      <div className="selection-layout">
        <div className="panel selection-table-panel">
          <div className="panel-head">
            <div>
              <h2>SKU 排序</h2>
              <p>排序优先看总分，再看资产完整度、生命周期和复盘结论。</p>
            </div>
          </div>
          <div className="selection-filter-bar">
            {reviewFilters.map((item) => (
              <button className={filter === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setFilter(item.id)}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
          <div className="selection-table-wrap">
            <table className="selection-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>类目 / 节点</th>
                  <th>分数</th>
                  <th>状态</th>
                  <th>复盘</th>
                  <th>资产</th>
                  <th>风险</th>
                  <th>动作</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const review = productReviewSummary(product);
                  const scorePreview = scorePreviewById.get(product.id);
                  const compliance = complianceSummaryForProduct(product);
                  const decision = decisionById.get(product.id) || selectionDecisionForProduct(product, accounts);
                  return (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.sku}</strong>
                        <span>#{product.rank} · {product.primaryTemplate}</span>
                      </td>
                      <td>
                        <strong>{product.category}</strong>
                        <span>{product.node}</span>
                      </td>
                      <td>
                        <ScorePill value={product.totalScore} />
                        {scorePreview ? (
                          <small className={`score-delta ${scorePreview.delta > 0 ? "good" : scorePreview.delta < 0 ? "bad" : "muted"}`}>
                            重算 {scorePreview.totalScore} / {scorePreview.delta > 0 ? `+${scorePreview.delta}` : scorePreview.delta}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <SelectionStatusBadge value={product.lifecycle} />
                        <small className={`decision-inline ${decision.tone}`}>{decision.label}</small>
                        <small>{decision.primaryReason}</small>
                      </td>
                      <td>
                        <ReviewBadge product={product} />
                        <small>{review.orders} 单 / {review.refunds} 退</small>
                      </td>
                      <td>
                        <div className="asset-progress">
                          <span style={{ width: `${product.assetPercent}%` }} />
                        </div>
                        <small>{product.assetStatus} · {product.assetPercent}%</small>
                        <small>素材 {product.materialSummary?.ready || 0}/{product.materialSummary?.total || 0}</small>
                        <MaterialPrecheckBadge product={product} />
                        <small>生成 {product.generationSummary?.total || 0} 条 / 视频 {product.generationSummary?.videoCount || 0}</small>
                      </td>
                      <td>
                        <TagList items={compliance.findings.length ? [compliance.primary, ...compliance.findings.slice(1, 2).map((finding) => finding.label)] : (review.commentIssues ? [review.commentIssues] : product.riskTags.slice(0, 2))} tone={compliance.tone === "good" ? reviewRiskTone(product) : compliance.tone} />
                        <small>{compliance.label}</small>
                      </td>
                      <td>
                        <button
                          className="secondary-button selection-row-button"
                          type="button"
                          onClick={() => decision.canCreateBatch
                            ? onCreateBatch([product], { autoStart: false })
                            : navigate(decision.route || productLibraryTarget(product.id))}
                        >
                          <span>{decision.action || selectionBatchActionLabel(product, accounts)}</span>
                          <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="panel selection-side-panel">
          <div className="mini-panel-head">
            <BookOpen size={17} />
            <strong>最新情报</strong>
          </div>
          <MarketSignalList signals={selectionMarketSignals} limit={4} />

          <div className="mini-panel-head">
            <Gauge size={17} />
            <strong>决策雷达</strong>
          </div>
          <SelectionDecisionRadar decisions={decisionQueue} navigate={navigate} onCreateBatch={onCreateBatch} limit={6} />

          <div className="mini-panel-head">
            <ShieldCheck size={17} />
            <strong>一票否决硬规则</strong>
          </div>
          <HardRuleList rules={selectionHardRules} limit={5} />

          <div className="mini-panel-head">
            <Clipboard size={17} />
            <strong>批次预检</strong>
          </div>
          <BatchPrecheckPanel products={firstBatch} accounts={accounts} onCreateBatch={onCreateBatch} title="第一批测品" />

          <div className="mini-panel-head">
            <ListChecks size={17} />
            <strong>第一批建议</strong>
          </div>
          <ol className="selection-mini-list">
            {firstBatch.map((product) => (
              <li key={product.id}>
                <span>{product.sku}</span>
                <strong>{product.totalScore}</strong>
              </li>
            ))}
          </ol>

          <div className="mini-panel-head">
            <Image size={17} />
            <strong>优先补资产</strong>
          </div>
          <div className="asset-gap-list">
            {weakestAssets.map((product) => (
              <div key={product.id}>
                <strong>{product.sku}</strong>
                <span>{product.assetGaps.slice(0, 2).join(" / ")}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <div className="panel selection-score-panel">
        <div className="panel-head">
          <div>
            <h2>动态评分库</h2>
            <p>按当前运营策略调整 8 个维度，预览排序变化后同步到商品资料。</p>
          </div>
          <div className="score-config-actions">
            <span className={`score-total ${scoringTotal === 100 ? "good" : "bad"}`}>合计 {scoringTotal}</span>
            <button className="primary-button" type="button" onClick={applyScoringToDatabase} disabled={savingScores || scoringTotal !== 100}>
              <Download size={16} />
              <span>{savingScores ? "回写中" : "回写评分"}</span>
            </button>
          </div>
        </div>
        <div className="score-preset-bar">
          {selectionScoringPresets.map((preset) => (
            <button
              className={normalizedScoringProfile.id === preset.id ? "active" : ""}
              type="button"
              key={preset.id}
              onClick={() => {
                setScoringProfile(normalizeScoringProfile(preset));
                setScoreSaveMessage("");
              }}
            >
              <strong>{preset.label}</strong>
              <span>{preset.note}</span>
            </button>
          ))}
        </div>
        <div className="score-config-grid">
          {selectionScoreDimensions.map((item) => (
            <div className="dimension-card" key={item.key}>
              <div>
                <strong>{item.label}</strong>
                <span>原始 {item.weight} 分</span>
              </div>
              <label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={normalizedScoringProfile.weights[item.key]}
                  onChange={(event) => updateScoringWeight(item.key, event.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={normalizedScoringProfile.weights[item.key]}
                  onChange={(event) => updateScoringWeight(item.key, event.target.value)}
                />
              </label>
            </div>
          ))}
        </div>
        <div className="score-preview-panel">
          <div>
            <div className="mini-panel-head">
              <Gauge size={17} />
              <strong>变化最大的 SKU</strong>
            </div>
            <div className="score-preview-list">
              {scorePreviewRows.map(({ product, preview }) => (
                <div key={product.id}>
                  <span>{product.sku}</span>
                  <strong>{product.totalScore} → {preview.totalScore}</strong>
                  <em>{preview.reasons.join(" / ")}</em>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mini-panel-head">
              <ShieldCheck size={17} />
              <strong>回写说明</strong>
            </div>
            <p className="selection-muted">
              回写会更新每个 SKU 的维度分、总分、风险等级和评分策略记录；商品素材、账号资产和生成记录不受影响。
            </p>
            <div className="mini-panel-head score-compliance-head">
              <ShieldCheck size={16} />
              <strong>合规影响预览</strong>
            </div>
            <div className="score-preview-list compact">
              {compliancePreviewRows.map(({ product, preview, compliance }) => (
                <div key={product.id}>
                  <span>{product.sku}</span>
                  <strong>{preview ? `${product.totalScore} → ${preview.totalScore}` : compliance.label}</strong>
                  <em>{compliance.label} / {compliance.action}</em>
                </div>
              ))}
              {!compliancePreviewRows.length ? <p className="selection-muted">暂无自动合规扣分项。</p> : null}
            </div>
            {scoreSaveMessage ? <p className="score-save-message">{scoreSaveMessage}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function BulkReviewImportPanel({ products = [], accounts = accountAssetSeeds, onUpdateProduct, onImported }) {
  const [text, setText] = useState(() => {
    const prefill = readReviewImportPrefill();
    if (prefill) clearReviewImportPrefill();
    return prefill;
  });
  const [applying, setApplying] = useState(false);
  const [notice, setNotice] = useState(() => text ? "已带入待复盘 SKU 模板，补齐指标后再写回。" : "");
  const previewRows = useMemo(() => buildReviewImportPreview(text, products, accounts), [text, products, accounts]);
  const matchedRows = previewRows.filter((row) => row.status === "matched");
  const skippedRows = previewRows.filter((row) => row.status !== "matched");
  const verdictCounts = matchedRows.reduce((counts, row) => {
    const key = row.advice?.lifecycle || row.summary?.lifecycle || "观察";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  function reviewImportPatch(product = {}, metrics = {}, row = {}) {
    const payload = reviewMetricsPayloadForProduct(product, metrics, accounts);
    const nextProduct = { ...product, ...payload };
    const verificationPatch = buildAssetVerificationRefreshPatch(nextProduct, accounts);
    const snapshot = verificationPatch.assetValidationSnapshot || {};
    return withAssetActionLogs(product, {
      ...verificationPatch,
      ...payload
    }, [
      {
        type: "数据回流",
        label: "批量复盘导入写回",
        detail: `${product.totalScore || 0} -> ${payload.totalScore || 0}；${payload.reviewAdvice?.action || row.summary?.verdict || "复盘数据已写回"}`,
        target: "复盘导入",
        status: row.summary?.verdict || payload.scoreCalibration?.verdict || "已写回"
      },
      {
        type: "资产验证",
        label: "复盘写回后刷新生成前验证",
        detail: snapshot.summary || "复盘数据变化后已刷新生成前资产验证",
        target: "生成前验证",
        status: snapshot.label || "已刷新"
      }
    ]);
  }

  async function applyImport() {
    if (!matchedRows.length) {
      setNotice("没有可写回的 SKU");
      return;
    }
    try {
      setApplying(true);
      for (const row of matchedRows) {
        await onUpdateProduct(row.product.id, reviewImportPatch(row.product, row.metrics, row), { silent: true });
      }
      setNotice(`已写回 ${matchedRows.length} 条复盘，跳过 ${skippedRows.length} 条`);
      onImported?.(matchedRows[0]?.product);
    } catch (error) {
      setNotice(error.message || "批量复盘写回失败");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="panel review-import-panel">
      <div className="review-import-head">
        <div>
          <span className="workflow-stage">数据回流</span>
          <h2>批量复盘导入</h2>
          <p>粘贴平台或表格里的 SKU、播放、点击、商品卡点击、成交和退货数据，系统自动写回生命周期。</p>
        </div>
        <div className="review-import-actions">
          <button className="secondary-button" type="button" onClick={() => setText(reviewImportTemplate)}>
            <Clipboard size={16} />
            <span>填模板</span>
          </button>
          <button className="primary-button" type="button" onClick={applyImport} disabled={applying || !matchedRows.length}>
            <Upload size={16} />
            <span>{applying ? "写回中" : `写回 ${matchedRows.length || 0} 条`}</span>
          </button>
        </div>
      </div>
      <textarea
        className="review-import-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="SKU,播放,点击,商品卡点击,成交,退货,评论高频问题,备注"
      />
      <div className="review-import-summary">
        <div><span>匹配</span><strong>{matchedRows.length}</strong></div>
        <div><span>跳过</span><strong>{skippedRows.length}</strong></div>
        <div><span>放大</span><strong>{verdictCounts["放大"] || 0}</strong></div>
        <div><span>复测</span><strong>{verdictCounts["复测"] || 0}</strong></div>
        <div><span>淘汰</span><strong>{verdictCounts["淘汰"] || 0}</strong></div>
      </div>
      {notice ? <p className="review-import-notice">{notice}</p> : null}
      {previewRows.length ? (
        <div className="review-import-list">
          {previewRows.slice(0, 8).map((row) => (
            <div className={`review-import-row ${row.status}`} key={row.id}>
              <div>
                <strong>{row.product?.sku || row.rawSku}</strong>
                <span>{row.status === "matched" ? `${row.metrics.views} 播放 / ${row.metrics.clicks} 点击 / ${row.metrics.orders} 成交` : row.reason}</span>
              </div>
              <small>{row.status === "matched" ? `${row.advice.action} -> ${row.advice.lifecycle} / ${row.summary.adjustedScore}分` : row.reason}</small>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ProductLibraryPage({ selectionAssets, navigate, onRefresh, onUpdateProduct, onCreateProduct, onUploadMaterial, onCreateBatch }) {
  const products = useMemo(() => sortedSelectionProducts(selectionAssets?.products), [selectionAssets]);
  const accounts = selectionAssets?.accounts?.length ? selectionAssets.accounts : accountAssetSeeds;
  const [selectedId, setSelectedId] = useState(() => readSelectionProductFocus() || products[0]?.id || "");
  const [catalogFilter, setCatalogFilter] = useState("all");
  const selected = products.find((item) => item.id === selectedId) || products[0];
  const readyAssets = products.filter((item) => item.assetPercent >= 78 && item.materialPrecheck?.status !== "blocked").length;
  const complianceBlockedCount = products.filter((item) => complianceSummaryForProduct(item).status === "blocked").length;
  const complianceWarnCount = products.filter((item) => complianceSummaryForProduct(item).status === "warn").length;
  const compliancePassCount = products.filter((item) => complianceSummaryForProduct(item).status === "pass").length;
  const sourceBlockedCount = products.filter((item) => researchTaskSummaryForProduct(item).status === "blocked").length;
  const sourceWarnCount = products.filter((item) => researchTaskSummaryForProduct(item).status === "warn").length;
  const generationTotals = products.reduce((total, item) => {
    const summary = item.generationSummary || {};
    total.records += Number(summary.total || 0);
    total.prompts += Number(summary.promptReadyCount || 0);
    total.videos += Number(summary.videoCount || 0);
    return total;
  }, { records: 0, prompts: 0, videos: 0 });
  const selectedGenerationSummary = selected.generationSummary || {};
  const selectedMaterialSummary = selected.materialSummary || summarizeMaterialChecklist(selected.assetChecklist || []);
  const selectedMaterialPrecheck = materialPrecheckForProduct(selected);
  const selectedAccountFit = useMemo(() => accountFitSummaryForProduct(selected, accounts), [selected, accounts]);
  const selectedAccount = selectedAccountFit.account;
  const selectedEvidencePack = useMemo(() => buildProductEvidencePack(selected, selectedAccount), [selected, selectedAccount]);
  const selectedAssetPlan = useMemo(() => buildAssetCompletionPlan(selected), [selected]);
  const selectedAssetLogs = useMemo(() => normalizeAssetActionLog(selected), [selected]);
  const selectedRecommendedSources = useMemo(() => recommendedResearchSourcesForProduct(selected), [selected]);
  const canMarkReady = !["可测", "小批量测试"].includes(selected.lifecycle);
  const selectedHasActiveBatch = hasActiveSelectionBatch(selected);
  const isTesting = selected.lifecycle === "小批量测试" || selectedHasActiveBatch;
  const selectedBatchGate = useMemo(() => selectionBatchGateForProduct(selected), [selected]);
  const selectedPersistedVerificationGate = useMemo(() => assetVerificationGateForProduct(selected, selectedAccountFit), [selected, selectedAccountFit]);
  const [reviewForm, setReviewForm] = useState(() => reviewFormFromMetrics(selected.reviewMetrics));
  const [uploadingSlotId, setUploadingSlotId] = useState("");
  const [cardDraft, setCardDraft] = useState(() => normalizeProductCardCheck(selected));
  const [evidenceCopyMessage, setEvidenceCopyMessage] = useState("");
  const [acceptanceCopyMessage, setAcceptanceCopyMessage] = useState("");
  const [verificationCopyMessage, setVerificationCopyMessage] = useState("");
  const [savingCard, setSavingCard] = useState(false);
  const [savingAssetPlan, setSavingAssetPlan] = useState(false);
  const [savingVerification, setSavingVerification] = useState(false);
  const currentReviewMetrics = normalizeReviewMetrics(reviewForm);
  const reviewSummary = summarizeReviewMetrics(currentReviewMetrics, selected.totalScore);
  const reviewAdvice = buildReviewAdvice(selected, currentReviewMetrics, reviewSummary, accounts);
  const draftCardPrecheck = useMemo(() => productCardPrecheck({ ...selected, cardCheck: cardDraft }), [selected, cardDraft]);
  const selectedAssetVerification = useMemo(() => buildAssetVerificationSnapshot({
    product: { ...selected, cardCheck: cardDraft },
    accountFit: selectedAccountFit,
    materialPrecheck: selectedMaterialPrecheck,
    cardPrecheck: draftCardPrecheck,
    assetPlan: selectedAssetPlan
  }), [selected, cardDraft, selectedAccountFit, selectedMaterialPrecheck, draftCardPrecheck, selectedAssetPlan]);
  const selectedDraftVerificationGate = useMemo(
    () => assetVerificationGateFromSnapshot({ ...selected, cardCheck: cardDraft }, selectedAssetVerification),
    [selected, cardDraft, selectedAssetVerification]
  );
  const selectedAcceptanceRows = useMemo(() => productAcceptanceGateRows({
    product: selected,
    accounts,
    accountFit: selectedAccountFit,
    materialPrecheck: selectedMaterialPrecheck,
    cardPrecheck: draftCardPrecheck,
    batchGate: selectedBatchGate,
    assetVerification: selectedDraftVerificationGate
  }), [selected, accounts, selectedAccountFit, selectedMaterialPrecheck, draftCardPrecheck, selectedBatchGate, selectedDraftVerificationGate]);
  const selectedAcceptanceSummary = useMemo(() => productAcceptanceSummary(selectedAcceptanceRows, selected), [selectedAcceptanceRows, selected]);
  const selectedCardDraftDirty = useMemo(() => {
    const savedCard = normalizeProductCardCheck(selected);
    return productCardFields.some((field) => savedCard[field.key] !== cardDraft[field.key]);
  }, [selected, cardDraft]);
  const selectedVerificationReadyForBatch = selectedPersistedVerificationGate.computedStatus !== "blocked"
    && !selectedPersistedVerificationGate.requiresSave
    && !selectedCardDraftDirty;
  const selectedBatchBlocked = !isTesting && (!selectedBatchGate.canQueue || selectedAccountFit.status === "blocked" || !selectedVerificationReadyForBatch);
  const canCreateNextBatch = selectedBatchGate.canQueue && selectedAccountFit.status !== "blocked" && selectedVerificationReadyForBatch;
  const selectedPrimaryCanPrepare = selectedCardDraftDirty || (
    selectedPersistedVerificationGate.requiresSave
    && selectedBatchGate.canQueue
    && selectedAccountFit.status !== "blocked"
    && selectedPersistedVerificationGate.computedStatus !== "blocked"
  );
  const selectedPrimaryActionDisabled = selectedBatchBlocked && !selectedPrimaryCanPrepare;
  const selectedManualReadinessBlocked = selectedAcceptanceSummary.blockedCount > 0 || selectedDraftVerificationGate.computedStatus === "blocked";
  const selectedManualReadinessWarn = !selectedManualReadinessBlocked
    && (selectedAcceptanceSummary.warnCount > 0 || selectedDraftVerificationGate.status === "warn");
  const selectedManualReadyLabel = !canMarkReady
    ? "退回补资产"
    : selectedManualReadinessBlocked
      ? "保存准入拦截"
      : selectedManualReadinessWarn
        ? "标记待核可测"
        : "标记可测";
  const selectedPrimaryBatchLabel = (() => {
    if (canCreateNextBatch) return selectionBatchActionLabel(selected, accounts);
    if (isTesting) return "查看批次";
    if (selectedCardDraftDirty) return "保存商品卡";
    if (selectedBatchGate.complianceBlocked) return "合规拦截";
    if (selectedBatchGate.researchBlocked) return "来源拦截";
    if (selectedBatchGate.cardBlocked) return "商品卡拦截";
    if (selectedPersistedVerificationGate.computedStatus === "blocked") return "验证拦截";
    if (selectedPersistedVerificationGate.requiresSave) return selectedPersistedVerificationGate.isStale ? "重存验证" : "保存验证";
    if (selectedAccountFit.status === "blocked") return "账号拦截";
    if (selectedMaterialPrecheck.status === "blocked") return "补关键素材";
    return selectedManualReadyLabel;
  })();
  const catalogFilters = [
    { id: "all", label: "全部", count: products.length },
    { id: "complianceBlocked", label: "合规拦截", count: complianceBlockedCount },
    { id: "complianceWarn", label: "合规待核", count: complianceWarnCount },
    { id: "sourceBlocked", label: "来源拦截", count: sourceBlockedCount },
    { id: "sourceWarn", label: "来源待核", count: sourceWarnCount },
    { id: "compliancePass", label: "合规可用", count: compliancePassCount },
    { id: "ready", label: "可生产", count: readyAssets },
    { id: "testing", label: "测试中", count: products.filter((item) => item.lifecycle === "小批量测试" || hasActiveSelectionBatch(item)).length }
  ];
  const catalogProducts = useMemo(() => products.filter((product) => {
    const compliance = complianceSummaryForProduct(product);
    const sourceTask = researchTaskSummaryForProduct(product);
    if (catalogFilter === "complianceBlocked") return compliance.status === "blocked";
    if (catalogFilter === "complianceWarn") return compliance.status === "warn";
    if (catalogFilter === "sourceBlocked") return sourceTask.status === "blocked";
    if (catalogFilter === "sourceWarn") return sourceTask.status === "warn";
    if (catalogFilter === "compliancePass") return compliance.status === "pass";
    if (catalogFilter === "ready") return product.assetPercent >= 78 && product.materialPrecheck?.status !== "blocked";
    if (catalogFilter === "testing") return product.lifecycle === "小批量测试" || hasActiveSelectionBatch(product);
    return true;
  }), [products, catalogFilter]);

  useEffect(() => {
    setReviewForm(reviewFormFromMetrics(selected.reviewMetrics));
  }, [selected.id, selected.reviewMetrics?.updatedAt]);

  useEffect(() => {
    setCardDraft(normalizeProductCardCheck(selected));
  }, [selected.id, selected.updatedAt]);

  useEffect(() => {
    setEvidenceCopyMessage("");
    setAcceptanceCopyMessage("");
    setVerificationCopyMessage("");
  }, [selected.id]);

  useEffect(() => {
    const focusedId = readSelectionProductFocus();
    if (focusedId && products.some((product) => product.id === focusedId)) {
      setSelectedId(focusedId);
      clearSelectionProductFocus();
      return;
    }
    if (focusedId && selectedId === focusedId) return;
    if (selectedId && products.some((product) => product.id === selectedId)) return;
    if (products[0]?.id) setSelectedId(products[0].id);
  }, [products, selectedId]);

  function updateReviewField(field, value) {
    setReviewForm((current) => ({ ...current, [field]: value }));
  }

  function withSelectedAssetVerificationLog(patch = {}, event = {}) {
    if (patch.assetValidationSnapshot) {
      return withAssetActionLog(selected, patch, event);
    }
    const nextProduct = { ...selected, ...patch };
    const verificationPatch = buildAssetVerificationRefreshPatch(nextProduct, accounts);
    const snapshot = verificationPatch.assetValidationSnapshot || {};
    return withAssetActionLogs(selected, {
      ...patch,
      ...verificationPatch
    }, [
      event,
      {
        type: "资产验证",
        label: "自动刷新生成前资产验证",
        detail: snapshot.summary || "资产验证已刷新",
        target: "生成前验证",
        status: snapshot.label || "已刷新"
      }
    ]);
  }

  function manualReadinessPatch(patch = {}, event = {}) {
    const cardPayload = productCardUpdatePayload(selected, cardDraft);
    const nextProduct = { ...selected, ...cardPayload, ...patch };
    const verificationSnapshot = patch.assetValidationSnapshot || buildAssetVerificationSnapshot({
      product: nextProduct,
      accountFit: selectedAccountFit,
      materialPrecheck: materialPrecheckForProduct(nextProduct),
      cardPrecheck: productCardPrecheck(nextProduct),
      assetPlan: nextProduct.assetCompletionPlan || selectedAssetPlan
    });
    return withAssetActionLogs(selected, {
      ...cardPayload,
      ...patch,
      assetValidationSnapshot: verificationSnapshot,
      assetVerificationUpdatedAt: verificationSnapshot.generatedAt || new Date().toISOString()
    }, [
      event,
      {
        type: "资产验证",
        label: "人工状态变更后同步验证",
        detail: verificationSnapshot.summary || "生成前资产验证已同步",
        target: "生成前验证",
        status: verificationSnapshot.label || verificationSnapshot.status || "已同步"
      }
    ]);
  }

  async function applySelectedManualReadiness() {
    try {
      if (!canMarkReady) {
        await onUpdateProduct(selected.id, manualReadinessPatch({
          lifecycle: "待补资产",
          assetStatus: "人工退回补资产",
          assetPercent: Math.min(Number(selected.assetPercent || 0), 72)
        }, {
          type: "人工准入",
          label: "退回补资产",
          detail: "人工将已放行 SKU 退回资产补齐队列",
          target: "准入验收",
          status: "待补资产"
        }), { silent: true });
        setAcceptanceCopyMessage(`${selected.sku} 已退回补资产，并同步刷新生成前验证。`);
        return;
      }

      if (selectedManualReadinessBlocked) {
        const blocker = selectedAssetVerification.status === "blocked"
          ? {
            label: selectedAssetVerification.label || "生成前验证",
            action: selectedAssetVerification.primaryAction || selectedAssetVerification.summary
          }
          : selectedAcceptanceSummary.primaryRow;
        const blockerLabel = blocker?.label || "准入验收";
        const blockerAction = blocker?.action || selectedAcceptanceSummary.action || "按准入验收项补齐";
        await onUpdateProduct(selected.id, manualReadinessPatch({
          lifecycle: "待补资产",
          assetStatus: `准入未通过：${blockerLabel}`,
          assetPercent: Math.min(Number(selected.assetPercent || 0), 76)
        }, {
          type: "人工准入",
          label: "保存准入拦截",
          detail: `${blockerLabel}：${blockerAction}`,
          target: "准入验收",
          status: "阻断"
        }), { silent: true });
        setAcceptanceCopyMessage(`${selected.sku} 已保存准入拦截：${blockerLabel}`);
        return;
      }

      const caution = selectedAssetVerification.status === "warn"
        ? selectedAssetVerification.primaryAction || selectedAssetVerification.summary
        : selectedAcceptanceSummary.primaryRow?.action || selectedAcceptanceSummary.action;
      await onUpdateProduct(selected.id, manualReadinessPatch({
        lifecycle: "可测",
        assetStatus: selectedManualReadinessWarn
          ? `准入待核：${caution || "按待核项保守推进"}`
          : "准入验收通过",
        assetPercent: Math.max(Number(selected.assetPercent || 0), selectedManualReadinessWarn ? 78 : 82)
      }, {
        type: "人工准入",
        label: selectedManualReadinessWarn ? "标记待核可测" : "标记可测",
        detail: selectedManualReadinessWarn
          ? caution || "存在待核项，按保守测品推进"
          : "评分、来源、素材、商品卡、账号和生成前验证已通过",
        target: "准入验收",
        status: selectedManualReadinessWarn ? "待核可测" : "可测"
      }), { silent: true });
      setAcceptanceCopyMessage(`${selected.sku} 已${selectedManualReadinessWarn ? "按待核状态标记可测" : "标记可测"}，并保存生成前验证。`);
    } catch (error) {
      setAcceptanceCopyMessage(error.message || "人工准入状态保存失败");
    }
  }

  async function eliminateSelectedProduct() {
    try {
      await onUpdateProduct(selected.id, manualReadinessPatch({
        lifecycle: "淘汰",
        assetStatus: "人工淘汰",
        assetPercent: Number(selected.assetPercent || 0)
      }, {
        type: "人工准入",
        label: "人工淘汰",
        detail: selectedAcceptanceSummary.action || selectedAssetVerification.summary || "人工判定不再进入测品池",
        target: "准入验收",
        status: "淘汰"
      }), { silent: true });
      setAcceptanceCopyMessage(`${selected.sku} 已淘汰，并写入资产日志。`);
    } catch (error) {
      setAcceptanceCopyMessage(error.message || "淘汰状态保存失败");
    }
  }

  async function handleSelectedPrimaryBatchAction() {
    if (canCreateNextBatch) {
      await onCreateBatch([selected], { autoStart: false });
      return;
    }
    if (isTesting) {
      navigate(activeSelectionBatchTarget(selected));
      return;
    }
    if (selectedCardDraftDirty) {
      await saveProductCardCheck();
      setAcceptanceCopyMessage("商品卡草稿已保存，请复核准入后再建草稿。");
      return;
    }
    if (selectedPersistedVerificationGate.requiresSave) {
      await saveSelectedAssetVerification();
      setAcceptanceCopyMessage("生成前验证已保存，请复核准入后再建草稿。");
      return;
    }
    await applySelectedManualReadiness();
  }

  async function saveReviewMetrics() {
    const metrics = normalizeReviewMetrics(reviewForm);
    const payload = reviewMetricsPayloadForProduct(selected, metrics, accounts);
    await onUpdateProduct(selected.id, withSelectedAssetVerificationLog(payload, {
      type: "数据回流",
      label: "商品详情保存复盘",
      detail: `${selected.totalScore || 0} -> ${payload.totalScore || 0}；${payload.reviewAdvice?.action || payload.scoreCalibration?.verdict || "复盘数据已写回"}`,
      target: "复盘数据",
      status: payload.reviewAdvice?.lifecycle || payload.scoreCalibration?.lifecycle || "已写回"
    }), { silent: true });
    setVerificationCopyMessage(`${selected.sku} 复盘已保存，并刷新生成前验证。`);
  }

  async function updateMaterialStatus(slotId, status) {
    const nextChecklist = (selected.assetChecklist || []).map((slot) =>
      slot.id === slotId ? { ...slot, status, updatedAt: new Date().toISOString() } : slot
    );
    const summary = summarizeMaterialChecklist(nextChecklist);
    const nextLifecycle = summary.blocked
      ? "待补资产"
      : summary.percent >= 78 && Number(selected.totalScore || 0) >= 75 && selected.lifecycle === "待补资产"
        ? "可测"
        : selected.lifecycle;
    await onUpdateProduct(selected.id, withSelectedAssetVerificationLog({
      assetChecklist: nextChecklist,
      assetPercent: summary.percent,
      assetStatus: summary.blocked
        ? `素材禁用：${summary.nextGap}`
        : summary.pending
          ? `素材待补：${summary.nextGap}`
          : "素材可生成",
      lifecycle: nextLifecycle
    }, {
      type: "素材状态",
      label: `${slotId} 标记为 ${status}`,
      detail: summary.nextGap,
      target: "素材清单",
      status
    }));
  }

  async function uploadMaterialFile(slot, file) {
    try {
      setUploadingSlotId(slot.id);
      await onUploadMaterial(selected, slot, file);
    } catch (error) {
      alert(error.message || "素材上传失败");
    } finally {
      setUploadingSlotId("");
    }
  }

  async function attachSelectedResearchSources() {
    if (!selectedRecommendedSources.length) {
      setEvidenceCopyMessage("当前 SKU 暂无可自动补入的新来源。");
      return;
    }
    try {
      await onUpdateProduct(selected.id, withSelectedAssetVerificationLog(researchSourcePatchForProduct(selected, selectedRecommendedSources), {
        type: "调研来源",
        label: "商品库补入基础规则来源",
        detail: selectedRecommendedSources.map((source) => source.label).join("、"),
        target: "来源证据",
        status: "已补"
      }), { silent: true });
      setEvidenceCopyMessage(`已补入 ${selectedRecommendedSources.length} 条基础规则来源。`);
    } catch (error) {
      setEvidenceCopyMessage(error.message || "来源补入失败");
    }
  }

  async function saveSelectedAssetPlan() {
    try {
      setSavingAssetPlan(true);
      await onUpdateProduct(selected.id, withSelectedAssetVerificationLog({
        assetCompletionPlan: selectedAssetPlan,
        assetStatus: selectedAssetPlan.status === "阻断"
          ? selectedAssetPlan.summary
          : selectedAssetPlan.status === "待补"
            ? selectedAssetPlan.summary
            : "资产补齐计划可用"
      }, {
        type: "补齐计划",
        label: "保存资产补齐计划",
        detail: selectedAssetPlan.summary,
        target: "资产补齐计划",
        status: selectedAssetPlan.status
      }), { silent: true });
      setEvidenceCopyMessage("资产补齐计划已保存。");
    } catch (error) {
      setEvidenceCopyMessage(error.message || "资产补齐计划保存失败");
    } finally {
      setSavingAssetPlan(false);
    }
  }

  async function copyEvidencePack() {
    try {
      await navigator.clipboard.writeText(productEvidencePackText(selectedEvidencePack));
      setEvidenceCopyMessage(`已复制 ${selected.sku} 证据包`);
    } catch {
      setEvidenceCopyMessage("复制失败，可直接导出 CSV");
    }
  }

  async function copyAssetVerification() {
    try {
      await navigator.clipboard.writeText(assetVerificationText(selectedDraftVerificationGate));
      setVerificationCopyMessage(`已复制 ${selected.sku} 资产验证清单`);
    } catch {
      setVerificationCopyMessage("复制失败，可直接按验证项处理。");
    }
  }

  async function saveAssetVerification() {
    try {
      setSavingVerification(true);
      const cardPayload = productCardUpdatePayload(selected, cardDraft);
      const nextLifecycle = selected.lifecycle === "淘汰"
        ? selected.lifecycle
        : selectedAssetVerification.status === "blocked"
          ? "待补资产"
          : selectedAssetVerification.status === "pass" && Number(selected.totalScore || 0) >= 75 && ["观察", "待补资产"].includes(selected.lifecycle)
            ? "可测"
            : selected.lifecycle;
      await onUpdateProduct(selected.id, withAssetActionLog(selected, {
        ...cardPayload,
        assetValidationSnapshot: selectedAssetVerification,
        assetStatus: selectedAssetVerification.summary,
        assetPercent: selectedAssetVerification.status === "pass"
          ? Math.max(selected.assetPercent || 0, 82)
          : selected.assetPercent,
        lifecycle: nextLifecycle
      }, {
        type: "资产验证",
        label: "保存生成前资产验证",
        detail: selectedAssetVerification.summary,
        target: "生成前资产验证",
        status: selectedAssetVerification.label
      }), { silent: true });
      setVerificationCopyMessage(`${selected.sku} 资产验证已保存：${selectedAssetVerification.label}`);
    } catch (error) {
      setVerificationCopyMessage(error.message || "资产验证保存失败");
    } finally {
      setSavingVerification(false);
    }
  }

  async function copyAcceptanceChecklist() {
    try {
      await navigator.clipboard.writeText(productAcceptanceText(selected, selectedAcceptanceRows, selectedAcceptanceSummary));
      setAcceptanceCopyMessage(`已复制 ${selected.sku} 准入验收清单`);
    } catch {
      setAcceptanceCopyMessage("复制失败，可直接按面板验收项处理。");
    }
  }

  function updateCardDraft(fieldKey, value) {
    setCardDraft((current) => ({ ...current, [fieldKey]: value }));
  }

  function applyProductCardDraft() {
    setCardDraft(productCardDraftForProduct(selected));
    setEvidenceCopyMessage("已生成保守商品卡草稿，确认后可保存。");
  }

  async function saveProductCardCheck() {
    try {
      setSavingCard(true);
      const cardPayload = productCardUpdatePayload(selected, cardDraft);
      await onUpdateProduct(selected.id, withSelectedAssetVerificationLog(cardPayload, {
        type: "商品卡",
        label: "保存商品卡核验",
        detail: cardPayload.cardPrecheck?.nextGap || "商品卡承接可用",
        target: "商品卡承接",
        status: cardPayload.cardPrecheck?.status || ""
      }));
    } catch (error) {
      alert(error.message || "商品卡保存失败");
    } finally {
      setSavingCard(false);
    }
  }

  return (
    <section className="selection-page">
      <div className="panel selection-hero">
        <div>
          <span className="workflow-stage">商品资产包</span>
          <h2>商品资料库</h2>
          <p>每个 SKU 以商品事实、商品卡承接、卖点白名单、禁用话术、素材和生成记录为一个资产包。</p>
        </div>
        <div className="hero-actions">
          <DataSourceBadge selectionAssets={selectionAssets} />
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            <span>刷新资产</span>
          </button>
          <button className="primary-button" type="button" onClick={() => navigate("studio")}>
            <Play size={16} />
            <span>单条生成</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => navigate("assets")}>
            <FolderOpen size={16} />
            <span>素材输出</span>
          </button>
        </div>
      </div>

      <div className="selection-metric-grid four">
        <SelectionMetricCard label="资产包" value={products.length} detail="已建档 SKU" icon={Database} tone="info" />
        <SelectionMetricCard label="可直接生产" value={readyAssets} detail="资产完整度 >= 78%" icon={ShieldCheck} tone="good" />
        <SelectionMetricCard label="合规拦截" value={complianceBlockedCount} detail={`${complianceWarnCount} 个待核 / ${compliancePassCount} 个可用`} icon={ShieldCheck} tone={complianceBlockedCount ? "bad" : complianceWarnCount ? "warn" : "good"} />
        <SelectionMetricCard label="视频回流" value={generationTotals.videos} detail="来自批量任务结果" icon={Video} tone={generationTotals.videos ? "good" : "warn"} />
      </div>

      <CandidateQuickAddPanel
        products={products}
        onCreateProduct={onCreateProduct}
        onCreated={(product) => setSelectedId(product.id)}
      />

      <BulkReviewImportPanel
        products={products}
        accounts={accounts}
        onUpdateProduct={onUpdateProduct}
        onImported={(product) => {
          if (product?.id) setSelectedId(product.id);
        }}
      />

      <div className="product-library-layout">
        <aside className="panel product-catalog">
          <div className="mini-panel-head">
            <Database size={17} />
            <strong>SKU 资产包</strong>
          </div>
          <div className="catalog-filter-bar">
            {catalogFilters.map((item) => (
              <button className={catalogFilter === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setCatalogFilter(item.id)}>
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </button>
            ))}
          </div>
          <div className="catalog-list">
            {catalogProducts.map((product) => {
              const compliance = complianceSummaryForProduct(product);
              const sourceTask = researchTaskSummaryForProduct(product);
              return (
                <button
                  className={product.id === selected.id ? `active ${sourceTask.tone === "good" ? compliance.tone : sourceTask.tone}` : sourceTask.tone === "good" ? compliance.tone : sourceTask.tone}
                  type="button"
                  key={product.id}
                  onClick={() => setSelectedId(product.id)}
                >
                  <span>{product.sku}</span>
                  <small>{product.category} · {product.assetPercent}% · {compliance.label} · {sourceTask.label}</small>
                  <small>{sourceTask.status === "pass" ? compliance.primary : sourceTask.action}</small>
                </button>
              );
            })}
            {!catalogProducts.length ? <p className="selection-muted">当前分组没有 SKU。</p> : null}
          </div>
        </aside>

        <div className="panel product-detail-panel">
          <div className="product-detail-head">
            <div>
              <span className="workflow-stage">{selected.category}</span>
              <h2>{selected.sku}</h2>
              <p>{selected.coreReason}</p>
            </div>
            <div className="product-head-score">
              <ScorePill value={selected.totalScore} />
              <SelectionStatusBadge value={selected.lifecycle} />
            </div>
          </div>

          <div className="product-detail-grid">
            <ProductIntelligencePanel product={selected} accounts={accounts} />

            <ProductAcceptanceGatePanel
              product={selected}
              rows={selectedAcceptanceRows}
              summary={selectedAcceptanceSummary}
              onCopy={copyAcceptanceChecklist}
              copyMessage={acceptanceCopyMessage}
              onCreateBatch={onCreateBatch}
              onAttachSources={attachSelectedResearchSources}
              onSavePlan={saveSelectedAssetPlan}
              onApplyCardDraft={applyProductCardDraft}
              navigate={navigate}
            />

            <EvidencePackPanel
              pack={selectedEvidencePack}
              onCopy={copyEvidencePack}
              onExport={() => downloadProductEvidencePack(selectedEvidencePack)}
              copyMessage={evidenceCopyMessage}
            />

            <AssetCompletionPlanPanel
              plan={selectedAssetPlan}
              onSavePlan={saveSelectedAssetPlan}
              onExport={() => downloadAssetCompletionPlans([selected], `${selected.sku || "SKU"}-资产补齐计划.csv`)}
              saving={savingAssetPlan}
            />

            <AssetVerificationPanel
              snapshot={selectedDraftVerificationGate}
              onCopy={copyAssetVerification}
              onSave={saveAssetVerification}
              saving={savingVerification}
              copyMessage={verificationCopyMessage}
            />

            <AssetActionLogPanel logs={selectedAssetLogs} />

            <div className="asset-section">
              <div className="mini-panel-head">
                <Gauge size={17} />
                <strong>商品事实</strong>
              </div>
              <dl className="fact-grid">
                <div><dt>价格带</dt><dd>{selected.priceBand} 元</dd></div>
                <div><dt>佣金/利润</dt><dd>{selected.commission}</dd></div>
                <div><dt>节点窗口</dt><dd>{selected.node}</dd></div>
                <div><dt>主推模板</dt><dd>{selected.primaryTemplate}</dd></div>
              </dl>
            </div>

            <div className="asset-section">
              <div className="mini-panel-head">
                <Clipboard size={17} />
                <strong>商品卡承接</strong>
              </div>
              <div className="product-card-editor">
                <div className={`product-card-precheck ${productCardPrecheckTone(draftCardPrecheck)}`}>
                  <span>{productCardPrecheckLabel(draftCardPrecheck)}</span>
                  <strong>{draftCardPrecheck.percent}%</strong>
                  <small>{draftCardPrecheck.nextGap}</small>
                </div>
                <div className="product-card-editor-grid">
                  {productCardFields.map((field) => {
                    const fieldStatus = draftCardPrecheck.fieldResults.find((item) => item.key === field.key)?.status || "pass";
                    return (
                      <label className={fieldStatus} key={field.key}>
                        <span>{field.label}</span>
                        <textarea
                          value={cardDraft[field.key] || ""}
                          onChange={(event) => updateCardDraft(field.key, event.target.value)}
                          placeholder={field.placeholder}
                          rows={field.key === "reviews" ? 3 : 2}
                        />
                      </label>
                    );
                  })}
                </div>
                <div className="product-card-editor-actions">
                  <div className="product-card-issue-list">
                    {productCardIssueList(draftCardPrecheck).slice(0, 4).map((issue) => (
                      <span key={issue}>{issue}</span>
                    ))}
                    {!productCardIssueList(draftCardPrecheck).length ? <span>商品卡承接可用</span> : null}
                  </div>
                  <button className="secondary-button" type="button" disabled={savingCard} onClick={applyProductCardDraft}>
                    <Sparkles size={16} />
                    <span>生成草稿</span>
                  </button>
                  <button className="secondary-button" type="button" disabled={savingCard} onClick={saveProductCardCheck}>
                    <Database size={16} />
                    <span>{savingCard ? "保存中" : "保存商品卡"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="asset-section">
              <div className="mini-panel-head">
                <Sparkles size={17} />
                <strong>卖点白名单</strong>
              </div>
              <TagList items={selected.whiteList} tone="good" />
            </div>

            <div className="asset-section">
              <div className="mini-panel-head">
                <AlertTriangle size={17} />
                <strong>禁用话术</strong>
              </div>
              <TagList items={selected.bannedWords} tone="bad" />
            </div>

            <div className="asset-section">
              <div className="mini-panel-head">
                <Image size={17} />
                <strong>资产缺口</strong>
              </div>
              <div className="asset-progress large">
                <span style={{ width: `${selected.assetPercent}%` }} />
              </div>
              <TagList items={selected.assetGaps} tone="warn" />
            </div>

            <div className="asset-section material-section">
              <div className="mini-panel-head">
                <FolderOpen size={17} />
                <strong>素材清单</strong>
              </div>
              <div className="material-summary-strip">
                <div><span>完整度</span><strong>{selectedMaterialSummary.percent}%</strong></div>
                <div><span>已就绪</span><strong>{selectedMaterialSummary.ready}</strong></div>
                <div><span>待补</span><strong>{selectedMaterialSummary.pending}</strong></div>
                <div><span>禁用</span><strong>{selectedMaterialSummary.blocked}</strong></div>
              </div>
              <div className="material-precheck-panel">
                <MaterialPrecheckBadge product={selected} />
                {[...selectedMaterialPrecheck.hardIssues, ...selectedMaterialPrecheck.warnings].slice(0, 4).map((issue) => (
                  <span key={issue}>{issue}</span>
                ))}
              </div>
              <MaterialChecklist
                checklist={selected.assetChecklist || []}
                uploadingSlotId={uploadingSlotId}
                onUpdateStatus={updateMaterialStatus}
                onUploadFile={uploadMaterialFile}
              />
            </div>

            <div className="asset-section">
              <div className="mini-panel-head">
                <KeyRound size={17} />
                <strong>推荐账号</strong>
              </div>
              <strong className="account-pick">{selectedAccount?.name || "未匹配账号"}</strong>
              <p>{selectedAccount?.position || selectedAccountFit.action}</p>
            </div>

            <div className="asset-section">
              <div className="mini-panel-head">
                <ListChecks size={17} />
                <strong>关联批次</strong>
              </div>
              <BatchLinksList links={selected.batchLinks || []} />
            </div>

            <div className="asset-section generation-section">
              <div className="mini-panel-head">
                <Video size={17} />
                <strong>生成记录</strong>
              </div>
              <div className="generation-summary-strip">
                <div><span>批次记录</span><strong>{selectedGenerationSummary.total || 0}</strong></div>
                <div><span>已出提示词</span><strong>{selectedGenerationSummary.promptReadyCount || 0}</strong></div>
                <div><span>已出视频</span><strong>{selectedGenerationSummary.videoCount || 0}</strong></div>
                <div><span>异常</span><strong>{selectedGenerationSummary.failedCount || 0}</strong></div>
              </div>
              <GenerationRecordsList records={selected.generationRecords || []} />
            </div>

            <div className="asset-section review-section">
              <div className="mini-panel-head">
                <Activity size={17} />
                <strong>复盘数据</strong>
              </div>
              <div className="review-metric-grid">
                <label>
                  <span>播放</span>
                  <input value={reviewForm.views} inputMode="numeric" onChange={(event) => updateReviewField("views", event.target.value)} />
                </label>
                <label>
                  <span>点击</span>
                  <input value={reviewForm.clicks} inputMode="numeric" onChange={(event) => updateReviewField("clicks", event.target.value)} />
                </label>
                <label>
                  <span>商品卡点击</span>
                  <input value={reviewForm.cardClicks} inputMode="numeric" onChange={(event) => updateReviewField("cardClicks", event.target.value)} />
                </label>
                <label>
                  <span>成交</span>
                  <input value={reviewForm.orders} inputMode="numeric" onChange={(event) => updateReviewField("orders", event.target.value)} />
                </label>
                <label>
                  <span>退货</span>
                  <input value={reviewForm.refunds} inputMode="numeric" onChange={(event) => updateReviewField("refunds", event.target.value)} />
                </label>
              </div>
              <div className="review-rate-grid">
                <div><span>点击率</span><strong>{formatRate(reviewSummary.ctr)}</strong></div>
                <div><span>商品卡承接</span><strong>{formatRate(reviewSummary.cardRate)}</strong></div>
                <div><span>点击转化</span><strong>{formatRate(reviewSummary.orderRate)}</strong></div>
                <div><span>退货率</span><strong>{formatRate(reviewSummary.refundRate)}</strong></div>
              </div>
              <div className="review-text-grid">
                <label>
                  <span>评论高频问题</span>
                  <textarea value={reviewForm.commentIssues} onChange={(event) => updateReviewField("commentIssues", event.target.value)} placeholder="例如：尺寸、气味、是否防水、发货时效" />
                </label>
                <label>
                  <span>复盘备注</span>
                  <textarea value={reviewForm.note} onChange={(event) => updateReviewField("note", event.target.value)} placeholder="记录本轮测试结论、下轮改法或淘汰原因" />
                </label>
              </div>
              <ReviewAdvicePanel advice={reviewAdvice} />
              <div className="review-verdict">
                <div>
                  <span>建议动作</span>
                  <strong>{reviewAdvice.action}</strong>
                  <small>保存后状态变为 {reviewAdvice.lifecycle}，评分调整到 {reviewSummary.adjustedScore}</small>
                </div>
                <button className="primary-button" type="button" onClick={saveReviewMetrics}>
                  <Download size={16} />
                  <span>保存复盘</span>
                </button>
              </div>
            </div>
          </div>

          <div className="product-detail-footer">
            <div>
              <strong>建议视频结构</strong>
              <TagList items={selected.videoAngles} tone="muted" />
            </div>
            <div className="product-batch-preview">
              <BatchPrecheckPanel products={[selected]} accounts={accounts} onCreateBatch={onCreateBatch} title="当前 SKU 测品" />
            </div>
            <div className="workflow-action-list">
              <button
                className="secondary-button"
                type="button"
                onClick={applySelectedManualReadiness}
              >
                <ShieldCheck size={16} />
                <span>{selectedManualReadyLabel}</span>
              </button>
              <button
                className="secondary-button danger-light"
                type="button"
                onClick={eliminateSelectedProduct}
              >
                <X size={16} />
                <span>淘汰</span>
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={selectedPrimaryActionDisabled}
                onClick={handleSelectedPrimaryBatchAction}
              >
                <ListChecks size={16} />
                <span>{selectedPrimaryBatchLabel}</span>
              </button>
              <button className="secondary-button" type="button" onClick={attachSelectedResearchSources} disabled={!selectedRecommendedSources.length}>
                <BookOpen size={16} />
                <span>{selectedRecommendedSources.length ? `补来源 ${selectedRecommendedSources.length}` : "来源已补"}</span>
              </button>
              <button className="secondary-button" type="button" onClick={() => navigate("accountAssets")}>
                <KeyRound size={16} />
                <span>账号适配</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AccountReadinessPanel({ rows = [], groups = [], onEditAccount, onCopyRow, onCopyAll, onRepairData, repairing = false, copyMessage = "" }) {
  const blockedCount = rows.filter((row) => row.status === "blocked").length;
  const warnCount = rows.filter((row) => row.status === "warn").length;
  const passCount = rows.filter((row) => row.status === "pass").length;
  const matchedSkuCount = rows.reduce((total, row) => total + row.matched.length, 0);
  const repairCount = rows.filter((row) => (row.account.dataQualityWarnings || []).length).length;
  return (
    <div className="panel account-readiness-panel">
      <div className="selection-task-head">
        <div>
          <div className="mini-panel-head">
            <ShieldCheck size={17} />
            <strong>账号承接验收队列</strong>
          </div>
          <p>把账号资产拆成定位、类目、DOC 包、平台规则、禁做边界、场景语气和 SKU 覆盖，作为批次准入前的账号侧验收。</p>
        </div>
        <div className="selection-task-actions">
          <button className="secondary-button" type="button" onClick={onRepairData} disabled={!repairCount || repairing}>
            <ShieldCheck size={16} />
            <span>{repairing ? "修复中" : repairCount ? `修复资料 ${repairCount}` : "资料正常"}</span>
          </button>
          <button className="secondary-button" type="button" onClick={onCopyAll} disabled={!groups.length}>
            <Copy size={16} />
            <span>{groups.length ? "复制分派" : "暂无分派"}</span>
          </button>
        </div>
      </div>
      {copyMessage ? <p className="selection-task-message">{copyMessage}</p> : null}
      <div className="account-readiness-summary">
        <div><span>账号可用</span><strong>{passCount}</strong></div>
        <div><span>账号待核</span><strong>{warnCount}</strong></div>
        <div><span>账号阻断</span><strong>{blockedCount}</strong></div>
        <div><span>覆盖 SKU</span><strong>{matchedSkuCount}</strong></div>
      </div>
      <div className="account-readiness-layout">
        <div className="account-readiness-list">
          {rows.map((row) => (
            <div className={`account-readiness-row ${row.tone}`} key={row.account.id}>
              <div className="account-readiness-score">
                <span>{row.score}</span>
                <small>{row.statusLabel}</small>
              </div>
              <div>
                <strong>{row.account.name}</strong>
                <span>{row.primaryTask?.label || "验收通过"} · {row.primaryTask?.action || "账号资产可承接"}</span>
                <small>{row.matched.length} 个 SKU · {row.mainDoc ? `${row.mainDoc.name} ${row.mainDoc.version}` : "DOC 待补"} · {row.mainPlatform?.platform || "平台待补"}</small>
              </div>
              <div className="account-readiness-actions">
                <button className="secondary-button" type="button" onClick={() => onCopyRow(row)}>
                  <Copy size={15} />
                  <span>复制</span>
                </button>
                <button className="secondary-button" type="button" onClick={() => onEditAccount(row.account.id)}>
                  <ChevronRight size={15} />
                  <span>编辑</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="account-handoff-board">
          {groups.slice(0, 4).map((group) => (
            <div className="account-handoff-column" key={group.owner}>
              <div className="manual-handoff-title">
                <strong>{group.owner}</strong>
                <span>{group.blocked} 阻断 / {group.warn} 待核</span>
              </div>
              <div className="account-handoff-items">
                {group.items.slice(0, 4).map((item) => (
                  <button className={`account-handoff-item ${item.task.tone}`} type="button" key={item.id} onClick={() => onEditAccount(item.account.id)}>
                    <strong>{item.account.name}</strong>
                    <span>{item.task.label}</span>
                    <small>{item.task.action}</small>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!groups.length ? <p className="selection-muted">账号侧暂无阻断或待核分派。</p> : null}
        </div>
      </div>
    </div>
  );
}

function AccountAssetEditor({ draft, onChange, onSubmit, saving, isNew, products = [] }) {
  const preview = accountDraftToPayload(draft);
  const matchedProducts = products.filter((product) => accountMatchesProduct(preview, product)).slice(0, 8);
  const activeDocPack = selectDocPackForProduct(preview, matchedProducts[0] || products[0]);
  const activePlatform = selectPlatformBindingForAccount(preview);

  function update(field, value) {
    onChange({ ...draft, [field]: value });
  }

  return (
    <form className="panel account-editor-panel" onSubmit={onSubmit}>
      <div className="account-editor-head">
        <div>
          <span className="workflow-stage">{isNew ? "新增账号" : "编辑账号"}</span>
          <h2>{isNew ? "新建账号资产" : draft.name || "账号资产"}</h2>
          <p>维护账号定位、场景、DOC 包和禁做边界，批次生成会按这里的资产自动带入提示词。</p>
        </div>
        <button className="primary-button" type="submit" disabled={saving || !preview.name}>
          <Database size={16} />
          <span>{saving ? "保存中" : "保存账号"}</span>
        </button>
      </div>

      <div className="account-editor-grid">
        <label>
          <span>账号名称</span>
          <input value={draft.name} onChange={(event) => update("name", event.target.value)} placeholder="例如：旅行出行号" />
        </label>
        <label>
          <span>平台</span>
          <select value={draft.platform} onChange={(event) => update("platform", event.target.value)}>
            <option value="抖音">抖音</option>
            <option value="视频号">视频号</option>
            <option value="小红书">小红书</option>
            <option value="多平台">多平台</option>
          </select>
        </label>
        <label>
          <span>平台绑定</span>
          <input value={draft.platformBindings} onChange={(event) => update("platformBindings", event.target.value)} placeholder="例如：抖音、小红书" />
        </label>
        <label>
          <span>人设语气</span>
          <input value={draft.tone} onChange={(event) => update("tone", event.target.value)} placeholder="例如：清单式、直接、强调边界" />
        </label>
        <label className="account-editor-wide">
          <span>账号定位</span>
          <textarea value={draft.position} onChange={(event) => update("position", event.target.value)} placeholder="例如：毕业旅行、玩水出行、低价收纳清单" />
        </label>
        <label className="account-editor-wide">
          <span>适合类目</span>
          <textarea value={draft.fit} onChange={(event) => update("fit", event.target.value)} placeholder="用顿号分隔，例如：玩水出行、毕业旅行、美妆边缘品" />
        </label>
        <label className="account-editor-wide">
          <span>推荐 SKU</span>
          <textarea value={draft.recommended} onChange={(event) => update("recommended", event.target.value)} placeholder="用顿号分隔，例如：防水手机袋、速干毛巾、旅行分装瓶" />
        </label>
        <label className="account-editor-wide">
          <span>常用场景</span>
          <textarea value={draft.scenes} onChange={(event) => update("scenes", event.target.value)} placeholder="例如：旅行箱、水乐园、宿舍、洗漱包" />
        </label>
        <label>
          <span>DOC 包</span>
          <textarea value={draft.docPacks} onChange={(event) => update("docPacks", event.target.value)} placeholder="例如：旅行清单 DOC v1、搜索答案型 DOC v1" />
        </label>
        <label className="account-editor-wide">
          <span>DOC 版本</span>
          <textarea value={draft.docPackVersions} onChange={(event) => update("docPackVersions", event.target.value)} placeholder="每行一个：旅行清单 DOC | v2 | 场景清单型 | 主用 | 补搜索词和 AI 标识" />
        </label>
        <label>
          <span>禁做边界</span>
          <textarea value={draft.avoid} onChange={(event) => update("avoid", event.target.value)} placeholder="例如：无授权IP、夸大防水效果" />
        </label>
        <label className="account-editor-wide">
          <span>最新判断</span>
          <textarea value={draft.lastSignal} onChange={(event) => update("lastSignal", event.target.value)} placeholder="例如：适合低价、低解释、节点明确的旅行清单 SKU。" />
        </label>
      </div>

      <div className="account-editor-preview">
        <div>
          <span>匹配 SKU</span>
          <strong>{matchedProducts.length}</strong>
        </div>
        <div>
          <span>类目</span>
          <TagList items={preview.fit.slice(0, 6)} tone="good" />
        </div>
        <div>
          <span>推荐</span>
          <TagList items={matchedProducts.map((product) => product.sku)} tone="muted" />
        </div>
        <div>
          <span>主用 DOC</span>
          <strong>{activeDocPack ? `${activeDocPack.name} ${activeDocPack.version}` : "-"}</strong>
        </div>
        <div>
          <span>主平台</span>
          <strong>{activePlatform?.platform || "-"}</strong>
        </div>
      </div>
    </form>
  );
}

function AccountAssetsPage({ selectionAssets, navigate, onRefresh, onSaveAccount }) {
  const products = useMemo(() => sortedSelectionProducts(selectionAssets?.products), [selectionAssets]);
  const accounts = selectionAssets?.accounts?.length ? selectionAssets.accounts : accountAssetSeeds;
  const [selectedId, setSelectedId] = useState(() => readAccountAssetFocus() || accounts[0]?.id || "new");
  const selectedAccount = accounts.find((account) => account.id === selectedId);
  const [draft, setDraft] = useState(() => accountAssetToDraft(selectedAccount || accounts[0] || {}));
  const [saving, setSaving] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [readinessCopyMessage, setReadinessCopyMessage] = useState("");
  const [repairingAccounts, setRepairingAccounts] = useState(false);

  useEffect(() => {
    if (selectedId === "new") {
      setDraft(emptyAccountAssetDraft());
      return;
    }
    if (selectedAccount) setDraft(accountAssetToDraft(selectedAccount));
  }, [selectedId, selectedAccount?.id, selectedAccount?.updatedAt]);

  useEffect(() => {
    const focusedId = readAccountAssetFocus();
    if (focusedId && accounts.some((account) => account.id === focusedId)) {
      setSelectedId(focusedId);
      clearAccountAssetFocus();
      return;
    }
    if (focusedId && selectedId === focusedId) return;
    if (selectedId !== "new" && !accounts.some((account) => account.id === selectedId)) {
      setSelectedId(accounts[0]?.id || "new");
    }
  }, [accounts, selectedId]);

  const matchCounts = useMemo(() => {
    const counts = new Map(accounts.map((account) => [account.id, 0]));
    for (const product of products) {
      const fit = accountFitSummaryForProduct(product, accounts);
      if (fit.account?.id) counts.set(fit.account.id, (counts.get(fit.account.id) || 0) + 1);
    }
    return counts;
  }, [accounts, products]);
  const accountAudit = useMemo(() => buildAccountCoverageAudit(products, accounts), [products, accounts]);
  const accountReadinessRows = useMemo(() => buildAccountReadinessRows(accounts, products, accountAudit), [accounts, products, accountAudit]);
  const accountHandoffGroups = useMemo(() => buildAccountReadinessHandoffGroups(accountReadinessRows), [accountReadinessRows]);

  function scrollToAccountEditor() {
    window.setTimeout(() => {
      document.querySelector(".account-editor-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function editAccount(accountId) {
    setSelectedId(accountId);
    scrollToAccountEditor();
  }

  async function submitAccount(event) {
    event.preventDefault();
    const payload = accountDraftToPayload(draft);
    if (!payload.name) {
      alert("请先填写账号名称。");
      return;
    }
    if (!payload.position || !payload.fit.length) {
      alert("请补账号定位和适合类目，后续才能稳定匹配 SKU。");
      return;
    }
    try {
      setSaving(true);
      const saved = await onSaveAccount(payload);
      setSelectedId(saved.id);
      setDraft(accountAssetToDraft(saved));
      setDraftMessage(`${saved.name} 已保存，可回到准入队列复核账号适配。`);
    } catch (error) {
      alert(error.message || "账号资产保存失败");
    } finally {
      setSaving(false);
    }
  }

  function createAccountDraftFromGap(row) {
    const product = row?.product || {};
    setSelectedId("new");
    setDraft(accountDraftFromCoverageGap(product, row));
    setDraftMessage(`${product.sku || "该 SKU"} 的账号缺口已生成草稿，确认定位、DOC 包和禁做边界后保存。`);
    scrollToAccountEditor();
  }

  async function copyAccountReadiness(row) {
    try {
      await navigator.clipboard.writeText(accountReadinessText(row));
      setReadinessCopyMessage(`已复制 ${row.account.name} 验收清单`);
    } catch {
      setReadinessCopyMessage("复制失败，可直接按队列处理。");
    }
  }

  async function copyAccountHandoff() {
    try {
      await navigator.clipboard.writeText(accountReadinessHandoffText(accountHandoffGroups));
      setReadinessCopyMessage(`已复制 ${accountHandoffGroups.length} 个负责人分派清单`);
    } catch {
      setReadinessCopyMessage("复制失败，可直接按负责人分派栏处理。");
    }
  }

  async function repairAccountDataQuality() {
    const targets = accountReadinessRows
      .map((row) => row.account)
      .filter((account) => account?.id && (account.dataQualityWarnings || []).length);
    if (!targets.length) {
      setReadinessCopyMessage("账号资料没有发现需要修复的异常占位文本。");
      return;
    }
    try {
      setRepairingAccounts(true);
      const savedAccounts = await Promise.all(targets.map((account) =>
        onSaveAccount({
          ...account,
          dataQualityWarnings: []
        })
      ));
      const selectedSaved = savedAccounts.find((account) => account.id === selectedId);
      if (selectedSaved) setDraft(accountAssetToDraft(selectedSaved));
      setReadinessCopyMessage(`已修复并保存 ${savedAccounts.length} 个账号资料。`);
    } catch (error) {
      setReadinessCopyMessage(error.message || "账号资料修复保存失败");
    } finally {
      setRepairingAccounts(false);
    }
  }

  return (
    <section className="selection-page">
      <div className="panel selection-hero">
        <div>
          <span className="workflow-stage">账号资产库</span>
          <h2>账号资产库</h2>
          <p>维护账号人设、场景、DOC 包和禁做边界，生成批次时按 SKU 自动匹配可复用的账号资产。</p>
        </div>
        <div className="hero-actions">
          <DataSourceBadge selectionAssets={selectionAssets} />
          <button className="secondary-button" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            <span>刷新资产</span>
          </button>
          <button className="primary-button" type="button" onClick={() => navigate("studio")}>
            <FileText size={16} />
            <span>提示词工作台</span>
          </button>
          <button className="secondary-button" type="button" onClick={() => navigate("productScoring")}>
            <BarChart3 size={16} />
            <span>回到评分</span>
          </button>
        </div>
      </div>

      {draftMessage ? <p className="selection-task-message">{draftMessage}</p> : null}

      <div className="account-workbench">
        <div className="panel account-library-panel">
          <div className="panel-head">
            <div>
              <h2>账号列表</h2>
              <p>{accounts.length} 个账号资产，按匹配 SKU 数辅助选择。</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => {
              setSelectedId("new");
              setDraft(emptyAccountAssetDraft());
              setDraftMessage("已打开空白账号草稿。");
            }}>
              <KeyRound size={16} />
              <span>新增账号</span>
            </button>
          </div>
          <div className="account-picker-list">
            {accounts.map((account) => (
              <button className={selectedId === account.id ? "active" : ""} type="button" key={account.id} onClick={() => setSelectedId(account.id)}>
                <strong>{account.name}</strong>
                <span>{account.position}</span>
                <em>{matchCounts.get(account.id) || 0} 个 SKU</em>
              </button>
            ))}
          </div>
        </div>
        <AccountAssetEditor
          draft={draft}
          onChange={setDraft}
          onSubmit={submitAccount}
          saving={saving}
          isNew={selectedId === "new"}
          products={products}
        />
      </div>

      <AccountReadinessPanel
        rows={accountReadinessRows}
        groups={accountHandoffGroups}
        onEditAccount={editAccount}
        onCopyRow={copyAccountReadiness}
        onCopyAll={copyAccountHandoff}
        onRepairData={repairAccountDataQuality}
        repairing={repairingAccounts}
        copyMessage={readinessCopyMessage}
      />

      <div className="panel account-fit-overview-panel">
        <div className="panel-head">
          <div>
            <h2>账号适配准入</h2>
            <p>按 SKU 类目、场景、推荐绑定、DOC 包和平台规则判断是否能进入批次。</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => navigate("selectionAssets")}>
            <Clipboard size={16} />
            <span>回总览</span>
          </button>
        </div>
        <div className="account-coverage-summary">
          <div><span>强匹配</span><strong>{accountAudit.strongRows.length}</strong></div>
          <div><span>弱匹配</span><strong>{accountAudit.weakRows.length}</strong></div>
          <div><span>未匹配</span><strong>{accountAudit.noMatchRows.length}</strong></div>
          <div><span>待补账号</span><strong>{accountAudit.issueAccounts.length}</strong></div>
        </div>
        <div className="account-fit-warning-list">
          {[...accountAudit.noMatchRows, ...accountAudit.weakRows].slice(0, 5).map((row) => (
            <div className={`account-coverage-row ${row.tone}`} key={row.product.id}>
              <div>
                <strong>{row.product.sku}</strong>
                <span>{row.fit?.label || row.strength} · {row.reason}</span>
              </div>
              <div className="account-coverage-actions">
                <button className="secondary-button" type="button" onClick={() => createAccountDraftFromGap(row)}>
                  <Sparkles size={15} />
                  <span>生成草稿</span>
                </button>
                <button className="secondary-button" type="button" onClick={() => navigate(productLibraryTarget(row.product.id))}>
                  <ChevronRight size={15} />
                  <span>看商品</span>
                </button>
              </div>
            </div>
          ))}
          {!accountAudit.noMatchRows.length && !accountAudit.weakRows.length ? <p className="selection-muted">当前 SKU 都已有稳定账号承接。</p> : null}
        </div>
      </div>

      <div className="account-grid">
        {accounts.map((account) => {
          const docPack = selectDocPackForProduct(account);
          const platform = selectPlatformBindingForAccount(account);
          return (
            <div className="panel account-card" key={account.id}>
              <div className="account-card-head">
                <span className="module-icon"><KeyRound size={18} /></span>
                <div>
                  <h3>{account.name}</h3>
                  <p>{account.position}</p>
                </div>
              </div>
              <button className="secondary-button selection-row-button" type="button" onClick={() => setSelectedId(account.id)}>
                <span>编辑资产</span>
                <ChevronRight size={14} />
              </button>
              <dl className="account-meta">
                <div><dt>人设语气</dt><dd>{account.tone || "-"}</dd></div>
                <div><dt>场景</dt><dd>{(account.scenes || []).join(" / ") || "-"}</dd></div>
                <div><dt>主用 DOC</dt><dd>{docPack ? `${docPack.name} ${docPack.version}` : "-"}</dd></div>
                <div><dt>发布平台</dt><dd>{platform ? `${platform.platform} · ${platform.publishTarget}` : "-"}</dd></div>
                <div><dt>AI 标识</dt><dd>{platform?.aigcLabel || "-"}</dd></div>
                <div><dt>匹配 SKU</dt><dd>{matchCounts.get(account.id) || 0}</dd></div>
              </dl>
              <div className="account-tags-block">
                <strong>适合类目</strong>
                <TagList items={account.fit || []} tone="good" />
              </div>
              <div className="account-tags-block">
                <strong>禁做边界</strong>
                <TagList items={[...(account.avoid || []), ...((platform?.avoid || []).slice(0, 3))]} tone="bad" />
              </div>
              <div className="account-recommended">
                <strong>推荐 SKU</strong>
                <TagList items={account.recommended || []} tone="muted" />
              </div>
              <p className="selection-muted">{account.lastSignal}</p>
            </div>
          );
        })}
      </div>

      <div className="panel account-matrix-panel">
        <div className="panel-head">
          <div>
            <h2>SKU × 账号适配矩阵</h2>
            <p>第一版用规则包给出推荐账号，后续可接数据回收自动修正。</p>
          </div>
        </div>
        <div className="selection-table-wrap">
          <table className="selection-table account-matrix-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>类目</th>
                <th>推荐账号</th>
                <th>视频结构</th>
                <th>状态</th>
                <th>下一步</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(0, 12).map((product) => {
                const fit = accountFitSummaryForProduct(product, accounts);
                return (
                  <tr className={fit.tone} key={product.id}>
                    <td>
                      <strong>{product.sku}</strong>
                      <span>{product.node}</span>
                    </td>
                    <td>{product.category}</td>
                    <td>
                      <strong>{fit.account?.name || "未匹配账号"}</strong>
                      <span>{fit.strength} / 匹配分 {fit.score}</span>
                    </td>
                    <td>{product.primaryTemplate}</td>
                    <td>
                      <SelectionStatusBadge value={product.lifecycle} />
                      <span>{fit.label}</span>
                    </td>
                    <td>
                      <button className="secondary-button selection-row-button" type="button" onClick={() => {
                        if (fit.status === "blocked" || fit.status === "warn") {
                          createAccountDraftFromGap({ product, fit, strength: fit.strength, reason: fit.action, tone: fit.tone });
                          return;
                        }
                        navigate(product.lifecycle === "可测" || product.lifecycle === "小批量测试" ? "batch" : "productLibrary");
                      }}>
                        <span>{fit.status === "blocked" ? "补账号" : fit.status === "warn" ? "核账号" : product.lifecycle === "小批量测试" ? "看批次" : product.lifecycle === "可测" ? "生成" : "补资产"}</span>
                        <ChevronRight size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function buildMobileImageChecklist(studio = {}, template = null) {
  const count = studio.images?.length || 0;
  const isFashionTemplate = template?.id === fashionLuxuryIndoorTemplate.id;
  const items = isFashionTemplate
    ? [
        {
          id: "person",
          label: "人物参考图",
          detail: "参考气质、发型、身材比例",
          requiredCount: 1
        },
        {
          id: "product",
          label: "女装商品图",
          detail: "看清颜色、版型、领口、腰线和面料",
          requiredCount: 2
        },
        {
          id: "cover",
          label: "封面/画报图",
          detail: "可选，用来参考版式、色系和系列感",
          requiredCount: 3,
          optional: true
        }
      ]
    : [
        {
          id: "product",
          label: "商品主体图",
          detail: "至少一张清楚看到商品主体",
          requiredCount: 1
        },
        {
          id: "detail",
          label: "细节/场景图",
          detail: "可补充材质、使用场景或卖点",
          requiredCount: 2,
          optional: true
        },
        {
          id: "cover",
          label: "封面参考图",
          detail: "可选，用来参考画面风格",
          requiredCount: 3,
          optional: true
        }
      ];
  return items.map((item) => {
    const done = count >= item.requiredCount;
    const previousDone = item.requiredCount <= 1 || count >= item.requiredCount - 1;
    return {
      ...item,
      state: done ? "done" : previousDone ? "current" : "todo",
      statusLabel: done ? "已准备" : item.optional ? "可选" : "待上传"
    };
  });
}

function buildMobilePromptChecklist(studio = {}, template = null) {
  const textReady = Boolean(String(studio.promptPackText || "").trim());
  const fileReady = Boolean(studio.promptPackage);
  const templateReady = Boolean(template && studio.promptPackage?.templateId === template.id);
  return [
    {
      id: "file",
      label: "上传文件",
      detail: "支持 .docx / .txt / .md 提示词包",
      state: fileReady ? "done" : textReady ? "todo" : "current",
      statusLabel: fileReady ? "已准备" : "二选一"
    },
    {
      id: "text",
      label: "粘贴文本",
      detail: "也可以直接粘贴 SOP 或提示词正文",
      state: textReady ? "done" : fileReady ? "todo" : "current",
      statusLabel: textReady ? "已填写" : "二选一"
    },
    {
      id: "template",
      label: "内置模板",
      detail: template ? "已自动放入模板提示词" : "从创意页套用模板会自动填写",
      state: templateReady ? "done" : "todo",
      statusLabel: templateReady ? "已套用" : "可选"
    }
  ];
}

function mobileVideoModeLabel(mode) {
  if (mode === "submit") return "真实提交";
  if (mode === "run") return "提交并等待";
  return "先验证";
}

function buildMobileProductChecklist(studio = {}) {
  const productName = String(studio.productName || "").trim();
  const category = String(studio.productCategory || "").trim();
  const brief = String(studio.productBrief || "").trim();
  const duration = Number(studio.targetDuration || 15);
  const durationReady = Number.isFinite(duration) && duration >= 4 && duration <= 15;
  const modeReady = ["dry_run", "submit", "run"].includes(studio.videoMode || "dry_run");
  return [
    {
      id: "name",
      label: "商品名称",
      detail: "方便在任务和资产里查找",
      state: productName ? "done" : "todo",
      statusLabel: productName ? "已填写" : "可选"
    },
    {
      id: "category",
      label: "商品类别",
      detail: category ? "会作为画面方向参考" : "不填会根据图片识别",
      state: category ? "done" : "todo",
      statusLabel: category ? "已填写" : "可选"
    },
    {
      id: "brief",
      label: "卖点/人群",
      detail: "写清卖点、人群、禁忌项更稳",
      state: brief ? "done" : "current",
      statusLabel: brief ? "已补充" : "建议填"
    },
    {
      id: "params",
      label: "视频参数",
      detail: `${durationReady ? `${duration} 秒` : "检查时长"} · ${studio.aspectRatio || "9:16"} · ${mobileVideoModeLabel(studio.videoMode)}`,
      state: durationReady && modeReady ? "done" : "current",
      statusLabel: durationReady && modeReady ? "已设置" : "请检查"
    }
  ];
}

function buildMobileSubmitChecklist({ studio = {}, videoRunning = false, videoUrl = "" } = {}) {
  const imageCount = studio.images?.length || 0;
  const imageReady = imageCount > 0;
  const promptReady = Boolean(String(studio.finalPrompt || "").trim());
  const canSubmit = imageReady && promptReady && !videoRunning;
  return [
    {
      id: "prompt",
      label: "最终提示词",
      detail: promptReady ? "已经生成，可以手动检查" : "先生成或粘贴最终提示词",
      state: promptReady ? "done" : "current",
      statusLabel: promptReady ? "已准备" : "待准备"
    },
    {
      id: "images",
      label: "参考图片",
      detail: imageReady ? `已放入 ${imageCount} 张图片` : "生成视频需要至少一张商品参考图",
      state: imageReady ? "done" : "current",
      statusLabel: imageReady ? "已准备" : "待上传"
    },
    {
      id: "mode",
      label: "生成方式",
      detail: studio.videoMode === "dry_run" ? "适合先测试，不会真实生成" : "会提交到视频生成通道",
      state: "done",
      statusLabel: mobileVideoModeLabel(studio.videoMode)
    },
    {
      id: "submit",
      label: "提交状态",
      detail: videoUrl ? "视频已生成" : videoRunning ? "正在生成，不用重复点击" : canSubmit ? "可以点击保存并生成视频" : "补齐上面内容后再提交",
      state: videoUrl || canSubmit ? "done" : videoRunning ? "current" : "todo",
      statusLabel: videoUrl ? "已完成" : videoRunning ? "生成中" : canSubmit ? "可提交" : "未就绪"
    }
  ];
}

function buildMobileVideoRecovery({ videoLogSummary = null, videoUrl = "", videoSteps = [], videoRunning = false, studio = {} } = {}) {
  const failedStep = videoSteps.find((step) => step.status === "failed");
  const failed = Boolean(failedStep || videoLogSummary?.tone === "warn");
  const logText = `${failedStep?.name || ""}\n${failedStep?.message || ""}\n${videoLogSummary?.title || ""}\n${videoLogSummary?.detail || ""}`;
  const hasImages = Boolean(studio.images?.length);
  const hasPrompt = Boolean(String(studio.finalPrompt || "").trim());
  const canRetry = hasImages && hasPrompt && !videoRunning;

  if (videoUrl) {
    return {
      tone: "done",
      label: "结果已返回",
      title: "下一步可以做什么？",
      detail: "先预览视频，不满意就回到提示词或图片继续微调。",
      tips: ["打开视频检查画面和声音", "保留这套提示词，可以继续生成变体"],
      actions: [
        { id: "open-video", label: "打开视频", primary: true },
        { id: "prompt", label: "改提示词" },
        { id: "images", label: "换图片" }
      ]
    };
  }

  if (videoRunning) return null;

  if (failed) {
    const complianceIssue = /合规|审核|真人|人物|肖像|face|copyright|版权/i.test(logText);
    const imageIssue = /图片|素材|参考图|image|size|尺寸|像素|分辨率/i.test(logText);
    const promptIssue = /提示词|prompt|参数|时长|画幅|比例|非法|invalid/i.test(logText);
    const serviceIssue = /连接|网络|超时|timeout|排队|服务|503|429|busy|limit/i.test(logText);
    const title = complianceIssue
      ? "先处理素材或合规问题"
      : imageIssue
        ? "先检查图片是否合适"
        : promptIssue
          ? "先检查提示词和参数"
          : serviceIssue
            ? "可能是通道繁忙或连接问题"
            : "按失败提示调整后重试";
    const detail = failedStep?.message || videoLogSummary?.detail || "任务没有完成，先按下面三步处理，再重新生成。";
    const tips = complianceIssue
      ? ["换成可商用、授权清晰的参考图", "避免真人敏感、品牌侵权和平台禁用画面"]
      : imageIssue
        ? ["补一张清晰商品图或封面参考图", "避免模糊、遮挡、拼图和尺寸过小"]
        : promptIssue
          ? ["删掉互相冲突的要求", "确认视频时长、画幅和生成方式"]
          : serviceIssue
            ? ["稍等后直接重试一次", "如果连续失败，再检查生成通道状态"]
            : ["先补图片或改提示词", "再点击重试生成"];
    return {
      tone: serviceIssue ? "warn" : "bad",
      label: "失败后处理",
      title,
      detail,
      tips,
      actions: [
        { id: "images", label: imageIssue || complianceIssue ? "换/补图片" : "补图片" },
        { id: "prompt", label: promptIssue ? "改提示词" : "检查提示词" },
        { id: "retry", label: canRetry ? "重试生成" : "先补齐再重试", primary: true, disabled: !canRetry }
      ]
    };
  }

  if (videoLogSummary?.tone === "info") {
    return {
      tone: "info",
      label: "已有任务记录",
      title: "还没有拿到视频结果",
      detail: "如果长时间没有变化，可以稍后刷新，或检查提示词和图片后重新提交。",
      tips: ["先确认最终提示词没有空着", "确认至少上传了一张参考图"],
      actions: [
        { id: "prompt", label: "看提示词" },
        { id: "images", label: "看图片" },
        { id: "retry", label: canRetry ? "重新提交" : "先补齐资料", primary: true, disabled: !canRetry }
      ]
    };
  }

  return null;
}

function OverviewPage({ runtime, tasks, jobs, assets, navigate, onRefresh, guest = false, onLogin }) {
  const [beginnerMode, setBeginnerMode] = useState("video");
  const [overviewDetailsOpen, setOverviewDetailsOpen] = useState(false);
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
  const connected = Boolean(runtime && !runtime?.error);
  const libtvReady = !guest && isLibtvConnected(runtime);
  const canViewInternalRuntime = String(runtime?.currentUser?.username || "").toLowerCase() === "zkr";
  const modelChannels = [
    { name: "提示词分析", model: runtime?.currentModels?.analysis || "-", ready: Boolean(runtime?.doubaoConfigured || runtime?.qianwenTextConfigured) },
    { name: "图片识别", model: runtime?.currentModels?.vision || "-", ready: Boolean(runtime?.qianwenVisionConfigured) },
    { name: "视频生成", model: runtime?.currentModels?.video || "-", ready: Boolean(runtime?.seedanceConfigured || libtvReady) },
    { name: "视频拼接", model: runtime?.ffmpeg || "ffmpeg", ready: Boolean(runtime?.ffmpegConfigured) }
  ];
  const statusCards = [
    {
      label: "生成服务",
      value: guest ? "登录后使用" : connected ? "已连接" : "未连接",
      detail: guest ? "点击功能时会提示登录" : connected ? "运行正常" : "等待检测",
      good: connected,
      icon: Server
    },
    {
      label: "视频通道",
      value: libtvReady ? "已连接" : "未连接",
      detail: libtvReady ? "可以提交视频" : "等待连接",
      good: libtvReady,
      icon: Video
    },
    {
      label: "账号数据",
      value: guest ? "登录可见" : runtime?.libtvDatabase ? "已保存" : "待检查",
      detail: guest ? "保护账号数据" : runtime?.libtvDatabase ? "素材和任务已隔离保存" : "等待系统检查",
      good: !guest && Boolean(runtime?.libtvDatabase),
      icon: Database
    },
    {
      label: "模型配置",
      value: guest ? "登录可见" : runtime?.doubaoConfigured || runtime?.qianwenVisionConfigured ? "可用" : "待配置",
      detail: guest ? "登录后自动检测" : runtime?.currentModels?.analysis || runtime?.currentModels?.vision || "查看系统设置",
      good: !guest && Boolean(runtime?.doubaoConfigured || runtime?.qianwenVisionConfigured),
      icon: Brain
    }
  ];
  const mobileStatusCards = [
    {
      label: "生成服务",
      value: guest ? "登录后用" : connected ? "可用" : "异常",
      detail: guest ? "登录后可以提交生成任务" : connected ? "可以创建和保存任务" : "点顶部状态重试",
      good: !guest && connected,
      icon: Server
    },
    {
      label: "视频通道",
      value: guest ? "登录后查" : libtvReady ? "可生成" : "待检查",
      detail: guest ? "登录后检测视频生成通道" : libtvReady ? "可以提交视频生成" : "先确认生成服务是否打开",
      good: !guest && libtvReady,
      icon: Video
    },
    {
      label: "账号数据",
      value: guest ? "未登录" : runtime?.libtvDatabase ? "已保护" : "检查中",
      detail: guest ? "登录后只看自己的任务" : "任务和素材按账号隔离",
      good: !guest && Boolean(runtime?.libtvDatabase),
      icon: ShieldCheck
    },
    {
      label: "AI 能力",
      value: guest ? "登录后查" : runtime?.doubaoConfigured || runtime?.qianwenVisionConfigured ? "可用" : "待配置",
      detail: guest ? "登录后自动检查" : "用于识别图片和生成提示词",
      good: !guest && Boolean(runtime?.doubaoConfigured || runtime?.qianwenVisionConfigured),
      icon: Brain
    }
  ];
  const productionCards = [
    { label: "今日任务", value: todayTaskCount, detail: "按任务更新时间统计", icon: Timer, tone: "good" },
    { label: "视频成功率", value: formatPercent(jobStats.succeeded, jobStats.total), detail: `${jobStats.succeeded}/${jobStats.total || 0} 个任务成功`, icon: Gauge, tone: "good" },
    { label: "拼接成片", value: stitchedOutputs.length, detail: "可下载的拼接视频", icon: Scissors, tone: "info" },
    { label: "生成视频", value: libtvOutputs.length, detail: "已生成的视频文件", icon: Video, tone: "info" },
    { label: "异常任务", value: failedTaskCount + jobStats.failed, detail: "任务与视频生成失败合计", icon: ShieldCheck, tone: failedTaskCount + jobStats.failed ? "bad" : "good" },
    { label: "本地存储", value: formatBytes(storageSize), detail: `${outputCount} 个输出文件`, icon: HardDrive, tone: "info" }
  ];
  const modules = [
    {
      page: "studio",
      title: "提示词工作台",
      code: "PROMPT_STUDIO",
      desc: "上传提示词包文档和商品图，生成最终完整视频提示词。",
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
      desc: "勾选已生成视频，按组拼成完整素材。",
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
      title: "视频任务",
      code: "VIDEO_TASKS",
      desc: "追踪真实提交、轮询结果、视频链接和失败原因。",
      icon: Video
    },
    {
      page: "assets",
      title: "素材与输出",
      code: "ASSETS",
      desc: "按任务查看上传图片、生成文件、本地输出和下载入口。",
      icon: FolderOpen
    },
    {
      page: "settings",
      title: "我的与设置",
      code: "ACCOUNT_SETTINGS",
      desc: "查看账号数据、隐私合规入口和模型配置。",
      icon: Settings
    }
  ];
  const beginnerActionGroups = {
    image: [
      {
        title: "上传商品图",
        detail: "拍照或选图片",
        page: "studio:images",
        icon: Upload,
        tone: "cyan",
        badge: "推荐"
      },
      {
        title: "整理素材",
        detail: "看图片和文件",
        page: "assets",
        icon: Image,
        tone: "green"
      },
      {
        title: "提示词包",
        detail: "导入文档",
        page: "studio:prompt",
        icon: FileText,
        tone: "purple"
      },
      {
        title: "我的数据",
        detail: "帮助与隐私",
        page: "settings",
        icon: ShieldCheck,
        tone: "blue"
      }
    ],
    video: [
      {
        title: "一键做视频",
        detail: "商品图 + 提示词",
        page: "studio:images",
        icon: Sparkles,
        tone: "cyan",
        badge: "推荐"
      },
      {
        title: "批量生成",
        detail: "多商品一起跑",
        page: "batch",
        icon: ListChecks,
        tone: "green"
      },
      {
        title: "图生视频",
        detail: "图片变成短片",
        page: "studio:images",
        icon: Video,
        tone: "pink",
        badge: "MAX"
      },
      {
        title: "视频拼接",
        detail: "多段合成一条",
        page: "stitch",
        icon: Scissors,
        tone: "orange"
      },
      {
        title: "素材结果",
        detail: "看视频和图片",
        page: "assets",
        icon: FolderOpen,
        tone: "purple",
        badge: "HOT"
      },
      {
        title: "我的数据",
        detail: "帮助与隐私",
        page: "settings",
        icon: ShieldCheck,
        tone: "blue"
      }
    ]
  };
  const beginnerActions = beginnerActionGroups[beginnerMode] || beginnerActionGroups.video;
  const beginnerPrimaryActions = beginnerActions.slice(0, 2);
  const beginnerSecondaryActions = beginnerActions.slice(2);
  const beginnerGoal = beginnerMode === "video"
    ? {
        title: "今日目标：完成 1 条商品短视频",
        detail: "先传商品图，再放提示词包，最后点生成视频。"
      }
    : {
        title: "今日目标：准备一组可用素材",
        detail: "先上传图片和提示词，后面可以直接生成视频。"
      };
  const mobileNextStep = (() => {
    if (guest) {
      return {
        eyebrow: "下一步",
        title: "先看模板，再决定怎么做",
        detail: "不用登录也能先看创意模板，真正使用功能时再登录。",
        action: "看模板",
        page: "inspiration",
        icon: Sparkles,
        tone: "green"
      };
    }
    if (failedTaskCount + jobStats.failed > 0) {
      return {
        eyebrow: "需要处理",
        title: "有任务失败，先看原因",
        detail: "处理失败任务比继续新建更重要，避免重复浪费素材。",
        action: "看任务",
        page: "tasks",
        icon: AlertTriangle,
        tone: "bad"
      };
    }
    if (jobStats.pending > 0) {
      return {
        eyebrow: "正在生成",
        title: "已有任务在排队或生成中",
        detail: "先看进度，完成后再去素材页下载结果。",
        action: "看进度",
        page: "tasks",
        icon: Timer,
        tone: "cyan"
      };
    }
    if (latestOutputs.length > 0) {
      return {
        eyebrow: "已有结果",
        title: "有生成好的视频可以查看",
        detail: "去素材与输出页下载视频，或者继续做下一条。",
        action: "看结果",
        page: "assets",
        icon: Download,
        tone: "green"
      };
    }
    if (beginnerMode === "image") {
      return {
        eyebrow: "推荐开始",
        title: "先做一张商品主图",
        detail: "适合先准备封面、活动图或商品场景图。",
        action: "做图片",
        page: "textImage",
        icon: Image,
        tone: "purple"
      };
    }
    return {
      eyebrow: "推荐开始",
      title: "先做 1 条商品短视频",
      detail: "上传商品图和提示词包，系统会按步骤生成。",
      action: "做视频",
      page: "studio:images",
      icon: Video,
      tone: "cyan"
    };
  })();
  const MobileNextStepIcon = mobileNextStep.icon;
  const serviceCheck = (() => {
    if (guest) {
      return {
        state: "guest",
        eyebrow: "生成前检查",
        title: "登录后自动检查生成服务",
        detail: "账号登录后会显示任务、素材、视频通道和运行状态。",
        primaryLabel: "登录",
        primaryIcon: LockKeyhole,
        primaryAction: onLogin,
        secondaryLabel: "先看模板",
        secondaryAction: () => navigate("inspiration")
      };
    }
    if (connected && libtvReady) {
      return {
        state: "ready",
        eyebrow: "生成前检查",
        title: "生成服务和视频通道都可用",
        detail: "可以直接上传商品图和提示词包，提交后到任务中心看进度。",
        primaryLabel: "开始生成",
        primaryIcon: Play,
        primaryAction: () => navigate("studio:images"),
        secondaryLabel: "看任务",
        secondaryAction: () => navigate("tasks")
      };
    }
    if (connected && !libtvReady) {
      return {
        state: "warn",
        eyebrow: "生成前检查",
        title: "生成服务可用，视频通道待检查",
        detail: "可以先准备图片和提示词；提交视频前建议刷新一次状态。",
        primaryLabel: "刷新状态",
        primaryIcon: RefreshCw,
        primaryAction: onRefresh,
        secondaryLabel: "去我的",
        secondaryAction: () => navigate("settings")
      };
    }
    return {
      state: "bad",
      eyebrow: "生成前检查",
      title: "生成服务暂时未连接",
      detail: "先刷新状态；如果还不行，到我的页面查看准备中心。",
      primaryLabel: "刷新状态",
      primaryIcon: RefreshCw,
      primaryAction: onRefresh,
      secondaryLabel: "去我的",
      secondaryAction: () => navigate("settings")
    };
  })();
  const MobileServicePrimaryIcon = serviceCheck.primaryIcon || RefreshCw;
  const mobileWorkStats = [
    { label: "今日", value: guest ? "-" : todayTaskCount, icon: Timer },
    { label: "待处理", value: guest ? "-" : jobStats.pending, icon: Gauge },
    { label: "产出", value: guest ? "-" : outputCount, icon: FolderOpen },
    { label: "状态", value: guest ? "登录" : libtvReady ? "可用" : "检查", icon: Server }
  ];
  const mobileHotPlays = [
    { title: "商品主图成片", detail: "适合女装、穿搭、上新", page: "studio:images" },
    { title: "文生图主视觉", detail: "直接生成封面和场景图", page: "textImage" },
    { title: "批量跑多商品", detail: "一次准备多条视频", page: "batch" },
    { title: "多段素材拼接", detail: "把结果合成一条成片", page: "stitch" }
  ];

  return (
    <section className="overview-page">
      <section className="mobile-beginner-launcher" aria-label="新手快捷入口">
        <div className="mobile-app-hero">
          <div>
            <span>AI短视频</span>
            <strong>商品图变短视频</strong>
            <small>{guest ? "先看功能，使用时登录。" : "选入口，按步骤上传素材。"}</small>
          </div>
          <button type="button" onClick={guest ? onLogin : () => navigate("studio:images")}>
            {guest ? "登录" : "开始"}
          </button>
        </div>
        <div className="mobile-beginner-copy">
          <span>新手模式</span>
          <strong>你想先做什么？</strong>
        </div>
        <div className="mobile-mode-switch" role="tablist" aria-label="内容类型">
          <button
            type="button"
            className={beginnerMode === "image" ? "active" : ""}
            role="tab"
            aria-selected={beginnerMode === "image"}
            onClick={() => setBeginnerMode("image")}
          >
            图文
          </button>
          <button
            type="button"
            className={beginnerMode === "video" ? "active" : ""}
            role="tab"
            aria-selected={beginnerMode === "video"}
            onClick={() => setBeginnerMode("video")}
          >
            视频
          </button>
        </div>
        <div className="mobile-goal-strip">
          <span>推荐路线</span>
          <strong>{beginnerGoal.title}</strong>
          <small>{beginnerGoal.detail}</small>
        </div>
        <button
          type="button"
          className={`mobile-next-step-card tone-${mobileNextStep.tone}`}
          onClick={() => navigate(mobileNextStep.page)}
        >
          <span className="mobile-next-step-icon">
            <MobileNextStepIcon size={22} />
          </span>
          <span className="mobile-next-step-copy">
            <small>{mobileNextStep.eyebrow}</small>
            <strong>{mobileNextStep.title}</strong>
            <em>{mobileNextStep.detail}</em>
          </span>
          <b>{mobileNextStep.action}</b>
        </button>
        <div className={`mobile-service-check-card state-${serviceCheck.state}`} aria-label="生成前检查">
          <div className="mobile-service-check-copy">
            <span>{serviceCheck.eyebrow}</span>
            <strong>{serviceCheck.title}</strong>
            <small>{serviceCheck.detail}</small>
          </div>
          <div className="mobile-service-check-actions">
            <button type="button" onClick={serviceCheck.primaryAction}>
              <MobileServicePrimaryIcon size={14} />
              <span>{serviceCheck.primaryLabel}</span>
            </button>
            <button type="button" onClick={serviceCheck.secondaryAction}>
              <ChevronRight size={14} />
              <span>{serviceCheck.secondaryLabel}</span>
            </button>
          </div>
        </div>
        <div className="mobile-action-grid">
          {beginnerActions.map((item) => {
            if (!beginnerPrimaryActions.includes(item)) return null;
            const Icon = item.icon;
            return (
              <button
                type="button"
                className={`mobile-action-tile tone-${item.tone}`}
                onClick={() => navigate(item.page)}
                key={item.title}
              >
                <span className="mobile-action-icon"><Icon size={26} /></span>
                <strong>
                  {item.title}
                  {item.badge ? <em>{item.badge}</em> : null}
                </strong>
                <small>{item.detail}</small>
              </button>
            );
          })}
        </div>
        {beginnerSecondaryActions.length ? (
          <div className="mobile-secondary-actions" aria-label="更多快捷入口" data-horizontal-scroll="true">
            {beginnerSecondaryActions.map((item) => {
              const Icon = item.icon;
              return (
                <button type="button" className={`mobile-secondary-action tone-${item.tone}`} key={item.title} onClick={() => navigate(item.page)}>
                  <Icon size={16} />
                  <span>{item.title}</span>
                  {item.badge ? <em>{item.badge}</em> : null}
                </button>
              );
            })}
          </div>
        ) : null}
        {guest ? (
          <button type="button" className="mobile-guest-data-note" onClick={onLogin}>
            <ShieldCheck size={16} />
            <span>登录后查看任务、产出和运行状态</span>
          </button>
        ) : (
          <div className="mobile-home-workbar" aria-label="首页工作栏">
            {mobileWorkStats.map((item) => {
              const Icon = item.icon;
              return (
                <button type="button" className="mobile-home-workbar-item" key={item.label} onClick={() => item.label === "状态" ? onRefresh?.() : navigate(item.label === "产出" ? "assets" : "tasks")}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </button>
              );
            })}
          </div>
        )}
        <div className="mobile-hot-play-section" aria-label="热门玩法">
          <div className="mobile-hot-play-head">
            <strong>热门玩法</strong>
            <button type="button" onClick={guest ? onLogin : () => navigate("studio")}>更多</button>
          </div>
          <div className="mobile-hot-play-list" data-horizontal-scroll="true">
            {mobileHotPlays.map((item) => (
              <button type="button" className="mobile-hot-play-card" key={item.title} onClick={() => navigate(item.page)}>
                <span>{item.title}</span>
                <small>{item.detail}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={overviewDetailsOpen ? "mobile-overview-fold open" : "mobile-overview-fold"}>
        <button type="button" className="mobile-fold-toggle" onClick={() => setOverviewDetailsOpen((current) => !current)}>
          <span>
            <strong>生产详情</strong>
            <small>任务、状态、最近产出</small>
          </span>
          <ChevronRight size={18} />
        </button>
        {overviewDetailsOpen ? (
          <div className="mobile-fold-body">
            <div className="mobile-fold-section">
              <div className="mobile-fold-section-head">
                <BarChart3 size={16} />
                <strong>今日概况</strong>
              </div>
              <div className="mobile-mini-stat-grid">
                {productionCards.slice(0, 4).map((card) => {
                  const Icon = card.icon;
                  return (
                    <div className={`mobile-mini-stat ${card.tone}`} key={card.label}>
                      <Icon size={16} />
                      <span>{card.label}</span>
                      <strong>{card.value}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mobile-fold-section">
              <div className="mobile-fold-section-head">
                <ShieldCheck size={16} />
                <strong>运行状态</strong>
              </div>
              <div className="mobile-status-list">
                {mobileStatusCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div className={card.good ? "mobile-status-row ready" : "mobile-status-row"} key={card.label}>
                      <Icon size={16} />
                      <span>
                        <small>{card.label}</small>
                        <em>{card.detail}</em>
                      </span>
                      <strong>{card.value}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mobile-fold-section">
              <div className="mobile-fold-section-head">
                <Clipboard size={16} />
                <strong>最近任务</strong>
              </div>
              <div className="mobile-recent-list">
                {latestTasks.length ? latestTasks.slice(0, 3).map((row) => (
                  <button type="button" className="mobile-recent-row" key={row["任务编号"]} onClick={() => navigate("tasks")}>
                    <span>{taskDisplayName(row)}</span>
                    <StatusBadge value={row["任务状态"]} />
                  </button>
                )) : <div className="empty-inline">暂无任务记录</div>}
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <div className="overview-desktop-detail">
      <div className="overview-hero panel">
        <div>
          <h2>AI 视频生成工作流平台</h2>
          <p>围绕商品图、提示词包、模型分析、视频生成和视频拼接组织生产流程，首页直接看到产能、状态、输出和模型通道。</p>
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
                  <div className="module-card-head">
                    <strong>{item.title}</strong>
                    <span className="module-icon"><Icon size={22} /></span>
                  </div>
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
              <div><span>视频</span><strong>{jobStats.total}</strong></div>
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
              <li><Workflow size={15} />保存任务并生成视频</li>
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
                <th>任务</th>
                <th>视频名称</th>
                <th>类别</th>
                <th>状态</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {latestTasks.length ? latestTasks.map((row, index) => (
                <tr key={row["任务编号"]}>
                  <td>{taskDisplayLabel(row, index)}</td>
                  <td>{taskDisplayName(row)}</td>
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
  const [mobileEntryIntent] = useState(() => consumeMobileCreateIntent());
  const [mobileCreateView, setMobileCreateView] = useState(() => mobileCreateViewForIntent(mobileEntryIntent));
  const [mobileInputStep, setMobileInputStep] = useState(() => mobileInputStepForIntent(mobileEntryIntent));
  const [videoProgressNow, setVideoProgressNow] = useState(() => Date.now());
  const promptProgress = progressPercent(promptSteps);
  const promptTokenUsage = summarizeTokenUsage(promptSteps, modelTrace);
  const outputPanelTitle = mobileCreateView === "video" ? "视频生成" : "过程进度";
  const mobileInputIssues = buildMobileInputIssues(studio);
  const mobileComplianceHints = buildStudioComplianceHints(studio);
  const isFashionTemplateActive = Boolean(
    studio.promptPackage?.name === fashionLuxuryIndoorTemplate.packageName ||
    studio.promptPackText?.includes("女装轻奢室内空间 15 秒") ||
    studio.promptPackText?.includes("女装服装带货\n15 秒生活使用状态视频提示词规范包 V3.0")
  );
  const activeBuiltInTemplate = builtInPromptTemplates.find((template) => (
    studio.promptPackage?.templateId === template.id ||
    studio.promptPackage?.name === template.packageName
  ));
  const templateUploadHint = activeBuiltInTemplate?.id === fashionLuxuryIndoorTemplate.id
    ? "下一步：上传人物参考图、女装商品图；有封面图或详情头图也可以一起上传。"
    : "下一步：上传商品图、场景参考图，再按提示生成完整提示词。";
  const hasTemplateImages = Boolean(studio.images?.length);
  const hasTemplatePrompt = Boolean(studio.finalPrompt?.trim());
  const mobileImageChecklist = buildMobileImageChecklist(studio, activeBuiltInTemplate);
  const mobileImageGuideTitle = hasTemplateImages
    ? `已上传 ${studio.images.length} 张图片`
    : "先上传图片";
  const mobileImageGuideDetail = hasTemplateImages
    ? "图片已放入任务，可以继续补充参考图，或进入提示词包步骤。"
    : activeBuiltInTemplate?.id === fashionLuxuryIndoorTemplate.id
      ? "建议先准备人物参考图和女装商品图，封面/画报图可选。"
      : "建议先准备商品主体图，细节图和封面参考图可选。";
  const promptPackReady = Boolean(studio.promptPackage || studio.promptPackText?.trim());
  const mobilePromptChecklist = buildMobilePromptChecklist(studio, activeBuiltInTemplate);
  const mobilePromptGuideTitle = promptPackReady ? "提示词包已准备" : "准备提示词包";
  const mobilePromptGuideDetail = promptPackReady
    ? activeBuiltInTemplate
      ? "模板提示词已经放入，可以继续检查文本，或进入商品信息步骤。"
      : "已经有提示词内容，可以继续检查文本，或进入商品信息步骤。"
    : "上传文件或粘贴文本二选一；套用模板时会自动填好。";
  const productInfoReady = Boolean(studio.productName?.trim() || studio.productCategory?.trim() || studio.productBrief?.trim());
  const mobileProductChecklist = buildMobileProductChecklist(studio);
  const mobileProductGuideTitle = productInfoReady ? "商品信息已补充" : "补充商品信息";
  const mobileProductGuideDetail = productInfoReady
    ? "这些信息会帮助 AI 锁定商品卖点、受众和画面重点。"
    : "商品名和类别可选，卖点、人群、禁忌项建议填写，生成更稳定。";
  const videoUrl =
    findDeepValue(videoLog ? safeJsonFromLog(videoLog) : {}, ["video_url", "视频链接"]) ||
    (videoLog.match(/https?:\/\/\S+?\.mp4/)?.[0] || "");
  const mobileSubmitReady = Boolean(studio.finalPrompt?.trim() && studio.images?.length && !videoRunning);
  const mobileSubmitChecklist = buildMobileSubmitChecklist({ studio, videoRunning, videoUrl });
  const mobileSubmitTitle = videoUrl
    ? "视频已生成"
    : videoRunning
      ? "正在生成视频"
      : mobileSubmitReady
        ? "可以生成视频"
        : "提交前确认";
  const mobileSubmitDetail = videoUrl
    ? "可以打开视频预览，或到资产页下载。"
    : videoRunning
      ? "保持页面打开即可，完成后会自动出现视频入口。"
      : mobileSubmitReady
        ? "最终提示词和图片都已准备好，可以点击保存并生成视频。"
        : "确认最终提示词、参考图片和生成方式后，再提交视频。";
  const templateNextAction = videoUrl
    ? {
        state: "done",
        kicker: "已完成",
        title: "视频已经生成",
        detail: "可以打开视频预览，或到资产页下载成片。"
      }
    : videoRunning
      ? {
          state: "running",
          kicker: "生成中",
          title: "正在等待视频结果",
          detail: "保持页面打开即可，完成后会自动出现视频入口。"
        }
      : promptRunning
        ? {
            state: "running",
            kicker: "整理中",
            title: "正在生成最终提示词",
            detail: "系统正在把模板、图片和商品信息整理成完整提示词。"
          }
        : hasTemplatePrompt
          ? {
              state: "current",
              kicker: "当前要做",
              title: "提交视频生成",
              detail: "最终提示词已经准备好，下一步直接生成视频。"
            }
          : hasTemplateImages
            ? {
                state: "current",
                kicker: "当前要做",
                title: "生成最终提示词",
                detail: `已上传 ${studio.images.length} 张图片，下一步让 AI 整理成完整视频提示词。`
              }
            : {
                state: "current",
                kicker: "当前要做",
                title: "先上传图片",
                detail: activeBuiltInTemplate?.id === fashionLuxuryIndoorTemplate.id
                  ? "建议先上传人物参考图和女装商品图，封面/画报图可选。"
                  : "建议先上传商品图和场景参考图，后面会自动套用模板。"
              };
  const mobileTemplateNextSteps = [
    {
      id: "images",
      label: "上传图片",
      note: hasTemplateImages ? `${studio.images.length} 张` : "先做这步",
      state: hasTemplateImages ? "done" : "current"
    },
    {
      id: "prompt",
      label: "生成提示词",
      note: hasTemplatePrompt ? "已准备" : "自动填写",
      state: hasTemplatePrompt ? "done" : hasTemplateImages ? "current" : "todo"
    },
    {
      id: "video",
      label: "提交视频",
      note: videoUrl ? "已完成" : videoRunning ? "生成中" : "最后一步",
      state: videoUrl ? "done" : videoRunning || hasTemplatePrompt ? "current" : "todo"
    }
  ];
  const videoEstimate = buildVideoGenerationEstimate({
    steps: videoSteps,
    running: videoRunning,
    targetDuration: Number(studio.targetDuration || 15),
    mode: studio.videoMode,
    hasVideo: Boolean(videoUrl),
    now: videoProgressNow
  });
  const videoProgress = videoEstimate.percent;
  const mobileSubmitWaitDetail = videoEstimate.completed
    ? "结果已经返回，可以打开视频或到资产页下载。"
    : videoEstimate.failed
      ? "生成没有完成，先看失败提示，再调整图片或提示词。"
      : videoEstimate.overdue
        ? "等待时间比预估更久，任务仍在排队，请稍后刷新任务。"
        : videoEstimate.running
          ? `预计还需 ${videoEstimate.remainingLabel}，当前阶段：${videoEstimate.currentPhaseLabel || "生成视频"}。可以切到任务页或稍后回来。`
          : "";
  const videoLogSummary = buildVideoLogSummary({ videoLog, videoUrl, videoSteps, videoRunning });
  const mobileVideoRecovery = buildMobileVideoRecovery({ videoLogSummary, videoUrl, videoSteps, videoRunning, studio });

  useEffect(() => {
    if (!mobileEntryIntent) return;
    window.requestAnimationFrame(() => {
      const target = ["output", "video"].includes(mobileEntryIntent)
        ? "#studio-output-panel"
        : "#studio-input-panel";
      document.querySelector(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [mobileEntryIntent]);

  useEffect(() => {
    if (!videoRunning) {
      setVideoProgressNow(Date.now());
      return undefined;
    }
    setVideoProgressNow(Date.now());
    const timer = window.setInterval(() => setVideoProgressNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [videoRunning, videoSteps.length]);

  function openMobileCreateView(view) {
    setMobileCreateView(view);
    window.requestAnimationFrame(() => {
      const target = view === "input" ? "#studio-input-panel" : "#studio-output-panel";
      document.querySelector(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function submitVideoFromMobile() {
    openMobileCreateView("video");
    submitVideo();
  }

  function handleMobileVideoRecoveryAction(actionId) {
    if (actionId === "open-video" && videoUrl) {
      window.open(videoUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (actionId === "images") {
      openMobileCreateView("input");
      openMobileInputStep("images");
      return;
    }
    if (actionId === "prompt") {
      openMobileCreateView("prompt");
      return;
    }
    if (actionId === "retry") {
      submitVideoFromMobile();
    }
  }

  async function downloadStudioAiEvidencePack() {
    const {
      buildAiDisclosureEvidencePack,
      downloadJsonFile,
      safeDownloadName
    } = await import("./shared/compliance/aiEvidencePack.js");
    const pack = buildAiDisclosureEvidencePack({
      studio,
      runId,
      promptSteps,
      videoSteps,
      modelTrace,
      runtime,
      modelSettings,
      videoUrl
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const namePart = safeDownloadName(studio.productName || studio.productCategory || runId || "AI视频任务");
    downloadJsonFile(pack, `${namePart}-AI生成内容证据包-${stamp}.json`);
  }

  function openMobileInputStep(step) {
    setMobileInputStep(step);
    window.requestAnimationFrame(() => {
      document.querySelector("#studio-input-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <>
      <MobileCreateGuide
        steps={buildMobileCreateSteps({ studio, promptSteps, promptRunning, videoSteps, videoRunning, videoUrl })}
        videoEstimate={videoEstimate}
        canSubmitVideo={Boolean(studio.finalPrompt) && !videoRunning}
        promptRunning={promptRunning}
        videoRunning={videoRunning}
        onOpenInput={() => openMobileCreateView("input")}
        onOpenOutput={() => openMobileCreateView("prompt")}
        onSubmitVideo={submitVideoFromMobile}
      />
      <MobileCreateTabs value={mobileCreateView} onChange={openMobileCreateView} />
      <section className={`studio-grid mobile-create-view-${mobileCreateView}`}>
      <form id="studio-input-panel" className={`panel input-panel mobile-input-step-${mobileInputStep}`} onSubmit={startPromptRun}>
        <div className="panel-head">
          <h2>输入</h2>
          <button type="button" className="ghost-button" onClick={clearStudio}>清空</button>
        </div>

        <MobileInputTabs value={mobileInputStep} onChange={openMobileInputStep} studio={studio} />

        {activeBuiltInTemplate ? (
          <div className="mobile-template-applied" role="status" aria-live="polite">
            <span>
              <CheckCircle2 size={15} />
              模板已套用
            </span>
            <strong>{activeBuiltInTemplate.productName || activeBuiltInTemplate.packageName}</strong>
            <p>{templateUploadHint}</p>
            <div className={`mobile-template-next-action state-${templateNextAction.state}`}>
              <span>{templateNextAction.kicker}</span>
              <strong>{templateNextAction.title}</strong>
              <small>{templateNextAction.detail}</small>
            </div>
            <div className="mobile-template-next-steps" aria-label="模板下一步">
              {mobileTemplateNextSteps.map((step, index) => (
                <span className={step.state} key={step.id}>
                  <em>{index + 1}</em>
                  <strong>{step.label}</strong>
                  <small>{step.note}</small>
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mobile-input-section mobile-input-section-prompt">
        <label className="field file-field">
          <span>提示词包</span>
          <input className="file-input-native" type="file" onChange={(event) => handlePromptFile(event.target.files?.[0])} />
          <span className="file-picker-shell">
            <span className="file-picker-button">
              <Upload size={16} />
              <span>上传文件</span>
            </span>
            <span className="file-picker-status">{studio.promptPackage?.name || (studio.promptPackText ? "已读取提示词文本" : "未选择文件")}</span>
          </span>
        </label>
        <div className="mobile-image-checklist mobile-prompt-checklist" aria-label="提示词包准备清单">
          <div className="mobile-image-checklist-head">
            <span>提示词准备</span>
            <strong>{mobilePromptGuideTitle}</strong>
            <p>{mobilePromptGuideDetail}</p>
          </div>
          <div className="mobile-image-checklist-grid">
            {mobilePromptChecklist.map((item) => (
              <span className={item.state} key={item.id}>
                <em>{item.statusLabel}</em>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            ))}
          </div>
        </div>
        <label className="field">
          <span>提示词包正文</span>
          <textarea rows={10} value={studio.promptPackText} onChange={(event) => updateStudio("promptPackText", event.target.value)} placeholder="粘贴 SOP / 提示词包文本" />
        </label>
        <MobileInputStepActions
          issues={mobileInputIssues.prompt.blockers}
          onBack={() => openMobileInputStep("images")}
          onNext={() => openMobileInputStep("info")}
          nextLabel="下一步：商品信息"
        />
        </div>

        <div className="mobile-input-section mobile-input-section-images">
        <label className="field file-field">
          <span>素材图片</span>
          <input className="file-input-native" type="file" accept="image/*" multiple onChange={(event) => handleImages(event.target.files)} />
          <span className="file-picker-shell">
            <span className="file-picker-button">
              <Upload size={16} />
              <span>上传图片</span>
            </span>
            <span className="file-picker-status">{studio.images.length ? `已选择 ${studio.images.length} 张图片` : "未选择图片"}</span>
          </span>
        </label>
        <div className="mobile-image-checklist" aria-label="图片准备清单">
          <div className="mobile-image-checklist-head">
            <span>图片准备</span>
            <strong>{mobileImageGuideTitle}</strong>
            <p>{mobileImageGuideDetail}</p>
          </div>
          <div className="mobile-image-checklist-grid">
            {mobileImageChecklist.map((item) => (
              <span className={item.state} key={item.id}>
                <em>{item.statusLabel}</em>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            ))}
          </div>
        </div>
        {isFashionTemplateActive ? (
          <div className="mobile-template-upload mobile-upload-guide">
            <strong>女装模板建议上传</strong>
            <ul>
              <li>人物参考图：成年女性正面或半身/全身图，用来参考气质、发型和身材比例。</li>
              <li>女装商品图：清楚看到颜色、版型、领口、腰线、裙摆、面料和纽扣等细节。</li>
              <li>封面图/详情页头图：可以一起上传，用来参考画报版式、色系、系列感和卖点表达。</li>
            </ul>
          </div>
        ) : null}
        <div className="image-grid">
          {studio.images.map((image) => (
            <div className="image-thumb" key={`${image.name}-${image.size}`}>
              <img src={image.dataUrl} alt="" />
              <span title={image.name}>{image.name}</span>
            </div>
          ))}
        </div>
        <MobileInputStepActions
          issues={mobileInputIssues.images.blockers}
          onNext={() => openMobileInputStep("prompt")}
          nextLabel="下一步：提示词包"
        />
        </div>

        <div className="mobile-input-section mobile-input-section-info">
        <div className="mobile-image-checklist mobile-product-checklist" aria-label="商品信息准备清单">
          <div className="mobile-image-checklist-head">
            <span>商品信息</span>
            <strong>{mobileProductGuideTitle}</strong>
            <p>{mobileProductGuideDetail}</p>
          </div>
          <div className="mobile-image-checklist-grid">
            {mobileProductChecklist.map((item) => (
              <span className={item.state} key={item.id}>
                <em>{item.statusLabel}</em>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </span>
            ))}
          </div>
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
            <input type="number" min="4" max="15" value={studio.targetDuration} onChange={(event) => updateStudio("targetDuration", event.target.value)} />
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
            <span>视频生成方式</span>
            <select value={studio.videoMode} onChange={(event) => updateStudio("videoMode", event.target.value)}>
              <option value="dry_run">先验证</option>
              <option value="submit">真实提交</option>
              <option value="run">提交并等待结果</option>
            </select>
          </label>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={studio.autoSubmit} onChange={(event) => updateStudio("autoSubmit", event.target.checked)} />
          <span>最终提示词生成后自动提交视频</span>
        </label>
        <MobileComplianceHints hints={mobileComplianceHints} />
        <MobileInputStepActions
          issues={mobileInputIssues.ready.blockers}
          suggestions={mobileInputIssues.ready.suggestions}
          onBack={() => openMobileInputStep("prompt")}
          nextLabel={mobileInputIssues.ready.blockers.length ? "补齐阻断项" : "可以生成"}
          isFinal
        />
        <button
          className={promptRunning ? "danger-button" : "primary-button"}
          type={promptRunning ? "button" : "submit"}
          onClick={promptRunning ? cancelPromptRun : undefined}
        >
          {promptRunning ? <X size={17} /> : <Play size={17} />}
          <span>{promptRunning ? "中断生成" : "生成最终完整提示词"}</span>
        </button>
        </div>
      </form>

      <section id="studio-output-panel" className="panel output-panel">
        <div className="panel-head">
          <h2>{outputPanelTitle}</h2>
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => setTraceOpen(true)}>
              <Brain size={16} />
              <span>模型过程</span>
            </button>
            <span className="run-id">{runId ? runId.slice(0, 8) : ""}</span>
          </div>
        </div>
        <div className="mobile-prompt-section">
          <ProgressBar value={promptProgress} />
          <TokenUsageSummary usage={promptTokenUsage} />
          <StepList steps={promptSteps} emptyText="等待开始任务" />
        </div>

        <div className="result-block mobile-prompt-section">
          <div className="panel-head">
            <h2>最终完整提示词</h2>
            <div className="button-row final-prompt-actions">
              <button type="button" className="secondary-button" onClick={copyFinalPrompt} disabled={!studio.finalPrompt}>
                <Copy size={16} />
                <span>复制</span>
              </button>
              <button type="button" className="secondary-button" onClick={downloadStudioAiEvidencePack} disabled={!studio.finalPrompt && !promptSteps.length}>
                <Download size={16} />
                <span>AI 证据包</span>
              </button>
              <button
                type="button"
                className={`secondary-button video-submit-button ${videoRunning ? "waiting" : ""}`}
                onClick={submitVideo}
                disabled={!studio.finalPrompt || videoRunning}
                aria-busy={videoRunning}
                title={videoRunning ? "视频正在生成，不用重复点击。" : "保存任务并生成视频"}
              >
                <Video size={16} />
                <span>{videoRunning ? "等待结果" : "保存并生成视频"}</span>
              </button>
            </div>
          </div>
          <textarea className="final-prompt" rows={9} value={studio.finalPrompt} onChange={(event) => updateStudio("finalPrompt", event.target.value)} placeholder="可以手动粘贴最终提示词，也可以等待分析流程自动填入" />
          <div className="mobile-submit-check-card" aria-label="提交视频前确认">
            <div className="mobile-image-checklist-head">
              <span>提交确认</span>
              <strong>{mobileSubmitTitle}</strong>
              <p>{mobileSubmitDetail}</p>
            </div>
            <div className="mobile-submit-check-grid mobile-image-checklist-grid">
              {mobileSubmitChecklist.map((item) => (
                <span className={item.state} key={item.id}>
                  <em>{item.statusLabel}</em>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              ))}
            </div>
            {videoEstimate.visible ? (
              <div className={`mobile-submit-wait-summary ${videoEstimate.running ? "running" : ""} ${videoEstimate.completed ? "done" : ""} ${videoEstimate.failed ? "bad" : ""}`} aria-label="提交后等待提示">
                <div className="mobile-submit-wait-head">
                  <span>{videoEstimate.statusLabel}</span>
                  <strong>{videoEstimate.resultLabel}</strong>
                </div>
                <div className="mobile-submit-wait-track" aria-hidden="true">
                  <i style={{ width: `${videoEstimate.percent}%` }} />
                </div>
                <p>{mobileSubmitWaitDetail}</p>
                <a className="secondary-button" href="#/libtv">
                  <Timer size={16} />
                  <span>查看任务</span>
                </a>
              </div>
            ) : null}
          </div>
          {studio.promptPackage ? (
            <>
              <div className="prompt-package-summary" aria-label="提示词包状态">
                <span>提示词包已准备</span>
                <strong>{studio.promptPackage.name || "内置提示词包"}</strong>
                <small>{studio.promptPackage.source || studio.promptPackage.type || "可直接用于生成视频"}</small>
              </div>
              <pre className="json-box prompt-package-debug">{JSON.stringify(studio.promptPackage, null, 2)}</pre>
            </>
          ) : null}
        </div>

        <div className="result-block mobile-video-section">
          <div className="panel-head">
            <h2>视频生成进度</h2>
            <span className="run-id">{videoRunning ? `${videoProgress}%` : ""}</span>
          </div>
          <VideoWaitStatus estimate={videoEstimate} />
          {!videoEstimate.visible ? (
            <ProgressBar value={videoProgress} label={videoSteps.length || videoRunning ? `${videoProgress}%` : ""} />
          ) : null}
          <StepList steps={videoSteps} emptyText="等待提交视频" />
          {videoUrl ? <a className="video-link" href={videoUrl} target="_blank" rel="noreferrer">打开生成视频</a> : null}
          <MobileVideoRecoveryCard recovery={mobileVideoRecovery} onAction={handleMobileVideoRecoveryAction} />
          {videoLogSummary ? (
            <>
              <div className={`video-log-summary ${videoLogSummary.tone}`} aria-label="视频生成状态">
                <span>{videoLogSummary.label}</span>
                <strong>{videoLogSummary.title}</strong>
                <small>{videoLogSummary.detail}</small>
              </div>
              <pre className="log-box video-log-debug">{videoLog}</pre>
            </>
          ) : null}
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
    </>
  );
}

function MobileInputTabs({ value, onChange, studio }) {
  const promptReady = Boolean(studio.promptPackage || studio.promptPackText?.trim());
  const items = [
    { id: "images", label: "素材图", icon: Image, meta: studio.images.length ? `${studio.images.length} 张` : "未上传" },
    { id: "prompt", label: "提示词包", icon: FileText, meta: promptReady ? "已准备" : "未填写" },
    { id: "info", label: "商品信息", icon: Info, meta: studio.productName || studio.productCategory ? "已补充" : "待补充" }
  ];
  return (
    <div className="mobile-input-tabs" role="tablist" aria-label="手机端资料输入分段">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            type="button"
            role="tab"
            aria-selected={value === item.id}
            className={value === item.id ? "active" : ""}
            key={item.id}
            onClick={() => onChange(item.id)}
          >
            <Icon size={16} />
            <span>{item.label}</span>
            <em>{item.meta}</em>
          </button>
        );
      })}
    </div>
  );
}

function MobileInputStepActions({ issues = [], suggestions = [], onBack, onNext, nextLabel = "下一步", isFinal = false }) {
  const hasIssues = issues.length > 0;
  const hasSuggestions = suggestions.length > 0;
  return (
    <div className="mobile-input-step-actions">
      {hasIssues ? (
        <div className="mobile-input-step-issues blocker" role="status">
          <strong>必须补齐</strong>
          {issues.map((issue) => <span key={issue}>{issue}</span>)}
        </div>
      ) : null}
      {hasSuggestions ? (
        <div className="mobile-input-step-issues suggestion" role="status">
          <strong>建议补充</strong>
          {suggestions.map((suggestion) => <span key={suggestion}>{suggestion}</span>)}
        </div>
      ) : null}
      {!hasIssues && !hasSuggestions ? (
        <div className="mobile-input-step-ready" role="status">
          {isFinal ? "基础资料已准备，可以生成最终提示词。" : "这一段已经准备好。"}
        </div>
      ) : null}
      <div className="mobile-input-step-buttons">
        {onBack ? (
          <button type="button" className="secondary-button" onClick={onBack}>
            <ChevronRight className="flip-icon" size={16} />
            <span>上一步</span>
          </button>
        ) : null}
        {onNext ? (
          <button type="button" className="primary-button" onClick={onNext}>
            <span>{nextLabel}</span>
            <ChevronRight size={16} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MobileComplianceHints({ hints = [] }) {
  return (
    <div className="mobile-compliance-hints" aria-label="生成前合规风险提示">
      <div className="mobile-compliance-head">
        <ShieldCheck size={16} />
        <strong>生成前风险</strong>
      </div>
      <div className="mobile-compliance-list">
        {hints.map((hint) => (
          <div className={`mobile-compliance-item ${hint.level}`} key={hint.id}>
            <span>{hint.label}</span>
            <strong>{hint.title}</strong>
            <p>{hint.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileVideoRecoveryCard({ recovery, onAction }) {
  if (!recovery) return null;
  return (
    <div className={`mobile-video-recovery-card ${recovery.tone}`} aria-label="视频生成补救建议">
      <div className="mobile-video-recovery-head">
        <span>{recovery.label}</span>
        <strong>{recovery.title}</strong>
        <p>{recovery.detail}</p>
      </div>
      {recovery.tips?.length ? (
        <div className="mobile-video-recovery-tips">
          {recovery.tips.map((tip) => (
            <span key={tip}>{tip}</span>
          ))}
        </div>
      ) : null}
      <div className="mobile-video-recovery-actions">
        {recovery.actions.map((action) => (
          <button
            type="button"
            className={action.primary ? "primary-button" : "secondary-button"}
            disabled={action.disabled}
            key={action.id}
            onClick={() => onAction?.(action.id)}
          >
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function buildMobileInputIssues(studio) {
  const promptReady = Boolean(studio.promptPackage || studio.promptPackText?.trim());
  const imageBlockers = studio.images?.length ? [] : ["请先上传至少一张清晰素材图。"];
  const promptBlockers = promptReady ? [] : ["请上传提示词包，或粘贴 SOP / 提示词包正文。"];
  const infoSuggestions = [];
  if (!String(studio.productName || "").trim()) infoSuggestions.push("商品名可选，但建议填写，方便后续查找。");
  if (!String(studio.productBrief || "").trim()) infoSuggestions.push("补充卖点、人群或禁忌项，可以减少生成偏差。");
  return {
    images: { blockers: imageBlockers, suggestions: [] },
    prompt: { blockers: promptBlockers, suggestions: [] },
    info: { blockers: [], suggestions: infoSuggestions },
    ready: { blockers: [...imageBlockers, ...promptBlockers], suggestions: infoSuggestions }
  };
}

function buildStudioComplianceHints(studio) {
  const text = [
    studio.productName,
    studio.productCategory,
    studio.productBrief,
    studio.promptPackText,
    studio.finalPrompt
  ].filter(Boolean).join(" ");
  const hints = [
    {
      id: "aigc-label",
      level: "info",
      label: "提示",
      title: "AI 标识",
      message: "发布 AI 生成视频时，需要保留或补充平台要求的 AI 生成内容标识。"
    }
  ];
  const rules = [
    {
      id: "absolute-claim",
      level: "high",
      label: "高风险",
      pattern: /绝对|100%|百分百|永久|根治|无副作用|全网最低|第一|必买|神器|永不|零风险/i,
      title: "绝对化或保证性用语",
      message: "避免使用绝对、永久、第一、全网最低、无副作用等不可证实承诺。"
    },
    {
      id: "health-function",
      level: "warn",
      label: "待确认",
      pattern: /医疗|保健|药|治疗|治愈|减肥|祛斑|降压|修复|抗炎|杀菌|消毒|抗菌|除螨|防晒|防辐射/i,
      title: "功效/健康/防护卖点",
      message: "涉及健康、防护、杀菌、减肥、美白等功效时，需要资质、检测或商品卡证据支撑。"
    },
    {
      id: "license-proof",
      level: "warn",
      label: "待确认",
      pattern: /授权|官方|正品|联名|同款|专利|认证|质检|检测|非遗|IP|迪士尼|耐克|阿迪|苹果/i,
      title: "授权/资质/品牌背书",
      message: "品牌、授权、认证、非遗、专利或检测表达需要先确认可展示的证据。"
    },
    {
      id: "price-promise",
      level: "warn",
      label: "待确认",
      pattern: /最低价|保价|买贵赔|限时最低|全网低价|亏本|官方补贴/i,
      title: "价格承诺",
      message: "价格、补贴和保价承诺要与商品卡、活动规则和平台政策一致。"
    }
  ];
  rules.forEach((rule) => {
    if (rule.pattern.test(text)) hints.push(rule);
  });
  if (hints.length === 1) {
    hints.push({
      id: "no-extra-risk",
      level: "good",
      label: "可继续",
      title: "未发现明显高风险词",
      message: "仍建议人工复核商品卡、授权资质和最终视频表达。"
    });
  }
  return hints;
}

function MobileCreateTabs({ value, onChange }) {
  const items = [
    { id: "input", label: "资料", icon: Upload },
    { id: "prompt", label: "提示词", icon: FileText },
    { id: "video", label: "视频", icon: Video }
  ];
  return (
    <div className="mobile-create-tabs" role="tablist" aria-label="手机端创建步骤切换">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            type="button"
            role="tab"
            aria-selected={value === item.id}
            className={value === item.id ? "active" : ""}
            key={item.id}
            onClick={() => onChange(item.id)}
          >
            <Icon size={16} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function buildMobileCreateSteps({ studio, promptSteps, promptRunning, videoSteps, videoRunning, videoUrl }) {
  const hasPromptPack = Boolean(studio.promptPackText?.trim() || studio.promptPackage);
  const hasProductImages = studio.images.length > 0;
  const promptFailed = promptSteps.some((step) => step.status === "failed");
  const videoFailed = videoSteps.some((step) => step.status === "failed");
  return [
    {
      label: "商品资料",
      detail: hasProductImages ? `已选择 ${studio.images.length} 张素材图` : "上传商品/人物/封面参考图，补充商品名和卖点",
      status: hasProductImages ? "done" : "current"
    },
    {
      label: "提示词包",
      detail: hasPromptPack ? "提示词包已准备" : "上传 .docx/.txt/.md 或粘贴 SOP 文本",
      status: hasPromptPack ? "done" : hasProductImages ? "current" : "pending"
    },
    {
      label: "AI 分析",
      detail: promptRunning ? "正在识别商品和拆解提示词" : promptSteps.length ? "分析流程已有记录" : "生成前会自动完成识别和预检",
      status: promptRunning ? "running" : promptFailed ? "failed" : promptSteps.length ? "done" : hasPromptPack && hasProductImages ? "current" : "pending"
    },
    {
      label: "提示词",
      detail: studio.finalPrompt ? "最终提示词可编辑和复制" : "等待生成最终完整提示词",
      status: studio.finalPrompt ? "done" : promptFailed ? "failed" : promptRunning ? "running" : "pending"
    },
    {
      label: "视频",
      detail: videoUrl ? "视频结果已返回" : videoRunning ? "正在提交或等待视频结果" : "提示词确认后提交生成视频",
      status: videoUrl ? "done" : videoFailed ? "failed" : videoRunning ? "running" : studio.finalPrompt ? "current" : "pending"
    }
  ];
}

function MobileCreateGuide({ steps, videoEstimate, canSubmitVideo, promptRunning, videoRunning, onOpenInput, onOpenOutput, onSubmitVideo }) {
  const completedCount = steps.filter((step) => step.status === "done").length;
  const activeStep = steps.find((step) => ["current", "running", "failed"].includes(step.status)) || steps[0];
  const nextHint = activeStep?.detail || "按提示补齐资料后继续。";
  const submitLabel = videoRunning ? (videoEstimate?.overdue ? "排队中" : "等待结果") : "生成视频";
  const submitTitle = videoRunning ? "视频已经提交，不用重复点击。" : "提交当前提示词和图片生成视频";
  return (
    <section className="mobile-create-guide" aria-label="手机端创建视频向导">
      <div className="mobile-create-guide-head">
        <div>
          <span>创建视频</span>
          <strong>{activeStep?.label || "准备资料"}</strong>
        </div>
        <em>{completedCount}/{steps.length}</em>
      </div>
      <div className="mobile-create-next-hint">
        <span>下一步</span>
        <strong>{nextHint}</strong>
      </div>
      {videoEstimate?.visible ? <VideoWaitStatus estimate={videoEstimate} compact /> : null}
      <div className="mobile-create-step-list">
        {steps.map((step, index) => {
          const Icon = step.status === "done"
            ? CheckCircle2
            : step.status === "failed"
              ? AlertTriangle
              : step.status === "running"
                ? RefreshCw
                : Timer;
          return (
            <article className={`mobile-create-step ${step.status}`} key={step.label}>
              <span className="mobile-create-step-icon"><Icon size={15} /></span>
              <div>
                <strong>{index + 1}. {step.label}</strong>
                <p>{step.detail}</p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mobile-create-guide-actions">
        <button type="button" className="secondary-button" onClick={onOpenInput}>
          <Upload size={16} />
          <span>补资料</span>
        </button>
        <button type="button" className="secondary-button" onClick={onOpenOutput}>
          <FileText size={16} />
          <span>看提示词</span>
        </button>
        <button
          type="button"
          className={`primary-button ${videoRunning ? "is-waiting" : ""}`}
          onClick={onSubmitVideo}
          disabled={!canSubmitVideo || videoRunning || promptRunning}
          aria-busy={videoRunning}
          title={submitTitle}
        >
          <Video size={16} />
          <span>{submitLabel}</span>
        </button>
      </div>
      {videoRunning ? (
        <p className="mobile-create-wait-tip">已提交生成，不用重复点击；可以切到任务页查看状态。</p>
      ) : null}
    </section>
  );
}

function ModelTraceDrawer({ open, onClose, runId, steps, trace, studio, runtime, modelSettings }) {
  if (!open) return null;
  const analysisModel = resolveModelChoice(modelSettings, "analysis") || runtime?.currentModels?.analysis || "系统默认";
  const visionModel = resolveModelChoice(modelSettings, "vision") || runtime?.currentModels?.vision || "系统默认";
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
    `素材图片：${studio.images?.length || 0} 张${studio.images?.length ? `（${studio.images.map((image) => image.name).join("，")}）` : ""}`,
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

function taskDisplayName(row = {}) {
  return row["最终视频名称"] || row["商品名称"] || "未命名任务";
}

function taskDisplayLabel(_row = {}, index = 0) {
  return `任务 ${index + 1}`;
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

function VideoWaitStatus({ estimate, compact = false }) {
  if (!estimate?.visible) return null;
  const cardClassName = [
    "video-wait-card",
    compact ? "compact" : "",
    estimate.running ? "running" : "",
    estimate.completed ? "completed" : "",
    estimate.failed ? "failed" : "",
    estimate.overdue ? "overdue" : ""
  ].filter(Boolean).join(" ");
  const remainingTitle = estimate.overdue ? "当前状态" : "预计剩余";
  const remainingValue = estimate.running ? estimate.remainingLabel : estimate.resultLabel;
  return (
    <div className={cardClassName} role="status" aria-live="polite">
      <div className="video-wait-head">
        <div>
          <span>{estimate.statusLabel}</span>
          <strong>{estimate.percent}%</strong>
        </div>
        <em>{estimate.headlineLabel}</em>
      </div>
      <div className="video-wait-meter" aria-hidden="true">
        <span style={{ width: `${estimate.percent}%` }} />
      </div>
      <div className="video-wait-current-note">{estimate.currentNote}</div>
      {estimate.phases?.length ? (
        <div className="video-wait-phases" aria-label="视频生成阶段">
          {estimate.phases.map((phase) => (
            <span className={`video-wait-phase ${phase.status}`} key={phase.key}>
              <em>{phase.index}</em>
              <strong>{phase.label}</strong>
            </span>
          ))}
        </div>
      ) : null}
      <div className="video-wait-stats">
        <span>
          <small>{remainingTitle}</small>
          <strong>{remainingValue}</strong>
        </span>
        <span>
          <small>已等待</small>
          <strong>{estimate.elapsedLabel}</strong>
        </span>
        <span>
          <small>视频时长</small>
          <strong>{estimate.durationLabel}</strong>
        </span>
      </div>
      <div className="video-wait-meta">{estimate.estimateLabel}</div>
      <p>{estimate.helpText}</p>
    </div>
  );
}

function ProgressBar({ value, label = "" }) {
  const percent = clampPercent(value);
  return (
    <div className="progress-wrap">
      <div className="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}>
        <div className="progress-bar" style={{ width: `${percent}%` }} />
      </div>
      {label ? <span className="progress-label">{label}</span> : null}
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

function statusBadgeText(value) {
  const text = String(value || "");
  if (text.toLowerCase() === "compliance_required") return "需合规校验";
  return value || "-";
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

function lastTruthyIndex(items = []) {
  let result = -1;
  items.forEach((item, index) => {
    if (item) result = index;
  });
  return result;
}

function buildVideoWaitPhases({ steps = [], running = false, completed = false, failed = false, mode = "run" } = {}) {
  const stepText = steps
    .map((step) => `${step.name || ""}\n${step.message || ""}\n${step.output || ""}\n${step.status || ""}`)
    .join("\n");
  const hasSubmit = running || completed || failed || steps.length > 0;
  const hasQueue = completed || failed || /提交|创建|任务|queued|queue|排队|等待|外部|job|准备/i.test(stepText);
  const hasGenerate = completed || failed || /生成|processing|running|progress|进度|seedance|libTV|视频|返回/i.test(stepText);
  const hasReturn = completed || /完成|成功|返回|video_url|视频链接|ready/i.test(stepText);
  const labels = mode === "dry_run"
    ? ["提交验证", "验证参数", "检查链路", "返回结果"]
    : ["提交任务", "等待排队", "生成视频", "返回结果"];
  const hits = [hasSubmit, hasQueue, hasGenerate, hasReturn || failed];
  const activeIndex = failed
    ? Math.max(0, lastTruthyIndex(hits))
    : completed
      ? 3
      : hasGenerate
        ? 2
        : hasQueue
          ? 1
          : hasSubmit
            ? 0
            : -1;
  return labels.map((label, index) => ({
    key: ["submit", "queue", "generate", "return"][index],
    label,
    index: String(index + 1).padStart(2, "0"),
    status: failed && index === activeIndex
      ? "failed"
      : completed || index < activeIndex
        ? "done"
        : index === activeIndex
          ? "current"
          : "pending"
  }));
}

function buildVideoLogSummary({ videoLog = "", videoUrl = "", videoSteps = [], videoRunning = false } = {}) {
  if (!String(videoLog || "").trim()) return null;
  const failed = videoSteps.some((step) => step.status === "failed");
  if (videoUrl) {
    return {
      tone: "done",
      label: "视频已生成",
      title: "可以打开结果视频",
      detail: "原始任务日志已收起，下载或复用素材可到资产页查看。"
    };
  }
  if (failed) {
    const failedStep = videoSteps.find((step) => step.status === "failed");
    return {
      tone: "warn",
      label: "需要处理",
      title: failedStep?.name || "视频生成遇到问题",
      detail: failedStep?.message || "请按上方步骤提示调整素材或提示词后重试。"
    };
  }
  if (videoRunning) {
    return {
      tone: "running",
      label: "正在生成",
      title: "后台还在处理视频",
      detail: "保持页面打开即可，完成后会显示视频入口。"
    };
  }
  return {
    tone: "info",
    label: "已有记录",
    title: "后台返回了任务记录",
    detail: "手机端已隐藏技术日志，继续查看上方进度或到任务中心确认结果。"
  };
}

function buildVideoGenerationEstimate({ steps = [], running = false, targetDuration = 15, mode = "run", hasVideo = false, now = Date.now() }) {
  const failed = steps.some((step) => step.status === "failed");
  const completed = hasVideo || steps.some((step) => step.status === "done" && /完成|成功|返回|libTV/i.test(`${step.name} ${step.message}`));
  const firstTime = firstStepTime(steps);
  const elapsedSeconds = firstTime ? Math.max(0, Math.floor((now - firstTime) / 1000)) : 0;
  const targetSeconds = boundedNumberValue(targetDuration, 15, 4, 15);
  const estimatedSeconds = estimateVideoWaitSeconds(targetSeconds, mode);
  const timePercent = firstTime ? Math.min(96, Math.round((elapsedSeconds / Math.max(estimatedSeconds, 1)) * 96)) : 0;
  const realPercent = extractProgressPercentFromSteps(steps);
  const stepPercent = progressPercent(steps);
  const percent = completed
    ? 100
    : failed
      ? Math.max(realPercent, stepPercent)
      : running
        ? clampPercent(Math.max(8, realPercent, stepPercent, timePercent))
        : clampPercent(Math.max(realPercent, stepPercent));
  const remainingSeconds = completed || failed
    ? 0
    : Math.max(0, estimatedSeconds - elapsedSeconds);
  const overdue = running && elapsedSeconds > estimatedSeconds;
  const phases = buildVideoWaitPhases({ steps, running, completed, failed, mode });
  const activePhase = phases.find((phase) => phase.status === "current" || phase.status === "failed");
  return {
    visible: running || completed || failed || steps.length > 0,
    running,
    completed,
    failed,
    overdue,
    percent,
    elapsedSeconds,
    estimatedSeconds,
    remainingSeconds,
    elapsedLabel: formatShortDuration(elapsedSeconds),
    remainingLabel: overdue ? "排队中" : formatShortDuration(remainingSeconds),
    estimateLabel: overdue ? "已超过预估，但任务还在等待返回" : `预估 ${formatShortDuration(estimatedSeconds)}`,
    durationLabel: `${targetSeconds} 秒视频`,
    phases,
    currentPhaseLabel: activePhase?.label || "",
    statusLabel: completed ? "视频已完成" : failed ? "生成未完成" : mode === "dry_run" ? "正在验证参数" : activePhase?.label ? `正在${activePhase.label}` : "正在生成视频",
    headlineLabel: completed ? "完成" : failed ? "需处理" : overdue ? "仍在排队" : running ? `约剩 ${formatShortDuration(remainingSeconds)}` : `${percent}%`,
    resultLabel: completed ? "100%" : failed ? "需处理" : `${percent}%`,
    currentNote: completed
      ? "结果已返回，可以打开视频或到资产页下载。"
      : failed
        ? "请根据失败提示调整素材或提示词后重试。"
        : overdue
          ? "排队时间比预估更久，页面会继续自动等待结果。"
          : running
            ? `当前阶段：${activePhase?.label || "生成视频"}，页面会自动更新。`
            : "准备好后点击生成视频。",
    helpText: completed
      ? "视频结果已经返回，可以打开查看或去素材页继续处理。"
      : failed
        ? "任务没有完成，请查看下方失败原因或到任务中心处理。"
        : overdue
          ? "生成时间受排队和模型负载影响，页面会继续等待结果。"
          : "这是根据视频秒数和当前阶段估算的进度，真实结果返回后会自动完成。"
  };
}

function firstStepTime(steps = []) {
  return steps
    .map((step) => new Date(step.at || "").getTime())
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right)[0] || 0;
}

function estimateVideoWaitSeconds(targetDuration = 15, mode = "run") {
  if (mode === "dry_run") return 24;
  if (mode === "submit") return 42;
  const seconds = boundedNumberValue(targetDuration, 15, 4, 15);
  return Math.round(58 + seconds * 11);
}

function extractProgressPercentFromSteps(steps = []) {
  const values = [];
  for (const step of steps) {
    const text = `${step.name || ""}\n${step.message || ""}\n${step.output || ""}`;
    for (const match of text.matchAll(/(?:progress|进度)\s*[:=：]?\s*(\d+(?:\.\d+)?)\s*%?/gi)) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) values.push(value <= 1 ? value * 100 : value);
    }
    for (const match of text.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%/g)) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) values.push(value);
    }
  }
  return clampPercent(Math.max(0, ...values));
}

function boundedNumberValue(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function formatShortDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (!minutes) return `${rest}秒`;
  return `${minutes}分${String(rest).padStart(2, "0")}秒`;
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
