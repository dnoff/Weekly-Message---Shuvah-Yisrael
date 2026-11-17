import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import QRCode from "qrcode";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcDir = path.join(root, "simcha-west");
const outDir = path.join(root, "docs", "simcha-west");
const docsDir = path.join(root, "docs");

function loadConfig() {
  const config = JSON.parse(
    fs.readFileSync(path.join(srcDir, "config.json"), "utf8")
  );
  config.publicUrl = config.publicUrl.replace(/\/?$/, "/");
  return config;
}

function parseFrontMatter(raw) {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: raw };
  const fm = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\s+/, "");
  const meta = {};
  for (const line of fm.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) meta[m[1]] = m[2].trim();
  }
  return { meta, body };
}

function markOutlineHeadings(html) {
  const sections = [];
  let markedHtml = html
    .replace(/<h3>([IVXLCDM]+)\.\s+([\s\S]*?)<\/h3>/g, (_m, numeral, rest) => {
      const id = `outline-${numeral.toLowerCase()}`;
      sections.push({ numeral, id, title: rest });
      return `<h3 id="${id}" class="outline-point"><span class="outline-marker">${numeral}</span><span>${rest}</span></h3>`;
    })
    .replace(
      /<h4>([A-Z])\.\s+([\s\S]*?)<\/h4>/g,
      (_m, letter, rest) =>
        `<h4 class="outline-sub"><span class="outline-letter">${letter}</span><span>${rest}</span></h4>`
    )
    .replace(
      /<h5>(\d+)\.\s+([\s\S]*?)<\/h5>/g,
      (_m, num, rest) =>
        `<h5 class="outline-num"><span class="outline-numeral">${num}</span><span>${rest}</span></h5>`
    );

  if (sections.length === 0) return markedHtml;

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
  return markedHtml.replace(/<h3 id="outline-/, `${legend}<h3 id="outline-`);
}

function listSessions() {
  const dir = path.join(srcDir, "sessions");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const { meta, body } = parseFrontMatter(raw);
      return {
        slug: meta.slug,
        date: meta.date,
        title: meta.title,
        when: meta.when,
        blurb: meta.blurb || "",
        deck: meta.deck || "",
        deckLabel: meta.deckLabel || "Download presentation",
        outlineFile: meta.outlineFile || "",
        outlineLabel: meta.outlineLabel || "Download outline",
        html: markOutlineHeadings(marked.parse(body)),
      };
    })
    .filter((s) => s.slug)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readCss() {
  return fs.readFileSync(path.join(srcDir, "style.css"), "utf8");
}

function navHtml(sessions, currentSlug) {
  const links = [
    `<a href="${currentSlug ? "../" : "./"}"${currentSlug ? "" : ' class="nav-current"'}>Conference</a>`,
    ...sessions.map((s) => {
      const href = currentSlug ? (s.slug === currentSlug ? "./" : `../${s.slug}/`) : `${s.slug}/`;
      const current = s.slug === currentSlug ? ' class="nav-current"' : "";
      const label = new Date(`${s.date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      return `<a href="${href}"${current}>${label}</a>`;
    }),
  ];
  return `<nav class="nav">${links.join("\n")}</nav>`;
}

function downloadLinks(session, prefix) {
  const links = [];
  if (session.deck) {
    links.push(
      `<a href="${prefix}downloads/${encodeURIComponent(session.deck)}">${escapeHtml(session.deckLabel)}</a>`
    );
  }
  if (session.outlineFile) {
    links.push(
      `<a href="${prefix}downloads/${encodeURIComponent(session.outlineFile)}">${escapeHtml(session.outlineLabel)}</a>`
    );
  }
  if (links.length === 0) return "";
  return `<div class="downloads">${links.join("")}</div>`;
}

function footerHtml(config) {
  return `<footer class="foot">
    <p>${escapeHtml(config.place)} · ${escapeHtml(config.dates)}</p>
    <p>${escapeHtml(config.schedule)}</p>
    <p>Questions: ${escapeHtml(config.contactName)} · <a href="tel:+18185216700">${escapeHtml(config.contactPhone)}</a> · <a href="mailto:${escapeHtml(config.contactEmail)}">${escapeHtml(config.contactEmail)}</a></p>
    <p><a href="${escapeHtml(config.registerUrl)}">Conference details</a></p>
  </footer>`;
}

function pageShell({ config, title, bodyHtml }) {
  const css = readCss();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · ${escapeHtml(config.siteName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Cormorant+SC:wght@500&family=Great+Vibes&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet" />
  <style>${css}</style>
</head>
<body>
  <div class="bg" aria-hidden="true"></div>
  <main class="sheet">
    ${bodyHtml}
  </main>
</body>
</html>`;
}

function homeHtml(config, sessions) {
  const cards = sessions
    .map(
      (s) => `<li>
      <a href="${s.slug}/">
        <span class="session-when">${escapeHtml(s.when)}</span>
        <span class="session-title">${escapeHtml(s.title)}</span>
        <span class="session-blurb">${escapeHtml(s.blurb)}</span>
      </a>
    </li>`
    )
    .join("\n");

  const files = sessions
    .map(
      (s) => `<p class="session-when">${escapeHtml(s.title)}</p>
    ${downloadLinks(s, "")}`
    )
    .join("");

  const body = `
    ${navHtml(sessions, null)}
    <header class="top">
      <div class="brand-lockup">
        <p class="brand-script">Simcha</p>
        <p class="brand-west" aria-label="West"><span aria-hidden="true">west</span></p>
      </div>
      <p class="badge">${escapeHtml(config.tagline)}</p>
      <h1>Session outlines</h1>
      <p class="meta">${escapeHtml(config.speaker)} · ${escapeHtml(config.host)}</p>
      <p class="lede">${escapeHtml(config.dates)} · ${escapeHtml(config.place)}</p>
    </header>
    <blockquote class="quote">
      <p>“${escapeHtml(config.quote)}”</p>
      <cite>${escapeHtml(config.quoteRef)}</cite>
    </blockquote>
    <div class="facts">
      <div class="fact"><span>When</span><strong>${escapeHtml(config.dates)}</strong></div>
      <div class="fact"><span>Where</span><strong>${escapeHtml(config.place)}</strong></div>
    </div>
    <p class="section-label">Messages</p>
    <ul class="session-list">${cards}</ul>
    <p class="section-label">Downloads</p>
    ${files}
    ${footerHtml(config)}
  `;
  return pageShell({ config, title: "Session outlines", bodyHtml: body });
}

function sessionHtml(config, sessions, session) {
  const body = `
    ${navHtml(sessions, session.slug)}
    <header class="top">
      <div class="brand-lockup">
        <p class="brand-script">Simcha</p>
        <p class="brand-west" aria-label="West"><span aria-hidden="true">west</span></p>
      </div>
      <p class="badge">${escapeHtml(session.when)}</p>
      <h1>${escapeHtml(session.title)}</h1>
      <p class="meta">${escapeHtml(config.speaker)} · ${escapeHtml(config.place)}</p>
    </header>
    ${downloadLinks(session, "../")}
    <article class="content">
      ${session.html}
    </article>
    ${footerHtml(config)}
  `;
  return pageShell({ config, title: session.title, bodyHtml: body });
}

async function writeQr(config) {
  const qrDir = path.join(docsDir, "qr");
  fs.mkdirSync(qrDir, { recursive: true });
  const opts = {
    errorCorrectionLevel: "H",
    margin: config.qr?.margin ?? 2,
    width: config.qr?.width ?? 512,
    color: {
      dark: config.qr?.dark ?? "#0c2340",
      light: config.qr?.light ?? "#ffffff",
    },
  };
  const pngPath = path.join(qrDir, "simcha-west.png");
  await QRCode.toFile(pngPath, config.publicUrl, opts);
  const svg = await QRCode.toString(config.publicUrl, { ...opts, type: "svg" });
  fs.writeFileSync(path.join(qrDir, "simcha-west.svg"), svg, "utf8");
  fs.writeFileSync(
    path.join(qrDir, "simcha-west.txt"),
    `Print simcha-west.png\n\nThis QR opens the Simcha West conference site:\n${config.publicUrl}\n\nIt is separate from the weekly Shuvah Yisrael QR (weekly.png).\n`,
    "utf8"
  );
  return pngPath;
}

export async function buildSimcha() {
  const config = loadConfig();
  const sessions = listSessions();
  if (sessions.length === 0) {
    throw new Error("No session files in simcha-west/sessions/");
  }

  fs.mkdirSync(docsDir, { recursive: true });
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, "index.html"), homeHtml(config, sessions), "utf8");

  for (const session of sessions) {
    const dir = path.join(outDir, session.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.html"),
      sessionHtml(config, sessions, session),
      "utf8"
    );
  }

  const downloadsSrc = path.join(srcDir, "downloads");
  const downloadsDest = path.join(outDir, "downloads");
  fs.mkdirSync(downloadsDest, { recursive: true });
  for (const name of fs.readdirSync(downloadsSrc)) {
    if (name.startsWith(".")) continue;
    fs.copyFileSync(path.join(downloadsSrc, name), path.join(downloadsDest, name));
  }

  await writeQr(config);

  execFileSync("python", [path.join(__dirname, "make_simcha_slide.py")], {
    cwd: root,
    stdio: "inherit",
  });

  console.log(`Simcha West: ${sessions.length} session(s)`);
  console.log(`Site:      docs/simcha-west/index.html`);
  console.log(`QR target: ${config.publicUrl}`);
  console.log(`Print:     docs/qr/simcha-west.png`);
  console.log(`Slide:     docs/qr/simcha-west-slide.png`);
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  buildSimcha().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
