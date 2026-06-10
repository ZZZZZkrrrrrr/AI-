import { readFile } from "node:fs/promises";
import path from "node:path";

const appPath = path.resolve("src", "App.jsx");
const source = await readFile(appPath, "utf8");
const lines = source.split(/\r?\n/);
const functionPattern = /^(?:export\s+)?function\s+([A-Za-z0-9_]+)\s*\(/;
const pagePattern = /(Page|Panel|Drawer|Cards|Tabs|Guide|Shell|Center)$/;

const starts = [];
for (let index = 0; index < lines.length; index += 1) {
  const match = lines[index].match(functionPattern);
  if (match) starts.push({ name: match[1], start: index + 1 });
}

const functions = starts.map((item, index) => {
  const next = starts[index + 1]?.start || lines.length + 1;
  const lineCount = next - item.start;
  return {
    ...item,
    end: next - 1,
    lineCount,
    likelyComponent: pagePattern.test(item.name) || /^[A-Z]/.test(item.name)
  };
});

const largest = [...functions].sort((a, b) => b.lineCount - a.lineCount).slice(0, 20);
const extractionCandidates = largest.filter((item) => item.likelyComponent).slice(0, 10);

function printRows(title, rows) {
  console.log(title);
  console.log("Name".padEnd(34), "Lines".padStart(7), "Range".padStart(15), "Kind");
  console.log("-".repeat(70));
  rows.forEach((row) => {
    console.log(
      row.name.padEnd(34),
      String(row.lineCount).padStart(7),
      `${row.start}-${row.end}`.padStart(15),
      row.likelyComponent ? "component/page" : "helper"
    );
  });
  console.log("");
}

console.log(`App structure report: ${path.relative(process.cwd(), appPath)}`);
console.log(`Total lines: ${lines.length}`);
console.log(`Top-level functions: ${functions.length}`);
console.log("");

printRows("Largest top-level functions", largest);
printRows("Suggested extraction candidates", extractionCandidates);
