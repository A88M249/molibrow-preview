import type { Metadata } from "next";
import { ActivateForm } from "@/components/b2b/Forms";

export const metadata: Metadata = { title: "Opprett passord – forhandlerportal", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <div className="wrap section">
      <p className="mono muted">BikeLink B2B</p>
      <h1>Opprett passord</h1>
      <ActivateForm />
    </div>
  );
}
