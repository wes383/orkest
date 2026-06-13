"use client";

import {
  ClipboardList,
  Settings,
  Sun,
  Target,
  Trash2,
  User,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import AllPage from "@/app/(shell)/all/page";
import FocusPage from "@/app/(shell)/focus/page";
import TodayPage from "@/app/(shell)/page";
import { TrashPage } from "@/components/trash-page";
import { ItemForm } from "@/components/all-page/item-form";
import { ProjectSection } from "@/components/sidebar/project-section";
import { SyncStatusIndicator } from "@/components/sync-status-indicator";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { useAiChatContext } from "@/lib/contexts/ai-chat-context";
import { useFocusStore } from "@/lib/stores/use-focus-store";
import { useAllPageStore } from "@/lib/stores/use-all-page-store";
import { formatCountdown, formatStopwatch } from "@/lib/focus-page-utils";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { CommandPalette } from "@/components/command-palette";
import { QuickAddBar } from "@/components/quick-add-bar";
import { Tooltip } from "@/components/ui/tooltip";
import { addLocaleToPathname, stripLocaleFromPathname, useI18n } from "@/lib/i18n";
import {
  parseSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_COOKIE,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
} from "@/lib/sidebar-preferences";
import { useAuth } from "@/lib/auth/auth-provider";

const items = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/all", label: "All", icon: ClipboardList },
  { href: "/focus", label: "Focus", icon: Target },
];

const TAB_COMPONENTS: Record<string, () => ReactNode> = {
  "/": TodayPage,
  "/all": AllPage,
  "/focus": FocusPage,
  "/trash": TrashPage,
};

function TogglePanelIcon({
  isCollapsed,
}: Readonly<{
  isCollapsed: boolean;
}>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="h-5 w-5"
      style={{ shapeRendering: "geometricPrecision" }}
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d={isCollapsed ? "M9 7V17" : "M9 3V21"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SidebarLayout({
  children,
  initialSidebarCollapsed = false,
}: {
  children: React.ReactNode;
  initialSidebarCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, t } = useI18n();
  const { user } = useAuth();
  const userName = user?.user_metadata?.username ?? "";
  const userAvatar = user?.user_metadata?.avatar_url ?? "";
  const localPathname = stripLocaleFromPathname(pathname);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return initialSidebarCollapsed;
    }
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    return saved === null
      ? initialSidebarCollapsed
      : parseSidebarCollapsedPreference(saved);
  });

  useEffect(() => {
    const serialized = String(isCollapsed);
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, serialized);
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${serialized}; path=/; max-age=31536000; samesite=lax`;
  }, [isCollapsed]);

  const isSettingsPage = localPathname === "/settings";
  const isTrashPage = localPathname === "/trash";
  const isAiChatPage = localPathname === "/chat";
  const isProjectsPage = localPathname === "/projects";

  const [activeTab, setActiveTab] = useState(() => {
    if (localPathname === "/trash") return "/trash";
    const match = items.find((item) => item.href === localPathname);
    return match ? match.href : "/";
  });

  // Track which tabs have been visited (lazy mount)
  const [mountedTabs, setMountedTabs] = useState<Set<string>>(() => {
    const initial = new Set([activeTab]);
    if (pathname === "/trash") initial.add("/trash");
    return initial;
  });

  const switchTab = useCallback(
    (href: string) => {
      if (href === activeTab && !isSettingsPage && !isTrashPage && !isProjectsPage) return;
      setActiveTab(href);
      setMountedTabs((prev) => {
        if (prev.has(href)) return prev;
        const next = new Set(prev);
        next.add(href);
        return next;
      });
      if ((isSettingsPage || isProjectsPage) && href !== "/trash") {
        router.push(addLocaleToPathname(href, locale));
      } else {
        window.history.pushState(null, "", addLocaleToPathname(href, locale));
      }
    },
    [activeTab, isSettingsPage, isTrashPage, isProjectsPage, locale, router],
  );

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = stripLocaleFromPathname(window.location.pathname);
      const match = items.find((item) => item.href === path);
      if (match) {
        setActiveTab(match.href);
        setMountedTabs((prev) => {
          if (prev.has(match.href)) return prev;
          const next = new Set(prev);
          next.add(match.href);
          return next;
        });
      } else if (path === "/trash") {
        setActiveTab("/trash");
        setMountedTabs((prev) => {
          if (prev.has("/trash")) return prev;
          const next = new Set(prev);
          next.add("/trash");
          return next;
        });
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const mobileContentBackground = activeTab === "/all" || activeTab === "/trash" ? "bg-[#fcfbfa] dark:bg-[#101010]" : "bg-transparent";
  const mobileTopContentBackground = "bg-linear-to-b from-[#fcfbfa] via-[#fcfbfa]/72 to-[#fcfbfa]/0 dark:from-[#101010] dark:via-[#101010]/72 dark:to-[#101010]/0";
  const iconClassName = "h-5 w-5 shrink-0";

  const ai = useAiChatContext();
  const openComposer = useAllPageStore((s) => s.openComposer);
  const { timerMode, timerState, timeRemainingSeconds, startedAtTimestamp, pausedElapsedSeconds, settings, startTimer, pauseTimer, resumeTimer, resetTimer } = useFocusStore();

  // Check if AI sidebar mode is active
  const isAiSidebarActive = ai.isExpanded && ai.displayMode === "sidebar";

  // Tick every 1s while the timer is running so the sidebar indicator stays live
  const [, setTick] = useState(0);
  useEffect(() => {
    if (timerState !== "running") return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [timerState]);

  // Live sidebar timer text: shown when a focus session is in progress and the user is not on the Focus page
  const sidebarTimerText =
    timerState === "idle"
      ? null
      : (() => {
          const liveElapsed =
            timerState === "running" && startedAtTimestamp
              ? pausedElapsedSeconds + Math.floor((Date.now() - startedAtTimestamp) / 1000)
              : pausedElapsedSeconds;
          const seconds =
            timerMode === "stopwatch"
              ? liveElapsed
              : Math.max(settings.countdownMinutes * 60 - liveElapsed, 0);
          // Countdown mirrors the focus page's minimalist display (minutes only / ":SS" for < 60s)
          return timerMode === "stopwatch" ? formatStopwatch(seconds) : formatCountdown(seconds);
        })();
  const showSidebarTimer = sidebarTimerText !== null && localPathname !== "/focus";

  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const expandedMenuRef = useRef<HTMLDivElement>(null);
  const collapsedMenuRef = useRef<HTMLDivElement>(null);
  const userMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const [isRailHover, setIsRailHover] = useState(false);
  const railHoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasBeenHovered = useRef(false);
  const isMouseOverToggle = useRef(false);
  const triggerZoneRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const showRail = useCallback(() => {
    if (isMouseOverToggle.current) return;
    if (railHoverTimeout.current) {
      clearTimeout(railHoverTimeout.current);
      railHoverTimeout.current = null;
    }
    hasBeenHovered.current = true;
    railHoverTimeout.current = setTimeout(() => {
      setIsRailHover(true);
    }, 100);
  }, []);

  const hideRailDelayed = useCallback((e?: React.MouseEvent) => {
    if (showUserMenu) return;
    const relatedTarget = e?.relatedTarget;
    if (
      relatedTarget instanceof Node &&
      (triggerZoneRef.current?.contains(relatedTarget) ||
        railRef.current?.contains(relatedTarget))
    ) {
      return;
    }
    if (railHoverTimeout.current) clearTimeout(railHoverTimeout.current);
    railHoverTimeout.current = setTimeout(() => {
      setIsRailHover(false);
    }, 200);
  }, [showUserMenu]);

  useEffect(() => {
    return () => {
      if (railHoverTimeout.current) clearTimeout(railHoverTimeout.current);
    };
  }, []);

  // Force-hide rail when sidebar collapses
  useEffect(() => {
    if (isCollapsed) {
      if (railHoverTimeout.current) {
        clearTimeout(railHoverTimeout.current);
        railHoverTimeout.current = null;
      }
      setIsRailHover(false);
      hasBeenHovered.current = false;
    }
  }, [isCollapsed]);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        expandedMenuRef.current?.contains(target) ||
        collapsedMenuRef.current?.contains(target) ||
        userMenuAnchorRef.current?.contains(target)
      ) {
        return;
      }
      setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showUserMenu]);

  // Hide rail after menu closes if mouse is no longer over rail
  useEffect(() => {
    if (showUserMenu) return;
    if (!isCollapsed || !isRailHover) return;
    const handleMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (
        railRef.current?.contains(el) ||
        triggerZoneRef.current?.contains(el) ||
        collapsedMenuRef.current?.contains(el)
      ) {
        return;
      }
      setIsRailHover(false);
    };
    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [showUserMenu, isCollapsed, isRailHover]);

  useKeyboardShortcuts([
    { key: "1", alt: true, handler: () => switchTab("/") },
    { key: "2", alt: true, handler: () => switchTab("/all") },
    { key: "3", alt: true, handler: () => switchTab("/focus") },
    { key: "4", alt: true, handler: () => switchTab("/trash") },
    { key: ",", alt: true, handler: () => router.push(addLocaleToPathname("/settings", locale)) },
    { key: "b", alt: true, handler: () => setIsCollapsed((c) => !c), allowInput: true },
    {
      key: "k",
      ctrl: true,
      handler: () => setShowCommandPalette((current) => !current),
      allowInput: true,
    },
    {
      key: "Enter",
      alt: true,
      handler: () => setShowQuickAdd((current) => !current),
      allowInput: true,
    },
    {
      key: "n",
      alt: true,
      handler: () => {
        if (!isSettingsPage && !isTrashPage) {
          openComposer();
        }
      },
    },
    {
      key: "i",
      alt: true,
      handler: () => {
        if (activeTab === "/focus") return;
        ai.setExpandedState(!ai.isExpanded);
      },
    },
    {
      key: " ",
      handler: () => {
        if (activeTab !== "/focus") return;
        const countdownEnded = timerMode === "countdown" && timerState === "idle" && timeRemainingSeconds === 0;
        if (timerState === "idle" && !countdownEnded) {
          startTimer();
        } else if (timerState === "running") {
          pauseTimer();
        } else if (timerState === "paused") {
          resumeTimer();
        }
      },
    },
    {
      key: "r",
      alt: true,
      handler: () => {
        if (activeTab === "/focus") resetTimer();
      },
    },
    {
      key: "?",
      handler: () => {
        setShowShortcutsHelp((current) => !current);
      },
    },
  ]);

  const toggleButton = (
    <button
      type="button"
      onClick={() => setIsCollapsed((current) => !current)}
      className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-black transition-colors hover:bg-black/[0.035] hover:text-black dark:text-[#f5f5f5] dark:hover:bg-white/8 dark:hover:text-white"
      aria-label={isCollapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
    >
      <TogglePanelIcon isCollapsed={isCollapsed} />
    </button>
  );

  return (
    <div className="relative flex min-h-screen text-black dark:text-[#f5f5f5]">
      <div className={`fixed inset-x-0 top-0 z-30 h-16 sm:hidden transition-opacity duration-300 ${ai.isFullscreen ? "opacity-0 pointer-events-none" : ""}`}>
        <div
          className={`absolute inset-y-0 left-0 bg-sidebar transition-[width] duration-200 ease-in-out ${
            isCollapsed ? "w-0" : "w-40"
          }`}
        />
        <div
          className={`absolute inset-y-0 right-0 left-0 transition-opacity duration-200 ease-in-out ${mobileTopContentBackground} ${
            isCollapsed ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />
        <div className="relative flex h-full items-center px-4">
          {toggleButton}
        </div>
      </div>
      <div
        className={`fixed z-30 hidden transition-all duration-300 ease-in-out sm:block ${
          ai.isFullscreen ? "opacity-0 pointer-events-none" : ""
        } ${isCollapsed ? "top-6 left-2" : "top-6 left-49"}`}
        onMouseEnter={() => { isMouseOverToggle.current = true; if (isCollapsed) showRail(); }}
        onMouseLeave={(e) => { isMouseOverToggle.current = false; if (isCollapsed) hideRailDelayed(e); }}
      >
        {toggleButton}
      </div>
      <aside
        className={`fixed left-0 z-20 overflow-hidden bg-sidebar transition-[width] duration-200 top-16 bottom-0 sm:inset-y-0 sm:top-0 ${
          isCollapsed ? "w-0" : "w-40 sm:w-64"
        }`}
      >
        <div
          className={`absolute inset-y-0 left-0 w-40 px-4 py-6 pt-6 sm:w-64 sm:px-5 sm:pt-8 transition-[opacity,transform] duration-200 flex flex-col ${
            isCollapsed
              ? "pointer-events-none translate-x-0 opacity-0"
              : "translate-x-0 opacity-100"
          }`}
        >
          <div className="mb-6">
            <button
              type="button"
              onClick={() => switchTab("/")}
              className="cursor-pointer rounded-md p-1 transition-colors hover:bg-black/[0.035] dark:hover:bg-white/8 ml-2"
              aria-label={t("nav.goToday")}
            >
              <svg
                className="h-6 w-6 shrink-0 block dark:hidden"
                viewBox="0 0 512 512"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="255.5" cy="255.5" r="200.5" fill="black" />
                <defs>
                  <clipPath id="logo-clip-light">
                    <circle cx="255.5" cy="255.5" r="200.5" />
                  </clipPath>
                </defs>
                <g clipPath="url(#logo-clip-light)">
                  <line
                    x1="380.529"
                    y1="98.0623"
                    x2="222.334"
                    y2="256.257"
                    stroke="white"
                    strokeWidth="48"
                    strokeLinecap="round"
                  />
                  <line
                    x1="388.987"
                    y1="423.362"
                    x2="223.529"
                    y2="257.904"
                    stroke="white"
                    strokeWidth="48"
                    strokeLinecap="round"
                  />
                </g>
              </svg>
              <svg
                className="h-6 w-6 shrink-0 hidden dark:block"
                viewBox="0 0 512 512"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="255.5" cy="255.5" r="200.5" fill="white" />
                <defs>
                  <clipPath id="logo-clip-dark">
                    <circle cx="255.5" cy="255.5" r="200.5" />
                  </clipPath>
                </defs>
                <g clipPath="url(#logo-clip-dark)">
                  <line
                    x1="380.529"
                    y1="98.0623"
                    x2="222.334"
                    y2="256.257"
                    stroke="black"
                    strokeWidth="48"
                    strokeLinecap="round"
                  />
                  <line
                    x1="388.987"
                    y1="423.362"
                    x2="223.529"
                    y2="257.904"
                    stroke="black"
                    strokeWidth="48"
                    strokeLinecap="round"
                  />
                </g>
              </svg>
            </button>
          </div>
          <nav className="flex flex-col gap-2">
            {items.map((item) => {
              const isActive = activeTab === item.href && !isSettingsPage;
              const Icon = item.icon;

              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => switchTab(item.href)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-[15px] leading-none font-medium transition-colors ${
                    isActive
                      ? "bg-black/[0.035] text-black dark:bg-white/10 dark:text-[#f5f5f5]"
                      : "text-black hover:bg-black/[0.035] hover:text-black dark:text-[#d4d4d4] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                  }`}
                  aria-label={t(`nav.${item.href === "/" ? "today" : item.href.slice(1)}` as "nav.today" | "nav.all" | "nav.focus")}
                >
                  <Icon
                    className={iconClassName}
                    strokeWidth={2}
                    style={{ shapeRendering: "geometricPrecision" }}
                  />
                  <span>{t(`nav.${item.href === "/" ? "today" : item.href.slice(1)}` as "nav.today" | "nav.all" | "nav.focus")}</span>
                  {item.href === "/focus" && showSidebarTimer && (
                    <span
                      className={`ml-auto flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-normal tabular-nums ${
                        isActive
                          ? "bg-black/[0.06] text-black/70 dark:bg-white/15 dark:text-[#f5f5f5]/75"
                          : "bg-black/[0.04] text-black/60 dark:bg-white/[0.06] dark:text-[#d4d4d4]/60"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          timerState === "running"
                            ? "animate-pulse bg-emerald-500"
                            : "bg-black/40 dark:bg-white/40"
                        }`}
                      />
                      {sidebarTimerText}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {((activeTab === "/all" && !isSettingsPage && !isTrashPage) || isProjectsPage) && (() => {
            return (
              <ProjectSection
                onSelect={(projectId) => {
                  if (isProjectsPage) {
                    router.push(addLocaleToPathname(`/all?project=${projectId}`, locale));
                    setActiveTab("/all");
                    setMountedTabs((prev) => {
                      if (prev.has("/all")) return prev;
                      const next = new Set(prev);
                      next.add("/all");
                      return next;
                    });
                    return;
                  }
                  if (activeTab !== "/all") {
                    setActiveTab("/all");
                    setMountedTabs((prev) => {
                      if (prev.has("/all")) return prev;
                      const next = new Set(prev);
                      next.add("/all");
                      return next;
                    });
                  }
                }}
              />
            );
          })()}

          <div className="mt-auto shrink-0 pt-4">
            <div className="px-4">
              <SyncStatusIndicator />
            </div>
            {user && (
              <div className="relative mt-4">
                <button
                  type="button"
                  ref={userMenuAnchorRef}
                  onClick={() => setShowUserMenu((prev) => !prev)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-black/[0.035] dark:hover:bg-white/8"
                >
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 dark:bg-white/10">
                      <User className="h-3.5 w-3.5 text-[#7d7880] dark:text-[#8a8a8a]" />
                    </div>
                  )}
                  <span className="truncate text-[13px] font-medium text-black dark:text-[#f5f5f5]">
                    {userName}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
      {/* Expanded sidebar user menu - rendered outside overflow:hidden */}
      {!isCollapsed && showUserMenu && user && (
        <div
          ref={expandedMenuRef}
          className="fixed z-50 w-40 sm:w-52 rounded-xl bg-sidebar p-1.5 shadow-lg border border-black/8 dark:border-white/10 flex flex-col gap-1"
          style={{
            bottom: `calc(100vh - ${(userMenuAnchorRef.current?.getBoundingClientRect().top ?? 0) - 4}px)`,
            left: isCollapsed ? '0px' : (userMenuAnchorRef.current?.getBoundingClientRect().left ?? 0) + 'px',
          }}
        >
          <button
            type="button"
            onClick={() => {
              switchTab("/trash");
              setShowUserMenu(false);
            }}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${
              isTrashPage
                ? "bg-black/[0.035] text-black dark:bg-white/10 dark:text-[#f5f5f5]"
                : "text-[#7d7880] hover:bg-black/[0.035] hover:text-black dark:text-[#8a8a8a] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
            }`}
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
            <span>{t("nav.trash")}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              router.push(addLocaleToPathname("/settings", locale));
              setShowUserMenu(false);
            }}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${
              isSettingsPage
                ? "bg-black/[0.035] text-black dark:bg-white/10 dark:text-[#f5f5f5]"
                : "text-[#7d7880] hover:bg-black/[0.035] hover:text-black dark:text-[#8a8a8a] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
            }`}
          >
            <Settings className="h-4 w-4" strokeWidth={2} />
            <span>{t("nav.settings")}</span>
          </button>
        </div>
      )}
      {/* Hover trigger zone */}
      <div
        ref={triggerZoneRef}
        className={`fixed left-0 bottom-0 z-10 hidden w-14 sm:block top-[72px] ${
          isCollapsed ? "" : "pointer-events-none"
        }`}
        onMouseEnter={showRail}
        onMouseLeave={(e) => hideRailDelayed(e)}
      />
      {/* Floating collapsed rail */}
      <div
        ref={railRef}
        className={`fixed left-0 bottom-0 z-20 w-14 bg-sidebar shadow-lg hidden sm:flex flex-col items-center pt-4 pb-5 rounded-r-xl top-[72px] ${
          isCollapsed && isRailHover ? "" : "pointer-events-none"
        }`}
        style={{
          animation: !hasBeenHovered.current
            ? "none"
            : isCollapsed && isRailHover
              ? "rail-slide-in 0.2s ease-in-out forwards"
              : "rail-slide-out 0.2s ease-in-out forwards",
          opacity: hasBeenHovered.current ? undefined : 0,
        }}
        onMouseLeave={(e) => hideRailDelayed(e)}
      >
          {/* Nav icons */}
          <nav className="flex flex-col gap-2">
            {items.map((item) => {
              const isActive = activeTab === item.href && !isSettingsPage;
              const Icon = item.icon;
              const label = t(`nav.${item.href === "/" ? "today" : item.href.slice(1)}` as "nav.today" | "nav.all" | "nav.focus");
              return (
                <Tooltip key={item.href} content={label} side="right">
                  <button
                    type="button"
                    onClick={() => switchTab(item.href)}
                    className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl transition-colors ${
                      isActive
                        ? "bg-black/[0.035] text-black dark:bg-white/10 dark:text-[#f5f5f5]"
                        : "text-[#7d7880] hover:bg-black/[0.035] hover:text-black dark:text-[#8a8a8a] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                    }`}
                    aria-label={label}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} style={{ shapeRendering: "geometricPrecision" }} />
                  </button>
                </Tooltip>
              );
            })}
          </nav>

          {/* Bottom: user avatar with menu */}
          <div className="mt-auto flex flex-col items-center gap-0 pt-2" ref={collapsedMenuRef}>
            {user && (
              <>
                <Tooltip content={userName || t("nav.settings")} side="right" disabled={showUserMenu}>
                  <button
                    type="button"
                    onClick={() => setShowUserMenu((prev) => !prev)}
                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl transition-colors hover:bg-black/[0.035] dark:hover:bg-white/8"
                  >
                    {userAvatar ? (
                      <img
                        src={userAvatar}
                        alt={userName}
                        className="h-7 w-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 dark:bg-white/10">
                        <User className="h-3.5 w-3.5 text-[#7d7880] dark:text-[#8a8a8a]" />
                      </div>
                    )}
                  </button>
                </Tooltip>
                {showUserMenu && (
                  <div className="absolute left-full bottom-4 ml-1 w-32 rounded-xl bg-sidebar p-1.5 shadow-lg border border-black/8 dark:border-white/10 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        switchTab("/trash");
                        setShowUserMenu(false);
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                        isTrashPage
                          ? "bg-black/[0.035] text-black dark:bg-white/10 dark:text-[#f5f5f5]"
                          : "text-[#7d7880] hover:bg-black/[0.035] hover:text-black dark:text-[#8a8a8a] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                      }`}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} />
                      <span>{t("nav.trash")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        router.push(addLocaleToPathname("/settings", locale));
                        setShowUserMenu(false);
                      }}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                        isSettingsPage
                          ? "bg-black/[0.035] text-black dark:bg-white/10 dark:text-[#f5f5f5]"
                          : "text-[#7d7880] hover:bg-black/[0.035] hover:text-black dark:text-[#8a8a8a] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                      }`}
                    >
                      <Settings className="h-4 w-4" strokeWidth={2} />
                      <span>{t("nav.settings")}</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
      </div>
      <main
        data-sidebar-collapsed={isCollapsed}
        className={`group/sidebar flex min-h-screen flex-1 ${mobileContentBackground} sm:bg-transparent transition-[margin-right] duration-300 ease-in-out ${
          isAiSidebarActive ? "sm:mr-[360px]" : ""
        }`}
      >
        <div
          aria-hidden="true"
          className={`shrink-0 transition-[width] duration-300 ease-in-out ${
            isCollapsed ? "w-0" : "w-40 sm:w-64"
          }`}
        />
        <div className={`min-h-screen min-w-0 flex-1 pt-16 sm:pt-0 ${mobileContentBackground} sm:bg-transparent`}>
          {isAiChatPage ? (
            children
          ) : isSettingsPage ? (
            children
          ) : isProjectsPage ? (
            children
          ) : isTrashPage ? (
            mountedTabs.has("/trash") && <TrashPage />
          ) : (
            items.map((item) => {
              if (!mountedTabs.has(item.href)) return null;
              const TabComponent = TAB_COMPONENTS[item.href];
              if (!TabComponent) return null;
              return (
                <div
                  key={item.href}
                  style={{ display: activeTab === item.href ? "contents" : "none" }}
                >
                  <TabComponent />
                </div>
              );
            })
          )}
        </div>
        <ItemForm />
      </main>
      <KeyboardShortcutsHelp open={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onOpenComposer={openComposer}
        onNavigate={switchTab}
        onNavigateSettings={() => router.push(addLocaleToPathname("/settings", locale))}
        onToggleAi={() => ai.setExpandedState(!ai.isExpanded)}
      />
      <QuickAddBar
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
      />
    </div>
  );
}
