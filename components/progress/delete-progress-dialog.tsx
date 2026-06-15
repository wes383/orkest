"use client";

import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface DeleteProgressDialogProps {
  progressName: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function DeleteProgressDialog({ progressName, onCancel, onConfirm }: DeleteProgressDialogProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-white/35 backdrop-blur-[5px] dark:bg-black/50"
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-black/8 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1f1d24]">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">
              {t("progress.deleteTitle", { name: progressName })}
            </h2>
            <p className="mt-1.5 text-sm text-[#7d7880] dark:text-[#a3a3a3]">
              {t("progress.deleteSubtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.05] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
            aria-label={t("common.cancel")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2 px-5 pb-5">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy} className="h-8 px-4 text-sm">
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="h-8 bg-red-500 px-4 text-sm text-white hover:bg-red-600 disabled:opacity-60"
          >
            {t("progress.deleteConfirm")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
