-- Deleting an account.
--
-- Better Auth deletes the auth_user row, and the foreign keys carry it from
-- there: the profile, its status history, quick picks, presence, the nudges it
-- sent and received and its own notifications all cascade; its desk is freed.
--
-- One cascade is an UPDATE rather than a DELETE. notifications.actor_id is
-- `on delete set null`, so every notification the person caused for someone
-- else — "Lance nudged you", "Lance saw your nudge" — has its actor cleared.
-- guard_notification_columns() refused any change but read_at, which made
-- every account that had ever nudged anyone impossible to delete.
--
-- This lets actor_id go to null and nowhere else. Pointing a notification at a
-- different actor is still refused, and so is every other column.

create or replace function public.guard_notification_columns()
returns trigger
language plpgsql
as $$
begin
  if new.id         is distinct from old.id
     or new.profile_id is distinct from old.profile_id
     or new.kind       is distinct from old.kind
     or new.nudge_id   is distinct from old.nudge_id
     or (new.actor_id is distinct from old.actor_id and new.actor_id is not null)
     or new.title      is distinct from old.title
     or new.body       is distinct from old.body
     or new.href       is distinct from old.href
     or new.created_at is distinct from old.created_at
  then
    raise exception 'notifications are written by trigger; only read_at may change'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
