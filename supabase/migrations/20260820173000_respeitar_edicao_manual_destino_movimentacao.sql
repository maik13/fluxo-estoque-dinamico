BEGIN;

-- O destino vindo da solicitação deve ser copiado ao criar a movimentação ou
-- ao trocar a solicitação vinculada. Uma edição manual do destino não pode ser
-- sobrescrita pelo valor original da solicitação.
DROP TRIGGER IF EXISTS trg_sincronizar_local_movimentacao_com_solicitacao
ON public.movements;

CREATE TRIGGER trg_sincronizar_local_movimentacao_com_solicitacao
BEFORE INSERT OR UPDATE OF solicitacao_id
ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_local_movimentacao_com_solicitacao();

COMMIT;
