"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { authStep, getSupabase, signOut } from "@/lib/auth";
import { continueAfterSignIn, useAuthConfig } from "@/components/AuthUI";
import { Button, Card, ErrorBox, Icon, IconCircle, Loading, PageTitle, Pill, Screen, TopBar } from "@/components/ui";

/**
 * Two-step verification with an authenticator app (TOTP).
 *  - enrol:  first sign-in, scan a QR code, then enter a code
 *  - verify: later sign-ins, enter a code
 *  - demo:   AUTH_ENABLED=false, a labelled dummy you can skip
 */
type Mode = "loading" | "demo" | "enrol" | "verify";
type Enrolment = { factorId: string; uri: string; secret: string };

const DEMO_CODE = "123456";
const codeCls = "min-h-14 rounded-full border border-field-line bg-field px-5 text-center text-[22px] font-semibold tracking-[0.4em]";

export default function Mfa() {
  const router = useRouter();
  const cfg = useAuthConfig();
  const [realMode, setMode] = useState<Mode>("loading");
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sign-in switched off: always the dummy screen
  const mode: Mode = cfg && !cfg.enabled ? "demo" : realMode;

  useEffect(() => {
    if (!cfg) return;
    if (!cfg.enabled) return; // demo mode, see `mode` above
    (async () => {
      const step = await authStep();
      if (step === "signed-out") return router.replace("/sign-in");
      if (step === "done") return continueAfterSignIn(router);
      const sb = (await getSupabase())!;
      const factors = await sb.auth.mfa.listFactors();
      if (step === "verify" && factors.data?.totp[0]) {
        setFactorId(factors.data.totp[0].id);
        return setMode("verify");
      }
      // Clear half-finished set-ups from earlier attempts, then start a new one
      for (const f of factors.data?.all ?? []) {
        if (f.factor_type === "totp" && f.status === "unverified") await sb.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `EarnSure ${Date.now()}` });
      if (error || !data) return setError(error?.message ?? "Could not start two-step verification");
      setEnrolment({ factorId: data.id, uri: data.totp.uri, secret: data.totp.secret });
      setFactorId(data.id);
      setMode("enrol");
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong"));
  }, [cfg, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your authenticator app.");
    setError(null);
    if (mode === "demo") {
      if (code !== DEMO_CODE) return setError(`That code doesn't match. For the demo, use ${DEMO_CODE}.`);
      return router.push("/consent");
    }
    setBusy(true);
    const sb = (await getSupabase())!;
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factorId!, code });
    if (error) {
      setBusy(false);
      setCode("");
      return setError("That code didn't work. Check your authenticator app and try again.");
    }
    continueAfterSignIn(router).catch((err) => {
      setBusy(false);
      setError(err.message);
    });
  }

  async function useAnotherAccount() {
    await signOut();
    router.replace("/sign-in");
  }

  const enrolling = mode === "enrol";
  return (
    <Screen>
      <TopBar title="Two-step verification" back="/sign-in"
        right={mode === "demo" ? <Pill tone="amber" size="sm">Demo</Pill> : undefined} />
      <PageTitle sub={enrolling
        ? "Add EarnSure to an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password."
        : "Enter the 6-digit code from your authenticator app."}>
        {enrolling ? "Set up two-step verification" : "Enter your code"}
      </PageTitle>

      {mode === "loading" && !error && <Loading />}

      {enrolling && enrolment && (
        <Card className="flex flex-col items-center gap-3 p-[18px]">
          <div className="text-[14px] font-medium text-muted">1. Scan this code in your app</div>
          <div className="rounded-tile border border-[#ECECF0] bg-white p-3">
            <QRCodeSVG value={enrolment.uri} size={168} marginSize={0} title="Authenticator set-up code" />
          </div>
          <details className="w-full text-center text-[13px] text-muted">
            <summary className="cursor-pointer font-medium text-primary">Can&apos;t scan? Enter a key instead</summary>
            <code className="mt-2 block break-all rounded-[14px] bg-soft px-3 py-2 text-[13px] text-ink">{enrolment.secret}</code>
          </details>
        </Card>
      )}

      {mode !== "loading" && (
        <form onSubmit={submit} className="flex grow flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="code" className="text-[14px] font-medium text-muted">
              {enrolling ? "2. Enter the 6-digit code it shows" : "Authenticator code"}
            </label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(null); }} className={codeCls} />
            {error && <p role="alert" className="m-0 text-[13px] font-medium text-red">{error}</p>}
            {mode === "demo" && (
              <button type="button" onClick={() => { setCode(DEMO_CODE); setError(null); }}
                className="self-start text-[13px] font-medium text-primary">Fill demo code ({DEMO_CODE})</button>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-tile bg-soft p-4 text-[13px] leading-normal text-sub">
            <IconCircle size={32} className="bg-white"><Icon name="shield" size={16} stroke="#17756B" width={1.9} /></IconCircle>
            <span>
              {mode === "demo"
                ? "Sign-in is switched off for this demo. This screen shows the step without checking a real code."
                : "Codes change every 30 seconds, so a stolen password alone can't open your account."}
            </span>
          </div>

          <div className="grow" />
          <Button type="submit" disabled={busy || code.length !== 6}>{busy ? "Checking…" : "Verify"}</Button>
          {mode === "demo" ? (
            <Button variant="secondary" onClick={() => router.push("/consent")}>Skip</Button>
          ) : (
            <button type="button" onClick={useAnotherAccount} className="min-h-11 text-[14px] font-medium text-muted">
              Use a different Google account
            </button>
          )}
        </form>
      )}
      {mode === "loading" && error && <ErrorBox message={error} />}
    </Screen>
  );
}
