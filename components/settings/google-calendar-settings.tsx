"use client";

import { Calendar, Unlink, AlertCircle, ExternalLink, ChevronDown, Brain } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { useSettingsStore } from "@/lib/stores/use-settings-store";

type CalendarInfo = {
  id: string;
  calendarId: string;
  calendarName: string | null;
  syncEnabled: boolean;
  lastSyncAt: string | null;
};

type ConnectionStatus = {
  connected: boolean;
  calendars: CalendarInfo[];
};

export function GoogleCalendarSettings() {
  const { t } = useI18n();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dataUsageOpen, setDataUsageOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const aiCalendarProcessingEnabled = useSettingsStore((s) => s.aiCalendarProcessingEnabled);
  const setAiCalendarProcessingEnabled = useSettingsStore((s) => s.setAiCalendarProcessingEnabled);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/google-calendar/calendars");
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshAndFetch = async () => {
      try {
        await fetch("/api/google-calendar/calendars/refresh", { method: "POST" });
      } catch {
        // ignore refresh errors
      }
      fetchStatus();
    };
    refreshAndFetch();
  }, [fetchStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("google") === "connected") {
      fetchStatus();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchStatus]);

  const handleConnectClick = () => {
    setConsentOpen(true);
  };

  const handleConsentAllow = async () => {
    setConsentOpen(false);
    setAiCalendarProcessingEnabled(true);
    try {
      setError(null);
      const res = await fetch("/api/google-calendar/auth");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError(t("settings.googleCalendar.connectError"));
    }
  };

  const handleConsentSkip = async () => {
    setConsentOpen(false);
    setAiCalendarProcessingEnabled(false);
    try {
      setError(null);
      const res = await fetch("/api/google-calendar/auth");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError(t("settings.googleCalendar.connectError"));
    }
  };

  const handleDisconnect = async () => {
    try {
      setError(null);
      const res = await fetch("/api/google-calendar/connection", { method: "DELETE" });
      if (res.ok) {
        setStatus({ connected: false, calendars: [] });
      }
    } catch {
      setError(t("settings.googleCalendar.disconnectError"));
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch("/api/google-calendar/calendars", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, syncEnabled: enabled }),
      });
      if (res.ok) {
        setStatus((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            calendars: prev.calendars.map((c) =>
              c.id === id ? { ...c, syncEnabled: enabled } : c
            ),
          };
        });
      }
    } catch {
      // ignore
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
        <span className="text-sm text-gray-500">{t("settings.googleCalendar.loading")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <Calendar className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">
                {t("settings.googleCalendar.title")}
              </h3>
              <span className="inline-flex items-center rounded-md bg-[#25242a]/8 px-1.5 py-0.5 text-[10px] font-semibold text-[#25242a]/60 dark:bg-white/10 dark:text-[#d4d4d4]/60">
                Beta
              </span>
            </div>
            <p className="text-xs text-[#9f99a3]">
              {status?.connected
                ? t("settings.googleCalendar.calendarsCount", { count: status.calendars.length })
                : t("settings.googleCalendar.notConnected")}
            </p>
          </div>
        </div>

        {status?.connected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            className="gap-1.5 text-red-600 hover:text-red-700"
          >
            <Unlink className="h-3.5 w-3.5" />
            {t("settings.googleCalendar.disconnect")}
          </Button>
        ) : (
          <Button onClick={handleConnectClick} size="sm" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {t("settings.googleCalendar.connect")}
          </Button>
        )}
      </div>

      {status?.connected && status.calendars.length > 0 && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700">
          {status.calendars.map((cal) => (
            <div
              key={cal.id}
              className="flex items-center justify-between px-4 py-3 border-b last:border-b-0 border-gray-100 dark:border-gray-800"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#25242a] dark:text-[#f5f5f5] truncate">
                  {cal.calendarName || cal.calendarId}
                </p>
              </div>
              <label className="flex cursor-pointer items-center">
                <div className="relative shrink-0">
                  <input
                    type="checkbox"
                    checked={cal.syncEnabled}
                    onChange={() => handleToggle(cal.id, !cal.syncEnabled)}
                    disabled={togglingId === cal.id}
                    className="peer sr-only"
                  />
                  <div className="h-5 w-9 rounded-full bg-gray-200 transition-colors peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-500/20 dark:bg-gray-600"></div>
                  <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4"></div>
                </div>
              </label>
            </div>
          ))}
        </div>
      )}

      {status?.connected && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50">
              <Brain className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#25242a] dark:text-[#f5f5f5]">
                {t("settings.googleCalendar.aiProcessing")}
              </p>
              <p className="text-xs text-[#9f99a3]">
                {t("settings.googleCalendar.aiProcessingDesc")}
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center">
            <div className="relative shrink-0">
              <input
                type="checkbox"
                checked={aiCalendarProcessingEnabled}
                onChange={() => setAiCalendarProcessingEnabled(!aiCalendarProcessingEnabled)}
                className="peer sr-only"
              />
              <div className="h-5 w-9 rounded-full bg-gray-200 transition-colors peer-checked:bg-purple-500 peer-focus:ring-2 peer-focus:ring-purple-500/20 dark:bg-gray-600"></div>
              <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4"></div>
            </div>
          </label>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="pt-1 text-left">
        <button
          type="button"
          onClick={() => setDataUsageOpen((v) => !v)}
          aria-expanded={dataUsageOpen}
          className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-[#9f99a3]/70 hover:text-[#9f99a3] hover:underline"
        >
          {t("settings.googleCalendar.dataUsage")}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${dataUsageOpen ? "rotate-180" : ""}`}
          />
        </button>
        {dataUsageOpen && (
          <ul className="mt-1.5 space-y-1 text-[11px]">
            <li>
              <a
                href="/privacy-policy#126-limited-use-disclosure"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#9f99a3]/80 underline-offset-2 hover:text-[#9f99a3] hover:underline"
              >
                {t("settings.googleCalendar.privacyPolicy")}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </li>
            <li>
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#9f99a3]/80 underline-offset-2 hover:text-[#9f99a3] hover:underline"
              >
                {t("settings.googleCalendar.googlePermissions")}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </li>
          </ul>
        )}
      </div>

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.googleCalendar.aiProcessingConsentTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.googleCalendar.aiProcessingConsentDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleConsentAllow} className="gap-1.5 bg-purple-600 hover:bg-purple-700">
              <Brain className="h-4 w-4" />
              {t("settings.googleCalendar.aiProcessingConsentAllow")}
            </Button>
            <Button variant="outline" onClick={handleConsentSkip}>
              {t("settings.googleCalendar.aiProcessingConsentSkip")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
