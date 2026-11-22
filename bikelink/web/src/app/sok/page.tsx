import type { Metadata } from "next";
import { SearchBox } from "@/components/SearchBox";

export const metadata: Metadata = { title: "Søk i MMR-syklene", robots: { index: false, follow: true } };

export default function Search() {
  return (
    <div className="wrap section">
      <p className="mono muted">Søk</p>
      <h1>Finn din MMR</h1>
      <SearchBox />
    </div>
  );
}
