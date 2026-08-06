-- Finaliza uma Ordem de Produção e confere, na mesma transação,
-- todos os apontamentos pendentes vinculados a ela.
-- O Histórico permanece como fonte de consulta e auditoria.

BEGIN;

CREATE OR REPLACE FUNCTION public.finalizar_ordem_producao_com_conferencia_v1(
  p_ordem_producao_id UUID,
  p_justificativa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_op public.producao_ordens_producao%ROWTYPE;
  v_pendentes_conferidos INTEGER := 0;
  v_apontamentos_validos INTEGER := 0;
  v_realizado NUMERIC := 0;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para finalizar Ordens de Produção';
  END IF;

  SELECT *
    INTO v_op
    FROM public.producao_ordens_producao
   WHERE id = p_ordem_producao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION 'A OP não está aberta para finalização';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  -- Registra individualmente a conferência automática para preservar auditoria.
  INSERT INTO public.producao_apontamento_eventos (
    apontamento_id,
    evento,
    campo_alterado,
    valor_anterior,
    valor_novo,
    usuario_id,
    nome_usuario_snapshot,
    justificativa
  )
  SELECT
    a.id,
    'apontamento_conferido_ao_finalizar_op',
    'status',
    a.status,
    'conferido',
    v_user,
    v_nome,
    'Conferência automática realizada na finalização da OP'
  FROM public.producao_apontamentos a
  WHERE a.ordem_producao_id = v_op.id
    AND a.status = 'lancado';

  UPDATE public.producao_apontamentos
     SET status = 'conferido',
         conferido_por_id = v_user,
         conferido_por_nome_snapshot = v_nome,
         conferido_em = NOW(),
         updated_at = NOW()
   WHERE ordem_producao_id = v_op.id
     AND status = 'lancado';

  GET DIAGNOSTICS v_pendentes_conferidos = ROW_COUNT;

  SELECT
    COUNT(*) FILTER (WHERE a.status <> 'cancelado'),
    COALESCE(
      SUM(a.quantidade_produzida) FILTER (WHERE a.status = 'conferido'),
      0
    )
    INTO v_apontamentos_validos, v_realizado
    FROM public.producao_apontamentos a
   WHERE a.ordem_producao_id = v_op.id;

  IF v_apontamentos_validos = 0 THEN
    RAISE EXCEPTION 'A OP não possui apontamentos válidos para finalização';
  END IF;

  IF v_realizado < v_op.quantidade_planejada
     AND BTRIM(COALESCE(p_justificativa, '')) = '' THEN
    RAISE EXCEPTION
      'JUSTIFICATIVA_PARCIAL: A produção confirmada (%) é menor que a quantidade planejada (%). Informe o motivo para finalizar a OP com saldo parcial',
      v_realizado,
      v_op.quantidade_planejada;
  END IF;

  UPDATE public.producao_ordens_producao
     SET status = 'concluida',
         data_inicio_real = COALESCE(data_inicio_real, CURRENT_DATE),
         data_fim_real = CURRENT_DATE,
         atualizado_por_id = v_user,
         atualizado_por_nome_snapshot = v_nome,
         updated_at = NOW()
   WHERE id = v_op.id;

  UPDATE public.producao_processos
     SET status = CASE
           WHEN status = 'planejado' THEN 'em_andamento'
           ELSE status
         END,
         data_inicio_real = CASE
           WHEN status = 'planejado' THEN COALESCE(data_inicio_real, CURRENT_DATE)
           ELSE data_inicio_real
         END,
         updated_at = NOW()
   WHERE id = v_op.processo_id
     AND status = 'planejado';

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
    v_op.id,
    'op_finalizada_com_conferencia',
    v_op.status,
    'concluida',
    v_user,
    v_nome,
    NULLIF(BTRIM(p_justificativa), ''),
    jsonb_build_object(
      'apontamentos_conferidos_automaticamente', v_pendentes_conferidos,
      'apontamentos_validos', v_apontamentos_validos,
      'quantidade_planejada', v_op.quantidade_planejada,
      'quantidade_confirmada', v_realizado,
      'versao_rpc', 1
    )
  );

  RETURN jsonb_build_object(
    'ordem_producao_id', v_op.id,
    'apontamentos_conferidos', v_pendentes_conferidos,
    'apontamentos_validos', v_apontamentos_validos,
    'quantidade_planejada', v_op.quantidade_planejada,
    'quantidade_confirmada', v_realizado,
    'status', 'concluida'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalizar_ordem_producao_com_conferencia_v1(
  UUID,
  TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.finalizar_ordem_producao_com_conferencia_v1(
  UUID,
  TEXT
) TO authenticated;

COMMENT ON FUNCTION public.finalizar_ordem_producao_com_conferencia_v1(
  UUID,
  TEXT
) IS
'Confere os apontamentos pendentes vinculados à OP e finaliza a ordem na mesma transação, mantendo auditoria individual e consolidada.';

NOTIFY pgrst, 'reload schema';

COMMIT;
