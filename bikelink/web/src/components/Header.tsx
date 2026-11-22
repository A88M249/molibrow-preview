import Image from "next/image";
import Link from "next/link";
import { buildMenu } from "@/lib/menu";
import { kr } from "@/lib/products";
import { CartLink } from "./CartLink";
import { MobileMenu } from "./MobileMenu";

/** Both logo colours are rendered; CSS shows the one that fits the header state. */
export function Logo({ white = false, className = "" }: { white?: boolean; className?: string }) {
  return (
    <Link href="/" className={`logo ${className}`} aria-label="BikeLink – til forsiden">
      {!white && <Image className="logo-dark" src="/logo.png" alt="BikeLink.no" width={900} height={145} priority sizes="170px" />}
      <Image className="logo-light" src="/logo-white.png" alt={white ? "BikeLink.no" : ""} aria-hidden={!white} width={900} height={145} priority sizes="170px" />
    </Link>
  );
}

const INFO = [
  { href: "/om-oss", label: "Om BikeLink", d: "Offisiell MMR-distributør i Norge" },
  { href: "/forhandlere", label: "Finn forhandler", d: "Showroom, utlevering og verksted" },
  { href: "/service", label: "Service og garanti", d: "Reklamasjon, garanti og verksteder" },
  { href: "/kontakt", label: "Kontakt oss", d: "Telefon, e-post og adresse" },
];

export function Header() {
  const menu = buildMenu();
  const featured = ["landevei", "terreng", "elsykkel"].map((id) => menu.find((m) => m.id === id)!.featured[0]).filter(Boolean);
  return (
    <>
      <div className="announce">Kjøp online – hent ferdig montert hos din nærmeste MMR-forhandler</div>
      <header className="header">
        <div className="header-row">
          <div className="hdr-left">
          <MobileMenu menu={menu.map(({ id, name, title, families }) => ({ id, name, title, families }))} />
          <nav aria-label="Hovedmeny" className="nav">
            <div className="nav-item">
              <Link href="/landevei" className="nav-link"><span>+</span>Sykler</Link>
              <div className="mega" role="region" aria-label="Sykler">
                <div className="wrap mega-grid">
                  <div className="mega-cats">
                    {menu.map((c) => (
                      <div key={c.id} className="mega-cat">
                        <Link href={`/${c.id}`} className="mega-h">{c.name} <i>{c.count}</i></Link>
                        <ul>{c.families.map((f) => <li key={f.anchor}><Link href={`/${c.id}#${f.anchor}`}>{f.name}</Link></li>)}</ul>
                      </div>
                    ))}
                  </div>
                  <div className="mega-feat">
                    {featured.map((p) => (
                      <Link key={p.handle} href={`/sykkel/${p.handle}`} className="mega-card">
                        <span className="mega-img"><Image src={p.image} alt="" width={p.width} height={p.height} sizes="240px" /></span>
                        <strong>{p.title}</strong>
                        <small>Fra {kr(p.fromOre)}</small>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="nav-item">
              <Link href="/om-oss" className="nav-link"><span>+</span>Informasjon</Link>
              <div className="mega small" role="region" aria-label="Informasjon">
                <div className="wrap info-grid">
                  {INFO.map((i) => <Link key={i.href} href={i.href}><strong>{i.label}</strong><small>{i.d}</small></Link>)}
                </div>
              </div>
            </div>
            <div className="nav-item"><a className="nav-link" href="https://app.spokesworkshop.com/book/bikelink">Bestill verksted</a></div>
          </nav>
          </div>
          <Logo className="logo-center" />
          <div className="header-end"><CartLink /></div>
        </div>
      </header>
    </>
  );
}
