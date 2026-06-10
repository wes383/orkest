/**
 * Lightweight distance-to-now formatter for project creation timestamps.
 * Keeps translation in one place (i18n keys) and avoids pulling in a date-fns clone.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type DistanceToNowKey =
  | "projects.distanceToNow.justNow"
  | "projects.distanceToNow.minutesAgo"
  | "projects.distanceToNow.hoursAgo"
  | "projects.distanceToNow.daysAgo";

type Translator = (key: DistanceToNowKey, values?: Record<string, string | number>) => string;

export function distanceToNow(
  date: Date | string,
  t: Translator,
  now: Date = new Date(),
): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const diff = now.getTime() - target.getTime();

  if (diff < MINUTE) {
    return t("projects.distanceToNow.justNow");
  }
  if (diff < HOUR) {
    const minutes = Math.max(1, Math.floor(diff / MINUTE));
    return t("projects.distanceToNow.minutesAgo", { n: minutes });
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return t("projects.distanceToNow.hoursAgo", { n: hours });
  }
  const days = Math.floor(diff / DAY);
  return t("projects.distanceToNow.daysAgo", { n: days });
}
