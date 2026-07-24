"""Compose a 1920x1080 promo slide with the real (scannable) QR code.

Reads the newest file in weeks/ so the slide updates itself each week.
"""
import json
import os
import re
import glob
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QR_PATH = os.path.join(ROOT, "docs", "qr", "weekly.png")
OUT_PATH = os.path.join(ROOT, "docs", "qr", "weekly-slide.png")

with open(os.path.join(ROOT, "config.json"), encoding="utf-8") as f:
    config = json.load(f)
URL = config["publicUrl"]


def latest_week():
    files = [
        f for f in glob.glob(os.path.join(ROOT, "weeks", "*.md"))
        if not os.path.basename(f).startswith("_")
    ]
    if not files:
        raise SystemExit("No week files found in weeks/")
    return max(files, key=lambda f: os.path.basename(f))


def parse_week(path):
    with open(path, encoding="utf-8") as f:
        raw = f.read()
    meta = {}
    if raw.startswith("---"):
        end = raw.find("\n---", 3)
        fm, body = raw[3:end], raw[end + 4:]
        for line in fm.strip().splitlines():
            m = re.match(r"(\w+):\s*(.*)", line)
            if m:
                meta[m.group(1)] = m.group(2).strip()
    else:
        body = raw
    title = meta.get("title", "Weekly Message")
    week_of = meta.get("weekOf", "")
    parashat = ""
    pm = re.search(r"\*\*(Parashat [^\*]+?)\*\*", body)
    if pm:
        parashat = pm.group(1).strip()
    return title, week_of, parashat


TITLE, WEEK_OF, PARASHAT = parse_week(latest_week())

# Date line: take the Gregorian part before any "·" separator
date_part = WEEK_OF.split("\u00b7")[0].strip() if WEEK_OF else ""
DATE_LINE = f"Saturday, {date_part}  \u00b7  10:00 AM (PDT)" if date_part else "Saturday  \u00b7  10:00 AM (PDT)"
PARASHAT = PARASHAT or "Shabbat Service"

W, H = 1920, 1080

# Palette (matches the website)
INK = (18, 33, 29)
DEEP = (15, 43, 37)
ACCENT = (95, 179, 158)
ACCENT_SOFT = (215, 235, 229)
CREAM = (244, 246, 244)
MUTED = (168, 190, 183)

FONT_DIR = r"C:\Windows\Fonts"
def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)

f_brand = font("seguisb.ttf", 30)
f_sub = font("segoeui.ttf", 30)
f_title = font("georgiab.ttf", 118)
f_detail = font("segoeui.ttf", 40)
f_detail_b = font("seguisb.ttf", 40)
f_cap = font("seguisb.ttf", 34)
f_url = font("segoeui.ttf", 26)
f_scan = font("georgiab.ttf", 46)

# --- Background: vertical deep-teal gradient ---
bg = Image.new("RGB", (W, H), DEEP)
top = (16, 38, 33)
bot = (9, 26, 22)
px = bg.load()
for y in range(H):
    t = y / (H - 1)
    r = int(top[0] + (bot[0] - top[0]) * t)
    g = int(top[1] + (bot[1] - top[1]) * t)
    b = int(top[2] + (bot[2] - top[2]) * t)
    for x in range(W):
        px[x, y] = (r, g, b)

# Soft radial glow top-left
glow = Image.new("L", (W, H), 0)
gd = ImageDraw.Draw(glow)
gd.ellipse([-500, -600, 900, 700], fill=70)
glow = glow.filter(__import__("PIL.ImageFilter", fromlist=["GaussianBlur"]).GaussianBlur(260))
tint = Image.new("RGB", (W, H), (26, 74, 63))
bg = Image.composite(tint, bg, glow)

draw = ImageDraw.Draw(bg)

def spaced(draw, xy, text, fnt, fill, spacing):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        w = draw.textlength(ch, font=fnt)
        x += w + spacing
    return x

MARGIN = 130

# Accent rule + brand
draw.line([(MARGIN, 150), (MARGIN + 70, 150)], fill=ACCENT, width=4)
spaced(draw, (MARGIN + 90, 133), "SHUVAH YISRAEL", f_brand, ACCENT, 6)
draw.text((MARGIN, 185), "Messianic Jewish Congregation", font=f_sub, fill=MUTED)

# Title: split on the em dash into two lines when present, else word-wrap.
def title_lines(text):
    if "\u2014" in text:
        return [p.strip() for p in text.split("\u2014", 1)]
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if len(trial) > 18 and cur:
            lines.append(cur)
            cur = w
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines[:3]

lines = title_lines(TITLE)
max_w = 960
t_size = 118
while t_size > 66:
    f_try = font("georgiab.ttf", t_size)
    if all(draw.textlength(ln, font=f_try) <= max_w for ln in lines):
        break
    t_size -= 4
f_title = font("georgiab.ttf", t_size)
line_h = int(t_size * 1.08)
block_h = line_h * len(lines)
ty = 300 + max(0, (250 - block_h) // 2)
for ln in lines:
    draw.text((MARGIN, ty), ln, font=f_title, fill=CREAM)
    ty += line_h

# Divider
draw.line([(MARGIN, 610), (MARGIN + 620, 610)], fill=(60, 90, 82), width=2)

# Details
dy = 665
draw.text((MARGIN, dy), "Shabbat Service", font=f_detail_b, fill=CREAM)
draw.text((MARGIN, dy + 62), DATE_LINE, font=f_detail, fill=MUTED)
draw.text((MARGIN, dy + 140), PARASHAT, font=f_detail_b, fill=CREAM)
draw.text((MARGIN, dy + 202), "Message by Rabbi Larry Feldman", font=f_detail, fill=MUTED)

# --- QR card (right side) ---
card_w, card_h = 620, 760
card_x = W - card_w - 150
card_y = (H - card_h) // 2
draw.rounded_rectangle(
    [card_x, card_y, card_x + card_w, card_y + card_h],
    radius=40, fill=CREAM,
)

# "Scan" heading on card
scan_text = "Scan to read this"
sw = draw.textlength(scan_text, font=f_scan)
draw.text((card_x + (card_w - sw) / 2, card_y + 52), scan_text, font=f_scan, fill=INK)
scan2 = "week's message & outline"
sw2 = draw.textlength(scan2, font=f_scan)
draw.text((card_x + (card_w - sw2) / 2, card_y + 108), scan2, font=f_scan, fill=INK)

# QR image (kept crisp with NEAREST)
qr = Image.open(QR_PATH).convert("RGB")
qr_size = 460
qr = qr.resize((qr_size, qr_size), Image.NEAREST)
qr_x = card_x + (card_w - qr_size) // 2
qr_y = card_y + 200
bg.paste(qr, (qr_x, qr_y))

# URL under QR
url_disp = URL.replace("https://", "").rstrip("/")
uw = draw.textlength(url_disp, font=f_url)
draw.text((card_x + (card_w - uw) / 2, qr_y + qr_size + 34), url_disp, font=f_url, fill=(90, 110, 103))

bg.save(OUT_PATH, "PNG")
print("Saved", OUT_PATH, bg.size)
