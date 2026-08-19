-- Corrige o histórico de movimentações em três pontos:
-- 1) alinha UPDATE/DELETE de movements à permissão dinâmica usada pelo frontend;
-- 2) garante que movements/locais_utilizacao estejam publicados no Realtime;
-- 3) ao renomear um projeto/local, força evento de atualização das movimentações
--    vinculadas para que a UI recarregue o nome atual pelo local_utilizacao_id.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. RLS: frontend e banco passam a usar a mesma fonte de autorização.
--    A interface exibe lápis/lixeira por estoque.movimentacoes.editar.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "movements_update_all_auth" ON public.movements;
DROP POLICY IF EXISTS "movements_delete_all_auth" ON public.movements;
DROP POLICY IF EXISTS "Movements can be updated by authenticated users" ON public.movements;
DROP POLICY IF EXISTS "Movements can be deleted by authenticated users" ON public.movements;
DROP POLICY IF EXISTS "Inventory managers can update movements" ON public.movements;
DROP POLICY IF EXISTS "Only admins can delete movements" ON public.movements;
DROP POLICY IF EXISTS "Movements editable by effective permission" ON public.movements;
DROP POLICY IF EXISTS "Movements deletable by effective permission" ON public.movements;

CREATE POLICY "Movements editable by effective permission"
ON public.movements
FOR UPDATE
TO authenticated
USING (public.usuario_tem_permissao('estoque.movimentacoes.editar'))
WITH CHECK (public.usuario_tem_permissao('estoque.movimentacoes.editar'));

CREATE POLICY "Movements deletable by effective permission"
ON public.movements
FOR DELETE
TO authenticated
USING (public.usuario_tem_permissao('estoque.movimentacoes.editar'));

-- ---------------------------------------------------------------------------
-- 2. Realtime: torna a atualização visual determinística no modelo atual,
--    que já possui listeners postgres_changes para estas duas tabelas.
-- ---------------------------------------------------------------------------
ALTER TABLE public.movements REPLICA IDENTITY FULL;
ALTER TABLE public.locais_utilizacao REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movements;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'locais_utilizacao'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.locais_utilizacao;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. O nome do projeto/local não é duplicado em movements: o vínculo estável
--    continua sendo local_utilizacao_id. Ao alterar o nome do local, emitimos
--    UPDATE das linhas vinculadas para que o listener de movements refaça a
--    consulta e passe a exibir o nome atual.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notificar_movimentacoes_apos_renomear_local_v1()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.movements
       SET local_utilizacao_id = local_utilizacao_id
     WHERE local_utilizacao_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_movimentacoes_apos_renomear_local_v1
  ON public.locais_utilizacao;

CREATE TRIGGER trg_notificar_movimentacoes_apos_renomear_local_v1
AFTER UPDATE OF nome
ON public.locais_utilizacao
FOR EACH ROW
WHEN (OLD.nome IS DISTINCT FROM NEW.nome)
EXECUTE FUNCTION public.notificar_movimentacoes_apos_renomear_local_v1();

REVOKE ALL ON FUNCTION public.notificar_movimentacoes_apos_renomear_local_v1() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';

COMMIT;
