/**
 * Converts between Orkest's RRULE format and Google Calendar's recurrence format.
 *
 * Google Calendar API uses an array of RRULE strings (without the "RRULE:" prefix),
 * plus separate EXDATE and RDATE arrays.
 */

import { rrulestr } from "rrule";
import { dayjs } from "../dayjs";

export type GoogleRecurrence = {
  rrules: string[];
  exdates: string[];
};

/**
 * Parse an Orkest RRULE string into Google Calendar's format.
 * Google expects: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]
 * We split into the RRULE part and extract EXDATEs separately.
 */
export function orkestRRuleToGoogle(
  rruleString: string | null | undefined,
  exdates: string[] | null | undefined,
): GoogleRecurrence | null {
  const rrules: string[] = [];
  const exdateSet = new Set<string>();

  if (rruleString) {
    const lines = rruleString
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      if (line.startsWith("RRULE:")) {
        rrules.push(line);
      } else if (line.startsWith("EXDATE")) {
        // Extract dates from EXDATE;VALUE=DATE:20250101,20250102
        const datesPart = line.split(":")[1] ?? "";
        for (const date of datesPart.split(",")) {
          const cleaned = date.trim();
          if (cleaned) exdateSet.add(cleaned);
        }
      }
    }
  }

  // Add exdates from the item's exdates array
  if (exdates) {
    for (const exdate of exdates) {
      const formatted = exdate.replace(/-/g, "").split("T")[0];
      exdateSet.add(formatted);
    }
  }

  if (rrules.length === 0 && exdateSet.size === 0) return null;

  return {
    rrules,
    exdates: Array.from(exdateSet),
  };
}

/**
 * Convert Google Calendar's recurrence format back to an Orkest RRULE string.
 * Google gives us: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"] and separate EXDATE array.
 */
export function googleToOrkestRRule(
  rrules: string[] | null | undefined,
  exdates: string[] | null | undefined,
): string | null {
  if (!rrules?.length) return null;

  const parts: string[] = [];

  for (const rrule of rrules) {
    // Google returns with "RRULE:" prefix
    parts.push(rrule.startsWith("RRULE:") ? rrule : `RRULE:${rrule}`);
  }

  if (exdates?.length) {
    const formatted = exdates
      .map((d) => d.replace(/-/g, "").split("T")[0])
      .join(",");
    parts.push(`EXDATE;VALUE=DATE:${formatted}`);
  }

  return parts.join("\n") || null;
}

/**
 * Convert Google's BYDAY format with numeric prefix (e.g., "1TU", "-1FR")
 * to Orkest's bysetpos + daysOfWeek representation.
 */
export function parseGoogleByDay(byday: string): {
  bysetpos?: number;
  daysOfWeek: number[];
} {
  const GOOGLE_WEEKDAYS: Record<string, number> = {
    SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
  };

  const days: number[] = [];
  let bysetpos: number | undefined;

  for (const part of byday.split(",")) {
    const trimmed = part.trim();
    const match = trimmed.match(/^(-?\d+)([A-Z]{2})$/);
    if (match) {
      bysetpos = Number(match[1]);
      const dayIndex = GOOGLE_WEEKDAYS[match[2]];
      if (dayIndex !== undefined) days.push(dayIndex);
    } else {
      const dayIndex = GOOGLE_WEEKDAYS[trimmed];
      if (dayIndex !== undefined) days.push(dayIndex);
    }
  }

  return { bysetpos, daysOfWeek: days };
}

/**
 * Convert Orkest's daysOfWeek array to Google's BYDAY format.
 * If bysetpos is provided, prepends the numeric prefix.
 */
export function toGoogleByDay(
  daysOfWeek: number[],
  bysetpos?: number,
): string | undefined {
  const ORKEST_WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

  if (daysOfWeek.length === 0) return undefined;

  const dayNames = daysOfWeek.map((d) => ORKEST_WEEKDAYS[d]).filter(Boolean);
  if (dayNames.length === 0) return undefined;

  if (bysetpos !== undefined && dayNames.length === 1) {
    return `${bysetpos}${dayNames[0]}`;
  }

  return dayNames.join(",");
}

/**
 * Convert a Google Calendar event's recurrence to Orkest's structured format.
 */
export function parseGoogleRecurrenceToOrkest(
  recurrence: string[] | null | undefined,
): {
  rrule: string | null;
  exdates: string[];
} {
  if (!recurrence?.length) {
    return { rrule: null, exdates: [] };
  }

  const rrules: string[] = [];
  const exdates: string[] = [];

  for (const line of recurrence) {
    if (line.startsWith("RRULE:")) {
      rrules.push(line);
    } else if (line.startsWith("EXDATE")) {
      const datesPart = line.split(":")[1] ?? "";
      for (const date of datesPart.split(",")) {
        const cleaned = date.trim();
        if (cleaned) {
          // Convert YYYYMMDD to YYYY-MM-DD
          if (cleaned.length === 8) {
            exdates.push(`${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`);
          } else {
            exdates.push(cleaned);
          }
        }
      }
    }
  }

  const rrule = rrules.join("\n") || null;
  return { rrule, exdates };
}

/**
 * Format an Orkest item's recurrence for Google Calendar API.
 * Returns the `recurrence` array field for Google Event resource.
 */
export function formatRecurrenceForGoogle(
  rrule: string | null | undefined,
  exdates: string[] | null | undefined,
): string[] | undefined {
  const result = orkestRRuleToGoogle(rrule, exdates);
  if (!result) return undefined;

  const lines: string[] = [...result.rrules];

  if (result.exdates.length > 0) {
    lines.push(`EXDATE;VALUE=DATE:${result.exdates.join(",")}`);
  }

  return lines.length > 0 ? lines : undefined;
}
