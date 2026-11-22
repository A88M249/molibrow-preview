import { CATEGORIES, isAvailable, listed, priceRange } from "@/lib/products";

export const dynamic = "force-static";

/** Small index for the client-side search page (about 70 bikes). */
export function GET() {
  const items = listed.map((p) => ({
    h: p.handle, t: p.title.replace(/^MMR\s+/, ""), c: p.colour, cat: CATEGORIES[p.category].name, f: p.family,
    p: priceRange(p).low, a: isAvailable(p), i: p.images[0]?.src ?? null,
  }));
  return Response.json(items);
}
