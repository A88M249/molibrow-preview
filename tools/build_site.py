# -*- coding: utf-8 -*-
"""Build the multi-page Moli Brow Studio site into ./studio

    SITE_URL=https://your-domain.no python3 tools/build_site.py

Output: Norwegian pages at the site root, English pages under /en/, plus sitemap.xml, robots.txt, 404.html.
Copy lives in tools/site_content.py; the home page body in tools/templates/home_main.html.
"""
import os, re, json, html, datetime, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from site_content import *
from areas_content import *

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('OUT_DIR') or os.path.join(ROOT, 'studio')
SITE_URL = os.environ.get('SITE_URL', 'https://example.com').rstrip('/')
# Booking: 'timma' (live today) or 'spokes' (native booking page that talks to the Spokes public API)
PROVIDER = os.environ.get('BOOKING_PROVIDER', 'timma').lower()
SPOKES_API = os.environ.get('SPOKES_API', 'https://api.spokes.no').rstrip('/')
SPOKES_SLUG = os.environ.get('SPOKES_SLUG', '')          # the studio's workshop slug in Spokes
SPOKES_APP = os.environ.get('SPOKES_APP', 'https://app.spokesworkshop.com').rstrip('/')
TURNSTILE_SITEKEY = os.environ.get('TURNSTILE_SITEKEY', '')
TODAY = datetime.date.today().isoformat()
LANGS = ('no', 'en')
L = 0  # current language index (0 = no, 1 = en)
esc = lambda s: html.escape(s, quote=True)


def t(pair):
    return pair[L]


def slug_path(key, lang_i):
    slug = SLUGS[key][lang_i]
    if slug is None:
        return None
    prefix = 'en/' if lang_i == 1 else ''
    return prefix + (slug + '/' if slug else '')


def href(frm, to):
    depth = frm.count('/')
    return ('../' * depth + to) or './'


def url(path):
    return SITE_URL + '/' + path


def has_lang(key, lang_i):
    return SLUGS[key][lang_i] is not None


def bk(path):
    """href (+ target) for every 'book' call-to-action: Timma today, the native Spokes page when enabled."""
    if PROVIDER == 'spokes':
        return f'href="{href(path, slug_path("book", L))}"'
    return f'href="{BOOKING}" target="_blank" rel="noopener"'


def book_abs():
    return url(slug_path('book', L)) if PROVIDER == 'spokes' else BOOKING


def fmt_dur(m):
    return f'{m} min'


def dur_range(d):
    return fmt_dur(d[0]) if d[0] == d[1] else f'{d[0]}–{d[1]} min'


def img(P, name, alt, cls='', loading='lazy', fetch=False):
    w, h = Image.open(os.path.join(OUT, 'img', name + '.jpg')).size
    return (f'<picture><source srcset="{P}img/{name}.webp" type="image/webp">'
            f'<img src="{P}img/{name}.jpg" alt="{esc(alt)}" width="{w}" height="{h}"'
            f'{f" class={chr(34)}{cls}{chr(34)}" if cls else ""} loading="{"eager" if fetch else loading}"'
            f'{" fetchpriority=" + chr(34) + "high" + chr(34) if fetch else ""}></picture>')


# ───────────────────────── shared chrome
def head(path, key, title, desc, ld=None, noindex=False, og_img='img/hero.jpg'):
    P = '../' * path.count('/')
    canon = url(path)
    alts = ''
    if not noindex and has_lang(key, 1) and has_lang(key, 0):
        no_u, en_u = url(slug_path(key, 0)), url(slug_path(key, 1))
        alts = (f'<link rel="alternate" hreflang="nb" href="{no_u}"><link rel="alternate" hreflang="en" href="{en_u}">'
                f'<link rel="alternate" hreflang="x-default" href="{no_u}">')
    blocks = ''.join(f'<script type="application/ld+json">{json.dumps(b, ensure_ascii=False)}</script>' for b in (ld or []))
    return f'''<!doctype html>
<html lang="{'nb' if L == 0 else 'en'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
{'<meta name="robots" content="noindex">' if noindex else '<meta name="robots" content="index,follow,max-image-preview:large">'}
{'' if noindex else f'<link rel="canonical" href="{canon}">'}
{alts}
<meta property="og:type" content="website"><meta property="og:site_name" content="Molí Brow Studio">
<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canon}"><meta property="og:image" content="{url(og_img)}"><meta property="og:locale" content="{'nb_NO' if L == 0 else 'en_GB'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FCF9F6">
<link rel="icon" href="{P}favicon.svg" type="image/svg+xml"><link rel="icon" href="{P}favicon-32.png" sizes="32x32"><link rel="apple-touch-icon" href="{P}apple-touch-icon.png"><link rel="manifest" href="{P}site.webmanifest">
<link rel="preload" href="{P}assets/montserrat-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{P}assets/montserrat.css"><link rel="stylesheet" href="{P}assets/site.css">
{blocks}
<script>document.documentElement.classList.add('js')</script>
</head>'''


def header(path, key, solid):
    P = '../' * path.count('/')
    nav_keys = ['treatments', 'gallery', 'about', 'faq', 'contact']
    links = ''.join(
        f'<a href="{href(path, slug_path(k, L))}"{" aria-current=" + chr(34) + "page" + chr(34) if k == key or (k in ("treatments",) and key in SERVICES) else ""}>{esc(t(NAV_LABEL[k]))}</a>'
        for k in nav_keys)
    other = 1 - L
    tgt_key = key if has_lang(key, other) else 'home'
    lang_link = (f'<a class="lang" href="{href(path, slug_path(tgt_key, other))}" hreflang="{"en" if other else "nb"}" lang="{"en" if other else "nb"}" '
                 f'aria-label="{"English" if other else "Norsk"}">{"EN" if other else "NO"}</a>')
    book = f'<a class="btn" {bk(path)}>{"Bestill time" if L == 0 else "Book now"}</a>'
    return f'''<body>
<a class="skip" href="#main">{"Hopp til innhold" if L == 0 else "Skip to content"}</a>
<header id="hd"{' class="solid" data-solid' if solid else ''}><div class="wrap bar">
  <a class="brand" href="{href(path, slug_path('home', L))}" aria-label="Molí Brow Studio"><img src="{P}img/logo-cocoa.svg" alt="Molí Brow Studio" width="78" height="44"></a>
  <button class="burger" id="bg" aria-label="{'Meny' if L == 0 else 'Menu'}" aria-expanded="false"><i></i><i></i></button>
  <nav id="nav" aria-label="{'Hovedmeny' if L == 0 else 'Main'}">{links}{lang_link}{book}</nav>
</div></header>
'''


def footer(path, extra_js=''):
    P = '../' * path.count('/')
    h = lambda k: href(path, slug_path(k, L))
    svc = ''.join(f'<a href="{h(k)}">{esc(t(NAV_LABEL[k]))}</a>' for k in SERVICE_ORDER)
    st = ''.join(f'<a href="{h(k)}">{esc(t(NAV_LABEL[k]))}</a>' for k in ['about', 'gallery', 'faq', 'contact', 'gift-cards'])
    area_col = ''
    if L == 0:
        area_col = ('<div><h4>Eidsvoll og omegn</h4>' + f'<a href="{h("areas")}">Bryn og vipper i Akershus</a>'
                    + ''.join(f'<a href="{h("area-" + k)}">{esc(AREAS[k]["name"])}</a>' for k in AREA_ORDER[:6]) + '</div>')
    return f'''<footer><div class="wrap">
  <div class="fgrid">
    <div><img src="{P}img/logo-milk.svg" alt="Molí Brow Studio" width="92" height="52" loading="lazy">
      <p>{'Bryn og vippeløft' if L == 0 else 'Brows and lash lift'}<br>Sundgata 7, 3. {'etasje' if L == 0 else 'floor'}<br>2080 Eidsvoll</p></div>
    <div><h4>{'Behandlinger' if L == 0 else 'Treatments'}</h4>{svc}</div>
    <div><h4>Studio</h4>{st}</div>
    {area_col}
    <div><h4>{'Følg og bestill' if L == 0 else 'Follow & book'}</h4><a href="{INSTAGRAM}" target="_blank" rel="noopener">Instagram</a><a href="{TIKTOK}" target="_blank" rel="noopener">TikTok</a><a {bk(path)}>{'Bestill time' if PROVIDER == 'spokes' else 'Timma'}</a><a href="mailto:{EMAIL}">{EMAIL}</a><a href="{href(path, slug_path('privacy', L))}">{esc(t(NAV_LABEL['privacy']))}</a></div>
  </div>
  <div class="legal"><span>© {datetime.date.today().year} Molí Brow Studio</span><span>{'Bilder er fargekorrigert for et enhetlig studiouttrykk.' if L == 0 else 'Photos colour-graded for a consistent studio look.'}</span></div>
</div></footer>
<script src="{P}assets/vendor/gsap.min.js" defer></script><script src="{P}assets/vendor/ScrollTrigger.min.js" defer></script>
<script src="{P}assets/site.js" defer></script>{extra_js}
</body></html>'''


def crumbs(path, trail):
    """trail: list of (label, key or None)"""
    items = [(t(NAV_LABEL['home']), 'home')] + trail
    lis = ''.join(
        f'<li><a href="{href(path, slug_path(k, L))}">{esc(lbl)}</a></li>' if k else f'<li aria-current="page">{esc(lbl)}</li>'
        for lbl, k in items)
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": lbl, **({"item": url(slug_path(k, L))} if k else {})}
        for i, (lbl, k) in enumerate(items)]}
    return f'<nav aria-label="Breadcrumb"><ol class="crumbs">{lis}</ol></nav>', ld


def first_sentence(txt):
    m = re.match(r'(.+?[.!?])(\s|$)', txt)
    return m.group(1) if m else txt


def eyebrow(s):
    return f'<p class="eyebrow">{esc(s)}</p>'


def cta_section(path, h2=None):
    h2 = h2 or ('Din <em>brynhistorie</em> begynner her.' if L == 0 else 'Your <em>brow story</em> starts here.')
    p = 'Velg tid som passer – bestillingen skjer trygt via Timma.' if L == 0 else 'Pick a time that suits you – booking is handled securely via Timma.'
    b = 'Bestill time' if L == 0 else 'Book now'
    return f'''<section class="book"><div class="wrap">
  <p class="eyebrow rv" style="justify-content:center">{'Bestill' if L == 0 else 'Book'}</p>
  <h2 class="rv">{h2}</h2><p class="rv">{p}</p>
  <a class="btn rv" {bk(path)}>{b} →</a>
</div></section>'''


def faq_section(items, h2=None, eyebrow_txt=None):
    det = ''.join(f'<details><summary>{esc(t(q))}</summary><p>{esc(t(a))}</p></details>' for q, a in items)
    h2 = h2 or ('Godt å <em>vite</em>' if L == 0 else 'Good to <em>know</em>')
    return f'''<section class="faq"><div class="wrap faq-grid">
  <div>{eyebrow(eyebrow_txt or ('Spørsmål' if L == 0 else 'FAQ'))}<h2>{h2}</h2></div>
  <div>{det}</div></div></section>'''


def faq_ld(items):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": t(q), "acceptedAnswer": {"@type": "Answer", "text": t(a)}} for q, a in items]}


def business_ld(full=True):
    node = {"@type": "BeautySalon", "name": "Molí Brow Studio", "url": url(slug_path('home', L)),
            "image": url('img/hero.jpg'), "email": EMAIL,
            "address": {"@type": "PostalAddress", "streetAddress": "Sundgata 7, 3. etasje", "postalCode": "2080",
                        "addressLocality": "Eidsvoll", "addressCountry": "NO"},
            "areaServed": [{"@type": "City", "name": "Eidsvoll"}, {"@type": "AdministrativeArea", "name": "Akershus"}] +
                          [{"@type": "Place", "name": AREAS[k]["name"]} for k in AREA_ORDER if k != "eidsvoll"],
            "sameAs": [INSTAGRAM, TIKTOK, BOOKING]}
    if full:
        node["@context"] = "https://schema.org"
        node["description"] = t(HOME['desc'])
        node["makesOffer"] = [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": t(NAV_LABEL[k]), "url": url(slug_path(k, L))}}
                              for k in SERVICE_ORDER]
    return node


def price_rows(path, opts, link_key=None):
    out = ''
    for no, en, price, dur, desc in opts:
        name = en if L else no
        nm = f'<a href="{href(path, slug_path(link_key, L))}">{esc(name)}</a>' if link_key else esc(name)
        small = f'<small>{esc(t(desc))}</small>' if desc else ''
        out += f'<div class="row"><b>{nm}</b><span class="p">{price} kr</span>{small}<span class="t">{fmt_dur(dur)}</span></div>'
    return out


def write(path, content):
    full = os.path.join(OUT, path, 'index.html') if path else os.path.join(OUT, 'index.html')
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf8').write(content)


# ───────────────────────── pages
def local_strip(path):
    if L != 0:
        return ''
    links = ', '.join(f'<a href="{href(path, slug_path("area-" + k, 0))}">{esc(AREAS[k]["name"])}</a>' for k in AREA_ORDER)
    return (f'<section style="padding:48px 0 0"><div class="wrap"><p class="rv" style="max-width:52em;margin:0">Vi tar imot kunder fra {links} og hele Akershus-området rundt Eidsvoll. '
            f'<a href="{href(path, slug_path("areas", 0))}">Se alle steder →</a></p></div></section>')


def page_service(key):
    s = SERVICES[key]
    path = slug_path(key, L)
    P = '../' * path.count('/')
    label = t(NAV_LABEL[key])
    cr_html, cr_ld = crumbs(path, [(t(NAV_LABEL['treatments']), 'treatments'), (label, None)])
    from_p = min(o[2] for o in s['options'])
    kf = [(('Pris', 'Price'), (f'fra {from_p} kr' if len(s['options']) > 1 else f'{from_p} kr', f'from {from_p} NOK' if len(s['options']) > 1 else f'{from_p} NOK')),
          (('Tid', 'Duration'), (dur_range(s['dur']),) * 2)]
    if s['lasts']:
        kf.append((('Varer', 'Lasts'), s['lasts']))
    keyfacts = ''.join(f'<div><b>{esc(t(a))}</b><span>{esc(t(b))}</span></div>' for a, b in kf)
    prep_no, prep_en = PREP.get(s['group'], PREP['brow']) if s['group'] in PREP else (None, None)
    prep_list = ''
    if prep_no:
        items = (prep_no, prep_en)[L]
        prep_list = f'''<div class="side"><h3>{'Før timen' if L == 0 else 'Before your visit'}</h3><ul class="ticks">{''.join(f"<li>{esc(i)}</li>" for i in items)}</ul>
        <div class="note-box">{esc(t(NOT_DONE))}</div></div>'''
    steps = ''.join(f'<div class="rv"><div class="n">0{i + 1}</div><p>{esc(x)}</p></div>' for i, x in enumerate(t(s['steps'])))
    forwho = ''.join(f'<li>{esc(x)}</li>' for x in t(s['forwho']))
    prose = ''.join(f'<p>{esc(x)}</p>' for x in t(s['what']))
    rel = ''.join(
        f'<a class="card plain rv" href="{href(path, slug_path(r, L))}"><div class="ct"><h3>{esc(t(NAV_LABEL[r]))}</h3>'
        f'<p>{esc(first_sentence(t(SERVICES[r]["lead"])))}</p><div class="from">{"Fra" if L == 0 else "From"} {SERVICES[r]["from_price"]} kr</div></div></a>'
        for r in s['related'])
    body = f'''<main id="main">
<section class="phero"><div class="wrap phero-grid">
  <div>{cr_html}{eyebrow('Molí Brow Studio · Eidsvoll')}<h1>{esc(t(s['h1']))}</h1>
    <p class="lead">{esc(t(s['lead']))}</p>{f'<div class="keyfacts">{keyfacts}</div>'}
    <a class="btn" {bk(path)}>{'Bestill time' if L == 0 else 'Book now'} →</a></div>
  <figure class="frame"><div class="marks"><i></i><i></i><i></i><i></i></div>{img(P, s['img'], t(s['alt']), fetch=True)}
    <figcaption><span>Molí Brow Studio</span><span>{esc(label)}</span></figcaption></figure>
</div></section>

<section><div class="wrap two">
  <div class="prose"><h2>{esc(t(s['what_h']))}</h2>{prose}</div>
  <div class="side"><h3>{'Passer for deg som' if L == 0 else 'Good for you if'}</h3><ul class="ticks">{forwho}</ul></div>
</div></section>

<section class="treat" id="priser"><div class="wrap">
  <p class="eyebrow">{'Priser' if L == 0 else 'Prices'}</p>
  <h2>{esc(label)} – {'pris og varighet' if L == 0 else 'price and duration'}</h2>
  <div style="max-width:780px;margin-top:32px">{price_rows(path, s['options'])}</div>
  <p class="note" style="margin-top:28px;font-size:14px;opacity:.8">{'Faste priser i NOK. Alle behandlinger utføres av Lina.' if L == 0 else 'Fixed prices in NOK. Every treatment is done by Lina.'}</p>
</div></section>

<section><div class="wrap">
  <div class="two"><div><p class="eyebrow">{'Slik foregår timen' if L == 0 else 'Your visit'}</p><h2>{'Tre steg. <em>Én</em> time.' if L == 0 else 'Three steps. <em>One</em> visit.'}</h2></div><div></div></div>
  <div class="steps3">{steps}</div>
  {f'<div style="margin-top:56px">{prep_list}</div>' if prep_list else ''}
</div></section>

{faq_section(s['faq'])}
{local_strip(path)}
<section><div class="wrap">
  <p class="eyebrow">{'Se også' if L == 0 else 'See also'}</p><h2 style="margin-bottom:40px">{'Andre <em>behandlinger</em>' if L == 0 else 'Other <em>treatments</em>'}</h2>
  <div class="cards">{rel}</div></div></section>
{cta_section(path)}
</main>'''
    service_ld = {"@context": "https://schema.org", "@type": "Service", "name": t(s['h1']), "serviceType": label,
                  "description": t(s['desc']), "url": url(path), "image": url(f"img/{s['img']}.jpg"),
                  "provider": business_ld(full=False), "areaServed": {"@type": "City", "name": "Eidsvoll"},
                  "offers": [{"@type": "Offer", "name": (o[1] if L else o[0]), "price": str(o[2]), "priceCurrency": "NOK", "url": book_abs()}
                             for o in s['options']]}
    ld = [service_ld, faq_ld(s['faq']), cr_ld]
    write(path, head(path, key, t(s['title']), t(s['desc']), ld, og_img=f"img/{s['img']}.jpg") + header(path, key, True) + body + footer(path))


def page_treatments():
    key, path = 'treatments', slug_path('treatments', L)
    cr_html, cr_ld = crumbs(path, [(t(NAV_LABEL['treatments']), None)])
    blocks = ''
    for k in SERVICE_ORDER:
        s = SERVICES[k]
        link = href(path, slug_path(k, L))
        blocks += f'''<div class="svc-block rv"><div class="svc-head"><h2><a href="{link}" style="text-decoration:none">{esc(t(NAV_LABEL[k]))}</a></h2>
        <a class="l" href="{link}">{'Les mer' if L == 0 else 'Read more'} →</a></div>
        <p style="max-width:44em;margin:0 0 8px">{esc(t(s['lead']))}</p>{price_rows(path, s['options'], k)}</div>'''
    body = f'''<main id="main">
<section class="phero solo"><div class="wrap phero-grid"><div>{cr_html}{eyebrow('Molí Brow Studio · Eidsvoll')}<h1>{esc(t(TREATMENTS['h1']))}</h1>
<p class="lead">{esc(t(TREATMENTS['lead']))}</p>
<a class="btn" {bk(path)}>{'Bestill time' if L == 0 else 'Book now'} →</a></div></div></section>
<section class="treat"><div class="wrap">{blocks}
<p class="note" style="font-size:14px;opacity:.8">{'Gavekort: 500 kr, 750 kr eller valgfritt beløp – ' if L == 0 else 'Gift cards: 500 NOK, 750 NOK or any amount – '}<a href="{href(path, slug_path('gift-cards', L))}">{esc(t(NAV_LABEL['gift-cards']))}</a>.</p></div></section>
{cta_section(path)}</main>'''
    ld = [cr_ld, {"@context": "https://schema.org", "@type": "ItemList", "name": t(TREATMENTS['h1']),
                  "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": t(NAV_LABEL[k]), "url": url(slug_path(k, L))}
                                      for i, k in enumerate(SERVICE_ORDER)]}]
    write(path, head(path, key, t(TREATMENTS['title']), t(TREATMENTS['desc']), ld) + header(path, key, True) + body + footer(path))


def page_gift():
    key, path = 'gift-cards', slug_path('gift-cards', L)
    P = '../' * path.count('/')
    cr_html, cr_ld = crumbs(path, [(t(NAV_LABEL['gift-cards']), None)])
    amounts = [('500 kr', ''), ('750 kr', ''), ('Valgfritt beløp' if L == 0 else 'Any amount', '')]
    cards = ''.join(f'<div class="amount rv"><b>{esc(a) if i < 2 else "∞"}</b><span>{esc(a) if i == 2 else ("Gavekort" if L == 0 else "Gift card")}</span></div>' for i, (a, _) in enumerate(amounts))
    steps = (['Velg «Gavekort» i bestillingen hos Timma.', 'Velg beløp – 500 kr, 750 kr eller valgfritt beløp.', 'Gi bort en rolig time og naturlige resultater.'],
             ['Choose “Gift cards” in the booking at Timma.', 'Pick an amount – 500 NOK, 750 NOK or any amount.', 'Give a calm appointment and natural results.'])
    st = ''.join(f'<div class="rv"><div class="n">0{i + 1}</div><p>{esc(x)}</p></div>' for i, x in enumerate(steps[L]))
    body = f'''<main id="main">
<section class="phero solo"><div class="wrap phero-grid"><div>{cr_html}{eyebrow('Molí Brow Studio · Eidsvoll')}<h1>{esc(t(GIFT['h1']))}</h1><p class="lead">{esc(t(GIFT['lead']))}</p>
<a class="btn" {bk(path)}>{'Kjøp gavekort' if L == 0 else 'Buy a gift card'} →</a></div></div></section>
<section><div class="wrap"><div class="amounts">{cards}</div><div class="steps3">{st}</div></div></section>
{cta_section(path, 'Gi bort en <em>brynhistorie</em>.' if L == 0 else 'Give someone a <em>brow story</em>.')}</main>'''
    write(path, head(path, key, t(GIFT['title']), t(GIFT['desc']), [cr_ld]) + header(path, key, True) + body + footer(path))


def page_about():
    key, path = 'about', slug_path('about', L)
    P = '../' * path.count('/')
    cr_html, cr_ld = crumbs(path, [(t(NAV_LABEL['about']), None)])
    quote = '«Hos meg kan du forvente en personlig og avslappende opplevelse.»' if L == 0 else '“With me you can expect a personal, relaxing experience.”'
    p1 = ('Bak Molí Brow Studio står jeg, Lina, sertifisert brynstylist siden 2024. Med en forkjærlighet for kvalitet og detaljer setter jeg høye krav til både produktene jeg bruker og utførelsen av arbeidet mitt.',
          'Behind Molí Brow Studio is me, Lina – a certified brow stylist since 2024. I love quality and detail, and I set high standards for both the products I use and the work I do.')
    p2 = ('Hos meg kan du forvente en personlig og avslappende opplevelse, der hver behandling er nøye tilpasset for å fremheve din naturlige skjønnhet. Jeg starter alltid med en konsultasjon og forklarer hvert steg underveis, slik at du vet hva som skjer – og hvorfor.',
          'With me you can expect a personal, relaxing experience, where every treatment is carefully tailored to bring out your natural beauty. I always start with a consultation and explain every step as we go, so you know what is happening – and why.')
    proofs = [('5,0' if L == 0 else '5.0', 'snitt på Timma' if L == 0 else 'average on Timma'), ('91', 'vurderinger' if L == 0 else 'ratings'),
              ('59', 'skrevne omtaler – alle 5★' if L == 0 else 'written reviews – all 5★')]
    pr = ''.join(f'<div><b>{a}</b><span>{b}</span></div>' for a, b in proofs)
    vals = (['Konsultasjon først – vi ser på hårene og ønskene dine før vi starter.', 'Rolig og nøye – en personlig time, bare deg og meg, uten stress.',
             'Hvert steg forklart – du vet alltid hva jeg gjør, og hvorfor.', 'Naturlig resultat – formet etter ansiktet ditt, ikke etter en mal.'],
            ['Consultation first – we look at your hairs and wishes before we begin.', 'Calm and careful – a personal appointment, just you and me, no rush.',
             'Every step explained – you always know what I’m doing, and why.', 'Natural results – shaped to your face, not to a template.'])
    body = f'''<main id="main">
<section class="phero"><div class="wrap phero-grid"><div>{cr_html}{eyebrow('Molí Brow Studio · Eidsvoll')}<h1>{esc(t(ABOUT['h1']))}</h1>
<p class="lead" style="font-weight:200;font-size:clamp(22px,2.4vw,30px);line-height:1.35">{esc(quote)}</p>
<a class="btn" {bk(path)}>{'Bestill hos Lina' if L == 0 else 'Book with Lina'} →</a></div>
<figure class="frame"><div class="marks"><i></i><i></i><i></i><i></i></div>{img(P, 'lina', 'Lina i studioet i Eidsvoll' if L == 0 else 'Lina in the studio in Eidsvoll', fetch=True)}<figcaption><span>Lina</span><span>{'Brynstylist' if L == 0 else 'Brow stylist'}</span></figcaption></figure></div></section>
<section><div class="wrap two"><div class="prose"><h2>{'Om meg og studioet' if L == 0 else 'About me and the studio'}</h2><p>{esc(t(p1))}</p><p>{esc(t(p2))}</p>
<div class="proofs">{pr}</div></div>
<div class="side"><h3>{'Slik jobber jeg' if L == 0 else 'How I work'}</h3><ul class="ticks">{''.join(f"<li>{esc(v)}</li>" for v in vals[L])}</ul></div></div></section>
<section class="treat"><div class="wrap"><div class="two"><div class="prose"><h2>{'Studioet i <em>Sundgata</em>' if L == 0 else 'The studio on <em>Sundgata</em>'}</h2>
<p>{'Studioet ligger i Sundgata 7, 3. etasje – et rolig, lyst rom der du kan senke skuldrene. Det er gratis parkering rett utenfor.' if L == 0 else 'The studio is at Sundgata 7, 3rd floor – a calm, bright room where you can relax. There is free parking right outside.'}</p>
<a class="btn ghost" href="{href(path, slug_path('contact', L))}">{'Se adresse og kontakt' if L == 0 else 'Address and contact'} →</a></div>
<figure class="frame">{img(P, 'room-2', 'Studioet i Sundgata, Eidsvoll' if L == 0 else 'The studio on Sundgata, Eidsvoll')}</figure></div></div></section>
{cta_section(path)}</main>'''
    write(path, head(path, key, t(ABOUT['title']), t(ABOUT['desc']), [cr_ld, {"@context": "https://schema.org", "@type": "Person", "name": "Lina",
          "jobTitle": "Certified brow stylist", "worksFor": business_ld(full=False)}], og_img='img/lina.jpg') + header(path, key, True) + body + footer(path))


GALLERY_ITEMS = [
    ('brow-1', ('Brynslaminering – ferdig resultat', 'Brow lamination – finished result'), ('Bryn', 'Brows')),
    ('lash-1', ('Koreansk vippeløft – nærbilde', 'Korean lash lift – close-up'), ('Vipper', 'Lashes')),
    ('process-2', ('Brynsfarging etter laminering', 'Brow tint after lamination'), ('Prosess', 'Process')),
    ('lash-3', ('Vippeløft og bryn', 'Lash lift and brows'), ('Vipper', 'Lashes')),
    ('process-1', ('Oppmåling og forming av bryn', 'Brow mapping and shaping'), ('Prosess', 'Process')),
    ('client-1', ('Fornøyd kunde etter timen', 'Happy client after the appointment'), ('Etter timen', 'After')),
    ('room-1', ('Behandlingsstolen i studioet', 'The treatment chair in the studio'), ('Studio', 'Studio')),
    ('room-2', ('Studioet i Sundgata', 'The studio on Sundgata'), ('Studio', 'Studio')),
    ('lina', ('Lina i studioet', 'Lina in the studio'), ('Studio', 'Studio')),
]


def page_gallery():
    key, path = 'gallery', slug_path('gallery', L)
    P = '../' * path.count('/')
    cr_html, cr_ld = crumbs(path, [(t(NAV_LABEL['gallery']), None)])
    figs = ''.join(f'<figure class="rv"><div class="ph">{img(P, n, t(a), loading="eager" if i < 3 else "lazy")}</div><figcaption><span>{str(i + 1).zfill(2)}</span><span>{esc(t(c))}</span></figcaption></figure>'
                   for i, (n, a, c) in enumerate(GALLERY_ITEMS))
    body = f'''<main id="main">
<section class="phero solo"><div class="wrap phero-grid"><div>{cr_html}{eyebrow('Molí Brow Studio · Eidsvoll')}<h1>{esc(t(GALLERY['h1']))}</h1><p class="lead">{esc(t(GALLERY['lead']))}</p>
<a class="btn ghost" href="{INSTAGRAM}" target="_blank" rel="noopener">Instagram →</a></div></div></section>
<section><div class="wrap"><div class="gal">{figs}</div></div></section>{cta_section(path)}</main>'''
    write(path, head(path, key, t(GALLERY['title']), t(GALLERY['desc']), [cr_ld]) + header(path, key, True) + body + footer(path))


def page_contact():
    key, path = 'contact', slug_path('contact', L)
    cr_html, cr_ld = crumbs(path, [(t(NAV_LABEL['contact']), None)])
    g = lambda no, en: no if L == 0 else en
    grid = f'''<div class="contact-grid">
<div class="rv"><h3>{g('Adresse', 'Address')}</h3><p style="margin:0">Molí Brow Studio<br>Sundgata 7, 3. {g('etasje', 'floor')}<br>2080 Eidsvoll</p><a href="{MAPS}" target="_blank" rel="noopener">{g('Åpne i Google Maps', 'Open in Google Maps')} →</a></div>
<div class="rv"><h3>{g('Slik finner du oss', 'Finding us')}</h3><p style="margin:0">{g('Studioet ligger i 3. etasje i Sundgata 7. Det er gratis parkering rett utenfor.', 'The studio is on the 3rd floor of Sundgata 7. Free parking is right outside.')}</p></div>
<div class="rv"><h3>{g('Kontakt', 'Contact')}</h3><a href="mailto:{EMAIL}">{EMAIL}</a><a href="{INSTAGRAM}" target="_blank" rel="noopener">Instagram</a><a href="{TIKTOK}" target="_blank" rel="noopener">TikTok</a></div>
<div class="rv"><h3>{g('Bestill time', 'Book')}</h3><p style="margin:0 0 10px">{g('Du bestiller trygt online via Timma.', 'You book securely online via Timma.')}</p><a {bk(path)}>{g('Se ledige timer', 'See available times')} →</a></div>
<div class="rv"><h3>{g('Avbestilling', 'Cancellation')}</h3><p style="margin:0">{g('Avbestill i Timma senest 24 timer før timen. Senere avbestilling eller uteblivelse kan belastes med 100 % av prisen.', 'Cancel in Timma at least 24 hours before. Later cancellations or no-shows may be charged 100% of the price.')}</p></div>
<div class="rv"><h3>{g('Spørsmål?', 'Questions?')}</h3><p style="margin:0">{g('Usikker på hva som passer? Send en e-post før du bestiller.', 'Unsure what suits you? Send an email before you book.')}</p><a href="{href(path, slug_path('faq', L))}">{g('Les spørsmål og svar', 'Read the FAQ')} →</a></div></div>'''
    body = f'''<main id="main">
<section class="phero solo"><div class="wrap phero-grid"><div>{cr_html}{eyebrow('Molí Brow Studio · Eidsvoll')}<h1>{esc(t(CONTACT['h1']))}</h1>
<p class="lead">{g('Sundgata 7, 3. etasje, 2080 Eidsvoll – med gratis parkering rett utenfor.', 'Sundgata 7, 3rd floor, 2080 Eidsvoll – with free parking right outside.')}</p></div></div></section>
<section><div class="wrap">{grid}</div></section>{cta_section(path)}</main>'''
    ld = [cr_ld, business_ld(full=True)]
    write(path, head(path, key, t(CONTACT['title']), t(CONTACT['desc']), ld) + header(path, key, True) + body + footer(path))


def page_faq():
    key, path = 'faq', slug_path('faq', L)
    cr_html, cr_ld = crumbs(path, [(t(NAV_LABEL['faq']), None)])
    body = f'''<main id="main">
<section class="phero solo"><div class="wrap phero-grid"><div>{cr_html}{eyebrow('Molí Brow Studio · Eidsvoll')}<h1>{esc(t(FAQ['h1']))}</h1><p class="lead">{esc(t(FAQ['lead']))}</p>
<a class="btn ghost" href="mailto:{EMAIL}">{'Send e-post' if L == 0 else 'Send email'}</a></div></div></section>
{faq_section(FAQ['items'])}{cta_section(path)}</main>'''
    write(path, head(path, key, t(FAQ['title']), t(FAQ['desc']), [faq_ld(FAQ['items']), cr_ld]) + header(path, key, True) + body + footer(path))


# ───────────────────────── area pages (Norwegian only) for Akershus local SEO
def area_label(k):
    return AREAS[k]['name']


def area_links_html(path, exclude=None, heading=None):
    cards = ''.join(
        f'<a class="card plain rv" href="{href(path, slug_path("area-" + k, 0))}"><div class="ct"><h3>{esc(AREAS[k]["name"])}</h3>'
        f'<p>{esc(AREAS[k]["muni"])}</p></div></a>' for k in AREA_ORDER if k != exclude)
    return cards


def page_areas_hub():
    key, path = 'areas', slug_path('areas', 0)
    cr_html, cr_ld = crumbs(path, [(HUB['h1'], None)])
    cards = area_links_html(path)
    prose = ''.join(f'<p>{esc(x)}</p>' for x in HUB['body'])
    body = f'''<main id="main">
<section class="phero solo"><div class="wrap phero-grid"><div>{cr_html}{eyebrow('Molí Brow Studio · Eidsvoll')}<h1>{esc(HUB['h1'])}</h1><p class="lead">{esc(HUB['lead'])}</p>
<a class="btn" {bk(path)}>Bestill time →</a></div></div></section>
<section><div class="wrap two"><div class="prose"><h2>Eidsvoll og <em>omegn</em></h2>{prose}
<p><a href="{MAPS}" target="_blank" rel="noopener">Åpne Sundgata 7 i Google Maps →</a></p></div>
<div class="side"><h3>Studioet</h3><ul class="ticks"><li>Sundgata 7, 3. etasje, 2080 Eidsvoll</li><li>Gratis parkering rett utenfor</li><li>5,0 fra 91 vurderinger på Timma</li></ul></div></div></section>
<section class="treat"><div class="wrap"><p class="eyebrow">Steder</p><h2 style="margin-bottom:40px">Kunder fra <em>hele området</em></h2><div class="cards">{cards}</div></div></section>
<section><div class="wrap"><p class="eyebrow">Behandlinger</p><h2 style="margin-bottom:40px">Det kan du bestille</h2>
<div class="cards">{''.join(f'<a class="card plain rv" href="{href(path, slug_path(k, 0))}"><div class="ct"><h3>{esc(NAV_LABEL[k][0])}</h3><p>{esc(first_sentence(SERVICES[k]["lead"][0]))}</p><div class="from">Fra {SERVICES[k]["from_price"]} kr</div></div></a>' for k in SERVICE_ORDER[:6])}</div></div></section>
{cta_section(path)}</main>'''
    ld = [cr_ld, {"@context": "https://schema.org", "@type": "CollectionPage", "name": HUB['h1'], "url": url(path),
                  "about": business_ld(full=False)}]
    write(path, head(path, key, HUB['title'], HUB['desc'], ld) + header(path, key, True) + body + footer(path))


def page_area(ak):
    a = AREAS[ak]
    key, path = 'area-' + ak, slug_path('area-' + ak, 0)
    P = '../' * path.count('/')
    cr_html, cr_ld = crumbs(path, [(t(NAV_LABEL['areas']), 'areas'), (a['name'], None)])
    prose = ''.join(f'<p>{esc(x)}</p>' for x in a['local'])
    rows = ''.join(
        f'<div class="row"><b><a href="{href(path, slug_path(k, 0))}">{esc(NAV_LABEL[k][0])}</a></b><span class="p">{"fra " if len(SERVICES[k]["options"]) > 1 else ""}{SERVICES[k]["from_price"]} kr</span>'
        f'</div>' for k in SERVICE_ORDER)
    near = area_links_html(path, exclude=ak)
    why = ['Konsultasjon først – vi ser på hårene og ønskene dine før vi starter.', 'Rolig og nøye – en personlig time, uten stress.',
           'Faste priser – du vet hva det koster før du bestiller.', 'Gratis parkering rett utenfor studioet.']
    faq_items = [((q, q), (ans, ans)) for q, ans in a['faq']]
    body = f'''<main id="main">
<section class="phero"><div class="wrap phero-grid"><div>{cr_html}{eyebrow('Molí Brow Studio · ' + a['name'])}<h1>{esc(a['h1'])}</h1>
<p class="lead">{esc(a['intro'])}</p>
<div class="ctas"><a class="btn" {bk(path)}>Bestill time →</a> <a class="btn ghost" href="{MAPS}" target="_blank" rel="noopener">Veibeskrivelse</a></div></div>
<figure class="frame"><div class="marks"><i></i><i></i><i></i><i></i></div>{img(P, 'brow-1', 'Brynslaminering hos Molí Brow Studio i Eidsvoll', fetch=True)}<figcaption><span>Sundgata 7</span><span>Eidsvoll</span></figcaption></figure></div></section>
<section><div class="wrap two"><div class="prose"><h2>Bryn og vipper <em>nær {esc(a['name'])}</em></h2>{prose}</div>
<div class="side"><h3>Hvorfor Molí Brow Studio</h3><ul class="ticks">{''.join(f'<li>{esc(x)}</li>' for x in why)}</ul></div></div></section>
<section class="treat"><div class="wrap"><p class="eyebrow">Behandlinger og priser</p><h2 style="margin-bottom:12px">Faste priser</h2><div style="max-width:640px">{rows}</div></div></section>
{faq_section(faq_items, 'Spørsmål fra <em>' + esc(a['name']) + '</em>')}
<section><div class="wrap"><p class="eyebrow">Eidsvoll og omegn</p><h2 style="margin-bottom:40px">Kunder fra <em>flere steder</em></h2><div class="cards">{near}</div></div></section>
{cta_section(path)}</main>'''
    ld = [cr_ld, faq_ld(faq_items), {"@context": "https://schema.org", "@type": "WebPage", "name": a['title'], "url": url(path),
          "about": business_ld(full=False), "spatialCoverage": {"@type": "AdministrativeArea", "name": a['muni']}}]
    write(path, head(path, key, a['title'], a['desc'], ld, og_img='img/brow-1.jpg') + header(path, key, True) + body + footer(path))


def page_privacy():
    key, path = 'privacy', slug_path('privacy', L)
    cr_html, cr_ld = crumbs(path, [(t(NAV_LABEL['privacy']), None)])
    secs = ''.join(f'<h2 style="font-size:24px;margin:40px 0 12px">{esc(t(h))}</h2><p>{esc(t(b))}</p>' for h, b in PRIVACY['sections'])
    body = f'''<main id="main"><section class="phero solo"><div class="wrap phero-grid"><div>{cr_html}<h1>{esc(t(PRIVACY['h1']))}</h1></div></div></section>
<section><div class="wrap"><div class="prose" style="max-width:46em">{secs}</div></div></section></main>'''
    write(path, head(path, key, t(PRIVACY['title']), t(PRIVACY['desc']), [cr_ld]) + header(path, key, True) + body + footer(path))


# ───────────────────────── booking page (native Spokes flow, or a Timma fallback)
I18N = {
    'no': {'service': 'Velg behandling', 'day': 'Velg dag', 'time': 'Velg tidspunkt', 'details': 'Dine opplysninger', 'first': 'Fornavn', 'last': 'Etternavn',
           'phone': 'Mobilnummer', 'email': 'E-post', 'comment': 'Kommentar (valgfritt)', 'terms': 'Jeg godtar vilkårene og at opplysningene brukes til å gjennomføre bestillingen.',
           'privacy': 'Personvern', 'send': 'Send bestilling', 'sending': 'Sender…', 'next': 'Neste', 'back': 'Tilbake', 'full': 'Fullt', 'closed': 'Stengt',
           'loading': 'Henter ledige dager…', 'noslots': 'Lina bekrefter klokkeslett på SMS eller e-post.', 'ok': 'Takk! Bestillingen er sendt.',
           'ok2': 'Du får bekreftelse på SMS eller e-post.', 'status': 'Se bestillingen din', 'err': 'Noe gikk galt. Prøv igjen, eller bestill via Timma.',
           'full_err': 'Dagen eller timen ble akkurat full – velg en annen.', 'rate': 'For mange forsøk. Vent litt og prøv igjen.', 'contact': 'Oppgi mobilnummer eller e-post.',
           'fallback': 'Bestill via Timma', 'fallbackText': 'Online booking er ikke tilgjengelig akkurat nå. Du kan bestille via Timma i stedet.',
           'min': 'min', 'from': 'kr', 'month': ['januar','februar','mars','april','mai','juni','juli','august','september','oktober','november','desember'],
           'dow': ['man','tir','ons','tor','fre','lør','søn'], 'prev': 'Forrige måned', 'nextm': 'Neste måned', 'pick': 'Velg en behandling og en dag.', 'terms_err': 'Du må godta vilkårene.',
           'name_err': 'Oppgi fornavn.', 'qty': 'Antall'},
    'en': {'service': 'Choose a treatment', 'day': 'Choose a day', 'time': 'Choose a time', 'details': 'Your details', 'first': 'First name', 'last': 'Last name',
           'phone': 'Mobile number', 'email': 'Email', 'comment': 'Comment (optional)', 'terms': 'I accept the terms and that my details are used to carry out the booking.',
           'privacy': 'Privacy', 'send': 'Send booking', 'sending': 'Sending…', 'next': 'Next', 'back': 'Back', 'full': 'Full', 'closed': 'Closed',
           'loading': 'Loading available days…', 'noslots': 'Lina confirms the time by SMS or email.', 'ok': 'Thank you! Your booking has been sent.',
           'ok2': 'You will get a confirmation by SMS or email.', 'status': 'View your booking', 'err': 'Something went wrong. Try again, or book via Timma.',
           'full_err': 'That day or time just filled up – please pick another.', 'rate': 'Too many attempts. Wait a moment and try again.', 'contact': 'Enter a mobile number or email.',
           'fallback': 'Book via Timma', 'fallbackText': 'Online booking is not available right now. You can book via Timma instead.',
           'min': 'min', 'from': 'NOK', 'month': ['January','February','March','April','May','June','July','August','September','October','November','December'],
           'dow': ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], 'prev': 'Previous month', 'nextm': 'Next month', 'pick': 'Choose a treatment and a day.', 'terms_err': 'You must accept the terms.',
           'name_err': 'Enter your first name.', 'qty': 'Quantity'},
}


def page_book():
    key, path = 'book', slug_path('book', L)
    P = '../' * path.count('/')
    cr_html, cr_ld = crumbs(path, [(t(NAV_LABEL['book']), None)])
    cfg = {"api": SPOKES_API, "slug": SPOKES_SLUG, "app": SPOKES_APP, "sitekey": TURNSTILE_SITEKEY, "timma": BOOKING,
           "provider": PROVIDER, "lang": LANGS[L], "i18n": I18N[LANGS[L]], "privacy": href(path, slug_path('privacy', L)),
           "pre": 'service'}
    fallback = f'<p>{esc(I18N[LANGS[L]]["fallbackText"])}</p><a class="btn" href="{BOOKING}" target="_blank" rel="noopener">{esc(I18N[LANGS[L]]["fallback"])} →</a>'
    body = f'''<main id="main">
<section class="phero solo"><div class="wrap phero-grid"><div>{cr_html}{eyebrow('Molí Brow Studio · Eidsvoll')}<h1>{esc(t(BOOK['h1']))}</h1><p class="lead">{esc(t(BOOK['lead']))}</p></div></div></section>
<section style="padding-top:24px"><div class="wrap"><div id="book-app" class="book-app" data-config='{esc(json.dumps(cfg, ensure_ascii=False))}'>
<noscript>{fallback}</noscript><div class="book-fallback" hidden>{fallback}</div></div></div></section></main>'''
    write(path, head(path, key, t(BOOK['title']), t(BOOK['desc']), [cr_ld], noindex=(PROVIDER != 'spokes')) + header(path, key, True) + body
          + footer(path, extra_js=f'<script src="{P}assets/booking.js" defer></script>'))


def first_sentence_pair(pair):
    return first_sentence(pair[L])


# ───────────────────────── home (reuses the designed one-pager body)
ALT_EN = {
    'Koreansk vippeløft, nærbilde': 'Korean lash lift, close-up',
    'Naturlig formede bryn og løftede vipper': 'Naturally shaped brows and lifted lashes',
    'Brynslaminering, ferdig resultat': 'Brow lamination, finished result', 'Vippeløft og bryn': 'Lash lift and brows',
    'Brynsfarging etter laminering': 'Brow tint after lamination', 'Oppmåling og forming': 'Mapping and shaping',
    'Fornøyd kunde etter timen': 'Happy client after the appointment', 'Behandlingsstolen i studioet': 'The treatment chair in the studio',
    'Studioet i Sundgata': 'The studio on Sundgata', 'Lina i studioet': 'Lina in the studio',
}


def page_home():
    key, path = 'home', slug_path('home', L)
    P = '../' * path.count('/')
    m = open(os.path.join(ROOT, 'tools', 'templates', 'home_main.html'), encoding='utf8').read()
    m = re.sub(r'<span data-l="no">(.*?)</span><span data-l="en">(.*?)</span>', lambda x: x.group(1 + L), m, flags=re.S)
    m = m.replace('src="img/', f'src="{P}img/').replace('srcset="img/', f'srcset="{P}img/')
    if L == 1:
        for no, en in ALT_EN.items():
            m = m.replace(f'alt="{no}"', f'alt="{en}"')
    # link rows to service pages
    link_map = {}
    for k in SERVICE_ORDER:
        for o in SERVICES[k]['options']:
            link_map.setdefault(o[1] if L else o[0], k)
    link_map.update({'Signaturbryn': 'signature-brows', 'Signature brows': 'signature-brows', 'Voksing': 'waxing', 'Waxing': 'waxing',
                     'Lash lift & brow shaping': 'combinations', 'Lash lift & tint': 'lash-lift'})
    for name, k in link_map.items():
        m = m.replace(f'<b>{name}</b>', f'<b><a href="{href(path, slug_path(k, L))}">{name}</a></b>')
    # services cards after treatments
    cards = ''.join(
        f'<a class="card rv" href="{href(path, slug_path(k, L))}">{img(P, SERVICES[k]["img"], t(SERVICES[k]["alt"]))}'
        f'<div class="ct"><h3>{esc(t(NAV_LABEL[k]))}</h3><p>{esc(first_sentence(t(SERVICES[k]["lead"])))}</p>'
        f'<div class="from">{"Fra" if L == 0 else "From"} {SERVICES[k]["from_price"]} kr</div></div></a>'
        for k in ['brow-lamination', 'lash-lift', 'signature-brows'])
    cards_sec = f'''<section><div class="wrap"><p class="eyebrow rv">{'Behandlinger' if L == 0 else 'Treatments'}</p>
<h2 class="rv" style="margin-bottom:48px">{'Våre mest populære <em>behandlinger</em>' if L == 0 else 'Our most popular <em>treatments</em>'}</h2>
<div class="cards">{cards}</div>
<div class="more rv"><a class="btn ghost" href="{href(path, slug_path('treatments', L))}">{'Se alle behandlinger og priser' if L == 0 else 'See all treatments and prices'} →</a></div></div></section>
'''
    m = m.replace('<!-- GALLERY: contact sheet -->', cards_sec + '<!-- GALLERY -->')
    m = m.replace('Instagram →</a>', f'Instagram →</a> <a class="btn ghost rv" href="{href(path, slug_path("gallery", L))}">{"Hele galleriet" if L == 0 else "Full gallery"} →</a>', 1)
    m = m.replace('<main id="top">', '').replace('id="studio"', 'id="studio"')
    if PROVIDER == 'spokes':
        bkp = href(path, slug_path('book', L))
        m = m.replace('href="https://bestill.timma.no/molbrowstudio" target="_blank" rel="noopener"', f'href="{bkp}"')
    m = re.sub(r' & ', ' &amp; ', m)
    m = m.replace('href="#om"', '')
    # extra links to About / FAQ / Contact
    m = m.replace('<!-- BOOK -->', f'<!-- BOOK -->')
    about_l = f'<p class="rv" style="margin-top:24px"><a href="{href(path, slug_path("about", L))}">{"Les mer om Lina" if L == 0 else "More about Lina"} →</a> &nbsp;·&nbsp; <a href="{href(path, slug_path("contact", L))}">{"Adresse og kontakt" if L == 0 else "Address and contact"} →</a> &nbsp;·&nbsp; <a href="{href(path, slug_path("faq", L))}">{"Alle spørsmål" if L == 0 else "All questions"} →</a></p>'
    m = m.replace('<!-- FAQ -->', '<!-- FAQ -->')
    area_sec = ''
    if L == 0:
        area_sec = (f'<section class="treat"><div class="wrap"><p class="eyebrow rv">Eidsvoll og omegn</p><h2 class="rv" style="margin-bottom:36px">Kunder fra <em>hele Akershus-området</em></h2>'
                    f'<div class="cards">{area_links_html(path)}</div><div class="more rv"><a class="btn ghost" href="{href(path, slug_path("areas", 0))}">Se alle steder →</a></div></div></section>')
    m = m.replace('<!-- BOOK -->', area_sec + f'<section style="padding:0 0 40px"><div class="wrap">{about_l}</div></section><!-- BOOK -->')
    body = '<main id="main">' + m + '</main>'
    # exactly one H1 already exists in the template hero
    write(path, head(path, key, t(HOME['title']), t(HOME['desc']), [business_ld(True)]) + header(path, key, False) + body + footer(path))


def page_404():
    path = '404.html'
    global L
    L = 0
    P = '/'
    doc = head('x', 'home', t(NOTFOUND['title']), '', None, noindex=True).replace('../', '/') if False else None
    body = f'''<main id="main"><section class="phero solo"><div class="wrap phero-grid"><div><h1>{esc(t(NOTFOUND['h1']))}</h1><p class="lead">{esc(t(NOTFOUND['lead']))}</p>
<a class="btn" href="/">{'Til forsiden' if L == 0 else 'Home'}</a> <a class="btn ghost" href="/{SLUGS['treatments'][0]}/">{'Behandlinger'}</a></div></div></section></main>'''
    doc = f'''<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(t(NOTFOUND['title']))}</title>
<meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/montserrat.css"><link rel="stylesheet" href="/assets/site.css"></head>
<body><header id="hd" class="solid" data-solid><div class="wrap bar"><a class="brand" href="/"><img src="/img/logo-cocoa.svg" alt="Molí Brow Studio" width="78" height="44"></a></div></header>{body}</body></html>'''
    open(os.path.join(OUT, '404.html'), 'w', encoding='utf8').write(doc)


def sitemap():
    rows = ''
    for k in SLUGS:
        both = has_lang(k, 0) and has_lang(k, 1)
        for i in (0, 1):
            if not has_lang(k, i):
                continue
            alts = ''
            if both:
                alts = ''.join(f'<xhtml:link rel="alternate" hreflang="{h}" href="{url(slug_path(k, j))}"/>' for j, h in ((0, 'nb'), (1, 'en')))
                alts += f'<xhtml:link rel="alternate" hreflang="x-default" href="{url(slug_path(k, 0))}"/>'
            if k == 'book' and PROVIDER != 'spokes':
                continue  # booking page is noindex until the Spokes flow is enabled
            pri = '1.0' if k == 'home' else ('0.9' if k in SERVICES or k in ('treatments', 'areas') else ('0.7' if k.startswith('area-') else '0.6'))
            rows += f'<url><loc>{url(slug_path(k, i))}</loc><lastmod>{TODAY}</lastmod><priority>{pri}</priority>{alts}</url>\n'
    open(os.path.join(OUT, 'sitemap.xml'), 'w', encoding='utf8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + rows + '</urlset>\n')
    open(os.path.join(OUT, 'robots.txt'), 'w', encoding='utf8').write(f'User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}/sitemap.xml\n')


def main():
    global L
    for i in (0, 1):
        L = i
        page_home(); page_treatments()
        for k in SERVICES:
            page_service(k)
        page_gift(); page_about(); page_gallery(); page_contact(); page_faq()
        page_privacy(); page_book()
    L = 0
    page_areas_hub()
    for ak in AREA_ORDER:
        page_area(ak)
    page_404(); sitemap()
    print('built', sum(1 for _ in os.walk(OUT)), 'dirs; SITE_URL =', SITE_URL)


if __name__ == '__main__':
    main()
