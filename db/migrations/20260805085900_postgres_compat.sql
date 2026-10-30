-- Workspace: the ground the rest of the schema stands on.
--
-- The schema was written against Supabase, which supplies three things before
-- any migration runs: the `anon` and `authenticated` roles, an `auth.uid()`
-- that names the signed-in user, and a table of accounts. On plain Postgres
-- (Neon) none of those exist, so this migration provides them — and nothing
-- more. Every policy, grant and security-definer function after this one is
-- unchanged, which is the point: RLS is still the enforcement, not the app.
--
-- How a request becomes "the signed-in user" (lib/db.ts, withUser):
--
--   begin;
--   select set_config('request.jwt.claim.sub', '<user id>', true);
--   set local role authenticated;
--   ... the request's queries, under RLS ...
--   commit;
--
-- Both settings are transaction-local, so a pooled connection never carries
-- one person's identity into the next request.

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;

  -- The app connects as the database owner and steps down into
  -- `authenticated` for every user request. It needs membership to SET ROLE.
  execute format('grant anon, authenticated to %I', current_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- auth.uid()
-- ---------------------------------------------------------------------------
create schema if not exists auth;
create schema if not exists extensions;

grant usage on schema auth to anon, authenticated;

-- The same contract Supabase gives: the current user's id, or null when the
-- request is not signed in. Reads the transaction-local setting withUser sets.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Accounts: Better Auth's tables
-- ---------------------------------------------------------------------------
-- Shapes match Better Auth 1.7's core schema (user, session, account,
-- verification) with ids as uuids, so profiles.id can reference a user
-- directly. Better Auth is configured with these model names in lib/auth.ts.
--
-- No GRANT to `authenticated` or `anon` on any of them. Password hashes and
-- session tokens are read only by the auth server, never by an app query.

create table public.auth_user (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  email           text        not null unique,
  "emailVerified" boolean     not null default false,
  image           text,
  "createdAt"     timestamptz not null default now(),
  "updatedAt"     timestamptz not null default now()
);

create table public.auth_session (
  id          uuid        primary key default gen_random_uuid(),
  "expiresAt" timestamptz not null,
  token       text        not null unique,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId"    uuid        not null references public.auth_user (id) on delete cascade
);

create index auth_session_user_idx on public.auth_session ("userId");

create table public.auth_account (
  id                      uuid        primary key default gen_random_uuid(),
  "accountId"             text        not null,
  "providerId"            text        not null,
  "userId"                uuid        not null references public.auth_user (id) on delete cascade,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  scope                   text,
  password                text,
  "createdAt"             timestamptz not null default now(),
  "updatedAt"             timestamptz not null
);

create index auth_account_user_idx on public.auth_account ("userId");

create table public.auth_verification (
  id          uuid        primary key default gen_random_uuid(),
  identifier  text        not null,
  value       text        not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index auth_verification_identifier_idx on public.auth_verification (identifier);

revoke all on public.auth_user, public.auth_session, public.auth_account, public.auth_verification
  from public, anon, authenticated;
