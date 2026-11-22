// Builds data/redirects.json: old Shopify URLs -> new URLs, so search rankings and old links survive the switch.
// Run: npm run redirects   (reads the live sitemap and data/products.json)
import { readFile, writeFile } from "node:fs/promises";

const SOURCE = process.env.SOURCE ?? "https://bikelink.no";
const products = JSON.parse(await readFile(new URL("../data/products.json", import.meta.url), "utf8"));
const anchor = (f) => f.toLowerCase().replace(/\s+/g, "-");
const familyCat = new Map(products.map((p) => [anchor(p.family), p.category]));
const families = [...familyCat.keys()].sort((a, b) => b.length - a.length); // longest match first ("adrenaline-sl" before "adrenaline")

const toDest = (handle) => {
  const h = handle.replace(/^mmr-/, "");
  const fam = families.find((f) => new RegExp(`(^|-)${f}(-|$)`).test(h));
  if (fam) return `/${familyCat.get(fam)}#${fam}`;
  if (/barn|kids/.test(h)) return "/barn";
  if (/gravel|grus/.test(h)) return "/gravel";
  if (/terreng|mtb|fulldemp/.test(h)) return "/terreng";
  if (/^el|elsykkel|elektris|e-bike/.test(h)) return "/elsykkel";
  if (/landevei|racer|road/.test(h)) return "/landevei";
  return "/";
};

const res = await fetch(`${SOURCE}/sitemap.xml`);
const index = await res.text();
const collectionsUrl = index.match(/<loc>([^<]*sitemap_collections[^<]*)<\/loc>/)?.[1]?.replace(/&amp;/g, "&");
const xml = collectionsUrl ? await (await fetch(collectionsUrl)).text() : "";
const handles = [...xml.matchAll(/<loc>https?:\/\/[^/]+\/collections\/([^<]+)<\/loc>/g)].map((m) => m[1]);

const redirects = [
  ...handles.map((h) => ({ source: `/collections/${h}`, destination: toDest(h) })),
  { source: "/collections", destination: "/" }, { source: "/collections/all", destination: "/" },
  { source: "/pages/service", destination: "/service" },
  { source: "/pages/service-locations", destination: "/forhandlere" },
  { source: "/pages/showroom-partners", destination: "/forhandlere" },
  { source: "/pages/dette-er-bikelink-no", destination: "/om-oss" },
  { source: "/pages/contact", destination: "/kontakt" },
  { source: "/cart", destination: "/handlekurv" },
  { source: "/pages/b2b", destination: "/b2b" },
  { source: "/pages/bike-exchange", destination: "/sykkelinnbytte" },
  { source: "/policies/terms-of-service", destination: "/vilkar" },
  { source: "/policies/refund-policy", destination: "/angrerett" },
  { source: "/policies/shipping-policy", destination: "/frakt" },
  { source: "/policies/privacy-policy", destination: "/personvern" },
  { source: "/policies/legal-notice", destination: "/juridisk" },
];
await writeFile(new URL("../data/redirects.json", import.meta.url), JSON.stringify(redirects, null, 1));
console.log(`${redirects.length} redirects (${handles.length} collections)`);
console.table(handles.slice(0, 40).map((h) => ({ collection: h.slice(0, 48), to: toDest(h) })));
