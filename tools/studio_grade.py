"""Give every Moli Brow photo one consistent 'studio' look.

Usage: python3 tools/studio_grade.py      (reads originals from repo root, writes studio/img)
Per image: neutral white-balance (skin-aware), exposure match, tame red/orange cast,
soft matte tone curve in the brand palette, gentle softness + unified fine grain,
then a fixed crop/aspect so the gallery reads as one shoot.
Originals are never modified.
"""
import numpy as np
from PIL import Image, ImageFilter, ImageOps
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'studio', 'img')
os.makedirs(OUT, exist_ok=True)

# name -> (source, aspect w/h, focus (fx,fy) 0..1, max long edge, kind)
JOBS = {
 'hero':        ('ed-bryn-e.jpg',          16/10, (.50,.50), 2000, 'skin'),
 'brow-1':      ('ed-bryn-a.jpg',          4/5,   (.55,.45), 1100, 'skin'),
 'lash-1':      ('ed-vipper-a.jpg',        4/5,   (.50,.50), 1100, 'skin'),
 'lash-3':      ('timma-studio-06.jpg',    4/5,   (.45,.40), 1100, 'skin'),
 'process-1':   ('ed-prosess-a.jpg',       4/5,   (.45,.45), 1000, 'skin'),
 'process-2':   ('ed-prosess-b.jpg',       4/5,   (.50,.50), 900,  'skin'),
 'room-1':      ('ed-studio-c.jpg',        4/5,   (.55,.55), 900,  'room'),
 'room-2':      ('ed-studio-a.jpg',        4/5,   (.50,.55), 900,  'room'),
 'lina':        ('ed-studio-b.jpg',        4/5,   (.50,.45), 900,  'room'),
 'client-1':    ('ed-bryn-b.jpg',          4/5,   (.50,.40), 900,  'skin'),
}

# brand palette
LO  = np.array([0x1E,0x14,0x13]) / 255.0   # ink  -> deepest shadow (lifted slightly below)
MID = np.array([0xA6,0x7A,0x6B]) / 255.0   # latte
HI  = np.array([0xFC,0xF9,0xF6]) / 255.0   # milk -> brightest highlight

def crop(im, aspect, focus):
    w, h = im.size
    if w/h > aspect:
        nw = int(h*aspect); x = int(np.clip(focus[0]*w - nw/2, 0, w-nw)); return im.crop((x,0,x+nw,h))
    nh = int(w/aspect); y = int(np.clip(focus[1]*h - nh/2, 0, h-nh)); return im.crop((0,y,w,y+nh))

def grade(im, kind):
    a = np.asarray(im.convert('RGB'), np.float32) / 255.0
    h, w, _ = a.shape
    # 1. white balance: pull channel means toward gray-world, partial strength (keeps skin warm)
    m = a[int(h*.1):int(h*.9), int(w*.1):int(w*.9)].reshape(-1,3).mean(0)
    target = m.mean() * (np.array([1.14,1.0,0.90]) if kind=='skin' else np.array([1.06,1.0,0.94]))
    gain = np.clip(target / np.maximum(m,1e-4), .75, 1.35)
    gain = gain ** (0.85 if kind=='skin' else 0.6)
    a = np.clip(a * gain, 0, 1)
    # 2. exposure match (studio-bright, even)
    lum = (a @ [.2126,.7152,.0722])
    p50 = np.percentile(lum, 50)
    tgt = .60 if kind=='skin' else .62
    gamma = np.log(tgt) / np.log(np.clip(p50, .05, .95))
    a = np.clip(a, 0, 1) ** np.clip(gamma, .6, 1.5)
    # 3. tame over-red / orange saturation (phone skin cast), keep a gentle warm glow
    lum = (a @ [.2126,.7152,.0722])[...,None]
    sat = .86 if kind=='skin' else .92
    a = np.clip(lum + (a - lum)*sat, 0, 1)
    r_over = np.clip(a[...,0] - a[...,1]*1.0 - .02, 0, 1)[...,None]   # excess red
    a[...,0:1] -= r_over * 0.18
    # 4. soft S-curve for gentle contrast
    a = np.clip(a, 0, 1)
    a = a + .18*(a - a*a)*(2*a - 1)*-1*-1  # mild contrast
    a = np.clip(a, 0, 1)
    # 5. matte + brand split tone: shadows -> warm cocoa, highlights -> milk
    lum = (a @ [.2126,.7152,.0722])[...,None]
    floor = LO*.55 + .05
    ceil  = HI
    a = floor + a*(ceil-floor)
    tone = np.where(lum<.5, LO, HI)
    k = np.abs(lum-.5)*2
    a = a*(1-.06*k) + tone*(.06*k)
    return np.clip(a,0,1)

def finish(a, long_edge):
    im = Image.fromarray((a*255+.5).astype(np.uint8))
    w,h = im.size; s = min(1, long_edge/max(w,h))
    if s<1: im = im.resize((int(w*s),int(h*s)), Image.LANCZOS)
    # whisper of softness then re-sharpen detail: smooth skin, crisp lashes
    soft = im.filter(ImageFilter.GaussianBlur(1.1))
    im = Image.blend(im, soft, .18).filter(ImageFilter.UnsharpMask(1.2, 60, 3))
    # unified fine grain
    a2 = np.asarray(im, np.float32)
    rng = np.random.default_rng(7)
    a2 += rng.normal(0, 1.6, a2.shape[:2])[...,None]
    return Image.fromarray(np.clip(a2,0,255).astype(np.uint8))

def main(only=None):
    for name,(src,aspect,focus,edge,kind) in JOBS.items():
        if only and name not in only: continue
        im = ImageOps.exif_transpose(Image.open(os.path.join(ROOT,src)).convert('RGB'))
        im = crop(im, aspect, focus)
        out = finish(grade(im, kind), edge)
        out.save(os.path.join(OUT,name+'.jpg'), quality=88, optimize=True, progressive=True)
        out.save(os.path.join(OUT,name+'.webp'), quality=82, method=6)
        print(name, out.size)

if __name__ == '__main__':
    main(sys.argv[1:] or None)
