import type { Project } from "../types/item";
import type { ManualItemRecord } from "../types/all-page";

export type ProjectWithStats = Project & {
  total: number;
  active: number;
  completed: number;
};

/**
 * Compute totals for each project by scanning manual item records.
 * Items that reference a missing project id still count toward `total`/`active`/`completed`
 * but their `projectId` will not match any entry in the returned list.
 */
export function computeProjectsWithStats(
  projects: Project[],
  items: ManualItemRecord[],
): ProjectWithStats[] {
  const stats = new Map<string, { total: number; active: number; completed: number }>();

  for (const project of projects) {
    stats.set(project.id, { total: 0, active: 0, completed: 0 });
  }

  for (const item of items) {
    if (item.deletedAt) continue;
    if (item.parentId) continue;
    if (!item.projectId) continue;
    const bucket = stats.get(item.projectId) ?? { total: 0, active: 0, completed: 0 };
    bucket.total += 1;
    if (item.status === "completed") {
      bucket.completed += 1;
    } else {
      bucket.active += 1;
    }
    stats.set(item.projectId, bucket);
  }

  return projects.map((project) => {
    const bucket = stats.get(project.id) ?? { total: 0, active: 0, completed: 0 };
    return {
      ...project,
      total: bucket.total,
      active: bucket.active,
      completed: bucket.completed,
    };
  });
}

export function sortProjectsWithStats(
  projects: ProjectWithStats[],
  mode: "alpha" | "recent" | "frequency",
): ProjectWithStats[] {
  const copy = [...projects];
  if (mode === "alpha") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (mode === "recent") {
    copy.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() ||
        a.name.localeCompare(b.name),
    );
  } else {
    copy.sort(
      (a, b) =>
        b.active - a.active || a.name.localeCompare(b.name),
    );
  }
  return copy;
}
