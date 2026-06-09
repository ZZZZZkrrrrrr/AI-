import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const distAssetsDir = path.resolve("dist", "assets");
const entryPattern = /^index-[\w-]+\.js$/;
const maxEntryBytes = 500 * 1024;
const warnEntryBytes = 485 * 1024;

function formatKib(bytes) {
  return `${(bytes / 1024).toFixed(2)}KiB`;
}

const files = await readdir(distAssetsDir);
const entryFiles = files.filter((file) => entryPattern.test(file));

if (!entryFiles.length) {
  console.error("Bundle budget check failed: no entry JS chunk found in dist/assets.");
  process.exit(1);
}

let failed = false;

for (const file of entryFiles) {
  const filePath = path.join(distAssetsDir, file);
  const info = await stat(filePath);
  const size = info.size;
  const label = `${file} ${formatKib(size)} / ${formatKib(maxEntryBytes)}`;
  if (size > maxEntryBytes) {
    console.error(`Bundle budget exceeded: ${label}`);
    failed = true;
  } else if (size > warnEntryBytes) {
    console.warn(`Bundle budget warning: ${label}`);
  } else {
    console.log(`Bundle budget ok: ${label}`);
  }
}

if (failed) process.exit(1);
