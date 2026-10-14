-- Snapshot somente-leitura dos dados operacionais antes de qualquer importação do MSP Natal 2026 v24.
-- Não altera objetos nem dados do schema public. O schema tem nome único e não é reutilizado.

BEGIN;

CREATE SCHEMA backup_msproject_20261014_v24_preimportacao;
REVOKE ALL ON SCHEMA backup_msproject_20261014_v24_preimportacao FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_tabela text;
BEGIN
  -- Inclui cada tabela operacional e sua auditoria/PCP, preservando o estado
  -- exato da produção neste instante, inclusive OPs, APs, eventos e planejamento.
  FOR v_tabela IN
    SELECT tablename
    FROM pg_catalog.pg_tables
    WHERE schemaname = 'public'
      AND left(tablename, 9) = 'producao_'
    ORDER BY tablename
  LOOP
    EXECUTE format(
      'CREATE TABLE backup_msproject_20261014_v24_preimportacao.%I AS TABLE public.%I',
      v_tabela,
      v_tabela
    );
  END LOOP;
END;
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA backup_msproject_20261014_v24_preimportacao FROM PUBLIC, anon, authenticated;
COMMENT ON SCHEMA backup_msproject_20261014_v24_preimportacao IS
  'Backup pré-importação do MS Project Natal 2026 v24; criado antes de qualquer gravação de OP/AP.';

COMMIT;
