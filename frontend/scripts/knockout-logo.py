import math
from pathlib import Path
from PIL import Image

path = Path(__file__).resolve().parents[1] / "public" / "assets" / "marics-logo.png"
im = Image.open(path).convert("RGBA")
px = im.load()
width, height = im.size
bg = (29, 33, 32)

for y in range(height):
    for x in range(width):
        r, g, b, _a = px[x, y]
        dist = math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2)
        chroma = max(r, g, b) - min(r, g, b)
        luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
        if dist < 14 and chroma < 16 and luma < 52:
            px[x, y] = (r, g, b, 0)
        elif dist < 30 and chroma < 24 and luma < 58:
            alpha = int(max(0, min(255, 255 * (dist - 14) / 16)))
            px[x, y] = (r, g, b, alpha)

bbox = im.getbbox()
if bbox:
    pad = 8
    im = im.crop((
        max(0, bbox[0] - pad),
        max(0, bbox[1] - pad),
        min(width, bbox[2] + pad),
        min(height, bbox[3] + pad),
    ))

im.save(path, "PNG")
print("saved", im.size, "bbox", bbox)
