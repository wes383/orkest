import type { ManualItemRecord } from "../types/all-page";

function isArrayField(key: string): boolean {
  return [
    "daysOfWeek",
    "exdates",
    "completedOccurrences",
    "reopenedOccurrences",
    "dismissedTodayDates",
    "plannedTodayDates",
    "completedOccurrenceKeys",
    "tags",
  ].includes(key);
}

function mergeArrayFields(
  local: unknown[] | undefined,
  remote: unknown[] | undefined,
): unknown[] | undefined {
  if (!local && !remote) return undefined;
  const set = new Set<string>();
  for (const v of local ?? []) {
    set.add(JSON.stringify(v));
  }
  for (const v of remote ?? []) {
    set.add(JSON.stringify(v));
  }
  const result = Array.from(set).map((s) => {
    try {
      return JSON.parse(s);
    } catch {
      return s;
    }
  });
  return result.length > 0 ? result : undefined;
}

export function resolveConflict(
  local: ManualItemRecord,
  remote: ManualItemRecord,
): ManualItemRecord {
  const merged: Record<string, unknown> = { ...remote };

  for (const key of Object.keys(local)) {
    if (key === "id" || key === "uid" || key === "createdAt" || key === "updatedAt") {
      continue;
    }

    const localValue = local[key as keyof ManualItemRecord];
    const remoteValue = remote[key as keyof ManualItemRecord];

    if (localValue === undefined && remoteValue === undefined) {
      continue;
    }

    if (isArrayField(key)) {
      merged[key] = mergeArrayFields(
        localValue as unknown[] | undefined,
        remoteValue as unknown[] | undefined,
      );
    } else if (localValue !== undefined && remoteValue === undefined) {
      merged[key] = localValue;
    } else if (localValue !== undefined && remoteValue !== undefined) {
      // Both modified: prefer local for scalar fields (last write wins from this client)
      merged[key] = localValue;
    }
  }

  return {
    ...merged,
    id: remote.id,
    uid: remote.uid,
    createdAt: remote.createdAt,
    updatedAt: new Date().toISOString(),
  } as ManualItemRecord;
}
