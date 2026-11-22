import type { Metadata } from "next";
import { LegalDoc, type LegalData } from "@/components/LegalDoc";
import doc from "../../../data/legal/frakt.json";

export const metadata: Metadata = { title: "Frakt og levering", description: "Leveringstider, frakt og sporing hos BikeLink.no.", alternates: { canonical: "/frakt" } };

export default function Page() {
  return <LegalDoc doc={doc as LegalData} />;
}
