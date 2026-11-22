import type { Metadata } from "next";
import { ApplyForm } from "@/components/b2b/Forms";

export const metadata: Metadata = { title: "Søk om B2B-konto", description: "Søk om forhandlerkonto hos BikeLink – offisiell MMR-distributør i Norge.", alternates: { canonical: "/b2b/soknad" } };

export default function Apply() {
  return (
    <div className="wrap section">
      <p className="mono muted">BikeLink B2B</p>
      <h1>Søk om B2B-konto</h1>
      <p className="lead">For sykkelbutikker, verksteder, forhandlere, distribusjonspartnere og kommersiell e-handel. Alle søknader behandles manuelt.</p>
      <ApplyForm />
    </div>
  );
}
