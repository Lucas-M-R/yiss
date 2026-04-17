-- Ajouter la colonne password_hash et garantir l'unicité des emails
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'users'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'users' and column_name = 'password_hash'
    ) then
      alter table public.users add column password_hash text;
    end if;

    drop index if exists users_email_idx;
    create unique index if not exists users_email_lower_uidx on public.users (lower(email));
  end if;
end $$;
