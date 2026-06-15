"use client";

import { ChevronDown, Plus, Tag, X } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ReminderSelector } from "@/components/ui/reminder-selector";

import { rrulestr } from "rrule";

import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { useProgressStore } from "@/lib/stores/use-progress-store";
import { useScrollLock } from "@/lib/hooks/use-scroll-lock";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth/auth-provider";
import { ProjectFormModal } from "@/components/projects/project-form-modal";
import { normalizeProjectColor } from "@/lib/projects/color-palette";
import {
  TITLE_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  TAG_MAX_LENGTH,
  TAG_MAX_COUNT,
  RECURRENCE_INTERVAL_MAX,
  ESTIMATE_MINUTES_MAX,
  SUBTASK_MAX_COUNT,
  SUBTASK_TITLE_MAX_LENGTH,
  buildRRuleString,
} from "@/lib/all-page-utils";
import { PrioritySelector, DayOfWeekSelector } from "./priority-selector";
import { getAllTimezones } from "@/lib/timezone";
import { dayjs } from "@/lib/dayjs";

const ITEM_FORM_SAVED_EVENT = "orkest:item-form-saved";

export function ItemForm() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isComposerOpen = useAllPageStore((s) => s.isComposerOpen);
  const closeComposer = useAllPageStore((s) => s.closeComposer);
  const form = useAllPageStore((s) => s.form);
  const setForm = useAllPageStore((s) => s.setForm);
  const formError = useAllPageStore((s) => s.formError);
  const setFormError = useAllPageStore((s) => s.setFormError);
  const tagInput = useAllPageStore((s) => s.tagInput);
  const setTagInput = useAllPageStore((s) => s.setTagInput);
  const editingItem = useAllPageStore((s) => s.editingItem);
  const shouldAutoExpandMoreOptions = useAllPageStore((s) => s.shouldAutoExpandMoreOptions);
  const handleCreateItem = useAllPageStore((s) => s.handleCreateItem);
  const composerSubmitOverride = useAllPageStore((s) => s.composerSubmitOverride);
  const manualItems = useAllPageStore((s) => s.manualItems);
  const bindProgressTasks = useProgressStore((s) => s.bindTasks);
  const [tagInputFocused, setTagInputFocused] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [closingSuggestedTags, setClosingSuggestedTags] = useState<string[]>([]);
  const [isSuggestedTagsClosing, setIsSuggestedTagsClosing] = useState(false);
  const suggestedTagsCloseTimeoutRef = useRef<number | null>(null);
  const suggestedTagsBlurTimeoutRef = useRef<number | null>(null);
  const tagFieldRef = useRef<HTMLDivElement>(null);
  const [hasManuallyToggledMoreOptions, setHasManuallyToggledMoreOptions] = useState(false);

  useScrollLock(isComposerOpen);

  useEffect(() => {
    if (!isComposerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowMoreOptions(false);
        setHasManuallyToggledMoreOptions(false);
        closeComposer();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isComposerOpen, closeComposer]);

  const hasMoreOptionsValue = useMemo(() => {
    return (
      form.recurrenceType !== "none" ||
      Boolean(form.estimateMinutes) ||
      Boolean(form.hasDueDate && form.dueDate) ||
      Boolean(form.description.trim())
    );
  }, [
    form.description,
    form.dueDate,
    form.estimateMinutes,
    form.hasDueDate,
    form.recurrenceType,
  ]);

  const isMoreOptionsOpen =
    showMoreOptions ||
    (!hasManuallyToggledMoreOptions && shouldAutoExpandMoreOptions && hasMoreOptionsValue);

  const allExistingTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of manualItems) {
      if (!item.deletedAt && item.tags) {
        for (const tag of item.tags) {
          tagSet.add(tag);
        }
      }
    }
    return Array.from(tagSet).sort();
  }, [manualItems]);

  const suggestedTags = useMemo(() => {
    if (!tagInputFocused || form.tags.length >= TAG_MAX_COUNT) return [];
    const input = tagInput.trim().toLowerCase();
    return allExistingTags.filter(
      (tag) =>
        !form.tags.includes(tag) &&
        (input === "" || tag.toLowerCase().includes(input)),
    );
  }, [allExistingTags, tagInputFocused, form.tags, tagInput]);

  const visibleSuggestedTags =
    suggestedTags.length > 0 ? suggestedTags : isSuggestedTagsClosing ? closingSuggestedTags : [];

  function clearSuggestedTagsTimers() {
    if (suggestedTagsBlurTimeoutRef.current) {
      window.clearTimeout(suggestedTagsBlurTimeoutRef.current);
      suggestedTagsBlurTimeoutRef.current = null;
    }

    if (suggestedTagsCloseTimeoutRef.current) {
      window.clearTimeout(suggestedTagsCloseTimeoutRef.current);
      suggestedTagsCloseTimeoutRef.current = null;
    }
  }

  function closeSuggestedTags(tagsToClose: string[]) {
    clearSuggestedTagsTimers();

    if (tagsToClose.length > 0) {
      setClosingSuggestedTags(tagsToClose);
      setIsSuggestedTagsClosing(true);
      suggestedTagsCloseTimeoutRef.current = window.setTimeout(() => {
        setIsSuggestedTagsClosing(false);
        setClosingSuggestedTags([]);
        suggestedTagsCloseTimeoutRef.current = null;
      }, 200);
    } else {
      setIsSuggestedTagsClosing(false);
      setClosingSuggestedTags([]);
    }

    setTagInputFocused(false);
  }

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (
      trimmed &&
      trimmed.length <= TAG_MAX_LENGTH &&
      !form.tags.includes(trimmed) &&
      form.tags.length < TAG_MAX_COUNT
    ) {
      setForm((current) => ({
        ...current,
        tags: [...current.tags, trimmed],
      }));
      setTagInput("");
    }
  }

  function commitPendingTag() {
    const trimmed = tagInput.trim();

    if (
      !trimmed ||
      trimmed.length > TAG_MAX_LENGTH ||
      form.tags.includes(trimmed) ||
      form.tags.length >= TAG_MAX_COUNT
    ) {
      return;
    }

    setForm((current) => ({
      ...current,
      tags: [...current.tags, trimmed],
    }));
    setTagInput("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitPendingTag();
    
    // Capture progress IDs before form is reset
    const progressIds = form.progressIds;
    
    const result = composerSubmitOverride
      ? { error: composerSubmitOverride(form, editingItem), itemId: editingItem?.id }
      : handleCreateItem();
    if (!result.error) {
      // Bind to progress trackers after successful creation/update
      if (user && progressIds.length > 0 && result.itemId) {
        for (const progressId of progressIds) {
          void bindProgressTasks(user.id, progressId, [result.itemId]);
        }
      }
      
      if (composerSubmitOverride) {
        closeComposer();
      }
      window.dispatchEvent(new CustomEvent(ITEM_FORM_SAVED_EVENT));
    }
  }

  if (!isComposerOpen) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close item form"
        onClick={() => {
          setShowMoreOptions(false);
          setHasManuallyToggledMoreOptions(false);
          closeComposer();
        }}
        className="fixed inset-0 z-40 cursor-default bg-white/35 backdrop-blur-[5px]"
      />
      <div className="fixed top-16 right-4 left-4 z-50 mx-auto flex max-h-[calc(100vh-6rem)] max-w-5xl flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.16)] sm:top-20 sm:max-h-[calc(100vh-7rem)]">
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-[0.2em] text-[#9f99a3] uppercase">
                {editingItem ? t("itemForm.editTitle") : t("itemForm.addTitle")}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#25242a]">
                {editingItem ? t("itemForm.editSubtitle") : t("itemForm.addSubtitle")}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowMoreOptions(false);
                setHasManuallyToggledMoreOptions(false);
                closeComposer();
              }}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.04] hover:text-[#25242a]"
              aria-label={t("itemForm.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form
            id="new-item-form"
            className="space-y-5"
            onSubmit={onSubmit}
            onClick={() => setFormError(null)}
            onClickCapture={(event) => {
              const target = event.target;
              const hasOpenSuggestedTags =
                suggestedTags.length > 0 || (isSuggestedTagsClosing && closingSuggestedTags.length > 0);

              if (
                !hasOpenSuggestedTags ||
                !(target instanceof Node) ||
                tagFieldRef.current?.contains(target)
              ) {
                return;
              }

              closeSuggestedTags(suggestedTags.length > 0 ? suggestedTags : closingSuggestedTags);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
                event.preventDefault();
              }
            }}
          >
            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                {t("itemForm.title")}
              </p>
              <Input
                id="item-title"
                type="text"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder={t("itemForm.titlePlaceholder")}
                required
                maxLength={TITLE_MAX_LENGTH}
              />
            </div>

            <div>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                    {t("itemForm.time")}
                  </p>
                  <label className="flex cursor-pointer items-center">
                    <div className="relative shrink-0">
                      <input
                        type="checkbox"
                        checked={form.hasTime}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            hasTime: event.target.checked,
                            startDate: event.target.checked ? current.startDate : "",
                            startTime: event.target.checked ? current.startTime : "",
                            endDate: event.target.checked ? current.endDate : "",
                            endTime: event.target.checked ? current.endTime : "",
                          }))
                        }
                        className="peer sr-only"
                      />
                      <div className="h-5 w-9 rounded-full bg-gray-200 transition-colors peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-500/20"></div>
                      <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4"></div>
                    </div>
                  </label>
                </div>
                <div className="hidden md:flex md:items-center md:gap-2">
                  <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                    {t("itemForm.priority")}
                  </p>
                  <PrioritySelector
                    value={form.priority}
                    onChange={(priority) =>
                      setForm((current) => ({ ...current, priority }))
                    }
                  />
                </div>
              </div>
              <div
                className={`grid transition-[grid-template-rows] duration-200 ${
                  form.hasTime ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="mt-3 space-y-4 rounded-lg border border-black/8 bg-white/70 p-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                          {t("itemForm.start")} <span className="text-red-500">*</span>
                        </p>
                        <div className="flex gap-2">
                          <Input
                            id="start-date"
                            type="date"
                            value={form.startDate}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, startDate: event.target.value }))
                            }
                            className="flex-1"
                          />
                          <Input
                            type="time"
                            value={form.startTime}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, startTime: event.target.value }))
                            }
                            disabled={form.allDay}
                            className="w-36"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                          {t("itemForm.end")} <span className="font-normal lowercase tracking-wide text-gray-400">({t("itemForm.endOptional")})</span>
                        </p>
                        <div className="flex gap-2">
                          <Input
                            id="end-date"
                            type="date"
                            value={form.endDate}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, endDate: event.target.value }))
                            }
                            className="flex-1"
                          />
                          <Input
                            type="time"
                            value={form.endTime}
                            onChange={(event) =>
                              setForm((current) => ({ ...current, endTime: event.target.value }))
                            }
                            disabled={form.allDay}
                            className="w-36"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="all-day"
                        checked={form.allDay}
                        onCheckedChange={(checked) =>
                          setForm((current) => ({
                            ...current,
                            allDay: checked === true,
                            startTime: checked === true ? "" : current.startTime,
                            endTime: checked === true ? "" : current.endTime,
                            reminders: [],
                          }))
                        }
                      />
                      <Label htmlFor="all-day" className="text-sm">
                        {t("itemForm.allDay")}
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 md:hidden">
              <p className="text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                {t("itemForm.priority")}
              </p>
              <PrioritySelector
                value={form.priority}
                onChange={(priority) =>
                  setForm((current) => ({ ...current, priority }))
                }
              />
            </div>

            <div>
              <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                {t("itemForm.tags")}
              </p>
              <div ref={tagFieldRef} className="relative">
                <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-black/8 bg-white px-4 py-2 min-h-12 focus-within:border-black/22 transition-colors">
                  {form.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="group inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-black/6 bg-[#fafafa] px-3 text-sm text-gray-700 transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-600"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          tags: current.tags.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      {tag}
                      <span className="ml-0.5 text-xs text-gray-400 transition-colors group-hover:text-red-400">×</span>
                    </span>
                  ))}
                  <input
                    id="tags"
                    type="text"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onFocus={() => {
                      clearSuggestedTagsTimers();
                      setIsSuggestedTagsClosing(false);
                      setClosingSuggestedTags([]);
                      setTagInputFocused(true);
                    }}
                    onBlur={() => {
                      suggestedTagsBlurTimeoutRef.current = window.setTimeout(() => {
                        closeSuggestedTags(suggestedTags);
                        suggestedTagsBlurTimeoutRef.current = null;
                      }, 200);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTag(tagInput.trim());
                      }
                      if (event.key === "Backspace" && !tagInput && form.tags.length > 0) {
                        setForm((current) => ({
                          ...current,
                          tags: current.tags.slice(0, -1),
                        }));
                      }
                    }}
                    placeholder={
                      form.tags.length >= TAG_MAX_COUNT
                        ? t("itemForm.maxTags", { count: TAG_MAX_COUNT })
                        : t("itemForm.addTagPlaceholder")
                    }
                    maxLength={TAG_MAX_LENGTH}
                    disabled={form.tags.length >= TAG_MAX_COUNT}
                    className="min-w-20 flex-1 border-0 bg-transparent p-0 text-[15px] outline-none placeholder:text-[#9f99a3]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      !tagInput.trim() ||
                      tagInput.trim().length > TAG_MAX_LENGTH ||
                      form.tags.includes(tagInput.trim()) ||
                      form.tags.length >= TAG_MAX_COUNT
                    }
                    onClick={() => addTag(tagInput.trim())}
                    className="h-8 shrink-0 rounded-xl px-3 text-sm"
                  >
                    {t("itemForm.addTag")}
                  </Button>
                </div>
                <div
                  className={`grid overflow-hidden transition-all duration-200 ease-out ${
                    suggestedTags.length > 0
                      ? "mt-2 grid-rows-[1fr] opacity-100"
                      : "mt-0 grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div
                    className="overflow-hidden rounded-2xl shadow-lg"
                    style={{ clipPath: "inset(0 round 1rem)" }}
                  >
                    <div className="rounded-[inherit] border border-gray-200 bg-white p-2">
                      <div className="flex max-h-34 flex-wrap gap-2 overflow-y-auto pr-1">
                        {visibleSuggestedTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              clearSuggestedTagsTimers();
                              setIsSuggestedTagsClosing(false);
                              setClosingSuggestedTags([]);
                              addTag(tag);
                            }}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/6 bg-[#fafafa] px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100"
                          >
                            <Tag className="h-3 w-3 text-gray-400" />
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setHasManuallyToggledMoreOptions(true);
                  setShowMoreOptions(!isMoreOptionsOpen);
                  const start = Date.now();
                  const duration = 250;
                  const tick = () => {
                    window.dispatchEvent(new Event("resize"));
                    if (Date.now() - start < duration) requestAnimationFrame(tick);
                  };
                  requestAnimationFrame(tick);
                }}
                className="flex w-full cursor-pointer items-center gap-2 text-[11px] font-semibold tracking-[0.24em] text-[#7b7580] uppercase transition-colors hover:text-[#5a5460]"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${isMoreOptionsOpen ? "rotate-180" : ""}`} />
                {t("itemForm.moreOptions")}
              </button>

              <div
                className={`grid overflow-hidden transition-all duration-250 ease-out ${
                  isMoreOptionsOpen ? "mt-5 grid-rows-[1fr]" : "mt-0 grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <div className="space-y-5">
                    <ProjectSelector />
                    <ProgressSelector />
                    <div>
                      <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                        {t("itemForm.subtasks")}
                      </p>
                      <div className="space-y-1.5">
                        {form.subtasks.map((subtask, index) => (
                          <div key={subtask.id} className="group/st flex items-center gap-2.5">
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                              <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                            </div>
                            <input
                              type="text"
                              value={subtask.title}
                              onChange={(event) => {
                                const newSubtasks = [...form.subtasks];
                                newSubtasks[index] = { ...newSubtasks[index], title: event.target.value };
                                setForm((current) => ({ ...current, subtasks: newSubtasks }));
                              }}
                              onBlur={() => {
                                if (!subtask.title.trim() && form.subtasks.length > 1) {
                                  setForm((current) => ({
                                    ...current,
                                    subtasks: current.subtasks.filter((_, i) => i !== index),
                                  }));
                                }
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  if (form.subtasks.length < SUBTASK_MAX_COUNT) {
                                    const newId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                                    setForm((current) => ({
                                      ...current,
                                      subtasks: [...current.subtasks, { id: newId, title: "" }],
                                    }));
                                    setTimeout(() => {
                                      const inputs = document.querySelectorAll<HTMLInputElement>(
                                        '[data-subtask-input]',
                                      );
                                      const last = inputs[inputs.length - 1];
                                      last?.focus();
                                    }, 0);
                                  }
                                }
                                if (event.key === "Backspace" && !subtask.title && form.subtasks.length > 1) {
                                  event.preventDefault();
                                  setForm((current) => ({
                                    ...current,
                                    subtasks: current.subtasks.filter((_, i) => i !== index),
                                  }));
                                }
                              }}
                              placeholder={t("itemForm.subtaskPlaceholder")}
                              maxLength={SUBTASK_TITLE_MAX_LENGTH}
                              data-subtask-input
                              className="min-w-0 flex-1 border-0 border-b border-transparent bg-transparent px-0.5 py-1 text-[15px] outline-none transition-colors placeholder:text-[#9f99a3] focus:border-blue-400"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setForm((current) => ({
                                  ...current,
                                  subtasks: current.subtasks.filter((_, i) => i !== index),
                                }));
                              }}
                              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-500"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {form.subtasks.length < SUBTASK_MAX_COUNT && (
                        <button
                          type="button"
                          onClick={() => {
                            const newId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                            setForm((current) => ({
                              ...current,
                              subtasks: [...current.subtasks, { id: newId, title: "" }],
                            }));
                            setTimeout(() => {
                              const inputs = document.querySelectorAll<HTMLInputElement>(
                                '[data-subtask-input]',
                              );
                              const last = inputs[inputs.length - 1];
                              last?.focus();
                            }, 0);
                          }}
                          className="mt-2 flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-black/8 bg-white px-3 text-sm text-[#4d4a51] transition-colors hover:bg-black/3 disabled:pointer-events-none disabled:opacity-50"
                        >
                          {t("itemForm.addSubtask")}
                        </button>
                      )}
                    </div>

                    <div>
                      <TimezoneSelect
                        value={form.timezone || ""}
                        onChange={(v) => setForm((current) => ({ ...current, timezone: v }))}
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                        {t("itemForm.repeat")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(["none", "daily", "weekly", "monthly", "yearly"] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() =>
                              setForm((current) => ({ ...current, recurrenceType: type }))
                            }
                            className={`flex-1 cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-all ${
                              form.recurrenceType === type
                                ? "border-blue-500 bg-blue-50 text-blue-600"
                                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {type === "none" ? t("itemForm.recurrenceNone") : type === "daily" ? t("itemForm.recurrenceDaily") : type === "weekly" ? t("itemForm.recurrenceWeekly") : type === "monthly" ? t("itemForm.recurrenceMonthly") : t("itemForm.recurrenceYearly")}
                          </button>
                        ))}
                      </div>
                    </div>

                    {form.recurrenceType !== "none" && (
                      <div className="space-y-4 rounded-lg border border-black/8 bg-white/70 p-4">
                        {form.recurrenceType === "weekly" && (
                          <div>
                            <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                              {t("itemForm.days")}
                            </p>
                            <DayOfWeekSelector
                              selected={form.daysOfWeek}
                              onChange={(days) =>
                                setForm((current) => ({ ...current, daysOfWeek: days }))
                              }
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">{t("itemForm.recurrenceInterval")}</span>
                          <Input
                            type="number"
                            min="1"
                            max={RECURRENCE_INTERVAL_MAX}
                            value={form.recurrenceInterval}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                recurrenceInterval: event.target.value,
                              }))
                            }
                            className="h-9 w-20"
                          />
                          <span className="text-sm text-gray-600">
                            {form.recurrenceType === "daily" ? t("itemForm.recurrenceDays") : form.recurrenceType === "weekly" ? t("itemForm.recurrenceWeeks") : form.recurrenceType === "monthly" ? t("itemForm.recurrenceMonths") : t("itemForm.recurrenceYears")}
                          </span>
                        </div>

                        {form.recurrenceType === "monthly" && (
                          <div>
                            <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                              {t("itemForm.monthlyPattern")}
                            </p>
                            <div className="space-y-2">
                              <label className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="radio"
                                  name="monthly-pattern"
                                  checked={form.monthlyPattern === "day_of_month"}
                                  onChange={() =>
                                    setForm((current) => ({
                                      ...current,
                                      monthlyPattern: "day_of_month",
                                      recurrenceBysetpos: undefined,
                                    }))
                                  }
                                  className="h-4 w-4 cursor-pointer"
                                />
                                <span className="text-sm">{t("itemForm.monthlyDayOfMonth")}</span>
                              </label>
                              <label className="flex cursor-pointer items-center gap-2">
                                <input
                                  type="radio"
                                  name="monthly-pattern"
                                  checked={form.monthlyPattern === "nth_weekday"}
                                  onChange={() =>
                                    setForm((current) => ({
                                      ...current,
                                      monthlyPattern: "nth_weekday",
                                      recurrenceBysetpos: current.nthWeekdayPosition || "2",
                                    }))
                                  }
                                  className="h-4 w-4 cursor-pointer"
                                />
                                <span className="text-sm">{t("itemForm.monthlyNthWeekday")}</span>
                              </label>
                              {form.monthlyPattern === "nth_weekday" && (
                                <div className="flex items-center gap-2 pl-6">
                                  <select
                                    value={form.nthWeekdayPosition || "2"}
                                    onChange={(event) =>
                                      setForm((current) => ({
                                        ...current,
                                        nthWeekdayPosition: event.target.value,
                                        recurrenceBysetpos: event.target.value,
                                      }))
                                    }
                                    className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  >
                                    <option value="1">1st</option>
                                    <option value="2">2nd</option>
                                    <option value="3">3rd</option>
                                    <option value="4">4th</option>
                                    <option value="5">5th</option>
                                    <option value="-1">Last</option>
                                  </select>
                                  <select
                                    value={form.nthWeekdayDay ?? 2}
                                    onChange={(event) => {
                                      const dayIndex = Number(event.target.value);
                                      setForm((current) => ({
                                        ...current,
                                        nthWeekdayDay: dayIndex,
                                        daysOfWeek: Array.from({ length: 7 }, (_, i) => i === dayIndex),
                                      }));
                                    }}
                                    className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  >
                                    <option value={0}>Sunday</option>
                                    <option value={1}>Monday</option>
                                    <option value={2}>Tuesday</option>
                                    <option value={3}>Wednesday</option>
                                    <option value={4}>Thursday</option>
                                    <option value={5}>Friday</option>
                                    <option value={6}>Saturday</option>
                                  </select>
                                  <span className="text-sm text-gray-600">{t("itemForm.monthlyNthWeekdayOf")}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <OccurrencePreview />

                        <div>
                          <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                            {t("itemForm.recurrenceEnd")}
                          </p>
                          <div className="space-y-2">
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name="recurrence-end"
                                checked={form.recurrenceEndType === "never"}
                                onChange={() =>
                                  setForm((current) => ({
                                    ...current,
                                    recurrenceEndType: "never",
                                  }))
                                }
                                className="h-4 w-4 cursor-pointer"
                              />
                              <span className="text-sm">{t("itemForm.recurrenceNever")}</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name="recurrence-end"
                                checked={form.recurrenceEndType === "on_date"}
                                onChange={() =>
                                  setForm((current) => ({
                                    ...current,
                                    recurrenceEndType: "on_date",
                                  }))
                                }
                                className="h-4 w-4 cursor-pointer"
                              />
                              <span className="text-sm">{t("itemForm.recurrenceOnDate")}</span>
                              {form.recurrenceEndType === "on_date" && (
                                <Input
                                  type="date"
                                  value={form.recurrenceEndDate}
                                  onChange={(event) =>
                                    setForm((current) => ({
                                      ...current,
                                      recurrenceEndDate: event.target.value,
                                    }))
                                  }
                                  className="ml-2 w-40"
                                />
                              )}
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                              <input
                                type="radio"
                                name="recurrence-end"
                                checked={form.recurrenceEndType === "after_count"}
                                onChange={() =>
                                  setForm((current) => ({
                                    ...current,
                                    recurrenceEndType: "after_count",
                                  }))
                                }
                                className="h-4 w-4 cursor-pointer"
                              />
                              <span className="text-sm">{t("itemForm.recurrenceAfterCount")}</span>
                              {form.recurrenceEndType === "after_count" && (
                                <>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="999"
                                    value={form.recurrenceCount}
                                    onChange={(event) =>
                                      setForm((current) => ({
                                        ...current,
                                        recurrenceCount: event.target.value,
                                      }))
                                    }
                                    className="ml-2 h-9 w-20"
                                  />
                                  <span className="text-sm">{t("itemForm.recurrenceTimes")}</span>
                                </>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
                        <div className="min-w-0">
                          <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                            {t("itemForm.dueDate")}
                          </p>
                          <div className="flex min-h-10 items-center gap-3 pl-0.5">
                            <label className="flex cursor-pointer items-center gap-3">
                              <div className="relative shrink-0">
                                <input
                                  type="checkbox"
                                  checked={form.hasDueDate ?? false}
                                  onChange={(event) =>
                                    setForm((current) => ({ ...current, hasDueDate: event.target.checked }))
                                  }
                                  className="peer sr-only"
                                />
                                <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-500/20"></div>
                                <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"></div>
                              </div>
                              <span className="text-sm text-gray-600">
                                {form.hasDueDate ? t("itemForm.dueDateSet") : t("itemForm.noDueDate")}
                              </span>
                            </label>
                            {form.hasDueDate && (
                              <Input
                                type="date"
                                value={form.dueDate}
                                onChange={(event) =>
                                  setForm((current) => ({ ...current, dueDate: event.target.value }))
                                }
                                className="h-10 w-40 shrink-0"
                              />
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                            {t("itemForm.estimatedDuration")}
                          </p>
                          <div className="flex min-h-10 items-center gap-2 pl-0.5">
                            <Input
                              id="estimate"
                              type="number"
                              min="0"
                              max={ESTIMATE_MINUTES_MAX}
                              value={form.estimateMinutes}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  estimateMinutes: event.target.value,
                                }))
                              }
                              placeholder="60"
                              className="h-9 w-24"
                            />
                            <span className="text-sm text-gray-600 whitespace-nowrap">{t("itemForm.minutes")}</span>
                          </div>
                        </div>
                      </div>
                      {form.hasTime && form.startDate && (
                        <div className="min-w-0 pt-4">
                          <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                            {t("itemForm.reminders")}
                          </p>
                          <ReminderSelector
                            reminders={form.reminders || []}
                            onChange={(reminders) =>
                              setForm((current) => ({ ...current, reminders }))
                            }
                            isAllDay={form.allDay}
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
                        {t("itemForm.notes")}
                      </p>
                      <Textarea
                        id="description"
                        value={form.description}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, description: event.target.value }))
                        }
                        placeholder={t("itemForm.notesPlaceholder")}
                        rows={3}
                        maxLength={DESCRIPTION_MAX_LENGTH}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
        <div className="shrink-0 border-t border-black/6 bg-white px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {formError ? (
              <div className="text-sm text-[#817b85]">
                <span className="text-[#b14242]">{formError}</span>
              </div>
            ) : null}
            <div className="flex gap-3 md:ml-auto">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setShowMoreOptions(false);
                  setHasManuallyToggledMoreOptions(false);
                  closeComposer();
                }}
              >
                {t("itemForm.cancel")}
              </Button>
              <Button type="submit" form="new-item-form">
                {t("itemForm.save")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ProjectSelector() {
  const { t } = useI18n();
  const { user } = useAuth();
  const form = useAllPageStore((s) => s.form);
  const setForm = useAllPageStore((s) => s.setForm);
  const projects = useProjectStore((s) => s.projects);
  const [modalOpen, setModalOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedProject = form.projectId
    ? projects.find((p) => p.id === form.projectId)
    : null;
  const selectedColor = selectedProject
    ? normalizeProjectColor(selectedProject.color)
    : null;

  function selectProject(projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    setForm((current) => ({
      ...current,
      projectId,
      projectName: project?.name ?? "",
    }));
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
        {t("itemForm.project")}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-2xl border border-black/8 bg-white px-4 text-[15px] text-[#4d4a51] transition-colors hover:border-black/15 focus:border-black/22 focus:outline-none dark:border-white/10 dark:bg-[#202020] dark:text-[#d4d4d4] dark:hover:border-white/18 dark:focus:border-white/25"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedColor ? (
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: selectedColor }}
            />
          ) : null}
          <span className={`truncate ${selectedProject ? "" : "text-[#9f99a3] dark:text-[#737373]"}`}>
            {selectedProject?.name ?? t("itemForm.noProject")}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#9f99a3] transition-transform dark:text-[#737373] ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-black/8 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-[#202020]">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setForm((current) => ({
                ...current,
                projectId: "",
                projectName: "",
              }));
              setOpen(false);
            }}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-black/3 dark:hover:bg-white/5 ${
              !form.projectId
                ? "font-medium text-[#25242a] dark:text-[#f5f5f5]"
                : "text-[#4d4a51] dark:text-[#d4d4d4]"
            }`}
          >
            <span className="h-2 w-2 shrink-0 rounded-full border border-dashed border-black/15 dark:border-white/20" />
            <span className="truncate">{t("itemForm.noProject")}</span>
          </button>
          {projects.map((project) => {
            const color = normalizeProjectColor(project.color);
            const isSelected = form.projectId === project.id;
            return (
              <button
                key={project.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectProject(project.id)}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-black/3 dark:hover:bg-white/5 ${
                  isSelected
                    ? "font-medium text-[#25242a] dark:text-[#f5f5f5]"
                    : "text-[#4d4a51] dark:text-[#d4d4d4]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate">{project.name}</span>
              </button>
            );
          })}
          {user ? (
            <div className="mt-1 border-t border-black/6 pt-1 dark:border-white/8">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  setModalOpen(true);
                }}
                className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] text-[#4d4a51] transition-colors hover:bg-black/3 dark:text-[#d4d4d4] dark:hover:bg-white/5"
              >
                <Plus className="h-4 w-4 shrink-0 text-[#9f99a3] dark:text-[#737373]" />
                <span className="truncate">{t("projects.newProject")}</span>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {user ? (
        <ProjectFormModal
          open={modalOpen}
          mode="create"
          onClose={() => setModalOpen(false)}
          onSubmitted={(projectId) => {
            const created = useProjectStore.getState().projects.find((p) => p.id === projectId);
            setForm((current) => ({
              ...current,
              projectId,
              projectName: created?.name ?? "",
            }));
            setModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function TimezoneSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const allTimezones = useMemo(() => getAllTimezones(), []);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedLabel = value
    ? allTimezones.find((tz) => tz.value === value)?.label ?? value
    : "";

  const candidates = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allTimezones
      .filter(
        (tz) =>
          tz.value.toLowerCase().includes(q) ||
          tz.label.toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [query, allTimezones]);

  return (
    <div ref={containerRef} className="relative">
      <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
        {t("itemForm.timezone")}
      </p>
      <input
        type="text"
        placeholder={focused ? t("itemForm.timezoneSearch") : ""}
        value={focused ? query : selectedLabel}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { setFocused(true); setQuery(""); }}
        onBlur={() => setFocused(false)}
        className="flex h-12 w-full rounded-2xl border border-black/8 bg-white px-4 text-[15px] outline-none transition-colors placeholder:text-[#9f99a3] focus:border-black/22 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5] dark:placeholder:text-[#737373] dark:focus:border-white/25"
      />
      {focused && candidates.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-2xl border border-black/8 bg-white shadow-lg dark:border-white/10 dark:bg-[#202020]">
          {candidates.map((tz) => (
            <button
              key={tz.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(tz.value);
                setQuery("");
                setFocused(false);
              }}
              className={`flex w-full cursor-pointer items-center px-4 py-2.5 text-left text-[15px] transition-colors hover:bg-black/3 dark:hover:bg-white/5 ${
                tz.value === value
                  ? "font-medium text-black dark:text-white"
                  : "text-[#4d4a51] dark:text-[#d4d4d4]"
              }`}
            >
              {tz.label}
            </button>
          ))}
        </div>
      )}
      {focused && query.trim() && candidates.length === 0 && (
        <p className="mt-1 text-xs text-[#9f99a3]">{t("itemForm.timezoneNoMatch")}</p>
      )}
    </div>
  );
}

function OccurrencePreview() {
  const { t } = useI18n();
  const form = useAllPageStore((s) => s.form);

  const dates = useMemo(() => {
    if (form.recurrenceType === "none" || !form.startDate) return [];

    const daysOfWeekIndices = form.recurrenceType === "weekly"
      ? form.daysOfWeek.reduce<number[]>((acc, selected, index) => {
          if (selected) acc.push(index);
          return acc;
        }, [])
      : form.recurrenceType === "monthly" && form.monthlyPattern === "nth_weekday" && form.nthWeekdayDay !== undefined
        ? [form.nthWeekdayDay]
        : [];

    const bysetpos = form.recurrenceType === "monthly" && form.monthlyPattern === "nth_weekday"
      ? Number(form.nthWeekdayPosition) || undefined
      : undefined;

    const count = form.recurrenceEndType === "after_count"
      ? Math.min(Number(form.recurrenceCount) || 10, 999)
      : undefined;

    const formTz = form.timezone || undefined;
    const anchorDate = formTz
      ? dayjs.tz(`${form.startDate}T00:00:00`, formTz).toDate()
      : new Date(form.startDate + "T00:00:00");

    const rruleString = buildRRuleString({
      anchorDate,
      recurrenceType: form.recurrenceType,
      recurrenceInterval: Math.max(1, Math.min(Number(form.recurrenceInterval) || 1, RECURRENCE_INTERVAL_MAX)),
      daysOfWeek: daysOfWeekIndices,
      recurrenceEndDate: form.recurrenceEndType === "on_date" ? form.recurrenceEndDate : undefined,
      recurrenceCount: count,
      recurrenceBysetpos: bysetpos,
      recurrenceEndType: form.recurrenceEndType,
      timezone: form.timezone || undefined,
    });

    if (!rruleString) return [];

    try {
      const rule = rrulestr(rruleString);
      const limit = count ? Math.min(count, 10) : 10;
      return rule.all((_, len) => len < limit);
    } catch {
      return [];
    }
  }, [
    form.recurrenceType,
    form.startDate,
    form.recurrenceInterval,
    form.daysOfWeek,
    form.monthlyPattern,
    form.nthWeekdayPosition,
    form.nthWeekdayDay,
    form.recurrenceEndType,
    form.recurrenceEndDate,
    form.recurrenceCount,
    form.timezone,
  ]);

  if (dates.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
        {t("itemForm.occurrencePreview")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {dates.map((date, i) => (
          <span
            key={i}
            className="inline-flex rounded-full border border-black/6 bg-[#fafafa] px-2.5 py-1 text-xs text-gray-600"
          >
            {dayjs(date).format("MMM D, YYYY")}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProgressSelector() {
  const { t } = useI18n();
  const form = useAllPageStore((s) => s.form);
  const setForm = useAllPageStore((s) => s.setForm);
  const progresses = useProgressStore((s) => s.progresses);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedProgresses = progresses.filter((p) => form.progressIds.includes(p.id));

  function toggleProgress(progressId: string) {
    setForm((current) => {
      const isSelected = current.progressIds.includes(progressId);
      return {
        ...current,
        progressIds: isSelected
          ? current.progressIds.filter((id) => id !== progressId)
          : [...current.progressIds, progressId],
      };
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <p className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
        {t("itemForm.progress")}
      </p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-full items-center justify-between gap-2 rounded-2xl border border-black/8 bg-white px-4 text-[15px] text-[#4d4a51] transition-colors hover:border-black/15 focus:border-black/22 focus:outline-none dark:border-white/10 dark:bg-[#202020] dark:text-[#d4d4d4] dark:hover:border-white/18 dark:focus:border-white/25"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedProgresses.length > 0 ? (
            <span className="truncate">
              {selectedProgresses.map((p) => p.name).join(", ")}
            </span>
          ) : (
            <span className="text-[#9f99a3] dark:text-[#737373]">{t("itemForm.noProgress")}</span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#9f99a3] transition-transform dark:text-[#737373] ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto scrollbar-transparent-track rounded-2xl border border-black/8 bg-white p-1.5 shadow-lg dark:border-white/10 dark:bg-[#202020]">
          {progresses.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-[#9f99a3] dark:text-[#737373]">
              {t("itemForm.noProgressAvailable")}
            </p>
          ) : (
            progresses.map((progress) => {
              const isSelected = form.progressIds.includes(progress.id);
              return (
                <button
                  key={progress.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleProgress(progress.id)}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-black/3 dark:hover:bg-white/5 ${
                    isSelected
                      ? "font-medium text-[#25242a] dark:text-[#f5f5f5]"
                      : "text-[#4d4a51] dark:text-[#d4d4d4]"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                      isSelected
                        ? "border-blue-500 bg-blue-500 text-white"
                        : "border-black/20 dark:border-white/20"
                    }`}
                  >
                    {isSelected ? (
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="truncate">{progress.name}</span>
                  <span className="ml-auto text-xs text-[#9f99a3] dark:text-[#737373]">
                    {progress.goalValue} {progress.goalUnit}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

