import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const outputPath = path.join(workspaceRoot, "00_docs", "LAUNCH_READINESS_COCKPIT_2026-06-10.md");

function appPath(relativePath) {
  return path.join(appRoot, relativePath);
}

async function readJson(relativePath) {
  const text = await readFile(appPath(relativePath), "utf8");
  return JSON.parse(text);
}

function textValue(input, fallback = "missing") {
  const text = String(input || "").trim();
  return text || fallback;
}

function isPlaceholder(input) {
  const text = textValue(input);
  return /^TODO_/i.test(text) || /TODO_|<secret>|<account>|pending|not-started/i.test(text);
}

function statusLabel(status) {
  const text = textValue(status);
  if (["ready", "done", "approved", "ok", "internal-ready", "internal-ready-with-manual-gates", "captured", "captured-first-pass", "draft-structured", "template-ready", "native-projects-generated", "config-ready", "web-first-pass-captured", "production-profile-ready", "release-guard-ready", "smoke-template-ready"].includes(text)) {
    return "可用于当前阶段";
  }
  if (/pending|draft|planned|waiting|not-started|collecting|blocked|design-needed|manual-qa/.test(text)) {
    return "需要继续推进";
  }
  return "需要复核";
}

function mdEscape(text) {
  return String(text || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((item) => mdEscape(item)).join(" | ")} |`)
  ].join("\n");
}

function collectMissingOwnerFields(operatorInputs) {
  const rows = [];
  for (const group of operatorInputs.inputGroups || []) {
    for (const field of group.fields || []) {
      if (!field.required) continue;
      if (!isPlaceholder(field.currentValue)) continue;
      rows.push({
        group: group.title,
        owner: group.owner,
        field: field.label,
        currentValue: field.currentValue,
        verification: (field.verification || []).join("; ")
      });
    }
  }
  return rows;
}

function collectBlockers(register) {
  return (register.blockers || []).map((item) => ({
    id: item.id,
    owner: item.owner,
    severity: item.severity,
    status: item.status,
    impact: item.releaseImpact,
    nextAction: (item.unblockActions || [])[0] || ""
  }));
}

function blockerSummary(blockers) {
  const summary = new Map();
  for (const blocker of blockers) {
    const key = blocker.severity || "unknown";
    summary.set(key, (summary.get(key) || 0) + 1);
  }
  return [...summary.entries()].map(([severity, count]) => `${severity}: ${count}`).join(", ");
}

function collectPlanRows(plan, key = "milestones") {
  return (plan?.[key] || []).map((item) => [
    item.title || item.id,
    item.owner || "missing",
    item.status || "missing",
    statusLabel(item.status)
  ]);
}

const submission = await readJson("store/submission-readiness.json");
const blockerRegister = await readJson("store/release-blockers-register.json");
const operatorInputs = await readJson("store/operator-inputs-register.json");
const launchPlan = await readJson("store/launch-action-plan.json");
const cloudPlan = await readJson("deploy/cloud-deployment-action-plan.json");
const mobileQaPlan = await readJson("store/mobile-device-qa-plan.json");
const screenshotPlan = await readJson("store/screenshot-plan.json");
const pilotRelease = await readJson("store/pilot-release-readiness.json");

const blockers = collectBlockers(blockerRegister);
const missingFields = collectMissingOwnerFields(operatorInputs);
const publicOrigin = operatorInputs.publicOrigin || submission.app?.marketingUrl || "missing";
const generatedAt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const releaseDecisionRows = [
  ["内部继续迭代 / 小范围试用", blockerRegister.summary?.internalPilotBlocked ? "不建议" : "可以继续", "公网页面、移动端大按钮、PWA、截图计划、Capacitor 工程和发布检查已有基础证据"],
  ["公开给外部用户", blockerRegister.summary?.publicLaunchBlocked ? "暂不通过" : "可发布", "还需要生产 Cookie/CORS、审核账号、持久化存储、libTV worker 和 owner 输入"],
  ["App Store / Google Play 提交", blockerRegister.summary?.storeSubmissionBlocked ? "暂不通过" : "可提交", "还需要审核账号、法务终稿、原生截图、Android/iOS 真机验证和商店资料终稿"],
  ["国内安卓商店 / 中国公开分发", "暂不通过", "还需要运营主体、ICP备案、APP 备案和展示位置"]
];

const verifiedRows = [
  ["Pilot release readiness", pilotRelease.status, "pilot:readiness / PILOT_RELEASE_READINESS"],
  ["公网域名", publicOrigin, "public:check / PUBLIC_DOMAIN_READINESS"],
  ["移动端新手入口", mobileQaPlan.status, "mobile:check / mobile:qa / screenshots:check"],
  ["PWA 资源", submission.distribution?.pwaStatus, "pwa:check / public:check"],
  ["Capacitor 原生工程", submission.distribution?.capacitorStatus, "capacitor:sync / capacitor:check"],
  ["Web 首轮截图", screenshotPlan.sets?.filter((set) => set.status === "captured").map((set) => set.id).join(", "), "screenshots:check"],
  ["运营输入追踪", operatorInputs.status, "owner:inputs"]
];

const commandRows = [
  ["npm run legal:finalization-plan", "Check legal finalization handoff for privacy pages, store forms, account deletion, AI disclosure, and owner-provided legal inputs"],
  ["npm run production:auth-plan", "Check production origin, authenticated CORS, Secure/SameSite cookies, and public smoke handoff"],
  ["npm run production:ops-plan", "Check production health surfaces, week-one monitoring, rollback playbooks, log safety, and incident response"],
  ["npm run cloud:worker-plan", "Check libTV worker and persistent storage migration plan"],
  ["npm run review:access-plan", "Check store review account access handoff"],
  ["npm run store:console-plan", "Check App Store Connect, Google Play Console, and domestic Android submission handoff"],
  ["npm run pilot:readiness", "Check the controlled mobile web and PWA pilot scope, gates, runbook, and evidence before inviting testers"],
  ["npm run pilot:feedback", "Check the mobile pilot feedback form, support feedback API, admin triage queue, and no-secret evidence rules"],
  ["npm run release:evidence", "Check that every release blocker has non-secret closure evidence requirements"],
  ["npm run screenshots:native-plan", "Check native store screenshot handoff"],
  ["npm run native:release-plan", "Check native release signing handoff, Android upload key plan, iOS signing plan, and no-secret rules"],
  ["npm run china:distribution-plan", "Check China distribution and filing handoff"],
  ["npm run public:check", "验证公网 URL、隐私/支持/删除账号页面、PWA manifest 和健康检查"],
  ["npm run owner:brief", "生成 owner 最短填写清单和生产环境变量预置清单"],
  ["npm run owner:form", "从登记表重新生成可分发的上线资料收集表"],
  ["npm run owner:inputs", "列出必须由运营/法务/账号持有人提供的真实值"],
  ["npm run mobile:qa", "验证移动端用户路径、真机/原生 App 待测项和截图证据"],
  ["npm run cloud:check:strict", "验证生产环境变量、Cookie/CORS、存储和 libTV worker 准备度"],
  ["npm run store:check", "验证上架资料、隐私表单草案、审核说明和截图计划"],
  ["npm run release:check", "总门禁：合规、云端、公网、运营输入、截图、移动端、商店、构建和封装"]
];

const nextActionRows = missingFields.slice(0, 12).map((item) => [
  item.field,
  item.owner,
  item.currentValue,
  item.verification
]);

const blockerRows = blockers.map((item) => [
  item.id,
  item.owner,
  item.severity,
  item.status,
  item.nextAction
]);

const content = `# Workflow App 上线驾驶舱

生成日期：${generatedAt}  
项目路径：\`D:\\Organized\\Projects\\codex_project\\workflow\\01_apps\\ai_prompt_video_studio\`  
公网入口：\`${publicOrigin}\`  
当前结论：可以继续内部迭代和小范围试用；暂不建议公开发布或提交应用商店。

## 1. 发布决策

${table(["场景", "结论", "原因"], releaseDecisionRows)}

## 2. 已有证据

${table(["领域", "当前状态", "验证入口"], verifiedRows)}

## 3. 当前阻断概览

阻断项数量：${blockers.length}  
严重度分布：${blockerSummary(blockers)}

${table(["阻断项", "负责人", "级别", "状态", "下一步"], blockerRows)}

## 4. 需要 owner 提供的 P0/P1 输入

缺失必填输入数量：${missingFields.length}

${table(["输入项", "负责人", "当前值", "验证方式"], nextActionRows)}

## 5. 上线工作流建议

1. 先补客服邮箱、客服电话、运营主体、审核账号和密码管理器引用。
2. 在生产环境设置 \`PUBLIC_APP_ORIGIN\`、\`CORS_ALLOWED_ORIGINS\`、\`CONSOLE_AUTH_COOKIE_SECURE=true\`、\`RUN_STORAGE_DIR\`。
3. 使用审核账号执行 \`npm run review:seed\` 和 \`npm run cloud:smoke\`。
4. 安装 Android SDK/JDK 17+，并在 macOS/Xcode 完成 iOS 构建签名。
5. 用原生 App 捕获 App Store / Google Play 截图，替换或补齐 web-first-pass 截图。
6. 法务确认隐私政策、用户协议、AI 说明、数据保留周期和服务商清单。
7. 国内分发前补 ICP 备案号、APP 备案号和展示位置。

## 6. 常用命令

${table(["命令", "用途"], commandRows)}

## 7. 商店发布计划

${table(["事项", "负责人", "状态", "判断"], collectPlanRows(launchPlan, "milestones"))}

## 8. 云端发布计划

${table(["事项", "负责人", "状态", "判断"], collectPlanRows(cloudPlan, "workstreams"))}

## 9. 不要写入仓库

- 真实审核账号密码
- API Key
- Android keystore 和密码
- Apple 账号密码、证书私钥、MFA 恢复码
- 私有客户素材
- 身份证、营业执照等非公开证件原件

## 10. 证据文件

- \`store/operator-inputs-register.json\`
- \`00_docs/OWNER_QUICK_INPUTS_2026-06-10.md\`
- \`00_docs/PRODUCTION_ENV_PRESET_CHECKLIST_2026-06-10.md\`
- \`00_docs/OWNER_INPUT_COLLECTION_FORM_2026-06-10.md\`
- \`store/release-blockers-register.json\`
- \`store/release-evidence-register.json\`
- \`store/pilot-release-readiness.json\`
- \`00_docs/PILOT_RELEASE_READINESS_2026-06-10.md\`
- \`00_docs/PILOT_FEEDBACK_LOOP_2026-06-10.md\`
- \`scripts/check-pilot-feedback-readiness.mjs\`
- \`00_docs/RELEASE_EVIDENCE_REGISTER_2026-06-10.md\`
- \`store/submission-readiness.json\`
- \`store/mobile-device-qa-plan.json\`
- \`store/screenshot-plan.json\`
- \`00_docs/OPERATOR_INPUTS_HANDOFF_2026-06-10.md\`
- \`00_docs/PUBLIC_DOMAIN_READINESS_2026-06-09.md\`
- \`deploy/libtv-worker-storage-plan.json\`
- \`00_docs/LIBTV_WORKER_STORAGE_MIGRATION_2026-06-10.md\`
- \`deploy/production-auth-cors-handoff.json\`
- \`00_docs/PRODUCTION_AUTH_CORS_HANDOFF_2026-06-10.md\`
- \`deploy/production-observability-rollback-plan.json\`
- \`00_docs/PRODUCTION_OBSERVABILITY_ROLLBACK_2026-06-10.md\`
- \`store/review-access-handoff.json\`
- \`00_docs/REVIEW_ACCOUNT_ACCESS_RUNBOOK_2026-06-10.md\`
- \`store/store-console-submission-handoff.json\`
- \`00_docs/STORE_CONSOLE_SUBMISSION_HANDOFF_2026-06-10.md\`
- \`store/legal-finalization-handoff.json\`
- \`00_docs/LEGAL_FINALIZATION_HANDOFF_2026-06-10.md\`
- \`store/native-store-screenshot-handoff.json\`
- \`00_docs/NATIVE_STORE_SCREENSHOT_HANDOFF_2026-06-10.md\`
- \`store/native-release-signing-handoff.json\`
- \`00_docs/NATIVE_RELEASE_SIGNING_HANDOFF_2026-06-10.md\`
- \`store/china-distribution-compliance-handoff.json\`
- \`00_docs/CHINA_DISTRIBUTION_COMPLIANCE_HANDOFF_2026-06-10.md\`
- \`00_docs/MOBILE_DEVICE_QA_PLAN_2026-06-09.md\`
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, content, "utf8");

console.log(`Launch cockpit written: ${outputPath}`);
console.log(`Release blockers: ${blockers.length}`);
console.log(`Missing required owner inputs: ${missingFields.length}`);
