import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | Orkest",
  description: "Terms of Service for Orkest - Your personal task and time orchestration app",
  robots: { index: true, follow: true },
};

export default function TermsOfServicePage() {
  return (
    <LegalPage
      fileName="TERMS_OF_SERVICE.md"
      title="Terms of Service"
      currentPage="terms"
    />
  );
}
