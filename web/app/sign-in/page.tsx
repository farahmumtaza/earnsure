"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authStep, getSupabase, misconfigured } from "@/lib/auth";
import { continueAfterSignIn, GoogleG, useAuthConfig } from "@/components/AuthUI";
import { Button, Card, ErrorBox, Icon, IconCircle, Loading, PageTitle, Pill, Screen, Spinner, TopBar } from "@/components/ui";

/**
 * Sign in. AUTH_ENABLED=true: real Google sign-in through Supabase.
 * AUTH_ENABLED=false: the same screen as a clearly labelled dummy you can skip.
 */
export default function SignIn() {
  const router = useRouter();
  const cfg = useAuthConfig();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configError = cfg && misconfigured(cfg)
    ? "Sign-in is switched on (AUTH_ENABLED=true) but SUPABASE_ANON_KEY isn't set. Add it to the environment and redeploy, or set AUTH_ENABLED=false for demo mode."
    : null;

  // Already signed in? Skip ahead to MFA or into the app.
  useEffect(() => {
    if (!cfg?.enabled || misconfigured(cfg)) return;
    authStep().then((step) => {
      if (step === "done") continueAfterSignIn(router).catch((e) => setError(e.message));
      else if (step !== "signed-out") router.replace("/sign-in/mfa");
    });
  }, [cfg, router]);

  async function google() {
    if (!cfg?.enabled) return router.push("/sign-in/mfa"); // dummy flow
    setBusy(true);
    setError(null);
    const sb = await getSupabase();
    if (!sb) {
      setBusy(false);
      return setError("Sign-in isn't configured. Check SUPABASE_ANON_KEY.");
    }
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setBusy(false);
      setError(error.message);
    }
    // On success the browser leaves for Google, then returns to /auth/callback
  }

  return (
    <Screen>
      <TopBar title="Sign in" back="/" right={cfg && !cfg.enabled ? <Pill tone="amber" size="sm">Demo</Pill> : undefined} />
      <PageTitle sub="Your figures and proof pages are saved to your account and protected with two-step verification.">
        Sign in to EarnSure
      </PageTitle>
      {!cfg && <Loading />}
      {cfg && (
        <>
          <Card className="flex flex-col gap-3 p-[18px]">
            <button type="button" onClick={google} disabled={busy || !!configError}
              className="flex min-h-14 items-center justify-center gap-3 rounded-full border border-line bg-white text-[16px] font-medium text-ink disabled:opacity-60">
              {busy ? <span className="text-primary"><Spinner /></span> : <GoogleG />}
              {busy ? "Opening Google…" : "Continue with Google"}
            </button>
            {[
              { icon: "shield" as const, text: "Two-step verification with an authenticator app" },
              { icon: "lock" as const, text: "We never see your Google password" },
            ].map((r) => (
              <div key={r.text} className="flex items-center gap-3 text-[14px] text-sub">
                <IconCircle size={32} className="bg-mint"><Icon name={r.icon} size={16} stroke="#17756B" width={1.9} /></IconCircle>
                {r.text}
              </div>
            ))}
          </Card>

          {!cfg.enabled && (
            <div className="flex flex-col gap-1 rounded-tile bg-amber-bg p-4 text-[13px] leading-normal text-amber">
              <b className="font-semibold">Sign-in is switched off for this demo.</b>
              <span>These screens show the flow without creating an account. You can skip straight to the app.</span>
            </div>
          )}
          {(configError || error) && <ErrorBox message={(configError ?? error)!} />}
          <div className="grow" />
          {!cfg.enabled && <Button variant="secondary" onClick={() => router.push("/consent")}>Skip sign-in</Button>}
        </>
      )}
    </Screen>
  );
}
