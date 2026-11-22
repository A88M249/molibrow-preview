import { CATEGORIES, CATEGORY_IDS, type CategoryId, familiesIn, inCategory, isAvailable, priceRange } from "./products";

export type MenuCategory = {
  id: CategoryId; name: string; title: string; intro: string; count: number; from: number;
  families: { name: string; anchor: string; count: number }[];
  featured: { handle: string; title: string; image: string; width: number; height: number; fromOre: number }[];
};

export const anchor = (family: string) => family.toLowerCase().replace(/\s+/g, "-");

export function buildMenu(): MenuCategory[] {
  return CATEGORY_IDS.map((id) => {
    const items = inCategory(id);
    const pool = items.filter((p) => isAvailable(p) && p.images[0]);
    const seen = new Set<string>();
    const featured = pool.filter((p) => (seen.has(p.family) ? false : (seen.add(p.family), true))).slice(0, 3);
    return {
      id, name: CATEGORIES[id].name, title: CATEGORIES[id].title, intro: CATEGORIES[id].intro,
      count: items.length, from: Math.min(...items.map((p) => priceRange(p).low)),
      families: familiesIn(id).map((f) => ({ name: f, anchor: anchor(f), count: items.filter((p) => p.family === f).length })),
      featured: featured.map((p) => ({ handle: p.handle, title: p.title.replace(/^MMR\s+/, ""), image: p.images[0].src, width: p.images[0].width, height: p.images[0].height, fromOre: priceRange(p).low })),
    };
  });
}
