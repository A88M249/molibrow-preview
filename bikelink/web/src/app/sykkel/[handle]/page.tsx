import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyPanel } from "@/components/BuyPanel";
import { Spin360 } from "@/components/Spin360";
import { spinFrames } from "@/lib/spin";
import { LifeImage } from "@/components/LifeImage";
import { CATEGORY_MOOD } from "@/lib/life";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES, byHandle, compareAt, describe, isAvailable, kr, listed, priceRange, products, siblings } from "@/lib/products";
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
  const description = snippet(describe(p));
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
  const text = describe(p);
  const colourways = [p, ...siblings(p)];
  const frames = spinFrames(p.handle);
  const related = listed.filter((x) => x.family === p.family && x.modelKey !== p.modelKey && x.category === p.category).slice(0, 4);

  return (
    <div className="wrap section">
      <JsonLd data={productLd(p)} />
      <JsonLd data={breadcrumbLd([{ name: "Forside", path: "/" }, { name: cat.name, path: categoryPath(p.category) }, { name: p.title, path: productPath(p) }])} />
      <nav className="crumbs" aria-label="Brødsmulesti"><Link href="/">Forside</Link> / <Link href={categoryPath(p.category)}>{cat.name}</Link> / {p.title.replace(/^MMR\s+/, "")}</nav>

      <div className="subnav" aria-label="På denne siden">
        <strong>{p.title.replace(/^MMR\s+/, "")}</strong>
        <nav><a href="#storrelse">Størrelse</a><a href="#beskrivelse">Beskrivelse</a><a href="#flere">Flere modeller</a></nav>
        <span className="price">{kr(low)}</span>
      </div>

      <div className="pdp">
        <div className="gallery">
          {frames.length >= 8 && <div className="gallery-spin"><Spin360 frames={frames} alt={p.title} /></div>}
          {p.images.map((img, i) => (
            <Image key={img.src} src={img.src} alt={img.alt ?? `${p.title} – bilde ${i + 1}`} width={img.width} height={img.height} priority={i === 0 && frames.length < 8} sizes="(max-width:900px) 100vw, 55vw" className={i === 0 && frames.length < 8 ? "wide" : ""} />
          ))}
        </div>

        <aside className="buybox">
          <p className="eyebrow">MMR Bikes · {cat.name}</p>
          <h1>{p.title}</h1>
          {p.colour && <p className="muted">Farge: {p.colour}</p>}
          {colourways.length > 1 && (
            <ul className="colours" aria-label="Velg farge">
              {colourways.map((c) => (
                <li key={c.handle}><Link href={productPath(c)} aria-current={c.handle === p.handle ? "page" : undefined} className={c.handle === p.handle ? "on" : ""}>{c.colour ?? c.title}</Link></li>
              ))}
            </ul>
          )}
          <p className="price big">{kr(low)}{high !== low && <span className="muted"> – {kr(high)}</span>} {was && <s>{kr(was)}</s>}</p>
          <p className="muted small">Inkl. mva. Frakt er inkludert i prisen.</p>
          <BuyPanel handle={p.handle} title={p.title} image={p.images[0]?.src ?? null} variants={p.variants.map((v) => ({ sku: v.sku, size: v.size, priceOre: v.priceOre, available: v.available }))} />
          <ul className="facts">
            <li><strong>Levering hjem</strong> eller hent ferdig montert hos forhandler</li>
            <li><strong>Betal</strong> med kort, Klarna eller Vipps</li>
            <li><strong>Reklamasjon</strong> i opptil 5 år og norsk service</li>
          </ul>
          <Link className="btn ghost block" href="/forhandlere">Finn forhandler</Link>
        </aside>
      </div>

      <section className="prose desc" id="beskrivelse">
        <h2>Om {p.title.replace(/^MMR\s+/, "")}</h2>
        {paragraphs(text).map((t, i) => <p key={i}>{t.trim()}</p>)}
      </section>

      {CATEGORY_MOOD[p.category] && (
        <section className="mood" aria-hidden="true"><LifeImage photo={CATEGORY_MOOD[p.category]!} position="50% 50%" sizes="100vw" /></section>
      )}

      {related.length > 0 && (
        <section id="flere">
          <h2 className="family">Flere i MMR {p.family}</h2>
          <div className="grid">{related.map((s) => <ProductCard key={s.handle} p={s} />)}</div>
        </section>
      )}
    </div>
  );
}
