import type { Metadata } from "next";
import Link from "next/link";
import { LIFE } from "@/lib/life";
import { PageHero, Steps } from "@/components/Blocks";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Om BikeLink – offisiell MMR-distributør i Norge",
  description: "BikeLink.no er offisiell distributør av MMR Bikes i Norge. Netthandel kombinert med ferdig montering, utlevering og service hos partnere over hele landet.",
  alternates: { canonical: "/om-oss" },
};

export default function About() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Forside", path: "/" }, { name: "Om oss", path: "/om-oss" }])} />
      <PageHero photo={LIFE.roadMountain} position="50% 55%" eyebrow="Om oss" title="Dette er BikeLink.no" lead="BikeLink.no er offisiell distributør av MMR Bikes i Norge. Vi kombinerer netthandel med ferdig montering, utlevering og service hos partnere over hele landet.">
        <Link className="btn" href="/landevei">Se alle sykler</Link>
        <Link className="btn ghost" href="/forhandlere">Finn forhandler</Link>
      </PageHero>
      <section className="wrap section split">
        <div className="prose">
          <h2>Mer enn bare sykler</h2>
          <p>Hos BikeLink.no tror vi at hver sykkel har sin egen historie – og at hver rytter fortjener å kjenne den. BikeLink.no er grunnlagt på lidenskap for sykling og et sterkt fokus på åpenhet.</p>
          <p>Målet vårt er å tilby mer enn bare sykler: en opplevelse som løfter fram kvalitet, håndverk og historien bak hvert produkt – fra bestilling til ferdig montert sykkel.</p>
        </div>
        <ul className="values">
          <li><strong>Offisiell MMR-distributør</strong>Du handler direkte fra importøren av MMR Bikes i Norge.</li>
          <li><strong>Montert og kontrollert</strong>Hver sykkel monteres og kvalitetssikres før den leveres.</li>
          <li><strong>Trygg levering</strong>Logistikk og levering i samarbeid med vårt lager- og logistikkmiljø.</li>
          <li><strong>Personlig veiledning</strong>Råd basert på behov, mål og underlag.</li>
        </ul>
      </section>
      <Steps title="Slik handler du hos BikeLink" items={[
        { t: "Velg sykkel på nett", d: "Se hele MMR-utvalget med spesifikasjoner, geometri og størrelsesguide." },
        { t: "Velg utleveringssted", d: "Hent sykkelen hos en MMR-forhandler nær deg." },
        { t: "Ferdig montert", d: "Sykkelen er montert og klar til bruk når du henter den." },
        { t: "Service etterpå", d: "Service og reparasjoner hos våre autoriserte verkstedpartnere." },
      ]} />
      <section className="wrap section prose">
        <h2>Oppdrag og visjon</h2>
        <p>Oppdraget vårt er å knytte syklister sammen med sykler der kvalitet og håndverk står i sentrum, og å gi en eksepsjonell kundeopplevelse gjennom et nøye kuratert utvalg. Vi ønsker å bygge et fellesskap som verdsetter autentisitet, ytelse og bærekraft på hver eneste tur.</p>
        <p>MMR Bikes er et spansk sykkelmerke fra Asturias med røtter i konkurransesykling.</p>
      </section>
    </>
  );
}
