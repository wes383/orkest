"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useSettingsStore } from "@/lib/stores/use-settings-store";
import { useFocusStore } from "@/lib/stores/use-focus-store";
import type { ReactNode } from "react";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, turnstileToken: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  verifySignUpCode: (email: string, code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: { username?: string; avatar_url?: string; terms_agreed?: boolean }) => Promise<{ error: string | null }>;
  resetPassword: (email: string, turnstileToken: string) => Promise<{ error: string | null }>;
  verifyRecoveryCode: (email: string, code: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

function hasStoreHydrated(store: typeof useSettingsStore | typeof useFocusStore) {
  return store.persist?.hasHydrated?.() ?? true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  console.log("[ORKEST-DEBUG][AuthProvider] render, pathname=", typeof window !== "undefined" ? window.location.pathname : "(ssr)");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const locale = useSettingsStore((s) => s.locale);
  // createClient() returns a fresh object on every call, so depending on
  // supabase.auth in effects would re-run them on every render. Pin the
  // client to a stable ref so auth listeners aren't re-subscribed in a loop.
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  useEffect(() => {
    let cancelled = false;

    if (user && loadedUserIdRef.current !== user.id) {
      loadedUserIdRef.current = user.id;
      useSettingsStore.setState({ loadedFromCloud: false });
      useFocusStore.setState({ loadedFromCloud: false });

      const loadSettingsWhenReady = () => {
        if (cancelled) return;
        if (hasStoreHydrated(useSettingsStore)) {
          void useSettingsStore.getState().loadFromCloud(user.id).catch((error) => {
            console.error("[AuthProvider] load settings failed:", error);
            useSettingsStore.setState({ loadedFromCloud: true });
          });
        } else {
          setTimeout(loadSettingsWhenReady, 50);
        }
      };

      const loadFocusWhenReady = () => {
        if (cancelled) return;
        if (hasStoreHydrated(useFocusStore)) {
          void useFocusStore.getState().loadFromCloud(user.id).catch((error) => {
            console.error("[AuthProvider] load focus failed:", error);
            useFocusStore.setState({ loadedFromCloud: true });
          });
        } else {
          setTimeout(loadFocusWhenReady, 50);
        }
      };
      loadSettingsWhenReady();
      loadFocusWhenReady();

      // Check if Google user needs to complete setup (agree to terms)
      const hasGoogleIdentity = user.identities?.some((i) => i.provider === "google");
      const hasEmailIdentity = user.identities?.some((i) => i.provider === "email");
      const hasAgreedToTerms = !!user.user_metadata?.terms_agreed;
      
      // Only require terms agreement for pure Google users (not linked with email)
      if (hasGoogleIdentity && !hasAgreedToTerms && !hasEmailIdentity) {
        // Redirect to set-username page if terms not agreed
        const currentPath = window.location.pathname;
        if (!currentPath.includes("/auth/set-username") && !currentPath.includes("/auth/callback")) {
          window.location.href = "/auth/set-username";
        }
      }

      const identity = user.identities?.find((i) => i.provider === "google");
      if (identity?.identity_data) {
        const googleName = (identity.identity_data.full_name as string | undefined) || (identity.identity_data.name as string | undefined);
        const googleAvatar = (identity.identity_data.avatar_url as string | undefined) || (identity.identity_data.picture as string | undefined);
        const currentName = user.user_metadata?.username as string | undefined;
        const currentAvatar = user.user_metadata?.avatar_url as string | undefined;

        if ((googleName && !currentName) || (googleAvatar && !currentAvatar)) {
          void supabase.auth.updateUser({
            data: {
              ...(googleName && !currentName ? { username: googleName } : {}),
              ...(googleAvatar && !currentAvatar ? { avatar_url: googleAvatar } : {}),
            },
          }).then(({ data: result, error }) => {
            if (!error && result?.user) {
              setUser(result.user);
            }
          });
        }
      }
    }
    if (!user) {
      loadedUserIdRef.current = null;
      useSettingsStore.setState({ loadedFromCloud: false });
      useFocusStore.setState({ loadedFromCloud: false });
    }

    return () => {
      cancelled = true;
    };
  }, [user, supabase.auth]);

  const sendAuthCode = useCallback(async (
    payload:
      | { purpose: "signup"; email: string; password: string; turnstileToken: string }
      | { purpose: "recovery"; email: string; turnstileToken: string },
  ) => {
    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, locale }),
      });
      let result: { error?: string } = {};
      try {
        result = (await response.json()) as { error?: string };
      } catch {
        // Keep the generic message for non-JSON failures.
      }

      return {
        error: response.ok ? null : result.error ?? "Failed to send verification email.",
      };
    } catch {
      return {
        error: "Failed to send verification email.",
      };
    }
  }, [locale]);

  const signUp = useCallback(async (email: string, password: string, turnstileToken: string) => {
    return sendAuthCode({ purpose: "signup", email, password, turnstileToken });
  }, [sendAuthCode]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, locale }),
      });
      const result = (await response.json()) as { error?: string; session?: { access_token: string; refresh_token: string } };

      if (!response.ok || result.error) {
        return { error: result.error ?? "Something went wrong." };
      }

      if (result.session) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
        if (sessionError) {
          return { error: sessionError.message };
        }
      }

      return { error: null };
    } catch {
      return { error: "Failed to sign in." };
    }
  }, [locale, supabase.auth]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase.auth]);

  const verifySignUpCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "signup",
    });
    return { error: error?.message ?? null };
  }, [supabase.auth]);

  const updateProfile = useCallback(async (data: { username?: string; avatar_url?: string; terms_agreed?: boolean }) => {
    const { data: result, error } = await supabase.auth.updateUser({ data });
    if (!error && result?.user) {
      setUser(result.user);
    }
    return { error: error?.message ?? null };
  }, [supabase.auth]);

  const resetPassword = useCallback(async (email: string, turnstileToken: string) => {
    return sendAuthCode({ purpose: "recovery", email, turnstileToken });
  }, [sendAuthCode]);

  const verifyRecoveryCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "recovery",
    });
    return { error: error?.message ?? null };
  }, [supabase.auth]);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }, [supabase.auth]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}/${locale}/auth/callback?next=/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
      },
    });
    return { error: error?.message ?? null };
  }, [locale, supabase.auth]);

  const deleteAccount = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok || result.error) {
        return { error: result.error ?? "Failed to delete account." };
      }
      await supabase.auth.signOut();
      return { error: null };
    } catch {
      return { error: "Failed to delete account." };
    }
  }, [supabase.auth]);

  const contextValue = useMemo<AuthState>(() => ({
    user, session, loading, signUp, signIn, verifySignUpCode, signOut, updateProfile, resetPassword, verifyRecoveryCode, updatePassword, signInWithGoogle, deleteAccount,
  }), [user, session, loading, signUp, signIn, verifySignUpCode, signOut, updateProfile, resetPassword, verifyRecoveryCode, updatePassword, signInWithGoogle, deleteAccount]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
