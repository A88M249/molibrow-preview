// Turns the static export (PREVIEW_EXPORT=1 next build → out/) into a self-contained preview folder:
//   - product photos are downloaded and bundled (the artifact viewer blocks external image hosts)
//   - every link is rewritten to a relative path ending in index.html (works from any base URL)
//   - Next's scripts are removed; a small inline script keeps the mobile menu, slider and size buttons working
// Usage: node scripts/make-preview.mjs <exportDir> <outDir>        (needs NODE_USE_ENV_PROXY=1 behind a proxy)
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "node-html-parser";

const [src, out] = process.argv.slice(2);
if (!src || !out) { console.error("usage: make-preview.mjs <exportDir> <outDir>"); process.exit(1); }
const site = path.join(out, "site");

// pages that need the backend: dropped from the preview and their links disabled
const DROP = ["admin", "b2b/portal", "b2b/aktiver", "b2b/glemt", "handlekurv", "sok", "404"];
const KEEP_FONTS = /geist(-mono)?-latin(-ext)?-wght/;

await rm(out, { recursive: true, force: true });
await mkdir(site, { recursive: true });
await cp(src, site, { recursive: true });
for (const d of DROP) await rm(path.join(site, d), { recursive: true, force: true });
await rm(path.join(site, "404.html"), { force: true });
for (const f of ["index.txt", "llms.txt", "feed.xml", "sitemap.xml", "robots.txt", "search-index.json"]) await rm(path.join(site, f), { force: true });
await rm(path.join(site, "_next/static/chunks"), { recursive: true, force: true });
for (const d of await readdir(path.join(site, "_next"))) if (d !== "static") await rm(path.join(site, "_next", d), { recursive: true, force: true });
for (const d of await readdir(path.join(site, "_next/static"))) if (!["css", "media"].includes(d)) await rm(path.join(site, "_next/static", d), { recursive: true, force: true });
for (const f of await readdir(path.join(site, "_next/static/media"))) if (!KEEP_FONTS.test(f)) await rm(path.join(site, "_next/static/media", f));

// CSS: relative font URLs, no @font-face for the subsets we dropped
for (const f of await readdir(path.join(site, "_next/static/css"))) {
  const p = path.join(site, "_next/static/css", f);
  let css = await readFile(p, "utf8");
  css = css.replace(/@font-face\s*\{[^}]*\}/g, (blk) => (KEEP_FONTS.test(blk) ? blk : ""));
  css = css.replace(/url\((['"]?)\/_next\/static\/media\//g, "url($1../media/");
  await writeFile(p, css);
}

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

// Next leaves a .txt (React payload) beside every page: not needed without scripts
for await (const f of walk(site)) if (f.endsWith(".txt")) await rm(f);

const pages = [];
for await (const f of walk(site)) if (f.endsWith(".html")) pages.push(f);
const routes = new Set(pages.map((f) => "/" + path.relative(site, path.dirname(f)).split(path.sep).filter(Boolean).join("/")));
routes.add("/");

const images = new Map(); // base URL -> local file
function localImage(url) {
  const u = new URL(url); u.searchParams.delete("width");
  const key = u.toString();
  if (!images.has(key)) {
    const ext = (u.pathname.match(/\.(jpe?g|png|webp|avif|gif)$/i)?.[1] ?? "jpg").toLowerCase();
    images.set(key, `img/${createHash("sha1").update(key).digest("hex").slice(0, 12)}.${ext}`);
  }
  return images.get(key);
}

const INLINE_JS = String.raw`(function(){
 var logo=document.querySelector('a.logo'),home=logo?logo.getAttribute('href'):'index.html',base=home.replace(/index\.html$/,'');
 var L=function(p){return base+p+'/index.html'};
 var btn=document.querySelector('.mobile-menu .icon-btn');
 if(btn){var d=document.createElement('div');d.className='drawer';d.hidden=true;
  d.innerHTML=['landevei:Landevei','gravel:Gravel','terreng:Terreng','elsykkel:Elsykkel','barn:Barn','forhandlere:Finn forhandler','service:Service og garanti','om-oss:Om oss','kontakt:Kontakt'].map(function(x){var a=x.split(':');return '<a class="drawer-link" href="'+L(a[0])+'">'+a[1]+'</a>'}).join('');
  document.body.appendChild(d);var open=false;
  btn.addEventListener('click',function(){open=!open;d.hidden=!open;document.body.style.overflow=open?'hidden':'';btn.setAttribute('aria-expanded',open)});}
 document.querySelectorAll('.slider').forEach(function(s){var t=s.querySelector('.slider-track');
  s.querySelectorAll('.slider-ctrl .circle').forEach(function(b,i){b.addEventListener('click',function(){t.scrollBy({left:(i?1:-1)*t.clientWidth*.8,behavior:'smooth'})})})});
 document.querySelectorAll('.size').forEach(function(b){b.addEventListener('click',function(){
  b.parentNode.querySelectorAll('.size').forEach(function(x){x.classList.remove('on');x.setAttribute('aria-checked','false')});b.classList.add('on');b.setAttribute('aria-checked','true')})});
 document.querySelectorAll('.buybox button.btn').forEach(function(b){b.addEventListener('click',function(){var a=document.querySelector('.added');if(a)a.textContent='Handlekurven er avslått i forhåndsvisningen.'})});
})();`;
const PV_CSS = `[hidden]{display:none!important}#pv-ribbon{position:fixed;left:0;right:0;bottom:0;z-index:200;background:#141414;color:#fff;font:400 12px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.04em;text-transform:uppercase;text-align:center;padding:9px 14px}body{padding-bottom:40px}`;

let disabled = 0;
function rel(prefix, href) {
  if (!href || /^(https?:|mailto:|tel:|data:|#)/.test(href)) return href;
  if (!href.startsWith("/")) return href;
  const [p, hash] = href.split("#");
  const h = hash ? `#${hash}` : "";
  if (/\.(txt|xml|json)$/.test(p)) { disabled++; return "#"; }
  if (/\.[a-z0-9]{2,5}$/i.test(p)) return prefix + p.slice(1) + h;          // asset
  const route = "/" + p.split("/").filter(Boolean).join("/");
  if (!routes.has(route)) { disabled++; return "#"; }                       // page that needs the backend
  return route === "/" ? `${prefix}index.html${h}` : `${prefix}${route.slice(1)}/index.html${h}`;
}

for (const file of pages) {
  const depth = path.relative(site, path.dirname(file)).split(path.sep).filter(Boolean).length;
  const prefix = "../".repeat(depth);
  const root = parse(await readFile(file, "utf8"), { comment: false });
  root.querySelectorAll("script, noscript, link[rel=preload], link[rel=prefetch], link[rel=modulepreload]").forEach((n) => n.remove());
  root.querySelectorAll("link[rel=stylesheet]").forEach((n) => n.setAttribute("href", rel(prefix, n.getAttribute("href"))));
  root.querySelectorAll("link[rel=icon], link[rel=apple-touch-icon]").forEach((n) => n.remove());
  root.querySelectorAll("a[href]").forEach((a) => {
    const h = a.getAttribute("href"); const r = rel(prefix, h);
    a.setAttribute("href", r);
    if (r === "#" && h !== "#") a.setAttribute("title", "Ikke tilgjengelig i forhåndsvisningen");
  });
  // keep the gallery light: first three photos only
  root.querySelectorAll(".gallery").forEach((g) => g.querySelectorAll("img").filter((i) => !i.closest(".gallery-spin")).slice(3).forEach((i) => i.remove()));
  root.querySelectorAll("img").forEach((img) => {
    const s = img.getAttribute("src") ?? "";
    for (const k of Object.keys(img.rawAttrs ? img.attributes : {})) if (/^(srcset|sizes|fetchpriority)$/i.test(k)) img.removeAttribute(k); // React writes srcSet / fetchPriority in camelCase
    if (s.startsWith("https://cdn.shopify.com/")) img.setAttribute("src", prefix + localImage(s));
    else if (s.startsWith("/")) img.setAttribute("src", rel(prefix, s.replace(/^\/_next\/image\?url=([^&]+).*$/, (_, u) => decodeURIComponent(u))));
  });
  // external embeds are blocked in the viewer: replace with a note
  root.querySelectorAll("iframe").forEach((f) => f.replaceWith(parse(`<div class="notice"><p>Her vises innbyttekalkulatoren fra Sportienda. Den kan ikke vises i forhåndsvisningen.</p></div>`)));
  const head = root.querySelector("head");
  head.insertAdjacentHTML("beforeend", `<meta name="robots" content="noindex"><style>${PV_CSS}</style>`);
  const body = root.querySelector("body");
  body.insertAdjacentHTML("beforeend", `<div id="pv-ribbon">Forhåndsvisning · statisk kopi. Handlekurv, søk, innlogging og live lager er avslått her.</div><script>${INLINE_JS}</script>`);
  await writeFile(file, "<!DOCTYPE html>" + root.toString().replace(/^<!DOCTYPE html>/i, ""));
}

// bundle the product photos
await mkdir(path.join(site, "img"), { recursive: true });
let done = 0, failed = 0;
const queue = [...images];
async function worker() {
  while (queue.length) {
    const [url, file] = queue.shift();
    const full = url + (url.includes("?") ? "&" : "?") + "width=800";
    let ok = false;
    for (let t = 0; t < 3 && !ok; t++) {
      try { const r = await fetch(full); if (r.ok) { await writeFile(path.join(site, file), Buffer.from(await r.arrayBuffer())); ok = true; } } catch { /* retry */ }
    }
    ok ? done++ : failed++;
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

let files = 0, bytes = 0;
for await (const f of walk(out)) { files++; bytes += (await stat(f)).size; }
console.log(`pages ${pages.length} · images ${done} ok / ${failed} failed · disabled links ${disabled} · files ${files} · ${(bytes / 1048576).toFixed(1)} MB`);
