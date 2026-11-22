import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/Blocks";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Kontakt BikeLink",
  description: "Kontakt BikeLink.no på telefon +47 46 41 19 06 eller info@bikelink.no. Hjelp med modell og størrelse, bestilling, levering, service og garanti.",
  alternates: { canonical: "/kontakt" },
};

const MAP = "https://www.google.com/maps/search/?api=1&query=Prost+Krags+veg+29%2C+2080+Eidsvoll";

export default function Contact() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Forside", path: "/" }, { name: "Kontakt", path: "/kontakt" }])} />
      <PageHero eyebrow="Kundeservice" title="Kontakt BikeLink.no" lead="Vi hjelper deg med valg av modell og størrelse, bestillinger, levering, service og garanti.">
        <a className="btn" href="tel:+4746411906">Ring +47 46 41 19 06</a>
        <a className="btn ghost" href="mailto:info@bikelink.no">info@bikelink.no</a>
      </PageHero>
      <section className="wrap section">
        <h2>Slik når du oss</h2>
        <div className="cards3">
          <div className="feature"><h3>Telefon</h3><p><a href="tel:+4746411906">+47 46 41 19 06</a></p><p className="small muted">Ring for råd om modell, størrelse og bestilling.</p></div>
          <div className="feature"><h3>E-post</h3><p><a href="mailto:info@bikelink.no">info@bikelink.no</a></p><p className="small muted">For bestillinger, reklamasjoner og generelle spørsmål.</p></div>
          <div className="feature"><h3>Adresse</h3><p>Prost Krags veg 29<br />2080 Eidsvoll</p><p className="small"><a href={MAP}>Åpne kart →</a> · lager og kontor</p></div>
        </div>
      </section>
      <section className="wrap section">
        <h2>Finn svaret raskere</h2>
        <div className="cards3">
          <Link href="/forhandlere" className="feature"><h3>Finn forhandler</h3><p>Utlevering, showroom og service nær deg.</p></Link>
          <Link href="/service" className="feature"><h3>Service og garanti</h3><p>Slik melder du en garantisak eller reklamasjon.</p></Link>
          <a href="https://bikelink.no/policies/refund-policy" className="feature"><h3>Angrerett og retur</h3><p>Slik bruker du angreretten.</p></a>
        </div>
      </section>
    </>
  );
}
