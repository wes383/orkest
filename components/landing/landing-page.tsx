"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import {
  ArrowRight,
  Brain,
  Calendar,
  Clock,
  Command,
  Focus,
  Globe,
  Mail,
  Tag,
  MessageSquare,
  Moon,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { addLocaleToPathname, useI18n } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/stores/use-settings-store";

function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="255.5" cy="255.5" r="200.5" fill="currentColor" />
      <defs>
        <clipPath id="circleClip">
          <circle cx="255.5" cy="255.5" r="200.5" />
        </clipPath>
      </defs>
      <g clipPath="url(#circleClip)">
        <line
          x1="380.529"
          y1="98.0623"
          x2="222.334"
          y2="256.257"
          className="stroke-white dark:stroke-[#25242a]"
          strokeWidth="48"
          strokeLinecap="round"
        />
        <line
          x1="388.987"
          y1="423.362"
          x2="223.529"
          y2="257.904"
          className="stroke-white dark:stroke-[#25242a]"
          strokeWidth="48"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

function useScrolled(threshold = 10) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

function Header() {
  const scrolled = useScrolled();
  const { locale, t } = useI18n();
  const { appearance, setAppearance } = useSettingsStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const appHref = addLocaleToPathname("/auth?mode=signup", locale);
  const signInHref = addLocaleToPathname("/auth", locale);

  const toggleTheme = () => {
    setAppearance(appearance === "dark" ? "light" : "dark");
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#fcfbfa]/80 backdrop-blur-xl shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:bg-[#101010]/80 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
        <div className="flex-1">
          <Link
            href={addLocaleToPathname("/", locale)}
            className="flex items-center gap-2.5 text-[#25242a] dark:text-[#f5f5f5]"
          >
            <Logo className="h-7 w-7" />
            <span className="font-display text-lg font-semibold tracking-tight">
              Orkest
            </span>
          </Link>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-sm font-medium text-[#6d6770] transition-colors hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5]"
          >
            {t("landing.nav.features")}
          </a>
          <a
            href="#preview"
            className="text-sm font-medium text-[#6d6770] transition-colors hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5]"
          >
            {t("landing.nav.preview")}
          </a>
          <a
            href="#highlights"
            className="text-sm font-medium text-[#6d6770] transition-colors hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5]"
          >
            {t("landing.nav.highlights")}
          </a>
          <Link
            href={addLocaleToPathname("/pricing", locale)}
            className="text-sm font-medium text-[#6d6770] transition-colors hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5]"
          >
            {t("landing.nav.pricing")}
          </Link>
        </nav>

        <div className="flex flex-1 items-center justify-end gap-3">
          {mounted ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="cursor-pointer h-9 w-9 rounded-full text-[#6d6770] hover:text-[#25242a] hover:bg-[#f4f0ec]/60 dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5] dark:hover:bg-white/[0.05]"
              aria-label="Toggle theme"
            >
              {appearance === "dark" ? (
                <Sun className="h-[18px] w-[18px]" />
              ) : (
                <Moon className="h-[18px] w-[18px]" />
              )}
            </Button>
          ) : (
            <div className="h-9 w-9" />
          )}

          <Link
            href={signInHref}
            className="hidden text-sm font-medium text-[#6d6770] transition-colors hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5] sm:inline-block"
          >
            {t("auth.signIn")}
          </Link>
          <Link href={appHref}>
            <Button size="sm">{t("landing.header.getStarted")}</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  const { locale, t } = useI18n();
  const appHref = addLocaleToPathname("/auth?mode=signup", locale);

  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-44 md:pb-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[-10%] left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,36,42,0.04)_0%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(245,245,245,0.04)_0%,transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-6 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/60 px-4 py-1.5 text-xs font-medium text-[#6d6770] shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04] dark:text-[#a3a3a3]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t("landing.hero.badge")}</span>
        </div>

        <h1 className="mx-auto max-w-4xl font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-[#171717] dark:text-[#f5f5f5]">
          {t("landing.hero.title")}
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#6d6770] dark:text-[#a3a3a3]">
          {t("landing.hero.subtitle")}
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={appHref}>
            <Button className="h-12 px-8 text-base">
              {t("landing.hero.cta")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#preview">
            <Button variant="outline" className="h-12 px-8 text-base">
              {t("landing.hero.seeHow")}
            </Button>
          </a>
        </div>


      </div>
    </section>
  );
}

function Features() {
  const { t } = useI18n();
  const features = [
    { icon: Sparkles, title: t("landing.features.aiScheduling"), description: t("landing.features.aiScheduling.desc") },
    { icon: Brain, title: t("landing.features.aiMemory"), description: t("landing.features.aiMemory.desc") },
    { icon: Clock, title: t("landing.features.focusTimer"), description: t("landing.features.focusTimer.desc") },
    { icon: Calendar, title: t("landing.features.timelineView"), description: t("landing.features.timelineView.desc") },
    { icon: Mail, title: t("landing.features.dailyDigest"), description: t("landing.features.dailyDigest.desc") },
    { icon: Tag, title: t("landing.features.projectsTags"), description: t("landing.features.projectsTags.desc") },
    { icon: Globe, title: t("landing.features.multilingual"), description: t("landing.features.multilingual.desc") },
    { icon: Zap, title: t("landing.features.offlineFirst"), description: t("landing.features.offlineFirst.desc") },
  ];
  return (
    <section id="features" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] text-[#171717] dark:text-[#f5f5f5] md:text-4xl">
            {t("landing.features.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[#6d6770] dark:text-[#a3a3a3]">
            {t("landing.features.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-black/[0.06] bg-white/60 p-6 transition-all hover:bg-white hover:shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4f0ec] text-[#25242a] dark:bg-[#1a1a1a] dark:text-[#f5f5f5]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-[#171717] dark:text-[#f5f5f5]">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-[#6d6770] dark:text-[#a3a3a3]">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Preview() {
  const { locale, t } = useI18n();
  const { appearance } = useSettingsStore();
  const [isDark, setIsDark] = useState(false);
  const appHref = addLocaleToPathname("/auth?mode=signup", locale);

  useEffect(() => {
    const checkDark = () => {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const shouldUseDark =
        appearance === "dark" || (appearance === "system" && mediaQuery.matches);
      setIsDark(shouldUseDark);
    };

    checkDark();

    if (appearance === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", checkDark);
      return () => mediaQuery.removeEventListener("change", checkDark);
    }
  }, [appearance]);

  return (
    <section id="preview" className="relative py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(37,36,42,0.03)_0%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(245,245,245,0.03)_0%,transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] text-[#171717] dark:text-[#f5f5f5] md:text-4xl">
            {t("landing.preview.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[#6d6770] dark:text-[#a3a3a3]">
            {t("landing.preview.subtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-16">
          {/* Today View Container */}
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-black/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.06)] dark:border-white/[0.06] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
            <img
              src={isDark ? "/screenshots/today-dark.png" : "/screenshots/today.png"}
              alt="Orkest Today page"
              className="w-full"
            />
          </div>

          {/* Daily Digest Container */}
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-black/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.06)] dark:border-white/[0.06] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)]">
            <img
              src={isDark ? "/screenshots/digest-dark.png" : "/screenshots/digest.png"}
              alt="Orkest Daily Digest page"
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link href={appHref}>
            <Button variant="outline" className="h-11 px-6">
              {t("landing.preview.cta")}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Highlights() {
  const { t } = useI18n();
  const highlights = [
    { icon: Command, title: t("landing.highlights.keyboardShortcuts"), description: t("landing.highlights.keyboardShortcuts.desc") },
    { icon: Moon, title: t("landing.highlights.darkMode"), description: t("landing.highlights.darkMode.desc") },
    { icon: Focus, title: t("landing.highlights.distractionFree"), description: t("landing.highlights.distractionFree.desc") },
    { icon: MessageSquare, title: t("landing.highlights.voiceInput"), description: t("landing.highlights.voiceInput.desc") },
  ];
  return (
    <section id="highlights" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] text-[#171717] dark:text-[#f5f5f5] md:text-4xl">
            {t("landing.highlights.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[#6d6770] dark:text-[#a3a3a3]">
            {t("landing.highlights.subtitle")}
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((h) => (
            <div key={h.title} className="text-center">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f0ec] text-[#25242a] dark:bg-[#1a1a1a] dark:text-[#f5f5f5]">
                <h.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-[#171717] dark:text-[#f5f5f5]">
                {h.title}
              </h3>
              <p className="text-sm leading-relaxed text-[#6d6770] dark:text-[#a3a3a3]">
                {h.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Cta() {
  const { locale, t } = useI18n();
  const appHref = addLocaleToPathname("/auth?mode=signup", locale);

  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="rounded-3xl border border-black/[0.06] bg-gradient-to-tr from-[#f7f4f1] to-[#fefdfd] p-10 dark:border-white/[0.06] dark:bg-none dark:bg-[#181818] md:p-16">
          <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] text-[#171717] dark:text-[#f5f5f5] md:text-4xl">
            {t("landing.cta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[#6d6770] dark:text-[#a3a3a3]">
            {t("landing.cta.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={appHref}>
              <Button className="h-12 px-8 text-base">
                {t("landing.cta.button")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fcfbfa] text-[#171717] dark:bg-[#101010] dark:text-[#f5f5f5]">
      <Header />
      <main>
        <Hero />
        <Features />
        <Preview />
        <Highlights />
        <Cta />
      </main>
      <SiteFooter />
    </div>
  );
}
