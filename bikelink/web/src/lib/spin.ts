import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * 360° spin frames live in public/spin/<product-handle>/ as numbered images
 * (01.webp, 02.webp ... 36.webp). No folder = no 360° viewer for that bike.
 */
export function spinFrames(handle: string): string[] {
  try {
    const dir = path.join(process.cwd(), "public", "spin", handle);
    return readdirSync(dir)
      .filter((f) => /\.(webp|jpe?g|png|avif)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((f) => `/spin/${handle}/${f}`);
  } catch {
    return [];
  }
}
