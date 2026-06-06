"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addLocaleToPathname, useI18n } from "@/lib/i18n";

function UpdatePasswordForm() {
  const { updatePassword, user, loading } = useAuth();
  const { locale, t } = useI18n();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const hasRecoveryLink = Boolean(code && type === "recovery");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exchanging, setExchanging] = useState(hasRecoveryLink);

  useEffect(() => {
    if (!code || type !== "recovery") {
      return;
    }

    let mounted = true;
    const supabase = createClient();

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (!mounted) {
        return;
      }
      if (error) {
        setError(error.message);
      }
      setExchanging(false);
    });

    return () => {
      mounted = false;
    };
  }, [code, type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      return;
    }

    setSubmitting(true);

    const { error } = await updatePassword(password);
    if (error) {
      setError(error);
      setSubmitting(false);
    } else {
      window.location.assign(addLocaleToPathname("/", locale));
    }
  }

  if (exchanging || (!hasRecoveryLink && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcfbfa] px-6">
        <p className="text-sm text-[#7d7880]">{t("auth.verifyingReset")}</p>
      </div>
    );
  }

  if (!hasRecoveryLink && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcfbfa] px-6">
        <p className="text-sm text-[#b14242]">{t("auth.invalidReset")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfbfa] px-6">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <h1 className="font-display text-[clamp(3rem,8vw,4.5rem)] leading-[0.9] font-semibold tracking-[-0.02em] text-[#25242a]">
            Orkest
          </h1>
          <p className="mt-4 text-base text-[#7d7880]">
            {t("auth.setNewPassword")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="password" className="mb-2 block">
              {t("auth.newPassword")}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.newPassword")}
                required
                minLength={6}
                autoComplete="new-password"
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
          </div>

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
                minLength={6}
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

          {error && (
            <p className="text-sm text-[#b14242]">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting}
          >
            {submitting ? t("auth.updating") : t("auth.updatePassword")}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#fcfbfa] px-6">
        <p className="text-sm text-[#7d7880]">Loading...</p>
      </div>
    }>
      <UpdatePasswordForm />
    </Suspense>
  );
}
