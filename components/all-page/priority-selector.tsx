"use client";

import { PRIORITY_CONFIG, getOrderedDayNames } from "@/lib/all-page-utils";
import { getWeekStartDay } from "@/lib/stores/use-settings-store";
import { useI18n } from "@/lib/i18n";
import type { Priority } from "@/lib/types/item";

export function PrioritySelector({
  value,
  onChange,
}: {
  value: Priority | undefined;
  onChange: (priority: Priority | undefined) => void;
}) {
  const { t } = useI18n();
  const priorities: Priority[] = ["low", "medium", "high", "urgent"];

  return (
    <div className="flex gap-2">
      {priorities.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(value === p ? undefined : p)}
          className={`cursor-pointer rounded-xl border px-3 py-1.5 text-sm font-medium transition-all ${
            value === p
              ? PRIORITY_CONFIG[p].color
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
          }`}
        >
          {t(`priority.${p}` as "priority.low" | "priority.medium" | "priority.high" | "priority.urgent")}
        </button>
      ))}
    </div>
  );
}

export function DayOfWeekSelector({
  selected,
  onChange,
}: {
  selected: boolean[];
  onChange: (days: boolean[]) => void;
}) {
  const startDay = getWeekStartDay();
  const orderedDays = getOrderedDayNames();

  function toggleDay(originalIndex: number) {
    const newSelected = [...selected];
    newSelected[originalIndex] = !newSelected[originalIndex];
    onChange(newSelected);
  }

  return (
    <div className="flex gap-1">
      {orderedDays.map((day, displayIndex) => {
        const originalIndex = (displayIndex + startDay) % 7;
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggleDay(originalIndex)}
            className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition-all ${
              selected[originalIndex]
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {day.charAt(0)}
          </button>
        );
      })}
    </div>
  );
}
