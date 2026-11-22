/**
 * next/image loader that needs no image server (works on Cloudflare Workers, Vercel, Node):
 * product photos live on Shopify's CDN, which resizes with ?width=; local files are served as they are.
 */
export default function loader({ src, width }: { src: string; width: number; quality?: number }): string {
  if (src.startsWith("https://cdn.shopify.com/")) {
    const url = new URL(src);
    url.searchParams.set("width", String(Math.min(width, 2048)));
    return url.toString();
  }
  return src;
}
