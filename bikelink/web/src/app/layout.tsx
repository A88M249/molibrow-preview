import type { Metadata } from "next";
import { Footer, Header } from "@/components/Chrome";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL, organizationLd, websiteLd } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "MMR-sykler i Norge – landevei, gravel, terreng og el | BikeLink", template: `%s | ${SITE_NAME}` },
  description: "BikeLink er offisiell importør av MMR Bikes i Norge. Landeveissykler, gravelsykler, terrengsykler og elsykler. Kjøp online og hent hos forhandler.",
  openGraph: { siteName: SITE_NAME, locale: "nb_NO", type: "website" },
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body>
        <JsonLd data={organizationLd} />
        <JsonLd data={websiteLd} />
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
