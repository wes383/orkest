export type SyncTable = "items" | "projects";

export type SyncOperationType = "create" | "update" | "delete";

export type SyncOperationStatus = "pending" | "syncing" | "failed" | "resolved";

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  table: SyncTable;
  recordId: string;
  payload: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  status: SyncOperationStatus;
}

export interface NetworkState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
}
