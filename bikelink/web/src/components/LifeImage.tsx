import Image from "next/image";
import type { Photo } from "@/lib/life";

/** Full-bleed lifestyle image that fills its (position: relative) parent. */
export function LifeImage({ photo, priority = false, position = "center", sizes = "100vw" }: { photo: Photo; priority?: boolean; position?: string; sizes?: string }) {
  return <Image src={photo.src} alt={photo.alt} fill priority={priority} sizes={sizes} className="life-img" style={{ objectPosition: position }} />;
}
