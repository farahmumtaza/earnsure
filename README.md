# EarnSure

Repository for EarnSure, developed for the 2026 FEIT Hackathon Festival.

EarnSure turns irregular student income (shifts, gig apps, freelance work) into one verified page a
landlord can trust: **dependable weekly income** plus a signed rent-affordability check.

- **`web/`**: Next.js (App Router, TypeScript, Tailwind) front end, one route per prototype screen
- **`api/`**: FastAPI backend. All figures come from deterministic Python in `api/earnsure/`
- **`supabase/migrations/`**: database schema (sessions, labels, notes, proofs)
- Open banking and the AI explanation are offline placeholders (`api/earnsure/providers/`)

## Run locally

```bash
make install   # Python venv + npm packages (needs python3.13 or 3.12)
make dev       # FastAPI on :8000, Next.js on http://localhost:3000
make test      # backend acceptance tests (TD §11)
make lint
```

Without `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` the API uses an in-memory store, so local dev
and CI need no database. Copy `.env.example` to `.env` to use Supabase locally.

## Deploy (Vercel + Supabase)

1. **Supabase:** create a free project in the Sydney region and run `supabase/migrations/001_init.sql`
   in the SQL editor. Copy the project URL and the **service-role** key.
2. **Vercel:** import this GitHub repo (leave Root Directory as the repo root). `vercel.json` defines
   two Services: Next.js from `web/` and FastAPI from `api/` at `/api/*`, region `syd1`.
3. **Environment variables** (Production and Preview): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `PROOF_SIGNING_SECRET` (`openssl rand -hex 32`), `APP_DOMAIN` (e.g. `earnsure.vercel.app`),
   `BANK_PROVIDER=dummy`, `EXPLANATION_PROVIDER=template`, `DEMO_SEED_TOKENS=true`.
4. Turn off Deployment Protection for Production so `/p/{token}` opens for a landlord without a login.

## Sign-in (optional): Google + two-step verification

One switch, read by the API and passed to the web app through `GET /api/auth/config`:

| `AUTH_ENABLED` | Behaviour |
|---|---|
| `false` (default) | Sign-in and MFA screens are labelled **Demo** and can be skipped (demo MFA code `123456`). Sessions are anonymous (cookie), as before. |
| `true` | "Continue with Google" signs in through Supabase Auth, then an authenticator app (TOTP) is required. Every API call except the public proof page needs the user's Supabase token with MFA passed (`aal2`). Each user gets their own data. |

`AUTH_REQUIRE_MFA=false` allows Google-only sign-in. The landlord page `/p/{token}` never needs sign-in.

To turn it on:
1. **Google Cloud Console:** OAuth consent screen (External; add test users while in Testing mode), then a
   **Web application** client with redirect URI `https://<project-ref>.supabase.co/auth/v1/callback` and
   JavaScript origins for your Vercel domain and `http://localhost:3000`.
2. **Supabase:** Authentication → Providers → Google (paste the client ID and secret). Authentication → URL
   Configuration: Site URL = your Vercel domain; Redirect URLs = `https://<your-domain>/**` and
   `http://localhost:3000/**`. Authenticator-app MFA is on by default.
3. **Database:** run `supabase/migrations/002_auth_user.sql` in the SQL editor.
4. **Env vars** (`.env` locally, Vercel for deploys): `AUTH_ENABLED=true`, `SUPABASE_ANON_KEY` (Project
   Settings → API → publishable/anon key), plus the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   Redeploy (or restart `make dev`) after changing them.

CI (`.github/workflows/ci.yml`) runs ruff + pytest and lint + typecheck + build on every PR and push to
`main`. Vercel deploys a preview for every PR and production on every merge to `main`.

## Demo script

Welcome → Consent (90 days) → Connect (pick a bank → simulated bank sign-in: customer ID `12345678`,
one-time code `246810`, share both accounts) → Found → confirm T NGUYEN as a gift (then Save through all 3)
→ Home (Watch, $790) → Trends (exam note) → Afford $230 → Proof settings → Create share link → scan the
QR on a phone → "Genuine and unchanged" → in Supabase, edit `proofs.snapshot` (e.g. `"dependable"`) →
reload the landlord page → "Could not verify".
