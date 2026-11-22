import type { Metadata } from "next";
import { LegalDoc, type LegalData } from "@/components/LegalDoc";
import doc from "../../../data/legal/angrerett.json";

export const metadata: Metadata = { title: "Angrerett, retur og refusjon", description: "Slik bruker du angreretten og returnerer en bestilling fra BikeLink.no.", alternates: { canonical: "/angrerett" } };

export default function Page() {
  return <LegalDoc doc={doc as LegalData} />;
}
