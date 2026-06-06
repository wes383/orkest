"use client";

import { useI18n } from "@/lib/i18n";

export function FocusHeader() {
  const { t } = useI18n();
  return (
    <header className="border-b border-black/6 pb-6 dark:border-white/10">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.1] font-semibold tracking-[-0.02em] text-[#25242a] dark:text-[#e8e6ea]">
        {t("focus.title")}
      </h1>
    </header>
  );
}
