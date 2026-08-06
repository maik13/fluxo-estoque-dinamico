-- Permite editar dados operacionais de uma Ordem de Produção aberta.
-- Projeto, Etapa, número e status não são alterados por esta função.

BEGIN;

CREATE OR REPLACE FUNCTION public.editar_ordem_producao_v1(
  p_ordem_producao_id UUID,
  p_quantidade_planejada NUMERIC,
  p_data_inicio_prevista DATE,
  p_data_fim_prevista DATE,
  p_local_tipo TEXT,
  p_responsavel_id UUID DEFAULT NULL,
  p_responsavel_nome TEXT DEFAULT NULL,
  p_equipe_prevista INTEGER DEFAULT NULL,
  p_instrucoes TEXT DEFAULT NULL,
  p_descricao TEXT DEFAULT NULL,
  p_prioridade TEXT DEFAULT 'normal',
  p_justificativa TEXT DEFAULT NULL
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
  v_realizado NUMERIC := 0;
  v_antes JSONB;
  v_depois JSONB;
BEGIN
  IF v_user IS NULL
     OR NOT public.usuario_tem_permissao_producao('processos') THEN
    RAISE EXCEPTION 'Sem permissão para editar Ordens de Produção';
  END IF;

  IF BTRIM(COALESCE(p_justificativa, '')) = '' THEN
    RAISE EXCEPTION 'Informe o motivo da alteração da OP';
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
    INTO v_op
    FROM public.producao_ordens_producao
   WHERE id = p_ordem_producao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada';
  END IF;

  IF v_op.status NOT IN ('liberada', 'em_execucao') THEN
    RAISE EXCEPTION
      'Somente OP liberada ou em execução pode ser editada. Reabra a OP antes da edição';
  END IF;

  SELECT COALESCE(SUM(a.quantidade_produzida), 0)
    INTO v_realizado
    FROM public.producao_apontamentos a
   WHERE a.ordem_producao_id = v_op.id
     AND a.status = 'conferido';

  IF p_quantidade_planejada < v_realizado THEN
    RAISE EXCEPTION
      'A quantidade planejada não pode ser menor que a produção já confirmada. Produção confirmada: %',
      v_realizado;
  END IF;

  v_antes := jsonb_build_object(
    'quantidade_planejada', v_op.quantidade_planejada,
    'data_inicio_prevista', v_op.data_inicio_prevista,
    'data_fim_prevista', v_op.data_fim_prevista,
    'local_tipo', v_op.local_tipo,
    'responsavel_id', v_op.responsavel_id,
    'responsavel_nome_snapshot', v_op.responsavel_nome_snapshot,
    'equipe_prevista', v_op.equipe_prevista,
    'prioridade', v_op.prioridade,
    'descricao', v_op.descricao,
    'instrucoes', v_op.instrucoes
  );

  v_nome := public.nome_usuario_producao(v_user);

  UPDATE public.producao_ordens_producao
     SET quantidade_planejada = p_quantidade_planejada,
         data_inicio_prevista = p_data_inicio_prevista,
         data_fim_prevista = p_data_fim_prevista,
         local_tipo = p_local_tipo,
         responsavel_id = p_responsavel_id,
         responsavel_nome_snapshot = NULLIF(BTRIM(p_responsavel_nome), ''),
         equipe_prevista = p_equipe_prevista,
         prioridade = p_prioridade,
         descricao = NULLIF(BTRIM(p_descricao), ''),
         instrucoes = NULLIF(BTRIM(p_instrucoes), ''),
         atualizado_por_id = v_user,
         atualizado_por_nome_snapshot = v_nome,
         updated_at = NOW()
   WHERE id = v_op.id;

  v_depois := jsonb_build_object(
    'quantidade_planejada', p_quantidade_planejada,
    'data_inicio_prevista', p_data_inicio_prevista,
    'data_fim_prevista', p_data_fim_prevista,
    'local_tipo', p_local_tipo,
    'responsavel_id', p_responsavel_id,
    'responsavel_nome_snapshot', NULLIF(BTRIM(p_responsavel_nome), ''),
    'equipe_prevista', p_equipe_prevista,
    'prioridade', p_prioridade,
    'descricao', NULLIF(BTRIM(p_descricao), ''),
    'instrucoes', NULLIF(BTRIM(p_instrucoes), '')
  );

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
    'op_editada',
    v_op.status,
    v_op.status,
    v_user,
    v_nome,
    BTRIM(p_justificativa),
    jsonb_build_object(
      'valores_anteriores', v_antes,
      'valores_posteriores', v_depois,
      'quantidade_confirmada_no_momento', v_realizado,
      'versao_rpc', 1
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.editar_ordem_producao_v1(
  UUID, NUMERIC, DATE, DATE, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.editar_ordem_producao_v1(
  UUID, NUMERIC, DATE, DATE, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION public.editar_ordem_producao_v1(
  UUID, NUMERIC, DATE, DATE, TEXT, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT
) IS 'Edita dados operacionais de OP aberta, sem alterar Projeto, Etapa, número ou status, e registra auditoria antes/depois.';

NOTIFY pgrst, 'reload schema';

COMMIT;
