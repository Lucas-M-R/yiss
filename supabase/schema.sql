-- =============================================================================
-- SPOR — Schéma Supabase
-- À exécuter dans l'éditeur SQL de votre projet Supabase
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- =============================================================================
-- USERS
-- =============================================================================
create table users (
  id             text primary key,           -- OAuth sub (Google user ID)
  email          text unique not null,
  display_name   text not null,
  avatar_url     text,
  partner_id     text references users(id) on delete set null,
  created_at     timestamptz default now()
);

-- =============================================================================
-- PARTNER INVITATIONS
-- =============================================================================
create table partner_invitations (
  id           uuid primary key default gen_random_uuid(),
  inviter_id   text not null references users(id) on delete cascade,
  invitee_email text not null,
  token        text unique not null default encode(gen_random_bytes(32), 'hex'),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz default now()
);

-- =============================================================================
-- EXERCISES
-- =============================================================================
create table exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  category     text not null default 'strength' check (category in ('strength', 'cardio')),
  created_by   text references users(id) on delete set null,  -- null = exercice global
  created_at   timestamptz default now(),
  unique(name, created_by)
);

-- Exercices globaux de départ (mockup)
insert into exercises (name, category, created_by) values
  ('Développé couché', 'strength', null),
  ('Squat', 'strength', null),
  ('Soulevé de terre', 'strength', null),
  ('Développé militaire', 'strength', null),
  ('Tirage vertical', 'strength', null),
  ('Rowing barre', 'strength', null),
  ('Curl biceps', 'strength', null),
  ('Extension triceps', 'strength', null),
  ('Leg press', 'strength', null),
  ('Fentes', 'strength', null),
  ('Tapis de course', 'cardio', null),
  ('Vélo elliptique', 'cardio', null),
  ('Escalier', 'cardio', null),
  ('Rameur', 'cardio', null);

-- =============================================================================
-- PROGRAMS
-- =============================================================================
create table programs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  owner_id     text not null references users(id) on delete cascade,
  is_shared    boolean not null default false,  -- true = partagé avec le partenaire
  created_at   timestamptz default now()
);

-- =============================================================================
-- PROGRAM DAYS
-- =============================================================================
create table program_days (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references programs(id) on delete cascade,
  label        text not null,   -- ex: "Lundi", "Jour A", "Poussée"
  sort_order   int not null default 0,
  created_at   timestamptz default now()
);

-- =============================================================================
-- PROGRAM DAY EXERCISES
-- =============================================================================
create table program_day_exercises (
  id              uuid primary key default gen_random_uuid(),
  program_day_id  uuid not null references program_days(id) on delete cascade,
  exercise_id     uuid not null references exercises(id) on delete cascade,
  default_sets    int not null default 3,
  sort_order      int not null default 0
);

-- =============================================================================
-- SESSIONS
-- =============================================================================
create table sessions (
  id               uuid primary key default gen_random_uuid(),
  session_date     date not null,
  program_day_id   uuid references program_days(id) on delete set null,
  created_by       text not null references users(id) on delete cascade,
  notes            text,
  created_at       timestamptz default now(),
  unique(session_date, created_by)
);

-- =============================================================================
-- SESSION PARTICIPANTS
-- Les deux partenaires sont liés à la même session
-- =============================================================================
create table session_participants (
  session_id  uuid not null references sessions(id) on delete cascade,
  user_id     text not null references users(id) on delete cascade,
  primary key (session_id, user_id)
);

-- =============================================================================
-- SESSION EXERCISES
-- Exercices d'une séance (peut dévier du programme)
-- =============================================================================
create table session_exercises (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references sessions(id) on delete cascade,
  exercise_id  uuid not null references exercises(id) on delete cascade,
  sets_count   int not null default 3,
  sort_order   int not null default 0
);

-- =============================================================================
-- SESSION SETS
-- Une ligne par série × par personne
-- =============================================================================
create table session_sets (
  id                   uuid primary key default gen_random_uuid(),
  session_exercise_id  uuid not null references session_exercises(id) on delete cascade,
  user_id              text not null references users(id) on delete cascade,
  set_number           int not null,
  reps                 int,           -- null pour cardio
  weight_kg            numeric(6,2),  -- null pour cardio ou poids de corps
  duration_sec         int,           -- cardio ou repos optionnel
  rest_sec             int,           -- temps de repos après la série (optionnel)
  created_at           timestamptz default now(),
  unique(session_exercise_id, user_id, set_number)
);

-- =============================================================================
-- INDEX
-- =============================================================================
create index idx_sessions_date          on sessions(session_date);
create index idx_sessions_created_by    on sessions(created_by);
create index idx_session_exercises_sid  on session_exercises(session_id);
create index idx_session_sets_sie       on session_sets(session_exercise_id);
create index idx_session_sets_user      on session_sets(user_id);
create index idx_exercises_category     on exercises(category);

-- =============================================================================
-- VIEW: stats par exercice et par utilisateur
-- Agrège charge max et volume total
-- =============================================================================
create or replace view exercise_stats as
select
  ss.user_id,
  e.id        as exercise_id,
  e.name      as exercise_name,
  s.session_date,
  max(ss.weight_kg)                                        as max_weight,
  sum(ss.reps * ss.weight_kg)                              as volume,
  count(distinct se.id)                                    as total_sets,
  sum(ss.reps)                                             as total_reps
from session_sets ss
join session_exercises se on se.id = ss.session_exercise_id
join sessions s            on s.id  = se.session_id
join exercises e           on e.id  = se.exercise_id
where ss.reps is not null and ss.weight_kg is not null
group by ss.user_id, e.id, e.name, s.session_date;
