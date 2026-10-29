-- ---------------------------------------------------------------------------
-- Backfill profiles for accounts that predate the trigger.
--
-- public.handle_new_user() fires "after insert on public.auth_user", so it only
-- ever sees signups that happen once it exists. Anyone with an account from
-- before would have no profile, and the app greets them with "you're signed
-- in, but you have no profile" — which is accurate and completely
-- unactionable.
--
-- Idempotent: on a fresh database there are no users to backfill and this does
-- nothing.
--
-- The column expressions mirror handle_new_user() deliberately. If that
-- function changes how it derives a display name, change it here too.
-- ---------------------------------------------------------------------------

insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(
    nullif(left(trim(u.name), 60), ''),
    split_part(coalesce(u.email, 'someone'), '@', 1)
  ),
  nullif(trim(u.image), '')
from public.auth_user u
on conflict (id) do nothing;
