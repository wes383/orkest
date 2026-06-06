export const SIDEBAR_COLLAPSED_STORAGE_KEY = "sidebar-collapsed";
export const SIDEBAR_COLLAPSED_COOKIE = "orkest-sidebar-collapsed";

export function parseSidebarCollapsedPreference(
  value: string | null | undefined,
): boolean {
  return value === "true";
}
