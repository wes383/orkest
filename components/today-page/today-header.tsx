"use client";

import { useI18n } from "@/lib/i18n";

export function TodayHeader({
  dateLabel,
}: {
  dateLabel: string;
}) {
  const { t } = useI18n();
  return (
    <header className="flex items-end justify-between border-b border-black/6 pb-6">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.8rem)] leading-[1.1] font-semibold tracking-[-0.02em] text-[#25242a]">
        {t("nav.today")}
      </h1>
      <p className="shrink-0 rounded-full bg-[#e8e6ea] px-3 py-1 text-sm font-medium text-[#6f6a72]">
        {dateLabel}
      </p>
    </header>
  );
}
