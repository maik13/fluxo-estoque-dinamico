-- Reforça o cancelamento automático da OP quando o último apontamento é excluído.
-- Inclui uma função administrativa para reparar OPs vazias que já ficaram ativas
-- antes da aplicação da regra automática.

BEGIN;

CREATE OR REPLACE FUNCTION public.cancelar_ordem_vazia_producao_admin(
  p_ordem_producao_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome_usuario TEXT;
  v_status_anterior TEXT;
  v_total_apontamentos BIGINT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Somente administradores podem liberar o saldo de uma OP vazia';
  END IF;

  SELECT o.status
    INTO v_status_anterior
    FROM public.producao_ordens_producao o
   WHERE o.id = p_ordem_producao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  SELECT COUNT(*)
    INTO v_total_apontamentos
    FROM public.producao_apontamentos a
   WHERE a.ordem_producao_id = p_ordem_producao_id;

  IF v_total_apontamentos > 0 THEN
    RETURN FALSE;
  END IF;

  IF v_status_anterior = 'cancelada' THEN
    RETURN TRUE;
  END IF;

  v_nome_usuario := public.nome_usuario_producao(v_user);

  UPDATE public.producao_ordens_producao
     SET status = 'cancelada',
         motivo_cancelamento = 'Cancelada administrativamente porque não possui apontamentos.',
         data_inicio_real = NULL,
         data_fim_real = NULL,
         atualizado_por_id = v_user,
         atualizado_por_nome_snapshot = v_nome_usuario,
         updated_at = NOW()
   WHERE id = p_ordem_producao_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    status_anterior,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    justificativa
  ) VALUES (
    p_ordem_producao_id,
    'cancelamento_administrativo_op_vazia',
    v_status_anterior,
    'cancelada',
    v_user,
    v_nome_usuario,
    'OP sem apontamentos; saldo devolvido à Etapa.'
  );

  RETURN TRUE;
END;
$$;

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
  v_ordem_id UUID;
  v_restantes BIGINT;
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

  DELETE FROM public.producao_apontamentos
   WHERE id = p_apontamento_id;

  IF v_ordem_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
    INTO v_restantes
    FROM public.producao_apontamentos a
   WHERE a.ordem_producao_id = v_ordem_id;

  IF v_restantes = 0 THEN
    PERFORM public.cancelar_ordem_vazia_producao_admin(v_ordem_id);
  ELSE
    PERFORM public.atualizar_status_ordem_producao(v_ordem_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_ordem_vazia_producao_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_ordem_vazia_producao_admin(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.excluir_apontamento_producao_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_apontamento_producao_admin(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
