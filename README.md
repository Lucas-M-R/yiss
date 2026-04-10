# Spor

Application mobile-first de suivi d'entraînement sportif en duo. Deux partenaires partagent leurs séances et suivent mutuellement leur progression. PWA installable sur mobile.

## Stack

- **Nuxt 4** + Nuxt UI v4 + Tailwind CSS v4
- **nuxt-auth-utils** — sessions sécurisées (email/password en dev, Google OAuth en prod)
- **Supabase** (PostgreSQL)
- **Vercel** (hébergement)

---

## Mise en route

### 1. Base de données Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Aller dans **SQL Editor** et exécuter le contenu de `supabase/schema.sql`
3. Récupérer dans **Settings → API** :
   - `Project URL` → `NUXT_PUBLIC_SUPABASE_URL`
   - `service_role` secret → `NUXT_SUPABASE_SERVICE_KEY`

### 2. Google OAuth

1. Aller sur [console.cloud.google.com](https://console.cloud.google.com)
2. Créer un projet → **APIs & Services → Credentials → Create OAuth 2.0 Client ID**
3. Type : **Web application**
4. Authorized redirect URIs :
   - `http://localhost:3000/auth/google` (dev)
   - `https://votre-domaine.vercel.app/auth/google` (prod)
5. Récupérer `Client ID` et `Client Secret`

### 3. Variables d'environnement

```bash
cp .env.example .env
```

Remplir `.env` :

```env
NUXT_SESSION_PASSWORD=<32 caractères aléatoires minimum>

# Auth simple (développement)
NUXT_AUTH_EMAIL=admin@spor.app
NUXT_AUTH_PASSWORD=monmotdepasse

# Supabase
NUXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NUXT_SUPABASE_SERVICE_KEY=<clé service_role>

# Google OAuth (production uniquement)
NUXT_OAUTH_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=GOCSPX-xxx
```

> Générer un mot de passe de session : `openssl rand -base64 32`

### 4. Lancer en développement

```bash
yarn install
yarn dev
```

→ [http://localhost:3000](http://localhost:3000)

---

## Déploiement sur Vercel

1. Pusher le repo sur GitHub
2. Importer le projet sur [vercel.com](https://vercel.com)
3. Ajouter les variables d'environnement dans **Settings → Environment Variables**
4. Ajouter l'URL Vercel dans les redirect URIs Google OAuth

---

## Lier deux comptes partenaires

1. **Personne A** se connecte → va dans **Paramètres** → envoie une invitation par email à la Personne B
2. **Personne B** reçoit un lien → se connecte → les deux comptes sont liés
3. Les séances sont alors partagées entre les deux

## Import de l'historique

Aller sur `/import`, coller ou uploader un fichier JSON au format :

```json
[
  {
    "date": "2025-01-15",
    "program_day": "Lundi",
    "exercises": [
      {
        "name": "Développé couché",
        "sets": [
          { "set": 1, "p1_reps": 10, "p1_weight": 80, "p2_reps": 8, "p2_weight": 60 }
        ]
      },
      {
        "name": "Tapis de course",
        "sets": [
          { "set": 1, "p1_duration_sec": 1200, "p2_duration_sec": 900 }
        ]
      }
    ]
  }
]
```

`p1` = la personne qui importe · `p2` = le/la partenaire
