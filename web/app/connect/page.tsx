"use client";

import { useEffect, useMemo, useState } from "react";
import { api, handleAuthError } from "@/lib/api";
import { clearConnection, loadConnection, type Connection, type Institution } from "@/lib/prefs";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Card, ErrorBox, Icon, IconCircle, PageTitle, Pill, Screen, TopBar } from "@/components/ui";
import BankLogo from "@/components/BankLogo";

const COLOURS = ["bg-lavender text-primary-dark", "bg-mint text-green-ink", "bg-pink text-ink", "bg-amber-bg text-amber"];

type Upload = { filename: string; kind: string };

export default function Connect() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [banks, setBanks] = useState<Institution[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [conn, setConn] = useState<Connection | null>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coming back from the bank authorisation stub: show the connected accounts.
  // sessionStorage only exists in the browser, so this runs after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setConn(loadConnection()), []);

  useEffect(() => {
    api<{ institutions: Institution[] }>("/institutions")
      .then((r) => setBanks(r.institutions))
      .catch((e) => {
        if (handleAuthError(e, router)) return;
        setError("Could not load the list of banks");
      });
  }, [router]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (banks ?? []).filter((b) => b.name.toLowerCase().includes(q));
  }, [banks, query]);
  const bank = banks?.find((b) => b.id === selected);

  // Hand off to the (simulated) bank authorisation page, as a real CDR redirect would
  function connect() {
    if (selected) router.push(`/connect/${selected}`);
  }

  function changeBank() {
    clearConnection();
    setConn(null);
  }

  // Front-end dummy (feature 2): nothing is sent to the API; analysis uses the demo data
  async function uploadFile(file: File) {
    setError(null);
    const kind = file.name.split(".").pop()?.toUpperCase() ?? "";
    if (kind !== "CSV" && kind !== "PDF") return setError("Upload a CSV or PDF file");
    setUploading(true);
    await new Promise((r) => setTimeout(r, 1200));
    setUpload({ filename: file.name, kind });
    setUploading(false);
  }

  const done = !!conn || !!upload;

  return (
    <Screen>
      <TopBar title="Step 2 of 3" back="/consent" />
      <PageTitle sub="Link every account your money moves through, so we can tell transfers between them apart from real income.">
        Connect your accounts
      </PageTitle>

      {conn ? (
        <Card className="flex flex-col px-4 py-1.5">
          {conn.accounts.map((a) => (
            <div key={a.account_id} className="flex min-h-[68px] items-center gap-3 border-b border-hair">
              <BankLogo name={conn.institution.name} logo={conn.institution.logo} initials={conn.institution.initials} size={44} />
              <div className="grow">
                <div className="text-[15px] font-medium">{a.name}</div>
                <div className="text-[13px] text-muted">{a.institution} · {a.masked_number}</div>
              </div>
              <Pill tone="green">{a.status}</Pill>
            </div>
          ))}
          <div className="flex min-h-[60px] items-center gap-3 text-[15px] font-medium text-muted" aria-disabled="true">
            <IconCircle className="bg-btn"><Icon name="plus" size={18} /></IconCircle>
            <span className="grow">Add another account</span>
            <button type="button" onClick={changeBank} className="min-h-11 text-[13px] font-medium text-primary">
              Change bank
            </button>
          </div>
        </Card>
      ) : (
        <div className={`flex flex-col gap-2 ${upload || uploading ? "opacity-60" : ""}`}>
          <label htmlFor="bank" className="text-[14px] font-medium text-muted">Find your bank</label>
          <input id="bank" type="search" placeholder="Search banks" value={query} autoComplete="off"
            onChange={(e) => setQuery(e.target.value)} disabled={!!upload || uploading}
            className="min-h-[52px] rounded-full border border-field-line bg-field px-5 text-[15px]" />

          <Card className="px-2 py-1.5">
            {!banks && !error && <div className="px-2 py-4 text-[14px] text-muted">Loading banks…</div>}
            {banks && shown.length === 0 && (
              <div className="px-2 py-4 text-[14px] text-muted">No match. Try another name, or upload a statement below.</div>
            )}
            <div role="radiogroup" aria-label="Choose your bank">
              {shown.map((b, i) => {
                const on = b.id === selected;
                return (
                  <label key={b.id}
                    className={`flex min-h-[60px] cursor-pointer items-center gap-3 rounded-[20px] px-2 ${
                      on ? "bg-violet-soft" : ""} ${i < shown.length - 1 ? "border-b border-hair" : ""}`}>
                    <input type="radio" name="bank" value={b.id} checked={on} disabled={!!upload || uploading}
                      onChange={() => setSelected(b.id)} className="sr-only" />
                    <BankLogo name={b.name} logo={b.logo} initials={b.initials} fallbackClass={COLOURS[i % COLOURS.length]} />
                    <span className={`grow text-[15px] ${on ? "font-semibold" : "font-medium"}`}>{b.name}</span>
                    <span aria-hidden="true"
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] ${
                        on ? "border-primary bg-primary text-white" : "border-line"}`}>
                      {on && <Icon name="check" size={14} width={2.6} />}
                    </span>
                  </label>
                );
              })}
            </div>
          </Card>
          <p className="m-0 px-1 text-[12px] leading-normal text-muted">
            Demo only: no bank is contacted. Every bank loads the same sample data through the Consumer Data Right flow.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 text-[13px] text-muted">
        <span className="h-px grow bg-[#ECECF0]" />or<span className="h-px grow bg-[#ECECF0]" />
      </div>

      <label className={`flex items-start gap-3.5 rounded-card border-[1.5px] border-dashed border-[#CFC8F3] bg-[#FAF9FF] p-4 ${
        uploading || done ? "cursor-default" : "cursor-pointer"} ${conn ? "opacity-60" : ""} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary`}>
        <input type="file" accept=".csv,.pdf,text/csv,application/pdf" className="sr-only" disabled={uploading || done}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) uploadFile(f);
          }} />
        <IconCircle className="bg-pink"><Icon name="upload" /></IconCircle>
        <span className="flex min-w-0 grow flex-col gap-0.5">
          <span className="truncate text-[15px] font-medium">
            {upload ? upload.filename : uploading ? "Reading statement…" : "Upload a statement (CSV or PDF)"}
          </span>
          <span className="text-[13px] leading-[1.45] text-muted">
            {upload
              ? `${upload.kind} · marked “self-uploaded”, counts as lower confidence`
              : <>If your bank isn&apos;t listed. Uploaded statements are marked &ldquo;self-uploaded&rdquo; and count as lower confidence.</>}
          </span>
        </span>
        {upload && <Pill tone="amber">Uploaded</Pill>}
      </label>
      {upload && (
        <button type="button" onClick={() => setUpload(null)} className="-mt-2 self-end text-[13px] font-medium text-primary">
          Remove statement
        </button>
      )}

      {error && <ErrorBox message={error} />}
      <div className="grow" />
      {done ? (
        <>
          <div className="text-center text-[13px] text-muted">
            {conn ? `Fetched ${conn.transaction_count} transactions · ${conn.period}` : "Statement uploaded"}
          </div>
          <ButtonLink href="/found">Analyse my earnings</ButtonLink>
        </>
      ) : (
        <Button onClick={connect} disabled={!selected || uploading}>
          {bank ? `Connect to ${bank.name}` : "Choose your bank"}
        </Button>
      )}
    </Screen>
  );
}
