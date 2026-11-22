import { isAvailable, priceRange, productSummary, products } from "@/lib/products";
import { SITE_URL, abs, productPath } from "@/lib/seo";

export const dynamic = "force-static";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Google Merchant Center compatible RSS 2.0 feed. Also useful to shopping AI agents.
export function GET() {
  const items = products.map((p) => {
    const { low } = priceRange(p);
    return `<item>
<g:id>${esc(p.variants[0]?.sku || p.handle)}</g:id>
<g:item_group_id>${esc(p.handle)}</g:item_group_id>
<title>${esc(p.title)}</title>
<description>${esc((p.description || productSummary(p)).slice(0, 4900))}</description>
<link>${abs(productPath(p))}</link>
<g:image_link>${esc(p.images[0]?.src ?? "")}</g:image_link>
<g:availability>${isAvailable(p) ? "in_stock" : "out_of_stock"}</g:availability>
<g:price>${(low / 100).toFixed(2)} NOK</g:price>
<g:brand>MMR Bikes</g:brand>
<g:condition>new</g:condition>
<g:identifier_exists>no</g:identifier_exists>
</item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>
<title>BikeLink</title><link>${SITE_URL}</link><description>MMR-sykler fra BikeLink</description>
${items.join("\n")}
</channel></rss>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
}
