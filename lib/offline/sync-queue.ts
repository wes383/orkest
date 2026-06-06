import type { SyncOperation, SyncOperationStatus, SyncTable } from "./types";

const STORAGE_KEY = "orkest-sync-queue";

function loadQueue(): SyncOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SyncOperation[];
  } catch {
    return [];
  }
}

function saveQueue(queue: SyncOperation[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage may be full
  }
}

let inMemoryQueue: SyncOperation[] | null = null;

export function getQueue(): SyncOperation[] {
  if (inMemoryQueue === null) {
    inMemoryQueue = loadQueue();
  }
  return inMemoryQueue;
}

export function setQueue(queue: SyncOperation[]) {
  inMemoryQueue = queue;
  saveQueue(queue);
}

export function getPendingOperations(): SyncOperation[] {
  return getQueue().filter((op) => op.status === "pending" || op.status === "failed");
}

export function getFailedOperations(): SyncOperation[] {
  return getQueue().filter((op) => op.status === "failed");
}

export function enqueue(
  type: SyncOperation["type"],
  table: SyncTable,
  recordId: string,
  payload: Record<string, unknown>,
): SyncOperation {
  const queue = getQueue();
  const op: SyncOperation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    table,
    recordId,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
    status: "pending",
  };
  queue.push(op);
  setQueue(queue);
  return op;
}

export function updateOperationStatus(opId: string, status: SyncOperationStatus, retryCount?: number) {
  const queue = getQueue();
  const index = queue.findIndex((op) => op.id === opId);
  if (index === -1) return;
  queue[index] = {
    ...queue[index],
    status,
    retryCount: retryCount ?? queue[index].retryCount,
  };
  setQueue(queue);
}

export function removeOperation(opId: string) {
  const queue = getQueue();
  const filtered = queue.filter((op) => op.id !== opId);
  setQueue(filtered);
}

export function clearResolved() {
  const queue = getQueue().filter((op) => op.status !== "resolved");
  setQueue(queue);
}

export function getQueueStats() {
  const queue = getQueue();
  return {
    pending: queue.filter((op) => op.status === "pending").length,
    syncing: queue.filter((op) => op.status === "syncing").length,
    failed: queue.filter((op) => op.status === "failed").length,
    total: queue.length,
  };
}

export function mergeConsecutiveUpdates(recordId: string): boolean {
  const queue = getQueue();
  const opsForRecord = queue.filter((op) => op.recordId === recordId);
  if (opsForRecord.length < 2) return false;

  const pendingOps = opsForRecord.filter((op) => op.status === "pending");
  if (pendingOps.length < 2) return false;

  // Keep only the last pending op, merge payloads
  const lastOp = pendingOps[pendingOps.length - 1];
  const mergedPayload: Record<string, unknown> = {};
  for (const op of pendingOps) {
    Object.assign(mergedPayload, op.payload);
  }

  const newQueue = queue.filter((op) => !(op.recordId === recordId && op.status === "pending" && op.id !== lastOp.id));
  const lastIndex = newQueue.findIndex((op) => op.id === lastOp.id);
  if (lastIndex !== -1) {
    newQueue[lastIndex] = { ...lastOp, payload: mergedPayload };
  }
  setQueue(newQueue);
  return true;
}
