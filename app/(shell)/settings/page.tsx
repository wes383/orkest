/* eslint-disable @next/next/no-img-element */
"use client";

import { BookOpen, Brain, Camera, Calendar, CalendarDays, ChevronDown, Clock, CreditCard, Download, Eye, EyeOff, Film, Languages, LayoutGrid, LayoutList, List, LogOut, Monitor, Moon, Sun, Timer, User, Trash2, BarChart3, Sparkles, Quote, Bug, LifeBuoy, MessageSquare, CheckCircle, RefreshCw, Keyboard } from "lucide-react";
import { Table2 as TableIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import { useAuth } from "@/lib/auth/auth-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  exportScheduleToCsv,
  exportScheduleToIcs,
  getScheduleExportFilename,
} from "@/lib/schedule-export";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { useSettingsStore, type Appearance, type TimeFormat, type AllDefaultView, WEEK_START_OPTIONS, getDateLocale } from "@/lib/stores/use-settings-store";
import { useFocusStore } from "@/lib/stores/use-focus-store";
import { LOCALE_LABELS, LOCALES, useI18n, addLocaleToPathname } from "@/lib/i18n";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { SHORTCUTS } from "@/lib/keyboard-shortcuts";
import { DateFormatSelector } from "@/components/settings/date-format-selector";
import { SettingsPageSkeleton } from "@/components/ui/page-skeletons";
import { GoogleCalendarSettings } from "@/components/settings/google-calendar-settings";

const APPEARANCE_OPTIONS: { value: Appearance; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const AVATAR_OUTPUT_SIZE = 512;
const AVATAR_MIN_ZOOM = 1;
const AVATAR_MAX_ZOOM = 3;
const AVATAR_QUALITY_STEPS = [0.9, 0.82, 0.74, 0.66];
const AVATAR_TARGET_BYTES = 450 * 1024;

const BILLING_LOCALE: Record<string, any> = {
  en: {
    sectionTitle: "Plan & Billing",
    sectionDesc: "Manage your subscription, view plan details, and access your billing history.",
    proPlan: "Orkest Pro",
    trialPlan: "7-Day Free Trial",
    freePlan: "Basic Plan (Trial Expired)",
    statusLabel: "Status",
    statusActive: "Active",
    statusTrial: "Trial Active",
    statusExpired: "Expired",
    aiLimitLabel: "Daily AI Chat Limit",
    messagesPerDay: "messages / day",
    renewsOn: "Next billing date",
    trialDaysRemaining: "Trial days remaining",
    trialExpiresOn: "Trial expires on",
    upgradeBtn: "Upgrade to Pro",
    manageBtn: "Manage Subscription",
  },
  "zh-CN": {
    sectionTitle: "方案与账单",
    sectionDesc: "管理您的订阅、查看方案详情并访问您的账单历史记录。",
    proPlan: "Orkest 专业版",
    trialPlan: "7天免费试用",
    freePlan: "基础方案 (试用已过期)",
    statusLabel: "状态",
    statusActive: "已激活",
    statusTrial: "试用中",
    statusExpired: "已过期",
    aiLimitLabel: "每日 AI 对话额度",
    messagesPerDay: "次对话 / 天",
    renewsOn: "下一次账单日期",
    trialDaysRemaining: "试用期剩余",
    trialExpiresOn: "试用到期",
    upgradeBtn: "升级为专业版",
    manageBtn: "管理我的订阅",
  },
  es: {
    sectionTitle: "Plan y facturación",
    sectionDesc: "Gestiona tu suscripción, consulta los detalles del plan y accede a tu historial de facturación.",
    proPlan: "Orkest Pro",
    trialPlan: "Prueba gratuita de 7 días",
    freePlan: "Plan básico (Prueba expirada)",
    statusLabel: "Estado",
    statusActive: "Activo",
    statusTrial: "Prueba activa",
    statusExpired: "Expirado",
    aiLimitLabel: "Límite diario de chat con IA",
    messagesPerDay: "mensajes / día",
    renewsOn: "Próxima fecha de facturación",
    trialDaysRemaining: "Días de prueba restantes",
    trialExpiresOn: "La prueba expira el",
    upgradeBtn: "Actualizar a Pro",
    manageBtn: "Gestionar suscripción",
  },
  fr: {
    sectionTitle: "Plan et facturation",
    sectionDesc: "Gériez votre abonnement, consultez les détails de votre forfait et accédez à votre historique de facturation.",
    proPlan: "Orkest Pro",
    trialPlan: "Essai gratuit de 7 jours",
    freePlan: "Forfait de base (Essai expiré)",
    statusLabel: "Statut",
    statusActive: "Actif",
    statusTrial: "Essai actif",
    statusExpired: "Expiré",
    aiLimitLabel: "Limite quotidienne de chat IA",
    messagesPerDay: "messages / jour",
    renewsOn: "Prochaine date de facturation",
    trialDaysRemaining: "Jours d'essai restants",
    trialExpiresOn: "L'essai expire le",
    upgradeBtn: "Passer à Pro",
    manageBtn: "Gérer l'abonnement",
  },
  de: {
    sectionTitle: "Plan & Abrechnung",
    sectionDesc: "Verwalte dein Abonnement, sieh dir die Details deines Plans an und greife auf deinen Rechnungsverlauf zu.",
    proPlan: "Orkest Pro",
    trialPlan: "7-tägige kostenlose Testversion",
    freePlan: "Basis-Plan (Testversion abgelaufen)",
    statusLabel: "Status",
    statusActive: "Aktiv",
    statusTrial: "Testversion aktiv",
    statusExpired: "Abgelaufen",
    aiLimitLabel: "Tägliches KI-Chat-Limit",
    messagesPerDay: "Nachrichten / Tag",
    renewsOn: "Nächster Abrechnungstermin",
    trialDaysRemaining: "Verbleibende Testtage",
    trialExpiresOn: "Testversion endet am",
    upgradeBtn: "Upgrade auf Pro",
    manageBtn: "Abonnement verwalten",
  },
  ja: {
    sectionTitle: "プランと請求",
    sectionDesc: "サブスクリプションの管理、プランの詳細確認、請求履歴へのアクセスができます。",
    proPlan: "Orkest Pro",
    trialPlan: "7日間無料トライアル",
    freePlan: "ベーシックプラン (トライアル終了)",
    statusLabel: "ステータス",
    statusActive: "有効",
    statusTrial: "トライアル中",
    statusExpired: "期限切れ",
    aiLimitLabel: "1日のAIメッセージ制限",
    messagesPerDay: "回メッセージ / 日",
    renewsOn: "次回請求日",
    trialDaysRemaining: "トライアル残り日数",
    trialExpiresOn: "トライアル終了日",
    upgradeBtn: "Pro にアップグレード",
    manageBtn: "サブスクリプションを管理",
  },
  pt: {
    sectionTitle: "Plano e Faturamento",
    sectionDesc: "Gerencie sua assinatura, visualize os detalhes do plano e acesse seu histórico de faturamento.",
    proPlan: "Orkest Pro",
    trialPlan: "Teste gratuito de 7 dias",
    freePlan: "Plano Básico (Teste expirado)",
    statusLabel: "Status",
    statusActive: "Ativo",
    statusTrial: "Teste ativo",
    statusExpired: "Expirado",
    aiLimitLabel: "Limite diário de chat com IA",
    messagesPerDay: "mensagens / dia",
    renewsOn: "Próxima data de cobrança",
    trialDaysRemaining: "Dias de teste restantes",
    trialExpiresOn: "Teste expira em",
    upgradeBtn: "Atualizar para Pro",
    manageBtn: "Gerenciar assinatura",
  }
};

export default function SettingsPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const { user, signOut, updateProfile, deleteAccount, loading: authLoading } = useAuth();
  const resetStore = useAllPageStore((s) => s.resetStore);
  const manualItems = useAllPageStore((s) => s.manualItems);
  const isItemsLoaded = useAllPageStore((s) => s.isLoaded);
  const isItemsSyncing = useAllPageStore((s) => s.isSyncing);
  const loadItemsFromCloud = useAllPageStore((s) => s.loadItemsFromCloud);
  const clearFocusSessions = useFocusStore((s) => s.clearSessions);
  const { sleepStart, sleepEnd, setSleepStart, setSleepEnd, timeFormat, setTimeFormat, weekStartDay, setWeekStartDay, bufferMinutes, setBufferMinutes, appearance, setAppearance, showCompletedOnToday, setShowCompletedOnToday, allDefaultView, setAllDefaultView, dateFormatRegion, setDateFormatRegion, dailyDigestEnabled, setDailyDigestEnabled, dailyDigestTopics, setDailyDigestTopics, loadedFromCloud: settingsLoadedFromCloud } = useSettingsStore();

  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement>(null);

  const [emailDigestEnabled, setEmailDigestEnabled] = useState(false);
  const [emailDigestHour, setEmailDigestHour] = useState(8);
  const [emailDigestLoading, setEmailDigestLoading] = useState(true);
  const [emailDigestSaving, setEmailDigestSaving] = useState(false);
  const emailTimezoneOffset = new Date().getTimezoneOffset();
  const [emailTimeDropdownOpen, setEmailTimeDropdownOpen] = useState(false);
  const [emailTimeDropUp, setEmailTimeDropUp] = useState(false);
  const emailTimeDropdownRef = useRef<HTMLDivElement>(null);
  const emailTimeButtonRef = useRef<HTMLButtonElement>(null);

  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showShortcutsSection, setShowShortcutsSection] = useState(false);


  // Feedback States
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"bug" | "feature_request" | "general" | "technical_support">("general");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSubmitSuccess, setFeedbackSubmitSuccess] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackContent.trim()) {
      setFeedbackError(t("settings.feedback.emptyContent"));
      return;
    }
    setSubmittingFeedback(true);
    setFeedbackError(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: feedbackType,
          content: feedbackContent,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("settings.feedback.error"));
      }

      setFeedbackSubmitSuccess(true);
      setFeedbackContent("");
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : t("settings.feedback.error"));
    } finally {
      setSubmittingFeedback(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (languageMenuRef.current && !languageMenuRef.current.contains(e.target as Node)) {
        setLanguageMenuOpen(false);
      }
      if (emailTimeDropdownRef.current && !emailTimeDropdownRef.current.contains(e.target as Node)) {
        setEmailTimeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const userEmail = user?.email ?? "";
  const userName = user?.user_metadata?.username ?? "";
  const userAvatar = user?.user_metadata?.avatar_url ?? "";
  const displayName = userName || userEmail;
  const userInitial = displayName.charAt(0).toUpperCase();

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState(userName);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [subscription, setSubscription] = useState<any | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoadingSub(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("Error fetching subscription:", error);
        } else {
          setSubscription(data);
        }
      } catch (err) {
        console.error("Failed to query subscription:", err);
      } finally {
        setLoadingSub(false);
      }
    };

    fetchSubscription();
  }, [user]);

  useEffect(() => {
    if (!user) { setEmailDigestLoading(false); return; }
    fetch("/api/daily-digest/email")
      .then((r) => r.json())
      .then((data) => {
        setEmailDigestEnabled(data.enabled ?? false);
        setEmailDigestHour(data.sendHour ?? 8);
      })
      .catch(() => {})
      .finally(() => setEmailDigestLoading(false));
  }, [user]);

  const billingT = BILLING_LOCALE[locale] || BILLING_LOCALE.en;

  const formatBillingDate = (dateStr: string) => {
    try {
      const dObj = new Date(dateStr);
      return dObj.toLocaleDateString(getDateLocale(), {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const signupDate = user?.created_at ? new Date(user.created_at) : new Date();
  const trialEndDate = new Date(signupDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const isPro = subscription?.status === "active" || subscription?.status === "trialing";
  const isTrialActive = !isPro && daysRemaining > 0;
  
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const response = await fetch("/api/subscription/portal", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Failed to generate billing portal link.");
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to redirect to billing portal:", err);
      alert(err instanceof Error ? err.message : "Failed to load billing portal.");
    } finally {
      setLoadingPortal(false);
    }
  };

  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [avatarSourceUrl, setAvatarSourceUrl] = useState<string | null>(null);
  const [avatarImageSize, setAvatarImageSize] = useState({ width: 0, height: 0 });
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffset, setAvatarOffset] = useState({ x: 0, y: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarImageRef = useRef<HTMLImageElement>(null);
  const avatarFrameRef = useRef<HTMLDivElement>(null);
  const avatarDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const displayAvatar = localAvatar ?? userAvatar;
  const isExportDisabled = isItemsSyncing || !isItemsLoaded;

  useEffect(() => {
    if (user && !isItemsLoaded) {
      void loadItemsFromCloud(user.id);
    }
  }, [isItemsLoaded, loadItemsFromCloud, user]);

  useEffect(() => {
    return () => {
      if (avatarSourceUrl) {
        URL.revokeObjectURL(avatarSourceUrl);
      }
    };
  }, [avatarSourceUrl]);

  const clearAvatarEditor = () => {
    if (avatarSourceUrl) {
      URL.revokeObjectURL(avatarSourceUrl);
    }
    setAvatarSourceUrl(null);
    setAvatarImageSize({ width: 0, height: 0 });
    setAvatarZoom(1);
    setAvatarOffset({ x: 0, y: 0 });
  };

  const handleSaveUsername = async () => {
    const trimmed = usernameDraft.trim();
    if (trimmed.length < 2) {
      setProfileError(t("auth.usernameShort"));
      return;
    }
    setSaving(true);
    setProfileError(null);
    const { error } = await updateProfile({ username: trimmed });
    if (error) {
      setProfileError(error);
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditingUsername(false);
  };

  const handleAvatarFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user?.id) {
      setProfileError(t("settings.profile.needSignInAvatar"));
      return;
    }
    if (!file.type.startsWith("image/")) {
      setProfileError(t("settings.profile.chooseImage"));
      return;
    }

    setProfileError(null);
    if (avatarSourceUrl) {
      URL.revokeObjectURL(avatarSourceUrl);
    }
    setAvatarSourceUrl(URL.createObjectURL(file));
    setAvatarImageSize({ width: 0, height: 0 });
    setAvatarZoom(1);
    setAvatarOffset({ x: 0, y: 0 });
    setAvatarDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAvatarBlob = async (avatarBlob: Blob) => {
    if (!user?.id) {
      setProfileError(t("settings.profile.needSignInAvatar"));
      return;
    }

    setSaving(true);
    setProfileError(null);
    const previousAvatar = displayAvatar;
    const previewUrl = URL.createObjectURL(avatarBlob);
    setLocalAvatar(previewUrl);

    const supabase = createClient();
    const fileName = `${user.id}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, avatarBlob, { contentType: "image/jpeg", upsert: true });

    if (uploadError) {
      URL.revokeObjectURL(previewUrl);
      setLocalAvatar(previousAvatar || null);
      setProfileError(uploadError.message);
      setSaving(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const publicUrl = data.publicUrl;

    setLocalAvatar(publicUrl);
    const { error: profileUpdateError } = await updateProfile({ avatar_url: publicUrl });
    URL.revokeObjectURL(previewUrl);
    if (profileUpdateError) {
      setLocalAvatar(previousAvatar || null);
      setProfileError(profileUpdateError);
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  const handleSaveAvatarCrop = async () => {
    if (!avatarImageRef.current || !avatarFrameRef.current) {
      return;
    }

    const blob = await createCroppedAvatarBlob({
      image: avatarImageRef.current,
      frameSize: avatarFrameRef.current.clientWidth,
      zoom: avatarZoom,
      offset: avatarOffset,
    });

    if (!blob) {
      setProfileError(t("settings.profile.processImage"));
      return;
    }

    setAvatarDialogOpen(false);
    clearAvatarEditor();
    await uploadAvatarBlob(blob);
  };

  const handleCloseAvatarDialog = (open: boolean) => {
    setAvatarDialogOpen(open);
    if (!open) {
      clearAvatarEditor();
    }
  };

  const handleAvatarPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    avatarDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: avatarOffset.x,
      originY: avatarOffset.y,
    };
  };

  const handleAvatarPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = avatarDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setAvatarOffset(
      clampAvatarOffset({
        offset: {
          x: drag.originX + event.clientX - drag.startX,
          y: drag.originY + event.clientY - drag.startY,
        },
        imageSize: avatarImageSize,
        frameSize: avatarFrameRef.current?.clientWidth ?? 0,
        zoom: avatarZoom,
      }),
    );
  };

  const handleAvatarPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = avatarDragRef.current;
    if (drag?.pointerId === event.pointerId) {
      avatarDragRef.current = null;
    }
  };

  const handleAvatarWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const zoomDelta = event.deltaY > 0 ? -0.08 : 0.08;
    const nextZoom = clamp(avatarZoom + zoomDelta, AVATAR_MIN_ZOOM, AVATAR_MAX_ZOOM);
    setAvatarZoom(nextZoom);
    setAvatarOffset((current) =>
      clampAvatarOffset({
        offset: current,
        imageSize: avatarImageSize,
        frameSize: avatarFrameRef.current?.clientWidth ?? 0,
        zoom: nextZoom,
      }),
    );
  };

  const handleSignOut = async () => {
    resetStore();
    await signOut();
    router.push(`/${locale}/auth`);
  };

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [clearStatsDialogOpen, setClearStatsDialogOpen] = useState(false);
  const [clearingStats, setClearingStats] = useState(false);
  const [clearStatsError, setClearStatsError] = useState<string | null>(null);

  const handleClearFocusStats = async () => {
    setClearingStats(true);
    setClearStatsError(null);
    await clearFocusSessions();
    setClearingStats(false);
    setClearStatsDialogOpen(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim() !== "DELETE") return;
    setDeleting(true);
    setDeleteError(null);
    const { error } = await deleteAccount();
    if (error) {
      setDeleteError(error);
      setDeleting(false);
      return;
    }
    router.push(`/${locale}/auth`);
  };

  const downloadExport = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleExportIcs = () => {
    downloadExport(
      exportScheduleToIcs(manualItems),
      getScheduleExportFilename("ics"),
      "text/calendar;charset=utf-8",
    );
  };

  const handleExportCsv = () => {
    downloadExport(
      exportScheduleToCsv(manualItems),
      getScheduleExportFilename("csv"),
      "text/csv;charset=utf-8",
    );
  };

  const [exportingConversations, setExportingConversations] = useState(false);
  const [exportingMemories, setExportingMemories] = useState(false);

  const handleExportConversations = async () => {
    setExportingConversations(true);
    try {
      const res = await fetch("/api/ai-conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const data = await res.json();
      downloadExport(
        JSON.stringify(data.conversations, null, 2),
        `orkest-conversations-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json;charset=utf-8",
      );
    } catch {
      // silent
    } finally {
      setExportingConversations(false);
    }
  };

  const handleExportMemories = async () => {
    setExportingMemories(true);
    try {
      const res = await fetch("/api/ai-memories");
      if (!res.ok) throw new Error("Failed to fetch memories");
      const data = await res.json();
      downloadExport(
        JSON.stringify(data.memories, null, 2),
        `orkest-memories-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json;charset=utf-8",
      );
    } catch {
      // silent
    } finally {
      setExportingMemories(false);
    }
  };

  if (authLoading || (user && (!settingsLoadedFromCloud || (isItemsSyncing && !isItemsLoaded)))) {
    return <SettingsPageSkeleton />;
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto dark:text-[#f5f5f5]">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.title")}</h1>
      </div>

      <div className="rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#25242a] text-white text-xl font-semibold dark:bg-[#f5f5f5] dark:text-[#111111]">
              {displayAvatar ? (
                <img src={displayAvatar} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                userInitial || <User className="h-8 w-8" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#25242a] text-white dark:border-[#181818] dark:bg-[#f5f5f5] dark:text-[#111111]"
              title={t("settings.profile.uploadAvatar")}
            >
              <Camera className="h-3 w-3" strokeWidth={2.5} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileSelected} />
          </div>
          <div className="min-w-0 flex-1">
            {editingUsername ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={usernameDraft}
                  onChange={(e) => setUsernameDraft(e.target.value.slice(0, 30))}
                  maxLength={30}
                  minLength={2}
                  className="flex-1 rounded-lg border border-black/10 bg-[#fafafa] px-3 py-1.5 text-sm font-medium text-[#25242a] outline-none focus:border-[#25242a]/30 dark:border-white/10 dark:bg-white/5 dark:text-[#f5f5f5]"
                  placeholder={t("settings.profile.enterUsername")}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveUsername(); if (e.key === "Escape") { setEditingUsername(false); setUsernameDraft(userName); } }}
                />
                <button
                  type="button"
                  onClick={() => { setEditingUsername(false); setUsernameDraft(userName); }}
                  className="cursor-pointer rounded-full border border-black/10 bg-[#fafafa] px-3 py-1.5 text-xs font-medium text-[#25242a]/70 transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleSaveUsername}
                  disabled={saving || usernameDraft.trim().length < 2}
                  className="cursor-pointer rounded-full bg-[#25242a] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-black disabled:opacity-50 dark:bg-[#f5f5f5] dark:text-[#111111] dark:hover:bg-white"
                >
                  {saving ? "..." : t("common.save")}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-[#25242a] truncate dark:text-[#f5f5f5]">{displayName}</p>
                <button
                  type="button"
                  onClick={() => { setEditingUsername(true); setUsernameDraft(userName); }}
                  className="cursor-pointer text-xs text-[#8c8691] hover:text-[#25242a] dark:hover:text-[#f5f5f5] transition-colors"
                >
                  {t("common.edit")}
                </button>
              </div>
            )}
            <p className="text-xs text-[#6a6570] dark:text-[#a09ba5] mt-0.5">{userEmail}</p>
            {profileError ? (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">{profileError}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Plan & Billing Section */}
      <div className="mt-4 rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{billingT.sectionTitle}</h2>
        </div>
        <p className="text-xs text-[#25242a]/50 mb-6 dark:text-[#d4d4d4]/60">
          {billingT.sectionDesc}
        </p>

        {loadingSub ? (
          <div className="flex items-center gap-2 py-4 justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-[#25242a]/40 dark:text-[#f5f5f5]/40" />
            <span className="text-xs text-[#25242a]/50 dark:text-[#d4d4d4]/50">{t("common.loading")}</span>
          </div>
        ) : isPro ? (
          /* Premium Pro Plan Card */
          <div className="relative overflow-hidden rounded-2xl border border-black/8 bg-[#f5f5f5]/40 p-5 dark:border-white/10 dark:bg-white/[0.04]">
            {/* Visual glow element */}
            <div className="absolute right-0 top-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-[#25242a]/5 blur-xl dark:bg-[#f5f5f5]/5 pointer-events-none" />
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="font-display text-lg font-bold text-[#25242a] dark:text-[#f5f5f5]">
                    {billingT.proPlan}
                  </span>
                </div>
                
                <div className="space-y-1.5">
                  {subscription?.current_period_end && (
                    <p className="text-xs text-[#25242a]/50 dark:text-[#d4d4d4]/50">
                      {billingT.renewsOn}: <span className="font-medium text-[#25242a] dark:text-[#f5f5f5]">{formatBillingDate(subscription.current_period_end)}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => router.push(addLocaleToPathname("/pricing", locale as any))}
                  className="cursor-pointer rounded-full border border-black/8 bg-transparent px-4 py-2 text-xs font-semibold text-[#25242a] transition-colors hover:bg-black/5 dark:border-white/10 dark:text-[#f5f5f5] dark:hover:bg-white/5"
                >
                  {t("landing.nav.pricing") || "Pricing"}
                </button>
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={loadingPortal}
                  className="cursor-pointer rounded-full bg-[#25242a] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed dark:bg-[#f5f5f5] dark:text-[#111111] dark:hover:bg-white"
                >
                  {loadingPortal ? (
                    <div className="flex items-center gap-1.5 justify-center">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>{t("common.loading")}</span>
                    </div>
                  ) : (
                    billingT.manageBtn
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Free Trial / Basic Plan Card */
          <div className="rounded-2xl border border-black/5 bg-[#faf9f6]/40 p-5 dark:border-white/5 dark:bg-white/[0.02]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="font-display text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">
                    {isTrialActive ? billingT.trialPlan : billingT.freePlan}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {isTrialActive && (
                    <p className="text-xs text-[#25242a]/50 dark:text-[#d4d4d4]/50">
                      {billingT.trialExpiresOn}: <span className="font-medium text-[#25242a] dark:text-[#f5f5f5]">{formatBillingDate(trialEndDate.toISOString())}</span>
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push(addLocaleToPathname("/pricing", locale as any))}
                className="shrink-0 cursor-pointer rounded-full bg-[#25242a] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-black dark:bg-[#f5f5f5] dark:text-[#111111] dark:hover:bg-white"
              >
                {billingT.upgradeBtn}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
            <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("digest.enabled")}</h2>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dailyDigestEnabled}
            onClick={() => setDailyDigestEnabled(!dailyDigestEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${
              dailyDigestEnabled
                ? "bg-[#25242a] dark:bg-[#f5f5f5]"
                : "bg-[#d4d4d4] dark:bg-[#404040]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform dark:bg-[#111111] ${
                dailyDigestEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <p className="mt-2 text-xs text-[#25242a]/50 dark:text-[#d4d4d4]/60">
          {t("digest.enabledHint")}
        </p>
        {dailyDigestEnabled && (
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
            {([
              { value: "task_summary" as const, label: t("digest.topic.task_summary"), icon: List },
              { value: "daily_quote" as const, label: t("digest.topic.daily_quote"), icon: Quote },
              { value: "today_in_history" as const, label: t("digest.topic.today_in_history"), icon: CalendarDays },
              { value: "daily_book" as const, label: t("digest.topic.daily_book"), icon: BookOpen },
              { value: "daily_movie" as const, label: t("digest.topic.daily_movie"), icon: Film },
            ]).map((topic) => {
              const selected = dailyDigestTopics.includes(topic.value);
              return (
                <button
                  key={topic.value}
                  type="button"
                  onClick={() => {
                    if (selected) {
                      setDailyDigestTopics(dailyDigestTopics.filter((v) => v !== topic.value));
                    } else {
                      setDailyDigestTopics([...dailyDigestTopics, topic.value]);
                    }
                  }}
                  className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border px-3 py-4 text-center transition-all ${
                    selected
                      ? "border-black/8 bg-[#25242a]/5 text-[#25242a] dark:border-white/10 dark:bg-[#f5f5f5]/5 dark:text-[#f5f5f5]"
                      : "border-black/8 bg-white text-[#25242a]/55 hover:border-black/15 hover:bg-black/[0.02] hover:text-[#25242a]/75 dark:border-white/10 dark:bg-[#202020] dark:text-[#d4d4d4]/55 dark:hover:border-white/15 dark:hover:bg-white/[0.04] dark:hover:text-[#d4d4d4]/75"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                      selected
                        ? "bg-black/[0.04] text-[#25242a] dark:bg-white/[0.06] dark:text-[#f5f5f5]"
                        : "bg-black/[0.04] text-[#25242a]/60 group-hover:bg-black/[0.06] dark:bg-white/[0.06] dark:text-[#d4d4d4]/60 dark:group-hover:bg-white/[0.10]"
                    }`}
                  >
                    <topic.icon className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                  <span className="text-[12px] font-medium leading-tight">{topic.label}</span>
                  {selected && (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#25242a] text-white dark:bg-[#f5f5f5] dark:text-[#111111]">
                      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Email Digest */}
        <div className="mt-6 border-t border-black/6 pt-6 dark:border-white/8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.emailDigest")}</h2>
                {!isPro && !isTrialActive && (
                  <span className="inline-flex items-center rounded-md bg-[#25242a]/8 px-1.5 py-0.5 text-[10px] font-semibold text-[#25242a]/60 dark:bg-white/10 dark:text-[#d4d4d4]/60">
                    {t("email.proOnly")}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#25242a]/50 dark:text-[#d4d4d4]/60 mt-0.5">
                {t("settings.emailDigestHint")}
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailDigestEnabled}
            disabled={emailDigestLoading || (!isPro && !isTrialActive)}
            onClick={async () => {
              const next = !emailDigestEnabled;
              setEmailDigestSaving(true);
              try {
                await fetch("/api/daily-digest/email", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ enabled: next, sendHour: emailDigestHour, timezoneOffset: emailTimezoneOffset }),
                });
                setEmailDigestEnabled(next);
              } catch {} finally {
                setEmailDigestSaving(false);
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              !isPro && !isTrialActive ? "cursor-not-allowed opacity-40" : "cursor-pointer"
            } ${
              emailDigestEnabled
                ? "bg-[#25242a] dark:bg-[#f5f5f5]"
                : "bg-[#d4d4d4] dark:bg-[#404040]"
            } ${emailDigestSaving ? "opacity-50" : ""}`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform dark:bg-[#111111] ${
                emailDigestEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        {emailDigestEnabled && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-xs text-[#25242a]/60 dark:text-[#d4d4d4]/70">
              {t("settings.emailDigestTime")}
            </label>
            <div className="relative" ref={emailTimeDropdownRef}>
              <button
                ref={emailTimeButtonRef}
                type="button"
                onClick={() => {
                  if (!emailTimeDropdownOpen && emailTimeButtonRef.current) {
                    const rect = emailTimeButtonRef.current.getBoundingClientRect();
                    setEmailTimeDropUp(rect.top > window.innerHeight / 2);
                  }
                  setEmailTimeDropdownOpen(!emailTimeDropdownOpen);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/10 bg-[#fafafa] px-3 py-2 text-sm text-[#25242a] outline-none transition-colors hover:bg-black/5 focus:border-[#25242a]/30 focus:ring-1 focus:ring-[#25242a]/20 dark:border-white/10 dark:bg-white/5 dark:text-[#f5f5f5] dark:hover:bg-white/10 dark:focus:border-white/30 dark:focus:ring-white/15"
              >
                <Clock className="h-4 w-4 text-[#6d6770] dark:text-[#a3a3a3]" />
                <span>
                  {timeFormat === "12h"
                    ? `${emailDigestHour === 0 ? 12 : emailDigestHour > 12 ? emailDigestHour - 12 : emailDigestHour} ${emailDigestHour < 12 ? "AM" : "PM"}`
                    : `${String(emailDigestHour).padStart(2, "0")}:00`}
                </span>
              </button>
              {emailTimeDropdownOpen && (
                <div className={`absolute left-0 z-50 w-64 rounded-2xl border border-black/8 bg-white p-1.5 shadow-[0_20px_45px_rgba(28,24,35,0.10)] dark:border-white/10 dark:bg-[#202020] dark:shadow-[0_20px_45px_rgba(0,0,0,0.45)] ${emailTimeDropUp ? "bottom-full mb-1" : "top-full mt-1"}`}>
                  <div className="grid grid-cols-2 gap-0.5">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const renderButton = (hour: number) => {
                        let label: string;
                        if (timeFormat === "12h") {
                          const period = hour < 12 ? "AM" : "PM";
                          const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                          label = `${displayHour} ${period}`;
                        } else {
                          label = `${String(hour).padStart(2, "0")}:00`;
                        }
                        return (
                          <button
                            key={hour}
                            type="button"
                            onClick={async () => {
                              setEmailDigestHour(hour);
                              setEmailTimeDropdownOpen(false);
                              setEmailDigestSaving(true);
                              try {
                                await fetch("/api/daily-digest/email", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ enabled: true, sendHour: hour, timezoneOffset: emailTimezoneOffset }),
                                });
                              } catch {} finally {
                                setEmailDigestSaving(false);
                              }
                            }}
                            className={`cursor-pointer rounded-lg px-2 py-1 text-xs font-medium tabular-nums transition-colors ${
                              emailDigestHour === hour
                                ? "bg-[#25242a] text-white dark:bg-[#f5f5f5] dark:text-[#111111]"
                                : "text-[#25242a] hover:bg-black/5 dark:text-[#f5f5f5] dark:hover:bg-white/8"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      };
                      return (
                        <div key={i} className="contents">
                          {renderButton(i)}
                          {renderButton(i + 12)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <div className="flex items-center gap-3 mb-2">
          <Languages className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.language")}</h2>
        </div>
        <p className="text-xs text-[#25242a]/50 mb-4 dark:text-[#d4d4d4]/60">
          {t("settings.languageDescription")}
        </p>
        <div ref={languageMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
            className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-black/8 bg-white px-4 py-3 text-[15px] text-[#25242a] outline-none transition-colors hover:border-black/15 focus:border-black/22 dark:border-white/10 dark:bg-[#202020] dark:text-[#f5f5f5] dark:hover:border-white/15 dark:focus:border-white/25"
          >
            <span>{LOCALE_LABELS[locale]}</span>
            <svg className={`h-4 w-4 text-[#25242a]/60 transition-transform dark:text-[#d4d4d4]/70 ${languageMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {languageMenuOpen && (
            <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-2xl border border-black/8 bg-white shadow-lg dark:border-white/10 dark:bg-[#202020]">
              {LOCALES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setLocale(option);
                    setLanguageMenuOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center px-4 py-3 text-[15px] transition-colors hover:bg-black/3 dark:hover:bg-white/5 ${
                    locale === option
                      ? "font-medium text-[#25242a] dark:text-[#f5f5f5]"
                      : "text-[#4d4a51] dark:text-[#d4d4d4]"
                  }`}
                >
                  {LOCALE_LABELS[option]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* All page default view */}
        <div className="mt-6 border-t border-black/6 pt-6 dark:border-white/8">
        <div className="flex items-center gap-3 mb-4">
          <LayoutList className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.allDefaultView")}</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {([
            { value: "timeline" as const, label: t("settings.view.timeline"), icon: List },
            { value: "list" as const, label: t("settings.view.list"), icon: LayoutList },
            { value: "calendar" as const, label: t("settings.view.calendar"), icon: Calendar },
            { value: "kanban" as const, label: t("settings.view.kanban"), icon: LayoutGrid },
            { value: "table" as const, label: t("settings.view.table"), icon: TableIcon },
          ] satisfies { value: AllDefaultView; label: string; icon: typeof List }[]).map((option) => {
            const Icon = option.icon;
            const isActive = allDefaultView === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setAllDefaultView(option.value)}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-[#25242a] bg-[#25242a] text-white dark:border-[#f5f5f5] dark:bg-[#f5f5f5] dark:text-[#111111]"
                    : "border-black/10 bg-[#fafafa] text-[#25242a]/60 hover:border-[#25242a]/30 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/70 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {option.label}
              </button>
            );
          })}
        </div>
        </div>

        {/* Appearance */}
        <div className="mt-6 border-t border-black/6 pt-6 dark:border-white/8">
        <div className="flex items-center gap-3 mb-4">
          <Monitor className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.appearance")}</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {APPEARANCE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = appearance === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setAppearance(option.value)}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-[#25242a] bg-[#25242a] text-white dark:border-[#f5f5f5] dark:bg-[#f5f5f5] dark:text-[#111111]"
                    : "border-black/10 bg-[#fafafa] text-[#25242a]/60 hover:border-[#25242a]/30 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/70 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {t(`settings.appearance.${option.value}` as "settings.appearance.light" | "settings.appearance.dark" | "settings.appearance.system")}
              </button>
            );
          })}
        </div>
        </div>

        {/* Show completed on Today */}
        <div className="mt-6 border-t border-black/6 pt-6 dark:border-white/8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showCompletedOnToday ? <Eye className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" /> : <EyeOff className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />}
            <div>
              <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.showCompleted")}</h2>
              <p className="text-xs text-[#25242a]/50 dark:text-[#d4d4d4]/60 mt-0.5">
                {showCompletedOnToday ? t("settings.completedVisible") : t("settings.completedHidden")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCompletedOnToday(!showCompletedOnToday)}
            className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${
              showCompletedOnToday ? "bg-[#25242a] dark:bg-[#f5f5f5]" : "bg-gray-200 dark:bg-white/20"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                showCompletedOnToday ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <div className="flex items-center gap-3 mb-4">
          <Moon className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.sleepTime")}</h2>
        </div>
        <p className="text-xs text-[#25242a]/50 mb-4 dark:text-[#d4d4d4]/60">
          {t("settings.sleepHint")}
        </p>
        <div className="flex gap-4">
          <label className="flex-1">
            <span className="text-xs text-[#25242a]/60 dark:text-[#d4d4d4]/70">{t("settings.bedtime")}</span>
            <input
              type="time"
              value={sleepStart}
              onChange={(e) => setSleepStart(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-black/10 bg-[#fafafa] px-3 py-2 text-sm text-[#25242a] outline-none focus:border-[#25242a]/30 focus:ring-1 focus:ring-[#25242a]/20 dark:border-white/10 dark:bg-white/5 dark:text-[#f5f5f5] dark:focus:border-white/30 dark:focus:ring-white/15"
            />
          </label>
          <label className="flex-1">
            <span className="text-xs text-[#25242a]/60 dark:text-[#d4d4d4]/70">{t("settings.wakeUp")}</span>
            <input
              type="time"
              value={sleepEnd}
              onChange={(e) => setSleepEnd(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-black/10 bg-[#fafafa] px-3 py-2 text-sm text-[#25242a] outline-none focus:border-[#25242a]/30 focus:ring-1 focus:ring-[#25242a]/20 dark:border-white/10 dark:bg-white/5 dark:text-[#f5f5f5] dark:focus:border-white/30 dark:focus:ring-white/15"
            />
          </label>
        </div>

        {/* Task buffer */}
        <div className="mt-6 border-t border-black/6 pt-6 dark:border-white/8">
        <div className="flex items-center gap-3 mb-4">
          <Timer className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.taskBuffer")}</h2>
        </div>
        <p className="text-xs text-[#25242a]/50 mb-4 dark:text-[#d4d4d4]/60">
          {t("settings.taskBufferHint")}
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={bufferMinutes}
            onChange={(e) => setBufferMinutes(Number(e.target.value))}
            className="flex-1 h-2 bg-black/10 rounded-lg appearance-none cursor-pointer accent-[#25242a] dark:bg-white/10 dark:accent-[#f5f5f5]"
          />
          <span className="text-sm font-medium text-[#25242a] w-16 text-right dark:text-[#f5f5f5]">
            {t("settings.minutes", { count: bufferMinutes })}
          </span>
        </div>
        </div>
      </div>

      {/* Time format + Date format + Week starts on */}
      <div className="mt-4 rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.timeFormat")}</h2>
        </div>
        <div className="relative grid grid-cols-2 rounded-full border border-black/10 bg-[#fafafa] p-1 dark:border-white/10 dark:bg-white/5">
          {/* Sliding background */}
          <div
            className="absolute top-1 bottom-1 rounded-full bg-[#25242a] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#f5f5f5]"
            style={{
              left: timeFormat === "12h" ? "4px" : "50%",
              width: "calc(50% - 4px)",
            }}
          />
          {(["12h", "24h"] as const satisfies TimeFormat[]).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => setTimeFormat(format)}
              className={`relative z-10 flex-1 cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                timeFormat === format
                  ? "text-white dark:text-[#111111]"
                  : "text-[#25242a]/60 hover:text-[#25242a] dark:text-[#d4d4d4]/70 dark:hover:text-[#f5f5f5]"
              }`}
            >
              {format === "12h" ? "12-hour (1:30 PM)" : "24-hour (13:30)"}
            </button>
          ))}
        </div>

        {/* Date format */}
        <div className="mt-6 border-t border-black/6 pt-6 dark:border-white/8">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.dateFormat")}</h2>
        </div>
        <p className="text-xs text-[#25242a]/50 mb-4 dark:text-[#d4d4d4]/60">
          {t("settings.dateFormatDesc")}
        </p>
        <DateFormatSelector
          value={dateFormatRegion || (typeof navigator !== "undefined" ? (navigator.language || (navigator as Navigator & { userLanguage?: string }).userLanguage) : "") || "en-US"}
          onChange={setDateFormatRegion}
        />
        </div>

        {/* Week starts on */}
        <div className="mt-6 border-t border-black/6 pt-6 dark:border-white/8">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.weekStartsOn")}</h2>
        </div>
        <div className="flex gap-2">
          {WEEK_START_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setWeekStartDay(option.value)}
              className={`flex-1 cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                weekStartDay === option.value
                  ? "border-[#25242a] bg-[#25242a] text-white dark:border-[#f5f5f5] dark:bg-[#f5f5f5] dark:text-[#111111]"
                  : "border-black/10 bg-[#fafafa] text-[#25242a]/60 hover:border-[#25242a]/30 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/70 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
              }`}
            >
              {option.value === 0 ? t("settings.week.sunday") : option.value === 1 ? t("settings.week.monday") : t("settings.week.saturday")}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Google Calendar */}
      <div className="mt-4 rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <GoogleCalendarSettings />
      </div>

      {/* Keyboard Shortcuts */}
      <div className="mt-4 rounded-2xl border border-black/8 bg-white dark:border-white/10 dark:bg-[#181818]">
        <button
          type="button"
          onClick={() => setShowShortcutsSection((c) => !c)}
          className="flex w-full cursor-pointer items-center justify-between p-6"
        >
          <div className="flex items-center gap-3">
            <Keyboard className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
            <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.shortcuts")}</h2>
          </div>
          <ChevronDown className={`h-4 w-4 text-[#9b95a0] transition-transform ${showShortcutsSection ? "rotate-180" : ""}`} />
        </button>
        {showShortcutsSection && (
          <div className="grid gap-2 px-6 pb-6 sm:grid-cols-2">
            {SHORTCUTS.map((shortcut) => {
              const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
              const formatKey = (key: string) => {
                if (key === "Alt") return isMac ? "⌥" : "Alt";
                if (key === "Ctrl") return isMac ? "⌘" : "Ctrl";
                return key;
              };
              const renderKeyGroup = (keys: string[], groupKey: string) => (
                <span className="flex items-center gap-1">
                  {keys.map((key, index) => {
                    const separator = shortcut.actionKey === "shortcuts.calendarPrevNext" ? "/" : "+";
                    return (
                      <span key={`${groupKey}-${key}-${index}`} className="flex items-center gap-1">
                        <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded-md border border-black/10 bg-[#f4f0ec]/60 px-1.5 py-0.5 text-xs font-medium text-[#5f5a63] dark:border-white/10 dark:bg-[#2a2a2a] dark:text-[#a3a3a3]">
                          {formatKey(key)}
                        </kbd>
                        {index < keys.length - 1 ? <span className="text-[#9f99a3]">{separator}</span> : null}
                      </span>
                    );
                  })}
                </span>
              );
              const showMacVariant = !!shortcut.macosKeys;
              return (
                <div key={shortcut.actionKey} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm">
                  <span className="text-[#2b2a30] dark:text-[#d4d4d4]">{t(shortcut.actionKey)}</span>
                  <span className="flex items-center gap-2">
                    {renderKeyGroup(shortcut.keys, shortcut.actionKey)}
                    {showMacVariant && (
                      <>
                        <span className="text-[#9f99a3]">/</span>
                        {renderKeyGroup(shortcut.macosKeys!, `${shortcut.actionKey}-macos`)}
                      </>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <div className="flex items-center gap-3 mb-4">
          <Download className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.export")}</h2>
        </div>
        <p className="text-xs text-[#25242a]/50 mb-4 dark:text-[#d4d4d4]/60">
          {t("settings.exportHint")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleExportIcs}
            disabled={isExportDisabled}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-black/10 bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#25242a]/70 transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] disabled:pointer-events-none disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
          >
            <Calendar className="h-4 w-4" strokeWidth={2} />
            {isItemsSyncing ? t("common.loading") : t("settings.exportIcs")}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isExportDisabled}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-black/10 bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#25242a]/70 transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] disabled:pointer-events-none disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
          >
            <Download className="h-4 w-4" strokeWidth={2} />
            {isItemsSyncing ? t("common.loading") : t("settings.exportCsv")}
          </button>
          <button
            type="button"
            onClick={handleExportConversations}
            disabled={exportingConversations}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-black/10 bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#25242a]/70 transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] disabled:pointer-events-none disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
          >
            <MessageSquare className="h-4 w-4" strokeWidth={2} />
            {exportingConversations ? t("common.loading") : t("settings.exportConversations")}
          </button>
          <button
            type="button"
            onClick={handleExportMemories}
            disabled={exportingMemories}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-black/10 bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#25242a]/70 transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] disabled:pointer-events-none disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
          >
            <Brain className="h-4 w-4" strokeWidth={2} />
            {exportingMemories ? t("common.loading") : t("settings.exportMemories")}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <div className="flex items-center gap-3 mb-2">
          <LifeBuoy className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.feedback.title")}</h2>
        </div>
        <p className="text-xs text-[#25242a]/50 mb-4 dark:text-[#d4d4d4]/60">
          {t("settings.feedback.hint")}
        </p>
        <button
          type="button"
          onClick={() => {
            setFeedbackDialogOpen(true);
            setFeedbackSubmitSuccess(false);
            setFeedbackContent("");
            setFeedbackError(null);
          }}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-black/10 bg-[#fafafa] px-5 py-3 text-sm font-medium text-[#25242a]/70 transition-all hover:border-[#25242a]/30 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
        >
          <MessageSquare className="h-4 w-4" strokeWidth={2} />
          <span>{t("settings.feedback.submit")}</span>
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#25242a] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-black dark:bg-[#f5f5f5] dark:text-[#111111] dark:hover:bg-white"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          <span>{t("settings.signOut")}</span>
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="h-5 w-5 text-[#25242a]/60 dark:text-[#d4d4d4]/70" />
          <h2 className="text-sm font-semibold text-[#25242a] dark:text-[#f5f5f5]">{t("settings.focusStats")}</h2>
        </div>
        <p className="text-xs text-[#25242a]/50 mb-4 dark:text-[#d4d4d4]/60">
          {t("settings.focusStatsHint")}
        </p>
        <button
          type="button"
          onClick={() => setClearStatsDialogOpen(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-black/10 bg-[#fafafa] px-5 py-3 text-sm font-medium text-[#25242a]/70 transition-colors hover:border-red-300 hover:text-red-600 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-red-800/40 dark:hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
          <span>{t("settings.clearFocusStats")}</span>
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/50 p-6 dark:border-red-900/30 dark:bg-red-950/20">
        <button
          type="button"
          onClick={() => setDeleteDialogOpen(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-red-300 bg-white px-5 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} />
          <span>{t("settings.profile.deleteAccount")}</span>
        </button>
      </div>

      <Dialog open={feedbackDialogOpen} onOpenChange={(open) => { if (!open) { setFeedbackDialogOpen(false); setFeedbackSubmitSuccess(false); setFeedbackError(null); } }}>
        <DialogContent className="mx-auto max-w-[min(92vw,32rem)] rounded-3xl dark:bg-[#181818] dark:border-white/10">
          <div className="p-5 sm:p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-xl tracking-normal text-[#25242a] dark:text-[#f5f5f5]">
                {t("settings.feedback.dialogTitle")}
              </DialogTitle>
              <DialogDescription className="text-sm text-[#25242a]/60 dark:text-[#d4d4d4]/70 mt-1 flex flex-col gap-1.5">
                {!feedbackSubmitSuccess && (
                  <span>{t("settings.feedback.dialogDesc")}</span>
                )}
              </DialogDescription>
            </DialogHeader>

            {feedbackSubmitSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400 mb-4 scale-in duration-500">
                  <CheckCircle className="h-10 w-10 animate-bounce-subtle" strokeWidth={2} />
                </div>
                <h3 className="text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5] mb-2">
                  {t("settings.feedback.successTitle")}
                </h3>
                <p className="text-sm text-[#25242a]/60 dark:text-[#d4d4d4]/70 max-w-xs leading-relaxed">
                  {t("settings.feedback.successDesc")}
                </p>
                <p className="mt-2 text-xs text-[#25242a]/45 dark:text-[#d4d4d4]/50 font-normal max-w-xs leading-normal">
                  {t("settings.feedback.replyNotice", { email: userEmail })}
                </p>
                <button
                  type="button"
                  onClick={() => setFeedbackDialogOpen(false)}
                  className="mt-6 w-full cursor-pointer rounded-full bg-[#25242a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black dark:bg-[#f5f5f5] dark:text-[#111111] dark:hover:bg-white"
                >
                  {t("common.close")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-[#25242a]/60 dark:text-[#d4d4d4]/70 block mb-2">
                    {t("settings.feedback.typeLabel")}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "bug" as const, label: t("settings.feedback.type.bug"), icon: Bug, activeColor: "border-red-500 bg-red-50/50 text-red-600 dark:bg-red-950/20 dark:text-red-400 dark:border-red-500/50" },
                      { value: "feature_request" as const, label: t("settings.feedback.type.feature_request"), icon: Sparkles, activeColor: "border-green-500 bg-green-50/50 text-green-600 dark:bg-green-950/20 dark:text-green-400 dark:border-green-500/50" },
                      { value: "general" as const, label: t("settings.feedback.type.general"), icon: MessageSquare, activeColor: "border-orange-500 bg-orange-50/50 text-orange-600 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-500/50" },
                      { value: "technical_support" as const, label: t("settings.feedback.type.technical_support"), icon: LifeBuoy, activeColor: "border-blue-500 bg-blue-50/50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-500/50" },
                    ]).map((type) => {
                      const Icon = type.icon;
                      const isActive = feedbackType === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFeedbackType(type.value)}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-all text-left ${
                            isActive
                              ? `${type.activeColor}`
                              : "border-black/8 bg-white text-[#25242a]/70 hover:border-black/15 hover:text-[#25242a] dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/70 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                          <span className="truncate">{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[#25242a]/60 dark:text-[#d4d4d4]/70 block mb-2">
                    {t("settings.feedback.contentLabel")}
                  </label>
                  <div className="relative">
                    <textarea
                      rows={5}
                      maxLength={1000}
                      value={feedbackContent}
                      onChange={(e) => setFeedbackContent(e.target.value)}
                      placeholder={t("settings.feedback.contentPlaceholder")}
                      disabled={submittingFeedback}
                      className="w-full rounded-xl border border-black/10 bg-[#fafafa] p-3 text-sm text-[#25242a] outline-none transition-all placeholder:text-black/30 focus:border-[#25242a]/30 focus:ring-1 focus:ring-[#25242a]/20 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-[#f5f5f5] dark:placeholder:text-white/30 dark:focus:border-white/30 dark:focus:ring-white/15 resize-none"
                    />
                    <div className="absolute bottom-2.5 right-3 text-[10px] font-medium text-[#25242a]/40 dark:text-[#d4d4d4]/40">
                      {t("settings.feedback.charactersRemaining", { count: 1000 - feedbackContent.length })}
                    </div>
                  </div>
                </div>

                {feedbackError && (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 animate-in fade-in duration-200">
                    {feedbackError}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setFeedbackDialogOpen(false); setFeedbackError(null); }}
                    disabled={submittingFeedback}
                    className="flex-1 cursor-pointer rounded-full border border-black/10 bg-[#fafafa] px-4 py-2.5 text-sm font-semibold text-[#25242a]/70 transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingFeedback || !feedbackContent.trim()}
                    className="flex-1 cursor-pointer rounded-full bg-[#25242a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-black disabled:opacity-50 dark:bg-[#f5f5f5] dark:text-[#111111] dark:hover:bg-white"
                  >
                    {submittingFeedback ? t("settings.feedback.submitting") : t("settings.feedback.submit")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clearStatsDialogOpen} onOpenChange={(open) => { if (!open) { setClearStatsDialogOpen(false); setClearStatsError(null); } }}>
        <DialogContent className="mx-auto max-w-[min(92vw,28rem)] rounded-3xl">
          <div className="p-5 sm:p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-xl tracking-normal text-red-600 dark:text-red-400">{t("settings.clearFocusStats")}</DialogTitle>
              <DialogDescription className="text-sm">{t("settings.clearFocusStatsConfirm")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {clearStatsError && (
                <p className="text-xs text-red-600 dark:text-red-400">{clearStatsError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setClearStatsDialogOpen(false); setClearStatsError(null); }}
                  disabled={clearingStats}
                  className="flex-1 cursor-pointer rounded-full border border-black/10 bg-[#fafafa] px-4 py-2.5 text-sm font-medium text-[#25242a]/70 transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleClearFocusStats}
                  disabled={clearingStats}
                  className="flex-1 cursor-pointer rounded-full bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {clearingStats ? t("settings.clearFocusStatsProcessing") : t("settings.clearFocusStats")}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!open) { setDeleteDialogOpen(false); setDeleteConfirmText(""); setDeleteError(null); } }}>
        <DialogContent className="mx-auto max-w-[min(92vw,28rem)] rounded-3xl">
          <div className="p-5 sm:p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-xl tracking-normal text-red-600 dark:text-red-400">{t("settings.profile.deleteAccount")}</DialogTitle>
              <DialogDescription className="text-sm">{t("settings.profile.deleteAccountConfirm")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full rounded-lg border border-black/10 bg-[#fafafa] px-3 py-2 text-sm text-[#25242a] outline-none focus:border-[#25242a]/30 dark:border-white/10 dark:bg-white/5 dark:text-[#f5f5f5]"
                placeholder={t("settings.profile.deleteAccountConfirmInput")}
                disabled={deleting}
              />
              {deleteError && (
                <p className="text-xs text-red-600 dark:text-red-400">{deleteError}</p>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(""); setDeleteError(null); }}
                  disabled={deleting}
                  className="flex-1 cursor-pointer rounded-full border border-black/10 bg-[#fafafa] px-4 py-2.5 text-sm font-medium text-[#25242a]/70 transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText.trim() !== "DELETE"}
                  className="flex-1 cursor-pointer rounded-full bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? t("settings.profile.deleteAccountProcessing") : t("settings.profile.deleteAccount")}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={avatarDialogOpen} onOpenChange={handleCloseAvatarDialog}>
        <DialogContent className="mx-auto max-w-[min(92vw,30rem)] rounded-3xl">
          <div className="p-5 sm:p-6">
            <DialogHeader className="mb-5">
              <DialogTitle className="text-xl tracking-normal">{t("settings.profile.adjustAvatar")}</DialogTitle>
              <DialogDescription>{t("settings.profile.largeImages")}</DialogDescription>
            </DialogHeader>

            <div
              ref={avatarFrameRef}
              className="relative mx-auto aspect-square w-full max-w-80 touch-none cursor-grab overflow-hidden rounded-full bg-[#f2f0ed] active:cursor-grabbing dark:bg-white/8"
              onPointerDown={handleAvatarPointerDown}
              onPointerMove={handleAvatarPointerMove}
              onPointerUp={handleAvatarPointerEnd}
              onPointerCancel={handleAvatarPointerEnd}
              onWheel={handleAvatarWheel}
            >
              {avatarSourceUrl ? (
                <img
                  ref={avatarImageRef}
                  src={avatarSourceUrl}
                  alt={t("settings.profile.avatarPreview")}
                  draggable={false}
                  onLoad={(event) => {
                    setAvatarImageSize({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    });
                  }}
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    width: getAvatarPreviewSize(avatarImageSize).width,
                    height: getAvatarPreviewSize(avatarImageSize).height,
                    transform: `translate(calc(-50% + ${avatarOffset.x}px), calc(-50% + ${avatarOffset.y}px)) scale(${avatarZoom})`,
                  }}
                />
              ) : null}
              <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/10 ring-inset dark:ring-white/15" />
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleCloseAvatarDialog(false)}
                disabled={saving}
                className="cursor-pointer rounded-full border border-black/10 bg-[#fafafa] px-4 py-2 text-sm font-medium text-[#25242a]/70 transition-colors hover:border-[#25242a]/30 hover:text-[#25242a] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-[#d4d4d4]/75 dark:hover:border-white/20 dark:hover:text-[#f5f5f5]"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveAvatarCrop}
                disabled={saving || !avatarImageSize.width}
                className="cursor-pointer rounded-full bg-[#25242a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50 dark:bg-[#f5f5f5] dark:text-[#111111] dark:hover:bg-white"
              >
                {saving ? t("common.saving") : t("settings.profile.saveAvatar")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mt-8 border-t border-black/6 pt-6 dark:border-white/10">
        <div className="flex justify-center items-center gap-4 mb-3">
          <a href={`/${locale}/chat`} className="text-xs text-[#8c8691] dark:text-[#a09ba5] hover:text-[#25242a] dark:hover:text-[#f5f5f5] transition-colors">/chat</a>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#8c8691] dark:text-[#a09ba5]">
          <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="hover:text-[#25242a] dark:hover:text-[#f5f5f5] transition-colors">{t("settings.privacyPolicy")}</a>
          <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="hover:text-[#25242a] dark:hover:text-[#f5f5f5] transition-colors">{t("settings.termsOfService")}</a>
          <a href={`/${locale}/open-source-licenses`} target="_blank" rel="noopener noreferrer" className="hover:text-[#25242a] dark:hover:text-[#f5f5f5] transition-colors">{t("settings.openSourceLicenses")}</a>
        </div>
      </div>
      <KeyboardShortcutsHelp open={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />
    </div>
  );
}

function getAvatarPreviewSize(imageSize: { width: number; height: number }) {
  if (!imageSize.width || !imageSize.height) {
    return { width: "100%", height: "100%" };
  }

  if (imageSize.width > imageSize.height) {
    return { width: "auto", height: "100%" };
  }
  return { width: "100%", height: "auto" };
}

function clampAvatarOffset({
  offset,
  imageSize,
  frameSize,
  zoom,
}: {
  offset: { x: number; y: number };
  imageSize: { width: number; height: number };
  frameSize: number;
  zoom: number;
}) {
  if (!imageSize.width || !imageSize.height || frameSize <= 0) {
    return offset;
  }

  const baseScale = Math.max(frameSize / imageSize.width, frameSize / imageSize.height);
  const displayedWidth = imageSize.width * baseScale * zoom;
  const displayedHeight = imageSize.height * baseScale * zoom;
  const maxX = Math.max(0, (displayedWidth - frameSize) / 2);
  const maxY = Math.max(0, (displayedHeight - frameSize) / 2);

  return {
    x: clamp(offset.x, -maxX, maxX),
    y: clamp(offset.y, -maxY, maxY),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function createCroppedAvatarBlob({
  image,
  frameSize,
  zoom,
  offset,
}: {
  image: HTMLImageElement;
  frameSize: number;
  zoom: number;
  offset: { x: number; y: number };
}) {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context || frameSize <= 0) {
    return null;
  }

  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  const baseScale = Math.max(frameSize / naturalWidth, frameSize / naturalHeight);
  const displayScale = baseScale * zoom;
  const outputScale = AVATAR_OUTPUT_SIZE / frameSize;
  const displayedWidth = naturalWidth * displayScale;
  const displayedHeight = naturalHeight * displayScale;
  const drawX = (frameSize / 2 + offset.x - displayedWidth / 2) * outputScale;
  const drawY = (frameSize / 2 + offset.y - displayedHeight / 2) * outputScale;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
  context.drawImage(
    image,
    drawX,
    drawY,
    displayedWidth * outputScale,
    displayedHeight * outputScale,
  );

  for (const quality of AVATAR_QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, quality);
    if (blob && (blob.size <= AVATAR_TARGET_BYTES || quality === AVATAR_QUALITY_STEPS.at(-1))) {
      return blob;
    }
  }

  return canvasToBlob(canvas, AVATAR_QUALITY_STEPS.at(-1) ?? 0.74);
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
}
