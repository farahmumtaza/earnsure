import { BottomNav, Card, Icon, IconCircle, Pill, Screen, TopBar } from "@/components/ui";
import { SignOutButton } from "@/components/AuthUI";

// Static screen (features 18 and 19): fixed prototype values, no logic.
const PERIODS = [
  { range: "31 Aug – 13 Sep", hours: "46 h", tag: "Near limit", tone: "amber" },
  { range: "17 – 30 Aug", hours: "40 h", tag: "OK", tone: "green" },
  { range: "6 – 19 Jul", hours: "62 h", tag: "Course break", tone: "grey" },
] as const;

export default function Rights() {
  return (
    <Screen nav>
      <TopBar title="Rights" back="/home" />
      <h1 className="m-0 text-[32px] leading-[1.1]">Work rights</h1>

      <div className="flex items-center gap-3 rounded-full bg-ink py-2 pl-2 pr-[18px] text-white">
        <IconCircle size={40} className="border border-[#3A3A46] bg-[#2A2A35]"><Icon name="lock" size={18} /></IconCircle>
        <span className="text-[14px] leading-[1.4]">Only you can see this page. Nothing here goes on your proof.</span>
      </div>

      <Card className="flex flex-col gap-3 p-[18px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[16px] font-medium tracking-[-0.01em]">Visa work hours</span>
          <Pill size="sm">14 – 27 Sep · study period</Pill>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[38px] font-semibold leading-none tracking-[-0.04em]">38</span>
          <span className="text-[15px] text-muted">of 48 hours this fortnight</span>
        </div>
        <div className="flex h-2 rounded-full bg-track"><div className="w-[79%] rounded-full bg-green" /></div>
        <div className="flex flex-col">
          {PERIODS.map((p) => (
            <div key={p.range} className="flex min-h-12 items-center gap-2.5 border-t border-hair text-[14px]">
              <span className="grow">{p.range}</span>
              <span className="font-semibold">{p.hours}</span>
              <Pill tone={p.tone} size="sm">{p.tag}</Pill>
            </div>
          ))}
        </div>
        <p className="m-0 text-[12px] leading-normal text-muted">
          Hours come from the rosters you enter; banks don&apos;t record hours. Current rule: 48 hours a fortnight during study
          periods, no limit in scheduled course breaks.{" "}
          <a href="https://www.studyaustralia.gov.au/en/plan-your-move/your-guide-to-visas/student-visa-subclass-500"
            target="_blank" rel="noreferrer" className="text-primary">Check the latest rule</a>
        </p>
      </Card>

      <Card className="flex flex-col gap-3 p-[18px]">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-medium tracking-[-0.01em]">Pay check</span>
          <Pill tone="amber" size="sm">Verification needed</Pill>
        </div>
        <div className="text-[14px] text-muted">Café wages · paid 25 Sep</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["$412", "Pay"], ["16 h", "Hours you entered"], ["$25.75", "Per hour"]].map(([v, l]) => (
            <div key={l} className="rounded-[20px] bg-soft px-1 py-3">
              <div className="text-[17px] font-semibold tracking-[-0.02em]">{v}</div>
              <div className="text-[11px] text-muted">{l}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[14px]">
          <span className="text-muted">Rate you selected (example)</span>
          <span className="font-semibold">[AWARD RATE]</span>
        </div>
        <p className="m-0 text-[13px] leading-normal text-muted">
          If your effective rate is more than 2% below the award rate for your role and level, we flag it so you can check.
          This is not a legal finding.
        </p>
        <a href="https://calculate.fairwork.gov.au/FindYourAward" target="_blank" rel="noreferrer"
          className="flex min-h-[52px] items-center justify-center rounded-full border border-line bg-white text-[16px] font-medium text-ink no-underline">
          Find my award at Fair Work
        </a>
      </Card>
      <SignOutButton className="self-center" />
      <BottomNav active="Rights" />
    </Screen>
  );
}
