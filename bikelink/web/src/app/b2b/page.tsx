import type { Metadata } from "next";
import { PageHero, Steps } from "@/components/Blocks";
import { LIFE } from "@/lib/life";

export const metadata: Metadata = {
  title: "Bli MMR-forhandler – B2B",
  description: "BikeLink er offisiell distributør av MMR Bikes i Norge og leverer sykler, rammesett og originale reservedeler til autoriserte forhandlere.",
  alternates: { canonical: "/b2b" },
};

const APPLY = "/b2b/soknad";

export default function B2B() {
  return (
    <>
      <PageHero photo={LIFE.roadRidge} position="50% 45%" eyebrow="BikeLink.no B2B-portal" title="Bli MMR-forhandler" lead="BikeLink.no er offisiell distributør av MMR Bikes i Norge og leverer sykler, rammesett og originale reservedeler til autoriserte forhandlere over hele landet.">
        <a className="btn" href={APPLY}>Søk om B2B-konto</a>
        <a className="btn ghost" href="/b2b/logg-inn">Logg inn</a>
      </PageHero>
      <section className="wrap section">
        <h2>Hva du får som partner</h2>
        <p className="lead">Gjennom B2B-portalen får sykkelbutikker og verksteder en effektiv bestillingsløsning, utviklet for å gjøre innkjøp enklere, raskere og mer oversiktlige.</p>
        <div className="cards3">
          <div className="feature"><h3>Grossistpriser</h3><p>Forhandlerpriser og oppdaterte prislister.</p></div>
          <div className="feature"><h3>Lagerstatus i sanntid</h3><p>Se tilgjengelighet før du bestiller.</p></div>
          <div className="feature"><h3>Produktinformasjon</h3><p>Spesifikasjoner og ordreoversikt samlet.</p></div>
        </div>
      </section>
      <Steps title="Slik blir du forhandler" items={[
        { t: "Send søknad", d: "Fyll ut søknadsskjemaet med firmaopplysninger." },
        { t: "Manuell behandling", d: "Alle søknader behandles manuelt for å sikre riktig tilgang og prisstruktur." },
        { t: "Full tilgang", d: "Når kontoen er godkjent, får du en lenke for å opprette passord – og tilgang til sortiment, priser, lagerstatus og ordreoversikt." },
      ]} />
      <section className="wrap section">
        <div className="cta"><div><h2>Søk om B2B-konto</h2><p><strong>Hvem kan registrere seg:</strong> sykkelbutikker, verksteder, forhandlere, distribusjonspartnere og kommersiell e-handel.</p></div><a className="btn light" href={APPLY}>Send søknad</a></div>
      </section>
    </>
  );
}
