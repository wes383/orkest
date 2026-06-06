export function getBrowserTimezone(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  }
  return "Asia/Shanghai";
}

function getUtcOffset(tz: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(now);
    const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    return off.replace("GMT", "UTC").replace(/^UTC\+0$/, "UTC+0");
  } catch {
    return "";
  }
}

export function getAllTimezones(): { value: string; label: string; group: string }[] {
  const timezones = Intl.supportedValuesOf?.("timeZone") ?? [];
  return timezones
    .map((tz) => {
      const offset = getUtcOffset(tz);
      const label = offset ? `${tz.replace(/_/g, " ")} (${offset})` : tz.replace(/_/g, " ");
      const group = tz.includes("/") ? tz.split("/")[0].replace(/_/g, " ") : "Other";
      return { value: tz, label, group };
    })
    .sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.value.localeCompare(b.value);
    });
}
