"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accessToken, signInRoute } from "./auth";

/** Money and percentages always arrive pre-formatted; the UI only renders `display`. */
export type Money = { value: number; display: string };
export type Pct = Money & { whole: number };
export type Tone = "green" | "amber" | "red";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  // With sign-in on, identify the user with their Supabase token; otherwise the demo cookie does
  const token = await accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? "GET",
    credentials: "include",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new ApiError(res.status, typeof detail === "string" ? detail : "Request failed");
  }
  return res.json() as Promise<T>;
}

/**
 * If the API said "not signed in" (401) or "MFA needed" (403), send the user to
 * the right screen: Welcome in demo mode, or the sign-in / MFA pages. Returns
 * true when it handled the error.
 */
export function handleAuthError(e: unknown, router: { replace: (href: string) => void }): boolean {
  if (!(e instanceof ApiError)) return false;
  const mfa = e.status === 403 && e.message === "mfa_required";
  if (e.status !== 401 && !mfa) return false;
  signInRoute(mfa ? "mfa" : "signed-out").then((href) => router.replace(href));
  return true;
}

/** GET with loading/error state. Auth errors redirect (see handleAuthError). */
export function useApi<T>(path: string | null) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let live = true;
    api<T>(path)
      .then((d) => live && (setData(d), setError(null)))
      .catch((e: unknown) => {
        if (!live) return;
        if (!handleAuthError(e, router)) setError(e instanceof Error ? e.message : "Something went wrong");
      });
    return () => {
      live = false;
    };
  }, [path, tick, router]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading: !data && !error, reload, setData };
}

// --- Response types (TD §9) -------------------------------------------------

export type Streams = {
  period: string;
  income: { key: string; name: string; detail: string; tag: string; typical: Money }[];
  outgoing: { key: string; name: string; detail: string; typical: Money }[];
  not_counted: { transfers: { count: number; total: Money }; refunds: { count: number; total: Money } };
  needs_check: number;
};

export type ConfirmItem = {
  txn_id: string;
  description: string;
  initials: string;
  amount: Money;
  detail: string;
  label: string | null;
  note: string | null;
};
export type Confirmations = { items: ConfirmItem[]; options: { category: string; label: string }[] };

export type Health = {
  greeting: string;
  week_label: string;
  status: "Stable" | "Watch" | "Tight";
  explanation: { headline: string; body: string; source: string };
  dependable: Money;
  typical: Money;
  regular_outflows: Money;
  typical_left: Money;
  lowest_left: Money;
  buffer_weeks: Money;
  balance: Money;
  account_count: number;
  safe_to_spend: Money;
  top_up: Money;
  lean_alert: { title: string; body: string };
};

export type Week = { week_start: string; label: string; month: string; amount: Money; lean: boolean };
export type Trends = {
  period: string;
  weeks: Week[];
  dependable: Money;
  lean_periods: { range: string; weeks: number; weeks_to_recover: number | null; recovered_by: string | null }[];
  drops: Week[];
  note: {
    period_start: string | null;
    note: string | null;
    include_on_proof: boolean;
    label: string | null;
    month_label?: string;
  };
};

export type AffordResult = {
  type: string;
  amount: Money;
  frequency: string;
  weekly_cost: Money;
  share: Pct;
  sim_pass_rate: Pct;
  share_passed: boolean;
  sim_passed: boolean;
  label: string;
  colour: Tone;
  summary: string;
};
export type Afford = { result: AffordResult; what_if: AffordResult[]; basis: string };

export type Snapshot = {
  statement_no: string;
  token: string;
  applicant_display: string;
  data_source: string;
  period: string;
  issued: string;
  valid_until: string;
  issued_display: string;
  valid_until_display: string;
  confidence: string;
  rent_weekly: string;
  share: string;
  sim_pass_rate: string;
  label: string;
  label_colour: Tone;
  dependable: string;
  typical_left: string;
  rent_paid_weeks: string;
  buffer_weeks: string;
  note_label?: string;
  weekly_series?: number[];
};

export type CurrentProof = {
  token: string;
  statement_no: string;
  url: string | null;
  valid_until: string;
  revoked: boolean;
  opened: { count: number; text: string; last: string | null };
  answers: string;
};

export type PublicProof = {
  state: "verified" | "revoked" | "expired" | "invalid";
  checked: string;
  snapshot?: Snapshot;
};

export function shareUrl(token: string, url: string | null) {
  if (url) return url;
  return typeof window !== "undefined" ? `${window.location.origin}/p/${token}` : `/p/${token}`;
}
