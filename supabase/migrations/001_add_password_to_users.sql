-- Ajouter une colonne pour stocker le hash du mot de passe
-- Utiliser DO pour vérifier si la colonne existe déjà
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'users' and column_name = 'password_hash'
  ) then
    alter table users add column password_hash text;
  end if;
end $$;

-- Index pour améliorer les performances de recherche par email
create index if not exists users_email_idx on users(email);
