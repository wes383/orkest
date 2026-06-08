import dayjs from "dayjs";
import type { Priority } from "./types/item";

export interface ParsedQuickAdd {
  title: string;
  startDate?: string;   // YYYY-MM-DD
  startTime?: string;   // HH:mm
  endDate?: string;     // YYYY-MM-DD
  endTime?: string;     // HH:mm
  hasTime?: boolean;
  allDay?: boolean;
  priority?: Priority;
  tags?: string[];
  projectName?: string;
  estimateMinutes?: number;
}

// --- Weekday maps (all 7 locales) ---

const WEEKDAY_MAP: Record<string, number> = {
  // Chinese
  "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0,
  // English
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 0,
  mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0,
  // Spanish
  lunes: 1, martes: 2, miércoles: 3, miercoles: 3, jueves: 4, viernes: 5, sábado: 6, sabado: 6, domingo: 0,
  // French
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
  // German
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonntag: 0,
  mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, so: 0,
  // Japanese
  月: 1, 火: 2, 水: 3, 木: 4, 金: 5, 土: 6, 日: 0,
  // Portuguese
  segunda: 1, terça: 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, sábado: 6, sabado: 6, domingo: 0,
  seg: 1, ter: 2, qua: 3, qui: 4, sex: 5,
};

// --- Priority maps (all 7 locales) ---

const PRIORITY_MAP: Record<string, Priority> = {
  // Chinese
  "紧急": "urgent", "高": "high", "中": "medium", "低": "low",
  // English
  urgent: "urgent", high: "high", medium: "medium", low: "low",
  // Spanish
  urgente: "urgent", alta: "high", media: "medium", baja: "low",
  // French
  haute: "high", moyenne: "medium", basse: "low",
  // German
  dringend: "urgent", hoch: "high", mittel: "medium", niedrig: "low",
  // Japanese
  "緊急": "urgent",
  // Portuguese
  alta: "high", média: "medium", media: "medium", baixa: "low",
  // Universal shorthand
  p1: "urgent", p2: "high", p3: "medium", p4: "low",
};

// --- Relative date keywords ---

const RELATIVE_DATES: Record<string, number> = {
  // Chinese
  "今天": 0, "明天": 1, "后天": 2, "大后天": 3,
  // English
  today: 0, tomorrow: 1,
  // Spanish
  hoy: 0, mañana: 1,
  // French
  "aujourd'hui": 0, demain: 1,
  // German
  heute: 0, morgen: 1, "übermorgen": 2, uebermorgen: 2,
  // Japanese
  "今日": 0, "きょう": 0, "明日": 1, "あした": 1, "あす": 1, "明後日": 2, "あさって": 2,
  // Portuguese
  hoje: 0, amanhã: 1, amanha: 1,
};

// --- Duration unit maps ---

const MINUTE_UNITS = ["min", "mins", "minute", "minutes", "分钟", "分", "minuto", "minutos", "minute", "minuten", "Minuten"];
const HOUR_UNITS = ["h", "hr", "hrs", "hour", "hours", "小时", "時", "hora", "horas", "heure", "heures", "Stunde", "Stunden"];

function parseWeekday(str: string): number | null {
  // Try progressively stripped versions of the input
  let key = str.toLowerCase();
  // Strip prefix characters (下/上/这/這/来/來/今/先)
  key = key.replace(/^[下上这這来來今先]/, "");
  // Strip week characters (周/星期/礼拜/週)
  key = key.replace(/^(周|星期|礼拜|週)/, "");
  // Strip 曜(日) suffix
  key = key.replace(/曜(日)?$/, "");
  // Strip trailing dot
  key = key.replace(/\.$/, "");
  // Direct lookup
  if (WEEKDAY_MAP[key] !== undefined) return WEEKDAY_MAP[key];
  // Try without stripping prefix (for direct weekday names like "lundi", "montag")
  const lower = str.toLowerCase().replace(/曜(日)?$/, "").replace(/\.$/, "");
  return WEEKDAY_MAP[lower] ?? null;
}

const CN_NUM: Record<string, number> = {
  "零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5,
  "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
  "十一": 11, "十二": 12, "十三": 13, "十四": 14, "十五": 15,
  "十六": 16, "十七": 17, "十八": 18, "十九": 19, "二十": 20,
  "二十一": 21, "二十二": 22, "二十三": 23, "二十四": 24, "二十五": 25,
  "二十六": 26, "二十七": 27, "二十八": 28, "二十九": 29, "三十": 30,
  "三十一": 31, "四十五": 45, "半": 30,
};

function cnToNum(str: string): number | null {
  // Try Chinese number first
  if (CN_NUM[str] !== undefined) return CN_NUM[str];
  // Try Arabic number
  const n = parseInt(str, 10);
  return isNaN(n) ? null : n;
}

function parseChineseTime(str: string, defaultPeriod?: string): { hours: number; minutes: number } | null {
  // 下午3点半, 上午十点, 四点, 午後3時, 三点半
  const m = str.match(/(上午|下午|早上|晚上|凌晨|午前|午後)?\s*(\d{1,2}|[零一二两三四五六七八九十]+)[点時:](\d{1,2}|[零一二两三四五六七八九十]+)?[分]?半?/);
  if (!m) return null;
  const hours = cnToNum(m[2]);
  if (hours === null) return null;
  let minutes = m[3] ? (cnToNum(m[3]) ?? 0) : 0;
  if (str.includes("半")) minutes = 30;
  const period = m[1] || defaultPeriod;
  let h = hours;
  if (period === "下午" || period === "晚上" || period === "午後") {
    if (h < 12) h += 12;
  } else if (period === "上午" || period === "早上" || period === "凌晨" || period === "午前") {
    if (h === 12) h = 0;
  }
  return { hours: h, minutes };
}

function parseEnglishTime(str: string): { hours: number; minutes: number } | null {
  // 3pm, 3:30pm, 15:00, 1500
  let m = str.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (m) {
    let hours = parseInt(m[1], 10);
    const minutes = parseInt(m[2], 10);
    const period = m[3]?.toLowerCase();
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return { hours, minutes };
  }
  m = str.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (m) {
    let hours = parseInt(m[1], 10);
    const period = m[2].toLowerCase();
    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;
    return { hours, minutes: 0 };
  }
  m = str.match(/^(\d{3,4})$/);
  if (m) {
    const raw = m[1].padStart(4, "0");
    const hours = parseInt(raw.slice(0, 2), 10);
    const minutes = parseInt(raw.slice(2), 10);
    if (hours < 24 && minutes < 60) return { hours, minutes };
  }
  return null;
}

function parseFrenchTime(str: string): { hours: number; minutes: number } | null {
  // 15h, 15h30, 15 h 30
  const m = str.match(/(\d{1,2})\s*h\s*(\d{1,2})?/i);
  if (!m) return null;
  const hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  if (hours < 24 && minutes < 60) return { hours, minutes };
  return null;
}

function parseGermanTime(str: string): { hours: number; minutes: number } | null {
  // 15 Uhr, 15:30 Uhr
  const m = str.match(/(\d{1,2})(?::(\d{2}))?\s*Uhr/i);
  if (!m) return null;
  const hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  if (hours < 24 && minutes < 60) return { hours, minutes };
  return null;
}

function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildDurationRegex(): RegExp {
  const minPattern = MINUTE_UNITS.join("|");
  // "h" needs negative lookahead to avoid matching "15h-17h" time ranges
  const hourPattern = HOUR_UNITS.map(u => u === "h" ? "h(?!\\s*(?:[-–—到至]|to|à|bis)\\s*\\d)" : u).join("|");
  return new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${minPattern}|${hourPattern})`, "gi");
}

function isHourUnit(unit: string): boolean {
  return HOUR_UNITS.includes(unit.toLowerCase());
}

export function parseNaturalLanguage(input: string): ParsedQuickAdd {
  let remaining = input.trim();
  let startDate: string | undefined;
  let startTime: string | undefined;
  let endDate: string | undefined;
  let endTime: string | undefined;
  let hasTime = false;
  let priority: Priority | undefined;
  const tags: string[] = [];
  let projectName: string | undefined;
  let estimateMinutes: number | undefined;

  const today = dayjs();

  // Extract #tags
  remaining = remaining.replace(/#(\S+)/g, (_match, tag) => {
    tags.push(tag);
    return "";
  });

  // Extract >project
  remaining = remaining.replace(/>(\S+)/g, (_match, proj) => {
    projectName = proj;
    return "";
  });

  // Extract priority: !紧急, !high, !urgente, p1~p4
  remaining = remaining.replace(/!(\S+)/g, (_match, p) => {
    const mapped = PRIORITY_MAP[p.toLowerCase()];
    if (mapped) priority = mapped;
    return "";
  });
  remaining = remaining.replace(/\b(p[1-4])\b/gi, (_match, p) => {
    const mapped = PRIORITY_MAP[p.toLowerCase()];
    if (mapped) priority = mapped;
    return "";
  });

  // --- Time parsing (range-aware, runs BEFORE duration to avoid "15h" being consumed) ---
  // Extract relative dates: 明天, tomorrow, mañana, demain, morgen, 明日, amanhã
  // First try datetime range: "明天7点到下周五9点", "today 3pm to tomorrow 5pm"
  // Strategy: find all "date + time" pairs, check separator between them
  const relDateNames = Object.keys(RELATIVE_DATES).sort((a, b) => b.length - a.length).join("|");
  const cjkWeekdayRe = /(?:下|上|这|這|来|來|今|先)?(?:周|星期|礼拜|週)[一二三四五六日天五]/g;
  const relDateRe = new RegExp(relDateNames, "gi");

  const resolveDateToken = (d: string): string | undefined => {
    const off = RELATIVE_DATES[d.toLowerCase()] ?? RELATIVE_DATES[d];
    if (off !== undefined) return today.add(off, "day").format("YYYY-MM-DD");
    // Strip Latin prefix before parseWeekday (which only handles CJK prefixes)
    const stripped = d.replace(/^(?:next|last|próximo|próxima|nächste\w?|letzte\w?|prossim[oa]|prochain|prochaine|dernier|derniere|scors[oa]|passad[oa]|est[ae]|diese\w?|quest[oa]|seguinte|atual)\s+/i, "");
    const wd = parseWeekday(stripped);
    if (wd === null) return undefined;
    let weekOffset = 0;
    if (/^下|来|來/.test(d)) weekOffset = 1;
    else if (/^上|先/.test(d)) weekOffset = -1;
    else if (/next|^próxim|^nächste|^prossim|^prochain|^seguinte/i.test(d)) weekOffset = 1;
    else if (/^last|pasad|^letzte|^scors|^derni|^passad|anterior/i.test(d)) weekOffset = -1;
    let diff = wd - today.day();
    if (diff <= 0) diff += 7;
    return today.add(diff + weekOffset * 7, "day").format("YYYY-MM-DD");
  };

  const resolveTimeToken = (t: string): { hours: number; minutes: number } | null => {
    return parseChineseTime(t) || parseEnglishTime(t) || parseFrenchTime(t) || parseGermanTime(t);
  };

  // Find all date tokens with their positions
  const findDateTokens = (text: string): Array<{ match: string; index: number }> => {
    const results: Array<{ match: string; index: number }> = [];
    // CJK weekdays with optional prefix (including Japanese weekday kanji)
    let m: RegExpExecArray | null;
    const cjkRe = /(?:下|上|这|這|来|來|今|先)?(?:周|星期|礼拜|週)[一二三四五六日天五]|(?:下|上|这|這|来|來|今|先)?(?:週|周)[月火水木金土日](?:曜)?(?:日)?|[月火水木金土日]曜(?:日)?/g;
    while ((m = cjkRe.exec(text)) !== null) results.push({ match: m[0], index: m.index });
    // Relative dates
    const relRe = new RegExp(relDateNames, "gi");
    while ((m = relRe.exec(text)) !== null) results.push({ match: m[0], index: m.index });
    // Latin weekdays with optional prefix (simple approach: check common patterns)
    const latinRe = /(?:(?:next|last|próximo|próxima|nächste\w?|letzte\w?|prossim[oa]|prochain|prochaine|dernier|derniere|scors[oa]|passad[oa]|est[ae]|diese\w?|quest[oa]|seguinte|atual)\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|lunes|martes|mi.rcoles|jueves|viernes|s.bado|domingo|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|segunda|ter.a|quarta|quinta|sexta)\.?(?:\s+(?:prochain|prochaine|dernier|derniere|prossimo|prossima|scorso|scorsa))?/gi;
    while ((m = latinRe.exec(text)) !== null) results.push({ match: m[0].trim(), index: m.index });
    return results.sort((a, b) => a.index - b.index);
  };

  // Find all time tokens with their positions
  const findTimeTokens = (text: string): Array<{ match: string; index: number }> => {
    const results: Array<{ match: string; index: number }> = [];
    let m: RegExpExecArray | null;
    // Chinese time
    const cnRe = /(上午|下午|早上|晚上|凌晨|午前|午後)?\s*(\d{1,2}|[零一二两三四五六七八九十]+)[点時:](\d{1,2}|[零一二两三四五六七八九十]+)?[分]?半?/g;
    while ((m = cnRe.exec(text)) !== null) results.push({ match: m[0], index: m.index });
    // English am/pm
    const enRe = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi;
    while ((m = enRe.exec(text)) !== null) results.push({ match: m[0], index: m.index });
    // French 15h
    const frRe = /(?<!\.)\d{1,2}\s*h\s*\d{0,2}/gi;
    while ((m = frRe.exec(text)) !== null) results.push({ match: m[0], index: m.index });
    // German 15 Uhr
    const deRe = /\d{1,2}(?::\d{2})?\s*Uhr/gi;
    while ((m = deRe.exec(text)) !== null) results.push({ match: m[0], index: m.index });
    // 24h 15:00
    const h24Re = /\b\d{1,2}:\d{2}\b/g;
    while ((m = h24Re.exec(text)) !== null) results.push({ match: m[0], index: m.index });
    return results.sort((a, b) => a.index - b.index);
  };

  const dtSepRe = /\s*(?:到|至|~|—|–|-|から|to|à|bis)\s*/i;

  // Try to find a datetime range: date1 time1 sep date2 time2
  const dateTokens = findDateTokens(remaining);
  const timeTokens = findTimeTokens(remaining);

  if (dateTokens.length >= 2 && timeTokens.length >= 2) {
    // Check if date1 < sep < date2 and time1 near date1 and time2 near date2
    for (let i = 0; i < dateTokens.length; i++) {
      for (let j = i + 1; j < dateTokens.length; j++) {
        const d1 = dateTokens[i];
        const d2 = dateTokens[j];
        // Find time tokens right after each date
        const t1 = timeTokens.find(t => t.index >= d1.index && t.index <= d1.index + d1.match.length + 3 && t.index > d1.index);
        const t2 = timeTokens.find(t => t.index >= d2.index && t.index <= d2.index + d2.match.length + 3 && t.index > d2.index);
        if (!t1 || !t2) continue;
        // Check separator between date1+time1 and date2+time2
        const afterT1 = t1.index + t1.match.length;
        const beforeD2 = d2.index;
        const between = remaining.slice(afterT1, beforeD2);
        if (dtSepRe.test(between)) {
          const sd = resolveDateToken(d1.match);
          const ed = resolveDateToken(d2.match);
          const st = resolveTimeToken(t1.match);
          const et = resolveTimeToken(t2.match);
          if (sd && ed && st && et) {
            startDate = sd;
            endDate = ed;
            startTime = formatTime(st.hours, st.minutes);
            endTime = formatTime(et.hours, et.minutes);
            hasTime = true;
            // Remove matched range from remaining
            const removeStart = d1.index;
            const removeEnd = t2.index + t2.match.length;
            remaining = remaining.slice(0, removeStart) + remaining.slice(removeEnd);
            break;
          }
        }
      }
      if (startDate) break;
    }
  }
  const dateRangeSep = /(?:到|至|~|—|–|-|から|to|à|bis)\s*/i;
  const dateRangePattern = new RegExp(
    `(${relDateNames})\\s*${dateRangeSep.source}(${relDateNames})`,
    "gi"
  );
  remaining = remaining.replace(dateRangePattern, (_match, d1, d2) => {
    if (!startDate) {
      const key1 = d1.toLowerCase();
      const key2 = d2.toLowerCase();
      const off1 = RELATIVE_DATES[key1] ?? RELATIVE_DATES[d1];
      const off2 = RELATIVE_DATES[key2] ?? RELATIVE_DATES[d2];
      if (off1 !== undefined && off2 !== undefined) {
        startDate = today.add(off1, "day").format("YYYY-MM-DD");
        endDate = today.add(off2, "day").format("YYYY-MM-DD");
      }
    }
    return "";
  });
  // Single relative date
  const relativeDatePattern = new RegExp(relDateNames, "gi");
  remaining = remaining.replace(relativeDatePattern, (match) => {
    if (!startDate) {
      const key = match.toLowerCase();
      const offset = RELATIVE_DATES[key] ?? RELATIVE_DATES[match];
      if (offset !== undefined) {
        startDate = today.add(offset, "day").format("YYYY-MM-DD");
      }
    }
    return "";
  });

  // Extract weekday: 周一, 火曜, lunes, lundi, Montag, segunda
  // CJK patterns need no word boundary; Latin patterns use \b
  // Supports optional prefix: next/last/this + localized equivalents
  // Supports optional suffix: prochain/dernier/etc (French/Italian)
  const NEXT_WORDS = "next|próximo|próxima|nächste\\w?|prossim[ao]|prochain|prochaine|seguinte";
  const LAST_WORDS = "last|pasad[ao]|letzte\\w?|scors[oa]|dernier|dernière|derniere|passad[ao]|anterior";
  const latinWeekdayPattern = new RegExp(
    "(" + NEXT_WORDS + "|" + LAST_WORDS + "|this|est[ae]|diese\\w?|quest[ao]|ce|cette|cet|atual)?\\s*" +
    "(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|" +
    "lunes|martes|mi.rcoles|jueves|viernes|s.bado|domingo|" +
    "lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|" +
    "montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|" +
    "segunda|ter.a|quarta|quinta|sexta)\\.?" +
    "(?:\\s+(?:prochain|prochaine|dernier|derniere|prossimo|prossima|scorso|scorsa))?" +
    "\\b",
    "gi"
  );

  // CJK weekday patterns (no word boundary needed)
  // Supports prefixes: 下(下week), 上(last week), 这(this week), 来(next week), 今(this week), 先(last week)
  const cjkWeekdayPattern = /(?:下|上|这|這|来|來|今|先)?(?:周|星期|礼拜|週)[一二三四五六日天五]|(?:下|上|这|這|来|來|今|先)?(?:週|周)[月火水木金土日](?:曜)?(?:日)?|[月火水木金土日]曜(?:日)?/gi;
  const calcWeekday = (target: number, weekOffset: number) => {
    let d = today;
    const currentDay = d.day();
    let diff = target - currentDay;
    if (diff <= 0) diff += 7;
    d = d.add(diff + weekOffset * 7, "day");
    return d.format("YYYY-MM-DD");
  };

  // CJK weekday: handle prefix (下/上/这/来/今/先) + weekday name
  remaining = remaining.replace(cjkWeekdayPattern, (match) => {
    if (startDate) return "";

    // Determine week offset from prefix
    let weekOffset = 0;
    if (/^下|来|來/.test(match)) weekOffset = 1;
    else if (/^上|先/.test(match)) weekOffset = -1;

    // Extract weekday: try parseWeekday on full match first, then progressively strip prefixes
    let target: number | null = null;
    target = parseWeekday(match);
    if (target === null) {
      // Strip leading prefix chars (下/上/这/這/来/來/今/先) and retry
      const stripped = match.replace(/^[下上这這来來今先]/, "");
      target = parseWeekday(stripped);
    }
    if (target === null) return "";

    startDate = calcWeekday(target, weekOffset);
    return "";
  });

  // Latin weekday: use \b boundary, with optional next/last/this prefix or suffix
  remaining = remaining.replace(latinWeekdayPattern, (_match, prefixWord, weekdayWord) => {
    if (startDate) return "";
    const target = parseWeekday(weekdayWord);
    if (target === null) return "";
    let weekOffset = 0;
    // Check prefix
    if (prefixWord) {
      const p = prefixWord.toLowerCase();
      if (/next|^próxim|^nächste|^prossim|^prochain|^seguinte/.test(p)) weekOffset = 1;
      else if (/last|pasad|^letzte|^scors|^derni|^passad|anterior/.test(p)) weekOffset = -1;
    }
    // Check suffix (French/Italian: "lundi prochain", "mercredi dernier")
    const suffixMatch = _match.match(/\s+(prochain|prochaine|dernier|derniere|prossimo|prossima|scorso|scorsa)\s*$/i);
    if (suffixMatch) {
      const s = suffixMatch[1].toLowerCase();
      if (/prochain|prossim/.test(s)) weekOffset = 1;
      else if (/derni|scors/.test(s)) weekOffset = -1;
    }
    startDate = calcWeekday(target, weekOffset);
    return "";
  });


  // Strategy: find ALL time-like tokens, if two are separated by a range connector, treat as range
  const TIME_RANGE_SEP = /\s*(?:到|至|~|—|–|-|から|to|à|bis|a)\s*/i;

  // Chinese/Japanese time: 下午3点半, 上午10点, 四点, 三点半, 午後3時
  const cnTimePattern = /(上午|下午|早上|晚上|凌晨|午前|午後)?\s*(\d{1,2}|[零一二两三四五六七八九十]+)[点時:](\d{1,2}|[零一二两三四五六七八九十]+)?[分]?半?/g;
  const cnTimeMatches: Array<{ match: string; index: number }> = [];
  let cnM: RegExpExecArray | null;
  while ((cnM = cnTimePattern.exec(remaining)) !== null) {
    cnTimeMatches.push({ match: cnM[0], index: cnM.index });
  }
  if (cnTimeMatches.length >= 2) {
    const between = remaining.slice(cnTimeMatches[0].index + cnTimeMatches[0].match.length, cnTimeMatches[1].index);
    if (TIME_RANGE_SEP.test(between)) {
      const periodMatch = cnTimeMatches[0].match.match(/^(上午|下午|早上|晚上|凌晨|午前|午後)/);
      const defaultPeriod = periodMatch?.[1];
      const t1 = parseChineseTime(cnTimeMatches[0].match);
      const t2 = parseChineseTime(cnTimeMatches[1].match, defaultPeriod);
      if (t1 && t2) {
        startTime = formatTime(t1.hours, t1.minutes);
        endTime = formatTime(t2.hours, t2.minutes);
        hasTime = true;
        remaining = remaining.slice(0, cnTimeMatches[0].index) + remaining.slice(cnTimeMatches[1].index + cnTimeMatches[1].match.length);
      }
    }
  }
  if (!startTime && cnTimeMatches.length >= 1) {
    const t = parseChineseTime(cnTimeMatches[0].match);
    if (t) {
      startTime = formatTime(t.hours, t.minutes);
      hasTime = true;
      remaining = remaining.slice(0, cnTimeMatches[0].index) + remaining.slice(cnTimeMatches[0].index + cnTimeMatches[0].match.length);
    }
  }

  // European time: 3pm, 15h, 15 Uhr, 15:00 — range-aware
  if (!startTime) {
    const enTimePattern = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/gi;
    const frTimePattern = /(?<!\.)(\d{1,2})\s*h\s*(\d{1,2})?/gi;
    const deTimePattern = /(\d{1,2})(?::(\d{2}))?\s*Uhr/gi;
    const h24Pattern = /\b(\d{1,2}):(\d{2})\b/g;

    const findTimeRange = <T>(pattern: RegExp, parseFn: (m: string) => T | null): boolean => {
      const matches: Array<{ match: string; index: number; parsed: T | null }> = [];
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(remaining)) !== null) {
        matches.push({ match: m[0], index: m.index, parsed: parseFn(m[0]) });
      }
      if (matches.length >= 2) {
        const between = remaining.slice(matches[0].index + matches[0].match.length, matches[1].index);
        if (TIME_RANGE_SEP.test(between) && matches[0].parsed && matches[1].parsed) {
          const t1 = matches[0].parsed as { hours: number; minutes: number };
          const t2 = matches[1].parsed as { hours: number; minutes: number };
          startTime = formatTime(t1.hours, t1.minutes);
          endTime = formatTime(t2.hours, t2.minutes);
          hasTime = true;
          remaining = remaining.slice(0, matches[0].index) + remaining.slice(matches[1].index + matches[1].match.length);
          return true;
        }
      }
      if (matches.length >= 1 && matches[0].parsed) {
        const t = matches[0].parsed as { hours: number; minutes: number };
        startTime = formatTime(t.hours, t.minutes);
        hasTime = true;
        remaining = remaining.slice(0, matches[0].index) + remaining.slice(matches[0].index + matches[0].match.length);
        return true;
      }
      return false;
    };

    if (!findTimeRange(enTimePattern, parseEnglishTime)) {
      if (!findTimeRange(frTimePattern, parseFrenchTime)) {
        if (!findTimeRange(deTimePattern, parseGermanTime)) {
          // 24h fallback
          const h24Matches: Array<{ match: string; index: number; hours: number; minutes: number }> = [];
          let h24M: RegExpExecArray | null;
          while ((h24M = h24Pattern.exec(remaining)) !== null) {
            const hours = parseInt(h24M[1], 10);
            const minutes = parseInt(h24M[2], 10);
            if (hours < 24 && minutes < 60) {
              h24Matches.push({ match: h24M[0], index: h24M.index, hours, minutes });
            }
          }
          if (h24Matches.length >= 2) {
            const between = remaining.slice(h24Matches[0].index + h24Matches[0].match.length, h24Matches[1].index);
            if (TIME_RANGE_SEP.test(between)) {
              startTime = formatTime(h24Matches[0].hours, h24Matches[0].minutes);
              endTime = formatTime(h24Matches[1].hours, h24Matches[1].minutes);
              hasTime = true;
              remaining = remaining.slice(0, h24Matches[0].index) + remaining.slice(h24Matches[1].index + h24Matches[1].match.length);
            }
          }
          if (!startTime && h24Matches.length >= 1) {
            startTime = formatTime(h24Matches[0].hours, h24Matches[0].minutes);
            hasTime = true;
            remaining = remaining.slice(0, h24Matches[0].index) + remaining.slice(h24Matches[0].index + h24Matches[0].match.length);
          }
        }
      }
    }
  }

  // Extract duration: 30min, 1h, 1.5h, 90分钟, 30 Minuten, 1 Stunde, 30 minutos, 1 hora, 30分, 1時間
  const durationRegex = buildDurationRegex();
  remaining = remaining.replace(durationRegex, (_match, num) => {
    if (!estimateMinutes) {
      const value = parseFloat(num);
      // Extract the unit part: "1.5h" → "h", "30 min" → "min", "90分钟" → "分钟"
      const unitPart = _match.replace(new RegExp("^\\s*" + num.replace(".", "\\.") + "\\s*"), "");
      estimateMinutes = isHourUnit(unitPart)
        ? Math.round(value * 60)
        : Math.round(value);
    }
    return "";
  });

  // Extract date: 6月10日, 6月10号, 6/10, 10 de junio, 10 juin, 10. Juni, 10 de junho
  // Chinese/Japanese: 6月10日
  remaining = remaining.replace(/(\d{1,2})[月/](\d{1,2})[日号]?/g, (_match, month, day) => {
    if (!startDate) {
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      let date = today.month(m - 1).date(d);
      if (date.isBefore(today, "day")) date = date.add(1, "year");
      startDate = date.format("YYYY-MM-DD");
    }
    return "";
  });

  // European date: 10 de junio, 10 juin, 10. Juni, 10 de junho, 10 jun
  const MONTH_MAP: Record<string, number> = {
    // Spanish
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
    // French
    janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, "août": 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
    // German
    januar: 1, februar: 2, märz: 3, marz: 3, april: 4, juni: 6,
    juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
    // Portuguese
    janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
    // Short forms
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const monthNames = Object.keys(MONTH_MAP).sort((a, b) => b.length - a.length).join("|");
  const europeanDateRegex = new RegExp(
    `(\\d{1,2})\\s+(?:de\\s+)?(${monthNames})(?:\\s+de)?(?:\\.)?\\b`, "gi"
  );
  remaining = remaining.replace(europeanDateRegex, (_match, day, month) => {
    if (!startDate) {
      const d = parseInt(day, 10);
      const m = MONTH_MAP[month.toLowerCase()];
      if (m) {
        let date = today.month(m - 1).date(d);
        if (date.isBefore(today, "day")) date = date.add(1, "year");
        startDate = date.format("YYYY-MM-DD");
      }
    }
    return "";
  });

  // --- Date range parsing ---
  // Chinese: 6月10日到6月15日, 下周一到周五
  // If we have startDate but no endDate, look for "到/至/-" followed by another date
  if (startDate && !endDate) {
    // Check for second date after separator
    const sepPattern = /\s*(?:到|至|-|—|to|à|bis|a|–)\s*/;
    const sepMatch = remaining.match(sepPattern);
    if (sepMatch) {
      const afterSep = remaining.slice(remaining.indexOf(sepMatch[0]) + sepMatch[0].length);
      // Try to parse a date from the text after separator
      // European date: 15 de junio, 15 juin, etc.
      const monthNames = Object.keys(MONTH_MAP).sort((a, b) => b.length - a.length).join("|");
      const euDateMatch = afterSep.match(new RegExp("^(\\d{1,2})\\s+(?:de\\s+)?(" + monthNames + ")(?:\\s+de)?(?:\\.)?\\b", "i"));
      if (euDateMatch) {
        const d = parseInt(euDateMatch[1], 10);
        const m = MONTH_MAP[euDateMatch[2].toLowerCase()];
        if (m) {
          let date = today.month(m - 1).date(d);
          if (date.isBefore(startDate, "day")) date = date.add(1, "year");
          endDate = date.format("YYYY-MM-DD");
          remaining = remaining.replace(sepMatch[0] + euDateMatch[0], "");
        }
      }
      // Chinese date: 6月15日
      if (!endDate) {
        const cnDateMatch = afterSep.match(/^(\d{1,2})[月/](\d{1,2})[日号]?/);
        if (cnDateMatch) {
          const m = parseInt(cnDateMatch[1], 10);
          const d = parseInt(cnDateMatch[2], 10);
          let date = today.month(m - 1).date(d);
          if (date.isBefore(startDate, "day")) date = date.add(1, "year");
          endDate = date.format("YYYY-MM-DD");
          remaining = remaining.replace(sepMatch[0] + cnDateMatch[0], "");
        }
      }
    }
  }

  // Clean up remaining text as title
  const title = remaining.replace(/\s+/g, " ").trim();

  // Apply scheduling rules:
  // - hasTime = true when startDate is present
  // - allDay = true when startDate is present but no startTime
  // - If has startTime + endDate: endTime is required
  // - If allDay + endDate: endTime is not allowed
  // - If startTime exists but no startDate: default to today
  // - If endTime exists but no endDate: default to startDate
  if (startTime && !startDate) {
    startDate = today.format("YYYY-MM-DD");
  }
  if (endTime && !endDate) {
    endDate = startDate;
  }
  const finalHasTime = !!startDate;
  const allDay = !!startDate && !startTime;
  const finalEndDate = endDate || undefined;
  let finalEndTime: string | undefined;
  if (allDay) {
    // All-day events cannot have endTime
    finalEndTime = undefined;
  } else if (startTime && endTime) {
    // Timed events: keep endTime if both times exist
    finalEndTime = endTime;
  } else {
    finalEndTime = endTime || undefined;
  }

  return {
    title,
    startDate,
    startTime,
    endDate: finalEndDate,
    endTime: finalEndTime,
    hasTime: finalHasTime,
    allDay,
    priority,
    tags: tags.length > 0 ? tags : undefined,
    projectName,
    estimateMinutes,
  };
}
