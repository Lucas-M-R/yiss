-- Ajouter une colonne pour stocker le hash du mot de passe
-- Vérifier d'abord si la table users existe
do $$
begin
  -- Vérifier si la table users existe
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    -- Vérifier si la colonne password_hash existe déjà
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'users' and column_name = 'password_hash'
    ) then
      alter table users add column password_hash text;
    end if;
  end if;
end $$;
