import type { Metadata } from "next";
import { LoginForm } from "@/components/b2b/Forms";

export const metadata: Metadata = { title: "Logg inn – forhandlerportal", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <div className="wrap section">
      <p className="mono muted">BikeLink B2B</p>
      <h1>Forhandlerportal</h1>
      <LoginForm />
    </div>
  );
}
