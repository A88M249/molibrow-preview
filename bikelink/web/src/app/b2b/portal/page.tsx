import type { Metadata } from "next";
import { Portal } from "@/components/b2b/Portal";

export const metadata: Metadata = { title: "Forhandlerportal", robots: { index: false, follow: false } };

export default function Page() {
  return <Portal />;
}
