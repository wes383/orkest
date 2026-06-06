"use client";

import { ItemCard } from "./item-card";
import { formatDayLabel, getTimelinePointColor } from "@/lib/all-page-utils";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import type { DayGroup } from "@/lib/types/all-page";

export function DayGroupSection({ group }: { group: DayGroup }) {
  useSettingsStore((s) => s.locale);
  const density = useSettingsStore((s) => s.density);
  const isCompact = density === "compact";
  const dotColor = getTimelinePointColor(group.date);

  return (
    <section className={`${isCompact ? "space-y-4" : "space-y-7"}`}>
      <div className={`grid grid-cols-[20px_minmax(0,1fr)] ${isCompact ? "gap-x-3 gap-y-3" : "gap-x-5 gap-y-5"} sm:grid-cols-[24px_minmax(0,1fr)] sm:gap-x-6`}>
        <div className="flex justify-center pt-[0.35rem]">
          <span className={`${isCompact ? "h-2 w-2" : "h-2.5 w-2.5"} rounded-full`} style={{ backgroundColor: dotColor }} />
        </div>
        <h3 className="text-sm font-semibold tracking-[0.2em] text-[#6f6a72] uppercase">
          {formatDayLabel(group.date)}
        </h3>

        <div className="flex justify-center">
          <div className="h-full w-px bg-black/6" />
        </div>
        <div className={`${isCompact ? "space-y-2" : "space-y-4"}`}>
          {group.items.map((item) => (
            <ItemCard key={`${item.id}:${item.occurrenceKey ?? "base"}`} item={item} inlineMetadata={isCompact} />
          ))}
        </div>
      </div>
    </section>
  );
}
