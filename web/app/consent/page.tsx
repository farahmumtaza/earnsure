"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button, Card, ErrorBox, Icon, IconCircle, PageTitle, Screen, SectionLabel, TopBar } from "@/components/ui";

const DURATIONS = [
  { days: 30, label: "Just this once (30 days)", short: "30 days" },
  { days: 90, label: "90 days, synced weekly", short: "90 days" },
  { days: 365, label: "12 months", short: "12 months" },
] as const;

function Row({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[15px]">
      <IconCircle size={28} className={ok ? "bg-lavender" : "bg-red-bg"}>
        <Icon name={ok ? "check" : "x"} size={ok ? 15 : 14} stroke={ok ? "#4B3CC4" : "#B0381F"} width={2.5} />
      </IconCircle>
      <span>{children}</span>
    </div>
  );
}

export default function Consent() {
  const router = useRouter();
  const [days, setDays] = useState<30 | 90 | 365>(90);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const short = DURATIONS.find((d) => d.days === days)!.short;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api("/session", { method: "POST" });
      await api("/consent", { method: "POST", body: { consent_days: days } });
      router.push("/connect");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save consent");
      setBusy(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Step 1 of 3" back="/" />
      <PageTitle sub="Here's exactly what we'll see, for how long, and how to stop it.">Before we connect</PageTitle>

      <Card className="flex flex-col gap-2.5 p-[18px]">
        <SectionLabel>What we&apos;ll access</SectionLabel>
        <Row ok>Account names, types and balances</Row>
        <Row ok>Your transaction history</Row>
      </Card>

      <fieldset className="m-0 flex flex-col gap-0.5 rounded-card border-0 bg-soft px-[18px] py-4">
        <legend className="float-left mb-1 w-full p-0 text-[14px] font-medium text-muted">How long</legend>
        {DURATIONS.map((d) => (
          <label key={d.days} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
            <input type="radio" name="dur" checked={days === d.days} onChange={() => setDays(d.days)}
              className="m-0 h-5 w-5 accent-primary" />
            {d.label}
          </label>
        ))}
      </fieldset>

      <Card className="flex flex-col gap-2.5 p-[18px]">
        <SectionLabel>What we never keep or share</SectionLabel>
        <Row ok={false}>Your bank login or password</Row>
        <Row ok={false}>Individual transactions, on any page you share</Row>
        <Row ok={false}>Your employers or where your income comes from</Row>
      </Card>

      <div className="flex items-start gap-3 text-[14px] leading-[1.45] text-sub">
        <IconCircle size={36} className="bg-mint">
          <Icon name="shield" size={17} stroke="#17756B" width={1.9} />
        </IconCircle>
        <span>Withdraw access any time in Settings or in your bank&apos;s app. Data is shared through the Consumer Data Right.</span>
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px] font-medium">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
          className="m-0 mt-px h-5 w-5 accent-primary" />
        I agree to share this data with EarnSure for {short}
      </label>

      {error && <ErrorBox message={error} />}
      <div className="grow" />
      <Button onClick={submit} disabled={!agree || busy}>{busy ? "Saving…" : "Continue to my bank"}</Button>
    </Screen>
  );
}
