-- Live-room additions: visual themes and short codes for joining on a phone.
alter table public.polls add column if not exists theme text not null default 'ocean'
  check (theme in ('ocean', 'sunset', 'forest', 'midnight'));
alter table public.polls add column if not exists join_code text;

update public.polls
set join_code = upper(substr(md5(id::text), 1, 6))
where join_code is null;

alter table public.polls alter column join_code set not null;
create unique index if not exists polls_join_code_key on public.polls(join_code);

create or replace function public.assign_poll_join_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.join_code is null or char_length(trim(new.join_code)) = 0 then
    new.join_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  end if;
  return new;
end; $$;

drop trigger if exists assign_poll_join_code on public.polls;
create trigger assign_poll_join_code before insert on public.polls
for each row execute procedure public.assign_poll_join_code();
