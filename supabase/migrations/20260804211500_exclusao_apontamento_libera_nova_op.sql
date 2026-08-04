-- Ao excluir administrativamente o último apontamento de uma OP,
-- cancela a OP vazia para devolver seu saldo à Etapa e permitir nova emissão.

BEGIN;

CREATE OR REPLACE FUNCTION public.excluir_apontamento_producao_admin(
  p_apontamento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome_usuario TEXT;
  v_ordem_id UUID;
  v_status_anterior TEXT;
  v_restantes BIGINT := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem excluir apontamentos';
  END IF;

  SELECT a.ordem_producao_id
    INTO v_ordem_id
    FROM public.producao_apontamentos a
   WHERE a.id = p_apontamento_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apontamento não encontrado';
  END IF;

  v_nome_usuario := public.nome_usuario_producao(v_user);

  DELETE FROM public.producao_apontamentos
   WHERE id = p_apontamento_id;

  IF v_ordem_id IS NULL THEN
    RETURN;
  END IF;

  SELECT o.status
    INTO v_status_anterior
    FROM public.producao_ordens_producao o
   WHERE o.id = v_ordem_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
    INTO v_restantes
    FROM public.producao_apontamentos a
   WHERE a.ordem_producao_id = v_ordem_id;

  IF v_restantes = 0 THEN
    IF v_status_anterior <> 'cancelada' THEN
      UPDATE public.producao_ordens_producao
         SET status = 'cancelada',
             motivo_cancelamento = 'Cancelada automaticamente após a exclusão administrativa do último apontamento.',
             data_inicio_real = NULL,
             data_fim_real = NULL,
             atualizado_por_id = v_user,
             atualizado_por_nome_snapshot = v_nome_usuario,
             updated_at = NOW()
       WHERE id = v_ordem_id;

      INSERT INTO public.producao_ordem_eventos (
        ordem_producao_id,
        evento,
        status_anterior,
        novo_status,
        usuario_id,
        nome_usuario_snapshot,
        justificativa,
        dados
      ) VALUES (
        v_ordem_id,
        'cancelamento_automatico_apos_exclusao',
        v_status_anterior,
        'cancelada',
        v_user,
        v_nome_usuario,
        'Último apontamento da OP excluído administrativamente.',
        jsonb_build_object('apontamento_excluido_id', p_apontamento_id)
      );
    END IF;
  ELSE
    PERFORM public.atualizar_status_ordem_producao(v_ordem_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_apontamento_producao_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_apontamento_producao_admin(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
