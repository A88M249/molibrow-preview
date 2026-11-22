import type { MetadataRoute } from "next";
import { CATEGORY_IDS, products } from "@/lib/products";
import { abs, categoryPath, productPath } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const latest = new Date(Math.max(...products.map((p) => Date.parse(p.updatedAt))));
  return [
    { url: abs("/"), lastModified: latest, priority: 1 },
    ...["/forhandlere", "/service", "/om-oss", "/kontakt", "/b2b", "/b2b/soknad", "/sykkelinnbytte", "/vilkar", "/angrerett", "/frakt", "/personvern", "/juridisk"].map((path) => ({ url: abs(path), lastModified: latest, priority: 0.5 })),
    ...CATEGORY_IDS.map((c) => ({ url: abs(categoryPath(c)), lastModified: latest, priority: 0.8 })),
    ...products.map((p) => ({ url: abs(productPath(p)), lastModified: new Date(p.updatedAt), priority: 0.6 })),
  ];
}
