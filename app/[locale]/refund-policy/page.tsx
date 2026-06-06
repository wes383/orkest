import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Refund Policy | Orkest",
  description: "Refund Policy for Orkest - Subscription billing, cancellations, and refunds",
  robots: { index: true, follow: true },
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      fileName="REFUND_POLICY.md"
      title="Refund Policy"
      currentPage="refund"
    />
  );
}
