# Clinical Trials Dashboard

A live-updating, three-column dashboard (menu / list / detail — Gmail-style)
that tracks [ClinicalTrials.gov](https://clinicaltrials.gov/data-api/api) for:

- **Indications** — Atopic Dermatitis and Hidradenitis Suppurativa by default;
  add more anytime from the left sidebar.
- **Compound-driven search** — 22 seed compounds (LAD191, SAR445399, CAN10,
  Upadacitinib, Ritlecitinib, etc.), flagging any brand-new NCT number that
  shows up for a compound after the dashboard starts tracking it.

Every refresh diffs each trial's **status, study start, primary completion,
study completion, enrollment (N=), study type, and phase** against the last
snapshot and logs a change event when any of them move — that's how "live
updates" work, since ClinicalTrials.gov itself has no push/webhook API.

## How it works

1. `lib/ctgov.ts` calls the public CT.gov v2 API (`/api/v2/studies`) — no key
   required.
2. `lib/refresh.ts` runs the full scan (once per indication, once per
   compound), diffs results against what's stored in Postgres, writes
   `ChangeEvent` rows for anything that changed, and flags brand-new NCT
   numbers.
3. `app/api/cron/refresh/route.ts` is hit daily by **Vercel Cron**
   (`vercel.json`) — the free Hobby plan allows one cron run/day. There's also
   a **"Refresh now"** button in the sidebar for on-demand updates.
4. The 3-column UI (`components/Dashboard.tsx`) reads from Postgres via the
   `/api/trials*` routes — it never calls clinicaltrials.gov directly from
   the browser.

## Deploying (Vercel, free Hobby plan)

**1. Push this folder to GitHub.** From inside this folder:

```bash
git init                     # already done for you if you're reading this after setup
git add -A
git commit -m "Initial clinical trials dashboard"
```

Create an empty repo at github.com/new (don't initialize it with a README),
then:

```bash
git remote add origin https://github.com/<you>/clinical-trials-dashboard.git
git branch -M main
git push -u origin main
```

**2. Import into Vercel.** Go to [vercel.com/new](https://vercel.com/new),
pick the repo you just pushed, and click Deploy. The first deploy will
succeed for the UI but the database isn't wired up yet — that's step 3.

**3. Add a database.** In the Vercel project → **Storage** tab → **Create
Database** → **Postgres** (this is Neon under the hood) → connect it to this
project. Vercel automatically adds `POSTGRES_PRISMA_URL` and
`POSTGRES_URL_NON_POOLING` as environment variables — no copy/pasting needed.

**4. Create the database tables (one-time).** Pull the env vars Vercel just
added down to your machine and push the schema:

```bash
npm i -g vercel        # if you don't already have the CLI
vercel link             # connect this folder to the Vercel project
vercel env pull .env.local
npm install
npm run db:push
```

**5. Add `CRON_SECRET`.** In Vercel project → **Settings** → **Environment
Variables**, add `CRON_SECRET` with a random value (e.g. run
`openssl rand -hex 32`). This stops random visitors from triggering refreshes
by hitting the cron URL directly — Vercel Cron automatically sends this as a
bearer token.

**6. Redeploy.** Vercel → **Deployments** → **Redeploy** (or just push a
commit) so the new env vars take effect. Open the deployed URL — the
dashboard will run its first refresh automatically since it starts with an
empty database (this can take 20–60s the first time, since it's pulling
every Atopic Dermatitis and Hidradenitis Suppurativa trial on CT.gov).

That's it — from then on, Vercel Cron refreshes it daily at 7am America/Detroit
(11:00 UTC; edit the schedule in `vercel.json`), and the "Refresh now" button
covers anything in between.

## Editing the tracked list

- **Indications**: sidebar → Indications → **+ Add**. Type the same term
  you'd search on clinicaltrials.gov's "Condition/disease" field.
- **Compounds**: sidebar → Compound-driven search → **+ Add**. For a compound
  with more than one name/code (e.g. "Abdakibart (AVTX-009)"), add it once
  and then use `npm run db:studio` (opens Prisma Studio) to add the alias to
  its `aliases` array — or just add each name as its own entry.
- Removing a default (seed) indication/compound isn't exposed in the UI on
  purpose (they repopulate on next cold start otherwise); use Prisma Studio
  or edit `lib/compounds.ts` and redeploy if you want to change the defaults
  permanently.

## A couple of things worth knowing

- **Compound name note**: "Tibulizumb" was carried over exactly as supplied
  in the request, with "Tibulizumab" added as a search alias in case that's
  the intended spelling — check `lib/compounds.ts` and remove the alias if
  it's wrong.
- **First-run baseline**: the very first time a trial is pulled in, there's
  nothing to diff against yet, so it won't show a change history until the
  *next* refresh finds something different.
- **Hobby plan cron limit**: Vercel's free tier allows 1 cron run/day. If you
  upgrade to Pro later, change the `schedule` in `vercel.json` to something
  like `*/30 * * * *` (every 30 minutes) for closer-to-real-time updates.
- **Dark mode** follows the OS/browser setting automatically (no in-app
  toggle yet).

## Local development

```bash
npm install
vercel env pull .env.local   # after step 3 above
npm run db:push
npm run dev
```
