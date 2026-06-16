"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

interface DeleteProgressDialogProps {
  open: boolean;
  progressName: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function DeleteProgressDialog({ open, progressName, onCancel, onConfirm }: DeleteProgressDialogProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="mx-auto max-w-[min(92vw,24rem)] rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("progress.deleteTitle", { name: progressName })}
          </DialogTitle>
          <DialogDescription>
            {t("progress.deleteSubtitle")}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex items-center justify-end gap-2">
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
      </DialogContent>
    </Dialog>
  );
}
