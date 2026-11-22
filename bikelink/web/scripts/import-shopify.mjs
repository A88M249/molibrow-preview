// Pulls the public Shopify catalogue and writes a slim data/products.json.
// Run: npm run import   (SOURCE=https://bikelink.no by default)
import { writeFile } from "node:fs/promises";

const SOURCE = process.env.SOURCE ?? "https://bikelink.no";

const CATEGORY_BY_TYPE = {
  "MMR Road Bike": "landevei",
  "MMR Gravel Bikes": "gravel",
  "Gravel Bikes": "gravel",
  "MMR MTB Hardtail": "terreng",
  "MMR MTB - Fullsuspension": "terreng",
  "MMR E-Bikes": "elsykkel",
  "E-Bikes": "elsykkel",
  "MMR Kids Bike": "barn",
};

const text = (html) =>
  html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// Family names come in mixed case in Shopify (LYTH, Lyth): normalise to "Lyth", "X-Grip", "Aelion SL".
const titleCase = (w) => w.split("-").map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()).join("-");
function family(title) {
  const t = title.replace(/^MMR\s+/i, "").split(/\s+/);
  if (t[0].toLowerCase() === "full") return "Full Power";
  const base = titleCase(t[0]);
  return t[1]?.toUpperCase() === "SL" ? `${base} SL` : base;
}

// Some Shopify descriptions are internal admin notes (SKU, stock, "utkast"). Never publish those.
const INTERNAL = /\bSKU\b|lager \d|Shopify|utkast|Fargevei/i;

const res = await fetch(`${SOURCE}/products.json?limit=250`);
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
const { products } = await res.json();

const out = [];
for (const p of products) {
  const category = CATEGORY_BY_TYPE[p.product_type];
  if (!category) { console.warn("Skipping (unknown type):", p.title, p.product_type); continue; }
  const variantOpt = (v, name) => {
    const i = p.options.findIndex((o) => o.name.toLowerCase() === name);
    return i < 0 ? null : v[`option${i + 1}`];
  };
  out.push({
    handle: p.handle,
    title: p.title,
    category,
    family: family(p.title),
    description: INTERNAL.test(text(p.body_html ?? "")) ? "" : text(p.body_html ?? ""),
    needsReview: INTERNAL.test(text(p.body_html ?? "")),
    updatedAt: p.updated_at,
    colour: p.variants[0] ? (variantOpt(p.variants[0], "farge") ?? variantOpt(p.variants[0], "color")) : null,
    images: p.images.slice(0, 6).map((i) => ({ src: i.src, width: i.width, height: i.height, alt: i.alt })),
    variants: p.variants.map((v) => ({
      sku: v.sku,
      size: variantOpt(v, "størrelse"),
      priceOre: Math.round(parseFloat(v.price) * 100),
      compareAtOre: v.compare_at_price ? Math.round(parseFloat(v.compare_at_price) * 100) : null,
      available: v.available,
    })),
  });
}
await writeFile(new URL("../data/products.json", import.meta.url), JSON.stringify(out));
console.log(`Wrote ${out.length} products`);
