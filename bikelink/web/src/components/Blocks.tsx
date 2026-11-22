import type { ReactNode } from "react";
import { JsonLd } from "./JsonLd";
import { faqLd } from "@/lib/seo";

export function PageHero({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead: string; children?: ReactNode }) {
  return (
    <section className="page-hero">
      <div className="wrap">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lead">{lead}</p>
        {children && <div className="btn-row">{children}</div>}
      </div>
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
