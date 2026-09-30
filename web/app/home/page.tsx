"use client";

import Link from "next/link";
import { useApi, type Health } from "@/lib/api";
import { BottomNav, Card, ErrorBox, Icon, IconCircle, Loading, Pill, Screen, Tile } from "@/components/ui";
import { SignOutButton } from "@/components/AuthUI";

const STATUS_TONE = { Stable: "green", Watch: "amber", Tight: "red" } as const;

function Stat({ label, value, unit, sub, colour }: {
  label: string; value: string; unit?: string; sub: string; colour?: string;
}) {
  return (
    <Tile className="flex flex-col gap-1 p-4">
      <span className="text-[13px] font-medium text-sub">{label}</span>
      <span className="text-[28px] font-semibold tracking-[-0.03em]" style={{ color: colour }}>
        {value}
        {unit && <span className="text-[14px] font-medium tracking-normal text-muted">{unit}</span>}
      </span>
      <span className="text-[12px] leading-[1.4] text-muted">{sub}</span>
    </Tile>
  );
}

export default function Home() {
  const { data: h, error, reload } = useApi<Health>("/health");

  return (
    <Screen nav>
      <div className="flex items-center justify-between gap-3">
        <IconCircle size={52} className="bg-lavender text-[16px] font-semibold text-primary-dark">LN</IconCircle>
        <span className="text-[18px] font-medium tracking-[-0.01em]">Home</span>
        <button type="button" aria-label="Alerts, 1 new"
          className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full bg-btn">
          <Icon name="bell" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-primary" />
        </button>
      </div>

      {error && <ErrorBox message={error} onRetry={reload} />}
      {!h && !error && <Loading />}
      {h && (
        <>
          <div className="flex flex-col gap-1">
            <div className="text-[14px] text-muted">{h.week_label}</div>
            <h1 className="m-0 text-[34px] leading-[1.08]">{h.greeting}</h1>
          </div>

          {/* Feature 9 + 10: status and plain-language explanation */}
          <Card highlight="violet" className="flex flex-col gap-2.5 p-[18px]">
            <span className="self-start"><Pill tone={STATUS_TONE[h.status]}>{h.status}</Pill></span>
            <div className="text-[21px] font-medium leading-tight tracking-[-0.02em]">{h.explanation.headline}</div>
            <p className="m-0 text-[14px] leading-[1.55] text-muted">{h.explanation.body}</p>
            <span className="text-[12px] font-medium text-muted">Plain-language summary of your figures</span>
          </Card>

          <div className="grid grid-cols-2 gap-2.5">
            <Stat label="Dependable weekly income" value={h.dependable.display}
              sub={`Earned or more in 3 of 4 weeks · typical ${h.typical.display}`} />
            <Stat label="Left after regular costs" value={h.typical_left.display}
              sub={`Typical week · lowest ${h.lowest_left.display}`} />
            <Stat label="Safe to spend" value={h.safe_to_spend.display} unit="/wk" colour="#17756B"
              sub={`After costs and a ${h.top_up.display} savings top-up`} />
            <Stat label="Savings buffer" value={h.buffer_weeks.display} unit=" wks"
              colour={h.status === "Stable" ? "#17756B" : "#95600C"}
              sub={`${h.balance.display} across ${h.account_count} accounts`} />
          </div>

          {/* Feature 13 (roadmap): static lean-week warning */}
          <Card className="flex gap-3.5 p-4">
            <IconCircle className="bg-[#FDF0D8]"><Icon name="bell" stroke="#95600C" width={1.9} /></IconCircle>
            <div className="flex flex-col gap-1">
              <div className="text-[15px] font-medium">{h.lean_alert.title}</div>
              <div className="text-[14px] leading-normal text-muted">{h.lean_alert.body}</div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-2.5">
            <Link href="/afford"
              className="flex min-h-[132px] flex-col justify-between gap-5 rounded-card border border-hair bg-white p-[18px] text-ink no-underline shadow-card">
              <IconCircle size={52} className="bg-lavender"><Icon name="home" stroke="#111117" /></IconCircle>
              <span className="text-[18px] font-medium tracking-[-0.02em]">Check a rent</span>
            </Link>
            <Link href="/trends"
              className="flex min-h-[132px] flex-col justify-between gap-5 rounded-card border border-hair bg-white p-[18px] text-ink no-underline shadow-card">
              <IconCircle size={52} className="bg-mint"><Icon name="trends" stroke="#111117" /></IconCircle>
              <span className="text-[18px] font-medium tracking-[-0.02em]">See my trends</span>
            </Link>
          </div>
        </>
      )}
      {/* Only shows when real sign-in is on (AUTH_ENABLED=true) */}
      <SignOutButton className="self-center" />
      <BottomNav active="Home" />
    </Screen>
  );
}
