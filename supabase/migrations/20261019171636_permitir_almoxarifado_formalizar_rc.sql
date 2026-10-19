BEGIN;

-- Formalizar a RC é uma etapa operacional do Almoxarifado. O Financeiro
-- recebe a previsão automaticamente, mas não executa a compra em nome do
-- almoxarife.
CREATE OR REPLACE FUNCTION public.financeiro_criar_rc_da_pn(p_necessidade_id uuid)
RETURNS TABLE (id uuid, numero bigint, ja_existia boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pn public.financeiro_necessidades%ROWTYPE;
  v_solicitacao public.solicitacoes_material%ROWTYPE;
  v_item public.solicitacao_material_itens%ROWTYPE;
  v_rc public.pedidos_compra%ROWTYPE;
  v_nome text;
  v_tem_itens_lote boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.permissao_individual_efetiva(auth.uid(), 'pode_pedido_compra')
    OR public.permissao_individual_efetiva(auth.uid(), 'pode_gerenciar_financeiro')
    OR EXISTS (
      SELECT 1
      FROM public.profiles perfil
      WHERE perfil.user_id = auth.uid()
        AND perfil.tipo_usuario IN ('administrador', 'estoquista')
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para formalizar RC a partir da PN.';
  END IF;

  SELECT * INTO v_pn
  FROM public.financeiro_necessidades pn
  WHERE pn.id = p_necessidade_id
  FOR UPDATE;

  IF NOT FOUND OR v_pn.status = 'cancelado' THEN
    RAISE EXCEPTION 'PN não disponível para formalização de RC.';
  END IF;

  IF v_pn.requisicao_compra_id IS NOT NULL THEN
    SELECT * INTO v_rc FROM public.pedidos_compra rc WHERE rc.id = v_pn.requisicao_compra_id;
    RETURN QUERY SELECT v_rc.id, v_rc.numero, true;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.financeiro_necessidade_itens linha_existente
    WHERE linha_existente.necessidade_id = v_pn.id
  ) INTO v_tem_itens_lote;

  SELECT COALESCE(nome, email, 'Usuário') INTO v_nome
  FROM public.profiles perfil WHERE perfil.user_id = auth.uid();

  IF v_tem_itens_lote THEN
    INSERT INTO public.pedidos_compra (
      criado_por_id, criado_por_nome, observacoes, status, pn_origem_id,
      projeto_centro_custo, especificacao_tecnica, data_necessaria,
      conferencia_estoque, valor_estimado_cotado, status_financeiro_rc, integrar_financeiro
    ) VALUES (
      auth.uid(), COALESCE(v_nome, 'Usuário'),
      'RC formalizada a partir da PN-' || LPAD(v_pn.numero::text, 4, '0') || ' do Almoxarifado.',
      'aberto', v_pn.id,
      v_pn.projeto_centro_custo, v_pn.especificacao, v_pn.data_necessidade,
      COALESCE(v_pn.justificativa, 'Itens conferidos na PN do Almoxarifado.'),
      v_pn.valor_estimado, 'em_cotacao', true
    ) RETURNING * INTO v_rc;

    INSERT INTO public.pedido_compra_itens (pedido_id, item_id, nome_item, quantidade, item_snapshot, status)
    SELECT
      v_rc.id, linha.item_id, linha.descricao, linha.quantidade,
      linha.item_snapshot || jsonb_build_object('unidade', linha.unidade, 'valor_unitario_estimado', linha.valor_unitario_estimado),
      'pendente'
    FROM public.financeiro_necessidade_itens linha
    WHERE linha.necessidade_id = v_pn.id
    ORDER BY linha.ordem;

    RETURN QUERY SELECT v_rc.id, v_rc.numero, false;
    RETURN;
  END IF;

  IF v_pn.solicitacao_material_id IS NULL OR v_pn.solicitacao_material_item_id IS NULL THEN
    RAISE EXCEPTION 'Esta PN não possui itens para formalizar RC.';
  END IF;

  SELECT * INTO v_solicitacao
  FROM public.solicitacoes_material solicitacao
  WHERE solicitacao.id = v_pn.solicitacao_material_id;
  SELECT * INTO v_item
  FROM public.solicitacao_material_itens item_solicitacao
  WHERE item_solicitacao.id = v_pn.solicitacao_material_item_id;

  INSERT INTO public.pedidos_compra (
    criado_por_id, criado_por_nome, observacoes, estoque_id, status,
    solicitacao_material_id, solicitacao_material_numero, pn_origem_id,
    projeto_centro_custo, especificacao_tecnica, data_necessaria,
    conferencia_estoque, valor_estimado_cotado, status_financeiro_rc, integrar_financeiro
  ) VALUES (
    auth.uid(), COALESCE(v_nome, 'Usuário'),
    'RC formalizada a partir da PN-' || LPAD(v_pn.numero::text, 4, '0') || '.',
    v_solicitacao.estoque_id, 'aberto',
    v_solicitacao.id, v_solicitacao.numero, v_pn.id,
    v_pn.projeto_centro_custo, v_pn.especificacao, v_pn.data_necessidade,
    COALESCE(v_pn.justificativa, 'Conferência de estoque registrada na Solicitação de Material.'),
    v_pn.valor_estimado, 'em_cotacao', true
  ) RETURNING * INTO v_rc;

  INSERT INTO public.pedido_compra_itens (pedido_id, item_id, nome_item, quantidade, item_snapshot, status)
  VALUES (
    v_rc.id, v_item.item_id, v_item.nome_item, v_item.quantidade,
    COALESCE(v_item.item_snapshot, jsonb_build_object('nome', v_item.nome_item, 'unidade', v_item.unidade)),
    'pendente'
  );

  RETURN QUERY SELECT v_rc.id, v_rc.numero, false;
END;
$$;

REVOKE ALL ON FUNCTION public.financeiro_criar_rc_da_pn(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financeiro_criar_rc_da_pn(uuid) TO authenticated;

COMMIT;
