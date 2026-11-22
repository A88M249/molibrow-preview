import type { Metadata } from "next";
import { AdminActivate } from "@/components/b2b/AdminLogin";

export const metadata: Metadata = { title: "Opprett passord – back-office", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <div className="wrap section">
      <p className="mono muted">Back-office</p>
      <h1>Opprett passord</h1>
      <AdminActivate />
    </div>
  );
}
