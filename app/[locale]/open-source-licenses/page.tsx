import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Open Source Licenses | Orkest",
  description: "Open Source Licenses used by Orkest",
  robots: { index: false, follow: false },
};

export default function OpenSourceLicensesPage() {
  return (
    <LegalPage
      fileName="OPEN_SOURCE_LICENSES.md"
      title="Open Source Licenses"
    />
  );
}
