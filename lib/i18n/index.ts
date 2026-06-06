export {
  DEFAULT_LOCALE,
  LOCALE_AI_NAMES,
  LOCALE_COOKIE,
  LOCALE_DATE_TAGS,
  LOCALE_LABELS,
  LOCALE_TRANSCRIPTION_LANGUAGES,
  LOCALES,
  addLocaleToPathname,
  detectLocaleFromAcceptLanguage,
  detectBrowserLocale,
  getLocaleFromPathname,
  isLocale,
  normalizeLocale,
  stripLocaleFromPathname,
  switchPathLocale,
  type Locale,
  getDateFormatLocales,
  type DateFormatLocale,
} from "./config";
export { getDictionary, translate, type TranslationKey } from "./dictionary";
export { LocaleProvider, useI18n } from "./locale-provider";
