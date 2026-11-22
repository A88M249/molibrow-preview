import { CATEGORIES, type CategoryId, type Product, compareAt, isAvailable, priceRange, productSummary } from "./products";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bikelink.no").replace(/\/$/, "");
export const SITE_NAME = "BikeLink";
export const abs = (path: string) => `${SITE_URL}${path}`;

export const categoryPath = (c: CategoryId) => `/${c}`;
export const productPath = (p: Product) => `/sykkel/${p.handle}`;

const json = (o: unknown) => o;

export const organizationLd = json({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": abs("/#org"),
  name: SITE_NAME,
  url: SITE_URL,
  description: "BikeLink er offisiell importør og distributør av MMR Bikes i Norge.",
  brand: { "@type": "Brand", name: "MMR Bikes" },
  areaServed: "NO",
});

export const websiteLd = json({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": abs("/#website"),
  url: SITE_URL,
  name: SITE_NAME,
  inLanguage: "nb-NO",
  publisher: { "@id": abs("/#org") },
});

export const breadcrumbLd = (items: { name: string; path: string }[]) =>
  json({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.path) })),
  });

export function productLd(p: Product) {
  const { low, high } = priceRange(p);
  const was = compareAt(p);
  return json({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": abs(productPath(p)) + "#product",
    name: p.title,
    description: p.description || productSummary(p),
    image: p.images.map((i) => i.src),
    sku: p.variants[0]?.sku,
    category: CATEGORIES[p.category].title,
    color: p.colour ?? undefined,
    brand: { "@type": "Brand", name: "MMR Bikes" },
    url: abs(productPath(p)),
    offers: {
      "@type": p.variants.length > 1 && low !== high ? "AggregateOffer" : "Offer",
      priceCurrency: "NOK",
      ...(low !== high ? { lowPrice: low / 100, highPrice: high / 100, offerCount: p.variants.length } : { price: low / 100 }),
      availability: isAvailable(p) ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      url: abs(productPath(p)),
      seller: { "@id": abs("/#org") },
      ...(was ? { priceSpecification: { "@type": "UnitPriceSpecification", priceType: "https://schema.org/ListPrice", price: was / 100, priceCurrency: "NOK" } } : {}),
    },
  });
}

export const collectionLd = (c: CategoryId, items: Product[]) =>
  json({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: CATEGORIES[c].title,
    description: CATEGORIES[c].intro,
    url: abs(categoryPath(c)),
    inLanguage: "nb-NO",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(productPath(p)), name: p.title })),
    },
  });
