import type { Metadata } from "next";
import { LegalDoc, type LegalData } from "@/components/LegalDoc";
import doc from "../../../data/legal/personvern.json";

export const metadata: Metadata = { title: "Personvernerklæring", description: "Hvordan BikeLink.no behandler personopplysninger.", alternates: { canonical: "/personvern" } };

export default function Page() {
  return <LegalDoc doc={doc as LegalData} />;
}
