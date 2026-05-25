-- =============================================================================
-- SPOR — Schéma initial (idempotent)
-- Crée toutes les tables de base si elles n'existent pas déjà.
-- =============================================================================

create extension if not exists "pgcrypto";

-- Users
create table if not exists users (
  id             text primary key,
  email          text unique not null,
  display_name   text not null,
  avatar_url     text,
  partner_id     text references users(id) on delete set null,
  created_at     timestamptz default now()
);

-- Partner invitations
create table if not exists partner_invitations (
  id            uuid primary key default gen_random_uuid(),
  inviter_id    text not null references users(id) on delete cascade,
  invitee_email text not null,
  token         text unique not null default encode(gen_random_bytes(32), 'hex'),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  created_at    timestamptz default now()
);

-- Exercises
create table if not exists exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null default 'strength' check (category in ('strength', 'cardio')),
  created_by   text references users(id) on delete set null,
  created_at   timestamptz default now(),
  unique(name, created_by)
);

insert into exercises (name, category, created_by) values
  ('Développé couché',    'strength', null),
  ('Squat',               'strength', null),
  ('Soulevé de terre',    'strength', null),
  ('Développé militaire', 'strength', null),
  ('Tirage vertical',     'strength', null),
  ('Rowing barre',        'strength', null),
  ('Curl biceps',         'strength', null),
  ('Extension triceps',   'strength', null),
  ('Leg press',           'strength', null),
  ('Fentes',              'strength', null),
  ('Tapis de course',     'cardio',   null),
  ('Vélo elliptique',     'cardio',   null),
  ('Escalier',            'cardio',   null),
  ('Rameur',              'cardio',   null)
on conflict do nothing;

-- Programs
create table if not exists programs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  owner_id     text not null references users(id) on delete cascade,
  is_shared    boolean not null default false,
  created_at   timestamptz default now()
);

-- Program days
create table if not exists program_days (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references programs(id) on delete cascade,
  label        text not null,
  sort_order   int not null default 0,
  created_at   timestamptz default now()
);

-- Program day exercises
create table if not exists program_day_exercises (
  id              uuid primary key default gen_random_uuid(),
  program_day_id  uuid not null references program_days(id) on delete cascade,
  exercise_id     uuid not null references exercises(id) on delete cascade,
  default_sets    int not null default 3,
  sort_order      int not null default 0
);

-- Sessions
create table if not exists sessions (
  id               uuid primary key default gen_random_uuid(),
  session_date     date not null,
  program_day_id   uuid references program_days(id) on delete set null,
  created_by       text not null references users(id) on delete cascade,
  notes            text,
  created_at       timestamptz default now(),
  unique(session_date, created_by)
);

-- Session participants
create table if not exists session_participants (
  session_id  uuid not null references sessions(id) on delete cascade,
  user_id     text not null references users(id) on delete cascade,
  primary key (session_id, user_id)
);

-- Session exercises
create table if not exists session_exercises (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  exercise_id  uuid not null references exercises(id) on delete cascade,
  sets_count   int not null default 3,
  sort_order   int not null default 0,
  notes        text
);

-- Session sets
create table if not exists session_sets (
  id                   uuid primary key default gen_random_uuid(),
  session_exercise_id  uuid not null references session_exercises(id) on delete cascade,
  user_id              text not null references users(id) on delete cascade,
  set_number           int not null,
  reps                 int,
  weight_kg            numeric(6,2),
  duration_sec         int,
  rest_sec             int,
  created_at           timestamptz default now(),
  unique(session_exercise_id, user_id, set_number)
);

-- Indexes
create index if not exists idx_sessions_date         on sessions(session_date);
create index if not exists idx_sessions_created_by   on sessions(created_by);
create index if not exists idx_session_exercises_sid on session_exercises(session_id);
create index if not exists idx_session_sets_sie      on session_sets(session_exercise_id);
create index if not exists idx_session_sets_user     on session_sets(user_id);
create index if not exists idx_exercises_category    on exercises(category);

-- View: stats par exercice et par utilisateur
create or replace view exercise_stats as
select
  ss.user_id,
  e.id        as exercise_id,
  e.name      as exercise_name,
  s.session_date,
  max(ss.weight_kg)            as max_weight,
  sum(ss.reps * ss.weight_kg)  as volume,
  count(distinct se.id)        as total_sets,
  sum(ss.reps)                 as total_reps
from session_sets ss
join session_exercises se on se.id = ss.session_exercise_id
join sessions s           on s.id  = se.session_id
join exercises e          on e.id  = se.exercise_id
where ss.reps is not null and ss.weight_kg is not null
group by ss.user_id, e.id, e.name, s.session_date;
