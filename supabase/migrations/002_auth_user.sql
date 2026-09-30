-- Optional sign-in (AUTH_ENABLED=true): each signed-in user gets one session row.
-- Anonymous demo sessions (AUTH_ENABLED=false) keep user_id null.
alter table demo_sessions
  add column if not exists user_id uuid unique references auth.users(id) on delete cascade;
