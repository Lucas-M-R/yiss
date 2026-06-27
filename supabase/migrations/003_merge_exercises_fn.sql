-- Fusionne deux exercices de façon atomique : reporte les références de
-- source_id vers target_id puis supprime l'exercice source, dans une seule
-- transaction (la fonction PL/pgSQL s'exécute toujours atomiquement).
create or replace function merge_exercises(source_id uuid, target_id uuid)
returns void
language plpgsql
as $$
begin
  update program_day_exercises set exercise_id = target_id where exercise_id = source_id;
  update session_exercises set exercise_id = target_id where exercise_id = source_id;
  delete from exercises where id = source_id;
end;
$$;
