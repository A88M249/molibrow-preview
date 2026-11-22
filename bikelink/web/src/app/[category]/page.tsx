import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/Blocks";
import { LIFE } from "@/lib/life";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES, CATEGORY_IDS, type CategoryId, familiesIn, inCategory, kr, priceRange } from "@/lib/products";
import { abs, breadcrumbLd, categoryPath, collectionLd } from "@/lib/seo";

type Props = { params: Promise<{ category: string }> };
const valid = (c: string): c is CategoryId => (CATEGORY_IDS as string[]).includes(c);

export const dynamicParams = false;
export const generateStaticParams = () => CATEGORY_IDS.map((category) => ({ category }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  if (!valid(category)) return {};
  const items = inCategory(category);
  const low = Math.min(...items.map((p) => priceRange(p).low));
  const c = CATEGORIES[category];
  const description = `${c.intro} ${items.length} MMR-modeller fra ${kr(low)}. Offisiell importør, pris inkl. mva.`;
  return {
    title: `${c.title} – MMR`,
    description,
    alternates: { canonical: categoryPath(category) },
    openGraph: { title: c.title, description, url: abs(categoryPath(category)), images: items[0]?.images[0] ? [items[0].images[0].src] : [] },
  };
}

export default async function Category({ params }: Props) {
  const { category } = await params;
  if (!valid(category)) notFound();
  const c = CATEGORIES[category];
  const items = inCategory(category);
  const families = familiesIn(category);

  return (
    <>
      {category === "landevei" && <PageHero photo={LIFE.hilltop} position="60% 25%" eyebrow="MMR Bikes®" title={c.title} lead={c.intro} />}
    <div className="wrap section">
      <JsonLd data={collectionLd(category, items)} />
      <JsonLd data={breadcrumbLd([{ name: "Forside", path: "/" }, { name: c.name, path: categoryPath(category) }])} />
      <nav className="crumbs" aria-label="Brødsmulesti"><Link href="/">Forside</Link> / {c.name}</nav>
      {category !== "landevei" && <><h1>{c.title}</h1><p className="lead">{c.intro}</p></>}

      {families.length > 1 && (
        <div className="chips" aria-label="Modellfamilier">
          {families.map((f) => <a key={f} href={`#${f.toLowerCase().replace(/\s+/g, "-")}`}>{f}</a>)}
        </div>
      )}

      {families.map((f) => (
        <section key={f} id={f.toLowerCase().replace(/\s+/g, "-")}>
          <h2 className="family">MMR {f}</h2>
          <div className="grid">{items.filter((p) => p.family === f).map((p, i) => <ProductCard key={p.handle} p={p} priority={i < 2} />)}</div>
        </section>
      ))}

      <section className="prose guide">
        <h2>Kjøpsguide: {c.name.toLowerCase()}</h2>
        <p>{c.guide}</p>
        <p>BikeLink er offisiell importør av MMR Bikes i Norge. Alle priser er oppgitt i norske kroner inkludert mva.</p>
      </section>
    </div>
    </>
  );
}
