"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError, handleAuthError } from "@/lib/api";
import { saveConnection, type Connection, type Institution } from "@/lib/prefs";
import BankLogo from "@/components/BankLogo";
import { Button, ErrorBox, Icon, IconCircle, Loading, Pill, Spinner } from "@/components/ui";

/**
 * Stub of the CDR bank authorisation step (TD §8.1 placeholder).
 * In production the user is redirected to their bank's own page (system browser
 * sheet or the bank's app), proves who they are with a customer ID and a one-time
 * code, picks accounts, and is sent back. Here every step is simulated.
 */

type Detail = {
  institution: Institution;
  accounts: { account_id: string; name: string; masked_number: string }[];
  consent_days: number;
};
type Step = "redirect" | "identify" | "code" | "accounts" | "returning";

const DEMO_CUSTOMER_ID = "12345678";
const DEMO_CODE = "246810";
const STEP_NUMBER: Record<Step, number> = { redirect: 0, identify: 1, code: 2, accounts: 3, returning: 3 };
function FieldError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="m-0 text-[13px] font-medium text-red">{message}</p> : null;
}

const fieldCls = "min-h-14 rounded-full border border-field-line bg-field px-5 text-[18px] font-semibold tracking-[0.08em]";

function durationLabel(days: number) {
  return days === 365 ? "12 months" : `${days} days`;
}

export default function BankAuthorise() {
  const { bank: bankId } = useParams<{ bank: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [step, setStep] = useState<Step>("redirect");
  const [customerId, setCustomerId] = useState("");
  const [code, setCode] = useState("");
  const [shared, setShared] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Detail>(`/institutions/${encodeURIComponent(bankId)}`)
      .then((d) => {
        setDetail(d);
        setShared(Object.fromEntries(d.accounts.map((a) => [a.account_id, true])));
        setTimeout(() => setStep("identify"), 1400);
      })
      .catch((e) => {
        if (handleAuthError(e, router)) return;
        setError(e instanceof ApiError && e.status === 404 ? "We don't know that bank." : "Could not reach the bank.");
      });
  }, [bankId, router]);

  const bank = detail?.institution;
  const cancel = () => router.replace("/connect");

  function submitId(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6,10}$/.test(customerId)) return setError("Enter your customer ID (6 to 10 digits).");
    setError(null);
    setStep("code");
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (code !== DEMO_CODE) return setError(`That code doesn't match. For the demo, use ${DEMO_CODE}.`);
    setError(null);
    setStep("accounts");
  }

  async function share() {
    setError(null);
    setStep("returning");
    try {
      const conn = await api<Connection>("/connect", { method: "POST", body: { institution_id: bankId } });
      saveConnection(conn);
      router.replace("/connect");
    } catch (e) {
      if (handleAuthError(e, router)) return;
      setError(e instanceof Error ? e.message : "Could not connect");
      setStep("accounts");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-soft">
      {/* Mimics the secure browser sheet the real flow opens in */}
      <div className="flex items-center gap-3 border-b border-hair bg-white px-4 py-3">
        <button type="button" onClick={cancel} className="min-h-11 text-[15px] font-medium text-primary">Cancel</button>
        <div className="flex grow items-center justify-center gap-1.5 truncate rounded-full bg-soft px-3 py-2 text-[13px] text-sub">
          <Icon name="lock" size={14} width={2} />
          <span className="truncate">{bank ? `${bank.name} · secure sign-in` : "Secure sign-in"}</span>
        </div>
        <Pill tone="amber" size="sm">Demo</Pill>
      </div>

      <div className="flex grow flex-col gap-4 px-5 pb-7 pt-5">
        {error && !detail && <ErrorBox message={error} />}
        {!detail && !error && <Loading label="Contacting your bank…" />}

        {detail && bank && (
          <>
            {/* Progress through the bank's steps */}
            {step !== "redirect" && (
              <div className="flex gap-1.5" aria-label={`Step ${STEP_NUMBER[step]} of 3`}>
                {[1, 2, 3].map((n) => (
                  <div key={n} className={`h-1.5 grow rounded-full ${n <= STEP_NUMBER[step] ? "bg-primary" : "bg-track"}`} />
                ))}
              </div>
            )}

            {step === "redirect" && (
              <div className="flex grow flex-col items-center justify-center gap-5 text-center" role="status">
                <div className="flex items-center gap-3">
                  <IconCircle size={56} className="bg-primary"><Icon name="logo" size={28} stroke="#fff" width={2.6} /></IconCircle>
                  <span className="flex gap-1 text-primary" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${i * 150}ms` }} />
                    ))}
                  </span>
                  <BankLogo name={bank.name} logo={bank.logo} initials={bank.initials} size={56} />
                </div>
                <h1 className="m-0 text-[26px] leading-tight">Taking you to {bank.name} securely</h1>
                <p className="m-0 max-w-[300px] text-[15px] leading-normal text-muted">
                  You&apos;ll confirm who you are with {bank.name}. EarnSure never sees your password.
                </p>
              </div>
            )}

            {step !== "redirect" && (
              <div className="flex items-center gap-3">
                <BankLogo name={bank.name} logo={bank.logo} initials={bank.initials} size={48} />
                <div>
                  <div className="text-[13px] font-medium text-muted">Consumer Data Right</div>
                  <div className="text-[17px] font-semibold tracking-[-0.01em]">{bank.name}</div>
                </div>
              </div>
            )}

            {step === "identify" && (
              <form onSubmit={submitId} className="flex grow flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h1 className="m-0 text-[26px] leading-tight">Confirm it&apos;s you</h1>
                  <p className="m-0 text-[15px] leading-normal text-muted">
                    Enter your customer ID. We&apos;ll send a one-time code to the phone number {bank.name} has for you.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="cid" className="text-[14px] font-medium text-muted">Customer ID</label>
                  <input id="cid" inputMode="numeric" autoComplete="off" maxLength={10} value={customerId}
                    onChange={(e) => { setCustomerId(e.target.value.replace(/\D/g, "")); setError(null); }} className={fieldCls} />
                  <FieldError message={error} />
                  <button type="button" onClick={() => { setCustomerId(DEMO_CUSTOMER_ID); setError(null); }}
                    className="self-start text-[13px] font-medium text-primary">Use demo ID ({DEMO_CUSTOMER_ID})</button>
                </div>
                <div className="flex items-start gap-3 rounded-tile bg-white p-4 text-[13px] leading-normal text-sub">
                  <span className="shrink-0"><Icon name="shield" size={18} stroke="#17756B" width={1.9} /></span>
                  <span>You&apos;ll never be asked for your internet banking password when sharing data under the Consumer Data Right.</span>
                </div>
                <div className="grow" />
                <Button type="submit">Send code</Button>
              </form>
            )}

            {step === "code" && (
              <form onSubmit={submitCode} className="flex grow flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h1 className="m-0 text-[26px] leading-tight">Enter your one-time code</h1>
                  <p className="m-0 text-[15px] leading-normal text-muted">We sent a 6-digit code by SMS to •••• ••• 482.</p>
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="otp" className="text-[14px] font-medium text-muted">One-time code</label>
                  <input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(null); }}
                    className={`${fieldCls} text-center tracking-[0.4em]`} />
                  <FieldError message={error} />
                  <div className="flex justify-between text-[13px] font-medium">
                    <button type="button" onClick={() => { setCode(DEMO_CODE); setError(null); }} className="text-primary">Fill demo code ({DEMO_CODE})</button>
                    <button type="button" onClick={() => setError(null)} className="text-muted">Resend code</button>
                  </div>
                </div>
                <div className="grow" />
                <Button type="submit" disabled={code.length !== 6}>Verify</Button>
              </form>
            )}

            {(step === "accounts" || step === "returning") && (
              <div className="flex grow flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <h1 className="m-0 text-[26px] leading-tight">Share your data with EarnSure?</h1>
                  <p className="m-0 text-[15px] leading-normal text-muted">
                    For {durationLabel(detail.consent_days)}. You can stop sharing any time, here or in the EarnSure app.
                  </p>
                </div>

                <div className="flex flex-col gap-2 rounded-card bg-white p-[18px]">
                  <div className="text-[14px] font-medium text-muted">EarnSure will see</div>
                  {["Account name, type and balance", "Transactions and their details"].map((t) => (
                    <div key={t} className="flex items-center gap-3 text-[15px]">
                      <IconCircle size={26} className="bg-lavender"><Icon name="check" size={14} stroke="#4B3CC4" width={2.5} /></IconCircle>
                      {t}
                    </div>
                  ))}
                </div>

                <fieldset className="m-0 flex flex-col rounded-card border-0 bg-white px-[18px] py-2">
                  <legend className="float-left w-full pb-1 pt-2 text-[14px] font-medium text-muted">Choose accounts to share</legend>
                  {detail.accounts.map((a, i) => (
                    <label key={a.account_id}
                      className={`flex min-h-[60px] cursor-pointer items-center gap-3 ${i < detail.accounts.length - 1 ? "border-b border-hair" : ""}`}>
                      <input type="checkbox" checked={!!shared[a.account_id]} disabled={step === "returning"}
                        onChange={(e) => setShared({ ...shared, [a.account_id]: e.target.checked })}
                        className="m-0 h-5 w-5 accent-primary" />
                      <span className="grow">
                        <span className="block text-[15px] font-medium">{a.name}</span>
                        <span className="block text-[13px] text-muted">{a.masked_number}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {Object.values(shared).filter(Boolean).length < detail.accounts.length && (
                  <p className="m-0 text-[13px] leading-normal text-amber">
                    Sharing every account lets EarnSure tell transfers between them apart from real income.
                    (In this demo, both accounts are analysed either way.)
                  </p>
                )}

                {error && <ErrorBox message={error} />}
                <div className="grow" />
                <Button onClick={share} disabled={step === "returning" || !Object.values(shared).some(Boolean)}>
                  {step === "returning" ? <span className="flex items-center gap-2.5"><Spinner />Fetching your transactions…</span> : "Share and continue"}
                </Button>
                <Button variant="secondary" onClick={cancel} disabled={step === "returning"}>Don&apos;t share</Button>
              </div>
            )}

            <p className="m-0 text-center text-[12px] leading-normal text-muted">
              Simulated for the demo. No bank is contacted and nothing you type here is sent anywhere.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
