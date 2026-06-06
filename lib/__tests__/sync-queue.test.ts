import { describe, it, expect, beforeEach } from "vitest";
import {
  enqueue,
  getQueue,
  getPendingOperations,
  getFailedOperations,
  updateOperationStatus,
  removeOperation,
  clearResolved,
  getQueueStats,
  mergeConsecutiveUpdates,
  setQueue,
} from "../offline/sync-queue";


beforeEach(() => {
  localStorage.clear();
  setQueue([]);
});

describe("enqueue", () => {
  it("adds a pending operation to the queue", () => {
    const op = enqueue("create", "items", "record-1", { title: "test" });
    expect(op.status).toBe("pending");
    expect(op.type).toBe("create");
    expect(op.table).toBe("items");
    expect(op.recordId).toBe("record-1");
    expect(op.payload).toEqual({ title: "test" });
    expect(op.retryCount).toBe(0);
    expect(op.id).toBeTruthy();
  });

  it("persists to localStorage", () => {
    enqueue("update", "projects", "proj-1", { name: "Project" });
    const raw = localStorage.getItem("orkest-sync-queue");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].recordId).toBe("proj-1");
  });
});

describe("getPendingOperations", () => {
  it("returns only pending and failed ops", () => {
    enqueue("create", "items", "op-1", {});
    const op2 = enqueue("update", "items", "op-2", {});
    const op3 = enqueue("delete", "items", "op-3", {});
    updateOperationStatus(op2.id, "syncing");
    updateOperationStatus(op3.id, "resolved");

    const pending = getPendingOperations();
    expect(pending).toHaveLength(1);
    expect(pending[0].recordId).toBe("op-1");
  });
});

describe("updateOperationStatus", () => {
  it("updates status and retryCount", () => {
    const op = enqueue("create", "items", "rec-1", {});
    updateOperationStatus(op.id, "failed", 3);
    const queue = getQueue();
    expect(queue[0].status).toBe("failed");
    expect(queue[0].retryCount).toBe(3);
  });

  it("does nothing for unknown id", () => {
    updateOperationStatus("non-existent", "resolved");
    expect(getQueue()).toHaveLength(0);
  });
});

describe("removeOperation", () => {
  it("removes the operation by id", () => {
    const op1 = enqueue("create", "items", "rec-1", {});
    const op2 = enqueue("update", "items", "rec-2", {});
    removeOperation(op1.id);
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0].id).toBe(op2.id);
  });
});

describe("clearResolved", () => {
  it("removes all resolved operations", () => {
    const op1 = enqueue("create", "items", "rec-1", {});
    const op2 = enqueue("update", "items", "rec-2", {});
    updateOperationStatus(op1.id, "resolved");
    clearResolved();
    expect(getQueue()).toHaveLength(1);
    expect(getQueue()[0].id).toBe(op2.id);
  });
});

describe("getQueueStats", () => {
  it("returns correct counts", () => {
    const op1 = enqueue("create", "items", "r1", {});
    const op2 = enqueue("update", "items", "r2", {});
    enqueue("delete", "items", "r3", {});
    updateOperationStatus(op1.id, "syncing");
    updateOperationStatus(op2.id, "failed");

    const stats = getQueueStats();
    expect(stats.pending).toBe(1);
    expect(stats.syncing).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.total).toBe(3);
  });
});

describe("getFailedOperations", () => {
  it("returns only failed operations", () => {
    enqueue("create", "items", "r1", {});
    const op2 = enqueue("update", "items", "r2", {});
    updateOperationStatus(op2.id, "failed");
    const failed = getFailedOperations();
    expect(failed).toHaveLength(1);
    expect(failed[0].recordId).toBe("r2");
  });
});

describe("mergeConsecutiveUpdates", () => {
  it("merges consecutive pending updates for same record", () => {
    enqueue("update", "items", "rec-1", { title: "first" });
    enqueue("update", "items", "rec-1", { priority: "high" });
    enqueue("update", "items", "rec-1", { tags: ["urgent"] });

    const merged = mergeConsecutiveUpdates("rec-1");
    expect(merged).toBe(true);

    const queue = getQueue();
    const ops = queue.filter((op) => op.recordId === "rec-1");
    expect(ops).toHaveLength(1);
    expect(ops[0].payload).toEqual({
      title: "first",
      priority: "high",
      tags: ["urgent"],
    });
  });

  it("does not merge if fewer than 2 pending ops", () => {
    enqueue("update", "items", "rec-1", { title: "only" });
    const result = mergeConsecutiveUpdates("rec-1");
    expect(result).toBe(false);
  });

  it("does not merge resolved/ syncing ops", () => {
    const op1 = enqueue("update", "items", "rec-1", { title: "a" });
    enqueue("update", "items", "rec-1", { title: "b" });
    updateOperationStatus(op1.id, "syncing");

    const result = mergeConsecutiveUpdates("rec-1");
    expect(result).toBe(false);
  });
});
