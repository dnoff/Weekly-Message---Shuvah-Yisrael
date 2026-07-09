# Weekly Message QR

Print **one QR code**. Each week, update the message page it points to — no new QR needed.

## Why this approach

Putting the full weekly outline *inside* the QR makes a dense, hard-to-scan code and forces a new print every week. Instead:

1. The QR always opens a stable URL (e.g. `…/this-week/`).
2. You edit one Markdown file and run `npm run build`.
3. Publish the `dist/` folder (GitHub Pages, Netlify, etc.).
4. Phones that scan the same printed QR always see the current week.

## Weekly workflow

```bash
# First time only
npm install
# Edit config.json → set publicUrl to your live site URL

# Each week
npm run new          # creates weeks/YYYY-MM-DD.md from the template
# Edit that file with the message & outline
npm run build        # writes dist/ (page + QR images)
# Deploy dist/ (or push if GitHub Pages is set up)
```

Optional local preview:

```bash
npm run preview
```

Then open http://localhost:4173/this-week/

## What gets generated

| Output | Purpose |
|--------|---------|
| `dist/this-week/index.html` | Always the latest week (QR target) |
| `dist/weeks/YYYY-MM-DD/index.html` | Archive of that week |
| `dist/index.html` | Simple landing / archive list |
| `dist/qr/this-week.png` | **Print this** — points at `/this-week/` |
| `dist/qr/this-week.svg` | Same QR as SVG |

## Editing a week

Front matter at the top of each `weeks/*.md` file:

```markdown
---
title: Parashat Example
date: 2026-07-11
weekOf: July 11, 2026
---

Your message and outline in normal Markdown…
```

## Hosting (GitHub Pages)

1. Create a GitHub repo and push this project.
2. Set `publicUrl` in `config.json` to `https://YOUR-USERNAME.github.io/REPO-NAME/`.
3. In the repo: **Settings → Pages → Deploy from a branch** → choose `gh-pages`, or use the included GitHub Action.
4. Run `npm run build`, commit, and push (or let the Action build on push).
5. Print `dist/qr/this-week.png` once; reuse it every week after you publish updates.

## Print tip

Use the PNG at a few inches wide with quiet space around it. Laminate or put it on a flyer/bulletin so the same code works all year.
