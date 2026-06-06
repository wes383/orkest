import { describe, it, expect } from "vitest";
import { resolveConflict } from "../offline/conflict-resolver";
import type { ManualItemRecord } from "../types/all-page";

function makeRecord(overrides: Partial<ManualItemRecord> = {}): ManualItemRecord {
  return {
    id: "id-1",
    uid: "uid-1",
    title: "test",
    hasTime: false,
    allDay: false,
    recurrenceType: "none",
    recurrenceInterval: 1,
    daysOfWeek: [],
    recurrenceEndType: "never",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveConflict", () => {
  it("preserves id, uid, createdAt from remote", () => {
    const local = makeRecord({ id: "local-id", uid: "local-uid", createdAt: "2024-01-01T00:00:00.000Z" });
    const remote = makeRecord({ id: "remote-id", uid: "remote-uid", createdAt: "2025-01-01T00:00:00.000Z" });
    const result = resolveConflict(local, remote);
    expect(result.id).toBe("remote-id");
    expect(result.uid).toBe("remote-uid");
    expect(result.createdAt).toBe("2025-01-01T00:00:00.000Z");
  });

  it("uses local scalar value when remote is undefined", () => {
    const local = makeRecord({ title: "local-title" });
    const remote = makeRecord({ title: undefined as unknown as string });
    const result = resolveConflict(local, remote);
    expect(result.title).toBe("local-title");
  });

  it("prefers local for scalar when both exist (last-write-wins)", () => {
    const local = makeRecord({ title: "local-title", priority: "high" as const });
    const remote = makeRecord({ title: "remote-title", priority: "low" as const });
    const result = resolveConflict(local, remote);
    expect(result.title).toBe("local-title");
    expect(result.priority).toBe("high");
  });

  it("merges array fields with union strategy", () => {
    const local = makeRecord({ tags: ["a", "b"] });
    const remote = makeRecord({ tags: ["b", "c"] });
    const result = resolveConflict(local, remote);
    expect(result.tags?.sort()).toEqual(["a", "b", "c"]);
  });

  it("handles both tags undefined", () => {
    const local = makeRecord();
    const remote = makeRecord();
    const result = resolveConflict(local, remote);
    expect(result.tags).toBeUndefined();
  });

  it("merges exdates array fields", () => {
    const local = makeRecord({ exdates: ["2025-01-01", "2025-01-02"] });
    const remote = makeRecord({ exdates: ["2025-01-02", "2025-01-03"] });
    const result = resolveConflict(local, remote);
    expect(result.exdates?.sort()).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
  });

  it("merges completedOccurrences", () => {
    const local = makeRecord({ completedOccurrences: ["2025-01-01"] });
    const remote = makeRecord({ completedOccurrences: ["2025-01-02"] });
    const result = resolveConflict(local, remote);
    expect(result.completedOccurrences?.sort()).toEqual(["2025-01-01", "2025-01-02"]);
  });

  it("updates updatedAt to current time", () => {
    const before = Date.now();
    const local = makeRecord({ title: "local" });
    const remote = makeRecord({ title: "remote" });
    const result = resolveConflict(local, remote);
    const resultTime = new Date(result.updatedAt).getTime();
    expect(resultTime).toBeGreaterThanOrEqual(before);
    expect(resultTime).toBeLessThanOrEqual(Date.now());
  });

  it("preserves local when remote has no extra fields", () => {
    const local = makeRecord({ title: "only-local", tags: ["x"] });
    const remote = makeRecord();
    const result = resolveConflict(local, remote);
    expect(result.title).toBe("only-local");
    expect(result.tags).toEqual(["x"]);
  });

  it("uses remote array value when local array is undefined", () => {
    const local = makeRecord();
    const remote = makeRecord({ tags: ["remote-tag"] });
    const result = resolveConflict(local, remote);
    expect(result.tags).toEqual(["remote-tag"]);
  });
});
