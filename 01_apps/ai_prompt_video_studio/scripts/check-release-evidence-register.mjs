import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const workspaceRoot = findWorkspaceRoot(appRoot);
const passes = [];
const warnings = [];
const failures = [];

function findWorkspaceRoot(startDir) {
  let current = path.resolve(startDir);
  for (let index = 0; index < 6; index += 1) {
    if (existsSync(path.join(current, "00_docs")) && existsSync(path.join(current, "01_apps"))) {
      return current;
    }
    const next = path.dirname(current);
    if (next === current) break;
    current = next;
  }
  return path.resolve(startDir, "..", "..");
}

function resolveProjectPath(relativePath) {
  if (relativePath.startsWith("00_docs/")) return path.join(workspaceRoot, relativePath);
  return path.join(appRoot, relativePath);
}

async function readText(relativePath) {
  try {
    return await readFile(resolveProjectPath(relativePath), "utf8");
  } catch {
    return "";
  }
}

async function readJson(relativePath) {
  const text = await readText(relativePath);
  if (!text) {
    fail(`${relativePath} is missing or empty.`);
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`${relativePath} is invalid JSON: ${error.message}`);
    return null;
  }
}

async function fileExists(relativePath) {
  try {
    const info = await stat(resolveProjectPath(relativePath));
    return info.isFile() && info.size > 0;
  } catch {
    return false;
  }
}

function pass(message) {
  passes.push(message);
}

function warn(message) {
  warnings.push(message);
}

function fail(message) {
  failures.push(message);
}

function requireValue(value, label) {
  if (value !== undefined && value !== null && String(value).trim()) {
    pass(`${label} is present.`);
    return true;
  }
  fail(`${label} is missing.`);
  return false;
}

function requireArray(value, label, minimum = 1) {
  if (Array.isArray(value) && value.length >= minimum) {
    pass(`${label} has ${value.length} item(s).`);
    return true;
  }
  fail(`${label} should contain at least ${minimum} item(s).`);
  return false;
}

function requireIncludes(source, marker, label) {
  if (String(source || "").includes(marker)) {
    pass(label);
    return;
  }
  fail(`${label}: missing marker "${marker}".`);
}

function commandScriptName(command) {
  const match = /npm run ([\w:-]+)/.exec(String(command || ""));
  return match?.[1] || "";
}

function looksSecretLike(value) {
  const text = String(value || "");
  return /sk-[A-Za-z0-9_-]{20,}/.test(text)
    || /AIza[A-Za-z0-9_-]{20,}/.test(text)
    || /ghp_[A-Za-z0-9_]{20,}/.test(text)
    || /xox[baprs]-[A-Za-z0-9-]{20,}/.test(text)
    || /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(text)
    || /password\s*[:=]\s*(?!TODO_|<secret>|password-manager|secret ref)/i.test(text);
}

const register = await readJson("store/release-evidence-register.json");
const blockerRegister = await readJson("store/release-blockers-register.json");
const operatorInputs = await readJson("store/operator-inputs-register.json");
const submission = await readJson("store/submission-readiness.json");
const packageJson = await readJson("package.json");
const docText = await readText("00_docs/RELEASE_EVIDENCE_REGISTER_2026-06-10.md");
const evidenceReadme = await readText("store/evidence/README.md");
const packageScripts = packageJson?.scripts || {};

if (register) {
  if (register.schemaVersion === "release-evidence-register-v1") pass("Release evidence register schema version is current.");
  else fail("Release evidence register schemaVersion must be release-evidence-register-v1.");

  requireValue(register.updatedAt, "Release evidence register updatedAt");
  requireIncludes(register.status, "waiting-production-owner-artifacts", "Release evidence register keeps production and owner evidence unresolved.");
  requireIncludes(register.publicOrigin, "https://www.zkraiflow.top", "Release evidence register uses the public production domain.");
  requireValue(register.objective, "Release evidence register objective");
  requireArray(register.rules, "Release evidence register rules", 4);

  const ruleText = (register.rules || []).join("\n");
  for (const marker of ["Do not store real passwords", "signing keys", "private customer assets", "Secrets should be represented"]) {
    requireIncludes(ruleText, marker, `Release evidence rules include ${marker}.`);
  }

  if (register.evidenceStorage?.repositoryFolder === "store/evidence/") pass("Release evidence storage points to store/evidence/.");
  else fail("Release evidence storage repositoryFolder should be store/evidence/.");
  requireArray(register.evidenceStorage?.externalPrivateStorage, "Release evidence external private storage options", 4);

  const bundles = Array.isArray(register.bundles) ? register.bundles : [];
  requireArray(bundles, "Release evidence bundles", 12);
  const bundleIds = new Set(bundles.map((bundle) => bundle.id));
  for (const id of [
    "public-domain-and-auth-smoke",
    "support-contact-and-public-pages",
    "legal-privacy-data-safety-final",
    "review-account-and-demo-seed",
    "production-observability-and-rollback",
    "persistent-storage-restart-proof",
    "libtv-worker-cloud-proof",
    "native-build-signing-upload-proof",
    "native-store-screenshot-proof",
    "mobile-device-qa-proof",
    "store-console-submission-proof",
    "china-filing-and-domestic-distribution-proof"
  ]) {
    if (bundleIds.has(id)) pass(`Release evidence bundle exists: ${id}.`);
    else fail(`Release evidence bundle is missing: ${id}.`);
  }

  const blockerIds = new Set((blockerRegister?.blockers || []).map((blocker) => blocker.id));
  const coveredBlockers = new Set();
  for (const bundle of bundles) {
    const label = bundle.id || "unnamed-bundle";
    requireValue(bundle.owner, `Evidence bundle ${label} owner`);
    requireValue(bundle.status, `Evidence bundle ${label} status`);
    requireArray(bundle.linkedBlockers, `Evidence bundle ${label} linked blockers`, 1);
    requireArray(bundle.requiredBefore, `Evidence bundle ${label} required-before list`, 1);
    requireArray(bundle.currentEvidence, `Evidence bundle ${label} current evidence`, 1);
    requireArray(bundle.acceptableEvidence, `Evidence bundle ${label} acceptable evidence`, 3);
    requireArray(bundle.missingEvidence, `Evidence bundle ${label} missing evidence`, 1);
    requireArray(bundle.verificationCommands, `Evidence bundle ${label} verification commands`, 1);
    requireArray(bundle.sourceFiles, `Evidence bundle ${label} source files`, 2);
    requireArray(bundle.doNotStore, `Evidence bundle ${label} do-not-store list`, 1);

    const combinedText = JSON.stringify(bundle);
    if (looksSecretLike(combinedText)) fail(`Evidence bundle ${label} appears to contain secret-like material.`);
    else pass(`Evidence bundle ${label} does not contain obvious secret-like material.`);

    for (const linkedBlocker of bundle.linkedBlockers || []) {
      if (blockerIds.has(linkedBlocker)) {
        pass(`Evidence bundle ${label} links existing blocker: ${linkedBlocker}.`);
        coveredBlockers.add(linkedBlocker);
      } else {
        fail(`Evidence bundle ${label} links unknown blocker: ${linkedBlocker}.`);
      }
    }

    for (const command of bundle.verificationCommands || []) {
      const script = commandScriptName(command);
      if (!script) {
        pass(`Evidence bundle ${label} includes manual or external verification: ${command}.`);
        continue;
      }
      if (packageScripts[script]) pass(`Evidence bundle ${label} command exists: npm run ${script}.`);
      else fail(`Evidence bundle ${label} references missing npm script: npm run ${script}.`);
    }

    for (const sourceFile of bundle.sourceFiles || []) {
      if (await fileExists(sourceFile)) pass(`Evidence bundle ${label} source exists: ${sourceFile}.`);
      else fail(`Evidence bundle ${label} source file is missing: ${sourceFile}.`);
    }
  }

  for (const blockerId of blockerIds) {
    if (coveredBlockers.has(blockerId)) pass(`Release evidence covers blocker: ${blockerId}.`);
    else fail(`Release evidence does not cover blocker: ${blockerId}.`);
  }

  requireArray(register.closeoutSequence, "Release evidence closeout sequence", 5);
  requireArray(register.verificationCommands, "Release evidence top-level verification commands", 8);
  for (const command of register.verificationCommands || []) {
    const script = commandScriptName(command);
    if (!script) continue;
    if (packageScripts[script]) pass(`Release evidence top-level command exists: npm run ${script}.`);
    else fail(`Release evidence top-level command references missing npm script: npm run ${script}.`);
  }

  for (const evidenceFile of register.evidenceFiles || []) {
    if (await fileExists(evidenceFile)) pass(`Release evidence file exists: ${evidenceFile}.`);
    else fail(`Release evidence file is missing: ${evidenceFile}.`);
  }
}

const releaseEvidence = submission?.releaseEvidence || {};
if (releaseEvidence.status === "evidence-slots-ready-waiting-production-owner-artifacts") {
  pass("Submission readiness tracks release evidence status.");
} else {
  fail("Submission readiness should track releaseEvidence.status as evidence-slots-ready-waiting-production-owner-artifacts.");
}
requireIncludes(releaseEvidence.registerFile, "store/release-evidence-register.json", "Submission readiness links release evidence register.");
requireIncludes(releaseEvidence.runbook, "00_docs/RELEASE_EVIDENCE_REGISTER_2026-06-10.md", "Submission readiness links release evidence runbook.");
requireIncludes(releaseEvidence.checkScript, "scripts/check-release-evidence-register.mjs", "Submission readiness links release evidence check script.");
requireArray(releaseEvidence.coverage, "Submission readiness release evidence coverage", 5);

if ((operatorInputs?.closeoutCommands || []).includes("npm run release:evidence")) {
  pass("Operator input closeout includes npm run release:evidence.");
} else {
  fail("Operator input closeout should include npm run release:evidence.");
}

if (docText) {
  for (const marker of [
    "发布证据登记表",
    "store/release-evidence-register.json",
    "store/evidence/",
    "npm run release:evidence",
    "不要放进仓库",
    "关闭 blocker"
  ]) {
    requireIncludes(docText, marker, `Release evidence runbook includes ${marker}`);
  }
} else {
  fail("Release evidence runbook is missing: 00_docs/RELEASE_EVIDENCE_REGISTER_2026-06-10.md.");
}

if (evidenceReadme) {
  for (const marker of ["Release Evidence Folder", "Allowed examples", "Do not store", "Passwords", "keystores"]) {
    requireIncludes(evidenceReadme, marker, `Evidence folder README includes ${marker}`);
  }
} else {
  fail("store/evidence/README.md is missing.");
}

if (!packageScripts["release:evidence"]) fail("package.json should define npm run release:evidence.");

console.log("Release evidence register check");
console.log(`Passes: ${passes.length}`);
console.log(`Failures: ${failures.length}`);
console.log(`Warnings: ${warnings.length}`);

if (warnings.length) {
  console.log("\nWarnings");
  for (const message of warnings) console.log(`- ${message}`);
}

if (failures.length) {
  console.error("\nFailures");
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}
