"use client";

import Link from "next/link";
import { addLocaleToPathname, useI18n } from "@/lib/i18n";

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

export function SiteFooter() {
  const { locale, t } = useI18n();

  const privacyHref = "/privacy-policy.html";
  const termsHref = "/terms-of-service.html";
  const refundHref = "/refund-policy.html";
  const licensesHref = addLocaleToPathname("/open-source-licenses", locale);

  return (
    <footer className="border-t border-black/[0.06] bg-[#fcfbfa] py-12 dark:border-white/[0.06] dark:bg-[#101010]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 md:flex-row">
        <div className="flex flex-1 items-center gap-2 text-[#25242a] dark:text-[#f5f5f5]">
          <Logo className="h-5 w-5" />
          <span className="font-display text-sm font-semibold tracking-tight">Orkest</span>
        </div>

        <div className="flex items-center gap-6 text-sm text-[#6d6770] dark:text-[#a3a3a3]">
          <Link href={addLocaleToPathname("/pricing", locale)} className="transition-colors hover:text-[#25242a] dark:hover:text-[#f5f5f5]">
            {t("landing.footer.pricing")}
          </Link>
          <a href={privacyHref} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#25242a] dark:hover:text-[#f5f5f5]">
            {t("landing.footer.privacy")}
          </a>
          <a href={termsHref} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#25242a] dark:hover:text-[#f5f5f5]">
            {t("landing.footer.terms")}
          </a>
          <a href={refundHref} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#25242a] dark:hover:text-[#f5f5f5]">
            {t("landing.footer.refund")}
          </a>
          <a href={licensesHref} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[#25242a] dark:hover:text-[#f5f5f5]">
            {t("landing.footer.licenses")}
          </a>
        </div>

        <p className="flex-1 text-right text-xs text-[#9ca3af]">
          {t("landing.footer.copyright", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
