import rawLocales from "../date-format-locales.json";

export const LOCALES = ["en", "zh-CN", "es", "fr", "de", "ja", "pt"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "orkest-locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  "zh-CN": "简体中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  pt: "Português",
};

export const LOCALE_DATE_TAGS: Record<Locale, string> = {
  en: "en-US",
  "zh-CN": "zh-CN",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
  pt: "pt-PT",
};

export interface DateFormatLocale {
  code: string;
  lang: string;
  country: string;
  fmt: string;
}

let cachedDateFormatLocales: DateFormatLocale[] | null = null;

export function getDateFormatLocales(): DateFormatLocale[] {
  if (cachedDateFormatLocales) return cachedDateFormatLocales;
  cachedDateFormatLocales = rawLocales as DateFormatLocale[];
  return cachedDateFormatLocales;
}

export const LOCALE_AI_NAMES: Record<Locale, string> = {
  en: "English",
  "zh-CN": "Simplified Chinese",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  pt: "Portuguese",
};

export const LOCALE_TRANSCRIPTION_LANGUAGES: Record<Locale, string> = {
  en: "en",
  "zh-CN": "zh",
  es: "es",
  fr: "fr",
  de: "de",
  ja: "ja",
  pt: "pt",
};

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: string | undefined | null): Locale {
  if (isLocale(value)) return value;
  if (!value) return DEFAULT_LOCALE;

  const normalized = value.toLowerCase();
  for (const locale of LOCALES) {
    if (normalized.startsWith(locale.toLowerCase())) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return isLocale(segment) ? segment : null;
}

export function stripLocaleFromPathname(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return pathname || "/";
  const stripped = pathname.slice(locale.length + 1);
  return stripped.startsWith("/") ? stripped || "/" : `/${stripped}`;
}

export function addLocaleToPathname(pathname: string, locale: Locale): string {
  const cleanPath = stripLocaleFromPathname(pathname);
  return cleanPath === "/" ? `/${locale}` : `/${locale}${cleanPath}`;
}

export function switchPathLocale(pathname: string, locale: Locale): string {
  return addLocaleToPathname(pathname, locale);
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of languages) {
    const locale = normalizeLocale(lang);
    if (locale !== DEFAULT_LOCALE) return locale;
  }
  return DEFAULT_LOCALE;
}

export function detectLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;

  const candidates = header
    .split(",")
    .map((part) => {
      const [tag, qValue] = part.trim().split(";q=");
      return {
        tag,
        quality: qValue ? Number(qValue) : 1,
      };
    })
    .filter((entry) => entry.tag)
    .sort((left, right) => right.quality - left.quality);

  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate.tag);
    if (locale !== DEFAULT_LOCALE || candidate.tag.toLowerCase().startsWith("en")) {
      return locale;
    }
  }

  return DEFAULT_LOCALE;
}
