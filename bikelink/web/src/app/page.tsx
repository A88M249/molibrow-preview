import Image from "next/image";
import Link from "next/link";
import { LINKS } from "@/components/Chrome";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES, CATEGORY_IDS, inCategory, isAvailable, products } from "@/lib/products";

const firstAvailable = (c: (typeof CATEGORY_IDS)[number]) => inCategory(c).find(isAvailable) ?? inCategory(c)[0];

export default function Home() {
  const heroImg = firstAvailable("landevei").images[0];
  const picks = products.filter(isAvailable).filter((p) => !p.needsReview).slice(0, 8);

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">Offisiell importør av MMR Bikes</p>
            <h1>Spansk ingeniørkunst.<br />Klar for norske veier og stier.</h1>
            <p className="lead">Landevei, gravel, terreng og el. Kjøp online og hent hos din nærmeste MMR-forhandler.</p>
            <div className="btn-row">
              <Link className="btn" href="/landevei">Se alle sykler</Link>
              <a className="btn ghost" href={LINKS.dealers}>Finn forhandler</a>
            </div>
          </div>
          <div className="hero-img">
            <Image src={heroImg.src} alt={heroImg.alt ?? firstAvailable("landevei").title} width={heroImg.width} height={heroImg.height} priority sizes="(max-width:900px) 100vw, 50vw" />
          </div>
        </div>
      </section>

      <section className="wrap section">
        <h2>Velg sykkeltype</h2>
        <div className="tiles">
          {CATEGORY_IDS.map((c) => {
            const p = firstAvailable(c);
            const img = p.images[0];
            return (
              <Link key={c} href={`/${c}`} className="tile">
                <Image src={img.src} alt="" width={img.width} height={img.height} sizes="(max-width:700px) 50vw, 20vw" />
                <span>{CATEGORIES[c].name}</span>
                <small>{inCategory(c).length} modeller</small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="wrap section">
        <h2>På lager nå</h2>
        <div className="grid">{picks.map((p, i) => <ProductCard key={p.handle} p={p} priority={i < 4} />)}</div>
      </section>

      <section className="band">
        <div className="wrap band-grid">
          <div><strong>Offisiell importør</strong><p>Direkte fra MMR – med norsk service og reservedeler.</p></div>
          <div><strong>Hent hos forhandler</strong><p>Velg levering hjem eller hent og få sykkelen klargjort av en lokal forhandler.</p></div>
          <div><strong>Betal over tid</strong><p>Betal med kort, Klarna eller Vipps.</p></div>
          <div><strong>Verksted</strong><p>Bestill service hos et av våre verksteder.</p></div>
        </div>
      </section>

      <section className="wrap section prose">
        <h2>MMR-sykler i Norge</h2>
        <p>BikeLink er offisiell importør og distributør av MMR Bikes i Norge. MMR er et spansk sykkelmerke som lager landeveissykler, gravelsykler, terrengsykler, elsykler og barnesykler, utviklet av ingeniører med bakgrunn fra profesjonell sykkelsport. Hos BikeLink finner du hele MMR-programmet, med pris i norske kroner inkludert mva.</p>
      </section>
    </>
  );
}
