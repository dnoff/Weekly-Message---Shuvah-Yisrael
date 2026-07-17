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

Then wait about a minute and refresh the website.

## Print the QR

After the site is live, print: `docs/qr/weekly.png`

## First-time GitHub Pages setup

1. Repo **Settings → Pages**
2. **Source:** Deploy from a branch
3. **Branch:** `main`
4. **Folder:** `/docs`
5. Save
