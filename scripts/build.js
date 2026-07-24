import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const weeksDir = path.join(root, "weeks");
const outDir = path.join(root, "docs");
const assetsDir = path.join(root, "assets");

function loadConfig() {
  const configPath = path.join(root, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!config.publicUrl || config.publicUrl.includes("YOUR-USERNAME")) {
    console.warn(
      "\n⚠  config.json publicUrl is still a placeholder.\n" +
        "   Set it to your live site URL before printing the QR.\n"
    );
  }
  config.publicUrl = config.publicUrl.replace(/\/?$/, "/");
  return config;
}

function parseFrontMatter(raw) {
  if (!raw.startsWith("---")) {
    return { meta: {}, body: raw };
  }
  const end = raw.indexOf("\n---", 3);
  if (end === -1) {
    return { meta: {}, body: raw };
  }
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\s+/, "");
  const meta = {};
  for (const line of fm.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return { meta, body };
}

// Roman-numeral headings become jump targets and generate a compact legend.
// Lettered headings get a smaller badge to preserve the outline hierarchy.
function markOutlineHeadings(html) {
  const sections = [];
  let markedHtml = html
    .replace(
      /<h3>([IVXLCDM]+)\.\s+([\s\S]*?)<\/h3>/g,
      (_m, numeral, rest) => {
        const id = `outline-${numeral.toLowerCase()}`;
        sections.push({ numeral, id, title: rest });
        return `<h3 id="${id}" class="outline-point"><span class="outline-marker">${numeral}</span><span>${rest}</span></h3>`;
      }
    )
    .replace(
      /<h4>([A-Z])\.\s+([\s\S]*?)<\/h4>/g,
      (_m, letter, rest) =>
        `<h4 class="outline-sub"><span class="outline-letter">${letter}</span><span>${rest}</span></h4>`
    );

  if (sections.length === 0) {
    return markedHtml;
  }

  const links = sections
    .map(
      ({ numeral, id, title }) =>
        `<a href="#${id}"><span>${numeral}</span>${title}</a>`
    )
    .join("");
  const legend = `<nav class="outline-legend" aria-label="Message outline">
    <p>Jump to a section</p>
    <div>${links}</div>
  </nav>`;

  return markedHtml.replace(
    /<h3 id="outline-/,
    `${legend}<h3 id="outline-`
  );
}

function listWeeks() {
  return fs
    .readdirSync(weeksDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(weeksDir, f), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      const date = meta.date || f.replace(/\.md$/, "");
      return {
        file: f,
        date,
        title: meta.title || "Weekly Message",
        weekOf: meta.weekOf || date,
        body,
        html: markOutlineHeadings(marked.parse(body)),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readAsset(name) {
  return fs.readFileSync(path.join(assetsDir, name), "utf8");
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pageShell({ config, title, weekOf, contentHtml, navHtml, isLatest }) {
  const css = readAsset("style.css");
  const badge = isLatest
    ? `<p class="badge">This week</p>`
    : `<p class="badge badge-archive">Archive</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · ${escapeHtml(config.siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet" />
  <style>${css}</style>
</head>
<body>
  <div class="bg" aria-hidden="true"></div>
  <main class="sheet">
    ${navHtml}
    <header class="top">
      <p class="brand">${escapeHtml(config.siteName)}</p>
      ${badge}
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">${escapeHtml(config.authorLabel)} · Week of ${escapeHtml(weekOf)}</p>
    </header>
    <article class="content">
      ${contentHtml}
    </article>
  </main>
</body>
</html>`;
}

async function writeQr(config) {
  const qrDir = path.join(outDir, "qr");
  ensureDir(qrDir);
  const targetUrl = config.publicUrl;
  const opts = {
    errorCorrectionLevel: "M",
    margin: config.qr?.margin ?? 2,
    width: config.qr?.width ?? 512,
    color: {
      dark: config.qr?.dark ?? "#1a2332",
      light: config.qr?.light ?? "#ffffff",
    },
  };

  await QRCode.toFile(path.join(qrDir, "weekly.png"), targetUrl, opts);
  const svg = await QRCode.toString(targetUrl, { ...opts, type: "svg" });
  fs.writeFileSync(path.join(qrDir, "weekly.svg"), svg, "utf8");
  fs.writeFileSync(
    path.join(qrDir, "README.txt"),
    `Print weekly.png\n\nThis QR opens:\n${targetUrl}\n\nUpdate the website each week — do not reprint the QR.\n`,
    "utf8"
  );
  return targetUrl;
}

async function build() {
  const config = loadConfig();
  const weeks = listWeeks();

  if (weeks.length === 0) {
    console.error("No week files in weeks/. Run: npm run new");
    process.exit(1);
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  ensureDir(outDir);
  ensureDir(path.join(outDir, "weeks"));
  fs.writeFileSync(path.join(outDir, ".nojekyll"), "", "utf8");

  const latest = weeks[0];

  // Homepage = this week's message (what people see when they scan)
  const homeHtml = pageShell({
    config,
    title: latest.title,
    weekOf: latest.weekOf,
    contentHtml: latest.html,
    navHtml: weeks.length > 1
      ? `<nav class="nav nav-top">
          <a href="./" class="nav-current">This week</a>
          <a href="weeks/">Past weeks</a>
        </nav>`
      : "",
    isLatest: true,
  });
  fs.writeFileSync(path.join(outDir, "index.html"), homeHtml, "utf8");

  // Archive pages
  for (const week of weeks) {
    const isLatest = week.date === latest.date;
    const html = pageShell({
      config,
      title: week.title,
      weekOf: week.weekOf,
      contentHtml: week.html,
      navHtml: `<nav class="nav nav-top">
        <a href="../">This week</a>
        <a href="./">Past weeks</a>
      </nav>`,
      isLatest,
    });
    const weekDir = path.join(outDir, "weeks", week.date);
    ensureDir(weekDir);
    fs.writeFileSync(path.join(weekDir, "index.html"), html, "utf8");
  }

  // Simple past-weeks list
  const archiveItems = weeks
    .map(
      (w) => `<li>
      <a href="${w.date}/">
        <span class="week-title">${escapeHtml(w.title)}</span>
        <span class="week-date">${escapeHtml(w.weekOf)}</span>
      </a>
    </li>`
    )
    .join("\n");

  const archiveHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Past weeks · ${escapeHtml(config.siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet" />
  <style>${readAsset("style.css")}</style>
</head>
<body>
  <div class="bg" aria-hidden="true"></div>
  <main class="sheet">
    <nav class="nav nav-top">
      <a href="../">This week</a>
      <a href="./" class="nav-current">Past weeks</a>
    </nav>
    <header class="top">
      <p class="brand">${escapeHtml(config.siteName)}</p>
      <h1>Past weeks</h1>
      <p class="meta">${escapeHtml(config.subtitle)}</p>
    </header>
    <ul class="week-list">${archiveItems}</ul>
  </main>
</body>
</html>`;
  fs.writeFileSync(path.join(outDir, "weeks", "index.html"), archiveHtml, "utf8");

  const qrUrl = await writeQr(config);

  console.log(`Built ${weeks.length} week(s). Latest: ${latest.date} — ${latest.title}`);
  console.log(`Site:      docs/index.html`);
  console.log(`QR target: ${qrUrl}`);
  console.log(`Print:     docs/qr/weekly.png`);
  console.log(`(Slide will be generated next…)`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
