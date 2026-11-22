import Image from "next/image";
import Link from "next/link";
import { type Product, compareAt, isAvailable, kr, priceRange, siblings } from "@/lib/products";
import { productPath } from "@/lib/seo";
import { DealerFrom } from "./DealerProvider";

export function ProductCard({ p, priority = false }: { p: Product; priority?: boolean }) {
  const { low } = priceRange(p);
  const was = compareAt(p);
  const img = p.images[0];
  const colours = siblings(p).length + 1;
  return (
    <Link href={productPath(p)} className="card">
      <div className="card-img">
        {img && <Image src={img.src} alt={img.alt ?? p.title} width={img.width} height={img.height} sizes="(max-width:700px) 70vw, (max-width:1100px) 33vw, 25vw" priority={priority} />}
        {!isAvailable(p) && <span className="tag">Utsolgt</span>}
        {was && isAvailable(p) && <span className="tag sale">Salg</span>}
      </div>
      <h3>{p.title.replace(/^MMR\s+/, "")}</h3>
      <p className="mono sub">{p.colour ?? "MMR Bikes®"}{colours > 1 && ` · ${colours} farger`}</p>
      <p className="price mono">{kr(low)} {was && <s>{kr(was)}</s>}</p>
      <DealerFrom slug={p.handle} />
    </Link>
  );
}
