// Curated project color palette.
// Hex strings match Tailwind's 500-tone defaults so the chosen hue reads
// consistently across light and dark mode.

export const PROJECT_PALETTE = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
  "#6b7280", // gray
  "#64748b", // slate
] as const;

export type ProjectPaletteColor = (typeof PROJECT_PALETTE)[number];

export const DEFAULT_PROJECT_COLOR = "#6b7280" satisfies ProjectPaletteColor;

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

/** Normalize a user-supplied color to "#rrggbb" lowercase, falling back to default. */
export function normalizeProjectColor(value: string | undefined | null): string {
  if (!value) return DEFAULT_PROJECT_COLOR;
  const trimmed = value.trim();
  if (HEX_RE.test(trimmed)) return trimmed.toLowerCase();
  // Allow "#rgb" form by expanding.
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return DEFAULT_PROJECT_COLOR;
}

/** Return a hex color with the given alpha (0..1) blended in rgba. */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = normalizeProjectColor(hex);
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const clamped = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}
