"use client";

import { useRef } from "react";
import { Check } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import {
  PROJECT_PALETTE,
  normalizeProjectColor,
  withAlpha,
} from "@/lib/projects/color-palette";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { t } = useI18n();
  const normalized = normalizeProjectColor(value);
  const isCustom = !PROJECT_PALETTE.includes(normalized as (typeof PROJECT_PALETTE)[number]);
  const customInputRef = useRef<HTMLInputElement>(null);

  function handleValueChange(next: string) {
    onChange(next);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PROJECT_PALETTE.map((color) => {
        const selected = normalized === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => handleValueChange(color)}
            aria-label={color}
            className="group relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full"
            style={{
              backgroundColor: color,
              boxShadow: selected
                ? `0 0 0 2px white, 0 0 0 4px ${color}`
                : `0 0 0 1px ${withAlpha(color, 0.4)}`,
            }}
          >
            {selected ? (
              <Check
                className="h-4 w-4"
                style={{ color: "#ffffff" }}
                strokeWidth={3}
              />
            ) : null}
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => customInputRef.current?.click()}
        className={`group relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-full ${
          isCustom ? "" : "border border-dashed border-black/15 dark:border-white/15"
        }`}
        style={{
          backgroundColor: isCustom ? normalized : undefined,
          boxShadow: isCustom
            ? `0 0 0 2px white, 0 0 0 4px ${normalized}`
            : undefined,
        }}
        aria-label={t("projects.colorPicker.custom")}
        title={t("projects.colorPicker.custom")}
      >
        {isCustom ? (
          <Check
            className="h-4 w-4"
            style={{ color: "#ffffff" }}
            strokeWidth={3}
          />
        ) : (
          <span className="text-[11px] font-semibold text-[#9f99a3]">#</span>
        )}
        <input
          ref={customInputRef}
          type="color"
          value={normalized}
          onChange={(e) => handleValueChange(e.target.value.toLowerCase())}
          className="absolute inset-0 cursor-pointer opacity-0"
          tabIndex={-1}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
