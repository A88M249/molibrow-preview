import type { Metadata } from "next";
import { LegalDoc, type LegalData } from "@/components/LegalDoc";
import doc from "../../../data/legal/juridisk.json";

export const metadata: Metadata = { title: "Juridisk merknad", description: "Juridisk merknad og informasjonskapsler for BikeLink.no.", alternates: { canonical: "/juridisk" } };

export default function Page() {
  return <LegalDoc doc={doc as LegalData} />;
}
