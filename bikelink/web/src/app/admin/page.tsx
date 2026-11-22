import type { Metadata } from "next";
import { AdminApp } from "@/components/b2b/Admin";

export const metadata: Metadata = { title: "Back-office", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminApp />;
}
