-- Ajouter une colonne pour stocker le hash du mot de passe
alter table users add column password_hash text;

-- Index pour améliorer les performances de recherche par email
create index if not exists users_email_idx on users(email);
