import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const weeksDir = path.join(root, "weeks");
const distDir = path.join(root, "dist");
const assetsDir = path.join(root, "assets");

function loadConfig() {
  const configPath = path.join(root, "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (!config.publicUrl || config.publicUrl.includes("YOUR-USERNAME")) {
    console.warn(
      "\n⚠  config.json publicUrl is still a placeholder.\n" +
        "   Set it to your live site URL before printing the QR.\n" +
        "   Example: https://yourname.github.io/QRCodeMaker/\n"
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
        html: marked.parse(body),
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
    <header class="top">
      <p class="brand">${escapeHtml(config.siteName)}</p>
      ${badge}
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">${escapeHtml(config.authorLabel)} · Week of ${escapeHtml(weekOf)}</p>
    </header>
    <article class="content">
      ${contentHtml}
    </article>
    ${navHtml}
  </main>
</body>
</html>`;
}

function homePage(config, weeks) {
  const css = readAsset("style.css");
  const items = weeks
    .map((w, i) => {
      const href = i === 0 ? "this-week/" : `weeks/${w.date}/`;
      const label = i === 0 ? "Current week" : "Archive";
      return `<li>
        <a href="${href}">
          <span class="week-label">${escapeHtml(label)}</span>
          <span class="week-title">${escapeHtml(w.title)}</span>
          <span class="week-date">${escapeHtml(w.weekOf)}</span>
        </a>
      </li>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(config.siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet" />
  <style>${css}</style>
</head>
<body>
  <div class="bg" aria-hidden="true"></div>
  <main class="sheet">
    <header class="top">
      <p class="brand">${escapeHtml(config.siteName)}</p>
      <h1>${escapeHtml(config.subtitle)}</h1>
      <p class="meta">Scan the printed QR for this week's page, or browse below.</p>
    </header>
    <ul class="week-list">
      ${items || "<li><p>No weeks yet. Run <code>npm run new</code>.</p></li>"}
    </ul>
  </main>
</body>
</html>`;
}

async function writeQr(config) {
  const qrDir = path.join(distDir, "qr");
  ensureDir(qrDir);
  const targetUrl = `${config.publicUrl}this-week/`;
  const opts = {
    errorCorrectionLevel: "M",
    margin: config.qr?.margin ?? 2,
    width: config.qr?.width ?? 512,
    color: {
      dark: config.qr?.dark ?? "#1a2332",
      light: config.qr?.light ?? "#ffffff",
    },
  };

  const pngPath = path.join(qrDir, "this-week.png");
  const svgPath = path.join(qrDir, "this-week.svg");
  await QRCode.toFile(pngPath, targetUrl, opts);
  const svg = await QRCode.toString(targetUrl, { ...opts, type: "svg" });
  fs.writeFileSync(svgPath, svg, "utf8");

  const readme = `Print this-week.png (or .svg).

This QR always opens:
${targetUrl}

Update the site each week with npm run build + deploy.
You do NOT need to reprint the QR unless publicUrl changes.
`;
  fs.writeFileSync(path.join(qrDir, "README.txt"), readme, "utf8");
  return targetUrl;
}

async function build() {
  const config = loadConfig();
  const weeks = listWeeks();

  if (weeks.length === 0) {
    console.error("No week files in weeks/. Run: npm run new");
    process.exit(1);
  }

  fs.rmSync(distDir, { recursive: true, force: true });
  ensureDir(distDir);
  ensureDir(path.join(distDir, "this-week"));
  ensureDir(path.join(distDir, "weeks"));

  const latest = weeks[0];

  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    const isLatest = i === 0;
    const navHtml = `<nav class="nav">
      <a href="${isLatest ? "../" : "../../"}">All weeks</a>
      ${isLatest ? "" : `<a href="../../this-week/">This week</a>`}
    </nav>`;

    const html = pageShell({
      config,
      title: week.title,
      weekOf: week.weekOf,
      contentHtml: week.html,
      navHtml,
      isLatest,
    });

    const weekDir = path.join(distDir, "weeks", week.date);
    ensureDir(weekDir);
    fs.writeFileSync(path.join(weekDir, "index.html"), html, "utf8");

    if (isLatest) {
      const latestNav = `<nav class="nav">
        <a href="../">All weeks</a>
      </nav>`;
      const latestHtml = pageShell({
        config,
        title: week.title,
        weekOf: week.weekOf,
        contentHtml: week.html,
        navHtml: latestNav,
        isLatest: true,
      });
      fs.writeFileSync(
        path.join(distDir, "this-week", "index.html"),
        latestHtml,
        "utf8"
      );
    }
  }

  fs.writeFileSync(
    path.join(distDir, "index.html"),
    homePage(config, weeks),
    "utf8"
  );

  const qrUrl = await writeQr(config);

  console.log(`Built ${weeks.length} week(s). Latest: ${latest.date} — ${latest.title}`);
  console.log(`QR target: ${qrUrl}`);
  console.log(`Print:     dist/qr/this-week.png`);
  console.log(`Preview:   npm run preview`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
