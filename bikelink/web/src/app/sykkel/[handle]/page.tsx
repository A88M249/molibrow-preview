import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LINKS } from "@/components/Chrome";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES, byHandle, compareAt, isAvailable, kr, priceRange, productSummary, products } from "@/lib/products";
import { abs, breadcrumbLd, categoryPath, productLd, productPath } from "@/lib/seo";

type Props = { params: Promise<{ handle: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => products.map((p) => ({ handle: p.handle }));

const snippet = (s: string, n = 155) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(" ", n)).replace(/[,.;:]$/, "") + "…");
const paragraphs = (s: string) => s.match(/[^.!?]+[.!?]+(\s|$)/g)?.reduce<string[]>((acc, x, i) => (i % 3 ? (acc[acc.length - 1] += x) : acc.push(x), acc), []) ?? [s];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const p = byHandle(handle);
  if (!p) return {};
  const { low } = priceRange(p);
  const description = snippet(`${p.description || productSummary(p)}`) ;
  const title = `${p.title} – ${CATEGORIES[p.category].noun} fra ${kr(low)}`;
  return {
    title,
    description,
    alternates: { canonical: productPath(p) },
    openGraph: { title, description, url: abs(productPath(p)), type: "website", images: p.images.slice(0, 1).map((i) => i.src) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  const p = byHandle(handle);
  if (!p) notFound();
  const cat = CATEGORIES[p.category];
  const { low, high } = priceRange(p);
  const was = compareAt(p);
  const text = p.description || productSummary(p);
  const siblings = products.filter((x) => x.family === p.family && x.handle !== p.handle && x.category === p.category).slice(0, 4);

  return (
    <div className="wrap section">
      <JsonLd data={productLd(p)} />
      <JsonLd data={breadcrumbLd([{ name: "Forside", path: "/" }, { name: cat.name, path: categoryPath(p.category) }, { name: p.title, path: productPath(p) }])} />
      <nav className="crumbs" aria-label="Brødsmulesti"><Link href="/">Forside</Link> / <Link href={categoryPath(p.category)}>{cat.name}</Link> / {p.title.replace(/^MMR\s+/, "")}</nav>

      <div className="pdp">
        <div className="gallery">
          {p.images.map((img, i) => (
            <Image key={img.src} src={img.src} alt={img.alt ?? `${p.title} – bilde ${i + 1}`} width={img.width} height={img.height} priority={i === 0} sizes="(max-width:900px) 100vw, 55vw" />
          ))}
        </div>

        <aside className="buybox">
          <p className="eyebrow">MMR Bikes · {cat.name}</p>
          <h1>{p.title}</h1>
          {p.colour && <p className="muted">Farge: {p.colour}</p>}
          <p className="price big">{kr(low)}{high !== low && <span className="muted"> – {kr(high)}</span>} {was && <s>{kr(was)}</s>}</p>
          <p className="muted small">Inkl. mva. Frakt er inkludert i prisen.</p>

          <h2 className="label">Størrelse</h2>
          <ul className="sizes">
            {p.variants.map((v) => (
              <li key={v.sku || v.size} className={v.available ? "" : "off"}>{v.size ?? "Standard"}{!v.available && <span> utsolgt</span>}</li>
            ))}
          </ul>
          <p className={isAvailable(p) ? "stock ok" : "stock"}>{isAvailable(p) ? "På lager" : "Utsolgt"}</p>

          <a className="btn block" href={`https://bikelink.no/products/${p.handle}`}>Kjøp hos BikeLink.no</a>
          <a className="btn ghost block" href={LINKS.dealers}>Finn forhandler</a>
          <ul className="facts">
            <li>Levering hjem eller henting hos forhandler</li>
            <li>Betal med kort, Klarna eller Vipps</li>
            <li>Offisiell MMR-importør i Norge</li>
          </ul>
        </aside>
      </div>

      <section className="prose desc">
        <h2>Om {p.title.replace(/^MMR\s+/, "")}</h2>
        {paragraphs(text).map((t, i) => <p key={i}>{t.trim()}</p>)}
      </section>

      {siblings.length > 0 && (
        <section>
          <h2 className="family">Flere i MMR {p.family}</h2>
          <div className="grid">{siblings.map((s) => <ProductCard key={s.handle} p={s} />)}</div>
        </section>
      )}
    </div>
  );
}
