-- Defesa em profundidade para a conta técnica de demonstração.
-- A marca local_test_mode vive em app_metadata (administrada no servidor).
-- O trigger é instalado em toda tabela de aplicação atualmente existente no
-- schema public. Novas tabelas devem repetir esta proteção na própria migration.
DO $block_local_test$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND NOT c.relispartition
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS block_local_test_all_writes ON %I.%I',
      target.schema_name,
      target.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER block_local_test_all_writes
         BEFORE INSERT OR UPDATE OR DELETE ON %I.%I
         FOR EACH ROW EXECUTE FUNCTION private.block_local_test_operational_write()',
      target.schema_name,
      target.table_name
    );
  END LOOP;
END
$block_local_test$;
