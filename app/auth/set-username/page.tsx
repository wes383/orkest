"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { addLocaleToPathname, useI18n } from "@/lib/i18n";

export default function SetUsernamePage() {
  const { user, loading, updateProfile } = useAuth();
  const router = useRouter();
  const { locale, t } = useI18n();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [initialUsernameState, setInitialUsernameState] = useState<boolean | null>(null);

  const hasGoogleIdentity = user?.identities?.some((i) => i.provider === "google") ?? false;
  const hasEmailIdentity = user?.identities?.some((i) => i.provider === "email") ?? false;
  // Only show terms checkbox for pure Google users (not linked with email)
  const needsTermsAgreement = hasGoogleIdentity && !hasEmailIdentity;

  // Capture initial username state on first load
  useEffect(() => {
    if (!loading && user && initialUsernameState === null) {
      setInitialUsernameState(!!user.user_metadata?.username);
    }
  }, [loading, user, initialUsernameState]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(addLocaleToPathname("/auth", locale));
      return;
    }
    // Only auto-redirect if user already had a username when page first loaded
    // Don't redirect if username was auto-filled after arriving at this page
    // For pure Google users (not linked with email), also check if they agreed to terms
    const hasCompletedSetup = user.user_metadata?.username && 
      (!needsTermsAgreement || user.user_metadata?.terms_agreed);
    
    if (hasCompletedSetup && initialUsernameState === true) {
      window.location.replace(addLocaleToPathname("/", locale));
    }
  }, [user, loading, router, locale, initialUsernameState, needsTermsAgreement]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError(t("auth.usernameEmpty"));
      return;
    }
    if (trimmed.length < 2) {
      setError(t("auth.usernameShort"));
      return;
    }
    if (trimmed.length > 30) {
      setError(t("auth.usernameLong"));
      return;
    }
    if (needsTermsAgreement && !agreedToTerms) {
      setError(t("auth.mustAgreeToTerms"));
      return;
    }
    setError(null);
    setSubmitting(true);

    // Save terms agreement status for all users
    const updateData = { username: trimmed, terms_agreed: true };

    const { error } = await updateProfile(updateData);
    if (error) {
      setError(error);
      setSubmitting(false);
    } else {
      window.location.assign(addLocaleToPathname("/", locale));
    }
  }

  function handleSkip() {
    if (needsTermsAgreement && !agreedToTerms) {
      setError(t("auth.mustAgreeToTerms"));
      return;
    }
    
    // For pure Google users, ensure username and terms_agreed are set before skipping
    if (needsTermsAgreement) {
      const currentUsername = user?.user_metadata?.username;
      const needsUsername = !currentUsername;
      
      // If no username, get it from Google identity
      let usernameToSave = currentUsername;
      if (needsUsername) {
        const googleIdentity = user?.identities?.find((i) => i.provider === "google");
        usernameToSave = googleIdentity?.identity_data?.full_name || 
                        googleIdentity?.identity_data?.name || 
                        user?.email?.split("@")[0] || 
                        "User";
      }
      
      setSubmitting(true);
      // Always save terms_agreed for pure Google users, and username if needed
      updateProfile({ 
        ...(needsUsername ? { username: usernameToSave } : {}),
        terms_agreed: true 
      })
        .then(({ error }) => {
          if (error) {
            setError(error);
            setSubmitting(false);
          } else {
            window.location.assign(addLocaleToPathname("/", locale));
          }
        })
        .catch(() => {
          setSubmitting(false);
          setError("An error occurred. Please try again.");
        });
      return;
    }
    
    window.location.assign(addLocaleToPathname("/", locale));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcfbfa] px-6">
        <p className="text-sm text-[#7d7880]">{t("common.loading")}</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfbfa] px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="font-display text-[clamp(3rem,8vw,4.5rem)] leading-[0.9] font-semibold tracking-[-0.02em] text-[#25242a]">
            Orkest
          </h1>
          <p className="mt-4 text-base text-[#7d7880]">
            {t("auth.chooseUsername")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="username" className="mb-2 block">
              {t("auth.username")}
            </Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.slice(0, 30))}
              placeholder={t("auth.usernamePlaceholder")}
              required
              minLength={2}
              maxLength={30}
              autoComplete="username"
            />
          </div>

          {error && (
            <p className="text-sm text-[#b14242]">{error}</p>
          )}

          {needsTermsAgreement && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <Checkbox
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <span className="text-xs text-[#7d7880] cursor-pointer">
                {t("auth.agreeToTerms")}{" "}
                <a href="/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#25242a] transition-colors">
                  {t("auth.termsOfService")}
                </a>{" "}
                {t("common.and")}{" "}
                <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#25242a] transition-colors">
                  {t("auth.privacyPolicy")}
                </a>
              </span>
            </label>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? t("common.saving") : t("common.save")}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={handleSkip}
            disabled={submitting}
            className="text-sm text-[#7d7880] hover:text-[#25242a] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t("common.loading") : t("auth.skipForNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
