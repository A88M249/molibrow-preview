import Link from "next/link";
import { CATEGORIES, CATEGORY_IDS } from "@/lib/products";

// Pages not rebuilt yet stay on the current shop during the transition.
const OLD = "https://bikelink.no/pages";
export const LINKS = { dealers: `${OLD}/showroom-partners`, service: `${OLD}/service`, about: `${OLD}/dette-er-bikelink-no`, contact: `${OLD}/contact` };

export function Header() {
  return (
    <>
      <div className="announce">Kjøp online – hent hos din nærmeste MMR-forhandler</div>
      <header className="header">
        <div className="wrap header-row">
          <Link href="/" className="logo" aria-label="BikeLink forside">BikeLink<span>.no</span></Link>
          <nav aria-label="Hovedmeny" className="nav">
            {CATEGORY_IDS.map((c) => <Link key={c} href={`/${c}`}>{CATEGORIES[c].name}</Link>)}
            <a href={LINKS.dealers}>Finn forhandler</a>
            <a href={LINKS.service}>Service</a>
          </nav>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <strong>BikeLink.no</strong>
          <p>Offisiell importør og distributør av MMR Bikes i Norge.</p>
        </div>
        <div>
          <strong>Sykler</strong>
          {CATEGORY_IDS.map((c) => <Link key={c} href={`/${c}`}>{CATEGORIES[c].title}</Link>)}
        </div>
        <div>
          <strong>BikeLink</strong>
          <a href={LINKS.dealers}>Finn forhandler</a>
          <a href={LINKS.service}>Service og verksted</a>
          <a href={LINKS.about}>Om oss</a>
          <a href={LINKS.contact}>Kontakt</a>
        </div>
        <div>
          <strong>For søk og AI</strong>
          <a href="/llms.txt">llms.txt</a>
          <a href="/feed.xml">Produktfeed</a>
          <a href="/sitemap.xml">Sitemap</a>
        </div>
      </div>
    </footer>
  );
}
