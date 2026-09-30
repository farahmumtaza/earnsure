"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authStep, getSupabase } from "@/lib/auth";
import { continueAfterSignIn } from "@/components/AuthUI";
import { ButtonLink, ErrorBox, Loading, Screen } from "@/components/ui";

/** Google → Supabase sends the user back here with a one-time code (PKCE). */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const sb = await getSupabase();
      if (!sb) return router.replace("/sign-in");
      const url = new URL(window.location.href);
      const failed = url.searchParams.get("error_description") ?? url.searchParams.get("error");
      if (failed) return setError(failed);
      // supabase-js usually exchanges the code itself on load; do it here if it hasn't
      const { data } = await sb.auth.getSession();
      const code = url.searchParams.get("code");
      if (!data.session && code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) return setError(error.message);
      }
      const step = await authStep();
      if (step === "signed-out") return setError("Sign-in didn't complete. Please try again.");
      if (step === "done") return continueAfterSignIn(router);
      router.replace("/sign-in/mfa");
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : "Sign-in failed"));
  }, [router]);

  return (
    <Screen>
      {error ? (
        <>
          <ErrorBox message={error} />
          <ButtonLink href="/sign-in">Back to sign in</ButtonLink>
        </>
      ) : (
        <Loading label="Signing you in…" />
      )}
    </Screen>
  );
}
