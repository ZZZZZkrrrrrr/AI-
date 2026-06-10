import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const ownerOutputPath = path.join(workspaceRoot, "00_docs", "OWNER_QUICK_INPUTS_2026-06-10.md");
const envOutputPath = path.join(workspaceRoot, "00_docs", "PRODUCTION_ENV_PRESET_CHECKLIST_2026-06-10.md");

function appPath(relativePath) {
  return path.join(appRoot, relativePath);
}

async function readText(relativePath) {
  return readFile(appPath(relativePath), "utf8").catch(() => "");
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(appPath(relativePath), "utf8"));
}

function mdEscape(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((item) => mdEscape(item)).join(" | ")} |`)
  ].join("\n");
}

function isPlaceholder(value) {
  const text = String(value ?? "").trim();
  return !text || /^TODO_/i.test(text) || /TODO_|<secret>|<account>|pending|not-started|change-me|example\.com/i.test(text);
}

function parseEnv(text) {
  const rows = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    rows.push({ key: line.slice(0, index).trim(), value: line.slice(index + 1).trim() });
  }
  return rows;
}

function isSecretKey(key) {
  return /KEY|PASSWORD|SECRET|TOKEN|SHA256|USERNAME/i.test(key);
}

function envCategory(key) {
  if (/^SMOKE_/.test(key)) return "部署后 smoke 验收";
  if (/CORS|COOKIE|AUTH|ORIGIN|NODE_ENV|PORT/.test(key)) return "公网登录与安全";
  if (/RUN_STORAGE|PYTHON|FFMPEG/.test(key)) return "持久化与工具路径";
  if (/LIBTV/.test(key)) return "libTV worker";
  if (/QIANWEN|ARK|SEEDANCE|DOUBAO|SEEDREAM/.test(key)) return "AI/视频服务商";
  if (/BATCH|TIMEOUT/.test(key)) return "运行限制";
  return "其他";
}

function envAction(row) {
  if (isSecretKey(row.key)) return "在托管平台 Secret 或密码管理器创建，不写入仓库。";
  if (isPlaceholder(row.value)) return "替换为生产真实值后写入托管平台环境变量。";
  if (row.key === "CORS_ALLOWED_ORIGINS" && /capacitor:\/\/localhost|https:\/\/localhost/.test(row.value)) {
    return "Web/PWA 只保留公网域名；原生包远程调用 API 时再保留对应 WebView origin。";
  }
  if (/localhost|127\.0\.0\.1/.test(row.value)) return "公网环境不能保留本地地址，替换后再发布。";
  return "可先按模板复制到生产环境，再用 smoke 验收。";
}

function ownerFields(register) {
  const rows = [];
  for (const group of register.inputGroups || []) {
    for (const field of group.fields || []) {
      if (!field.required || !isPlaceholder(field.currentValue)) continue;
      rows.push({ group, field });
    }
  }
  return rows;
}

function ownerLane({ group, field }) {
  if (/password|secret/i.test(`${field.id} ${field.label}`)) return "只给引用";
  if (group.id === "production-runtime" || group.id === "native-store-packaging") return "工程确认";
  return "可直接填写";
}

function ownerQuestion({ group, field }, index) {
  const lane = ownerLane({ group, field });
  const answerHint = lane === "只给引用"
    ? "填密码管理器条目名或托管平台 Secret 名称"
    : lane === "工程确认"
      ? "填负责环境/路径/完成状态"
      : "填真实公开资料";
  return [
    index + 1,
    lane,
    group.owner,
    field.label,
    field.targetFormat || "",
    answerHint,
    field.currentValue || "empty",
    (field.verification || []).join("; ")
  ];
}

function pasteTemplate(fields) {
  return fields.map(({ group, field }, index) => {
    const label = `${index + 1}. ${field.label}`;
    const safeHint = ownerLane({ group, field }) === "只给引用" ? `SECRET_REF_${field.id}` : `TODO_${field.id}`;
    return `${label}: ${safeHint}`;
  }).join("\n");
}

function envRows(rows, secret = false) {
  return rows
    .filter((row) => isSecretKey(row.key) === secret)
    .map((row) => [
      envCategory(row.key),
      row.key,
      secret ? "Secret/密码管理器" : row.value,
      isPlaceholder(row.value) ? "待替换" : "模板可用",
      envAction(row)
    ]);
}

const register = await readJson("store/operator-inputs-register.json");
const productionEnvRows = parseEnv(await readText("deploy/production.env.example"));
const requiredOwnerFields = ownerFields(register);
const generatedAt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const quickContent = `# Owner 最短填写清单

生成日期：${generatedAt}  
公网域名：\`${register.publicOrigin}\`  
用途：把上线阻断中必须由你、运营、法务、账号持有人或工程负责人确认的资料压缩成一张最短答复表。

## 直接回复模板

把下面内容补齐后发回即可。真实密码、API Key、签名证书和私有证件不要写在这里。

\`\`\`text
${pasteTemplate(requiredOwnerFields)}
\`\`\`

## 必填问题

缺少必填项：${requiredOwnerFields.length}

${table(["序号", "填写方式", "负责人", "资料项", "目标格式", "你该怎么填", "当前值", "验收方式"], requiredOwnerFields.map(ownerQuestion))}

## 先填哪几项

| 优先级 | 资料 | 原因 |
| --- | --- | --- |
| P0 | 客服邮箱、客服电话、运营主体 | 会同时影响公网支持页、隐私政策、商店资料和审核说明。 |
| P0 | 审核账号用户名、审核密码引用 | 没有审核账号就无法做真实生产 smoke 和商店审核。 |
| P0 | 生产持久化存储、libTV worker | 没有这两项，外部用户的素材/任务记录和真实视频生成不可稳定上线。 |
| P1 | 服务商清单、数据保留与删除周期 | 会影响隐私政策、AI 说明、Apple 隐私标签和 Google Data safety。 |
| P1 | Android/iOS 工具链、原生截图 | 会影响 App Store、Google Play 和国内安卓商店提交。 |
| P1 | ICP/APP 备案号和展示位置 | 会影响中国大陆公开分发。 |

## 安全边界

- 可以公开写入仓库：客服邮箱、客服电话、运营主体、备案号、备案展示位置、公开服务商名称。
- 只写引用名：审核账号密码、API Key、对象存储密钥、worker token、Android keystore、Apple 证书私钥。
- 不写入仓库：真实密码、MFA 恢复码、身份证/营业执照原件、客户私有素材、未公开合同。
`;

const envContent = `# 生产环境变量预置清单

生成日期：${generatedAt}  
公网域名：\`${register.publicOrigin}\`  
来源：\`deploy/production.env.example\`

这份清单给工程部署使用。先把非敏感变量复制到托管平台环境变量，再把敏感变量放进 Secret 管理器；不要把真实密钥、密码或 token 写回仓库。

## 非敏感变量

${table(["分类", "变量", "模板值", "状态", "处理动作"], envRows(productionEnvRows, false))}

## Secret / 凭证变量

${table(["分类", "变量", "设置位置", "状态", "处理动作"], envRows(productionEnvRows, true))}

## 推荐部署顺序

1. 设置 \`NODE_ENV=production\`、\`PUBLIC_APP_ORIGIN=https://www.zkraiflow.top\` 和精确 \`CORS_ALLOWED_ORIGINS\`。
2. 设置 \`CONSOLE_AUTH_COOKIE_SECURE=true\`，生产账号启用强密码或 SHA256 密码。
3. 配置 \`RUN_STORAGE_DIR\` 到可持久化卷，确认重启后上传、导出和删除请求仍在。
4. 把 libTV 从本地路径迁移到 worker/private service，替换 \`LIBTV_BRIDGE_URL\`、\`LIBTV_REGISTER_SCRIPT\`、\`LIBTV_DB_PATH\`。
5. 创建 AI/视频服务商 Secret，保留服务商名称和模型名在公开配置里。
6. 用审核账号运行 \`npm run review:seed\` 和 \`npm run cloud:smoke\`。
7. 最后运行 \`npm run release:check\`。

## 必须人工确认

- 生产环境不能保留 localhost worker、Windows 本地路径或空密码。
- \`CORS_ALLOWED_ORIGINS\` 不要用通配符。
- \`LIBTV_DEFAULT_DRY_RUN=false\` 只应在 worker 已通过真实 smoke 后启用。
- 移动端原生包如果远程调用该 API，需要保留 \`capacitor://localhost\` 或对应 WebView origin。
`;

await mkdir(path.dirname(ownerOutputPath), { recursive: true });
await writeFile(ownerOutputPath, quickContent, "utf8");
await writeFile(envOutputPath, envContent, "utf8");

console.log(`Owner quick inputs written: ${ownerOutputPath}`);
console.log(`Production env preset checklist written: ${envOutputPath}`);
console.log(`Missing required owner inputs: ${requiredOwnerFields.length}`);
