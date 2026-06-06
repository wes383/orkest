"use client";

import { createContext, useContext, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  getLocaleFromPathname,
  switchPathLocale,
} from "./config";
import { translate, type TranslationKey } from "./dictionary";
import { useSettingsStore } from "@/lib/stores/use-settings-store";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const storeLocale = useSettingsStore((s) => s.locale);
  const setStoreLocale = useSettingsStore((s) => s.setLocale);
  const loadedFromCloud = useSettingsStore((s) => s.loadedFromCloud);
  const routeLocale = getLocaleFromPathname(pathname);
  const locale = routeLocale ?? storeLocale ?? DEFAULT_LOCALE;
  const initialRedirectDoneRef = useRef(false);

  // Only redirect once on initial load if cloud locale differs from URL
  useEffect(() => {
    if (loadedFromCloud && routeLocale && storeLocale && routeLocale !== storeLocale && !initialRedirectDoneRef.current) {
      initialRedirectDoneRef.current = true;
      router.replace(switchPathLocale(pathname, storeLocale));
    }
  }, [loadedFromCloud, routeLocale, storeLocale, pathname, router]);

  useEffect(() => {
    document.documentElement.lang = locale;
    writeLocaleCookie(locale);
    
    // Sync URL locale to store, but skip if we're about to redirect
    if (storeLocale !== locale) {
      if (loadedFromCloud && routeLocale && !initialRedirectDoneRef.current) {
        // Skip sync, we're about to redirect
        return;
      }
      setStoreLocale(locale, { skipSync: !routeLocale });
    }
  }, [locale, routeLocale, setStoreLocale, storeLocale, loadedFromCloud]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale(nextLocale) {
      setStoreLocale(nextLocale);
      writeLocaleCookie(nextLocale);
      router.push(switchPathLocale(pathname, nextLocale));
    },
    t(key, values) {
      return translate(locale, key, values);
    },
  }), [locale, pathname, router, setStoreLocale]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(LocaleContext);
  if (!value) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: (key: TranslationKey, values?: Record<string, string | number>) =>
        translate(DEFAULT_LOCALE, key, values),
    };
  }
  return value;
}
