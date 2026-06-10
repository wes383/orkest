import { describe, it, expect } from "vitest";
import {
  computeProjectsWithStats,
  sortProjectsWithStats,
} from "../projects/project-stats";
import type { Project } from "../types/item";
import type { ManualItemRecord } from "../types/all-page";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    userId: "u-1",
    name: "Alpha",
    createdAt: new Date("2025-01-01T00:00:00Z"),
    updatedAt: new Date("2025-01-01T00:00:00Z"),
    ...overrides,
  };
}

function makeItem(overrides: Partial<ManualItemRecord> = {}): ManualItemRecord {
  return {
    id: "i-1",
    uid: "uid-1",
    title: "Task",
    hasTime: false,
    allDay: false,
    recurrenceType: "none",
    recurrenceInterval: 1,
    daysOfWeek: [],
    recurrenceEndType: "never",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("computeProjectsWithStats", () => {
  it("returns zero counts when there are no items", () => {
    const projects = [makeProject(), makeProject({ id: "p-2", name: "Beta" })];
    const result = computeProjectsWithStats(projects, []);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ total: 0, active: 0, completed: 0 });
    expect(result[1]).toMatchObject({ total: 0, active: 0, completed: 0 });
  });

  it("counts active and completed items per project", () => {
    const projects = [makeProject()];
    const items = [
      makeItem({ id: "i-1", projectId: "p-1", status: "active" }),
      makeItem({ id: "i-2", projectId: "p-1", status: "completed" }),
      makeItem({ id: "i-3", projectId: "p-1" }),
    ];
    const [result] = computeProjectsWithStats(projects, items);
    expect(result.total).toBe(3);
    expect(result.active).toBe(2);
    expect(result.completed).toBe(1);
  });

  it("skips soft-deleted items", () => {
    const projects = [makeProject()];
    const items = [
      makeItem({ id: "i-1", projectId: "p-1", status: "active" }),
      makeItem({ id: "i-2", projectId: "p-1", status: "completed", deletedAt: "2025-02-01T00:00:00Z" }),
    ];
    const [result] = computeProjectsWithStats(projects, items);
    expect(result.total).toBe(1);
    expect(result.active).toBe(1);
    expect(result.completed).toBe(0);
  });

  it("skips subtasks (items with parentId)", () => {
    const projects = [makeProject()];
    const items = [
      makeItem({ id: "i-1", projectId: "p-1" }),
      makeItem({ id: "i-2", projectId: "p-1", parentId: "i-parent" }),
    ];
    const [result] = computeProjectsWithStats(projects, items);
    expect(result.total).toBe(1);
  });

  it("ignores items without a projectId", () => {
    const projects = [makeProject()];
    const items = [
      makeItem({ id: "i-1" }),
      makeItem({ id: "i-2", projectId: "p-1" }),
    ];
    const [result] = computeProjectsWithStats(projects, items);
    expect(result.total).toBe(1);
  });

  it("preserves the original project order", () => {
    const projects = [
      makeProject({ id: "p-2", name: "Beta" }),
      makeProject({ id: "p-1", name: "Alpha" }),
    ];
    const result = computeProjectsWithStats(projects, []);
    expect(result.map((p) => p.id)).toEqual(["p-2", "p-1"]);
  });
});

describe("sortProjectsWithStats", () => {
  const projects = [
    makeProject({ id: "p-1", name: "Charlie", updatedAt: new Date("2025-03-01") }),
    makeProject({ id: "p-2", name: "alpha", updatedAt: new Date("2025-01-01") }),
    makeProject({ id: "p-3", name: "Bravo", updatedAt: new Date("2025-02-01") }),
  ];

  const withStats = (entries: Array<{ id: string; active: number }>) => {
    const map = new Map(entries.map((e) => [e.id, e.active]));
    return projects.map((p) => {
      const stats = computeProjectsWithStats([p], [])[0];
      return { ...stats, active: map.get(p.id) ?? 0 };
    });
  };

  it("sorts alphabetically (case-insensitive locale)", () => {
    const stats = withStats([
      { id: "p-1", active: 5 },
      { id: "p-2", active: 10 },
      { id: "p-3", active: 1 },
    ]);
    const sorted = sortProjectsWithStats(stats, "alpha");
    expect(sorted.map((p) => p.name)).toEqual(["alpha", "Bravo", "Charlie"]);
  });

  it("sorts by most recently updated first", () => {
    const stats = withStats([
      { id: "p-1", active: 5 },
      { id: "p-2", active: 10 },
      { id: "p-3", active: 1 },
    ]);
    const sorted = sortProjectsWithStats(stats, "recent");
    expect(sorted.map((p) => p.id)).toEqual(["p-1", "p-3", "p-2"]);
  });

  it("sorts by active count desc, with alpha tie-breaker", () => {
    const stats = withStats([
      { id: "p-1", active: 3 },
      { id: "p-2", active: 5 },
      { id: "p-3", active: 3 },
    ]);
    const sorted = sortProjectsWithStats(stats, "frequency");
    // p-2 (5) first, then p-1 (Charlie, 3) and p-3 (Bravo, 3) tied — alpha wins (Bravo < Charlie).
    expect(sorted.map((p) => p.id)).toEqual(["p-2", "p-3", "p-1"]);
  });

  it("does not mutate the input array", () => {
    const stats = withStats([
      { id: "p-1", active: 1 },
      { id: "p-2", active: 2 },
    ]);
    const original = [...stats];
    sortProjectsWithStats(stats, "frequency");
    expect(stats).toEqual(original);
  });
});
