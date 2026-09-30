# EarnSure — Dev TODO (v2)

Build plan for the hackathon prototype. Sources:

- **Technical design v2:** `docs/EarnSure_Technical_Design.md` (referred to as "TD §x" below)
- **Screen flow:** [EarnSure Mobile Flow](https://claude.ai/artifact/TBo4hXdshMwMxsazuDnMcy) (12 artboards, "S1–S12"). This is the source of truth for layout and copy.

Tasks are grouped by day to follow TD §14. ⭐ = on the demo path, must work. 🧊 = stretch goal. **Static** = fixed values from the prototype, no logic.

**Stack (TD §3):**

- **Front end:** Next.js (App Router) + TypeScript + Tailwind in `web/`
- **Back end:** FastAPI on Vercel Python Functions in `api/`
- **Database:** Supabase Postgres (Sydney)
- **Hosting:** Vercel Hobby, region `syd1`
- **Integrations:** none. Open banking and the LLM are offline placeholder providers. There are no API keys and it costs $0.

---

## Day 0: Setup (≈1–2 h)

- [ ] **0.1** ⭐ Commit the TD v2 to `docs/EarnSure_Technical_Design.md` and link it from `README.md`.
- [ ] **0.2** ⭐ **Replace the Vite scaffold at the repo root.** Delete `index.html`, `vite.config.js`, `src/`, `public/`, `.oxlintrc.json`, `package.json` and `package-lock.json` at the root, then create `web/` with `npx create-next-app@latest web --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*"`.
- [ ] **0.3** ⭐ Web deps: `npm i recharts qrcode.react` (in `web/`). Load Plus Jakarta Sans 400/500/600 via `next/font/google` in `app/layout.tsx`.
- [ ] **0.4** ⭐ Python: create `api/requirements.txt` = `fastapi numpy supabase` (+ `pandas` only if used; keep it small for cold starts) and `api/requirements-dev.txt` = `pytest httpx ruff uvicorn`. Local venv in `.venv/`.
- [ ] **0.5** ⭐ Update the root `.gitignore`: `.venv/`, `__pycache__/`, `.env*` (but keep a committed `.env.example`), `.vercel/`, `web/.next/`, `node_modules/`.
- [ ] **0.6** ⭐ Local dev:
  - `uvicorn api.index:app --reload --port 8000`
  - in `web/next.config.ts`, a **dev-only** rewrite `/api/:path*` → `http://localhost:8000/api/:path*`, so cookies stay same-origin
  - a root `Makefile` (or npm script) with `make dev` to run both
- [ ] **0.7** ⭐ Supabase: create a Free project in the **Sydney** region. Add `supabase/migrations/001_init.sql` (TD §5.3: 4 tables, RLS on, no public policies) and run it. Put the URL and service-role key in `.env` (backend only).
- [ ] **0.8** ⭐ `.env.example` lists every variable in TD §12: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PROOF_SIGNING_SECRET`, `APP_DOMAIN`, `BANK_PROVIDER=dummy`, `EXPLANATION_PROVIDER=template`, `DEMO_SEED_TOKENS=true`.

---

## Day 1: Backend (Python, `api/earnsure/`)

### 1A. Config and dummy data (TD §6)

- [ ] **1.1** ⭐ `config.py` holds every threshold from TD §7:
  - 30% share limit, 90% simulation pass, 4-week buffer
  - `n_sims=2000`, `block=4`, `blocks_per_year=13`, `seed=41`
  - recurrence tolerances; lean threshold 0.70 and recovery threshold 0.90; 10% top-up
  - `KEYWORDS`
  - a comment documenting the **decision-uses-display-rounded-percent** rule (TD §7.6)
- [ ] **1.2** ⭐ `data_gen.py` (`default_rng(2026)`, built once and cached at module level, **never stored in Supabase**):
  - [ ] 26 weeks, Mon 30 Mar to Sun 27 Sep 2026; accounts Everyday •• 4821 / Savings •• 0937; combined balance **$1,180**.
  - [ ] Café: fortnightly Thursdays, 13 payments of ≈ $600, $300 on exam-week pay days.
  - [ ] Freelance: `INV-10xx STUDIO MOSS`, 6 payments of ≈ $540, placed so no remainder goes negative.
  - [ ] Delivery: Mondays, 26 payments. Each is the week's remainder so the week equals `WEEKLY_INCOME`. Assert each is within $50–$800, median ≈ $420.
  - [ ] Outgoings from TD §6.2 (total **317.54**/week).
  - [ ] 14 × $200 own-transfer pairs; 2 refunds ($58 `REFUND HOMEWARES STORE`, $38).
  - [ ] The 3 person-to-person confirmation items (TD §6.4), kept out of `WEEKLY_INCOME`.
  - [ ] Discretionary debits so each week's sum equals `WEEKLY_DISCRETIONARY` exactly.
  - [ ] Pad the total to ≈ **612** transactions.

### 1B. Placeholder providers (TD §8)

- [ ] **1.3** ⭐ `providers/bank.py`: the `BankDataProvider` Protocol and `DummyBankProvider`:
  - `list_institutions(q)` returns a fixed list of fictional banks
  - `connect()` sleeps 1.5 s and returns the 2 accounts, "Fetched 612 transactions · 30 Mar – 27 Sep 2026"
  - `fetch_transactions()` returns the §6 data
  - choose the provider with `BANK_PROVIDER`
- [ ] **1.4** ⭐ `providers/explain.py`: the `ExplanationProvider` Protocol and `TemplateExplanationProvider`:
  - `health_explanation()` has headlines for Watch, Stable and Tight; its body is the TD template, giving "$790", "$318", "3.7"
  - `proof_note_label()` maps keywords (exam / sick / holiday|break / default), giving "Exam period: reduced shifts (June 2026)."
  - choose the provider with `EXPLANATION_PROVIDER`

### 1C. Logic (TD §7)

- [ ] **1.5** ⭐ `classify.py`: rules 1–6 in order (own transfer → refund → keywords → recurrence → first-seen person-to-person → fallback). Stream summaries give frequency, count, median and weekly equivalent.
- [ ] **1.6** ⭐ `apply_labels()`: `user_labels` override the rules (TD §7.1 table). The confirmation queue is sorted by amount descending.
- [ ] **1.7** ⭐ `metrics.py`:
  - dependable **790** (`method="lower"`); typical **855**
  - costs **317.54**; typical left **537.46**; lowest **102.46**
  - buffer **3.7**; status **Watch**
- [ ] **1.8** ⭐ `fmt.py`: `money()` and `pct()` round half-up with `Decimal`. Every money field is serialised as `{"value": 317.54, "display": "$318"}`.
- [ ] **1.9** ⭐ `affordability.py`:
  - `weekly_cost`, share, and `simulate()` **exactly as in TD §7.6** (Rent replaces the $210 stream)
  - the decision label compares the **display-rounded** percentages (so $250 gives 90% → passes → "Possible, some risk")
  - what-if rows at $250 and $290 when the type is Rent
- [ ] **1.10** ⭐ `trends.py`: the lean-week rule for "Weeks with a big drop" (8, 15, 22 Jun) and the bar colouring (TD §7.9, Core).
- [ ] **1.11** 🧊 `trends.py`: lean-period and recovery values (TD §7.7) to replace the static ones.
- [ ] **1.12** 🧊 Safe to spend (TD §7.8): top-up 79, safe 393.
- [ ] **1.13** ⭐ `proof.py`:
  - `build_snapshot()` using only the TD §9.3 fields
  - `canonical_json` (sorted keys, no whitespace)
  - `sign()` / `verify()` with HMAC-SHA256 using `PROOF_SIGNING_SECRET`
  - token `XXXX-XXXX` from an alphabet with no look-alike characters; `statement_no` = `ES-` + 8 base32 characters
  - when `DEMO_SEED_TOKENS=true`, the first proof uses `7KQ4-M2X9` / `ES-7KQ4M2X9`

### 1D. API (`api/index.py` + `routes/`, TD §9)

- [ ] **1.14** ⭐ `db.py`: a supabase-py client using the service-role key, plus query helpers for the 4 tables.
- [ ] **1.15** ⭐ Session dependency: read the `demo_session_id` httpOnly cookie (`Secure`, `SameSite=Lax`) and return 401 if it's missing. Every route requires it **except** `GET /api/proofs/{token}`.
- [ ] **1.16** ⭐ Routes. Every GET that returns figures recalculates them from the cached dataset plus this session's labels (TD §9.1).
  - [ ] `POST /api/session` / `DELETE /api/session`
  - [ ] `POST /api/consent`
  - [ ] `GET /api/institutions?q=`
  - [ ] `POST /api/connect`
  - [ ] `GET /api/streams`
  - [ ] `GET /api/confirmations` / `POST /api/confirmations/{txn_id}` (upsert)
  - [ ] `GET /api/health`: figures, status and explanation, plus the **static** safe-to-spend and lean-week alert data
  - [ ] `GET /api/trends` / `PUT /api/trends/note`
  - [ ] `POST /api/affordability`
  - [ ] `POST /api/proofs`: recompute the figures server-side and never trust figures sent by the client
  - [ ] `GET /api/proofs/current` / `POST /api/proofs/{token}/revoke`
  - [ ] `GET /api/proofs/{token}` (public): verify, then increment `open_count` and set `last_opened_at`; return a `state` of `verified | revoked | expired | invalid`

### 1E. Tests (TD §11), all green before the front end relies on them

- [ ] **1.17** ⭐ `tests/test_classify.py`: count 612 ± 10; the 3 income streams; 14 transfers / $2,800; 2 refunds / $96; queue of 3 with T NGUYEN first.
- [ ] **1.18** ⭐ `tests/test_metrics.py`: 790 / 855 / 317.54 ± 0.01 / $537 / $102 / 3.7 / Watch. Relabelling T NGUYEN as work recalculates, and dependable does not decrease.
- [ ] **1.19** ⭐ `tests/test_affordability.py`: $230 → 29 / 94 / Likely; $250 → 32 / 90 / Possible; $290 → 37 / 79 / Unlikely. The raw pass rates must equal 0.9385 / 0.8950 / 0.7935 exactly.
- [ ] **1.20** ⭐ `tests/test_explain.py`: the template contains "$790", "$318" and "3.7" and no other numbers; the note label equals "Exam period: reduced shifts (June 2026)."
- [ ] **1.21** ⭐ `tests/test_proof.py`:
  - tampering with any field → not verified
  - revoked and expired give the correct states
  - privacy: the serialised snapshot contains no `•• `, counterparties, "visa" or "remittance"
  - `weekly_series` is present only when `show_chart`; `note_label` only when included
- [ ] **1.22** ⭐ `tests/test_api.py`: FastAPI `TestClient` with an in-memory fake of `db.py`, so CI needs no Supabase.
- [ ] **1.23** 🧊 Tests for stretch items 1.11 and 1.12.
- [ ] **1.24** ⭐ **Deploy the API to Vercel on Day 1** to prove the Services setup (see §D) before building the UI on top of it.

---

## Day 2: Front end, screens 1–8 (`web/`)

### 2A. Foundation

- [ ] **2.1** ⭐ `tailwind.config.ts` with the TD §10 tokens:
  - every colour, including the semantic outlines
  - radii 28 px (card) and 24 px (tile), both shadows
  - `tabular-nums` on figures
- [ ] **2.2** ⭐ `app/layout.tsx`: a centred **390 px phone frame** on desktop, full width on phones.
- [ ] **2.3** ⭐ Components:
  - `Header` (52 px round buttons, 18 px title), `PageTitle`
  - `Card`, `Tile`, `Pill`/`Tag` (green/amber/red outline variants)
  - `PrimaryButton`, `SecondaryButton`, `BlackPill`
  - `StatTile`, `IconCircle`, `ListRow`, `ProgressBar` (with a marker)
  - `BottomNav`: a 72 px `#17171F` pill; the active tab is a purple pill with its label, inactive tabs are 52 px circles with `aria-label`. It appears only on Home, Trends, Afford, Proof and Rights.
- [ ] **2.4** ⭐ `lib/api.ts`: typed fetch wrappers for each TD §9 endpoint (`credentials: "include"`), a `Money` type `{value, display}`, and error and loading helpers. **The front end only ever renders `display` strings.**

### 2B. Screens (match the prototype artboards)

- [ ] **2.5** ⭐ **S1 `/` Welcome**:
  - on mount, call `POST /api/session` (if there's no cookie yet), which also warms the Python function
  - "Get started" → `/consent`; "I'll upload a statement instead" → `/connect`
  - ⚠ the heading is cut off in the prototype (see Q1)
- [ ] **2.6** ⭐ **S2 `/consent`**:
  - radio 30 / 90 / 365 (default 90)
  - the agree tick box is required; its label follows the chosen duration (the prototype hard-codes "90 days")
  - Continue → `POST /api/consent` → `/connect`
- [ ] **2.7** ⭐ **S3 `/connect`**:
  - bank search → `GET /api/institutions`
  - `POST /api/connect` with a spinner (1.5 s delay), then 2 "Connected" rows and "Fetched 612 transactions · …"
  - "Add another account" is inert
  - **upload box is a placeholder**: dashed card, disabled, with a "Coming soon" badge
  - "Analyse my earnings" → `/found`
- [ ] **2.8** ⭐ **S4 `/found`**: the amber banner "N items need your check" → `/confirm/0`; money in (3 streams with tags); regular outgoings (6); not counted (×14 $2,800, ×2 $96); "Review N items".
- [ ] **2.9** ⭐ **S5 `/confirm/[index]`**:
  - progress bar, "Item n of 3", the item card
  - 4 radio pills, note, footer copy
  - **Save and next** → `POST /api/confirmations/{txn_id}` → the next index; **Skip** → the next index with no label (the item stays excluded)
  - after the last item → `/home`
  - ⚠ the prototype's buttons jump straight to Home; implement the loop instead
- [ ] **2.10** ⭐ **S6 `/home`**:
  - "Hi Linh", "Week of 28 Sep", status pill (Watch = amber), the explanation card and the caption "Plain-language summary of your figures"
  - 4 tiles:
    - Dependable $790 · "Earned or more in 3 of 4 weeks · typical $855"
    - Left $537 · "Typical week · lowest $102"
    - **Safe to spend $393 / $79** (static from the API)
    - Buffer 3.7 wks · "$1,180 across 2 accounts"
  - **static** lean-week alert (energy ≈ $160 due 13 Oct)
  - quick actions "Check a rent" → `/afford`; "See my trends" → `/trends`
- [ ] **2.11** ⭐ **S7 `/trends`**:
  - Recharts bar chart of the 26 weeks with a **dashed $790 line** and lean bars in amber
  - **static** lean and recovery tiles (1 period · 3 weeks · 8–28 Jun; 4 wks · recovered 6 Jul)
  - drop-week rows from the API
  - note editor (prefilled with the TD default note): save → `PUT /api/trends/note`, then show "Shown on your proof as" with the returned label and a **User-provided** tag
  - "Include this note on my proof page" tick box
  - static caption about the mid-year break
- [ ] **2.12** ⭐ **S8 `/afford`**:
  - segmented "What is it" (Rent / Phone plan / Loan repayment) and "How often" (Weekly / Fortnightly / Monthly); amount (default 230); Check → `POST /api/affordability`
  - result card: label pill; 2 progress bars with markers at 30% and 90%
  - what-if rows for Rent; disclaimer
  - "Create proof for this rent" saves the rent to page state → `/proof`

---

## Day 3: Proof, share, landlord view, static screens, polish

- [ ] **3.1** ⭐ **S9 `/proof`**:
  - preview card (Bank-sourced; rent result; $790; $537/wk; 26 of 26 wks; 3.7 wks)
  - "Show weekly income chart" tick box (**off** by default)
  - "Include my note about June" tick box (defaults to the value from S7)
  - "Valid for" 30 / 14 / 7 days
  - "Never on your proof" list
  - "Create share link" → `POST /api/proofs` → `/share`
  - "Preview as the landlord" → an unsigned preview of the S11 layout that writes nothing and does not count as an open
- [ ] **3.2** ⭐ **S10 `/share`**:
  - `GET /api/proofs/current`
  - QR code via `qrcode.react` for `https://{APP_DOMAIN}/p/{token}`
  - the URL with **Copy** (Clipboard API + fallback)
  - Valid until; Opened (count + time); Answers "Rent of $230 a week"
  - "See what they'll see" → `/p/{token}`
  - "Switch off this link" → confirm → revoke → show the off state
- [ ] **3.3** ⭐ **S11 `/p/[token]`** (server component, public, no nav):
  - server-side fetch of `GET /api/proofs/{token}` (absolute URL from `APP_DOMAIN`, `cache: "no-store"`)
  - four states: **Genuine and unchanged.** Signature checked {date} / switched off / expired / Could not verify
  - details grid; 94% + label; figure rows
  - the note block only if present ("user-provided"); the chart only if `weekly_series` is present
  - the "Not included" list and the disclaimer
  - "Restart demo" → `DELETE /api/session` → `/`
- [ ] **3.4** ⭐ **S12 `/rights`**: fully static (38 of 48 h, period rows, pay check $412 / 16 h / $25.75, `[AWARD RATE]`). External links open in a new tab.
- [ ] **3.5** ⭐ Loading skeletons and error/retry states on every API call; a 401 sends the user back to `/`.
- [ ] **3.6** ⭐ Accessibility pass: real `<button>`, `<a>`, `<input>` and `<label>`; `aria-label` on icon-only buttons; targets ≥ 44 px; visible focus.
- [ ] **3.7** ⭐ Visual pass: put each screen next to its prototype artboard and pixel-check spacing and copy.
- [ ] **3.8** ⭐ Rehearse the TD §14 demo script against **production** on a real phone. That includes scanning the QR, then editing `proofs.snapshot` in the Supabase table editor and reloading to show "Could not verify". Write the script into `README.md`.
- [ ] **3.9** 🧊 Playwright smoke test of the demo script (checks the figures on S6, S8 and S11).

---

## D. Deployment and CI/CD (GitHub → Vercel)

### Vercel project (TD §12)

- [ ] **D.1** ⭐ Import the GitHub repo into Vercel from **one** team member's account (Hobby has no team seats).
- [ ] **D.2** ⭐ ⚠ **Hobby plan and private repos:** Vercel Hobby can block deploys for commits authored by anyone other than the project owner when the repo is private. Pick one before Day 1 and check it works with a teammate's commit:
  - **(a)** make the GitHub repo **public** (simplest), or
  - **(b)** have only the owner merge pull requests into `main`, so production deploys are triggered by the owner's merge commit.
- [ ] **D.3** ⭐ One project, one domain: the Next.js app from `web/` and FastAPI from `api/` served at `/api/*`, using Vercel **Services** (docs: *Using the Python Runtime → Combine Python with another framework*). Set `"regions": ["syd1"]` in `vercel.json` and exclude `api/tests/` from the function bundle.
  - **Fallback** if Services is awkward: deploy `api/` as a second Vercel project (`earnsure-api`) and add a Next.js rewrite `/api/:path*` → `https://earnsure-api.vercel.app/api/:path*`. Cookies stay first-party because the browser only ever talks to the web domain.
- [ ] **D.4** ⭐ Environment variables for Production and Preview: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PROOF_SIGNING_SECRET` (`openssl rand -hex 32`), `APP_DOMAIN`, `BANK_PROVIDER=dummy`, `EXPLANATION_PROVIDER=template`, `DEMO_SEED_TOKENS=true`. **The service-role key never gets a `NEXT_PUBLIC_` prefix.**
- [ ] **D.5** ⭐ Turn off **Deployment Protection** for Production, so `/p/{token}` opens in a private window without a Vercel login. Check this.
- [ ] **D.6** ⭐ Check that a hard refresh on `/home` and `/p/7KQ4-M2X9` works in production.
- [ ] **D.7** ⭐ Git integration gives the CD half: every pull request gets a preview URL and a merge to `main` deploys production. The limit is 100 deploys a day, so avoid pushing every tiny commit.

### GitHub Actions (the CI half): `.github/workflows/ci.yml`

- [ ] **D.8** ⭐ Run on `pull_request` and on `push` to `main`, with two jobs:
  - **api**: `setup-python@v5` (3.12, pip cache) → `pip install -r api/requirements.txt -r api/requirements-dev.txt` → `ruff check api` → `pytest api/tests -q`. Tests use the in-memory DB fake, so they need **no secrets**.
  - **web**: `setup-node@v4` (Node 22, npm cache, `working-directory: web`) → `npm ci` → `npm run lint` → `npx tsc --noEmit` → `npm run build`.
- [ ] **D.9** ⭐ Branch protection on `main`: require the `api` and `web` checks plus 1 review, and no direct pushes.
- [ ] **D.10** 🧊 Post-deploy smoke test on `deployment_status`: curl the preview URL's `/api/session`, then `POST /api/affordability` $230, and check the result is 94%.

### Before judging

- [ ] **D.11** ⭐ The Supabase Free project **pauses after 1 week of inactivity**. Open the dashboard the day before judging and create one proof to warm everything up.

---

## Open questions for the PO

1. What is the final Welcome headline? S1 is cut off at "Financial intelligence for".
2. S2 says "Transactions from the last 12 months", but the analysis covers 26 weeks and the user can pick 30 or 90 days. What should the copy say?
3. Should the repo be public or private? This decides option (a) or (b) in D.2.
