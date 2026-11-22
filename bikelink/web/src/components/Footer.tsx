import Link from "next/link";
import { CATEGORIES, CATEGORY_IDS } from "@/lib/products";
import { Logo } from "./Header";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <Logo white />
          <p>Offisiell importør og distributør av MMR Bikes i Norge.</p>
          <p className="small"><a href="tel:+4746411906">+47 46 41 19 06</a><br /><a href="mailto:info@bikelink.no">info@bikelink.no</a></p>
        </div>
        <div>
          <strong>Sykler</strong>
          {CATEGORY_IDS.map((c) => <Link key={c} href={`/${c}`}>{CATEGORIES[c].title}</Link>)}
        </div>
        <div>
          <strong>Kundeservice</strong>
          <Link href="/forhandlere">Finn forhandler</Link>
          <Link href="/service">Service og garanti</Link>
          <Link href="/sykkelinnbytte">Sykkelinnbytte</Link>
          <Link href="/kontakt">Kontakt oss</Link>
          <Link href="/b2b">Bli forhandler (B2B)</Link>
        </div>
        <div>
          <strong>Retningslinjer</strong>
          <Link href="/vilkar">Kjøpsvilkår</Link>
          <Link href="/angrerett">Angrerett og retur</Link>
          <Link href="/frakt">Frakt og levering</Link>
          <Link href="/personvern">Personvern</Link>
          <Link href="/juridisk">Juridisk merknad</Link>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>BikeLink AS · Prost Krags veg 29, 2080 Eidsvoll · Org.nr. 935 095 034 MVA</span>
        <span><a href="/llms.txt">llms.txt</a> · <a href="/feed.xml">Produktfeed</a> · <a href="/sitemap.xml">Sitemap</a></span>
      </div>
    </footer>
  );
}
