# Spor — Spécifications fonctionnelles

## Vision

Application mobile-first de suivi d'entraînement sportif en **duo**. Deux partenaires (amis, couple, coach/athlète) partagent leurs séances et suivent mutuellement leur progression.

---

## Utilisateurs

- **Compte unique** par utilisateur (email + mot de passe en dev, Google OAuth en prod)
- Chaque utilisateur peut avoir **un partenaire** lié via invitation
- Un partenaire peut voir les séances et stats de l'autre

---

## Fonctionnalités

### Auth
- Connexion email/password (mode développement)
- Connexion Google OAuth (mode production — à configurer)
- Session persistante via cookie chiffré (`nuxt-auth-utils`)
- Déconnexion depuis les paramètres

### Dashboard (/)
- Date du jour formatée
- **Séance du jour** : lien vers la séance, résumé si existante
- **Bande hebdomadaire** : Lun→Dim avec indicateur de séance par jour
- **Stats rapides** : nombre de séances du mois + 7 derniers jours
- **Dernières séances** : liste des 5 plus récentes

### Séance (/session/[date])
- Création automatique de la séance si elle n'existe pas
- Association optionnelle à un **jour de programme**
- Liste des exercices de la séance
- Pour chaque exercice :
  - Nombre de séries configuré
  - Saisie des séries : reps + poids (force) ou durée (cardio)
  - Vue côte à côte des performances du user et du partenaire
- Ajout d'exercices à la séance (depuis la liste globale)
- Suppression d'un exercice
- Notes libres sur la séance

### Exercices (/exercises)
- Liste des exercices globaux + exercices créés par l'utilisateur
- Catégories : `strength` (force) / `cardio`
- Création d'un exercice personnalisé
- Suppression d'un exercice personnel

### Programmes (/programs)
- Liste des programmes de l'utilisateur
- Création d'un programme (nom)
- **Partage** avec le partenaire (`is_shared: true`)
- Détail d'un programme (`/programs/[id]`) :
  - Liste des jours (ex: "Jour A", "Poussée", "Lundi")
  - Ajout/suppression de jours
  - Pour chaque jour : liste d'exercices avec nombre de séries par défaut
  - Ajout/suppression d'exercices dans un jour
- Suppression d'un programme

### Statistiques (/stats)
- Progression par exercice : charge max au fil du temps (graphique)
- Volume total par exercice
- Filtre par exercice
- Vue `exercise_stats` en base (agrégation SQL)

### Paramètres (/settings)
- Affichage du profil (nom, avatar)
- Modification du nom d'affichage
- Section partenaire :
  - Affichage du partenaire actuel (nom, avatar)
  - Envoi d'une invitation par email
  - Dissociation du partenaire
- Déconnexion

### Invitation partenaire (/invite/[token])
- Page publique (pas de auth requise)
- Acceptation de l'invitation → lie les deux comptes
- Token expirant (7 jours)

### Import (/import)
- Import de données existantes (format à définir)

---

## Modèle de données

### `users`
| Champ | Type | Description |
|-------|------|-------------|
| id | text PK | Email (auth simple) ou Google sub (OAuth) |
| email | text unique | Email |
| display_name | text | Nom affiché |
| avatar_url | text | URL photo |
| partner_id | text FK→users | Partenaire lié |

### `exercises`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| name | text | Nom |
| category | text | `strength` ou `cardio` |
| created_by | text FK→users | null = exercice global |

### `programs` + `program_days` + `program_day_exercises`
Structure hiérarchique : Programme → Jours → Exercices avec sets par défaut

### `sessions`
| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| session_date | date | Date (unique par user) |
| program_day_id | uuid FK | Jour de programme associé (optionnel) |
| created_by | text FK→users | Créateur |
| notes | text | Notes libres |

### `session_participants`
Table de jointure session ↔ users (permet au partenaire de participer)

### `session_exercises` + `session_sets`
- `session_exercises` : exercices d'une séance avec ordre
- `session_sets` : une ligne par série × par utilisateur (reps, poids, durée, repos)

### Vue `exercise_stats`
Agrège charge max, volume, sets et reps par (user, exercice, date)

---

## Règles métier

- Une séance est **unique par date par utilisateur** (contrainte SQL)
- Un exercice global (`created_by = null`) est visible par tous, non supprimable
- Un programme partagé (`is_shared = true`) est visible par le partenaire
- Les deux partenaires contribuent leurs séries dans la même `session_exercises`
- L'invitation expire après 7 jours
- Un utilisateur ne peut avoir qu'un seul partenaire à la fois

---

## Contraintes techniques

- **Mobile-first** : conçu pour smartphone, layout bottom nav
- **PWA** : installable, mode standalone
- **SSR** : Nuxt 4 avec rendu serveur
- **Dark mode** forcé (zinc-950 background)
- Couleur principale : violet (`violet-600` / `violet-400`)
