-- =============================================================================
-- Sécurité : verrouille l'accès direct à la base via l'API REST Supabase.
--
-- L'app ne passe que par le serveur Nuxt avec la clé service_role, qui ignore
-- RLS. Activer RLS sans aucune policy bloque donc tout accès via les clés
-- anon / authenticated (PostgREST) sans rien changer au fonctionnement de l'app.
-- Corrige les alertes du Security Advisor :
--   - rls_disabled_in_public  (tables exposées sans RLS)
--   - security_definer_view   (vue exercise_stats exécutée avec les droits du créateur)
-- =============================================================================

alter table public.users                  enable row level security;
alter table public.partner_invitations    enable row level security;
alter table public.exercises              enable row level security;
alter table public.programs               enable row level security;
alter table public.program_days           enable row level security;
alter table public.program_day_exercises  enable row level security;
alter table public.sessions               enable row level security;
alter table public.session_participants   enable row level security;
alter table public.session_exercises      enable row level security;
alter table public.session_sets           enable row level security;

-- La vue s'exécute avec les droits de l'appelant (donc soumise à RLS)
alter view public.exercise_stats set (security_invoker = on);

-- Défense en profondeur : aucun droit pour les rôles exposés par l'API REST
revoke all on all tables in schema public from anon, authenticated;
