"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/b2b";

export type AdminInfo = { email: string; name: string | null; role: "owner" | "staff" };
type Step = { kind: "password" } | { kind: "totp"; challenge: string } | { kind: "enroll"; challenge: string } | { kind: "codes"; codes: string[]; token: string; admin: AdminInfo };

/** Email + password → authenticator code (or first-time setup with QR code and recovery codes). */
export function AdminLogin({ onDone }: { onDone: (token: string, admin: AdminInfo) => void }) {
  const [step, setStep] = useState<Step>({ kind: "password" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(""); try { await fn(); } catch (e) { const m = (e as Error).message; setError(m); if (/utløpt/.test(m)) setStep({ kind: "password" }); } finally { setBusy(false); } };

  return (
    <div className="wrap section">
      <p className="mono muted">Back-office</p>
      <h1>Logg inn</h1>
      {step.kind === "password" && (
        <form className="form narrow" onSubmit={(e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
          run(async () => { const r = await api<{ step: "totp" | "enroll"; challenge: string }>("/admin/auth/login", { body: { email: v.email, password: v.password } }); setStep({ kind: r.step, challenge: r.challenge }); }); }}>
          <label className="field">E-post<input name="email" type="email" required autoComplete="username" autoFocus /></label>
          <label className="field">Passord<input name="password" type="password" required autoComplete="current-password" /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" disabled={busy}>{busy ? "Sjekker …" : "Fortsett"}</button>
        </form>
      )}
      {step.kind === "totp" && <TotpStep challenge={step.challenge} busy={busy} error={error} run={run} onDone={onDone} />}
      {step.kind === "enroll" && <EnrollStep challenge={step.challenge} busy={busy} error={error} run={run} onCodes={(codes, token, admin) => setStep({ kind: "codes", codes, token, admin })} />}
      {step.kind === "codes" && <RecoveryCodes codes={step.codes} onContinue={() => onDone(step.token, step.admin)} />}
    </div>
  );
}

function TotpStep({ challenge, busy, error, run, onDone }: { challenge: string; busy: boolean; error: string; run: (f: () => Promise<void>) => void; onDone: (t: string, a: AdminInfo) => void }) {
  const [recovery, setRecovery] = useState(false);
  return (
    <form className="form narrow" onSubmit={(e) => { e.preventDefault(); const code = String(new FormData(e.currentTarget).get("code"));
      run(async () => { const r = await api<{ token: string; admin: AdminInfo; recoveryCodesLeft?: number }>("/admin/auth/totp", { body: { challenge, code } });
        if (r.recoveryCodesLeft !== undefined) alert(`Gjenopprettingskode brukt. ${r.recoveryCodesLeft} igjen – sett opp autentiseringsappen på nytt hvis du har byttet telefon.`);
        onDone(r.token, r.admin); }); }}>
      <p className="muted">{recovery ? "Skriv inn en av gjenopprettingskodene dine (hver kan brukes én gang)." : "Åpne autentiseringsappen og skriv inn den 6-sifrede koden for BikeLink Admin."}</p>
      <label className="field">{recovery ? "Gjenopprettingskode" : "Kode"}
        <input name="code" required autoFocus autoComplete="one-time-code" inputMode={recovery ? "text" : "numeric"} maxLength={recovery ? 12 : 7} pattern={recovery ? undefined : "[0-9 ]{6,7}"} placeholder={recovery ? "xxxx-xxxx" : "123456"} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Sjekker …" : "Logg inn"}</button>
      <button type="button" className="link" onClick={() => setRecovery(!recovery)}>{recovery ? "Bruk autentiseringsappen" : "Mistet telefonen? Bruk gjenopprettingskode"}</button>
    </form>
  );
}

function EnrollStep({ challenge, busy, error, run, onCodes }: { challenge: string; busy: boolean; error: string; run: (f: () => Promise<void>) => void; onCodes: (codes: string[], token: string, a: AdminInfo) => void }) {
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  useEffect(() => { run(async () => { setSetup(await api("/admin/auth/enroll/start", { body: { challenge } })); }); }, [challenge]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!setup) return <p className="muted">{error || "Gjør klar …"}</p>;
  return (
    <form className="form narrow" onSubmit={(e) => { e.preventDefault(); const code = String(new FormData(e.currentTarget).get("code"));
      run(async () => { const r = await api<{ token: string; admin: AdminInfo; recoveryCodes: string[] }>("/admin/auth/enroll/finish", { body: { challenge, code } }); onCodes(r.recoveryCodes, r.token, r.admin); }); }}>
      <div className="notice"><strong>Sett opp tofaktor-godkjenning (påkrevd)</strong>
        <ol className="small" style={{ paddingLeft: "1.2em" }}>
          <li>Åpne en autentiseringsapp (Google Authenticator, 1Password, Authy, Microsoft Authenticator …).</li>
          <li>Skann QR-koden – eller skriv inn nøkkelen for hånd.</li>
          <li>Skriv inn den 6-sifrede koden appen viser.</li>
        </ol>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="QR-kode for autentiseringsappen" width={220} height={220} src={`data:image/svg+xml;base64,${btoa(setup.qrSvg)}`} style={{ background: "#fff" }} />
        <p className="small">Nøkkel: <code style={{ wordBreak: "break-all" }}>{setup.secret.match(/.{1,4}/g)?.join(" ")}</code></p>
      </div>
      <label className="field">Kode fra appen<input name="code" required autoFocus autoComplete="one-time-code" inputMode="numeric" maxLength={7} pattern="[0-9 ]{6,7}" placeholder="123456" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Sjekker …" : "Bekreft og logg inn"}</button>
    </form>
  );
}

function RecoveryCodes({ codes, onContinue }: { codes: string[]; onContinue: () => void }) {
  const [saved, setSaved] = useState(false);
  return (
    <div className="form narrow">
      <div className="notice ok"><strong>Gjenopprettingskoder</strong>
        <p className="small">Lagre disse et trygt sted (passordbehandler eller utskrift). Hver kode kan brukes én gang hvis du mister telefonen. De vises <strong>kun nå</strong>.</p>
        <pre className="recovery">{codes.join("\n")}</pre>
        <button type="button" className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(codes.join("\n"))}>Kopier</button>
      </div>
      <label className="opt"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> Jeg har lagret kodene</label>
      <button className="btn" disabled={!saved} onClick={onContinue}>Fortsett til back-office</button>
    </div>
  );
}

/** /admin/aktiver?token=… – choose a password after an invitation. */
export function AdminActivate() {
  const [token, setToken] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") ?? ""); }, []);
  if (done) return <div className="notice ok"><h2>Passordet er lagret</h2><p><a className="btn" href="/admin">Logg inn</a></p><p className="small muted">Ved første innlogging setter du opp autentiseringsappen.</p></div>;
  if (!token) return <div className="notice"><p>Lenken mangler eller er ufullstendig. Be en eier om en ny invitasjon.</p></div>;
  return (
    <form className="form narrow" onSubmit={async (e) => { e.preventDefault(); const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      if (v.password !== v.confirm) return setError("Passordene er ikke like.");
      try { await api("/admin/auth/activate", { body: { token, password: v.password } }); setDone(true); } catch (x) { setError((x as Error).message); } }}>
      <p className="muted">Velg et passord på minst 12 tegn. En setning med flere ord fungerer bra.</p>
      <label className="field">Passord<input name="password" type="password" required minLength={12} autoComplete="new-password" /></label>
      <label className="field">Gjenta passord<input name="confirm" type="password" required minLength={12} autoComplete="new-password" /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn">Lagre passord</button>
    </form>
  );
}
