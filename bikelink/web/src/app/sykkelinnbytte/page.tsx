import type { Metadata } from "next";
import { PageHero, Steps } from "@/components/Blocks";
import { LIFE } from "@/lib/life";

export const metadata: Metadata = {
  title: "Sykkelinnbytte – selg din brukte sykkel",
  description: "Selg den brukte sykkelen din trygt og enkelt, og bruk verdien som delbetaling på en ny sykkel fra BikeLink. I samarbeid med Sportienda.",
  alternates: { canonical: "/sykkelinnbytte" },
};

const CALC = "https://sportienda.com/no/embed/calculator/bikelink";

export default function Exchange() {
  return (
    <>
      <PageHero photo={LIFE.mtbHardtail} position="50% 55%" eyebrow="I samarbeid med Sportienda" title="Innbytte av brukt sykkel" lead="Selg den brukte sykkelen din trygt og enkelt, og bruk verdien som delbetaling på en ny sykkel fra BikeLink.no.">
        <a className="btn" href="#innbytte">Beregn innbytteverdi</a>
        <a className="btn ghost" href="/landevei">Se alle sykler</a>
      </PageHero>
      <Steps title="Slik fungerer innbytte" items={[
        { t: "Beregn verdien", d: "Bruk kalkulatoren under for å få et anslag på sykkelen din." },
        { t: "Sportienda vurderer", d: "Sportienda håndterer vurdering, salg og videredistribusjon." },
        { t: "Ingen annonsering", d: "Mindre administrasjon og ingen direkte kontakt med kjøpere." },
        { t: "Velg ny sykkel", d: "Bruk verdien som delbetaling på en ny sykkel." },
      ]} />
      <section className="wrap section" id="innbytte">
        <h2>Innbyttekalkulator</h2>
        <p className="muted">Kalkulatoren leveres av Sportienda. <a className="more" href={CALC}>Åpne i eget vindu</a> hvis den ikke vises.</p>
        <iframe className="embed" src={CALC} title="Innbyttekalkulator fra Sportienda" loading="lazy" />
      </section>
      <section className="wrap section prose">
        <h2>Et nytt liv for sykkelen din</h2>
        <p>Innbytteprogrammet er en vinn–vinn-løsning: du gir sykkelen et nytt liv og bruker verdien på en ny sykkel – effektivt, trygt og fremtidsrettet.</p>
      </section>
    </>
  );
}
