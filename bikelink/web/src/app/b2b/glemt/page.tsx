import type { Metadata } from "next";
import { ForgotForm } from "@/components/b2b/Forms";

export const metadata: Metadata = { title: "Glemt passord – forhandlerportal", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <div className="wrap section">
      <p className="mono muted">BikeLink B2B</p>
      <h1>Glemt passord</h1>
      <ForgotForm />
    </div>
  );
}
