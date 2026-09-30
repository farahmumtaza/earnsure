"use client";

import { useEffect, useState } from "react";
import { api, useApi, type Trends } from "@/lib/api";
import { savePrefs } from "@/lib/prefs";
import IncomeChart from "@/components/IncomeChart";
import { BottomNav, Card, ErrorBox, Icon, IconCircle, Loading, Pill, Screen, Tile, TopBar } from "@/components/ui";

function NoteEditor({ t }: { t: Trends }) {
  const [note, setNote] = useState(t.note.note ?? "");
  const [include, setInclude] = useState(t.note.include_on_proof);
  const [label, setLabel] = useState(t.note.label);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(nextNote = note, nextInclude = include) {
    if (!t.note.period_start || !nextNote.trim()) return;
    setStatus("saving");
    try {
      const r = await api<{ label: string }>("/trends/note", {
        method: "PUT",
        body: { period_start: t.note.period_start, note: nextNote, include_on_proof: nextInclude },
      });
      setLabel(r.label);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    savePrefs({ include_note: include });
  }, [include]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <label htmlFor="why" className="text-[14px] font-medium text-muted">Your note</label>
        <textarea id="why" rows={2} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)}
          onBlur={() => save()}
          className="resize-none rounded-[20px] border border-field-line bg-field px-4 py-3 text-[14px]" />
        <span className="min-h-4 text-[12px] text-muted" aria-live="polite">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Could not save, try again" : ""}
        </span>
      </div>
      {label && (
        <div className="flex flex-col gap-1 rounded-[20px] border border-[#E4DAFB] bg-violet-soft px-3.5 py-3">
          <span className="text-[12px] font-medium text-muted">Shown on your proof as</span>
          <span className="text-[14px]">&ldquo;{label}&rdquo; <Pill tone="teal" size="sm">User-provided</Pill></span>
        </div>
      )}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] font-medium">
        <input type="checkbox" checked={include} className="m-0 h-5 w-5 accent-primary"
          onChange={(e) => {
            setInclude(e.target.checked);
            save(note, e.target.checked);
          }} />
        Include this note on my proof page
      </label>
    </>
  );
}

export default function TrendsPage() {
  const { data: t, error, reload } = useApi<Trends>("/trends");
  const lean = t?.lean_periods[0];

  return (
    <Screen nav>
      <TopBar title="Trends" back="/home" />
      <h1 className="m-0 text-[32px] leading-[1.1]">Your weekly income</h1>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!t && !error && <Loading />}
      {t && (
        <>
          <Card className="flex flex-col gap-3 p-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-[16px] font-medium tracking-[-0.01em]">Last {t.weeks.length} weeks</span>
              <Pill size="sm">{t.period}</Pill>
            </div>
            <IncomeChart dependable={t.dependable.value} dependableLabel={t.dependable.display}
              weeks={t.weeks.map((w) => ({ label: w.label, month: w.month, amount: w.amount.value, display: w.amount.display, lean: w.lean }))} />
            <div className="flex flex-wrap gap-3.5 text-[12px] text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-bar" />Weekly income</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-lean" />Lean week</span>
              <span className="flex items-center gap-1.5 font-medium text-primary-dark">
                <span className="w-3.5 border-t-[1.5px] border-dashed border-primary" />{t.dependable.display} dependable
              </span>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-2.5">
            <Tile className="flex items-center gap-3 p-3.5">
              <IconCircle className="border border-field-line bg-white"><Icon name="dip" stroke="#95600C" /></IconCircle>
              <div className="flex min-w-0 flex-col gap-px">
                <span className="text-[12px] font-medium text-sub">Lean periods</span>
                <span className="text-[24px] font-semibold tracking-[-0.03em]">{t.lean_periods.length}</span>
                {lean && <span className="text-[11px] text-muted">{lean.weeks} weeks · {lean.range}</span>}
              </div>
            </Tile>
            <Tile className="flex items-center gap-3 p-3.5">
              <IconCircle className="border border-field-line bg-white"><Icon name="recover" stroke="#17756B" /></IconCircle>
              <div className="flex min-w-0 flex-col gap-px">
                <span className="text-[12px] font-medium text-sub">Back to usual in</span>
                <span className="text-[24px] font-semibold tracking-[-0.03em] text-green">
                  {lean?.weeks_to_recover != null ? `${lean.weeks_to_recover} wks` : "–"}
                </span>
                {lean?.recovered_by && <span className="text-[11px] text-muted">Recovered by {lean.recovered_by}</span>}
              </div>
            </Tile>
          </div>

          {t.drops.length > 0 && (
            <Card className="flex flex-col gap-3 p-[18px]">
              <div className="text-[16px] font-medium tracking-[-0.01em]">Weeks with a big drop</div>
              <div className="flex flex-col gap-2 text-[14px]">
                {t.drops.map((w) => (
                  <div key={w.week_start} className="flex justify-between">
                    <span>{w.label}</span>
                    <span className="font-semibold">{w.amount.display}</span>
                  </div>
                ))}
              </div>
              <NoteEditor t={t} />
            </Card>
          )}
          <p className="m-0 text-[13px] leading-normal text-muted">
            The higher weeks in July were the mid-year break.
          </p>
        </>
      )}
      <BottomNav active="Trends" />
    </Screen>
  );
}
