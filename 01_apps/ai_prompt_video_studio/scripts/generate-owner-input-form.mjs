import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const outputPath = path.join(workspaceRoot, "00_docs", "OWNER_INPUT_COLLECTION_FORM_2026-06-10.md");

function appPath(relativePath) {
  return path.join(appRoot, relativePath);
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
  return !text || /^TODO_/i.test(text) || /TODO_|<secret>|<account>|pending|not-started/i.test(text);
}

function fieldStatus(field) {
  if (!field.required) return "可选";
  if (isPlaceholder(field.currentValue)) return "待提供";
  return "已有初值，待验收";
}

function safetyInstruction(field) {
  const doNotStore = (field.doNotStore || []).join("；");
  if (/password|secret|key|token|certificate|private/i.test(`${field.id} ${field.label}`)) {
    return "只提供密码管理器条目或托管平台 Secret 名称，不提供真实密钥/密码。";
  }
  if (doNotStore) return `可提供当前资料项；不要提交：${doNotStore}`;
  return "可提供公开业务信息；确认后再写入仓库。";
}

function ownerGroups(register) {
  const owners = new Map();
  for (const group of register.inputGroups || []) {
    if (!owners.has(group.owner)) owners.set(group.owner, []);
    owners.get(group.owner).push(group);
  }
  return owners;
}

function missingRequiredFields(register) {
  const fields = [];
  for (const group of register.inputGroups || []) {
    for (const field of group.fields || []) {
      if (!field.required || !isPlaceholder(field.currentValue)) continue;
      fields.push({ group, field });
    }
  }
  return fields;
}

function rowsForGroup(group) {
  return (group.fields || []).map((field) => [
    field.required ? "必填" : "可选",
    field.label,
    fieldStatus(field),
    field.targetFormat || "待补格式说明",
    "线下填写；敏感项只填引用名",
    (field.writeTo || []).join("; "),
    (field.verification || []).join("; "),
    safetyInstruction(field)
  ]);
}

function missingRows(items) {
  return items.map(({ group, field }) => [
    group.owner,
    group.title,
    field.label,
    field.currentValue || "empty",
    field.targetFormat || "",
    safetyInstruction(field),
    (field.verification || []).join("; ")
  ]);
}

const register = await readJson("store/operator-inputs-register.json");
const submission = await readJson("store/submission-readiness.json");
const generatedAt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const missing = missingRequiredFields(register);
const byOwner = ownerGroups(register);

const ownerSections = [...byOwner.entries()].map(([owner, groups]) => {
  const groupSections = groups.map((group) => `### ${group.title}

负责人：\`${owner}\`  
当前状态：\`${group.status}\`  
上线影响：${group.releaseImpact}

${table(["级别", "资料项", "状态", "目标格式", "填写区", "写入位置", "验收方式", "安全边界"], rowsForGroup(group))}
`).join("\n");
  return `## ${owner}\n\n${groupSections}`;
}).join("\n");

const content = `# App 上线资料收集表

生成日期：${generatedAt}  
公网域名：\`${register.publicOrigin || submission.app?.marketingUrl || "missing"}\`  
状态：\`${register.status}\`  

这份表给运营、法务、账号持有人和工程负责人使用。它只收集“上线必须有人确认的真实值或凭证位置”，不要把真实密码、API Key、签名密钥、证书私钥、MFA 恢复码或私有客户素材写进仓库。

## 使用方式

1. 按负责人分发表格，先收齐“待提供”的必填项。
2. 公开信息可以写入仓库，例如客服邮箱、客服电话、运营主体、备案展示位置。
3. 敏感信息只记录密码管理器条目名、托管平台 Secret 名称或负责人的确认结论。
4. 收齐后由工程把非敏感值写回对应文件或生产环境，再运行验收命令。

## 最快上线顺序

| 顺序 | 事项 | 为什么先做 |
| --- | --- | --- |
| 1 | 客服邮箱、客服电话、运营主体 | 影响公网支持页、隐私政策和商店资料。 |
| 2 | 审核账号和密码管理器引用 | 影响 App Store / Google Play 审核和生产 smoke。 |
| 3 | 生产 Cookie/CORS、持久化存储、libTV worker | 影响外部用户登录、任务记录、上传素材和真实生成。 |
| 4 | 最终服务商清单、数据保留与删除周期 | 影响隐私政策、AI 说明和数据安全表单。 |
| 5 | Android/iOS 工具链、签名和原生截图 | 影响原生商店提交。 |
| 6 | ICP 备案号、APP 备案号、展示位置 | 影响国内公开分发。 |

## 当前缺口汇总

缺少必填项：${missing.length}

${table(["负责人", "分组", "资料项", "当前值", "目标格式", "安全边界", "验收方式"], missingRows(missing))}

${ownerSections}

## 收齐后的验收顺序

\`\`\`bash
npm run owner:form
npm run owner:inputs
npm run public:check
npm run store:check
npm run cloud:check:strict
npm run review:seed
npm run cloud:smoke
npm run release:check
\`\`\`

## 不要写入仓库

- 真实审核账号密码
- API Key、访问 Token、Cookie
- Android keystore、签名证书、证书私钥和密码
- Apple 账号密码、证书私钥、MFA 恢复码
- 私有客户素材、身份证、营业执照原件或非公开合同
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, content, "utf8");

console.log(`Owner input collection form written: ${outputPath}`);
console.log(`Missing required owner inputs: ${missing.length}`);
