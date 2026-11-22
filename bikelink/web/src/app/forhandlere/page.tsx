import type { Metadata } from "next";
import { Faq, PageHero, Steps } from "@/components/Blocks";
import { JsonLd } from "@/components/JsonLd";
import { CITIES, DEALERS, SERVICE_LABEL, mapUrl } from "@/lib/dealers";
import { abs, breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Finn MMR-forhandler – showroom, verksted og utlevering",
  description: "MMR-forhandlere og serviceverksteder i Oslo, Eidsvoll, Bergen, Trondheim og Stavanger. Se syklene, hent nettkjøpet ferdig montert og få service.",
  alternates: { canonical: "/forhandlere" },
};

const FAQ = [
  { q: "Kan jeg se og prøve en MMR før jeg kjøper?", a: "Ja. Showroom-partnerne våre i Oslo, Bergen, Trondheim, Stavanger og Eidsvoll har MMR-sykler du kan se på. Ta gjerne kontakt med butikken først, så vet du hvilke modeller og størrelser de har inne." },
  { q: "Kan jeg kjøpe på nett og hente sykkelen hos en forhandler?", a: "Ja. Du kan kjøpe på nett og hente sykkelen ferdig montert hos en MMR-forhandler nær deg. Partnere merket «Utlevering» tar imot nettkjøp." },
  { q: "Hvor får jeg service på sykkelen?", a: "Verkstedpartnerne merket «Verksted og service» utfører service, reparasjoner og teknisk oppfølging. Bestill service hos vår partner, eller kontakt verkstedet direkte." },
  { q: "Garanti og reklamasjon – hvem kontakter jeg?", a: "Kontakt BikeLink på info@bikelink.no med kjøpsbevis og bilder av feilen." },
  { q: "Er det ingen forhandler nær meg?", a: "Ta kontakt, så finner vi den beste løsningen for levering og service der du bor." },
];

const dealerLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: DEALERS.map((d, i) => ({
    "@type": "ListItem", position: i + 1,
    item: { "@type": "BicycleStore", name: d.name, email: d.email, url: abs("/forhandlere"),
      address: { "@type": "PostalAddress", streetAddress: d.street, postalCode: d.postcode, addressLocality: d.city, addressCountry: "NO" } },
  })),
};

export default function Dealers() {
  return (
    <>
      <JsonLd data={dealerLd} />
      <JsonLd data={breadcrumbLd([{ name: "Forside", path: "/" }, { name: "Finn forhandler", path: "/forhandlere" }])} />
      <PageHero eyebrow="Forhandlere og serviceverksteder" title="Finn din nærmeste MMR-forhandler" lead="BikeLink samarbeider med nøye utvalgte forhandlere og verksteder over hele Norge – for utlevering, service og prøving av MMR-sykler." />
      <section className="wrap section">
        <div className="chips" aria-label="Byer">{CITIES.map((c) => <a key={c} href={`#${c.toLowerCase()}`}>{c}</a>)}</div>
        {CITIES.map((city) => (
          <div key={city} id={city.toLowerCase()}>
            <h2 className="family">{city}</h2>
            <div className="dealer-grid">
              {DEALERS.filter((d) => d.city === city).map((d) => (
                <article key={d.id} className="dealer">
                  <h3>{d.name}</h3>
                  <ul className="pills">{d.services.map((s) => <li key={s}>{SERVICE_LABEL[s]}</li>)}</ul>
                  <p><a href={mapUrl(d)}>{d.street}, {d.postcode} {d.city}</a><br /><a href={`mailto:${d.email}`}>{d.email}</a></p>
                  {d.note && <p className="small muted">{d.note}</p>}
                </article>
              ))}
            </div>
          </div>
        ))}
      </section>
      <Steps title="Slik fungerer det" items={[
        { t: "Ferdig montert", d: "Sykkelen leveres ferdig montert gjennom autoriserte MMR-forhandlere." },
        { t: "Hent lokalt", d: "Hent sykkelen hos en forhandler nær deg." },
        { t: "Se og prøv", d: "Showroom-partnere i fem byer." },
        { t: "Service etterpå", d: "Profesjonell service hos verkstedpartnere." },
      ]} />
      <Faq title="Spørsmål om forhandlere og service" items={FAQ} />
      <section className="wrap section"><div className="cta"><div><h2>Er du sykkelbutikk eller verksted?</h2><p>Bli MMR-forhandler og få tilgang til hele MMR-sortimentet via BikeLinks B2B-portal.</p></div><a className="btn light" href="https://bikelink.no/pages/b2b">Bli forhandler</a></div></section>
    </>
  );
}
