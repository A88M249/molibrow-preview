import { CATEGORIES, CATEGORY_IDS, inCategory, isAvailable, kr, priceRange, productSummary } from "@/lib/products";
import { SITE_URL, abs, categoryPath, productPath } from "@/lib/seo";

export const dynamic = "force-static";

// llms.txt: a plain-text map of the site for AI assistants (https://llmstxt.org).
export function GET() {
  const lines = [
    "# BikeLink",
    "",
    "> BikeLink (bikelink.no) er offisiell importør og distributør av MMR Bikes i Norge. Nettbutikk for landeveissykler, gravelsykler, terrengsykler, elsykler og barnesykler. Priser i NOK inkludert mva. Kunden kan få levering hjem eller hente hos en MMR-forhandler.",
    "",
    `Site: ${SITE_URL}`,
    "Language: nb-NO",
    "",
    "## Kategorier",
    ...CATEGORY_IDS.map((c) => `- [${CATEGORIES[c].title}](${abs(categoryPath(c))}): ${CATEGORIES[c].intro} (${inCategory(c).length} modeller)`),
    "",
    ...CATEGORY_IDS.flatMap((c) => [
      `## ${CATEGORIES[c].title}`,
      ...inCategory(c).map((p) => {
        const { low, high } = priceRange(p);
        const price = low === high ? kr(low) : `${kr(low)}–${kr(high)}`;
        return `- [${p.title}](${abs(productPath(p))}): ${price}, ${isAvailable(p) ? "på lager" : "utsolgt"}. ${productSummary(p)}`;
      }),
      "",
    ]),
    "## Forhandlere, service og kontakt",
    `- [Forhandlere og verksteder](${abs("/forhandlere")}): MMR-partnere i Oslo, Eidsvoll, Bergen, Trondheim og Stavanger for showroom, utlevering og service.`,
    `- [Service og garanti](${abs("/service")}): reklamasjon i 2 eller 5 år, produsentgaranti og verksteder.`,
    `- [Om BikeLink](${abs("/om-oss")}): offisiell MMR-distributør i Norge.`,
    `- [Kontakt](${abs("/kontakt")}): +47 46 41 19 06, info@bikelink.no, Prost Krags veg 29, 2080 Eidsvoll.`,
    "",
    "## Andre ressurser",
    `- [Produktfeed (Google Merchant / RSS)](${abs("/feed.xml")})`,
    `- [Sitemap](${abs("/sitemap.xml")})`,
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
