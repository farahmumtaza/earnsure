"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type Snapshot, handleAuthError } from "@/lib/api";
import { loadPrefs, savePrefs, type ProofPrefs } from "@/lib/prefs";
import ProofStatement from "@/components/ProofStatement";
import { BottomNav, Button, Card, ErrorBox, Loading, PageTitle, Pill, Screen, TopBar } from "@/components/ui";

export default function ProofSettings() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<ProofPrefs | null>(null);
  const [preview, setPreview] = useState<Snapshot | null>(null);
  const [showLandlord, setShowLandlord] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // sessionStorage only exists in the browser, so prefs load after mount
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setPrefs(loadPrefs()), []);

  // Re-render the preview from the server whenever a setting changes
  useEffect(() => {
    if (!prefs) return;
    let live = true;
    api<{ snapshot: Snapshot }>("/proofs/preview", { method: "POST", body: prefs })
      .then((r) => live && setPreview(r.snapshot))
      .catch((e) => {
        if (handleAuthError(e, router)) return;
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [prefs, router]);

  function update(patch: Partial<ProofPrefs>) {
    setPrefs(savePrefs(patch));
  }

  async function create() {
    if (!prefs) return;
    setBusy(true);
    setError(null);
    try {
      await api("/proofs", { method: "POST", body: prefs });
      router.push("/share");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the link");
      setBusy(false);
    }
  }

  if (showLandlord && preview)
    return (
      <ProofStatement state="preview" checked="" snapshot={preview}
        footer={<Button variant="secondary" onClick={() => setShowLandlord(false)}>Back to settings</Button>} />
    );

  return (
    <Screen nav>
      <TopBar title="Proof" back="/afford" />
      <PageTitle sub="Choose what goes on it. The landlord sees only this page.">Your proof page</PageTitle>
      {error && <ErrorBox message={error} />}
      {!preview && !error && <Loading />}
      {preview && prefs && (
        <>
          <Card highlight="violet" className="flex flex-col gap-3 p-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-muted">Preview</span>
              <Pill tone="green" size="sm">Bank-sourced</Pill>
            </div>
            <div className="text-[19px] font-medium leading-tight tracking-[-0.02em]">
              Rent of {preview.rent_weekly}/week:{preview.label.toLowerCase()}
            </div>
            <div className="flex flex-col gap-2 text-[14px]">
              {[
                ["Dependable weekly income", preview.dependable],
                ["Typical left after regular costs", `${preview.typical_left}/wk`],
                ["Rent paid", `${preview.rent_paid_weeks} wks`],
                ["Savings buffer", `${preview.buffer_weeks} wks`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between"><span className="text-muted">{k}</span><span className="font-semibold">{v}</span></div>
              ))}
            </div>
          </Card>

          <Card className="px-[18px] py-1">
            <label className="flex cursor-pointer items-start gap-3 border-b border-hair py-3.5">
              <input type="checkbox" checked={prefs.show_chart} onChange={(e) => update({ show_chart: e.target.checked })}
                className="m-0 mt-px h-5 w-5 accent-primary" />
              <span>
                <span className="block text-[15px] font-medium">Show weekly income chart</span>
                <span className="block text-[13px] leading-[1.45] text-muted">
                  Off by default. Week-by-week amounts show more than a landlord needs.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 border-b border-hair py-3.5">
              <input type="checkbox" checked={prefs.include_note} onChange={(e) => update({ include_note: e.target.checked })}
                className="m-0 mt-px h-5 w-5 accent-primary" />
              <span>
                <span className="block text-[15px] font-medium">Include my note about June</span>
                <span className="block text-[13px] text-muted">
                  {preview.note_label ? "Shown as user-provided" : "No note to include. Add one on Trends"}
                </span>
              </span>
            </label>
            <div className="flex items-center gap-3 py-3">
              <label htmlFor="valid" className="grow text-[15px] font-medium">Valid for</label>
              <select id="valid" value={prefs.valid_days} onChange={(e) => update({ valid_days: Number(e.target.value) as 7 | 14 | 30 })}
                className="min-h-11 rounded-full border border-field-line bg-field px-3.5 text-[15px]">
                <option value={30}>30 days</option><option value={14}>14 days</option><option value={7}>7 days</option>
              </select>
            </div>
          </Card>

          <div className="flex flex-col gap-2 rounded-card bg-soft px-[18px] py-4">
            <div className="text-[14px] font-medium text-muted">Never on your proof</div>
            <div className="text-[14px] leading-relaxed text-sub">
              Transactions · Merchants · Employers and platforms · Money sent home · Account numbers
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={create} disabled={busy}>{busy ? "Signing…" : "Create share link"}</Button>
            <Button variant="secondary" onClick={() => setShowLandlord(true)}>Preview as the landlord</Button>
          </div>
        </>
      )}
      <BottomNav active="Proof" />
    </Screen>
  );
}
