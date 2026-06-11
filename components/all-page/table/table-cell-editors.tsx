"use client";

import { Check, Repeat, Tag, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import { rrulestr } from "rrule";

import { Input } from "@/components/ui/input";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useCellEditorOpenStore } from "@/lib/stores/use-cell-editor-open-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { buildRRuleString, getOrderedDayNames, PRIORITY_CONFIG, RECURRENCE_INTERVAL_MAX } from "@/lib/all-page-utils";
import { useI18n } from "@/lib/i18n";
import { getWeekStartDay } from "@/lib/stores/use-settings-store";
import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types/item";

import { DayOfWeekSelector } from "@/components/all-page/priority-selector";
import { TableCellTooltip } from "./table-cell-tooltip";
import { Popover } from "./table-cell-popover";

/* -------------------------------------------------------------------------- */
/*  Shared input shell (smaller than the default 48px Input)                  */
/* -------------------------------------------------------------------------- */

function CellInput({
  autoFocus,
  className,
  ...props
}: React.ComponentProps<"input"> & { autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [autoFocus]);
  return (
    <input
      ref={ref}
      className={cn(
        "h-7 w-full rounded-md border border-black/15 bg-white px-2 text-[12px] text-[#25242a] outline-none",
        "focus:border-blue-400 focus:ring-1 focus:ring-blue-200",
        "dark:border-white/15 dark:bg-[#1a1a1a] dark:text-[#f5f5f5] dark:focus:border-blue-500 dark:focus:ring-blue-800",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Title editor                                                              */
/* -------------------------------------------------------------------------- */

export function TitleCellEditor({
  value,
  onCommit,
  onCancel,
  label,
}: {
  value: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
  label: string;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(value);

  return (
    <TableCellTooltip
      label={label}
      value={value || "Untitled"}
    >
      <CellInput
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (trimmed && trimmed !== value) onCommit(trimmed);
          else onCancel();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            const trimmed = draft.trim();
            if (trimmed && trimmed !== value) onCommit(trimmed);
            else onCancel();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        onClick={(event) => event.stopPropagation()}
        placeholder="Title"
      />
    </TableCellTooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*  Estimate editor (minutes, integer)                                        */
/* -------------------------------------------------------------------------- */

export function EstimateCellEditor({
  value,
  onCommit,
  onCancel,
  label,
}: {
  value: number | undefined;
  onCommit: (next: number | undefined) => void;
  onCancel: () => void;
  label: string;
}) {
  const initial = value === undefined ? "" : String(value);
  const [draft, setDraft] = useState(initial);

  return (
    <TableCellTooltip
      label={label}
      value={value === undefined ? "—" : `${value} min`}
    >
      <CellInput
        autoFocus
        type="number"
        min={0}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          const trimmed = draft.trim();
          if (trimmed === "") {
            if (value !== undefined) onCommit(undefined);
            else onCancel();
          } else {
            const parsed = Number(trimmed);
            if (Number.isFinite(parsed) && parsed >= 0 && parsed !== value) {
              onCommit(Math.floor(parsed));
            } else {
              onCancel();
            }
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.currentTarget as HTMLInputElement).blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        onClick={(event) => event.stopPropagation()}
        placeholder="min"
      />
    </TableCellTooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*  Popover shell (renders outside the table via portal)                      */
/* -------------------------------------------------------------------------- */

function CellPopover({
  open,
  onOpenChange,
  align = "start",
  className,
  tooltip,
  tooltipDisabled,
  children,
  popover,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  align?: "start" | "end";
  className?: string;
  tooltip: { label: string; value: string; hint?: string };
  tooltipDisabled?: boolean;
  children: ReactNode;
  popover: (close: () => void) => ReactNode;
}) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const incrementEditor = useCellEditorOpenStore((s) => s.increment);
  const decrementEditor = useCellEditorOpenStore((s) => s.decrement);

  useEffect(() => {
    if (open) {
      setAnchor(triggerRef.current);
    } else {
      setAnchor(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      incrementEditor();
      return () => {
        decrementEditor();
      };
    }
    return undefined;
  }, [open, incrementEditor, decrementEditor]);

  return (
    <TableCellTooltip label={tooltip.label} value={tooltip.value} hint={tooltip.hint}>
      <span
        ref={triggerRef}
        className="relative inline-flex max-w-full"
        onClick={(event) => event.stopPropagation()}
      >
        <span
          role="button"
          tabIndex={0}
          onClick={() => onOpenChange(!open)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenChange(!open);
            }
          }}
          className="inline-flex max-w-full cursor-pointer items-center"
        >
          {children}
        </span>
      </span>
      <Popover
        open={open}
        onClose={() => onOpenChange(false)}
        anchor={anchor}
        align={align}
        className={className}
      >
        {popover(() => onOpenChange(false))}
      </Popover>
    </TableCellTooltip>
  );
}

/* -------------------------------------------------------------------------- */
/*  Priority editor                                                           */
/* -------------------------------------------------------------------------- */

export function PriorityCellEditor({
  value,
  onCommit,
  label,
  trigger,
}: {
  value: Priority | undefined;
  onCommit: (next: Priority | undefined) => void;
  label: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <CellPopover
      open={open}
      onOpenChange={setOpen}
      align="start"
      tooltip={{ label, value: value ? "" : "—" }}
      tooltipDisabled={open}
      popover={(close) => (
        <PriorityMenu
          value={value}
          onSelect={(next) => {
            onCommit(next);
            close();
          }}
        />
      )}
    >
      {trigger}
    </CellPopover>
  );
}

function PriorityMenu({
  value,
  onSelect,
}: {
  value: Priority | undefined;
  onSelect: (priority: Priority | undefined) => void;
}) {
  const { t } = useI18n();
  const priorities: Priority[] = ["low", "medium", "high", "urgent"];
  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-black/5",
          value === undefined && "bg-black/5",
          "dark:hover:bg-white/5",
        )}
      >
        <X className="h-3.5 w-3.5 text-[#9f99a3]" />
        <span className="text-[#525059] dark:text-[#d4d4d4]">—</span>
      </button>
      {priorities.map((p) => {
        const config = PRIORITY_CONFIG[p];
        const selected = value === p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => onSelect(p)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-black/5",
              selected && "bg-black/5",
              "dark:hover:bg-white/5",
            )}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: config.textColor }}
              aria-hidden
            />
            <span className="text-[#25242a] dark:text-[#f5f5f5]">
              {t(`priority.${p}` as Parameters<typeof t>[0])}
            </span>
            {selected ? <Check className="ml-auto h-3.5 w-3.5 text-blue-500" /> : null}
          </button>
        );
      })}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Project editor                                                            */
/* -------------------------------------------------------------------------- */

export function ProjectCellEditor({
  value,
  onCommit,
  label,
  trigger,
}: {
  value: string | undefined;
  onCommit: (next: string | undefined) => void;
  label: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <CellPopover
      open={open}
      onOpenChange={setOpen}
      align="end"
      tooltip={{ label, value: "" }}
      popover={(close) => (
        <ProjectMenu
          value={value}
          onSelect={(next) => {
            onCommit(next);
            close();
          }}
        />
      )}
    >
      {trigger}
    </CellPopover>
  );
}

function ProjectMenu({
  value,
  onSelect,
}: {
  value: string | undefined;
  onSelect: (id: string | undefined) => void;
}) {
  const projects = useProjectStore((s) => s.projects);
  return (
    <div className="max-h-64 overflow-y-auto">
      <button
        type="button"
        onClick={() => onSelect(undefined)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-black/5",
          value === undefined && "bg-black/5",
          "dark:hover:bg-white/5",
        )}
      >
        <X className="h-3.5 w-3.5 text-[#9f99a3]" />
        <span className="text-[#525059] dark:text-[#d4d4d4]">—</span>
      </button>
      {projects.map((p) => {
        const selected = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-black/5",
              selected && "bg-black/5",
              "dark:hover:bg-white/5",
            )}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color ?? "#a3a3a3" }}
              aria-hidden
            />
            <span className="text-[#25242a] dark:text-[#f5f5f5]">{p.name}</span>
            {selected ? <Check className="ml-auto h-3.5 w-3.5 text-blue-500" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Date/time editor (popover with native date + time inputs)                  */
/* -------------------------------------------------------------------------- */

export function DateCellEditor({
  startDate,
  startTime,
  endDate,
  endTime,
  allDay,
  onCommit,
  onCancel,
  label,
  trigger,
}: {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  allDay?: boolean;
  onCommit: (patch: {
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    allDay?: boolean;
  }) => void;
  onCancel: () => void;
  label: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  const [draftDate, setDraftDate] = useState(startDate ?? "");
  const [draftTime, setDraftTime] = useState(startTime ?? "");
  const [draftEndDate, setDraftEndDate] = useState(endDate ?? "");
  const [draftEndTime, setDraftEndTime] = useState(endTime ?? "");
  const [draftAllDay, setDraftAllDay] = useState(Boolean(allDay));
  const [errors, setErrors] = useState<{ startDate?: string; endDate?: string }>({});

  function validate(): { startDate?: string; endDate?: string } {
    const errs: { startDate?: string; endDate?: string } = {};
    const startPattern = /^\d{4}-\d{2}-\d{2}$/;
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (draftDate && !startPattern.test(draftDate)) {
      errs.startDate = "Invalid";
    }
    if (draftEndDate && !startPattern.test(draftEndDate)) {
      errs.endDate = "Invalid";
    }
    if (!draftAllDay) {
      if (draftTime && !timePattern.test(draftTime)) {
        errs.startDate = "Invalid time";
      }
      if (draftEndTime && !timePattern.test(draftEndTime)) {
        errs.endDate = "Invalid time";
      }
    }
    if (!errs.startDate && !errs.endDate) {
      if (draftDate && draftEndDate) {
        const start = new Date(`${draftDate}T${draftTime || "00:00"}:00`);
        const end = new Date(`${draftEndDate}T${draftEndTime || draftTime || "00:00"}:00`);
        if (end < start) {
          errs.endDate = "End must be after start";
        }
      }
    }
    return errs;
  }

  function commit(close: () => void) {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onCommit({
      startDate: draftDate || undefined,
      startTime: draftAllDay ? undefined : draftTime || undefined,
      endDate: draftEndDate || undefined,
      endTime: draftAllDay ? undefined : draftEndTime || undefined,
      allDay: draftAllDay,
    });
    close();
  }

  const tooltipValue = startDate
    ? `${startDate}${startTime ? ` ${startTime}` : ""}`
    : "—";

  return (
    <CellPopover
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
          setErrors({});
        }
        setOpen(next);
      }}
      align="end"
      className="w-72 p-3"
      tooltip={{ label, value: tooltipValue }}
      popover={(close) => {
        const errs = validate();
        const hasErrors = Object.keys(errs).length > 0;
        return (
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 flex items-baseline gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-[#9f99a3] uppercase">
                <span>Start</span>
                {!draftAllDay ? <span className="text-red-500">*</span> : null}
              </p>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={draftDate}
                  onChange={(event) => setDraftDate(event.target.value)}
                  className="h-8 flex-1 rounded-md px-2 text-xs"
                />
                <Input
                  type="time"
                  value={draftTime}
                  disabled={draftAllDay}
                  onChange={(event) => setDraftTime(event.target.value)}
                  className="h-8 w-28 rounded-md px-2 text-xs"
                />
              </div>
              {errors.startDate ? (
                <p className="mt-1 text-[10px] text-red-500">{errors.startDate}</p>
              ) : null}
            </div>
            <div>
              <p className="mb-1.5 flex items-baseline gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-[#9f99a3] uppercase">
                <span>End</span>
                <span className="text-[10px] font-normal normal-case tracking-normal text-[#9f99a3]">
                  (optional)
                </span>
              </p>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={draftEndDate}
                  onChange={(event) => setDraftEndDate(event.target.value)}
                  className="h-8 flex-1 rounded-md px-2 text-xs"
                />
                <Input
                  type="time"
                  value={draftEndTime}
                  disabled={draftAllDay}
                  onChange={(event) => setDraftEndTime(event.target.value)}
                  className="h-8 w-28 rounded-md px-2 text-xs"
                />
              </div>
              {errors.endDate ? (
                <p className="mt-1 text-[10px] text-red-500">{errors.endDate}</p>
              ) : null}
            </div>
            <label className="flex items-center gap-2 text-xs text-[#525059] dark:text-[#d4d4d4]">
              <input
                type="checkbox"
                checked={draftAllDay}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setDraftAllDay(checked);
                  if (checked) {
                    setDraftTime("");
                    setDraftEndTime("");
                    setErrors({});
                  }
                }}
                className="h-3.5 w-3.5 cursor-pointer rounded border-black/20"
              />
              All day
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onCancel();
                  close();
                }}
                className="cursor-pointer rounded-full px-3 py-1 text-[11px] text-[#525059] hover:bg-black/5 dark:text-[#d4d4d4] dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => commit(close)}
                disabled={hasErrors}
                className={cn(
                  "cursor-pointer rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white",
                  hasErrors ? "cursor-not-allowed opacity-50" : "hover:bg-neutral-800",
                )}
              >
                Save
              </button>
            </div>
          </div>
        );
      }}
    >
      {trigger}
    </CellPopover>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tags editor (popover with comma-separated input)                          */
/* -------------------------------------------------------------------------- */

export function TagsCellEditor({
  value,
  onCommit,
  onCancel,
  label,
  trigger,
}: {
  value: string[] | undefined;
  onCommit: (next: string[] | undefined) => void;
  onCancel: () => void;
  label: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState<string[]>(value ?? []);
  const [input, setInput] = useState("");
  const allExistingTags = useAllPageStore((s) => s.manualItems);

  const suggestions = useMemo(() => {
    const set = new Set<string>();
    for (const record of allExistingTags) {
      if (record.deletedAt) continue;
      for (const tag of record.tags ?? []) {
        if (!tags.includes(tag)) set.add(tag);
      }
    }
    const all = Array.from(set);
    const query = input.trim().replace(/^#/, "").toLowerCase();
    if (!query) return all.slice(0, 12);
    return all.filter((tag) => tag.toLowerCase().includes(query)).slice(0, 12);
  }, [allExistingTags, tags, input]);

  function addTag(raw: string) {
    const trimmed = raw.trim().replace(/^#/, "");
    if (!trimmed || tags.includes(trimmed)) {
      setInput("");
      return;
    }
    setTags((current) => [...current, trimmed]);
    setInput("");
  }

  function removeTag(index: number) {
    setTags((current) => current.filter((_, i) => i !== index));
  }

  function commit(close: () => void) {
    addTag(input);
    // read latest tags via setTimeout to ensure the just-typed pending tag is included
    setTimeout(() => {
      setTags((latest) => {
        onCommit(latest.length > 0 ? latest : undefined);
        return latest;
      });
      close();
    }, 0);
  }

  return (
    <CellPopover
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
        setOpen(next);
      }}
      align="end"
      className="w-72 p-3"
      tooltip={{
        label,
        value: value && value.length > 0 ? value.map((tag) => `#${tag}`).join(" ") : "—",
      }}
      tooltipDisabled={open}
      popover={(close) => (
        <div>
          <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
            <Tag className="h-3 w-3" /> {label}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-black/8 bg-white px-2 py-1.5 focus-within:border-black/22 dark:border-white/10 dark:bg-[#202020]">
            {tags.map((tag, index) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full border border-black/6 bg-[#fafafa] px-2 py-0.5 text-[11px] text-[#525059] hover:border-red-100 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4] dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(index)}
                  className="text-[#9f99a3] hover:text-current"
                  aria-label={`Remove ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              autoFocus
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(input);
                } else if (event.key === "Backspace" && !input && tags.length > 0) {
                  removeTag(tags.length - 1);
                } else if (event.key === ",") {
                  event.preventDefault();
                  addTag(input);
                }
              }}
              placeholder={tags.length === 0 ? "Add a tag" : ""}
              className="min-w-20 flex-1 border-0 bg-transparent p-0 text-xs outline-none placeholder:text-[#9f99a3]"
            />
          </div>
          {suggestions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(tag)}
                  className="inline-flex items-center gap-1 rounded-full border border-black/6 bg-[#fafafa] px-2 py-0.5 text-[11px] text-[#525059] hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4] dark:hover:bg-white/10"
                >
                  <Tag className="h-2.5 w-2.5 text-[#9f99a3]" />
                  {tag}
                </button>
              ))}
            </div>
          ) : null}
          <p className="mt-1.5 text-[10px] text-[#9f99a3]">
            Press Enter or comma to add
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onCancel();
                  close();
                }}
                className="cursor-pointer rounded-full px-3 py-1 text-[11px] text-[#525059] hover:bg-black/5 dark:text-[#d4d4d4] dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  commit(close);
                }}
                className="cursor-pointer rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white hover:bg-neutral-800"
              >
                Save
              </button>
          </div>
        </div>
      )}
    >
      {trigger}
    </CellPopover>
  );
}

/* -------------------------------------------------------------------------- */
/*  Recurrence editor (mirrors the item-form's recurrence section)            */
/* -------------------------------------------------------------------------- */

type RecurrenceType = "none" | "daily" | "weekly" | "monthly" | "yearly";
type RecurrenceEndType = "never" | "on_date" | "after_count";
type MonthlyPattern = "day_of_month" | "nth_weekday";

export type RecurrenceValue = {
  type: RecurrenceType;
  interval: number;
  daysOfWeek: number[];
  endType: RecurrenceEndType;
  endDate: string;
  count: number;
  monthlyPattern: MonthlyPattern;
  nthWeekdayPosition: number;
  nthWeekdayDay: number;
};

const RECURRENCE_TYPE_OPTIONS: Array<{ value: RecurrenceType; label: string }> = [
  { value: "none", label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const WEEKDAY_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const ORDINAL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "1st" },
  { value: 2, label: "2nd" },
  { value: 3, label: "3rd" },
  { value: 4, label: "4th" },
  { value: 5, label: "5th" },
  { value: -1, label: "Last" },
];

function emptyRecurrence(): RecurrenceValue {
  return {
    type: "none",
    interval: 1,
    daysOfWeek: [],
    endType: "never",
    endDate: "",
    count: 10,
    monthlyPattern: "day_of_month",
    nthWeekdayPosition: 2,
    nthWeekdayDay: 1,
  };
}

function valueToDraft(value: RecurrenceValue | undefined): RecurrenceValue {
  if (!value) return emptyRecurrence();
  return {
    type: value.type,
    interval: value.interval,
    daysOfWeek: [...value.daysOfWeek],
    endType: value.endType,
    endDate: value.endDate,
    count: value.count,
    monthlyPattern: value.monthlyPattern,
    nthWeekdayPosition: value.nthWeekdayPosition,
    nthWeekdayDay: value.nthWeekdayDay,
  };
}

export function RecurrenceCellEditor({
  value,
  anchorDate,
  onCommit,
  onCancel,
  label,
}: {
  value: RecurrenceValue | undefined;
  anchorDate: Date | undefined;
  onCommit: (next: RecurrenceValue) => void;
  onCancel: () => void;
  label: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState<RecurrenceValue>(() => valueToDraft(value));
  const [selectedDayChips, setSelectedDayChips] = useState<boolean[]>(() => {
    const arr = [false, false, false, false, false, false, false];
    value?.daysOfWeek?.forEach((index) => {
      if (index >= 0 && index < 7) arr[index] = true;
    });
    return arr;
  });

  const currentType = draft.type;

  function setType(type: RecurrenceType) {
    setDraft((current) => {
      const next: RecurrenceValue = { ...current, type };
      if (type === "weekly") {
        // Seed daysOfWeek with anchor weekday when empty.
        if (next.daysOfWeek.length === 0 && anchorDate) {
          const weekday = anchorDate.getDay();
          next.daysOfWeek = [weekday];
          const arr = [false, false, false, false, false, false, false];
          arr[weekday] = true;
          setSelectedDayChips(arr);
        }
      }
      if (type === "monthly" && next.monthlyPattern === "nth_weekday" && anchorDate) {
        next.nthWeekdayDay = anchorDate.getDay();
      }
      return next;
    });
  }

  function setInterval(raw: string) {
    const parsed = Math.max(1, Math.min(Number(raw) || 1, RECURRENCE_INTERVAL_MAX));
    setDraft((current) => ({ ...current, interval: parsed }));
  }

  function setEndType(endType: RecurrenceEndType) {
    setDraft((current) => ({ ...current, endType }));
  }

  function setDaysOfWeek(ordered: boolean[]) {
    const startDay = getWeekStartDay();
    const normalized = Array.from({ length: 7 }, (_, i) => false);
    ordered.forEach((selected, displayIndex) => {
      const originalIndex = (displayIndex + startDay) % 7;
      normalized[originalIndex] = selected;
    });
    setSelectedDayChips(ordered);
    setDraft((current) => ({
      ...current,
      daysOfWeek: normalized
        .map((selected, index) => (selected ? index : -1))
        .filter((index) => index >= 0),
    }));
  }

  function setMonthlyPattern(pattern: MonthlyPattern) {
    setDraft((current) => {
      if (pattern === "day_of_month") {
        return { ...current, monthlyPattern: pattern, nthWeekdayPosition: 2 };
      }
      return {
        ...current,
        monthlyPattern: pattern,
        nthWeekdayPosition: current.nthWeekdayPosition || 2,
        nthWeekdayDay: current.nthWeekdayDay ?? (anchorDate?.getDay() ?? 1),
      };
    });
  }

  function setNthWeekdayPosition(value: string) {
    const parsed = Number(value);
    setDraft((current) => ({ ...current, nthWeekdayPosition: parsed }));
  }

  function setNthWeekdayDay(value: string) {
    const parsed = Number(value);
    setDraft((current) => ({ ...current, nthWeekdayDay: parsed }));
  }

  const previewDates = useMemo(() => {
    if (draft.type === "none" || !anchorDate) return [];
    const daysOfWeek =
      draft.type === "weekly"
        ? draft.daysOfWeek
        : draft.type === "monthly" && draft.monthlyPattern === "nth_weekday"
          ? [draft.nthWeekdayDay]
          : [];
    const bysetpos =
      draft.type === "monthly" && draft.monthlyPattern === "nth_weekday"
        ? draft.nthWeekdayPosition
        : undefined;
    const count =
      draft.endType === "after_count" ? Math.min(draft.count || 10, 999) : undefined;
    const rruleString = buildRRuleString({
      anchorDate,
      recurrenceType: draft.type,
      recurrenceInterval: Math.max(1, Math.min(draft.interval, RECURRENCE_INTERVAL_MAX)),
      daysOfWeek,
      recurrenceEndDate: draft.endType === "on_date" ? draft.endDate : undefined,
      recurrenceCount: count,
      recurrenceBysetpos: bysetpos,
      recurrenceEndType: draft.endType,
    });
    if (!rruleString) return [];
    try {
      const rule = rrulestr(rruleString);
      const limit = count ? Math.min(count, 10) : 10;
      return rule.all((_, len) => len < limit);
    } catch {
      return [];
    }
  }, [draft, anchorDate]);

  const intervalSuffix = useMemo(() => {
    switch (draft.type) {
      case "daily":
        return "day(s)";
      case "weekly":
        return "week(s)";
      case "monthly":
        return "month(s)";
      case "yearly":
        return "year(s)";
      default:
        return "";
    }
  }, [draft.type]);

  return (
    <CellPopover
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
        setOpen(next);
      }}
      align="end"
      className="w-[22rem] p-3"
      tooltip={{
        label,
        value: currentType !== "none" ? currentType : "—",
      }}
      popover={(close) => (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
              {t("itemForm.repeat")}
            </p>
            <div className="flex flex-wrap gap-1">
              {RECURRENCE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setType(option.value)}
                  className={cn(
                    "flex-1 cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    currentType === option.value
                      ? "border-black bg-black text-white"
                      : "border-black/10 text-[#25242a] hover:bg-black/5 dark:border-white/15 dark:text-[#f5f5f5] dark:hover:bg-white/5",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {currentType !== "none" && (
            <>
              {currentType === "weekly" && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                    {t("itemForm.days")}
                  </p>
                  <DayOfWeekSelector
                    selected={selectedDayChips}
                    onChange={setDaysOfWeek}
                  />
                </div>
              )}

              {currentType === "monthly" && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                    {t("itemForm.monthlyPattern")}
                  </p>
                  <div className="space-y-1.5">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="monthly-pattern-cell"
                        checked={draft.monthlyPattern === "day_of_month"}
                        onChange={() => setMonthlyPattern("day_of_month")}
                        className="h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="text-xs">{t("itemForm.monthlyDayOfMonth")}</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="monthly-pattern-cell"
                        checked={draft.monthlyPattern === "nth_weekday"}
                        onChange={() => setMonthlyPattern("nth_weekday")}
                        className="h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="text-xs">{t("itemForm.monthlyNthWeekday")}</span>
                    </label>
                    {draft.monthlyPattern === "nth_weekday" && (
                      <div className="flex items-center gap-1.5 pl-5">
                        <select
                          value={String(draft.nthWeekdayPosition)}
                          onChange={(event) => setNthWeekdayPosition(event.target.value)}
                          className="h-7 cursor-pointer rounded-md border border-black/10 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-transparent dark:text-[#f5f5f5]"
                        >
                          {ORDINAL_OPTIONS.map((option) => (
                            <option key={option.value} value={String(option.value)}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={String(draft.nthWeekdayDay)}
                          onChange={(event) => setNthWeekdayDay(event.target.value)}
                          className="h-7 cursor-pointer rounded-md border border-black/10 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-black/10 dark:border-white/15 dark:bg-transparent dark:text-[#f5f5f5]"
                        >
                          {WEEKDAY_FULL.map((label, index) => (
                            <option key={label} value={String(index)}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#525059] dark:text-[#d4d4d4]">
                  {t("itemForm.recurrenceInterval")}
                </span>
                <Input
                  type="number"
                  min="1"
                  max={RECURRENCE_INTERVAL_MAX}
                  value={String(draft.interval)}
                  onChange={(event) => setInterval(event.target.value)}
                  className="h-7 w-16 text-xs"
                />
                <span className="text-xs text-[#525059] dark:text-[#d4d4d4]">
                  {intervalSuffix}
                </span>
              </div>

              <div>
                <p className="mb-1.5 text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                  {t("itemForm.recurrenceEnd")}
                </p>
                <div className="space-y-1.5">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="recurrence-end-cell"
                      checked={draft.endType === "never"}
                      onChange={() => setEndType("never")}
                      className="h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="text-xs">{t("itemForm.recurrenceNever")}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="recurrence-end-cell"
                      checked={draft.endType === "on_date"}
                      onChange={() => setEndType("on_date")}
                      className="h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="text-xs">{t("itemForm.recurrenceOnDate")}</span>
                    {draft.endType === "on_date" && (
                      <Input
                        type="date"
                        value={draft.endDate}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, endDate: event.target.value }))
                        }
                        className="ml-1 h-7 w-36 text-xs"
                      />
                    )}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="recurrence-end-cell"
                      checked={draft.endType === "after_count"}
                      onChange={() => setEndType("after_count")}
                      className="h-3.5 w-3.5 cursor-pointer"
                    />
                    <span className="text-xs">{t("itemForm.recurrenceAfterCount")}</span>
                    {draft.endType === "after_count" && (
                      <>
                        <Input
                          type="number"
                          min="1"
                          max="999"
                          value={String(draft.count)}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              count: Math.max(1, Number(event.target.value) || 1),
                            }))
                          }
                          className="ml-1 h-7 w-14 text-xs"
                        />
                        <span className="text-xs">{t("itemForm.recurrenceTimes")}</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {previewDates.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                    {t("itemForm.occurrencePreview")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {previewDates.map((date, index) => (
                      <span
                        key={index}
                        className="inline-flex rounded-full border border-black/6 bg-[#fafafa] px-2 py-0.5 text-[10px] text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]"
                      >
                        {dayjs(date).format("MMM D, YYYY")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onMouseDown={(event) => {
                // Prevent the popover's mousedown handler from racing with
                // this button and triggering a state update before commit.
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onCancel();
                close();
              }}
              className="cursor-pointer rounded-full px-3 py-1 text-[11px] text-[#525059] hover:bg-black/5 dark:text-[#d4d4d4] dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onCommit({
                  type: draft.type,
                  interval: draft.interval,
                  daysOfWeek: draft.daysOfWeek,
                  endType: draft.endType,
                  endDate: draft.endDate,
                  count: draft.count,
                  monthlyPattern: draft.monthlyPattern,
                  nthWeekdayPosition: draft.nthWeekdayPosition,
                  nthWeekdayDay: draft.nthWeekdayDay,
                });
                close();
              }}
              className="cursor-pointer rounded-full bg-black px-3 py-1 text-[11px] font-medium text-white hover:bg-neutral-800"
            >
              Save
            </button>
          </div>
        </div>
      )}
    >
      <span className="inline-flex max-w-full items-center gap-1">
        {currentType === "none" ? (
          <span className="text-xs text-[#9f99a3]">—</span>
        ) : (
          <Repeat
            className="h-3.5 w-3.5 text-[#7d7880] dark:text-[#a3a3a3]"
            aria-label="Recurring"
          />
        )}
      </span>
    </CellPopover>
  );
}
