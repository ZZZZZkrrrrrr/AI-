import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const assetsDir = path.join(distDir, "assets");
const entryPattern = /^index-[\w-]+\.js$/;

function formatKib(bytes) {
  return `${(bytes / 1024).toFixed(2)}KiB`;
}

async function collectFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolute, relative));
    } else {
      files.push({ absolute, relative: relative.replaceAll(path.sep, "/") });
    }
  }
  return files;
}

const files = [
  ...(await collectFiles(assetsDir, "assets")),
  { absolute: path.join(distDir, "index.html"), relative: "index.html" }
];

const rows = await Promise.all(files.map(async (file) => {
  const [info, content] = await Promise.all([stat(file.absolute), readFile(file.absolute)]);
  const ext = path.extname(file.relative).slice(1) || "file";
  return {
    file: file.relative,
    type: ext,
    bytes: info.size,
    gzipBytes: gzipSync(content).length,
    entry: entryPattern.test(path.basename(file.relative))
  };
}));

rows.sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));

console.log("Bundle size report");
console.log("File".padEnd(44), "Type".padEnd(8), "Size".padStart(12), "Gzip".padStart(12), "Entry");
console.log("-".repeat(86));

for (const row of rows) {
  console.log(
    row.file.padEnd(44),
    row.type.padEnd(8),
    formatKib(row.bytes).padStart(12),
    formatKib(row.gzipBytes).padStart(12),
    row.entry ? "yes" : ""
  );
}

const totals = rows.reduce(
  (total, row) => {
    total.bytes += row.bytes;
    total.gzipBytes += row.gzipBytes;
    return total;
  },
  { bytes: 0, gzipBytes: 0 }
);

console.log("-".repeat(86));
console.log(
  "Total".padEnd(53),
  formatKib(totals.bytes).padStart(12),
  formatKib(totals.gzipBytes).padStart(12)
);
