"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { id: string; name: string; title: string; families: { name: string; anchor: string }[] };

export function MobileMenu({ menu }: { menu: Item[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [open]);
  const close = () => setOpen(false);

  return (
    <div className="mobile-menu">
      <button className="icon-btn" aria-label={open ? "Lukk meny" : "Åpne meny"} aria-expanded={open} aria-controls="mobile-drawer" onClick={() => setOpen(!open)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div id="mobile-drawer" className="drawer" role="dialog" aria-modal="true" aria-label="Meny">
          {menu.map((c) => (
            <details key={c.id}>
              <summary>{c.name}</summary>
              <ul>
                <li><Link href={`/${c.id}`} onClick={close}>Alle {c.name.toLowerCase()}</Link></li>
                {c.families.map((f) => <li key={f.anchor}><Link href={`/${c.id}#${f.anchor}`} onClick={close}>MMR {f.name}</Link></li>)}
              </ul>
            </details>
          ))}
          <Link className="drawer-link" href="/sok" onClick={close}>Søk</Link>
          <Link className="drawer-link" href="/forhandlere" onClick={close}>Forhandlere</Link>
          <Link className="drawer-link" href="/service" onClick={close}>Service og garanti</Link>
          <Link className="drawer-link" href="/om-oss" onClick={close}>Om oss</Link>
          <Link className="drawer-link" href="/kontakt" onClick={close}>Kontakt</Link>
          <a className="btn block" href="https://app.spokesworkshop.com/book/bikelink">Bestill verksted</a>
        </div>
      )}
    </div>
  );
}
