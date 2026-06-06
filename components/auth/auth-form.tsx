"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { addLocaleToPathname, useI18n } from "@/lib/i18n";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

type AuthMode = "signin" | "signup" | "reset";

export function AuthForm() {
  const { signIn, signUp, verifySignUpCode, resetPassword, verifyRecoveryCode, signInWithGoogle } = useAuth();
  const router = useRouter();
  const { locale, t } = useI18n();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(() => {
    if (searchParams.get("mode") === "signup") return "signup";
    if (searchParams.get("mode") === "reset") return "reset";
    return "signin";
  });

  useEffect(() => {
    const modeParam = searchParams.get("mode");
    if (modeParam === "signup" || modeParam === "reset") {
      setMode(modeParam);
    }
  }, [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [code, setCode] = useState("");
  const [codeFocused, setCodeFocused] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const isSignIn = mode === "signin";
  const isSignUp = mode === "signup";
  const isReset = mode === "reset";

  const allChecksMet = isSignUp && !awaitingCode && password.length > 0
    ? password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    : false;

  const showPasswordChecks = isSignUp && !awaitingCode && !allChecksMet && (passwordFocused || password.length > 0);

  const passwordChecks = isSignUp && !awaitingCode && (passwordFocused || password.length > 0) ? {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  } : null;

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const needsTurnstile = (isSignUp || isReset) && !awaitingCode;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (isSignUp && !awaitingCode) {
      if (password !== confirmPassword) {
        setError(t("auth.passwordMismatch"));
        return;
      }
      if (password.length < 8) {
        setError(t("auth.passwordTooShort"));
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError(t("auth.passwordNoUppercase"));
        return;
      }
      if (!/[a-z]/.test(password)) {
        setError(t("auth.passwordNoLowercase"));
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError(t("auth.passwordNoDigit"));
        return;
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        setError(t("auth.passwordNoSpecial"));
        return;
      }
    }

    if (isSignUp && !agreedToTerms) {
      setError(t("auth.mustAgreeToTerms"));
      return;
    }

    if (needsTurnstile && !turnstileToken) {
      setError(t("auth.completeChallenge"));
      return;
    }

    setSubmitting(true);

    if (awaitingCode && isSignUp) {
      const { error } = await verifySignUpCode(email, code);
      if (error) {
        setError(error);
      } else {
        router.push(addLocaleToPathname("/auth/set-username", locale));
        return;
      }
    } else if (awaitingCode && isReset) {
      const { error } = await verifyRecoveryCode(email, code);
      if (error) {
        setError(error);
      } else {
        router.push(addLocaleToPathname("/auth/update-password", locale));
        return;
      }
    } else if (isSignUp) {
      const { error } = await signUp(email, password, turnstileToken ?? "");
      if (error) {
        setError(error);
        setTurnstileToken(null);
        setTurnstileResetKey((value) => value + 1);
      } else {
        setAwaitingCode(true);
        setSuccess(t("auth.signupCodeSent"));
      }
    } else if (isReset) {
      const { error } = await resetPassword(email, turnstileToken ?? "");
      if (error) {
        setError(error);
        setTurnstileToken(null);
        setTurnstileResetKey((value) => value + 1);
      } else {
        setAwaitingCode(true);
        setSuccess(t("auth.resetCodeSent"));
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
      } else {
        window.location.assign(addLocaleToPathname("/", locale));
        return;
      }
    }

    setSubmitting(false);
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setCode("");
    setTurnstileToken(null);
    setTurnstileResetKey((value) => value + 1);
    setAwaitingCode(false);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function editEmail() {
    setError(null);
    setSuccess(null);
    setCode("");
    setTurnstileToken(null);
    setTurnstileResetKey((value) => value + 1);
    setAwaitingCode(false);
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#fcfbfa] px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="font-display text-[clamp(3rem,8vw,4.5rem)] leading-[0.9] font-semibold tracking-[-0.02em] text-[#25242a]">
            Orkest
          </h1>
          <p className="mt-4 text-base text-[#7d7880]">
            {isSignUp ? t("auth.createAccount") : isReset ? t("auth.resetPassword") : t("auth.welcomeBack")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="email" className="mb-2 block">
              {t("auth.email")}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={awaitingCode}
              autoComplete="email"
            />
          </div>

          {!isReset && !awaitingCode && (
            <div>
              <Label htmlFor="password" className="mb-2 block">
                {t("auth.password")}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder={t("auth.password")}
                  required
                  minLength={isSignUp ? 8 : undefined}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/5 hover:text-[#25242a]"
                  aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {isSignUp && !awaitingCode && (
                <div
                  className={`overflow-hidden transition-all duration-200 ease-out ${
                    !allChecksMet && (passwordFocused || password.length > 0) ? "max-h-24 opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"
                  }`}
                >
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-[#7d7880]">{t("auth.passwordRequirements")}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${passwordChecks?.length ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400" : "border-[#e5e2e8] text-[#7d7880] dark:border-white/10"}`}>
                        {t("auth.reqLength")}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${passwordChecks?.uppercase ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400" : "border-[#e5e2e8] text-[#7d7880] dark:border-white/10"}`}>
                        {t("auth.reqUppercase")}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${passwordChecks?.lowercase ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400" : "border-[#e5e2e8] text-[#7d7880] dark:border-white/10"}`}>
                        {t("auth.reqLowercase")}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${passwordChecks?.digit ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400" : "border-[#e5e2e8] text-[#7d7880] dark:border-white/10"}`}>
                        {t("auth.reqDigit")}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors ${passwordChecks?.special ? "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400" : "border-[#e5e2e8] text-[#7d7880] dark:border-white/10"}`}>
                        {t("auth.reqSpecial")}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {isSignUp && !awaitingCode && (
            <div>
              <Label htmlFor="confirm-password" className="mb-2 block">
                {t("auth.confirmPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.confirmPassword")}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#7d7880] transition-colors hover:bg-black/5 hover:text-[#25242a]"
                  aria-label={showConfirmPassword ? t("auth.hidePassword") : t("auth.showPassword")}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {awaitingCode && (
            <div>
              <Label className="mb-2 block">
                {t("auth.verificationCode")}
              </Label>
              <div
                className="flex items-center justify-center gap-2 outline-none"
                tabIndex={0}
                onFocus={() => setCodeFocused(true)}
                onBlur={() => setCodeFocused(false)}
                onKeyDown={(e) => {
                  if (e.key >= "0" && e.key <= "9") {
                    setCode((prev) => (prev.length < 6 ? prev + e.key : prev));
                    e.preventDefault();
                  }
                  if (e.key === "Backspace") {
                    setCode((prev) => prev.slice(0, -1));
                    e.preventDefault();
                  }
                  if (e.key === "v" && (e.metaKey || e.ctrlKey)) {
                    navigator.clipboard.readText().then((text) => {
                      const digits = text.replace(/[^0-9]/g, "").slice(0, 6);
                      if (digits) setCode(digits);
                    });
                    e.preventDefault();
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const text = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
                  if (text) setCode(text);
                }}
                role="group"
                aria-label={t("auth.verificationCode")}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex h-14 w-11 items-center justify-center rounded-lg border text-xl font-semibold transition-colors ${
                      i < code.length
                        ? "border-[#25242a]/30 bg-white text-[#25242a] dark:border-white/20 dark:bg-[#181818] dark:text-[#f5f5f5]"
                        : "border-[#e5e2e8] bg-transparent dark:border-white/10"
                    } ${codeFocused && i === code.length ? "border-[#25242a] ring-2 ring-[#25242a]/10 dark:border-white dark:ring-white/10" : ""}`}
                  >
                    {code[i] || ""}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={editEmail}
                className="mt-2 text-sm text-[#7d7880] hover:text-[#25242a] transition-colors cursor-pointer"
              >
                {t("auth.useDifferentEmail")}
              </button>
            </div>
          )}

          {isSignIn && !awaitingCode && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => switchMode("reset")}
                className="text-sm text-[#7d7880] hover:text-[#25242a] transition-colors cursor-pointer"
              >
                {t("auth.forgotPassword")}
              </button>
            </div>
          )}

          {needsTurnstile && turnstileSiteKey && (
            <TurnstileWidget
              key={`${mode}-${turnstileResetKey}`}
              siteKey={turnstileSiteKey}
              onTokenChange={setTurnstileToken}
            />
          )}

          {needsTurnstile && !turnstileSiteKey && (
            <p className="text-sm text-[#b14242]">{t("auth.turnstileMissing")}</p>
          )}

          {error && (
            <p className="text-sm text-[#b14242]">{error}</p>
          )}

          {success && (
            <p className="text-sm text-green-600">{success}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
          >
            {submitting
              ? t("common.loading")
              : awaitingCode
                ? t("auth.verifyCode")
                : isSignUp
                  ? t("auth.sendSignupCode")
                  : isReset
                    ? t("auth.sendResetCode")
                    : t("auth.signIn")}
          </Button>

          {isSignUp && !awaitingCode && (
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

          {isSignIn && !awaitingCode && (
            <>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[#e5e2e8]" />
                <span className="text-xs text-[#7d7880]">{t("common.or")}</span>
                <div className="h-px flex-1 bg-[#e5e2e8]" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={async () => {
                  setError(null);
                  const { error } = await signInWithGoogle();
                  if (error) setError(error);
                }}
              >
                <GoogleIcon className="mr-2 h-4 w-4" />
                {t("auth.continueGoogle")}
              </Button>
            </>
          )}
        </form>

        {!awaitingCode && (
          <div className="mt-6 text-center space-y-2">
            {isReset ? (
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="text-sm text-[#7d7880] hover:text-[#25242a] transition-colors cursor-pointer"
              >
                {t("auth.backToSignIn")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode(isSignUp ? "signin" : "signup")}
                className="text-sm text-[#7d7880] hover:text-[#25242a] transition-colors cursor-pointer"
              >
                {isSignUp
                  ? t("auth.haveAccount")
                  : t("auth.noAccount")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
