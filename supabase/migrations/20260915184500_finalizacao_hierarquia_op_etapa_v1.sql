-- Protege a conclusão hierárquica da Produção.
-- Uma Etapa só pode ser finalizada quando:
-- 1) não houver apontamento/jornada em aberto;
-- 2) todas as OPs estiverem concluídas ou canceladas;
-- 3) não houver apontamentos pendentes de conferência.
-- Não altera dados existentes durante a instalação.

BEGIN;

CREATE OR REPLACE FUNCTION public.validar_finalizacao_etapa_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'finalizado'
     AND OLD.status IS DISTINCT FROM 'finalizado' THEN

    IF EXISTS (
      SELECT 1
      FROM public.producao_op_jornadas j
      JOIN public.producao_ordens_producao o
        ON o.id = j.ordem_producao_id
      WHERE o.processo_id = NEW.id
        AND j.status = 'aberta'
    ) THEN
      RAISE EXCEPTION 'FINALIZACAO_ETAPA: Existe apontamento em andamento. Encerre ou descarte o apontamento aberto antes de finalizar a Etapa';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.producao_ordens_producao o
      WHERE o.processo_id = NEW.id
        AND o.status NOT IN ('concluida', 'cancelada')
    ) THEN
      RAISE EXCEPTION 'FINALIZACAO_ETAPA: Existem OPs ainda abertas. Conclua ou cancele todas as OPs antes de finalizar a Etapa';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.producao_apontamentos a
      WHERE a.processo_id = NEW.id
        AND a.status = 'lancado'
    ) THEN
      RAISE EXCEPTION 'FINALIZACAO_ETAPA: Existem apontamentos pendentes de conferência. Resolva-os antes de finalizar a Etapa';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_finalizacao_etapa_v1
  ON public.producao_processos;

CREATE TRIGGER trg_validar_finalizacao_etapa_v1
BEFORE UPDATE OF status
ON public.producao_processos
FOR EACH ROW
EXECUTE FUNCTION public.validar_finalizacao_etapa_v1();

REVOKE ALL ON FUNCTION public.validar_finalizacao_etapa_v1() FROM PUBLIC;

NOTIFY pgrst, 'reload schema';

COMMIT;

SELECT
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_validar_finalizacao_etapa_v1'
      AND NOT tgisinternal
  ) AS protecao_finalizacao_etapa_instalada,
  (
    SELECT COUNT(*)
    FROM public.producao_ordens_producao
    WHERE status NOT IN ('concluida', 'cancelada')
  ) AS ops_abertas_preservadas,
  (
    SELECT COUNT(*)
    FROM public.producao_op_jornadas
    WHERE status = 'aberta'
  ) AS jornadas_abertas_preservadas,
  (
    SELECT COUNT(*)
    FROM public.producao_apontamentos
    WHERE status = 'lancado'
  ) AS apontamentos_pendentes_preservados;
