"""1920x1080 slide for the Simcha West conference QR."""
import json
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QR_PATH = os.path.join(ROOT, "docs", "qr", "simcha-west.png")
OUT_PATH = os.path.join(ROOT, "docs", "qr", "simcha-west-slide.png")

with open(os.path.join(ROOT, "simcha-west", "config.json"), encoding="utf-8") as f:
    config = json.load(f)

W, H = 1920, 1080
NAVY = (12, 35, 64)
NAVY_MID = (18, 48, 86)
GOLD = (196, 163, 90)
CREAM = (251, 249, 245)
MUTED = (186, 198, 214)
INK = (12, 35, 64)

FONT_DIR = r"C:\Windows\Fonts"

def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), size)

f_script = font("segoesc.ttf", 118)
f_west = font("seguisb.ttf", 28)
f_kicker = font("seguisb.ttf", 28)
f_line = font("georgiab.ttf", 42)
f_sub = font("segoeui.ttf", 32)
f_scan = font("georgiab.ttf", 42)
f_url = font("segoeui.ttf", 22)

bg = Image.new("RGB", (W, H), NAVY)
px = bg.load()
for y in range(H):
    t = y / (H - 1)
    r = int(NAVY_MID[0] + (NAVY[0] - NAVY_MID[0]) * t)
    g = int(NAVY_MID[1] + (NAVY[1] - NAVY_MID[1]) * t)
    b = int(NAVY_MID[2] + (NAVY[2] - NAVY_MID[2]) * t)
    for x in range(W):
        px[x, y] = (r, g, b)

glow = Image.new("L", (W, H), 0)
ImageDraw.Draw(glow).ellipse([-420, -520, 980, 760], fill=80)
glow = glow.filter(ImageFilter.GaussianBlur(240))
bg = Image.composite(Image.new("RGB", (W, H), (36, 72, 120)), bg, glow)
draw = ImageDraw.Draw(bg)

MARGIN = 120

def spaced(xy, text, fnt, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x

draw.text((MARGIN, 150), "Simcha", font=f_script, fill=CREAM)
west = "WEST"
west_x = MARGIN + 8
west_y = 290
spaced((west_x, west_y), west, f_west, GOLD, 14)
rule_end = west_x + draw.textlength(west, font=f_west) + 14 * 3 + 36
draw.line([(MARGIN, 345), (rule_end, 345)], fill=GOLD, width=3)

draw.text((MARGIN, 390), "SESSION OUTLINES", font=f_kicker, fill=GOLD)
draw.text((MARGIN, 470), "Saturday, November 21", font=f_line, fill=CREAM)
draw.text((MARGIN, 530), "God’s Mandate", font=f_sub, fill=MUTED)
draw.text((MARGIN, 620), "Sunday, November 22", font=f_line, fill=CREAM)
draw.text((MARGIN, 680), "Atonement from the Jewish Scriptures", font=f_sub, fill=MUTED)

draw.line([(MARGIN, 790), (MARGIN + 520, 790)], fill=(48, 74, 110), width=2)
draw.text((MARGIN, 830), "Rabbi Larry Feldman", font=f_line, fill=CREAM)
draw.text((MARGIN, 900), "Pine Summit  ·  Big Bear, CA", font=f_sub, fill=MUTED)
draw.text((MARGIN, 960), "November 20–22, 2026", font=f_sub, fill=MUTED)

card_w, card_h = 560, 820
card_x = W - card_w - 110
card_y = (H - card_h) // 2
draw.rounded_rectangle([card_x, card_y, card_x + card_w, card_y + card_h], radius=36, fill=CREAM)

scan = "Scan for the outlines"
sw = draw.textlength(scan, font=f_scan)
draw.text((card_x + (card_w - sw) / 2, card_y + 48), scan, font=f_scan, fill=INK)

qr = Image.open(QR_PATH).convert("RGB")
qr_size = 430
qr = qr.resize((qr_size, qr_size), Image.NEAREST)
qr_x = card_x + (card_w - qr_size) // 2
qr_y = card_y + 140
bg.paste(qr, (qr_x, qr_y))

url = config["publicUrl"].replace("https://", "").rstrip("/")
# Split the long project URL so it stays inside the card.
parts = url.split("/")
line_a = "/".join(parts[:2]) + "/"
line_b = "/".join(parts[2:])
for i, line in enumerate((line_a, line_b)):
    uw = draw.textlength(line, font=f_url)
    draw.text((card_x + (card_w - uw) / 2, qr_y + qr_size + 28 + i * 32), line, font=f_url, fill=(70, 84, 104))

bg.save(OUT_PATH, "PNG")
print("Saved", OUT_PATH, bg.size)
