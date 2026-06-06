import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | Orkest",
  description: "Privacy Policy for Orkest - Your personal task and time orchestration app",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      fileName="PRIVACY_POLICY.md"
      title="Privacy Policy"
      currentPage="privacy"
    />
  );
}
