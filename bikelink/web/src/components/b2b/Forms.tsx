"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEALER_KEY, api, setToken } from "@/lib/b2b";

function useSubmit<T extends unknown[]>(fn: (...a: T) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (...a: T) => {
    setBusy(true); setError("");
    try { await fn(...a); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  return { busy, error, run };
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="field">{label}{children}</label>;

export function ApplyForm() {
  const [done, setDone] = useState(false);
  const { busy, error, run } = useSubmit(async (f: HTMLFormElement) => {
    const v = Object.fromEntries(new FormData(f)) as Record<string, string>;
    await api("/b2b/apply", { body: { company: v.company, orgNr: v.orgNr, contactName: v.contactName, email: v.email, phone: v.phone, address: v.address, businessType: v.businessType, website: v.website || undefined, message: v.message || undefined } });
    setDone(true);
  });
  if (done) return <div className="notice ok"><h2>Takk for søknaden!</h2><p>Alle søknader behandles manuelt. Du får en e-post med lenke til å opprette passord når kontoen er godkjent.</p></div>;
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); run(e.currentTarget); }}>
      <div className="form-grid">
        <Field label="Firmanavn *"><input name="company" required minLength={2} maxLength={120} autoComplete="organization" /></Field>
        <Field label="Organisasjonsnummer *"><input name="orgNr" required inputMode="numeric" placeholder="9 siffer" /></Field>
        <Field label="Kontaktperson *"><input name="contactName" required autoComplete="name" /></Field>
        <Field label="E-post *"><input name="email" type="email" required autoComplete="email" /></Field>
        <Field label="Telefon *"><input name="phone" type="tel" required autoComplete="tel" /></Field>
        <Field label="Type virksomhet *">
          <select name="businessType" required defaultValue="">
            <option value="" disabled>Velg …</option><option>Sykkelbutikk</option><option>Verksted</option><option>Forhandler</option><option>Distribusjonspartner</option><option>Kommersiell e-handel</option>
          </select>
        </Field>
        <Field label="Adresse (gate, postnr. og sted) *"><input name="address" required autoComplete="street-address" /></Field>
        <Field label="Nettside"><input name="website" type="url" placeholder="https://" /></Field>
      </div>
      <Field label="Melding"><textarea name="message" rows={4} maxLength={1000} /></Field>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Sender …" : "Send søknad"}</button>
      <p className="small muted">Har du allerede konto? <Link href="/b2b/logg-inn" className="more">Logg inn</Link></p>
    </form>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { busy, error, run } = useSubmit(async (f: HTMLFormElement) => {
    const v = Object.fromEntries(new FormData(f)) as Record<string, string>;
    const r = await api<{ token: string }>("/b2b/login", { body: { email: v.email, password: v.password } });
    setToken(DEALER_KEY, r.token);
    router.push("/b2b/portal");
  });
  return (
    <form className="form narrow" onSubmit={(e) => { e.preventDefault(); run(e.currentTarget); }}>
      <Field label="E-post"><input name="email" type="email" required autoComplete="username" /></Field>
      <Field label="Passord"><input name="password" type="password" required autoComplete="current-password" /></Field>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Logger inn …" : "Logg inn"}</button>
      <p className="small"><Link href="/b2b/glemt" className="more">Glemt passord?</Link> · <Link href="/b2b/soknad" className="more">Søk om B2B-konto</Link></p>
    </form>
  );
}

export function ActivateForm() {
  const [token, setTok] = useState("");
  const [reset, setReset] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { const q = new URLSearchParams(window.location.search); setTok(q.get("token") ?? ""); setReset(q.has("reset")); }, []);
  const { busy, error, run } = useSubmit(async (f: HTMLFormElement) => {
    const v = Object.fromEntries(new FormData(f)) as Record<string, string>;
    if (v.password !== v.confirm) throw new Error("Passordene er ikke like.");
    await api("/b2b/activate", { body: { token, password: v.password } });
    setDone(true);
  });
  if (done) return <div className="notice ok"><h2>Passordet er lagret</h2><p><Link className="btn" href="/b2b/logg-inn">Logg inn</Link></p></div>;
  if (!token) return <div className="notice"><p>Lenken mangler eller er ufullstendig. Åpne lenken fra e-posten på nytt, eller <Link href="/b2b/glemt" className="more">be om en ny</Link>.</p></div>;
  return (
    <form className="form narrow" onSubmit={(e) => { e.preventDefault(); run(e.currentTarget); }}>
      <p className="muted">{reset ? "Velg nytt passord." : "Velkommen! Velg et passord for å åpne forhandlerportalen."} Minst 10 tegn.</p>
      <Field label="Passord"><input name="password" type="password" required minLength={10} autoComplete="new-password" /></Field>
      <Field label="Gjenta passord"><input name="confirm" type="password" required minLength={10} autoComplete="new-password" /></Field>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Lagrer …" : "Lagre passord"}</button>
    </form>
  );
}

export function ForgotForm() {
  const [done, setDone] = useState(false);
  const { busy, error, run } = useSubmit(async (f: HTMLFormElement) => {
    await api("/b2b/forgot", { body: { email: String(new FormData(f).get("email")) } });
    setDone(true);
  });
  if (done) return <div className="notice ok"><p>Hvis e-postadressen har en godkjent konto, er det sendt en lenke for å velge nytt passord. Lenken gjelder i 2 timer.</p></div>;
  return (
    <form className="form narrow" onSubmit={(e) => { e.preventDefault(); run(e.currentTarget); }}>
      <Field label="E-post"><input name="email" type="email" required autoComplete="username" /></Field>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Sender …" : "Send lenke"}</button>
    </form>
  );
}
