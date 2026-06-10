"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";
import { useScrollLock } from "@/lib/hooks/use-scroll-lock";
import { useAuth } from "@/lib/auth/auth-provider";
import { useProjectStore } from "@/lib/stores/use-project-store";
import {
  DEFAULT_PROJECT_COLOR,
  normalizeProjectColor,
} from "@/lib/projects/color-palette";
import type { Project } from "@/lib/types/item";
import { ColorPicker } from "./color-picker";

interface ProjectFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  projectId?: string;
  onClose: () => void;
  onSubmitted?: (projectId: string) => void;
}

export function ProjectFormModal({
  open,
  mode,
  projectId,
  onClose,
  onSubmitted,
}: ProjectFormModalProps) {
  const { t } = useI18n();
  const projects = useProjectStore((s) => s.projects);
  const editing = useMemo<Project | null>(
    () =>
      mode === "edit" && projectId
        ? projects.find((p) => p.id === projectId) ?? null
        : null,
    [mode, projectId, projects],
  );

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Keyed inner form so each open / mode / project remounts with a fresh form state.
  return (
    <ProjectFormModalBody
      key={`${mode}-${editing?.id ?? "new"}-${open ? "1" : "0"}`}
      mode={mode}
      editing={editing}
      onClose={onClose}
      onSubmitted={onSubmitted}
      t={t}
    />
  );
}

interface ProjectFormModalBodyProps {
  mode: "create" | "edit";
  editing: Project | null;
  onClose: () => void;
  onSubmitted?: (projectId: string) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
}

function ProjectFormModalBody({
  mode,
  editing,
  onClose,
  onSubmitted,
  t,
}: ProjectFormModalBodyProps) {
  const { user } = useAuth();
  const projects = useProjectStore((s) => s.projects);
  const createProject = useProjectStore((s) => s.createProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const initialName = editing?.name ?? "";
  const initialColor = editing
    ? normalizeProjectColor(editing.color)
    : DEFAULT_PROJECT_COLOR;

  const [name, setName] = useState<string>(initialName);
  const [color, setColor] = useState<string>(initialColor);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const trimmedName = name.trim();
  const isDuplicate = projects.some(
    (p) => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== editing?.id,
  );
  const canSave =
    trimmedName.length > 0 && trimmedName.length <= 50 && !isDuplicate && !isSubmitting;

  async function handleSave() {
    if (!canSave || !user) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const safeColor = normalizeProjectColor(color);
      if (mode === "create") {
        const created = await createProject(user.id, trimmedName, safeColor);
        if (!created) {
          setError(t("projects.error.createFailed"));
          return;
        }
        onSubmitted?.(created.id);
      } else if (editing) {
        const ok = await updateProject(user.id, editing.id, {
          name: trimmedName,
          color: safeColor,
        });
        if (!ok) {
          setError(t("projects.error.updateFailed"));
          return;
        }
        onSubmitted?.(editing.id);
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editing || !user) return;
    setIsSubmitting(true);
    try {
      const ok = await deleteProject(user.id, editing.id);
      if (ok) onClose();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-white/35 backdrop-blur-[5px] dark:bg-black/50"
      />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-black/8 bg-white shadow-[0_18px_55px_rgba(0,0,0,0.16)] dark:border-white/10 dark:bg-[#202020]">
        <div className="flex items-center justify-between border-b border-black/6 px-5 py-4 dark:border-white/8">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.2em] text-[#9f99a3] uppercase dark:text-[#737373]">
              {mode === "create" ? t("projects.newProject") : t("projects.editProject")}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">
              {trimmedName || t("projects.title")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.04] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
              {t("itemForm.project")}
            </label>
            <input
              type="text"
              autoFocus
              maxLength={60}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("projects.namePlaceholder")}
              className="w-full rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-[#25242a] placeholder:text-[#9f99a3] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5]"
            />
            {isDuplicate ? (
              <p className="mt-1.5 text-xs text-red-500">{t("projects.error.duplicate")}</p>
            ) : null}
            {error ? (
              <p className="mt-1.5 text-xs text-red-500">{error}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold tracking-[0.15em] text-[#9f99a3] uppercase">
              {t("projects.color")}
            </label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-black/6 px-5 py-3 dark:border-white/8">
          <div>
            {mode === "edit" && editing ? (
              confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-[#7d7880] dark:text-[#a3a3a3]">
                    {t("projects.deleteSubtitle")}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmingDelete(false)}
                    className="h-7 px-2 text-xs"
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="h-7 gap-1.5 bg-red-500 px-2.5 text-xs text-white hover:bg-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("projects.deleteConfirm")}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmingDelete(true)}
                  className="h-7 gap-1.5 px-2 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-500/15"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("common.delete")}
                </Button>
              )
            ) : null}
          </div>
          {!confirmingDelete ? (
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose} className="h-8 px-3 text-xs">
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="h-8 px-3 text-xs"
              >
                {mode === "create" ? t("projects.create") : t("common.save")}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
