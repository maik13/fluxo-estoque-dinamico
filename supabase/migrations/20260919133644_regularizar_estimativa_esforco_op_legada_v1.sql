CREATE OR REPLACE FUNCTION public.regularizar_estimativa_esforco_op_v1(
  p_ordem_producao_id UUID,
  p_duracao_estimada_horas NUMERIC,
  p_equipe_prevista INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_op public.producao_ordens_producao%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para regularizar estimativa da OP';
  END IF;

  IF COALESCE(p_duracao_estimada_horas, 0) <= 0 THEN
    RAISE EXCEPTION 'Informe o tempo estimado de execução da OP em horas';
  END IF;

  IF COALESCE(p_equipe_prevista, 0) <= 0 THEN
    RAISE EXCEPTION 'Informe uma equipe necessária de pelo menos 1 pessoa';
  END IF;

  SELECT * INTO v_op
  FROM public.producao_ordens_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status = 'cancelada' THEN
    RAISE EXCEPTION 'OP cancelada não participa do progresso e não precisa de estimativa';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  UPDATE public.producao_ordens_producao
  SET duracao_estimada_horas = p_duracao_estimada_horas,
      equipe_prevista = p_equipe_prevista,
      atualizado_por_id = v_user,
      atualizado_por_nome_snapshot = v_nome,
      updated_at = NOW()
  WHERE id = v_op.id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    status_anterior,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    dados
  ) VALUES (
    v_op.id,
    'estimativa_esforco_regularizada_v1',
    v_op.status,
    v_op.status,
    v_user,
    v_nome,
    jsonb_build_object(
      'duracao_estimada_horas_anterior', v_op.duracao_estimada_horas,
      'equipe_prevista_anterior', v_op.equipe_prevista,
      'duracao_estimada_horas_nova', p_duracao_estimada_horas,
      'equipe_prevista_nova', p_equipe_prevista,
      'esforco_estimado_horas_homem',
        p_duracao_estimada_horas * p_equipe_prevista
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.regularizar_estimativa_esforco_op_v1(UUID, NUMERIC, INTEGER)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.regularizar_estimativa_esforco_op_v1(UUID, NUMERIC, INTEGER)
TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
