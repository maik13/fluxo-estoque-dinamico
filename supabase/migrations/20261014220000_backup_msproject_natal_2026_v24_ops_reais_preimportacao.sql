-- Snapshot privado atualizado, imediatamente antes da importação de OPs reais.
-- Não modifica o schema public nem registros operacionais existentes.
BEGIN;

CREATE SCHEMA backup_msproject_20261014_v24_ops_reais_preimportacao;
REVOKE ALL ON SCHEMA backup_msproject_20261014_v24_ops_reais_preimportacao FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_tabela text;
BEGIN
  -- Inclui produção, OPs, APs, eventos e PCP, preservando cada tabela no
  -- estado anterior à importação. O schema é privado e somente leitura.
  FOR v_tabela IN
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND left(tablename, 9) = 'producao_'
    ORDER BY tablename
  LOOP
    EXECUTE format(
      'CREATE TABLE backup_msproject_20261014_v24_ops_reais_preimportacao.%I AS TABLE public.%I',
      v_tabela,
      v_tabela
    );
  END LOOP;
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA backup_msproject_20261014_v24_ops_reais_preimportacao FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA backup_msproject_20261014_v24_ops_reais_preimportacao IS
  'Backup privado atualizado antes da importação real do MS Project Natal 2026 v24.';

COMMIT;
