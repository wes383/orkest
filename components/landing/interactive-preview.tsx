"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sun, ClipboardList, Target, TrendingUp, User, Clock,
  CheckCircle, Circle, Calendar, List, LayoutGrid, Table2,
  ChevronDown, Eye, EyeOff, Plus, Pencil, Trash2, Quote,
  Bell, Search, Folder, Tag, Flag, ArrowUpDown,
  ChevronLeft, ChevronRight, MoreHorizontal, Repeat,
  Maximize2, Minimize2, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PageId = "timeline" | "digest" | "all" | "focus" | "progress";

const NAV: { id: PageId; icon: typeof Sun; label: string }[] = [
  { id: "timeline", icon: Sun, label: "Today" },
  { id: "all", icon: ClipboardList, label: "All" },
  { id: "focus", icon: Target, label: "Focus" },
  { id: "progress", icon: TrendingUp, label: "Progress" },
];

const pBorder = (p: string) => p === "urgent" ? "bg-red-500" : p === "high" ? "bg-orange-500" : p === "medium" ? "bg-blue-500" : "bg-gray-300";
const pBg = (p: string) => p === "urgent" ? "bg-red-50" : p === "high" ? "bg-orange-50" : p === "medium" ? "bg-blue-50" : "bg-gray-50";

/* ─── Pill Toggle (matches TimerModeSelector / Digest view toggle) ─── */
function PillToggle({
  options, active, onChange, dark,
}: { options: string[]; active: number; onChange: (i: number) => void; dark: boolean }) {
  return (
    <div className="relative grid grid-cols-2 rounded-full border border-black/8 dark:border-white/10 bg-[#f4f0ec]/[0.5] dark:bg-[#2a2a2a] p-0.5">
      <div
        className="absolute top-0.5 bottom-0.5 rounded-full bg-[#ffffff] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#d4d4d4]"
        style={{ left: active === 0 ? "2px" : "50%", width: "calc(50% - 2px)" }}
      />
      {options.map((opt, i) => (
        <button key={opt} type="button" onClick={() => onChange(i)}
          className={cn(
            "relative z-10 flex cursor-pointer items-center justify-center rounded-full px-5 py-1.5 text-xs font-medium tracking-wide transition-colors",
            i === active ? "text-[#1a1a1a] dark:text-[#000000]" : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3] dark:hover:text-[#d4d4d4]"
          )}>{opt}</button>
      ))}
    </div>
  );
}

/* ─── Sidebar Logo (exact match) ─── */
function Logo({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0">
      <circle cx="255.5" cy="255.5" r="200.5" fill={dark ? "white" : "black"} />
      <defs><clipPath id="lp-c"><circle cx="255.5" cy="255.5" r="200.5" /></clipPath></defs>
      <g clipPath="url(#lp-c)">
        <line x1="380.529" y1="98.0623" x2="222.334" y2="256.257" stroke={dark ? "black" : "white"} strokeWidth="48" strokeLinecap="round" />
        <line x1="388.987" y1="423.362" x2="223.529" y2="257.904" stroke={dark ? "black" : "white"} strokeWidth="48" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/* ─── TogglePanelIcon (matches sidebar-layout.tsx) ─── */
function ToggleIcon({ isCollapsed }: { isCollapsed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5" style={{ shapeRendering: "geometricPrecision" }}>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d={isCollapsed ? "M9 7V17" : "M9 3V21"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Sidebar ─── */
function Sidebar({ active, onChange, dark, isCollapsed, onToggleCollapse }: { active: PageId; onChange: (p: PageId) => void; dark: boolean; isCollapsed: boolean; onToggleCollapse: () => void }) {
  const realActive = active === "digest" ? "timeline" : active;

  return (
    <>
      {/* Desktop sidebar — always visible */}
      <div className="hidden sm:flex h-full w-64 shrink-0 flex-col bg-sidebar px-5 pt-6 sm:pt-8">
        <div className="mb-6 flex items-center justify-between">
          <button type="button" className="cursor-pointer rounded-md p-1 transition-colors hover:bg-black/[0.035] dark:hover:bg-white/8 ml-2">
            <Logo dark={dark} />
          </button>
          <button type="button" className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-black transition-colors hover:bg-black/[0.035] dark:text-[#f5f5f5] dark:hover:bg-white/8">
            <ToggleIcon />
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          {NAV.map(item => {
            const isActive = realActive === item.id;
            return (
              <button key={item.id} type="button" onClick={() => onChange(item.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-[15px] leading-none font-medium transition-colors",
                  isActive
                    ? "bg-black/[0.035] text-black dark:bg-white/10 dark:text-[#f5f5f5]"
                    : "text-black hover:bg-black/[0.035] hover:text-black dark:text-[#d4d4d4] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                )}>
                <item.icon className="h-5 w-5 shrink-0" strokeWidth={2} style={{ shapeRendering: "geometricPrecision" }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="mt-auto shrink-0 pt-4">
          <button type="button" className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 dark:bg-white/10">
              <User className="h-3.5 w-3.5 text-[#7d7880] dark:text-[#8a8a8a]" />
            </div>
            <span className="truncate text-[13px] font-medium text-black dark:text-[#f5f5f5]">demo_user</span>
          </button>
        </div>
      </div>

      {/* Mobile sidebar — absolute within container, slides in/out */}
      <aside className={`absolute sm:hidden inset-y-0 left-0 z-40 w-72 overflow-hidden bg-sidebar shadow-xl transition-transform duration-200 ease-in-out ${isCollapsed ? "-translate-x-full" : "translate-x-0"}`}>
        <div className={`absolute inset-y-0 left-0 w-72 px-5 pt-6 flex flex-col transition-[opacity] duration-200 ${isCollapsed ? "pointer-events-none opacity-0" : "opacity-100"}`}>
          <div className="mb-6 flex items-center justify-between">
            <button type="button" className="cursor-pointer rounded-md p-1 transition-colors hover:bg-black/[0.035] dark:hover:bg-white/8 ml-2">
              <Logo dark={dark} />
            </button>
            <button type="button" onClick={onToggleCollapse} className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-black transition-colors hover:bg-black/[0.035] dark:text-[#f5f5f5] dark:hover:bg-white/8">
              <ToggleIcon isCollapsed={isCollapsed} />
            </button>
          </div>
          <nav className="flex flex-col gap-2">
            {NAV.map(item => {
              const isActive = realActive === item.id;
              return (
                <button key={item.id} type="button" onClick={() => { onChange(item.id); onToggleCollapse(); }}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-[15px] leading-none font-medium transition-colors",
                    isActive
                      ? "bg-black/[0.035] text-black dark:bg-white/10 dark:text-[#f5f5f5]"
                      : "text-black hover:bg-black/[0.035] hover:text-black dark:text-[#d4d4d4] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]"
                  )}>
                  <item.icon className="h-5 w-5 shrink-0" strokeWidth={2} style={{ shapeRendering: "geometricPrecision" }} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto shrink-0 pt-4">
            <button type="button" className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/10 dark:bg-white/10">
                <User className="h-3.5 w-3.5 text-[#7d7880] dark:text-[#8a8a8a]" />
              </div>
              <span className="truncate text-[13px] font-medium text-black dark:text-[#f5f5f5]">demo_user</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─── Today: Timeline ─── */
const HOUR_H = 96;
const LABEL_W = 56;
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16];
const TOTAL_H = HOURS.length * HOUR_H;
const TASKS_TL = [
  { n: "Team standup meeting", t: "10:00 - 10:30", top: 2 * HOUR_H, h: HOUR_H / 2, p: "high" },
  { n: "Review PR #142", t: "11:00 - 11:30", top: 3 * HOUR_H, h: HOUR_H / 2, p: "medium" },
  { n: "Lunch break", t: "12:00 - 13:00", top: 4 * HOUR_H, h: HOUR_H, p: "low" },
  { n: "Write API docs", t: "14:00 - 15:00", top: 6 * HOUR_H, h: HOUR_H, p: "medium" },
  { n: "1:1 with Sarah", t: "15:30 - 16:00", top: 7.5 * HOUR_H, h: HOUR_H / 2, p: "high" },
];

function TimelineView() {
  return (
    <div>
      <div className="relative pl-2 pr-1">
        <div className="relative" style={{ height: TOTAL_H }}>
          {HOURS.map((hour, i) => (
            <div key={hour} className="absolute left-0 right-0 flex items-start" style={{ top: i * HOUR_H, height: HOUR_H }}>
              <span className="shrink-0 text-right pr-4 text-xs font-medium tabular-nums whitespace-nowrap" style={{ width: LABEL_W }}>
                {String(hour).padStart(2, "0")}:00
              </span>
              <div className="flex-1 border-t border-black/6 dark:border-white/6" />
            </div>
          ))}
          {/* Current time: ~10:40 */}
          <div className="absolute z-20 pointer-events-none" style={{ top: 2 * HOUR_H + 40 * (HOUR_H / 60), left: LABEL_W, right: 0 }}>
            <div className="h-px bg-green-500" />
          </div>
          {/* Task cards */}
          {TASKS_TL.map(task => (
            <div key={task.n}
              className={cn("group absolute rounded-xl shadow-sm border border-black/8 hover:shadow-md hover:border-black/12 transition-colors overflow-hidden text-left cursor-pointer dark:border-white/10 dark:hover:border-white/20", pBg(task.p))}
              style={{ top: task.top, height: task.h, left: LABEL_W + 2, right: 4 }}>
              <div className="h-full flex items-center justify-between gap-2 px-3.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn("w-1 h-5 rounded-full shrink-0", pBorder(task.p))} />
                  <h3 className="text-sm font-medium truncate text-[#25242a] dark:text-[#f5f5f5]">{task.n}</h3>
                </div>
                <span className="text-xs text-[#6f6a72] whitespace-nowrap shrink-0 tabular-nums dark:text-[#a09ba5]">{task.t}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Today: Digest ─── */
function DigestView() {
  const card = "rounded-2xl border border-black/8 bg-white p-6 dark:border-white/10 dark:bg-[#181818]";
  const label = "text-[11px] font-semibold tracking-[0.18em] text-[#8c8691] dark:text-[#a09ba5] uppercase";
  return (
    <div className="flex flex-col gap-6">
      {/* DailyDigestCard */}
      <div className={card}>
        <h2 className="font-display text-xl font-semibold text-[#25242a] dark:text-[#f5f5f5]">Good afternoon!</h2>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[["LEFT", "4"], ["DONE", "0"], ["OVERDUE", "1"]].map(([l, v]) => (
            <div key={l} className="rounded-2xl border border-black/8 bg-white/75 px-4 py-3 dark:border-white/10 dark:bg-[#202020]/75">
              <p className={label}>{l}</p>
              <p className="mt-1 text-2xl font-semibold text-[#25242a] dark:text-[#f5f5f5]">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2">
          <Clock className="h-4 w-4 shrink-0 mt-0.5 text-[#8c8691] dark:text-[#a09ba5]" />
          <div className="min-w-0">
            <p className={label}>Next Up</p>
            <p className="text-sm font-medium text-[#25242a] dark:text-[#f5f5f5] truncate">Lunch break · 12:00 - 13:00</p>
          </div>
        </div>
      </div>
      {/* DailyQuoteCard */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Quote className="h-4 w-4 text-[#8c8691] dark:text-[#a09ba5]" />
          <p className={label}>Daily Quote</p>
        </div>
        <div className="mt-4">
          <p className="text-base font-medium leading-relaxed text-[#25242a] dark:text-[#f5f5f5]">&ldquo;The secret of getting ahead is getting started.&rdquo;</p>
          <p className="mt-2 text-sm text-[#6f6a72] dark:text-[#a09ba5]">— Mark Twain</p>
        </div>
      </div>
      {/* OnThisDayCard */}
      <div className={card}>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[#8c8691] dark:text-[#a09ba5]" />
          <p className={label}>Today in History</p>
        </div>
        <div className="mt-4 flex gap-3 text-[13px]">
          <span className="shrink-0 text-[11px] font-semibold text-[#8c8691] dark:text-[#a09ba5]">2022</span>
          <span className="text-[#25242a] dark:text-[#f5f5f5]">First image of the Milky Way's black hole revealed</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Today Page ─── */
function TodayPage({ dark }: { dark: boolean }) {
  const [view, setView] = useState(1); // 0=digest, 1=timeline
  return (
    <div className="px-4 py-8 sm:px-14 lg:px-14 lg:py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 lg:px-3">
          <PillToggle options={["Digest", "Timeline"]} active={view} onChange={setView} dark={dark} />
          <p className="hidden sm:block shrink-0 rounded-full bg-[#e8e6ea] px-3 py-1 text-sm font-medium text-[#6f6a72]">Wednesday, May 20</p>
        </div>
        {view === 0 ? <DigestView /> : <TimelineView />}
      </div>
    </div>
  );
}

/* ─── All Page ─── */
type AllView = "list" | "timeline" | "calendar" | "kanban" | "table";
const VIEW_OPTIONS: { key: AllView; label: string; icon: typeof List }[] = [
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "list", label: "List", icon: List },
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "kanban", label: "Kanban", icon: LayoutGrid },
  { key: "table", label: "Table", icon: Table2 },
];
type Task = {
  id: number; title: string; time: string; day: string; p: "low" | "medium" | "high" | "urgent";
  done: boolean; scheduled: boolean; project: string | null; projColor: string;
  tags: string[]; recurring: boolean; desc?: string;
};
const TASKS: Task[] = [
  { id: 1, title: "Team standup meeting", time: "10:00 AM - 10:30 AM", day: "Today", p: "high", done: false, scheduled: true, project: null, projColor: "#a3a3a3", tags: ["meeting"], recurring: true },
  { id: 2, title: "Review PR #142", time: "11:00 AM - 11:30 AM", day: "Today", p: "medium", done: false, scheduled: true, project: "Engineering", projColor: "#3b82f6", tags: [], recurring: false },
  { id: 3, title: "Lunch break", time: "12:00 PM - 1:00 PM", day: "Today", p: "low", done: false, scheduled: true, project: null, projColor: "#a3a3a3", tags: [], recurring: false },
  { id: 4, title: "Write API documentation", time: "2:00 PM - 3:00 PM", day: "Today", p: "medium", done: false, scheduled: true, project: "Design", projColor: "#8b5cf6", tags: ["docs"], recurring: false, desc: "Document the new REST API endpoints for v2" },
  { id: 5, title: "1:1 with Sarah", time: "3:30 PM - 4:00 PM", day: "Today", p: "high", done: false, scheduled: true, project: null, projColor: "#a3a3a3", tags: ["meeting"], recurring: true },
  { id: 6, title: "Submit quarterly report", time: "", day: "Unscheduled", p: "urgent", done: false, scheduled: false, project: null, projColor: "#a3a3a3", tags: ["report"], recurring: false },
  { id: 7, title: "Update project roadmap", time: "", day: "Unscheduled", p: "medium", done: false, scheduled: false, project: "Marketing", projColor: "#14b8a6", tags: [], recurring: false },
  { id: 8, title: "Fix login bug", time: "", day: "Unscheduled", p: "high", done: true, scheduled: false, project: "Engineering", projColor: "#3b82f6", tags: ["bug"], recurring: false },
];
const PRIO: Record<string, { label: string; cls: string; textColor: string }> = {
  low:    { label: "Low",    cls: "bg-gray-100 text-gray-600 border-gray-200",   textColor: "#4b5563" },
  medium: { label: "Medium", cls: "bg-blue-50 text-blue-600 border-blue-200",    textColor: "#2563eb" },
  high:   { label: "High",   cls: "bg-orange-50 text-orange-600 border-orange-200", textColor: "#ea580c" },
  urgent: { label: "Urgent", cls: "bg-red-50 text-red-600 border-red-200",       textColor: "#dc2626" },
};

/* matches ProjectPill from project-pill.tsx */
function pAlpha(hex: string, a: number) {
  const n = hex.replace("#", "");
  return `rgba(${parseInt(n.slice(0,2),16)},${parseInt(n.slice(2,4),16)},${parseInt(n.slice(4,6),16)},${a})`;
}
function ProjectPillPreview({ name, color }: { name: string; color: string }) {
  return (
    <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors"
      style={{ borderColor: pAlpha(color, 0.28), backgroundColor: pAlpha(color, 0.12), color: pAlpha(color, 0.85) }}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="max-w-[8rem] truncate">{name}</span>
    </button>
  );
}

/* ─── PreviewItemCard (matches ItemCard DOM output exactly) ─── */
function PreviewItemCard({ item, compact = true, showCompactActions = true, inlineMeta = true, hidePriority = false, titleSize = "compact" }: {
  item: Task; compact?: boolean; showCompactActions?: boolean; inlineMeta?: boolean; hidePriority?: boolean; titleSize?: "compact" | "timeline" | "default";
}) {
  const titleCls = titleSize === "compact"
    ? "text-[clamp(0.95rem,1.5vw,1.2rem)]"
    : titleSize === "timeline"
      ? "text-[clamp(1rem,1.8vw,1.4rem)]"
      : "text-[clamp(1.65rem,3vw,2.35rem)]";
  return (
    <article className="group/item cursor-pointer">
      <div className={cn("rounded-xl transition-colors duration-200 hover:bg-black/2", compact ? "p-3" : "p-6")}>
        <div className="flex gap-4">
          <div className="flex-1">
            {/* ProjectPill */}
            {item.project && <div className="mb-2"><ProjectPillPreview name={item.project} color={item.projColor} /></div>}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Time */}
                {item.time && (
                  <p className={cn("mb-2 font-medium tracking-[0.05em] tabular-nums text-[#7e7982] uppercase", compact ? "text-xs" : "text-sm")}>
                    {item.time}
                  </p>
                )}
                {/* Tags */}
                {item.tags.length > 0 && (
                  <div className={cn("mb-2 -ml-0.5 flex flex-wrap items-center", compact ? "gap-1" : "gap-1.5")}>
                    {item.tags.map(tag => (
                      <span key={tag} className={cn("rounded-full bg-gray-200 font-medium text-gray-600", compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm")}>{tag}</span>
                    ))}
                  </div>
                )}
                {/* Title */}
                <h4 className={cn("font-display leading-[1.08] font-medium tracking-[-0.01em] transition-all",
                  titleCls,
                  item.done ? "line-through text-[#b0a9b2]" : "text-[#333139]"
                )}>{item.title}</h4>
              </div>
              {/* Compact actions */}
              {showCompactActions && (
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" className={cn("flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors",
                    item.done ? "text-gray-400 hover:bg-gray-100 hover:text-gray-600" : "text-green-500 hover:bg-green-50 hover:text-green-600"
                  )}>
                    {item.done ? <CheckCircle className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                  </button>
                  <button type="button" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[#9f99a3] transition-colors hover:bg-black/5 hover:text-[#525059]">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            {/* Description */}
            {item.desc && <p className={cn("max-w-2xl text-[#706b74]", compact ? "mt-1.5 text-sm leading-5" : "mt-3 text-base leading-7")}>{item.desc}</p>}
            {/* Metadata badges */}
            {(item.p || item.recurring) && (
              <div className={cn("flex flex-wrap items-center gap-1.5", compact && inlineMeta ? "mt-1.5" : "mt-3", compact && inlineMeta ? "hidden lg:flex" : "")}>
                {item.p && !hidePriority && (
                  <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tracking-[0.05em] uppercase", PRIO[item.p]?.cls)}>
                    {PRIO[item.p]?.label}
                  </span>
                )}
                {item.recurring && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-black/6 px-2 py-0.5 text-xs font-medium text-gray-400 dark:border-white/10">
                    <Repeat className="h-3 w-3" />Every weekday
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* shared filter pill (matches FilterDropdown button in filter-bar.tsx) */
function FilterPill({ icon: Icon, label, active }: { icon: typeof Filter; label: string; active?: boolean }) {
  return (
    <button type="button" className={cn(
      "flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
      active
        ? "border-black/12 bg-white text-[#25242a] dark:border-white/12 dark:bg-[#2a2a2a] dark:text-[#f5f5f5]"
        : "border-black/8 bg-transparent text-[#7d7880] hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]"
    )}>
      <Icon className="h-3 w-3" />
      <span className="max-w-[6rem] truncate">{label}</span>
      <ChevronDown className="h-3 w-3" />
    </button>
  );
}

/* ─── All page: List View (matches ListView + ListRow + ItemCard) ─── */
function AllListView() {
  const scheduled = TASKS.filter(t => t.scheduled);
  const unscheduled = TASKS.filter(t => !t.scheduled);
  return (
    <div className="space-y-8">
      <div className="grid gap-12 grid-cols-1 lg:grid-cols-2">
        {/* Scheduled */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold tracking-[0.2em] text-[#6f6a72] uppercase">Scheduled</h2>
              <span className="text-xs text-[#9f99a3]">{scheduled.length}</span>
            </div>
          </div>
          <div className="space-y-6">
            {/* Day group: Today */}
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-[0.15em] uppercase" style={{ color: "#2f855a" }}>TUESDAY, JUNE 16</h3>
              <div className="space-y-1">
                {scheduled.map(t => (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl border border-black/6 bg-white/40 hover:bg-white/70 dark:border-white/8 dark:bg-white/[0.04] dark:hover:bg-white/8">
                    <div className="flex-1 min-w-0">
                      <PreviewItemCard item={t} compact showCompactActions inlineMeta />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Unscheduled */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold tracking-[0.2em] text-[#6f6a72] uppercase">Unscheduled</h2>
              <span className="text-xs text-[#9f99a3]">{unscheduled.length}</span>
            </div>
          </div>
          <div className="space-y-1">
            {unscheduled.map(t => (
              <div key={t.id} className={cn("flex items-center gap-2 rounded-xl border border-black/6 bg-white/40 hover:bg-white/70 dark:border-white/8 dark:bg-white/[0.04] dark:hover:bg-white/8", t.done && "opacity-55")}>
                <div className="flex-1 min-w-0">
                  <PreviewItemCard item={t} compact showCompactActions inlineMeta />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── All page: Timeline View (matches SectionList + DayGroupSection + ItemCard) ─── */
function AllTimelineView() {
  const scheduled = TASKS.filter(t => t.scheduled);
  return (
    <div className="space-y-20">
      {/* Section: Today */}
      <section className="grid gap-12 pt-10 border-t border-black/6 first:border-t-0 first:pt-0 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-10">
        <aside className="space-y-3 lg:sticky lg:top-12 lg:self-start">
          <div className="relative inline-block">
            <h2 className="text-[1.6rem] leading-none font-semibold tracking-[-0.01em] text-[#2b2a30] dark:text-[#d4d4d4] lg:pt-4">Today</h2>
            <span className="absolute -top-1 -right-5 lg:top-4 text-xs font-medium text-[#9f99a3]">{scheduled.length}</span>
          </div>
        </aside>
        <div className="space-y-14">
          {/* DayGroup */}
          <section className="space-y-7">
            <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-5 gap-y-5 sm:grid-cols-[24px_minmax(0,1fr)] sm:gap-x-6">
              <div className="flex justify-center pt-[0.35rem]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#2f855a" }} />
              </div>
              <h3 className="text-sm font-semibold tracking-[0.2em] text-[#6f6a72] uppercase">TUESDAY, JUNE 16</h3>
              <div className="flex justify-center"><div className="h-full w-px bg-black/6" /></div>
              <div className="space-y-4">
                {scheduled.map(t => <PreviewItemCard key={t.id} item={t} compact={false} showCompactActions={false} inlineMeta={false} titleSize="timeline" />)}
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

/* ─── All page: Calendar View ─── */
function AllCalendarView() {
  const [mode, setMode] = useState<"month" | "week" | "day">("month");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dates = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(2026, 4, 26 + i); // May 2026 grid start
    return { date: d.getDate(), month: d.getMonth() };
  });
  const today = 16; // June 16
  const CAL_BG: Record<string, string> = { urgent: "#fef2f2", high: "#fff7ed", medium: "#eff6ff", low: "#f9fafb" };
  const CAL_DOT: Record<string, string> = { urgent: "#ef4444", high: "#f97316", medium: "#3b82f6", low: "#6b7280" };
  const calEvents: Record<number, { title: string; p: string }[]> = {
    16: [
      { title: "Team standup meeting", p: "high" },
      { title: "Review PR #142", p: "medium" },
    ],
    17: [
      { title: "Write API documentation", p: "medium" },
      { title: "1:1 with Sarah", p: "high" },
      { title: "Submit quarterly report", p: "urgent" },
    ],
    18: [
      { title: "Lunch break", p: "low" },
    ],
    20: [
      { title: "Update project roadmap", p: "medium" },
      { title: "Fix login bug", p: "high" },
    ],
  };
  const hasEvent = (d: number) => d in calEvents;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-black/8 bg-white/45 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <h2 className="truncate text-lg font-semibold text-[#25242a]">June 2026</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative grid grid-cols-3 rounded-full border border-black/8 bg-[#f4f0ec]/[0.5] dark:bg-[#2a2a2a] dark:border-white/10 p-0.5">
            <div className="absolute top-0.5 bottom-0.5 rounded-full bg-[#ffffff] shadow-sm transition-all duration-300 ease-in-out dark:bg-[#d4d4d4]" style={{ left: "2px", width: "calc((100% - 4px) / 3)" }} />
            {(["month", "week", "day"] as const).map(m => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cn("relative z-10 cursor-pointer rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors", mode === m ? "text-[#1a1a1a] dark:text-[#000]" : "text-[#7d7880] hover:text-[#5f5a63] dark:text-[#a3a3a3]")}>{m}</button>
            ))}
          </div>
          <button type="button" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-black/8 bg-white text-[#7d7880] transition-colors hover:text-[#25242a] dark:border-white/10 dark:bg-[#2a2a2a] dark:text-[#a3a3a3]"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" className="flex h-8 cursor-pointer items-center whitespace-nowrap rounded-full border border-black/8 bg-white px-3 text-xs font-medium text-[#7d7880] transition-colors hover:text-[#25242a] dark:border-white/10 dark:bg-[#2a2a2a] dark:text-[#a3a3a3]">Today</button>
          <button type="button" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-black/8 bg-white text-[#7d7880] transition-colors hover:text-[#25242a] dark:border-white/10 dark:bg-[#2a2a2a] dark:text-[#a3a3a3]"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-black/8 bg-white/55 shadow-sm">
        <div className="grid grid-cols-7 border-b border-black/8 bg-[#f4f0ec]/55">
          {days.map(d => <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold tracking-[0.14em] text-[#8c8691] uppercase">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {dates.map((c, i) => {
            const outside = c.month !== 5; // June = 5
            const isToday = c.date === today && c.month === 5;
            return (
              <section key={i} className={cn("min-h-16 sm:min-h-32 cursor-pointer border-b border-r border-black/8 p-1 sm:p-2 transition-colors", outside ? "bg-white/35" : "bg-white/70")}>
                <div className={cn("mb-1 sm:mb-2 flex h-6 w-6 sm:h-7 sm:w-7 cursor-pointer items-center justify-center rounded-full text-xs sm:text-sm font-semibold transition-colors", isToday ? "bg-[#25242a] text-white" : "text-[#5f5a63] hover:bg-black/4")}>{c.date}</div>
                {hasEvent(c.date) && c.month === 5 && (
                  <div className="hidden sm:flex sm:flex-col sm:gap-0.5">
                    {calEvents[c.date]!.map((ev, ei) => (
                      <div key={ei} className="flex items-center gap-1 rounded-lg px-2 py-1" style={{ backgroundColor: CAL_BG[ev.p] }}>
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: CAL_DOT[ev.p] }} />
                        <span className="truncate text-[11px] font-semibold text-[#333139]">{ev.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                {hasEvent(c.date) && c.month === 5 && (
                  <div className="flex sm:hidden flex-wrap gap-0.5 justify-center">
                    {calEvents[c.date]!.map((ev, ei) => (
                      <span key={ei} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: CAL_DOT[ev.p] }} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── All page: Kanban View (matches KanbanView + KanbanColumn + KanbanCard + ItemCard) ─── */
function AllKanbanView() {
  const columns: { id: string; label: string; items: Task[] }[] = [
    { id: "backlog", label: "Backlog", items: TASKS.filter(t => !t.done && !t.scheduled) },
    { id: "today", label: "Today", items: TASKS.filter(t => !t.done && t.scheduled) },
    { id: "done", label: "Done", items: TASKS.filter(t => t.done) },
  ];
  return (
    <div className="pb-2">
      <div className="grid items-start gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map(col => (
          <section key={col.id} className="flex min-w-0 flex-col rounded-2xl border border-black/6 bg-[#f4f0ec]/40 backdrop-blur-sm dark:border-white/8 dark:bg-[#1a1a1a]/60">
            <header className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-xs font-semibold tracking-[0.15em] text-[#525059] uppercase dark:text-[#a3a3a3]">{col.label}</h3>
                <span className="text-xs font-medium text-[#9f99a3]">{col.items.length}</span>
              </div>
            </header>
            <div className="space-y-2 px-2 pt-2 pb-2">
              {col.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-black/8 bg-white/30 px-3 py-6 text-center dark:border-white/8 dark:bg-white/[0.02]">
                  <p className="text-xs text-[#9f99a3]">No tasks</p>
                </div>
              ) : col.items.map(t => (
                /* KanbanCard wrapper (matches kanban-card.tsx) */
                <div key={t.id} className="group relative cursor-grab rounded-xl border border-black/6 bg-white/70 p-1 transition-colors active:cursor-grabbing hover:bg-white dark:border-white/8 dark:bg-white/[0.04] dark:hover:bg-white/[0.06]">
                  <PreviewItemCard item={t} compact showCompactActions inlineMeta />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/* ─── All page: Table View ─── */
function AllTableView() {
  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[#7d7880] dark:text-[#a3a3a3]">{TASKS.length} tasks</span>
        <button type="button" className="flex cursor-pointer items-center gap-1.5 rounded-full border border-black/8 bg-[#25242a] px-3 py-1.5 text-xs font-medium tracking-wide text-white transition-colors hover:bg-[#3a3940] dark:bg-white dark:text-[#101010] dark:hover:bg-[#e0e0e0]">
          <Plus className="h-3.5 w-3.5" />New task
        </button>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-black/8 bg-white/40 dark:border-white/8 dark:bg-white/[0.04]">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[#f4f0ec]/95 dark:bg-[#1e1e1e]/90 backdrop-blur-sm">
            <tr className="border-b border-black/8 dark:border-white/10">
              {["", "Title", "Start", "Project", "Tags", "Priority", ""].map((h, i) => (
                <th key={i} className={cn("px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#7d7880] dark:text-[#a3a3a3] whitespace-nowrap text-left", i === 0 && "w-8", i === 5 && "w-20 text-center", i === 6 && "w-12")}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TASKS.map(t => (
              <tr key={t.id} className={cn("border-b border-black/4 transition-colors hover:bg-black/[0.02] dark:border-white/6 dark:hover:bg-white/[0.04]", t.done && "opacity-55")}>
                <td className="px-3 py-2 text-center">
                  {t.done ? <CheckCircle className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4 text-[#b0a9b2] dark:text-[#6a6570]" />}
                </td>
                <td className="px-3 py-2">
                  <p className={cn("text-sm font-medium text-[#25242a] dark:text-[#f5f5f5]", t.done && "line-through")}>{t.title}</p>
                </td>
                <td className="px-3 py-2 text-xs text-[#7d7880] tabular-nums dark:text-[#a3a3a3] whitespace-nowrap">{t.time || "—"}</td>
                <td className="px-3 py-2">
                  {t.project && <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.projColor }} />{t.project}</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">{t.tags.map(tag => <span key={tag} className="rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[10px] text-[#7d7880] dark:bg-white/[0.06] dark:text-[#a3a3a3]">#{tag}</span>)}</div>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PRIO[t.p]?.textColor ?? "#a3a3a3" }} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="h-6 w-6 inline-flex items-center justify-center rounded-full text-[#9f99a3] hover:bg-black/5 hover:text-[#525059] dark:hover:bg-white/8"><MoreHorizontal className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── All Page: Main ─── */
function AllPageView({ dark }: { dark: boolean }) {
  const [view, setView] = useState<AllView>("list");
  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const current = VIEW_OPTIONS.find(v => v.key === view)!;

  useEffect(() => {
    if (!dropOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropOpen]);

  return (
    <div className="px-4 py-8 sm:px-14 lg:py-12 lg:pr-14 lg:pl-14">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 min-w-0">
        {/* ── Header row: view dropdown + search ── */}
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 px-2 lg:px-3">
          <div className="flex items-center gap-2">
            {/* View dropdown */}
            <div className="relative" ref={dropRef}>
              <button type="button" onClick={() => setDropOpen(o => !o)} className="flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-black/8 dark:border-white/10 bg-[#f4f0ec]/[0.5] dark:bg-[#2a2a2a] px-4 text-xs font-medium tracking-wide text-[#525059] dark:text-[#d4d4d4] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                <current.icon className="h-3.5 w-3.5" />
                {current.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", dropOpen && "rotate-180")} />
              </button>
              {dropOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-2xl border border-black/8 dark:border-white/10 bg-white dark:bg-[#202020] p-1.5 shadow-[0_20px_45px_rgba(28,24,35,0.10)] dark:shadow-[0_20px_45px_rgba(0,0,0,0.45)]">
                  <div className="space-y-0.5">
                    {VIEW_OPTIONS.map(opt => (
                      <button key={opt.key} type="button" onClick={() => { setView(opt.key); setDropOpen(false); }}
                        className={cn("flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                          view === opt.key ? "bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]" : "text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                        )}>
                        <opt.icon className="h-3.5 w-3.5" />{opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="my-1 border-t border-black/8 dark:border-white/10" />
                  <div className="space-y-0.5">
                    <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors bg-black/[0.06] dark:bg-white/[0.08] text-[#1a1a1a] dark:text-[#f5f5f5]">
                      <Maximize2 className="h-3.5 w-3.5" />Default
                    </button>
                    <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-[#525059] dark:text-[#d4d4d4] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                      <Minimize2 className="h-3.5 w-3.5" />Compact
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Search (matches AllPageSearch) */}
          <div className="relative w-full max-w-80 min-w-[140px] hidden lg:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9b95a0]" />
            <input type="text" placeholder="Search" readOnly className="h-9 w-full rounded-full border border-black/8 bg-[#f4f0ec]/60 pl-9 pr-8 text-sm text-[#25242a] placeholder:text-[#9b95a0] dark:border-white/10 dark:bg-[#2a2a2a] dark:text-[#f5f5f5] dark:placeholder:text-[#7a7a7a]" />
          </div>
        </div>
        {/* ── Filter bar (matches FilterBar desktop inline) ── */}
        <div className="px-2 lg:px-3 -mt-2 -mb-2">
          <div className="hidden lg:flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-[#9f99a3]" />
              <FilterPill icon={Folder} label="Project" />
              {view !== "calendar" && view !== "kanban" && <FilterPill icon={Clock} label="Time" />}
              <FilterPill icon={Tag} label="Tags" />
              {view !== "kanban" && <FilterPill icon={CheckCircle} label="Status" />}
              <FilterPill icon={Flag} label="Priority" />
            </div>
            {(view === "list" || view === "kanban") && (
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5 text-[#9f99a3]" />
                <FilterPill icon={view === "list" ? Clock : Flag} label={view === "list" ? "Date" : "Priority"} />
              </div>
            )}
          </div>
        </div>
        {/* ── View content ── */}
        <div className="px-2 lg:px-3">
          {view === "list" && <AllListView />}
          {view === "timeline" && <AllTimelineView />}
          {view === "calendar" && <AllCalendarView />}
          {view === "kanban" && <AllKanbanView />}
          {view === "table" && <AllTableView />}
        </div>
      </div>
    </div>
  );
}

/* ─── Focus Page ─── */
function FocusPageView({ dark }: { dark: boolean }) {
  return (
    <div className="px-4 py-8 sm:px-14 lg:px-14 lg:py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-1 w-full flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-16">
          {/* Left: timer */}
          <div className="flex flex-col items-center gap-6 w-full max-w-xs sm:max-w-none sm:min-w-[480px] lg:min-w-[520px]">
            {/* TimerModeSelector */}
            <PillToggle options={["Countdown", "Stopwatch"]} active={0} onChange={() => {}} dark={dark} />
            {/* FocusTimer */}
            <div className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/10">
              <div className="absolute inset-0 bg-white/75 dark:bg-black/60" />
              <span className="relative z-10 font-sans text-8xl font-light tracking-tight tabular-nums text-[#25242a]/60 dark:text-[#e8e6ea]/60">25:00</span>
            </div>
            {/* QuickPresets */}
            <div className="flex items-center gap-2">
              {[15, 25, 45, 60].map(m => (
                <button key={m} type="button"
                  className={cn(
                    "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    m === 25
                      ? "bg-[#25242a] text-white dark:bg-[#e8e6ea] dark:text-[#25242a]"
                      : "border border-black/8 dark:border-white/15 text-[#7d7880] dark:text-[#a9a4ae] hover:bg-black/[0.035] dark:hover:bg-white/[0.06]"
                  )}>{m}m</button>
              ))}
            </div>
            {/* TimerControls */}
            <div className="flex items-center gap-3">
              <button type="button" className="cursor-pointer rounded-full bg-[#25242a] dark:bg-[#e8e6ea] px-8 py-2.5 text-sm font-medium text-white dark:text-[#25242a] transition-all hover:bg-[#25242a]/90 dark:hover:bg-[#e8e6ea]/90 active:scale-95">
                Start
              </button>
              <button type="button" className={cn("cursor-pointer rounded-full p-2 transition-all active:scale-90 text-[#25242a] dark:text-[#e8e6ea] hover:bg-black/[0.035] dark:hover:bg-white/[0.06]")}>
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Right: task selector */}
          <div className="flex w-full flex-col gap-6 sm:w-96 sm:max-w-96 lg:pt-10">
            <div className="rounded-2xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-[#181818]">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-[#8c8691] dark:text-[#737373] uppercase mb-3">Select a task</p>
              <div className="space-y-1">
                {["Write API docs", "Team standup meeting", "Review PR #142"].map(n => (
                  <div key={n} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] cursor-pointer hover:bg-black/[0.025] dark:hover:bg-white/[0.04] transition-colors">
                    <Circle className="h-4 w-4 shrink-0 text-[#b0a9b2] dark:text-[#6a6570]" />
                    <span className="truncate text-[#25242a] dark:text-[#f5f5f5]">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Bottom: Statistics */}
        <FocusPreviewStats />
      </div>
    </div>
  );
}

/* ─── Focus Preview: Static Statistics ─── */
function FocusPreviewStats() {
  const stats = [
    { label: "Total Focus", value: "2h 15m" },
    { label: "Sessions", value: "3/4" },
    { label: "Average", value: "34m" },
    { label: "Efficiency", value: "85%" },
    { label: "Longest", value: "52m" },
    { label: "Streak", value: "5d" },
  ];
  const hourlyData = [0, 15, 0, 0, 0, 30, 45, 20, 0, 10, 0, 0, 25, 35, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const maxMinutes = Math.max(...hourlyData, 1);
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div className="rounded-2xl border border-black/8 dark:border-white/10 bg-white/75 dark:bg-white/[0.06] overflow-hidden">
      <div className="px-4 pt-3 pb-4 space-y-4">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#8c8691] dark:text-[#a09ba5] uppercase">
          Statistics
        </p>

        <div className="relative flex gap-1 p-1 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl">
          <div
            className="absolute top-1 bottom-1 rounded-lg bg-white shadow-sm dark:bg-[#3a3840]"
            style={{ left: "calc(4px + 0 * ((100% - 24px) / 5 + 4px))", width: "calc((100% - 24px) / 5)" }}
          />
          {["Today", "Week", "Month", "Year", "All"].map((label, i) => (
            <span
              key={label}
              className={`relative z-10 flex flex-1 items-center justify-center py-1.5 text-xs font-medium ${
                i === 0 ? "text-[#25242a] dark:text-[#e8e6ea]" : "text-[#7d7880] dark:text-[#a9a4ae]"
              }`}
            >
              {label}
            </span>
          ))}
        </div>

        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8c8691] dark:text-[#a09ba5] uppercase mb-2">Overview</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-x-2 gap-y-4 md:gap-y-2">
            {stats.map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8c8691] dark:text-[#a09ba5] uppercase">{label}</p>
                <p className="mt-1 text-lg font-semibold text-[#25242a] dark:text-[#e8e6ea] tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-black/6 dark:border-white/10 pt-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8c8691] dark:text-[#a09ba5] uppercase mb-2">Hourly Distribution</p>
          <div className="space-y-1">
            <div className="relative" style={{ height: "80px" }}>
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {ticks.map((tick) => (
                  <div key={tick} className="w-full border-t border-black/6 dark:border-white/10" />
                ))}
              </div>
              <div className="relative flex items-end gap-px h-full">
                {hourlyData.map((minutes, hour) => {
                  const heightPercent = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
                  return (
                    <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full">
                      {minutes > 0 && (
                        <span className="text-[9px] text-[#7d7880] dark:text-[#a9a4ae] tabular-nums mb-0.5">{minutes}</span>
                      )}
                      <div
                        className="w-full rounded-t-sm bg-[#25242a]/80 dark:bg-[#e8e6ea]/70"
                        style={{ height: `${Math.max(heightPercent, minutes > 0 ? 8 : 0)}%`, minHeight: minutes > 0 ? "2px" : "0" }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-px">
              {hourlyData.map((_, hour) => (
                <div key={hour} className="flex-1 text-center">
                  <span className="text-[8px] text-[#8c8691] dark:text-[#a09ba5] tabular-nums leading-none">
                    {hour % 3 === 0 ? (hour === 0 ? "12a" : hour < 12 ? `${hour}a` : hour === 12 ? "12p" : `${hour - 12}p`) : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Progress Page ─── */
const PROG = [
  { id: "1", name: "Q2 OKR — Ship v2.0", desc: "Launch the new platform with core features", pct: 72, total: "18 / 25 tasks", color: "#f97316", mode: "Count", completed: 18, boundTaskCount: 25 },
  { id: "2", name: "Read 12 books", desc: "Personal reading goal for the year", pct: 42, total: "5 / 12 books", color: "#3b82f6", mode: "Manual", completed: 5, boundTaskCount: 12 },
  { id: "3", name: "Weekly exercise goal", desc: "5 sessions per week", pct: 80, total: "4 / 5 sessions", color: "#10b981", mode: "Count", completed: 4, boundTaskCount: 5 },
];

function ProgressPageView({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="px-4 py-8 sm:px-14 lg:px-14 lg:py-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        {/* Header */}
        <header className="flex items-center gap-1.5 px-2 lg:px-3">
          <button type="button" className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-black/8 bg-transparent px-2.5 text-[11px] font-medium text-[#7d7880] transition-colors hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]">
            <Eye className="h-3 w-3" />
            <span>Hide completed</span>
          </button>
          <div className="flex-1" />
          <button type="button" className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-black/8 bg-transparent px-2.5 text-[11px] font-medium text-[#7d7880] transition-colors hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]">
            <Plus className="h-3 w-3" />
            <span>New Progress</span>
          </button>
        </header>
        {/* Progress cards */}
        <ul className="flex flex-col gap-3 px-2 lg:px-3">
          {PROG.map(p => (
            <li key={p.id}>
              <div onClick={() => onOpen(p.id)} className="group relative flex cursor-pointer items-stretch gap-4 overflow-hidden rounded-2xl border border-black/8 bg-white/70 p-5 text-left shadow-sm transition-all hover:border-black/15 hover:bg-white/90 sm:gap-6 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/20 dark:hover:bg-white/[0.06]">
                <div aria-hidden="true" className="self-center h-10 w-1 shrink-0 rounded-full sm:h-12" style={{ backgroundColor: p.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1">
                    <h3 className="truncate font-display text-lg font-medium text-[#25242a] dark:text-[#f5f5f5]">{p.name}</h3>
                    <p className="line-clamp-1 text-xs text-[#7d7880] dark:text-[#a3a3a3]">{p.desc}</p>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="group/bar relative w-full overflow-visible rounded-full bg-black/5 dark:bg-white/10 h-1.5">
                      <div className="h-full rounded-full" style={{ width: `${p.pct}%`, backgroundColor: p.color }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#9f99a3] dark:text-[#737373]">
                      <span>{p.total}</span>
                    </div>
                  </div>
                </div>
                <div className="hidden shrink-0 items-center text-right sm:flex">
                  <span className="text-[11px] text-[#9f99a3] dark:text-[#737373]">{p.mode}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                  <button type="button" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/[0.05] hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:bg-white/8 dark:hover:text-[#f5f5f5]">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-red-50 hover:text-red-500 dark:text-[#a3a3a3] dark:hover:bg-red-500/15 dark:hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── Progress Detail Preview ─── */
const BOUND_TASKS = [
  { id: "t1", title: "Design new landing page", priority: "high" as const, done: false },
  { id: "t2", title: "Implement auth flow", priority: "urgent" as const, done: true },
  { id: "t3", title: "Write API documentation", priority: "medium" as const, done: false },
  { id: "t4", title: "Set up CI/CD pipeline", priority: "medium" as const, done: true },
  { id: "t5", title: "User testing sessions", priority: "high" as const, done: false },
];

const PRIO_DETAIL: Record<string, { color: string; label: string }> = {
  urgent: { color: "#dc2626", label: "Urgent" },
  high: { color: "#ea580c", label: "High" },
  medium: { color: "#2563eb", label: "Medium" },
  low: { color: "#6b7280", label: "Low" },
};

function ProgressDetailPreview({ progressId, onBack }: { progressId: string; onBack: () => void }) {
  const prog = PROG.find(p => p.id === progressId) ?? PROG[0];
  const [showCompleted, setShowCompleted] = useState(true);
  const visibleTasks = showCompleted ? BOUND_TASKS : BOUND_TASKS.filter(t => !t.done);

  return (
    <div className="px-4 py-8 sm:px-14 lg:px-14 lg:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        {/* Back button */}
        <button type="button" onClick={onBack} className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-[#7d7880] transition-colors hover:text-[#25242a] dark:text-[#a3a3a3] dark:hover:text-[#f5f5f5]">
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Back to Progress</span>
        </button>

        {/* Overview card */}
        <div className="overflow-hidden rounded-2xl border border-black/8 bg-white/70 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="space-y-5 px-6 py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-[#9f99a3] uppercase">OVERVIEW</p>
                <h1 className="mt-1 truncate font-display text-2xl font-semibold text-[#25242a] dark:text-[#f5f5f5]">{prog.name}</h1>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="flex h-7 cursor-pointer items-center rounded-full px-2 text-xs font-medium text-[#7d7880] transition-colors hover:bg-black/[0.04] dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]">Edit</button>
                <button type="button" className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/15">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
            {prog.desc && <p className="text-sm text-[#7d7880] dark:text-[#a3a3a3]">{prog.desc}</p>}
            <div className="space-y-1.5">
              <div className="relative w-full overflow-visible rounded-full bg-black/5 dark:bg-white/10 h-2">
                <div className="h-full rounded-full" style={{ width: `${prog.pct}%`, backgroundColor: prog.color }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#9f99a3] dark:text-[#737373]">
                <span>{prog.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bound Tasks section */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-[#25242a] dark:text-[#f5f5f5]">Bound Tasks</h2>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setShowCompleted(v => !v)}
                className={`flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors ${showCompleted ? "border-black/8 bg-transparent text-[#7d7880] hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]" : "border-black/12 bg-white text-[#25242a] dark:border-white/12 dark:bg-[#2a2a2a] dark:text-[#f5f5f5]"}`}>
                {showCompleted ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                <span>{showCompleted ? "Hide completed" : "Show completed"}</span>
              </button>
              <button type="button" className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-black/8 bg-transparent px-2.5 text-[11px] font-medium text-[#7d7880] transition-colors hover:bg-black/[0.04] dark:border-white/8 dark:text-[#a3a3a3] dark:hover:bg-white/[0.06]">
                <Plus className="h-3 w-3" />
                <span>Add Task</span>
              </button>
            </div>
          </div>
          <ul className="flex flex-col gap-1">
            {visibleTasks.map(task => {
              const prio = PRIO_DETAIL[task.priority] ?? PRIO_DETAIL.medium;
              return (
                <li key={task.id} className={`flex items-center gap-3 rounded-xl border border-black/6 bg-white/40 px-4 py-3 dark:border-white/8 dark:bg-white/[0.04] ${task.done ? "opacity-55" : ""}`}>
                  <button type="button" className="shrink-0">
                    {task.done
                      ? <CheckCircle className="h-4 w-4 text-emerald-500" />
                      : <Circle className="h-4 w-4 text-[#b0a9b2] dark:text-[#6a6570]" />}
                  </button>
                  <span className={`flex-1 text-sm font-medium ${task.done ? "line-through text-[#b0a9b2]" : "text-[#25242a] dark:text-[#f5f5f5]"}`}>{task.title}</span>
                  <span className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.05em] uppercase" style={{ borderColor: prio.color + "40", backgroundColor: prio.color + "15", color: prio.color }}>{prio.label}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

/* ─── Main Export ─── */
export function InteractivePreview({ dark }: { dark: boolean }) {
  const [active, setActive] = useState<PageId>("digest");
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [progressDetailId, setProgressDetailId] = useState<string | null>(null);
  const bg = "bg-[#fcfbfa] dark:bg-[#101010]";

  return (
    <div className={cn("relative flex h-[680px] w-full overflow-hidden rounded-2xl border border-black/[0.06] shadow-[0_8px_40px_rgba(0,0,0,0.06)] dark:border-white/[0.06] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)]", bg)}>
      {/* Mobile backdrop overlay — within container */}
      <div
        className={`absolute inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-200 sm:hidden ${isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"}`}
        onClick={() => setIsCollapsed(true)}
      />
      {/* Mobile top header bar with toggle — within container */}
      <div className="absolute inset-x-0 top-0 z-30 h-16 flex items-end pb-2 px-3 sm:hidden">
        <div className={`absolute inset-y-0 left-0 bg-sidebar transition-[width] duration-200 ease-in-out ${isCollapsed ? "w-0" : "w-72"}`} />
        <div className={`absolute inset-y-0 right-0 left-0 bg-linear-to-b from-[#fcfbfa] via-[#fcfbfa]/72 to-[#fcfbfa]/0 dark:from-[#101010] dark:via-[#101010]/72 dark:to-[#101010]/0 transition-opacity duration-200 ease-in-out ${isCollapsed ? "opacity-100" : "opacity-0 pointer-events-none"}`} />
        <button type="button" onClick={() => setIsCollapsed(c => !c)}
          className="relative z-40 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-black transition-colors hover:bg-black/[0.035] dark:text-[#f5f5f5] dark:hover:bg-white/8">
          <ToggleIcon isCollapsed={isCollapsed} />
        </button>
      </div>
      <Sidebar active={active} onChange={(p) => { setActive(p); setProgressDetailId(null); }} dark={dark} isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(c => !c)} />
      <div className={cn("flex-1 overflow-y-auto", bg)}>
        <div className="sm:hidden h-16" />
        {(active === "timeline" || active === "digest") && <TodayPage dark={dark} />}
        {active === "all" && <AllPageView dark={dark} />}
        {active === "focus" && <FocusPageView dark={dark} />}
        {active === "progress" && !progressDetailId && <ProgressPageView onOpen={setProgressDetailId} />}
        {active === "progress" && progressDetailId && <ProgressDetailPreview progressId={progressDetailId} onBack={() => setProgressDetailId(null)} />}
      </div>
    </div>
  );
}
