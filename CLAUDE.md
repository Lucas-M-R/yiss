# CLAUDE.md — Contexte projet Spor

## Ce qu'est ce projet

**Spor** est une application mobile-first de suivi d'entraînement sportif en duo. Deux partenaires partagent leurs séances et peuvent voir mutuellement leur progression.

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Nuxt 4 (`compatibilityVersion: 4`) |
| UI | Nuxt UI v4 (`@nuxt/ui@4.6.0`) + Tailwind CSS v4 |
| Auth | `nuxt-auth-utils@0.5.x` (sessions chiffrées via cookie) |
| Base de données | Supabase (PostgreSQL) via `@supabase/supabase-js` |
| PWA | `@vite-pwa/nuxt` |
| Déploiement cible | Vercel |

## Structure des fichiers clés

```
app/
  app.vue              # UApp > NuxtLayout > NuxtPage (ne pas oublier NuxtLayout !)
  assets/css/main.css  # @import "tailwindcss" + @import "@nuxt/ui" (OBLIGATOIRE en NuxtUI v4)
  layouts/
    auth.vue           # Page login : fond sombre centré
    default.vue        # App principale : header + bottom nav + slot
  pages/
    login.vue          # Formulaire email/password (auth simple)
    index.vue          # Dashboard : séance du jour, semaine, stats rapides
    session/[date].vue # Séance : exercices + séries par utilisateur + partenaire
    exercises/         # Liste et création d'exercices
    programs/          # Programmes d'entraînement (jours + exercices)
    stats/             # Graphiques de progression
    settings/          # Profil utilisateur
    import/            # Import de données
    invite/[token].vue # Invitation partenaire
  composables/
    useAuth.ts         # Wrapper useUserSession() + logout
  middleware/
    auth.ts            # Redirige vers /login si non connecté
server/
  middleware/
    auth.ts            # Protège /api/* (sauf /api/auth/*)
  routes/
    auth/google.get.ts # OAuth Google (désactivé faute de credentials)
  api/
    auth/login.post.ts # Auth simple : vérifie NUXT_AUTH_EMAIL + NUXT_AUTH_PASSWORD
    users/             # GET/PATCH profil
    exercises/         # CRUD exercices
    programs/          # CRUD programmes + jours
    sessions/          # CRUD séances par date
    session-exercises/ # PATCH/DELETE exercices dans une séance
    sets.post.ts       # Création de séries
    stats/             # Statistiques agrégées
    import.post.ts     # Import de données
    invitations/       # Invitation partenaire
  utils/
    supabase.ts        # Singleton client Supabase (service role)
supabase/
  schema.sql           # Schéma complet à exécuter dans Supabase SQL Editor
```

## Variables d'environnement (.env)

```env
NUXT_SESSION_PASSWORD=    # 32+ caractères, chiffrement des sessions
NUXT_AUTH_EMAIL=          # Email de connexion (auth simple dev)
NUXT_AUTH_PASSWORD=       # Mot de passe de connexion (auth simple dev)
NUXT_PUBLIC_SUPABASE_URL= # URL du projet Supabase
NUXT_SUPABASE_SERVICE_KEY=# Clé service_role Supabase (pas la clé anon !)
# Google OAuth (optionnel, désactivé pour l'instant)
NUXT_OAUTH_GOOGLE_CLIENT_ID=
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=
```

## État actuel (avril 2026)

### Ce qui fonctionne
- Auth simple email/password (login → session → redirect)
- Styles Nuxt UI + Tailwind v4 correctement chargés
- Layout auth (login centré) + layout default (header + bottom nav)
- Connexion Supabase établie (credentials dans .env)
- Structure complète des pages et API

### Ce qui reste à faire / bugs connus

1. **Schéma Supabase pas encore appliqué** — exécuter `supabase/schema.sql` dans le SQL Editor Supabase avant tout test
2. **Utilisateur non créé en base au login** — `server/api/auth/login.post.ts` fait un upsert mais échoue silencieusement si la table `users` n'existe pas encore. Une fois le schéma appliqué, ça marchera.
3. **Auth Google désactivée** — `server/routes/auth/google.get.ts` existe mais nécessite `NUXT_OAUTH_GOOGLE_CLIENT_ID` + `NUXT_OAUTH_GOOGLE_CLIENT_SECRET`. Quand on voudra l'activer, il faudra aussi s'assurer que `users.id` est compatible (Google sub vs email).
4. **`users.id` = email avec l'auth simple** — le schéma prévoyait `id = Google sub`. Avec l'auth simple, `id = email`. Ça marche mais c'est à garder en tête si on passe à Google OAuth plus tard.
5. **Page `/session/[date]`** — à tester une fois Supabase opérationnel
6. **Import de données** — page existe, à tester

## Modèle de données (résumé)

```
users ←──────────────── partner_id (auto-référence)
  ↓ created_by
programs → program_days → program_day_exercises → exercises
  ↓
sessions (unique par date + user)
  ↓ session_participants (les 2 partenaires)
  ↓
session_exercises → session_sets (une ligne par série × user)
                    ↑
                  exercises
```

Vue SQL : `exercise_stats` — charge max + volume par exercice + utilisateur + date

## Commandes utiles

```bash
yarn dev          # Démarrage serveur de dev
yarn build        # Build production
yarn preview      # Preview build prod
```

## Points d'attention NuxtUI v4

- **Toujours** avoir `app/assets/css/main.css` avec `@import "tailwindcss"` et `@import "@nuxt/ui"`
- **Toujours** avoir `<NuxtLayout>` dans `app/app.vue` sinon les layouts ne s'appliquent pas
- `app.config.ts` utilise `ui: { primary: 'violet', gray: 'zinc' }` (ancien format v2/v3 — à migrer si besoin)
- `colorMode: { preference: 'dark', fallback: 'dark' }` dans `nuxt.config.ts`
