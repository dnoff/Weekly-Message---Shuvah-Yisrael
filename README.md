# Weekly Message — Shuvah Yisrael

A clean webpage for the weekly message and outline. One printed QR code always opens the current week.

## Each week

```powershell
npm run new
# Edit the new file in the weeks folder
npm run build
git add .
git commit -m "Update weekly message"
git push
```

`npm run build` updates the website **and** the 1920×1080 slide in one step.

Then wait about a minute and refresh the website.

## Print / display

| File | Use |
|------|-----|
| `docs/qr/weekly.png` | QR only |
| `docs/qr/weekly-slide.png` | 1920×1080 slide with QR (for screens / PowerPoint) |

## First-time GitHub Pages setup

1. Repo **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main`
4. **Folder:** `/docs`
5. Save
