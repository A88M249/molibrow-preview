import { Fragment } from "react";
import { JsonLd } from "./JsonLd";
import { breadcrumbLd } from "@/lib/seo";

type Inline = { t?: string; b?: boolean; i?: boolean; href?: string; br?: boolean };
type Block = { type: "h2" | "h3" | "h4" | "p" | "hr" | "ul" | "ol"; inline?: Inline[]; items?: Inline[][] };
export type LegalData = { slug: string; title: string; source: string; blocks: Block[] };

function Inl({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, k) => {
        if (n.br) return <br key={k} />;
        let el: React.ReactNode = n.t;
        if (n.b) el = <strong>{el}</strong>;
        if (n.i) el = <em>{el}</em>;
        if (n.href) el = <a href={n.href} {...(n.href.startsWith("http") ? { rel: "noopener" } : {})}>{el}</a>;
        return <Fragment key={k}>{el}</Fragment>;
      })}
    </>
  );
}

/** Renders imported policy text (structured blocks, never raw HTML). */
export function LegalDoc({ doc }: { doc: LegalData }) {
  return (
    <div className="wrap section legal">
      <JsonLd data={breadcrumbLd([{ name: "Forside", path: "/" }, { name: doc.title, path: `/${doc.slug}` }])} />
      <p className="mono muted">BikeLink.no</p>
      <h1>{doc.title}</h1>
      <div className="prose">
        {doc.blocks.map((b, i) => {
          switch (b.type) {
            case "hr": return <hr key={i} />;
            case "h2": return <h2 key={i}><Inl nodes={b.inline!} /></h2>;
            case "h3": return <h3 key={i}><Inl nodes={b.inline!} /></h3>;
            case "h4": return <h4 key={i}><Inl nodes={b.inline!} /></h4>;
            case "p": return <p key={i}><Inl nodes={b.inline!} /></p>;
            case "ul": return <ul key={i}>{b.items!.map((it, k) => <li key={k}><Inl nodes={it} /></li>)}</ul>;
            case "ol": return <ol key={i}>{b.items!.map((it, k) => <li key={k}><Inl nodes={it} /></li>)}</ol>;
          }
        })}
      </div>
    </div>
  );
}
