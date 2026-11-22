import Image from "next/image";
import Link from "next/link";
import { buildMenu } from "@/lib/menu";
import { kr } from "@/lib/products";
import { CartLink } from "./CartLink";
import { MobileMenu } from "./MobileMenu";

export function Logo({ white = false, className = "" }: { white?: boolean; className?: string }) {
  return (
    <Link href="/" className={`logo ${className}`} aria-label="BikeLink – til forsiden">
      <Image src={white ? "/logo-white.png" : "/logo.png"} alt="BikeLink.no" width={900} height={145} priority sizes="160px" />
    </Link>
  );
}

const PLAIN = [
  { href: "/forhandlere", label: "Forhandlere" },
  { href: "/service", label: "Service" },
  { href: "/om-oss", label: "Om oss" },
];

export function Header() {
  const menu = buildMenu();
  return (
    <>
      <div className="announce">Kjøp online – hent ferdig montert hos din nærmeste MMR-forhandler</div>
      <header className="header">
        <div className="wrap header-row">
          <MobileMenu menu={menu.map(({ id, name, title, families }) => ({ id, name, title, families }))} />
          <Logo />
          <nav aria-label="Hovedmeny" className="nav">
            {menu.map((c) => (
              <div className="nav-item" key={c.id} data-menu={c.id}>
                <Link href={`/${c.id}`} className="nav-link">{c.name}</Link>
                <div className="mega" role="region" aria-label={c.title}>
                  <div className="wrap mega-grid">
                    <div className="mega-col">
                      <p className="mega-h">Modeller</p>
                      <ul>
                        {c.families.map((f) => (
                          <li key={f.anchor}><Link href={`/${c.id}#${f.anchor}`}>MMR {f.name} <span>{f.count}</span></Link></li>
                        ))}
                      </ul>
                      <Link href={`/${c.id}`} className="mega-all">Se alle {c.name.toLowerCase()} →</Link>
                    </div>
                    <div className="mega-feat">
                      <p className="mega-h">På lager nå</p>
                      <div className="mega-cards">
                        {c.featured.map((p) => (
                          <Link key={p.handle} href={`/sykkel/${p.handle}`} className="mega-card">
                            <span className="mega-img"><Image src={p.image} alt="" width={p.width} height={p.height} sizes="220px" /></span>
                            <strong>{p.title}</strong>
                            <small>Fra {kr(p.fromOre)}</small>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="mega-promo">
                      <p className="mega-h">{c.title}</p>
                      <p>{c.intro}</p>
                      <p className="small muted">{c.count} modeller · fra {kr(c.from)}</p>
                      <Link href="/forhandlere" className="btn sm">Finn forhandler</Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {PLAIN.map((l) => (
              <div className="nav-item" key={l.href}><Link href={l.href} className="nav-link">{l.label}</Link></div>
            ))}
          </nav>
          <div className="header-end">
            <a className="btn sm dark" href="https://app.spokesworkshop.com/book/bikelink">Bestill verksted</a>
            <CartLink />
          </div>
        </div>
      </header>
    </>
  );
}
