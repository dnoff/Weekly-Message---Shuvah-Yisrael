import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const weeksDir = path.join(root, "weeks");
const templatePath = path.join(weeksDir, "_template.md");

function pad(n) {
  return String(n).padStart(2, "0");
}

function todayStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatWeekOf(d = new Date()) {
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function main() {
  if (!fs.existsSync(templatePath)) {
    console.error("Missing weeks/_template.md");
    process.exit(1);
  }

  const dateArg = process.argv[2];
  const date = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg)
    ? dateArg
    : todayStamp();

  const outPath = path.join(weeksDir, `${date}.md`);
  if (fs.existsSync(outPath)) {
    console.error(`Already exists: weeks/${date}.md`);
    console.error("Edit that file, or pass another date: npm run new -- 2026-07-18");
    process.exit(1);
  }

  const parsed = new Date(`${date}T12:00:00`);
  const weekOf = Number.isNaN(parsed.getTime())
    ? date
    : formatWeekOf(parsed);

  let body = fs.readFileSync(templatePath, "utf8");
  body = body
    .replace(/^title:.*$/m, "title: Weekly Message")
    .replace(/^date:.*$/m, `date: ${date}`)
    .replace(/^weekOf:.*$/m, `weekOf: ${weekOf}`);

  fs.writeFileSync(outPath, body, "utf8");
  console.log(`Created weeks/${date}.md`);
  console.log("1. Edit the file with this week's message & outline");
  console.log("2. Run: npm run build");
  console.log("3. Deploy dist/ (or push if Pages is configured)");
}

main();
