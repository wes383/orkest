import type { MetadataRoute } from "next";

const BASE_URL = "https://orkest.wesluma.com";
const LOCALES = ["en", "zh-CN", "es", "fr", "de", "ja", "pt"] as const;

interface RouteConfig {
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
}

const routes: RouteConfig[] = [
  { path: "", priority: 1.0, changeFrequency: "daily" },
  { path: "/terms-of-service", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/open-source-licenses", priority: 0.2, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map(({ path, priority, changeFrequency }) => {
    const languages: Record<string, string> = {
      "x-default": `${BASE_URL}${path}`,
    };
    for (const locale of LOCALES) {
      languages[locale] = `${BASE_URL}/${locale}${path}`;
    }
    return {
      url: `${BASE_URL}${path}`,
      lastModified: new Date(),
      changeFrequency,
      priority,
      alternates: {
        languages,
      },
    };
  });
}
