import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

type Product = { handle: string; duplicateOf?: string };
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(process.cwd(), "data", f), "utf8"));

const config: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.shopify.com" }],
    formats: ["image/avif", "image/webp"],
  },
  // Old Shopify URLs keep working after the switch (and keep their search rankings).
  async redirects() {
    const dups = read<Product[]>("products.json").filter((p) => p.duplicateOf);
    const collections = read<{ source: string; destination: string }[]>("redirects.json");
    return [
      // duplicate Shopify listings -> the original product
      ...dups.flatMap((p) => [
        { source: `/products/${p.handle}`, destination: `/sykkel/${p.duplicateOf}`, permanent: true },
        { source: `/sykkel/${p.handle}`, destination: `/sykkel/${p.duplicateOf}`, permanent: true },
      ]),
      { source: "/products/:handle", destination: "/sykkel/:handle", permanent: true },
      ...collections.map((r) => ({ ...r, permanent: true })),
    ];
  },
};
export default config;
