"use client";

import { Calendar, Clock, Tag, Flag, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useProjectStore } from "@/lib/stores/use-project-store";
import { parseNaturalLanguage } from "@/lib/natural-language-parse";
import { emptyForm } from "@/lib/all-page-utils";
import type { Priority } from "@/lib/types/item";

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "!",
  high: "H",
  medium: "M",
  low: "L",
};

interface QuickAddBarProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddBar({ open, onClose }: QuickAddBarProps) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [placeholder, setPlaceholder] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleCreateItem = useAllPageStore((s) => s.handleCreateItem);
  const listFilterConfig = useAllPageStore((s) => s.listFilterConfig);
  const projects = useProjectStore((s) => s.projects);

  const selectedProjectId = listFilterConfig.selectedProjectIds?.[0];
  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;

  useEffect(() => {
    if (open) {
      setInput("");
      setCreated(null);
      const examples = t("quickAdd.placeholder").split("|");
      setPlaceholder(examples[Math.floor(Math.random() * examples.length)]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, t]);

  // Esc to close, click outside to close (only when input is empty)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) && !input.trim()) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose, input]);

  const parsed = input.trim() ? parseNaturalLanguage(input) : null;

  const handleSubmit = useCallback(() => {
    if (!parsed?.title) return;

    const form = {
      ...emptyForm,
      title: parsed.title,
      startDate: parsed.startDate ?? "",
      startTime: parsed.startTime ?? "",
      endDate: parsed.endDate ?? "",
      endTime: parsed.endTime ?? "",
      hasTime: parsed.hasTime ?? false,
      allDay: parsed.allDay ?? false,
      priority: parsed.priority,
      tags: parsed.tags ?? [],
      projectId: selectedProjectId || "",
      projectName: parsed.projectName || selectedProject?.name || "",
      estimateMinutes: parsed.estimateMinutes ? String(parsed.estimateMinutes) : "",
    };

    const error = handleCreateItem(form);
    if (!error) {
      setCreated(parsed.title);
      setTimeout(() => {
        setCreated(null);
        onClose();
      }, 1500);
    }
  }, [parsed, handleCreateItem, onClose, selectedProjectId, selectedProject]);

  if (!open) return null;

  return (
    <div ref={containerRef} className="fixed top-20 left-1/2 z-[60] -translate-x-1/2 w-full max-w-lg px-4">
      <div className="rounded-2xl border border-black/8 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1e1e1e]">
        {/* Success state */}
        {created ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-sm text-[#25242a] dark:text-[#f5f5f5]">
              {t("quickAdd.created")}: {created}
            </span>
          </div>
        ) : (
          <>
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm text-[#25242a] placeholder:text-[#9b95a0] focus:outline-none dark:text-[#f5f5f5] dark:placeholder:text-[#7a7a7a]"
              />
              <kbd className="hidden rounded border border-black/10 bg-black/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-[#9b95a0] sm:inline dark:border-white/10 dark:bg-white/[0.05]">
                ↵
              </kbd>
            </div>

            {/* Parse preview */}
            {parsed && parsed.title && (
              <div className="flex flex-wrap items-center gap-2 border-t border-black/6 px-4 py-2 dark:border-white/8">
                <span className="text-xs text-[#6d6770] dark:text-[#a3a3a3] truncate max-w-48">
                  {parsed.title}
                </span>
                {parsed.startDate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f0ec] px-2 py-0.5 text-[10px] text-[#6d6770] dark:bg-[#2a2a2a] dark:text-[#a3a3a3]">
                    <Calendar className="h-3 w-3" />
                    {parsed.startDate}{parsed.startTime ? ` ${parsed.startTime}` : ""}
                    {(parsed.endDate && parsed.endDate !== parsed.startDate) || parsed.endTime
                      ? ` - ${parsed.endDate && parsed.endDate !== parsed.startDate ? parsed.endDate : ""}${parsed.endDate && parsed.endDate !== parsed.startDate && parsed.endTime ? " " : ""}${parsed.endTime ?? ""}`
                      : ""}
                  </span>
                )}
                {parsed.priority && (
                  <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${PRIORITY_COLORS[parsed.priority]}`}>
                    {PRIORITY_LABELS[parsed.priority]}
                  </span>
                )}
                {parsed.tags?.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#f4f0ec] px-2 py-0.5 text-[10px] text-[#6d6770] dark:bg-[#2a2a2a] dark:text-[#a3a3a3]">
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
                {parsed.projectName && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f0ec] px-2 py-0.5 text-[10px] text-[#6d6770] dark:bg-[#2a2a2a] dark:text-[#a3a3a3]">
                    <Flag className="h-3 w-3" />
                    {parsed.projectName}
                  </span>
                )}
                {parsed.estimateMinutes && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#f4f0ec] px-2 py-0.5 text-[10px] text-[#6d6770] dark:bg-[#2a2a2a] dark:text-[#a3a3a3]">
                    <Clock className="h-3 w-3" />
                    {parsed.estimateMinutes}min
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
