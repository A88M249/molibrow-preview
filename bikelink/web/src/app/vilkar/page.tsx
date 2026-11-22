import type { Metadata } from "next";
import { LegalDoc, type LegalData } from "@/components/LegalDoc";
import doc from "../../../data/legal/vilkar.json";

export const metadata: Metadata = { title: "Vilkår for bruk", description: "Vilkår og betingelser for kjøp og bruk av BikeLink.no.", alternates: { canonical: "/vilkar" } };

export default function Page() {
  return <LegalDoc doc={doc as LegalData} />;
}
