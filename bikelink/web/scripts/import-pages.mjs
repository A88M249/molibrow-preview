// Copies the legal/policy pages from the live Shopify store into data/legal/*.json as structured blocks
// (no raw HTML), so they render safely and can be edited. Run: npm run import:pages
import { mkdir, writeFile } from "node:fs/promises";
import { parse } from "node-html-parser";

const SOURCE = process.env.SOURCE ?? "https://bikelink.no";
const PAGES = { "terms-of-service": "vilkar", "refund-policy": "angrerett", "shipping-policy": "frakt", "privacy-policy": "personvern", "legal-notice": "juridisk" };

const clean = (s) => s.replace(/ /g, " ").replace(/[ \t\r\n]+/g, " ");

/** Inline nodes: { t } text, { t, b, i, href } formatted text, { br: true } line break. */
function inline(node, fmt = {}, out = []) {
  for (const c of node.childNodes) {
    if (c.nodeType === 3) { const t = clean(c.rawText); if (t) out.push({ t, ...fmt }); continue; }
    const tag = c.tagName?.toLowerCase();
    if (tag === "br") { out.push({ br: true }); continue; }
    const next = { ...fmt };
    if (tag === "strong" || tag === "b") next.b = true;
    if (tag === "em" || tag === "i") next.i = true;
    if (tag === "a") { const h = c.getAttribute("href") ?? ""; next.href = h.startsWith("/") ? `${SOURCE}${h}` : h; }
    inline(c, next, out);
  }
  return out;
}
const trim = (nodes) => { // drop leading/trailing whitespace and breaks
  while (nodes.length && (nodes[0].br || nodes[0].t?.trim() === "")) nodes.shift();
  while (nodes.length && (nodes.at(-1).br || nodes.at(-1).t?.trim() === "")) nodes.pop();
  if (nodes[0]?.t) nodes[0].t = nodes[0].t.replace(/^\s+/, "");
  if (nodes.at(-1)?.t) nodes.at(-1).t = nodes.at(-1).t.replace(/\s+$/, "");
  return nodes;
};

function blocks(root) {
  const out = [];
  for (const el of root.childNodes) {
    if (el.nodeType !== 1) continue;
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) { const n = Math.max(2, Math.min(4, +tag[1])); const inl = trim(inline(el)); if (inl.length) out.push({ type: `h${n}`, inline: inl }); }
    else if (tag === "p") { const inl = trim(inline(el)); if (inl.length) out.push({ type: "p", inline: inl }); }
    else if (tag === "ul" || tag === "ol") out.push({ type: tag, items: el.querySelectorAll(":scope > li").map((li) => trim(inline(li))) });
    else if (tag === "hr") out.push({ type: "hr" });
    else if (["div", "span", "section"].includes(tag)) out.push(...blocks(el));
  }
  return out;
}

await mkdir(new URL("../data/legal/", import.meta.url), { recursive: true });
for (const [shopify, slug] of Object.entries(PAGES)) {
  const res = await fetch(`${SOURCE}/policies/${shopify}`);
  if (!res.ok) throw new Error(`${shopify}: ${res.status}`);
  const root = parse(await res.text());
  const title = root.querySelector(".shopify-policy__title h1")?.text.trim() ?? slug;
  const body = root.querySelector(".shopify-policy__body .rte") ?? root.querySelector(".shopify-policy__body");
  const doc = { slug, title, source: `${SOURCE}/policies/${shopify}`, blocks: blocks(body) };
  await writeFile(new URL(`../data/legal/${slug}.json`, import.meta.url), JSON.stringify(doc, null, 1));
  console.log(`${slug.padEnd(10)} "${title}" – ${doc.blocks.length} blocks`);
}
