-- Workspace: who is here.
--
-- On Supabase this lived entirely in Realtime Presence and never touched
-- Postgres. Neon has no presence channel, so the board polls instead, and each
-- poll says "I'm still here" by calling mark_seen(). Someone counts as online
-- while their last poll is recent; the window lives in lib/live.ts.
--
-- One row per person, overwritten in place — it is a last-seen time, not a
-- log. Postgres still stores only what people are DOING in status_updates;
-- this table answers whether they are THERE, and nothing reads history from
-- it.

create table public.presence (
  profile_id uuid        primary key references public.profiles (id) on delete cascade,
  team_id    uuid        not null references public.teams (id) on delete cascade,
  seen_at    timestamptz not null default now()
);

create index presence_team_seen_idx on public.presence (team_id, seen_at desc);

alter table public.presence enable row level security;

create policy "teammates see who is here"
  on public.presence for select to authenticated
  using (team_id = public.current_team_id());

-- Read-only to clients, like status_updates: the only write is mark_seen().
grant select on public.presence to authenticated;
revoke all on public.presence from anon;

create or replace function public.mark_seen()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from public.profiles where id = auth.uid();

  -- Not on a team yet: there is no board to be present on.
  if v_team is null then
    delete from public.presence where profile_id = auth.uid();
    return;
  end if;

  insert into public.presence (profile_id, team_id, seen_at)
  values (auth.uid(), v_team, now())
  on conflict (profile_id) do update
    set team_id = excluded.team_id,
        seen_at = excluded.seen_at;
end;
$$;

revoke execute on function public.mark_seen() from public, anon;
grant execute on function public.mark_seen() to authenticated;
