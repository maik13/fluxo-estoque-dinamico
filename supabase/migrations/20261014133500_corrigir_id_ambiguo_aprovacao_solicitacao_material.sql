BEGIN;

CREATE OR REPLACE FUNCTION public.financeiro_criar_pns_da_solicitacao(
  p_solicitacao_material_id UUID,
  p_itens_ids UUID[]
)
RETURNS TABLE (id UUID, numero BIGINT, ja_existia BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_item public.solicitacao_material_itens%ROWTYPE;
  v_pn public.financeiro_necessidades%ROWTYPE;
  v_valor NUMERIC(14,2);
  v_descricao TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.permissao_individual_efetiva(auth.uid(), 'pode_solicitacao_material')
    OR public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_financeiro')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para encaminhar uma Solicitação de Material para PN.';
  END IF;

  SELECT sm.*
  INTO v_solicitacao
  FROM public.solicitacoes_material sm
  WHERE sm.id = p_solicitacao_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de Material não encontrada.';
  END IF;

  IF v_solicitacao.status <> 'aprovada' THEN
    RAISE EXCEPTION 'A Solicitação de Material precisa estar aprovada antes de gerar PN.';
  END IF;

  FOR v_item IN
    SELECT si.*
    FROM public.solicitacao_material_itens si
    WHERE si.solicitacao_material_id = p_solicitacao_material_id
      AND si.id = ANY (COALESCE(p_itens_ids, ARRAY[]::UUID[]))
    ORDER BY si.created_at, si.id
  LOOP
    SELECT fn.*
    INTO v_pn
    FROM public.financeiro_necessidades fn
    WHERE fn.solicitacao_material_item_id = v_item.id
      AND fn.origem_tipo = 'solicitacao_material';

    IF FOUND THEN
      RETURN QUERY SELECT v_pn.id, v_pn.numero, true;
      CONTINUE;
    END IF;

    SELECT COALESCE(v_item.quantidade * i.valor, NULL)
    INTO v_valor
    FROM public.items i
    WHERE i.id = v_item.item_id;

    v_descricao := 'PN da Solicitação #' || v_solicitacao.numero || ' - ' || v_item.nome_item;

    INSERT INTO public.financeiro_necessidades (
      status, origem_tipo, origem_modulo, descricao,
      solicitante_id, solicitante_nome,
      solicitacao_material_id, solicitacao_material_item_id,
      producao_projeto_id, processo_id, ordem_producao_id,
      item_id, quantidade, unidade,
      valor_estimado, estimativa_incompleta, base_estimativa,
      data_necessidade, data_prevista_desembolso,
      projeto_centro_custo,
      criado_automaticamente, criado_por_id, criado_por_nome,
      area_solicitante, especificacao, justificativa
    ) VALUES (
      'previsto', 'solicitacao_material', COALESCE(v_solicitacao.origem_modulo, 'almoxarifado'), v_descricao,
      v_solicitacao.solicitante_id, v_solicitacao.solicitante_nome,
      v_solicitacao.id, v_item.id,
      v_solicitacao.producao_projeto_id, v_solicitacao.processo_id, v_solicitacao.ordem_producao_id,
      v_item.item_id, v_item.quantidade, v_item.unidade,
      v_valor, v_valor IS NULL,
      CASE WHEN v_valor IS NULL THEN 'Estimativa pendente: item sem valor cadastrado ou avulso.' ELSE 'Quantidade solicitada x valor cadastrado do item.' END,
      v_solicitacao.data_necessidade, v_solicitacao.data_necessidade,
      COALESCE(v_solicitacao.local_origem, v_solicitacao.origem_modulo),
      true, auth.uid(), v_solicitacao.solicitante_nome,
      v_solicitacao.solicitante_nome, v_item.nome_item,
      COALESCE(v_item.observacoes, 'Necessidade identificada pelo Almoxarifado após conferência de saldo.')
    )
    RETURNING * INTO v_pn;

    INSERT INTO public.financeiro_lancamentos (
      necessidade_id, tipo, status, descricao,
      projeto_centro_custo, producao_projeto_id,
      data_prevista, valor_previsto,
      origem_tipo, origem_id, criado_por_id
    ) VALUES (
      v_pn.id, 'saida', 'previsto', v_descricao,
      v_pn.projeto_centro_custo, v_pn.producao_projeto_id,
      v_pn.data_prevista_desembolso, v_pn.valor_estimado,
      'solicitacao_material', v_solicitacao.id, auth.uid()
    );

    RETURN QUERY SELECT v_pn.id, v_pn.numero, false;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.aprovar_solicitacao_material_com_pns(
  p_solicitacao_material_id UUID,
  p_itens_ids UUID[]
)
RETURNS TABLE (id UUID, numero BIGINT, ja_existia BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_nome TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.permissao_individual_efetiva(auth.uid(), 'pode_solicitacao_material') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar Solicitação de Material.';
  END IF;

  SELECT sm.*
  INTO v_solicitacao
  FROM public.solicitacoes_material sm
  WHERE sm.id = p_solicitacao_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação de Material não encontrada.';
  END IF;

  SELECT COALESCE(p.nome, p.email, 'Usuário')
  INTO v_nome
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  UPDATE public.solicitacoes_material sm
  SET status = 'aprovada',
      aprovado_por_id = auth.uid(),
      aprovado_por_nome = COALESCE(v_nome, 'Usuário'),
      data_aprovacao = COALESCE(sm.data_aprovacao, now()),
      updated_at = now()
  WHERE sm.id = p_solicitacao_material_id;

  RETURN QUERY
  SELECT r.id, r.numero, r.ja_existia
  FROM public.financeiro_criar_pns_da_solicitacao(
    p_solicitacao_material_id,
    p_itens_ids
  ) r;
END;
$$;

COMMIT;