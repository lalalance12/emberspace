# Emberspace

An ambient status board that replaces the daily standup. Everyone posts what
they're working on; two shared views show the whole team at a glance.

Emberspace is an **attention layer, not a chat app.** It never carries
conversation — when someone needs a teammate, it produces a nudge that sends
them to Slack, Discord, or wherever the team actually talks.

## Stack

| | |
|---|---|
| Next.js | 15.5.22, App Router |
| React | 19.1 |
| Tailwind | v4, tokens via `@theme` in `app/globals.css` |
| Database | Postgres on Neon (via the Vercel Marketplace), RLS on every table |
| Auth | Better Auth, email + password, tables in the same database |
| Live data | Short polling from the browser (`app/live-actions.ts`) |
| Animation | `motion`, imported from `motion/react` |
| Tests | Vitest, Playwright, pgTAP |

The whole backend is Postgres plus the app's own server code. No Edge Functions,
no third-party services.

## Environment

Three variables.

```bash
vercel env pull .env.local     # if Neon was added through Vercel
# or: cp .env.example .env.local and fill it in
```

| Variable | Where it comes from |
|---|---|
| `DATABASE_URL` | Set by Vercel when Neon is added (Storage → Create → Neon). Server-only. |
| `BETTER_AUTH_SECRET` | You make it: `openssl rand -base64 32`. Add it in Vercel → Settings → Environment Variables. Server-only. |
| `NEXT_PUBLIC_SITE_URL` | The domain this deployment answers on. Blank locally. |

### Nothing bypasses RLS

The app connects as the database owner, but every user request steps down into
the `authenticated` role with that user's id set for `auth.uid()`
(`lib/db.ts`, `withUser`). So the policies and grants in `db/migrations` decide
everything, exactly as they did on Supabase:

- every write goes through a **security-definer RPC executed as the signed-in
  user**, so the tables have no insert policies at all;
- notifications are written by **triggers**;
- the browser holds **no database credential** — it reaches data only through
  server actions (`app/actions.ts`, `app/live-actions.ts`).

The one owner-level call is the scheduler (`lib/scheduler.ts`), which runs
`enqueue_due_nudges()` and `expire_due_durations()` — functions revoked from
every client role because they act on the whole database.

## Running locally

```bash
pnpm install
vercel env pull .env.local      # DATABASE_URL + BETTER_AUTH_SECRET
pnpm db:migrate                 # apply db/migrations
pnpm db:seed                    # optional: a team of five at every decay tier
pnpm dev
```

Local development runs against a Neon database too — there is no local stack to
install. Use a separate Neon **branch** for development (Neon console →
Branches) so experiments never touch production data, and point `.env.local`'s
`DATABASE_URL` at it.

The seed creates a **Product** team with five people deliberately spread across
the staleness ladder, so every decay tier is visible the first time you open
`/board`. All of them sign in at `/login` with the password `password123`
(`dana@example.com`, `lance@example.com`, …).

### Getting onto a team

A fresh signup has a profile but no team, and nothing works until they have one,
so the `(app)` layout sends anyone without a `team_id` to **`/onboarding`**. It
offers both paths side by side: enter a **join code**, or name a team and become
its head. The code is eight characters with no ambiguous glyphs, shown on
`/settings/team`. Anyone holding it can join, so the head can rotate it.

`/onboarding` sits outside the `(app)` group on purpose — there is no board and
no nudge policy to navigate to until you belong somewhere, so there is no top
bar either.

## Deploying

1. In Vercel, add Neon to the project: **Storage → Create → Neon**, connected to
   Production, Preview and Development. That sets `DATABASE_URL`.
2. Add `BETTER_AUTH_SECRET` (and `NEXT_PUBLIC_SITE_URL` for production).
3. Apply the schema once from your machine: `vercel env pull .env.local`, then
   `pnpm db:migrate`. Re-run it after every new migration.
4. Deploy.

`pnpm db:reset --yes` drops every table and re-applies the migrations from
scratch. It is for disposable test databases only.

### Sign-in

Email and password. No magic link, no OAuth providers, nothing that sends email —
so nothing that can be rate limited.

The consequence to accept: **there is no self-serve password recovery.** A
forgotten password is reset by whoever runs the database. For a small team that
is a fair trade for sign-in with no moving parts.

### Live updates without Realtime

Neon has no push channel, so the board asks for a fresh snapshot every 5 seconds
and the bell every 10, only while the tab is visible. A hidden tab does not poll,
which is what lets Neon's free tier sleep when nobody is looking. Updates land a
few seconds late; for a board people glance at, that is the right trade.

"Who's online" is a last-seen time per person (`public.presence`), written by
each poll. Someone counts as here while their last poll is under 45 seconds old.

The staleness nudges and timed status switches used to run on pg_cron every
minute. Neon only runs cron while awake, so they now run on board polls,
throttled to once a minute — nudges are created while someone has the app open,
which is when they can be seen.

## Commands

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test                              # vitest: decay, RPC wrappers, board
pnpm test:e2e                          # playwright: log in, post, see the note
pnpm db:migrate                        # apply new migrations to DATABASE_URL
pnpm db:seed                           # development seed
pnpm db:test                           # pgTAP: the scheduler guard
pnpm db:reset --yes                    # drop everything and re-apply
```

**Update `lib/database.types.ts` with every migration.** It is maintained by
hand now — nothing generates it from Neon — and a stale one is the most common
source of confusing type errors in this project.

## Where things live

```
app/
  page.tsx          the landing page — the one indexable route
  actions.ts        server actions: the write API, settings writes
  live-actions.ts   server actions: board snapshot + notifications (polled)
  api/auth/         Better Auth's endpoints
  (app)/            authenticated shell — top bar, drafting grid
    board/          the board (server shell + polling client)
    office/         floor-plan view                        [parked]
    me/             set my status — the most important screen
    timeline/       one day's history
    settings/team/  membership for everyone; nudge policy + join code head-only
    settings/me/    nudge preferences, pause, message link, password
  login/ signup/    email + password
  auth/signout/     POST only — ends the session server-side
components/
  status-note.tsx   the sticky note, including the decay treatment
  status-detail.tsx what a card opens to: full note, details, real timestamps
lib/
  db.ts             the Postgres pool and withUser() — every query goes through it
  auth.ts           Better Auth (server); auth-client.ts is the browser half
  queries.ts        server-side reads for first paint
  rpc.ts            typed wrappers over the write API
  scheduler.ts      the two jobs pg_cron used to run
  staleness.ts      the decay thresholds — single source, unit tested
db/
  migrations/       ground truth. Never invent a table or column.
  tests/            pgTAP
  seed.sql          development data
scripts/
  migrate.mjs seed.mjs test-sql.mjs
```

## The two kinds of nudge

They share the `nudges` table and are otherwise different features. Don't
collapse them into one UI.

| | **Peer nudge** | **System nudge** |
|---|---|---|
| Sent by | a teammate, from the board | the scheduler, on staleness |
| Asks for | attention — go look at your DMs | a status update |
| Resolves via | `acknowledge_nudge()` | `respond_to_nudge()` or any `set_status()` |
| Can stack | yes | no, one open at a time |
| Visibility | whole team, on purpose | recipient and head only |

Peer nudges are public because nudging in the open keeps it social; covert
nudging turns the feature into a management cudgel. System nudges are private
because a stale status shouldn't be a public scolding.

A peer nudge is a **signpost, not a message** — 80 characters and a link out.
Never let it grow a reply field.
