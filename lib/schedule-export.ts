import { buildRRuleString, makeDateFromInput } from "./all-page-utils";
import { dayjs } from "./dayjs";
import type { ManualItemRecord } from "./types/all-page";
import type { ItemStatus, Priority } from "./types/item";

const CSV_HEADERS = [
  "id",
  "title",
  "description",
  "status",
  "priority",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "dueDate",
  "allDay",
  "timezone",
  "recurrence",
  "rrule",
  "tags",
  "parentId",
  "estimateMinutes",
  "createdAt",
  "updatedAt",
] as const;

const PRIORITY_VALUES: Record<Priority, number> = {
  urgent: 1,
  high: 3,
  medium: 5,
  low: 9,
};

export function exportScheduleToIcs(records: ManualItemRecord[]) {
  const now = formatUtcDateTime(new Date());
  const exportableRecords = getExportableRecords(records);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Orkest//Schedule Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const timezone of getEventTimezones(exportableRecords)) {
    lines.push(...buildTimezone(timezone));
  }

  for (const record of exportableRecords) {
    lines.push(...buildIcsComponent(record, now));
  }

  lines.push("END:VCALENDAR");
  return `${foldIcsLines(lines).join("\r\n")}\r\n`;
}

export function exportScheduleToCsv(records: ManualItemRecord[]) {
  const rows = getExportableRecords(records).map((record) => [
    record.id,
    record.title,
    record.description ?? "",
    record.status ?? "active",
    record.priority ?? "",
    record.startDate ?? "",
    record.startTime ?? "",
    record.endDate ?? "",
    record.endTime ?? "",
    record.dueDate ?? "",
    String(record.allDay),
    record.timezone ?? "",
    getRecurrenceLabel(record),
    getRRuleLine(record) ?? "",
    (record.tags ?? []).join(","),
    record.parentId ?? "",
    record.estimateMinutes?.toString() ?? "",
    record.createdAt,
    record.updatedAt,
  ]);

  return [
    CSV_HEADERS.join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join("\r\n");
}

export function getScheduleExportFilename(extension: "ics" | "csv", date = new Date()) {
  return `orkest-schedule-${formatDateForFilename(date)}.${extension}`;
}

function getExportableRecords(records: ManualItemRecord[]) {
  return records.filter((record) => !record.deletedAt);
}

function buildIcsComponent(record: ManualItemRecord, dtstamp: string) {
  if (shouldExportAsEvent(record)) {
    return buildEvent(record, dtstamp);
  }

  return buildTodo(record, dtstamp);
}

function shouldExportAsEvent(record: ManualItemRecord) {
  return Boolean(record.startDate || record.endDate || record.startTime || record.endTime);
}

function getEventTimezones(records: ManualItemRecord[]) {
  const timezones = new Set<string>();

  for (const record of records) {
    if (shouldExportAsEvent(record) && !record.allDay && record.timezone) {
      timezones.add(record.timezone);
    }
  }

  return Array.from(timezones).sort();
}

function buildTimezone(timezone: string) {
  const now = dayjs().tz(timezone);
  const offset = formatTimezoneOffset(now.utcOffset());

  return [
    "BEGIN:VTIMEZONE",
    `TZID:${escapeIcsText(timezone)}`,
    "BEGIN:STANDARD",
    `DTSTART:${now.format("YYYYMMDD")}T000000`,
    `TZOFFSETFROM:${offset}`,
    `TZOFFSETTO:${offset}`,
    `TZNAME:${escapeIcsText(timezone)}`,
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
}

function buildEvent(record: ManualItemRecord, dtstamp: string) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${escapeIcsText(record.uid || record.id)}`,
    `DTSTAMP:${dtstamp}`,
    `CREATED:${formatUtcDateTime(record.createdAt)}`,
    `LAST-MODIFIED:${formatUtcDateTime(record.updatedAt)}`,
    `SUMMARY:${escapeIcsText(record.title)}`,
    `STATUS:${getEventStatus(record.status)}`,
  ];

  addOptionalText(lines, "DESCRIPTION", record.description);
  addPriority(lines, record.priority);
  addEventDates(lines, record);
  addRRule(lines, record);
  addExdates(lines, record);
  addSharedOptionalFields(lines, record, Boolean(record.endDate));

  lines.push("END:VEVENT");
  return lines;
}

function buildTodo(record: ManualItemRecord, dtstamp: string) {
  const lines = [
    "BEGIN:VTODO",
    `UID:${escapeIcsText(record.uid || record.id)}`,
    `DTSTAMP:${dtstamp}`,
    `CREATED:${formatUtcDateTime(record.createdAt)}`,
    `LAST-MODIFIED:${formatUtcDateTime(record.updatedAt)}`,
    `SUMMARY:${escapeIcsText(record.title)}`,
    `STATUS:${getTodoStatus(record.status)}`,
  ];

  addOptionalText(lines, "DESCRIPTION", record.description);
  addPriority(lines, record.priority);
  addRRule(lines, record);
  addExdates(lines, record);

  if (record.dueDate) {
    lines.push(`DUE;VALUE=DATE:${formatIcsDate(record.dueDate)}`);
  }

  if (record.status === "completed") {
    lines.push(`COMPLETED:${formatUtcDateTime(record.updatedAt)}`);
  }

  addSharedOptionalFields(lines, record);
  lines.push("END:VTODO");
  return lines;
}

function addEventDates(lines: string[], record: ManualItemRecord) {
  const timezone = record.timezone;

  if (record.allDay) {
    const startDate = record.startDate ?? record.endDate;
    if (startDate) {
      lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(startDate)}`);
    }
    if (record.endDate) {
      lines.push(`DTEND;VALUE=DATE:${formatIcsDate(addDays(record.endDate, 1))}`);
    }
    return;
  }

  if (record.startDate) {
    lines.push(formatIcsDateTimeProperty("DTSTART", record.startDate, record.startTime, timezone));
  }
  if (record.endDate) {
    lines.push(formatIcsDateTimeProperty("DTEND", record.endDate, record.endTime, timezone));
  }
}

function addSharedOptionalFields(
  lines: string[],
  record: ManualItemRecord,
  omitDuration = false,
) {
  if (record.tags?.length) {
    lines.push(`CATEGORIES:${record.tags.map(escapeIcsText).join(",")}`);
  }
  if (record.parentId) {
    lines.push(`RELATED-TO:${escapeIcsText(record.parentId)}`);
  }
  if (record.estimateMinutes && !omitDuration) {
    lines.push(`DURATION:PT${Math.max(0, Math.round(record.estimateMinutes))}M`);
  }
}

function addRRule(lines: string[], record: ManualItemRecord) {
  const rruleLine = getRRuleLine(record);
  if (rruleLine) {
    lines.push(rruleLine);
  }
}

function addExdates(lines: string[], record: ManualItemRecord) {
  if (!record.exdates?.length) return;
  const exdateValues = record.exdates
    .map((exdate) => formatIcsDate(exdate.split("T")[0]))
    .join(",");
  lines.push(`EXDATE;VALUE=DATE:${exdateValues}`);
}

function addOptionalText(lines: string[], name: string, value?: string) {
  if (value) {
    lines.push(`${name}:${escapeIcsText(value)}`);
  }
}

function addPriority(lines: string[], priority?: Priority) {
  if (priority) {
    lines.push(`PRIORITY:${PRIORITY_VALUES[priority]}`);
  }
}

function getRRuleLine(record: ManualItemRecord) {
  const rawRule = record.rrule ?? buildFallbackRRule(record);
  return rawRule
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("RRULE:"));
}

function buildFallbackRRule(record: ManualItemRecord) {
  const anchor = makeDateFromInput(
    record.startDate ?? record.dueDate ?? record.endDate,
    record.allDay ? undefined : record.startTime ?? record.endTime,
    record.timezone,
  );

  return buildRRuleString({
    anchorDate: anchor,
    recurrenceType: record.recurrenceType,
    recurrenceInterval: record.recurrenceInterval,
    daysOfWeek: record.daysOfWeek,
    recurrenceEndDate: record.recurrenceEndDate,
    timezone: record.timezone,
  });
}

function getEventStatus(status?: ItemStatus) {
  if (status === "cancelled" || status === "skipped") {
    return "CANCELLED";
  }
  return "CONFIRMED";
}

function getTodoStatus(status?: ItemStatus) {
  if (status === "completed") {
    return "COMPLETED";
  }
  if (status === "cancelled" || status === "skipped") {
    return "CANCELLED";
  }
  return "NEEDS-ACTION";
}

function getRecurrenceLabel(record: ManualItemRecord) {
  if (record.recurrenceType === "none") {
    return "none";
  }

  const parts = [record.recurrenceType, `every ${record.recurrenceInterval}`];
  if (record.daysOfWeek.length > 0) {
    parts.push(`days ${record.daysOfWeek.join("|")}`);
  }
  if (record.recurrenceEndDate) {
    parts.push(`until ${record.recurrenceEndDate}`);
  }
  return parts.join("; ");
}

function formatIcsDateTimeProperty(
  name: string,
  date: string,
  time?: string,
  timezone?: string,
) {
  const value = formatIcsLocalDateTime(date, time);
  if (timezone) {
    return `${name};TZID=${escapeIcsParam(timezone)}:${value}`;
  }
  return `${name}:${value}`;
}

function formatIcsLocalDateTime(date: string, time?: string) {
  return `${formatIcsDate(date)}T${(time || "00:00").replace(":", "")}00`;
}

function formatUtcDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return formatUtcDateTime(new Date());
  }

  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatIcsDate(date: string) {
  return date.replace(/-/g, "");
}

function addDays(date: string, days: number) {
  return dayjs(date).add(days, "day").format("YYYY-MM-DD");
}

function formatTimezoneOffset(offsetMinutes: number) {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `${sign}${String(hours).padStart(2, "0")}${String(minutes).padStart(2, "0")}`;
}

function formatDateForFilename(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function escapeIcsParam(value: string) {
  return value.replace(/[";:,]/g, "");
}

function escapeCsvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

function foldIcsLines(lines: string[]) {
  return lines.flatMap((line) => {
    if (line.length <= 75) {
      return line;
    }

    const folded = [];
    let rest = line;
    folded.push(rest.slice(0, 75));
    rest = rest.slice(75);
    while (rest.length > 0) {
      folded.push(` ${rest.slice(0, 74)}`);
      rest = rest.slice(74);
    }
    return folded;
  });
}
