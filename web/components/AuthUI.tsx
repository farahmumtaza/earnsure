"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getAuthConfig, signOut, type AuthConfig } from "@/lib/auth";
import { clearPrefs } from "@/lib/prefs";

/** Google's multi-colour "G", for the sign-in button. */
export function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

/** Loads the sign-in switch from the API (AUTH_ENABLED). null while loading. */
export function useAuthConfig(): AuthConfig | null {
  const [cfg, setCfg] = useState<AuthConfig | null>(null);
  useEffect(() => {
    getAuthConfig().then(setCfg);
  }, []);
  return cfg;
}

/**
 * After a real sign-in: make sure the user has a session, then continue.
 * First visit goes to Consent; a returning user goes straight Home.
 */
export async function continueAfterSignIn(router: { replace: (href: string) => void }) {
  const r = await api<{ new: boolean }>("/session", { method: "POST" });
  if (r.new) clearPrefs();
  router.replace(r.new ? "/consent" : "/home");
}

/** "Sign out" link, shown only when real sign-in is on. */
export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const cfg = useAuthConfig();
  if (!cfg?.enabled) return null;
  return (
    <button type="button" className={`min-h-11 text-[14px] font-medium text-red ${className}`}
      onClick={async () => {
        await signOut();
        clearPrefs();
        router.replace("/");
      }}>
      Sign out
    </button>
  );
}
