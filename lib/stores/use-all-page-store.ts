import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Item } from "../types/item";
import type { ManualItemRecord, DisplayItem, ItemFormState, SubtaskFormItem, Section, AiMode, AiTargetItem, ListFilterConfig, ListSortConfig, CalendarRescheduleTarget } from "../types/all-page";
import {
  emptyForm,
  dedupeManualItemRecords,
  formatDateInput,
  toItemFromManualRecord,
  toManualItemRecord,
  toFormStateFromItem,
  buildDisplayItems,
  buildSections,
  buildRecordFromForm,
  validateItemForm,
  serializeOccurrenceKey,
  makeUid,
  isRecurringItem,
  makeDateFromInput,
} from "../all-page-utils";
import { createClient } from "../supabase/client";
import { dbRowToManualItemRecord } from "../supabase/mapping";
import { syncRecord } from "../offline/sync-engine";
import { getDateLocale } from "./use-settings-store";
import { getBrowserTimezone } from "../timezone";
import { dayjs } from "../dayjs";

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

interface AllPageState {
  manualItems: ManualItemRecord[];
  isComposerOpen: boolean;
  form: ItemFormState;
  formError: string | null;
  tagInput: string;
  editingItem: Item | null;
  shouldAutoExpandMoreOptions: boolean;
  composerSubmitOverride: ((form: ItemFormState, editingItem: Item | null) => string | null) | null;
  selectedItem: string | null;
  translator: ((key: string, values?: Record<string, string | number>) => string) | null;

  // AI panel state
  aiMode: AiMode;
  aiTargetItem: AiTargetItem | null;

  // Sort config
  listSortConfig: ListSortConfig;
  listFilterConfig: ListFilterConfig;

  // Computed
  sections: Section[];
  currentMonthLabel: string;

  // Supabase sync state
  isSyncing: boolean;
  isLoaded: boolean;

  // Actions
  setForm: (update: Partial<ItemFormState> | ((current: ItemFormState) => ItemFormState)) => void;
  setTagInput: (value: string) => void;
  setFormError: (error: string | null) => void;
  setSelectedItem: (key: string | null) => void;
  setTranslator: (translator: TranslateFn) => void;
  setComposerSubmitOverride: (
    override: ((form: ItemFormState, editingItem: Item | null) => string | null) | null,
  ) => void;
  setAiMode: (mode: AiMode) => void;
  setAiTargetItem: (item: AiTargetItem | null) => void;
  setListSortConfig: (update: Partial<ListSortConfig>) => void;
  setListFilterConfig: (update: Partial<ListFilterConfig>) => void;
  openComposer: (item?: DisplayItem) => void;
  openComposerWithForm: (formState: ItemFormState, editingItem?: Item) => void;
  scheduleItemForToday: (item: DisplayItem) => void;
  removeItemFromTodayPlan: (item: DisplayItem) => void;
  setItemAsNowForToday: (item: DisplayItem) => void;
  deferItemForToday: (item: DisplayItem) => void;
  dismissItemFromToday: (item: DisplayItem) => void;
  applyAiUpdate: (itemId: string, form: ItemFormState) => void;
  applyAiUpdates: (updates: Array<{ itemId: string; form: ItemFormState }>) => void;
  closeComposer: () => void;
  resetForm: () => void;
  handleCreateItem: (formOverride?: ItemFormState) => { error: string | null; itemId?: string };
  handleCreateItems: (forms: ItemFormState[]) => string | null;
  handleToggleComplete: (item: DisplayItem) => void;
  handleMoveItemToColumn: (item: DisplayItem, targetColumn: "backlog" | "today" | "done") => { originalRecord: ManualItemRecord } | null;
  restoreMovedItem: (record: ManualItemRecord) => void;
  handleEditItem: (item: DisplayItem) => void;
  patchManualItem: (itemId: string, patch: Partial<ManualItemRecord>) => void;
  handleDeleteItem: (item: DisplayItem, scope?: "single" | "series") => void;
  handleToggleSubtaskComplete: (subtaskRecord: ManualItemRecord, occurrenceKey?: string) => void;
  getSubtasksForItem: (parentId: string) => ManualItemRecord[];
  rescheduleItemFromCalendar: (item: DisplayItem, target: CalendarRescheduleTarget, timezoneOverride?: string) => void;

  // Batch operations
  handleBatchDelete: (items: DisplayItem[]) => void;
  handleBatchToggleComplete: (items: DisplayItem[], targetStatus: "completed" | "active") => void;
  handleBatchMoveToProject: (items: DisplayItem[], projectId: string | null) => void;

  // Undo
  undoToast: { label: string; undoAction?: () => void } | null;
  undo: () => void;
  dismissUndoToast: () => void;
  showUndoToast: (label: string, undoAction: () => void) => void;

  // Trash operations
  restoreItem: (itemId: string) => void;
  permanentlyDeleteItem: (itemId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;

  // Supabase actions
  loadItemsFromCloud: (userId: string) => Promise<void>;
  resetStore: () => void;

  // Realtime actions
  applyRemoteItemChange: (record: ManualItemRecord) => void;
  applyRemoteDelete: (recordId: string) => void;
}

function upsertManualItem(
  current: ManualItemRecord[],
  updatedItem: ManualItemRecord,
): ManualItemRecord[] {
  const itemExists = current.some((item) => item.id === updatedItem.id);
  if (itemExists) {
    return current.map((item) => (item.id === updatedItem.id ? updatedItem : item));
  }
  return [...current, updatedItem];
}

function computeSections(manualItems: ManualItemRecord[]): Section[] {
  const uniqueManualItems = dedupeManualItemRecords(manualItems);
  const combinedItems = uniqueManualItems
    .filter((record) => !record.deletedAt && !record.parentId)
    .map((item) => toItemFromManualRecord(item));
  const displayItems = buildDisplayItems(combinedItems);
  return buildSections(displayItems);
}

/** Minimum upcoming occurrence notifications to keep per recurring item */
const MIN_UPCOMING_NOTIFICATIONS = 10;

/**
 * Find recurring items whose occurrence notifications are running low
 * and trigger rescheduling via the sync engine.
 */
function rescheduleStaleReminders(items: ManualItemRecord[]): void {
  const today = new Date().toISOString().slice(0, 10);
  let enqueued = 0;
  for (const item of items) {
    if (!item.rrule || !item.reminders?.length || !item.startDate) continue;
    let upcoming = 0;
    for (const r of item.reminders) {
      if (r.occurrenceNotifications?.length) {
        for (const occ of r.occurrenceNotifications) {
          if (occ.date >= today) upcoming++;
        }
      }
    }
    if (upcoming < MIN_UPCOMING_NOTIFICATIONS) {
      console.log("[ORKEST-DEBUG][Reschedule] enqueueing item", item.id, "title=", item.title, "upcoming=", upcoming, "threshold=", MIN_UPCOMING_NOTIFICATIONS, "rrule=", item.rrule);
      syncRecord("update", "items", item.id, item as unknown as Record<string, unknown>);
      enqueued++;
    }
  }
  if (enqueued > 0) {
    console.log("[ORKEST-DEBUG][Reschedule] total enqueued this run:", enqueued, "out of", items.length, "items");
  }
}

function getMonthFormatter(): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(getDateLocale(), {
    month: "long",
    year: "numeric",
    timeZone: getBrowserTimezone() || undefined,
  });
}

const defaultListSortConfig: ListSortConfig = {
  mode: "time",
  timeDirection: "asc",
  allDayPreference: "allDayFirst",
  unscheduledSort: "newest",
  createdDirection: "desc",
  prioritySubField: "startTime",
  prioritySubDirection: "asc",
  prioritySchedulePreference: "scheduledFirst",
};

const defaultListFilterConfig: ListFilterConfig = {
  timePreset: "none",
  customStartDate: "",
  customEndDate: "",
  status: "all",
  selectedTags: [],
  tagMatchMode: "or",
  selectedPriorities: [],
  selectedProjectIds: [],
  searchQuery: "",
};

// Module-level undo stack (not persisted)
const _undoStack: ManualItemRecord[][] = [];
let _undoTimerRef: ReturnType<typeof setTimeout> | null = null;

const initialState = {
  manualItems: [] as ManualItemRecord[],
  isComposerOpen: false,
  form: emptyForm,
  formError: null as string | null,
  tagInput: "",
  editingItem: null as Item | null,
  shouldAutoExpandMoreOptions: false,
  composerSubmitOverride: null as ((form: ItemFormState, editingItem: Item | null) => string | null) | null,
  selectedItem: null as string | null,
  translator: null as ((key: string, values?: Record<string, string | number>) => string) | null,
  listSortConfig: defaultListSortConfig,
  sections: [] as Section[],
  currentMonthLabel: getMonthFormatter().format(new Date()),
  isSyncing: false,
  isLoaded: false,
  aiMode: "create" as AiMode,
  aiTargetItem: null,
  listFilterConfig: defaultListFilterConfig,
  undoToast: null as { label: string; undoAction?: () => void } | null,
};

export const useAllPageStore = create<AllPageState>()(
  persist(
    (set, get) => ({
      ...initialState,

  setForm: (update) => {
    set((state) => ({
      form:
        typeof update === "function"
          ? update(state.form)
          : { ...state.form, ...update },
    }));
  },

  setTagInput: (value) => set({ tagInput: value }),
  setFormError: (error) => set({ formError: error }),
  setSelectedItem: (key) => set({ selectedItem: key }),
  setTranslator: (translator) => set({ translator }),
  setComposerSubmitOverride: (override) => set({ composerSubmitOverride: override }),
  setAiMode: (mode) => set({ aiMode: mode }),
  setAiTargetItem: (item) => set({ aiTargetItem: item, aiMode: item ? "update" : get().aiMode }),
  setListSortConfig: (update) =>
    set((state) => ({
      listSortConfig: { ...state.listSortConfig, ...update },
    })),
  setListFilterConfig: (update) =>
    set((state) => ({
      // Spread the defaults first so any missing fields from older persisted
      // snapshots (e.g. `selectedProjectIds` added later) are backfilled on
      // every write instead of persisting `undefined` values forever.
      listFilterConfig: {
        ...defaultListFilterConfig,
        ...state.listFilterConfig,
        ...update,
      },
    })),

  openComposer: (item?: DisplayItem) => {
    if (item) {
      const sourceItem = item.seriesSource ?? item;
      const existingSubtasks = get().manualItems
        .filter((r) => r.parentId === sourceItem.id && !r.deletedAt)
        .map((r): SubtaskFormItem => ({ id: r.id, title: r.title }));
      set({
        editingItem: sourceItem,
        form: toFormStateFromItem(sourceItem, existingSubtasks),
        tagInput: "",
        formError: null,
        shouldAutoExpandMoreOptions: true,
        isComposerOpen: true,
      });
    } else {
      const { listFilterConfig } = get();
      const selectedProjectId = listFilterConfig.selectedProjectIds?.[0];
      set({
        form: { ...emptyForm, timezone: getBrowserTimezone(), projectId: selectedProjectId || "" },
        formError: null,
        tagInput: "",
        editingItem: null,
        shouldAutoExpandMoreOptions: false,
        isComposerOpen: true,
      });
    }
  },

  openComposerWithForm: (formState, editingItem) => {
    const { listFilterConfig } = get();
    const selectedProjectId = listFilterConfig.selectedProjectIds?.[0];
    const sanitizedForm: ItemFormState = {
      ...formState,
      endDate: formState.endDate ?? "",
      endTime: formState.endTime ?? "",
      dueDate: formState.dueDate ?? "",
      recurrenceEndDate: formState.recurrenceEndDate ?? "",
      recurrenceCount: formState.recurrenceCount ?? "10",
      monthlyPattern: formState.monthlyPattern ?? "day_of_month",
      nthWeekdayPosition: formState.nthWeekdayPosition ?? "2",
      nthWeekdayDay: formState.nthWeekdayDay ?? 2,
      estimateMinutes: formState.estimateMinutes ?? "",
      projectId: formState.projectId || (!editingItem && selectedProjectId ? selectedProjectId : ""),
      projectName: formState.projectName || (!editingItem && selectedProjectId ? "" : ""),
      progressIds: formState.progressIds ?? [],
    };
    set({
      form: sanitizedForm,
      formError: null,
      tagInput: "",
      editingItem: editingItem ?? null,
      shouldAutoExpandMoreOptions: true,
      isComposerOpen: true,
    });
  },

  scheduleItemForToday: (item) => {
    const sourceItem = item.seriesSource ?? item;
    const { manualItems } = get();
    const existingManualItem = manualItems.find((record) => record.id === sourceItem.id);
    if (!existingManualItem) {
      return;
    }

    const todayKey = formatDateInput(new Date());
    const updatedRecord = {
      ...existingManualItem,
      hasTime: false,
      startDate: undefined,
      startTime: undefined,
      endDate: undefined,
      endTime: undefined,
      allDay: false,
      plannedTodayDates: Array.from(new Set([...(existingManualItem.plannedTodayDates ?? []), todayKey])),
      dismissedTodayDates: (existingManualItem.dismissedTodayDates ?? []).filter((date) => date !== todayKey),
      updatedAt: new Date().toISOString(),
    } satisfies ManualItemRecord;

    const newManualItems = upsertManualItem(manualItems, updatedRecord);
    const sections = computeSections(newManualItems);
    set({ manualItems: newManualItems, sections });

    syncRecord("update", "items", updatedRecord.id, updatedRecord);
  },

  removeItemFromTodayPlan: (item) => {
    const baseItem = item.seriesSource ?? item;
    const { manualItems } = get();
    const existingManualItem = manualItems.find((record) => record.id === baseItem.id);
    if (!existingManualItem) {
      return;
    }

    const todayKey = formatDateInput(new Date());
    const updatedRecord = {
      ...existingManualItem,
      plannedTodayDates: (existingManualItem.plannedTodayDates ?? []).filter((date) => date !== todayKey),
      nowOverrideDate: existingManualItem.nowOverrideDate === todayKey ? undefined : existingManualItem.nowOverrideDate,
      updatedAt: new Date().toISOString(),
    } satisfies ManualItemRecord;

    const newManualItems = upsertManualItem(manualItems, updatedRecord);
    const sections = computeSections(newManualItems);
    set({ manualItems: newManualItems, sections });

    syncRecord("update", "items", updatedRecord.id, updatedRecord);
  },

  setItemAsNowForToday: (item) => {
    const baseItem = item.seriesSource ?? item;
    const { manualItems } = get();
    const existingManualItem = manualItems.find((record) => record.id === baseItem.id);
    if (!existingManualItem) {
      return;
    }

    const todayKey = formatDateInput(new Date());
    const now = new Date().toISOString();
    const updatedRecords: ManualItemRecord[] = [];

    for (const record of manualItems) {
      if (record.parentId || record.deletedAt) {
        continue;
      }

      if (record.id === baseItem.id) {
        updatedRecords.push({
          ...record,
          nowOverrideDate: todayKey,
          deferredUntil: undefined,
          dismissedTodayDates: (record.dismissedTodayDates ?? []).filter((date) => date !== todayKey),
          updatedAt: now,
        });
        continue;
      }

      if (record.nowOverrideDate === todayKey) {
        updatedRecords.push({
          ...record,
          nowOverrideDate: undefined,
          updatedAt: now,
        });
      }
    }

    if (updatedRecords.length === 0) {
      return;
    }

    let newManualItems = manualItems;
    for (const record of updatedRecords) {
      newManualItems = upsertManualItem(newManualItems, record);
    }

    const sections = computeSections(newManualItems);
    set({ manualItems: newManualItems, sections });

    for (const record of updatedRecords) {
      syncRecord("update", "items", record.id, record);
    }
  },

  deferItemForToday: (item) => {
    const baseItem = item.seriesSource ?? item;
    const { manualItems } = get();
    const existingManualItem = manualItems.find((record) => record.id === baseItem.id);
    if (!existingManualItem) {
      return;
    }

    const now = new Date();
    const todayKey = formatDateInput(now);
    const updatedRecord = toManualItemRecord(baseItem, {
      deferredUntil: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      dismissedTodayDates: existingManualItem.dismissedTodayDates,
      nowOverrideDate:
        existingManualItem.nowOverrideDate === todayKey ? undefined : existingManualItem.nowOverrideDate,
      deletedAt: existingManualItem.deletedAt ?? (baseItem.deletedAt ? baseItem.deletedAt.toISOString() : undefined),
      createdAt: existingManualItem.createdAt,
      updatedAt: now.toISOString(),
    });

    const newManualItems = upsertManualItem(manualItems, updatedRecord);
    const sections = computeSections(newManualItems);
    set({ manualItems: newManualItems, sections });
    syncRecord("update", "items", updatedRecord.id, updatedRecord);
  },

  dismissItemFromToday: (item) => {
    const baseItem = item.seriesSource ?? item;
    const { manualItems } = get();
    const existingManualItem = manualItems.find((record) => record.id === baseItem.id);
    if (!existingManualItem) {
      return;
    }

    const todayKey = formatDateInput(new Date());
    const updatedRecord = toManualItemRecord(baseItem, {
      dismissedTodayDates: Array.from(new Set([...(existingManualItem.dismissedTodayDates ?? []), todayKey])),
      deferredUntil: existingManualItem.deferredUntil,
      nowOverrideDate:
        existingManualItem.nowOverrideDate === todayKey ? undefined : existingManualItem.nowOverrideDate,
      deletedAt: existingManualItem.deletedAt ?? (baseItem.deletedAt ? baseItem.deletedAt.toISOString() : undefined),
      createdAt: existingManualItem.createdAt,
      updatedAt: new Date().toISOString(),
    });

    const newManualItems = upsertManualItem(manualItems, updatedRecord);
    const sections = computeSections(newManualItems);
    set({ manualItems: newManualItems, sections });
    syncRecord("update", "items", updatedRecord.id, updatedRecord);
  },

  closeComposer: () => {
    set({ isComposerOpen: false, composerSubmitOverride: null });
    get().resetForm();
  },

  resetForm: () => {
    set({
      form: emptyForm,
      formError: null,
      tagInput: "",
      editingItem: null,
      shouldAutoExpandMoreOptions: false,
      composerSubmitOverride: null,
    });
  },

  applyAiUpdate: (itemId, form) => {
    const { manualItems } = get();
    const targetRecord = manualItems.find((r) => r.id === itemId);
    if (!targetRecord) return;

    const now = new Date().toISOString();
    const updatedItem = buildRecordFromForm({
      form,
      existingManualItem: targetRecord,
      now,
      id: targetRecord.id,
      uid: targetRecord.uid,
    });

    let newManualItems = manualItems.map((item) =>
      item.id === updatedItem.id ? updatedItem : item
    );
    newManualItems = syncSubtasks(newManualItems, itemId, form.subtasks, now);
    const sections = computeSections(newManualItems);
    set({ manualItems: newManualItems, sections });

    queueParentWithSubtasksSync(newManualItems, updatedItem);
  },

  applyAiUpdates: (updates) => {
    const { manualItems } = get();
    if (updates.length === 0) return;

    const now = new Date().toISOString();
    let nextManualItems = manualItems;
    const updatedRecords: ManualItemRecord[] = [];

    for (const update of updates) {
      const targetRecord = nextManualItems.find((record) => record.id === update.itemId);
      if (!targetRecord) continue;

      const updatedItem = buildRecordFromForm({
        form: update.form,
        existingManualItem: targetRecord,
        now,
        id: targetRecord.id,
        uid: targetRecord.uid,
      });

      nextManualItems = nextManualItems.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      );
      nextManualItems = syncSubtasks(nextManualItems, update.itemId, update.form.subtasks, now);
      updatedRecords.push(updatedItem);
    }

    if (updatedRecords.length === 0) return;

    const sections = computeSections(nextManualItems);
    set({ manualItems: nextManualItems, sections });

    for (const record of updatedRecords) {
      queueParentWithSubtasksSync(nextManualItems, record);
    }
  },

  loadItemsFromCloud: async (userId: string) => {
    // Prevent concurrent loads (e.g. when multiple effects fire on mount)
    if (get().isSyncing) return;
    set({ isSyncing: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[ORKEST-DEBUG][LoadItems] select failed:", error);
        return;
      }

      const manualItems = (data ?? []).map((row) => dbRowToManualItemRecord(row));
      const recurring = manualItems.filter((i) => i.rrule);
      console.log("[ORKEST-DEBUG][LoadItems] loaded", manualItems.length, "items,", recurring.length, "recurring");

      const sections = computeSections(manualItems);
      set({ manualItems, sections, isLoaded: true });

      // Replenish stale reminders for recurring items (rolling window for push)
      rescheduleStaleReminders(manualItems);
    } catch (err) {
      console.error("[ORKEST-DEBUG][LoadItems] threw:", err);
    } finally {
      set({ isSyncing: false });
    }
  },

  resetStore: () => {
    set(initialState);
  },

  applyRemoteItemChange: (record) => {
    set((state) => {
      const newManualItems = upsertManualItem(state.manualItems, record);
      const sections = computeSections(newManualItems);
      return { manualItems: newManualItems, sections };
    });
  },

  applyRemoteDelete: (recordId) => {
    set((state) => {
      const newManualItems = state.manualItems.filter((item) => item.id !== recordId);
      const sections = computeSections(newManualItems);
      return { manualItems: newManualItems, sections };
    });
  },

  undo: () => {
    const { undoToast } = get();
    if (undoToast?.undoAction) {
      undoToast.undoAction();
      set({ undoToast: null });
      return;
    }
    if (_undoStack.length === 0) return;
    const snapshot = _undoStack.pop()!;
    if (_undoTimerRef) { clearTimeout(_undoTimerRef); _undoTimerRef = null; }

    const sections = computeSections(snapshot);
    set({ manualItems: snapshot, sections, undoToast: null });

    // Re-sync all restored records to Supabase
    for (const record of snapshot) {
      if (!record.deletedAt) {
        syncRecord("update", "items", record.id, record);
      }
    }
  },

  dismissUndoToast: () => {
    _undoStack.length = 0;
    if (_undoTimerRef) { clearTimeout(_undoTimerRef); _undoTimerRef = null; }
    set({ undoToast: null });
  },

  showUndoToast: (label, undoAction) => {
    if (_undoTimerRef) clearTimeout(_undoTimerRef);
    set({ undoToast: { label, undoAction } });
    _undoTimerRef = setTimeout(() => set({ undoToast: null }), 5000);
  },

  handleCreateItem: (formOverride) => {
    const { form, editingItem, manualItems, translator } = get();
    const nextForm = formOverride ?? form;
    const validationError = validateItemForm(nextForm, translator ?? undefined);
    if (validationError) {
      set({ formError: validationError });
      return { error: validationError };
    }

    const now = new Date().toISOString();

    if (editingItem) {
      const existingManualItem = manualItems.find((item) => item.id === editingItem.id);
      const updatedItem = buildRecordFromForm({
        form: nextForm,
        baseItem: editingItem,
        existingManualItem,
        now,
        id: editingItem.id,
        uid: existingManualItem?.uid ?? editingItem.uid,
      });

      let newManualItems = upsertManualItem(manualItems, updatedItem);

      // Sync subtasks for edit mode
      newManualItems = syncSubtasks(newManualItems, editingItem.id, nextForm.subtasks, now);

      const sections = computeSections(newManualItems);
      set({ manualItems: newManualItems, sections, isComposerOpen: false });
      get().resetForm();

      // Sync to Supabase
      queueParentWithSubtasksSync(newManualItems, updatedItem);
      return { error: null, itemId: editingItem.id };
    }

    const newId = makeUid();
    const newItem = buildRecordFromForm({
      form: nextForm,
      now,
      id: newId,
      uid: `manual-${makeUid()}`,
    });

    let newManualItems = upsertManualItem(manualItems, newItem);

    // Create subtasks for new item
    newManualItems = syncSubtasks(newManualItems, newId, nextForm.subtasks, now);

    const sections = computeSections(newManualItems);
    set({ manualItems: newManualItems, sections, isComposerOpen: false });
    get().resetForm();

    // Sync to Supabase
    queueParentWithSubtasksSync(newManualItems, newItem);
    return { error: null, itemId: newId };
  },

  handleCreateItems: (forms) => {
    const { manualItems, translator } = get();
    if (forms.length === 0) {
      return "No selected items to create.";
    }

    const now = new Date().toISOString();
    let nextManualItems = manualItems;
    const createdRecords: ManualItemRecord[] = [];

    for (const [index, form] of forms.entries()) {
      // Auto-fix: normalize date/time fields to prevent validation errors
      const fixedForm = { ...form };
      const todayStr = new Date().toISOString().slice(0, 10);
      
      // Fix 1: startDate without startTime -> set allDay
      if (fixedForm.startDate && !fixedForm.startTime && !fixedForm.allDay) {
        fixedForm.allDay = true;
      }
      
      // Fix 2: endDate without endTime -> set allDay
      if (fixedForm.endDate && !fixedForm.endTime && !fixedForm.allDay) {
        fixedForm.allDay = true;
      }
      
      // Fix 3: startTime without startDate -> set startDate to today
      if (fixedForm.startTime && !fixedForm.startDate) {
        fixedForm.startDate = todayStr;
      }
      
      // Fix 4: endTime without endDate -> set endDate to today
      if (fixedForm.endTime && !fixedForm.endDate) {
        fixedForm.endDate = todayStr;
      }
      
      // Fix 5: hasTime without startDate -> disable hasTime
      if (fixedForm.hasTime && !fixedForm.startDate) {
        fixedForm.hasTime = false;
      }
      
      // Fix 6: swap if end is before start
      if (fixedForm.startDate && fixedForm.endDate && fixedForm.endDate < fixedForm.startDate) {
        fixedForm.endDate = fixedForm.startDate;
        fixedForm.startDate = form.endDate;
      }
      if (fixedForm.startTime && fixedForm.endTime && fixedForm.startDate === fixedForm.endDate && fixedForm.endTime < fixedForm.startTime) {
        const temp = fixedForm.startTime;
        fixedForm.startTime = fixedForm.endTime;
        fixedForm.endTime = temp;
      }

      const validationError = validateItemForm(fixedForm, translator ?? undefined);
      if (validationError) {
        return `Item ${index + 1}: ${validationError}`;
      }

      const newId = makeUid();
      const newItem = buildRecordFromForm({
        form: fixedForm,
        now,
        id: newId,
        uid: `manual-${makeUid()}`,
      });

      nextManualItems = upsertManualItem(nextManualItems, newItem);
      nextManualItems = syncSubtasks(nextManualItems, newId, fixedForm.subtasks, now);
      createdRecords.push(newItem);
    }

    const sections = computeSections(nextManualItems);
    set({ manualItems: nextManualItems, sections, isComposerOpen: false });
    get().resetForm();

    for (const record of createdRecords) {
      queueParentWithSubtasksSync(nextManualItems, record);
    }

    return null;
  },

  handleToggleComplete: (item) => {
    const now = new Date().toISOString();
    const baseItem = item.seriesSource ?? item;

    set((state) => {
      const existingManualItem = state.manualItems.find((current) => current.id === baseItem.id);
      const preservedDeletedAt =
        existingManualItem?.deletedAt ?? (baseItem.deletedAt ? baseItem.deletedAt.toISOString() : undefined);

      let updatedRecord: ManualItemRecord;

      if (item.isRecurringInstance && item.occurrenceKey) {
        const currentCompletedOccurrences =
          existingManualItem?.completedOccurrences ??
          baseItem.completedOccurrences?.map(serializeOccurrenceKey) ??
          [];
        const currentReopenedOccurrences =
          existingManualItem?.reopenedOccurrences ??
          baseItem.reopenedOccurrences?.map(serializeOccurrenceKey) ??
          [];
        const completedOccurrences =
          item.status === "completed"
            ? currentCompletedOccurrences.filter(
                (occurrenceKey) => occurrenceKey !== item.occurrenceKey,
              )
            : Array.from(new Set([...currentCompletedOccurrences, item.occurrenceKey]));
        const reopenedOccurrences =
          item.status === "completed"
            ? Array.from(new Set([...currentReopenedOccurrences, item.occurrenceKey]))
            : currentReopenedOccurrences.filter(
                (occurrenceKey) => occurrenceKey !== item.occurrenceKey,
              );

        updatedRecord = toManualItemRecord(baseItem, {
          exdates:
            existingManualItem?.exdates ?? baseItem.exdates?.map(serializeOccurrenceKey),
          completedOccurrences,
          reopenedOccurrences,
          status: "active",
          deletedAt: preservedDeletedAt,
          createdAt: existingManualItem?.createdAt ?? baseItem.createdAt.toISOString(),
          updatedAt: now,
        });
      } else {
        const newStatus = item.status === "completed" ? "active" : "completed";
        updatedRecord = toManualItemRecord(baseItem, {
          status: newStatus,
          deletedAt: preservedDeletedAt,
          createdAt: existingManualItem?.createdAt ?? baseItem.createdAt.toISOString(),
          updatedAt: now,
        });
      }

      const newManualItems = upsertManualItem(state.manualItems, updatedRecord);
      const sections = computeSections(newManualItems);

      // Sync to Supabase
      syncRecord("update", "items", updatedRecord.id, updatedRecord);

      return { manualItems: newManualItems, sections };
    });
  },

  handleMoveItemToColumn: (item, targetColumn) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const todayKey = formatDateInput(now);
    const baseItem = item.seriesSource ?? item;
    let originalRecord: ManualItemRecord | undefined;
    let isUnsupported = false;

    set((state) => {
      const existingManualItem = state.manualItems.find((current) => current.id === baseItem.id);
      if (!existingManualItem) {
        return {};
      }
      originalRecord = existingManualItem;

      const preservedDeletedAt =
        existingManualItem?.deletedAt ??
        (baseItem.deletedAt ? baseItem.deletedAt.toISOString() : undefined);

      const isRecurringInstance = item.isRecurringInstance && Boolean(item.occurrenceKey);
      const currentCompletedOccurrences =
        existingManualItem?.completedOccurrences ??
        baseItem.completedOccurrences?.map(serializeOccurrenceKey) ??
        [];
      const currentReopenedOccurrences =
        existingManualItem?.reopenedOccurrences ??
        baseItem.reopenedOccurrences?.map(serializeOccurrenceKey) ??
        [];

      const overrides: Partial<ManualItemRecord> = {
        deletedAt: preservedDeletedAt,
        createdAt: existingManualItem?.createdAt ?? baseItem.createdAt.toISOString(),
        updatedAt: nowIso,
      };

      if (isRecurringInstance && item.occurrenceKey) {
        const occurrenceKey = item.occurrenceKey;
        if (targetColumn === "done") {
          if (!currentCompletedOccurrences.includes(occurrenceKey)) {
            overrides.completedOccurrences = Array.from(
              new Set([...currentCompletedOccurrences, occurrenceKey]),
            );
          }
          if (currentReopenedOccurrences.includes(occurrenceKey)) {
            overrides.reopenedOccurrences = currentReopenedOccurrences.filter(
              (entry) => entry !== occurrenceKey,
            );
          }
        } else if (targetColumn === "today") {
          // Reopen this occurrence: pull it out of completedOccurrences
          if (currentCompletedOccurrences.includes(occurrenceKey)) {
            overrides.completedOccurrences = currentCompletedOccurrences.filter(
              (entry) => entry !== occurrenceKey,
            );
            if (!currentReopenedOccurrences.includes(occurrenceKey)) {
              overrides.reopenedOccurrences = Array.from(
                new Set([...currentReopenedOccurrences, occurrenceKey]),
              );
            }
          }
        } else {
          // backlog: recurring tasks cannot be moved to unscheduled
          isUnsupported = true;
          return {};
        }
      } else {
        if (targetColumn === "done") {
          overrides.status = "completed";
          overrides.completedOccurrences = currentCompletedOccurrences;
          overrides.reopenedOccurrences = currentReopenedOccurrences;
        } else {
          overrides.status = "active";
          overrides.completedOccurrences = currentCompletedOccurrences;
          overrides.reopenedOccurrences = currentReopenedOccurrences;

          if (targetColumn === "today") {
            overrides.startDate = todayKey;
            overrides.startTime = undefined;
            overrides.endDate = undefined;
            overrides.endTime = undefined;
            overrides.dueDate = undefined;
            overrides.hasTime = false;
            overrides.allDay = true;
          } else {
            // backlog: clear all dates
            overrides.startDate = undefined;
            overrides.startTime = undefined;
            overrides.endDate = undefined;
            overrides.endTime = undefined;
            overrides.dueDate = undefined;
            overrides.hasTime = false;
            overrides.allDay = false;
          }
        }
      }

      const updatedRecord = toManualItemRecord(baseItem, overrides);
      const newManualItems = upsertManualItem(state.manualItems, updatedRecord);
      const sections = computeSections(newManualItems);

      syncRecord("update", "items", updatedRecord.id, updatedRecord);

      return { manualItems: newManualItems, sections };
    });

    if (isUnsupported) return null;
    return originalRecord ? { originalRecord } : null;
  },

  restoreMovedItem: (record) => {
    set((state) => {
      const newManualItems = upsertManualItem(state.manualItems, record);
      const sections = computeSections(newManualItems);
      syncRecord("update", "items", record.id, record);
      return { manualItems: newManualItems, sections };
    });
  },

  handleEditItem: (item) => {
    get().openComposer(item);
  },

  patchManualItem: (itemId, patch) => {
    const now = new Date().toISOString();
    set((state) => {
      const existing = state.manualItems.find((record) => record.id === itemId);
      if (!existing) return state;

      // Preserve recurring-instance-only fields (exdates, completedOccurrences, etc.)
      // when patching, since those are managed by handleToggleComplete.
      const nextRecord: ManualItemRecord = {
        ...existing,
        ...patch,
        id: existing.id,
        uid: existing.uid,
        createdAt: existing.createdAt,
        updatedAt: now,
        deletedAt: existing.deletedAt,
      };

      const newManualItems = upsertManualItem(state.manualItems, nextRecord);
      const sections = computeSections(newManualItems);
      syncRecord("update", "items", nextRecord.id, nextRecord);
      return { manualItems: newManualItems, sections };
    });
  },

  handleDeleteItem: (item, scope = "series") => {
    const { manualItems, translator } = get();
    const baseItem = item.seriesSource ?? item;
    const now = new Date().toISOString();

    // Save undo snapshot before mutation
    _undoStack.push(manualItems);
    const label = translator ? (scope === "single" ? translator("all.undoToast.singleRemoved") : translator("all.undoToast.deleted")) : "Item deleted";
    set({ undoToast: { label } });
    if (_undoTimerRef) clearTimeout(_undoTimerRef);
    _undoTimerRef = setTimeout(() => set({ undoToast: null }), 5000);

    set((state) => {
      const existingManualItem = state.manualItems.find((current) => current.id === baseItem.id);
      const preservedDeletedAt =
        existingManualItem?.deletedAt ??
        (baseItem.deletedAt ? baseItem.deletedAt.toISOString() : undefined);
      const existingExdates =
        existingManualItem?.exdates ?? baseItem.exdates?.map(serializeOccurrenceKey) ?? [];
      const existingCompletedOccurrences =
        existingManualItem?.completedOccurrences ??
        baseItem.completedOccurrences?.map(serializeOccurrenceKey) ??
        [];
      const existingReopenedOccurrences =
        existingManualItem?.reopenedOccurrences ??
        baseItem.reopenedOccurrences?.map(serializeOccurrenceKey) ??
        [];

      let updatedRecord: ManualItemRecord;

      if (scope === "single" && item.isRecurringInstance && item.occurrenceKey) {
        updatedRecord = toManualItemRecord(baseItem, {
          exdates: Array.from(new Set([...existingExdates, item.occurrenceKey!])),
          completedOccurrences: existingCompletedOccurrences.filter(
            (occurrenceKey) => occurrenceKey !== item.occurrenceKey,
          ),
          reopenedOccurrences: existingReopenedOccurrences.filter(
            (occurrenceKey) => occurrenceKey !== item.occurrenceKey,
          ),
          status: "active",
          deletedAt: preservedDeletedAt,
          createdAt: existingManualItem?.createdAt ?? baseItem.createdAt.toISOString(),
          updatedAt: now,
        });
      } else {
        updatedRecord = toManualItemRecord(baseItem, {
          exdates: existingExdates,
          completedOccurrences: existingCompletedOccurrences,
          reopenedOccurrences: existingReopenedOccurrences,
          deletedAt: now,
          createdAt: existingManualItem?.createdAt ?? baseItem.createdAt.toISOString(),
          updatedAt: now,
        });
      }

      const newManualItems = upsertManualItem(state.manualItems, updatedRecord);

      // For recurring series deletion, don't cascade soft-delete subtasks
      // because completed instances still need to display their subtasks.
      // For non-recurring items, cascade soft-delete subtasks.
      let cascadedManualItems = newManualItems;
      if (scope !== "single" && updatedRecord.deletedAt && !isRecurringItem(baseItem)) {
        cascadedManualItems = newManualItems.map((mi) =>
          mi.parentId === baseItem.id && !mi.deletedAt
            ? { ...mi, deletedAt: now, updatedAt: now }
            : mi,
        );
        // Sync cascaded deletes
        for (const mi of cascadedManualItems) {
          if (mi.parentId === baseItem.id && mi.deletedAt === now) {
            syncRecord("delete", "items", mi.id, mi);
          }
        }
      }

      const sections = computeSections(cascadedManualItems);

      // Sync to Supabase - use "delete" type for actual deletions so Google Calendar push works
      const syncType = updatedRecord.deletedAt ? "delete" : "update";
      syncRecord(syncType, "items", updatedRecord.id, updatedRecord);

      return { manualItems: cascadedManualItems, sections, selectedItem: null };
    });
  },

  handleToggleSubtaskComplete: (subtaskRecord, occurrenceKey) => {
    const now = new Date().toISOString();
    set((state) => {
      let updatedRecord: ManualItemRecord;

      if (occurrenceKey) {
        // Recurring instance: toggle completion for this specific occurrence
        const currentKeys = subtaskRecord.completedOccurrenceKeys ?? [];
        const isCurrentlyCompleted = currentKeys.includes(occurrenceKey);
        const completedOccurrenceKeys = isCurrentlyCompleted
          ? currentKeys.filter((k) => k !== occurrenceKey)
          : Array.from(new Set([...currentKeys, occurrenceKey]));

        updatedRecord = {
          ...subtaskRecord,
          completedOccurrenceKeys,
          updatedAt: now,
        };
      } else {
        // Non-recurring item: toggle status directly
        const newStatus = subtaskRecord.status === "completed" ? "active" : "completed";
        updatedRecord = {
          ...subtaskRecord,
          status: newStatus,
          updatedAt: now,
        };
      }

      const newManualItems = upsertManualItem(state.manualItems, updatedRecord);
      const sections = computeSections(newManualItems);
      syncRecord("update", "items", updatedRecord.id, updatedRecord);
      return { manualItems: newManualItems, sections };
    });
  },

  getSubtasksForItem: (parentId) => {
    return get().manualItems.filter(
      (r) => r.parentId === parentId && !r.deletedAt,
    );
  },

  rescheduleItemFromCalendar: (item, target, timezoneOverride) => {
    if (item.isRecurringInstance || isRecurringItem(item)) {
      return;
    }

    const baseItem = item.seriesSource ?? item;
    const { manualItems } = get();
    const existingManualItem = manualItems.find((record) => record.id === baseItem.id);
    if (!existingManualItem || existingManualItem.deletedAt) {
      return;
    }

    const updatedRecord = buildCalendarRescheduledRecord(
      existingManualItem,
      target,
      new Date().toISOString(),
      timezoneOverride,
    );
    const newManualItems = upsertManualItem(manualItems, updatedRecord);
    const sections = computeSections(newManualItems);
    set({ manualItems: newManualItems, sections });
    syncRecord("update", "items", updatedRecord.id, updatedRecord);
  },

  handleBatchDelete: (items) => {
    const { manualItems, translator } = get();
    const now = new Date().toISOString();

    // Save undo snapshot before mutation
    _undoStack.push(manualItems);
    const label = translator ? translator("all.undoToast.batchDeleted", { count: items.length }) : "Items deleted";
    set({ undoToast: { label } });
    if (_undoTimerRef) clearTimeout(_undoTimerRef);
    _undoTimerRef = setTimeout(() => set({ undoToast: null }), 5000);

    set((state) => {
      const updatedItems = [...state.manualItems];

      for (const item of items) {
        const baseItem = item.seriesSource ?? item;
        const itemIndex = updatedItems.findIndex((r) => r.id === baseItem.id);
        if (itemIndex === -1) continue;

        const existingManualItem = updatedItems[itemIndex];
        if (existingManualItem.deletedAt) continue;

        let updated: ManualItemRecord;

        if (item.isRecurringInstance && item.occurrenceKey) {
          const existingExdates = existingManualItem.exdates ?? [];
          const existingCompletedOccurrences = existingManualItem.completedOccurrences ?? [];
          const existingReopenedOccurrences = existingManualItem.reopenedOccurrences ?? [];

          updated = {
            ...existingManualItem,
            exdates: Array.from(new Set([...existingExdates, item.occurrenceKey])),
            completedOccurrences: existingCompletedOccurrences.filter(
              (occurrenceKey) => occurrenceKey !== item.occurrenceKey,
            ),
            reopenedOccurrences: existingReopenedOccurrences.filter(
              (occurrenceKey) => occurrenceKey !== item.occurrenceKey,
            ),
            status: "active",
            updatedAt: now,
          };
        } else {
          updated = {
            ...existingManualItem,
            deletedAt: now,
            updatedAt: now,
          };
        }

        updatedItems[itemIndex] = updated;
        const syncType = updated.deletedAt ? "delete" : "update";
        syncRecord(syncType, "items", updated.id, updated);
      }

      const sections = computeSections(updatedItems);
      return { manualItems: updatedItems, sections };
    });
  },

  handleBatchToggleComplete: (items, targetStatus) => {
    const { manualItems, translator } = get();
    const now = new Date().toISOString();

    // Save undo snapshot before mutation
    _undoStack.push(manualItems);
    const label = translator ? translator("all.undoToast.batchStatusChanged", { count: items.length }) : "Status changed";
    set({ undoToast: { label } });
    if (_undoTimerRef) clearTimeout(_undoTimerRef);
    _undoTimerRef = setTimeout(() => set({ undoToast: null }), 5000);

    set((state) => {
      const updatedItems = [...state.manualItems];

      for (const item of items) {
        const baseItem = item.seriesSource ?? item;
        const itemIndex = updatedItems.findIndex((r) => r.id === baseItem.id);
        if (itemIndex === -1) continue;

        const existingManualItem = updatedItems[itemIndex];
        if (existingManualItem.deletedAt) continue;

        let updated: ManualItemRecord;

        if (item.isRecurringInstance && item.occurrenceKey) {
          const currentCompletedOccurrences =
            existingManualItem.completedOccurrences ?? [];
          const currentReopenedOccurrences =
            existingManualItem.reopenedOccurrences ?? [];

          const isMarkingComplete = targetStatus === "completed";
          const completedOccurrences = isMarkingComplete
            ? Array.from(new Set([...currentCompletedOccurrences, item.occurrenceKey]))
            : currentCompletedOccurrences.filter(
                (occurrenceKey) => occurrenceKey !== item.occurrenceKey,
              );
          const reopenedOccurrences = isMarkingComplete
            ? currentReopenedOccurrences.filter(
                (occurrenceKey) => occurrenceKey !== item.occurrenceKey,
              )
            : Array.from(new Set([...currentReopenedOccurrences, item.occurrenceKey]));

          updated = {
            ...existingManualItem,
            completedOccurrences,
            reopenedOccurrences,
            status: "active",
            updatedAt: now,
          };
        } else {
          updated = {
            ...existingManualItem,
            status: targetStatus,
            updatedAt: now,
          };
        }

        updatedItems[itemIndex] = updated;
        syncRecord("update", "items", updated.id, updated);
      }

      const sections = computeSections(updatedItems);
      return { manualItems: updatedItems, sections };
    });
  },

  handleBatchMoveToProject: (items, projectId) => {
    const { manualItems, translator } = get();
    const now = new Date().toISOString();

    // Save undo snapshot before mutation
    _undoStack.push(manualItems);
    const label = translator ? translator("all.undoToast.batchMoved", { count: items.length }) : "Items moved";
    set({ undoToast: { label } });
    if (_undoTimerRef) clearTimeout(_undoTimerRef);
    _undoTimerRef = setTimeout(() => set({ undoToast: null }), 5000);

    set((state) => {
      const updatedItems = [...state.manualItems];

      for (const item of items) {
        const baseItem = item.seriesSource ?? item;
        const itemIndex = updatedItems.findIndex((r) => r.id === baseItem.id);
        if (itemIndex === -1) continue;

        const existingManualItem = updatedItems[itemIndex];
        if (existingManualItem.deletedAt) continue;

        // For recurring instances we still update the base record's project.
        const updated: ManualItemRecord = {
          ...existingManualItem,
          projectId: projectId ?? undefined,
          updatedAt: now,
        };

        updatedItems[itemIndex] = updated;
        syncRecord("update", "items", updated.id, updated);
      }

      const sections = computeSections(updatedItems);
      return { manualItems: updatedItems, sections };
    });
  },

  restoreItem: (itemId) => {
    set((state) => {
      const item = state.manualItems.find((r) => r.id === itemId);
      if (!item || !item.deletedAt) return state;

      const now = new Date().toISOString();
      const restoredItem = { ...item, deletedAt: undefined, updatedAt: now };
      const updatedItems = state.manualItems.map((r) => (r.id === itemId ? restoredItem : r));

      // Also restore subtasks
      const itemsWithRestoredSubtasks = updatedItems.map((r) =>
        r.parentId === itemId && r.deletedAt ? { ...r, deletedAt: undefined, updatedAt: now } : r,
      );

      const sections = computeSections(itemsWithRestoredSubtasks);
      syncRecord("update", "items", itemId, restoredItem);

      return { manualItems: itemsWithRestoredSubtasks, sections };
    });
  },

  permanentlyDeleteItem: async (itemId) => {
    const supabase = createClient();
    
    const state = get();
    const item = state.manualItems.find((r) => r.id === itemId);
    if (!item) return;

    const childIds = state.manualItems.filter((r) => r.parentId === itemId).map((r) => r.id);
    const updatedItems = state.manualItems.filter((r) => r.id !== itemId && r.parentId !== itemId);
    const sections = computeSections(updatedItems);

    set({ manualItems: updatedItems, sections });

    // Delete from Supabase
    await supabase.from("items").delete().eq("id", itemId);
    for (const childId of childIds) {
      await supabase.from("items").delete().eq("id", childId);
    }
  },

  emptyTrash: async () => {
    const supabase = createClient();
    
    const state = get();
    const deletedItems = state.manualItems.filter((r) => r.deletedAt);
    const deletedIds = new Set(deletedItems.map((r) => r.id));

    // Also collect subtask IDs of deleted parents
    for (const item of deletedItems) {
      state.manualItems.forEach((r) => {
        if (r.parentId === item.id) {
          deletedIds.add(r.id);
        }
      });
    }

    const updatedItems = state.manualItems.filter((r) => !deletedIds.has(r.id));
    const sections = computeSections(updatedItems);

    set({ manualItems: updatedItems, sections });

    // Delete from Supabase
    for (const id of deletedIds) {
      await supabase.from("items").delete().eq("id", id);
    }
  },
  }),
  {
    name: "orkest-list-controls",
    version: 1,
    migrate: (persistedState, version) => {
      // Bump `version` above whenever the persisted shape gains a new field.
      // Older snapshots are merged with the latest defaults so legacy users
      // (e.g. those whose saved `listFilterConfig` predates the
      // `selectedProjectIds` field) do not end up with `undefined` array
      // values that crash consumers.
      if (!persistedState || typeof persistedState !== "object") {
        return persistedState as never;
      }
      const state = persistedState as {
        listFilterConfig?: Partial<ListFilterConfig>;
        listSortConfig?: Partial<ListSortConfig>;
      };
      if (version < 1) {
        return {
          listFilterConfig: {
            ...defaultListFilterConfig,
            ...(state.listFilterConfig ?? {}),
          },
          listSortConfig: {
            ...defaultListSortConfig,
            ...(state.listSortConfig ?? {}),
          },
        } as never;
      }
      return persistedState as never;
    },
    partialize: (state) => ({
      listSortConfig: state.listSortConfig,
      listFilterConfig: state.listFilterConfig,
    }),
  },
  ),
);

function addDaysToDateInput(dateInput: string, days: number) {
  const date = makeDateFromInput(dateInput);
  if (!date) {
    return dateInput;
  }
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

function getDaySpan(startDate?: string, endDate?: string) {
  const start = makeDateFromInput(startDate);
  const end = makeDateFromInput(endDate);
  if (!start || !end) {
    return 0;
  }
  return Math.max(
    0,
    Math.round((startOfCalendarDay(end).getTime() - startOfCalendarDay(start).getTime()) / 86400000),
  );
}

function startOfCalendarDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function buildCalendarRescheduledRecord(
  record: ManualItemRecord,
  target: CalendarRescheduleTarget,
  now: string,
  timezoneOverride?: string,
): ManualItemRecord {
  const targetTz = timezoneOverride || getBrowserTimezone();

  if (record.dueDate && !record.startDate && !record.endDate) {
    return {
      ...record,
      hasTime: false,
      startDate: undefined,
      startTime: undefined,
      endDate: undefined,
      endTime: undefined,
      allDay: false,
      dueDate: target.date,
      timezone: targetTz,
      plannedTodayDates: undefined,
      updatedAt: now,
    };
  }

  if (target.time) {
    const nextStart = makeDateFromInput(target.date, target.time);
    if (!nextStart) {
      return { ...record, updatedAt: now };
    }

    const currentEnd = record.endDate
      ? makeDateFromInput(record.endDate, record.endTime, record.timezone)
      : undefined;

    if (!currentEnd) {
      return {
        ...record,
        hasTime: true,
        startDate: formatDateInput(nextStart, targetTz),
        startTime: formatTimeFromDate(nextStart, targetTz),
        endDate: undefined,
        endTime: undefined,
        allDay: false,
        timezone: targetTz,
        plannedTodayDates: undefined,
        updatedAt: now,
      };
    }

    const currentStart = makeDateFromInput(record.startDate, record.startTime, record.timezone);
    const durationMs = currentEnd.getTime() - currentStart!.getTime();
    const nextEnd = new Date(nextStart.getTime() + durationMs);

    return {
      ...record,
      hasTime: true,
      startDate: formatDateInput(nextStart, targetTz),
      startTime: formatTimeFromDate(nextStart, targetTz),
      endDate: formatDateInput(nextEnd, targetTz),
      endTime: formatTimeFromDate(nextEnd, targetTz),
      allDay: false,
      timezone: targetTz,
      plannedTodayDates: undefined,
      updatedAt: now,
    };
  }

  const daySpan = getDaySpan(record.startDate, record.endDate);
  const hasExistingTime = Boolean(record.startDate || record.startTime || record.endDate || record.endTime);

  if (hasExistingTime) {
    return {
      ...record,
      hasTime: true,
      startDate: target.date,
      endDate: record.endDate ? addDaysToDateInput(target.date, daySpan) : undefined,
      allDay: Boolean(record.allDay),
      timezone: targetTz,
      plannedTodayDates: undefined,
      updatedAt: now,
    };
  }

  return {
    ...record,
    hasTime: true,
    startDate: target.date,
    startTime: undefined,
    endDate: undefined,
    endTime: undefined,
    allDay: true,
    timezone: targetTz,
    plannedTodayDates: undefined,
    updatedAt: now,
  };
}

function formatTimeFromDate(date: Date, tz?: string) {
  if (tz) {
    return dayjs(date).tz(tz).format("HH:mm");
  }
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function queueParentWithSubtasksSync(
  manualItems: ManualItemRecord[],
  parentRecord: ManualItemRecord,
) {
  // Queue parent
  syncRecord("update", "items", parentRecord.id, parentRecord);

  // Queue subtasks
  const subtasks = manualItems.filter((r) => r.parentId === parentRecord.id);
  for (const subtask of subtasks) {
    syncRecord("update", "items", subtask.id, subtask);
  }

  // Embedding is handled inside sync-engine.ts
}

/**
 * Sync subtask records for a parent item.
 * Compares form subtasks with existing records to determine creates/updates/deletes.
 */
function syncSubtasks(
  manualItems: ManualItemRecord[],
  parentId: string,
  formSubtasks: SubtaskFormItem[],
  now: string,
): ManualItemRecord[] {
  const existingSubtasks = manualItems.filter(
    (r) => r.parentId === parentId && !r.deletedAt,
  );
  const existingMap = new Map(existingSubtasks.map((r) => [r.id, r]));

  // Determine which form subtasks are new vs existing
  const keepIds = new Set<string>();
  const newRecords: ManualItemRecord[] = [];

  for (const formSubtask of formSubtasks) {
    if (!formSubtask.title.trim()) continue;

    const existing = existingMap.get(formSubtask.id);
    if (existing) {
      // Update existing subtask if title changed
      keepIds.add(formSubtask.id);
      if (existing.title !== formSubtask.title.trim()) {
        newRecords.push({
          ...existing,
          title: formSubtask.title.trim(),
          updatedAt: now,
        });
      }
    } else {
      // Create new subtask
      const newId = formSubtask.id.startsWith("new-") ? makeUid() : formSubtask.id;
      keepIds.add(newId);
      newRecords.push({
        id: newId,
        uid: `manual-${makeUid()}`,
        title: formSubtask.title.trim(),
        hasTime: false,
        allDay: false,
        recurrenceType: "none",
        recurrenceInterval: 1,
        daysOfWeek: [],
        recurrenceEndType: "never",
        parentId,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Soft-delete subtasks that are no longer in the form
  const toDeleteIds = existingSubtasks
    .filter((r) => !keepIds.has(r.id))
    .map((r) => r.id);

  let result = manualItems;

  // Apply updates and creates
  for (const record of newRecords) {
    result = upsertManualItem(result, record);
  }

  // Apply soft-deletes
  if (toDeleteIds.length > 0) {
    result = result.map((mi) =>
      toDeleteIds.includes(mi.id) ? { ...mi, deletedAt: now, updatedAt: now } : mi,
    );
  }

  return result;
}
