"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Afford, type AffordResult, type Tone, handleAuthError } from "@/lib/api";
import { loadPrefs, savePrefs } from "@/lib/prefs";
import { BottomNav, Button, ButtonLink, Card, ErrorBox, Icon, IconCircle, Pill, Screen, TopBar } from "@/components/ui";

const TONE_TEXT: Record<Tone, string> = { green: "#17756B", amber: "#6B4508", red: "#B0381F" };
const TONE_BG: Record<Tone, string> = { green: "bg-mint", amber: "bg-amber-bg", red: "bg-red-bg" };
const selectCls = "min-h-12 rounded-full border border-field-line bg-field px-3.5 text-[15px]";

function Meter({ label, pct, marker, tone, caption }: {
  label: string; pct: { display: string; whole: number }; marker: number; tone: Tone; caption: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[14px]">
        <span className="font-medium">{label}</span>
        <span className="font-semibold">{pct.display}</span>
      </div>
      <div className="relative h-2 rounded-full bg-track">
        <div className="h-2 rounded-full" style={{ width: `${Math.min(pct.whole, 100)}%`, background: TONE_TEXT[tone] }} />
        <div className="absolute -top-1 h-4 w-0.5 rounded-sm bg-ink" style={{ left: `${marker}%` }} aria-hidden="true" />
      </div>
      <div className="text-[12px] text-muted">{caption}</div>
    </div>
  );
}

function ResultCard({ r }: { r: AffordResult }) {
  const t1: Tone = r.share_passed ? "green" : "red";
  const t2: Tone = r.sim_passed ? "green" : "red";
  const what = r.type === "Rent" ? "rent" : r.type.toLowerCase();
  const per = { Weekly: "/week", Fortnightly: "/fortnight", Monthly: "/month" }[r.frequency];
  return (
    <Card highlight={r.colour} className="flex flex-col gap-3.5 p-[18px]">
      <div className="flex items-center gap-3">
        <IconCircle size={48} className={TONE_BG[r.colour]}>
          <Icon name={r.colour === "green" ? "check" : "warn"} size={22} stroke={TONE_TEXT[r.colour]} width={2.2} />
        </IconCircle>
        <div>
          <div className="text-[22px] font-semibold tracking-[-0.02em]" style={{ color: TONE_TEXT[r.colour] }}>{r.label}</div>
          <div className="text-[13px] text-muted">{r.amount.display}{per} {what} · {r.summary}</div>
        </div>
      </div>
      <Meter label="Share of dependable income" pct={r.share} marker={30} tone={t1}
        caption="Marker = 30% housing affordability benchmark" />
      <Meter label="Simulated years covered" pct={r.sim_pass_rate} marker={90} tone={t2}
        caption={`Your savings never ran out in ${r.sim_pass_rate.display} of 2,000 simulated years. Marker = 90% pass level`} />
    </Card>
  );
}

export default function AffordPage() {
  const router = useRouter();
  const [type, setType] = useState("Rent");
  const [frequency, setFrequency] = useState<"Weekly" | "Fortnightly" | "Monthly">("Weekly");
  const [amount, setAmount] = useState("$230");
  const [data, setData] = useState<Afford | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async (t: string, f: string, a: string) => {
    const value = Number(a.replace(/[^0-9.]/g, ""));
    if (!value || value <= 0) return setError("Enter an amount greater than $0");
    setBusy(true);
    setError(null);
    try {
      setData(await api<Afford>("/affordability", { method: "POST", body: { type: t, amount: value, frequency: f } }));
    } catch (e) {
      if (handleAuthError(e, router)) return;
      setError(e instanceof Error ? e.message : "Could not check");
    } finally {
      setBusy(false);
    }
  }, [router]);

  // Restore the last checked rent and run the check once on open
  useEffect(() => {
    const p = loadPrefs();
    const a = `$${p.rent_amount}`;
    // sessionStorage only exists in the browser, so the saved rent loads after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAmount(a);
    setFrequency(p.rent_frequency);
    check("Rent", p.rent_frequency, a);
  }, [check]);

  function createProof() {
    if (!data || data.result.type !== "Rent") return;
    savePrefs({ rent_amount: data.result.amount.value, rent_frequency: data.result.frequency as "Weekly" });
    router.push("/proof");
  }

  return (
    <Screen nav>
      <TopBar title="Afford" back="/home" />
      <h1 className="m-0 text-[32px] leading-[1.1]">Can I afford it?</h1>

      <Card className="p-[18px]">
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); check(type, frequency, amount); }}>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="what" className="text-[13px] font-medium text-muted">What is it</label>
              <select id="what" value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
                <option>Rent</option><option>Phone plan</option><option>Loan repayment</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="freq" className="text-[13px] font-medium text-muted">How often</label>
              <select id="freq" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)} className={selectCls}>
                <option>Weekly</option><option>Fortnightly</option><option>Monthly</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="amt" className="text-[13px] font-medium text-muted">Amount</label>
            <input id="amt" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="min-h-14 rounded-full border border-field-line bg-field px-5 text-[24px] font-semibold tracking-[-0.02em]" />
          </div>
          <Button type="submit" variant="black" className="min-h-[52px] text-[16px]" disabled={busy}>
            {busy ? "Checking…" : "Check"}
          </Button>
        </form>
      </Card>

      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <ResultCard r={data.result} />
          {data.what_if.length > 0 && (
            <div className="rounded-card bg-soft px-4 py-1.5">
              <div className="pb-1 pt-2.5 text-[14px] font-medium text-muted">What if the rent were…</div>
              {data.what_if.map((w, i) => (
                <div key={w.amount.display}
                  className={`flex min-h-[50px] items-center gap-2.5 ${i < data.what_if.length - 1 ? "border-b border-[#E8E8ED]" : ""}`}>
                  <span className="w-14 font-semibold">{w.amount.display}</span>
                  <span className="grow text-[13px] text-muted">{w.share.display} · {w.sim_pass_rate.display}</span>
                  <Pill tone={w.colour} size="sm">{w.label}</Pill>
                </div>
              ))}
            </div>
          )}
          <p className="m-0 text-[13px] leading-normal text-muted">An indicative guide, not a lending decision. {data.basis}</p>
          {data.result.type === "Rent" ? (
            <Button onClick={createProof}>Create proof for this rent</Button>
          ) : (
            <ButtonLink href="/proof" variant="secondary">Proof pages cover rent only</ButtonLink>
          )}
        </>
      )}
      <BottomNav active="Afford" />
    </Screen>
  );
}
