-- PollPulse: run with `supabase db push` or in the Supabase SQL editor.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 5 and 140),
  description text check (char_length(description) <= 500),
  category text not null default 'General',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 120),
  position smallint not null check (position between 1 and 6),
  vote_count integer not null default 0 check (vote_count >= 0),
  unique(poll_id, position)
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(poll_id, user_id)
);

create index polls_owner_idx on public.polls(owner_id);
create index polls_published_created_idx on public.polls(is_published, created_at desc);
create index options_poll_idx on public.poll_options(poll_id);
create index votes_option_idx on public.votes(option_id);

create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  insert into public.user_roles(user_id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create function public.validate_vote_option() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.poll_options where id = new.option_id and poll_id = new.poll_id) then raise exception 'Option does not belong to this poll'; end if;
  return new;
end; $$;
create trigger validate_vote_option before insert on public.votes for each row execute procedure public.validate_vote_option();

create function public.refresh_vote_count() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.poll_options set vote_count = vote_count + 1 where id = new.option_id; return new; end if;
  update public.poll_options set vote_count = greatest(vote_count - 1, 0) where id = old.option_id; return old;
end; $$;
create trigger refresh_vote_count after insert or delete on public.votes for each row execute procedure public.refresh_vote_count();

alter table public.profiles enable row level security; alter table public.user_roles enable row level security; alter table public.polls enable row level security; alter table public.poll_options enable row level security; alter table public.votes enable row level security;
create policy "public profiles readable" on public.profiles for select using (true);
create policy "users update own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "users view own role" on public.user_roles for select using (user_id = auth.uid());
create policy "published polls readable" on public.polls for select using (is_published or owner_id = auth.uid() or public.is_admin());
create policy "users create polls" on public.polls for insert with check (owner_id = auth.uid());
create policy "owners manage polls" on public.polls for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy "admins delete polls" on public.polls for delete using (public.is_admin());
create policy "options readable with poll" on public.poll_options for select using (exists(select 1 from public.polls where id = poll_id and (is_published or owner_id = auth.uid() or public.is_admin())));
create policy "owners add options" on public.poll_options for insert with check (exists(select 1 from public.polls where id = poll_id and owner_id = auth.uid()));
create policy "owners update options" on public.poll_options for update using (exists(select 1 from public.polls where id = poll_id and owner_id = auth.uid()));
create policy "voters see their votes" on public.votes for select using (user_id = auth.uid() or public.is_admin());
create policy "users vote once" on public.votes for insert with check (user_id = auth.uid() and exists(select 1 from public.polls where id = poll_id and is_published));

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
create policy "avatar upload own folder" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "public avatar read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatar owner update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
