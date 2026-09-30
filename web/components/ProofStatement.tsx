"use client";

import type { ReactNode } from "react";
import type { PublicProof, Snapshot } from "@/lib/api";
import IncomeChart from "./IncomeChart";
import { Card, Icon, IconCircle, Logo, Pill, type IconName } from "./ui";

const BANNERS: Record<PublicProof["state"] | "preview", { cls: string; icon: IconName; text: (d: string) => ReactNode }> = {
  verified: {
    cls: "bg-[#EAF8F5] border-[#BFE6DF] text-[#0F4F48]", icon: "shieldCheck",
    text: (d) => <><b className="font-semibold">Genuine and unchanged.</b> Signature checked {d}.</>,
  },
  revoked: {
    cls: "bg-soft border-line text-sub", icon: "x",
    text: () => <><b className="font-semibold">This link has been switched off</b> by the applicant.</>,
  },
  expired: {
    cls: "bg-amber-bg border-amber-line text-amber", icon: "warn",
    text: () => <><b className="font-semibold">This proof has expired.</b> Ask the applicant for a new link.</>,
  },
  invalid: {
    cls: "bg-red-bg border-red-line text-red-ink", icon: "warn",
    text: () => <><b className="font-semibold">Could not verify.</b> This statement may have been changed. Do not rely on it.</>,
  },
  preview: {
    cls: "bg-violet-soft border-highlight text-primary-dark", icon: "proof",
    text: () => <><b className="font-semibold">Preview.</b> Not signed yet. Create a share link to sign it.</>,
  },
};

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between py-[11px] text-[14px] ${last ? "" : "border-b border-hair"}`}>
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

/** Screen 11: the only thing a landlord ever sees. */
export default function ProofStatement({ state, checked, snapshot: s, footer }: {
  state: PublicProof["state"] | "preview"; checked: string; snapshot?: Snapshot; footer?: ReactNode;
}) {
  const b = BANNERS[state];
  return (
    <div className="flex min-h-dvh flex-col gap-4 px-5 pb-7 pt-5">
      <div className="flex items-center gap-2.5">
        <Logo size={44} />
        <span className="text-[16px] font-semibold tracking-[-0.01em]">EarnSure</span>
        <span className="ml-auto"><Pill tone="grey" size="md">For the landlord or agent</Pill></span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[30px] leading-[1.1]">Verified Cash Flow Statement</h1>
        {s && <div className="text-[13px] font-medium text-muted">No. {s.statement_no}</div>}
      </div>

      <div className={`flex items-center gap-3 rounded-full border py-2 pl-2 pr-4 ${b.cls}`} role="status">
        <IconCircle size={40} className="bg-white"><Icon name={b.icon} size={19} width={1.9} /></IconCircle>
        <span className="text-[14px] leading-[1.4]">{b.text(checked)}</span>
      </div>

      {s && state !== "invalid" && state !== "revoked" && (
        <>
          <Card className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 px-[18px] py-4 text-[14px]">
            <span className="text-muted">Applicant</span><span className="font-medium">{s.applicant_display}</span>
            <span className="text-muted">Data source</span><span className="font-medium">{s.data_source}</span>
            <span className="text-muted">Period</span><span className="font-medium">{s.period}</span>
            <span className="text-muted">Issued</span><span className="font-medium">{s.issued_display}</span>
            <span className="text-muted">Valid until</span><span className="font-medium">{s.valid_until_display}</span>
            <span className="text-muted">Confidence</span><span className="font-medium">{s.confidence}</span>
          </Card>

          <div className="flex flex-col gap-2 rounded-card bg-soft p-[18px]">
            <span className="text-[14px] font-medium text-muted">For rent of {s.rent_weekly}/week</span>
            <div className="flex items-center gap-3">
              <span className="text-[48px] font-semibold leading-none tracking-[-0.04em]">{s.sim_pass_rate}</span>
              <Pill tone={s.label_colour}>{s.label}</Pill>
            </div>
            <span className="text-[13px] leading-[1.45] text-sub">
              Share of 2,000 simulated years in which the applicant&apos;s cash flow covered this rent without running out.
            </span>
          </div>

          <div className="flex flex-col px-1">
            <Row label="Dependable weekly income" value={s.dependable} />
            <Row label="Typical left after regular costs" value={`${s.typical_left}/wk`} />
            <Row label={`Rent paid, past ${s.rent_paid_weeks.split(" of ")[1]} weeks`} value={s.rent_paid_weeks} />
            <Row label="Rent as share of dependable income" value={s.share} />
            <Row label="Savings buffer" value={`${s.buffer_weeks} weeks`} last />
          </div>

          {s.weekly_series && (
            <Card className="p-4">
              <div className="mb-1 text-[14px] font-medium text-muted">Weekly income, {s.weekly_series.length} weeks</div>
              <IncomeChart height={120} dependable={Number(s.dependable.replace(/[^0-9.]/g, ""))} dependableLabel={s.dependable}
                weeks={s.weekly_series.map((v, i) => ({ label: `Week ${i + 1}`, month: "", amount: v, display: `$${v.toLocaleString("en-AU")}`, lean: false }))} />
            </Card>
          )}

          {s.note_label && (
            <div className="flex flex-col gap-1 rounded-[22px] border border-[#E4DAFB] bg-violet-soft px-4 py-3.5">
              <span className="text-[12px] font-medium text-[#0E6573]">Note from the applicant · user-provided</span>
              <span className="text-[14px]">{s.note_label}</span>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col gap-1 text-[13px] leading-normal text-muted">
        <span>
          <b className="font-semibold text-sub">Not included:</b> transactions, merchants, employers, account numbers.
        </span>
        <span>An indicative guide based on the applicant&apos;s bank data. It is not a credit check or lending decision.</span>
      </div>
      <div className="grow" />
      {footer}
    </div>
  );
}
