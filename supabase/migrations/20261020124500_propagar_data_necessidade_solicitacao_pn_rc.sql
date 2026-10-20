CREATE OR REPLACE FUNCTION public.propagar_data_necessidade_solicitacao_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.data_necessidade IS NOT DISTINCT FROM OLD.data_necessidade THEN
    RETURN NEW;
  END IF;

  UPDATE public.financeiro_necessidades
  SET data_necessidade = NEW.data_necessidade,
      data_prevista_desembolso = NEW.data_necessidade,
      updated_at = now()
  WHERE solicitacao_material_id = NEW.id;

  UPDATE public.pedidos_compra
  SET data_necessaria = NEW.data_necessidade,
      updated_at = now()
  WHERE solicitacao_material_id = NEW.id;

  UPDATE public.financeiro_lancamentos lancamento
  SET data_prevista = NEW.data_necessidade,
      updated_at = now()
  FROM public.financeiro_necessidades necessidade
  WHERE necessidade.solicitacao_material_id = NEW.id
    AND lancamento.necessidade_id = necessidade.id;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_propagar_data_necessidade_solicitacao
ON public.solicitacoes_material;

CREATE TRIGGER trg_propagar_data_necessidade_solicitacao
AFTER UPDATE OF data_necessidade ON public.solicitacoes_material
FOR EACH ROW
EXECUTE FUNCTION public.propagar_data_necessidade_solicitacao_v1();

REVOKE ALL ON FUNCTION public.propagar_data_necessidade_solicitacao_v1() FROM PUBLIC;
