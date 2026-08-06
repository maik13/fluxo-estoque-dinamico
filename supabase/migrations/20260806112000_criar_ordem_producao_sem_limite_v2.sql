-- Cria uma RPC exclusiva para emissão de Ordens de Produção sem usar
-- a quantidade planejada da Etapa como teto acumulado.
--
-- A função possui nome novo para evitar que uma versão antiga de
-- criar_ordem_producao continue sendo resolvida pelo PostgREST.

BEGIN;

CREATE OR REPLACE FUNCTION public.criar_ordem_producao_sem_limite_v2(
  p_processo_id UUID,
  p_quantidade_planejada NUMERIC,
  p_data_inicio_prevista DATE,
  p_data_fim_prevista DATE,
  p_local_tipo TEXT,
  p_responsavel_id UUID DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_equipe_prevista INTEGER DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_processo public.producao_processos%ROWTYPE;
  v_id UUID;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para emitir Ordens de Produção';
  END IF;

  IF COALESCE(p_quantidade_planejada, 0) <= 0 THEN
    RAISE EXCEPTION 'A quantidade da OP deve ser maior que zero';
  END IF;

  IF p_data_inicio_prevista IS NULL
     OR p_data_fim_prevista IS NULL
     OR p_data_fim_prevista < p_data_inicio_prevista THEN
    RAISE EXCEPTION 'Informe um período planejado válido para a OP';
  END IF;

  IF p_local_tipo NOT IN ('Fábrica', 'Execução') THEN
    RAISE EXCEPTION 'Local operacional inválido';
  END IF;

  IF p_prioridade NOT IN ('baixa', 'normal', 'alta', 'urgente') THEN
    RAISE EXCEPTION 'Prioridade inválida';
  END IF;

  IF p_equipe_prevista IS NOT NULL AND p_equipe_prevista < 0 THEN
    RAISE EXCEPTION 'Equipe prevista inválida';
  END IF;

  SELECT *
    INTO v_processo
    FROM public.producao_processos
   WHERE id = p_processo_id
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Etapa não encontrada';
  END IF;

  IF v_processo.status IN ('finalizado', 'cancelado') THEN
    RAISE EXCEPTION 'Não é possível emitir OP para uma Etapa encerrada';
  END IF;

  v_nome := public.nome_usuario_producao(v_user);

  INSERT INTO public.producao_ordens_producao (
    processo_id,
    projeto_id,
    local_tipo,
    descricao,
    instrucoes,
    produto_entregavel,
    unidade_medida,
    quantidade_planejada,
    data_inicio_prevista,
    data_fim_prevista,
    responsavel_id,
    responsavel_nome_snapshot,
    equipe_prevista,
    prioridade,
    status,
    criado_por_id,
    criado_por_nome_snapshot
  ) VALUES (
    v_processo.id,
    v_processo.projeto_id,
    p_local_tipo,
    NULLIF(BTRIM(p_descricao), ''),
    NULLIF(BTRIM(p_instrucoes), ''),
    v_processo.produto_entregavel,
    v_processo.unidade_medida,
    p_quantidade_planejada,
    p_data_inicio_prevista,
    p_data_fim_prevista,
    p_responsavel_id,
    NULLIF(BTRIM(p_responsavel_nome), ''),
    p_equipe_prevista,
    p_prioridade,
    'liberada',
    v_user,
    v_nome
  )
  RETURNING id INTO v_id;

  INSERT INTO public.producao_ordem_eventos (
    ordem_producao_id,
    evento,
    novo_status,
    usuario_id,
    nome_usuario_snapshot,
    dados
  ) VALUES (
    v_id,
    'op_emitida_sem_limite_v2',
    'liberada',
    v_user,
    v_nome,
    jsonb_build_object(
      'quantidade_planejada', p_quantidade_planejada,
      'data_inicio_prevista', p_data_inicio_prevista,
      'data_fim_prevista', p_data_fim_prevista,
      'meta_etapa_referencial', v_processo.quantidade_planejada,
      'emissao_sem_limite_acumulado', TRUE,
      'versao_rpc', 2
    )
  );

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_ordem_producao_sem_limite_v2(
  UUID, NUMERIC, DATE, DATE, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.criar_ordem_producao_sem_limite_v2(
  UUID, NUMERIC, DATE, DATE, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.criar_ordem_producao_sem_limite_v2(
  UUID, NUMERIC, DATE, DATE, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT
) IS 'Emite uma OP em Etapa aberta sem limitar a soma das quantidades planejadas das demais OPs.';

NOTIFY pgrst, 'reload schema';

COMMIT;
