import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Manrope, Noto_Sans_SC, Noto_Sans_JP } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { OrganizationJsonLd, WebApplicationJsonLd } from "@/components/seo/json-ld";
import { AuthProvider } from "@/lib/auth/auth-provider";
import { RealtimeProvider } from "@/lib/realtime/realtime-provider";
import { SyncEngineProvider } from "@/lib/offline/sync-engine-provider";
import { ThemeProvider } from "@/lib/theme/theme-provider";
import { LocaleProvider } from "@/lib/i18n";
import { OneSignalProvider } from "@/components/onesignal-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter-next",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-next",
  weight: ["400", "500", "600"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-display-next",
});

const notoSC = Noto_Sans_SC({
  weight: ["400", "500", "700"],
  variable: "--font-noto-sc",
  display: "swap",
  preload: false,
});

const notoJP = Noto_Sans_JP({
  weight: ["400", "500", "700"],
  variable: "--font-noto-jp",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://orkest.wesluma.com"),
  title: {
    default: "Orkest - Task & Time Orchestration App",
    template: "%s | Orkest",
  },
  description:
    "Orkest helps you plan your day, manage tasks, and orchestrate your time with AI-powered scheduling. Stay focused, stay on track.",
  keywords: [
    "task management",
    "time management",
    "AI scheduling",
    "productivity app",
    "daily planner",
    "focus timer",
    "task orchestration",
  ],
  authors: [{ name: "Orkest" }],
  creator: "Orkest",
  publisher: "Orkest",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  verification: {
    google: "ONBkoxX1DHguYPLcVZkYA0GNzcvxuDQ2ykHGHkau1gU",
  },
  openGraph: {
    type: "website",
    siteName: "Orkest",
    title: "Orkest - Task & Time Orchestration App",
    description:
      "Orkest helps you plan your day, manage tasks, and orchestrate your time with AI-powered scheduling.",
    url: "https://orkest.wesluma.com",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Orkest - Task & Time Orchestration App",
    description:
      "Orkest helps you plan your day, manage tasks, and orchestrate your time with AI-powered scheduling.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/logo.svg" },
    ],
  },
  category: "productivity",
};

const themeScript = `
  (function() {
    try {
      var settings = JSON.parse(localStorage.getItem('orkest-settings'));
      var appearance = settings?.state?.appearance || 'light';
      var isDark = appearance === 'dark' || (appearance === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      }
    } catch(e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable} ${manrope.variable} ${notoSC.variable} ${notoJP.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <LocaleProvider>
            <AuthProvider>
              <OneSignalProvider />
              <RealtimeProvider>
                <SyncEngineProvider>
                  {children}
                  <Analytics />
                  <SpeedInsights />
                  <OrganizationJsonLd />
                  <WebApplicationJsonLd />
                </SyncEngineProvider>
              </RealtimeProvider>
            </AuthProvider>
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
