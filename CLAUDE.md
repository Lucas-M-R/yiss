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
    login.vue          # Formulaire email/password + magic link (toggle)
    auth/verify.vue    # Page de callback pour magic link
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
    auth.ts                      # Protège /api/* (sauf /api/auth/*)
  routes/
    auth/google.get.ts           # OAuth Google (problème Firefox)
  api/
    auth/
      login.post.ts              # Auth simple : vérifie NUXT_AUTH_EMAIL + NUXT_AUTH_PASSWORD
      send-magic-link.post.ts    # Envoie un lien de connexion par email (Resend)
      verify-magic-link.post.ts  # Vérifie le token du magic link
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
NUXT_RESEND_API_KEY=      # Clé API Resend pour l'envoi d'emails (magic link)
NUXT_EMAIL_FROM=          # Optionnel : "Spor <noreply@votredomaine.com>"
NUXT_PUBLIC_APP_URL=      # URL de l'app (ex: http://localhost:3000 en dev)
# Google OAuth (optionnel, problème Firefox connu)
NUXT_OAUTH_GOOGLE_CLIENT_ID=
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=
```

## État actuel (avril 2026)

### Ce qui fonctionne ✅
- **Auth complète** :
  - **Magic link par email** (Resend) — Le lien pointe vers `/login?token=...` pour éviter les problèmes de routing SSR
  - **Email + mot de passe** (bcrypt) — L'utilisateur peut définir un mot de passe dans les paramètres
  - Google OAuth (problème sur Firefox, désactivé)
- **Storage des magic links** : Filesystem storage (`.data/magic-links/`) avec TTL de 15 minutes
- **Gestion des mots de passe** : Hachage bcrypt, API `/api/auth/set-password` pour définir/changer le mot de passe
- Styles Nuxt UI + Tailwind v4 correctement chargés
- Layout auth (login centré) + layout default (header + bottom nav)
- Connexion Supabase établie (credentials dans .env)
- Structure complète des pages et API
- Migration Supabase appliquée : colonne `password_hash` dans la table `users`

### Ce qui reste à faire / bugs connus

1. **Page `/session/[date]`** — à tester une fois les données remplies
2. **Import de données** — page existe, à tester
3. **Auth Google : problème Firefox** — Google OAuth fonctionne sur Chromium mais pas sur Firefox. Désactivé pour l'instant.
4. **Domaine Resend** — En mode test, les emails ne sont envoyés qu'à l'adresse vérifiée dans Resend. Il faut vérifier un domaine pour envoyer à n'importe quelle adresse.

### Configuration Magic Link (Resend)

Pour activer l'authentification par magic link :

1. Créer un compte sur [resend.com](https://resend.com)
2. Récupérer la clé API
3. Ajouter dans `.env` :
   ```env
   NUXT_RESEND_API_KEY=re_xxxxx
   NUXT_PUBLIC_APP_URL=http://localhost:3000  # ou URL prod
   ```
4. (Optionnel) Configurer un domaine vérifié dans Resend et modifier `NUXT_EMAIL_FROM`

Le magic link expire après 15 minutes.

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
