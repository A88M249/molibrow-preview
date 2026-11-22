import type { ReactNode } from "react";
import type { Photo } from "@/lib/life";
import { JsonLd } from "./JsonLd";
import { LifeImage } from "./LifeImage";
import { faqLd } from "@/lib/seo";

export function PageHero({ eyebrow, title, lead, photo, position, children }: { eyebrow: string; title: string; lead: string; photo?: Photo; position?: string; children?: ReactNode }) {
  const body = (
    <div className="wrap hero-body">
      <p className="mono">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
      {children && <div className="btn-row">{children}</div>}
    </div>
  );
  if (!photo) return <section className="page-hero">{body}</section>;
  return (
    <section className="hero-full compact">
      <LifeImage photo={photo} priority position={position} />
      <div className="hero-shade" />
      {body}
    </section>
  );
}

export function Steps({ title, items }: { title: string; items: { t: string; d: string }[] }) {
  return (
    <section className="wrap section">
      <h2>{title}</h2>
      <ol className="steps">
        {items.map((s, i) => (
          <li key={s.t}><span className="num">{String(i + 1).padStart(2, "0")}</span><strong>{s.t}</strong><p>{s.d}</p></li>
        ))}
      </ol>
    </section>
  );
}

export function Faq({ title, items }: { title: string; items: { q: string; a: string }[] }) {
  return (
    <section className="wrap section faq">
      <JsonLd data={faqLd(items)} />
      <h2>{title}</h2>
      {items.map((i) => (
        <details key={i.q}><summary>{i.q}</summary><p>{i.a}</p></details>
      ))}
    </section>
  );
}

/** Image card with caption on the photo. */
export function PhotoCard({ photo, href, label, title, position }: { photo: Photo; href: string; label: string; title: string; position?: string }) {
  return (
    <a href={href} className="photo-card">
      <LifeImage photo={photo} position={position} sizes="(max-width:900px) 100vw, 50vw" />
      <div className="hero-shade" />
      <span className="photo-cap"><small className="mono">{label}</small><strong>{title}</strong></span>
    </a>
  );
}
