import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = path.resolve(appRoot, "..", "..");
const outputPath = path.join(workspaceRoot, "00_docs", "PRODUCTION_DEPLOYMENT_HANDOFF_2026-06-10.md");

function appPath(relativePath) {
  return path.join(appRoot, relativePath);
}

async function readText(relativePath) {
  return readFile(appPath(relativePath), "utf8").catch(() => "");
}

async function readJson(relativePath) {
  const text = await readText(relativePath);
  return text ? JSON.parse(text) : null;
}

function parseEnv(text) {
  const rows = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    rows.push({
      key: line.slice(0, index).trim(),
      value: line.slice(index + 1).trim()
    });
  }
  return rows;
}

function isSecretKey(key) {
  return /KEY|PASSWORD|SECRET|TOKEN|SHA256|USERNAME/i.test(key);
}

function isPlaceholder(value) {
  const text = String(value || "").trim();
  return !text || /change-me|example\.com|<hosting-secret>|<review|TODO_|^pending$/i.test(text);
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((item) => String(item || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ")).join(" | ")} |`)
  ].join("\n");
}

function envRows(rows, secret = false) {
  return rows
    .filter((row) => isSecretKey(row.key) === secret)
    .map((row) => [
      row.key,
      secret ? (isPlaceholder(row.value) ? "set in secret manager" : "template contains a value; verify it is not real") : row.value,
      isPlaceholder(row.value) ? "replace before deploy" : "template-ready"
    ]);
}

function requiredOwnerRows(operatorInputs) {
  const rows = [];
  for (const group of operatorInputs?.inputGroups || []) {
    for (const field of group.fields || []) {
      if (!field.required || !isPlaceholder(field.currentValue)) continue;
      rows.push([
        group.owner || "",
        field.label || field.id,
        field.currentValue,
        (field.writeTo || []).join("; "),
        (field.verification || []).join("; ")
      ]);
    }
  }
  return rows;
}

function blockerRows(register) {
  return (register?.blockers || [])
    .filter((item) => item.severity?.includes("production") || item.severity?.includes("launch"))
    .map((item) => [
      item.id,
      item.owner,
      item.status,
      (item.unblockActions || []).slice(0, 2).join("; "),
      (item.verificationCommands || []).join("; ")
    ]);
}

const productionEnv = parseEnv(await readText("deploy/production.env.example"));
const operatorInputs = await readJson("store/operator-inputs-register.json");
const blockerRegister = await readJson("store/release-blockers-register.json");
const cloudPlan = await readJson("deploy/cloud-deployment-action-plan.json");
const publicOrigin = operatorInputs?.publicOrigin || productionEnv.find((row) => row.key === "PUBLIC_APP_ORIGIN")?.value || "missing";
const generatedAt = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const cloudRows = (cloudPlan?.workstreams || []).map((item) => [
  item.order || "",
  item.title || item.id,
  item.status || "",
  (item.productionValues || []).join("; "),
  (item.nextActions || []).slice(0, 2).join("; ")
]);

const content = `# Production Deployment Handoff

Generated: ${generatedAt}

Project: \`D:\\Organized\\Projects\\codex_project\\workflow\\01_apps\\ai_prompt_video_studio\`

Public origin: \`${publicOrigin}\`

Use this file as the hosting-platform handoff. Do not paste real API keys, passwords, signing keys, cookies, or private certificates into this repository.

## 1. Environment Values To Copy

These values come from \`deploy/production.env.example\`. Copy them into the production hosting platform, then replace the placeholders in the platform secret manager.

${table(["Variable", "Production value", "Status"], envRows(productionEnv, false))}

## 2. Secret Values To Create

Store these as hosting secrets or password-manager items. Keep real values outside git.

${table(["Secret", "Where to set it", "Status"], envRows(productionEnv, true))}

## 3. Owner Inputs Still Needed

${table(["Owner", "Input", "Current value", "Write to", "Verification"], requiredOwnerRows(operatorInputs).slice(0, 18))}

## 4. Production Blockers

These are not code blockers; they require real hosting, storage, worker, reviewer, or business inputs before public launch.

${table(["Blocker", "Owner", "Status", "Next action", "Verification"], blockerRows(blockerRegister))}

## 5. Cloud Workstreams

${table(["Order", "Workstream", "Status", "Production values", "Next actions"], cloudRows)}

## 6. Deployment Order

1. Configure hosting environment variables from section 1.
2. Create hosting secrets from section 2.
3. Confirm \`https://www.zkraiflow.top/api/healthz\` returns ok after deploy.
4. Create the review-safe account and seed demo data with \`npm run review:seed\`.
5. Run \`npm run cloud:smoke\` against \`https://www.zkraiflow.top\`.
6. Run \`npm run release:check\` before packaging native builds or store submission.
7. Keep \`LIBTV_DEFAULT_DRY_RUN=true\` in staging until the worker endpoint is proven with a real smoke test.

## 7. Commands

${table(["Command", "Purpose"], [
  ["npm run production:profile", "Verify the production env template for www.zkraiflow.top."],
  ["npm run cloud:check:strict", "Audit local environment and cloud readiness warnings."],
  ["npm run cloud:smoke", "Verify deployed health, auth, legal pages, and protected APIs."],
  ["npm run review:seed", "Seed reviewer-safe demo product, account asset, and dry-run batch."],
  ["npm run release:check", "Run the full local release gate."]
])}
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, content, "utf8");

console.log(`Production deployment handoff written: ${outputPath}`);
console.log(`Public origin: ${publicOrigin}`);
console.log(`Required owner inputs: ${requiredOwnerRows(operatorInputs).length}`);
