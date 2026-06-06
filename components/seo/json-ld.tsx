import type { Thing, WebApplication, Organization } from "schema-dts";

interface JsonLdProps<T extends Thing> {
  jsonLd: T;
}

export function JsonLd<T extends Thing>({ jsonLd }: JsonLdProps<T>) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function OrganizationJsonLd() {
  const org: Organization = {
    "@type": "Organization",
    name: "Orkest",
    url: "https://orkest.wesluma.com",
    description:
      "Personal task and time orchestration app with AI-powered scheduling.",
  };

  return <JsonLd jsonLd={org} />;
}

export function WebApplicationJsonLd() {
  const app: WebApplication = {
    "@type": "WebApplication",
    name: "Orkest",
    url: "https://orkest.wesluma.com",
    description:
      "Orkest helps you plan your day, manage tasks, and orchestrate your time with AI-powered scheduling.",
    applicationCategory: "ProductivityApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return <JsonLd jsonLd={app} />;
}
