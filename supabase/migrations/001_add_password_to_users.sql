-- Ajouter une colonne pour stocker le hash du mot de passe
-- Vérifier d'abord si la table users existe
do $$
begin
  -- Vérifier si la table users existe
  if exists (
    select 1 from information_schema.tables
    where table_name = 'users'
  ) then
    -- Vérifier si la colonne password_hash existe déjà
    if not exists (
      select 1 from information_schema.columns
      where table_name = 'users' and column_name = 'password_hash'
    ) then
      alter table users add column password_hash text;
    end if;

    -- Créer l'index si la table existe
    create index if not exists users_email_idx on users(email);
  end if;
end $$;
