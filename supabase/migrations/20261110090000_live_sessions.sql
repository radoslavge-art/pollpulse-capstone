-- PollPulse live sessions: multiple slides, anonymous devices, reactions and Q&A.
alter table public.polls add column if not exists is_session boolean not null default false;
alter table public.polls add column if not exists active_slide_id uuid;

create table if not exists public.session_slides (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 180),
  body text check (char_length(body) <= 500),
  kind text not null default 'question' check (kind in ('question', 'info')),
  question_type text check (question_type in ('multiple_choice', 'yes_no', 'open_text')),
  position smallint not null check (position between 1 and 30),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique(poll_id, position)
);

create table if not exists public.session_options (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.session_slides(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  position smallint not null check (position between 1 and 8),
  is_correct boolean not null default false,
  unique(slide_id, position)
);

alter table public.session_slides add column if not exists correct_option_id uuid references public.session_options(id) on delete set null;
alter table public.polls drop constraint if exists polls_active_slide_id_fkey;
alter table public.polls add constraint polls_active_slide_id_fkey foreign key (active_slide_id) references public.session_slides(id) on delete set null;

create table if not exists public.session_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  slide_id uuid not null references public.session_slides(id) on delete cascade,
  option_id uuid references public.session_options(id) on delete set null,
  guest_token text not null check (char_length(guest_token) between 16 and 120),
  profile_id uuid references public.profiles(id) on delete set null,
  text_answer text check (char_length(text_answer) <= 300),
  created_at timestamptz not null default now(),
  unique(slide_id, guest_token)
);

create table if not exists public.audience_reactions (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  guest_token text not null check (char_length(guest_token) between 16 and 120),
  emoji text not null check (emoji in ('👏', '🔥', '💡', '😮', '❤️')),
  created_at timestamptz not null default now()
);

create table if not exists public.audience_questions (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  guest_token text not null check (char_length(guest_token) between 16 and 120),
  body text not null check (char_length(body) between 3 and 300),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists session_slides_poll_position_idx on public.session_slides(poll_id, position);
create index if not exists session_responses_slide_idx on public.session_responses(slide_id);
create index if not exists reactions_poll_created_idx on public.audience_reactions(poll_id, created_at desc);
create index if not exists audience_questions_poll_idx on public.audience_questions(poll_id, approved, created_at desc);

alter table public.session_slides enable row level security;
alter table public.session_options enable row level security;
alter table public.session_responses enable row level security;
alter table public.audience_reactions enable row level security;
alter table public.audience_questions enable row level security;

create policy "published session slides readable" on public.session_slides for select using (exists(select 1 from public.polls where id = poll_id and is_published));
create policy "owners manage session slides" on public.session_slides for all using (exists(select 1 from public.polls where id = poll_id and owner_id = auth.uid())) with check (exists(select 1 from public.polls where id = poll_id and owner_id = auth.uid()));
create policy "published session options readable" on public.session_options for select using (exists(select 1 from public.session_slides s join public.polls p on p.id = s.poll_id where s.id = slide_id and p.is_published));
create policy "owners manage session options" on public.session_options for all using (exists(select 1 from public.session_slides s join public.polls p on p.id = s.poll_id where s.id = slide_id and p.owner_id = auth.uid())) with check (exists(select 1 from public.session_slides s join public.polls p on p.id = s.poll_id where s.id = slide_id and p.owner_id = auth.uid()));
create policy "session responses readable" on public.session_responses for select using (exists(select 1 from public.polls where id = poll_id and is_published));
create policy "guests answer active session slides" on public.session_responses for insert with check (exists(select 1 from public.session_slides s join public.polls p on p.id = s.poll_id where s.id = slide_id and p.id = poll_id and p.is_published and s.is_active));
create policy "reactions readable" on public.audience_reactions for select using (exists(select 1 from public.polls where id = poll_id and is_published));
create policy "guests send reactions" on public.audience_reactions for insert with check (exists(select 1 from public.polls where id = poll_id and is_published));
create policy "approved questions readable" on public.audience_questions for select using (approved or exists(select 1 from public.polls where id = poll_id and owner_id = auth.uid()));
create policy "guests ask questions" on public.audience_questions for insert with check (exists(select 1 from public.polls where id = poll_id and is_published));
create policy "owners moderate questions" on public.audience_questions for update using (exists(select 1 from public.polls where id = poll_id and owner_id = auth.uid())) with check (exists(select 1 from public.polls where id = poll_id and owner_id = auth.uid()));
