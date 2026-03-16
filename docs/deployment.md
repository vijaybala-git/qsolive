# QSOlive Deployment Guide

**Part of the core docs:** [Documentation index](README.md) · [Architecture](architecture.md) · [Client setup](client-setup.md) · [Database setup](database-setup.md)

This guide describes how to deploy QSOlive in **development** and **production**. Frontend is hosted on **Vercel** (Hugging Face deployment is deprecated). We use the **Supabase CLI** to make pushing schema to production robust.

---

## 1. Purpose and overview

- **Goal:** Document deployment for **dev** (current working environment) and **prod** (stable 1.0+).
- **Scope:** Frontend (Vercel), backend (Supabase), Windows client (points at one Supabase project per environment).
- **Environments:**
  - **Dev** – current working setup; one Supabase project + Vercel preview/local.
  - **Prod** – stable release (e.g. 1.0); separate Supabase project + Vercel production.
- **Change:** Frontend hosting moved from Hugging Face to **Vercel** only.

---

## 2. Environments and versioning

| Environment | Frontend | Supabase | Use |
|-------------|----------|----------|-----|
| **Dev – Local** | `npm run dev` (localhost) | Dev project | Day-to-day development |
| **Dev – Vercel** | Vercel preview (branch deploys) | Dev project | Shareable dev URL, testing |
| **Prod** | Vercel production | Prod project | Public 1.0+ release |

**Versioning:**
- App version: `frontend/package.json` (and About page).
- Git: e.g. `main` = prod, feature branches = dev; tag releases (e.g. `v1.0.0`) for prod deploys.
- *(To be filled: exact branch/tag strategy and how versions map to deployments.)*

---

## 3. Prerequisites

- **Accounts:** GitHub, Vercel, Supabase (two projects: one dev, one prod).
- **Local tools:** Node.js, npm, Git, **Supabase CLI** (for schema/migrations to prod).
- **Secrets:** Supabase **anon** and **service_role** keys per project; Vercel env vars per project/environment.

---

## 4. Dev environment

### 4.1 Dev – Local

- **4.1.1 Supabase dev project**
  - Create a Supabase project for development.
  - Apply schema: run the SQL from [Database setup](database-setup.md) (main schema + user/clubs/roster) in the SQL Editor, or use Supabase CLI and migrations (see Prod section for CLI workflow).
- **4.1.2 Frontend (local)**
  - In `frontend/`, create `.env.local` with:
    - `VITE_SUPABASE_URL` = dev project URL
    - `VITE_SUPABASE_ANON_KEY` = dev anon key
  - Run: `npm install`, `npm run dev`.
- **4.1.3 Windows client (dev)**
  - Point `client/config.json` (or `build_config.py` for dev build) at **dev** Supabase URL and service_role key.
  - Run client; confirm contacts reach dev DB and appear on local frontend.

### 4.2 Dev – Vercel

- **4.2.1 Create Vercel project (dev)**
  - Import the GitHub repo in Vercel.
  - Set framework to Vite (or detect from repo).
  - Set **Root Directory** to `frontend` if the app lives there.
- **4.2.2 Dev environment variables on Vercel**
  - In Vercel: Project → Settings → Environment Variables.
  - Add for **Preview** (and optionally Development):
    - `VITE_SUPABASE_URL` = dev Supabase URL
    - `VITE_SUPABASE_ANON_KEY` = dev anon key
- **4.2.3 Deploy flow**
  - Push to your dev branch → Vercel auto-deploys a preview.
  - *(To be filled: branch name, preview URL pattern.)*
- **4.2.4 Testing checklist (dev)**
  - [ ] Map loads; real-time contacts appear.
  - [ ] Settings: set callsign, mode (self / club / clubs), save.
  - [ ] Club Admin: create club, add/remove roster (as owner or master admin).
  - [ ] Help: About and User Guide load.

---

## 5. Prod environment

### 5.1 Supabase prod project (Supabase CLI)

- **5.1.1 Dedicated prod project**
  - Create a **separate** Supabase project for production (do not reuse dev).
- **5.1.2 Supabase CLI and migrations**
  - Install and login: `supabase login`; link to prod project: `supabase link --project-ref <prod-ref>`.
  - **Migrations:** Store schema and changes under `supabase/migrations/`. Apply locally with `supabase db reset` (dev) and push to prod with `supabase db push` (or your chosen workflow).
  - *(To be filled: how current [database-setup](database-setup.md) SQL is turned into migrations; order of migrations; one-time data if any.)*
- **5.1.3 Promoting schema changes**
  - Develop and test in dev (local + Vercel preview).
  - Generate or export migration; apply to prod via CLI so prod schema is always driven by versioned migrations.
- **5.1.4 Secrets**
  - Prod **anon** key → frontend only (Vercel env).
  - Prod **service_role** key → used only for building/packaging the Windows client that talks to prod; never in repo or frontend.

### 5.2 Vercel prod deployment

- **5.2.1 Production env vars**
  - In Vercel, set **Production** env vars:
    - `VITE_SUPABASE_URL` = prod Supabase URL
    - `VITE_SUPABASE_ANON_KEY` = prod anon key (use the **new** anon key from Dashboard → Settings → API if "Legacy API Key" is disabled).
- **5.2.2 Supabase Auth (signup confirmation emails)**
  - In Supabase Dashboard → **Authentication** → **URL Configuration**:
    - **Site URL:** set to your production frontend URL (e.g. `https://your-app.vercel.app`).
    - **Redirect URLs:** add your production URL (e.g. `https://your-app.vercel.app/**`). The confirmation email link uses this; if the URL is not listed, signup can fail or emails may not be sent.
  - If confirmation emails do not arrive: check Auth → Logs for errors; ensure the new anon key is in Vercel when Legacy API Key is disabled; consider [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) for production (built-in has low rate limits).
- **5.2.3 Domain**
  - *(To be filled: production URL, custom domain if any.)*
- **5.2.4 Deploying 1.0 to prod**
  - Tag release (e.g. `git tag v1.0.0`); deploy from that tag or from `main`.
  - In Vercel: Production deploy triggered by push to production branch or by “Deploy” from tag.
  - *(To be filled: exact steps – e.g. push tag, or merge to main.)*
- **5.2.5 Post-deploy checks**
  - [ ] Map, Settings, Club Admin, Help work against prod.
  - [ ] Confirm frontend is using prod Supabase (no dev data).
  - Rollback: redeploy previous tag or branch from Vercel dashboard.

---

## 6. Release process (1.0 and beyond)

- **6.1 Pre-release**
  - Code freeze on dev; run full QA (local + Vercel preview).
  - Bump version in `frontend/package.json` and in About / User Guide if needed.
- **6.2 Cut release**
  - Create tag (e.g. `v1.0.0`).
  - Merge to `prod` (or push to `prod`); GitHub Actions applies migrations to prod automatically (see §8).
  - Trigger Vercel production deploy from that tag/branch.
- **6.3 Post-release**
  - *(To be filled: how to do hotfixes, next release cycle.)*

---

## 7. Environment summary

| Item | Dev (Local / Vercel) | Prod |
|------|----------------------|------|
| Supabase project | One dev project | One prod project |
| Frontend URL | localhost / Vercel preview | Vercel production URL |
| VITE_SUPABASE_URL | Dev project URL | Prod project URL |
| VITE_SUPABASE_ANON_KEY | Dev anon key | Prod anon key |
| Client (Windows) | config points at dev | Built with prod URL/key for distributable |

### How to tell which env you're on

- **Frontend:** Footer shows a badge **DEV** (orange) or **PROD** (green) and, in dev, the git branch (e.g. `main`). Set `VITE_APP_ENV=dev` or `VITE_APP_ENV=prod` in Vercel (Preview vs Production) and in local `.env.local`; branch is injected at build from `VERCEL_GIT_COMMIT_REF` or `GIT_BRANCH`.
- **Client:** On startup the client logs and prints one line: `[DEV] Branch: main | DB: <project-ref>` or `[PROD] Branch: release | DB: <project-ref>`. Set `BUILD_LABEL` and `BUILD_BRANCH` in `build_config.py` (or `environment` / `git_branch` in `config.json`) for explicit values; otherwise the client infers env from the Supabase URL and branch from git or `release`.

---

## 8. Automated migrations (main → dev, prod → prod)

Migrations are applied automatically by GitHub Actions so that **main** stays in sync with **dev** and **prod** with **prod**.

### 8.1 Workflow behaviour

| Branch | Target DB | Trigger |
|--------|-----------|--------|
| **main** | Dev Supabase | Push to `main` when `supabase/migrations/**` or this workflow changed |
| **prod** | Prod Supabase | Push to `prod` when `supabase/migrations/**` or this workflow changed |

**Typical flow:**

1. Create or edit migrations under `supabase/migrations/`.
2. Merge/push to **main** → workflow runs and applies migrations to **dev**. Test in dev (local + Vercel preview).
3. When ready for production, merge **main** into **prod** (or push to `prod`) → workflow runs and applies migrations to **prod**.

The workflow only runs when migration files (or `.github/workflows/supabase-migrate.yml`) change, so other pushes to `main` or `prod` do not re-run migrations.

### 8.2 Required GitHub secrets

In the repo: **Settings → Secrets and variables → Actions**, add:

| Secret | Description |
|--------|-------------|
| `SUPABASE_ACCESS_TOKEN` | Personal access token from [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens). Used by the CLI in CI. |
| `SUPABASE_PROJECT_REF_DEV` | Dev project ref (e.g. from dashboard URL: `https://supabase.com/dashboard/project/<ref>` or **Settings → General → Reference ID**). |
| `SUPABASE_PROJECT_REF_PROD` | Prod project ref (same as above, for the prod project). |

Workflow file: `.github/workflows/supabase-migrate.yml`.

---

## 9. Future improvements

- Smoke tests after deploy (e.g. Playwright/Cypress).
- *(Other ideas as we approach 1.0.)*

---

*This doc will be updated as we finalize 1.0 and the first prod push.*

---

## Related documentation

- **[Architecture](architecture.md)** – System design and deployment context.
- **[Database setup](database-setup.md)** – Schema and RLS to apply (dev/prod).
- **[Client setup](client-setup.md)** – Building the client for dev vs prod.
- **[Documentation index](README.md)** – Overview of all core docs.
