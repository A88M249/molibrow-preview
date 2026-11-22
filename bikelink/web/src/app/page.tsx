import Image from "next/image";
import Link from "next/link";
import { PhotoCard } from "@/components/Blocks";
import { LifeImage } from "@/components/LifeImage";
import { ProductCard } from "@/components/ProductCard";
import { Slider } from "@/components/Slider";
import { CITIES } from "@/lib/dealers";
import { LIFE } from "@/lib/life";
import { CATEGORIES, CATEGORY_IDS, inCategory, isAvailable, kr, priceRange, products } from "@/lib/products";

const firstAvailable = (c: (typeof CATEGORY_IDS)[number]) => inCategory(c).find((p) => isAvailable(p) && !p.needsReview) ?? inCategory(c)[0];

export default function Home() {
  const feature = firstAvailable("landevei");
  const picks = products.filter((p) => isAvailable(p) && !p.needsReview).slice(0, 12);

  return (
    <>
      <section className="hero-full">
        <LifeImage photo={LIFE.mountains} priority position="50% 35%" />
        <div className="hero-shade" />
        <div className="wrap hero-captions">
          <div className="cap">
            <p className="mono">Offisiell importør av MMR Bikes</p>
            <h1>Spansk ingeniørkunst. Klar for norske veier og stier.</h1>
            <Link className="pill" href="/landevei" aria-label="Se alle sykler">Se alle sykler <span>→</span></Link>
          </div>
          <div className="cap right">
            <h2>{feature.title.replace(/^MMR\s+/, "")}</h2>
            <p className="mono">MMR Bikes® · fra {kr(priceRange(feature).low)}</p>
            <Link className="pill" href={`/sykkel/${feature.handle}`} aria-label={`Se ${feature.title}`}><span>→</span></Link>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <div className="section-head"><h2>Velg sykkeltype</h2><span className="mono muted">{products.length} modeller</span></div>
        <div className="tiles">
          {CATEGORY_IDS.map((c) => {
            const p = firstAvailable(c);
            const img = p.images[0];
            return (
              <Link key={c} href={`/${c}`} className="tile">
                <span className="mono">+ {CATEGORIES[c].name}</span>
                <Image src={img.src} alt="" width={img.width} height={img.height} sizes="(max-width:700px) 50vw, 20vw" />
                <small className="mono muted">{inCategory(c).length} modeller</small>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="editorial">
        <div className="editorial-img"><LifeImage photo={LIFE.hilltop} position="60% 50%" sizes="(max-width:900px) 100vw, 55vw" /></div>
        <div className="editorial-copy">
          <p className="mono">MMR Bikes®</p>
          <h2>Fra Asturias, med røtter i konkurransesykling</h2>
          <p>MMR er et spansk sykkelmerke som lager landeveissykler, gravelsykler, terrengsykler, elsykler og barnesykler. BikeLink er offisiell importør og distributør i Norge.</p>
          <Link className="btn ghost" href="/om-oss">Om BikeLink</Link>
        </div>
      </section>

      <Slider title="På lager nå" link={<Link href="/landevei" className="mono more">Se hele utvalget →</Link>}>
        {picks.map((p, i) => <div className="slide" key={p.handle}><ProductCard p={p} priority={i < 4} /></div>)}
      </Slider>

      <section className="hero-full band-photo">
        <LifeImage photo={LIFE.curve} position="60% 50%" />
        <div className="hero-shade strong" />
        <div className="wrap band-body">
          <p className="mono">Fra klikk til første tur</p>
          <h2>Kjøp på nett – hent lokalt</h2>
          <ol className="steps-line">
            <li><span className="mono">01</span><strong>Velg sykkel</strong><p>Spesifikasjoner, geometri og størrelsesguide.</p></li>
            <li><span className="mono">02</span><strong>Velg utleveringssted</strong><p>Hent hos en MMR-forhandler nær deg.</p></li>
            <li><span className="mono">03</span><strong>Ferdig montert</strong><p>Montert og kontrollert før den leveres.</p></li>
            <li><span className="mono">04</span><strong>Service etterpå</strong><p>Hos autoriserte verkstedpartnere.</p></li>
          </ol>
          <div className="btn-row"><Link className="btn light" href="/forhandlere">Finn forhandler</Link><span className="mono">{CITIES.join(" · ")}</span></div>
        </div>
      </section>

      <section className="wrap section photo-pair">
        <PhotoCard photo={LIFE.aelionDetail} href="/service" label="Trygghet" title="Service og garanti" position="50% 50%" />
        <PhotoCard photo={LIFE.face} href="/forhandlere" label="Forhandlere" title="Se og prøv hos en MMR-partner" position="50% 40%" />
      </section>

      <section className="wrap section prose">
        <h2>MMR-sykler i Norge</h2>
        <p>BikeLink er offisiell importør og distributør av MMR Bikes i Norge. MMR er et spansk sykkelmerke fra Asturias med røtter i konkurransesykling, og lager landeveissykler, gravelsykler, terrengsykler, elsykler og barnesykler. Hos BikeLink finner du hele MMR-programmet, med pris i norske kroner inkludert mva.</p>
      </section>
    </>
  );
}
