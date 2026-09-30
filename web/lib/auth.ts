"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Optional sign-in. The API decides (AUTH_ENABLED in .env) and tells us via
 * GET /api/auth/config, so the switch lives in one place:
 *  - disabled: sign-in and MFA screens are skippable dummies, sessions are anonymous
 *  - enabled:  Google sign-in through Supabase, then authenticator-app MFA; every
 *              API call carries the Supabase access token
 */
export type AuthConfig = {
  enabled: boolean;
  require_mfa: boolean;
  supabase_url?: string;
  supabase_anon_key?: string;
};

/** Where the user is in the sign-in journey. */
export type AuthStep = "signed-out" | "enrol" | "verify" | "done";

let configPromise: Promise<AuthConfig> | null = null;
let client: SupabaseClient | null = null;

export function getAuthConfig(): Promise<AuthConfig> {
  configPromise ??= fetch("/api/auth/config", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { enabled: false, require_mfa: false }))
    .catch(() => {
      configPromise = null; // retry next time
      return { enabled: false, require_mfa: false };
    });
  return configPromise;
}

/** The Supabase client, or null when sign-in is disabled. */
export async function getSupabase(): Promise<SupabaseClient | null> {
  const cfg = await getAuthConfig();
  if (!cfg.enabled || !cfg.supabase_url || !cfg.supabase_anon_key) return null;
  client ??= createClient(cfg.supabase_url, cfg.supabase_anon_key, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

/** Current access token for API calls (refreshed automatically), or null. */
export async function accessToken(): Promise<string | null> {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authStep(): Promise<AuthStep> {
  const sb = await getSupabase();
  if (!sb) return "done";
  const { data } = await sb.auth.getSession();
  if (!data.session) return "signed-out";
  if (!(await getAuthConfig()).require_mfa) return "done";
  const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.data?.currentLevel === "aal2") return "done";
  const factors = await sb.auth.mfa.listFactors();
  return factors.data?.totp.length ? "verify" : "enrol";
}

/** Page to send someone to when the API says they aren't (fully) signed in. */
export async function signInRoute(reason: "signed-out" | "mfa" = "signed-out"): Promise<string> {
  const cfg = await getAuthConfig();
  if (!cfg.enabled) return "/";
  return reason === "mfa" ? "/sign-in/mfa" : "/sign-in";
}

export async function signOut() {
  const sb = await getSupabase();
  if (sb) await sb.auth.signOut();
}
