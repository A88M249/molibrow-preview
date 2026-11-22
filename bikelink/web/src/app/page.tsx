import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { CATEGORIES, CATEGORY_IDS, inCategory, isAvailable, kr, priceRange, products } from "@/lib/products";
import { CITIES } from "@/lib/dealers";

const firstAvailable = (c: (typeof CATEGORY_IDS)[number]) => inCategory(c).find((p) => isAvailable(p) && !p.needsReview) ?? inCategory(c)[0];

export default function Home() {
  const hero = firstAvailable("landevei");
  const heroImg = hero.images[0];
  const picks = products.filter((p) => isAvailable(p) && !p.needsReview).slice(0, 8);
  const lowest = Math.min(...products.map((p) => priceRange(p).low));

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Offisiell importør av MMR Bikes</p>
            <h1>Spansk ingeniørkunst. Klar for norske veier og stier.</h1>
            <p className="lead">Landevei, gravel, terreng og el. Kjøp online og hent ferdig montert hos din nærmeste MMR-forhandler.</p>
            <div className="btn-row">
              <Link className="btn" href="/landevei">Se alle sykler</Link>
              <Link className="btn ghost" href="/forhandlere">Finn forhandler</Link>
            </div>
            <p className="small muted hero-note">{products.length} modeller · fra {kr(lowest)} · frakt inkludert</p>
          </div>
          <div className="hero-img">
            <Image src={heroImg.src} alt={heroImg.alt ?? hero.title} width={heroImg.width} height={heroImg.height} priority sizes="(max-width:900px) 100vw, 55vw" />
            <Link href={`/sykkel/${hero.handle}`} className="hero-tag"><strong>{hero.title.replace(/^MMR\s+/, "")}</strong><span>Fra {kr(priceRange(hero).low)} →</span></Link>
          </div>
        </div>
      </section>

      <section className="usp">
        <div className="wrap usp-row">
          <span>Offisiell MMR-importør</span><span>Ferdig montert</span><span>Hent hos forhandler</span><span>Betal med kort, Klarna eller Vipps</span>
        </div>
      </section>

      <section className="wrap section">
        <div className="section-head"><h2>Velg sykkeltype</h2></div>
        <div className="tiles">
          {CATEGORY_IDS.map((c) => {
            const p = firstAvailable(c);
            const img = p.images[0];
            return (
              <Link key={c} href={`/${c}`} className="tile">
                <span className="tile-name">{CATEGORIES[c].name}</span>
                <small>{inCategory(c).length} modeller</small>
                <Image src={img.src} alt="" width={img.width} height={img.height} sizes="(max-width:700px) 50vw, 20vw" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="wrap section">
        <div className="section-head"><h2>På lager nå</h2><Link href="/landevei" className="more">Se hele utvalget →</Link></div>
        <div className="grid">{picks.map((p, i) => <ProductCard key={p.handle} p={p} priority={i < 4} />)}</div>
      </section>

      <section className="band">
        <div className="wrap">
          <p className="eyebrow light">Fra klikk til første tur</p>
          <h2>Kjøp på nett – hent lokalt</h2>
          <ol className="steps dark">
            <li><span className="num">01</span><strong>Velg sykkel</strong><p>Se spesifikasjoner, geometri og størrelsesguide.</p></li>
            <li><span className="num">02</span><strong>Velg utleveringssted</strong><p>Hent sykkelen hos en MMR-forhandler nær deg.</p></li>
            <li><span className="num">03</span><strong>Ferdig montert</strong><p>Montert og kontrollert før den leveres.</p></li>
            <li><span className="num">04</span><strong>Service etterpå</strong><p>Hos autoriserte verkstedpartnere.</p></li>
          </ol>
          <div className="btn-row">
            <Link className="btn light" href="/forhandlere">Finn forhandler</Link>
            <span className="cities">{CITIES.join(" · ")}</span>
          </div>
        </div>
      </section>

      <section className="wrap section split">
        <Link href="/service" className="feature"><p className="eyebrow">Trygghet</p><h3>Service og garanti</h3><p>Reklamasjon i opptil 5 år på sykler, produsentgaranti og verkstedpartnere over hele landet.</p><span className="more">Les mer →</span></Link>
        <Link href="/om-oss" className="feature"><p className="eyebrow">Om oss</p><h3>Dette er BikeLink.no</h3><p>Offisiell MMR-distributør som kombinerer netthandel med montering, utlevering og service hos partnere.</p><span className="more">Møt BikeLink →</span></Link>
      </section>

      <section className="wrap section prose">
        <h2>MMR-sykler i Norge</h2>
        <p>BikeLink er offisiell importør og distributør av MMR Bikes i Norge. MMR er et spansk sykkelmerke fra Asturias med røtter i konkurransesykling, og lager landeveissykler, gravelsykler, terrengsykler, elsykler og barnesykler. Hos BikeLink finner du hele MMR-programmet, med pris i norske kroner inkludert mva.</p>
      </section>
    </>
  );
}
