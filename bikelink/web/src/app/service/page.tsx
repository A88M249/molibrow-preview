import type { Metadata } from "next";
import { LIFE } from "@/lib/life";
import { Faq, PageHero, Steps } from "@/components/Blocks";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Service, garanti og reklamasjon",
  description: "Slik fungerer garanti og reklamasjon for sykler kjøpt hos BikeLink: 2 eller 5 års reklamasjonsrett, produsentgaranti og service hos autoriserte verksteder.",
  alternates: { canonical: "/service" },
};

const FAQ = [
  { q: "Hva er forskjellen på garanti og reklamasjon?", a: "Reklamasjonsretten følger av forbrukerkjøpsloven og gjelder mangler som fantes da du fikk varen. Garanti er et frivillig tillegg fra produsenten eller selgeren, og kommer i tillegg til reklamasjonsretten." },
  { q: "Hvor lenge kan jeg reklamere på en sykkel?", a: "Fristen er 2 år, eller 5 år for varer som ved vanlig bruk er ment å vare vesentlig lenger, slik som sykler og rammesett. Du må reklamere innen rimelig tid etter at du oppdaget feilen – alltid tidsnok innen 2 måneder." },
  { q: "Hva dekkes ikke?", a: "Normal slitasje, skader etter uhell, feil bruk, manglende vedlikehold eller uautoriserte endringer, og slitedeler som bremseklosser, dekk og kjeder." },
  { q: "Hvor får jeg service?", a: "Hos verkstedpartnerne våre. Bestill service hos vår partner, eller se forhandlere og serviceverksteder." },
];

export default function Service() {
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Forside", path: "/" }, { name: "Service og garanti", path: "/service" }])} />
      <PageHero photo={LIFE.detailDark} position="50% 50%" eyebrow="Trygg handel hos BikeLink.no" title="Service, garanti og reklamasjon" lead="En samlet oversikt over garanti og reklamasjon for sykler, rammesett og komponenter kjøpt hos BikeLink.no – og hvor du får service.">
        <a className="btn" href="mailto:info@bikelink.no?subject=Garanti%2Freklamasjon">Meld en sak</a>
        <a className="btn ghost" href="https://app.spokesworkshop.com/book/bikelink">Bestill verksted</a>
      </PageHero>
      <section className="wrap section">
        <h2>Rettighetene dine i korte trekk</h2>
        <div className="cards3">
          <div className="feature"><h3>Reklamasjon 2 eller 5 år</h3><p>Etter forbrukerkjøpsloven kan du reklamere i inntil 5 år på varer som er ment å vare vesentlig lenger enn 2 år, som sykler og rammesett – ellers 2 år.</p></div>
          <div className="feature"><h3>Produsentgaranti</h3><p>Garanti fra produsenten kommer i tillegg til reklamasjonsretten og begrenser den ikke.</p></div>
          <div className="feature"><h3>Vi hjelper deg</h3><p>BikeLink er bindeleddet mellom deg og produsenten.</p></div>
        </div>
      </section>
      <Steps title="Slik melder du en garantisak eller reklamasjon" items={[
        { t: "Kontakt oss", d: "Send e-post til info@bikelink.no." },
        { t: "Legg ved kjøpsbevis", d: "Dokumenter når og hvor du kjøpte sykkelen." },
        { t: "Send bilder eller video", d: "Vis feilen tydelig." },
        { t: "Vi vurderer saken", d: "Fagavdelingen vurderer saken og forteller deg hva som skjer videre." },
      ]} />
      <section className="wrap section split">
        <div className="feature"><h3>Dette dekkes</h3><ul className="ticks"><li>Produksjonsfeil i materialer og utførelse</li><li>Strukturell integritet på rammer og sentrale komponenter (der dette er relevant)</li><li>Feil som var til stede da sykkelen ble levert</li></ul></div>
        <div className="feature"><h3>Dette dekkes ikke</h3><ul className="crosses"><li>Normal slitasje</li><li>Skader etter uhell, feilmontering, feil bruk eller manglende vedlikehold</li><li>Uautoriserte modifikasjoner eller reparasjoner</li><li>Korrosjon, rust eller kosmetiske skader som ikke påvirker funksjon</li><li>Forbruksdeler som bremseklosser, dekk, kjeder, lager og grep</li></ul></div>
      </section>
      <section className="wrap section"><div className="cta"><div><h2>Service hos autoriserte verksteder</h2><p>BikeLink samarbeider med kvalitetssikrede verkstedpartnere over hele Norge for service, reparasjoner og teknisk oppfølging.</p></div><a className="btn light" href="https://app.spokesworkshop.com/book/bikelink">Bestill verkstedtime</a></div></section>
      <Faq title="Spørsmål om garanti og service" items={FAQ} />
    </>
  );
}
